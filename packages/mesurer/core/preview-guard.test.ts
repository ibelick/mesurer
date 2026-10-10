import { describe, expect, it, vi } from "vitest"
import { holdPreviewSideEffects } from "./preview-guard"

const makeView = () => {
  const sent: string[] = []
  class FakeRequest {
    keepalive: boolean
    constructor(public url: string, init?: { keepalive?: boolean }) {
      this.keepalive = init?.keepalive ?? false
    }
  }
  const view = {
    fetch: vi.fn(async (_input: unknown, init?: { method?: string }) => {
      sent.push(`fetch ${init?.method ?? "GET"}`)
      return new Response()
    }),
    Request: FakeRequest,
    Response,
    navigator: { sendBeacon: () => false },
  }
  return { view: view as unknown as Window & typeof globalThis, sent }
}

describe("holdPreviewSideEffects", () => {
  it("lets the page read and write as it would in another tab", async () => {
    const { view, sent } = makeView()
    holdPreviewSideEffects(view)
    await view.fetch("/a")
    await view.fetch("/a", { method: "POST" })
    expect(sent).toEqual(["fetch GET", "fetch POST"])
  })

  it("holds a beacon, and tells the page it went", () => {
    const { view, sent } = makeView()
    holdPreviewSideEffects(view)
    expect(view.navigator.sendBeacon("/t", "x")).toBe(true)
    expect(sent).toEqual([])
  })

  it("holds a request sent to outlive the page, and answers it as done", async () => {
    const { view, sent } = makeView()
    holdPreviewSideEffects(view)
    expect((await view.fetch("/t", { method: "POST", keepalive: true })).status).toBe(204)
    const request = new (view as typeof globalThis).Request("/t", { keepalive: true })
    expect((await view.fetch(request)).status).toBe(204)
    expect(sent).toEqual([])
  })

  it("holds a window once, however often it is asked to", async () => {
    const { view, sent } = makeView()
    holdPreviewSideEffects(view)
    const held = view.fetch
    holdPreviewSideEffects(view)
    expect(view.fetch).toBe(held)
    await view.fetch("/a")
    expect(sent).toEqual(["fetch GET"])
  })
})
