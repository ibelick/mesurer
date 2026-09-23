import { installKeyboardGate } from "../../../packages/mesurer/core/keyboard-gate"

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

installKeyboardGate(window, {
  isolateMesurerEvents: true,
  isolationHostId: "mesurer-extension-host",
})
patchHistory(window)
