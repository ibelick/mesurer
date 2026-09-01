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
import { eventView, isPointerDragActive, listenPointerDrag } from "../core/pointer-drag"
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
  onBeginMove?: (id: string) => void
  onDragMove?: (dx: number, dy: number) => void
  onMoveEnd?: () => void
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
  onBeginMove,
  onDragMove,
  onMoveEnd,
  pointerIdRef,
}: UseArrowsSelectionOptions) => {
  const [editingArrowId, setEditingArrowId] = useState<string | null>(null)
  const editRef = useRef<EditState | null>(null)
  const handleSelectionPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || settingsOpen || event.button !== 0 || !(event.target instanceof Element)) {
      return false
    }
    const arrowNode = event.target.closest("[data-mesurer-arrow-id]")
    const arrowId = arrowNode instanceof Element ? arrowNode.getAttribute("data-mesurer-arrow-id") : null
    const arrow = arrowId ? arrows.find((item) => item.id === arrowId) : undefined
    if (!arrow || !arrowId) return false
    const handle = arrowNode instanceof Element ? arrowNode.getAttribute("data-mesurer-arrow-handle") : null
    event.preventDefault()
    event.stopPropagation()

    const alreadySelected = selectedArrowIds.includes(arrowId)
    if (event.shiftKey) {
      setSelectedArrowIds((previous) => {
        if (alreadySelected) {
          return previous.filter((id) => id !== arrowId)
        }

        return [...previous, arrowId]
      })
      return true
    }

    if (!alreadySelected) {
      clearOtherSelections?.()
      setSelectedArrowIds([arrowId])
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
      arrowId,
      action: isHandle ? handle : "move",
      origin: { x: event.clientX, y: event.clientY },
      arrow: snapshot,
      basis: relativeControl(snapshot.start, snapshot.end, snapshot.control),
      changed: false,
      last: { x: event.clientX, y: event.clientY },
    }
    if (isHandle) {
      setEditingArrowId(arrowId)
    } else {
      onBeginMove?.(arrowId)
    }

    const view = eventView(event)
    if (view) {
      listenPointerDrag(event.pointerId, view, { x: event.clientX, y: event.clientY }, {
        onMove: (dx, dy) => {
          const edit = editRef.current
          if (!edit) return
          if (!edit.changed && (dx !== 0 || dy !== 0)) {
            createActionCommit()()
            edit.changed = true
          }
          if (!edit.changed) return
          if (edit.action === "move") {
            if (onDragMove) {
              onDragMove(dx, dy)
              return
            }
            setArrows((previous) => previous.map((item) => (
              item.id === edit.arrowId ? translateArrow(edit.arrow, dx, dy) : item
            )))
            return
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
          setArrows((previous) => previous.map((item) => {
            if (item.id !== edit.arrowId) return item
            if (edit.action === "control") {
              return { ...item, control: localPointer }
            }
            const start = edit.action === "start" ? localPointer : edit.arrow.start
            const end = edit.action === "end" ? localPointer : edit.arrow.end
            return {
              ...item,
              start,
              end,
              control: edit.basis ? controlFromRelative(start, end, edit.basis) : edit.arrow.control,
            }
          }))
        },
        onEnd: () => {
          editRef.current = null
          pointerIdRef.current = null
          setEditingArrowId(null)
          onMoveEnd?.()
        },
      })
    }
    return true
  }, [
    arrows,
    clearOtherSelections,
    createActionCommit,
    enabled,
    onBeginMove,
    onDragMove,
    onMoveEnd,
    pointerIdRef,
    selectedArrowIds,
    setArrows,
    setSelectedArrowIds,
    settingsOpen,
  ])
  const handleSelectionPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPointerDragActive()) return true
    const edit = editRef.current
    if (!edit || event.pointerId !== pointerIdRef.current) {
      return false
    }
    return true
  }, [pointerIdRef])
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
