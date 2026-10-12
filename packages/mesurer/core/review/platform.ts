import type { ReviewState } from "./model"

// A review as it is handed over once saved: its state, placed on the picture of the page, that
// picture, and the page that shows both on its own.
export type ReviewPublication = {
  id: string
  html: string
  state: ReviewState
  screenshot: Blob
  /**
   * The page as an SVG document that loads, from their own address, the images the picture
   * could not include. Present only when there are some.
   */
  live?: string
}

export type PlatformReviewPublisherOptions = {
  /** The platform's API, as an origin: `https://api.example.com`. */
  apiOrigin: string
  /** What allows this one review to be kept: asked for each time, used once. */
  getCapability: () => Promise<string>
  fetch?: typeof fetch
  /** Calls the upload off. */
  signal?: AbortSignal
}

const MAX_TITLE = 300

/**
 * Keeps saved reviews on the Mesurer platform. A review goes up as a form of two parts, its
 * state as JSON and the picture as a file, and comes back as the address it is seen at.
 */
export const createPlatformReviewPublisher =
  ({ apiOrigin, getCapability, fetch: send = fetch, signal }: PlatformReviewPublisherOptions) =>
  async ({ state, screenshot, live }: ReviewPublication) => {
    const version = state.versions[state.versions.length - 1]
    if (!version) throw new Error("Review has no page version")
    const { url: pageUrl, title, viewport } = version.snapshot
    const form = new FormData()
    form.set(
      "review",
      JSON.stringify({
        version: 2,
        pageUrl,
        origin: new URL(pageUrl).origin,
        title: (title ?? "").trim().slice(0, MAX_TITLE),
        // The size of the page as it was captured, which is what the review's positions are in.
        viewport: { width: viewport.width, height: viewport.height },
        state,
      }),
    )
    form.set("screenshot", screenshot, "screenshot")
    if (live) form.set("live", new Blob([live], { type: "image/svg+xml" }), "live.svg")
    const response = await send(`${apiOrigin.replace(/\/+$/, "")}/api/toolbar/share`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getCapability()}`, "Idempotency-Key": state.review.id },
      body: form,
      signal,
    })
    const body: unknown = await response.json().catch(() => null)
    const address = typeof body === "object" && body !== null && "url" in body ? body.url : undefined
    if (!response.ok || typeof address !== "string") throw new Error(`Review not saved (${response.status})`)
    return address
  }
