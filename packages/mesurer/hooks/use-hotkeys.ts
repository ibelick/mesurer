import type { Dispatch, SetStateAction } from "react"
import { useEffect } from "react"
import type { ToolMode } from "../core/types"

type HotkeyOptions = {
  eventTarget: Window
  clearAll: () => void
  undo: () => void
  redo: () => void
  removeSelectedGuides: () => boolean
  setEnabled: Dispatch<SetStateAction<boolean>>
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setRulersVisible: Dispatch<SetStateAction<boolean>>
  setAltPressed: Dispatch<SetStateAction<boolean>>
  isOverlayActive: () => boolean
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>
  onInteract: () => void
  onColorPicker: () => void
  onToggleXray: () => void
  onToggleSettings: () => void
  isSettingsOpen: () => boolean
  onCloseColorPicker: () => void
  isColorPickerActive: () => boolean
}

export const useHotkeys = (options: HotkeyOptions) => {
  useEffect(() => {
    const target = options.eventTarget
      const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (options.isSettingsOpen()) {
          options.onToggleSettings()
          return
        }
        if (options.isColorPickerActive()) {
          options.onCloseColorPicker()
          return
        }
        options.clearAll()
        return
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.key === ",") {
          event.preventDefault()
          options.onToggleSettings()
          options.onInteract()
          return
        }
        if (event.key.toLowerCase() !== "z") return
        if (event.shiftKey) {
          event.preventDefault()
          options.redo()
          return
        }
        event.preventDefault()
        options.undo()
        return
      }

      if (event.key.toLowerCase() === "m") {
        options.setEnabled((prev) => !prev)
      }

      const key = event.key.toLowerCase()
      if (key === "p") {
        event.preventDefault()
        options.onColorPicker()
        options.onInteract()
        return
      }

      if (key === "x") {
        options.onToggleXray()
        options.onInteract()
        return
      }

      if (options.isOverlayActive()) {
        if (key === "a") {
          options.setToolMode((prev) =>
            prev === "text-inspector" ? "none" : "text-inspector",
          )
          options.onInteract()
        }

        if (key === "s") {
          options.setToolMode((prev) => (prev === "select" ? "none" : "select"))
          options.onInteract()
        }

        if (key === "g") {
          options.setToolMode((prev) => (prev === "guides" ? "none" : "guides"))
          options.onInteract()
        }

        if (key === "r") {
          options.setRulersVisible((prev) => !prev)
          options.onInteract()
        }

        if (key === "h") {
          options.setGuideOrientation("horizontal")
          options.onInteract()
        }

        if (key === "v") {
          options.setGuideOrientation("vertical")
          options.onInteract()
        }
      }

      if (event.key === "Alt") {
        options.setAltPressed(true)
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        const removed = options.removeSelectedGuides()
        if (removed) {
          event.preventDefault()
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        options.setAltPressed(false)
      }
    }

    target.addEventListener("keydown", handleKeyDown)
    target.addEventListener("keyup", handleKeyUp)
    return () => {
      target.removeEventListener("keydown", handleKeyDown)
      target.removeEventListener("keyup", handleKeyUp)
    }
  }, [options])
}
