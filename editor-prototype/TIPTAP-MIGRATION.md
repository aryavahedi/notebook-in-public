# Tiptap migration — 6 November 2026

The active writing engine is now Tiptap 3.33.0, using its ProseMirror document model, selection handling, mark commands and undo/redo. The previous `visual-editor.js` and `metadata-editor.js` are retained as historical source but are no longer loaded.

## Preserved behavior

- Body paragraphs, title and description use Tiptap editors.
- Existing library entries, images, side-note headings, dated revisions and connected ideas remain in the current data model.
- A custom inline footnote node holds the reference ID. The public renderer assigns sequential reading numbers.
- Bold and italic are true toggle commands. Undo/redo apply to the focused editor. Structural actions such as moving/removing a paragraph retain the existing separate controls.
- Links can be inserted, edited and removed through the link dialog.
- The writing surface keeps the established typography and has no enclosing focus border.
- No heading/list/quote controls were restored; those were explicitly reverted.

## Content compatibility

Legacy text is parsed when an entry opens. On editing, a paragraph stores a Tiptap `richDoc` JSON document, a portable `text` representation and `richSource`. The exact JSON document is authoritative whenever `richSource` matches `text`. Older insertion/removal tools can update text; the next render reparses it rather than using stale JSON. The website preview uses the bundled Tiptap schema to render structured documents, then resolves footnote references using the existing reading navigation.

The library and server store these fields without dropping annotations. Exported notebook backups retain structured content. Previous exports remain readable.

A SQLite backup was taken before migration at `../notebook-data/before-tiptap.sqlite3`. This file is private local data and is excluded from the distributable prototype.

## Build and run

Dependencies are locked in package-lock.json. Run `npm ci`, then `npm run build` from this folder to regenerate tiptap-editor.js. The bundle is shipped locally; no CDN request is needed to type. Start `python3 server.py --port 4321` for disk saving.

## Validation

Checked in an isolated local database: uninterrupted title/body/description typing; bold and italic on/off; undo/redo; legacy footnote migration; inserted footnotes and linked reading references; links; reopening structured paragraphs; and new library entries. Publishing remains a local demo. Undo history is per editor instance and does not persist across reopening or structural rerenders.
