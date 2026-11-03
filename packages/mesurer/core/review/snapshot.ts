import { hideNodesForCapture } from "../screenshot"
import { captureVisibleTabPng } from "../screenshot-capture"
import type { CapturedReviewImage } from "./capture"

declare const __MESURER_SNAPDOM_CAPTURE__: boolean | undefined

type DomCapture = (
  ownerDocument: Document,
  ownerWindow: Window,
) => Promise<CapturedReviewImage>

export type ReviewSnapshotCaptureOptions = {
  ownerDocument: Document
  ownerWindow: Window
  overlay: HTMLElement | null
  captureVisibleTab?: () => Promise<Blob>
  captureDom?: DomCapture | false
  maskPrivate?: boolean
}

export type ReviewSnapshotCapture = {
  blob: Blob
  width: number
  height: number
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  origin?: { x: number; y: number }
  cssWidth?: number
  cssHeight?: number
  scale?: number
  live?: string
}

const getCaptureNodes = (overlay: HTMLElement | null) => [
  overlay,
  overlay?.querySelector<HTMLElement>("[data-mesurer-comments-layer]") ?? null,
  overlay?.querySelector<HTMLElement>(".mesurer-color-picker") ?? null,
  overlay?.querySelector<HTMLElement>(".mesurer-screenshot-preview") ?? null,
  overlay?.querySelector<HTMLElement>("[aria-label='Screenshot selection']") ?? null,
]

// Hide editable fields and explicitly private regions without changing their layout. Frames are
// masked whole because their contents may be cross-origin. This is defense in depth, not a
// substitute for reviewing the page; ordinary text, images and closed shadow roots may be private.
const maskPrivateNodes = (ownerDocument: Document) => {
  const masked: Array<{ node: HTMLElement; value: string; priority: string }> = []
  const visit = (root: Document | ShadowRoot) => {
    for (const node of root.querySelectorAll<HTMLElement>("input, textarea, select, [contenteditable]:not([contenteditable='false']), iframe, frame, [data-mesurer-private]")) {
      masked.push({ node, value: node.style.getPropertyValue("opacity"), priority: node.style.getPropertyPriority("opacity") })
      node.style.setProperty("opacity", "0", "important")
    }
    for (const element of root.querySelectorAll("*")) if (element.shadowRoot) visit(element.shadowRoot)
  }
  visit(ownerDocument)
  return () => {
    for (const { node, value, priority } of masked) {
      if (node.style.getPropertyValue("opacity") !== "0" || node.style.getPropertyPriority("opacity") !== "important") continue
      if (value) node.style.setProperty("opacity", value, priority)
      else node.style.removeProperty("opacity")
    }
  }
}

// A full-page capture includes content that has never entered the viewport. Ask the browser to
// load lazy images before measuring it, including images whose auto width is zero until decoded.
const prepareLazyImages = (ownerDocument: Document, ownerWindow: Window) => {
  const images: Array<{ node: HTMLImageElement; loading: string }> = []
  const visit = (root: Document | ShadowRoot) => {
    for (const node of root.querySelectorAll<HTMLImageElement>('img[loading="lazy" i]')) {
      if (node.closest("[data-mesurer-private]")) continue
      images.push({ node, loading: node.getAttribute("loading") ?? "lazy" })
      node.setAttribute("loading", "eager")
    }
    for (const node of root.querySelectorAll("*")) {
      if (node.shadowRoot && !node.closest("[data-mesurer-private]")) visit(node.shadowRoot)
    }
  }
  visit(ownerDocument)
  const ready = async () => {
    if (!images.length) return
    let timeout = 0
    try {
      await Promise.race([
        Promise.all(images.map(({ node }) => node.decode().catch(() => undefined))),
        new Promise<void>((resolve) => { timeout = ownerWindow.setTimeout(resolve, 8_000) }),
      ])
    } finally {
      ownerWindow.clearTimeout(timeout)
    }
  }
  const restore = () => {
    for (const { node, loading } of images) {
      if (node.getAttribute("loading") === "eager") node.setAttribute("loading", loading)
    }
  }
  return { ready, restore }
}

// Waits for Mesurer's own layers, just hidden, to be painted away. The page is in the background
// by now, behind the tab its review will open in, and a page there is given no frame: a short
// wait stands in for one, so saving does not stop until the page is come back to.
const waitForPaint = (ownerWindow: Window) =>
  new Promise<void>((resolve) => {
    ownerWindow.setTimeout(resolve, 120)
    if (ownerWindow.document.visibilityState === "hidden") return
    ownerWindow.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(() => resolve()))
  })

const getImageSize = async (blob: Blob) => {
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

export const captureReviewSnapshot = async ({
  ownerDocument,
  ownerWindow,
  overlay,
  captureVisibleTab,
  captureDom,
  maskPrivate = false,
}: ReviewSnapshotCaptureOptions): Promise<ReviewSnapshotCapture> => {
  const restore = hideNodesForCapture(getCaptureNodes(overlay))
  const restorePrivate = maskPrivate ? maskPrivateNodes(ownerDocument) : () => {}
  const lazyImages = prepareLazyImages(ownerDocument, ownerWindow)
  try {
    await lazyImages.ready()
    await waitForPaint(ownerWindow)
    const capture = captureVisibleTab ?? (() => captureVisibleTabPng(ownerDocument, ownerWindow))
    const domCapture = captureDom === false
      ? undefined
      : captureDom ?? (__MESURER_SNAPDOM_CAPTURE__
      ? async (document: Document, window: Window) => {
          const { captureDocumentWithSnapdom } = await import("./capture/snapdom")
          return captureDocumentWithSnapdom(document, window, { maskPrivate })
        }
      : undefined)
    let captured: CapturedReviewImage | null = null
    if (domCapture) {
      try {
        captured = await domCapture(ownerDocument, ownerWindow)
      } catch {
        // Fall back to browser capture when DOM serialization cannot handle page content.
      }
    }
    // A picture of the tab is of the tab in front, which is not this page while it is behind.
    if (!captured && ownerDocument.visibilityState === "hidden") throw new Error("Page not in view")
    const blob = captured?.blob ?? await capture()
    const size = await getImageSize(blob)
    return {
      blob,
      ...size,
      mimeType: blob.type === "image/jpeg" || blob.type === "image/webp" ? blob.type : "image/png",
      ...(captured ? {
        origin: captured.origin,
        cssWidth: captured.cssWidth,
        cssHeight: captured.cssHeight,
        scale: captured.scale,
        ...(captured.live ? { live: captured.live } : {}),
      } : { origin: { x: ownerWindow.scrollX, y: ownerWindow.scrollY }, scale: 1 }),
    }
  } finally {
    lazyImages.restore()
    restorePrivate()
    restore()
  }
}
