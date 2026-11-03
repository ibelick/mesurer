type Clip = { x: number; y: number; width: number; height: number }
export type ImageLayer = { url: string; x: number; y: number; width: number; height: number; fit: "none" | "meet" | "slice"; clip?: Clip }

const imageUrl = (value: string) => {
  try {
    const url = new URL(value)
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined
    // Query strings and fragments often contain signed credentials or personal data. They must
    // not become part of a share link's publicly readable image layer.
    url.search = ""
    url.hash = ""
    return url.href
  } catch {
    return undefined
  }
}

// Constructs a transparent overlay from image addresses and geometry only, never page markup.
export const liveImageDocument = (layers: ImageLayer[], kept: Iterable<string>, width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined
  const blocked = new Set(kept)
  const images = layers.flatMap((layer) => {
    const address = imageUrl(layer.url)
    if (!address || !blocked.has(layer.url) || ![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) || layer.width <= 0 || layer.height <= 0 || !["none", "meet", "slice"].includes(layer.fit)) return []
    const url = address.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const aspect = layer.fit === "none" ? "none" : `xMidYMid ${layer.fit}`
    const image = `<image href="${url}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${aspect}"/>`
    const clip = layer.clip
    if (!clip) return [image]
    if (![clip.x, clip.y, clip.width, clip.height].every(Number.isFinite) || clip.width <= 0 || clip.height <= 0) return []
    return [`<svg x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}" viewBox="${clip.x} ${clip.y} ${clip.width} ${clip.height}" overflow="hidden">${image}</svg>`]
  })
  return images.length ? `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}">${images.join("")}</svg>` : undefined
}

// Hosts can supply their own capture function. Fail closed if its SVG is not an image-only
// document, and rebuild it rather than uploading arbitrary markup or attributes.
export const sanitizeLiveImageDocument = (value: string) => {
  if (typeof DOMParser === "undefined") return undefined
  const document = new DOMParser().parseFromString(value, "image/svg+xml")
  const root = document.documentElement
  if (root.localName !== "svg" || root.namespaceURI !== "http://www.w3.org/2000/svg" || document.querySelector("parsererror")) return undefined
  const viewBox = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number)
  if (viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0) return undefined
  const layers: ImageLayer[] = []
  for (const node of root.childNodes) {
    if (node.nodeType === 3 && !node.textContent?.trim()) continue
    if (node.nodeType !== 1) return undefined
    let element = node as Element
    let clip: Clip | undefined
    if (element.localName === "svg" && element.namespaceURI === root.namespaceURI) {
      const values = ["x", "y", "width", "height"].map((name) => element.hasAttribute(name) ? Number(element.getAttribute(name)) : NaN)
      const box = (element.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number)
      if (!values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0 || box.length !== 4 || !values.every((v, i) => v === box[i]) || element.children.length !== 1 || [...element.childNodes].some((child) => child.nodeType !== 1 && (child.nodeType !== 3 || child.textContent?.trim()))) return undefined
      clip = { x: values[0], y: values[1], width: values[2], height: values[3] }
      element = element.children[0]
    }
    if (element.localName !== "image" || element.namespaceURI !== root.namespaceURI || element.childNodes.length) return undefined
    const url = element.getAttribute("href") ?? ""
    const aspect = element.getAttribute("preserveAspectRatio")
    const fit = aspect === "none" ? "none" : aspect === "xMidYMid meet" ? "meet" : aspect === "xMidYMid slice" ? "slice" : undefined
    const coordinates = ["x", "y", "width", "height"].map((name) => element.hasAttribute(name) ? Number(element.getAttribute(name)) : NaN)
    if (!imageUrl(url) || !fit || !coordinates.every(Number.isFinite)) return undefined
    layers.push({ url, x: coordinates[0], y: coordinates[1], width: coordinates[2], height: coordinates[3], fit, ...(clip ? { clip } : {}) })
  }
  return liveImageDocument(layers, layers.map((layer) => layer.url), viewBox[2], viewBox[3])
}
