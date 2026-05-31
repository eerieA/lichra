# Lichra Implementation Plan

## v1.5 — Rich Editor (completed)

- Replaced `<textarea>` with CodeMirror in `src/editor/Editor.tsx`
- Added `[[` autocomplete picker inserting `[[uuid]]` directly via `src/editor/wikilinkCompletion.ts`
- Fixed spurious `updateContent` calls on note switch (equality guard)
- Fixed note-switch transactions leaking into undo history (`Transaction.addToHistory: false`)

---

## v2 — Editor Experience

All changes are frontend-only. No storage, backend, or data model changes required.

### Phase 1 — Multi-file tabs (completed)

Replace the single shared `EditorView` with a per-note `EditorState` model. This fixes the undo history leak (see `docs/tech-debt.md`) and enables multiple notes open simultaneously.

#### Phase 1a — Per-note EditorState cache (completed)

- Keep a `Map<noteId, EditorState>` in `Editor.tsx`
- On note switch, call `view.setState(savedState)` instead of dispatching a full document replacement — history, cursor, and scroll are preserved per note
- Create a fresh `EditorState` (with all extensions) the first time a note is opened; reuse on subsequent switches
- The `updateListener` extension still calls `props.onInput` on every keystroke as before

#### Phase 1b — Tab strip UI (completed)

- `openTabIds` (`string[]`) in `Workspace` (`App.tsx`) is the ordered list of note IDs open as tabs
- `openTab(id)` adds to `openTabIds` if not already present, then navigates to the note
- Closing a tab removes it from `openTabIds`; if it was the current note, navigate to the nearest remaining tab (or null)
- `<TabStrip>` renders above the editor pane; hidden when no tabs are open
- Breadcrumb shows a clickable `⊕` marker when the current note is not in the tab strip and at least one tab is open — clicking it calls `openTab` for the current note

**Behaviour note:** "Open in tab" on a note other than the current active note adds that note to the tab strip *and* navigates to it immediately. The previously active note is not automatically added as a tab — if it was not already a tab, it becomes a non-tab background note navigable via the sidebar.

#### Phase 1c — Sidebar context menu (completed)

- Right-clicking a note item in the sidebar shows a custom context menu at cursor coordinates; `e.preventDefault()` suppresses the browser default
- Context menu is dismissed on click-outside or Escape
- "Open in tab" calls `openTab(id)` — first action; designed to host future actions (rename, delete, move) without restructuring
- Context menu state is local to `NoteItem` in `src/sidebar/FolderTree.tsx` (no separate file needed)

### Phase 2 — Wikilink polish

- Suppress the `[[` autocomplete picker when the cursor is inside a fenced code block (use `syntaxTree` from `@codemirror/language` to check the cursor's syntax node)

**Files changed:** `src/editor/wikilinkCompletion.ts`

**Verify:** typing `[[` inside a code block does not open the picker; typing `[[` outside a code block still does.

### Phase 3 — Tauri desktop improvements

**Config to change vault** — add a settings screen (or menu item) that calls the Tauri folder picker and updates `vaultPath` in `lichra-prefs.json`. On confirmation, reload the store from the new vault.

**File watcher** — use Tauri's `@tauri-apps/plugin-fs` watch API to listen for changes to `.md` files in the vault. On change, call the already-exported `mergeVaultFromDisk(vault, index)` in `src/lib/storage-tauri.ts` to reconcile the updated file into the index.

**Files changed:** `src/lib/storage-tauri.ts`, `src-tauri/tauri.conf.json` (plugin permissions), new settings UI component.

**Verify:** editing a note in VS Code while Lichra is open reloads it; switching vault reloads all notes from the new path.

