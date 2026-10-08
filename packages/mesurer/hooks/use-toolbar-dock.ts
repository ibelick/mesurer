import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import { flushSync } from "react-dom"
import type { ToolbarDock, ToolbarSide } from "../core/persistence"
import {
  centeredDockPosition,
  dragToolbarPosition,
  isVerticalToolbarSide,
  snapToolbarPosition,
  type Point,
  type Size,
} from "../core/toolbar-dock"
import { captureToolbarTurn, playToolbarTurn } from "../core/toolbar-turn"
import { useToolbarDrag } from "./use-toolbar-drag"

const GLIDE_MS = 280
// Different timing per axis, so the glide curves in an arc instead of running straight.
const GLIDE_TRANSITION = `left ${GLIDE_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1), top ${GLIDE_MS * 1.35}ms cubic-bezier(0.3, 1.2, 0.5, 1)`
// A resize that moved the toolbar is saved once it has settled.
const PERSIST_DELAY_MS = 300

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y

// Owns where the toolbar sits: dragging it, and in snap mode gluing it to the screen edges,
// turning it between horizontal and vertical, and keeping it centered as it resizes.
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
  initialPosition: Point
  onPositionChange?: (position: Point) => void
  onDragStart: () => void
  onDragEnd: () => void
}) => {
  const snapping = dock === "snap"
  const viewportSize = (): Size => ({ width: eventTarget.innerWidth, height: eventTarget.innerHeight })
  const barSize = (): Size => ({
    width: motionRef.current?.offsetWidth ?? 0,
    height: motionRef.current?.offsetHeight ?? 0,
  })

  // The edge mask: stays mounted and fades, so it eases in and out instead of popping.
  const [snapMask, setSnapMask] = useState<{ side: ToolbarSide; active: boolean }>({ side: "left", active: false })
  const [edge, setEdgeState] = useState<ToolbarSide | null>(null)
  const edgeRef = useRef<ToolbarSide | null>(null)
  const turnRef = useRef<{ from: DOMRect; vertical: boolean } | null>(null)
  const setEdge = useCallback(
    (next: ToolbarSide | null) => {
      if (next === edgeRef.current) return
      const node = motionRef.current
      // Measure the bar before it turns, so the new orientation swings out of the old one.
      if (
        node?.dataset.ready === "true" &&
        isVerticalToolbarSide(next) !== isVerticalToolbarSide(edgeRef.current)
      ) {
        turnRef.current = { from: captureToolbarTurn(node), vertical: isVerticalToolbarSide(next) }
      }
      edgeRef.current = next
      setEdgeState(next)
    },
    [motionRef],
  )
  const vertical = isVerticalToolbarSide(edge)

  // Last measured size per orientation, so a glue can aim at the spot the turned bar will occupy.
  const sizesRef = useRef<{ horizontal?: Size; vertical?: Size }>({})
  useLayoutEffect(() => {
    const size = barSize()
    if (size.width) sizesRef.current[vertical ? "vertical" : "horizontal"] = size
  })
  // The toolbar's size on a side (null when free). The orientation on screen is measured live;
  // the other one comes from its last measure, or from the current size turned on its side.
  const sizeFor = (side: ToolbarSide | null): Size => {
    const live = barSize()
    const upright = isVerticalToolbarSide(side)
    if (upright === (motionRef.current?.dataset.orientation === "vertical")) return live
    return sizesRef.current[upright ? "vertical" : "horizontal"] ?? { width: live.height, height: live.width }
  }

  // Gluing eases the toolbar into the middle of the edge instead of jumping there.
  const [gliding, setGliding] = useState(false)
  const glideTimerRef = useRef<number | undefined>(undefined)
  const startGlide = () => {
    eventTarget.clearTimeout(glideTimerRef.current)
    setGliding(true)
    glideTimerRef.current = eventTarget.setTimeout(() => setGliding(false), GLIDE_MS)
  }
  useLayoutEffect(() => () => eventTarget.clearTimeout(glideTimerRef.current), [eventTarget])

  // Where the pointer holds the toolbar, as fractions along its length and across its thickness.
  const grabRef = useRef({ along: 0.5, across: 0.5 })
  const [dragging, setDragging] = useState(false)
  const drag = useToolbarDrag(
    initialPosition,
    eventTarget,
    () => {
      setDragging(true)
      onDragStart()
    },
    (released) => {
      setDragging(false)
      setSnapMask((mask) => ({ ...mask, active: false }))
      onDragEnd()
      let settled = released
      if (snapping) {
        // A toolbar released on an edge, or dropped right next to one, settles in the middle of it.
        const { side } = snapToolbarPosition({
          point: released,
          size: barSize(),
          viewport: viewportSize(),
          glued: edgeRef.current,
        })
        if (side) {
          setEdge(side)
          settled = centeredDockPosition(side, sizeFor(side), viewportSize())
          if (!samePoint(settled, released)) {
            startGlide()
            setPosition(settled)
          }
        }
      }
      onPositionChange?.(settled)
    },
    snapping
      ? (_point, pointer) => {
          const result = dragToolbarPosition({
            pointer,
            grab: grabRef.current,
            glued: edgeRef.current,
            sizeFor,
            viewport: viewportSize(),
          })
          setEdge(result.side)
          setSnapMask((mask) => ({ side: result.preview ?? mask.side, active: result.preview !== null }))
          return result.position
        }
      : undefined,
  )
  const { position, setPosition, isDragging, refreshDrag } = drag
  const positionRef = useRef(position)
  positionRef.current = position
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    grabRef.current = vertical ? { along: y, across: x } : { along: x, across: y }
    drag.onPointerDown(event)
  }

  useLayoutEffect(() => {
    if (!snapping) {
      setEdge(null)
      return
    }
    const node = motionRef.current
    if (!node) return
    // Re-glues after mount, resize and minimize so a glued toolbar stays in the middle of its
    // edge. `along` overrides the coordinate on a free bar's own axis.
    const snap = (along?: number) => {
      const current = positionRef.current
      const upright = isVerticalToolbarSide(edgeRef.current)
      const result = snapToolbarPosition({
        point: along === undefined ? current : upright ? { x: current.x, y: along } : { x: along, y: current.y },
        size: barSize(),
        viewport: viewportSize(),
        glued: edgeRef.current,
      })
      setEdge(result.side)
      if (!samePoint(result.position, current)) setPosition(result.position)
    }
    snap()
    // A resize keeps a free bar's middle where it was, so it too opens and switches modes from
    // its center.
    const measure = () => {
      const upright = isVerticalToolbarSide(edgeRef.current)
      const size = upright ? node.offsetHeight : node.offsetWidth
      const at = upright ? positionRef.current.y : positionRef.current.x
      return { upright, size, at, center: at + size / 2 }
    }
    let anchor = measure()
    let persistTimer: number | undefined
    const onResize = () => {
      const next = measure()
      // A drag places the bar itself.
      if (isDragging()) {
        anchor = next
        return
      }
      const turned = next.upright !== anchor.upright
      const resized = !turned && next.size !== anchor.size
      // The kept middle survives rounding and clamping, unless a drag has moved the bar since.
      const center = next.at === anchor.at ? anchor.center : next.at + anchor.size / 2
      // Flushed so the new position lands in the same frame as the new size.
      flushSync(() => snap(resized ? Math.round(center - next.size / 2) : undefined))
      anchor = turned ? measure() : { ...measure(), center }
      if (!resized) return
      eventTarget.clearTimeout(persistTimer)
      persistTimer = eventTarget.setTimeout(
        () => onPositionChangeRef.current?.(positionRef.current),
        PERSIST_DELAY_MS,
      )
    }
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null
    observer?.observe(node)
    const onViewportResize = () => {
      if (!isDragging()) snap()
    }
    eventTarget.addEventListener("resize", onViewportResize)
    return () => {
      observer?.disconnect()
      eventTarget.clearTimeout(persistTimer)
      eventTarget.removeEventListener("resize", onViewportResize)
    }
  }, [eventTarget, snapping, isDragging, motionRef, setEdge, setPosition])

  // A swap between vertical and horizontal swings the bar a quarter turn from its old place.
  // Run it as a layout effect on every render, after whatever settles the turned bar's size.
  const settleTurn = () => {
    const node = motionRef.current
    const turn = turnRef.current
    if (!node || !turn) return
    if (turn.vertical === vertical) {
      // The turned bar's real size is only known now: put it back under the pointer, or in the
      // middle of its edge, and swing on the render that follows.
      if (isDragging()) {
        if (refreshDrag()) return
      } else if (edge) {
        const centered = centeredDockPosition(edge, barSize(), viewportSize())
        if (!samePoint(centered, position)) {
          setPosition(centered)
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
    dragging,
    snapMask,
    transition: gliding ? GLIDE_TRANSITION : undefined,
    settleTurn,
    onPointerDown,
    onClickCapture: drag.onClickCapture,
    consumeDragClick: drag.consumeDragClick,
  }
}
