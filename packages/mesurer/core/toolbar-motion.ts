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

// The toolbar's shared motion timing, set by `--msr-toolbar-motion` on the motion element.
export const readToolbarMotionTiming = (motion: HTMLElement) =>
  toolbarMotionTiming(
    getComputedStyle(motion).getPropertyValue("--msr-toolbar-motion").trim() ||
      `${TOOLBAR_MOTION_FALLBACK_MS}ms ease`,
  )

export const transformScaleX = (value: string) => {
  if (!value || value === "none") return 1
  try {
    return new DOMMatrix(value).a
  } catch {
    return 1
  }
}

// The toolbar lays out along one axis: x when horizontal, y when docked left/right.
// Motion code reads sizes and writes transforms through this descriptor.
export type ToolbarAxis = {
  size: "width" | "height"
  offsetSize: "offsetWidth" | "offsetHeight"
  translate: "translateX" | "translateY"
  scale: "scaleX" | "scaleY"
  matrixTranslate: "e" | "f"
}

const HORIZONTAL_AXIS: ToolbarAxis = {
  size: "width",
  offsetSize: "offsetWidth",
  translate: "translateX",
  scale: "scaleX",
  matrixTranslate: "e",
}

const VERTICAL_AXIS: ToolbarAxis = {
  size: "height",
  offsetSize: "offsetHeight",
  translate: "translateY",
  scale: "scaleY",
  matrixTranslate: "f",
}

export const toolbarAxis = (vertical: boolean) =>
  vertical ? VERTICAL_AXIS : HORIZONTAL_AXIS

// Value for the `translate` property, which composes with any `transform` already in use.
export const axisTranslate = (axis: ToolbarAxis, offset: number) =>
  axis.size === "width" ? `${offset}px 0px` : `0px ${offset}px`

export const transformTranslate = (value: string, axis: ToolbarAxis) => {
  if (!value || value === "none") return 0
  try {
    return new DOMMatrix(value)[axis.matrixTranslate]
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

// Counter-scales the radius along the axis so a scaled surface keeps round corners.
export const toolbarRadius = (visual: number, axisScale: number, axis: ToolbarAxis) => {
  const scale = Math.abs(axisScale) < 1e-6 ? 1 : Math.abs(axisScale)
  return axis.size === "width"
    ? `${visual / scale}px / ${visual}px`
    : `${visual}px / ${visual / scale}px`
}

export const syncToolbarLayoutSizes = ({
  stage,
  collapseStage,
  inspectPanel,
  annotatePanel,
  expandedPanel,
  iconSlot,
  axis,
  destGroup,
}: {
  stage: HTMLElement
  collapseStage: HTMLElement
  inspectPanel: HTMLElement
  annotatePanel: HTMLElement
  expandedPanel: HTMLElement
  iconSlot: HTMLElement
  axis: ToolbarAxis
  destGroup?: "inspect" | "annotate"
}) => {
  const inspectNow = inspectPanel[axis.offsetSize]
  const annotateNow = annotatePanel[axis.offsetSize]
  if (inspectNow > 0) stage.style.setProperty("--msr-inspect-size", `${inspectNow}px`)
  if (annotateNow > 0) stage.style.setProperty("--msr-annotate-size", `${annotateNow}px`)
  const inspectSize =
    inspectNow || parseFloat(stage.style.getPropertyValue("--msr-inspect-size")) || 0
  const annotateSize =
    annotateNow || parseFloat(stage.style.getPropertyValue("--msr-annotate-size")) || 0
  const group = destGroup ?? (stage.dataset.group === "annotate" ? "annotate" : "inspect")
  const destStage = group === "annotate" ? annotateSize : inspectSize
  const stageSize = stage[axis.offsetSize]
  const expandedNow = expandedPanel[axis.offsetSize]
  const expandedSize =
    destStage > 0 && stageSize > 0 && expandedNow > 0
      ? expandedNow - stageSize + destStage
      : expandedNow
  const iconSize = iconSlot[axis.offsetSize]
  if (expandedSize > 0) {
    collapseStage.style.setProperty("--msr-expanded-size", `${expandedSize}px`)
  }
  if (iconSize > 0) {
    collapseStage.style.setProperty("--msr-icon-size", `${iconSize}px`)
  }
  void collapseStage.offsetWidth
}
