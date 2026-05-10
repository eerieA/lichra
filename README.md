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

Notes are stored as plain Markdown files with YAML frontmatter. Folder structure is mirrored as real subdirectories. A `_lichra.json` file at the vault root tracks folder UUIDs — this is the only non-Markdown file in the vault.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Double-click note | Rename inline |
| Double-click search result | Reveal in folder tree |

## Developer docs

Architecture, data model, storage internals, and roadmap: [docs/architecture.md](docs/architecture.md)
