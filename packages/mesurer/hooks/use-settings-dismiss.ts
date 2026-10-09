import { useEffect } from "react"
import { addMesurerCaptureListener } from "../core/keyboard-gate"

// Closes the settings on a press anywhere outside the panel and the button that opens it.
export const useSettingsDismiss = (ownerWindow: Window & typeof globalThis, open: boolean, close: () => void) => {
  useEffect(() => {
    if (!open) return
    const ElementConstructor = ownerWindow.Element
    const closeIfOutside = (event: Event) => {
      const inside = event.composedPath().some((node) => {
        if (!(node instanceof ElementConstructor)) return false
        return Boolean(
          node.closest("[data-mesurer-settings-panel], [data-tool-id='settings']"),
        )
      })
      if (!inside) close()
    }
    return addMesurerCaptureListener(ownerWindow, ownerWindow, "pointerdown", closeIfOutside)
  }, [close, open, ownerWindow])
}
