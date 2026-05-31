# Lichra Implementation Plan

## v1.5 — Rich Editor (completed)

- Replaced `<textarea>` with CodeMirror in `src/editor/Editor.tsx`
- Added `[[` autocomplete picker inserting `[[uuid]]` directly via `src/editor/wikilinkCompletion.ts`
- Fixed spurious `updateContent` calls on note switch (equality guard)
- Fixed note-switch transactions leaking into undo history (`Transaction.addToHistory: false`)

---

## v2 — Editor Experience

All changes are frontend-only. No storage, backend, or data model changes required.

### Phase 1 — Multi-file tabs (in progress)

Replace the single shared `EditorView` with a per-note `EditorState` model. This fixes the undo history leak (see `docs/tech-debt.md`) and enables multiple notes open simultaneously.

#### Phase 1a — Per-note EditorState cache (completed)

- Keep a `Map<noteId, EditorState>` in `Editor.tsx`
- On note switch, call `view.setState(savedState)` instead of dispatching a full document replacement — history, cursor, and scroll are preserved per note
- Create a fresh `EditorState` (with all extensions) the first time a note is opened; reuse on subsequent switches
- The `updateListener` extension still calls `props.onInput` on every keystroke as before

**Verify:** undo in note A does not affect note B; switching notes preserves cursor position; existing save path unchanged.

#### Phase 1b — Tab strip UI

Add a tab strip above the editor showing explicitly opened notes.

**Approach:**
- Add `openTabIds` (`string[]`) and `setOpenTabIds` to `Workspace` in `App.tsx` — ordered list of note IDs currently open as tabs
- Expose an `openTab(id)` handler that adds to `openTabIds` if not already present, then navigates
- Closing a tab removes it from `openTabIds`; if it was the current note, navigate to the nearest remaining tab (or null if none)
- Render a `<TabStrip>` component above the editor pane, showing one tab per entry in `openTabIds`; active tab highlighted; each tab has a close button
- Tab strip is hidden when `openTabIds` is empty

**Files changed:** `src/App.tsx`, new `src/editor/TabStrip.tsx`

**Verify:** programmatically opening two notes shows both as tabs; closing the active tab switches to the next; tab strip disappears when all tabs are closed.

#### Phase 1c — Sidebar context menu

Add a right-click context menu on note items in the sidebar. First action: "Open in tab". Designed to host future actions (rename, delete, move) without further restructuring.

**Approach:**
- Right-clicking a note item shows a custom context menu at cursor coordinates; `e.preventDefault()` suppresses any browser default
- Context menu is a positioned `<div>` rendered via a portal or at app root level, dismissed on click-outside or Escape
- "Open in tab" calls the `openTab(id)` handler from Phase 1b

**Files changed:** `src/sidebar/FolderTree.tsx`, new `src/sidebar/NoteContextMenu.tsx`

**Verify:** right-clicking a note shows the context menu; selecting "Open in tab" adds it to the tab strip; clicking outside or pressing Escape dismisses the menu; single-click navigation does not open tabs.

### Phase 2 — Wikilink polish

- Suppress the `[[` autocomplete picker when the cursor is inside a fenced code block (use `syntaxTree` from `@codemirror/language` to check the cursor's syntax node)

**Files changed:** `src/editor/wikilinkCompletion.ts`

**Verify:** typing `[[` inside a code block does not open the picker; typing `[[` outside a code block still does.

### Phase 3 — Tauri desktop improvements

**Config to change vault** — add a settings screen (or menu item) that calls the Tauri folder picker and updates `vaultPath` in `lichra-prefs.json`. On confirmation, reload the store from the new vault.

**File watcher** — use Tauri's `@tauri-apps/plugin-fs` watch API to listen for changes to `.md` files in the vault. On change, call the already-exported `mergeVaultFromDisk(vault, index)` in `src/lib/storage-tauri.ts` to reconcile the updated file into the index.

**Files changed:** `src/lib/storage-tauri.ts`, `src-tauri/tauri.conf.json` (plugin permissions), new settings UI component.

**Verify:** editing a note in VS Code while Lichra is open reloads it; switching vault reloads all notes from the new path.

