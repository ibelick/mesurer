import { useCallback, useState } from "react"
import { copyCommentSelector } from "../comments"
import { getElementSelector } from "../core/selector"
import { useTimeout } from "./use-timeout"

const COPIED_MS = 1200

// Copies an element's selector to the clipboard and remembers it for a moment, so the card
// that shows it can say it was copied.
export const useSelectorCopy = (ownerWindow: Window) => {
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null)
  const { start } = useTimeout(ownerWindow)
  const copySelector = useCallback((element: Element) => {
    const selector = getElementSelector(element)
    void copyCommentSelector(selector, ownerWindow)
      .then(() => {
        setCopiedSelector(selector)
        start(() => setCopiedSelector(null), COPIED_MS)
      })
      .catch(() => {})
  }, [ownerWindow, start])
  // Whether this element's selector is the one that was just copied.
  const isCopied = (element: Element | null) =>
    element !== null && copiedSelector !== null && copiedSelector === getElementSelector(element)
  return { copySelector, isCopied }
}
