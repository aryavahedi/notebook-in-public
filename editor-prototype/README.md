# The Writing Room

A local Tiptap writing editor and publishing workflow for Arya Vahedi’s notebook. Includes Markdown shortcuts, images, tables, paragraph numbers, footnotes, side notes, connected ideas and dated passages.

## Open on this Mac

Double-click the generated **Writing Room.app**. To create it from a fresh project, run `python3 editor-prototype/create_launcher.py` from the project root. It starts or reuses the existing notebook server and opens your browser. See LAUNCHER-AND-BACKUPS.md for details.

Private notebook backups are verified automatically on opening and hourly when content changes. The Notebook backups section provides manual backup, download, folder and restore controls. Backups stay local under notebook-backups/, outside the served editor and public website.

## Run manually

```sh
npm ci
npm run build
python3 server.py --port 4321
```

Open http://localhost:4321/?v=delete-1 . The compiled editor is included, so npm installation/build is needed only when changing source. Keep the local Python server running while writing. Data saves outside the served folder in `../notebook-data/notebook.sqlite3`.

With a GitHub checkout connected, **Publish to website** creates a published snapshot and sends the public-only export to GitHub Pages. The editor shows Draft, Unpublished changes, Deploying or Live, with a View live page link and a retry action. You can keep writing while deployment runs; later edits remain private. Unpublish removes the page online while preserving the draft.

To connect a checkout for the first time, add `--github-repo-dir /path/to/notebook-in-public` when starting the server. The connection is remembered in the private notebook-data folder. No tokens are stored in the browser or project source; the service uses the existing GitHub CLI sign-in. Without a checkout, the editor labels publication as a local copy.

Download published website still exports a static ZIP. See LIVE-PUBLISHING.md for background jobs, retry behavior and setup.

## Find and create entries

Open **Library** to search titles, descriptions, passages, annotations, image descriptions or folio numbers. Filter by Essay, Note or Sketch and publication status. Sort by recent edits, title or folio. Sketches include a small image preview. Entries without a recorded edit time use their publication or original date until edited.

The **+ New** menu remains in the writing toolbar while you scroll. The Library also keeps **+ New entry**, search and filters above the scrolling results. Choose Essay, Note or Sketch; a new Sketch opens the photo picker immediately.

## Delete and restore entries

In Library, use **Move to Trash** on a draft or unpublished entry and confirm its title. Published entries show **Unpublish first**; the service also checks that the online withdrawal has finished before allowing deletion. Entries in Trash are hidden from normal search, editing, the connected-idea picker and public exports.

Use the **Trash** button in the Library header to find and restore entries. Restoration does not republish them. Original content, annotations, connections, publication history and folio reservations remain intact. Trash is recoverable local removal. **Delete permanently** is available only inside Trash and requires a confirmation naming the entry. It clears the content from the current notebook and removes connected-idea references, keeping the old entry ID reserved so its link cannot point to a different post. The next folio is one higher than the highest number still held by an entry of that type. This makes numbers at the end of a sequence available again after permanent deletion. It cannot be restored through Trash. Previous local database versions, backup archives and GitHub history are not erased. Backups include Trash. A notebook with all entries in Trash can still create new entries or restore old ones.

## Photos

Uploads retain the original file bytes, embedded color profile and metadata, with a normal-brightness preview before insertion. The editor and reader use `dynamic-range-limit: standard` to cap HDR highlight boosts where the browser supports it. This changes display only; it does not re-encode or adjust the original photo. Unsupported browsers retain their native image rendering.

## Check

```sh
npm test
```

See PUBLISHING.md for publication behavior, privacy boundaries, version history and validation. CONTINUOUS-EDITOR.md describes the writing engine and migration. Back up notebook exports all entries; Download published website contains only published reader content.

The website and preview share `../living-folio/dist`, the canonical public website source. Building synchronizes its stylesheet, application, fonts and theme. Keep the `living-folio` folder beside `editor-prototype` when rebuilding from a downloaded source archive.

Numbering is independent for essays, notes and sketches, assigned at first publication. See NUMBERING.md for numbering, draft labels and paragraph references.
