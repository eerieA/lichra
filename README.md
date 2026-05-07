# Lichra

A fast, local-first Markdown workspace. Write and link notes with immediate visual feedback — no cloud, no sync, no friction.

## Features

- **Split-pane editing** — Markdown editor on the left, live rendered preview on the right
- **Wikilinks** — `[[Note Title]]` links resolve across all folders; missing links shown with a dashed underline
- **Folder tree** — collapsible hierarchy in the sidebar; folders are first-class entities
- **Real `.md` files on disk** (desktop) — notes stored as plain Markdown files with YAML frontmatter, mirroring your folder structure as real subdirectories
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as SVG diagrams
- **Title search** — real-time filter by note title in the sidebar; double-click a result to reveal it in the folder tree
- **Auto-save** — debounced at 300ms after last keystroke
- **Inline rename** — double-click any note to rename it in place; warns if the title already exists
- **Safe delete** — two-click confirmation on note and folder deletion; no accidental data loss
- **Editor breadcrumb** — shows the current note's folder path above the editor

## Running

### Browser (IndexedDB storage)

Notes are stored in the browser's IndexedDB. No installation required.

```
npm install
npm run dev
```

Open `http://localhost:5173`.

### Desktop (Tauri — files on disk)

Notes are saved as real `.md` files in a vault folder you choose on first launch.

**Prerequisites:** [Rust](https://rustup.rs) and the Tauri CLI (`cargo install tauri-cli`).

```
npm install
cargo tauri dev
```

On first launch a folder picker will appear — choose or create a directory to use as your vault. This choice is remembered across restarts.

To build a standalone executable:

```
cargo tauri build
```

## Storage

| Mode | Storage | Notes location |
|------|---------|---------------|
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

Folder structure is mirrored as real subdirectories. A `_lichra.json` file at the vault root stores folder UUIDs and tracks note paths across renames — this is the only non-Markdown file.

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

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Double-click note | Rename inline |
| Double-click search result | Reveal in folder tree |

## Data model

```
Folder { id, name, parentId }   // adjacency list, rename is O(1)
Note   { id, title, content, folderId, updatedAt }
```

Wikilinks resolve case-insensitively via an in-memory title index (`Map<lowerTitle, Note>`). If two notes share the same title, a warning is shown during rename to prevent ambiguity.

## v2 Ideas

**Wikilink robustness** — enforce globally unique titles as a hard constraint, or switch wikilink resolution from title-matching to ID-based with a title alias. Eliminates the current non-determinism when duplicate titles exist.

**Full-text search** — current search is title-only. v2 could index note content for body search, scoped to the current folder or global.

**Cloud storage adapter** — implement `StorageAdapter` backed by a cloud API (e.g. Google Drive, S3). The interface is already designed for this; the app core needs no changes.

**Hosted service** — deploy as a web service on a VPS or platform like Render. A `ServerStorageAdapter` reads/writes files on the server filesystem or object store behind an HTTP API. Multi-user isolation and auth are the main additions.

**Cross-device sync** — once a cloud or server adapter exists, sync follows naturally from pointing multiple clients at the same backend.

**Web Worker renderer** — move the markdown-it parsing pipeline off the main thread entirely. Currently rendering is debounced and async enough for v1, but a Worker would eliminate any theoretical jank on very large notes.

**File watcher (Tauri)** — detect external edits to `.md` files and reload the affected note in the editor. Useful when notes are edited by another tool (e.g. VS Code) while Lichra is open.
