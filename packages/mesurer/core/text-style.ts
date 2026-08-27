export type TextFont = "handwritten" | "code" | "serif" | "sans-serif"

export type TextStyleSettings = {
  font: TextFont
  color: string
}

export const DEFAULT_TEXT_STYLE: TextStyleSettings = {
  font: "sans-serif",
  color: "#000000",
}

export const TEXT_FONT_OPTIONS: Array<{ value: TextFont; label: string }> = [
  { value: "handwritten", label: "Handwritten" },
  { value: "code", label: "Code" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-serif" },
]

const FONT_STACKS: Record<TextFont, string> = {
  handwritten:
    '"Segoe Script", "Bradley Hand", "Apple Chancery", "Snell Roundhand", "Comic Sans MS", cursive',
  code: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  serif: 'ui-serif, Georgia, "Times New Roman", "Noto Serif", serif',
  "sans-serif": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}

const isTextFont = (value: unknown): value is TextFont =>
  value === "handwritten" || value === "code" || value === "serif" || value === "sans-serif"

export const resolveTextFontFamily = (style: TextStyleSettings) => FONT_STACKS[style.font]

export const normalizeTextStyle = (value: unknown): TextStyleSettings | undefined => {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  return {
    font: isTextFont(input.font) ? input.font : DEFAULT_TEXT_STYLE.font,
    color: typeof input.color === "string" && input.color ? input.color : DEFAULT_TEXT_STYLE.color,
  }
}
