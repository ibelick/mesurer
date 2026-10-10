import { describe, expect, it, vi } from "vitest"
import { holdPreviewSideEffects } from "./preview-guard"

const makeView = () => {
  const sent: string[] = []
  class FakeRequest {
    method: string
    constructor(public url: string, init?: { method?: string }) {
      this.method = init?.method ?? "GET"
    }
  }
  class FakeXHR {
    method = ""
    aborted = false
    open(method: string) { this.method = method }
    send() { sent.push(`xhr ${this.method}`) }
    abort() { this.aborted = true }
  }
  const view = {
    fetch: vi.fn(async (input: unknown, init?: { method?: string }) => {
      sent.push(`fetch ${init?.method ?? "GET"}`)
      return new Response()
    }),
    Request: FakeRequest,
    TypeError,
    navigator: { sendBeacon: () => true },
    XMLHttpRequest: FakeXHR,
  }
  return { view: view as unknown as Window & typeof globalThis, sent }
}

describe("holdPreviewSideEffects", () => {
  it("lets reads through and holds requests that write", async () => {
    const { view, sent } = makeView()
    holdPreviewSideEffects(view)
    await view.fetch("/a")
    await expect(view.fetch("/a", { method: "post" })).rejects.toThrow("POST")
    expect(sent).toEqual(["fetch GET"])
  })

  it("holds a beacon and an XHR that writes, and lets an XHR read through", () => {
    const { view, sent } = makeView()
    holdPreviewSideEffects(view)
    expect(view.navigator.sendBeacon("/t", "x")).toBe(false)
    const write = new (view as typeof globalThis).XMLHttpRequest()
    write.open("DELETE", "/a")
    write.send()
    expect((write as unknown as { aborted: boolean }).aborted).toBe(true)
    const read = new (view as typeof globalThis).XMLHttpRequest()
    read.open("GET", "/a")
    read.send()
    expect(sent).toEqual(["xhr GET"])
  })
})
