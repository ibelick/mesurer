import { useCallback, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from "react"
import { getSnapArrowPoint } from "../core/arrows-snap"
import { midpoint, relativeControl, controlFromRelative, translateArrow } from "../core/arrows"
import { transformedArrowPoints } from "../core/arrow-transform"
import type { Arrow, Guide, Point } from "../core/types"
import { createId } from "../core/utils"

const MIN_ARROW_LENGTH = 4
const SLIDE_THRESHOLD = 8

type UseArrowsPointerOptions = {
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
  setArrows: Dispatch<SetStateAction<Arrow[]>>
  setSelectedArrowIds: Dispatch<SetStateAction<string[]>>
  clearOtherSelections?: () => void
  arrows: Arrow[]
  selectedArrowIds: string[]
  arrowStart: Point | null
  arrowMiddle: Point | null
  arrowPreviewEnd: Point | null
  setArrowStart: Dispatch<SetStateAction<Point | null>>
  setArrowMiddle: Dispatch<SetStateAction<Point | null>>
  setArrowPreviewEnd: Dispatch<SetStateAction<Point | null>>
  scrollOffset: Point
  onMove?: (id: string, dx: number, dy: number) => void
}

export const useArrowsPointer = ({
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
  setArrows,
  setSelectedArrowIds,
  clearOtherSelections,
  arrows,
  selectedArrowIds,
  arrowStart,
  arrowMiddle,
  arrowPreviewEnd,
  setArrowStart,
  setArrowMiddle,
  setArrowPreviewEnd,
  scrollOffset,
  onMove,
}: UseArrowsPointerOptions) => {
  const [editingArrowId, setEditingArrowId] = useState<string | null>(null)
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
    last: Point
  } | null>(null)

  const pagePoint = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): Point => ({
      x: event.clientX + scrollOffset.x,
      y: event.clientY + scrollOffset.y,
    }),
    [scrollOffset],
  )

  const snapPoint = useCallback(
    (point: Point) =>
      getSnapArrowPoint({
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
    },
     [color, createActionCommit, setArrows, setSelectedArrowIds, width],
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
    },
    [arrowStart, enabled, pagePoint, settingsOpen, setArrowPreviewEnd, setArrowStart, setSelectedArrowIds, snapPoint],
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
      setArrowPreviewEnd(snapPoint(pagePoint(event)))
    },
    [arrowStart, pagePoint, setArrowPreviewEnd, snapPoint],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drawing = drawingRef.current
      if (!drawing || event.pointerId !== drawing.pointerId) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      drawingRef.current = null
      const point = snapPoint(pagePoint(event))
      if (!arrowStart) return

      if (drawing.fromStart) {
        if (arrowClickToPlace) return
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
    },
    [arrowClickToPlace, arrowMiddle, arrowStart, clearDrawing, commitArrow, pagePoint, setArrowMiddle, setArrowPreviewEnd, snapPoint],
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
      const alreadySelected = selectedArrowIds.includes(arrowId)
      if (event.shiftKey) {
        setSelectedArrowIds((previous) => alreadySelected
          ? previous.filter((id) => id !== arrowId)
          : [...previous, arrowId])
        return true
      }
       if (!alreadySelected) {
         clearOtherSelections?.()
         setSelectedArrowIds([arrowId])
       }
      pointerIdRef.current = event.pointerId
       const snapshot = {
         ...arrow,
         control: arrow.control ?? midpoint(arrow.start, arrow.end),
       }
       if (handle === "start" || handle === "control" || handle === "end") {
         const points = transformedArrowPoints(arrow)
         snapshot.start = points[0]!
         snapshot.control = points[1]!
         snapshot.end = points[2]!
         snapshot.rotation = 0
         setArrows((previous) => previous.map((item) => item.id === arrow.id ? snapshot : item))
       }
      editRef.current = {
        arrowId,
        action: handle === "start" || handle === "control" || handle === "end" ? handle : "move",
        origin: { x: event.clientX, y: event.clientY },
        arrow: snapshot,
        basis: relativeControl(snapshot.start, snapshot.end, snapshot.control),
        changed: false,
        last: { x: event.clientX, y: event.clientY },
      }
      if (handle === "start" || handle === "control" || handle === "end") setEditingArrowId(arrowId)
      event.currentTarget.setPointerCapture(event.pointerId)
      return true
    },
    [arrows, clearOtherSelections, enabled, selectedArrowIds, settingsOpen, setSelectedArrowIds],
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
       if (edit.action === "move" && onMove) {
        onMove(edit.arrowId, event.clientX - edit.last.x, event.clientY - edit.last.y)
        edit.last = { x: event.clientX, y: event.clientY }
         return true
       }
        const localPointer = (() => {
          const dx = event.clientX - edit.origin.x
          const dy = event.clientY - edit.origin.y
          const anchor = edit.action === "start"
            ? edit.arrow.start
            : edit.action === "control"
              ? edit.arrow.control ?? midpoint(edit.arrow.start, edit.arrow.end)
              : edit.arrow.end
          return { x: anchor.x + dx, y: anchor.y + dy }
        })()
       setArrows((previous) => previous.map((arrow) => {
        if (arrow.id !== edit.arrowId) return arrow
        if (edit.action === "move") return translateArrow(edit.arrow, dx, dy)
         if (edit.action === "control") {
           const control = localPointer
          return {
            ...arrow,
            control,
          }
        }
         const start = edit.action === "start"
           ? localPointer
          : edit.arrow.start
         const end = edit.action === "end"
           ? localPointer
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
    [createActionCommit, onMove, pagePoint, scrollOffset, setArrows, snapPoint],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (editRef.current && event.pointerId === pointerIdRef.current) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        editRef.current = null
        setEditingArrowId(null)
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
    setEditingArrowId(null)
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
      setEditingArrowId(null)
      return true
    },
    [],
  )

  const hasActiveInteraction = useCallback(
    () => Boolean(drawingRef.current || editRef.current),
    [],
  )

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handlePointerCancel,
    cancelInteraction,
    hasActiveInteraction,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    handleSelectionPointerUp,
    editingArrowId,
    preview: arrowStart && arrowPreviewEnd
      ? {
          start: arrowStart,
          end: arrowPreviewEnd,
          control: arrowMiddle ?? midpoint(arrowStart, arrowPreviewEnd),
        }
      : null,
  }
}
