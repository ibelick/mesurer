import { useState } from "react"
import type { ToolMode } from "../core/types"

type MeasureToggleOptions = {
  initialEnabled?: boolean
  initialToolMode?: ToolMode
}

export const useMeasureToggles = (options: MeasureToggleOptions = {}) => {
  const [enabled, setEnabled] = useState(options.initialEnabled ?? true)
  const [altPressed, setAltPressed] = useState(false)
  const [toolMode, setToolMode] = useState<ToolMode>(
    options.initialToolMode ?? "none"
  )
  const holdEnabled = false
  const multiMeasureEnabled = false
  const snapGuidesEnabled = true
  const guidesEnabled = toolMode === "guides"
  const snapEnabled = true

  return {
    enabled,
    setEnabled,
    holdEnabled,
    altPressed,
    setAltPressed,
    toolMode,
    setToolMode,
    guidesEnabled,
    multiMeasureEnabled,
    snapGuidesEnabled,
    snapEnabled,
  }
}
