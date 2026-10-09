import { useEffect, useState } from "react"
import { motionDuration, readMotionDetails, scopedMotionAnimations } from "../core/motion"
import { useObservedMotion } from "./use-observed-motion"

export const usePlayableMotion = (
  element: Element | null | undefined,
  ownerWindow: Window | null | undefined,
) => {
  const view = element?.ownerDocument?.defaultView ?? ownerWindow ?? null
  const [native, setNative] = useState<{ element: Element | null | undefined; view: Window | null; ready: boolean }>({ element: null, view: null, ready: false })
  const { properties: observedProperties, targets: observedTargets } = useObservedMotion(element, view)

  useEffect(() => {
    if (!element || !view) {
      setNative({ element, view, ready: false })
      return
    }
    const refresh = () => {
      let ready = false
      if (element.isConnected) {
        try {
          const motions = readMotionDetails(element, view)
          const effects = scopedMotionAnimations(element)
          ready = motions.some((motion) => motionDuration(motion) > 0) || effects.some((animation) => {
            try {
              const timing = animation.effect?.getTiming()
              return Boolean(timing && (timing.duration === "auto" || Number(timing.duration) > 0))
            } catch { return false }
          })
        } catch { /* Navigating frames can temporarily lose their style context. */ }
      }
      setNative((previous) => previous.element === element && previous.view === view && previous.ready === ready ? previous : { element, view, ready })
    }
    refresh()
    const interval = view.setInterval(refresh, 250)
    return () => view.clearInterval(interval)
  }, [element, view])

  return { ready: (native.element === element && native.view === view && native.ready) || observedProperties.length > 0, observedProperties, observedTargets }
}
