# Lichra — Tech Debt & Known Issues

Identified during a pre-v2 architecture audit. Ordered by severity.

## High — fix before new features

### ~~1. O(n²) folder path resolution~~ ✓ Fixed

`folderPath()` and `resolveFolderIdByPath()` now use pre-built maps (`Map<id, Folder>` and `Map<parentId, Map<name, Folder>>`) instead of `Array.find()` on every step.

---

### ~~2. Index can drift from disk~~ ✓ Fixed

`mergeVaultFromDisk(vault, index)` now runs on every `loadAll()` call. It scans the vault for `.md` files and registers any note ID not already tracked in `notePaths`, then writes the index if anything changed. The function is exported so a future file watcher can call it without duplication.

---

### ~~3. Race condition in state updates~~ ✓ Fixed

`withIndexRollback(fn)` in `notes.ts` snapshots all three index signals before calling `fn`, and restores them if `fn` throws. Applied to `updateContent`, `renameNote`, and `renameFolder` — the three mutators that followed the remove→mutate→re-add pattern.

---

## Medium — worth fixing soon

### ~~4. Fragile frontmatter parsing~~ ✓ Fixed

`parseFrontmatter` now normalises `\r\n` → `\n` before matching, fixing the Windows line-ending failure. The colon-truncation bug reported in the audit was a false positive — `indexOf` + `slice(colon + 1)` already preserved colons in values correctly. The format is intentionally simple (three machine-written string fields), so the hand-rolled parser is sufficient without adding a dependency.

---

### ~~5. Back-pointer callback for wikilink navigation~~ ✓ Fixed

`navigateToNote(id)` is now a store action (`src/lib/notes.ts`). `Workspace` calls `store.navigateToNote()` directly on wikilink clicks. The `onRegisterNavigate` prop and the `sidebarNavigate` mutable variable are gone. `Sidebar` retains its own `navigateToNote` for the expand-ancestors and scroll-into-view side effects, which are sidebar-local UI concerns.

---

### 6. Duplicate titles silently corrupt the title index
**File:** `src/lib/notes.ts:59`

The title index (`Map<lowerTitle, Note>`) lets a later note silently shadow an earlier one with the same lowercase title. The UI warns on rename but does not prevent duplicates. Wikilinks then resolve to whichever note was indexed last.

**Decision:** Switch wikilink storage to ID-based (`[[uuid]]` in raw `.md`), rendering the note title as display text in-app. This is unambiguous and rename-safe. The raw markdown will contain UUIDs, but a future `id → path` map can make links more readable when opened in other editors.

**Deferred until after #9 (tests):** this is a breaking change to existing note content requiring a migration on first launch. A test suite should be in place before that migration is written.

---

## Low — tidy-up

### ~~7. Duplicate delete button components~~ ✓ Fixed

`NoteDeleteButton` and `FolderDeleteButton` replaced by a single `ConfirmButton` component in `src/sidebar/FolderTree.tsx`. Accepts `class` and `confirmTitle` props to cover both cases.

---

### ~~8. No Content Security Policy~~ ✓ Fixed

CSP set in `src-tauri/tauri.conf.json`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`. `unsafe-inline` for styles is required by Mermaid SVG rendering and `markdown-it` inline styles. Scripts are locked to `'self'`.

---

### ~~9. No tests~~ ✓ Partially addressed

Vitest added (`npm test`). 28 tests across two files covering the highest-value pure logic:

- `src/lib/__tests__/storage-tauri.test.ts` — `parseFrontmatter`, `serializeFrontmatter` (including CRLF and colon-in-value), `buildFolderMap`, `buildFolderChildMap`, `folderPath`, `resolveFolderIdByPath`
- `src/lib/__tests__/notes.test.ts` — `buildIndex` (placement, sorting, depth, empty cases)

**Deferred:** Tauri adapter I/O tests (require fake filesystem), rename/duplicate-title tests (pending #6 refactor). Manual test plan: `docs/manual-tests.md`.
