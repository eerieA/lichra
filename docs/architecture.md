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

## v1.5 Ideas

**Rich editor component** — replace the plain `<textarea>` in `src/editor/Editor.tsx` with CodeMirror (or ProseMirror). Immediate wins: proper undo/redo, syntax highlighting, better keyboard handling. This is also the prerequisite for wikilink autocomplete (see v2). CodeMirror is the pragmatic choice — lighter integration, good Markdown support, and the `[[` trigger pattern is well-supported via its autocomplete extension.

**Wikilink `[[` autocomplete picker** — once the rich editor is in place, detect `[[` as a trigger and show a filtered dropdown of note titles. Selecting a note inserts `[[uuid]]` directly, so the user authors links by name but the file stores IDs. This eliminates the current authoring gap where a manually typed `[[Title]]` only resolves after the next app restart (via `normaliseWikilinks`). Until this is implemented, `normaliseWikilinks` remains the fallback for links written in external editors.

## v2 Ideas

**Wikilink robustness** — ID-based resolution is already in place (wikilinks store `[[uuid]]`, render as note title). The remaining gap is authoring UX, addressed in v1.5 above.

**Full-text search** — current search is title-only. v2 could index note content for body search, scoped to the current folder or global.

**Cloud storage adapter** — implement `StorageAdapter` backed by a cloud API (e.g. Google Drive, S3). The interface is already designed for this; the app core needs no changes.

**Hosted service** — deploy as a web service on a VPS or platform like Render. A `ServerStorageAdapter` reads/writes files on the server filesystem or object store behind an HTTP API. Multi-user isolation and auth are the main additions.

**Cross-device sync** — once a cloud or server adapter exists, sync follows naturally from pointing multiple clients at the same backend.

**Web Worker renderer** — move the markdown-it parsing pipeline off the main thread entirely. Currently rendering is debounced and async enough for v1, but a Worker would eliminate any theoretical jank on very large notes.

**File watcher (Tauri)** — detect external edits to `.md` files and reload the affected note in the editor. Useful when notes are edited by another tool (e.g. VS Code) while Lichra is open. `mergeVaultFromDisk(vault, index)` in `src/lib/storage-tauri.ts` is already exported for this purpose — a file watcher can call it on change events to reconcile new or modified files into the index without any additional logic.
