import type { Note } from './storage'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

export function processWikilinks(html: string, notes: Note[]): string {
  const titleSet = new Set(notes.map((n) => n.title.toLowerCase()))
  return html.replace(WIKILINK_RE, (_, title: string) => {
    const cls = titleSet.has(title.toLowerCase()) ? 'wikilink' : 'wikilink wikilink--missing'
    return `<a class="${cls}" data-note="${title}">${title}</a>`
  })
}
