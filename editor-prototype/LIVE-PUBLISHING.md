# Direct publication to GitHub Pages

The local Writing Room publishes to https://aryavahedi.github.io/notebook-in-public/ through the existing GitHub checkout and gh sign-in. The service remains bound to 127.0.0.1; no remote administration or credentials in the browser are introduced.

## Use

Write and preview normally. Choose Publish to website (or Update live website), then confirm. The current draft finishes saving before publication. The service creates its public snapshot and freezes an export of explicitly published pages; other drafts, detached notes and private metadata stay excluded. Publication synchronizes the whole published website, as stated in the dialog.

While the background job runs, writing and local saving remain available. A second website publication waits for that job to finish. Later edits never enter the frozen export. View live page opens the last deployed page. Live is shown only after the matching GitHub Pages build succeeds; unpublished changes remain labelled when the draft has moved on.

Retry website update sends/checks the same frozen export and commit. It does not publish newer writing or create another editorial revision. Failed builds leave the previous live snapshot recorded. Job state and its public export are kept under the private notebook-data folder; restarting the server resumes an interrupted job.

Unpublish follows the same deployment flow. The page is not labelled removed online until deployment succeeds. An already-local withdrawal can be retried without duplicating history.

## Setup

On the original workspace, GitHub is already connected and this server command is sufficient:

`python3 editor-prototype/server.py --port 4321`

For a fresh repository checkout, start from its root with:

`python3 editor-prototype/server.py --port 4321 --github-repo-dir .`

The checkout must be on main, with origin matching aryavahedi/notebook-in-public, and gh authenticated. The path is remembered in notebook-data/publishing-config.json. Keep this folder private and excluded from Git. Restore your notebook separately when using a fresh checkout.

## Interfaces

GET /api/deployment returns connection, job and per-page live state. POST /api/publication accepts destination: live plus a requestId; repeated delivery of the same recorded request returns the same job. Local-only publication remains available when no checkout is configured. POST /api/deployment/retry accepts the failed job ID. POST /api/deployment/refresh rechecks the deployed commit.

Only the public asset allowlist is staged in docs/. Git commits explicitly include docs/ alone; the worker does not stage source changes or private notebook files. It uses fast-forward updates and never force-pushes. Network and deployment errors are reported without replacing the writing surface.

## Validation

The editor/document/controller/publication suite includes regression checks for live/private status, cursor preservation during retry, frozen exports, restart recovery, duplicate-update prevention, matching-commit verification, failed pushes and failed builds. A real unchanged public version was sent through the UI and verified without incrementing its revision.
