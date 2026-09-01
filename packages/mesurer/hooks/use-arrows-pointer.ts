import {
  useCallback,
  useRef,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import type { Arrow, Guide, Point, ToolMode } from "../core/types"
import { abortPointerDrag } from "../core/pointer-drag"
import { midpoint } from "../core/arrows"
import { useArrowsDrawing } from "./use-arrows-drawing"
import { useArrowsSelection } from "./use-arrows-selection"

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
  setToolMode: Dispatch<SetStateAction<ToolMode>>
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
  onBeginMove?: (id: string) => void
  onDragMove?: (dx: number, dy: number) => void
  onMoveEnd?: () => void
}

export const useArrowsPointer = (options: UseArrowsPointerOptions) => {
  const pointerIdRef = useRef<number | null>(null)
  const drawing = useArrowsDrawing({ ...options, pointerIdRef })
  const selection = useArrowsSelection({ ...options, pointerIdRef })

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (selection.editRef.current && event.pointerId === pointerIdRef.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      selection.editRef.current = null
      selection.clearEditing()
      pointerIdRef.current = null
      return
    }

    if (drawing.drawingRef.current && event.pointerId === drawing.drawingRef.current.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      drawing.clearDrawing()
    }
  }, [drawing, pointerIdRef, selection.editRef])

  const cancelInteraction = useCallback(() => {
    abortPointerDrag()
    const edit = selection.editRef.current
    if (edit?.changed) {
      options.setArrows((previous) => previous.map((arrow) => {
        if (arrow.id === edit.arrowId) {
          return edit.arrow
        }

        return arrow
      }))
    }

    selection.editRef.current = null
    selection.clearEditing()
    pointerIdRef.current = null
    drawing.drawingRef.current = null
    drawing.clearDrawing()
  }, [drawing, options.setArrows, pointerIdRef, selection.editRef])

  return {
    handlePointerDown: drawing.handlePointerDown,
    handlePointerMove: drawing.handlePointerMove,
    handlePointerUp: drawing.handlePointerUp,
    handlePointerLeave: drawing.handlePointerLeave,
    handlePointerCancel,
    cancelInteraction,
    hasActiveInteraction: useCallback(
      () => Boolean(drawing.drawingRef.current || selection.editRef.current),
      [drawing.drawingRef, selection.editRef],
    ),
    handleSelectionPointerDown: selection.handleSelectionPointerDown,
    handleSelectionPointerMove: selection.handleSelectionPointerMove,
    handleSelectionPointerUp: selection.handleSelectionPointerUp,
    editingArrowId: selection.editingArrowId,
    preview: options.arrowStart && options.arrowPreviewEnd
      ? {
          start: options.arrowStart,
          end: options.arrowPreviewEnd,
          control: options.arrowMiddle ?? midpoint(options.arrowStart, options.arrowPreviewEnd),
        }
      : null,
  }
}
