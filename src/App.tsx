import { createResource, createSignal, createEffect, Show } from 'solid-js'
import Editor from './editor/Editor'
import Preview from './preview/Preview'
import Sidebar from './sidebar/Sidebar'
import { renderer } from './lib/markdown'
import { createNotesStore } from './lib/notes'
import { createIndexedDBAdapter } from './lib/storage'
import type { Note } from './lib/storage'

const DEBOUNCE_MS = 75
const LARGE_NOTE_THRESHOLD = 50_000

const isTauri = () => '__TAURI_INTERNALS__' in window

async function initStore() {
  let adapter
  if (isTauri()) {
    const { createTauriAdapter } = await import('./lib/storage-tauri')
    adapter = await createTauriAdapter()
  } else {
    adapter = await createIndexedDBAdapter()
  }
  const store = createNotesStore(adapter)
  await store.load()
  return store
}

export default function App() {
  const [store] = createResource(initStore)

  return (
    <Show when={store()} fallback={<div class="loading">Loading…</div>}>
      {(getStore) => <Workspace store={getStore()} />}
    </Show>
  )
}

function Workspace(props: { store: ReturnType<typeof createNotesStore> }) {
  const { store } = props
  const [html, setHtml] = createSignal('')
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function scheduleRender(content: string) {
    clearTimeout(debounceTimer)
    const delay = content.length > LARGE_NOTE_THRESHOLD ? 300 : DEBOUNCE_MS
    debounceTimer = setTimeout(() => {
      setHtml(renderer.render(content, store.notes as Note[]))
    }, delay)
  }

  createEffect(() => {
    const note = store.currentNote()
    scheduleRender(note?.content ?? '')
  })

  function handleInput(value: string) {
    const note = store.currentNote()
    if (!note) return
    store.updateContent(note.id, value)
    scheduleRender(value)
  }

  function handlePreviewClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.wikilink')
    if (!target) return
    const found = store.resolveWikilink(target.dataset.note ?? '')
    if (found) store.navigateToNote(found.id)
  }

  function breadcrumb(): string {
    const note = store.currentNote()
    if (!note) return ''
    const parts: string[] = []
    let id = note.folderId
    while (id !== null) {
      const f = store.getFolderById(id)
      if (!f) break
      parts.unshift(f.name)
      id = f.parentId
    }
    const path = parts.length > 0 ? '/' + parts.join('/') + '/' : '/'
    return path
  }

  return (
    <div class="workspace">
      <Sidebar store={store} />
      <div class="editor-pane">
        <div class="editor-breadcrumb">
          {breadcrumb()}<span class="breadcrumb-title">{store.currentNote()?.title ?? ''}</span>
        </div>
        <Editor value={store.currentNote()?.content ?? ''} onInput={handleInput} notes={store.notes as Note[]} />
      </div>
      <Preview html={html()} onClick={handlePreviewClick} />
    </div>
  )
}
