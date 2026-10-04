import { describe, expect, it } from "vitest"
import { getFloatingSurfacePlacement } from "./use-floating-surface-placement"

describe("getFloatingSurfacePlacement", () => {
  it("preserves the 0.2.3 recording-card gap from the toolbar", () => {
    expect(getFloatingSurfacePlacement({
      anchor: { left: 16, right: 416, top: 16, bottom: 56 },
      surfaceWidth: 288,
      viewportWidth: 1200,
      viewportHeight: 800,
      align: "left",
      gap: 4,
      rightOffset: 0,
    })).toMatchObject({ side: "bottom", left: 16, top: 60 })
  })

  it("keeps inset control menus at their existing eight-pixel gap", () => {
    expect(getFloatingSurfacePlacement({
      anchor: { left: 380, right: 412, top: 20, bottom: 52 },
      surfaceWidth: 176,
      viewportWidth: 1200,
      viewportHeight: 800,
      align: "right",
      gap: 8,
      rightOffset: 4,
    })).toMatchObject({ side: "bottom", right: 784, top: 60 })
  })
})
