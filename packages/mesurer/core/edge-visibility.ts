import type { Rect } from "./types"

export type EdgeVisibility = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

const rangesOverlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(a2, b2) - Math.max(a1, b1) > 0

export const getEdgeVisibilityForRects = (rects: Rect[], epsilon = 1) => {
  const visibility: EdgeVisibility[] = rects.map(() => ({
    top: true,
    right: true,
    bottom: true,
    left: true,
  }))

  for (let i = 0; i < rects.length; i += 1) {
    const a = rects[i]
    const aRight = a.left + a.width
    const aBottom = a.top + a.height

    for (let j = i + 1; j < rects.length; j += 1) {
      const b = rects[j]
      const bRight = b.left + b.width
      const bBottom = b.top + b.height

      const overlapX = rangesOverlap(a.left, aRight, b.left, bRight)
      const overlapY = rangesOverlap(a.top, aBottom, b.top, bBottom)

      if (Math.abs(aRight - b.left) <= epsilon && overlapY) {
        visibility[i].right = false
        visibility[j].left = false
      }

      if (Math.abs(a.left - bRight) <= epsilon && overlapY) {
        visibility[i].left = false
        visibility[j].right = false
      }

      if (Math.abs(aBottom - b.top) <= epsilon && overlapX) {
        visibility[i].bottom = false
        visibility[j].top = false
      }

      if (Math.abs(a.top - bBottom) <= epsilon && overlapX) {
        visibility[i].top = false
        visibility[j].bottom = false
      }
    }
  }

  return visibility
}
