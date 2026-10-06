import { describe, expect, it } from "vitest"
import { createMotionDependencies } from "./motion-dependencies"

function fixture() {
  let value = "translateX(var(--x))"
  const rule = { selectorText: ".target", cssText: ".target { transform: translateX(var(--x)); }", style: { getPropertyValue: (property: string) => property === "transform" ? value : "" } }
  const sheet = { cssRules: [rule] } as unknown as CSSStyleSheet
  const document = { styleSheets: [sheet], adoptedStyleSheets: [] } as unknown as Document
  const element = { getRootNode: () => document, matches: (selector: string) => selector === ".target" } as unknown as Element
  const dependencies = createMotionDependencies(document)
  return { rule, document, element, dependencies, change: () => { value = "translateX(var(--y))"; rule.cssText = ".target { transform: translateX(var(--y)); }" } }
}

describe("motion stylesheet dependencies", () => {
  it("invalidates CSSOM edits even without DOM mutation records", () => {
    const test = fixture()
    expect(test.dependencies.forElement(test.element, "").get("transform")).toEqual(["--x"])
    test.dependencies.refresh(0)
    test.change()
    expect(test.dependencies.refresh(1000)).toBe(true)
    expect(test.dependencies.forElement(test.element, "").get("transform")).toEqual(["--y"])
  })

  it("detects adopted stylesheet replacement", () => {
    const test = fixture()
    test.dependencies.forElement(test.element, "")
    test.dependencies.refresh(0)
    test.document.adoptedStyleSheets = [{ cssRules: [{ ...test.rule, selectorText: ".target::before" }] } as unknown as CSSStyleSheet]
    expect(test.dependencies.refresh(1000)).toBe(true)
    expect(test.dependencies.forElement(test.element, "").get("transform")).toEqual(["--x", "--x"])
  })

  it("tracks stylesheet scopes inside shadow roots", () => {
    const test = fixture()
    const scope = { styleSheets: test.document.styleSheets, adoptedStyleSheets: [] }
    const element = { getRootNode: () => scope, matches: () => true } as unknown as Element
    expect(test.dependencies.forElement(element, "").get("transform")).toEqual(["--x"])
    test.dependencies.refresh(0)
    test.change()
    expect(test.dependencies.refresh(1000)).toBe(true)
    expect(test.dependencies.forElement(element, "").get("transform")).toEqual(["--y"])
  })
})
