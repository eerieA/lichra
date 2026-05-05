# Lichra - First Version Plan

This app is a fast, local-first Markdown workspace for writing and linking notes with immediate visual feedback.

# 1 Service Goal

## Primary

> A **zero-friction, local-first Markdown workspace** optimized for *fast writing and simple linking*.

## Non-negotiable properties

* Typing latency: **<50ms perceived**
* Navigation latency: **instant (<100ms)**
* Works **offline without user awareness**
  - Means the app functions fully offline - the user shouldn't have to think about whether they're online.

---

## Explicit Non-Goals (enforced boundaries)

We are not building:

- ❌ A plugin ecosystem
- ❌ A full knowledge graph engine
- ❌ Real-time collaboration
- ❌ Cross-device sync (for first version)
- ❌ Rich WYSIWYG editor

Add two more non-goals:

* ❌ No plugin hooks or extension APIs
* ❌ No background indexing beyond what is required for links

If a feature moves us toward those → reject it for first version

---

# 2 Core System Invariants

These must hold across all phases:

### (1) Markdown is the only source of truth

No HTML is stored anywhere

---

### (2) Rendering is pure and stateless

markdown → renderer → HTML  
(no side effects)

---

### (3) Storage is fully abstracted

All persistence goes through:

```ts
interface StorageAdapter {
  loadAll(): Promise<Note[]>
  save(note: Note): Promise<void>
  delete(id: string): Promise<void>
}
```

---

### (4) UI never blocks on heavy work

* Rendering is **debounced or async**
* No synchronous parsing inside reactive computations

---

### (5) Editor and preview are isolated

* Updating preview must **never trigger editor re-render**

---

# 3 Tech Stack (tightened)

| Concern         | Choice                           |
| --------------- | -------------------------------- |
| Framework       | SolidJS                          |
| Build           | Vite                             |
| Markdown        | markdown-it (wrapped in adapter) |
| Storage         | IndexedDB                        |
| PWA             | Service worker + manifest        |
| Desktop (later) | Tauri                            |

---

# 4 Data Model (make explicit early)

```ts
type Folder = {
  id: string
  name: string
  parentId: string | null  // null = root
}

type Note = {
  id: string
  title: string
  content: string
  folderId: string | null  // null = root
  updatedAt: number
}
```

Folders are first-class entities with their own IDs. Hierarchy is expressed via `parentId` (adjacency list), not path strings. Renaming a folder is O(1) — one record update, zero note writes.

---

## Derived state (never stored)

```ts
currentNote
renderedHtml
resolvedLinks
```

### In-memory indices (never persisted)

Built once at load, updated incrementally on every mutation:

```ts
childFolders: Map<parentId, Folder[]>   // O(1) sidebar expansion
folderNotes:  Map<folderId, Note[]>     // O(1) notes-in-folder lookup
titleIndex:   Map<lowerTitle, Note>     // O(1) wikilink resolution
```

---

# 5 Wikilink Design

## Syntax

```text
[[Note Title]]
```

---

## Rules

* Case-insensitive match
* Title is unique identifier (no IDs in first version)
* No nested links

---

## Rendering contract

```html
<a class="wikilink" data-note="Note Title">Note Title</a>
```

Resolved links: solid underline. Missing links: dashed underline, muted color.

---

## Important constraint

> Do NOT rely entirely on `markdown-it-wikilinks`

Instead:

* either preprocess tokens
* or post-process HTML

This keeps behavior under our control.

---

# 5 Phases

## Phase 1 - Core Editor (Done)

### Goal

Single-note, zero-lag editing

### Deliverables

* textarea editor
* preview pane
* markdown-it pipeline
* debounce: **50–100ms (not 16ms)**

---

## Phase 2 - Persistence + Multi-note (Soon)

### Goal

A usable daily tool: notes survive reload, organized in folders, searchable by title, linkable across folders.

### Deliverables

#### 2a — Persistence (IndexedDB)

- Implement `StorageAdapter` (as spec'd in section 2 above)
- Auto-save debounced at 300ms after last keystroke
- Notes survive page reload

#### 2b — Sidebar + folder tree

- Left sidebar: fixed width ~220px, left of the editor
- Folder tree: collapsible, derived from `note.folder` values
- Flat note list within each folder, sorted by `updatedAt` desc
- Create note in the currently selected folder
- Delete note with confirmation
- Rename note = edit title inline
- First keystroke in empty state creates a new untitled note in root

#### 2c — Title-based search

- Single search input at top of sidebar
- Filters note list in real time by title substring (case-insensitive)
- Scope: titles only, no full-text
- No separate index — `notes.filter()` over the in-memory array on each keystroke
- Search results shown flat (no folder grouping) when a query is active

#### 2d — Wikilink resolution across folders

- `[[Note Title]]` resolves by title match across all folders (case-insensitive)
- Resolution happens at click time by scanning the in-memory `Note[]` — no stored index
- Missing links render with a dashed underline and muted color
- Clicking a resolved link navigates to that note and expands its folder in the sidebar

#### 2e — Mermaid rendering

- Add `mermaid` as a dependency
- Post-process rendered HTML: detect `<code class="language-mermaid">` blocks, replace with rendered SVG
- Rendering is async and does not block the editor

---

### Constraints carried from Phase 1

- No synchronous work in reactive computations
- Preview rendering remains debounced and interruptible
- Storage fully abstracted behind `StorageAdapter` — nothing touches IndexedDB directly except the adapter
- No full-text index, no graph structure stored

### Data structure constraints

- Folders use an adjacency list (`parentId`), not path strings — keeps rename O(1) at any depth
- In-memory indices (`childFolders`, `folderNotes`, `titleIndex`) are always derived from the store, never persisted independently

---

### Done when

- Notes and folders survive a page reload
- Can create, rename, and delete notes; folders appear and disappear implicitly
- Sidebar shows a collapsible folder tree; clicking a note opens it
- Title search filters the list in real time
- `[[Note Title]]` navigates to the correct note regardless of its folder
- Mermaid fenced blocks render as diagrams
- Auto-save fires within 300ms of last keystroke

---

## Phase 3 - PWA (Not started)

### Goal

Offline-first

### Deliverables

* manifest
* service worker

### Caching strategy (tightened)

App shell → cache-first  
Dynamic data → never cached (IndexedDB only)

### Done when

* App loads and works fully with network disabled
* Browser shows "installable" prompt
* Existing notes still accessible after offline reload

---

## Phase 4 - Polish (Not started)

### Allowed improvements only:

* readability (spacing, typography)
* small UX fixes
* minimal shortcuts

---

### Explicitly forbidden even here

* search
* tagging

### Done when

* The overall Definition of Done (section 9) is met
* No regressions in editor latency or link navigation
* No new features added - only existing UX improved

---

## Phase 5 - Desktop (optional)

Using Tauri

### Key rule

> Do NOT replace logic—only swap StorageAdapter

---

# 7 Performance Guardrails

## Rule 1

Parsing must not run more than **10 times/sec**

## Rule 2

Preview rendering must be **interruptible**
(latest input cancels previous render)

## Rule 3

Large note safety (basic)

If > 50KB → increase debounce automatically

---

# 8 Scope Control (tightened)

### A feature is allowed ONLY if:

1. Reduces friction in writing
2. Improves navigation between notes
3. Does not introduce new data structures

If it introduces:

* new index
* new graph
* new abstraction layer

→ **reject for first version**

---

# 9 Definition of DONE

We are done when:

* We can:

  * open app offline
  * write notes instantly
  * link notes and navigate
* No noticeable lag on typical notes (<10KB)

---

NOT when:

* it looks polished
* it resembles Obsidian
