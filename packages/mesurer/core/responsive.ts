export type ResponsiveSize = { width: number; height: number }

export type ResponsiveDeviceKind = "phone" | "tablet" | "desktop"
export type ResponsiveDevice = ResponsiveSize & { id: string; name: string; kind: ResponsiveDeviceKind }

const device = (kind: ResponsiveDeviceKind, name: string, width: number, height: number): ResponsiveDevice => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  kind,
  name,
  width,
  height,
})

// Screen sizes in CSS pixels, upright for phones and tablets.
export const RESPONSIVE_DEVICES: readonly ResponsiveDevice[] = [
  device("phone", "iPhone SE", 375, 667),
  device("phone", "iPhone X", 375, 812),
  device("phone", "iPhone 15", 393, 852),
  device("phone", "iPhone 15 Pro Max", 430, 932),
  device("phone", "Pixel 8", 412, 915),
  device("phone", "Galaxy S24", 360, 780),
  device("tablet", "iPad mini", 744, 1133),
  device("tablet", "iPad", 820, 1180),
  device("tablet", "iPad Pro 12.9", 1024, 1366),
  device("desktop", "Laptop", 1280, 800),
  device("desktop", "MacBook Air 13", 1470, 956),
  device("desktop", "Full HD", 1920, 1080),
]

export const RESPONSIVE_DEVICE_GROUPS: ReadonlyArray<[ResponsiveDeviceKind, string]> = [
  ["phone", "Phones"],
  ["tablet", "Tablets"],
  ["desktop", "Desktops"],
]

export const DEFAULT_RESPONSIVE_DEVICE = RESPONSIVE_DEVICES[2]

// Each preview is the whole page loaded once more, so there is a limit to how many are kept.
export const RESPONSIVE_MAX_PREVIEWS = 6

// The device a size is the screen of.
export const responsiveDeviceFor = ({ width, height }: ResponsiveSize) =>
  RESPONSIVE_DEVICES.find((candidate) => candidate.width === width && candidate.height === height)

// Marks the preview's frame, so the page loaded in it knows it is one.
export const RESPONSIVE_FRAME_ATTRIBUTE = "data-mesurer-responsive-frame"

export const isResponsivePreview = (ownerWindow: Window) => {
  try {
    return ownerWindow.frameElement?.hasAttribute(RESPONSIVE_FRAME_ATTRIBUTE) ?? false
  } catch {
    // A frame from another origin: not ours.
    return false
  }
}

export const RESPONSIVE_MIN_SIZE = 240
export const RESPONSIVE_MAX_SIZE = 3840

export const clampResponsiveSize = ({ width, height }: ResponsiveSize): ResponsiveSize => {
  const clamp = (value: number) => Math.round(Math.min(RESPONSIVE_MAX_SIZE, Math.max(RESPONSIVE_MIN_SIZE, value)))
  return { width: clamp(width), height: clamp(height) }
}

// A media query's em and rem are the browser's default font size, whatever the page sets.
const PX_PER_EM = 16
const LENGTH = "(\\d*\\.?\\d+)(px|r?em)"
const px = (value: string, unit: string) => Number(value) * (unit === "px" ? 1 : PX_PER_EM)
// The first whole width past a limit: `max-width: 767.98px` and `max-width: 767px` both end at 768.
const past = (limit: number) => Math.floor(limit) + 1

const WIDTH_CONDITIONS: ReadonlyArray<[RegExp, (limit: number, operator: string) => number]> = [
  [new RegExp(`min-width\\s*:\\s*${LENGTH}`, "g"), (limit) => limit],
  [new RegExp(`max-width\\s*:\\s*${LENGTH}`, "g"), past],
  // Range syntax, the width on the left: `width >= 40rem`.
  [new RegExp(`(?<![-\\w])width\\s*(>=|<=|>|<)\\s*${LENGTH}`, "g"), (limit, operator) =>
    operator === ">=" || operator === "<" ? limit : past(limit)],
  // And on the right: `40rem <= width`.
  [new RegExp(`${LENGTH}\\s*(>=|<=|>|<)\\s*width(?![-\\w])`, "g"), (limit, operator) =>
    operator === "<=" || operator === ">" ? limit : past(limit)],
]

// The widths at which a media condition starts or stops applying, in px.
export const mediaWidthBreakpoints = (condition: string): number[] => {
  const text = condition.toLowerCase()
  const widths: number[] = []
  WIDTH_CONDITIONS.forEach(([pattern, toWidth], index) => {
    for (const match of text.matchAll(pattern)) {
      // The operator comes first when the width is on the left, last when it is on the right.
      const [operator, value, unit] = index === 2 ? [match[1], match[2], match[3]] : index === 3 ? [match[3], match[1], match[2]] : ["", match[1], match[2]]
      widths.push(Math.ceil(toWidth(px(value, unit), operator)))
    }
  })
  return widths
}

type RuleLike = { media?: { mediaText?: string }; cssRules?: ArrayLike<RuleLike>; styleSheet?: { cssRules?: ArrayLike<RuleLike> } | null }

// Every width at which the page's own styles change, smallest first. A stylesheet from another
// origin cannot be read and is skipped.
export const readBreakpoints = (ownerDocument: Document): number[] => {
  const widths = new Set<number>()
  const visit = (rules: ArrayLike<RuleLike> | undefined) => {
    for (const rule of Array.from(rules ?? [])) {
      for (const width of mediaWidthBreakpoints(rule.media?.mediaText ?? "")) widths.add(width)
      try {
        visit(rule.cssRules)
        visit(rule.styleSheet?.cssRules)
      } catch {
        /* An imported sheet from another origin. */
      }
    }
  }
  for (const sheet of [...Array.from(ownerDocument.styleSheets), ...(ownerDocument.adoptedStyleSheets ?? [])]) {
    for (const width of mediaWidthBreakpoints(sheet.media?.mediaText ?? "")) widths.add(width)
    try {
      visit(sheet.cssRules as unknown as ArrayLike<RuleLike>)
    } catch {
      /* A sheet from another origin. */
    }
  }
  return [...widths].filter((width) => width > 0 && width <= RESPONSIVE_MAX_SIZE).sort((a, b) => a - b)
}

// A list with one of its items moved to another place in it.
export const moveItem = <Item,>(items: readonly Item[], from: number, to: number): Item[] => {
  const next = [...items]
  next.splice(Math.max(0, Math.min(items.length - 1, to)), 0, ...next.splice(from, 1))
  return next
}

// How much a size has to shrink to fit in the room there is. Never grows it.
export const responsiveFitScale = (size: ResponsiveSize, room: ResponsiveSize) =>
  Math.min(1, Math.max(0, room.width) / size.width, Math.max(0, room.height) / size.height)
