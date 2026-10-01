import type { Point, Rect } from "./types"

export const COMPOSITE_CONTROL_SELECTOR = "button, a[href], label, summary, [role='button']"

const getCaretRangeAtPoint = (point: Point, ownerDocument: Document) => {
  const documentWithCaret = ownerDocument as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode?: Node; offset?: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const range = documentWithCaret.caretRangeFromPoint?.(point.x, point.y)
  if (range) return range
  const position = documentWithCaret.caretPositionFromPoint?.(point.x, point.y)
  if (!position?.offsetNode) return null
  const nextRange = ownerDocument.createRange()
  const offset = position.offset ?? 0
  nextRange.setStart(position.offsetNode, offset)
  nextRange.setEnd(position.offsetNode, offset)
  return nextRange
}

/** Text node rendered at point that is a direct child of a composite control (e.g. button label). */
export const getDirectTextRangeAtPoint = (
  control: Element,
  point: Point,
  ownerDocument: Document,
): Range | null => {
  const range = getCaretRangeAtPoint(point, ownerDocument)
  if (!range) return null
  const container = range.startContainer
  if (container.nodeType !== Node.TEXT_NODE) return null
  if (container.parentElement !== control) return null
  const text = container.nodeValue ?? ""
  const trimmed = text.trim()
  if (!trimmed) return null
  const textRange = ownerDocument.createRange()
  const start = text.indexOf(trimmed)
  if (start < 0) return null
  textRange.setStart(container, start)
  textRange.setEnd(container, start + trimmed.length)
  return textRange
}

export const getRectFromRange = (range: Range): Rect | null => {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  )
  if (rects.length === 0) {
    const fallback = range.getBoundingClientRect()
    if (fallback.width <= 0 || fallback.height <= 0) return null
    return {
      left: fallback.left,
      top: fallback.top,
      width: fallback.width,
      height: fallback.height,
    }
  }
  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return { left, top, width: right - left, height: bottom - top }
}
