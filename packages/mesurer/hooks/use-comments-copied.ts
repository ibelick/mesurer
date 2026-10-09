import { useState } from "react"
import { usePageListener } from "./use-page-listener"
import { useTimeout } from "./use-timeout"

const COPIED_MS = 1800

// Whether the comments were copied a moment ago, wherever the copy was asked from. `flash`
// says so for a copy made right here.
export const useCommentsCopied = (ownerWindow: Window) => {
  const [copied, setCopied] = useState(false)
  const { start } = useTimeout(ownerWindow)
  const flash = () => {
    setCopied(true)
    start(() => setCopied(false), COPIED_MS)
  }
  usePageListener({
    view: ownerWindow,
    types: "mesurer:comments-copied",
    phase: "bubble",
    onEvent: flash,
  })
  return { copied, flash }
}
