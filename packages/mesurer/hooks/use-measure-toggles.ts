import { useState } from "react"
import type { ToolMode } from "../core/types"

type MeasureToggleOptions = {
  initialEnabled?: boolean
  initialToolMode?: ToolMode
  initialRulersVisible?: boolean
}

export const useMeasureToggles = (options: MeasureToggleOptions = {}) => {
  const [enabled, setEnabled] = useState(options.initialEnabled ?? true)
  const [altPressed, setAltPressed] = useState(false)
  const [toolMode, setToolMode] = useState<ToolMode>(
    options.initialToolMode ?? "none"
  )
  const [rulersVisible, setRulersVisible] = useState(
    options.initialRulersVisible ?? false
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
    rulersVisible,
    setRulersVisible,
    guidesEnabled,
    multiMeasureEnabled,
    snapGuidesEnabled,
    snapEnabled,
  }
}
