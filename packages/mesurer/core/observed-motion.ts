import { getMotionAnimations, hasTransientScriptMotion, motionCssProperty, OBSERVED_MOTION_PROPERTIES, scopedMotionAnimations } from "./motion"
import { createMotionDependencies, cssVariables } from "./motion-dependencies"
export { OBSERVED_MOTION_PROPERTIES } from "./motion"

export type ObservedMotionTarget = { element: Element; properties: string[] }
const knownMotion = new WeakMap<Element, ObservedMotionTarget[]>()
export const readObservedMotion = (element: Element): ObservedMotionTarget[] => {
  const cached = knownMotion.get(element)?.filter((target) => target.element.isConnected)
  return cached?.length ? cached : hasTransientScriptMotion(element) ? [{ element, properties: ["animation"] }] : []
}

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
  const previous = new WeakMap<Element, { values: string[]; inputs: string[]; declarations: string[]; nativeInputs: Set<string>; covered: Set<string> }>()
  const dependencies = createMotionDependencies(root.ownerDocument)
  const oldStyle = root.ownerDocument?.createElement?.("span")?.style
  const initial = readObservedMotion(root)
  if (initial.length) knownMotion.set(root, initial)
  const detected = new Map(initial.map((target) => [target.element, new Set(target.properties)]))
  const observers: MutationObserver[] = []
  const observedRoots = new WeakSet<Node>()
  const watch = (node: Node, subtree = true) => {
    const Constructor = (view as Window & typeof globalThis).MutationObserver
    if (!Constructor || observedRoots.has(node)) return
    try {
      const observer = new Constructor((records = []) => {
        if (records.some((record) => record.type === "attributes" && record.attributeName === "class")) dependencies.invalidate()
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
        // An opaque stylesheet prevents proving which property consumes a JS
        // variable write. Preserve read-only ownership rather than promise control.
        if (dependencies.hasOpaqueStyles(root) && records.some((record) => {
          if (record.type !== "attributes" || record.attributeName !== "style") return false
          const current = (record.target as HTMLElement).style
          if (!oldStyle) return /(^|;)\s*--/.test(`${record.oldValue ?? ""};${current?.cssText ?? ""}`)
          oldStyle.cssText = record.oldValue ?? ""
          return [...new Set([...current, ...oldStyle])].some((property) => property.startsWith("--") && current.getPropertyValue(property) !== oldStyle.getPropertyValue(property))
        })) {
          const properties = detected.get(root) ?? new Set<string>()
          if (!properties.has("style")) { properties.add("style"); detected.set(root, properties); publish() }
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
      observer.observe(node, { subtree, childList: subtree, characterData: subtree, attributes: true, attributeOldValue: true, attributeFilter: ["style", "class", "transform", "opacity"] })
      observedRoots.add(node)
      observers.push(observer)
    } catch { /* Detached or unsupported document: sampling still works. */ }
  }
  const sample = (time: number) => {
    request = 0
    if (disposed) return
    if (!root.isConnected) {
      knownMotion.delete(root)
      if (detected.size) { detected.clear(); onChange([]) }
      return
    }
    if (time - lastSample >= 100) {
      lastSample = time
      dependencies.refresh(time)
      const covered = new Map<Element, Set<string>>()
      const names = new Map<Element, string[]>()
      const animations = getMotionAnimations(root)
      for (const animation of animations) {
        try {
          const effect = animation.effect as KeyframeEffect | null
          if (!effect?.target) continue
          const name = (animation as CSSAnimation).animationName
          if (name) names.set(effect.target, [...(names.get(effect.target) ?? []), name])
          const properties = covered.get(effect.target) ?? new Set<string>()
          for (const frame of effect.getKeyframes()) for (const property of Object.keys(frame)) properties.add(motionCssProperty(property))
          covered.set(effect.target, properties)
        } catch { /* Some effects cannot expose keyframes. */ }
      }
      let changed = false
      if (hasTransientScriptMotion(root, scopedMotionAnimations(root, animations)) && !detected.has(root)) {
        detected.set(root, new Set(["animation"]))
        changed = true
      }
      const elements = motionElements(root)
      for (const element of detected.keys()) if (!elements.includes(element)) { detected.delete(element); changed = true }
      for (const element of elements) {
        if (element.shadowRoot) watch(element.shadowRoot)
        try {
          const style = view.getComputedStyle(element)
          const values = OBSERVED_MOTION_PROPERTIES.map((property) => style.getPropertyValue(property))
          const inline = (element as HTMLElement).style
          const authorVariables = dependencies.forElement(element, [style.animationName ?? "", ...(names.get(element) ?? [])].join(","))
          const native = new Set(covered.get(element) ?? [])
          const nativeInputs = new Set<string>()
          const declarations = OBSERVED_MOTION_PROPERTIES.map((property) => inline?.getPropertyValue(property) ?? "")
          const inputs = OBSERVED_MOTION_PROPERTIES.map((property) => {
            const declaration = inline?.getPropertyValue(property) ?? ""
            const variables = [...cssVariables(declaration), ...(authorVariables.get(property) ?? [])]
            if (variables.length && variables.every((variable) => {
              let owner: Element | null = element
              while (owner) {
                if (covered.get(owner)?.has(variable)) return true
                owner = owner.parentElement ?? (owner.getRootNode?.() as ShadowRoot | undefined)?.host ?? null
              }
              return false
            })) { native.add(property); nativeInputs.add(property) }
            return JSON.stringify([declaration, ...variables.map((variable) => style.getPropertyValue(variable))])
          })
          const before = previous.get(element)
          const properties = detected.get(element) ?? new Set<string>()
          if (before) OBSERVED_MOTION_PROPERTIES.forEach((property, index) => {
            const inputChanged = declarations[index] !== before.declarations[index] || (inputs[index] !== before.inputs[index] && !nativeInputs.has(property) && !before.nativeInputs.has(property))
            const uncoveredChange = values[index] !== before.values[index] && !native.has(property) && !before.covered.has(property)
            if ((inputChanged || uncoveredChange) && !properties.has(property)) {
              properties.add(property)
              detected.set(element, properties)
              changed = true
            }
          })
          previous.set(element, { values, inputs, declarations, nativeInputs, covered: native })
        } catch { /* A disappearing/foreign element must not break inspection. */ }
      }
      if (changed) publish()
    }
    if (time < until) request = view.requestAnimationFrame(sample)
  }
  function publish() {
    if (!disposed) {
      const targets = [...detected].map(([element, properties]) => ({ element, properties: [...properties] }))
      knownMotion.set(root, targets)
      onChange(targets)
    }
  }
  function wake() {
    if (disposed || typeof view.requestAnimationFrame !== "function") return
    if (view.performance.now() > until) urgent = true
    until = view.performance.now() + 1500
    if (!request) request = view.requestAnimationFrame(sample)
  }
  watch(root)
  let ancestor = root.parentElement ?? (root.getRootNode?.() as ShadowRoot | undefined)?.host ?? null
  while (ancestor) { watch(ancestor, false); ancestor = ancestor.parentElement ?? (ancestor.getRootNode?.() as ShadowRoot | undefined)?.host ?? null }
  const Constructor = (view as Window & typeof globalThis).MutationObserver
  if (Constructor && root.ownerDocument?.head) {
    const observer = new Constructor(() => { dependencies.invalidate(); wake() })
    observer.observe(root.ownerDocument.head, { subtree: true, childList: true, characterData: true })
    observers.push(observer)
  }
  sample(view.performance.now())
  wake()
  const stylesheetInterval = typeof view.setInterval === "function" ? view.setInterval(() => {
    if (dependencies.refresh(view.performance.now())) wake()
  }, 1000) : null
  return () => {
    disposed = true
    knownMotion.delete(root)
    observers.forEach((observer) => observer.disconnect())
    if (stylesheetInterval !== null) view.clearInterval(stylesheetInterval)
    view.cancelAnimationFrame?.(request)
  }
}
