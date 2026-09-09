import { GUIDE_SNAP_DISTANCE, MIN_SINGLE_TARGET_SIZE } from "./constants"
import { getBodyElementsCached, getRectFromDomCached } from "./dom"
import { getViewportSize, rectContainsPoint } from "./geometry"
import type { Guide, Point, Rect } from "./types"

export const getGuideRect = (guide: Guide, ownerWindow: Window = window): Rect => {
  const viewport = getViewportSize(ownerWindow)
  const position = Math.round(guide.position)
  return guide.orientation === "vertical"
    ? { left: position, top: 0, width: 0, height: viewport.height }
    : { left: 0, top: position, width: viewport.width, height: 0 }
}

export const getGuideDistance = (guide: Guide, point: Point) =>
  guide.orientation === "vertical"
    ? Math.abs(guide.position - point.x)
    : Math.abs(guide.position - point.y)

export const getSnapGuidePosition = (params: {
  orientation: Guide["orientation"]
  point: Point
  snapGuidesEnabled: boolean
  overlayNode: HTMLDivElement | null
  guides: Guide[]
  draggingGuideId: string | null
  document?: Document
}) => {
  const ownerDocument = params.document ?? document
  const { orientation, point, snapGuidesEnabled, overlayNode, guides } = params
  if (!snapGuidesEnabled) {
    return orientation === "vertical" ? point.x : point.y
  }

  const elements = getBodyElementsCached(ownerDocument)
  let bestValue = orientation === "vertical" ? point.x : point.y
  let bestDistance = GUIDE_SNAP_DISTANCE + 1

  for (const element of elements) {
    if (!(element instanceof (ownerDocument.defaultView?.HTMLElement ?? HTMLElement))) continue
    if (overlayNode && overlayNode.contains(element)) continue
    if (element === ownerDocument.body || element === ownerDocument.documentElement)
      continue
    const rect = getRectFromDomCached(element)
    if (rect.width <= 2 || rect.height <= 2) continue
    if (orientation === "vertical") {
      if (
        point.x < rect.left - GUIDE_SNAP_DISTANCE ||
        point.x > rect.left + rect.width + GUIDE_SNAP_DISTANCE
      ) {
        continue
      }
    } else {
      if (
        point.y < rect.top - GUIDE_SNAP_DISTANCE ||
        point.y > rect.top + rect.height + GUIDE_SNAP_DISTANCE
      ) {
        continue
      }
    }
    const candidates =
      orientation === "vertical"
        ? [rect.left, rect.left + rect.width, rect.left + rect.width / 2]
        : [rect.top, rect.top + rect.height, rect.top + rect.height / 2]
    candidates.forEach((candidate) => {
      const distance =
        orientation === "vertical"
          ? Math.abs(candidate - point.x)
          : Math.abs(candidate - point.y)
      if (distance > GUIDE_SNAP_DISTANCE) return
      if (distance < bestDistance) {
        bestValue = candidate
        bestDistance = distance
      }
    })
  }

  guides.forEach((guide) => {
    if (guide.id === params.draggingGuideId) return
    const candidate = guide.position
    const distance =
      orientation === "vertical"
        ? Math.abs(candidate - point.x)
        : Math.abs(candidate - point.y)
    if (distance > GUIDE_SNAP_DISTANCE) return
    if (distance < bestDistance) {
      bestValue = candidate
      bestDistance = distance
    }
  })

  return bestDistance <= GUIDE_SNAP_DISTANCE
    ? bestValue
    : orientation === "vertical"
      ? point.x
      : point.y
}

export const getNearestElementToGuide = (params: {
  guide: Guide
  overlayNode: HTMLDivElement | null
}) => {
  const elements = getBodyElementsCached()
  const position = params.guide.position
  let bestElement: HTMLElement | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let bestArea = Number.POSITIVE_INFINITY

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue
    if (params.overlayNode && params.overlayNode.contains(element)) continue
    if (element === document.body || element === document.documentElement)
      continue
    const rect = getRectFromDomCached(element)
    if (
      rect.width < MIN_SINGLE_TARGET_SIZE ||
      rect.height < MIN_SINGLE_TARGET_SIZE
    )
      continue

    const distance =
      params.guide.orientation === "vertical"
        ? position < rect.left
          ? rect.left - position
          : position > rect.left + rect.width
            ? position - (rect.left + rect.width)
            : 0
        : position < rect.top
          ? rect.top - position
          : position > rect.top + rect.height
            ? position - (rect.top + rect.height)
            : 0

    const area = rect.width * rect.height
    if (
      distance < bestDistance ||
      (distance === bestDistance && area < bestArea)
    ) {
      bestDistance = distance
      bestArea = area
      bestElement = element
    }
  }

  return bestElement
}

export const getElementBetweenGuides = (params: {
  document: Document
  overlayNode: HTMLElement | null
  orientation: Guide["orientation"]
  start: number
  end: number
  pointer: Point
}) => {
  const min = Math.min(params.start, params.end)
  const max = Math.max(params.start, params.end)
  if (max - min < 1) return null

  const ownerDocument = params.document
  const overlayNode = params.overlayNode
  const elements = getBodyElementsCached(ownerDocument)
  const ElementConstructor = ownerDocument.defaultView?.HTMLElement ?? HTMLElement
  let bestElement: Element | null = null
  let bestArea = Number.POSITIVE_INFINITY

  for (const element of elements) {
    if (!(element instanceof ElementConstructor)) continue
    if (overlayNode && (overlayNode === element || overlayNode.contains(element))) {
      continue
    }
    if (element === ownerDocument.body || element === ownerDocument.documentElement) {
      continue
    }
    const rect = getRectFromDomCached(element)
    if (
      rect.width < MIN_SINGLE_TARGET_SIZE ||
      rect.height < MIN_SINGLE_TARGET_SIZE
    ) {
      continue
    }
    if (!rectContainsPoint(rect, params.pointer)) continue

    const overlap =
      params.orientation === "vertical"
        ? Math.min(rect.left + rect.width, max) - Math.max(rect.left, min)
        : Math.min(rect.top + rect.height, max) - Math.max(rect.top, min)
    if (overlap <= 0) continue

    const area = rect.width * rect.height
    if (area < bestArea) {
      bestElement = element
      bestArea = area
    }
  }

  return bestElement
}
