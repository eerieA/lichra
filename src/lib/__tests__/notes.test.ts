// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildIndex } from '../notes'
import type { Note, Folder } from '../storage'

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return { id, name, parentId }
}

function note(id: string, title: string, folderId: string | null = null, updatedAt = 0): Note {
  return { id, title, content: '', folderId, updatedAt }
}

// ── buildIndex ─────────────────────────────────────────────────────────────

describe('buildIndex', () => {
  it('places root notes under null key in folderNotes', () => {
    const notes = [note('n1', 'Note 1')]
    const { folderNotes } = buildIndex(notes, [])
    expect(folderNotes.get(null)?.map((n) => n.id)).toContain('n1')
  })

  it('places notes under their folderId key', () => {
    const f = folder('f1', 'Docs')
    const n = note('n1', 'Note 1', 'f1')
    const { folderNotes } = buildIndex([n], [f])
    expect(folderNotes.get('f1')?.map((n) => n.id)).toContain('n1')
  })

  it('places child folders under their parentId in childFolders', () => {
    const parent = folder('p', 'Parent')
    const child = folder('c', 'Child', 'p')
    const { childFolders } = buildIndex([], [parent, child])
    expect(childFolders.get(null)?.map((f) => f.id)).toContain('p')
    expect(childFolders.get('p')?.map((f) => f.id)).toContain('c')
  })

  it('sorts notes by updatedAt descending', () => {
    const notes = [
      note('n1', 'Old', null, 100),
      note('n2', 'New', null, 200),
      note('n3', 'Mid', null, 150),
    ]
    const { folderNotes } = buildIndex(notes, [])
    const ids = folderNotes.get(null)!.map((n) => n.id)
    expect(ids).toEqual(['n2', 'n3', 'n1'])
  })

  it('sorts folders alphabetically', () => {
    const folders = [folder('b', 'Zebra'), folder('a', 'Alpha'), folder('c', 'Mango')]
    const { childFolders } = buildIndex([], folders)
    const names = childFolders.get(null)!.map((f) => f.name)
    expect(names).toEqual(['Alpha', 'Mango', 'Zebra'])
  })

  it('handles multiple folders at different depths', () => {
    const folders = [
      folder('a', 'folder1'),
      folder('b', 'folder2', 'a'),
      folder('c', 'folder3', 'b'),
    ]
    const notes = [
      note('n1', 'Root note'),
      note('n2', 'Deep note', 'c'),
    ]
    const { folderNotes, childFolders } = buildIndex(notes, folders)
    expect(folderNotes.get(null)?.map((n) => n.id)).toContain('n1')
    expect(folderNotes.get('c')?.map((n) => n.id)).toContain('n2')
    expect(childFolders.get('b')?.map((f) => f.id)).toContain('c')
  })

  it('adding then removing a note leaves the index clean', () => {
    const n = note('n1', 'Test')
    const { folderNotes: before } = buildIndex([n], [])
    expect(before.get(null)?.length).toBe(1)

    const { folderNotes: after } = buildIndex([], [])
    expect(after.get(null) ?? []).toHaveLength(0)
  })

  it('returns empty maps for empty input', () => {
    const { childFolders, folderNotes } = buildIndex([], [])
    expect(childFolders.size).toBe(0)
    expect(folderNotes.size).toBe(0)
  })
})
