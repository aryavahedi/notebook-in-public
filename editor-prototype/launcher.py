"""Open this notebook, reusing its server or starting one quietly in the background."""
import argparse
import fcntl
import hashlib
import html
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser


def notebook_id(data):
    return hashlib.sha256(str((Path(data) / 'notebook.sqlite3').resolve()).encode()).hexdigest()[:20]


def probe(port):
    try:
        with urlopen(f'http://localhost:{port}/api/health', timeout=1) as response:
            return json.load(response)
    except URLError as error:
        if isinstance(error.reason, ConnectionRefusedError):
            return None
        raise ValueError('Another app may be using the Writing Room address. Close it and try again.') from error
    except (ValueError, OSError) as error:
        raise ValueError('The Writing Room address is in use by another app.') from error


def open_page(url):
    if sys.platform == 'darwin':
        subprocess.Popen(['/usr/bin/open', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        webbrowser.open(url)


def ensure_server(workspace, data, port=4321, check=probe, spawn=subprocess.Popen, pause=time.sleep):
    workspace, data = Path(workspace), Path(data)
    expected = notebook_id(data)
    def valid(current):
        if current.get('application') != 'living-folio-writing-room' or current.get('notebookId') != expected:
            raise ValueError('A different notebook or app is already using this address. Close it before opening this Writing Room.')
        return current
    current = check(port)
    if current is not None:
        return valid(current), False
    server = workspace / 'editor-prototype/server.py'
    if not server.is_file():
        raise ValueError('The Writing Room project could not be found. Recreate this launcher from the project folder.')
    data.mkdir(parents=True, exist_ok=True)
    log_path = data / 'writing-room.log'
    if log_path.exists() and log_path.stat().st_size > 2_000_000:
        log_path.replace(data / 'writing-room.previous.log')
    environment = {**os.environ, 'PYTHONUNBUFFERED': '1',
                   'PATH': '/opt/homebrew/bin:/usr/local/bin:' + os.environ.get('PATH', '')}
    with log_path.open('ab') as log:
        process = spawn([sys.executable, str(server), '--port', str(port), '--data-dir', str(data)],
                        cwd=workspace, env=environment, stdin=subprocess.DEVNULL, stdout=log,
                        stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
    for _ in range(100):
        current = check(port)
        if current is not None:
            return valid(current), True
        if process.poll() is not None:
            break
        pause(.1)
    if process.poll() is None:
        process.terminate()
    raise ValueError('The Writing Room could not start. Its diagnostic log is in the notebook-data folder.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument('--data-dir')
    parser.add_argument('--port', type=int, default=4321)
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    workspace = Path(args.workspace).resolve()
    data = Path(args.data_dir).resolve() if args.data_dir else workspace / 'notebook-data'
    data.mkdir(parents=True, exist_ok=True)
    try:
        # Two rapid opens must not launch competing copies of the saving service.
        with (data / 'launcher.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            health, started = ensure_server(workspace, data, args.port)
        url = f'http://localhost:{args.port}/?v=writing-room'
        print(json.dumps({'url': url, 'started': started, 'pid': health.get('pid')}))
        if not args.no_open:
            open_page(url)
    except Exception as error:
        if not args.no_open:
            page = data / 'launcher-error.html'
            page.write_text('<!doctype html><meta charset="utf-8"><title>Writing Room</title>'
                            '<body style="background:#F3F2ED;color:#30231F;font:20px/1.6 Georgia;max-width:650px;margin:12vh auto;padding:24px">'
                            '<h1>The Writing Room couldn’t open.</h1><p>' + html.escape(str(error)) + '</p>'
                            '<p>Your saved writing has not been replaced.</p></body>')
            open_page(page.as_uri())
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
