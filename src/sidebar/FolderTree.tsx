import { Component, createSignal, For, Show } from 'solid-js'
import type { Note, Folder, NotesStore } from '../lib/notes'

interface Props {
  store: NotesStore
  selectedFolderId: () => string | null
  onSelectFolder: (id: string | null) => void
}

const FolderTree: Component<Props> = (props) => {
  return (
    <div class="folder-tree">
      <FolderNode
        store={props.store}
        folderId={null}
        label="/ root"
        depth={0}
        selectedFolderId={props.selectedFolderId}
        onSelectFolder={props.onSelectFolder}
      />
    </div>
  )
}

interface NodeProps {
  store: NotesStore
  folderId: string | null
  label: string
  depth: number
  selectedFolderId: () => string | null
  onSelectFolder: (id: string | null) => void
}

const FolderNode: Component<NodeProps> = (props) => {
  const [open, setOpen] = createSignal(true)

  const subfolders = () => props.store.getChildFolders(props.folderId)
  const notes = () => props.store.getNotesInFolder(props.folderId)
  const isSelected = () => props.selectedFolderId() === props.folderId

  return (
    <div class="folder-node" style={{ '--depth': props.depth }}>
      <div
        class={`folder-label${isSelected() ? ' selected' : ''}`}
        onClick={() => {
          props.onSelectFolder(props.folderId)
          setOpen((o) => !o)
        }}
      >
        <span class="folder-caret">{open() ? '▾' : '▸'}</span>
        <span class="folder-name">{props.label}</span>
      </div>

      <Show when={open()}>
        <For each={notes()}>
          {(note) => <NoteItem note={note} store={props.store} />}
        </For>
        <For each={subfolders()}>
          {(folder) => (
            <FolderNode
              store={props.store}
              folderId={folder.id}
              label={folder.name}
              depth={props.depth + 1}
              selectedFolderId={props.selectedFolderId}
              onSelectFolder={props.onSelectFolder}
            />
          )}
        </For>
      </Show>
    </div>
  )
}

interface NoteItemProps {
  note: Note
  store: NotesStore
}

const NoteItem: Component<NoteItemProps> = (props) => {
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal('')

  const isActive = () => props.store.currentId() === props.note.id

  function startRename() {
    setDraft(props.note.title)
    setEditing(true)
  }

  function commitRename() {
    const t = draft().trim()
    if (t && t !== props.note.title) props.store.renameNote(props.note.id, t)
    setEditing(false)
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (confirm(`Delete "${props.note.title}"?`)) props.store.deleteNote(props.note.id)
  }

  return (
    <div
      class={`note-item${isActive() ? ' active' : ''}`}
      onClick={() => props.store.setCurrentId(props.note.id)}
      onDblClick={startRename}
    >
      <Show
        when={editing()}
        fallback={
          <>
            <span class="note-title">{props.note.title}</span>
            <button class="note-delete" onClick={handleDelete} title="Delete">×</button>
          </>
        }
      >
        <input
          class="note-rename-input"
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
          ref={(el) => setTimeout(() => el.focus(), 0)}
        />
      </Show>
    </div>
  )
}

export default FolderTree
