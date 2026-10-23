# Yet Another Sidebar Notes

A compact, offline-first note space for the Chrome and Vivaldi side panel.

**Open → write → archive.** No account, server, telemetry, sync, or network requests.

## Install

1. Clone the repository and open its root folder.
2. Install dependencies with `npm install`.
3. Create the extension bundle with `npm run build`.
4. In Chrome or Vivaldi, open the extensions page, enable **Developer mode**, choose **Load unpacked**, and select the repository root — not `dist/`.
5. Pin **Sidebar Notes** if desired, then click its toolbar icon to open the side panel.

The extension needs a browser version which supports the Manifest V3 Side Panel API. It has not been manually browser-tested as part of this implementation.

## Privacy

All notes live locally in `chrome.storage.local`. The extension requests only `storage` and `sidePanel`; it does not access web-page content, browsing history, cookies, or network services.

## Commands

```sh
npm run build   # production bundle in dist
npm test        # storage service tests
```

## Architecture and storage

- `manifest.json` defines a minimal MV3 extension: only `storage` and `sidePanel` permissions.
- `src/background.ts` configures the action button to open the side panel.
- `src/sidepanel/main.ts` is vanilla TypeScript DOM rendering and view-local event handling.
- `src/services/storage/storage.ts` is the sole owner of `chrome.storage.local` access. It stores schema version, archived notes, the active draft, and theme settings under separate keys. This avoids serializing the full archive during ordinary draft autosaves and migrates the previous single-record format once.
- `src/styles/main.scss` contains the compact theme tokens and responsive panel layout.

Notes have stable IDs, content, creation/update/archive timestamps, and a reserved optional `sourceUrl`. The active draft is separate, so closing the panel never loses unfinished writing. Imports validate the expected note shape and retain existing notes when IDs duplicate.

## Included

- Immediate editor focus, debounced local draft persistence, and automatic first-line titles.
- Lightweight Markdown helpers for bold, italic, and bulleted lists, plus standard Cmd/Ctrl shortcuts for bold and italic.
- Archive search, editing-in-place, copy, delete with five-second undo, and newest-first ordering.
- System/light/dark appearance and validated JSON export/import.
- Keyboard-accessible controls and compact layouts designed for 280–600px side panels.

## Intentionally excluded

There are no accounts, sync, backend calls, telemetry, folders, tags, rich text, content scripts, page scraping, or background polling. Page-linked capture, shortcuts, and synchronisation are reserved for later without being implemented in this MVP.
