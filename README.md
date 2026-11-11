# Notebook In Public

Arya Vahedi’s personal website and local Writing Room. Lora and IBM Plex Sans, warm paper, cobalt marginalia, independent essay/note/sketch numbers, footnotes, side notes and dated revisions.

## Website

The public website is deployed from **docs/** on the **main** branch:
https://aryavahedi.github.io/notebook-in-public/

Only explicitly published snapshots are included. The local Writing Room, notebook database, draft content and backups are not part of the deployed site.

## Project folders

- **docs/**: the deployable website and public content.
- **living-folio/dist/**: canonical website design, navigation, theme and fonts.
- **editor-prototype/**: the local editor, saving service, shared reader, source and tests.
- **scripts/update-website.py**: refresh docs/ from a running Writing Room’s published-only export; optionally commit and push it.

## Write locally

From this repository, run:

```sh
python3 editor-prototype/server.py --port 4321 --github-repo-dir .
```

Open http://localhost:4321/ for writing and http://localhost:4321/published/ for the local published site. Keep the server running while writing. It stores notebook-data/ beside the editor; this folder is ignored by Git. Restore a personal structured JSON notebook backup through the Writing Room to load existing writing into a fresh checkout.

The original notebook on Arya’s Mac continues to be served from the existing project workspace. Cloning this repository does not download private drafts or saved-version history.

## Update the live website

Use **Publish to website** in the connected Writing Room. Drafts finish saving before publication. The service creates a public snapshot, exports only explicitly published pages, commits docs/ and deploys through GitHub Pages. It shows Deploying and then Live; **View live page** opens the published entry. Typing stays available while the update runs, and later changes remain private until another publication.

**Retry website update** retries the saved export if the connection or build fails; it does not send newer private edits or add an editorial revision. Interrupted jobs resume when the server restarts. **Unpublish** removes a page online while preserving your private draft.

The server remembers its checkout path under the ignored notebook-data/ folder. It uses the existing GitHub CLI sign-in; no token is included in this repository or sent to the browser. See editor-prototype/LIVE-PUBLISHING.md for details.

The manual alternative remains `python3 scripts/update-website.py --publish` with the Writing Room running. It exports the whole published site, commits docs/ and pushes to GitHub.

## Source development

```sh
cd editor-prototype
npm ci
npm run build
npm test
```

Compiled editor and reader bundles are included for local use. Rebuilding synchronizes the preview with the canonical website design. After design or reader changes, run the updated local server before refreshing docs/.

## Hosting configuration

GitHub Pages: deploy from branch **main**, folder **/docs**. The .nojekyll file keeps the static files intact. Hash routes and relative assets support the repository URL without server rewrites.

Bundled font licenses are included with their assets. No license for Arya’s writing or artwork is granted by publishing this source repository.
