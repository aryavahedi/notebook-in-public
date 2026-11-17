"""Build a small macOS launcher pointing to this Mac's existing Writing Room."""
from pathlib import Path
import plistlib
import shlex
import sys

root = Path(__file__).resolve().parents[1]
app = root / 'Writing Room.app'
executable = app / 'Contents/MacOS/WritingRoom'
executable.parent.mkdir(parents=True, exist_ok=True)
(app / 'Contents/Info.plist').write_bytes(plistlib.dumps({
    'CFBundleExecutable': 'WritingRoom', 'CFBundleIdentifier': 'personal.arya.writingroom',
    'CFBundleName': 'Writing Room', 'CFBundleDisplayName': 'Writing Room',
    'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1', 'LSUIElement': True,
    'NSHighResolutionCapable': True,
}))
executable.write_text('#!/bin/sh\nexec ' + shlex.quote(sys.executable) + ' ' +
                      shlex.quote(str(root / 'editor-prototype/launcher.py')) +
                      ' --workspace ' + shlex.quote(str(root)) + '\n')
executable.chmod(0o755)
print(app)
