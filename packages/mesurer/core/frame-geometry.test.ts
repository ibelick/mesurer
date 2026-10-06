import { describe, expect, it } from "vitest"
import { framePointToParent, parentPointToFrame, projectPoint, projectRect } from "./frame-geometry"

function fixture(transform: string, rect = { left: 100, top: 50 }) {
  class Matrix {
    a = 1; b = 0; c = 0; d = 1
    constructor(value?: string) {
      if (value) [this.a, this.b, this.c, this.d] = value.match(/-?[\d.]+/g)!.map(Number)
    }
  }
  const document = { defaultView: { performance: { now: () => 0 }, DOMMatrixReadOnly: Matrix, getComputedStyle: (element: { style: unknown }) => element.style } }
  const frame = {
    ownerDocument: document, parentElement: null, getRootNode: () => document,
    clientLeft: 2, clientTop: 3, offsetWidth: 300, offsetHeight: 200,
    style: { transform, scale: "none", rotate: "none", zoom: "1", width: "300px", height: "200px", boxSizing: "border-box", paddingLeft: "0px", paddingTop: "0px" },
    getBoundingClientRect: () => rect,
  } as unknown as Element
  const child = { defaultView: { frameElement: frame } } as unknown as Document
  return { frame, child }
}

describe("frame coordinate projection", () => {
  it("scales points, borders, and rectangle dimensions and supports inverse hit testing", () => {
    const { frame, child } = fixture("matrix(0.5,0,0,0.5,0,0)")
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: 106, top: 61.5, width: 50, height: 20 })
    expect(parentPointToFrame(frame, framePointToParent(frame, { x: 10, y: 20 }))).toEqual({ x: 10, y: 20 })
  })

  it("projects rotated iframe corners rather than just adding its AABB offset", () => {
    const { frame, child } = fixture("matrix(0,1,-1,0,0,0)")
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: 237, top: 62, width: 40, height: 100 })
    expect(parentPointToFrame(frame, framePointToParent(frame, { x: 10, y: 20 }))).toEqual({ x: 10, y: 20 })
  })

  it("does not reuse geometry after a synchronous layout change", () => {
    const rect = { left: 100, top: 50 }
    const { frame } = fixture("matrix(1,0,0,1,0,0)", rect)
    expect(framePointToParent(frame, { x: 0, y: 0 })).toEqual({ x: 102, y: 53 })
    rect.left = 200
    expect(framePointToParent(frame, { x: 0, y: 0 })).toEqual({ x: 202, y: 53 })
  })

  it("projects nested frames and converts back through their common ancestor", () => {
    const outer = fixture("matrix(0.5,0,0,0.5,0,0)")
    const inner = fixture("matrix(1,0,0,1,0,0)")
    Object.defineProperty(outer.child, "defaultView", { value: { ...outer.frame.ownerDocument.defaultView, frameElement: outer.frame } })
    Object.defineProperty(inner.frame, "ownerDocument", { value: outer.child })
    const point = { x: 10, y: 20 }
    expect(projectPoint(point, inner.child, outer.child)).toEqual({ x: 112, y: 73 })
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, inner.child)).toEqual({ left: 157, top: 88, width: 50, height: 20 })
    expect(projectPoint({ x: 157, y: 88 }, outer.frame.ownerDocument, inner.child)).toEqual(point)
  })

  it("rejects unrelated document trees instead of returning partially projected points", () => {
    const source = fixture("matrix(1,0,0,1,0,0)")
    const target = fixture("matrix(1,0,0,1,0,0)")
    expect(projectPoint({ x: 10, y: 20 }, source.child, target.child)).toEqual({ x: -1, y: -1 })
  })

  it("rejects singular transforms during inverse hit testing", () => {
    const { frame } = fixture("matrix(0,0,0,0,0,0)")
    expect(parentPointToFrame(frame, { x: 100, y: 50 })).toEqual({ x: -1, y: -1 })
  })

  it("supports nonuniform scaling and percentage zoom", () => {
    const { frame, child } = fixture("matrix(2,0,0,3,0,0)")
    Object.assign((frame as HTMLElement).style, { zoom: "50%" })
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: 112, top: 84.5, width: 100, height: 60 })
  })

  it("uses resolved border-box dimensions for percentage-sized frames", () => {
    const { frame, child } = fixture("matrix(0,1,-1,0,0,0)")
    Object.assign((frame as HTMLElement).style, { width: "100%", height: "50%" })
    Object.assign(frame, { offsetWidth: 400, offsetHeight: 100 })
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: 137, top: 62, width: 40, height: 100 })
  })

  it("uses the rendered rect translation from individual CSS translate properties", () => {
    const rect = { left: 100, top: 50 }
    const { frame } = fixture("matrix(1,0,0,1,0,0)", rect)
    Object.assign((frame as HTMLElement).style, { translate: "50px 0" })
    rect.left += 50
    expect(framePointToParent(frame, { x: 10, y: 20 })).toEqual({ x: 162, y: 73 })
  })

  it("keeps fractional resolved pixel dimensions", () => {
    const { frame, child } = fixture("matrix(0,1,-1,0,0,0)")
    Object.assign((frame as HTMLElement).style, { width: "400.5px", height: "100.25px" })
    Object.assign(frame, { offsetWidth: 400, offsetHeight: 100 })
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: 137.25, top: 62, width: 40, height: 100 })
  })

  it("does not parse unresolved percentage dimensions as pixels", () => {
    const { frame, child } = fixture("matrix(0,1,-1,0,0,0)")
    Object.assign((frame as HTMLElement).style, { width: "100%", height: "50%" })
    Object.assign(frame, { offsetWidth: 0, offsetHeight: 0 })
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: 37, top: 62, width: 40, height: 100 })
  })

  it("does not treat perspective as an ordinary 2D affine transform", () => {
    const { frame, child } = fixture("matrix(1,0,0,1,0,0)")
    Object.assign((frame as HTMLElement).style, { perspective: "500px" })
    expect(parentPointToFrame(frame, { x: 100, y: 50 })).toEqual({ x: -1, y: -1 })
    expect(projectRect({ left: 10, top: 20, width: 100, height: 40 }, child)).toEqual({ left: -1, top: -1, width: 0, height: 0 })
  })
})
