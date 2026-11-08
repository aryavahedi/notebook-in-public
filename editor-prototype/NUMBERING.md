# Folio numbering

Each category has an independent publication sequence:

- Essays: e. 1, e. 2, e. 3…
- Notes: n. 1, n. 2, n. 3…
- Sketches: s. 1, s. 2, s. 3…

A number is assigned on first publication. Drafts display e./n./s. Draft and do not consume a number. Updates, withdrawal and republication retain the assigned number. Numbers have no leading zeros and continue through 1000 and beyond.

Paragraph references include the category and entry number: e.2.3 is the third prose paragraph in essay e. 2. Unpublished drafts use ¶1, ¶2, etc. Headings, lists, images and tables do not consume prose paragraph numbers; prose inside quotes does.

The internal entry ID is independent of the displayed folio. Existing /entry/043 links and connected-entry IDs remain unchanged even when their display label becomes e. 2. Published entries were migrated in first-publication order without altering their text, connections, publication events or version counts. Draft content was preserved.

If an entry changes category, its next publication receives a number from the new category; its earlier allocation remains reserved. Changing back reuses that entry's earlier category number. Numbers are never recycled merely because a page is unpublished.

The server stores per-entry folioNumbers reservations and puts folioNumber in the published snapshot. UI helpers in editor-src/folio.js render the same labels in the editor, index, article, sketch preview and related links. Server-side allocation occurs inside the publication transaction, so two windows cannot assign the same number concurrently.

A pre-migration backup is retained at ../notebook-data/before-per-type-numbering.sqlite3. The migration is idempotent and also handles older notebook restores.

Validation: 32 checks pass (23 JavaScript and 9 Python), including category independence, drafts not consuming numbers, updates, withdrawal, type changes, migration preservation/idempotence, and numbering beyond 999.
