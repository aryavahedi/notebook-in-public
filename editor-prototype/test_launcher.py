from pathlib import Path
import tempfile
import unittest
from launcher import ensure_server, notebook_id


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'A project with spaces'
        (self.root / 'editor-prototype').mkdir(parents=True)
        (self.root / 'editor-prototype/server.py').touch()
        self.data = self.root / 'notebook-data'
        self.health = {'application': 'living-folio-writing-room', 'notebookId': notebook_id(self.data), 'pid': 123}

    def tearDown(self):
        self.temp.cleanup()

    def test_reuses_only_the_correct_notebook_without_launching_another_server(self):
        health, started = ensure_server(self.root, self.data, check=lambda _: self.health,
                                       spawn=lambda *a, **k: self.fail('Must reuse the running server'))
        self.assertFalse(started)
        self.assertEqual(health['pid'], 123)

    def test_refuses_another_app_or_notebook_using_the_address(self):
        for health in [{'application': 'another-app'}, {**self.health, 'notebookId': 'different'}]:
            with self.subTest(health=health), self.assertRaises(ValueError):
                ensure_server(self.root, self.data, check=lambda _: health,
                              spawn=lambda *a, **k: self.fail('Must not launch or replace anything'))

    def test_starts_with_exact_paths_and_background_log_then_waits_until_ready(self):
        probes = iter([None, None, self.health])
        calls = []
        class Process:
            def poll(self): return None
        def spawn(args, **options):
            calls.append((args, options))
            return Process()
        health, started = ensure_server(self.root, self.data, check=lambda _: next(probes), spawn=spawn, pause=lambda _: None)
        self.assertTrue(started)
        self.assertEqual(health, self.health)
        args, options = calls[0]
        self.assertEqual(args[1], str(self.root / 'editor-prototype/server.py'))
        self.assertEqual(args[-1], str(self.data))
        self.assertTrue(options['start_new_session'])
        self.assertIn('/opt/homebrew/bin', options['env']['PATH'])
        self.assertTrue((self.data / 'writing-room.log').exists())


if __name__ == '__main__':
    unittest.main()
