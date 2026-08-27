import { useEffect, useRef } from "react"
import type { ToolMode } from "../core/types"
import {
  createTextInspector,
  type TextInspectorAPI,
} from "../runtime/text-inspector"

export const useTextInspector = (
  portalTarget: HTMLElement | ShadowRoot,
  toolMode: ToolMode,
  settingsOpen = false,
): TextInspectorAPI => {
  const textInspectorRef = useRef<TextInspectorAPI | null>(null)
  if (!textInspectorRef.current) {
    textInspectorRef.current = createTextInspector({ portalTarget })
  }
  const textInspector = textInspectorRef.current

  const modeRef = useRef<ToolMode | null>(null)
  if (modeRef.current !== toolMode) {
    const previous = modeRef.current
    modeRef.current = toolMode
    if (toolMode === "text-inspector") {
      textInspector.enable()
    } else if (previous === "text-inspector") {
      textInspector.disable()
    }
  }

  const pausedRef = useRef(false)
  if (pausedRef.current !== settingsOpen) {
    pausedRef.current = settingsOpen
    textInspector.setPaused(settingsOpen)
  }

  useEffect(() => {
    return () => {
      textInspector.destroy()
    }
  }, [textInspector])

  return textInspector
}
