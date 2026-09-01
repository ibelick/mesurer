type PointerDragHandlers = {
  onMove: (dx: number, dy: number, event: PointerEvent) => void
  onEnd: () => void
}

type PointerDragSession = {
  pointerId: number
  stop: (emitEnd?: boolean) => void
}

let session: PointerDragSession | null = null

export const isPointerDragActive = () => session !== null

export const abortPointerDrag = () => {
  session?.stop(false)
}

export const listenPointerDrag = (
  pointerId: number,
  view: Window,
  origin: { x: number; y: number },
  handlers: PointerDragHandlers,
) => {
  session?.stop(false)

  let stopped = false
  let frame = 0
  let latest: PointerEvent | null = null

  const emitMove = () => {
    const event = latest
    if (!event) return
    handlers.onMove(event.clientX - origin.x, event.clientY - origin.y, event)
  }

  const onMove = (event: PointerEvent) => {
    if (stopped || event.pointerId !== pointerId) return
    latest = event
    if (frame) return
    frame = view.requestAnimationFrame(() => {
      frame = 0
      if (stopped) return
      emitMove()
    })
  }

  const stop = (emitEnd = true) => {
    if (stopped) return
    stopped = true
    if (frame) {
      view.cancelAnimationFrame(frame)
      frame = 0
    }
    view.removeEventListener("pointermove", onMove, true)
    view.removeEventListener("pointerup", onUp, true)
    view.removeEventListener("pointercancel", onUp, true)
    if (session?.pointerId === pointerId) session = null
    if (emitEnd) {
      if (latest) emitMove()
      handlers.onEnd()
    }
  }

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    stop(true)
  }

  view.addEventListener("pointermove", onMove, true)
  view.addEventListener("pointerup", onUp, true)
  view.addEventListener("pointercancel", onUp, true)
  session = { pointerId, stop }
}

export const eventView = (event: { nativeEvent?: { view?: Window | null } }) =>
  event.nativeEvent?.view ?? (typeof window === "undefined" ? null : window)
