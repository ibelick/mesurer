import { getMotionAnimations, motionCssProperty } from "./motion"

export type ObservedMotionTarget = { element: Element; properties: string[] }
export const OBSERVED_MOTION_PROPERTIES = ["transform", "translate", "rotate", "scale", "opacity", "filter", "clip-path", "width", "height", "top", "left"]

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
  let request = 0, lastSample = -Infinity, until = 0, disposed = false, urgent = true
  const previous = new WeakMap<Element, { values: string[]; inputs: string[]; covered: Set<string> }>()
  const detected = new Map<Element, Set<string>>()
  const observers: MutationObserver[] = []
  const observedRoots = new WeakSet<Node>()
  const watch = (node: Node) => {
    const Constructor = (view as Window & typeof globalThis).MutationObserver
    if (!Constructor || observedRoots.has(node)) return
    try {
      const observer = new Constructor((records = []) => {
        // Text morphers replace glyphs while browser animations are still active.
        // Keep one content flag for the selection, not a target per transient glyph.
        if (records.some((record) => record.type === "childList" || record.type === "characterData")) {
          const properties = detected.get(root) ?? new Set<string>()
          if (!properties.has("content")) {
            properties.add("content")
            detected.set(root, properties)
            publish()
          }
        }
        // Confirm the first JS style update in this burst before the next 10Hz tick.
        if (urgent && records.some((record) => record.type === "attributes" && record.attributeName === "style")) {
          urgent = false
          view.cancelAnimationFrame?.(request)
          lastSample = -Infinity
          sample(view.performance.now())
        }
        wake()
      })
      observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "transform", "opacity"] })
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
          const values = OBSERVED_MOTION_PROPERTIES.map((property) => style.getPropertyValue(property))
          const inline = (element as HTMLElement).style
          const inputs = OBSERVED_MOTION_PROPERTIES.map((property) => {
            const declaration = inline?.getPropertyValue(property) ?? ""
            const variables = [...declaration.matchAll(/var\(\s*(--[\w-]+)/g)]
              .map(([, variable]) => style.getPropertyValue(variable))
            return JSON.stringify([declaration, ...variables])
          })
          const native = covered.get(element) ?? new Set<string>()
          const before = previous.get(element)
          const properties = detected.get(element) ?? new Set<string>()
          if (before) OBSERVED_MOTION_PROPERTIES.forEach((property, index) => {
            const inputChanged = inputs[index] !== before.inputs[index]
            const uncoveredChange = values[index] !== before.values[index] && !native.has(property) && !before.covered.has(property)
            if ((inputChanged || uncoveredChange) && !properties.has(property)) {
              properties.add(property)
              detected.set(element, properties)
              changed = true
            }
          })
          previous.set(element, { values, inputs, covered: native })
        } catch { /* A disappearing/foreign element must not break inspection. */ }
      }
      if (changed) publish()
    }
    if (time < until) request = view.requestAnimationFrame(sample)
  }
  function publish() {
    if (!disposed) onChange([...detected].map(([element, properties]) => ({ element, properties: [...properties] })))
  }
  function wake() {
    if (disposed || typeof view.requestAnimationFrame !== "function") return
    if (view.performance.now() > until) urgent = true
    until = view.performance.now() + 1500
    if (!request) request = view.requestAnimationFrame(sample)
  }
  watch(root)
  sample(view.performance.now())
  wake()
  return () => {
    disposed = true
    observers.forEach((observer) => observer.disconnect())
    view.cancelAnimationFrame?.(request)
  }
}
