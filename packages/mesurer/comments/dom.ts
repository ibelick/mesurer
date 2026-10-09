import { getRectFromDom } from "../core/dom"
import { getAccessibleFrameDocument, getOwnFrameDocuments } from "../core/document-tree"
import { isResponsivePreview } from "../core/responsive"
import { getTargetElement } from "../core/selection"
import { createId } from "../core/utils"
import { getElementSelector } from "../core/selector"
import type { CommentTarget, Point, Rect } from "../core/types"

const MAX_HTML_LENGTH = 4000
const MAX_TEXT_LENGTH = 240

const getElementName = (element: Element) => element.tagName.toLowerCase()

const getElementAttributes = (element: Element) => {
  const attributes: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name.startsWith("on") || attribute.name === "style") continue
    attributes[attribute.name] = attribute.value.slice(0, MAX_TEXT_LENGTH)
  }
  return attributes
}

const getFramePath = (element: Element) => {
  const path: string[] = []
  const shadowPaths: string[][] = []
  let view = element.ownerDocument.defaultView
  // A preview's own frame is Mesurer's, not the page's: the path stops at the page in it.
  while (view?.frameElement && !isResponsivePreview(view)) {
    const frame = view.frameElement
    path.unshift(getElementSelector(frame))
    shadowPaths.unshift(getShadowPath(frame))
    view = frame.ownerDocument.defaultView
  }
  return { path, shadowPaths }
}

// The window of the page the element is part of: the preview it is in, or the page itself.
const getPageView = (element: Element, ownerWindow: Window) => {
  let view = element.ownerDocument.defaultView ?? ownerWindow
  while (view !== ownerWindow && !isResponsivePreview(view) && view.frameElement) {
    view = view.frameElement.ownerDocument.defaultView ?? ownerWindow
  }
  return view
}

// A page's address without the place in it.
const pageAddress = (url: string) => url.split("#")[0]

// The page in the preview a comment was left in: the one of that size, or failing that of that
// width, while it still shows the page the comment is about.
const getPreviewDocument = (target: CommentTarget, ownerDocument: Document) => {
  const previews = getOwnFrameDocuments(ownerDocument).filter(
    ({ defaultView }) =>
      defaultView &&
      isResponsivePreview(defaultView) &&
      defaultView.innerWidth === target.viewport?.width &&
      (!target.url || pageAddress(defaultView.location.href) === pageAddress(target.url)),
  )
  return previews.find(({ defaultView }) => defaultView?.innerHeight === target.viewport?.height) ?? previews[0] ?? null
}

const getShadowPath = (element: Element) => {
  const path: string[] = []
  let root: Node = element.getRootNode()
  while (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in root) {
    const host = (root as ShadowRoot).host
    const tag = getElementName(host)
    if (host.id) {
      path.unshift(`${tag}#${CSS.escape(host.id)}`)
    } else if (host.parentElement) {
      path.unshift(getElementSelector(host))
    } else {
      const parent = host.parentNode
      const siblings = parent && "children" in parent
        ? Array.from(parent.children).filter(
        (sibling) => sibling.tagName === host.tagName,
          )
        : []
      const index = siblings.indexOf(host)
      const selector = siblings.length > 1 ? `${tag}:nth-of-type(${index + 1})` : tag
      path.unshift(`:scope > ${selector}`)
    }
    root = host.getRootNode()
  }
  return path
}

const getStyles = (element: Element, ownerWindow: Window) => {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element) ?? ownerWindow.getComputedStyle(element)
  return [
    `display: ${style.display}`,
    `position: ${style.position}`,
    `width: ${style.width}`,
    `height: ${style.height}`,
    `padding: ${style.padding}`,
    `margin: ${style.margin}`,
    `font: ${style.font}`,
    `color: ${style.color}`,
    `background: ${style.backgroundColor}`,
  ].join("\n")
}

export const captureCommentTarget = (
  element: Element,
  point: Point,
  ownerWindow: Window = window,
): CommentTarget => {
  const html = element.outerHTML.replace(/\s+/g, " ").trim()
  const rect = getRectFromDom(element)
  const frame = getFramePath(element)
  const pageView = getPageView(element, ownerWindow)
  return {
    url: pageView.location.href,
    viewport: { width: pageView.innerWidth, height: pageView.innerHeight },
    ...(isResponsivePreview(pageView) ? { preview: true } : null),
    selector: getElementSelector(element),
    framePath: frame.path,
    frameShadowPaths: frame.shadowPaths,
    shadowPath: getShadowPath(element),
    tagName: getElementName(element),
    textSnippet: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH),
    htmlPreview: html.slice(0, MAX_HTML_LENGTH),
    attributes: getElementAttributes(element),
    styles: getStyles(element, ownerWindow),
    rect,
    anchor: {
      x: rect.width > 0 ? Math.max(0, Math.min(1, (point.x - rect.left) / rect.width)) : 0.5,
      y: rect.height > 0 ? Math.max(0, Math.min(1, (point.y - rect.top) / rect.height)) : 0.5,
    },
    documentPoint: {
      x: point.x + ownerWindow.scrollX,
      y: point.y + ownerWindow.scrollY,
    },
  }
}

export const getCommentTargetAtPoint = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
) => getTargetElement(point, overlayNode, ownerDocument)

export const createCommentId = () => `comment-${createId()}`

export const resolveCommentTarget = (
  target: CommentTarget,
  ownerDocument: Document = document,
) => {
  try {
    let targetDocument = ownerDocument
    if (target.preview) {
      // Left in a preview: it is found there again while one of its size is open.
      const previewDocument = getPreviewDocument(target, ownerDocument)
      if (!previewDocument) return null
      targetDocument = previewDocument
    }
    for (const [index, frameSelector] of (target.framePath ?? []).entries()) {
      let frameRoot: Document | ShadowRoot = targetDocument
      for (const hostSelector of target.frameShadowPaths?.[index] ?? []) {
        const host: Element | null = frameRoot.querySelector(hostSelector)
        if (!host?.shadowRoot) return null
        frameRoot = host.shadowRoot
      }
      const frame = frameRoot.querySelector(frameSelector)
      if (!frame) return null
      const childDocument = getAccessibleFrameDocument(frame)
      if (!childDocument) return null
      targetDocument = childDocument
    }
    let targetRoot: Document | ShadowRoot = targetDocument
    for (const hostSelector of target.shadowPath ?? []) {
      const host: Element | null = targetRoot.querySelector(hostSelector)
      if (!host?.shadowRoot) return null
      targetRoot = host.shadowRoot
    }
    const candidates = Array.from(targetRoot.querySelectorAll(target.selector))
    const element = candidates.find((candidate) => candidate.parentNode === targetRoot) ?? candidates[0]
    if (!element || getElementName(element) !== target.tagName) return null
    return element
  } catch {
    return null
  }
}

export const isRectEqual = (a: Rect, b: Rect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

export const COMMENT_CHROME_SELECTOR = [
  "[data-mesurer-comment-pin]",
  "[data-mesurer-comment-popover]",
  "[data-mesurer-comment-overflow-menu]",
  "[data-mesurer-comment-delete-confirmation]",
  "[data-mesurer-comment-hover-card]",
].join(", ")

export const eventPathHits = (event: Event, selector: string) =>
  event.composedPath().some((node) => {
    const candidate = node as { closest?: (value: string) => Element | null }
    return Boolean(candidate.closest?.(selector))
  })
