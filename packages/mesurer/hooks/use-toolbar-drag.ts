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
) => {
  const [position, setPosition] = useState(initialPosition)
  const positionRef = useRef(position)
  positionRef.current = position
  const suppressClickRef = useRef(false)
  const onDragStartRef = useRef(onDragStart)
  onDragStartRef.current = onDragStart
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
  })

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const target = event.target as { closest?: (value: string) => Element | null }
      if (target.closest?.(IGNORE_DRAG)) return
      suppressClickRef.current = false
      const state = dragRef.current
      state.pointerId = event.pointerId
      state.dragging = false
      state.startX = event.clientX
      state.startY = event.clientY
      state.originX = position.x
      state.originY = position.y
      const rect = event.currentTarget.getBoundingClientRect()
      state.width = rect.width
      state.height = rect.height
    },
    [position.x, position.y],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = dragRef.current
      if (current.pointerId !== event.pointerId) return
      const dx = event.clientX - current.startX
      const dy = event.clientY - current.startY
      if (!current.dragging) {
        if (Math.abs(dx) <= TOOLBAR_DRAG_SLOP && Math.abs(dy) <= TOOLBAR_DRAG_SLOP) return
        current.dragging = true
        event.currentTarget.setPointerCapture(event.pointerId)
        onDragStartRef.current?.()
      }
      const maxX = Math.max(8, eventTarget.innerWidth - current.width - 8)
      const maxY = Math.max(8, eventTarget.innerHeight - current.height - 8)
      setPosition({
        x: Math.min(maxX, Math.max(8, current.originX + dx)),
        y: Math.min(maxY, Math.max(8, current.originY + dy)),
      })
    },
    [eventTarget],
  )

  const onPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    if (current.pointerId !== event.pointerId) return
    const dragged = current.dragging
    suppressClickRef.current = dragged
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    current.pointerId = -1
    current.dragging = false
    if (dragged) onPositionChangeRef.current?.(positionRef.current)
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
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onClickCapture,
    consumeDragClick,
  }
}
