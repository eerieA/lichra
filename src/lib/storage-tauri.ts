import { readTextFile, writeTextFile, remove, mkdir, readDir, exists } from '@tauri-apps/plugin-fs'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { load as loadStore } from '@tauri-apps/plugin-store'
import type { StorageAdapter, Note, Folder } from './storage'

const STORE_FILE = 'lichra-prefs.json'
const VAULT_KEY = 'vaultPath'
const INDEX_FILE = '_lichra.json'

// ── Frontmatter ────────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return { meta, body: match[2] }
}

function serializeFrontmatter(meta: Record<string, string>, body: string): string {
  const lines = Object.entries(meta).map(([k, v]) => `${k}: ${v}`)
  return `---\n${lines.join('\n')}\n---\n${body}`
}

// ── Vault path ─────────────────────────────────────────────────────────────

async function getOrPickVaultPath(): Promise<string> {
  const store = await loadStore(STORE_FILE)
  const saved = await store.get<string>(VAULT_KEY)
  if (saved) return saved

  const chosen = await openDialog({
    title: 'Choose your Lichra vault folder',
    directory: true,
  })
  if (!chosen) throw new Error('No vault folder selected')

  await store.set(VAULT_KEY, chosen)
  await store.save()
  return chosen
}

// ── Path helpers ───────────────────────────────────────────────────────────

function folderPath(vault: string, folder: Folder, allFolders: Folder[]): string {
  const parts: string[] = []
  let id: string | null = folder.id
  while (id !== null) {
    const f = allFolders.find((x) => x.id === id)
    if (!f) break
    parts.unshift(f.name)
    id = f.parentId
  }
  return [vault, ...parts].join('/')
}

function noteDiskPath(vault: string, note: Note, allFolders: Folder[]): string {
  if (note.folderId === null) return `${vault}/${sanitizeFilename(note.title)}.md`
  const folder = allFolders.find((f) => f.id === note.folderId)
  if (!folder) return `${vault}/${sanitizeFilename(note.title)}.md`
  const dir = folderPath(vault, folder, allFolders)
  return `${dir}/${sanitizeFilename(note.title)}.md`
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Untitled'
}

// ── Index (folders + note path registry) ──────────────────────────────────

interface VaultIndex {
  folders: Folder[]
  // maps note id → relative path from vault root (tracks renames)
  notePaths: Record<string, string>
}

async function readIndex(vault: string): Promise<VaultIndex> {
  const path = `${vault}/${INDEX_FILE}`
  if (!(await exists(path))) return { folders: [], notePaths: {} }
  try {
    const raw = await readTextFile(path)
    return JSON.parse(raw) as VaultIndex
  } catch {
    return { folders: [], notePaths: {} }
  }
}

async function writeIndex(vault: string, index: VaultIndex): Promise<void> {
  await writeTextFile(`${vault}/${INDEX_FILE}`, JSON.stringify(index, null, 2))
}

// ── Scan vault for .md files ───────────────────────────────────────────────

async function scanNotes(vault: string, folders: Folder[]): Promise<Note[]> {
  const notes: Note[] = []
  await scanDir(vault, vault, folders, notes)
  return notes
}

async function scanDir(
  vault: string,
  dir: string,
  folders: Folder[],
  acc: Note[],
): Promise<void> {
  const entries = await readDir(dir)
  for (const entry of entries) {
    if (entry.name === INDEX_FILE) continue
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory) {
      await scanDir(vault, fullPath, folders, acc)
    } else if (entry.name.endsWith('.md')) {
      const raw = await readTextFile(fullPath)
      const { meta, body } = parseFrontmatter(raw)
      const relDir = dir === vault ? null : dir.slice(vault.length + 1)
      const folderId = relDir ? resolveFolderIdByPath(relDir, folders) : null
      acc.push({
        id: meta.id ?? crypto.randomUUID(),
        title: meta.title ?? entry.name.replace(/\.md$/, ''),
        content: body,
        folderId,
        updatedAt: meta.updatedAt ? parseInt(meta.updatedAt) : Date.now(),
      })
    }
  }
}

function resolveFolderIdByPath(relPath: string, folders: Folder[]): string | null {
  const parts = relPath.split('/')
  let parentId: string | null = null
  for (const part of parts) {
    const match = folders.find((f) => f.name === part && f.parentId === parentId)
    if (!match) return null
    parentId = match.id
  }
  return parentId
}

// ── Adapter ────────────────────────────────────────────────────────────────

export async function createTauriAdapter(): Promise<StorageAdapter & { vaultPath: string }> {
  const vault = await getOrPickVaultPath()
  await mkdir(vault, { recursive: true })

  let index = await readIndex(vault)

  // Ensure all folder directories exist on disk
  async function ensureFolderDirs(): Promise<void> {
    for (const folder of index.folders) {
      const dir = folderPath(vault, folder, index.folders)
      await mkdir(dir, { recursive: true })
    }
  }
  await ensureFolderDirs()

  return {
    vaultPath: vault,

    async loadAll() {
      index = await readIndex(vault)
      const notes = await scanNotes(vault, index.folders)
      return { notes, folders: index.folders }
    },

    async saveNote(note: Note) {
      const path = noteDiskPath(vault, note, index.folders)
      const dir = path.slice(0, path.lastIndexOf('/'))
      await mkdir(dir, { recursive: true })

      // If the note was previously saved at a different path (rename), remove old file
      const oldRelPath = index.notePaths[note.id]
      const newRelPath = path.slice(vault.length + 1)
      if (oldRelPath && oldRelPath !== newRelPath) {
        const oldFull = `${vault}/${oldRelPath}`
        if (await exists(oldFull)) await remove(oldFull)
      }
      index.notePaths[note.id] = newRelPath
      await writeIndex(vault, index)

      const content = serializeFrontmatter(
        { id: note.id, title: note.title, updatedAt: String(note.updatedAt) },
        note.content,
      )
      await writeTextFile(path, content)
    },

    async deleteNote(id: string) {
      const relPath = index.notePaths[id]
      if (relPath) {
        const full = `${vault}/${relPath}`
        if (await exists(full)) await remove(full)
        delete index.notePaths[id]
        await writeIndex(vault, index)
      }
    },

    async saveFolder(folder: Folder) {
      const existing = index.folders.find((f) => f.id === folder.id)
      if (existing) {
        // Rename: move directory on disk
        const oldPath = folderPath(vault, existing, index.folders)
        index.folders = index.folders.map((f) => (f.id === folder.id ? folder : f))
        const newPath = folderPath(vault, folder, index.folders)
        if (oldPath !== newPath && (await exists(oldPath))) {
          await mkdir(newPath.slice(0, newPath.lastIndexOf('/')), { recursive: true })
          // tauri-plugin-fs rename
          const { rename } = await import('@tauri-apps/plugin-fs')
          await rename(oldPath, newPath)
        }
      } else {
        index.folders.push(folder)
        const dir = folderPath(vault, folder, index.folders)
        await mkdir(dir, { recursive: true })
      }
      await writeIndex(vault, index)
    },

    async deleteFolder(id: string) {
      const folder = index.folders.find((f) => f.id === id)
      if (folder) {
        const dir = folderPath(vault, folder, index.folders)
        if (await exists(dir)) await remove(dir, { recursive: true })
      }
      index.folders = index.folders.filter((f) => f.id !== id)
      // Clean up notePaths entries for notes that were in this folder
      for (const [noteId, relPath] of Object.entries(index.notePaths)) {
        if (!await exists(`${vault}/${relPath}`)) delete index.notePaths[noteId]
      }
      await writeIndex(vault, index)
    },
  }
}
