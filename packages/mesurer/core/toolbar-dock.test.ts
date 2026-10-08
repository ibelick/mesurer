import { describe, expect, it } from "vitest"
import type { ToolbarSide } from "./persistence"
import { dockedToolbarPosition, dragToolbarPosition, isVerticalToolbarSide, snapToolbarPosition, toolbarZone } from "./toolbar-dock"

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
  it("reads an unknown edge from the toolbar: close to one it glues there", () => {
    const result = snapToolbarPosition({ point: { x: 30, y: 100 }, size: column, glued: undefined, ...viewport })
    expect(result).toEqual({ side: "left", align: "center", position: { x: 16, y: 250 } })
    const away = snapToolbarPosition({ point: { x: 80, y: 300 }, size: bar, glued: undefined, ...viewport })
    expect(away).toEqual({ side: null, align: "center", position: { x: 80, y: 300 } })
  })

  it("leaves a toolbar known to be free where it is, even beside an edge, but on screen", () => {
    const beside = snapToolbarPosition({ point: { x: 10, y: 300 }, size: bar, glued: null, ...viewport })
    expect(beside).toEqual({ side: null, align: "center", position: { x: 10, y: 300 } })
    const outside = snapToolbarPosition({ point: { x: 1100, y: 900 }, size: bar, glued: null, ...viewport })
    expect(outside.position).toEqual({ x: 892, y: 752 })
  })

  it("keeps a glued toolbar in the middle of its edge, whatever its size", () => {
    const result = snapToolbarPosition({ point: { x: 40, y: 400 }, size: column, glued: "left", ...viewport })
    expect(result).toEqual({ side: "left", align: "center", position: { x: 16, y: 250 } })
    const icon = snapToolbarPosition({ point: { x: 16, y: 250 }, size: { width: 40, height: 40 }, glued: "left", ...viewport })
    expect(icon.position).toEqual({ x: 16, y: 380 })
    const top = snapToolbarPosition({ point: { x: 450, y: 16 }, size: bar, glued: "top", ...viewport })
    expect(top.position).toEqual({ x: 450, y: 16 })
  })

  it("settles in a corner when the toolbar sits close to the edge across from its glue", () => {
    const topLeft = snapToolbarPosition({ point: { x: 20, y: 20 }, size: bar, glued: "top", ...viewport })
    expect(topLeft.position).toEqual({ x: 16, y: 16 })
    const topRight = snapToolbarPosition({ point: { x: 880, y: 16 }, size: bar, glued: "top", ...viewport })
    expect(topRight.position).toEqual({ x: 884, y: 16 })
    const leftBottom = snapToolbarPosition({ point: { x: 16, y: 690 }, size: column, glued: "left", ...viewport })
    expect(leftBottom.position).toEqual({ x: 16, y: 484 })
  })

  it("keeps the corner it holds, whatever its size", () => {
    const icon = { width: 40, height: 40 }
    // Closed around its middle the icon would sit far from the corner: the held spot wins.
    const closed = snapToolbarPosition({ point: { x: 146, y: 16 }, size: icon, glued: "top", align: "start", ...viewport })
    expect(closed).toEqual({ side: "top", align: "start", position: { x: 16, y: 16 } })
    const opened = snapToolbarPosition({ point: { x: 1144, y: 16 }, size: bar, glued: "top", align: "end", ...viewport })
    expect(opened.position).toEqual({ x: 884, y: 16 })
    const column40 = snapToolbarPosition({ point: { x: 16, y: 16 }, size: icon, glued: "left", align: "end", ...viewport })
    expect(column40.position).toEqual({ x: 16, y: 744 })
  })

  it("glues to the top when the top-left corner is reached first", () => {
    const result = snapToolbarPosition({ point: { x: 20, y: 20 }, size: bar, glued: undefined, ...viewport })
    expect(result.side).toBe("top")
    expect(result.position.y).toBe(16)
  })
})

describe("toolbarZone", () => {
  const zone = (x: number, y: number) => toolbarZone({ x, y }, viewport.viewport)

  it("is a band along each edge, and free in the middle", () => {
    expect(zone(600, 72)).toBe("top")
    expect(zone(600, 73)).toBe(null)
    expect(zone(600, 728)).toBe("bottom")
    expect(zone(72, 400)).toBe("left")
    expect(zone(73, 400)).toBe(null)
    expect(zone(1128, 400)).toBe("right")
    expect(zone(600, 400)).toBe(null)
  })

  it("covers a glued toolbar entirely, so grabbing it anywhere keeps it glued", () => {
    // A glued toolbar spans 16 to 56 across its edge.
    for (const across of [16, 36, 56]) {
      expect(zone(across, 400)).toBe("left")
      expect(zone(600, across)).toBe("top")
    }
  })

  it("runs a little deeper for the zone the toolbar is in, so its line does not flicker", () => {
    const held = (x: number, y: number, side: ToolbarSide) => toolbarZone({ x, y }, viewport.viewport, side)
    expect(held(78, 400, "left")).toBe("left")
    expect(held(81, 400, "left")).toBe(null)
    expect(zone(78, 400)).toBe(null)
    // In a corner the same margin favours the edge it is on.
    expect(held(30, 34, "top")).toBe("top")
    expect(held(30, 34, "left")).toBe("left")
    expect(held(30, 40, "top")).toBe("left")
  })

  it("splits each corner on its diagonal", () => {
    expect(zone(30, 20)).toBe("top")
    expect(zone(20, 30)).toBe("left")
    expect(zone(1180, 30)).toBe("right")
    expect(zone(1170, 20)).toBe("top")
    expect(zone(20, 770)).toBe("left")
    expect(zone(30, 780)).toBe("bottom")
    expect(zone(1180, 770)).toBe("right")
    expect(zone(1170, 780)).toBe("bottom")
  })

  it("mirrors exactly across the viewport, so both sides and both ends behave alike", () => {
    for (const [x, y] of [[10, 300], [72, 300], [73, 300], [20, 30], [30, 20], [300, 40]]) {
      const mirrorX = { left: "right", right: "left" }[zone(x, y) as string] ?? zone(x, y)
      const mirrorY = { top: "bottom", bottom: "top" }[zone(x, y) as string] ?? zone(x, y)
      expect(zone(1200 - x, y)).toBe(mirrorX)
      expect(zone(x, 800 - y)).toBe(mirrorY)
    }
  })
})

describe("dragToolbarPosition", () => {
  const sizeFor = (upright: boolean) => (upright ? column : bar)
  const grab = { along: 0.5, across: 0.5 }
  const drag = (pointer: { x: number; y: number }, upright = false, glued: ToolbarSide | null = null) =>
    dragToolbarPosition({ pointer, grab, glued, upright, sizeFor, ...viewport })
  const holds = (pointer: { x: number; y: number }, wasUpright = false) => {
    const { upright, position } = drag(pointer, wasUpright)
    const size = sizeFor(upright)
    return (
      pointer.x >= position.x && pointer.x <= position.x + size.width &&
      pointer.y >= position.y && pointer.y <= position.y + size.height
    )
  }

  it("takes the edge of the zone under the pointer, whichever way it came", () => {
    expect(drag({ x: 600, y: 400 }).side).toBe(null)
    expect(drag({ x: 40, y: 400 }).side).toBe("left")
    expect(drag({ x: 90, y: 400 }).side).toBe(null)
    expect(drag({ x: 600, y: 40 }).side).toBe("top")
    expect(drag({ x: 600, y: 90 }).side).toBe(null)
  })

  it("pins a glued toolbar into the corner it is dragged toward, and eases off it", () => {
    // The grab is the bar's middle, so the bar's left edge sits 150px left of the pointer.
    expect(drag({ x: 166, y: 36 }).position).toEqual({ x: 16, y: 16 })
    expect(drag({ x: 1034, y: 36 }).position).toEqual({ x: 884, y: 16 })
    const leaving = drag({ x: 246, y: 36 }).position
    expect(leaving.x).toBeGreaterThan(16)
    expect(leaving.x).toBeLessThan(96)
    expect(drag({ x: 400, y: 36 }).position.x).toBeGreaterThan(200)
  })

  it("turns a free toolbar pushed lengthwise into a wall, wherever it is grabbed", () => {
    // Grabbed at its right end, a row reaches the left wall with the pointer still 290px away.
    const byEnd = (pointer: { x: number; y: number }, upright: boolean) =>
      dragToolbarPosition({ pointer, grab: { along: 0.9, across: 0.5 }, glued: null, upright, sizeFor, ...viewport })
    expect(byEnd({ x: 270, y: 400 }, false)).toMatchObject({ side: null, upright: false, position: { x: 8, y: 380 } })
    // Pushed 40px further it stands up, free, under the pointer.
    expect(byEnd({ x: 230, y: 400 }, false)).toEqual({ side: null, upright: true, pushed: true, position: { x: 210, y: 130 } })
    // Standing, it is not pushed any more, so it stays that way when the pointer backs off.
    expect(byEnd({ x: 400, y: 400 }, true).upright).toBe(true)
    // The mirror: a column pushed up into the top wall lies flat.
    expect(byEnd({ x: 600, y: 230 }, true)).toEqual({ side: null, upright: false, pushed: true, position: { x: 330, y: 210 } })
    // It does not turn into a wall that would push it straight back: it would flip back and forth.
    expect(byEnd({ x: 230, y: 200 }, false).upright).toBe(false)
    expect(byEnd({ x: 230, y: 250 }, false).upright).toBe(true)
    expect(byEnd({ x: 230, y: 250 }, true).upright).toBe(true)
  })

  it("turns a wall-turned toolbar back once the pointer lets off the wall", () => {
    const byEnd = (pointer: { x: number; y: number }, upright: boolean, pushed: boolean) =>
      dragToolbarPosition({ pointer, grab: { along: 0.9, across: 0.5 }, glued: null, upright, pushed, sizeFor, ...viewport })
    // Still against the wall it stays standing; let off it, it lies flat again.
    expect(byEnd({ x: 260, y: 400 }, true, true)).toMatchObject({ upright: true, pushed: true })
    expect(byEnd({ x: 280, y: 400 }, true, true)).toMatchObject({ upright: false, pushed: false })
    // A column that was not turned by a wall keeps standing wherever it goes.
    expect(byEnd({ x: 600, y: 400 }, true, false)).toMatchObject({ upright: true, pushed: false })
    // Glued, then pulled off again, it is no longer a wall's doing.
    expect(byEnd({ x: 40, y: 400 }, true, true)).toMatchObject({ side: "left", pushed: false })
  })

  it("leaves the middle of a short edge out of the corners' pull", () => {
    // A 300px column on a 600px edge has 268px to slide in: its middle is 134px from either end.
    const short = { viewport: { width: 1200, height: 600 } }
    const at = (y: number) =>
      dragToolbarPosition({ pointer: { x: 30, y }, grab, glued: "left", upright: true, sizeFor, ...short }).position.y
    expect(at(300)).toBe(150)
    expect(at(280)).toBe(130)
    expect(at(190)).toBe(16)
  })

  it("holds a free toolbar at the grabbed spot", () => {
    expect(drag({ x: 600, y: 400 })).toEqual({ side: null, upright: false, pushed: false, position: { x: 450, y: 380 } })
  })

  it("keeps its orientation in the free middle, and only turns in an edge zone", () => {
    // Pulled off a side edge it stays a column, under the pointer.
    expect(drag({ x: 90, y: 400 }, true)).toEqual({ side: null, upright: true, pushed: false, position: { x: 70, y: 250 } })
    expect(drag({ x: 600, y: 400 }, true).upright).toBe(true)
    // Pulled off the top it stays a row, even right beside the left edge's zone.
    expect(drag({ x: 90, y: 90 }, false).upright).toBe(false)
    // The top and bottom zones lay a column flat; the side zones stand a row up.
    expect(drag({ x: 600, y: 40 }, true)).toMatchObject({ side: "top", upright: false })
    expect(drag({ x: 600, y: 760 }, true)).toMatchObject({ side: "bottom", upright: false })
    expect(drag({ x: 40, y: 400 }, false)).toMatchObject({ side: "left", upright: true })
    expect(drag({ x: 1160, y: 400 }, false)).toMatchObject({ side: "right", upright: true })
  })

  it("stands the toolbar up under the pointer in a side zone", () => {
    expect(drag({ x: 40, y: 400 })).toEqual({ side: "left", upright: true, pushed: false, position: { x: 20, y: 250 } })
    expect(drag({ x: 20, y: 400 }).position).toEqual({ x: 16, y: 250 })
  })

  it("slides along the edge with the pointer", () => {
    expect(drag({ x: 30, y: 300 }).position).toEqual({ x: 16, y: 150 })
    expect(drag({ x: 30, y: 700 }).position).toEqual({ x: 16, y: 800 - 300 - 16 })
  })

  it("keeps the pointer on the toolbar in every zone", () => {
    for (const x of [600, 140, 100, 60, 40, 20]) {
      expect(holds({ x, y: 400 })).toBe(true)
      expect(holds({ x, y: 400 }, true)).toBe(true)
      expect(holds({ x: 1200 - x, y: 400 })).toBe(true)
    }
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
