import { useCallback, useLayoutEffect, useRef, useState } from "react"

type Point = {
  x: number
  y: number
}

const TOOLBAR_DRAG_SLOP = 6

export const useToolbarDrag = (initialPosition: Point, eventTarget: Window) => {
  const [position, setPosition] = useState(initialPosition)
  const suppressClickRef = useRef(false)
  const previousUserSelectRef = useRef<string | null>(null)
  const detachListenersRef = useRef<(() => void) | null>(null)
  const dragRef = useRef({
    active: false,
    didDrag: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    width: 0,
    height: 0,
  })

  const disableTextSelection = useCallback(() => {
    if (previousUserSelectRef.current !== null) return
    const root = eventTarget.document.documentElement
    previousUserSelectRef.current = root.style.userSelect
    root.style.setProperty("user-select", "none", "important")
  }, [eventTarget])

  const restoreTextSelection = useCallback(() => {
    const previous = previousUserSelectRef.current
    if (previous === null) return
    const root = eventTarget.document.documentElement
    root.style.userSelect = previous
    previousUserSelectRef.current = null
  }, [eventTarget])

  useLayoutEffect(() => {
    return () => {
      detachListenersRef.current?.()
      const previous = previousUserSelectRef.current
      if (previous === null) return
      eventTarget.document.documentElement.style.userSelect = previous
      previousUserSelectRef.current = null
    }
  }, [eventTarget])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      disableTextSelection()

      if (detachListenersRef.current) {
        detachListenersRef.current()
        detachListenersRef.current = null
        restoreTextSelection()
      }

      const state = dragRef.current
      state.active = false
      state.didDrag = false
      state.pointerId = event.pointerId
      state.startX = event.clientX
      state.startY = event.clientY
      state.originX = position.x
      state.originY = position.y
      const rect = event.currentTarget.getBoundingClientRect()
      state.width = rect.width
      state.height = rect.height

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const current = dragRef.current
        if (current.pointerId !== moveEvent.pointerId) return

        const dx = moveEvent.clientX - current.startX
        const dy = moveEvent.clientY - current.startY

        if (!current.active) {
          current.active =
            Math.abs(dx) > TOOLBAR_DRAG_SLOP ||
            Math.abs(dy) > TOOLBAR_DRAG_SLOP
        }

        if (!current.active) return

        current.didDrag = true
        const maxX = Math.max(8, eventTarget.innerWidth - current.width - 8)
        const maxY = Math.max(8, eventTarget.innerHeight - current.height - 8)
        setPosition({
          x: Math.min(maxX, Math.max(8, current.originX + dx)),
          y: Math.min(maxY, Math.max(8, current.originY + dy)),
        })
      }

      const handlePointerEnd = (endEvent: PointerEvent) => {
        const current = dragRef.current
        if (
          current.pointerId !== endEvent.pointerId &&
          current.pointerId !== -1
        )
          return
        suppressClickRef.current = current.didDrag
        restoreTextSelection()
        current.active = false
        current.didDrag = false
        current.pointerId = -1

        eventTarget.removeEventListener("pointermove", handlePointerMove)
        eventTarget.removeEventListener("pointerup", handlePointerEnd)
        eventTarget.removeEventListener("pointercancel", handlePointerEnd)
        detachListenersRef.current = null
      }

      eventTarget.addEventListener("pointermove", handlePointerMove)
      eventTarget.addEventListener("pointerup", handlePointerEnd)
      eventTarget.addEventListener("pointercancel", handlePointerEnd)
      detachListenersRef.current = () => {
        eventTarget.removeEventListener("pointermove", handlePointerMove)
        eventTarget.removeEventListener("pointerup", handlePointerEnd)
        eventTarget.removeEventListener("pointercancel", handlePointerEnd)
      }
    },
    [disableTextSelection, eventTarget, position.x, position.y, restoreTextSelection],
  )

  const onClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) return
      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
    },
    [],
  )

  return { position, onPointerDown, onClickCapture }
}
