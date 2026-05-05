export type Folder = {
  id: string
  name: string
  parentId: string | null  // null = root
}

export type Note = {
  id: string
  title: string
  content: string
  folderId: string | null  // null = root
  updatedAt: number
}

export interface StorageAdapter {
  loadAll(): Promise<{ notes: Note[]; folders: Folder[] }>
  saveNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  saveFolder(folder: Folder): Promise<void>
  deleteFolder(id: string): Promise<void>
}

const DB_NAME = 'lichra'
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        db.createObjectStore('notes', { keyPath: 'id' })
      }

      if (oldVersion < 2) {
        // Migrate notes: drop old 'folder' string field, add 'folderId'
        // Folders store is new in v2
        db.createObjectStore('folders', { keyPath: 'id' })

        const notesStore = req.transaction!.objectStore('notes')
        notesStore.createIndex('byFolder', 'folderId')

        // Migrate existing notes: build Folder records from path strings
        notesStore.getAll().onsuccess = (e) => {
          const oldNotes = (e.target as IDBRequest).result as Array<Record<string, unknown>>
          const folderStore = req.transaction!.objectStore('folders')

          // path → folder id
          const pathToId = new Map<string, string>()

          for (const note of oldNotes) {
            const folderPath = (note.folder as string | undefined) ?? ''
            const parts = folderPath.split('/').filter(Boolean)
            let parentId: string | null = null

            for (let i = 0; i < parts.length; i++) {
              const path = parts.slice(0, i + 1).join('/')
              if (!pathToId.has(path)) {
                const id = crypto.randomUUID()
                pathToId.set(path, id)
                folderStore.put({ id, name: parts[i], parentId })
              }
              parentId = pathToId.get(path)!
            }

            const folderId = folderPath
              ? pathToId.get(folderPath) ?? null
              : null

            notesStore.put({
              id: note.id,
              title: note.title,
              content: note.content,
              folderId,
              updatedAt: note.updatedAt,
            })
          }
        }
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function createIndexedDBAdapter(): Promise<StorageAdapter> {
  const db = await openDB()

  return {
    async loadAll() {
      const t = db.transaction(['notes', 'folders'], 'readonly')
      const [notes, folders] = await Promise.all([
        idbRequest<Note[]>(t.objectStore('notes').getAll()),
        idbRequest<Folder[]>(t.objectStore('folders').getAll()),
      ])
      return { notes, folders }
    },

    async saveNote(note: Note) {
      await idbRequest(db.transaction('notes', 'readwrite').objectStore('notes').put(note))
    },

    async deleteNote(id: string) {
      await idbRequest(db.transaction('notes', 'readwrite').objectStore('notes').delete(id))
    },

    async saveFolder(folder: Folder) {
      await idbRequest(db.transaction('folders', 'readwrite').objectStore('folders').put(folder))
    },

    async deleteFolder(id: string) {
      await idbRequest(db.transaction('folders', 'readwrite').objectStore('folders').delete(id))
    },
  }
}
