# Lichra — Architecture & Developer Notes

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

## v2 Ideas

**Wikilink robustness** — enforce globally unique titles as a hard constraint, or switch wikilink resolution from title-matching to ID-based with a title alias. Eliminates the current non-determinism when duplicate titles exist.

**Full-text search** — current search is title-only. v2 could index note content for body search, scoped to the current folder or global.

**Cloud storage adapter** — implement `StorageAdapter` backed by a cloud API (e.g. Google Drive, S3). The interface is already designed for this; the app core needs no changes.

**Hosted service** — deploy as a web service on a VPS or platform like Render. A `ServerStorageAdapter` reads/writes files on the server filesystem or object store behind an HTTP API. Multi-user isolation and auth are the main additions.

**Cross-device sync** — once a cloud or server adapter exists, sync follows naturally from pointing multiple clients at the same backend.

**Web Worker renderer** — move the markdown-it parsing pipeline off the main thread entirely. Currently rendering is debounced and async enough for v1, but a Worker would eliminate any theoretical jank on very large notes.

**File watcher (Tauri)** — detect external edits to `.md` files and reload the affected note in the editor. Useful when notes are edited by another tool (e.g. VS Code) while Lichra is open.
