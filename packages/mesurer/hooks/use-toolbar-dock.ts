import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import { flushSync } from "react-dom"
import { TOOLBAR_SIDES, type ToolbarDock, type ToolbarSide } from "../core/persistence"
import {
  alignedDockPosition,
  cornerDropFor,
  dockAlignFor,
  dragToolbarPosition,
  isVerticalToolbarSide,
  snapToolbarPosition,
  type DockAlign,
  type Point,
  type Size,
  type ToolbarPlacement,
} from "../core/toolbar-dock"
import { captureToolbarTurn, playToolbarTurn, type ToolbarTurn } from "../core/toolbar-turn"
import { useToolbarDrag } from "./use-toolbar-drag"

// Every spot the bar can land on along an edge in snap mode: its middle, and the corner at either end.
const DROP_ALIGNS: DockAlign[] = ["center", "start", "end"]

const GLIDE_MS = 280
// Different timing per axis, so the glide curves in an arc instead of running straight.
const GLIDE_TRANSITION = `left ${GLIDE_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1), top ${GLIDE_MS * 1.35}ms cubic-bezier(0.3, 1.2, 0.5, 1)`
// A resize that moved the toolbar is saved once it has settled.
const PERSIST_DELAY_MS = 300

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y

// How far along the bar its fixed point sits while it opens, closes and resizes.
const GROW_ORIGIN: Record<DockAlign, number> = { start: 0, center: 0.5, end: 1 }

// Owns where the toolbar sits: dragging it, and in snap mode gluing it to the screen edges,
// turning it between horizontal and vertical, and keeping it in place as it resizes.
export const useToolbarDock = ({
  eventTarget,
  motionRef,
  dock,
  minimized,
  initialPosition,
  onPositionChange,
  onDragStart,
  onDragEnd,
}: {
  eventTarget: Window
  motionRef: RefObject<HTMLElement | null>
  dock: ToolbarDock
  minimized: boolean
  initialPosition: ToolbarPlacement
  onPositionChange?: (placement: ToolbarPlacement) => void
  onDragStart: () => void
  onDragEnd: () => void
}) => {
  const snapping = dock === "snap"
  const viewportSize = (): Size => ({ width: eventTarget.innerWidth, height: eventTarget.innerHeight })
  const barSize = (): Size => ({
    width: motionRef.current?.offsetWidth ?? 0,
    height: motionRef.current?.offsetHeight ?? 0,
  })

  // The saved placement says where the bar was glued. Without it (an older save, or snap mode
  // just turned on) the edge is not known yet, and is read from where the bar is.
  const edgeKnownRef = useRef(snapping && initialPosition.edge !== undefined)
  const [edge, setEdgeState] = useState<ToolbarSide | null>((snapping && initialPosition.edge) || null)
  const edgeRef = useRef(edge)
  // Standing vertical or lying flat. An edge sets it; a free bar keeps the one it had.
  const [vertical, setVertical] = useState(
    snapping && (edge ? isVerticalToolbarSide(edge) : initialPosition.vertical === true),
  )
  const verticalRef = useRef(vertical)
  const turnRef = useRef<{ from: ToolbarTurn; vertical: boolean } | null>(null)
  const setEdge = useCallback(
    (next: ToolbarSide | null, upright = next ? isVerticalToolbarSide(next) : verticalRef.current) => {
      const node = motionRef.current
      // Measure the bar before it turns, so the new orientation swings out of the old one.
      if (upright !== verticalRef.current) {
        if (node?.dataset.ready === "true") {
          turnRef.current = { from: captureToolbarTurn(node), vertical: upright }
        }
        verticalRef.current = upright
        setVertical(upright)
      }
      edgeRef.current = next
      setEdgeState(next)
    },
    [motionRef],
  )
  // Where the glued bar sits along its edge: the middle, or a corner.
  const [align, setAlignState] = useState<DockAlign>(initialPosition.align ?? "center")
  const alignRef = useRef(align)
  const setAlign = useCallback((next: DockAlign) => {
    alignRef.current = next
    setAlignState(next)
  }, [])
  // Saves where the bar rests, with what cannot be read back from the position alone.
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange
  const report = useCallback(
    (point: Point) =>
      onPositionChangeRef.current?.({
        ...point,
        edge: edgeRef.current,
        align: alignRef.current,
        vertical: verticalRef.current,
      }),
    [],
  )

  // Last measured size per orientation, so a glue can aim at the spot the turned bar will occupy.
  const sizesRef = useRef<{ horizontal?: Size; vertical?: Size }>({})
  useLayoutEffect(() => {
    const size = barSize()
    if (size.width) sizesRef.current[vertical ? "vertical" : "horizontal"] = size
  })
  // The toolbar's size standing up or lying flat. The orientation on screen is measured live;
  // the other one comes from its last measure, or from the current size turned on its side.
  const sizeFor = (upright: boolean): Size => {
    const live = barSize()
    if (upright === (motionRef.current?.dataset.orientation === "vertical")) return live
    return sizesRef.current[upright ? "vertical" : "horizontal"] ?? { width: live.height, height: live.width }
  }

  // Gluing eases the toolbar into the middle of the edge instead of jumping there.
  const [gliding, setGliding] = useState(false)
  const glideTimerRef = useRef<number | undefined>(undefined)
  const startGlide = () => {
    if (eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    eventTarget.clearTimeout(glideTimerRef.current)
    setGliding(true)
    glideTimerRef.current = eventTarget.setTimeout(() => setGliding(false), GLIDE_MS)
  }
  useLayoutEffect(() => () => eventTarget.clearTimeout(glideTimerRef.current), [eventTarget])

  // Where the pointer holds the toolbar, as fractions along its length and across its thickness.
  const grabRef = useRef({ along: 0.5, across: 0.5 })
  // Whether a wall is what turned the dragged bar, so it turns back when let off it.
  const pushedRef = useRef(false)
  // Whether a toolbar pulled off an edge is still free, until the pointer is back in the middle.
  const latchedRef = useRef(false)
  // The corner a free toolbar is in, where releasing it glues it.
  const cornerRef = useRef<{ side: ToolbarSide; align: DockAlign } | null>(null)
  // The zone the toolbar would land in on release, as state, so it lights up while dragged.
  const [landing, setLanding] = useState<{ side: ToolbarSide; align: DockAlign } | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useToolbarDrag(
    { x: initialPosition.x, y: initialPosition.y },
    eventTarget,
    () => {
      setDragging(true)
      onDragStart()
    },
    (released) => {
      setDragging(false)
      onDragEnd()
      let settled = released
      if (snapping) {
        // The drag already chose the edge, from the pointer. A glued toolbar settles in the
        // middle of its edge or the corner it was left near. A free one stays where it is, unless
        // it was let go in a corner, where it glues to that corner.
        const corner = edgeRef.current ? null : cornerRef.current
        const result = snapToolbarPosition({
          point: released,
          size: barSize(),
          viewport: viewportSize(),
          glued: corner ? corner.side : edgeRef.current,
          align: corner?.align,
        })
        cornerRef.current = null
        setLanding(null)
        if (corner) setEdge(result.side)
        setAlign(result.align)
        settled = result.position
        if (!samePoint(settled, released)) {
          startGlide()
          setPosition(settled)
        }
      }
      report(settled)
    },
    snapping
      ? (_point, pointer) => {
          const result = dragToolbarPosition({
            pointer,
            grab: grabRef.current,
            glued: edgeRef.current,
            upright: verticalRef.current,
            pushed: pushedRef.current,
            latched: latchedRef.current,
            sizeFor,
            viewport: viewportSize(),
          })
          pushedRef.current = result.pushed
          latchedRef.current = result.latched
          // The zone it would land in: the edge and end it is on, or the corner a free one is in.
          const landed = result.side
            ? { side: result.side, align: dockAlignFor(result.side, result.position, sizeFor(result.upright), viewportSize()) }
            : cornerDropFor(pointer, result.upright, viewportSize())
          cornerRef.current = result.side ? null : landed
          setLanding((prev) => (prev?.side === landed?.side && prev?.align === landed?.align ? prev : landed))
          setEdge(result.side, result.upright)
          return result.position
        }
      : undefined,
  )
  const { position, setPosition, isDragging, refreshDrag } = drag
  // Static while dragging: fixed to the viewport, so they never follow the bar. Each one is the
  // little square the closed bar makes on that spot, whether the bar is open or not.
  const dropZones = () => {
    if (!snapping || !dragging) return []
    const bar = barSize()
    const side = Math.min(bar.width, bar.height)
    const square = { width: side, height: side }
    // The zone the toolbar would land in on release lights up.
    const lit = landing && alignedDockPosition(landing.side, landing.align, square, viewportSize())
    // The corners belong to two edges: the top and bottom ones bring them.
    return TOOLBAR_SIDES.flatMap((edge) =>
      (isVerticalToolbarSide(edge) ? DROP_ALIGNS.slice(0, 1) : DROP_ALIGNS).map((spot) => {
        const at = alignedDockPosition(edge, spot, square, viewportSize())
        return { ...at, ...square, active: !!lit && samePoint(at, lit) }
      }),
    )
  }
  const positionRef = useRef(position)
  positionRef.current = position

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    grabRef.current = vertical ? { along: y, across: x } : { along: x, across: y }
    pushedRef.current = false
    latchedRef.current = false
    drag.onPointerDown(event)
  }

  const wasSnappingRef = useRef(snapping)
  useLayoutEffect(() => {
    const wasSnapping = wasSnappingRef.current
    wasSnappingRef.current = snapping
    if (!snapping) {
      setEdge(null, false)
      edgeKnownRef.current = false
      // Leaving snap mode frees the bar: saved, so the next load does not glue it back.
      if (wasSnapping) report(positionRef.current)
      return
    }
    const node = motionRef.current
    if (!node) return
    // Re-glues after mount, resize and minimize so a glued toolbar keeps its spot on the edge.
    // `along` overrides the coordinate on a free bar's own axis.
    const snap = (along?: number) => {
      const current = positionRef.current
      const upright = verticalRef.current
      const result = snapToolbarPosition({
        point: along === undefined ? current : upright ? { x: current.x, y: along } : { x: along, y: current.y },
        size: barSize(),
        viewport: viewportSize(),
        glued: edgeKnownRef.current ? edgeRef.current : undefined,
        align: alignRef.current,
      })
      const known = edgeKnownRef.current
      edgeKnownRef.current = true
      setEdge(result.side)
      setAlign(result.align)
      if (!samePoint(result.position, current)) setPosition(result.position)
      // An edge read from the bar is saved, so the next load starts from it.
      if (!known) report(result.position)
    }
    // A resize keeps a free bar's middle where it was, so it too opens and switches modes from
    // its center.
    const measure = () => {
      const upright = verticalRef.current
      const size = upright ? node.offsetHeight : node.offsetWidth
      const at = upright ? positionRef.current.y : positionRef.current.x
      return { upright, size, at, center: at + size / 2 }
    }
    let anchor = measure()
    // The observer's first report is the bar's size once laid out, which is where it starts from.
    let observed = false
    let persistTimer: number | undefined
    const persistSoon = () => {
      eventTarget.clearTimeout(persistTimer)
      persistTimer = eventTarget.setTimeout(() => {
        persistTimer = undefined
        report(positionRef.current)
      }, PERSIST_DELAY_MS)
    }
    const onResize = () => {
      const next = measure()
      // A drag places the bar itself.
      if (isDragging()) {
        anchor = next
        return
      }
      const turned = next.upright !== anchor.upright
      const resized = observed && !turned && next.size !== anchor.size
      observed = true
      // The kept middle survives rounding and clamping, unless a drag has moved the bar since.
      const center = next.at === anchor.at ? anchor.center : next.at + anchor.size / 2
      // Flushed so the new position lands in the same frame as the new size.
      flushSync(() => snap(resized ? Math.round(center - next.size / 2) : undefined))
      anchor = turned || !resized ? measure() : { ...measure(), center }
      if (resized) persistSoon()
    }
    // The observer reports once the bar is laid out, before it is painted: that first report
    // places it. Placing it any sooner would measure a bar that has not taken its size yet.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null
    if (observer) observer.observe(node)
    else snap()
    const onViewportResize = () => {
      if (isDragging()) return
      const before = positionRef.current
      flushSync(() => snap())
      // A window resize that moved the bar is saved too.
      if (!samePoint(before, positionRef.current)) persistSoon()
    }
    eventTarget.addEventListener("resize", onViewportResize)
    return () => {
      observer?.disconnect()
      // Save a pending size-driven position now, rather than dropping it on unmount.
      if (persistTimer !== undefined) {
        eventTarget.clearTimeout(persistTimer)
        report(positionRef.current)
      }
      eventTarget.removeEventListener("resize", onViewportResize)
    }
  }, [eventTarget, snapping, isDragging, motionRef, report, setAlign, setEdge, setPosition])

  // A swap between vertical and horizontal swings the bar a quarter turn from its old place.
  // Run it as a layout effect on every render, after whatever settles the turned bar's size.
  const settleTurn = () => {
    const node = motionRef.current
    const turn = turnRef.current
    if (!node || !turn) return
    if (turn.vertical === vertical) {
      // The turned bar's real size is only known now: put it back under the pointer, or on its
      // spot of the edge, and swing on the render that follows.
      if (isDragging()) {
        if (refreshDrag()) return
      } else if (edge) {
        const settled = alignedDockPosition(edge, align, barSize(), viewportSize())
        if (!samePoint(settled, position)) {
          setPosition(settled)
          return
        }
      }
      // A minimized toolbar is a square either way: it has nothing to swing.
      if (!minimized && !eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        playToolbarTurn(node, turn.from, vertical)
      }
    }
    turnRef.current = null
  }

  return {
    position,
    edge,
    vertical,
    // The screen side a vertical bar stands on: its edge, or the half of the screen a free one is in.
    columnSide: !vertical
      ? null
      : edge === "left" || edge === "right"
        ? edge
        : position.x < eventTarget.innerWidth / 2
          ? ("left" as const)
          : ("right" as const),
    // Free bars keep their middle in snap mode, and their leading edge otherwise.
    growOrigin: !snapping ? 0 : edge ? GROW_ORIGIN[align] : 0.5,
    dragging,
    dropZones: dropZones(),
    transition: gliding ? GLIDE_TRANSITION : undefined,
    settleTurn,
    onPointerDown,
    onClickCapture: drag.onClickCapture,
    consumeDragClick: drag.consumeDragClick,
  }
}
