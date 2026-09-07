export const TOOLBAR_MOTION_FALLBACK_MS = 200

export const toolbarMotionMs = (motion: string) => {
  const value = Number.parseFloat(motion)
  if (!Number.isFinite(value)) return TOOLBAR_MOTION_FALLBACK_MS
  const unit = motion.trim().match(/[\d.]+\s*(m?s)/i)?.[1]
  return unit?.toLowerCase() === "s" ? value * 1000 : value
}

export const toolbarMotionTiming = (motion: string) => {
  const duration = toolbarMotionMs(motion)
  const easing = motion.replace(/^[\d.]+\s*m?s\s*/i, "").trim() || "ease"
  return { duration, easing }
}

export const transformScaleX = (value: string) => {
  if (!value || value === "none") return 1
  try {
    return new DOMMatrix(value).a
  } catch {
    return 1
  }
}

export const transformTranslateX = (value: string) => {
  if (!value || value === "none") return 0
  try {
    return new DOMMatrix(value).e
  } catch {
    return 0
  }
}

export const nearlyEqual = (a: number, b: number, epsilon = 0.5) =>
  Math.abs(a - b) < epsilon

export const TOOLBAR_RADIUS = 9

export const lerp = (from: number, to: number, t: number) => from + (to - from) * t

export const progress = (value: number, from: number, to: number) => {
  const span = to - from
  if (Math.abs(span) < 1e-6) return 1
  return Math.min(1, Math.max(0, (value - from) / span))
}

export const toolbarRadius = (visual: number, scaleX: number) => {
  const scale = Math.abs(scaleX) < 1e-6 ? 1 : Math.abs(scaleX)
  return `${visual / scale}px / ${visual}px`
}

export const syncToolbarLayoutWidths = ({
  stage,
  collapseStage,
  inspectPanel,
  annotatePanel,
  expandedPanel,
  iconSlot,
  destGroup,
}: {
  stage: HTMLElement
  collapseStage: HTMLElement
  inspectPanel: HTMLElement
  annotatePanel: HTMLElement
  expandedPanel: HTMLElement
  iconSlot: HTMLElement
  destGroup?: "inspect" | "annotate"
}) => {
  const inspectWidth = inspectPanel.offsetWidth
  const annotateWidth = annotatePanel.offsetWidth
  if (inspectWidth > 0) stage.style.setProperty("--msr-inspect-w", `${inspectWidth}px`)
  if (annotateWidth > 0) stage.style.setProperty("--msr-annotate-w", `${annotateWidth}px`)
  const inspectW =
    inspectWidth || parseFloat(stage.style.getPropertyValue("--msr-inspect-w")) || 0
  const annotateW =
    annotateWidth || parseFloat(stage.style.getPropertyValue("--msr-annotate-w")) || 0
  const group = destGroup ?? (stage.dataset.group === "annotate" ? "annotate" : "inspect")
  const destStage = group === "annotate" ? annotateW : inspectW
  const stageW = stage.offsetWidth
  const expandedNow = expandedPanel.offsetWidth
  const expandedWidth =
    destStage > 0 && stageW > 0 && expandedNow > 0
      ? expandedNow - stageW + destStage
      : expandedNow
  const iconWidth = iconSlot.offsetWidth
  if (expandedWidth > 0) {
    collapseStage.style.setProperty("--msr-expanded-w", `${expandedWidth}px`)
  }
  if (iconWidth > 0) {
    collapseStage.style.setProperty("--msr-icon-w", `${iconWidth}px`)
  }
  void collapseStage.offsetWidth
}
