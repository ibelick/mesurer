import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import { getSnapArrowPoint } from "../core/arrows-snap"
import { midpoint } from "../core/arrows"
import type { Arrow, Guide, Point, ToolMode } from "../core/types"
import { createId } from "../core/utils"

const MIN_ARROW_LENGTH = 4
const SLIDE_THRESHOLD = 8

export type DrawingState = {
  pointerId: number
  origin: Point
  slid: boolean
  fromStart: boolean
}

type UseArrowsDrawingOptions = {
  enabled: boolean
  settingsOpen: boolean
  snapArrowsEnabled: boolean
  arrowClickToPlace: boolean
  color: string
  width: number
  overlayRef: RefObject<HTMLDivElement | null>
  ownerDocument: Document
  guides: Guide[]
  createActionCommit: () => () => void
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setArrows: Dispatch<SetStateAction<Arrow[]>>
  setSelectedArrowIds: Dispatch<SetStateAction<string[]>>
  arrowStart: Point | null
  arrowMiddle: Point | null
  setArrowStart: Dispatch<SetStateAction<Point | null>>
  setArrowMiddle: Dispatch<SetStateAction<Point | null>>
  setArrowPreviewEnd: Dispatch<SetStateAction<Point | null>>
  scrollOffset: Point
  pointerIdRef: MutableRefObject<number | null>
}

export const useArrowsDrawing = ({
  enabled,
  settingsOpen,
  snapArrowsEnabled,
  arrowClickToPlace,
  color,
  width,
  overlayRef,
  ownerDocument,
  guides,
  createActionCommit,
  setToolMode,
  setArrows,
  setSelectedArrowIds,
  arrowStart,
  arrowMiddle,
  setArrowStart,
  setArrowMiddle,
  setArrowPreviewEnd,
  scrollOffset,
  pointerIdRef,
}: UseArrowsDrawingOptions) => {
  const drawingRef = useRef<DrawingState | null>(null)
  const pagePoint = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): Point => ({
      x: event.clientX + scrollOffset.x,
      y: event.clientY + scrollOffset.y,
    }),
    [scrollOffset],
  )
  const snapPoint = useCallback(
    (point: Point) => getSnapArrowPoint({
      point,
      snapArrowsEnabled,
      overlayNode: overlayRef.current,
      guides,
      scrollOffset,
      document: ownerDocument,
    }),
    [guides, overlayRef, ownerDocument, scrollOffset, snapArrowsEnabled],
  )
  const clearDrawing = useCallback(() => {
    drawingRef.current = null
    pointerIdRef.current = null
    setArrowStart(null)
    setArrowMiddle(null)
    setArrowPreviewEnd(null)
  }, [pointerIdRef, setArrowMiddle, setArrowPreviewEnd, setArrowStart])
  const commitArrow = useCallback(
    (start: Point, control: Point, end: Point) => {
      if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_ARROW_LENGTH) {
        return
      }

      createActionCommit()()
      setArrows((previous) => [
        ...previous,
        { id: createId(), start, control, end, color, width },
      ])
      setSelectedArrowIds([])
      setToolMode("selection")
    },
    [color, createActionCommit, setArrows, setSelectedArrowIds, setToolMode, width],
  )
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || settingsOpen || event.button !== 0) {
      return
    }
    if (event.target instanceof Element) {
      const arrowId = event.target.getAttribute("data-mesurer-arrow-id")
      if (arrowId && !arrowStart) {
        setSelectedArrowIds([arrowId])
        return
      }
    }
    if (!arrowStart && event.target !== event.currentTarget) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const point = snapPoint(pagePoint(event))
    const fromStart = !arrowStart
    if (fromStart) {
      setArrowStart(point)
      setArrowPreviewEnd(point)
    }
    drawingRef.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      slid: false,
      fromStart,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [arrowStart, enabled, pagePoint, setArrowPreviewEnd, setArrowStart, setSelectedArrowIds, settingsOpen, snapPoint])
  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (drawing && event.pointerId === drawing.pointerId && event.buttons !== 0) {
      const travel = Math.hypot(event.clientX - drawing.origin.x, event.clientY - drawing.origin.y)
      if (!drawing.slid && travel >= SLIDE_THRESHOLD) {
        drawing.slid = true
      }
    }
    if (!arrowStart) {
      return
    }
    setArrowPreviewEnd(snapPoint(pagePoint(event)))
  }, [arrowStart, pagePoint, setArrowPreviewEnd, snapPoint])
  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || event.pointerId !== drawing.pointerId) {
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drawingRef.current = null
    const point = snapPoint(pagePoint(event))
    if (!arrowStart) {
      return
    }
    if (drawing.fromStart) {
      if (arrowClickToPlace) {
        return
      }

      if (drawing.slid) {
        commitArrow(arrowStart, midpoint(arrowStart, point), point)
        clearDrawing()
      }

      return
    }
    if (!arrowMiddle) {
      if (arrowClickToPlace) {
        if (Math.hypot(point.x - arrowStart.x, point.y - arrowStart.y) >= MIN_ARROW_LENGTH) {
          commitArrow(arrowStart, midpoint(arrowStart, point), point)
          clearDrawing()
        }

        return
      }
      if (Math.hypot(point.x - arrowStart.x, point.y - arrowStart.y) >= MIN_ARROW_LENGTH) {
        setArrowMiddle(point)
        setArrowPreviewEnd(point)
      }

      return
    }
    commitArrow(arrowStart, arrowMiddle, point)
    clearDrawing()
  }, [arrowClickToPlace, arrowMiddle, arrowStart, clearDrawing, commitArrow, pagePoint, setArrowMiddle, setArrowPreviewEnd, snapPoint])
  return {
    drawingRef,
    clearDrawing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave: useCallback(() => undefined, []),
  }
}
