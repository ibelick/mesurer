import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import type { ToolbarSide } from "../core/persistence"

// How long an auto-hidden bar stays out once the pointer has left it.
const TUCK_DELAY_MS = 600
// A little longer than the slide in and out of view takes (260ms in styles.css).
const TUCK_SLIDE_MS = 320

// Auto-hide: a bar glued to an edge slides mostly out of view until the pointer comes back.
// `busy` keeps it out: something hangs off it, or it is being dragged.
export const useToolbarAutoHide = ({
  eventTarget,
  barRef,
  enabled,
  edge,
  minimized,
  busy,
}: {
  eventTarget: Window
  barRef: RefObject<HTMLElement | null>
  enabled: boolean
  edge: ToolbarSide | null
  minimized: boolean
  busy: boolean
}) => {
  const idle = enabled && edge !== null && !busy
  // The bar comes out as soon as the pointer is within reach of its edge, not only over the tab,
  // or the keyboard reaches it, and only goes back a moment after they have left. Just dropped
  // or just used, it starts out and waits that same moment, so it is seen landing before it hides.
  const [revealed, setRevealed] = useState(false)
  // A press that began off the bar (a guide, a stroke, a region being drawn) keeps it hidden
  // until it ends, however close to the bar's edge it goes.
  const [pressedOff, setPressedOff] = useState(false)
  // New on the page or just opened from its closed state, it stays out until the pointer has
  // reached it: it shows that it is there, and the pointer may be anywhere when a page loads or
  // a shortcut opens it. Kept in a ref, so it outlives the effect below being run again.
  const awaitedRef = useRef(true)
  const wasMinimizedRef = useRef(minimized)
  useLayoutEffect(() => {
    if (wasMinimizedRef.current && !minimized) awaitedRef.current = true
    wasMinimizedRef.current = minimized
    if (!idle) {
      // Only a bar that would otherwise be hiding is waited on.
      awaitedRef.current = false
      setRevealed(busy)
      setPressedOff(false)
      return
    }
    let timer: number | undefined
    const bar = barRef.current
    const hideSoon = () => {
      // Not before the pointer has been to it, nor while the keyboard is on it.
      if (awaitedRef.current || bar?.querySelector(":focus-visible")) return
      timer ??= eventTarget.setTimeout(() => {
        timer = undefined
        setRevealed(false)
      }, TUCK_DELAY_MS)
    }
    const reach = 48
    const onPointerMove = (event: PointerEvent) => {
      const rect = barRef.current?.getBoundingClientRect()
      if (!rect) return
      const { innerWidth: width, innerHeight: height } = eventTarget
      const alongX = event.clientX >= rect.left - 16 && event.clientX <= rect.right + 16
      const alongY = event.clientY >= rect.top - 16 && event.clientY <= rect.bottom + 16
      const near = {
        top: event.clientY <= reach && alongX,
        bottom: event.clientY >= height - reach && alongX,
        left: event.clientX <= reach && alongY,
        right: event.clientX >= width - reach && alongY,
      }[edge!]
      if (!near) hideSoon()
      else if (event.buttons === 0) {
        awaitedRef.current = false
        stay()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      // The path is read through the shadow root the toolbar lives in.
      setPressedOff(bar !== null && !event.composedPath().includes(bar))
    }
    const onPointerEnd = () => setPressedOff(false)
    const stay = () => {
      eventTarget.clearTimeout(timer)
      timer = undefined
      setRevealed(true)
    }
    // Focus that came from the keyboard: a click on the bar leaves focus behind without it.
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as Element).matches(":focus-visible")) stay()
    }
    if (awaitedRef.current) stay()
    else hideSoon()
    eventTarget.addEventListener("pointermove", onPointerMove)
    eventTarget.addEventListener("pointerdown", onPointerDown, true)
    eventTarget.addEventListener("pointerup", onPointerEnd, true)
    eventTarget.addEventListener("pointercancel", onPointerEnd, true)
    bar?.addEventListener("focusin", onFocusIn)
    bar?.addEventListener("focusout", hideSoon)
    return () => {
      eventTarget.clearTimeout(timer)
      eventTarget.removeEventListener("pointermove", onPointerMove)
      eventTarget.removeEventListener("pointerdown", onPointerDown, true)
      eventTarget.removeEventListener("pointerup", onPointerEnd, true)
      eventTarget.removeEventListener("pointercancel", onPointerEnd, true)
      bar?.removeEventListener("focusin", onFocusIn)
      bar?.removeEventListener("focusout", hideSoon)
    }
  }, [busy, edge, eventTarget, idle, minimized])
  const tucked = idle && !revealed
  const [tuckSliding, setTuckSliding] = useState(false)
  // A surface opened while the bar is tucked (a shortcut, a capture that just finished) would
  // otherwise be placed against where the bar was hiding, and end up on top of it.
  useLayoutEffect(() => {
    setTuckSliding(true)
    const timer = eventTarget.setTimeout(() => setTuckSliding(false), TUCK_SLIDE_MS)
    return () => eventTarget.clearTimeout(timer)
  }, [eventTarget, tucked])
  // The tuck only animates once the bar has been painted, so nothing slides as the page loads.
  const [tuckAnimated, setTuckAnimated] = useState(false)
  useEffect(() => {
    // Two frames: the first one places the bar on its edge.
    let frame = eventTarget.requestAnimationFrame(() => {
      frame = eventTarget.requestAnimationFrame(() => setTuckAnimated(true))
    })
    return () => eventTarget.cancelAnimationFrame(frame)
  }, [eventTarget])
  // Whether the bar is sliding in or out of view. It slides with a transform, which nothing that
  // watches its layout sees, so its surfaces are placed again on every frame of it.
  return { tucked, pressedOff, tuckAnimated, tuckSliding }
}
