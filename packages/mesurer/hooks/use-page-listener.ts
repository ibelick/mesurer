import { useEffect, useRef } from "react"
import { addMesurerCaptureListener } from "../core/keyboard-gate"

type Getter<T> = T | (() => T)
const read = <T,>(value: Getter<T>) => (typeof value === "function" ? (value as () => T)() : value)

// Listens for events on the page for as long as `active`, always with the latest handler, so
// callers do not need an effect or a ref of their own.
// `phase` is how the listener is registered: "gate" goes through the app's own capture
// listener, which runs ahead of the page's; "capture" and "bubble" are plain listeners.
// `target` defaults to the window; pass a function when it comes from a ref.
export const usePageListener = ({
  active = true,
  view,
  target,
  types,
  phase = "gate",
  onEvent,
}: {
  active?: boolean
  view: Getter<Window | null | undefined>
  target?: () => EventTarget | null | undefined
  types: string | string[]
  phase?: "gate" | "capture" | "bubble"
  onEvent: (event: Event) => void
}) => {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent
  const viewRef = useRef(view)
  viewRef.current = view
  const targetRef = useRef(target)
  targetRef.current = target
  const typeKey = typeof types === "string" ? types : types.join(" ")
  // A window given directly is listened on again when it changes; one read from a ref is read
  // when the listener goes on.
  const givenView = typeof view === "function" ? null : view
  useEffect(() => {
    if (!active) return
    const owner = read(viewRef.current)
    if (!owner) return
    const node = targetRef.current?.() ?? owner
    const listener = (event: Event) => handlerRef.current(event)
    const detach = typeKey.split(" ").map((type) => {
      if (phase === "gate") return addMesurerCaptureListener(owner, node, type, listener)
      node.addEventListener(type, listener, phase === "capture")
      return () => node.removeEventListener(type, listener, phase === "capture")
    })
    return () => detach.forEach((remove) => remove())
  }, [active, phase, typeKey, givenView])
}
