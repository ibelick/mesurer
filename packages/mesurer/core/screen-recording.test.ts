import { describe, expect, it } from "vitest"
import {
  getCaptureViewportMetrics,
  isFullClipExport,
  resolveRecordingDuration,
  screenshotRectToVideoCrop,
} from "./screen-recording"

describe("getCaptureViewportMetrics", () => {
  it("falls back to inner dimensions without visualViewport", () => {
    const metrics = getCaptureViewportMetrics({
      innerWidth: 1200,
      innerHeight: 800,
      visualViewport: null,
    } as Window)
    expect(metrics).toEqual({ width: 1200, height: 800 })
  })

  it("uses visual viewport dimensions when present", () => {
    const metrics = getCaptureViewportMetrics({
      innerWidth: 1200,
      innerHeight: 800,
      visualViewport: { width: 1000, height: 700, offsetLeft: 12, offsetTop: 8 },
    } as Window)
    expect(metrics).toEqual({ width: 1000, height: 700 })
  })
})

describe("screenshotRectToVideoCrop", () => {
  const window = {
    innerWidth: 1000,
    innerHeight: 800,
    visualViewport: null,
  } as Window

  it("maps a viewport rect to video pixels", () => {
    const crop = screenshotRectToVideoCrop(
      { left: 100, top: 50, width: 200, height: 150 },
      2000,
      1600,
      window,
    )
    expect(crop).toEqual({ sx: 200, sy: 100, sw: 400, sh: 300 })
  })

  it("uses visual viewport dimensions for crop scaling", () => {
    const offsetWindow = {
      innerWidth: 1200,
      innerHeight: 900,
      visualViewport: { width: 1000, height: 800, offsetLeft: 50, offsetTop: 25 },
    } as Window
    const crop = screenshotRectToVideoCrop(
      { left: 150, top: 75, width: 100, height: 100 },
      1200,
      900,
      offsetWindow,
    )
    expect(crop).toEqual({ sx: 180, sy: 84, sw: 120, sh: 113 })
  })
})

describe("resolveRecordingDuration", () => {
  it("prefers media duration within elapsed upper bound", () => {
    expect(resolveRecordingDuration(9.8, 10.2)).toBe(9.8)
    expect(resolveRecordingDuration(10.5, 10)).toBe(10)
  })

  it("falls back when metadata is missing", () => {
    expect(resolveRecordingDuration(Number.NaN, 4.2)).toBe(4.2)
    expect(resolveRecordingDuration(0, 0)).toBe(0.1)
  })
})

describe("isFullClipExport", () => {
  it("detects full-length exports within tolerance", () => {
    expect(isFullClipExport(0, 9.96, 10)).toBe(true)
    expect(isFullClipExport(0.2, 9.5, 10)).toBe(false)
  })
})
