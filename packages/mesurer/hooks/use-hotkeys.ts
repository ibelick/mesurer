import type { Dispatch, SetStateAction } from "react"
import { useEffect, useRef } from "react"
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
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const target = options.eventTarget
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = optionsRef.current
      if (event.key === "Escape") {
        if (current.isSettingsOpen()) {
          current.onToggleSettings()
          return
        }
        if (current.isColorPickerActive()) {
          current.onCloseColorPicker()
          return
        }
        current.clearAll()
        return
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.key === ",") {
          event.preventDefault()
          current.onToggleSettings()
          current.onInteract()
          return
        }
        if (event.key.toLowerCase() !== "z") return
        if (event.shiftKey) {
          event.preventDefault()
          current.redo()
          return
        }
        event.preventDefault()
        current.undo()
        return
      }

      if (event.key.toLowerCase() === "m") {
        current.setEnabled((prev) => !prev)
      }

      const key = event.key.toLowerCase()
      if (key === "p") {
        event.preventDefault()
        current.onColorPicker()
        current.onInteract()
        return
      }

      if (key === "x") {
        current.onToggleXray()
        current.onInteract()
        return
      }

      if (current.isOverlayActive()) {
        if (key === "a") {
          current.setToolMode((prev) =>
            prev === "text-inspector" ? "none" : "text-inspector",
          )
          current.onInteract()
        }

        if (key === "s") {
          current.setToolMode((prev) => (prev === "select" ? "none" : "select"))
          current.onInteract()
        }

        if (key === "g") {
          current.setToolMode((prev) => (prev === "guides" ? "none" : "guides"))
          current.onInteract()
        }

        if (key === "r") {
          current.setRulersVisible((prev) => !prev)
          current.onInteract()
        }

        if (key === "h") {
          current.setGuideOrientation("horizontal")
          current.onInteract()
        }

        if (key === "v") {
          current.setGuideOrientation("vertical")
          current.onInteract()
        }
      }

      if (event.key === "Alt") {
        current.setAltPressed(true)
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        const removed = current.removeSelectedGuides()
        if (removed) {
          event.preventDefault()
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        optionsRef.current.setAltPressed(false)
      }
    }

    target.addEventListener("keydown", handleKeyDown)
    target.addEventListener("keyup", handleKeyUp)
    return () => {
      target.removeEventListener("keydown", handleKeyDown)
      target.removeEventListener("keyup", handleKeyUp)
    }
  }, [options.eventTarget])
}
