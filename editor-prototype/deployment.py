"""Persistent, single-flight publication of immutable public exports to GitHub Pages."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile

REPOSITORY = 'aryavahedi/notebook-in-public'
WEBSITE = 'https://aryavahedi.github.io/notebook-in-public/'
ACTIVE = {'queued', 'preparing', 'pushing', 'deploying'}
PUBLIC_FILES = {'index.html', 'styles.css', 'theme.js', 'app.js', 'preview-content.css',
                'preview-adapter.js', 'continuous-reader.js', 'content/published.json', '.nojekyll'}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def signatures(entries):
    # Connections are filtered against available pages in the public catalogue.
    return {entry['entryId']: hashlib.sha256(json.dumps(
        {k: v for k, v in entry.items() if k != 'connected'}, sort_keys=True).encode()).hexdigest()
        for entry in entries}


def validate_files(files):
    if not (PUBLIC_FILES - {'.nojekyll'}).issubset(files):
        raise ValueError('The website export is incomplete. Rebuild the project before publishing.')
    for name in files:
        path = PurePosixPath(name)
        if (path.is_absolute() or '..' in path.parts or '\\' in name or path.as_posix() != name or
                not (name in PUBLIC_FILES or name.startswith('assets/'))):
            raise ValueError('Only published website files can be sent to GitHub.')
    if b'data-content-source="published"' not in files['index.html']:
        raise ValueError('This is not a published website export.')
    packet = json.loads(files['content/published.json'])
    if not isinstance(packet.get('entries'), list):
        raise ValueError('The published catalogue is invalid.')
    return packet


class Deployments:
    def __init__(self, data, repository, run=None, pause=time.sleep):
        self.data, self.repository = Path(data), Path(repository) if repository else None
        self.data.mkdir(parents=True, exist_ok=True)
        self.state_path = self.data / 'website-deployment.json'
        self.export_path = self.data / 'pending-website.zip'
        self.lock = threading.RLock()
        self.pause = pause
        self.run = run or self._run
        self.state = {'job': None, 'live': None, 'checking': False}
        self.thread = None
        try:
            self.state.update(json.loads(self.state_path.read_text()))
        except (OSError, ValueError):
            pass

    @property
    def enabled(self):
        return bool(self.repository and (self.repository / '.git').is_dir())

    def _save(self):
        temporary = self.state_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(self.state))
        temporary.replace(self.state_path)

    def snapshot(self):
        with self.lock:
            return {**deepcopy(self.state), 'enabled': self.enabled, 'websiteURL': WEBSITE,
                    'repository': REPOSITORY}

    def _run(self, args, timeout=60, check=True):
        env = {**os.environ, 'GH_PROMPT_DISABLED': '1', 'GIT_TERMINAL_PROMPT': '0'}
        try:
            result = subprocess.run(args, cwd=self.repository, env=env,
                                    capture_output=True, text=True, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise ValueError('Could not connect to GitHub. Your writing is saved on this Mac; retry when connected.') from error
        if check and result.returncode:
            raise ValueError('GitHub could not complete this step. Check your connection and GitHub sign-in, then retry. Your writing is saved on this Mac.')
        return result

    def git(self, *args, **kwargs):
        return self.run(['git', *args], **kwargs)

    def api(self, endpoint):
        return json.loads(self.run(['gh', 'api', f'repos/{REPOSITORY}/{endpoint}']).stdout)

    def _validate_repository(self):
        if not self.enabled:
            raise ValueError('Connect the local GitHub checkout before publishing online.')
        remote = self.git('remote', 'get-url', 'origin').stdout.strip()
        if remote not in (f'https://github.com/{REPOSITORY}.git', f'https://github.com/{REPOSITORY}',
                          f'git@github.com:{REPOSITORY}.git'):
            raise ValueError('The connected repository does not match this website.')
        if self.git('branch', '--show-current').stdout.strip() != 'main':
            raise ValueError('Switch the website repository to its main branch before publishing.')

    def start(self):
        with self.lock:
            if (self.state.get('job') or {}).get('status') in ACTIVE:
                self._launch()
            elif self.enabled:
                self.refresh()

    def refresh(self):
        with self.lock:
            if self.thread and self.thread.is_alive():
                return
            self.state['checking'] = True
            self.thread = threading.Thread(target=self._check_live, daemon=True)
            self.thread.start()

    def _check_live(self):
        try:
            self._validate_repository()
            builds = self.api('pages/builds?per_page=10')
            built = next((build for build in builds if build['status'] == 'built'), None)
            if built:
                raw = self.git('show', built['commit'] + ':docs/content/published.json').stdout
                with self.lock:
                    self.state['live'] = {'commit': built['commit'], 'at': built.get('updated_at') or now(),
                                          'entries': signatures(json.loads(raw)['entries'])}
                    self.state.pop('checkError', None)
        except (ValueError, KeyError):
            with self.lock:
                self.state['checkError'] = 'Could not verify the live website. Check your connection and retry.'
        finally:
            with self.lock:
                self.state['checking'] = False
                self._save()

    def busy(self):
        return (self.state.get('job') or {}).get('status') in ACTIVE

    def enqueue(self, files, entry_id, action):
        with self.lock:
            if self.busy():
                raise ValueError('A website update is already being sent. You can keep writing while it finishes.')
            if self.state.get('checking'):
                raise ValueError('The website connection is being checked. Try publishing again in a moment.')
            packet = validate_files(files)
            files = {**files, '.nojekyll': b''}
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
                for name, raw in files.items():
                    archive.writestr(name, raw)
            temporary = self.export_path.with_suffix('.tmp')
            temporary.write_bytes(output.getvalue())
            temporary.replace(self.export_path)
            self.state['job'] = {'id': uuid.uuid4().hex, 'entryId': entry_id, 'action': action,
                                 'status': 'queued', 'createdAt': now(), 'message': 'Preparing your website…',
                                 'entries': signatures(packet['entries'])}
            self._save()
            self._launch()
            return self.snapshot()

    def retry(self, job_id):
        with self.lock:
            job = self.state.get('job')
            if not job or job['id'] != job_id or job['status'] != 'error':
                raise ValueError('There is no failed update to retry.')
            job.update(status='queued', message='Retrying your saved website update…')
            job.pop('error', None)
            self._save()
            self._launch()
            return self.snapshot()

    def _launch(self):
        self.thread = threading.Thread(target=self._work, daemon=True)
        self.thread.start()

    def _update(self, **values):
        with self.lock:
            self.state['job'].update(values)
            self._save()

    def _finish(self, commit):
        with self.lock:
            self.state['live'] = {'commit': commit, 'at': now(),
                                  'entries': deepcopy(self.state['job']['entries'])}
            self.state['job'].update(status='live', commit=commit, message='Your website is live.', completedAt=now())
            self.state.pop('checkError', None)
            self._save()

    def _replace_docs(self, files):
        temporary = Path(tempfile.mkdtemp(prefix='.public-export-', dir=self.repository))
        previous = self.repository / '.previous-public-export'
        target = self.repository / 'docs'
        try:
            # Recover a folder swap interrupted by a server restart.
            if previous.exists() and not target.exists():
                previous.rename(target)
            elif previous.exists():
                shutil.rmtree(previous)
            for name, raw in files.items():
                path = temporary / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            if target.exists():
                target.rename(previous)
            try:
                temporary.rename(target)
            except Exception:
                if previous.exists():
                    previous.rename(target)
                raise
            if previous.exists():
                shutil.rmtree(previous)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)

    def _work(self):
        try:
            self._validate_repository()
            with zipfile.ZipFile(self.export_path) as archive:
                files = {item.filename: archive.read(item) for item in archive.infolist()}
            validate_files(files)
            with self.lock:
                commit = self.state['job'].get('commit')
            if not commit:
                self._update(status='preparing', message='Preparing the published pages…')
                self.git('fetch', 'origin', 'main')
                # No force pushes or automatic merges of diverging histories.
                self.git('merge', '--ff-only', 'origin/main')
                self._replace_docs(files)
                self.git('add', '--', 'docs')
                changed = self.git('diff', '--cached', '--quiet', '--', 'docs', check=False).returncode
                if changed:
                    self.git('commit', '-m', 'Publish website from the Writing Room', '--only', '--', 'docs')
                else:
                    built = self.api('pages/builds/latest')
                    if built['status'] == 'built' and self.git('diff', '--quiet', built['commit'], '--', 'docs', check=False).returncode == 0:
                        self._finish(built['commit'])
                        return
                commit = self.git('rev-parse', 'HEAD').stdout.strip()
                self._update(commit=commit)
            self._update(status='pushing', message='Sending your published pages to GitHub…')
            # Use the existing GitHub sign-in. No token enters the browser or the export.
            self.git('-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential',
                     'push', f'https://github.com/{REPOSITORY}.git', f'{commit}:refs/heads/main')
            self._update(status='deploying', message='GitHub is deploying your website. You can keep writing.')
            for _ in range(150):
                build = self.api('pages/builds/latest')
                if build.get('commit') == commit:
                    if build['status'] == 'built':
                        self._finish(commit)
                        return
                    if build['status'] == 'errored':
                        raise ValueError('GitHub could not deploy this update. Your draft and the previous live website are safe. Retry publishing.')
                self.pause(4)
            raise ValueError('GitHub is taking longer than usual. Retry to check this same update; your writing is saved.')
        except Exception as error:
            message = str(error) if isinstance(error, ValueError) else 'Could not complete the website update. Your writing is saved on this Mac. Retry publishing.'
            self._update(status='error', message=message, error=message)
