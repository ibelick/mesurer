import { useEffect, useState } from "react"
import { motionDuration, readMotionDetails } from "../core/motion"
import { useObservedMotion } from "./use-observed-motion"

export const usePlayableMotion = (
  element: Element | null | undefined,
  ownerWindow: Window | null | undefined,
) => {
  const [ready, setReady] = useState(false)
  const observedProperties = useObservedMotion(element, ownerWindow ?? null)

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
    const interval = ownerWindow.setInterval(refresh, 250)
    return () => ownerWindow.clearInterval(interval)
  }, [element, ownerWindow])

  return { ready: ready || observedProperties.length > 0, observedProperties }
}
