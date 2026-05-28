import { Component, createEffect, onCleanup, onMount } from 'solid-js'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'

interface Props {
  value: string
  onInput: (value: string) => void
}

const Editor: Component<Props> = (props) => {
  let container!: HTMLDivElement
  let view: EditorView

  onMount(() => {
    view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: props.value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ codeLanguages: languages }),
          oneDark,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              props.onInput(update.state.doc.toString())
            }
          }),
        ],
      }),
    })
  })

  createEffect(() => {
    const incoming = props.value
    if (!view) return
    if (incoming !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: incoming },
      })
    }
  })

  onCleanup(() => view?.destroy())

  return <div class="editor" ref={container} />
}

export default Editor
