import { describe, expect, it, vi } from "vitest"
import { observeMotion } from "./observed-motion"

const node = () => {
  const inline: Record<string, string> = {}
  return { nodeType: 1, isConnected: true, children: [] as unknown[], shadowRoot: null as unknown, values: { transform: "none", opacity: "1" } as Record<string, string>, inline, style: { getPropertyValue: (property: string) => inline[property] ?? "" }, getAnimations: undefined as unknown }
}
function fixture(root = node(), withObserver = true) {
  let time = 0, id = 0
  const frames = new Map<number, FrameRequestCallback>()
  const mutations: { wake: (records?: MutationRecord[]) => void; disconnect: ReturnType<typeof vi.fn> }[] = []
  class Observer {
    disconnect = vi.fn()
    observe = vi.fn()
    constructor(public wake: (records?: MutationRecord[]) => void) { mutations.push(this) }
  }
  const view = {
    MutationObserver: withObserver ? Observer : undefined,
    performance: { now: () => time },
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++id, callback); return id },
    cancelAnimationFrame: (request: number) => frames.delete(request),
    getComputedStyle: (element: ReturnType<typeof node>) => ({ getPropertyValue: (property: string) => element.values[property as keyof typeof element.values] ?? "" }),
  } as unknown as Window
  const changed = vi.fn()
  const stop = observeMotion(root as unknown as Element, view, changed)
  const flush = (next: number) => { time = next; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(time)) }
  return { root, view, changed, stop, flush, frames, mutations }
}

describe("selected-subtree motion observation", () => {
  it("publishes the first JS style change without waiting for an animation frame", () => {
    const test = fixture()
    test.root.inline.transform = "translateX(12px)"
    test.mutations[0].wake([{ type: "attributes", attributeName: "style", target: test.root } as unknown as MutationRecord])
    expect(test.changed).toHaveBeenLastCalledWith([{ element: test.root, properties: ["transform"] }])
    test.stop()
  })

  it("does not classify an unrelated style mutation as motion", () => {
    const test = fixture()
    test.root.inline.color = "red"
    test.mutations[0].wake([{ type: "attributes", attributeName: "style", target: test.root } as unknown as MutationRecord])
    expect(test.changed).not.toHaveBeenCalled()
    test.stop()
  })
  it("detects child changes with no Web Animations or MutationObserver API", () => {
    const root = node(), child = node()
    root.children.push(child)
    const test = fixture(root, false)
    test.flush(0)
    child.values.transform = "translateX(12px)"
    test.flush(100)
    expect(test.changed).toHaveBeenLastCalledWith([{ element: child, properties: ["transform"] }])
    test.stop()
  })

  it("does not classify a native animation as observed JavaScript motion", () => {
    const root = node(), child = node()
    root.children.push(child)
    root.getAnimations = () => [{ effect: { target: child, getKeyframes: () => [{ transform: "translateX(12px)" }] } }]
    const test = fixture(root)
    test.flush(0)
    child.values.transform = "translateX(12px)"
    test.flush(100)
    root.getAnimations = () => []
    child.values.transform = "none"
    test.flush(200)
    expect(test.changed).not.toHaveBeenCalled()
    test.stop()
  })

  it("watches open shadow roots and stops all work on cleanup", () => {
    const root = node(), child = node()
    root.shadowRoot = { children: [child] }
    const test = fixture(root)
    test.flush(0)
    expect(test.mutations).toHaveLength(2)
    child.values.opacity = "0.5"
    test.flush(100)
    expect(test.changed).toHaveBeenLastCalledWith([{ element: child, properties: ["opacity"] }])
    test.stop()
    expect(test.frames.size).toBe(0)
    test.mutations.forEach((observer) => { expect(observer.disconnect).toHaveBeenCalledOnce(); observer.wake() })
    expect(test.frames.size).toBe(0)
  })

  it("detects JavaScript inputs even when a native effect covers the same property", () => {
    const root = node()
    root.getAnimations = () => [{ effect: { target: root, getKeyframes: () => [{ transform: "translateX(12px)" }] } }]
    root.inline.transform = "translateX(var(--x))"
    root.values["--x"] = "0px"
    const test = fixture(root)
    test.flush(0)
    root.values["--x"] = "20px"
    test.flush(100)
    expect(test.changed).toHaveBeenLastCalledWith([{ element: root, properties: ["transform"] }])
    test.stop()
  })

  it("detects replaced text independently of native animation coverage", () => {
    const test = fixture()
    test.mutations[0].wake([{ type: "childList", target: test.root } as unknown as MutationRecord])
    expect(test.changed).toHaveBeenLastCalledWith([{ element: test.root, properties: ["content"] }])
    test.mutations[0].wake([{ type: "characterData", target: node() } as unknown as MutationRecord])
    expect(test.changed).toHaveBeenCalledTimes(1)
    test.stop()
  })

  it("ends idle bursts and tolerates unsupported or disappearing elements", () => {
    const test = fixture()
    test.flush(0)
    test.flush(1600)
    expect(test.frames.size).toBe(0)
    test.view.getComputedStyle = () => { throw new Error("document detached") }
    test.mutations[0].wake()
    expect(() => test.flush(1700)).not.toThrow()
    expect(test.changed).not.toHaveBeenCalled()
    test.stop()
  })
})
