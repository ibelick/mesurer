import { useEffect, useMemo, useState } from "react"
import { observeMotion, type ObservedMotionTarget } from "../core/observed-motion"

// Observe only the selected element, in short bursts. Never patch the page's JS.
export function useObservedMotion(element: Element | null | undefined, view: Window | null) {
  const [targets, setTargets] = useState<ObservedMotionTarget[]>([])
  useEffect(() => {
    setTargets([])
    if (!element || !view) return
    return observeMotion(element, view, setTargets)
  }, [element, view])
  const properties = useMemo(() => [...new Set(targets.flatMap((target) => target.properties))], [targets])
  return { properties, targets }
}
