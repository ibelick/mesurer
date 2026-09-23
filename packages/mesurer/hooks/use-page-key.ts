import { useCallback, useSyncExternalStore } from "react"
import { getPageKey } from "../core/workspace"

const LOCATION_EVENT = "mesurer:locationchange"
const PATCHED = "__MESURER_HISTORY_PATCH__"

const patchHistory = (ownerWindow: Window) => {
  const patchedWindow = ownerWindow as Window & { [PATCHED]?: boolean }
  if (patchedWindow[PATCHED]) return
  patchedWindow[PATCHED] = true
  const history = ownerWindow.history
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method]
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args)
      ownerWindow.dispatchEvent(new Event(LOCATION_EVENT))
      return result
    }
  }
}

const subscribeToLocation = (ownerWindow: Window, onStoreChange: () => void) => {
  patchHistory(ownerWindow)
  ownerWindow.addEventListener("popstate", onStoreChange)
  ownerWindow.addEventListener("hashchange", onStoreChange)
  ownerWindow.addEventListener(LOCATION_EVENT, onStoreChange)
  return () => {
    ownerWindow.removeEventListener("popstate", onStoreChange)
    ownerWindow.removeEventListener("hashchange", onStoreChange)
    ownerWindow.removeEventListener(LOCATION_EVENT, onStoreChange)
  }
}

export const usePageKey = (ownerWindow: Window) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToLocation(ownerWindow, onStoreChange),
    [ownerWindow],
  )
  const getSnapshot = useCallback(() => getPageKey(ownerWindow), [ownerWindow])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
