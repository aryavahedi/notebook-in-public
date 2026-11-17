# Opening and backing up the Writing Room

## Open it without a terminal

Double-click Writing Room.app on this Mac. It starts the existing notebook quietly in the background and opens your browser. Opening it again reuses the same server. A different notebook or app at the same address is detected; the launcher never replaces it or switches to an empty notebook.

The launcher points to this project’s location on this Mac. It can be moved to the Desktop or Dock, but the project folder must stay in place. If the project moves, recreate the launcher from that project by running `python3 editor-prototype/create_launcher.py`. The generated app is machine-specific and excluded from GitHub. It does not install a login item or a system-wide service.

The Writing Room keeps running after the launcher exits. Your saved notebook remains in notebook-data/notebook.sqlite3. Diagnostics go to notebook-data/writing-room.log. The existing GitHub connection is reused. An internet connection is needed for online publication, while local writing and backups work offline.

## Automatic backups

Verified notebook ZIPs are created in notebook-backups/, beside notebook-data/, on opening when content has changed and hourly while the service runs. No archive is added for unchanged content. The first saved notebook also triggers a backup if no recovery point exists.

The Writing Room shows the last verified backup with Back up now, Open backups folder and Download latest backup controls. Export notebook JSON remains available separately.

Each ZIP contains notebook.sqlite3 (all saved versions), notebook.json (the latest structured notebook) and manifest.json (checksums and recovery details). Notes, footnotes, images, paragraph IDs, revisions, published snapshots, connections and entry metadata are preserved. A consistent SQLite snapshot is checked for integrity; ZIP contents and checksums are verified before the archive becomes a recovery point.

Automatic retention keeps 24 recent recovery points plus one per day for up to 30 dates. Manual and before-restore backups are retained. Older manual project backups are untouched. Notebook files, connection state, generated apps and private backup archives are excluded from the public repository and website export.

These backups are local copies on this Mac. For protection against loss of the Mac, copy them to another private location or include the project in your own backup system.

## Restore

Use Restore a backup in the Notebook backups section and select a notebook ZIP or structured JSON export. ZIP imports are checked before the normal document-schema validation. Confirming a restore first creates a verified safety backup of the current notebook. If that cannot finish, the restore stops and retains the current notebook. Previous versions also remain in the destination database.

Restoring through the editor loads the latest entries from the backup; it does not replace the destination’s full database history. To restore all archived saved versions, extract the ZIP into a separate folder and use its notebook.sqlite3 as a new data folder with the Writing Room server. Preserve the old data folder, stop the old server first, and point the new server at the recovered folder with --data-dir. A real backup was restored to a separate test database and verified without replacing the user’s notebook.

## Development checks

`npm test` in editor-prototype covers the document, editor, deployment, backup and launcher behavior. Backup checks cover full-history restoration, corrupted imports, unchanged-content skipping, failure preservation and retention. Launcher checks cover reuse, exact paths with spaces, readiness and refusing another notebook at the same port. The ZIP restore endpoint and before-restore safety copy were also checked against an isolated local service.
