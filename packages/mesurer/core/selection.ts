import { MIN_MULTI_TARGET_SIZE } from "./constants"
import {
  getBodyElementsCached,
  getFrameToken,
  getRectFromDomCached,
} from "./dom"
import { rectsOverlap } from "./geometry"
import { pickMultiTargets, pickPointTarget, pickSingleTarget } from "./targets"
import type { Point, Rect } from "./types"

const getOverlayHost = (overlayNode: HTMLDivElement | null) => {
  if (!overlayNode) return null
  const rootNode = overlayNode.getRootNode()
  return rootNode.nodeType === 11 ? (rootNode as ShadowRoot).host : null
}

const isOverlayElement = (
  element: HTMLElement,
  overlayNode: HTMLDivElement | null,
  overlayHost: Element | null
) => {
  if (overlayNode && overlayNode.contains(element)) return true
  if (overlayHost && element === overlayHost) return true
  return false
}

const getDeepestElementAt = (
  element: Element,
  point: Point,
): Element => {
  let current = element
  const HTMLElementConstructor =
    element.ownerDocument.defaultView?.HTMLElement ?? HTMLElement
  while (current instanceof HTMLElementConstructor && current.shadowRoot) {
    const nested = current.shadowRoot.elementFromPoint(point.x, point.y)
    if (!nested || nested === current) break
    current = nested
  }
  return current
}

export const getTargetElement = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
) => {
  const overlayHost = getOverlayHost(overlayNode)

  if (overlayNode) {
    const previous = overlayNode.style.pointerEvents
    overlayNode.style.pointerEvents = "none"
    const elements = ownerDocument.elementsFromPoint(point.x, point.y)
    overlayNode.style.pointerEvents = previous

    for (const rawElement of elements) {
      const element = getDeepestElementAt(rawElement, point)
      if (!(element instanceof (ownerDocument.defaultView?.HTMLElement ?? HTMLElement))) continue
      if (isOverlayElement(element, overlayNode, overlayHost)) continue
      if (element === ownerDocument.body || element === ownerDocument.documentElement)
        continue
      const rect = element.getBoundingClientRect()
      if (rect.width <= 2 || rect.height <= 2) continue
      return element
    }
    return null
  }

  const elements = ownerDocument.elementsFromPoint(point.x, point.y)
  for (const rawElement of elements) {
    const element = getDeepestElementAt(rawElement, point)
    if (!(element instanceof (ownerDocument.defaultView?.HTMLElement ?? HTMLElement))) continue
    if (isOverlayElement(element, overlayNode, overlayHost)) continue
    if (element === ownerDocument.body || element === ownerDocument.documentElement)
      continue
    const rect = element.getBoundingClientRect()
    if (rect.width <= 2 || rect.height <= 2) continue
    return element
  }
  return null
}

export const getShiftClickTarget = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
) => {
  const overlayHost = getOverlayHost(overlayNode)
  const elements = ownerDocument.elementsFromPoint(point.x, point.y)
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = getDeepestElementAt(elements[i], point)
    if (!(element instanceof (ownerDocument.defaultView?.HTMLElement ?? HTMLElement))) continue
    if (isOverlayElement(element, overlayNode, overlayHost)) continue
    if (element === ownerDocument.body || element === ownerDocument.documentElement)
      continue
    const rect = element.getBoundingClientRect()
    if (rect.width <= 2 || rect.height <= 2) continue
    return element
  }
  return null
}

export const getSnappedClickTarget = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  snapEnabled: boolean,
  ownerDocument: Document = document,
) => {
  if (!snapEnabled) return getTargetElement(point, overlayNode, ownerDocument)
  const probeRect: Rect = {
    left: point.x - 20,
    top: point.y - 20,
    width: 40,
    height: 40,
  }
  const entries = getSelectionEntries(probeRect, overlayNode, ownerDocument)
  return (
    pickPointTarget(point, entries) ??
    pickSingleTarget(probeRect, point, entries) ??
    getTargetElement(point, overlayNode, ownerDocument)
  )
}

export const getElementsInRect = (
  rect: Rect,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
): HTMLElement[] => {
  const entries = getSelectionEntries(rect, overlayNode, ownerDocument)
  if (entries.length === 0) return []
  return pickMultiTargets(rect, entries)
}

export const getSelectionEntries = (
  rect: Rect,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
) => {
  const overlayHost = getOverlayHost(overlayNode)
  const frame = getFrameToken()
  const key = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(
    rect.width
  )}:${Math.round(rect.height)}`
  if (
    frame === cachedSelectionFrame &&
    cachedSelectionKey === key &&
    cachedOverlayNode === overlayNode &&
    cachedSelectionDocument === ownerDocument
  ) {
    return cachedSelectionEntries
  }
  const minLeft = rect.left - 1
  const minTop = rect.top - 1
  const maxRight = rect.left + rect.width + 1
  const maxBottom = rect.top + rect.height + 1
  const elements = getBodyElementsCached(ownerDocument)
  const entries = elements
    .map((element) => ({ element, rect: getRectFromDomCached(element) }))
    .filter(({ element, rect: elementRect }) => {
      if (isOverlayElement(element, overlayNode, overlayHost)) return false
      if (element === ownerDocument.body || element === ownerDocument.documentElement)
        return false
      if (
        elementRect.width < MIN_MULTI_TARGET_SIZE ||
        elementRect.height < MIN_MULTI_TARGET_SIZE
      ) {
        return false
      }
      if (elementRect.left > maxRight || elementRect.top > maxBottom)
        return false
      if (elementRect.left + elementRect.width < minLeft) return false
      if (elementRect.top + elementRect.height < minTop) return false
      return rectsOverlap(rect, elementRect)
    })

  cachedSelectionFrame = frame
  cachedSelectionKey = key
  cachedOverlayNode = overlayNode
  cachedSelectionDocument = ownerDocument
  cachedSelectionEntries = entries
  return entries
}

let cachedSelectionFrame = -1
let cachedSelectionKey = ""
let cachedSelectionEntries: Array<{ element: HTMLElement; rect: Rect }> = []
let cachedOverlayNode: HTMLDivElement | null = null
let cachedSelectionDocument: Document | null = null

export type SelectionEntriesCache = {
  key: string
  entries: Array<{ element: HTMLElement; rect: Rect }>
  overlayNode: HTMLDivElement | null
  frame: number
}

const getSelectionCacheKey = (rect: Rect) =>
  `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(
    rect.width
  )}:${Math.round(rect.height)}`

export const getSelectionEntriesCached = (
  rect: Rect,
  overlayNode: HTMLDivElement | null,
  cache: SelectionEntriesCache,
  ownerDocument: Document = document,
) => {
  const frame = getFrameToken()
  const key = getSelectionCacheKey(rect)
  if (
    cache.key === key &&
    cache.overlayNode === overlayNode &&
    cache.frame === frame
  ) {
    return cache.entries
  }
  const entries = getSelectionEntries(rect, overlayNode, ownerDocument)
  cache.key = key
  cache.overlayNode = overlayNode
  cache.frame = frame
  cache.entries = entries
  return entries
}

export const getElementsInRectCached = (
  rect: Rect,
  overlayNode: HTMLDivElement | null,
  cache: SelectionEntriesCache,
  ownerDocument: Document = document,
) => {
  const entries = getSelectionEntriesCached(rect, overlayNode, cache, ownerDocument)
  if (entries.length === 0) return []
  return pickMultiTargets(rect, entries)
}
