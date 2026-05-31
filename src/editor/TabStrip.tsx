import { Component, For } from 'solid-js'
import type { Note } from '../lib/storage'

interface Props {
  tabs: Note[]
  currentId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

const TabStrip: Component<Props> = (props) => {
  return (
    <div class="tab-strip">
      <For each={props.tabs}>
        {(note) => (
          <div
            class={`tab${note.id === props.currentId ? ' active' : ''}`}
            onClick={() => props.onSelect(note.id)}
          >
            <span class="tab-title">{note.title}</span>
            <button
              class="tab-close"
              onClick={(e) => { e.stopPropagation(); props.onClose(note.id) }}
              title="Close tab"
            >×</button>
          </div>
        )}
      </For>
    </div>
  )
}

export default TabStrip
