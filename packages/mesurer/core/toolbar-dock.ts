import type { ToolbarSide } from "./persistence"

export const TOOLBAR_DOCK_MARGIN = 16
// Within this distance from an edge the toolbar glues to it.
export const SNAP_DISTANCE = 48
// Within this distance the edge's indicator appears, so the glue is anticipated.
export const PREVIEW_DISTANCE = 96
// Once glued, the toolbar only releases after being pulled this far from the edge.
export const RELEASE_DISTANCE = 128

const SNAP_SIDES: ToolbarSide[] = ["top", "bottom", "left", "right"]

export const isVerticalToolbarSide = (side: ToolbarSide | null) => side === "left" || side === "right"

// Pins the toolbar to an edge. The coordinate along that edge is kept and clamped,
// so a glued toolbar slides along its edge: horizontally for top/bottom, vertically for left/right.
export const dockedToolbarPosition = ({
  side,
  point,
  width,
  height,
  viewportWidth,
  viewportHeight,
  margin = TOOLBAR_DOCK_MARGIN,
}: {
  side: ToolbarSide
  point: { x: number; y: number }
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  margin?: number
}): { x: number; y: number } => {
  if (side === "top" || side === "bottom") {
    const maxX = viewportWidth - width - margin
    return {
      x: Math.max(margin, Math.min(point.x, maxX)),
      y: side === "top" ? margin : viewportHeight - height - margin,
    }
  }
  const maxY = viewportHeight - height - margin
  return {
    x: side === "left" ? margin : viewportWidth - width - margin,
    y: Math.max(margin, Math.min(point.y, maxY)),
  }
}

// Where a toolbar sits when glued to an edge: centered along that edge.
export const centeredDockPosition = (
  side: ToolbarSide,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = TOOLBAR_DOCK_MARGIN,
) =>
  dockedToolbarPosition({
    side,
    point: side === "top" || side === "bottom"
      ? { x: (viewport.width - size.width) / 2, y: 0 }
      : { x: 0, y: (viewport.height - size.height) / 2 },
    ...size,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    margin,
  })

// Distance between the toolbar and the given viewport edge.
export const edgeGap = (
  side: ToolbarSide,
  point: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
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

const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smoothstep = (t: number) => t * t * (3 - 2 * t)

// Decides where a dragged toolbar goes in snap mode. Continuous on purpose: approaching an edge
// pulls the toolbar toward its glue spot, and leaving an edge stretches it toward the pointer,
// so the glue and release never jump. `glueSize` gives the size the toolbar will have on a side.
export const snapToolbarPosition = ({
  point,
  size,
  viewportWidth,
  viewportHeight,
  glued,
  glueSize,
  margin = TOOLBAR_DOCK_MARGIN,
}: {
  point: { x: number; y: number }
  size: { width: number; height: number }
  viewportWidth: number
  viewportHeight: number
  glued: ToolbarSide | null
  glueSize?: (side: ToolbarSide) => { width: number; height: number } | undefined
  margin?: number
}): { side: ToolbarSide | null; position: { x: number; y: number }; preview: ToolbarSide | null } => {
  const viewport = { width: viewportWidth, height: viewportHeight }

  if (glued) {
    const gap = edgeGap(glued, point, size, viewport)
    if (gap > RELEASE_DISTANCE) return { side: null, position: point, preview: null }
    const docked = dockedToolbarPosition({ side: glued, point, ...size, viewportWidth, viewportHeight, margin })
    const r = smoothstep(clamp01((gap - SNAP_DISTANCE) / (RELEASE_DISTANCE - SNAP_DISTANCE)))
    const position = glued === "top" || glued === "bottom"
      ? { x: docked.x, y: lerp(docked.y, point.y, r) }
      : { x: lerp(docked.x, point.x, r), y: docked.y }
    return { side: glued, position, preview: null }
  }

  let nearest: { side: ToolbarSide; gap: number } | null = null
  for (const side of SNAP_SIDES) {
    const gap = edgeGap(side, point, size, viewport)
    if (gap <= PREVIEW_DISTANCE && (!nearest || gap < nearest.gap)) nearest = { side, gap }
  }
  if (!nearest) return { side: null, position: point, preview: null }

  const target = centeredDockPosition(nearest.side, glueSize?.(nearest.side) ?? size, viewport, margin)
  if (nearest.gap <= SNAP_DISTANCE) return { side: nearest.side, position: target, preview: null }
  const t = smoothstep(clamp01((PREVIEW_DISTANCE - nearest.gap) / (PREVIEW_DISTANCE - SNAP_DISTANCE)))
  return {
    side: null,
    position: { x: lerp(point.x, target.x, t), y: lerp(point.y, target.y, t) },
    preview: nearest.side,
  }
}

