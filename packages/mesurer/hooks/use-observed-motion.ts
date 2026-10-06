import { useEffect, useState } from "react"
import { motionCssProperty } from "../core/motion"

const PROPERTIES = ["transform", "translate", "rotate", "scale", "opacity", "filter", "clip-path", "width", "height", "top", "left"]

// Observe only the selected element, in short bursts. Never patch the page's JS.
export function useObservedMotion(element: Element | null | undefined, view: Window | null) {
  const [properties, setProperties] = useState<string[]>([])
  useEffect(() => {
    setProperties([])
    if (!element || !view) return
    let request = 0, lastSample = -Infinity, until = 0
    let previous: string[] | null = null
    let previousCovered = new Set<string>()
    const detected = new Set<string>()
    const sample = (time: number) => {
      request = 0
      if (!element.isConnected) return
      if (time - lastSample >= 100) {
        lastSample = time
        const style = view.getComputedStyle(element)
        const values = PROPERTIES.map((property) => style.getPropertyValue(property))
        const covered = new Set(element.getAnimations().flatMap((animation) => {
          const effect = animation.effect as KeyframeEffect | null
          return effect?.getKeyframes?.().flatMap((frame) => Object.keys(frame).map(motionCssProperty)) ?? []
        }))
        let changed = false
        if (previous) PROPERTIES.forEach((property, index) => {
          if (values[index] !== previous![index] && !covered.has(property) && !previousCovered.has(property) && !detected.has(property)) {
            detected.add(property)
            changed = true
          }
        })
        previous = values
        previousCovered = covered
        if (changed) setProperties([...detected])
      }
      if (time < until) request = view.requestAnimationFrame(sample)
    }
    const observe = () => {
      until = view.performance.now() + 1500
      if (!request) request = view.requestAnimationFrame(sample)
    }
    const observer = new MutationObserver(observe)
    observer.observe(element, { attributes: true, attributeFilter: ["style", "class"] })
    observe()
    return () => {
      observer.disconnect()
      view.cancelAnimationFrame(request)
    }
  }, [element, view])
  return properties
}
