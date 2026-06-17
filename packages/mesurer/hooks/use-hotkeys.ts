import type { Dispatch, SetStateAction } from "react"
import { useEffect } from "react"
import type { ToolMode } from "../core/types"

type HotkeyOptions = {
  clearAll: () => void
  undo: () => void
  redo: () => void
  removeSelectedGuides: () => boolean
  setEnabled: Dispatch<SetStateAction<boolean>>
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setAltPressed: Dispatch<SetStateAction<boolean>>
  isOverlayActive: () => boolean
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>
  onInteract: () => void
}

export const useHotkeys = (options: HotkeyOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        options.clearAll()
        return
      }

      if (event.metaKey || event.ctrlKey) {
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

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [options])
}
