# Writing Room review — 6 November 2026

## Fixed during review

- Restoring a backup now replaces an open editor without trying to capture into a missing entry. The restored notebook is committed to disk before replacing the active library; a rejected save leaves the current notebook intact.
- Reattaching a detached footnote creates an inline numbered reference, rather than a generic annotation mark. Undo restores its detached state.
- Body annotation actions explicitly select the body undo context. Clicking an annotated whole paragraph no longer interrupts writing with a note dialog; its note remains editable in the sidebar.
- Title, description, entry type, dates and connections correctly mark unpublished changes. Published demo status remains correct after reopening an entry.

## Verification

All 15 tests pass: 11 document/schema tests plus four controller regressions for restore success/failure, footnote reattachment/undo and metadata cursor/status stability. Build passes. Public CSS, application JavaScript and theme remain byte-identical to the canonical website source.

Browser review used a separate database copy on port 4323. Checked uninterrupted writing across paragraphs, individual letter input, formatting toggles, selected-word notes, footnotes, revisions, connected ideas, demo snapshot saving and draft isolation, desktop/mobile reading layouts, revision visibility and footnote forward/return links. No browser console errors appeared in this flow. Separate API checks confirmed stale writes and invalid empty notebooks are rejected without replacing the saved version.

The real notebook was not edited by these tests. Screenshots use review-only writing.

## Next milestone and limits

The current publish button still saves a local demonstration snapshot. Homepage/index content and public catalogue generation are the next integration stage; the writing editor is not yet a production publishing system. Add public output from published snapshots only, connect homepage/index/related routes to that catalogue, and implement actual publication history before hosting the admin service. Native mobile keyboards and OS IME composition still require hands-on testing; desktop Unicode checks are not equivalent to device testing.
