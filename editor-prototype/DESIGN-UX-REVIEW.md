# Living Folio — design and UX review

Reviewed 5 November 2026. Scope: local editor, connected website preview, homepage, reading layout, navigation, mobile layout, light/dark reading, notes, images, revisions, saving and demo publishing. This is a prototype review, not a production accessibility or security certification.

## Assessment

Keep the established visual direction: warm paper, Lora and IBM Plex Sans, cobalt annotations, generous reading space and quiet rules. The most significant problems are in writing and content management rather than the public visual design.

## Fixed in this review

- **Unclear insertion location:** a paragraph selector and active-paragraph marker now identify where insertion tools act.
- **Tools disappear during long edits:** the action bar and insertion toolbar remain available while scrolling.
- **No way to rearrange or remove paragraphs:** paragraphs and images can move up/down. Paragraphs can be removed with their attached notes; removal can be undone before another edit. Image/note removal also supports undo. A blank paragraph remains if the last text block is removed.
- **Mobile controls too small / settings too far away:** expanded touch areas and a Notes & settings jump action. No horizontal overflow observed at 390 CSS pixels.
- **Inconsistent numbering around images:** text paragraphs are counted separately from images in editor and reading view.
- **Side-note titles invisible in the editor sidebar:** custom headings now appear with the note text.
- **Deleting a footnote reference silently hides its note:** the sidebar detects missing references and offers Restore reference.
- **Misleading publish success when storage fails:** the new snapshot is committed only after the browser confirms the save. A failed save keeps the previous snapshot and displays an error. Unsaved browser state triggers a navigation warning.
- **Comparing with a nonexistent publication:** the published-version control is disabled until a demo snapshot exists.
- **Stale homepage revision date:** the editable entry's date now follows its actual dated passages.
- **Unnecessary space after title / incorrect text sizing:** title height follows content; textarea sizes recalculate after fonts load and viewport changes.
- **Keyboard exit from reading preview:** Escape returns to writing, including when focus is in the reading frame.
- **Mixed cached versions of the prototype:** updated asset version tags prevent older editor scripts from being combined with new controls.

## Verified

Browser checks covered paragraph removal with attached-note recovery, reordering, insertion targets, demo publishing, desktop/mobile layouts, reading navigation, footnotes, and the dark reading view. A focused check covered both successful publication and a simulated browser-storage failure. Existing author content was preserved; mutation checks used a separate test origin.

## Required in the next implementation stage

1. **Visual text editing.** Links currently appear as Markdown and footnotes as numbered markers. Replace the textarea model with formatted text, editable link controls, headings, lists, emphasis, and stable annotation references. Toolbar labels make the current behavior understandable but are not a substitute for this.
2. **Real library and recovery.** Create/reopen multiple entries, search actual entries for connections, and restore exported backups. Current exports do not yet have an import UI.
3. **Durable saving and media.** Browser-local drafts and embedded images remain capacity-limited. Move images to durable storage, add save/sync status, image compression, and a recovery path for interrupted edits.
4. **True revision events.** The displayed count currently groups marked passages by date. Production should count published revisions, support multiple revisions on one day, and retain previous text. Re-marking a paragraph currently replaces its date rather than keeping a full history.
5. **Metadata and real content.** Add editable publication dates and page addresses, confirm folio numbering rules, replace illustrative About/project text, and make Latest sketch come from the library.
6. **Launch validation.** Check keyboard and screen-reader behavior, contrast, long/empty content, failed uploads, draft privacy, real authentication, and deployment recovery against the final implementation.

## Recommended next milestone

Build the content library and visual editor around the approved reading layout, with durable saving. Prove that two entries can be created, closed, reopened and connected, and that one can be published while the other remains a draft. Complete this before starting commerce.
