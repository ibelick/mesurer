import { CLICK_CYCLE_THRESHOLD, MIN_MULTI_TARGET_SIZE } from "./constants"
import {
  getAccessibleDocumentElements,
  getAccessibleFrameDocument,
  getDocumentTreeVersion,
  getFrameToken,
  getRectFromDomCached,
} from "./dom"
import { rectsOverlap } from "./geometry"
import { pickMultiTargets, pickPointTarget } from "./targets"
import type { Point, Rect } from "./types"

const SELECTION_BUCKET_SIZE = 160
const MAX_INDEXED_BUCKET_SPAN = 32

type SelectionEntry = { element: Element; rect: Rect }
type SelectionIndex = {
  frame: number
  version: number
  buckets: Map<string, SelectionEntry[]>
  large: SelectionEntry[]
}

const selectionIndexes = new WeakMap<Document, SelectionIndex>()

const bucketCoordinate = (value: number) => Math.floor(value / SELECTION_BUCKET_SIZE)
const bucketKey = (x: number, y: number) => `${x}:${y}`

const getSelectionIndex = (ownerDocument: Document): SelectionIndex => {
  const frame = getFrameToken()
  const version = getDocumentTreeVersion()
  const cached = selectionIndexes.get(ownerDocument)
  if (cached?.frame === frame && cached.version === version) return cached

  const buckets = new Map<string, SelectionEntry[]>()
  const large: SelectionEntry[] = []
  for (const element of getAccessibleDocumentElements(ownerDocument)) {
    if (element === element.ownerDocument.body || element === element.ownerDocument.documentElement) continue
    const rect = getRectFromDomCached(element)
    if (rect.width <= 2 || rect.height <= 2) continue

    const minX = bucketCoordinate(rect.left)
    const minY = bucketCoordinate(rect.top)
    const maxX = bucketCoordinate(rect.left + rect.width)
    const maxY = bucketCoordinate(rect.top + rect.height)
    const entry = { element, rect }
    if (maxX - minX > MAX_INDEXED_BUCKET_SPAN || maxY - minY > MAX_INDEXED_BUCKET_SPAN) {
      large.push(entry)
      continue
    }
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = bucketKey(x, y)
        const bucket = buckets.get(key)
        if (bucket) bucket.push(entry)
        else buckets.set(key, [entry])
      }
    }
  }

  const index = { frame, version, buckets, large }
  selectionIndexes.set(ownerDocument, index)
  return index
}

const getIndexedCandidates = (rect: Rect, ownerDocument: Document) => {
  const index = getSelectionIndex(ownerDocument)
  const candidates = [...index.large]
  const seen = new Set<Element>(candidates.map(({ element }) => element))
  const minX = bucketCoordinate(rect.left)
  const minY = bucketCoordinate(rect.top)
  const maxX = bucketCoordinate(rect.left + rect.width)
  const maxY = bucketCoordinate(rect.top + rect.height)
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (const entry of index.buckets.get(bucketKey(x, y)) ?? []) {
        if (seen.has(entry.element)) continue
        seen.add(entry.element)
        candidates.push(entry)
      }
    }
  }
  return candidates
}

export type ClickCycleState = {
  point: Point
  index: number
  stack: Element[]
}

const getOverlayHost = (overlayNode: HTMLDivElement | null) => {
  if (!overlayNode) return null
  const rootNode = overlayNode.getRootNode()
  return rootNode.nodeType === 11 ? (rootNode as ShadowRoot).host : null
}

const isOverlayElement = (
  element: Element,
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
  const childDocument = getAccessibleFrameDocument(element)
  if (childDocument) {
    const frameRect = element.getBoundingClientRect()
    const childPoint = {
      x: point.x - frameRect.left - element.clientLeft,
      y: point.y - frameRect.top - element.clientTop,
    }
    const child = childDocument.elementFromPoint(childPoint.x, childPoint.y)
    if (child && child !== childDocument.body && child !== childDocument.documentElement) {
      return getDeepestElementAt(child, childPoint)
    }
  }
  let current = element
  const ElementConstructor = element.ownerDocument.defaultView?.Element ?? Element
  while (current instanceof ElementConstructor && current.shadowRoot) {
    const nested = current.shadowRoot.elementFromPoint(point.x, point.y)
    if (!nested || nested === current) break
    current = nested
  }
  return current
}

const isSelectableElement = (
  element: Element,
  overlayNode: HTMLDivElement | null,
  overlayHost: Element | null,
): boolean => {
  const elementDocument = element.ownerDocument
  const ElementConstructor = elementDocument.defaultView?.Element ?? Element
  if (!(element instanceof ElementConstructor)) return false
  if (isOverlayElement(element, overlayNode, overlayHost)) return false
  if (element === elementDocument.body || element === elementDocument.documentElement) {
    return false
  }
  const rect = element.getBoundingClientRect()
  if (rect.width <= 2 || rect.height <= 2) return false
  return true
}

const readElementsFromPoint = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document,
) => {
  if (overlayNode) {
    const previous = overlayNode.style.pointerEvents
    overlayNode.style.pointerEvents = "none"
    const elements = ownerDocument.elementsFromPoint(point.x, point.y)
    overlayNode.style.pointerEvents = previous
    return elements
  }
  return ownerDocument.elementsFromPoint(point.x, point.y)
}

export const getElementsAtPoint = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
) => {
  const overlayHost = getOverlayHost(overlayNode)
  const elements: Element[] = []
  const seen = new Set<Element>()

  for (const rawElement of readElementsFromPoint(point, overlayNode, ownerDocument)) {
    const element = getDeepestElementAt(rawElement, point)
    if (!isSelectableElement(element, overlayNode, overlayHost)) continue
    if (seen.has(element)) continue
    seen.add(element)
    elements.push(element)
  }

  return elements
}

export const getTargetElement = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
) => {
  return getElementsAtPoint(point, overlayNode, ownerDocument)[0] ?? null
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
    if (!isSelectableElement(element, overlayNode, overlayHost)) continue
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
  const elements = getElementsAtPoint(point, overlayNode, ownerDocument)
  return getSnappedTargetFromElements(point, elements, overlayNode, snapEnabled, ownerDocument)
}

const getSnappedTargetFromElements = (
  point: Point,
  elements: Element[],
  overlayNode: HTMLDivElement | null,
  snapEnabled: boolean,
  ownerDocument: Document,
) => {
  const directTarget = elements[0] ?? null
  if (!snapEnabled) return directTarget
  if (directTarget && directTarget.ownerDocument !== ownerDocument) return directTarget
  const probeRect: Rect = {
    left: point.x - 20,
    top: point.y - 20,
    width: 40,
    height: 40,
  }
  const entries = getSelectionEntries(probeRect, overlayNode, ownerDocument)
  return pickPointTarget(point, entries) ?? directTarget
}

const isSameClickSpot = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) <= CLICK_CYCLE_THRESHOLD &&
  Math.abs(a.y - b.y) <= CLICK_CYCLE_THRESHOLD

export const getCycledClickTarget = (
  point: Point,
  overlayNode: HTMLDivElement | null,
  snapEnabled: boolean,
  ownerDocument: Document = document,
  cycle: ClickCycleState | null = null,
): { target: Element | null; cycle: ClickCycleState | null } => {
  if (
    cycle &&
    isSameClickSpot(point, cycle.point) &&
    cycle.stack.length > 0
  ) {
    const nextIndex = (cycle.index + 1) % cycle.stack.length
    return {
      target: cycle.stack[nextIndex] ?? null,
      cycle: {
        point,
        index: nextIndex,
        stack: cycle.stack,
      },
    }
  }

  const stack = getElementsAtPoint(point, overlayNode, ownerDocument)
  const initial = getSnappedTargetFromElements(
    point,
    stack,
    overlayNode,
    snapEnabled,
    ownerDocument,
  )
  if (!initial) return { target: null, cycle: null }

  const cycleStack = stack.includes(initial) ? stack : [initial, ...stack]
  const index = cycleStack.indexOf(initial)

  return {
    target: initial,
    cycle: {
      point,
      index: index >= 0 ? index : 0,
      stack: cycleStack,
    },
  }
}

export const getElementsInRect = (
  rect: Rect,
  overlayNode: HTMLDivElement | null,
  ownerDocument: Document = document,
): Element[] => {
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
  const candidates = getIndexedCandidates(rect, ownerDocument)
  const entries: Array<{ element: Element; rect: Rect }> = []
  for (const { element, rect: elementRect } of candidates) {
    if (isOverlayElement(element, overlayNode, overlayHost)) continue
    if (element === element.ownerDocument.body || element === element.ownerDocument.documentElement) continue
    if (elementRect.width < MIN_MULTI_TARGET_SIZE || elementRect.height < MIN_MULTI_TARGET_SIZE) continue
    if (elementRect.left > maxRight || elementRect.top > maxBottom) continue
    if (elementRect.left + elementRect.width < minLeft || elementRect.top + elementRect.height < minTop) continue
    if (rectsOverlap(rect, elementRect)) entries.push({ element, rect: elementRect })
  }

  cachedSelectionFrame = frame
  cachedSelectionKey = key
  cachedOverlayNode = overlayNode
  cachedSelectionDocument = ownerDocument
  cachedSelectionEntries = entries
  return entries
}

let cachedSelectionFrame = -1
let cachedSelectionKey = ""
let cachedSelectionEntries: Array<{ element: Element; rect: Rect }> = []
let cachedOverlayNode: HTMLDivElement | null = null
let cachedSelectionDocument: Document | null = null

export type SelectionEntriesCache = {
  key: string
  entries: Array<{ element: Element; rect: Rect }>
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
