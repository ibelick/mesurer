import { GUIDE_SNAP_DISTANCE } from "./constants"
import { getBodyElementsCached, getRectFromDomCached } from "./dom"
import type { Guide, Point } from "./types"

export const getSnapArrowPoint = (params: {
  point: Point
  snapArrowsEnabled: boolean
  overlayNode: HTMLDivElement | null
  guides: Guide[]
  scrollOffset: Point
  document?: Document
}): Point => {
  if (!params.snapArrowsEnabled) return params.point

  const ownerDocument = params.document ?? document
  const { scrollOffset } = params
  const view = {
    x: params.point.x - scrollOffset.x,
    y: params.point.y - scrollOffset.y,
  }

  let bestX = view.x
  let bestY = view.y
  let bestXDist = GUIDE_SNAP_DISTANCE + 1
  let bestYDist = GUIDE_SNAP_DISTANCE + 1
  let cornerSnap: Point | null = null
  let cornerDist = GUIDE_SNAP_DISTANCE + 1

  const elements = getBodyElementsCached(ownerDocument)
  for (const element of elements) {
    if (!(element instanceof (ownerDocument.defaultView?.HTMLElement ?? HTMLElement))) continue
    if (params.overlayNode && params.overlayNode.contains(element)) continue
    if (element === ownerDocument.body || element === ownerDocument.documentElement) continue
    const rect = getRectFromDomCached(element)
    if (rect.width <= 2 || rect.height <= 2) continue

    const right = rect.left + rect.width
    const bottom = rect.top + rect.height

    if (view.y >= rect.top - GUIDE_SNAP_DISTANCE && view.y <= bottom + GUIDE_SNAP_DISTANCE) {
      for (const x of [rect.left, rect.left + rect.width / 2, right]) {
        const distance = Math.abs(x - view.x)
        if (distance <= GUIDE_SNAP_DISTANCE && distance < bestXDist) {
          bestX = x
          bestXDist = distance
        }
      }
    }

    if (view.x >= rect.left - GUIDE_SNAP_DISTANCE && view.x <= right + GUIDE_SNAP_DISTANCE) {
      for (const y of [rect.top, rect.top + rect.height / 2, bottom]) {
        const distance = Math.abs(y - view.y)
        if (distance <= GUIDE_SNAP_DISTANCE && distance < bestYDist) {
          bestY = y
          bestYDist = distance
        }
      }
    }

    const corners: Point[] = [
      { x: rect.left, y: rect.top },
      { x: right, y: rect.top },
      { x: rect.left, y: bottom },
      { x: right, y: bottom },
    ]
    for (const corner of corners) {
      const distance = Math.hypot(corner.x - view.x, corner.y - view.y)
      if (distance <= GUIDE_SNAP_DISTANCE && distance < cornerDist) {
        cornerSnap = corner
        cornerDist = distance
      }
    }
  }

  for (const guide of params.guides) {
    if (guide.orientation === "vertical") {
      const distance = Math.abs(guide.position - view.x)
      if (distance <= GUIDE_SNAP_DISTANCE && distance < bestXDist) {
        bestX = guide.position
        bestXDist = distance
      }
    } else {
      const distance = Math.abs(guide.position - view.y)
      if (distance <= GUIDE_SNAP_DISTANCE && distance < bestYDist) {
        bestY = guide.position
        bestYDist = distance
      }
    }
  }

  if (cornerSnap) {
    return {
      x: cornerSnap.x + scrollOffset.x,
      y: cornerSnap.y + scrollOffset.y,
    }
  }

  return {
    x: (bestXDist <= GUIDE_SNAP_DISTANCE ? bestX : view.x) + scrollOffset.x,
    y: (bestYDist <= GUIDE_SNAP_DISTANCE ? bestY : view.y) + scrollOffset.y,
  }
}
