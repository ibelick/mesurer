import { createId } from "./utils"

export type LayoutGuideKind = "columns" | "rows" | "grid"
export type LayoutGuideAlign = "stretch" | "min" | "center" | "max"

export type LayoutGuide = {
  id: string
  kind: LayoutGuideKind
  visible: boolean
  color: string
  opacity: number
  count: number
  size: number
  gutter: number
  offset: number
  align: LayoutGuideAlign
}

export type LayoutBand = {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_LAYOUT_GUIDE_COLOR = "#FF0000"
export const DEFAULT_LAYOUT_GUIDE_OPACITY = 0.1

const KINDS: LayoutGuideKind[] = ["columns", "rows", "grid"]
const ALIGNS: LayoutGuideAlign[] = ["stretch", "min", "center", "max"]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const createLayoutGuide = (partial: Partial<LayoutGuide> = {}): LayoutGuide => ({
  id: createId(),
  kind: "columns",
  visible: true,
  color: DEFAULT_LAYOUT_GUIDE_COLOR,
  opacity: DEFAULT_LAYOUT_GUIDE_OPACITY,
  count: 5,
  size: 72,
  gutter: 20,
  offset: 0,
  align: "stretch",
  ...partial,
})

export const isLayoutGuide = (value: unknown): value is LayoutGuide => {
  if (!value || typeof value !== "object") return false
  const input = value as LayoutGuide
  return (
    typeof input.id === "string" &&
    KINDS.includes(input.kind) &&
    typeof input.visible === "boolean" &&
    typeof input.color === "string" &&
    typeof input.opacity === "number" &&
    typeof input.count === "number" &&
    typeof input.size === "number" &&
    typeof input.gutter === "number" &&
    typeof input.offset === "number" &&
    ALIGNS.includes(input.align)
  )
}

export const normalizeLayoutGuides = (value: unknown): LayoutGuide[] => {
  if (!Array.isArray(value)) return []
  return value.filter(isLayoutGuide).map((guide) => ({
    ...guide,
    opacity: clamp(guide.opacity, 0, 1),
    count: Math.max(1, Math.round(guide.count)),
    size: Math.max(0, guide.size),
    gutter: Math.max(0, guide.gutter),
    offset: guide.offset,
  }))
}

export const layoutGuideLabel = (guide: LayoutGuide) => {
  if (guide.kind === "grid") return `Grid ${Math.round(guide.size)}px`
  const unit = guide.kind === "columns" ? "columns" : "rows"
  if (guide.align === "stretch") return `${guide.count} ${unit}`
  return `${guide.count} ${unit} (${Math.round(guide.size)}px)`
}

const tracks = (
  count: number,
  size: number,
  gutter: number,
  offset: number,
  align: LayoutGuideAlign,
  span: number,
) => {
  const n = Math.max(1, Math.round(count))
  if (align === "stretch") {
    const inner = Math.max(0, span - offset * 2)
    const extent = Math.max(0, (inner - gutter * (n - 1)) / n)
    return Array.from({ length: n }, (_, index) => ({
      start: offset + index * (extent + gutter),
      extent,
    }))
  }
  const extent = Math.max(0, size)
  const total = n * extent + (n - 1) * gutter
  const origin =
    align === "center"
      ? (span - total) / 2 + offset
      : align === "max"
        ? span - offset - total
        : offset
  return Array.from({ length: n }, (_, index) => ({
    start: origin + index * (extent + gutter),
    extent,
  }))
}

export const layoutGuideBands = (
  guide: LayoutGuide,
  viewport: { width: number; height: number },
): LayoutBand[] => {
  if (!guide.visible || guide.kind === "grid") return []
  if (guide.kind === "columns") {
    return tracks(guide.count, guide.size, guide.gutter, guide.offset, guide.align, viewport.width).map(
      (track) => ({
        x: track.start,
        y: 0,
        width: track.extent,
        height: viewport.height,
      }),
    )
  }
  return tracks(guide.count, guide.size, guide.gutter, guide.offset, guide.align, viewport.height).map(
    (track) => ({
      x: 0,
      y: track.start,
      width: viewport.width,
      height: track.extent,
    }),
  )
}
