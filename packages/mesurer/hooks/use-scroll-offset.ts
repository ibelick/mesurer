import { useCallback, useRef, useSyncExternalStore } from "react"

// The window's scroll offset, kept as the same object for as long as it has not changed.
export const useScrollOffset = (ownerWindow: Window) => {
  const subscribe = useCallback((onStoreChange: () => void) => {
    ownerWindow.addEventListener("scroll", onStoreChange, true)
    ownerWindow.addEventListener("resize", onStoreChange)
    return () => {
      ownerWindow.removeEventListener("scroll", onStoreChange, true)
      ownerWindow.removeEventListener("resize", onStoreChange)
    }
  }, [ownerWindow])
  const snapshotRef = useRef({
    ownerWindow,
    value: { x: ownerWindow.scrollX, y: ownerWindow.scrollY },
  })
  const getSnapshot = useCallback(() => {
    const previous = snapshotRef.current
    const x = ownerWindow.scrollX
    const y = ownerWindow.scrollY
    if (previous.ownerWindow !== ownerWindow || previous.value.x !== x || previous.value.y !== y) {
      snapshotRef.current = { ownerWindow, value: { x, y } }
    }
    return snapshotRef.current.value
  }, [ownerWindow])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
