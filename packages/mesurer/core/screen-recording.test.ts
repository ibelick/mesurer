import { describe, expect, it } from "vitest"
import {
  getCaptureViewportMetrics,
  placeScreenshotRectInVideo,
  screenshotRectToVideoCrop,
  tabCaptureRectToVideoCrop,
  visibleSelectionSlice,
} from "./screen-recording-crop"
import { isFullClipExport, resolveRecordingDuration } from "./screen-recording-export"
import { GIF_FRAME_RATE, gifFrameTimes } from "./screen-recording-gif"
import { writeWebmDuration } from "./screen-recording-webm"

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

describe("visibleSelectionSlice", () => {
  it("covers the whole selection while it stays inside the window", () => {
    expect(visibleSelectionSlice(
      { left: 100, top: 80, width: 200, height: 40 },
      { width: 1000, height: 800 },
    )).toEqual({ dx: 0, dy: 0, dw: 1, dh: 1, visible: true })
  })

  it("keeps the on-screen part of the selection in place after a resize", () => {
    expect(visibleSelectionSlice(
      { left: 900, top: 80, width: 200, height: 40 },
      { width: 1000, height: 800 },
    )).toEqual({ dx: 0, dy: 0, dw: 0.5, dh: 1, visible: true })
  })
})

describe("placeScreenshotRectInVideo", () => {
  const rect = { left: 100, top: 80, width: 200, height: 40 }
  const viewport = { width: 1000, height: 800 }

  it("centers the viewport when a resized capture frame is taller than the page", () => {
    expect(placeScreenshotRectInVideo(rect, 2000, 2000, viewport)).toMatchObject({
      sx: 200,
      sy: 360,
      sw: 400,
      sh: 80,
      dx: 0,
      dy: 0,
      dw: 1,
      dh: 1,
    })
  })

  it("centers the viewport when a resized capture frame is wider than the page", () => {
    expect(placeScreenshotRectInVideo(rect, 2400, 1600, viewport)).toMatchObject({
      sx: 400,
      sy: 160,
      sw: 400,
      sh: 80,
    })
  })

  it("keeps the visible slice in place when the selection leaves the viewport", () => {
    const placed = placeScreenshotRectInVideo(
      { left: 900, top: 80, width: 200, height: 40 },
      1000,
      800,
      viewport,
    )
    expect(placed.sx).toBe(900)
    expect(placed.sw).toBe(100)
    expect(placed.dx).toBe(0)
    expect(placed.dw).toBeCloseTo(0.5)
    expect(placed.dh).toBe(1)
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

  it("keeps the recorded length when container metadata is only the first clusters", () => {
    expect(resolveRecordingDuration(1.2, 8)).toBe(8)
  })
})

describe("writeWebmDuration", () => {
  it("replaces a short container duration with the recorded length", () => {
    const duration = new Uint8Array(4)
    new DataView(duration.buffer).setFloat32(0, 1000)
    const infoPayload = [
      0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40,
      0x44, 0x89, 0x84, ...duration,
    ]
    const info = [0x15, 0x49, 0xa9, 0x66, 0x8e, ...infoPayload]
    const bytes = new Uint8Array([0x18, 0x53, 0x80, 0x67, 0x93, ...info])
    expect(writeWebmDuration(bytes, 8)).toBe(true)
    expect(new DataView(bytes.buffer).getFloat32(5 + 4 + 1 + 7 + 2 + 1)).toBe(8000)
  })
})

describe("isFullClipExport", () => {
  it("detects full-length exports within tolerance", () => {
    expect(isFullClipExport(0, 9.96, 10)).toBe(true)
    expect(isFullClipExport(0.2, 9.5, 10)).toBe(false)
  })
})

describe("gifFrameTimes", () => {
  it("samples the complete trim range at the GIF frame rate", () => {
    expect(gifFrameTimes(2, 2.2)).toEqual([2, 2 + 1 / GIF_FRAME_RATE, 2 + 2 / GIF_FRAME_RATE])
  })

  it("always returns a frame for a short clip", () => {
    expect(gifFrameTimes(4, 4.01)).toEqual([4])
  })
})
