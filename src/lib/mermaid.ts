import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'dark' })

let counter = 0

export async function renderMermaidBlocks(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll<HTMLElement>('code.language-mermaid')
  if (blocks.length === 0) return

  await Promise.all(
    Array.from(blocks).map(async (block) => {
      const source = block.textContent ?? ''
      const id = `mermaid-${++counter}`
      try {
        const { svg } = await mermaid.render(id, source)
        const wrapper = document.createElement('div')
        wrapper.className = 'mermaid-diagram'
        wrapper.innerHTML = svg
        block.parentElement?.replaceWith(wrapper)
      } catch {
        block.parentElement?.classList.add('mermaid-error')
      }
    })
  )
}
