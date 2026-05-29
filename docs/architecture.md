# Lichra — Architecture & Developer Notes

## Running tests

```
npm test           # run once
npm run test:watch # watch mode
```

Tests live in `src/lib/__tests__/`. See `docs/manual-tests.md` for the manual test plan.

## Tech stack

| Concern | Choice |
|---------|--------|
| Framework | SolidJS |
| Build | Vite |
| Markdown | markdown-it |
| Diagrams | Mermaid |
| Storage (browser) | IndexedDB |
| Storage (desktop) | Tauri filesystem API |
| Desktop shell | Tauri 2 |

## Data model

```
Folder { id, name, parentId }   // adjacency list, rename is O(1)
Note   { id, title, content, folderId, updatedAt }
```

Wikilinks resolve case-insensitively via an in-memory title index (`Map<lowerTitle, Note>`). If two notes share the same title, a warning is shown during rename to prevent ambiguity.

## Storage

| Mode | Storage | Notes location |
|------|---------|----------------|
| Browser | IndexedDB | Browser internal store |
| Desktop (Tauri) | Filesystem | `<vault>/<folder/path>/<title>.md` |

Each `.md` file in the vault has a small YAML frontmatter block:

```
---
id: <uuid>
title: Note Title
updatedAt: <unix ms>
---

Note content here...
```

Folder structure is mirrored as real subdirectories. A `_lichra.json` file at the vault root stores folder UUIDs and tracks note paths across renames — this is the only non-Markdown file in the vault.

### Vault path persistence (desktop)

On first launch the user picks a vault folder. That choice is saved by `@tauri-apps/plugin-store` in a file called `lichra-prefs.json` under the key `vaultPath`. The file lives in the OS app-data directory:

| Platform | Path |
|----------|------|
| Windows | `C:\Users\<user>\AppData\Roaming\dev.lichra.app\lichra-prefs.json` |
| macOS | `~/Library/Application Support/dev.lichra.app/lichra-prefs.json` |
| Linux | `~/.local/share/dev.lichra.app/lichra-prefs.json` |

The app identifier `dev.lichra.app` is set in `src-tauri/tauri.conf.json`. The relevant source is `src/lib/storage-tauri.ts`.

To reset the vault (force the folder picker to reappear on next launch), delete `lichra-prefs.json` or remove the `vaultPath` key from it.

## Known issues & tech debt

See [tech-debt.md](tech-debt.md) for a prioritised list of issues to address before implementing new features.

## v1.5 — Rich Editor (completed)

**Rich editor component** — replaced the plain `<textarea>` with CodeMirror. Gains: proper undo/redo, Markdown syntax highlighting, better keyboard handling.

**Wikilink `[[` autocomplete picker** — detects `[[` as a trigger and shows a filtered dropdown of note titles. Selecting a note inserts `[[uuid]]` directly, eliminating the authoring gap. `normaliseWikilinks` remains the fallback for links written in external editors.

## v2 — Editor Experience

**Multi-file tabs** — to support multiple notes open simultaneously, keep a `Map<noteId, EditorState>` and swap `view.setState(savedState)` on tab switch rather than dispatching a full document replacement. This preserves per-file undo/redo history, cursor position, and scroll offset. The change is isolated to `src/editor/Editor.tsx` and `src/App.tsx` (tab state) plus a new tab UI; storage, preview, and wikilinks are unaffected.

**Wikilink polish** — suppress the `[[` autocomplete picker when the cursor is inside a fenced code block, using `syntaxTree` from `@codemirror/language`.

**Config to change vault (Tauri)** — provide UI to change the previously selected vault folder. On confirmation, reload the store from the new vault path.

**File watcher (Tauri)** — detect external edits to `.md` files and reload the affected note. `mergeVaultFromDisk(vault, index)` in `src/lib/storage-tauri.ts` is already exported for this purpose; a file watcher calls it on change events.

## v3 — Search & Discovery

**Full-text search** — current search is title-only. v3 indexes note body content, scoped to the current folder or global.

**Web Worker renderer** — move the markdown-it parsing pipeline off the main thread entirely. Currently rendering is debounced and async enough for v2, but a Worker would eliminate any theoretical jank on very large notes. Pairs naturally with a full-text indexing Worker.

## v4 — Cloud & Collaboration

**Cloud storage adapter** — implement `StorageAdapter` backed by a cloud API (e.g. Google Drive, S3). The interface is already designed for this; the app core needs no changes.

**Hosted service** — deploy as a web service on a VPS or platform like Render. A `ServerStorageAdapter` reads/writes files on the server filesystem or object store behind an HTTP API. Multi-user isolation and auth are the main additions.

**Cross-device sync** — once a cloud or server adapter exists, sync follows naturally from pointing multiple clients at the same backend.
