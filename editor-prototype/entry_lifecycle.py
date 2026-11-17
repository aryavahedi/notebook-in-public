"""Recoverable deletion without releasing identities, folios or publication history."""
from copy import deepcopy
from datetime import datetime, timezone


def change_entry_state(book, entry_id, action, active_id=None):
    updated = deepcopy(book)
    entry = next((e for e in updated['entries'] if e['entryId'] == entry_id), None)
    if entry is None:
        raise ValueError('Entry not found.')
    if action == 'trash':
        if (entry.get('publication') or {}).get('status') == 'published':
            raise ValueError('Unpublish this page before moving it to Trash.')
        entry.setdefault('trashedAt', datetime.now(timezone.utc).isoformat(timespec='seconds'))
    elif action == 'restore':
        entry.pop('trashedAt', None)
    else:
        raise ValueError('Unknown entry action.')
    available = [e for e in updated['entries'] if not e.get('trashedAt')]
    active = next((e for e in available if e['entryId'] == active_id), None)
    updated['activeId'] = active['entryId'] if active else available[0]['entryId'] if available else None
    return updated
