export type TextFont = "handwritten" | "code" | "serif" | "sans-serif" | "custom"

export type TextStyleSettings = {
  font: TextFont
  customFamily: string
}

export const DEFAULT_TEXT_STYLE: TextStyleSettings = {
  font: "sans-serif",
  customFamily: "",
}

export const TEXT_FONT_OPTIONS: Array<{ value: TextFont; label: string }> = [
  { value: "handwritten", label: "Handwritten" },
  { value: "code", label: "Code" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-serif" },
  { value: "custom", label: "Custom" },
]

const FONT_STACKS: Record<Exclude<TextFont, "custom">, string> = {
  handwritten:
    '"Segoe Script", "Bradley Hand", "Apple Chancery", "Snell Roundhand", "Comic Sans MS", cursive',
  code: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  serif: 'ui-serif, Georgia, "Times New Roman", "Noto Serif", serif',
  "sans-serif": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}

const isTextFont = (value: unknown): value is TextFont =>
  value === "handwritten" ||
  value === "code" ||
  value === "serif" ||
  value === "sans-serif" ||
  value === "custom"

export const sanitizeCustomFamily = (value: string) =>
  value.trim().replace(/["';{}\\\n\r]/g, "").slice(0, 64)

export const resolveTextFontFamily = (style: TextStyleSettings) => {
  if (style.font !== "custom") return FONT_STACKS[style.font]
  const custom = sanitizeCustomFamily(style.customFamily)
  if (!custom) return FONT_STACKS["sans-serif"]
  return `"${custom}", ${FONT_STACKS["sans-serif"]}`
}

export const normalizeTextStyle = (value: unknown): TextStyleSettings | undefined => {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  return {
    font: isTextFont(input.font) ? input.font : DEFAULT_TEXT_STYLE.font,
    customFamily:
      typeof input.customFamily === "string"
        ? sanitizeCustomFamily(input.customFamily)
        : DEFAULT_TEXT_STYLE.customFamily,
  }
}
