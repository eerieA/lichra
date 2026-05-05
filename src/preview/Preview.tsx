import { Component, createEffect } from 'solid-js'
import { renderMermaidBlocks } from '../lib/mermaid'

interface Props {
  html: string
  onClick: (e: MouseEvent) => void
}

const Preview: Component<Props> = (props) => {
  let ref!: HTMLDivElement

  createEffect(() => {
    // html accessor tracked here; Mermaid runs after DOM update
    const _ = props.html
    queueMicrotask(() => renderMermaidBlocks(ref))
  })

  return (
    <div
      class="preview"
      ref={ref}
      onClick={props.onClick}
      innerHTML={props.html}
    />
  )
}

export default Preview
