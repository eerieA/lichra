# Lichra — Tech Debt & Known Issues

## Resolved

| # | Issue | Fix |
|---|-------|-----|
| 1 | O(n²) folder path resolution | `buildFolderMap` / `buildFolderChildMap` replace `Array.find()` on every step |
| 2 | Index can drift from disk | `mergeVaultFromDisk()` runs on every `loadAll()`, reconciling untracked files |
| 3 | Race condition in state updates | `withIndexRollback(fn)` snapshots and restores index signals on error |
| 4 | Fragile frontmatter parsing | `\r\n` normalised before regex match; colon-in-value was a false positive |
| 5 | Back-pointer callback for wikilink navigation | `store.navigateToNote(id)` replaces the `onRegisterNavigate` side-channel |
| 6 | Duplicate titles silently corrupt title index | Wikilinks now store `[[uuid]]`; `normaliseWikilinks()` rewrites legacy `[[Title]]` links on load |
| 7 | Duplicate delete button components | Single `ConfirmButton` component replaces `NoteDeleteButton` + `FolderDeleteButton` |
| 8 | No Content Security Policy | CSP set in `src-tauri/tauri.conf.json`; scripts locked to `'self'` |
| 9 | No tests | Vitest added; 38 tests across `storage-tauri`, `notes`, and `wikilinks` modules |

## Open

### Tauri adapter I/O tests
**File:** `src/lib/storage-tauri.ts`

The adapter's file I/O operations (`saveNote`, `saveFolder`, `deleteNote`, `deleteFolder`, `mergeVaultFromDisk`) have no automated test coverage. Testing them requires either a real vault on disk or a fake filesystem (e.g. `memfs`).

**Deferred until:** a `memfs`-based test harness is set up. Lower priority now that the pure logic functions (path resolution, frontmatter, index) are covered.

---

### Wikilink authoring gap
**File:** `src/lib/wikilinks.ts`

`normaliseWikilinks()` runs at `load()` time only. If a user writes `[[Title]]` in an external editor and clicks the link in the same session before restarting, it renders as a missing link. Resolves correctly on the next app launch.

**Planned fix:** `[[` autocomplete picker in the editor (requires replacing the plain textarea with CodeMirror first). See `docs/architecture.md` — v1.5 Ideas.
