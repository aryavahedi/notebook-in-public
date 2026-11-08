import importlib.util
import io
import pathlib
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('update_website', pathlib.Path(__file__).with_name('update-website.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def archive(extra=None):
    files = {name: b'' for name in exporter.FILES}
    files['index.html'] = b'<body data-content-source="published">'
    files['content/published.json'] = b'{"entries":[]}'
    files.update(extra or {})
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as target:
        for name, content in files.items():
            target.writestr(name, content)
    return output.getvalue()


class ExportTests(unittest.TestCase):
    def test_accepts_published_site_and_bundled_assets(self):
        files, count = exporter.validate_archive(archive({'assets/font.ttf': b'font'}))
        self.assertEqual(count, 0)
        self.assertEqual(files['assets/font.ttf'], b'font')
        self.assertEqual(files['.nojekyll'], b'')

    def test_refuses_private_notebook_or_editor_payloads(self):
        for name in ['notebook-data/notebook.sqlite3', 'editor-prototype/index.html', 'backup.json']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                exporter.validate_archive(archive({name: b'private'}))

    def test_refuses_paths_outside_the_export(self):
        for name in ['../private.json', '/tmp/private.json', 'assets/../../private.json']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                exporter.validate_archive(archive({name: b'private'}))


if __name__ == '__main__':
    unittest.main()
