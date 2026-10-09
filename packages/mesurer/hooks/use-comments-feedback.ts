import { useState } from "react"
import { usePageListener } from "./use-page-listener"
import { useTimeout } from "./use-timeout"

// Share brief success feedback between toolbar buttons and keyboard commands.
export const useCommentsFeedback = (ownerWindow: Window, action: "copied" | "resolved") => {
  const [active, setActive] = useState(false)
  const { start } = useTimeout(ownerWindow)
  usePageListener({
    view: ownerWindow,
    types: `mesurer:comments-${action}`,
    phase: "bubble",
    onEvent: () => {
      setActive(true)
      start(() => setActive(false), 1800)
    },
  })
  return active
}
