import { useEffect, useMemo, useState } from "react"
import { observeMotion, type ObservedMotionTarget } from "../core/observed-motion"

// Observe only the selected element, in short bursts. Never patch the page's JS.
export function useObservedMotion(element: Element | null | undefined, view: Window | null) {
  const [observed, setObserved] = useState<{ element: Element | null | undefined; targets: ObservedMotionTarget[] }>({ element: null, targets: [] })
  // Torph owns and replaces its glyphs between animation cycles. Its native
  // handles are only pieces of that JS lifecycle, not a controllable timeline.
  const managed = useMemo<ObservedMotionTarget[]>(() => element && (element.closest("[torph-root]") || element.querySelector("[torph-root]"))
    ? [{ element, properties: ["content"] }] : [], [element])
  useEffect(() => {
    if (!element || !view) return
    return observeMotion(element, view, (targets) => setObserved({ element, targets }))
  }, [element, view])
  const targets = observed.element === element && observed.targets.length ? observed.targets : managed
  const properties = useMemo(() => [...new Set(targets.flatMap((target) => target.properties))], [targets])
  return { properties, targets }
}
