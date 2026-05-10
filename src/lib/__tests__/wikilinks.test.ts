import { describe, it, expect } from 'vitest'
import { processWikilinks, normaliseWikilinks } from '../wikilinks'
import type { Note } from '../storage'

function note(id: string, title: string, content = ''): Note {
  return { id, title, content, folderId: null, updatedAt: 0 }
}

// ── processWikilinks ───────────────────────────────────────────────────────

describe('processWikilinks', () => {
  it('renders a resolved wikilink with the note title as display text', () => {
    const notes = [note('abc-123', 'My Note')]
    const html = '<p>[[abc-123]]</p>'
    const result = processWikilinks(html, notes)
    expect(result).toContain('class="wikilink"')
    expect(result).toContain('data-note="abc-123"')
    expect(result).toContain('>My Note<')
  })

  it('renders an unresolved wikilink as missing', () => {
    const html = '<p>[[unknown-id]]</p>'
    const result = processWikilinks(html, [])
    expect(result).toContain('wikilink--missing')
    expect(result).toContain('data-note="unknown-id"')
  })

  it('handles two notes with the same title without ambiguity', () => {
    const n1 = note('id-1', 'Duplicate')
    const n2 = note('id-2', 'Duplicate')
    const html = '<p>[[id-1]] [[id-2]]</p>'
    const result = processWikilinks(html, [n1, n2])
    expect(result).toContain('data-note="id-1"')
    expect(result).toContain('data-note="id-2"')
  })

  it('leaves non-wikilink content untouched', () => {
    const html = '<p>Hello world</p>'
    expect(processWikilinks(html, [])).toBe(html)
  })
})

// ── normaliseWikilinks ─────────────────────────────────────────────────────

describe('normaliseWikilinks', () => {
  const UUID = '3f2a1b00-0000-0000-0000-000000000000'

  it('rewrites [[Title]] to [[id]] when title is found', () => {
    const n = note(UUID, 'My Note')
    const titleIndex = new Map([[n.title.toLowerCase(), n]])
    const result = normaliseWikilinks('[[My Note]]', titleIndex)
    expect(result).toBe(`[[${UUID}]]`)
  })

  it('is case-insensitive when matching titles', () => {
    const n = note(UUID, 'My Note')
    const titleIndex = new Map([[n.title.toLowerCase(), n]])
    const result = normaliseWikilinks('[[my note]]', titleIndex)
    expect(result).toBe(`[[${UUID}]]`)
  })

  it('leaves [[uuid]] unchanged (already migrated)', () => {
    const titleIndex = new Map<string, Note>()
    const result = normaliseWikilinks(`[[${UUID}]]`, titleIndex)
    expect(result).toBe(`[[${UUID}]]`)
  })

  it('leaves unresolved title links unchanged', () => {
    const titleIndex = new Map<string, Note>()
    const result = normaliseWikilinks('[[Unknown Note]]', titleIndex)
    expect(result).toBe('[[Unknown Note]]')
  })

  it('migrates only matching links and preserves unresolved ones', () => {
    const n = note(UUID, 'Known')
    const titleIndex = new Map([[n.title.toLowerCase(), n]])
    const result = normaliseWikilinks('[[Known]] and [[Unknown]]', titleIndex)
    expect(result).toBe(`[[${UUID}]] and [[Unknown]]`)
  })

  it('is idempotent — migrating twice produces the same result', () => {
    const n = note(UUID, 'My Note')
    const titleIndex = new Map([[n.title.toLowerCase(), n]])
    const once = normaliseWikilinks('[[My Note]]', titleIndex)
    const twice = normaliseWikilinks(once, titleIndex)
    expect(twice).toBe(once)
  })
})
