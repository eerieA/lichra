import { Component, createMemo, createSignal, For, onMount, Show } from 'solid-js'
import type { NotesStore } from '../lib/notes'
import FolderTree from './FolderTree'

interface Props {
  store: NotesStore
  onRegisterNavigate: (fn: (id: string) => void) => void
}

function getAncestorIds(folderId: string | null, store: NotesStore): string[] {
  const ids: string[] = []
  let id = folderId
  while (id !== null) {
    ids.push(id)
    const f = store.getFolderById(id)
    id = f?.parentId ?? null
  }
  return ids
}

const Sidebar: Component<Props> = (props) => {
  const [query, setQuery] = createSignal('')
  const [selectedFolderId, setSelectedFolderId] = createSignal<string | null>(null)
  const [newFolder, setNewFolder] = createSignal(false)
  const [folderDraft, setFolderDraft] = createSignal('')

  const isDuplicateFolderName = createMemo(() => {
    const name = folderDraft().trim().toLowerCase()
    if (!name) return false
    return props.store.folders.some(
      (f) => f.parentId === selectedFolderId() && f.name.toLowerCase() === name
    )
  })
  const [openFolderIds, setOpenFolderIds] = createSignal<Set<string>>(new Set())

  const noteRefs = new Map<string, HTMLElement>()
  let treeScrollRef!: HTMLDivElement

  const isSearching = () => query().trim().length > 0

  const searchResults = () => {
    const q = query().toLowerCase().trim()
    if (!q) return []
    return props.store.notes.filter((n) => n.title.toLowerCase().includes(q))
  }

  function folderBadge(folderId: string | null): string {
    if (folderId === null) return '/'
    const parts: string[] = []
    let id: string | null = folderId
    while (id !== null) {
      const f = props.store.getFolderById(id)
      if (!f) break
      parts.unshift(f.name)
      id = f.parentId
    }
    return '/' + parts.join('/')
  }

  // Single entry point for all note navigation
  function navigateToNote(id: string) {
    props.store.setCurrentId(id)
    const note = props.store.notes.find((n) => n.id === id)
    if (!note) return
    // Expand all ancestors
    const ancestors = getAncestorIds(note.folderId, props.store)
    if (ancestors.length > 0) {
      setOpenFolderIds((prev) => {
        const next = new Set(prev)
        for (const aid of ancestors) next.add(aid)
        return next
      })
    }
    // Scroll after DOM settles
    setTimeout(() => {
      noteRefs.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 0)
  }

  onMount(() => {
    props.onRegisterNavigate(navigateToNote)
    // Expand and scroll to the active note on initial load
    const id = props.store.currentId()
    if (id) navigateToNote(id)
  })

  function handleToggleFolder(folderId: string | null) {
    if (folderId === null) return
    setOpenFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function handleNewNote() {
    const note = props.store.createNote(selectedFolderId())
    navigateToNote(note.id)
  }

  function handleNewFolder() {
    setFolderDraft('')
    setNewFolder(true)
  }

  function commitNewFolder() {
    const name = folderDraft().trim()
    if (!name) { setNewFolder(false); return }
    if (isDuplicateFolderName()) return  // keep input open, warning is shown
    setFolderDraft('')
    setNewFolder(false)
    const folder = props.store.createFolder(name, selectedFolderId())
    setSelectedFolderId(folder.id)
    setOpenFolderIds((prev) => new Set([...prev, folder.id]))
  }

  return (
    <div class="sidebar">
      <div class="sidebar-search">
        <input
          type="text"
          placeholder="Search notes..."
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </div>

      <Show when={isSearching()}>
        <div class="search-results">
          <For each={searchResults()}>
            {(note) => (
              <div
                class={`note-item${props.store.currentId() === note.id ? ' active' : ''}`}
                onClick={() => props.store.setCurrentId(note.id)}
                onDblClick={() => {
                  setQuery('')
                  navigateToNote(note.id)
                }}
                title="Double-click to reveal in folder tree"
              >
                <span class="note-title">{note.title}</span>
                <span class="note-folder-badge">{folderBadge(note.folderId)}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!isSearching()}>
        <div class="folder-tree-scroll" ref={treeScrollRef}>
          <FolderTree
            store={props.store}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            openFolderIds={openFolderIds}
            onToggleFolder={handleToggleFolder}
            onNavigateNote={navigateToNote}
            noteRefs={noteRefs}
          />
        </div>
      </Show>

      <div class="sidebar-actions">
        <button onClick={handleNewNote} title="New note">+ Note</button>
        <button onClick={handleNewFolder} title="New folder">+ Folder</button>
      </div>

      <Show when={newFolder()}>
        <div class="new-folder-input">
          <input
            placeholder="Folder name..."
            value={folderDraft()}
            onInput={(e) => setFolderDraft(e.currentTarget.value)}
            onBlur={commitNewFolder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitNewFolder()
              if (e.key === 'Escape') setNewFolder(false)
            }}
            ref={(el) => setTimeout(() => el.focus(), 0)}
          />
          <Show when={isDuplicateFolderName()}>
            <span class="new-folder-warning">A folder with this name already exists here</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default Sidebar
