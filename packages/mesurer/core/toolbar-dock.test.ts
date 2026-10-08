import { describe, expect, it } from "vitest"
import { dockedToolbarPosition, isVerticalToolbarSide, snapToolbarPosition } from "./toolbar-dock"

const viewport = { viewportWidth: 1200, viewportHeight: 800 }
const bar = { width: 300, height: 40 }
const column = { width: 40, height: 300 }

describe("dockedToolbarPosition", () => {
  it("pins top and bottom to the edge and keeps the x coordinate", () => {
    expect(dockedToolbarPosition({ side: "top", point: { x: 240, y: 500 }, ...bar, ...viewport })).toEqual({ x: 240, y: 16 })
    expect(dockedToolbarPosition({ side: "bottom", point: { x: 240, y: 16 }, ...bar, ...viewport })).toEqual({ x: 240, y: 744 })
  })

  it("pins left and right to the edge and keeps the y coordinate", () => {
    expect(dockedToolbarPosition({ side: "left", point: { x: 900, y: 120 }, ...column, ...viewport })).toEqual({ x: 16, y: 120 })
    expect(dockedToolbarPosition({ side: "right", point: { x: 16, y: 120 }, ...column, ...viewport })).toEqual({ x: 1144, y: 120 })
  })

  it("clamps the along-edge coordinate so the toolbar stays on screen", () => {
    expect(dockedToolbarPosition({ side: "top", point: { x: 5000, y: 0 }, ...bar, ...viewport }).x).toBe(1200 - 300 - 16)
    expect(dockedToolbarPosition({ side: "left", point: { x: 0, y: 5000 }, ...column, ...viewport }).y).toBe(800 - 300 - 16)
  })
})

describe("snapToolbarPosition", () => {
  it("glues to the middle of the nearest edge within the snap distance", () => {
    const result = snapToolbarPosition({ point: { x: 30, y: 100 }, size: column, glued: null, ...viewport })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 250 }, preview: null })
  })

  it("shows a preview and pulls toward the glue spot before gluing", () => {
    const result = snapToolbarPosition({ point: { x: 80, y: 300 }, size: column, glued: null, ...viewport })
    expect(result.side).toBe(null)
    expect(result.preview).toBe("left")
    expect(result.position.x).toBeLessThan(80)
    expect(result.position.x).toBeGreaterThan(16)
  })

  it("lands exactly on the glue spot when the glue happens, so there is no jump", () => {
    const result = snapToolbarPosition({ point: { x: 40, y: 100 }, size: column, glued: null, ...viewport })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 250 }, preview: null })
  })

  it("stays free away from every edge", () => {
    const result = snapToolbarPosition({ point: { x: 400, y: 300 }, size: bar, glued: null, ...viewport })
    expect(result).toEqual({ side: null, position: { x: 400, y: 300 }, preview: null })
  })

  it("keeps a glued toolbar glued while it moves along the edge", () => {
    const result = snapToolbarPosition({ point: { x: 40, y: 400 }, size: column, glued: "left", ...viewport })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 400 }, preview: null })
  })

  it("stretches toward the pointer before releasing, so release is continuous", () => {
    const pulled = snapToolbarPosition({ point: { x: 100, y: 400 }, size: column, glued: "left", ...viewport })
    expect(pulled.side).toBe("left")
    expect(pulled.position.x).toBeGreaterThan(16)
    expect(pulled.position.x).toBeLessThan(100)
    const released = snapToolbarPosition({ point: { x: 140, y: 400 }, size: column, glued: "left", ...viewport })
    expect(released).toEqual({ side: null, position: { x: 140, y: 400 }, preview: null })
  })

  it("releases a glued toolbar only after it is pulled far from the edge", () => {
    expect(snapToolbarPosition({ point: { x: 100, y: 400 }, size: column, glued: "left", ...viewport }).side).toBe("left")
    expect(snapToolbarPosition({ point: { x: 300, y: 400 }, size: column, glued: "left", ...viewport }).side).toBe(null)
  })

  it("aims the glue at the size the glued orientation will have", () => {
    const result = snapToolbarPosition({
      point: { x: 40, y: 100 }, size: bar, glued: null, ...viewport,
      glueSize: (side) => (side === "left" ? column : undefined),
    })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 250 }, preview: null })
  })

  it("glues to the top when the top-left corner is reached first", () => {
    const result = snapToolbarPosition({ point: { x: 20, y: 20 }, size: bar, glued: null, ...viewport })
    expect(result.side).toBe("top")
    expect(result.position.y).toBe(16)
  })
})

describe("isVerticalToolbarSide", () => {
  it("is true only for left and right", () => {
    expect(isVerticalToolbarSide("left")).toBe(true)
    expect(isVerticalToolbarSide("right")).toBe(true)
    expect(isVerticalToolbarSide("top")).toBe(false)
    expect(isVerticalToolbarSide(null)).toBe(false)
  })
})
