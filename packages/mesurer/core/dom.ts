import { denormalizeRect, getViewportSize, normalizeRect } from "./geometry"
import type { InspectMeasurement, Measurement, Rect } from "./types"
import { createId } from "./utils"

const getElementLabel = (element: HTMLElement) => {
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ""
  const className = element.className
    ? `.${element.className.toString().split(" ")[0]}`
    : ""
  return `${tag}${id}${className}`
}

const parseEdge = (value: string) => Number.parseFloat(value) || 0

export const getRectFromDom = (element: Element): Rect => {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
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

let cachedElements: HTMLElement[] = []
let cachedFrame = -1
let cachedDocument: Document | null = null

export const getFrameToken = () => {
  if (typeof performance === "undefined") return 0
  return Math.floor(performance.now() / 16)
}

export const getBodyElementsCached = (ownerDocument: Document = document) => {
  const frame = getFrameToken()
  if (frame === cachedFrame && cachedDocument === ownerDocument && cachedElements.length > 0) {
    return cachedElements
  }
  cachedFrame = frame
  cachedDocument = ownerDocument
  const elements: HTMLElement[] = []
  const HTMLElementConstructor =
    ownerDocument.defaultView?.HTMLElement ?? HTMLElement
  const visit = (root: Document | ShadowRoot | HTMLElement) => {
    const walker = ownerDocument.createTreeWalker(root, 1)
    let node = walker.nextNode()
    while (node) {
      if (node instanceof HTMLElementConstructor) {
        elements.push(node)
        if (node.shadowRoot) visit(node.shadowRoot)
      }
      node = walker.nextNode()
    }
  }
  if (ownerDocument.body) visit(ownerDocument.body)
  cachedElements = elements
  return cachedElements
}

export const getInspectMeasurement = (
  element: HTMLElement,
  ownerWindow: Window = window,
): InspectMeasurement => {
  const rect = element.getBoundingClientRect()
  const style = ownerWindow.getComputedStyle(element)
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
    left: rect.left + padding.left,
    top: rect.top + padding.top,
    width: Math.max(0, rect.width - padding.left - padding.right),
    height: Math.max(0, rect.height - padding.top - padding.bottom),
  }
  const marginRect = {
    left: rect.left - margin.left,
    top: rect.top - margin.top,
    width: rect.width + margin.left + margin.right,
    height: rect.height + margin.top + margin.bottom,
  }
  return {
    id: createId(),
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    paddingRect,
    marginRect,
    padding,
    margin,
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
  if (measurement.elementRef && ownerDocument.contains(measurement.elementRef)) {
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
