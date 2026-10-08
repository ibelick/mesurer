import { TOOLBAR_SIDES, type ToolbarSide } from "./persistence"

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
// Where the toolbar rests, as it is saved: its position, the edge it is glued to and its spot
// on it, and whether it stands vertical. Without them they are read from the position.
export type ToolbarPlacement = Point & { edge?: ToolbarSide | null; align?: DockAlign; vertical?: boolean }

export const TOOLBAR_DOCK_MARGIN = 16
// Distances to an edge: from the pointer while dragging, from the toolbar itself at rest.
// Within this distance the toolbar glues to the edge.
export const SNAP_DISTANCE = 48
// How deep each edge's zone runs, from the pointer while dragging. Deeper than a glued toolbar
// (its 40px and the dock margin), so a pointer anywhere on one is inside its zone.
export const ZONE_DEPTH = 72
// The zone the toolbar is in runs this much deeper, so resting the pointer on a zone's line
// does not turn the toolbar back and forth.
export const ZONE_HOLD = 8
// A free toolbar pushed this far lengthwise into a wall turns the other way, so reaching a wall
// turns it wherever it was grabbed, not only once the pointer itself gets to the wall's zone.
export const PUSH_TURN = 40
// A toolbar pinned in a corner eases off it up to this distance.
export const CORNER_EASE_DISTANCE = 128

// Keeps a free toolbar this far inside the viewport while it is dragged.
const DRAG_INSET = 8


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
  for (const side of TOOLBAR_SIDES) {
    const gap = gapTo(side)
    if (gap <= within && (!nearest || gap < nearest.gap)) nearest = { side, gap }
  }
  return nearest
}

// Keeps a free toolbar on screen, where the drag left it.
export const freeToolbarPosition = (point: Point, size: Size, viewport: Size): Point => ({
  x: Math.max(DRAG_INSET, Math.min(point.x, viewport.width - size.width - DRAG_INSET)),
  y: Math.max(DRAG_INSET, Math.min(point.y, viewport.height - size.height - DRAG_INSET)),
})

// Where a toolbar at rest belongs in snap mode. A glued toolbar keeps its spot on its edge
// whatever its size: `align` is the spot it holds, read from where it is when missing. A free
// one (null) stays where it is. When the edge is not known yet (undefined), it is read from the
// toolbar itself: close to an edge it glues there.
export const snapToolbarPosition = ({
  point,
  size,
  viewport,
  glued,
  align,
}: {
  point: Point
  size: Size
  viewport: Size
  glued: ToolbarSide | null | undefined
  align?: DockAlign
}): { side: ToolbarSide | null; align: DockAlign; position: Point } => {
  const side =
    glued === undefined
      ? nearestEdge((edge) => edgeGap(edge, point, size, viewport), SNAP_DISTANCE)?.side
      : glued
  if (!side) return { side: null, align: "center", position: freeToolbarPosition(point, size, viewport) }
  const settledAlign = (glued && align) || dockAlignFor(side, point, size, viewport)
  return { side, align: settledAlign, position: alignedDockPosition(side, settledAlign, size, viewport) }
}

// Along a glued edge, a toolbar near either end is pinned to that corner; the pin eases off
// past the snap distance, so leaving the corner never jumps. Both distances shrink with the
// room the toolbar has to slide in, so the middle of a short edge stays out of the corners' pull.
const pinnedAlong = (value: number, length: number, span: number) => {
  const start = TOOLBAR_DOCK_MARGIN
  const end = span - length - TOOLBAR_DOCK_MARGIN
  const nearStart = value - start <= end - value
  const edge = nearStart ? start : end
  const gap = nearStart ? value - start : end - value
  const ease = Math.min(CORNER_EASE_DISTANCE, (end - start) * 0.4)
  const pin = Math.min(SNAP_DISTANCE, ease / 2)
  if (gap > ease) return value
  return lerp(edge, value, smoothstep(clamp01((gap - pin) / (ease - pin))))
}

// The screen is cut into fixed, invisible zones, and the zone under the pointer alone decides
// where a dragged toolbar belongs: a band ZONE_DEPTH deep along each edge, split on the
// diagonal where two bands meet in a corner, and the free middle (null). The left and right
// zones stand the toolbar up and the top and bottom ones lay it flat; the middle changes nothing,
// so a toolbar pulled off an edge keeps the orientation it had there. `held` is the zone the
// toolbar is in, which runs ZONE_HOLD deeper.
export const toolbarZone = (pointer: Point, viewport: Size, held: ToolbarSide | null = null): ToolbarSide | null =>
  nearestEdge(
    (edge) => edgeGap(edge, pointer, { width: 0, height: 0 }, viewport) - (edge === held ? ZONE_HOLD : 0),
    ZONE_DEPTH,
  )?.side ?? null

// Places a dragged toolbar in snap mode. The toolbar is held at the spot it was grabbed, so it
// stays under the pointer through a glue, a turn and a release, and it takes the edge of the
// zone the pointer is in, whichever way it came. `upright` is whether it stands vertical now,
// which the free middle keeps unless the toolbar is pushed into a wall, and `glued` the edge it
// is on. `grab` is the held spot as fractions along the toolbar's length
// and across its thickness; `sizeFor` gives the toolbar's size standing up or lying flat.
export const dragToolbarPosition = ({
  pointer,
  grab,
  glued,
  upright: wasUpright,
  sizeFor,
  viewport,
}: {
  pointer: Point
  grab: { along: number; across: number }
  glued: ToolbarSide | null
  upright: boolean
  sizeFor: (upright: boolean) => Size
  viewport: Size
}): { side: ToolbarSide | null; upright: boolean; position: Point } => {
  const side = toolbarZone(pointer, viewport, glued)
  // Where the pointer holds the toolbar standing up or lying flat, and how far that would push
  // it lengthwise through a wall.
  const hold = (standing: boolean) => {
    const size = sizeFor(standing)
    const held = {
      x: Math.round(pointer.x - (standing ? grab.across : grab.along) * size.width),
      y: Math.round(pointer.y - (standing ? grab.along : grab.across) * size.height),
    }
    const [start, length, span] = standing
      ? [held.y, size.height, viewport.height]
      : [held.x, size.width, viewport.width]
    return { size, held, push: Math.max(DRAG_INSET - start, start + length - (span - DRAG_INSET)) }
  }
  let upright = side ? isVerticalToolbarSide(side) : wasUpright
  // In the free middle, a toolbar pushed into a wall turns, unless the other way would be pushed
  // back just as much: it would only turn again.
  if (!side && hold(upright).push > PUSH_TURN && hold(!upright).push <= PUSH_TURN) upright = !upright
  const { size, held } = hold(upright)
  if (!side) return { side: null, upright, position: freeToolbarPosition(held, size, viewport) }
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
  return { side, upright, position }
}
