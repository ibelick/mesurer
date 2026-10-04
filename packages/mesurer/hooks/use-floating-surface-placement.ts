import { useLayoutEffect, useRef, useState, type RefObject } from "react"

const DEFAULT_HEIGHT = 500
const VIEWPORT_PADDING = 8

export type FloatingSurfacePlacement = {
  side: "top" | "bottom"
  height: number
  right: number
  left?: number
  top?: number
  bottom?: number
}

export function getFloatingSurfacePlacement({
  anchor,
  surfaceWidth,
  viewportWidth,
  viewportHeight,
  align,
  gap,
  rightOffset,
}: {
  anchor: Pick<DOMRect, "left" | "right" | "top" | "bottom">
  surfaceWidth: number
  viewportWidth: number
  viewportHeight: number
  align: "left" | "right"
  gap: number
  rightOffset: number
}): FloatingSurfacePlacement {
  const availableTop = Math.max(0, anchor.top - gap)
  const availableBottom = Math.max(0, viewportHeight - anchor.bottom - gap)
  const side = availableBottom >= DEFAULT_HEIGHT || availableBottom >= availableTop ? "bottom" : "top"
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING - surfaceWidth)
  const desiredLeft = align === "left" ? anchor.left : anchor.right + rightOffset - surfaceWidth
  const left = Math.min(maxLeft, Math.max(VIEWPORT_PADDING, desiredLeft))

  return {
    side,
    height: Math.min(DEFAULT_HEIGHT, side === "bottom" ? availableBottom : availableTop),
    right: viewportWidth - left - surfaceWidth,
    ...(align === "left" ? { left } : {}),
    ...(side === "bottom"
      ? { top: anchor.bottom + gap }
      : { bottom: viewportHeight - anchor.top + gap }),
  }
}

export const useFloatingSurfacePlacement = ({
  anchorRef,
  eventTarget,
  open,
  refreshKey,
  align = "right",
  gap = 8,
  rightOffset = 4,
}: {
  anchorRef: RefObject<HTMLElement | null>
  eventTarget: Window
  open: boolean
  refreshKey?: string | number
  align?: "left" | "right"
  gap?: number
  rightOffset?: number
}) => {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<FloatingSurfacePlacement>({
    side: "bottom",
    height: DEFAULT_HEIGHT,
    right: -4,
  })

  useLayoutEffect(() => {
    if (!open) return

    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const surface = surfaceRef.current?.getBoundingClientRect()
      if (!anchor || !surface) return
      setPlacement(getFloatingSurfacePlacement({
        anchor,
        surfaceWidth: surface.width,
        viewportWidth: eventTarget.innerWidth,
        viewportHeight: eventTarget.innerHeight,
        align,
        gap,
        rightOffset,
      }))
    }

    measure()
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null
    if (anchorRef.current) observer?.observe(anchorRef.current)
    if (surfaceRef.current) observer?.observe(surfaceRef.current)
    eventTarget.addEventListener("resize", measure)
    eventTarget.addEventListener("scroll", measure, true)
    return () => {
      observer?.disconnect()
      eventTarget.removeEventListener("resize", measure)
      eventTarget.removeEventListener("scroll", measure, true)
    }
  }, [align, anchorRef, eventTarget, gap, open, refreshKey, rightOffset])

  return { surfaceRef, menuRef: surfaceRef, placement }
}
