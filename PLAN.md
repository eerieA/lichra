# Lichra v1.5 Implementation Plan

## Overview

Two features, one dependency chain: CodeMirror replaces the textarea (Phase 1), then the `[[` autocomplete picker sits on top (Phase 2). The `Editor` component's two-prop interface (`value`, `onInput`) stays unchanged from `App.tsx`'s perspective for Phase 1.

---

## Phase 1 — CodeMirror Editor

**Install:**
```
npm install @codemirror/view @codemirror/state @codemirror/commands \
            @codemirror/lang-markdown @codemirror/language-data \
            @codemirror/theme-one-dark
```

**`src/editor/Editor.tsx` — full rewrite (only file that changes in Phase 1):**
- Mount an `EditorView` into a `<div>` using SolidJS `onMount` / `onCleanup`
- Controlled value sync via `createEffect` with a string-equality guard to avoid loops when the external signal updates
- `updateListener` extension calls `props.onInput(doc.toString())` on every change
- Extensions: `markdown()` + `history()` + `defaultKeymap` + `historyKeymap` + `EditorView.lineWrapping` + `oneDark`

**`src/styles.css`** — override `oneDark`'s `#282c34` background to `#1e1e1e` via `.cm-editor` / `.cm-content` selectors to avoid a colour seam.

**Verify:** undo/redo works, note switching clears history, syntax highlighting visible, save path still functions.

---

## Phase 2 — `[[` Autocomplete Picker

**Install:**
```
npm install @codemirror/autocomplete
```

**New file: `src/editor/wikilinkCompletion.ts`**
- Exports `wikilinkCompletionSource(notes: Note[]): CompletionSource`
- Detects `[[` trigger with `context.matchBefore(/\[\[[^\]]*/)` 
- Filters note titles by query substring
- `apply` inserts `[[uuid]]` (not `[[title]]`) — this eliminates the authoring gap

**`src/editor/Editor.tsx`** — add `notes: Note[]` prop; use a `Compartment` to reconfigure the autocomplete extension reactively when the note list changes.

**`src/App.tsx`** — pass `notes={store.notes}` to `<Editor>`.

**New test: `src/lib/__tests__/wikilinkCompletion.test.ts`** — the completion source is a pure function; test: null when not in `[[`, filters by substring, inserts UUID not title, correct UUID when titles share a prefix.

**Verify:** picker opens on `[[`, filters live, Enter inserts `[[uuid]]`, link renders immediately in preview without restart.

---

## Sequencing

```
Phase 1 (CodeMirror swap)
  └─ Phase 2 (autocomplete)
       └─ wikilinkCompletion.ts test can be written in parallel with Phase 1
```

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Controlled-value loop during rapid note switching | String-equality guard in `createEffect`; also check editor focus if needed |
| `oneDark` background mismatch | Override `.cm-editor` / `.cm-content` in `styles.css` |
| Autocomplete dropdown clipped in Tauri WebView | Test picker near bottom of editor pane on macOS |
| `Compartment` reconfigure on every keystroke (title index changes) | Cheap operation — confirm no flicker; optimise later if needed |
| Picker triggers inside code blocks | Acceptable for v1.5; `syntaxTree` check is a follow-up |

---

## Critical Files

| File | Change |
|------|--------|
| `src/editor/Editor.tsx` | Full rewrite (Phase 1 + Phase 2 extension wiring) |
| `src/editor/wikilinkCompletion.ts` | New — core completion source logic (Phase 2) |
| `src/App.tsx` | Add `notes` prop pass-through to `<Editor>` |
| `src/styles.css` | CodeMirror theme overrides |
| `src/lib/__tests__/wikilinkCompletion.test.ts` | New — unit tests for completion source |
