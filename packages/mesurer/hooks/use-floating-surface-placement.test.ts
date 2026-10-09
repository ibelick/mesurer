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

  const bar = { left: 342, right: 758, top: 16, bottom: 56 }
  const column = { left: 16, right: 56, top: 142, bottom: 558 }
  const viewport = { viewportWidth: 1100, viewportHeight: 700, gap: 8, rightOffset: 4 }

  it("keeps a menu within the toolbar's span instead of sticking out past its end", () => {
    // Lined up with a control near the right end, a 240px panel would overshoot the bar.
    expect(getFloatingSurfacePlacement({
      anchor: { left: 702, right: 718, top: 20, bottom: 52 }, bar, surfaceWidth: 240, align: "left", ...viewport,
    })).toMatchObject({ left: 518, top: 60 })
    // And one lined up by its right edge near the left end would overshoot the other way.
    expect(getFloatingSurfacePlacement({
      anchor: { left: 346, right: 408, top: 20, bottom: 52 }, bar, surfaceWidth: 240, align: "right", ...viewport,
    })).toMatchObject({ right: 1100 - 342 - 240, top: 60 })
  })

  it("opens beside a vertical toolbar, level with its control and within the toolbar", () => {
    expect(getFloatingSurfacePlacement({
      anchor: { left: 20, right: 52, top: 377, bottom: 409 }, bar: column, surfaceWidth: 205, surfaceHeight: 73,
      align: "left", sideOfAnchor: "right", ...viewport,
    })).toMatchObject({ left: 60, top: 377 })
    // Near the bottom of the column the menu moves up rather than hanging below it.
    expect(getFloatingSurfacePlacement({
      anchor: { left: 20, right: 52, top: 522, bottom: 554 }, bar: column, surfaceWidth: 176, surfaceHeight: 65,
      align: "left", sideOfAnchor: "right", ...viewport,
    })).toMatchObject({ left: 60, top: 558 - 65 })
    expect(getFloatingSurfacePlacement({
      anchor: { left: 1048, right: 1080, top: 377, bottom: 409 }, bar: { ...column, left: 1044, right: 1084 },
      surfaceWidth: 205, surfaceHeight: 73, align: "right", sideOfAnchor: "left", ...viewport,
    })).toMatchObject({ right: 60, top: 377 })
  })

  it("centers a surface on the toolbar when it is longer than the toolbar", () => {
    expect(getFloatingSurfacePlacement({
      anchor: column, bar: column, surfaceWidth: 252, surfaceHeight: 500, align: "right", sideOfAnchor: "right",
      viewportWidth: 1100, viewportHeight: 700, gap: 4, rightOffset: 0,
    })).toMatchObject({ left: 60, top: 100 })
  })
})
