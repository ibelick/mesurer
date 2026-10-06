export type MotionSnapshotPair = { source: Element; copy: HTMLElement; style: CSSStyleDeclaration; pseudo: string | null }

// Inert rendered snapshot. Never clone resource URLs or custom-element behavior.
export function createMotionSnapshot(element: Element, view: Window, shadow: ShadowRoot) {
  const document = shadow.ownerDocument
  const pairs: MotionSnapshotPair[] = []
  const cleanups: (() => void)[] = []
  const pseudoRules: { pair: MotionSnapshotPair; css: string }[] = []
  const copyStyle = (source: CSSStyleDeclaration, target: CSSStyleDeclaration) => {
    for (const property of source) target.setProperty(property, source.getPropertyValue(property))
    target.setProperty("animation", "none", "important")
    target.setProperty("transition", "none", "important")
    target.setProperty("pointer-events", "none", "important")
  }
  const clone = (source: Node): Node | null => {
    if (source.nodeType === 3) return document.createTextNode(source.textContent ?? "")
    if (source.nodeType !== 1 || pairs.length >= 128) return null
    const original = source as Element
    if (["SCRIPT", "STYLE", "LINK", "IFRAME", "OBJECT", "EMBED", "SOURCE", "TRACK"].includes(original.tagName)) return null
    const media = ["IMG", "VIDEO", "CANVAS"].includes(original.tagName)
    const tag = media ? "canvas" : original.localName.includes("-") || original.localName === "slot" ? "div" : original.localName
    const copy = document.createElementNS(media ? "http://www.w3.org/1999/xhtml" : original.namespaceURI, tag) as HTMLElement
    // Geometry attributes matter for SVG. All other rendering comes from computed CSS.
    if (original.namespaceURI === "http://www.w3.org/2000/svg") for (const attribute of original.attributes) {
      if (!/^(on|href|src)|:href$/i.test(attribute.name)) copy.setAttribute(attribute.name, attribute.value)
    }
    let computed: CSSStyleDeclaration
    try { computed = view.getComputedStyle(original) } catch { return null }
    copyStyle(computed, copy.style)
    copy.setAttribute("tabindex", "-1")
    const id = pairs.length
    copy.dataset.motionSnapshot = String(id)
    pairs.push({ source: original, copy, style: copy.style, pseudo: null })
    if (media) {
      const canvas = copy as HTMLCanvasElement
      canvas.width = Math.min(1024, original.clientWidth || 1)
      canvas.height = Math.min(1024, original.clientHeight || 1)
      const draw = () => { try {
        const context = canvas.getContext("2d")
        const image = original as HTMLImageElement
        const width = image.naturalWidth || (original as HTMLVideoElement).videoWidth || (original as HTMLCanvasElement).width || canvas.width
        const height = image.naturalHeight || (original as HTMLVideoElement).videoHeight || (original as HTMLCanvasElement).height || canvas.height
        const scale = computed.objectFit === "cover" ? Math.max(canvas.width / width, canvas.height / height) : computed.objectFit === "contain" ? Math.min(canvas.width / width, canvas.height / height) : null
        const w = scale ? width * scale : canvas.width, h = scale ? height * scale : canvas.height
        context?.drawImage(original as CanvasImageSource, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
      } catch { /* Unloaded or unavailable media remains an inert placeholder. */ } }
      draw()
      original.addEventListener("load", draw)
      original.addEventListener("loadeddata", draw)
      cleanups.push(() => { original.removeEventListener("load", draw); original.removeEventListener("loadeddata", draw) })
    } else {
      const slot = original as HTMLSlotElement
      const children = original.localName === "slot" ? slot.assignedNodes({ flatten: true }) : [...(original.shadowRoot?.childNodes ?? original.childNodes)]
      for (const child of children.length ? children : original.childNodes) {
        const copied = clone(child)
        if (copied) copy.append(copied)
      }
    }
    for (const pseudo of ["::before", "::after"]) {
      let style: CSSStyleDeclaration
      try { style = view.getComputedStyle(original, pseudo) } catch { continue }
      if (!style.content || style.content === "none" || style.content === "normal") continue
      const scratch = document.createElement("span").style
      copyStyle(style, scratch)
      const pair = { source: original, copy, style: scratch, pseudo }
      pseudoRules.push({ pair, css: `[data-motion-snapshot="${id}"]${pseudo}{${scratch.cssText}}` })
    }
    return copy
  }
  const root = clone(element) as HTMLElement | null
  if (!root) return null
  const styles = document.createElement("style")
  styles.textContent = pseudoRules.map(({ css }) => css).join("\n")
  shadow.append(styles)
  const rules = styles.sheet?.cssRules
  pseudoRules.forEach(({ pair }, index) => {
    const rule = rules?.[index] as CSSStyleRule | undefined
    if (rule) pairs.push({ ...pair, style: rule.style })
  })
  return { root, pairs, dispose: () => cleanups.forEach((cleanup) => cleanup()) }
}
