// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { CompletionContext } from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import type { Note } from '../storage'

// Import the internal source directly for unit testing
import { wikilinkAutocomplete } from '../../editor/wikilinkCompletion'

function note(id: string, title: string): Note {
  return { id, title, content: '', folderId: null, updatedAt: 0 }
}

// Build a CompletionContext with cursor at end of doc
function makeContext(doc: string, explicit = true): CompletionContext {
  const state = EditorState.create({ doc })
  return new CompletionContext(state, doc.length, explicit)
}

// Extract the raw CompletionSource from the extension so we can call it directly
async function getSource(notes: Note[]) {
  const mod = await import('../../editor/wikilinkCompletion')
  return mod.__wikilinkCompletionSource(() => notes)
}

describe('wikilinkCompletion', () => {
  it('returns null when cursor is not inside [[', async () => {
    const source = await getSource([note('id-1', 'My Note')])
    const result = source(makeContext('hello world'))
    expect(result).toBeNull()
  })

  it('returns all notes when query is empty ([[)', async () => {
    const notes = [note('id-1', 'Alpha'), note('id-2', 'Beta')]
    const source = await getSource(notes)
    const result = source(makeContext('[['))
    expect(result?.options).toHaveLength(2)
    expect(result?.filter).toBe(false)
  })

  it('filters notes by title substring', async () => {
    const notes = [note('id-1', 'Alpha'), note('id-2', 'Beta'), note('id-3', 'Alphabet')]
    const source = await getSource(notes)
    const result = source(makeContext('[[alph'))
    expect(result?.options).toHaveLength(2)
    expect(result?.options.map((o) => o.label)).toEqual(expect.arrayContaining(['Alpha', 'Alphabet']))
  })

  it('filter is case-insensitive', async () => {
    const source = await getSource([note('id-1', 'My Note')])
    const result = source(makeContext('[[MY'))
    expect(result?.options).toHaveLength(1)
  })

  it('inserts [[uuid]] not [[title]] when applied', async () => {
    const n = note('abc-123', 'My Note')
    const source = await getSource([n])
    const result = source(makeContext('[['))
    expect(result?.options).toHaveLength(1)

    const view = new EditorView({ state: EditorState.create({ doc: '[[' }) })
    const completion = result!.options[0]
    ;(completion.apply as Function)(view, completion, 0, 2)
    expect(view.state.doc.toString()).toBe('[[abc-123]]')
    view.destroy()
  })

  it('resolves correct UUID when two notes share a title prefix', async () => {
    const n1 = note('uuid-1', 'Notes')
    const n2 = note('uuid-2', 'Notes Archive')
    const source = await getSource([n1, n2])
    const result = source(makeContext('[[Notes'))
    expect(result?.options).toHaveLength(2)

    const view = new EditorView({ state: EditorState.create({ doc: '[[Notes' }) })
    const first = result!.options.find((o) => o.label === 'Notes')!
    ;(first.apply as Function)(view, first, 0, 7)
    expect(view.state.doc.toString()).toBe('[[uuid-1]]')
    view.destroy()
  })
})
