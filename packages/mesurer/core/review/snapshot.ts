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
  try {
    await waitForPaint(ownerWindow)
    const capture = captureVisibleTab ?? (() => captureVisibleTabPng(ownerDocument, ownerWindow))
    const domCapture = captureDom === false
      ? undefined
      : captureDom ?? (__MESURER_SNAPDOM_CAPTURE__
      ? async (document: Document, window: Window) => {
          const { captureDocumentWithSnapdom } = await import("./capture/snapdom")
          return captureDocumentWithSnapdom(document, window)
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
    restorePrivate()
    restore()
  }
}
