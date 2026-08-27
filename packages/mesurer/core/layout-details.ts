import type { BoxEdges } from "./types"

const round = (value: number) => Math.round(value)

export const isLayoutContainerDisplay = (display: string) =>
  display === "flex" ||
  display === "inline-flex" ||
  display === "grid" ||
  display === "inline-grid"

export const formatEdgeShorthand = (edges: BoxEdges): string | null => {
  const top = round(edges.top)
  const right = round(edges.right)
  const bottom = round(edges.bottom)
  const left = round(edges.left)

  if (top === 0 && right === 0 && bottom === 0 && left === 0) return null
  if (top === right && right === bottom && bottom === left) return `${top}`
  if (top === bottom && left === right) return `${top} ${right}`
  return `${top} ${right} ${bottom} ${left}`
}

export const formatGapShorthand = (row: number, column: number): string | null => {
  const rowGap = round(row)
  const columnGap = round(column)
  if (rowGap === 0 && columnGap === 0) return null
  if (rowGap === columnGap) return `${rowGap}`
  return `${rowGap} ${columnGap}`
}

export type LayoutDetailPart = {
  label: string
  value: string
}

const withPx = (value: string) =>
  value
    .split(" ")
    .map((part) => `${part}px`)
    .join(" ")

export const formatLayoutDetailParts = (options: {
  padding: BoxEdges
  gap: { row: number; column: number } | null
}): LayoutDetailPart[] => {
  const parts: LayoutDetailPart[] = []
  const gap = options.gap
    ? formatGapShorthand(options.gap.row, options.gap.column)
    : null
  const padding = formatEdgeShorthand(options.padding)

  if (gap) parts.push({ label: "gap", value: withPx(gap) })
  if (padding) parts.push({ label: "padding", value: withPx(padding) })
  return parts
}

export const formatLayoutDetailsLabel = (options: {
  padding: BoxEdges
  gap: { row: number; column: number } | null
}): string | null => {
  const parts = formatLayoutDetailParts(options)
  return parts.length > 0
    ? parts.map((part) => `${part.label} ${part.value}`).join("   ")
    : null
}
