import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
import zipfile
from deployment import Deployments, PUBLIC_FILES, REPOSITORY, signatures, validate_files


def files():
    result = {name: b'' for name in PUBLIC_FILES}
    result['index.html'] = b'<body data-content-source="published">'
    result['content/published.json'] = json.dumps({'entries': [{'entryId': '049', 'title': 'Public', 'body': {'type': 'doc'}, 'publication': {'version': 4}}]}).encode()
    return result


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.repository = root / 'repository'
        (self.repository / '.git').mkdir(parents=True)
        self.manager = Deployments(root / 'private', self.repository, pause=lambda _: None)
        self.manager._launch = lambda: None

    def tearDown(self):
        self.temp.cleanup()

    def test_exports_are_frozen_and_resume_after_restart(self):
        source = files()
        self.manager.enqueue(source, '049', 'publish')
        source['content/published.json'] = b'PRIVATE LATER DRAFT'
        with zipfile.ZipFile(self.manager.export_path) as archive:
            self.assertNotIn(b'PRIVATE LATER DRAFT', archive.read('content/published.json'))
        resumed = Deployments(self.manager.data, self.repository)
        calls = []
        resumed._launch = lambda: calls.append('resume')
        resumed.start()
        self.assertEqual(calls, ['resume'])
        self.assertEqual(resumed.snapshot()['job']['entryId'], '049')

    def test_rejects_concurrent_updates_and_private_payloads(self):
        self.manager.enqueue(files(), '049', 'publish')
        with self.assertRaisesRegex(ValueError, 'already'):
            self.manager.enqueue(files(), '050', 'publish')
        with self.assertRaises(ValueError):
            validate_files({**files(), 'notebook-data/notebook.sqlite3': b'PRIVATE'})
        with self.assertRaises(ValueError):
            validate_files({**files(), 'assets/../../draft.json': b'PRIVATE'})

    def runner(self, fail_push=False, build_status='built'):
        calls = []
        def run(args, **kwargs):
            calls.append(args)
            text = ''
            code = 0
            if args[:4] == ['git', 'remote', 'get-url', 'origin']:
                text = f'https://github.com/{REPOSITORY}.git'
            elif args[:3] == ['git', 'branch', '--show-current']:
                text = 'main'
            elif args[:4] == ['git', 'diff', '--cached', '--quiet']:
                code = 1
            elif args[:3] == ['git', 'rev-parse', 'HEAD']:
                text = 'abc123'
            elif 'push' in args and fail_push:
                raise ValueError('Connection lost. Retry publishing.')
            elif args[:2] == ['gh', 'api']:
                text = json.dumps({'commit': 'abc123', 'status': build_status})
            return SimpleNamespace(stdout=text, returncode=code)
        return run, calls

    def test_failed_push_retries_the_same_commit_without_duplicate_revision(self):
        self.manager.enqueue(files(), '049', 'publish')
        self.manager.run, first = self.runner(fail_push=True)
        self.manager._work()
        job = self.manager.snapshot()['job']
        self.assertEqual(job['status'], 'error')
        self.assertEqual(job['commit'], 'abc123')
        self.assertEqual(sum(args[:2] == ['git', 'commit'] for args in first), 1)
        self.manager.retry(job['id'])
        self.manager.run, second = self.runner()
        self.manager._work()
        result = self.manager.snapshot()
        self.assertEqual(result['job']['status'], 'live')
        self.assertEqual(result['live']['entries'], signatures(json.loads(files()['content/published.json'])['entries']))
        self.assertFalse(any(args[:2] == ['git', 'commit'] for args in second))

    def test_failed_build_preserves_previous_live_status(self):
        self.manager.state['live'] = {'commit': 'previous', 'entries': {'049': 'previous-hash'}}
        self.manager.enqueue(files(), '049', 'unpublish')
        self.manager.run, _ = self.runner(build_status='errored')
        self.manager._work()
        self.assertEqual(self.manager.snapshot()['job']['status'], 'error')
        self.assertEqual(self.manager.snapshot()['live']['commit'], 'previous')

    def test_live_check_reads_the_deployed_commit_not_the_local_checkout(self):
        def run(args, **kwargs):
            text = ''
            if args[:2] == ['gh', 'api']:
                text = json.dumps([{'commit': 'deployed', 'status': 'built'}])
            elif args[:2] == ['git', 'show']:
                self.assertEqual(args[2], 'deployed:docs/content/published.json')
                text = files()['content/published.json'].decode()
            elif args[:2] == ['git', 'remote']:
                text = f'https://github.com/{REPOSITORY}.git'
            else:
                text = 'main'
            return SimpleNamespace(stdout=text, returncode=0)
        self.manager.run = run
        self.manager._check_live()
        self.assertEqual(self.manager.snapshot()['live']['commit'], 'deployed')


if __name__ == '__main__':
    unittest.main()
