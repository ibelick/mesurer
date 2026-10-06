import { useLayoutEffect, useRef } from "react"
import { fitMotionPreview } from "../core/motion-preview"

// A read-only visual mirror: controls always operate on the original element.
// The shadow root isolates page selectors/IDs from the inspector UI.
export function MotionPreview({ element, ownerWindow, observedProperties = [] }: { element: Element; ownerWindow: Window; observedProperties?: string[] }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    const clone = element.cloneNode(true) as HTMLElement
    const sources = [element, ...element.querySelectorAll("*")]
    const copies = [clone, ...clone.querySelectorAll("*")] as HTMLElement[]
    const pairs = sources.map((source, index) => ({ source, copy: copies[index], properties: new Set<string>(source === element ? observedProperties : []) }))
    const frame = host.ownerDocument.createElement("div")
    frame.style.cssText = "position:absolute;transform-origin:top left;pointer-events:none;"
    for (const { source, copy } of pairs) {
      if (!copy?.style) continue
      for (const attribute of [...copy.attributes]) {
        if (attribute.name.startsWith("on")) copy.removeAttribute(attribute.name)
      }
      if (["SCRIPT", "IFRAME", "OBJECT", "EMBED", "STYLE", "LINK"].includes(copy.tagName)) {
        copy.remove()
        continue
      }
      const computed = ownerWindow.getComputedStyle(source)
      for (const property of computed) copy.style.setProperty(property, computed.getPropertyValue(property))
      copy.style.setProperty("animation", "none", "important")
      copy.style.setProperty("transition", "none", "important")
      copy.style.setProperty("pointer-events", "none", "important")
      copy.setAttribute("tabindex", "-1")
      if (copy.tagName === "CANVAS") {
        (copy as HTMLCanvasElement).getContext("2d")?.drawImage(source as HTMLCanvasElement, 0, 0)
      }
    }
    clone.style.setProperty("position", "absolute")
    clone.style.setProperty("inset", "auto")
    clone.style.setProperty("left", "0")
    clone.style.setProperty("top", "0")
    clone.style.setProperty("margin", "0")
    frame.append(clone)
    shadow.replaceChildren(frame)

    let observedBounds: { left: number; top: number; right: number; bottom: number } | null = null
    const size = () => {
      const computed = ownerWindow.getComputedStyle(element)
      // Preserve fractional CSS dimensions: offsetWidth rounds and can wrap text.
      clone.style.width = computed.width
      clone.style.height = computed.height
      frame.style.width = computed.width
      frame.style.height = computed.height
      frame.style.transform = "none"
      let background = "rgba(0, 0, 0, 0)"
      let parent = element.parentElement
      while (background === "rgba(0, 0, 0, 0)" && parent) {
        background = ownerWindow.getComputedStyle(parent).backgroundColor
        parent = parent.parentElement
      }
      host.style.background = background
      const origin = frame.getBoundingClientRect()
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
      const measure = () => {
        for (const { copy } of pairs) {
          if (!copy?.isConnected) continue
          const rect = copy.getBoundingClientRect()
          if (!rect.width || !rect.height) continue
          left = Math.min(left, rect.left - origin.left)
          top = Math.min(top, rect.top - origin.top)
          right = Math.max(right, rect.right - origin.left)
          bottom = Math.max(bottom, rect.bottom - origin.top)
        }
      }
      // Sample only the isolated copies. Never seek or restart the page's animations.
      const samples: Animation[] = []
      try {
        measure()
        for (const { source, copy } of pairs) {
          if (!copy?.isConnected || !copy.animate) continue
          for (const animation of source.getAnimations()) {
            const effect = animation.effect as KeyframeEffect | null
            if (!effect?.getKeyframes) continue
            const sample = copy.animate(effect.getKeyframes(), { duration: 1000, fill: "both" })
            sample.pause()
            samples.push(sample)
          }
        }
        for (let step = 0; samples.length && step <= 32; step++) {
          for (const sample of samples) sample.currentTime = step * 1000 / 32
          measure()
        }
      } finally {
        for (const sample of samples) sample.cancel()
      }
      if (!Number.isFinite(left)) return
      if (observedProperties.length) {
        left = Math.min(left, observedBounds?.left ?? left)
        top = Math.min(top, observedBounds?.top ?? top)
        right = Math.max(right, observedBounds?.right ?? right)
        bottom = Math.max(bottom, observedBounds?.bottom ?? bottom)
        observedBounds = { left, top, right, bottom }
      }
      const fit = fitMotionPreview({ left, top, width: right - left, height: bottom - top }, host.clientWidth, host.clientHeight)
      frame.style.transform = `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})`
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(host)
    observer.observe(element)
    let request = 0, lastFit = 0
    const update = () => {
      for (const { source, copy, properties } of pairs) {
        if (!copy?.isConnected || !copy.style) continue
        for (const animation of source.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null
          for (const keyframe of effect?.getKeyframes() ?? []) {
            for (const key of Object.keys(keyframe)) {
              if (!["offset", "computedOffset", "easing", "composite"].includes(key)) properties.add(key)
            }
          }
        }
        if (properties.size === 0) continue
        const computed = ownerWindow.getComputedStyle(source)
        for (const property of properties) {
          const cssProperty = property.startsWith("--") ? property : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
          copy.style.setProperty(cssProperty, computed.getPropertyValue(cssProperty))
        }
      }
      if (observedProperties.length && ownerWindow.performance.now() - lastFit >= 100) {
        lastFit = ownerWindow.performance.now()
        size()
      }
      request = ownerWindow.requestAnimationFrame(update)
    }
    update()
    return () => {
      observer.disconnect()
      ownerWindow.cancelAnimationFrame(request)
      shadow.replaceChildren()
    }
  }, [element, ownerWindow, observedProperties])

  return <div ref={hostRef} aria-hidden="true" className="msr:pointer-events-none msr:relative msr:h-36 msr:w-full msr:overflow-hidden" />
}
