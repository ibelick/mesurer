import { describe, expect, it } from "vitest"
import type { ReviewState } from "./model"
import { createPlatformReviewPublisher } from "./platform"
import { liveImageDocument } from "./capture/live-images"

const state: ReviewState = {
  schemaVersion: 1,
  project: { id: "project", name: "Project" },
  page: { id: "page", projectId: "project", url: "https://example.com/pricing", versionIds: ["version"] },
  versions: [{
    id: "version",
    pageId: "page",
    number: 1,
    createdAt: 1,
    snapshot: { url: "https://example.com/pricing", title: " Pricing ", capturedAt: 1, viewport: { width: 1440, height: 3200, devicePixelRatio: 2 }, scroll: { x: 0, y: 0 } },
    domContext: { fingerprints: {} },
  }],
  review: { id: "review", pageId: "page", createdAt: 1, updatedAt: 1, comments: [], annotations: [] },
}

const publication = { id: "local", html: "<html></html>", state, screenshot: new Blob(["picture"], { type: "image/webp" }) }

describe("createPlatformReviewPublisher", () => {
  it("sends the review's state and its picture in one request, and gives the address it is seen at", async () => {
    const sent: Array<{ url: string; init: RequestInit }> = []
    const publish = createPlatformReviewPublisher({
      apiOrigin: "https://api.example.com/",
      getCapability: async () => "capability",
      fetch: async (url, init) => {
        sent.push({ url: String(url), init: init ?? {} })
        return new Response(JSON.stringify({ url: "https://api.example.com/s/k7Qm2xPa9fRt" }), { status: 201 })
      },
    })

    await expect(publish(publication)).resolves.toBe("https://api.example.com/s/k7Qm2xPa9fRt")
    expect(sent[0].url).toBe("https://api.example.com/api/toolbar/share")
    expect(sent[0].init.headers).toMatchObject({ Authorization: "Bearer capability" })
    const form = sent[0].init.body as FormData
    expect(JSON.parse(String(form.get("review")))).toMatchObject({
      version: 2,
      pageUrl: "https://example.com/pricing",
      origin: "https://example.com",
      title: "Pricing",
      viewport: { width: 1440, height: 3200 },
      state: { schemaVersion: 1 },
    })
    expect((form.get("screenshot") as File).type).toBe("image/webp")
  })

  it("fails when the platform does not keep the review", async () => {
    const publish = createPlatformReviewPublisher({
      apiOrigin: "https://api.example.com",
      getCapability: async () => "capability",
      fetch: async () => new Response(JSON.stringify({ error: "Capability is invalid" }), { status: 401 }),
    })
    await expect(publish(publication)).rejects.toThrow("Capability is invalid")
  })

  it("rejects a link outside the platform", async () => {
    const publish = createPlatformReviewPublisher({
      apiOrigin: "https://mesurer.dev",
      getCapability: async () => "capability",
      fetch: async () => new Response(JSON.stringify({ url: "https://example.com/s/fake" }), { status: 201 }),
    })
    await expect(publish(publication)).rejects.toThrow("invalid review link")
  })

  it("omits URL secrets, DOM fingerprints, arbitrary live markup and ambient credentials", async () => {
    const sensitiveUrl = "https://example.com/pricing?token=secret#private"
    const sensitive: ReviewState = {
      ...state,
      page: { ...state.page, id: sensitiveUrl, url: sensitiveUrl },
      versions: state.versions.map((version) => ({
        ...version, pageId: sensitiveUrl,
        snapshot: { ...version.snapshot, url: sensitiveUrl },
        domContext: { fingerprints: { field: { tagName: "input", attributes: { value: "secret" }, bounds: { left: 0, top: 0, width: 10, height: 10 } } } },
      })),
      review: { ...state.review, pageId: sensitiveUrl },
    }
    let request: RequestInit | undefined
    const publish = createPlatformReviewPublisher({
      apiOrigin: "https://mesurer.dev",
      getCapability: async () => "capability",
      fetch: async (_url, init) => {
        request = init
        return new Response(JSON.stringify({ url: "https://mesurer.dev/s/review" }), { status: 201 })
      },
    })
    await publish({ ...publication, state: sensitive })
    const form = request?.body as FormData
    const body = JSON.parse(String(form.get("review")))
    expect(JSON.stringify(body)).not.toContain("secret")
    expect(body.pageUrl).toBe("https://example.com/pricing")
    expect(body.state.page.id).toBe(body.pageUrl)
    expect(body.state.versions[0].domContext.fingerprints).toEqual({})
    expect(form.has("live")).toBe(false)
    await expect(publish({ ...publication, state: sensitive, live: "<svg>secret</svg>" })).rejects.toThrow("Could not prepare the page's images")
    expect(request).toMatchObject({ credentials: "omit", redirect: "error" })
    const image = liveImageDocument([{ url: "https://images.example/photo?a=1&b=2", x: 10, y: 20, width: 30, height: 40, fit: "meet" }], ["https://images.example/photo?a=1&b=2"], 100, 200)
    expect(image).toContain('href="https://images.example/photo"')
    expect(image).not.toContain("?a=1")
    expect(image).not.toContain("foreignObject")
  })
})
