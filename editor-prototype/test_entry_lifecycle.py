import unittest
from copy import deepcopy
from entry_lifecycle import change_entry_state
from publishing import publish_entry, catalogue
from test_publishing import entry


class EntryLifecycleTest(unittest.TestCase):
    def test_trash_and_restore_preserve_content_identity_and_number(self):
        book, _, _ = publish_entry({'entries': [entry('1'), entry('2')]}, '1')
        book, _, _ = publish_entry(book, '1', 'unpublish')
        original = deepcopy(book)
        deleted = change_entry_state(book, '1', 'trash', '1')
        self.assertEqual(book, original)
        self.assertEqual(deleted['activeId'], '2')
        self.assertTrue(deleted['entries'][0]['trashedAt'])
        for field in ['body', 'published', 'publication', 'folioNumbers', 'connected']:
            self.assertEqual(deleted['entries'][0].get(field), book['entries'][0].get(field))
        self.assertEqual(catalogue(deleted)['entries'], [])
        restored = change_entry_state(deleted, '1', 'restore', '2')
        self.assertNotIn('trashedAt', restored['entries'][0])
        self.assertEqual(restored['entries'][0]['publication']['status'], 'unpublished')
        self.assertEqual(catalogue(restored)['entries'], [])
        next_book, second, _ = publish_entry(deleted, '2')
        self.assertEqual(second['folioNumber'], 2)

    def test_live_and_trashed_entries_cannot_be_published_or_deleted_incorrectly(self):
        book, _, _ = publish_entry({'entries': [entry()]}, '041')
        with self.assertRaisesRegex(ValueError, 'Unpublish'):
            change_entry_state(book, '041', 'trash')
        draft = change_entry_state({'entries': [entry()]}, '041', 'trash')
        with self.assertRaisesRegex(ValueError, 'Restore'):
            publish_entry(draft, '041')

    def test_last_entry_can_be_trashed_and_restored_without_creating_another(self):
        book = change_entry_state({'entries': [entry()]}, '041', 'trash', '041')
        self.assertIsNone(book['activeId'])
        self.assertEqual(len(book['entries']), 1)
        self.assertEqual(change_entry_state(book, '041', 'restore')['activeId'], '041')

    def test_trash_is_never_exported_even_if_a_malformed_record_claims_published(self):
        book, _, _ = publish_entry({'entries': [entry()]}, '041')
        book['entries'][0]['trashedAt'] = '2026-11-17'
        self.assertEqual(catalogue(book)['entries'], [])

    def test_permanent_delete_removes_content_and_connections_but_reserves_numbers(self):
        book, _, _ = publish_entry({'entries': [entry('1'), entry('2')]}, '1')
        book, _, _ = publish_entry(book, '1', 'unpublish')
        book['entries'][1]['connected'] = ['1']
        trashed = change_entry_state(book, '1', 'trash', '2')
        deleted = change_entry_state(trashed, '1', 'delete', '2', confirm_delete=True)
        record = deleted['entries'][0]
        self.assertTrue(record['deletedAt'])
        self.assertEqual(record['title'], '')
        self.assertNotIn('Words for the page', str(record))
        self.assertNotIn('published', record)
        self.assertEqual(deleted['entries'][1]['connected'], [])
        self.assertEqual(deleted['activeId'], '2')
        _, next_entry, _ = publish_entry(deleted, '2')
        self.assertEqual(next_entry['folioNumber'], 2)
        with self.assertRaisesRegex(ValueError, 'already'):
            change_entry_state(deleted, '1', 'restore')
        self.assertEqual(trashed['entries'][0]['title'], 'A public thought')

    def test_permanent_delete_requires_trash_and_explicit_confirmation(self):
        book = {'entries': [entry()]}
        with self.assertRaisesRegex(ValueError, 'Trash'):
            change_entry_state(book, '041', 'delete', confirm_delete=True)
        book = change_entry_state(book, '041', 'trash')
        with self.assertRaisesRegex(ValueError, 'Confirm'):
            change_entry_state(book, '041', 'delete')
        deleted = change_entry_state(book, '041', 'delete', confirm_delete=True)
        self.assertIsNone(deleted['activeId'])
