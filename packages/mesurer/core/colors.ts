export type ColorPickerFormat = "hex" | "rgb" | "hsl" | "oklch"

export type ColorSample = {
  red: number
  green: number
  blue: number
  alpha: number
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const parseChannel = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.endsWith("%")) return clamp(Number.parseFloat(trimmed) / 100) * 255
  return clamp(Number.parseFloat(trimmed) / 255) * 255
}

const parseAlpha = (value: string | undefined) => {
  if (!value) return 1
  return clamp(value.trim().endsWith("%")
    ? Number.parseFloat(value) / 100
    : Number.parseFloat(value))
}

export const parseCssColor = (value: string): ColorSample | null => {
  const input = value.trim().toLowerCase()
  if (!input || input === "transparent") return null

  if (input.startsWith("#")) {
    const hex = input.slice(1)
    const expanded = hex.length === 3 || hex.length === 4
      ? hex.split("").map((digit) => digit + digit).join("")
      : hex
    if (![6, 8].includes(expanded.length) || !/^[\da-f]+$/.test(expanded)) return null
    return {
      red: Number.parseInt(expanded.slice(0, 2), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    }
  }

  const match = input.match(/^rgba?\((.*)\)$/)
  if (!match) return null
  const channels = match[1].replace(/\//g, " ").split(/[ ,]+/).filter(Boolean)
  if (channels.length < 3) return null
  return {
    red: parseChannel(channels[0]),
    green: parseChannel(channels[1]),
    blue: parseChannel(channels[2]),
    alpha: parseAlpha(channels[3]),
  }
}

const toByte = (value: number) => Math.round(clamp(value / 255) * 255)

export const colorToHex = (color: ColorSample) => {
  const hex = [color.red, color.green, color.blue]
    .map((channel) => toByte(channel).toString(16).padStart(2, "0"))
    .join("")
  if (color.alpha >= 0.999) return `#${hex}`
  return `#${hex}${Math.round(color.alpha * 255).toString(16).padStart(2, "0")}`
}

export const colorToRgb = (color: ColorSample) => {
  const channels = `${toByte(color.red)}, ${toByte(color.green)}, ${toByte(color.blue)}`
  return color.alpha >= 0.999
    ? `rgb(${channels})`
    : `rgba(${channels}, ${round(color.alpha, 3)})`
}

export const colorToHsl = (color: ColorSample) => {
  const red = color.red / 255
  const green = color.green / 255
  const blue = color.blue / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  let hue = 0
  let saturation = 0
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    if (max === red) hue = ((green - blue) / delta) % 6
    else if (max === green) hue = (blue - red) / delta + 2
    else hue = (red - green) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  const result = `hsl(${round(hue, 1)} ${round(saturation * 100, 1)}% ${round(lightness * 100, 1)}%`
  return color.alpha >= 0.999 ? `${result})` : `${result} / ${round(color.alpha, 3)})`
}

const linearize = (value: number) => {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

export const colorToOklch = (color: ColorSample) => {
  const red = linearize(color.red)
  const green = linearize(color.green)
  const blue = linearize(color.blue)
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot
  const b = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot
  const chroma = Math.sqrt(a * a + b * b)
  let hue = (Math.atan2(b, a) * 180) / Math.PI
  if (hue < 0) hue += 360
  const result = `oklch(${round(lightness, 3)} ${round(chroma, 3)} ${round(hue, 1)}`
  return color.alpha >= 0.999 ? `${result})` : `${result} / ${round(color.alpha, 3)})`
}

export const formatColor = (color: ColorSample, format: ColorPickerFormat) => {
  if (format === "hex") return colorToHex(color)
  if (format === "rgb") return colorToRgb(color)
  if (format === "hsl") return colorToHsl(color)
  return colorToOklch(color)
}
