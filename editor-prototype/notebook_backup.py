"""Verified private notebook snapshots, separate from public website exports."""
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import zipfile

FORMAT = 'living-folio-notebook-backup-v1'


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def read_notebook_backup(raw):
    """Read the structured notebook without extracting an uploaded archive to disk."""
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if len(archive.infolist()) != 3 or set(archive.namelist()) != {'notebook.sqlite3', 'notebook.json', 'manifest.json'}:
            raise ValueError('Choose a Writing Room notebook backup ZIP.')
        if archive.getinfo('manifest.json').file_size > 100_000 or archive.getinfo('notebook.json').file_size > 25_000_000:
            raise ValueError('The notebook backup is too large to import.')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('format') != FORMAT:
            raise ValueError('This backup format is not supported.')
        notebook = archive.read('notebook.json')
        if hashlib.sha256(notebook).hexdigest() != manifest['sha256']['notebook.json']:
            raise ValueError('The notebook backup is damaged. Choose another backup.')
        return json.loads(notebook)


class NotebookBackups:
    def __init__(self, database, folder, interval=3600, clock=time.time):
        self.database, self.folder = Path(database), Path(folder)
        self.interval, self.clock = interval, clock
        self.lock = threading.Lock()
        self.state_path = self.database.parent / 'backup-status.json'
        self.state = {'running': False, 'lastBackupAt': None, 'lastFile': None, 'error': None}
        self.last_check = 0
        try:
            self.state.update(json.loads(self.state_path.read_text()))
        except (OSError, ValueError):
            pass
        self.state['running'] = False

    def status(self):
        with self.lock:
            return {k: v for k, v in self.state.items() if k != 'contentDigest'}

    def _save(self):
        temporary = self.state_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(self.state))
        temporary.replace(self.state_path)

    def latest_path(self):
        name = self.state.get('lastFile')
        if name and Path(name).name == name:
            path = self.folder / name
            if path.is_file():
                return path
        return None

    def create(self, force=False, reason='automatic'):
        with self.lock:
            if self.state['running']:
                return None
            self.state.update(running=True, error=None)
        try:
            self.folder.mkdir(mode=0o700, parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='.creating-', dir=self.folder) as temporary:
                temporary = Path(temporary)
                database = temporary / 'notebook.sqlite3'
                with sqlite3.connect(self.database) as source, sqlite3.connect(database) as target:
                    source.backup(target, pages=256, sleep=.01)
                with sqlite3.connect(database) as snapshot:
                    if snapshot.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise ValueError('The notebook could not be verified.')
                    row = snapshot.execute('SELECT revision,content FROM versions ORDER BY revision DESC LIMIT 1').fetchone()
                    if not row:
                        return None
                    revision, raw = row
                    book = json.loads(raw)
                    versions = snapshot.execute('SELECT COUNT(*) FROM versions').fetchone()[0]
                notebook = temporary / 'notebook.json'
                notebook.write_text(json.dumps(book, ensure_ascii=False, sort_keys=True, indent=2))
                content_digest = digest(notebook)
                if not force and self.latest_path() and content_digest == self.state.get('contentDigest'):
                    return self.latest_path()
                created = datetime.fromtimestamp(self.clock(), ZoneInfo('Europe/Amsterdam'))
                manifest = {'format': FORMAT, 'createdAt': created.isoformat(), 'reason': reason,
                            'revision': revision, 'savedVersions': versions, 'entries': len(book['entries']),
                            'sha256': {'notebook.sqlite3': digest(database), 'notebook.json': content_digest}}
                (temporary / 'manifest.json').write_text(json.dumps(manifest, indent=2))
                archive_path = temporary / 'backup.zip'
                with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
                    for name in ['notebook.sqlite3', 'notebook.json', 'manifest.json']:
                        archive.write(temporary / name, name)
                # Verify every stored byte before this file becomes a visible recovery point.
                with zipfile.ZipFile(archive_path) as archive:
                    if archive.testzip() is not None:
                        raise ValueError('The backup archive could not be verified.')
                    for name, expected in manifest['sha256'].items():
                        value = hashlib.sha256()
                        with archive.open(name) as source:
                            for block in iter(lambda: source.read(1024 * 1024), b''):
                                value.update(block)
                        if value.hexdigest() != expected:
                            raise ValueError('The backup checksum did not match.')
                name = f"notebook-{created.strftime('%Y-%m-%d_%H-%M-%S-%f')}-r{revision}.zip"
                final = self.folder / name
                archive_path.replace(final)
                final.chmod(0o600)
                with self.lock:
                    self.state.update(lastBackupAt=created.isoformat(), lastFile=name, contentDigest=content_digest)
                self._prune()
                return final
        except Exception:
            with self.lock:
                self.state['error'] = 'Could not create a verified backup. Your saved notebook is unchanged. Check free disk space and try again.'
            return None
        finally:
            with self.lock:
                self.state['running'] = False
                self.last_check = self.clock()
                self._save()

    def _prune(self):
        automatic = []
        for path in sorted(self.folder.glob('notebook-*.zip'), reverse=True):
            try:
                with zipfile.ZipFile(path) as archive:
                    record = json.loads(archive.read('manifest.json'))
                if record.get('format') == FORMAT and record.get('reason') in ('automatic', 'startup'):
                    automatic.append((path, record['createdAt'][:10]))
            except (OSError, ValueError, KeyError, zipfile.BadZipFile):
                continue
        # Keep 24 recent hourly points plus one per day for 30 days. Manual/pre-restore points stay.
        keep = {path for path, _ in automatic[:24]}
        daily = {}
        for path, date in automatic:
            daily.setdefault(date, path)
        keep.update(list(daily.values())[:30])
        for path, _ in automatic:
            if path not in keep:
                try:path.unlink()
                except OSError:pass  # Keep extra recovery points if cleanup is unavailable.

    def request(self, force=False, reason='manual'):
        with self.lock:
            if self.state['running']:
                return
        threading.Thread(target=self.create, kwargs={'force': force, 'reason': reason}, daemon=True).start()

    def start(self):
        self.request(reason='startup')
        def periodic():
            while True:
                time.sleep(60)
                if self.clock() - self.last_check >= self.interval:
                    self.request(reason='automatic')
        threading.Thread(target=periodic, daemon=True).start()
