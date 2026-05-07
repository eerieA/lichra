# Lichra — Build Progress

## Phase 1 — Core Editor ✅

**Status:** Complete

### What was built

- SolidJS + Vite + TypeScript scaffold
- Split-pane layout: `textarea` editor (left) + rendered preview (right)
- `markdown-it` rendering pipeline wrapped behind a `MarkdownRenderer` adapter interface
- Wikilink post-processor: `[[Note Title]]` → `<a class="wikilink" data-note="Note Title">` via regex on rendered HTML (no plugin dependency)
- Debounced preview update at 75ms; auto-increases to 300ms for notes > 50KB
- Preview rendering is async (`setTimeout`) — never blocks the editor
- Dark theme base styles

### Files created

```
index.html
vite.config.ts
tsconfig.json
src/
  vite-env.d.ts
  main.tsx
  App.tsx
  styles.css
  editor/Editor.tsx
  preview/Preview.tsx
  lib/markdown.ts
  lib/wikilinks.ts
```

### Phase 1 done criteria met

- [x] Typing in the editor updates the preview within 100ms
- [x] `[[text]]` renders as a styled span (no navigation yet)
- [x] No persistence, no sidebar, no routing

---

## Phase 2 — Persistence + Multi-note + File Management ✅

**Status:** Complete

### What was built

#### 2a — Persistence (IndexedDB)
- `StorageAdapter` interface + IndexedDB implementation (`src/lib/storage.ts`)
- Auto-save debounced at 300ms after last keystroke
- Notes survive page reload

#### 2b — Sidebar + folder tree
- Fixed 220px sidebar left of the editor
- Collapsible folder tree; folders are first-class entities with `id`/`name`/`parentId` (adjacency list)
- Flat note list per folder, sorted by `updatedAt` desc
- Create note in the currently selected folder; create named subfolders
- Delete note with confirmation dialog
- Delete folder with confirmation via hover button (recursively removes all descendant folders and notes)
- Rename note by double-clicking (inline input, Enter/Escape/blur to commit); rename folder is O(1)
- First open with no notes: sidebar is empty, editor is blank

#### 2c — Title-based search
- Search input at top of sidebar
- Real-time filter by title substring (case-insensitive)
- Search results shown flat with full folder path badge; folder tree hidden while searching

#### 2d — Wikilink resolution across folders
- `[[Note Title]]` resolved via `titleIndex` (O(1) map lookup, not a scan)
- Resolved links: solid blue underline; missing links: dashed grey underline
- Clicking a resolved wikilink in the preview navigates to that note

#### 2f — Adjacency list + in-memory indices (scalability refactor)
- `Note.folder: string` replaced by `Note.folderId: string | null`; `Folder` is now a persisted entity
- Three indices maintained incrementally on every mutation (never full-rebuilt after load):
  - `childFolders: Map<parentId, Folder[]>` — O(1) sidebar expansion per folder
  - `folderNotes: Map<folderId, Note[]>` — O(1) notes-in-folder lookup
  - `titleIndex: Map<lowerTitle, Note>` — O(1) wikilink resolution
- Folder rename is O(1) (one record write); previously required patching every note in the subtree
- IndexedDB schema migrated from v1 (path strings) to v2 (adjacency list) automatically on first load

#### 2e — Mermaid rendering
- `mermaid` rendered asynchronously after each preview update via `queueMicrotask`
- Detects `<code class="language-mermaid">` blocks in rendered HTML and replaces with SVG
- Errors shown with a dashed red border

#### 2g — Unified note navigation with sidebar expansion and scroll
- All note navigation (wikilink clicks, sidebar note clicks, new note creation) goes through a single `navigateToNote(id)` in `Sidebar`
- On navigation: sets current note, expands all ancestor folders, scrolls sidebar to the note item
- Open folder state is `openFolderIds: Signal<Set<string>>` in `Sidebar` — multiple folders stay open simultaneously; navigation only adds to the set
- `App` registers `navigateToNote` via `onRegisterNavigate` prop so wikilink clicks in the preview can trigger the same function
- `FolderNode.open` local signal removed; open state now derived from `openFolderIds` set

### New files

```
src/
  lib/storage.ts
  lib/notes.ts
  lib/mermaid.ts
  sidebar/Sidebar.tsx
  sidebar/FolderTree.tsx
```

### Modified files

```
src/App.tsx        — wired sidebar, store, wikilink click, preview component
src/lib/markdown.ts — accepts notes[] for wikilink resolution
src/lib/wikilinks.ts — marks missing links with wikilink--missing class
src/preview/Preview.tsx — triggers Mermaid after each render
src/styles.css     — sidebar styles, missing wikilink style, mermaid styles
```

### Phase 2 done criteria met

- [x] Notes and folders survive a page reload
- [x] Can create, rename, and delete notes; folders appear and disappear implicitly
- [x] Sidebar shows a collapsible folder tree; clicking a note opens it
- [x] Title search filters the list in real time
- [x] `[[Note Title]]` navigates to the correct note regardless of its folder
- [x] Mermaid fenced blocks render as diagrams
- [x] Auto-save fires within 300ms of last keystroke

---

## Phase 3 — Polish ✅

**Status:** Complete

### What was built

#### Typography / readability
- Preview uses Georgia serif font with graduated heading sizes (h1–h4)
- Code blocks have a border and distinct background; inline code styled separately
- Added `hr`, `li` spacing, and full table styles (with alternating row shading)
- Preview max-width capped at 720px for comfortable reading line length

#### UX: inline delete confirmation
- Removed `confirm()` dialogs for note and folder deletion
- Two-click pattern: first click turns the `×` button red and shows `?`; second click confirms; mouse-leave cancels

#### UX: duplicate title warning
- While renaming a note, an inline warning appears below the input if the draft title matches an existing note (case-insensitive)
- Non-blocking — the rename still saves; the warning just makes the wikilink ambiguity visible

#### UX: search → tree navigation
- Double-clicking a search result clears the query and calls `navigateToNote`, expanding ancestor folders and scrolling to the note in the tree view

#### UX: editor breadcrumb
- A breadcrumb bar above the editor shows the current note's folder path and title (e.g. `/folder1/folder3/` + `test5`)
- At root it shows `/` + title; updates reactively on note switch

#### UX: sidebar expansion on reload
- On app load, the sidebar now automatically expands ancestor folders and scrolls to the active note
- Reuses `navigateToNote` called once in `onMount` — no new logic

### Notes
- `Ctrl+N` shortcut was implemented then reverted — conflicts with Firefox's native new-window shortcut

### Modified files

```
src/App.tsx                — editor breadcrumb, editor-pane wrapper
src/styles.css             — preview typography, table, hr, delete confirmation styles, breadcrumb styles
src/sidebar/Sidebar.tsx    — double-click search result to reveal in tree, expand on load
src/sidebar/FolderTree.tsx — inline delete confirmation, duplicate title warning
```

### Phase 3 done criteria met

- [x] No regressions in editor latency or link navigation
- [x] No new features added — only existing UX improved
- [x] Duplicate title warning shown inline during rename
- [x] Search results navigable back to tree view via double-click
- [x] Editor breadcrumb shows current note location
- [x] Sidebar expands to active note on app reload

---

## Phase 4 — Desktop (Tauri) ✅

**Status:** Complete

### What was built

#### Tauri scaffold
- `src-tauri/` generated with Tauri 2 (`tauri-cli 2.10.0`)
- Plugins registered: `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-store`
- Capabilities grant full filesystem read/write scope for the user-chosen vault directory
- Window size set to 1280×800; app identifier `dev.lichra.app`
- `vite.config.ts` updated with `strictPort: true` and Tauri-compatible build target
- `package.json` gets a `tauri` script (`cargo tauri dev` / `cargo tauri build`)

#### Tauri StorageAdapter (`src/lib/storage-tauri.ts`)
- Implements the same `StorageAdapter` interface — no changes to app logic
- On first launch: opens a folder picker (`tauri-plugin-dialog`); chosen vault path persisted via `tauri-plugin-store`
- Notes saved as real `.md` files with YAML frontmatter (`id`, `title`, `updatedAt`) — Markdown remains the sole source of truth
- Folder hierarchy mirrored as real subdirectories on disk
- Vault metadata (folder UUIDs, note path registry) stored in `<vault>/_lichra.json`
- Rename tracking: when a note is renamed, the old `.md` file is removed and a new one written; path registry updated in `_lichra.json`
- `loadAll()` recursively scans the vault, parsing frontmatter from each `.md` file

#### Adapter selection (`src/App.tsx`)
- Detects `__TAURI_INTERNALS__` at runtime; dynamically imports `TauriStorageAdapter` in Tauri, falls back to `IndexedDBAdapter` in the browser
- Both modes remain fully functional with zero shared-code changes

#### Bug fixes
- Duplicate folder creation on Enter+blur: `commitNewFolder` now clears state before creating, so the blur no-ops
- Duplicate sibling folder names: blocked with an inline warning ("A folder with this name already exists here"); input stays open for correction

### New files

```
src-tauri/                  — full Tauri project scaffold
src/lib/storage-tauri.ts    — Tauri filesystem StorageAdapter
```

### Modified files

```
src/App.tsx               — runtime adapter selection
src/sidebar/Sidebar.tsx   — duplicate folder name guard + warning
src/styles.css            — new-folder-warning style
vite.config.ts            — Tauri-compatible server config
package.json              — tauri script, Tauri JS dependencies
```

### Phase 4 done criteria met

- [x] Notes saved as real `.md` files on disk with YAML frontmatter
- [x] Folder hierarchy mirrored as real subdirectories
- [x] Vault folder chosen on first launch, persisted across restarts
- [x] Browser version (IndexedDB) continues to work unchanged
- [x] StorageAdapter interface unchanged — future adapters (cloud, server) slot in identically
- [x] No regressions in editor latency or note persistence

---

## v1 Complete ✅

All four phases shipped. The app is a functional local-first Markdown workspace with:
- Zero-lag editing with live preview and Mermaid diagrams
- Wikilinks with O(1) resolution across folders
- Full folder tree with inline rename, delete confirmation, and duplicate guards
- Notes persisted as real `.md` files on disk (Tauri) or IndexedDB (browser)
- Clean `StorageAdapter` abstraction ready for cloud/server adapters in v2
