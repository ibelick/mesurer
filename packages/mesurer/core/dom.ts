import { denormalizeRect, getViewportSize, normalizeRect } from "./geometry"
import { isLayoutContainerDisplay } from "./layout-details"
import type { InspectMeasurement, LayoutGap, Measurement, Rect } from "./types"
import { createId } from "./utils"
import { getFrameToken, getViewportRect, isConnectedElement } from "./document-tree"

export {
  getAccessibleDocumentElements,
  getAccessibleFrameDocument,
  getBodyElementsCached,
  getDocumentTreeVersion,
  getFrameToken,
  getViewportRect,
  isConnectedElement,
  isIframeElement,
} from "./document-tree"

const getElementLabel = (element: Element) => {
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ""
  const className = element.className
    ? `.${element.className.toString().split(" ")[0]}`
    : ""
  return `${tag}${id}${className}`
}

const parseEdge = (value: string) => Number.parseFloat(value) || 0

const readLayoutGap = (style: CSSStyleDeclaration): LayoutGap | null => {
  if (!isLayoutContainerDisplay(style.display)) return null
  const row = parseEdge(style.rowGap)
  const column = parseEdge(style.columnGap)
  if (row === 0 && column === 0) return null
  return { row, column }
}

export const getRectFromDom = getViewportRect

let rectCacheFrame = -1
const rectCache = new Map<Element, Rect>()

export const getRectFromDomCached = (element: Element) => {
  const frame = getFrameToken()
  if (frame !== rectCacheFrame) {
    rectCacheFrame = frame
    rectCache.clear()
  }
  const cached = rectCache.get(element)
  if (cached) return cached
  const rect = getRectFromDom(element)
  rectCache.set(element, rect)
  return rect
}

export const getInspectMeasurement = (
  element: Element,
  ownerWindow: Window = window,
): InspectMeasurement => {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element) ?? ownerWindow.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const translatedRect = getViewportRect(element)
  const padding = {
    top: parseEdge(style.paddingTop),
    right: parseEdge(style.paddingRight),
    bottom: parseEdge(style.paddingBottom),
    left: parseEdge(style.paddingLeft),
  }
  const margin = {
    top: parseEdge(style.marginTop),
    right: parseEdge(style.marginRight),
    bottom: parseEdge(style.marginBottom),
    left: parseEdge(style.marginLeft),
  }
  const paddingRect = {
    left: translatedRect.left + padding.left,
    top: translatedRect.top + padding.top,
    width: Math.max(0, rect.width - padding.left - padding.right),
    height: Math.max(0, rect.height - padding.top - padding.bottom),
  }
  const marginRect = {
    left: translatedRect.left - margin.left,
    top: translatedRect.top - margin.top,
    width: rect.width + margin.left + margin.right,
    height: rect.height + margin.top + margin.bottom,
  }
  const gap = readLayoutGap(style)
  return {
    id: createId(),
    rect: {
      left: translatedRect.left,
      top: translatedRect.top,
      width: rect.width,
      height: rect.height,
    },
    paddingRect,
    marginRect,
    padding,
    margin,
    gap,
    label: getElementLabel(element),
    elementRef: element,
  }
}

export const updateMeasurementForResize = (
  measurement: Measurement,
  viewport = getViewportSize(),
  ownerDocument: Document = document,
): Measurement => {
  let rect = measurement.rect
  if (measurement.elementRef && isConnectedElement(measurement.elementRef)) {
    rect = getRectFromDom(measurement.elementRef)
  } else if (measurement.normalizedRect) {
    rect = denormalizeRect(measurement.normalizedRect, viewport)
  }

  return {
    ...measurement,
    rect,
    normalizedRect: normalizeRect(rect, viewport),
    originRect: undefined,
  }
}
