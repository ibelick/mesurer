import { useLayoutEffect, useRef } from "react"
import {
  placeOverlayPosition,
  type OverlayAvoidAxis,
  type OverlayAvoidRect,
  type OverlayPosition,
} from "../core/overlay-position"

export const useOverlayPosition = ({
  ownerWindow,
  position,
  avoidRect,
  avoidAxis,
  gap = 16,
  enabled = true,
}: {
  ownerWindow: Window | null
  position: OverlayPosition
  avoidRect?: OverlayAvoidRect
  avoidAxis?: OverlayAvoidAxis
  gap?: number
  enabled?: boolean
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef(position)
  const avoidRectRef = useRef(avoidRect)
  const scheduleRef = useRef<() => void>(() => {})
  const sizeRef = useRef<{ width: number; height: number } | null>(null)

  positionRef.current = position
  avoidRectRef.current = avoidRect

  useLayoutEffect(() => {
    if (!enabled || !ownerWindow) return
    const overlay = overlayRef.current
    if (!overlay) return

    const update = () => {
      const size = sizeRef.current ?? overlay.getBoundingClientRect()
      sizeRef.current = { width: size.width, height: size.height }
      const next = placeOverlayPosition({
        position: positionRef.current,
        width: size.width,
        height: size.height,
        viewportWidth: ownerWindow.innerWidth,
        viewportHeight: ownerWindow.innerHeight,
        avoidRect: avoidRectRef.current,
        avoidAxis,
        gap,
      })
      overlay.style.left = `${next.left}px`
      overlay.style.top = `${next.top}px`
    }

    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = ownerWindow.requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }
    scheduleRef.current = schedule
    overlay.style.left = `${position.left}px`
    overlay.style.top = `${position.top}px`
    schedule()
    ownerWindow.addEventListener("resize", schedule)
    ownerWindow.addEventListener("scroll", schedule, true)
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const rect = overlay.getBoundingClientRect()
        sizeRef.current = { width: rect.width, height: rect.height }
      }
      schedule()
    })
    resizeObserver.observe(overlay)
    return () => {
      if (frame) ownerWindow.cancelAnimationFrame(frame)
      scheduleRef.current = () => {}
      ownerWindow.removeEventListener("resize", schedule)
      ownerWindow.removeEventListener("scroll", schedule, true)
      resizeObserver.disconnect()
    }
  }, [avoidAxis, enabled, gap, ownerWindow])

  useLayoutEffect(() => {
    if (enabled) scheduleRef.current()
  }, [avoidRect?.height, avoidRect?.left, avoidRect?.top, avoidRect?.width, enabled, position.left, position.top])

  return { overlayRef }
}
