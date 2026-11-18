"""Manage Trash and retain stable entry IDs after permanent deletion."""
from copy import deepcopy
from datetime import datetime, timezone


def change_entry_state(book, entry_id, action, active_id=None, confirm_delete=False):
    updated = deepcopy(book)
    entry = next((e for e in updated['entries'] if e['entryId'] == entry_id), None)
    if entry is None:
        raise ValueError('Entry not found.')
    if entry.get('deletedAt'):
        raise ValueError('This entry has already been deleted.')
    if action == 'trash':
        if (entry.get('publication') or {}).get('status') == 'published':
            raise ValueError('Unpublish this page before moving it to Trash.')
        entry.setdefault('trashedAt', datetime.now(timezone.utc).isoformat(timespec='seconds'))
    elif action == 'restore':
        entry.pop('trashedAt', None)
    elif action == 'delete':
        if not entry.get('trashedAt') or (entry.get('publication') or {}).get('status') == 'published':
            raise ValueError('Move an unpublished entry to Trash before deleting it permanently.')
        if confirm_delete is not True:
            raise ValueError('Confirm permanent deletion of this entry first.')
        # Keep the old ID for links and the historical folio for reference.
        # Allocation skips permanently deleted records.
        reservation = {key: deepcopy(entry[key]) for key in ('entryId', 'type', 'folioNumbers', 'folioNumber', 'folioType') if key in entry}
        entry.clear()
        entry.update(reservation, schemaVersion=2, title='', description='', trashedAt=True,
                     deletedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'), connected=[],
                     body={'type': 'doc', 'attrs': {'annotations': {}}, 'content': [{'type': 'paragraph', 'content': []}]})
        for other in updated['entries']:
            other['connected'] = [key for key in other.get('connected', []) if key != entry_id]
    else:
        raise ValueError('Unknown entry action.')
    available = [e for e in updated['entries'] if not e.get('trashedAt')]
    active = next((e for e in available if e['entryId'] == active_id), None)
    updated['activeId'] = active['entryId'] if active else available[0]['entryId'] if available else None
    return updated
