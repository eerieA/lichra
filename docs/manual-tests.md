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

## 3. Wikilink navigation — shallow to deep

- Create `test1.md` at the vault root containing `[[test5]]`.
- Create `test5.md` at `folder1/folder2/folder3/folder4/folder5/`.
- Open `test1.md` and click the wikilink to `test5`.
- **Expected:** editor and preview switch to `test5`; sidebar expands all ancestor folders and scrolls `test5` into view.

## 4. Wikilink navigation — deep to shallow

- From `test5.md` at the deep path above, add `[[test1]]` and click it.
- **Expected:** editor and preview switch to `test1`; sidebar collapses back and focuses `test1` at the root.

## 5. Search result navigation

- Use the search bar to find a note at a deep path (e.g. `test5`).
- Single-click: editor switches to the note but sidebar does not expand yet.
- Double-click the result: sidebar should expand all ancestor folders, scroll the note into view, and clear the search query.

## 6. Wikilink to current note (edge case)

- Open a note that contains a wikilink pointing to itself (e.g. `[[test1]]` inside `test1.md`).
- Click the wikilink.
- **Expected:** no visible flash, scroll jump, or duplicate expand animation. The note stays open cleanly.

## 7. Browser mode smoke test

- Run `npm run dev` and open in browser.
- Create folders and notes, verify they persist across page reload (IndexedDB).
- Confirm wikilinks, search, and delete all work as in desktop mode.
