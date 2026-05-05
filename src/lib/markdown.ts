import MarkdownIt from 'markdown-it'
import { processWikilinks } from './wikilinks'
import type { Note } from './storage'

export interface MarkdownRenderer {
  render(md: string, notes: Note[]): string
}

function createRenderer(): MarkdownRenderer {
  const md = new MarkdownIt({ linkify: true, typographer: true })

  return {
    render(source: string, notes: Note[]): string {
      return processWikilinks(md.render(source), notes)
    },
  }
}

export const renderer = createRenderer()
