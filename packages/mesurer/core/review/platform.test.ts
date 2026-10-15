import { describe, expect, it } from "vitest"
import type { ReviewState } from "./model"
import { createPlatformReviewPublisher } from "./platform"

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
        return new Response(JSON.stringify({ url: "https://app.example.com/s/k7Qm2xPa9fRt" }), { status: 201 })
      },
    })

    await expect(publish(publication)).resolves.toBe("https://app.example.com/s/k7Qm2xPa9fRt")
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
    await expect(publish(publication)).rejects.toThrow("Review not saved (401)")
  })
})
