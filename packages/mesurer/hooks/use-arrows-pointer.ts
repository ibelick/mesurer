import { useCallback, useRef } from "react"
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react"
import type { Arrow, Point, ToolMode } from "../core/types"
import { createId } from "../core/utils"

const MIN_ARROW_LENGTH = 4

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
  arrowPreviewEnd: Point | null
  setArrowStart: Dispatch<SetStateAction<Point | null>>
  setArrowPreviewEnd: Dispatch<SetStateAction<Point | null>>
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
  arrowPreviewEnd,
  setArrowStart,
  setArrowPreviewEnd,
}: UseArrowsPointerOptions) => {
  const pointerIdRef = useRef<number | null>(null)
  const editRef = useRef<{
    arrowId: string
    action: "move" | "start" | "end"
    origin: Point
    arrow: Arrow
    changed: boolean
  } | null>(null)

  const clearDrawing = useCallback(() => {
    pointerIdRef.current = null
    setArrowStart(null)
    setArrowPreviewEnd(null)
  }, [setArrowPreviewEnd, setArrowStart])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || settingsOpen || event.button !== 0) return
      if (event.target instanceof Element) {
        const arrowId = event.target.getAttribute("data-mesurer-arrow-id")
        if (arrowId) {
          setSelectedArrowIds([arrowId])
          return
        }
      }
      if (event.target !== event.currentTarget) return
      event.preventDefault()
      event.stopPropagation()
      const point = { x: event.clientX, y: event.clientY }
      pointerIdRef.current = event.pointerId
      setArrowStart(point)
      setArrowPreviewEnd(point)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [enabled, settingsOpen, setArrowPreviewEnd, setArrowStart, setSelectedArrowIds],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId || !arrowStart) return
      setArrowPreviewEnd({ x: event.clientX, y: event.clientY })
    },
    [arrowStart, setArrowPreviewEnd],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId || !arrowStart) return
      event.preventDefault()
      event.stopPropagation()
      const end = { x: event.clientX, y: event.clientY }
      const distance = Math.hypot(end.x - arrowStart.x, end.y - arrowStart.y)
      if (distance >= MIN_ARROW_LENGTH) {
        const id = createId()
        createActionCommit()()
        setArrows((previous) => [
          ...previous,
          { id, start: arrowStart, end, color, width },
        ])
        setSelectedArrowIds([id])
        setToolMode("selection")
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      clearDrawing()
    },
    [arrowStart, clearDrawing, color, createActionCommit, setArrows, setSelectedArrowIds, setToolMode, width],
  )

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
      editRef.current = {
        arrowId,
        action: handle === "start" || handle === "end" ? handle : "move",
        origin: { x: event.clientX, y: event.clientY },
        arrow,
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
        if (edit.action === "move") {
          return {
            ...arrow,
            start: { x: edit.arrow.start.x + dx, y: edit.arrow.start.y + dy },
            end: { x: edit.arrow.end.x + dx, y: edit.arrow.end.y + dy },
          }
        }
        return {
          ...arrow,
          [edit.action]: {
            x: edit.arrow[edit.action].x + dx,
            y: edit.arrow[edit.action].y + dy,
          },
        }
      }))
      return true
    },
    [createActionCommit, setArrows],
  )

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

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (editRef.current && event.pointerId === pointerIdRef.current) {
        editRef.current = null
        pointerIdRef.current = null
        return
      }
      if (pointerIdRef.current !== event.pointerId) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      clearDrawing()
    },
    [clearDrawing],
  )

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    handleSelectionPointerUp,
    preview: arrowStart && arrowPreviewEnd
      ? { start: arrowStart, end: arrowPreviewEnd }
      : null,
  }
}
