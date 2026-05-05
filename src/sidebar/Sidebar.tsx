import { Component, createSignal, For, Show } from 'solid-js'
import type { NotesStore } from '../lib/notes'
import FolderTree from './FolderTree'

interface Props {
  store: NotesStore
}

const Sidebar: Component<Props> = (props) => {
  const [query, setQuery] = createSignal('')
  // null = root
  const [selectedFolderId, setSelectedFolderId] = createSignal<string | null>(null)
  const [newFolder, setNewFolder] = createSignal(false)
  const [folderDraft, setFolderDraft] = createSignal('')

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

  function handleNewNote() {
    const note = props.store.createNote(selectedFolderId())
    props.store.setCurrentId(note.id)
  }

  function handleNewFolder() {
    setFolderDraft('')
    setNewFolder(true)
  }

  function commitNewFolder() {
    const name = folderDraft().trim()
    if (name) {
      const folder = props.store.createFolder(name, selectedFolderId())
      setSelectedFolderId(folder.id)
    }
    setNewFolder(false)
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
              >
                <span class="note-title">{note.title}</span>
                <span class="note-folder-badge">{folderBadge(note.folderId)}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!isSearching()}>
        <FolderTree
          store={props.store}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
        />
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
        </div>
      </Show>
    </div>
  )
}

export default Sidebar
