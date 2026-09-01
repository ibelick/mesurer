import { useLayoutEffect, useRef } from "react"
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

  useLayoutEffect(() => {
    const previous = modeRef.current
    if (previous !== toolMode) {
      if (toolMode === "text-inspector") textInspector.enable()
      else if (previous === "text-inspector") textInspector.disable()
      modeRef.current = toolMode
    }
    textInspector.setPaused(settingsOpen)
  }, [settingsOpen, textInspector, toolMode])

  useLayoutEffect(() => {
    return () => {
      textInspector.destroy()
    }
  }, [textInspector])

  return textInspector
}
