# Lichra — Tech Debt & Known Issues

Identified during a pre-v2 architecture audit. Ordered by severity.

## High — fix before new features

### 1. O(n²) folder path resolution
**File:** `src/lib/storage-tauri.ts:49–59`

`folderPath()` walks the ancestor chain with `allFolders.find()` on every step, and is called on every note and folder save. Degrades badly with many folders.

**Fix:** Build a `Map<id, Folder>` once at load time and pass it down instead of the raw array.

---

### 2. Index can drift from disk
**File:** `src/lib/storage-tauri.ts:163–167`

On load, the app reads `_lichra.json` then scans the vault. If the user edits files externally (another editor, terminal), the index goes stale. On the next folder rename, external notes can be orphaned or duplicated.

**Fix:** After reading the index, scan disk and merge any untracked notes into the index before returning.

---

### 3. Race condition in state updates
**File:** `src/lib/notes.ts:158–169`

`updateContent` removes a note from the in-memory index, mutates the store, then re-adds the note. If the mutation throws between remove and re-add, the index is permanently corrupted until page reload. Same pattern exists in other mutators.

**Fix:** Rollback the index removal on error, or update the index only after a confirmed successful store mutation.

---

## Medium — worth fixing soon

### 4. Fragile frontmatter parsing
**File:** `src/lib/storage-tauri.ts:12–22`

Hand-rolled regex parser. Known failure modes:
- Doesn't handle `\r\n` line endings (breaks on Windows if files are edited externally)
- Silently truncates values containing a colon (e.g. `title: foo: bar` → `{ title: "foo" }`)
- No escaping or multiline value support

**Fix:** Replace with `js-yaml` or a dedicated frontmatter library (e.g. `gray-matter`).

---

### 5. Back-pointer callback for wikilink navigation
**File:** `src/App.tsx:92`

`onRegisterNavigate` is a side-channel where the parent stores a reference to a child's internal function. This is an anti-pattern in component hierarchies and makes the data flow hard to follow.

**Fix:** Expose a `navigateToNote(id)` action on the store, or use a simple event bus, so Preview can trigger navigation without a back-pointer.

---

### 6. Duplicate titles silently corrupt the title index
**File:** `src/lib/notes.ts:59`

The title index (`Map<lowerTitle, Note>`) lets a later note silently shadow an earlier one with the same lowercase title. The UI warns on rename but does not prevent duplicates. Wikilinks then resolve to whichever note was indexed last.

**Fix:** Either enforce unique titles as a hard constraint (reject duplicates), or switch wikilink resolution to ID-based with title as an alias.

---

## Low — tidy-up

### 7. Duplicate delete button components
**File:** `src/components/FolderTree.tsx:175–226`

`NoteDeleteButton` and `FolderDeleteButton` implement identical two-click confirmation logic in separate copy-pasted components.

**Fix:** Extract a shared `ConfirmButton` component.

---

### 8. No Content Security Policy
**File:** `src-tauri/tauri.conf.json:23` (`"csp": null`)

Low risk for a local-only app, but a missing CSP becomes a real concern if note sharing or sync is added (Mermaid SVGs accept user-provided content).

**Fix:** Set a restrictive CSP now: `"default-src 'self'; script-src 'self'"`.

---

### 9. No tests
Critical paths have no test coverage:
- Frontmatter parse/serialize round-trip
- Folder path resolution (deep nesting, renames)
- In-memory index consistency (add, remove, duplicate titles)
- Tauri adapter file I/O and external-edit handling

**Fix:** Add a Vitest suite. The storage adapter interface makes it straightforward to test adapters in isolation with a mock filesystem.
