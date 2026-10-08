import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react"

type Point = {
  x: number
  y: number
}

const TOOLBAR_DRAG_SLOP = 6
const IGNORE_DRAG = "input, textarea, select, [contenteditable], [data-slider-container], [role='menu'], [role='dialog']"

export const useToolbarDrag = (
  initialPosition: Point,
  eventTarget: Window,
  onDragStart?: () => void,
  onPositionChange?: (position: Point) => void,
  // Lets the caller adjust each dragged position, e.g. to glue the toolbar to an edge.
  // When `rebase` is true the drag continues from the returned point instead of the original grab point.
  constrain?: (point: Point, size: { width: number; height: number }) => { point: Point; rebase: boolean },
) => {
  const [position, setPosition] = useState(initialPosition)
  const positionRef = useRef(position)
  positionRef.current = position
  const suppressClickRef = useRef(false)
  const onDragStartRef = useRef(onDragStart)
  onDragStartRef.current = onDragStart
  const constrainRef = useRef(constrain)
  constrainRef.current = constrain
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange
  const dragRef = useRef({
    pointerId: -1,
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    width: 0,
    height: 0,
    lastX: 0,
    lastY: 0,
    detach: () => {},
  })

  // Pointer moves and release are read from the window, so a drag keeps going when the pointer
  // leaves the toolbar (for example while the toolbar is held at a screen edge).
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const target = event.target as { closest?: (value: string) => Element | null }
      if (target.closest?.(IGNORE_DRAG)) return
      suppressClickRef.current = false
      const state = dragRef.current
      state.detach()
      state.pointerId = event.pointerId
      state.dragging = false
      state.startX = event.clientX
      state.startY = event.clientY
      state.originX = position.x
      state.originY = position.y
      const rect = event.currentTarget.getBoundingClientRect()
      state.width = rect.width
      state.height = rect.height

      const onWindowMove = (moveEvent: PointerEvent) => {
        const current = dragRef.current
        if (current.pointerId !== moveEvent.pointerId) return
        current.lastX = moveEvent.clientX
        current.lastY = moveEvent.clientY
        const dx = moveEvent.clientX - current.startX
        const dy = moveEvent.clientY - current.startY
        if (!current.dragging) {
          if (Math.abs(dx) <= TOOLBAR_DRAG_SLOP && Math.abs(dy) <= TOOLBAR_DRAG_SLOP) return
          current.dragging = true
          onDragStartRef.current?.()
        }
        const maxX = Math.max(8, eventTarget.innerWidth - current.width - 8)
        const maxY = Math.max(8, eventTarget.innerHeight - current.height - 8)
        const free = {
          x: Math.min(maxX, Math.max(8, current.originX + dx)),
          y: Math.min(maxY, Math.max(8, current.originY + dy)),
        }
        const size = { width: current.width, height: current.height }
        const result = constrainRef.current ? constrainRef.current(free, size) : { point: free, rebase: false }
        if (result.rebase) {
          current.startX = moveEvent.clientX
          current.startY = moveEvent.clientY
          current.originX = result.point.x
          current.originY = result.point.y
        }
        setPosition(result.point)
      }
      const onWindowEnd = (endEvent: PointerEvent) => {
        const current = dragRef.current
        if (current.pointerId !== endEvent.pointerId) return
        const dragged = current.dragging
        suppressClickRef.current = dragged
        current.pointerId = -1
        current.dragging = false
        state.detach()
        if (dragged) onPositionChangeRef.current?.(positionRef.current)
      }
      eventTarget.addEventListener("pointermove", onWindowMove)
      eventTarget.addEventListener("pointerup", onWindowEnd)
      eventTarget.addEventListener("pointercancel", onWindowEnd)
      state.detach = () => {
        eventTarget.removeEventListener("pointermove", onWindowMove)
        eventTarget.removeEventListener("pointerup", onWindowEnd)
        eventTarget.removeEventListener("pointercancel", onWindowEnd)
        state.detach = () => {}
      }
    },
    [eventTarget, position.x, position.y],
  )

  // Continues an active drag from `point`, so later moves are relative to where the caller put the toolbar.
  const rebaseDrag = useCallback((point: Point) => {
    const current = dragRef.current
    if (!current.dragging) return
    current.startX = current.lastX
    current.startY = current.lastY
    current.originX = point.x
    current.originY = point.y
  }, [])

  const consumeDragClick = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  const onClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!consumeDragClick()) return
      event.preventDefault()
      event.stopPropagation()
    },
    [consumeDragClick],
  )

  return {
    position,
    setPosition,
    rebaseDrag,
    onPointerDown,
    onClickCapture,
    consumeDragClick,
  }
}
