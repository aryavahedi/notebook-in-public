from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import zipfile
from notebook_backup import FORMAT, NotebookBackups, read_notebook_backup


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.database = root / 'notebook-data/notebook.sqlite3'
        self.database.parent.mkdir()
        self.book = {'entries': [{'entryId': '049', 'title': 'Private draft', 'body': {'type': 'doc', 'attrs': {'annotations': {'n': {'kind': 'side', 'text': 'Private note'}}}}, 'published': {'title': 'Earlier public version'}, 'connected': ['043']}], 'activeId': '049'}
        with sqlite3.connect(self.database) as db:
            db.execute('CREATE TABLE versions(revision INTEGER PRIMARY KEY, content TEXT)')
            db.execute('INSERT INTO versions VALUES(1,?)', (json.dumps(self.book),))
            db.execute('INSERT INTO versions VALUES(2,?)', (json.dumps(self.book),))
        self.timestamp = 1_800_000_000
        self.manager = NotebookBackups(self.database, root / 'notebook-backups', clock=lambda: self.timestamp)

    def tearDown(self):
        self.temp.cleanup()

    def test_full_history_and_all_notebook_features_round_trip_into_isolated_database(self):
        path = self.manager.create(force=True, reason='manual')
        self.assertEqual(read_notebook_backup(path.read_bytes()), self.book)
        restored = Path(self.temp.name) / 'restored.sqlite3'
        with zipfile.ZipFile(path) as archive:
            restored.write_bytes(archive.read('notebook.sqlite3'))
            manifest = json.loads(archive.read('manifest.json'))
            self.assertEqual(manifest['savedVersions'], 2)
            self.assertEqual(manifest['revision'], 2)
            self.assertEqual(hashlib.sha256(restored.read_bytes()).hexdigest(), manifest['sha256']['notebook.sqlite3'])
        with sqlite3.connect(restored) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            rows = db.execute('SELECT content FROM versions ORDER BY revision').fetchall()
            self.assertEqual(len(rows), 2)
            self.assertEqual(json.loads(rows[-1][0]), self.book)

    def test_unchanged_automatic_backup_is_skipped_but_changed_writing_is_saved(self):
        first = self.manager.create(reason='startup')
        self.timestamp += 3600
        self.assertEqual(self.manager.create(), first)
        self.assertEqual(len(list(self.manager.folder.glob('*.zip'))), 1)
        self.book['entries'][0]['title'] = 'New private writing'
        with sqlite3.connect(self.database) as db:
            db.execute('INSERT INTO versions VALUES(3,?)', (json.dumps(self.book),))
        second = self.manager.create()
        self.assertNotEqual(first, second)
        self.assertEqual(read_notebook_backup(second.read_bytes()), self.book)

    def test_failed_backup_preserves_previous_recovery_point(self):
        first = self.manager.create(force=True)
        expected = first.read_bytes()
        self.database.write_bytes(b'not a database')
        self.assertIsNone(self.manager.create(force=True))
        self.assertEqual(self.manager.latest_path(), first)
        self.assertEqual(first.read_bytes(), expected)
        self.assertIn('Could not create', self.manager.status()['error'])

    def test_import_rejects_corrupted_json_and_foreign_archives(self):
        path = self.manager.create(force=True)
        output = io.BytesIO()
        with zipfile.ZipFile(path) as source, zipfile.ZipFile(output, 'w') as target:
            for name in source.namelist():
                target.writestr(name, b'{"entries":[]}' if name == 'notebook.json' else source.read(name))
        with self.assertRaises(ValueError):
            read_notebook_backup(output.getvalue())
        with self.assertRaises(ValueError):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as target:
                target.writestr('../notebook.json', b'{}')
            read_notebook_backup(output.getvalue())

    def test_retention_keeps_hourly_daily_and_manual_points_without_touching_other_files(self):
        self.manager.folder.mkdir()
        manual = self.manager.folder / 'notebook-manual.zip'
        foreign = self.manager.folder / 'family-backup.zip'
        foreign.write_bytes(b'keep this')
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        for index in range(60):
            path = self.manager.folder / f'notebook-{index:03}.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('manifest.json', json.dumps({'format': FORMAT, 'reason': 'automatic', 'createdAt': (start + timedelta(hours=index)).isoformat()}))
        with zipfile.ZipFile(manual, 'w') as archive:
            archive.writestr('manifest.json', json.dumps({'format': FORMAT, 'reason': 'manual', 'createdAt': start.isoformat()}))
        self.manager._prune()
        self.assertTrue(manual.exists())
        self.assertEqual(foreign.read_bytes(), b'keep this')
        remaining = list(self.manager.folder.glob('notebook-0*.zip'))
        self.assertEqual(len(remaining), 25)
        self.assertTrue((self.manager.folder / 'notebook-023.zip').exists())


if __name__ == '__main__':
    unittest.main()
