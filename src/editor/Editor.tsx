import { Component, createEffect, onCleanup, onMount } from 'solid-js'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { wikilinkAutocomplete } from './wikilinkCompletion'
import type { Note } from '../lib/storage'

interface Props {
  note: Note | undefined
  onInput: (value: string) => void
  notes: Note[]
}

const Editor: Component<Props> = (props) => {
  let container!: HTMLDivElement
  let view: EditorView
  const stateCache = new Map<string, EditorState>()
  let currentNoteId: string | undefined

  function makeState(note: Note): EditorState {
    return EditorState.create({
      doc: note.content,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ codeLanguages: languages }),
        oneDark,
        EditorView.lineWrapping,
        wikilinkAutocomplete(() => props.notes),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            props.onInput(update.state.doc.toString())
          }
        }),
      ],
    })
  }

  onMount(() => {
    view = new EditorView({ parent: container })
    if (props.note) {
      const state = makeState(props.note)
      stateCache.set(props.note.id, state)
      view.setState(state)
      currentNoteId = props.note.id
    }
  })

  createEffect(() => {
    const note = props.note
    if (!view || !note) return
    if (note.id === currentNoteId) return

    // Snapshot the live state back into the cache before leaving
    if (currentNoteId) {
      stateCache.set(currentNoteId, view.state)
    }

    // Restore or create state for the incoming note
    if (!stateCache.has(note.id)) {
      stateCache.set(note.id, makeState(note))
    }
    view.setState(stateCache.get(note.id)!)
    currentNoteId = note.id
  })

  onCleanup(() => view?.destroy())

  return <div class="editor" ref={container} />
}

export default Editor
