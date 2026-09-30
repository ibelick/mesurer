import { describe, expect, it } from "vitest"
import {
  getCaptureViewportMetrics,
  isFullClipExport,
  resolveRecordingDuration,
  screenshotRectToVideoCrop,
  tabCaptureRectToVideoCrop,
} from "./screen-recording"

describe("getCaptureViewportMetrics", () => {
  it("uses the layout viewport even when a visual viewport is present", () => {
    const metrics = getCaptureViewportMetrics({
      innerWidth: 1200,
      innerHeight: 800,
      visualViewport: { width: 1000, height: 700, offsetLeft: 12, offsetTop: 8 },
    } as Window)
    expect(metrics).toEqual({ width: 1200, height: 800 })
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

  it("scales against the layout viewport, not the visual viewport", () => {
    const offsetWindow = {
      innerWidth: 1200,
      innerHeight: 900,
      visualViewport: { width: 1000, height: 800, offsetLeft: 50, offsetTop: 25 },
    } as Window
    const crop = screenshotRectToVideoCrop(
      { left: 150, top: 75, width: 100, height: 100 },
      2400,
      1800,
      offsetWindow,
    )
    expect(crop).toEqual({ sx: 300, sy: 150, sw: 200, sh: 200 })
  })
})

describe("tabCaptureRectToVideoCrop", () => {
  const rect = { left: 100, top: 80, width: 200, height: 40 }
  const viewport = { width: 1000, height: 800 }

  it("uses one scale when the frame matches the viewport", () => {
    expect(tabCaptureRectToVideoCrop(rect, 2000, 1600, viewport)).toEqual({
      sx: 200,
      sy: 160,
      sw: 400,
      sh: 80,
    })
  })

  it("keeps the vertical scale equal to the horizontal scale when the frame is shorter", () => {
    expect(tabCaptureRectToVideoCrop(rect, 2000, 1400, viewport)).toEqual({
      sx: 200,
      sy: 160,
      sw: 400,
      sh: 80,
    })
  })

  it("centers leftover frame height so the selection is not shifted up", () => {
    expect(tabCaptureRectToVideoCrop(rect, 2000, 1800, viewport)).toEqual({
      sx: 200,
      sy: 260,
      sw: 400,
      sh: 80,
    })
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
