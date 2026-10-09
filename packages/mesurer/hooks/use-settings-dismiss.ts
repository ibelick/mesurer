import { usePageListener } from "./use-page-listener"

// Closes the settings on a press anywhere outside the panel and the button that opens it.
export const useSettingsDismiss = (ownerWindow: Window & typeof globalThis, open: boolean, close: () => void) => {
  usePageListener({
    active: open,
    view: ownerWindow,
    types: "pointerdown",
    onEvent: (event) => {
      const inside = event.composedPath().some(
        (node) =>
          node instanceof ownerWindow.Element &&
          node.closest("[data-mesurer-settings-panel], [data-tool-id='settings']") !== null,
      )
      if (!inside) close()
    },
  })
}
