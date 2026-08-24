import { useCallback, useRef } from "react"
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react"
import { midpoint, relativeControl, controlFromRelative, translateArrow } from "../core/arrows"
import type { Arrow, Point, ToolMode } from "../core/types"
import { createId } from "../core/utils"

const MIN_ARROW_LENGTH = 4
const SLIDE_THRESHOLD = 8

type UseArrowsPointerOptions = {
  enabled: boolean
  settingsOpen: boolean
  color: string
  width: number
  createActionCommit: () => () => void
  setArrows: Dispatch<SetStateAction<Arrow[]>>
  setSelectedArrowIds: Dispatch<SetStateAction<string[]>>
  setToolMode: (value: ToolMode) => void
  arrows: Arrow[]
  arrowStart: Point | null
  arrowMiddle: Point | null
  arrowPreviewEnd: Point | null
  setArrowStart: Dispatch<SetStateAction<Point | null>>
  setArrowMiddle: Dispatch<SetStateAction<Point | null>>
  setArrowPreviewEnd: Dispatch<SetStateAction<Point | null>>
  scrollOffset: Point
}

export const useArrowsPointer = ({
  enabled,
  settingsOpen,
  color,
  width,
  createActionCommit,
  setArrows,
  setSelectedArrowIds,
  setToolMode,
  arrows,
  arrowStart,
  arrowMiddle,
  arrowPreviewEnd,
  setArrowStart,
  setArrowMiddle,
  setArrowPreviewEnd,
  scrollOffset,
}: UseArrowsPointerOptions) => {
  const pointerIdRef = useRef<number | null>(null)
  const drawingRef = useRef<{
    pointerId: number
    origin: Point
    slid: boolean
    fromStart: boolean
  } | null>(null)
  const editRef = useRef<{
    arrowId: string
    action: "move" | "start" | "control" | "end"
    origin: Point
    arrow: Arrow
    basis: ReturnType<typeof relativeControl> | null
    changed: boolean
  } | null>(null)

  const pagePoint = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): Point => ({
      x: event.clientX + scrollOffset.x,
      y: event.clientY + scrollOffset.y,
    }),
    [scrollOffset],
  )

  const clearDrawing = useCallback(() => {
    drawingRef.current = null
    pointerIdRef.current = null
    setArrowStart(null)
    setArrowMiddle(null)
    setArrowPreviewEnd(null)
  }, [setArrowMiddle, setArrowPreviewEnd, setArrowStart])

  const commitArrow = useCallback(
    (start: Point, control: Point, end: Point) => {
      if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_ARROW_LENGTH) return
      createActionCommit()()
      setArrows((previous) => [
        ...previous,
        {
          id: createId(),
          start,
          control,
          end,
          color,
          width,
        },
      ])
      setSelectedArrowIds([])
      setToolMode("selection")
    },
    [color, createActionCommit, setArrows, setSelectedArrowIds, setToolMode, width],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || settingsOpen || event.button !== 0) return
      if (event.target instanceof Element) {
        const arrowId = event.target.getAttribute("data-mesurer-arrow-id")
        if (arrowId && !arrowStart) {
          setSelectedArrowIds([arrowId])
          return
        }
      }
      if (!arrowStart && event.target !== event.currentTarget) return
      event.preventDefault()
      event.stopPropagation()
      const point = pagePoint(event)
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
    },
    [arrowStart, enabled, pagePoint, settingsOpen, setArrowPreviewEnd, setArrowStart, setSelectedArrowIds],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drawing = drawingRef.current
      if (drawing && event.pointerId === drawing.pointerId && event.buttons !== 0) {
        const travel = Math.hypot(
          event.clientX - drawing.origin.x,
          event.clientY - drawing.origin.y,
        )
        if (!drawing.slid && travel >= SLIDE_THRESHOLD) drawing.slid = true
      }
      if (!arrowStart) return
      setArrowPreviewEnd(pagePoint(event))
    },
    [arrowStart, pagePoint, setArrowPreviewEnd],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drawing = drawingRef.current
      if (!drawing || event.pointerId !== drawing.pointerId) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      drawingRef.current = null
      const point = pagePoint(event)
      if (!arrowStart) return

      if (drawing.fromStart) {
        if (drawing.slid) {
          commitArrow(arrowStart, midpoint(arrowStart, point), point)
          clearDrawing()
        }
        return
      }

      if (!arrowMiddle) {
        if (Math.hypot(point.x - arrowStart.x, point.y - arrowStart.y) >= MIN_ARROW_LENGTH) {
          setArrowMiddle(point)
          setArrowPreviewEnd(point)
        }
        return
      }

      commitArrow(arrowStart, arrowMiddle, point)
      clearDrawing()
    },
    [arrowMiddle, arrowStart, clearDrawing, commitArrow, pagePoint, setArrowMiddle, setArrowPreviewEnd],
  )

  const handlePointerLeave = useCallback(() => undefined, [])

  const handleSelectionPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || settingsOpen || event.button !== 0) return false
      if (!(event.target instanceof Element)) return false
      const arrowId = event.target.getAttribute("data-mesurer-arrow-id")
      if (!arrowId) return false
      const arrow = arrows.find((item) => item.id === arrowId)
      if (!arrow) return false
      const handle = event.target.getAttribute("data-mesurer-arrow-handle")
      event.preventDefault()
      event.stopPropagation()
      setSelectedArrowIds([arrowId])
      pointerIdRef.current = event.pointerId
      const snapshot = {
        ...arrow,
        control: arrow.control ?? midpoint(arrow.start, arrow.end),
      }
      editRef.current = {
        arrowId,
        action: handle === "start" || handle === "control" || handle === "end" ? handle : "move",
        origin: { x: event.clientX, y: event.clientY },
        arrow: snapshot,
        basis: relativeControl(snapshot.start, snapshot.end, snapshot.control),
        changed: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      return true
    },
    [arrows, enabled, settingsOpen, setSelectedArrowIds],
  )

  const handleSelectionPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const edit = editRef.current
      if (!edit || event.pointerId !== pointerIdRef.current) return false
      const dx = event.clientX - edit.origin.x
      const dy = event.clientY - edit.origin.y
      if (!edit.changed && (dx !== 0 || dy !== 0)) {
        createActionCommit()()
        edit.changed = true
      }
      if (!edit.changed) return true
      setArrows((previous) => previous.map((arrow) => {
        if (arrow.id !== edit.arrowId) return arrow
        if (edit.action === "move") return translateArrow(edit.arrow, dx, dy)
        if (edit.action === "control") {
          return {
            ...arrow,
            control: {
              x: edit.arrow.control!.x + dx,
              y: edit.arrow.control!.y + dy,
            },
          }
        }
        const start = edit.action === "start"
          ? { x: edit.arrow.start.x + dx, y: edit.arrow.start.y + dy }
          : edit.arrow.start
        const end = edit.action === "end"
          ? { x: edit.arrow.end.x + dx, y: edit.arrow.end.y + dy }
          : edit.arrow.end
        return {
          ...arrow,
          start,
          end,
          control: edit.basis ? controlFromRelative(start, end, edit.basis) : edit.arrow.control,
        }
      }))
      return true
    },
    [createActionCommit, setArrows],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (editRef.current && event.pointerId === pointerIdRef.current) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        editRef.current = null
        pointerIdRef.current = null
        return
      }
      if (drawingRef.current && event.pointerId === drawingRef.current.pointerId) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        clearDrawing()
      }
    },
    [clearDrawing],
  )

  const cancelInteraction = useCallback(() => {
    const edit = editRef.current
    if (edit?.changed) {
      setArrows((previous) => previous.map((arrow) =>
        arrow.id === edit.arrowId ? edit.arrow : arrow,
      ))
    }
    editRef.current = null
    drawingRef.current = null
    pointerIdRef.current = null
    clearDrawing()
  }, [clearDrawing, setArrows])

  const handleSelectionPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!editRef.current || event.pointerId !== pointerIdRef.current) return false
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      editRef.current = null
      pointerIdRef.current = null
      return true
    },
    [],
  )

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handlePointerCancel,
    cancelInteraction,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    handleSelectionPointerUp,
    preview: arrowStart && arrowPreviewEnd
      ? {
          start: arrowStart,
          end: arrowPreviewEnd,
          control: arrowMiddle ?? midpoint(arrowStart, arrowPreviewEnd),
        }
      : null,
  }
}
