import type { Dispatch, SetStateAction } from "react"
import { useEffect } from "react"
import type { ToolMode } from "../types"

type HotkeyOptions = {
  clearAll: () => void
  removeSelectedGuides: () => boolean
  setEnabled: Dispatch<SetStateAction<boolean>>
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setAltPressed: Dispatch<SetStateAction<boolean>>
  isOverlayActive: () => boolean
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>
  onInteract: () => void
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']") !== null
}

export const useHotkeys = (options: HotkeyOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      if (event.key === "Escape") {
        options.clearAll()
        return
      }

      if (event.key.toLowerCase() === "m") {
        options.setEnabled((prev) => !prev)
      }

      const key = event.key.toLowerCase()
      if (options.isOverlayActive()) {
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
      if (isEditableTarget(event.target)) return

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
