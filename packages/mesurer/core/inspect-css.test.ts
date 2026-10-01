import { describe, expect, it } from "vitest"
import { formatInspectCssParts, visibleInspectCssParts } from "./inspect-css"

const emptyEdges = { top: 0, right: 0, bottom: 0, left: 0 }

const styleStub = (values: Record<string, string>): CSSStyleDeclaration =>
  new Proxy(values as CSSStyleDeclaration, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined
      const key = prop in target ? prop : prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
      return target[key] ?? target[prop] ?? ""
    },
  })

describe("formatInspectCssParts", () => {
  it("includes margin and skips empty values", () => {
    const parts = formatInspectCssParts(
      {
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
        margin: { top: 0, right: 0, bottom: 16, left: 0 },
        gap: null,
      },
      styleStub({
        display: "block",
        borderTopWidth: "0px",
        borderRightWidth: "0px",
        borderBottomWidth: "0px",
        borderLeftWidth: "0px",
        borderRadius: "0px",
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(0, 0, 0)",
        position: "static",
        boxShadow: "none",
        opacity: "1",
        zIndex: "auto",
        overflow: "visible",
      }),
    )
    expect(parts.some((part) => part.label === "padding" && part.value === "8px")).toBe(true)
    expect(parts.some((part) => part.label === "margin" && part.value.includes("16px"))).toBe(true)
    expect(parts.some((part) => part.label === "border")).toBe(false)
    expect(parts.some((part) => part.label === "display")).toBe(false)
    expect(parts.some((part) => part.label === "background")).toBe(false)
    expect(parts.some((part) => part.label === "color")).toBe(false)
  })

  it("orders padding before gap and margin", () => {
    const parts = formatInspectCssParts(
      {
        padding: { top: 4, right: 4, bottom: 4, left: 4 },
        margin: { top: 8, right: 8, bottom: 8, left: 8 },
        gap: { row: 12, column: 12 },
      },
      styleStub({
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        justifyContent: "flex-start",
        rowGap: "12px",
        columnGap: "12px",
        borderTopWidth: "0px",
        borderRightWidth: "0px",
        borderBottomWidth: "0px",
        borderLeftWidth: "0px",
        borderRadius: "0px",
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(0, 0, 0)",
        position: "static",
        boxShadow: "none",
        opacity: "1",
        zIndex: "auto",
        overflow: "visible",
      }),
    )
    const labels = parts.map((part) => part.label)
    expect(labels.indexOf("padding")).toBeLessThan(labels.indexOf("gap"))
    expect(labels.indexOf("gap")).toBeLessThan(labels.indexOf("margin"))
    expect(labels).toContain("display")
  })

  it("keeps non-default colors", () => {
    const parts = formatInspectCssParts(
      {
        padding: emptyEdges,
        margin: emptyEdges,
        gap: null,
      },
      styleStub({
        display: "block",
        borderTopWidth: "0px",
        borderRightWidth: "0px",
        borderBottomWidth: "0px",
        borderLeftWidth: "0px",
        borderRadius: "0px",
        backgroundColor: "rgb(30, 41, 59)",
        color: "rgb(248, 250, 252)",
        position: "static",
        boxShadow: "none",
        opacity: "1",
        zIndex: "auto",
        overflow: "visible",
      }),
    )
    expect(parts.some((part) => part.label === "background")).toBe(true)
    expect(parts.some((part) => part.label === "color")).toBe(true)
  })
})

describe("visibleInspectCssParts", () => {
  it("caps rows until expanded", () => {
    const parts = Array.from({ length: 8 }, (_, index) => ({ label: `p${index}`, value: "1" }))
    const capped = visibleInspectCssParts(parts, false, 6)
    expect(capped.visible).toHaveLength(6)
    expect(capped.hiddenCount).toBe(2)
    const expanded = visibleInspectCssParts(parts, true, 6)
    expect(expanded.visible).toHaveLength(8)
    expect(expanded.hiddenCount).toBe(0)
  })
})
