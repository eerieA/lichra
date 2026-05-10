import { describe, it, expect, vi } from 'vitest'

// Stub Tauri plugins so the module can be imported in a Node environment
vi.mock('@tauri-apps/plugin-fs', () => ({}))
vi.mock('@tauri-apps/plugin-dialog', () => ({}))
vi.mock('@tauri-apps/plugin-store', () => ({}))

import {
  parseFrontmatter,
  serializeFrontmatter,
  buildFolderMap,
  buildFolderChildMap,
  folderPath,
  resolveFolderIdByPath,
} from '../storage-tauri'
import type { Folder } from '../storage'

// ── Helpers ────────────────────────────────────────────────────────────────

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return { id, name, parentId }
}

// ── parseFrontmatter ───────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('parses well-formed frontmatter', () => {
    const raw = '---\nid: abc\ntitle: Hello\nupdatedAt: 123\n---\nbody text'
    const { meta, body } = parseFrontmatter(raw)
    expect(meta).toEqual({ id: 'abc', title: 'Hello', updatedAt: '123' })
    expect(body).toBe('body text')
  })

  it('returns raw input as body when no frontmatter present', () => {
    const raw = 'just plain content'
    const { meta, body } = parseFrontmatter(raw)
    expect(meta).toEqual({})
    expect(body).toBe(raw)
  })

  it('handles Windows CRLF line endings', () => {
    const raw = '---\r\nid: abc\r\ntitle: Hello\r\nupdatedAt: 123\r\n---\r\nbody'
    const { meta, body } = parseFrontmatter(raw)
    expect(meta.id).toBe('abc')
    expect(meta.title).toBe('Hello')
    expect(body).toBe('body')
  })

  it('preserves colons in values', () => {
    const raw = '---\ntitle: foo: bar: baz\n---\nbody'
    const { meta } = parseFrontmatter(raw)
    expect(meta.title).toBe('foo: bar: baz')
  })

  it('handles empty body', () => {
    const raw = '---\nid: x\n---\n'
    const { body } = parseFrontmatter(raw)
    expect(body).toBe('')
  })
})

// ── serializeFrontmatter ───────────────────────────────────────────────────

describe('serializeFrontmatter', () => {
  it('produces parseable output (round-trip)', () => {
    const meta = { id: 'abc', title: 'Hello', updatedAt: '123' }
    const body = 'note content'
    const serialized = serializeFrontmatter(meta, body)
    const { meta: parsed, body: parsedBody } = parseFrontmatter(serialized)
    expect(parsed).toEqual(meta)
    expect(parsedBody).toBe(body)
  })

  it('round-trips a title containing a colon', () => {
    const meta = { id: 'x', title: 'foo: bar', updatedAt: '0' }
    const { meta: parsed } = parseFrontmatter(serializeFrontmatter(meta, ''))
    expect(parsed.title).toBe('foo: bar')
  })

  it('round-trips an empty body', () => {
    const meta = { id: 'x', title: 'T', updatedAt: '0' }
    const { body } = parseFrontmatter(serializeFrontmatter(meta, ''))
    expect(body).toBe('')
  })
})

// ── buildFolderMap ─────────────────────────────────────────────────────────

describe('buildFolderMap', () => {
  it('maps each folder by id', () => {
    const folders = [folder('a', 'A'), folder('b', 'B', 'a')]
    const map = buildFolderMap(folders)
    expect(map.get('a')?.name).toBe('A')
    expect(map.get('b')?.parentId).toBe('a')
  })

  it('returns empty map for empty input', () => {
    expect(buildFolderMap([])).toEqual(new Map())
  })
})

// ── buildFolderChildMap ────────────────────────────────────────────────────

describe('buildFolderChildMap', () => {
  it('groups root folders under empty-string key', () => {
    const folders = [folder('a', 'A'), folder('b', 'B')]
    const map = buildFolderChildMap(folders)
    expect(map.get('')?.has('A')).toBe(true)
    expect(map.get('')?.has('B')).toBe(true)
  })

  it('groups children under their parentId', () => {
    const folders = [folder('a', 'A'), folder('b', 'B', 'a'), folder('c', 'C', 'a')]
    const map = buildFolderChildMap(folders)
    expect(map.get('a')?.has('B')).toBe(true)
    expect(map.get('a')?.has('C')).toBe(true)
  })

  it('returns empty map for empty input', () => {
    expect(buildFolderChildMap([])).toEqual(new Map())
  })
})

// ── folderPath ─────────────────────────────────────────────────────────────

describe('folderPath', () => {
  const vault = '/vault'

  it('returns vault/name for a root-level folder', () => {
    const f = folder('a', 'notes')
    const map = buildFolderMap([f])
    expect(folderPath(vault, f, map)).toBe('/vault/notes')
  })

  it('builds deep nested path', () => {
    const folders = [
      folder('a', 'folder1'),
      folder('b', 'folder2', 'a'),
      folder('c', 'folder3', 'b'),
    ]
    const map = buildFolderMap(folders)
    expect(folderPath(vault, folders[2], map)).toBe('/vault/folder1/folder2/folder3')
  })

  it('stops gracefully when a parent is missing from the map', () => {
    const f = folder('b', 'child', 'missing-parent')
    const map = buildFolderMap([f])
    // Should not throw; produces partial path
    expect(() => folderPath(vault, f, map)).not.toThrow()
  })
})

// ── resolveFolderIdByPath ──────────────────────────────────────────────────

describe('resolveFolderIdByPath', () => {
  const folders = [
    folder('a', 'folder1'),
    folder('b', 'folder2', 'a'),
    folder('c', 'folder3', 'b'),
  ]

  it('resolves a single-segment path', () => {
    const map = buildFolderChildMap(folders)
    expect(resolveFolderIdByPath('folder1', map)).toBe('a')
  })

  it('resolves a deep nested path', () => {
    const map = buildFolderChildMap(folders)
    expect(resolveFolderIdByPath('folder1/folder2/folder3', map)).toBe('c')
  })

  it('returns null for an unknown segment', () => {
    const map = buildFolderChildMap(folders)
    expect(resolveFolderIdByPath('folder1/nonexistent', map)).toBeNull()
  })

  it('returns null for empty folder list', () => {
    const map = buildFolderChildMap([])
    expect(resolveFolderIdByPath('folder1', map)).toBeNull()
  })
})
