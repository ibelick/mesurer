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
// Along its edge, a toolbar this close to a corner sits right in it.
export const CORNER_PIN = 16
// A free toolbar pushed this far lengthwise into a wall turns the other way, so reaching a wall
// turns it wherever it was grabbed, not only once the pointer itself gets to the wall's zone.
// It turns back when the pointer lets off the wall, so brushing one changes nothing for good.
export const PUSH_TURN = 40
// From there the corner's pull fades out up to this distance, so the toolbar is drawn into a
// corner and comes away from one without a dead stretch or a jump.
export const CORNER_EASE_DISTANCE = 96
// Within this radius of a screen corner a dragged toolbar glues to no edge at all, so approaching a
// corner never picks horizontal or vertical. Released there, it glues to that corner.
export const CORNER_RADIUS = 120

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

// A glued toolbar settles on the nearest of its edge's three spots, so it never flies past a
// corner it was left next to, nor into one from the middle.
export const dockAlignFor = (side: ToolbarSide, point: Point, size: Size, viewport: Size): DockAlign => {
  const [at, length, span] = isVerticalToolbarSide(side)
    ? [point.y, size.height, viewport.height]
    : [point.x, size.width, viewport.width]
  const start = TOOLBAR_DOCK_MARGIN
  const end = span - length - TOOLBAR_DOCK_MARGIN
  // Halfway between a corner and the middle is where the nearer of the two changes.
  const reach = (end - start) / 4
  return at - start <= reach ? "start" : end - at <= reach ? "end" : "center"
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

// Along a glued edge, a toolbar near either end is drawn to that corner: right in it when very
// close, then less and less. Both distances shrink with the room the toolbar has to slide in,
// so the middle of a short edge stays out of the corners' pull.
const pinnedAlong = (value: number, length: number, span: number) => {
  const start = TOOLBAR_DOCK_MARGIN
  const end = span - length - TOOLBAR_DOCK_MARGIN
  const nearStart = value - start <= end - value
  const edge = nearStart ? start : end
  const gap = nearStart ? value - start : end - value
  const ease = Math.min(CORNER_EASE_DISTANCE, (end - start) * 0.4)
  const pin = Math.min(CORNER_PIN, ease / 2)
  if (gap > ease) return value
  return Math.round(lerp(edge, value, smoothstep(clamp01((gap - pin) / (ease - pin)))))
}

// The screen corner the pointer is within CORNER_RADIUS of, if any.
const cornerAt = (pointer: Point, viewport: Size): { x: ToolbarSide; y: ToolbarSide } | null => {
  const x = pointer.x < viewport.width / 2 ? "left" : "right"
  const y = pointer.y < viewport.height / 2 ? "top" : "bottom"
  const cornerX = x === "left" ? 0 : viewport.width
  const cornerY = y === "top" ? 0 : viewport.height
  return Math.hypot(pointer.x - cornerX, pointer.y - cornerY) <= CORNER_RADIUS ? { x, y } : null
}

// The edge and end a free toolbar released in a corner glues to: a standing one takes the side of
// that corner, a flat one its top or bottom, at the end nearest the corner.
export const cornerDropFor = (
  pointer: Point,
  upright: boolean,
  viewport: Size,
): { side: ToolbarSide; align: DockAlign } | null => {
  const corner = cornerAt(pointer, viewport)
  if (!corner) return null
  const nearStart = upright ? pointer.y < viewport.height / 2 : pointer.x < viewport.width / 2
  return { side: upright ? corner.x : corner.y, align: nearStart ? "start" : "end" }
}

// The screen is cut into fixed, invisible zones, and the zone under the pointer alone decides
// where a dragged toolbar belongs: a band ZONE_DEPTH deep along each edge, and the free middle
// (null). The left and right zones stand the toolbar up and the top and bottom ones lay it flat;
// the middle changes nothing, so a toolbar pulled off an edge keeps the orientation it had there.
// The bands stop short of the corners, which belong to neither edge. A toolbar already on an edge
// (`held`) stays on it for as long as the pointer is in that edge's band, corner included, which
// runs ZONE_HOLD deeper.
export const toolbarZone = (pointer: Point, viewport: Size, held: ToolbarSide | null = null): ToolbarSide | null => {
  const gap = (edge: ToolbarSide) => edgeGap(edge, pointer, { width: 0, height: 0 }, viewport)
  if (held && gap(held) <= ZONE_DEPTH + ZONE_HOLD) return held
  // A corner belongs to neither edge: approaching it, a free toolbar keeps its orientation.
  if (cornerAt(pointer, viewport)) return null
  return nearestEdge(gap, ZONE_DEPTH)?.side ?? null
}

// Places a dragged toolbar in snap mode. The toolbar is held at the spot it was grabbed, so it
// stays under the pointer through a glue, a turn and a release, and it takes the edge of the
// zone the pointer is in, whichever way it came. `upright` is whether it stands vertical now,
// which the free middle keeps unless the toolbar is pushed into a wall, `pushed` whether a wall
// is what turned it, and `glued` the edge it is on. `grab` is the held spot as fractions along the toolbar's length
// and across its thickness; `sizeFor` gives the toolbar's size standing up or lying flat.
export const dragToolbarPosition = ({
  pointer,
  grab,
  glued,
  upright: wasUpright,
  pushed: wasPushed = false,
  latched: wasLatched = false,
  sizeFor,
  viewport,
}: {
  pointer: Point
  grab: { along: number; across: number }
  glued: ToolbarSide | null
  upright: boolean
  pushed?: boolean
  latched?: boolean
  sizeFor: (upright: boolean) => Size
  viewport: Size
}): { side: ToolbarSide | null; upright: boolean; pushed: boolean; latched: boolean; position: Point } => {
  const zone = toolbarZone(pointer, viewport, glued)
  // Pulled off an edge, a toolbar stays free until the pointer is back in the middle, so letting
  // go in a corner does not hop it onto the other edge of that corner. Entering from the middle
  // glues as usual. A corner is not the middle: the toolbar stays free through it.
  const middle = zone === null && !cornerAt(pointer, viewport)
  const latched = wasLatched ? !middle : glued !== null && zone !== glued
  const side = latched ? null : zone
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
  let pushed = !side && wasPushed
  if (!side) {
    // In the free middle, a toolbar pushed into a wall turns, unless the other way would be
    // pushed back just as much. Turned by a wall, it turns back once it would clear that wall.
    const turns = pushed
      ? hold(!upright).push <= 0
      : hold(upright).push > PUSH_TURN && hold(!upright).push <= PUSH_TURN
    if (turns) {
      upright = !upright
      pushed = !pushed
    }
  }
  const { size, held } = hold(upright)
  if (!side) return { side: null, upright, pushed, latched, position: freeToolbarPosition(held, size, viewport) }
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
  return { side, upright, pushed, latched, position }
}
