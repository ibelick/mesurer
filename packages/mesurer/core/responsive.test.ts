import { describe, expect, it } from "vitest"
import {
  RESPONSIVE_DEVICES,
  activeBreakpoint,
  clampResponsiveSize,
  mediaWidthBreakpoints,
  readBreakpoints,
  responsiveDeviceFor,
  responsiveFitScale,
} from "./responsive"

describe("mediaWidthBreakpoints", () => {
  it("reads min-width and max-width, where the styles start to change", () => {
    expect(mediaWidthBreakpoints("(min-width: 768px)")).toEqual([768])
    expect(mediaWidthBreakpoints("(max-width: 767px)")).toEqual([768])
    expect(mediaWidthBreakpoints("(max-width: 767.98px)")).toEqual([768])
    expect(mediaWidthBreakpoints("screen and (min-width: 640px) and (max-width: 1023px)")).toEqual([640, 1024])
  })

  it("reads the range syntax, either way round", () => {
    expect(mediaWidthBreakpoints("(width >= 40rem)")).toEqual([640])
    expect(mediaWidthBreakpoints("(width > 639px)")).toEqual([640])
    expect(mediaWidthBreakpoints("(width < 768px)")).toEqual([768])
    expect(mediaWidthBreakpoints("(width <= 767px)")).toEqual([768])
    expect(mediaWidthBreakpoints("(640px <= width)")).toEqual([640])
    expect(mediaWidthBreakpoints("(1024px > width)")).toEqual([1024])
    expect(mediaWidthBreakpoints("(640px <= width < 768px)").sort((a, b) => a - b)).toEqual([640, 768])
  })

  it("counts em and rem as 16px, and leaves other conditions alone", () => {
    expect(mediaWidthBreakpoints("(min-width: 48em)")).toEqual([768])
    expect(mediaWidthBreakpoints("(min-height: 600px)")).toEqual([])
    expect(mediaWidthBreakpoints("(min-device-width: 600px)")).toEqual([])
    expect(mediaWidthBreakpoints("(prefers-color-scheme: dark)")).toEqual([])
    expect(mediaWidthBreakpoints("print")).toEqual([])
  })
})

describe("readBreakpoints", () => {
  const media = (mediaText: string, cssRules: unknown[] = []) => ({ media: { mediaText }, cssRules })

  it("collects every width once, smallest first, through nested rules and imports", () => {
    const blocked = { get cssRules(): never { throw new Error("SecurityError") } }
    const ownerDocument = {
      styleSheets: [
        { cssRules: [media("(min-width: 1024px)"), { cssRules: [media("(width >= 40rem)", [media("(min-width: 1024px)")])] }] },
        { media: { mediaText: "(max-width: 479px)" }, cssRules: [{ styleSheet: { cssRules: [media("(min-width: 768px)")] } }] },
        blocked,
      ],
      adoptedStyleSheets: [{ cssRules: [media("(min-width: 1280px)")] }],
    } as unknown as Document
    expect(readBreakpoints(ownerDocument)).toEqual([480, 640, 768, 1024, 1280])
  })
})

describe("activeBreakpoint", () => {
  it("is the last breakpoint a width has reached", () => {
    expect(activeBreakpoint([640, 768, 1024], 390)).toBe(null)
    expect(activeBreakpoint([640, 768, 1024], 640)).toBe(640)
    expect(activeBreakpoint([640, 768, 1024], 1000)).toBe(768)
    expect(activeBreakpoint([640, 768, 1024], 2000)).toBe(1024)
  })
})

describe("responsive sizes", () => {
  it("keeps a size within bounds, in whole pixels", () => {
    expect(clampResponsiveSize({ width: 10, height: 99999 })).toEqual({ width: 240, height: 3840 })
    expect(clampResponsiveSize({ width: 390.6, height: 844 })).toEqual({ width: 391, height: 844 })
  })

  it("shrinks to fit the room, and never grows", () => {
    expect(responsiveFitScale({ width: 1440, height: 900 }, { width: 720, height: 900 })).toBe(0.5)
    expect(responsiveFitScale({ width: 390, height: 844 }, { width: 1200, height: 422 })).toBe(0.5)
    expect(responsiveFitScale({ width: 390, height: 844 }, { width: 1200, height: 900 })).toBe(1)
  })
})

describe("responsive devices", () => {
  it("names each device once, with a size within bounds", () => {
    expect(new Set(RESPONSIVE_DEVICES.map((device) => device.id)).size).toBe(RESPONSIVE_DEVICES.length)
    for (const device of RESPONSIVE_DEVICES) expect(clampResponsiveSize(device)).toEqual({ width: device.width, height: device.height })
  })

  it("finds the device a size belongs to, held either way up", () => {
    expect(responsiveDeviceFor({ width: 375, height: 812 })?.name).toBe("iPhone X")
    expect(responsiveDeviceFor({ width: 812, height: 375 })?.name).toBe("iPhone X")
    expect(responsiveDeviceFor({ width: 500, height: 812 })).toBeUndefined()
  })
})
