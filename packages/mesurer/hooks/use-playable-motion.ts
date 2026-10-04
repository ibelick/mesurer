import { useEffect, useState } from "react"
import { motionDuration, readMotionDetails } from "../core/motion"

export const usePlayableMotion = (
  element: Element | null | undefined,
  ownerWindow: Window | null | undefined,
) => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!element || !ownerWindow) {
      setReady(false)
      return
    }
    const refresh = () => {
      const motions = readMotionDetails(element, ownerWindow)
      const duration = Math.max(0, ...motions.map(motionDuration))
      setReady(motions.length > 0 && duration > 0)
    }
    refresh()
    const frame = ownerWindow.requestAnimationFrame(refresh)
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [element, ownerWindow])

  return ready
}
