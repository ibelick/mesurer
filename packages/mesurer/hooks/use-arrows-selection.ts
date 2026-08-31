import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react"
import { controlFromRelative, midpoint, relativeControl, translateArrow } from "../core/arrows"
import { transformedArrowPoints } from "../core/arrow-transform"
import type { Arrow, Point } from "../core/types"

type EditState = {
  arrowId: string
  action: "move" | "start" | "control" | "end"
  origin: Point
  arrow: Arrow
  basis: ReturnType<typeof relativeControl> | null
  changed: boolean
  last: Point
}
type UseArrowsSelectionOptions = {
  enabled: boolean
  settingsOpen: boolean
  arrows: Arrow[]
  selectedArrowIds: string[]
  createActionCommit: () => () => void
  setArrows: Dispatch<SetStateAction<Arrow[]>>
  setSelectedArrowIds: Dispatch<SetStateAction<string[]>>
  clearOtherSelections?: () => void
  onMove?: (id: string, dx: number, dy: number) => void
  pointerIdRef: MutableRefObject<number | null>
}

export const useArrowsSelection = ({
  enabled,
  settingsOpen,
  arrows,
  selectedArrowIds,
  createActionCommit,
  setArrows,
  setSelectedArrowIds,
  clearOtherSelections,
  onMove,
  pointerIdRef,
}: UseArrowsSelectionOptions) => {
  const [editingArrowId, setEditingArrowId] = useState<string | null>(null)
  const editRef = useRef<EditState | null>(null)
  const handleSelectionPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || settingsOpen || event.button !== 0 || !(event.target instanceof Element)) {
      return false
    }
    const arrowId = event.target.getAttribute("data-mesurer-arrow-id")
    const arrow = arrowId ? arrows.find((item) => item.id === arrowId) : undefined
    if (!arrow) return false
    const selectedArrowId = arrowId!
    const handle = event.target.getAttribute("data-mesurer-arrow-handle")
    event.preventDefault()
    event.stopPropagation()

    const alreadySelected = selectedArrowIds.includes(selectedArrowId)
    if (event.shiftKey) {
      setSelectedArrowIds((previous) => {
        if (alreadySelected) {
          return previous.filter((id) => id !== selectedArrowId)
        }

        return [...previous, selectedArrowId]
      })
      return true
    }

    if (!alreadySelected) {
      clearOtherSelections?.()
      setSelectedArrowIds([selectedArrowId])
    }

    pointerIdRef.current = event.pointerId
    const snapshot = { ...arrow, control: arrow.control ?? midpoint(arrow.start, arrow.end) }
    const isHandle = handle === "start" || handle === "control" || handle === "end"
    if (isHandle) {
      const points = transformedArrowPoints(arrow)
      snapshot.start = points[0]!
      snapshot.control = points[1]!
      snapshot.end = points[2]!
      snapshot.rotation = 0
      setArrows((previous) => previous.map((item) => {
        if (item.id === arrow.id) {
          return snapshot
        }

        return item
      }))
    }

    editRef.current = {
      arrowId: selectedArrowId,
      action: isHandle ? handle : "move",
      origin: { x: event.clientX, y: event.clientY },
      arrow: snapshot,
      basis: relativeControl(snapshot.start, snapshot.end, snapshot.control),
      changed: false,
      last: { x: event.clientX, y: event.clientY },
    }
    if (isHandle) {
      setEditingArrowId(selectedArrowId)
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    return true
  }, [arrows, clearOtherSelections, enabled, pointerIdRef, selectedArrowIds, setArrows, setSelectedArrowIds, settingsOpen])
  const handleSelectionPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const edit = editRef.current
    if (!edit || event.pointerId !== pointerIdRef.current) {
      return false
    }
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

    let anchor: Point
    if (edit.action === "start") {
      anchor = edit.arrow.start
    } else if (edit.action === "control") {
      anchor = edit.arrow.control ?? midpoint(edit.arrow.start, edit.arrow.end)
    } else {
      anchor = edit.arrow.end
    }

    const localPointer = { x: anchor.x + dx, y: anchor.y + dy }
    setArrows((previous) => previous.map((arrow) => {
      if (arrow.id !== edit.arrowId) {
        return arrow
      }
      if (edit.action === "move") {
        return translateArrow(edit.arrow, dx, dy)
      }
      if (edit.action === "control") {
        return { ...arrow, control: localPointer }
      }

      const start = edit.action === "start" ? localPointer : edit.arrow.start
      const end = edit.action === "end" ? localPointer : edit.arrow.end
      return {
        ...arrow,
        start,
        end,
        control: edit.basis ? controlFromRelative(start, end, edit.basis) : edit.arrow.control,
      }
    }))
    return true
  }, [createActionCommit, onMove, pointerIdRef, setArrows])
  const handleSelectionPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editRef.current || event.pointerId !== pointerIdRef.current) {
      return false
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    editRef.current = null
    pointerIdRef.current = null
    setEditingArrowId(null)
    return true
  }, [pointerIdRef])
  const clearEditing = useCallback(() => {
    setEditingArrowId(null)
  }, [])
  return {
    editRef,
    editingArrowId,
    clearEditing,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    handleSelectionPointerUp,
  }
}
