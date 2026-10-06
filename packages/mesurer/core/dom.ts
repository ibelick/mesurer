import { COMPOSITE_CONTROL_SELECTOR, getDirectTextRangeAtPoint, getRectFromRange } from "./inspect-text"
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

const readBoxEdges = (style: CSSStyleDeclaration, prefix: "padding" | "margin") => ({
  top: parseEdge(style[`${prefix}Top` as keyof CSSStyleDeclaration] as string),
  right: parseEdge(style[`${prefix}Right` as keyof CSSStyleDeclaration] as string),
  bottom: parseEdge(style[`${prefix}Bottom` as keyof CSSStyleDeclaration] as string),
  left: parseEdge(style[`${prefix}Left` as keyof CSSStyleDeclaration] as string),
})

const hasInspectableSpacing = (style: CSSStyleDeclaration) => {
  const padding = readBoxEdges(style, "padding")
  const margin = readBoxEdges(style, "margin")
  const hasPadding = padding.top > 0 || padding.right > 0 || padding.bottom > 0 || padding.left > 0
  const hasMargin = margin.top > 0 || margin.right > 0 || margin.bottom > 0 || margin.left > 0
  return hasPadding || hasMargin || readLayoutGap(style) !== null
}

const hasLayoutContainerSpacing = (style: CSSStyleDeclaration) => {
  if (!isLayoutContainerDisplay(style.display)) return false
  const padding = readBoxEdges(style, "padding")
  const hasPadding = padding.top > 0 || padding.right > 0 || padding.bottom > 0 || padding.left > 0
  return hasPadding || readLayoutGap(style) !== null
}

const TYPOGRAPHIC_LEAF_SELECTOR =
  "strong, em, span, small, i, b, cite, dfn, mark, sub, sup, time, var, p, h1, h2, h3, h4, h5, h6"

const isTypographicLeaf = (element: Element) => element.matches(TYPOGRAPHIC_LEAF_SELECTOR)

const readSpacingFromElement = (layoutElement: Element, ownerWindow: Window) => {
  const view = layoutElement.ownerDocument.defaultView ?? ownerWindow
  const style = view.getComputedStyle(layoutElement)
  return {
    style,
    padding: readBoxEdges(style, "padding"),
    margin: readBoxEdges(style, "margin"),
    gap: readLayoutGap(style),
  }
}

export const readInspectBoxSpacing = (layoutElement: Element, ownerWindow: Window) => {
  const { padding, margin, gap } = readSpacingFromElement(layoutElement, ownerWindow)
  return { padding, margin, gap }
}

const compositeControlFor = (element: Element, body: HTMLElement) => {
  const composite = element.closest(COMPOSITE_CONTROL_SELECTOR)
  if (!composite || composite === body) return null
  return composite
}

/** Box model for CSS details: prefer controls and inner layout containers over outer fixture chrome. */
export const resolveInspectLayoutElement = (
  element: Element,
  ownerWindow: Window,
  textAnchor?: InspectTextAnchor | null,
): Element => {
  const view = element.ownerDocument.defaultView ?? ownerWindow
  const body = element.ownerDocument.body

  const fromSelection = compositeControlFor(element, body)
  if (fromSelection) return fromSelection

  if (textAnchor) {
    let node: Node | null = textAnchor.node
    while (node && node !== body) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(COMPOSITE_CONTROL_SELECTOR)) {
        return node as Element
      }
      node = node.parentElement
    }
  }

  const ownStyle = view.getComputedStyle(element)
  if (hasLayoutContainerSpacing(ownStyle)) return element
  if (!isTypographicLeaf(element) && hasInspectableSpacing(ownStyle)) return element

  let layoutContainer: Element | null = null
  let paddedAncestor: Element | null = null
  let current: Element | null = element.parentElement
  while (current && current !== body) {
    const style = view.getComputedStyle(current)
    if (!layoutContainer && hasLayoutContainerSpacing(style)) layoutContainer = current
    if (!paddedAncestor && hasInspectableSpacing(style)) paddedAncestor = current
    current = current.parentElement
  }

  return layoutContainer ?? paddedAncestor ?? element
}

export const getRectFromDom = getViewportRect

const toViewportRect = (element: Element, rect: Rect): Rect => {
  const localElementRect = element.getBoundingClientRect()
  const viewportElementRect = getViewportRect(element)
  return {
    left: viewportElementRect.left + rect.left - localElementRect.left,
    top: viewportElementRect.top + rect.top - localElementRect.top,
    width: rect.width,
    height: rect.height,
  }
}

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
  const elementRect = element.getBoundingClientRect()
  const textPoint = options?.mode === "text" ? options.point : undefined
  const textControl = compositeControlFor(element, element.ownerDocument.body) ?? element
  const textRange = textPoint
    ? withOverlayHitTesting(options?.overlayNode ?? null, () =>
        getDirectTextRangeAtPoint(textControl, textPoint, element.ownerDocument),
      )
    : null
  const localTextRect = textRange ? getRectFromRange(textRange) : null
  const textRect = localTextRect ? toViewportRect(element, localTextRect) : null
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
  const layoutElement = resolveInspectLayoutElement(element, ownerWindow, textAnchor)
  const { padding, margin, gap } = readSpacingFromElement(layoutElement, ownerWindow)
  const layoutRect = getViewportRect(layoutElement)
  const paddingRect = {
    left: layoutRect.left + padding.left,
    top: layoutRect.top + padding.top,
    width: Math.max(0, layoutRect.width - padding.left - padding.right),
    height: Math.max(0, layoutRect.height - padding.top - padding.bottom),
  }
  const marginRect = {
    left: layoutRect.left - margin.left,
    top: layoutRect.top - margin.top,
    width: layoutRect.width + margin.left + margin.right,
    height: layoutRect.height + margin.top + margin.bottom,
  }
  return {
    id: createId(),
    rect: selectionRect,
    paddingRect,
    marginRect,
    padding,
    margin,
    gap,
    label: getElementLabel(element),
    elementRef: element,
    layoutSpacingElementRef: layoutElement,
    textAnchor,
  }
}

export const refreshInspectMeasurement = (
  measurement: InspectMeasurement,
  ownerWindow: Window,
): InspectMeasurement => {
  const anchor = measurement.textAnchor
  if (anchor?.node.isConnected) {
    const element = measurement.elementRef
    const range = anchor.node.ownerDocument.createRange()
    try {
      range.setStart(anchor.node, anchor.start)
      range.setEnd(anchor.node, anchor.end)
    } catch {
      return measurement
    }
    const localRect = getRectFromRange(range)
    if (!localRect) return measurement
    if (!element) return { ...measurement, rect: localRect }
    const rect = toViewportRect(element, localRect)
    const layoutElement = resolveInspectLayoutElement(element, ownerWindow, anchor)
    const { padding, margin, gap } = readInspectBoxSpacing(layoutElement, ownerWindow)
    const layoutRect = getViewportRect(layoutElement)
    const paddingRect = {
      left: layoutRect.left + padding.left,
      top: layoutRect.top + padding.top,
      width: Math.max(0, layoutRect.width - padding.left - padding.right),
      height: Math.max(0, layoutRect.height - padding.top - padding.bottom),
    }
    const marginRect = {
      left: layoutRect.left - margin.left,
      top: layoutRect.top - margin.top,
      width: layoutRect.width + margin.left + margin.right,
      height: layoutRect.height + margin.top + margin.bottom,
    }
    return {
      ...measurement,
      rect,
      padding,
      margin,
      gap,
      paddingRect,
      marginRect,
      layoutSpacingElementRef: layoutElement,
    }
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
