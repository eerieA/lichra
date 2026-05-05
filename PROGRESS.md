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

## Phase 3 — PWA

**Status:** Not started — see `PLAN.md`
