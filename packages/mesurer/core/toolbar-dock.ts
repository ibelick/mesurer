import type { ToolbarSide } from "./persistence"

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }

export const TOOLBAR_DOCK_MARGIN = 16
// Distances to an edge: from the pointer while dragging, from the toolbar itself at rest.
// Within this distance the toolbar glues to the edge.
export const SNAP_DISTANCE = 48
// Within this distance the edge's indicator appears, so the glue is anticipated.
export const PREVIEW_DISTANCE = 96
// Once glued, the toolbar only releases after the pointer has pulled this far from the edge.
export const RELEASE_DISTANCE = 128

const SNAP_SIDES: ToolbarSide[] = ["top", "bottom", "left", "right"]

// Anchored surfaces open toward the room on the bar's side of the screen.
export const surfaceAlignFor = (barX: number, viewportWidth: number): "left" | "right" =>
  barX < viewportWidth / 2 ? "left" : "right"

export const isVerticalToolbarSide = (side: ToolbarSide | null) => side === "left" || side === "right"

// Pins the toolbar to an edge. The coordinate along that edge is kept and clamped,
// so a glued toolbar slides along its edge: horizontally for top/bottom, vertically for left/right.
export const dockedToolbarPosition = ({
  side,
  point,
  size,
  viewport,
}: {
  side: ToolbarSide
  point: Point
  size: Size
  viewport: Size
}): Point => {
  if (side === "top" || side === "bottom") {
    const maxX = viewport.width - size.width - TOOLBAR_DOCK_MARGIN
    return {
      x: Math.max(TOOLBAR_DOCK_MARGIN, Math.min(point.x, maxX)),
      y: side === "top" ? TOOLBAR_DOCK_MARGIN : viewport.height - size.height - TOOLBAR_DOCK_MARGIN,
    }
  }
  const maxY = viewport.height - size.height - TOOLBAR_DOCK_MARGIN
  return {
    x: side === "left" ? TOOLBAR_DOCK_MARGIN : viewport.width - size.width - TOOLBAR_DOCK_MARGIN,
    y: Math.max(TOOLBAR_DOCK_MARGIN, Math.min(point.y, maxY)),
  }
}

// Where a toolbar sits when glued to an edge: centered along that edge.
export const centeredDockPosition = (
  side: ToolbarSide,
  size: Size,
  viewport: Size,
) =>
  dockedToolbarPosition({
    side,
    point: side === "top" || side === "bottom"
      ? { x: Math.round((viewport.width - size.width) / 2), y: 0 }
      : { x: 0, y: Math.round((viewport.height - size.height) / 2) },
    size,
    viewport,
  })

const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smoothstep = (t: number) => t * t * (3 - 2 * t)

// Where a glued toolbar sits along its edge: in the middle, or pinned to the corner at either end.
// It also opens, closes and resizes from there.
export type DockAlign = "start" | "center" | "end"

// A toolbar close to the edge across from its glue belongs in that corner.
export const dockAlignFor = (side: ToolbarSide, point: Point, size: Size, viewport: Size): DockAlign => {
  const [start, end]: ToolbarSide[] = isVerticalToolbarSide(side) ? ["top", "bottom"] : ["left", "right"]
  if (edgeGap(start, point, size, viewport) <= SNAP_DISTANCE) return "start"
  if (edgeGap(end, point, size, viewport) <= SNAP_DISTANCE) return "end"
  return "center"
}

export const alignedDockPosition = (side: ToolbarSide, align: DockAlign, size: Size, viewport: Size): Point => {
  if (align === "center") return centeredDockPosition(side, size, viewport)
  // Aimed past the end, the dock clamps it into the corner.
  const far = align === "start" ? -Infinity : Infinity
  return dockedToolbarPosition({ side, point: { x: far, y: far }, size, viewport })
}

// Distance between the toolbar and the given viewport edge.
export const edgeGap = (
  side: ToolbarSide,
  point: Point,
  size: Size,
  viewport: Size,
) => {
  switch (side) {
    case "top":
      return point.y
    case "bottom":
      return viewport.height - (point.y + size.height)
    case "left":
      return point.x
    case "right":
      return viewport.width - (point.x + size.width)
  }
}

const nearestEdge = (gapTo: (side: ToolbarSide) => number, within: number) => {
  let nearest: { side: ToolbarSide; gap: number } | null = null
  for (const side of SNAP_SIDES) {
    const gap = gapTo(side)
    if (gap <= within && (!nearest || gap < nearest.gap)) nearest = { side, gap }
  }
  return nearest
}

// Where a toolbar at rest belongs in snap mode: one left close to an edge glues there, in the
// middle or in a corner, and a glued toolbar keeps that spot whatever its size. `align` is the
// spot it already holds; without it the spot is read from where the toolbar is. `glueSize` gives
// the size it will have on a side.
export const snapToolbarPosition = ({
  point,
  size,
  viewport,
  glued,
  align,
  glueSize,
}: {
  point: Point
  size: Size
  viewport: Size
  glued: ToolbarSide | null
  align?: DockAlign
  glueSize?: (side: ToolbarSide) => Size | undefined
}): { side: ToolbarSide | null; align: DockAlign; position: Point } => {
  const side = glued ?? nearestEdge((edge) => edgeGap(edge, point, size, viewport), SNAP_DISTANCE)?.side
  if (!side) return { side: null, align: "center", position: point }
  const settledSize = glued ? size : (glueSize?.(side) ?? size)
  // The spot is read from the toolbar as it lies now, not as it will once turned to the edge.
  const settledAlign = (glued && align) || dockAlignFor(side, point, size, viewport)
  return { side, align: settledAlign, position: alignedDockPosition(side, settledAlign, settledSize, viewport) }
}

// Along a glued edge, a toolbar near either end is pinned to that corner; the pin eases off
// between the snap and release distances, so leaving the corner never jumps.
const pinnedAlong = (value: number, length: number, span: number) => {
  const start = TOOLBAR_DOCK_MARGIN
  const end = span - length - TOOLBAR_DOCK_MARGIN
  const nearStart = value - start <= end - value
  const edge = nearStart ? start : end
  const gap = nearStart ? value - start : end - value
  if (gap > RELEASE_DISTANCE) return value
  return lerp(edge, value, smoothstep(clamp01((gap - SNAP_DISTANCE) / (RELEASE_DISTANCE - SNAP_DISTANCE))))
}

// Keeps a free toolbar this far inside the viewport while it is dragged.
const DRAG_INSET = 8

// Decides where a dragged toolbar goes in snap mode. The toolbar is held at the spot it was
// grabbed, so it stays under the pointer through a glue, a turn and a release. Edges are judged
// from the pointer: close to one the toolbar glues to it and hugs it, and it only lets go once
// the pointer has pulled well away. `grab` is the held spot as fractions along the toolbar's
// length and across its thickness; `sizeFor` gives the toolbar's size on a side (null when free).
export const dragToolbarPosition = ({
  pointer,
  grab,
  glued,
  sizeFor,
  viewport,
}: {
  pointer: Point
  grab: { along: number; across: number }
  glued: ToolbarSide | null
  sizeFor: (side: ToolbarSide | null) => Size
  viewport: Size
}): { side: ToolbarSide | null; position: Point; preview: ToolbarSide | null } => {
  const gapTo = (side: ToolbarSide) => edgeGap(side, pointer, { width: 0, height: 0 }, viewport)
  const nearest = nearestEdge(gapTo, PREVIEW_DISTANCE)
  const side =
    glued && gapTo(glued) <= RELEASE_DISTANCE
      ? glued
      : nearest && nearest.gap <= SNAP_DISTANCE
        ? nearest.side
        : null

  const size = sizeFor(side)
  const upright = isVerticalToolbarSide(side)
  const held = {
    x: Math.round(pointer.x - (upright ? grab.across : grab.along) * size.width),
    y: Math.round(pointer.y - (upright ? grab.along : grab.across) * size.height),
  }
  if (!side) {
    return {
      side: null,
      position: {
        x: Math.max(DRAG_INSET, Math.min(held.x, viewport.width - size.width - DRAG_INSET)),
        y: Math.max(DRAG_INSET, Math.min(held.y, viewport.height - size.height - DRAG_INSET)),
      },
      preview: nearest?.side ?? null,
    }
  }
  // Glued: it slides along the edge, and comes off it with the pointer rather than staying behind.
  const docked = dockedToolbarPosition({ side, point: held, size, viewport })
  // Along the edge the toolbar follows the pinned spot; across it, the pointer can only pull it off.
  const along = upright
    ? pinnedAlong(held.y, size.height, viewport.height)
    : pinnedAlong(held.x, size.width, viewport.width)
  const pull = side === "top" || side === "left" ? Math.max : Math.min
  const position = upright
    ? { x: pull(docked.x, held.x), y: along }
    : { x: along, y: pull(docked.y, held.y) }
  return { side, position, preview: null }
}
