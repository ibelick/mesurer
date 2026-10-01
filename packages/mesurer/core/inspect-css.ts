import {
  formatEdgeShorthand,
  formatGapShorthand,
  formatLayoutDetailParts,
  type LayoutDetailPart,
} from "./layout-details"
import type { InspectMeasurement } from "./types"

export const INSPECT_CSS_VISIBLE_ROWS = 6

const round = (value: number) => Math.round(value)

const withPx = (value: string) =>
  value
    .split(" ")
    .map((part) => `${part}px`)
    .join(" ")

const parseEdge = (value: string) => Number.parseFloat(value) || 0

const isDefaultInset = (top: number, right: number, bottom: number, left: number) =>
  top === 0 && right === 0 && bottom === 0 && left === 0

const formatInsetShorthand = (top: number, right: number, bottom: number, left: number) => {
  const t = round(top)
  const r = round(right)
  const b = round(bottom)
  const l = round(left)
  if (isDefaultInset(t, r, b, l)) return null
  if (t === r && r === b && b === l) return `${t}px`
  if (t === b && l === r) return `${t}px ${r}px`
  return `${t}px ${r}px ${b}px ${l}px`
}

const formatBorderWidth = (style: CSSStyleDeclaration): string | null => {
  const top = parseEdge(style.borderTopWidth)
  const right = parseEdge(style.borderRightWidth)
  const bottom = parseEdge(style.borderBottomWidth)
  const left = parseEdge(style.borderLeftWidth)
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return null
  const width = formatEdgeShorthand({ top, right, bottom, left })
  if (!width) return null
  const styleName = style.borderTopStyle
  if (styleName && styleName !== "none" && top === right && right === bottom && bottom === left) {
    return `${withPx(width)} ${styleName}`
  }
  return withPx(width)
}

const formatBorderRadius = (style: CSSStyleDeclaration): string | null => {
  const value = style.borderRadius.trim()
  if (!value || value === "0px") return null
  return value
}

type Rgb = { r: number; g: number; b: number; a: number }

const parseRgbColor = (value: string): Rgb | null => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === "transparent") return { r: 0, g: 0, b: 0, a: 0 }
  const rgbMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(trimmed)
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
      a: rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
    }
  }
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(trimmed)
  if (!hexMatch) return null
  const hex = hexMatch[1]
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
      a: 1,
    }
  }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: 1,
  }
}

const isOpaque = (color: Rgb) => color.a >= 0.999

const isDefaultBackgroundColor = (value: string) => {
  const rgb = parseRgbColor(value)
  if (!rgb) return false
  if (rgb.a < 0.001) return true
  return isOpaque(rgb) && rgb.r === 255 && rgb.g === 255 && rgb.b === 255
}

const isDefaultTextColor = (value: string) => {
  const rgb = parseRgbColor(value)
  if (!rgb || !isOpaque(rgb)) return false
  return rgb.r === 0 && rgb.g === 0 && rgb.b === 0
}

const formatBackgroundColor = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed || isDefaultBackgroundColor(trimmed)) return null
  return trimmed
}

const formatTextColor = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed || isDefaultTextColor(trimmed)) return null
  return trimmed
}

const BORING_DISPLAY = new Set(["block", "inline", "inline-block"])

const formatDisplayValue = (display: string): string | null => {
  const value = display.trim()
  if (!value || BORING_DISPLAY.has(value)) return null
  return value
}

const truncate = (value: string, max = 52) =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`

const pushPart = (parts: LayoutDetailPart[], label: string, value: string | null) => {
  if (!value) return
  parts.push({ label, value })
}

const layoutModeParts = (style: CSSStyleDeclaration, hasGap: boolean): LayoutDetailPart[] => {
  const parts: LayoutDetailPart[] = []
  const display = style.display
  pushPart(parts, "display", formatDisplayValue(display))
  if (display === "flex" || display === "inline-flex") {
    pushPart(parts, "flex-direction", style.flexDirection !== "row" ? style.flexDirection : null)
    pushPart(
      parts,
      "align-items",
      style.alignItems !== "normal" && style.alignItems !== "stretch" ? style.alignItems : null,
    )
    pushPart(
      parts,
      "justify-content",
      style.justifyContent !== "normal" && style.justifyContent !== "flex-start" ? style.justifyContent : null,
    )
    if (!hasGap) {
      const gap = formatGapShorthand(parseEdge(style.rowGap), parseEdge(style.columnGap))
      pushPart(parts, "gap", gap ? withPx(gap) : null)
    }
  }
  if (display === "grid" || display === "inline-grid") {
    pushPart(
      parts,
      "grid-template-columns",
      style.gridTemplateColumns !== "none" ? truncate(style.gridTemplateColumns, 40) : null,
    )
    pushPart(
      parts,
      "grid-template-rows",
      style.gridTemplateRows !== "none" ? truncate(style.gridTemplateRows, 40) : null,
    )
  }
  return parts
}

export const formatInspectCssParts = (
  measurement: Pick<InspectMeasurement, "padding" | "gap" | "margin">,
  style: CSSStyleDeclaration,
): LayoutDetailPart[] => {
  const parts: LayoutDetailPart[] = []
  const spacing = formatLayoutDetailParts({ padding: measurement.padding, gap: measurement.gap })
  const hasGap = spacing.some((part) => part.label === "gap")
  const paddingPart = spacing.find((part) => part.label === "padding")
  const gapPart = spacing.find((part) => part.label === "gap")
  if (paddingPart) parts.push(paddingPart)
  if (gapPart) parts.push(gapPart)

  const margin = formatEdgeShorthand(measurement.margin)
  if (margin) parts.push({ label: "margin", value: withPx(margin) })

  parts.push(...layoutModeParts(style, hasGap))

  const position = style.position
  if (position && position !== "static") {
    parts.push({ label: "position", value: position })
    const inset = formatInsetShorthand(
      parseEdge(style.top),
      parseEdge(style.right),
      parseEdge(style.bottom),
      parseEdge(style.left),
    )
    pushPart(parts, "inset", inset)
  }

  const zIndex = style.zIndex.trim()
  if (zIndex && zIndex !== "auto" && zIndex !== "0") {
    parts.push({ label: "z-index", value: zIndex })
  }

  pushPart(parts, "border", formatBorderWidth(style))
  pushPart(parts, "radius", formatBorderRadius(style))
  pushPart(parts, "background", formatBackgroundColor(style.backgroundColor))
  pushPart(parts, "color", formatTextColor(style.color))

  const shadow = style.boxShadow.trim()
  if (shadow && shadow !== "none") {
    pushPart(parts, "box-shadow", truncate(shadow))
  }

  const opacity = Number.parseFloat(style.opacity)
  if (Number.isFinite(opacity) && opacity < 0.999) {
    parts.push({ label: "opacity", value: String(round(opacity * 100) / 100) })
  }

  const overflow = style.overflow
  if (overflow && overflow !== "visible") {
    parts.push({ label: "overflow", value: overflow })
  }

  return parts
}

export const visibleInspectCssParts = (
  parts: LayoutDetailPart[],
  expanded: boolean,
  visibleRows = INSPECT_CSS_VISIBLE_ROWS,
) => {
  if (expanded || parts.length <= visibleRows) {
    return { visible: parts, hiddenCount: 0 }
  }
  return { visible: parts.slice(0, visibleRows), hiddenCount: parts.length - visibleRows }
}
