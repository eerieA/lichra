# Lichra Implementation Plan

## v1.5 — Rich Editor (completed)

- Replaced `<textarea>` with CodeMirror in `src/editor/Editor.tsx`
- Added `[[` autocomplete picker inserting `[[uuid]]` directly via `src/editor/wikilinkCompletion.ts`
- Fixed spurious `updateContent` calls on note switch (equality guard)
- Fixed note-switch transactions leaking into undo history (`Transaction.addToHistory: false`)

---

## v2 — Editor Experience

All changes are frontend-only. No storage, backend, or data model changes required.

### Phase 1 — Multi-file tabs

Replace the single shared `EditorView` with a per-note `EditorState` model. This fixes the undo history leak (see `docs/tech-debt.md`) and enables multiple notes open simultaneously.

**Approach:**
- Keep a `Map<noteId, EditorState>` in `Editor.tsx`
- On note switch, call `view.setState(savedState)` instead of dispatching a full document replacement — history, cursor, and scroll are preserved per note
- Create a fresh `EditorState` (with all extensions) the first time a note is opened; reuse on subsequent switches
- Remove the `createEffect` that syncs `props.value` into the editor — note switching is now handled entirely by `setState`, not by a reactive dispatch
- The `updateListener` extension still calls `props.onInput` on every keystroke as before

**Files changed:** `src/editor/Editor.tsx`, `src/App.tsx` (tab state + tab UI)

**Verify:** undo in note A does not affect note B; switching notes preserves cursor position; existing save path unchanged.

### Phase 2 — Wikilink polish

- Suppress the `[[` autocomplete picker when the cursor is inside a fenced code block (use `syntaxTree` from `@codemirror/language` to check the cursor's syntax node)

**Files changed:** `src/editor/wikilinkCompletion.ts`

**Verify:** typing `[[` inside a code block does not open the picker; typing `[[` outside a code block still does.

### Phase 3 — Tauri desktop improvements

**Config to change vault** — add a settings screen (or menu item) that calls the Tauri folder picker and updates `vaultPath` in `lichra-prefs.json`. On confirmation, reload the store from the new vault.

**File watcher** — use Tauri's `@tauri-apps/plugin-fs` watch API to listen for changes to `.md` files in the vault. On change, call the already-exported `mergeVaultFromDisk(vault, index)` in `src/lib/storage-tauri.ts` to reconcile the updated file into the index.

**Files changed:** `src/lib/storage-tauri.ts`, `src-tauri/tauri.conf.json` (plugin permissions), new settings UI component.

**Verify:** editing a note in VS Code while Lichra is open reloads it; switching vault reloads all notes from the new path.

