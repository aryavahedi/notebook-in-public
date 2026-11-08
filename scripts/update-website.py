#!/usr/bin/env python3
"""Refresh only published website files; --publish explicitly commits and pushes docs/."""
import argparse
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
from urllib.parse import urlsplit
from urllib.request import urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = {'index.html', 'styles.css', 'theme.js', 'app.js', 'preview-content.css',
         'preview-adapter.js', 'continuous-reader.js', 'content/published.json', '.nojekyll'}


def validate_archive(raw):
    files = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 50_000_000:
            raise ValueError('Website export exceeds 50 MB.')
        for item in archive.infolist():
            if item.is_dir():
                continue
            name = item.filename
            path = PurePosixPath(name)
            if (path.is_absolute() or '..' in path.parts or '\\' in name or
                    path.as_posix() != name or name in files or
                    ((item.external_attr >> 16) & 0o170000) == 0o120000 or
                    not (name in FILES or name.startswith('assets/'))):
                raise ValueError(f'Unexpected file in website export: {name}')
            files[name] = archive.read(item)
    if not (FILES - {'.nojekyll'}).issubset(files):
        raise ValueError('The website export is incomplete.')
    packet = json.loads(files['content/published.json'])
    if not isinstance(packet.get('entries'), list):
        raise ValueError('The published content catalogue is invalid.')
    if b'data-content-source="published"' not in files['index.html']:
        raise ValueError('This is not a published website export.')
    files['.nojekyll'] = b''
    return files, len(packet['entries'])


def replace_website(files):
    # Swap complete generated folders so a failed download never leaves a half-written site.
    temporary = Path(tempfile.mkdtemp(prefix='.public-export-', dir=ROOT))
    previous = ROOT / '.previous-public-export'
    target = ROOT / 'docs'
    try:
        for name, data in files.items():
            path = temporary / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        if previous.exists():
            raise ValueError('A previous export recovery folder exists. Restore or rename it first.')
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


def publish():
    def git(*args, **kwargs):
        return subprocess.run(['git', *args], cwd=ROOT, check=True, **kwargs)
    staged = git('diff', '--cached', '--name-only', capture_output=True, text=True).stdout
    if staged.strip():
        raise ValueError('Commit or unstage your existing changes before publishing the website.')
    git('add', '--', 'docs')
    changed = git('diff', '--cached', '--name-only', capture_output=True, text=True).stdout
    if changed.strip():
        git('commit', '-m', 'Update published notebook', '--', 'docs')
    git('push', 'origin', 'main')
    print('Sent to GitHub. Pages will deploy the updated website.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:4321', help='Running local Writing Room URL')
    parser.add_argument('--publish', action='store_true', help='Commit docs/ and push to GitHub after export')
    args = parser.parse_args()
    url = urlsplit(args.url)
    if url.scheme != 'http' or url.hostname not in ('localhost', '127.0.0.1') or url.username or url.password:
        parser.error('Use the local Writing Room URL, for example http://localhost:4321')
    try:
        with urlopen(args.url.rstrip('/') + '/api/export-website', timeout=30) as response:
            raw = response.read(50_000_001)
        if len(raw) > 50_000_000:
            raise ValueError('Website export exceeds 50 MB.')
        files, count = validate_archive(raw)
        replace_website(files)
        print(f'Prepared {count} published entries in docs/. Private drafts stay on your Mac.')
        if args.publish:
            publish()
        else:
            print('Review the website, then use --publish to commit and send it to GitHub.')
    except Exception as error:
        parser.exit(1, f'Could not update the website: {error}\n')


if __name__ == '__main__':
    main()
