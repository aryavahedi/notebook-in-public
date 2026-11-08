# Continuous Writing Room — November 2026

The active controller is `editor-src/continuous.js`, bundled to `continuous-editor.js`. The old layered controllers remain as reference but are not loaded. `editor-src/document.js` defines the shared schema and migration; `editor-src/reader.js` renders the preview.

## Content and persistence

Entry schema version 2 stores one authoritative Tiptap JSON document in `body`. Document attributes hold annotation records. Inline footnote nodes, annotation marks and stable block attributes anchor records to the writing. Paragraph numbers are derived decorations, never attachment identifiers. Legacy `paragraphs` and `notes` are emptied after migration; original data remains in the pre-migration database backup and earlier database versions. Published snapshots are migrated separately. Migration returns version 2 entries unchanged.

The existing loopback-only Python server stores full notebook snapshots transactionally with optimistic revision checks. The client debounces body capture and disk writes by 650ms; it does not serialize the notebook on every keystroke. Errors keep pending work and show retry/backup actions. Backup exports include full structured documents and published snapshots. Restore validates the document schema before replacing the library. The database backup before this migration is `../notebook-data/before-continuous-editor.sqlite3`, excluded from downloadable files.

## Editing

One Tiptap instance owns the entire body and undo/redo history. Plain metadata uses native textareas with native input history. Standard input rules format headings, lists, quotes and inline marks as you type. Insert exposes tables, checklists, images, code, links and annotations. Paste as Markdown imports standard Markdown; notebook JSON is the full-fidelity format for custom annotations. Click an image to update its caption, alt text or file.

Selected text gets an annotation mark; an empty selection attaches side notes/revisions to the current paragraph. Footnotes insert after the selection. Paragraph splits retain whole-block annotations on the original portion. Joins retain notes from both blocks. Completely deleted anchors leave records in Unattached notes; Undo or Reattach restores their placement. Copy/paste within an entry retains IDs; cross-entry copied annotations require recreating their note records. Undo history resets when changing entries or reopening the page.

Paragraph numbering includes prose and quote paragraphs and excludes list/table content, headings, code and figure captions. Reader revision totals continue grouping dated passages by date; they are not a record of real publishing events. Publishing is still a local demo.

## Validation

`npm test` runs eleven document tests covering migration/idempotence/snapshots, splits, joins, detached notes, clipboard IDs, full-document undo, formatting, Markdown, Unicode, tables, figures, reader numbering and a 10,000-word editing fixture. Browser checks cover continuous writing, selected-word notes, footnotes, revisions, reload persistence and desktop/mobile preview. Native mobile keyboards and operating-system IME composition still need hands-on testing; automated Unicode checks are not equivalent to that testing.

Run `npm ci`, `npm run build`, then `python3 server.py --port 4321`. Open `http://localhost:4321/?v=continuous-2`.

## Preview layout fix

The structured reader now supplies article content to the website’s existing essay renderer through FolioSite. It reuses the original essay header, prose grid, paragraph gutter, marginalia, footnotes, revision switch and footer styles. Only new rich-text elements (tables, lists, code and uploaded figures) add scoped styles. Preview stylesheet and script URLs use a fresh version to avoid cached legacy assets.

## Public website as source of truth

`npm run build` runs `scripts/sync-website.mjs`: public HTML, stylesheet, JavaScript, fonts and theme are synchronized from `../living-folio/dist`. Those base assets remain byte-identical. Preview-only content support lives in `site/preview-content.css` and `site/preview-adapter.js`. The compiled reader supplies the draft content to the public application. Asset URLs are hashed from the public source, rich-content CSS and reader bundle. Verified the synchronized stylesheet against the live page’s CSS rules directly. Compared the live essay sample in an isolated test notebook; the real notebook is preserved.

## Publishing integration

The later PUBLISHING.md supersedes the earlier local-demo-only limitation: Publish now creates a separate published website on this Mac, with catalogue-backed homepage/index and real publication events. Live hosting is still separate.
