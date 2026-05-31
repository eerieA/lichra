import { Component, createSignal, For, Show, createMemo } from 'solid-js'
import type { Note, Folder, NotesStore } from '../lib/notes'

interface Props {
  store: NotesStore
  selectedFolderId: () => string | null
  onSelectFolder: (id: string | null) => void
  openFolderIds: () => Set<string>
  onToggleFolder: (id: string | null) => void
  onNavigateNote: (id: string) => void
  onOpenTab: (id: string) => void
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
        onOpenTab={props.onOpenTab}
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
  onOpenTab: (id: string) => void
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
          <ConfirmButton class="folder-delete" confirmTitle={`Delete folder "${props.label}"`} onConfirm={() => props.store.deleteFolder(props.folderId!)} />
        </Show>
      </div>

      <Show when={isOpen()}>
        <For each={notes()}>
          {(note) => (
            <NoteItem
              note={note}
              store={props.store}
              onNavigate={props.onNavigateNote}
              onOpenTab={props.onOpenTab}
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
              onOpenTab={props.onOpenTab}
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
  onOpenTab: (id: string) => void
  noteRefs: Map<string, HTMLElement>
}

const NoteItem: Component<NoteItemProps> = (props) => {
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal('')

  const isActive = () => props.store.currentId() === props.note.id

  const isDuplicateTitle = createMemo(() => {
    const d = draft().trim().toLowerCase()
    if (!d || d === props.note.title.toLowerCase()) return false
    return props.store.notes.some(
      (n) => n.id !== props.note.id && n.title.toLowerCase() === d
    )
  })

  function startRename() {
    setDraft(props.note.title)
    setEditing(true)
  }

  function commitRename() {
    const t = draft().trim()
    if (t && t !== props.note.title) props.store.renameNote(props.note.id, t)
    setEditing(false)
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
            <ConfirmButton class="note-delete" confirmTitle={`Delete "${props.note.title}"`} onConfirm={() => props.store.deleteNote(props.note.id)} />
          </>
        }
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', flex: '1', 'min-width': '0' }}>
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
          <Show when={isDuplicateTitle()}>
            <span class="note-rename-warning">A note with this title already exists</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}

interface ConfirmButtonProps {
  class: string
  confirmTitle: string
  onConfirm: () => void
}

const ConfirmButton: Component<ConfirmButtonProps> = (props) => {
  const [confirming, setConfirming] = createSignal(false)

  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (confirming()) {
      props.onConfirm()
    } else {
      setConfirming(true)
    }
  }

  return (
    <button
      class={`${props.class}${confirming() ? ' confirming' : ''}`}
      title={confirming() ? 'Click again to confirm' : props.confirmTitle}
      onClick={handleClick}
      onMouseLeave={() => setConfirming(false)}
    >
      {confirming() ? '?' : '×'}
    </button>
  )
}

export default FolderTree
