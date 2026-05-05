import { Component, createSignal, For, Show } from 'solid-js'
import type { Note, Folder, NotesStore } from '../lib/notes'

interface Props {
  store: NotesStore
  selectedFolderId: () => string | null
  onSelectFolder: (id: string | null) => void
  openFolderIds: () => Set<string>
  onToggleFolder: (id: string | null) => void
  onNavigateNote: (id: string) => void
  noteRefs: Map<string, HTMLElement>
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
        openFolderIds={props.openFolderIds}
        onToggleFolder={props.onToggleFolder}
        onNavigateNote={props.onNavigateNote}
        noteRefs={props.noteRefs}
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
  openFolderIds: () => Set<string>
  onToggleFolder: (id: string | null) => void
  onNavigateNote: (id: string) => void
  noteRefs: Map<string, HTMLElement>
}

const FolderNode: Component<NodeProps> = (props) => {
  const isOpen = () =>
    props.folderId === null || props.openFolderIds().has(props.folderId)

  const subfolders = () => props.store.getChildFolders(props.folderId)
  const notes = () => props.store.getNotesInFolder(props.folderId)
  const isSelected = () => props.selectedFolderId() === props.folderId

  return (
    <div class="folder-node" style={{ '--depth': props.depth }}>
      <div
        class={`folder-label${isSelected() ? ' selected' : ''}`}
        onClick={() => {
          props.onSelectFolder(props.folderId)
          props.onToggleFolder(props.folderId)
        }}
      >
        <span class="folder-caret">{isOpen() ? '▾' : '▸'}</span>
        <span class="folder-name">{props.label}</span>
        <Show when={props.folderId !== null}>
          <button
            class="folder-delete"
            title="Delete folder"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete folder "${props.label}" and all its contents?`)) {
                props.store.deleteFolder(props.folderId!)
              }
            }}
          >×</button>
        </Show>
      </div>

      <Show when={isOpen()}>
        <For each={notes()}>
          {(note) => (
            <NoteItem
              note={note}
              store={props.store}
              onNavigate={props.onNavigateNote}
              noteRefs={props.noteRefs}
            />
          )}
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
              openFolderIds={props.openFolderIds}
              onToggleFolder={props.onToggleFolder}
              onNavigateNote={props.onNavigateNote}
              noteRefs={props.noteRefs}
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
  onNavigate: (id: string) => void
  noteRefs: Map<string, HTMLElement>
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
      ref={(el) => props.noteRefs.set(props.note.id, el)}
      onClick={() => props.onNavigate(props.note.id)}
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
