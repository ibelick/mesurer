import { useLayoutEffect, useRef } from "react"

// A read-only visual mirror: controls always operate on the original element.
// The shadow root isolates page selectors/IDs from the inspector UI.
export function MotionPreview({ element, ownerWindow }: { element: Element; ownerWindow: Window }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    const clone = element.cloneNode(true) as HTMLElement
    const sources = [element, ...element.querySelectorAll("*")]
    const copies = [clone, ...clone.querySelectorAll("*")] as HTMLElement[]
    const pairs = sources.map((source, index) => ({ source, copy: copies[index] }))
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
    clone.style.setProperty("position", "relative")
    clone.style.setProperty("inset", "auto")
    clone.style.setProperty("margin", "0")
    frame.append(clone)
    shadow.replaceChildren(frame)

    const size = () => {
      const computed = ownerWindow.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const width = (element as HTMLElement).offsetWidth || rect.width || 1
      const height = (element as HTMLElement).offsetHeight || rect.height || 1
      clone.style.width = `${width}px`
      clone.style.height = `${height}px`
      frame.style.width = `${width}px`
      frame.style.height = `${height}px`
      let background = computed.backgroundColor
      let parent = element.parentElement
      while (background === "rgba(0, 0, 0, 0)" && parent) {
        background = ownerWindow.getComputedStyle(parent).backgroundColor
        parent = parent.parentElement
      }
      host.style.background = background
      const scale = Math.min(host.clientWidth / width, host.clientHeight / height)
      frame.style.transform = `translate(${(host.clientWidth - width * scale) / 2}px, ${(host.clientHeight - height * scale) / 2}px) scale(${scale})`
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(host)
    observer.observe(element)
    let request = 0
    const update = () => {
      for (const { source, copy } of pairs) {
        if (!copy?.isConnected || !copy.style) continue
        const properties = new Set<string>()
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
      request = ownerWindow.requestAnimationFrame(update)
    }
    update()
    return () => {
      observer.disconnect()
      ownerWindow.cancelAnimationFrame(request)
      shadow.replaceChildren()
    }
  }, [element, ownerWindow])

  return <div ref={hostRef} aria-hidden="true" className="msr:pointer-events-none msr:relative msr:h-36 msr:w-full msr:overflow-hidden" />
}
