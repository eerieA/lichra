import { createSignal } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import type { Note, Folder, StorageAdapter } from './storage'
import { normaliseWikilinks } from './wikilinks'

export type { Note, Folder }

// ── Children map index ─────────────────────────────────────────────────────
// Keyed by parentId (null = root). O(1) lookup for sidebar rendering.
// Never persisted — always derived from the store and updated incrementally.

type ChildFolders = Map<string | null, Folder[]>
type FolderNotes  = Map<string | null, Note[]>

export function buildIndex(notes: Note[], folders: Folder[]): { childFolders: ChildFolders; folderNotes: FolderNotes } {
  const childFolders: ChildFolders = new Map()
  const folderNotes: FolderNotes = new Map()

  for (const f of folders) {
    if (!childFolders.has(f.parentId)) childFolders.set(f.parentId, [])
    childFolders.get(f.parentId)!.push(f)
  }

  for (const n of notes) {
    if (!folderNotes.has(n.folderId)) folderNotes.set(n.folderId, [])
    folderNotes.get(n.folderId)!.push(n)
  }

  for (const arr of childFolders.values()) arr.sort((a, b) => a.name.localeCompare(b.name))
  for (const arr of folderNotes.values()) arr.sort((a, b) => a.title.localeCompare(b.title))

  return { childFolders, folderNotes }
}

// ── Store ──────────────────────────────────────────────────────────────────

export function createNotesStore(adapter: StorageAdapter) {
  const [notes, setNotes] = createStore<Note[]>([])
  const [folders, setFolders] = createStore<Folder[]>([])
  const [currentId, setCurrentId] = createSignal<string | null>(null)

  // Children maps — plain signals so components can track them
  const [childFolders, setChildFolders] = createSignal<ChildFolders>(new Map())
  const [folderNotes, setFolderNotes] = createSignal<FolderNotes>(new Map())

  // id → note map for wikilink resolution — O(1) lookup, unambiguous across duplicate titles
  const [idIndex, setIdIndex] = createSignal<Map<string, Note>>(new Map())

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  // ── Index maintenance ────────────────────────────────────────────────────

  function rebuildIndex() {
    const { childFolders: cf, folderNotes: fn } = buildIndex(notes, folders)
    setChildFolders(cf)
    setFolderNotes(fn)

    const ii = new Map<string, Note>()
    for (const n of notes) ii.set(n.id, n)
    setIdIndex(ii)
  }

  function removeNoteFromIndex(note: Note) {
    setFolderNotes((prev) => {
      const next = new Map(prev)
      const arr = next.get(note.folderId)
      if (arr) next.set(note.folderId, arr.filter((n) => n.id !== note.id))
      return next
    })
    setIdIndex((prev) => {
      const next = new Map(prev)
      next.delete(note.id)
      return next
    })
  }

  function addNoteToIndex(note: Note) {
    setFolderNotes((prev) => {
      const next = new Map(prev)
      const arr = (next.get(note.folderId) ?? []).filter((n) => n.id !== note.id)
      arr.push(note)
      arr.sort((a, b) => a.title.localeCompare(b.title))
      next.set(note.folderId, arr)
      return next
    })
    setIdIndex((prev) => {
      const next = new Map(prev)
      next.set(note.id, note)
      return next
    })
  }

  function addFolderToIndex(folder: Folder) {
    setChildFolders((prev) => {
      const next = new Map(prev)
      const arr = (next.get(folder.parentId) ?? []).filter((f) => f.id !== folder.id)
      arr.push(folder)
      arr.sort((a, b) => a.name.localeCompare(b.name))
      next.set(folder.parentId, arr)
      return next
    })
  }

  function removeFolderFromIndex(folder: Folder) {
    setChildFolders((prev) => {
      const next = new Map(prev)
      const arr = next.get(folder.parentId)
      if (arr) next.set(folder.parentId, arr.filter((f) => f.id !== folder.id))
      return next
    })
  }

  // ── Index rollback ───────────────────────────────────────────────────────
  // Snapshots the index signals before fn(), restores them if fn() throws.

  function withIndexRollback<T>(fn: () => T): T {
    const snapFolderNotes = folderNotes()
    const snapTitleIndex = idIndex()
    const snapChildFolders = childFolders()
    try {
      return fn()
    } catch (e) {
      setFolderNotes(snapFolderNotes)
      setIdIndex(snapTitleIndex)
      setChildFolders(snapChildFolders)
      throw e
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  function currentNote(): Note | undefined {
    const id = currentId()
    return id ? notes.find((n) => n.id === id) : undefined
  }

  function getChildFolders(parentId: string | null): Folder[] {
    return childFolders().get(parentId) ?? []
  }

  function getNotesInFolder(folderId: string | null): Note[] {
    return folderNotes().get(folderId) ?? []
  }

  function getFolderById(id: string): Folder | undefined {
    return folders.find((f) => f.id === id)
  }

  function scheduleSave(note: Note) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => adapter.saveNote(note), 300)
  }

  function createNote(folderId: string | null): Note {
    const note: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled',
      content: '',
      folderId,
      updatedAt: Date.now(),
    }
    setNotes(produce((ns) => ns.push(note)))
    addNoteToIndex(note)
    adapter.saveNote(note)
    return note
  }

  function createFolder(name: string, parentId: string | null): Folder {
    const folder: Folder = { id: crypto.randomUUID(), name, parentId }
    setFolders(produce((fs) => fs.push(folder)))
    addFolderToIndex(folder)
    adapter.saveFolder(folder)
    return folder
  }

  function updateContent(id: string, content: string) {
    const existing = notes.find((n) => n.id === id)
    if (!existing || content === existing.content) return
    withIndexRollback(() => {
      removeNoteFromIndex({ ...existing })
      setNotes(
        (n) => n.id === id,
        produce((n) => { n.content = content; n.updatedAt = Date.now() })
      )
      const updated = notes.find((n) => n.id === id)!
      addNoteToIndex({ ...updated })
      scheduleSave({ ...updated })
    })
  }

  function renameNote(id: string, title: string) {
    const existing = notes.find((n) => n.id === id)
    if (!existing) return
    withIndexRollback(() => {
      removeNoteFromIndex({ ...existing })
      setNotes(
        (n) => n.id === id,
        produce((n) => { n.title = title; n.updatedAt = Date.now() })
      )
      const updated = notes.find((n) => n.id === id)!
      addNoteToIndex({ ...updated })
      adapter.saveNote({ ...updated })
    })
  }

  function renameFolder(id: string, name: string) {
    const existing = folders.find((f) => f.id === id)
    if (!existing) return
    withIndexRollback(() => {
      removeFolderFromIndex({ ...existing })
      setFolders(
        (f) => f.id === id,
        produce((f) => { f.name = name })
      )
      const updated = folders.find((f) => f.id === id)!
      addFolderToIndex({ ...updated })
      adapter.saveFolder({ ...updated })
    })
  }

  async function deleteNote(id: string) {
    const note = notes.find((n) => n.id === id)
    if (note) removeNoteFromIndex({ ...note })
    setNotes((ns) => ns.filter((n) => n.id !== id))
    await adapter.deleteNote(id)
    if (currentId() === id) {
      setCurrentId(notes.length > 0 ? notes[0].id : null)
    }
  }

  // Recursively deletes a folder and all its descendant folders and notes
  async function deleteFolder(id: string) {
    const childIds = getChildFolders(id).map((f) => f.id)
    for (const childId of childIds) await deleteFolder(childId)

    const notesHere = getNotesInFolder(id)
    for (const note of notesHere) await deleteNote(note.id)

    const folder = folders.find((f) => f.id === id)
    if (folder) removeFolderFromIndex({ ...folder })
    setFolders((fs) => fs.filter((f) => f.id !== id))
    await adapter.deleteFolder(id)
  }

  function resolveWikilink(id: string): Note | undefined {
    return idIndex().get(id)
  }

  function navigateToNote(id: string) {
    setCurrentId(id)
  }

  async function load() {
    const { notes: loadedNotes, folders: loadedFolders } = await adapter.loadAll()
    // Build a title index just for migration — maps lowerTitle → Note
    const titleIndex = new Map(loadedNotes.map((n) => [n.title.toLowerCase(), n]))
    const migratedNotes = loadedNotes.map((n) => {
      const migrated = normaliseWikilinks(n.content, titleIndex)
      if (migrated === n.content) return n
      const updated = { ...n, content: migrated }
      adapter.saveNote(updated)
      return updated
    })
    setNotes(migratedNotes)
    setFolders(loadedFolders)
    rebuildIndex()
    if (migratedNotes.length > 0) {
      const latest = [...migratedNotes].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      setCurrentId(latest.id)
    }
  }

  return {
    notes,
    folders,
    currentNote,
    currentId,
    setCurrentId,
    getChildFolders,
    getNotesInFolder,
    getFolderById,
    createNote,
    createFolder,
    updateContent,
    renameNote,
    renameFolder,
    deleteNote,
    deleteFolder,
    resolveWikilink,
    navigateToNote,
    load,
  }
}

export type NotesStore = ReturnType<typeof createNotesStore>
