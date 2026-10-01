import { getDirectTextRangeAtPoint, getRectFromRange } from "./inspect-text"
import { withOverlayHitTesting } from "./overlay-hit-test"
import { denormalizeRect, getViewportSize, normalizeRect } from "./geometry"
import { isLayoutContainerDisplay } from "./layout-details"
import type { InspectMeasurement, InspectTextAnchor, LayoutGap, Measurement, Rect } from "./types"
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

export type InspectMeasurementOptions = {
  mode?: "default" | "text"
  point?: { x: number; y: number }
  overlayNode?: HTMLDivElement | null
}

export const getInspectMeasurement = (
  element: Element,
  ownerWindow: Window = window,
  options?: InspectMeasurementOptions,
): InspectMeasurement => {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element) ?? ownerWindow.getComputedStyle(element)
  const elementRect = element.getBoundingClientRect()
  const textPoint = options?.mode === "text" ? options.point : undefined
  const textRange = textPoint
    ? withOverlayHitTesting(options?.overlayNode ?? null, () =>
        getDirectTextRangeAtPoint(element, textPoint, element.ownerDocument),
      )
    : null
  const textRect = textRange ? getRectFromRange(textRange) : null
  const textAnchor: InspectTextAnchor | null = textRect && textRange?.startContainer.nodeType === Node.TEXT_NODE
    ? {
        node: textRange.startContainer as Text,
        start: textRange.startOffset,
        end: textRange.endOffset,
      }
    : null
  const selectionRect = textRect ?? {
    left: elementRect.left,
    top: elementRect.top,
    width: elementRect.width,
    height: elementRect.height,
  }
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
    left: elementRect.left + padding.left,
    top: elementRect.top + padding.top,
    width: Math.max(0, elementRect.width - padding.left - padding.right),
    height: Math.max(0, elementRect.height - padding.top - padding.bottom),
  }
  const marginRect = {
    left: elementRect.left - margin.left,
    top: elementRect.top - margin.top,
    width: elementRect.width + margin.left + margin.right,
    height: elementRect.height + margin.top + margin.bottom,
  }
  return {
    id: createId(),
    rect: selectionRect,
    paddingRect,
    marginRect,
    padding,
    margin,
    gap: readLayoutGap(style),
    label: getElementLabel(element),
    elementRef: element,
    textAnchor,
  }
}

export const refreshInspectMeasurement = (
  measurement: InspectMeasurement,
  ownerWindow: Window,
): InspectMeasurement => {
  const anchor = measurement.textAnchor
  if (anchor?.node.isConnected) {
    const range = anchor.node.ownerDocument.createRange()
    try {
      range.setStart(anchor.node, anchor.start)
      range.setEnd(anchor.node, anchor.end)
    } catch {
      return measurement
    }
    const rect = getRectFromRange(range)
    if (!rect) return measurement
    return { ...measurement, rect }
  }
  if (!measurement.elementRef || !isConnectedElement(measurement.elementRef)) return measurement
  const next = getInspectMeasurement(measurement.elementRef, ownerWindow)
  return { ...next, id: measurement.id }
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
