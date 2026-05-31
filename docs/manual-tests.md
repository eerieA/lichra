# Lichra — Manual Test Plan

Run these in the Tauri desktop app after any significant change. Browser mode should be tested separately for the storage-agnostic cases.

## 1. Note and folder creation

- Create a note at the vault root.
- Create a folder at the vault root, then create a note inside it.
- Create a deeply nested folder structure (e.g. `folder1/folder2/folder3/folder4/folder5`) and create a note at the deepest level.
- Verify that `.md` files appear on disk at the expected paths.

## 2. Note and folder deletion

- Delete a root-level note. Verify it disappears from the sidebar and from disk.
- Delete a note inside a nested folder. Verify the folder remains.
- Delete a folder that contains notes and subfolders. Verify the entire subtree is removed from disk.
- Confirm the two-click confirmation is required for both note and folder deletion.

## 3. Note rename

- Rename a note. Verify the sidebar title updates, the `.md` file on disk is renamed, and any wikilinks pointing to it still resolve (they store UUID, so they should be unaffected).
- Rename a note to a title that already exists. Verify the duplicate-title warning is shown.

## 4. Editor basics

- Open a note and verify Markdown syntax highlighting is visible (headings, bold, code spans, fenced code blocks).
- Verify long lines wrap rather than overflow horizontally.
- Type several words, press Ctrl+Z — verify undo works within the note.
- Press Ctrl+Y (or Ctrl+Shift+Z) — verify redo works.

## 5. Wikilink `[[` autocomplete

- Open any note and type `[[`. Verify the autocomplete picker appears immediately.
- Type a few characters to filter — verify the list narrows to matching note titles.
- Select a note from the picker (Enter or click). Verify the inserted text is `[[uuid]]` (not `[[Title]]`) and the preview immediately renders it as a blue wikilink with the note's display title.
- Press Escape while the picker is open — verify it dismisses without inserting anything.
- Type `[[` inside a fenced code block (` ``` ` ... ` ``` `). Verify the picker does **not** appear. *(Known gap — not yet implemented; expect picker to appear.)*

## 6. Wikilink navigation — shallow to deep

- Create `Note A` at the vault root. Open it and use the `[[` picker to insert a link to `Note B`.
- Create `Note B` at `folder1/folder2/`.
- In the preview of `Note A`, click the wikilink to `Note B`.
- **Expected:** editor and preview switch to `Note B`; sidebar expands all ancestor folders and scrolls `Note B` into view.

## 7. Wikilink navigation — deep to shallow

- From `Note B` at the deep path above, use the `[[` picker to insert a link to `Note A` and click it in the preview.
- **Expected:** editor and preview switch to `Note A`; sidebar collapses back and focuses `Note A` at the root.

## 8. Wikilink to current note (edge case)

- Open a note and use the `[[` picker to insert a link pointing to itself.
- Click the wikilink in the preview.
- **Expected:** no visible flash, scroll jump, or duplicate expand animation. The note stays open cleanly.

## 9. Sidebar note ordering

- Open the vault with several notes. Verify notes within each folder are ordered alphabetically by title.
- Edit a note (type a few characters). **Expected:** the note does not move in the sidebar.
- Undo the edit (Ctrl+Z). **Expected:** the note still does not move.

## 10. Per-note undo/redo history

- Open note A. Type "hello" then "world" (two distinct edits).
- Switch to note B. Type "foo".
- Press Ctrl+Z in note B — "foo" should be undone. Note A is unaffected.
- Switch back to note A — content and cursor position should be exactly as left.
- Press Ctrl+Z in note A — "world" should be undone. Note B is unaffected.
- Switch to note B and back to note A again — undo history in A should still be intact (pressing Ctrl+Z again undoes "hello").

## 11. Tab strip

- With no tabs open, verify the tab strip is not visible.
- Right-click a note in the sidebar. Verify the context menu appears with an "Open in tab" item.
- Click outside the context menu (or press Escape). Verify it dismisses without opening a tab.
- Right-click the same note and select "Open in tab". Verify the tab strip appears with one tab, the note is navigated to, and the tab is highlighted as active.
- Right-click a second note and select "Open in tab". Verify a second tab appears and navigation switches to that note.
- Click the first tab. Verify the editor switches to that note and the tab is highlighted as active.
- With two tabs open, single-click a third note in the sidebar (do not use the context menu). Verify no new tab is added and the tab strip still shows only the original two tabs.
- Verify the breadcrumb shows a `⊕` marker for the third note (since it is active but not a tab).
- Click the `⊕` marker. Verify the third note is now added to the tab strip.
- Close the active tab using its `×` button. Verify the editor switches to the nearest remaining tab and that tab becomes active.
- Close all remaining tabs one by one. Verify the tab strip disappears when the last tab is closed.
- With no tabs open, verify the `⊕` marker is not shown in the breadcrumb even when browsing notes.

## 12. Browser mode smoke test

- Run `npm run dev` and open in browser.
- Create folders and notes, verify they persist across page reload (IndexedDB).
- Confirm wikilinks, autocomplete, search, and delete all work as in desktop mode.
