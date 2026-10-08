import { describe, expect, it } from "vitest"
import type { ToolbarSide } from "./persistence"
import { dockedToolbarPosition, dragToolbarPosition, isVerticalToolbarSide, snapToolbarPosition } from "./toolbar-dock"

const viewport = { viewport: { width: 1200, height: 800 } }
const bar = { width: 300, height: 40 }
const column = { width: 40, height: 300 }

describe("dockedToolbarPosition", () => {
  it("pins top and bottom to the edge and keeps the x coordinate", () => {
    expect(dockedToolbarPosition({ side: "top", point: { x: 240, y: 500 }, size: bar, ...viewport })).toEqual({ x: 240, y: 16 })
    expect(dockedToolbarPosition({ side: "bottom", point: { x: 240, y: 16 }, size: bar, ...viewport })).toEqual({ x: 240, y: 744 })
  })

  it("pins left and right to the edge and keeps the y coordinate", () => {
    expect(dockedToolbarPosition({ side: "left", point: { x: 900, y: 120 }, size: column, ...viewport })).toEqual({ x: 16, y: 120 })
    expect(dockedToolbarPosition({ side: "right", point: { x: 16, y: 120 }, size: column, ...viewport })).toEqual({ x: 1144, y: 120 })
  })

  it("clamps the along-edge coordinate so the toolbar stays on screen", () => {
    expect(dockedToolbarPosition({ side: "top", point: { x: 5000, y: 0 }, size: bar, ...viewport }).x).toBe(1200 - 300 - 16)
    expect(dockedToolbarPosition({ side: "left", point: { x: 0, y: 5000 }, size: column, ...viewport }).y).toBe(800 - 300 - 16)
  })
})

describe("snapToolbarPosition", () => {
  it("glues to the middle of the nearest edge within the snap distance", () => {
    const result = snapToolbarPosition({ point: { x: 30, y: 100 }, size: column, glued: null, ...viewport })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 250 } })
  })

  it("stays free away from every edge", () => {
    const result = snapToolbarPosition({ point: { x: 80, y: 300 }, size: bar, glued: null, ...viewport })
    expect(result).toEqual({ side: null, position: { x: 80, y: 300 } })
  })

  it("keeps a glued toolbar in the middle of its edge, whatever its size", () => {
    const result = snapToolbarPosition({ point: { x: 40, y: 400 }, size: column, glued: "left", ...viewport })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 250 } })
    const icon = snapToolbarPosition({ point: { x: 16, y: 250 }, size: { width: 40, height: 40 }, glued: "left", ...viewport })
    expect(icon.position).toEqual({ x: 16, y: 380 })
    const top = snapToolbarPosition({ point: { x: 900, y: 16 }, size: bar, glued: "top", ...viewport })
    expect(top.position).toEqual({ x: 450, y: 16 })
  })

  it("aims the glue at the size the glued orientation will have", () => {
    const result = snapToolbarPosition({
      point: { x: 40, y: 100 }, size: bar, glued: null, ...viewport,
      glueSize: (side) => (side === "left" ? column : undefined),
    })
    expect(result).toEqual({ side: "left", position: { x: 16, y: 250 } })
  })

  it("glues to the top when the top-left corner is reached first", () => {
    const result = snapToolbarPosition({ point: { x: 20, y: 20 }, size: bar, glued: null, ...viewport })
    expect(result.side).toBe("top")
    expect(result.position.y).toBe(16)
  })
})

describe("dragToolbarPosition", () => {
  const sizeFor = (side: ToolbarSide | null) => (isVerticalToolbarSide(side) ? column : bar)
  const grab = { along: 0.5, across: 0.5 }
  const drag = (pointer: { x: number; y: number }, glued: ToolbarSide | null) =>
    dragToolbarPosition({ pointer, grab, glued, sizeFor, ...viewport })
  const holds = (pointer: { x: number; y: number }, glued: ToolbarSide | null) => {
    const { side, position } = drag(pointer, glued)
    const size = sizeFor(side)
    return (
      pointer.x >= position.x && pointer.x <= position.x + size.width &&
      pointer.y >= position.y && pointer.y <= position.y + size.height
    )
  }

  it("holds a free toolbar at the grabbed spot", () => {
    expect(drag({ x: 600, y: 400 }, null)).toEqual({ side: null, position: { x: 450, y: 380 }, preview: null })
  })

  it("previews the edge before the pointer is close enough to glue", () => {
    expect(drag({ x: 80, y: 400 }, null)).toMatchObject({ side: null, preview: "left" })
  })

  it("glues once the pointer is close to an edge, turned under the pointer", () => {
    expect(drag({ x: 40, y: 400 }, null)).toEqual({ side: "left", position: { x: 20, y: 250 }, preview: null })
    expect(drag({ x: 20, y: 400 }, null).position).toEqual({ x: 16, y: 250 })
  })

  it("slides along the glued edge with the pointer", () => {
    expect(drag({ x: 30, y: 300 }, "left").position).toEqual({ x: 16, y: 150 })
    expect(drag({ x: 30, y: 5000 }, "left").position).toEqual({ x: 16, y: 800 - 300 - 16 })
  })

  it("comes off the edge with the pointer and only releases far from it", () => {
    expect(drag({ x: 100, y: 400 }, "left")).toEqual({ side: "left", position: { x: 80, y: 250 }, preview: null })
    expect(drag({ x: 140, y: 400 }, "left")).toEqual({ side: null, position: { x: 8, y: 380 }, preview: null })
  })

  it("keeps the pointer on the toolbar through a glue and a release", () => {
    for (const x of [600, 140, 100, 60, 40, 20]) {
      expect(holds({ x, y: 400 }, null)).toBe(true)
      expect(holds({ x, y: 400 }, "left")).toBe(true)
      expect(holds({ x: 1200 - x, y: 400 }, "right")).toBe(true)
    }
  })

  it("glues to the top when the top-left corner is reached first", () => {
    expect(drag({ x: 20, y: 20 }, null).side).toBe("top")
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
