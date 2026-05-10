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

function buildFolderMap(folders: Folder[]): Map<string, Folder> {
  return new Map(folders.map((f) => [f.id, f]))
}

// Maps `parentId` (or '' for root) → (name → Folder), for O(1) path segment lookup
function buildFolderChildMap(folders: Folder[]): Map<string, Map<string, Folder>> {
  const m = new Map<string, Map<string, Folder>>()
  for (const f of folders) {
    const key = f.parentId ?? ''
    if (!m.has(key)) m.set(key, new Map())
    m.get(key)!.set(f.name, f)
  }
  return m
}

function folderPath(vault: string, folder: Folder, folderMap: Map<string, Folder>): string {
  const parts: string[] = []
  let id: string | null = folder.id
  while (id !== null) {
    const f = folderMap.get(id)
    if (!f) break
    parts.unshift(f.name)
    id = f.parentId
  }
  return [vault, ...parts].join('/')
}

function noteDiskPath(vault: string, note: Note, folderMap: Map<string, Folder>): string {
  if (note.folderId === null) return `${vault}/${sanitizeFilename(note.title)}.md`
  const folder = folderMap.get(note.folderId)
  if (!folder) return `${vault}/${sanitizeFilename(note.title)}.md`
  const dir = folderPath(vault, folder, folderMap)
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
  const folderChildMap = buildFolderChildMap(folders)
  await scanDir(vault, vault, folderChildMap, notes)
  return notes
}

async function scanDir(
  vault: string,
  dir: string,
  folderChildMap: Map<string, Map<string, Folder>>,
  acc: Note[],
): Promise<void> {
  const entries = await readDir(dir)
  for (const entry of entries) {
    if (entry.name === INDEX_FILE) continue
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory) {
      await scanDir(vault, fullPath, folderChildMap, acc)
    } else if (entry.name.endsWith('.md')) {
      const raw = await readTextFile(fullPath)
      const { meta, body } = parseFrontmatter(raw)
      const relDir = dir === vault ? null : dir.slice(vault.length + 1)
      const folderId = relDir ? resolveFolderIdByPath(relDir, folderChildMap) : null
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

function resolveFolderIdByPath(
  relPath: string,
  folderChildMap: Map<string, Map<string, Folder>>,
): string | null {
  const parts = relPath.split('/')
  let parentId: string | null = null
  for (const part of parts) {
    const match: Folder | undefined = folderChildMap.get(parentId ?? '')?.get(part)
    if (!match) return null
    parentId = match.id
  }
  return parentId
}

// ── Merge vault from disk ──────────────────────────────────────────────────
// Scans the vault for .md files and registers any note whose id is not yet
// tracked in index.notePaths. Called on load so external edits are picked up.
// Safe to call again later (e.g. from a file watcher).

export async function mergeVaultFromDisk(vault: string, index: VaultIndex): Promise<void> {
  const scanned = await scanNotes(vault, index.folders)
  let dirty = false
  for (const note of scanned) {
    if (!index.notePaths[note.id]) {
      const folderMap = buildFolderMap(index.folders)
      index.notePaths[note.id] = noteDiskPath(vault, note, folderMap).slice(vault.length + 1)
      dirty = true
    }
  }
  if (dirty) await writeIndex(vault, index)
}

// ── Adapter ────────────────────────────────────────────────────────────────

export async function createTauriAdapter(): Promise<StorageAdapter & { vaultPath: string }> {
  const vault = await getOrPickVaultPath()
  await mkdir(vault, { recursive: true })

  let index = await readIndex(vault)
  await mergeVaultFromDisk(vault, index)

  // Ensure all folder directories exist on disk
  async function ensureFolderDirs(): Promise<void> {
    const folderMap = buildFolderMap(index.folders)
    for (const folder of index.folders) {
      const dir = folderPath(vault, folder, folderMap)
      await mkdir(dir, { recursive: true })
    }
  }
  await ensureFolderDirs()

  return {
    vaultPath: vault,

    async loadAll() {
      index = await readIndex(vault)
      await mergeVaultFromDisk(vault, index)
      const notes = await scanNotes(vault, index.folders)
      return { notes, folders: index.folders }
    },

    async saveNote(note: Note) {
      const path = noteDiskPath(vault, note, buildFolderMap(index.folders))
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
        const oldMap = buildFolderMap(index.folders)
        const oldPath = folderPath(vault, existing, oldMap)
        index.folders = index.folders.map((f) => (f.id === folder.id ? folder : f))
        const newPath = folderPath(vault, folder, buildFolderMap(index.folders))
        if (oldPath !== newPath && (await exists(oldPath))) {
          await mkdir(newPath.slice(0, newPath.lastIndexOf('/')), { recursive: true })
          // tauri-plugin-fs rename
          const { rename } = await import('@tauri-apps/plugin-fs')
          await rename(oldPath, newPath)
        }
      } else {
        index.folders.push(folder)
        const dir = folderPath(vault, folder, buildFolderMap(index.folders))
        await mkdir(dir, { recursive: true })
      }
      await writeIndex(vault, index)
    },

    async deleteFolder(id: string) {
      const folder = index.folders.find((f) => f.id === id)
      if (folder) {
        const dir = folderPath(vault, folder, buildFolderMap(index.folders))
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
