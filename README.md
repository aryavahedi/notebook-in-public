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
python3 editor-prototype/server.py --port 4321
```

Open http://localhost:4321/ for writing and http://localhost:4321/published/ for the local published site. Keep the server running while writing. It stores notebook-data/ beside the editor; this folder is ignored by Git. Restore a personal structured JSON notebook backup through the Writing Room to load existing writing into a fresh checkout.

The original notebook on Arya’s Mac continues to be served from the existing project workspace. Cloning this repository does not download private drafts or saved-version history.

## Update the live website

1. Write, preview, and **Publish** in the Writing Room. This updates the local published site.
2. With that server running, refresh the public files:

```sh
python3 scripts/update-website.py
```

Review the result, then commit and push docs/ with Git, or run the explicit publishing command:

```sh
python3 scripts/update-website.py --publish
```

GitHub Pages then deploys the pushed docs/ folder. Local Publish does not send writing to GitHub by itself. This separation lets drafts remain private and gives the live site an explicit update step. The script uses the published-only ZIP export; it never reads or uploads the private notebook database.

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
