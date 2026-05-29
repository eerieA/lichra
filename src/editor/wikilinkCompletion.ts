import { autocompletion, acceptCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { Note } from '../lib/storage'

export function __wikilinkCompletionSource(getNotes: () => Note[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^\]]*/)
    if (!match) return null

    const query = match.text.slice(2).toLowerCase()
    const options = getNotes()
      .filter((n) => n.title.toLowerCase().includes(query))
      .map((n) => ({
        label: n.title,
        apply: (view: import('@codemirror/view').EditorView, _completion: unknown, from: number, to: number) => {
          view.dispatch({ changes: { from, to, insert: `[[${n.id}]]` } })
        },
      }))

    return { from: match.from, options, validFor: /^\[\[[^\]]*/, filter: false }
  }
}

export function wikilinkAutocomplete(getNotes: () => Note[]): Extension {
  return [
    autocompletion({ override: [__wikilinkCompletionSource(getNotes)], activateOnTyping: true }),
    keymap.of([{ key: 'Tab', run: acceptCompletion }]),
  ]
}
