import { Component } from 'solid-js'

interface Props {
  value: string
  onInput: (value: string) => void
}

const Editor: Component<Props> = (props) => {
  return (
    <textarea
      class="editor"
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      placeholder="Start writing..."
      spellcheck={false}
    />
  )
}

export default Editor
