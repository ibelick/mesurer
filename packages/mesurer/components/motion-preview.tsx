import { useLayoutEffect, useRef } from "react"
import { getMotionAnimations, motionCssProperty } from "../core/motion"
import { fitMotionPreview } from "../core/motion-preview"
import { createMotionSnapshot } from "../core/motion-snapshot"
import { OBSERVED_MOTION_PROPERTIES, type ObservedMotionTarget } from "../core/observed-motion"
import { createMotionDependencies, cssVariables } from "../core/motion-dependencies"

type PreviewBounds = { left: number; top: number; right: number; bottom: number }

// Read-only mirror. Metadata is polled at 4Hz; JS updates paint at up to 60Hz.
export function MotionPreview({ element, ownerWindow, observedTargets, wakeRef }: { element: Element; ownerWindow: Window; observedTargets: ObservedMotionTarget[]; wakeRef?: { current: (() => void) | null } }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const internalSeekRef = useRef<(() => void) | null>(null)
  const seekRef = wakeRef ?? internalSeekRef
  const framingRef = useRef<{ element: Element; bounds: PreviewBounds } | null>(null)
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    shadow.replaceChildren()
    const snapshot = createMotionSnapshot(element, ownerWindow, shadow)
    if (!snapshot) return
    const { root: clone } = snapshot
    const dependencies = createMotionDependencies(element.ownerDocument)
    const oldStyle = host.ownerDocument.createElement("span").style
    const childrenOf = (source: Element) => {
      if (source.localName === "slot") {
        const assigned = (source as HTMLSlotElement).assignedNodes({ flatten: true })
        if (assigned.length) return assigned
      }
      return [...(source.shadowRoot?.childNodes ?? source.childNodes)]
    }
    // Cache node references until structure changes, not on every animation frame.
    const readPairs = () => snapshot.pairs.map((pair) => {
      dependencies.forElement(pair.source, "")
      const targets = observedTargets.filter((target) => target.element === pair.source)
      // Ownership flags are not CSS properties. An opaque source requires a
      // bounded computed-style fallback for its snapshot subtree.
      const opaque = observedTargets.some((target) => target.properties.includes("style") && (target.element === element || target.element === pair.source || target.element.contains(pair.source)))
      const properties = targets.flatMap((target) => target.properties).filter((property) => OBSERVED_MOTION_PROPERTIES.includes(property))
      return {
        ...pair,
        properties: new Set<string>(opaque ? OBSERVED_MOTION_PROPERTIES : properties),
        written: new Map<string, string>(),
        sourceText: pair.pseudo ? [] : childrenOf(pair.source).filter((node) => node.nodeType === 3),
        copyText: pair.pseudo ? [] : [...pair.copy.childNodes].filter((node) => node.nodeType === 3),
      }
    })
    let pairs = readPairs()
    let structureDirty = false
    const frame = host.ownerDocument.createElement("div")
    frame.style.cssText = "position:absolute;transform-origin:top left;pointer-events:none;"
    Object.assign(clone.style, { position: "absolute", inset: "auto", left: "0", top: "0", margin: "0" })
    frame.append(clone)
    shadow.append(frame)
    let request = 0, lastPaint = -Infinity, lastFit = 0, lastSize = -Infinity, needsSize = false, running = false, disposed = false
    let scale = 1
    let bounds = framingRef.current?.element === element ? framingRef.current.bounds : null
    const originStyle = ownerWindow.getComputedStyle(element)
    const offsets = { left: Number.parseFloat(originStyle.left) || 0, top: Number.parseFloat(originStyle.top) || 0 }
    let effects: { source: Element; pseudo: string | null; frames: Keyframe[] }[] = []
    let previousAnimations: Animation[] = []
    const signatures = new WeakMap<Animation, string>()
    const fit = () => {
      if (!bounds) return
      framingRef.current = { element, bounds }
      const fitted = fitMotionPreview({ left: bounds.left, top: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top }, host.clientWidth, host.clientHeight)
      scale = fitted.scale
      frame.style.transform = `translate(${fitted.left}px, ${fitted.top}px) scale(${scale})`
    }
    const measure = (dynamicOnly = false) => {
      const origin = frame.getBoundingClientRect()
      for (const { copy, pseudo, properties } of pairs) {
        if (pseudo || !copy.isConnected) continue
        if (dynamicOnly && copy !== clone && !properties.size) continue
        const rect = copy.getBoundingClientRect()
        if (!rect.width || !rect.height) continue
        const next = { left: (rect.left - origin.left) / scale, top: (rect.top - origin.top) / scale, right: (rect.right - origin.left) / scale, bottom: (rect.bottom - origin.top) / scale }
        bounds = bounds ? { left: Math.min(bounds.left, next.left), top: Math.min(bounds.top, next.top), right: Math.max(bounds.right, next.right), bottom: Math.max(bounds.bottom, next.bottom) } : next
      }
    }
    const size = (sampleEffects = true) => {
      if (!element.isConnected) return
      const computed = ownerWindow.getComputedStyle(element)
      clone.style.width = frame.style.width = computed.width
      clone.style.height = frame.style.height = computed.height
      frame.style.transform = "none"
      scale = 1
      if (!observedTargets.length) bounds = null
      let parent = element.parentElement, background = "rgba(0, 0, 0, 0)"
      while (parent && background === "rgba(0, 0, 0, 0)") { background = ownerWindow.getComputedStyle(parent).backgroundColor; parent = parent.parentElement }
      host.style.background = background
      const samples: Animation[] = []
      try {
        measure()
        // Live JS/mixed motion has no seekable envelope. Avoid 33 forced-layout
        // keyframe samples every time a text morpher creates a new effect.
        for (const effect of observedTargets.length || !sampleEffects ? [] : effects) {
          const pair = pairs.find((pair) => pair.source === effect.source && pair.pseudo === effect.pseudo)
          if (!pair || !pair.copy.animate) continue
          try {
            const sample = pair.copy.animate(effect.frames, { duration: 1000, fill: "both", pseudoElement: effect.pseudo })
            sample.pause()
            samples.push(sample)
          } catch { /* Unsupported pseudo-element/animation: keep the visual snapshot. */ }
        }
        for (let step = 0; samples.length && step <= 32; step++) {
          samples.forEach((sample) => { sample.currentTime = step * 1000 / 32 })
          measure()
        }
      } finally { samples.forEach((sample) => sample.cancel()) }
      fit()
    }
    const paint = (time: number) => {
      request = 0
      if (disposed || !element.isConnected) return
      if (time - lastPaint >= 1000 / (observedTargets.length ? 60 : 30) - 1) {
        lastPaint = time
        if (structureDirty) {
          structureDirty = false
          snapshot.refresh()
          pairs = readPairs()
          for (const pair of pairs) if (pair.source.shadowRoot) mutations?.observe(pair.source.shadowRoot, mutationOptions)
          scan()
          needsSize = true
        }
        if (needsSize && time - lastSize >= 250) { lastSize = time; needsSize = false; size() }
        // Read source styles before writing to the mirror, avoiding layout thrash.
        const textUpdates = pairs.map((pair) => {
          if (pair.pseudo) return []
          const { sourceText, copyText } = pair
          return sourceText.flatMap((node, index) => copyText[index] && copyText[index].textContent !== node.textContent ? [{ copy: copyText[index], text: node.textContent }] : [])
        })
        const computedStyles = pairs.map((pair, index) => {
          if (!pair.source.isConnected || (!pair.properties.size && !textUpdates[index].length)) return null
          try { return ownerWindow.getComputedStyle(pair.source, pair.pseudo) } catch { return null }
        })
        const values = pairs.map((pair, index) => {
          const computed = computedStyles[index]
          return computed ? [...pair.properties].map((property) => [property, computed.getPropertyValue(property)] as const) : []
        })
        const sizes = computedStyles.map((computed, index) => computed && textUpdates[index].length ? [computed.width, computed.height] : null)
        for (const [index, pair] of pairs.entries()) {
          if (textUpdates[index].length) {
            for (const update of textUpdates[index]) update.copy.textContent = update.text
            const size = sizes[index]
            if (size) { pair.style.width = size[0]; pair.style.height = size[1] }
            needsSize = true
          }
          if (!pair.properties.size || !pair.copy.isConnected) continue
          for (const [property, sourceValue] of values[index]) {
            if (property === "content" && !pair.pseudo) continue
            let value = sourceValue
            if (pair.source === element && !pair.pseudo && (property === "left" || property === "top")) {
              value = `${(Number.parseFloat(value) || 0) - offsets[property]}px`
            }
            if (pair.written.get(property) !== value) {
              pair.style.setProperty(property, value)
              pair.written.set(property, value)
            }
          }
        }
        if (observedTargets.length && time - lastFit >= 100) { lastFit = time; measure(true); fit() }
      }
      if (running && !request) request = ownerWindow.requestAnimationFrame(paint)
    }
    const wake = () => { if (!disposed && !request) request = ownerWindow.requestAnimationFrame(paint) }
    seekRef.current = () => { lastPaint = -Infinity; wake() }
    const scan = () => {
      if (disposed) return
      if (!element.isConnected) { running = false; return }
      if (dependencies.refresh(ownerWindow.performance.now())) {
        structureDirty = true
        needsSize = true
      }
      const animations = getMotionAnimations(element)
      let changed = animations.length !== previousAnimations.length || animations.some((animation, index) => animation !== previousAnimations[index])
      previousAnimations = animations
      running = observedTargets.length > 0 || animations.some((animation) => animation.playState === "running")
      effects = []
      for (const animation of animations) {
        try {
          const effect = animation.effect as KeyframeEffect | null
          if (!effect?.target) continue
          const frames = effect.getKeyframes()
          const signature = JSON.stringify(frames)
          if (signatures.get(animation) !== signature) { signatures.set(animation, signature); changed = true }
          const pair = pairs.find((pair) => pair.source === effect.target && pair.pseudo === (effect.pseudoElement ?? null))
          if (!pair) continue
          frames.forEach((frame) => Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)).forEach((key) => pair.properties.add(motionCssProperty(key))))
          if (!frames.length && observedTargets.some((target) => target.properties.includes("animation"))) {
            for (const property of OBSERVED_MOTION_PROPERTIES) pair.properties.add(property)
          }
          effects.push({ source: effect.target, pseudo: effect.pseudoElement ?? null, frames })
        } catch {
          // Hidden keyframes still permit mirroring the effect's target styles.
          const effect = animation.effect as KeyframeEffect | null
          for (const pair of pairs) if (pair.source === effect?.target && pair.pseudo === (effect?.pseudoElement ?? null)) {
            for (const property of OBSERVED_MOTION_PROPERTIES) pair.properties.add(property)
          }
        }
      }
      if (changed) needsSize = true
      wake()
    }
    scan()
    // Show the first frame before doing the more expensive native bounds sweep.
    size(false)
    needsSize = effects.length > 0 && !observedTargets.length
    lastSize = ownerWindow.performance.now()
    const Resize = (ownerWindow as Window & typeof globalThis).ResizeObserver
    const resize = Resize ? new Resize(() => { needsSize = true; wake() }) : null
    resize?.observe(host)
    resize?.observe(element)
    const Mutation = (ownerWindow as Window & typeof globalThis).MutationObserver
    const mutations = Mutation ? new Mutation((records) => {
      if (records.some((record) => record.type === "childList")) structureDirty = true
      for (const record of records) {
        if (record.type !== "attributes") continue
        const source = record.target as HTMLElement
        if (record.attributeName === "class") dependencies.invalidate()
        if (record.attributeName === "style") {
          oldStyle.cssText = record.oldValue ?? ""
          const variables = [...new Set([...source.style, ...oldStyle])].filter((property) => property.startsWith("--") && source.style.getPropertyValue(property) !== oldStyle.getPropertyValue(property))
          for (const pair of pairs) {
            const author = variables.length ? dependencies.forElement(pair.source, "") : null
            const computed = variables.length && dependencies.hasOpaqueStyles(pair.source) ? ownerWindow.getComputedStyle(pair.source, pair.pseudo) : null
            for (const property of OBSERVED_MOTION_PROPERTIES) {
              const inline = pair.pseudo ? "" : (pair.source as HTMLElement).style?.getPropertyValue(property) ?? ""
              if ((pair.source === source && !pair.pseudo && inline !== oldStyle.getPropertyValue(property)) || variables.some((variable) => [...cssVariables(inline), ...(author?.get(property) ?? [])].includes(variable)) || (computed && computed.getPropertyValue(property) !== (pair.written.get(property) ?? pair.style.getPropertyValue(property)))) pair.properties.add(property)
            }
          }
        } else if (record.attributeName === "class") {
          // Discover class-driven changes once, rather than sampling every node
          // and every property throughout the animation.
          for (const pair of pairs) {
            const computed = ownerWindow.getComputedStyle(pair.source, pair.pseudo)
            for (const property of OBSERVED_MOTION_PROPERTIES) if (computed.getPropertyValue(property) !== (pair.written.get(property) ?? pair.style.getPropertyValue(property))) pair.properties.add(property)
          }
        } else if (record.attributeName === "transform" || record.attributeName === "opacity") {
          for (const pair of pairs) if (pair.source === source && !pair.pseudo) pair.properties.add(record.attributeName)
        }
      }
      wake()
    }) : null
    const mutationOptions = { subtree: true, attributes: true, attributeOldValue: true, childList: true, characterData: true, attributeFilter: ["style", "class", "transform", "opacity"] }
    mutations?.observe(element, mutationOptions)
    for (const { source } of pairs) if (source.shadowRoot) mutations?.observe(source.shadowRoot, mutationOptions)
    let ancestor = element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null
    while (ancestor) {
      mutations?.observe(ancestor, { attributes: true, attributeOldValue: true, attributeFilter: ["style", "class"] })
      ancestor = ancestor.parentElement ?? (ancestor.getRootNode() as ShadowRoot).host ?? null
    }
    const stylesObserver = Mutation ? new Mutation(() => { dependencies.invalidate(); wake() }) : null
    if (element.ownerDocument.head) stylesObserver?.observe(element.ownerDocument.head, { subtree: true, childList: true, characterData: true })
    const interval = ownerWindow.setInterval(scan, 250)
    return () => {
      disposed = true
      seekRef.current = null
      resize?.disconnect()
      mutations?.disconnect()
      stylesObserver?.disconnect()
      ownerWindow.clearInterval(interval)
      ownerWindow.cancelAnimationFrame(request)
      snapshot.dispose()
      shadow.replaceChildren()
    }
  }, [element, ownerWindow, observedTargets, seekRef])
  return <div ref={hostRef} aria-hidden="true" className="msr:pointer-events-none msr:relative msr:h-36 msr:w-full msr:overflow-hidden" />
}
