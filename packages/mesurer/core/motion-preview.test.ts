import { describe, expect, it } from "vitest"
import { fitMotionPreview } from "./motion-preview"

describe("motion preview framing", () => {
  it("centers a small button without enlarging it", () => {
    const fit = fitMotionPreview({ left: 0, top: 0, width: 141.328125, height: 42.5 }, 336, 144)
    expect(fit.scale).toBe(1)
    expect(fit.left).toBeCloseTo((336 - 141.328125) / 2)
    expect(fit.top).toBeCloseTo((144 - 42.5) / 2)
  })

  it("fits the full orbit including negative translation and padding", () => {
    const bounds = { left: -142, top: -94, width: 284, height: 188 }
    const fit = fitMotionPreview(bounds, 336, 144)
    expect(fit.left + bounds.left * fit.scale).toBeGreaterThanOrEqual(12)
    expect(fit.top + bounds.top * fit.scale).toBeCloseTo(12)
    expect(fit.left + (bounds.left + bounds.width) * fit.scale).toBeLessThanOrEqual(324)
    expect(fit.top + (bounds.top + bounds.height) * fit.scale).toBeCloseTo(132)
  })

  it("scales down large containers while preserving their aspect ratio", () => {
    const fit = fitMotionPreview({ left: 0, top: 0, width: 1226, height: 580 }, 336, 144)
    expect(fit.scale).toBeCloseTo(120 / 580)
    expect(fit.top).toBeCloseTo(12)
  })
})
