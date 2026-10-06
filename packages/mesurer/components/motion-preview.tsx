import { useLayoutEffect, useRef } from "react"
import { getMotionAnimations, motionCssProperty } from "../core/motion"
import { fitMotionPreview } from "../core/motion-preview"
import { createMotionSnapshot } from "../core/motion-snapshot"
import type { ObservedMotionTarget } from "../core/observed-motion"

// Read-only mirror. Metadata is polled at 4Hz; only running motion paints at 30Hz.
export function MotionPreview({ element, ownerWindow, observedTargets }: { element: Element; ownerWindow: Window; observedTargets: ObservedMotionTarget[] }) {
  const hostRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    shadow.replaceChildren()
    const snapshot = createMotionSnapshot(element, ownerWindow, shadow)
    if (!snapshot) return
    const { root: clone } = snapshot
    const pairs = snapshot.pairs.map((pair) => ({ ...pair, properties: new Set(observedTargets.filter((target) => target.element === pair.source && !pair.pseudo).flatMap((target) => target.properties)) }))
    const frame = host.ownerDocument.createElement("div")
    frame.style.cssText = "position:absolute;transform-origin:top left;pointer-events:none;"
    Object.assign(clone.style, { position: "absolute", inset: "auto", left: "0", top: "0", margin: "0" })
    frame.append(clone)
    shadow.append(frame)
    let request = 0, lastPaint = -Infinity, lastFit = 0, lastSize = -Infinity, needsSize = false, running = false, disposed = false
    let scale = 1
    let bounds: { left: number; top: number; right: number; bottom: number } | null = null
    let effects: { source: Element; pseudo: string | null; frames: Keyframe[] }[] = []
    let previousAnimations: Animation[] = []
    const signatures = new WeakMap<Animation, string>()
    const fit = () => {
      if (!bounds) return
      const fitted = fitMotionPreview({ left: bounds.left, top: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top }, host.clientWidth, host.clientHeight)
      scale = fitted.scale
      frame.style.transform = `translate(${fitted.left}px, ${fitted.top}px) scale(${scale})`
    }
    const measure = () => {
      const origin = frame.getBoundingClientRect()
      for (const { copy, pseudo } of pairs) {
        if (pseudo || !copy.isConnected) continue
        const rect = copy.getBoundingClientRect()
        if (!rect.width || !rect.height) continue
        const next = { left: (rect.left - origin.left) / scale, top: (rect.top - origin.top) / scale, right: (rect.right - origin.left) / scale, bottom: (rect.bottom - origin.top) / scale }
        bounds = bounds ? { left: Math.min(bounds.left, next.left), top: Math.min(bounds.top, next.top), right: Math.max(bounds.right, next.right), bottom: Math.max(bounds.bottom, next.bottom) } : next
      }
    }
    const size = () => {
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
        for (const effect of effects) {
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
      if (time - lastPaint >= 1000 / 30) {
        lastPaint = time
        if (needsSize && time - lastSize >= 250) { lastSize = time; needsSize = false; size() }
        for (const pair of pairs) {
          if (!pair.properties.size || !pair.copy.isConnected) continue
          let computed: CSSStyleDeclaration
          try { computed = ownerWindow.getComputedStyle(pair.source, pair.pseudo) } catch { continue }
          for (const property of pair.properties) {
            const value = computed.getPropertyValue(property)
            if (pair.style.getPropertyValue(property) !== value) pair.style.setProperty(property, value)
          }
        }
        if (observedTargets.length && time - lastFit >= 100) { lastFit = time; measure(); fit() }
      }
      if (running) request = ownerWindow.requestAnimationFrame(paint)
    }
    const wake = () => { if (!disposed && !request) request = ownerWindow.requestAnimationFrame(paint) }
    const scan = () => {
      if (disposed) return
      if (!element.isConnected) { running = false; return }
      const animations = getMotionAnimations(element)
      let changed = animations.length !== previousAnimations.length || animations.some((animation, index) => animation !== previousAnimations[index])
      previousAnimations = animations
      running = animations.some((animation) => animation.playState === "running")
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
          effects.push({ source: effect.target, pseudo: effect.pseudoElement ?? null, frames })
        } catch { /* Unavailable effect data must not stop the mirror. */ }
      }
      if (changed) needsSize = true
      wake()
    }
    scan()
    size()
    needsSize = false
    lastSize = ownerWindow.performance.now()
    const Resize = (ownerWindow as Window & typeof globalThis).ResizeObserver
    const resize = Resize ? new Resize(() => { needsSize = true; wake() }) : null
    resize?.observe(host)
    resize?.observe(element)
    const Mutation = (ownerWindow as Window & typeof globalThis).MutationObserver
    const mutations = Mutation ? new Mutation(wake) : null
    mutations?.observe(element, { subtree: true, attributes: true, childList: true })
    for (const { source } of pairs) if (source.shadowRoot) mutations?.observe(source.shadowRoot, { subtree: true, attributes: true, childList: true })
    const interval = ownerWindow.setInterval(scan, 250)
    return () => {
      disposed = true
      resize?.disconnect()
      mutations?.disconnect()
      ownerWindow.clearInterval(interval)
      ownerWindow.cancelAnimationFrame(request)
      snapshot.dispose()
      shadow.replaceChildren()
    }
  }, [element, ownerWindow, observedTargets])
  return <div ref={hostRef} aria-hidden="true" className="msr:pointer-events-none msr:relative msr:h-36 msr:w-full msr:overflow-hidden" />
}
