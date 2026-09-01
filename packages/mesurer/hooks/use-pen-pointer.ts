import { useCallback, useLayoutEffect, useRef, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react"
import type { PenStroke, Point, ToolMode } from "../core/types"
import { createId } from "../core/utils"

const MIN_STROKE_LENGTH = 4

type UsePenPointerOptions = {
  enabled: boolean
  settingsOpen: boolean
  toolMode: ToolMode
  color: string
  scrollOffset: Point
  createActionCommit: () => () => void
  setPenStrokes: Dispatch<SetStateAction<PenStroke[]>>
  setPenPreview: Dispatch<SetStateAction<Point[]>>
}

export const usePenPointer = ({
  enabled,
  settingsOpen,
  toolMode,
  color,
  scrollOffset,
  createActionCommit,
  setPenStrokes,
  setPenPreview,
}: UsePenPointerOptions) => {
  const drawingRef = useRef<{
    pointerId: number
    points: Point[]
    target: HTMLDivElement
  } | null>(null)

  const pagePoint = useCallback((event: ReactPointerEvent<HTMLDivElement>): Point => ({
    x: event.clientX + scrollOffset.x,
    y: event.clientY + scrollOffset.y,
  }), [scrollOffset])

  const clearDrawing = useCallback(() => {
    const drawing = drawingRef.current
    if (drawing?.target.hasPointerCapture(drawing.pointerId)) {
      drawing.target.releasePointerCapture(drawing.pointerId)
    }
    drawingRef.current = null
    setPenPreview([])
  }, [setPenPreview])

  useLayoutEffect(() => {
    if (toolMode !== "pen") clearDrawing()
  }, [clearDrawing, toolMode])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || settingsOpen || toolMode !== "pen" || event.button !== 0) return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    event.stopPropagation()
    const point = pagePoint(event)
    drawingRef.current = { pointerId: event.pointerId, points: [point], target: event.currentTarget }
    setPenPreview([point])
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [enabled, pagePoint, setPenPreview, settingsOpen, toolMode])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || drawing.pointerId !== event.pointerId || event.buttons === 0) return
    const point = pagePoint(event)
    const previous = drawing.points[drawing.points.length - 1]
    if (previous.x === point.x && previous.y === point.y) return
    drawing.points.push(point)
    setPenPreview([...drawing.points])
  }, [pagePoint, setPenPreview])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current
    if (!drawing || drawing.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const point = pagePoint(event)
    const previous = drawing.points[drawing.points.length - 1]
    if (previous.x !== point.x || previous.y !== point.y) drawing.points.push(point)
    const first = drawing.points[0]
    const last = drawing.points[drawing.points.length - 1]
    if (Math.hypot(last.x - first.x, last.y - first.y) >= MIN_STROKE_LENGTH) {
      createActionCommit()()
      setPenStrokes((strokes) => [...strokes, { id: createId(), points: drawing.points, color, width: 2 }])
    }
    clearDrawing()
  }, [clearDrawing, color, createActionCommit, pagePoint, setPenStrokes])

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (drawingRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    clearDrawing()
  }, [clearDrawing])

  const handlePointerLeave = useCallback(() => undefined, [])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
    cancelInteraction: clearDrawing,
    hasActiveInteraction: () => Boolean(drawingRef.current),
  }
}
