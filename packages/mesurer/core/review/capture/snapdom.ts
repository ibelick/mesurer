import type { CapturedReviewImage } from "./types"
import { liveImageDocument, type ImageLayer } from "./live-images"

// What stands in for an image that could not be drawn. `id` makes each one distinct, so the
// image it stands for can be found again in the capture.
const placeholderSvg = (id: number | string = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" preserveAspectRatio="none" data-image="${id}">` +
  `<rect width="40" height="40" fill="#94a3b8" fill-opacity=".07"/></svg>`

const FALLBACK_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(placeholderSvg())}`
const CSS_IMAGE_PROPERTIES = ["background-image", "mask-image", "border-image-source", "list-style-image", "content"]
const CSS_URL = /url\(\s*(["']?)(.*?)\1\s*\)/g


// A page may show images its own scripts cannot read: another origin's, served without CORS
// headers. Drawing them takes a host that can fetch them some other way.
// Without one, or for an image it cannot get, the capture keeps the image's address and the
// saved review shows it from there.
export type DomCaptureOptions = {
  /** Reads one image CORS blocks, as a data URL. Nothing, or a rejection, keeps its address. */
  loadImage?: (url: string) => Promise<string | undefined>
  /** Omits private fields from the captured clone as well as hiding them on the live page. */
  maskPrivate?: boolean
}

const dataUrlResponse = (dataUrl: string) => {
  const [header, body = ""] = dataUrl.split(",", 2)
  const binary = header.includes(";base64") ? atob(body) : decodeURIComponent(body)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new Response(bytes, { headers: { "Content-Type": header.slice(5).split(";")[0] } })
}

// The address of every image the page shows from http(s): its <img>, <picture> and SVG images,
// its video posters, and the images its styles draw, pseudo-elements and open shadow trees
// included.
const pageImageUrls = (root: Element, ownerWindow: Window) => {
  const urls = new Set<string>()
  const layers: ImageLayer[] = []
  const add = (value: string | null | undefined, element?: Element, fit: ImageLayer["fit"] = "none") => {
    if (!value) return
    try {
      const url = new URL(value, ownerWindow.location.href)
      if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return
      urls.add(url.href)
      if (!element) return
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      let left = rect.left, right = rect.right, top = rect.top, bottom = rect.bottom
      let parent = element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null
      while (parent && parent !== ownerWindow.document.documentElement && parent !== ownerWindow.document.body) {
        const style = ownerWindow.getComputedStyle(parent)
        const bounds = parent.getBoundingClientRect()
        if (style.overflowX !== "visible") { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right) }
        if (style.overflowY !== "visible") { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom) }
        parent = parent.parentElement ?? (parent.getRootNode() as ShadowRoot).host ?? null
      }
      if (right <= left || bottom <= top) return
      const clipped = left > rect.left || right < rect.right || top > rect.top || bottom < rect.bottom
      layers.push({
        url: url.href, x: rect.left + ownerWindow.scrollX, y: rect.top + ownerWindow.scrollY, width: rect.width, height: rect.height, fit,
        ...(clipped ? { clip: { x: left + ownerWindow.scrollX, y: top + ownerWindow.scrollY, width: right - left, height: bottom - top } } : {}),
      })
    } catch {
      /* Not an address. */
    }
  }
  const addStyled = (element: Element, pseudo?: string) => {
    const style = ownerWindow.getComputedStyle(element, pseudo)
    if (pseudo && /^(?:none|normal)$/.test(style.content)) return
    for (const property of CSS_IMAGE_PROPERTIES) {
      const value = style.getPropertyValue(property)
      if (value.includes("url(")) for (const match of value.matchAll(CSS_URL)) add(match[2], property === "background-image" || property === "content" ? element : undefined, "slice")
    }
  }
  const visit = (element: Element) => {
    if (element.matches("[data-mesurer-private], input, textarea, select, iframe, frame, [contenteditable]:not([contenteditable='false'])")) return
    const style = ownerWindow.getComputedStyle(element)
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return
    const tag = element.localName
    if (tag === "img") add((element as HTMLImageElement).currentSrc || (element as HTMLImageElement).src, element, style.objectFit === "cover" ? "slice" : style.objectFit === "contain" || style.objectFit === "scale-down" ? "meet" : "none")
    if (tag === "video") add(element.getAttribute("poster"), element, "meet")
    if (tag === "image") add(element.getAttribute("href") ?? element.getAttribute("xlink:href"), element, "meet")
    for (const candidate of element.getAttribute("srcset")?.split(",") ?? []) add(candidate.trim().split(/\s+/)[0])
    addStyled(element)
    addStyled(element, "::before")
    addStyled(element, "::after")
    for (const child of element.shadowRoot?.children ?? []) visit(child)
    for (const child of element.children) visit(child)
  }
  visit(root)
  return { urls, layers }
}

// For the length of a capture, a fetch for one of the page's images that fails (CORS, for an
// <img> and a CSS background alike) is answered by the host's loader. When it has none, or not
// this image, the answer is a placeholder that is told apart from every other, and `kept`
// records which image each one stands for. Every other fetch on the page is left as it is.
const routeBlockedFetches = (images: Set<string>, { loadImage }: DomCaptureOptions) => {
  const fetchDirectly = globalThis.fetch
  const kept = new Map<string, string>()
  const placeholders = new Map<string, string>()
  let routing = true
  const route: typeof fetch = async (input, init) => {
    try {
      return await fetchDirectly(input, init)
    } catch (error) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (!routing || !images.has(url)) throw error
      const dataUrl = await loadImage?.(url).catch(() => undefined)
      if (dataUrl) return dataUrlResponse(dataUrl)
      const placeholder = placeholders.get(url) ?? placeholderSvg(placeholders.size)
      placeholders.set(url, placeholder)
      kept.set(`data:image/svg+xml;base64,${btoa(placeholder)}`, url)
      return new Response(placeholder, { headers: { "Content-Type": "image/svg+xml" } })
    }
  }
  globalThis.fetch = route
  return {
    kept,
    // Something else may have wrapped fetch since: then this stays in the chain, passing through.
    restore: () => {
      routing = false
      if (globalThis.fetch === route) globalThis.fetch = fetchDirectly
    },
  }
}


// A whole page at a screen's full density is a very large picture: slow to draw and to encode,
// and heavy to keep and to send. So a capture is drawn at twice its size at most, and at less
// than that for a page so long that it would pass this many pixels.
const MAX_DENSITY = 2
const MAX_PIXELS = 20_000_000
// The longest side WebP can hold. A picture past it is saved as JPEG.
const MAX_WEBP_SIDE = 16383
// Text stays crisp at this, at a fraction of what a PNG weighs.
const QUALITY = 0.9

export const captureDocumentWithSnapdom = async (
  ownerDocument: Document,
  ownerWindow: Window,
  { loadImage, maskPrivate = false }: DomCaptureOptions = {},
): Promise<CapturedReviewImage> => {
  const { snapdom } = await import("@zumer/snapdom")
  const root = ownerDocument.documentElement
  const width = Math.max(root.scrollWidth, ownerDocument.body?.scrollWidth ?? 0, ownerWindow.innerWidth)
  const height = Math.max(root.scrollHeight, ownerDocument.body?.scrollHeight ?? 0, ownerWindow.innerHeight)
  const density = Math.min(ownerWindow.devicePixelRatio || 1, MAX_DENSITY, Math.sqrt(MAX_PIXELS / (width * height)))
  const format = Math.max(width, height) * density <= MAX_WEBP_SIDE ? "webp" : "jpeg"
  const images = pageImageUrls(root, ownerWindow)
  const blocked = routeBlockedFetches(images.urls, { loadImage })
  const result = await Promise.resolve().then(() => snapdom(root, {
    dpr: density,
    clip: { x: 0, y: 0, width, height },
    exclude: "[data-mesurer-comments-layer], .mesurer-color-picker, .mesurer-screenshot-preview, [aria-label='Screenshot selection']",
    excludeMode: "remove",
    ...(maskPrivate ? {
      filter: (element: Element) => !element.matches("input, textarea, select, [contenteditable]:not([contenteditable='false']), iframe, frame, [data-mesurer-private]"),
      filterMode: "hide" as const,
    } : {}),
    format,
    quality: QUALITY,
    backgroundColor: "#ffffff",
    reconcile: true,
    placeholders: true,
    fallbackURL: FALLBACK_IMAGE_URL,
  })).finally(blocked.restore)
  // The browser decodes the fonts embedded in the capture while it first paints it, and paints
  // that first time without them: every text would be missing. Painting it once before the
  // export, then letting that settle, leaves them ready. A timer, not a frame: the tab may be in
  // the background by now, where no frame comes.
  try {
    const warmUp = ownerDocument.createElement("img")
    warmUp.src = result.url
    await warmUp.decode()
    await new Promise<void>((resolve) => ownerWindow.setTimeout(resolve, 0))
  } catch {
    /* The export below still stands on its own. */
  }
  // A browser that cannot write the format asked for gives a PNG, which is taken as it comes.
  const blob = await result.toBlob({ format, quality: QUALITY })
  const live = blocked.kept.size ? liveImageDocument(images.layers, blocked.kept.values(), width, height) : undefined
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return {
    blob,
    ...size,
    mimeType: blob.type === "image/webp" || blob.type === "image/jpeg" ? blob.type : "image/png",
    origin: { x: 0, y: 0 },
    cssWidth: width,
    cssHeight: height,
    scale: 1,
    ...(live ? { live } : {}),
  }
}
