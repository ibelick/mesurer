import { useLayoutEffect, useRef, useState, type RefObject } from "react"

const DEFAULT_HEIGHT = 500
const VIEWPORT_PADDING = 8

export type FloatingSurfacePlacement = {
  side: "top" | "bottom"
  height: number
  right?: number
  left?: number
  top?: number
  bottom?: number
}

// The CSS that puts a fixed surface at its placement. A surface lined up by its right edge is
// pinned from the right, so it grows leftward when its content changes.
export const surfaceStyle = ({ top, bottom, left, right }: FloatingSurfacePlacement) => ({
  top,
  bottom,
  ...(left !== undefined ? { left } : { right }),
})

type Span = { start: number; end: number }

// Where a surface starts along the toolbar: lined up with its anchor, then kept within the
// toolbar's own span when it fits there and centered on the toolbar when it does not, and
// always on screen.
const alongToolbar = ({
  desired,
  size,
  bar,
  viewport,
}: {
  desired: number
  size: number
  bar?: Span
  viewport: number
}) => {
  let start = desired
  if (bar) {
    start = size <= bar.end - bar.start
      ? Math.min(bar.end - size, Math.max(bar.start, desired))
      : (bar.start + bar.end - size) / 2
  }
  const max = Math.max(VIEWPORT_PADDING, viewport - VIEWPORT_PADDING - size)
  return Math.min(max, Math.max(VIEWPORT_PADDING, start))
}

export function getFloatingSurfacePlacement({
  anchor,
  bar,
  surfaceWidth,
  viewportWidth,
  viewportHeight,
  align,
  gap,
  rightOffset,
  side = "auto",
  sideOfAnchor,
  surfaceHeight = 0,
}: {
  anchor: Pick<DOMRect, "left" | "right" | "top" | "bottom">
  // The toolbar the anchor belongs to: surfaces stay within its span when they fit.
  bar?: Pick<DOMRect, "left" | "right" | "top" | "bottom">
  surfaceWidth: number
  viewportWidth: number
  viewportHeight: number
  align: "left" | "right"
  gap: number
  rightOffset: number
  side?: "auto" | "top" | "bottom"
  // Places the surface beside the anchor (for a toolbar docked to a vertical edge).
  sideOfAnchor?: "left" | "right"
  surfaceHeight?: number
}): FloatingSurfacePlacement {
  if (sideOfAnchor) {
    const maxRight = Math.max(VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING - surfaceWidth)
    return {
      side: "bottom",
      height: Math.min(DEFAULT_HEIGHT, Math.max(0, viewportHeight - VIEWPORT_PADDING * 2)),
      top: alongToolbar({
        desired: anchor.top,
        size: surfaceHeight,
        bar: bar && { start: bar.top, end: bar.bottom },
        viewport: viewportHeight,
      }),
      ...(sideOfAnchor === "right"
        ? { left: Math.min(maxRight, anchor.right + gap) }
        : { right: Math.min(maxRight, viewportWidth - anchor.left + gap) }),
    }
  }

  const availableTop = Math.max(0, anchor.top - gap)
  const availableBottom = Math.max(0, viewportHeight - anchor.bottom - gap)
  const placementSide = side === "auto"
    ? (availableBottom >= DEFAULT_HEIGHT || availableBottom >= availableTop ? "bottom" : "top")
    : side
  const left = alongToolbar({
    desired: align === "left" ? anchor.left : anchor.right + rightOffset - surfaceWidth,
    size: surfaceWidth,
    bar: bar && { start: bar.left, end: bar.right },
    viewport: viewportWidth,
  })

  return {
    side: placementSide,
    height: Math.min(DEFAULT_HEIGHT, placementSide === "bottom" ? availableBottom : availableTop),
    right: viewportWidth - left - surfaceWidth,
    ...(align === "left" ? { left } : {}),
    ...(placementSide === "bottom"
      ? { top: anchor.bottom + gap }
      : { bottom: viewportHeight - anchor.top + gap }),
  }
}

export const useFloatingSurfacePlacement = ({
  anchorRef,
  barRef,
  eventTarget,
  open,
  refreshKey,
  align = "right",
  gap = 8,
    rightOffset = 4,
    side = "auto",
  sideOfAnchor,
  follow = false,
}: {
  anchorRef: RefObject<HTMLElement | null>
  barRef?: RefObject<HTMLElement | null>
  eventTarget: Window
  open: boolean
  refreshKey?: string | number
  align?: "left" | "right"
  gap?: number
  rightOffset?: number
  side?: "auto" | "top" | "bottom"
  sideOfAnchor?: "left" | "right"
  // Place the surface again on every frame, while its anchor is being animated into place.
  follow?: boolean
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
        bar: barRef?.current?.getBoundingClientRect(),
        surfaceWidth: surface.width,
        viewportWidth: eventTarget.innerWidth,
        viewportHeight: eventTarget.innerHeight,
        align,
        gap,
        rightOffset,
        side,
        sideOfAnchor,
        surfaceHeight: surface.height,
      }))
    }

    measure()
    let frame = 0
    if (follow) {
      frame = eventTarget.requestAnimationFrame(function track() {
        measure()
        frame = eventTarget.requestAnimationFrame(track)
      })
    }
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null
    if (anchorRef.current) observer?.observe(anchorRef.current)
    if (surfaceRef.current) observer?.observe(surfaceRef.current)
    eventTarget.addEventListener("resize", measure)
    eventTarget.addEventListener("scroll", measure, true)
    return () => {
      eventTarget.cancelAnimationFrame(frame)
      observer?.disconnect()
      eventTarget.removeEventListener("resize", measure)
      eventTarget.removeEventListener("scroll", measure, true)
    }
  }, [align, anchorRef, barRef, eventTarget, follow, gap, open, refreshKey, rightOffset, side, sideOfAnchor])

  return { surfaceRef, placement }
}
