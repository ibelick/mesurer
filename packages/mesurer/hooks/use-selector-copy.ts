import { useCallback, useEffect, useRef, useState } from "react"
import { copyCommentSelector } from "../comments"
import { getElementSelector } from "../core/selector"

const COPIED_MS = 1200

// Copies an element's selector to the clipboard and remembers it for a moment, so the card
// that shows it can say it was copied.
export const useSelectorCopy = (ownerWindow: Window) => {
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (timeoutRef.current !== null) ownerWindow.clearTimeout(timeoutRef.current)
  }, [ownerWindow])
  const copySelector = useCallback((element: Element) => {
    const selector = getElementSelector(element)
    void copyCommentSelector(selector, ownerWindow)
      .then(() => {
        setCopiedSelector(selector)
        if (timeoutRef.current !== null) ownerWindow.clearTimeout(timeoutRef.current)
        timeoutRef.current = ownerWindow.setTimeout(() => {
          timeoutRef.current = null
          setCopiedSelector(null)
        }, COPIED_MS)
      })
      .catch(() => {})
  }, [ownerWindow])
  // Whether this element's selector is the one that was just copied.
  const isCopied = (element: Element | null) =>
    element !== null && copiedSelector !== null && copiedSelector === getElementSelector(element)
  return { copySelector, isCopied }
}
