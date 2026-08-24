import type { Dispatch, SetStateAction } from "react"
import { useEffect, useRef } from "react"
import type { ToolMode } from "../core/types"

type HotkeyOptions = {
  eventTarget: Window
  cancelInteraction: () => void
  undo: () => void
  redo: () => void
  removeSelectedGuides: () => boolean
  removeSelectedArrows: () => boolean
  setEnabled: Dispatch<SetStateAction<boolean>>
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setRulersVisible: Dispatch<SetStateAction<boolean>>
  setAltPressed: Dispatch<SetStateAction<boolean>>
  isOverlayActive: () => boolean
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>
  onInteract: () => void
  onColorPicker: () => void
  onScreenshot: () => void
  onCloseScreenshot: () => void
  isScreenshotActive: () => boolean
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
      const target = event.target as HTMLElement | null
      const path = event.composedPath()
      const isEditable = path.some((item) => {
        const element = item as HTMLElement | null
        return Boolean(
          element &&
          (element.isContentEditable ||
            element.tagName === "INPUT" ||
            element.tagName === "TEXTAREA" ||
            element.tagName === "SELECT"),
        )
      })
      if (
        (target &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")) ||
        isEditable
      ) {
        return
      }
      if (event.key === "Escape") {
        if (current.isSettingsOpen()) {
          current.onToggleSettings()
          return
        }
        if (current.isScreenshotActive()) {
          current.onCloseScreenshot()
          return
        }
        if (current.isColorPickerActive()) {
          current.onCloseColorPicker()
          return
        }
        event.preventDefault()
        current.cancelInteraction()
        return
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.key === ",") {
          event.preventDefault()
          current.onCloseScreenshot()
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
        current.onCloseScreenshot()
        current.onColorPicker()
        current.onInteract()
        return
      }

      if (key === "c") {
        event.preventDefault()
        current.onScreenshot()
        current.onInteract()
        return
      }

      if (key === "x") {
        current.onCloseScreenshot()
        current.onToggleXray()
        current.onInteract()
        return
      }

      if (current.isOverlayActive()) {
        if (key === "a") {
          current.onCloseScreenshot()
          current.setToolMode((prev) =>
            prev === "text-inspector" ? "none" : "text-inspector",
          )
          current.onInteract()
        }

        if (key === "s") {
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "select" ? "none" : "select"))
          current.onInteract()
        }

        if (key === "o") {
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "selection" ? "none" : "selection"))
          current.onInteract()
        }

        if (key === "g") {
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "guides" ? "none" : "guides"))
          current.onInteract()
        }

        if (key === "d") {
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "arrows" ? "none" : "arrows"))
          current.onInteract()
        }

        if (key === "t") {
          current.onCloseScreenshot()
          current.setToolMode((prev) => (prev === "text" ? "none" : "text"))
          current.onInteract()
        }

        if (key === "r") {
          current.onCloseScreenshot()
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
        const removed = current.removeSelectedGuides() || current.removeSelectedArrows()
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
