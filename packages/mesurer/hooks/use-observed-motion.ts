import { useEffect, useMemo, useState } from "react"
import { motionLevel } from "../core/motion"
import { observeMotion, readObservedMotion, type ObservedMotionTarget } from "../core/observed-motion"

// Observe only the selected element, in short bursts. Never patch the page's JS.
export function useObservedMotion(element: Element | null | undefined, view: Window | null) {
  const [observed, setObserved] = useState<{ element: Element | null | undefined; targets: ObservedMotionTarget[] }>({ element: null, targets: [] })
  const managed = useMemo(() => element ? readObservedMotion(element) : [], [element])
  useEffect(() => {
    setObserved({ element, targets: element && view ? readObservedMotion(element) : [] })
    if (!element || !view) return
    return observeMotion(element, view, (targets) => setObserved({ element, targets }))
  }, [element, view])
  const targets = observed.element === element ? observed.targets : managed
  // Only motion within MOTION_LEVELS of the element makes its card; deeper changes belong to their own element.
  const properties = useMemo(
    () => [...new Set(targets.filter((target) => element && motionLevel(element, target.element) !== null).flatMap((target) => target.properties))],
    [targets, element],
  )
  return { properties, targets }
}
