export type MotionSnapshotPair = { source: Element; copy: HTMLElement; style: CSSStyleDeclaration; pseudo: string | null }

// Inert rendered snapshot. Never clone resource URLs or custom-element behavior.
export function createMotionSnapshot(element: Element, view: Window, shadow: ShadowRoot) {
  const document = shadow.ownerDocument
  const pairs: MotionSnapshotPair[] = []
  const cleanups = new Map<Element, () => void>()
  const copies = new WeakMap<Node, Node>()
  const sourcePairs = new WeakMap<Node, MotionSnapshotPair[]>()
  const pseudoRules: { pair: MotionSnapshotPair; css: string }[] = []
  const copyStyle = (source: CSSStyleDeclaration, target: CSSStyleDeclaration) => {
    for (const property of source) {
      const value = source.getPropertyValue(property)
      // Keep the mirror inert and avoid triggering duplicate network requests
      // from computed background, mask, cursor, or content URLs.
      if (/\burl\(/i.test(value)) continue
      target.setProperty(property, value)
    }
    target.setProperty("animation", "none", "important")
    target.setProperty("transition", "none", "important")
    target.setProperty("pointer-events", "none", "important")
  }
  const clone = (source: Node): Node | null => {
    if (source.nodeType === 3) {
      const copy = copies.get(source) ?? document.createTextNode("")
      if (copy.textContent !== source.textContent) copy.textContent = source.textContent
      copies.set(source, copy)
      return copy
    }
    if (source.nodeType !== 1 || pairs.length >= 128) return null
    const original = source as Element
    if (["SCRIPT", "STYLE", "LINK", "IFRAME", "OBJECT", "EMBED", "SOURCE", "TRACK"].includes(original.tagName)) return null
    const cached = copies.get(source) as HTMLElement | undefined
    if (cached) {
      for (const pair of sourcePairs.get(source) ?? []) {
        if (pair.pseudo) pseudoRules.push({ pair, css: `[data-motion-snapshot="${cached.dataset.motionSnapshot}"]${pair.pseudo}{${pair.style.cssText}}` })
        else pairs.push(pair)
      }
      syncChildren(original, cached)
      return cached
    }
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
    copy.dataset.motionSnapshot = String(nextId++)
    const ownPairs: MotionSnapshotPair[] = [{ source: original, copy, style: copy.style, pseudo: null }]
    pairs.push(...ownPairs)
    copies.set(source, copy)
    sourcePairs.set(source, ownPairs)
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
      cleanups.set(original, () => { original.removeEventListener("load", draw); original.removeEventListener("loadeddata", draw) })
    } else {
      syncChildren(original, copy)
    }
    for (const pseudo of ["::before", "::after"]) {
      let style: CSSStyleDeclaration
      try { style = view.getComputedStyle(original, pseudo) } catch { continue }
      if (!style.content || style.content === "none" || style.content === "normal") continue
      const scratch = document.createElement("span").style
      copyStyle(style, scratch)
      const pair = { source: original, copy, style: scratch, pseudo }
      ownPairs.push(pair)
      pseudoRules.push({ pair, css: `[data-motion-snapshot="${copy.dataset.motionSnapshot}"]${pseudo}{${scratch.cssText}}` })
    }
    return copy
  }
  let nextId = 0
  function syncChildren(original: Element, copy: HTMLElement) {
    if (["IMG", "VIDEO", "CANVAS"].includes(original.tagName)) return
    const slot = original as HTMLSlotElement
    const assigned = original.localName === "slot" ? slot.assignedNodes({ flatten: true }) : []
    const nodes = assigned.length ? assigned : [...(original.shadowRoot?.childNodes ?? original.childNodes)]
    const children = nodes.map(clone).filter((node): node is Node => Boolean(node))
    children.forEach((child, index) => {
      if (copy.childNodes[index] !== child) copy.insertBefore(child, copy.childNodes[index] ?? null)
    })
    while (copy.childNodes.length > children.length) copy.lastChild?.remove()
  }
  const root = clone(element) as HTMLElement | null
  if (!root) return null
  const styles = document.createElement("style")
  shadow.append(styles)
  const updateRules = () => {
    styles.textContent = pseudoRules.map(({ css }) => css).join("\n")
    const rules = styles.sheet?.cssRules
    pseudoRules.forEach(({ pair }, index) => {
      const rule = rules?.[index] as CSSStyleRule | undefined
      if (rule) { pair.style = rule.style; pairs.push(pair) }
    })
  }
  updateRules()
  const refresh = () => {
    pairs.length = 0
    pseudoRules.length = 0
    clone(element)
    updateRules()
    const active = new Set(pairs.map((pair) => pair.source))
    for (const [source, cleanup] of cleanups) if (!active.has(source)) {
      cleanup(); cleanups.delete(source); copies.delete(source)
    }
  }
  return { root, pairs, refresh, dispose: () => cleanups.forEach((cleanup) => cleanup()) }
}
