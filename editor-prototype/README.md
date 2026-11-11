# The Writing Room

A local Tiptap writing editor and publishing workflow for Arya Vahedi’s notebook. Includes Markdown shortcuts, images, tables, paragraph numbers, footnotes, side notes, connected ideas and dated passages.

## Run

```sh
npm ci
npm run build
python3 server.py --port 4321
```

Open http://localhost:4321/?v=publishing-1 . The compiled editor is included, so npm installation/build is needed only when changing source. Keep the local Python server running while writing. Data saves outside the served folder in `../notebook-data/notebook.sqlite3`.

With a GitHub checkout connected, **Publish to website** creates a published snapshot and sends the public-only export to GitHub Pages. The editor shows Draft, Unpublished changes, Deploying or Live, with a View live page link and a retry action. You can keep writing while deployment runs; later edits remain private. Unpublish removes the page online while preserving the draft.

To connect a checkout for the first time, add `--github-repo-dir /path/to/notebook-in-public` when starting the server. The connection is remembered in the private notebook-data folder. No tokens are stored in the browser or project source; the service uses the existing GitHub CLI sign-in. Without a checkout, the editor labels publication as a local copy.

Download published website still exports a static ZIP. See LIVE-PUBLISHING.md for background jobs, retry behavior and setup.

## Check

```sh
npm test
```

See PUBLISHING.md for publication behavior, privacy boundaries, version history and validation. CONTINUOUS-EDITOR.md describes the writing engine and migration. Back up notebook exports all entries; Download published website contains only published reader content.

The website and preview share `../living-folio/dist`, the canonical public website source. Building synchronizes its stylesheet, application, fonts and theme. Keep the `living-folio` folder beside `editor-prototype` when rebuilding from a downloaded source archive.

Numbering is independent for essays, notes and sketches, assigned at first publication. See NUMBERING.md for numbering, draft labels and paragraph references.
