# The Living Folio

A responsive, interactive prototype for Arya Vahedi’s personal website. The visual direction follows the supplied “Improve Website Design” conversation and screenshots.

## Experience

- Homepage with recent folios, geometric pen study, project drawings, and introduction.
- Full e. 041 essay with desktop marginalia, mobile expandable notes, footnotes with return links, a reading progress line, revision marks and version history.
- Connected n. 040 woodpecker note and three further illustrative entries.
- Writing index with type filters, search and useful empty state.
- Two project studies and an About page.
- Keyboard focus, skip link, semantic navigation, accessible drawing descriptions, reduced-motion support, and native colophon dialog.

## Design decisions

The exact paper (#F3F2ED), ink (#30231F) and cobalt (#304BB5) colors establish a quiet reading environment. Lora carries the writing, with IBM Plex Sans for the smaller navigational layer. Both fonts are bundled locally, with licenses under `dist/assets/`.

Blue has a specific purpose: references, folio numbers, drawings and additions. Hairline rules and shared baselines create structure without enclosing the writing in cards. Diagrams are editable SVG studies, rather than stock imagery or artificial paper textures.

On large screens the essay has a metadata rail, a readable central column, and a quiet margin. On phones, the main text takes the full width and key annotations become expandable inline notes. Revision marks are optional; the essay remains readable either way. Related entries form a small readable thread rather than a complex graph.

The copy is adapted from the supplied screenshots and design conversation. Additional entry copy and project material are illustrative. The colophon explains this within the prototype.

## Run locally

This site uses plain HTML, CSS, and JavaScript. No dependency installation or build step is needed.

From this directory:

```sh
python3 -m http.server 4317 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4317`. Routes use URL fragments, so every page can be opened directly on static hosting.

The source for the shared interface is `dist/index.html`; layouts and responsive rules are in `dist/styles.css`; page content, routing and browser-local interactions are in `dist/app.js`.

The homepage header uses three small irregular filled circles: deep red (#973A3C), dark green (#365B48), and the existing cobalt (#304BB5). Interior pages retain the name wordmark.

The header sun/star button switches between light and dark palettes. Light mode is the default; the chosen mode is stored in this browser and restored before the page renders. The control supports keyboard activation and remains available on mobile.
