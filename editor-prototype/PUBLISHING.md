# Publishing

Direct publication to GitHub Pages is now available from the local Writing Room. See [LIVE-PUBLISHING.md](LIVE-PUBLISHING.md) for the current workflow, setup, durable jobs and retry behavior. The original hosted chatgpt.site prototype is separate.

The notes below describe the local snapshot/export foundation, which is retained underneath online publication.

# Publishing integration — 6 November 2026

The Writing Room now publishes entries into a separate local website at `/published/`. The hosted chatgpt.site website is not automatically deployed by this action.

## Flow

1. Write normally; drafts save to the private local notebook.
2. Choose Publish. The client finishes saving, then sends the current notebook revision and entry ID to `POST /api/publication`.
3. The server checks the revision and creates a published snapshot transactionally. Repeated publication of identical content is idempotent.
4. The published homepage, searchable/filterable index, stable `/entry/ID` routes, related links and latest sketch read from published snapshots only.
5. Later edits remain private until Publish update. Unpublish removes the entry from the catalogue and inbound related links without deleting the draft, earlier snapshot or saved database history.
6. Download published website exports a static ZIP that can be hosted without Python or the Writing Room.

Existing prototype/demo snapshots are not automatically made public. An entry needs an explicit successful publication operation and `publication.status === 'published'`.

## Data and interfaces

`entry.publication` records status, first publication time, update time, version and timestamped publish/update/unpublish/republish events. `entry.published` stores a whitelist of reader-facing content plus its publication metadata. Draft-only metadata and detached annotation records are excluded. Connected-entry IDs are projected to currently published targets when serving/exporting; publishing or withdrawing a target updates those links automatically.

`POST /api/publication` accepts `{revision, entryId, action: 'publish' | 'unpublish'}`. A revision mismatch returns 409; failures preserve the prior published site. The response includes the new notebook revision and notebook. `/published/content/published.json` supplies only the public projection. `GET /api/export-website` returns the standalone ZIP from the same projection and explicit asset allowlist.

The public renderer and local preview share the canonical website application and the compiled structured reader. Hash-based entry routes work on basic static hosting. Original design-prototype article routes map to published IDs when present; unavailable writing links in illustrative project pages are hidden. Page revision totals and publication history now use real publication versions; dated passages remain a separate section.

The Python server remains loopback-only. Deploy the exported ZIP, not the admin folder or notebook database. Live deployment, remote authentication and cloud writing access are a subsequent integration stage.

## Validation

25 automated checks (20 JavaScript/document/controller/catalogue checks and 5 Python publication checks). Additional isolated API checks cover the complete publish/update/withdraw/republish cycle, draft and orphan-note exclusion, idempotence, connected links, and ZIP contents. Browser checks covered publishing an entry through the UI and browsing its generated homepage and article. Exported ZIP was extracted and served using only a basic static server; index, article, related links and real version history worked without the admin server. No real notebook entry was published by testing.

A pre-publication database snapshot is retained at `../notebook-data/before-publishing.sqlite3`. Keep the user's dated full project backup as the rollback checkpoint for the code and earlier data.
