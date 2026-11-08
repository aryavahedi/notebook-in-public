# The Writing Room

A local Tiptap writing editor and publishing workflow for Arya Vahedi’s notebook. Includes Markdown shortcuts, images, tables, paragraph numbers, footnotes, side notes, connected ideas and dated passages.

## Run

```sh
npm ci
npm run build
python3 server.py --port 4321
```

Open http://localhost:4321/?v=publishing-1 . The compiled editor is included, so npm installation/build is needed only when changing source. Keep the local Python server running while writing. Data saves outside the served folder in `../notebook-data/notebook.sqlite3`.

Publish creates a local published version. Update website publishes later changes. Unpublish withdraws a page while preserving your writing. Open the published site at http://localhost:4321/published/ . Download published website exports a static ZIP ready for a hosting service. The live hosted website is not deployed automatically yet.

## Check

```sh
npm test
```

See PUBLISHING.md for publication behavior, privacy boundaries, version history and validation. CONTINUOUS-EDITOR.md describes the writing engine and migration. Back up notebook exports all entries; Download published website contains only published reader content.

The website and preview share `../living-folio/dist`, the canonical public website source. Building synchronizes its stylesheet, application, fonts and theme. Keep the `living-folio` folder beside `editor-prototype` when rebuilding from a downloaded source archive.

Numbering is independent for essays, notes and sketches, assigned at first publication. See NUMBERING.md for numbering, draft labels and paragraph references.
