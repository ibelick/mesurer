import { getRectFromDom } from "../core/dom"
import { getAccessibleFrameDocument } from "../core/document-tree"
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
  let frame = element.ownerDocument.defaultView?.frameElement
  while (frame) {
    path.unshift(getElementSelector(frame))
    frame = frame.ownerDocument.defaultView?.frameElement
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
  return {
    selector: getElementSelector(element),
    framePath: getFramePath(element),
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

export const getCommentTargetKey = (target: CommentTarget) =>
  `${(target.framePath ?? []).join("/")}::${target.selector}`

export const resolveCommentTarget = (
  target: CommentTarget,
  ownerDocument: Document = document,
) => {
  try {
    let targetDocument = ownerDocument
    for (const frameSelector of target.framePath ?? []) {
      const frame = targetDocument.querySelector(frameSelector)
      if (!frame) return null
      const childDocument = getAccessibleFrameDocument(frame)
      if (!childDocument) return null
      targetDocument = childDocument
    }
    const element = targetDocument.querySelector(target.selector)
    if (!element || getElementName(element) !== target.tagName) return null
    return element
  } catch {
    return null
  }
}

export const isRectEqual = (a: Rect, b: Rect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
