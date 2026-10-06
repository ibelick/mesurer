import { getMotionAnimations, motionCssProperty } from "./motion"

export type ObservedMotionTarget = { element: Element; properties: string[] }
const PROPERTIES = ["transform", "translate", "rotate", "scale", "opacity", "filter", "clip-path", "width", "height", "top", "left"]

export function motionElements(root: Element, limit = 128) {
  const elements = [root]
  for (let index = 0; index < elements.length && elements.length < limit; index++) {
    const element = elements[index]
    elements.push(...[...element.children, ...(element.shadowRoot?.children ?? [])].slice(0, limit - elements.length))
  }
  return elements
}

// Bounded 10Hz bursts, triggered by relevant mutations in the selected subtree.
export function observeMotion(root: Element, view: Window, onChange: (targets: ObservedMotionTarget[]) => void) {
  let request = 0, lastSample = -Infinity, until = 0, disposed = false
  const previous = new WeakMap<Element, { values: string[]; covered: Set<string> }>()
  const detected = new Map<Element, Set<string>>()
  const observers: MutationObserver[] = []
  const observedRoots = new WeakSet<Node>()
  const watch = (node: Node) => {
    const Constructor = (view as Window & typeof globalThis).MutationObserver
    if (!Constructor || observedRoots.has(node)) return
    try {
      const observer = new Constructor(wake)
      observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "transform", "opacity"] })
      observedRoots.add(node)
      observers.push(observer)
    } catch { /* Detached or unsupported document: sampling still works. */ }
  }
  const sample = (time: number) => {
    request = 0
    if (disposed) return
    if (!root.isConnected) {
      if (detected.size) { detected.clear(); onChange([]) }
      return
    }
    if (time - lastSample >= 100) {
      lastSample = time
      const covered = new Map<Element, Set<string>>()
      for (const animation of getMotionAnimations(root)) {
        try {
          const effect = animation.effect as KeyframeEffect | null
          if (!effect?.target) continue
          const properties = covered.get(effect.target) ?? new Set<string>()
          for (const frame of effect.getKeyframes()) for (const property of Object.keys(frame)) properties.add(motionCssProperty(property))
          covered.set(effect.target, properties)
        } catch { /* Some effects cannot expose keyframes. */ }
      }
      let changed = false
      const elements = motionElements(root)
      for (const element of detected.keys()) if (!elements.includes(element)) { detected.delete(element); changed = true }
      for (const element of elements) {
        if (element.shadowRoot) watch(element.shadowRoot)
        try {
          const style = view.getComputedStyle(element)
          const values = PROPERTIES.map((property) => style.getPropertyValue(property))
          const native = covered.get(element) ?? new Set<string>()
          const before = previous.get(element)
          const properties = detected.get(element) ?? new Set<string>()
          if (before) PROPERTIES.forEach((property, index) => {
            if (values[index] !== before.values[index] && !native.has(property) && !before.covered.has(property) && !properties.has(property)) {
              properties.add(property)
              detected.set(element, properties)
              changed = true
            }
          })
          previous.set(element, { values, covered: native })
        } catch { /* A disappearing/foreign element must not break inspection. */ }
      }
      if (changed) onChange([...detected].map(([element, properties]) => ({ element, properties: [...properties] })))
    }
    if (time < until) request = view.requestAnimationFrame(sample)
  }
  function wake() {
    if (disposed || typeof view.requestAnimationFrame !== "function") return
    until = view.performance.now() + 1500
    if (!request) request = view.requestAnimationFrame(sample)
  }
  watch(root)
  wake()
  return () => {
    disposed = true
    observers.forEach((observer) => observer.disconnect())
    view.cancelAnimationFrame?.(request)
  }
}
