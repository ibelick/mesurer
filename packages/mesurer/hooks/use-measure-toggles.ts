import { useState } from "react"
import type { ToolMode } from "../core/types"

type MeasureToggleOptions = {
  initialEnabled?: boolean
  initialToolMode?: ToolMode
  initialRulersVisible?: boolean
  initialSnapEnabled?: boolean
  initialSnapGuidesEnabled?: boolean
  initialSnapArrowsEnabled?: boolean
  initialArrowClickToPlace?: boolean
  initialSelectNewGuideEnabled?: boolean
  initialMultiMeasureEnabled?: boolean
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
  const [multiMeasureEnabled, setMultiMeasureEnabled] = useState(
    options.initialMultiMeasureEnabled ?? false,
  )
  const [snapGuidesEnabled, setSnapGuidesEnabled] = useState(
    options.initialSnapGuidesEnabled ?? true,
  )
  const [snapArrowsEnabled, setSnapArrowsEnabled] = useState(
    options.initialSnapArrowsEnabled ?? true,
  )
  const [arrowClickToPlace, setArrowClickToPlace] = useState(
    options.initialArrowClickToPlace ?? false,
  )
  const [selectNewGuideEnabled, setSelectNewGuideEnabled] = useState(
    options.initialSelectNewGuideEnabled ?? true,
  )
  const guidesEnabled = toolMode === "guides"
  const [snapEnabled, setSnapEnabled] = useState(options.initialSnapEnabled ?? true)

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
    setSnapGuidesEnabled,
    snapArrowsEnabled,
    setSnapArrowsEnabled,
    arrowClickToPlace,
    setArrowClickToPlace,
    selectNewGuideEnabled,
    setSelectNewGuideEnabled,
    snapEnabled,
    setSnapEnabled,
    setMultiMeasureEnabled,
  }
}
