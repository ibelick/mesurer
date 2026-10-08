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
  margin = TOOLBAR_DOCK_MARGIN,
}: {
  side: ToolbarSide
  point: Point
  size: Size
  viewport: Size
  margin?: number
}): Point => {
  if (side === "top" || side === "bottom") {
    const maxX = viewport.width - size.width - margin
    return {
      x: Math.max(margin, Math.min(point.x, maxX)),
      y: side === "top" ? margin : viewport.height - size.height - margin,
    }
  }
  const maxY = viewport.height - size.height - margin
  return {
    x: side === "left" ? margin : viewport.width - size.width - margin,
    y: Math.max(margin, Math.min(point.y, maxY)),
  }
}

// Where a toolbar sits when glued to an edge: centered along that edge.
export const centeredDockPosition = (
  side: ToolbarSide,
  size: Size,
  viewport: Size,
  margin = TOOLBAR_DOCK_MARGIN,
) =>
  dockedToolbarPosition({
    side,
    point: side === "top" || side === "bottom"
      ? { x: Math.round((viewport.width - size.width) / 2), y: 0 }
      : { x: 0, y: Math.round((viewport.height - size.height) / 2) },
    size,
    viewport,
    margin,
  })

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

// Where a toolbar at rest belongs in snap mode: a glued toolbar sits in the middle of its edge,
// whatever its size, and one left close to an edge glues there. `glueSize` gives the size it
// will have on a side.
export const snapToolbarPosition = ({
  point,
  size,
  viewport,
  glued,
  glueSize,
  margin = TOOLBAR_DOCK_MARGIN,
}: {
  point: Point
  size: Size
  viewport: Size
  glued: ToolbarSide | null
  glueSize?: (side: ToolbarSide) => Size | undefined
  margin?: number
}): { side: ToolbarSide | null; position: Point } => {
  if (glued) return { side: glued, position: centeredDockPosition(glued, size, viewport, margin) }
  const nearest = nearestEdge((side) => edgeGap(side, point, size, viewport), SNAP_DISTANCE)
  if (!nearest) return { side: null, position: point }
  return {
    side: nearest.side,
    position: centeredDockPosition(nearest.side, glueSize?.(nearest.side) ?? size, viewport, margin),
  }
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
  margin = TOOLBAR_DOCK_MARGIN,
}: {
  pointer: Point
  grab: { along: number; across: number }
  glued: ToolbarSide | null
  sizeFor: (side: ToolbarSide | null) => Size
  viewport: Size
  margin?: number
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
  const docked = dockedToolbarPosition({ side, point: held, size, viewport, margin })
  const position = {
    top: { x: docked.x, y: Math.max(docked.y, held.y) },
    bottom: { x: docked.x, y: Math.min(docked.y, held.y) },
    left: { x: Math.max(docked.x, held.x), y: docked.y },
    right: { x: Math.min(docked.x, held.x), y: docked.y },
  }[side]
  return { side, position, preview: null }
}
