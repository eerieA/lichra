import type { Note } from './storage'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

export function processWikilinks(html: string, notes: Note[]): string {
  const idIndex = new Map(notes.map((n) => [n.id, n]))
  return html.replace(WIKILINK_RE, (_, id: string) => {
    const note = idIndex.get(id.trim())
    if (!note) return `<a class="wikilink wikilink--missing" data-note="${id.trim()}">${id.trim()}</a>`
    return `<a class="wikilink" data-note="${note.id}">${note.title}</a>`
  })
}

// Rewrites [[Title]] links to [[id]] on every load, including externally-edited notes.
// Safe to call repeatedly — UUID tokens are left untouched.
export function normaliseWikilinks(content: string, titleIndex: Map<string, Note>): string {
  return content.replace(WIKILINK_RE, (original, token: string) => {
    const trimmed = token.trim()
    // Already an ID (present in idIndex means it's a valid note id — but we
    // don't have idIndex here, so use the heuristic: UUIDs contain hyphens
    // and are 36 chars). If it looks like a UUID, leave it alone.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return original
    }
    const note = titleIndex.get(trimmed.toLowerCase())
    return note ? `[[${note.id}]]` : original
  })
}
