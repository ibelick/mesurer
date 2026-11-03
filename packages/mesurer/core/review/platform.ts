import type { ReviewState } from "./model"
import { sanitizeLiveImageDocument } from "./capture/live-images"

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

// URLs may contain reset links, access tokens or customer data. A shared review only needs
// the page path. Keep IDs and references consistent when they are derived from that URL.
export const privatePageUrl = (value: string) => {
  const url = new URL(value)
  url.username = ""
  url.password = ""
  url.search = ""
  url.hash = ""
  return url.href
}

const safeState = (state: ReviewState): ReviewState => {
  const originalId = state.page.id
  const pageId = originalId === state.page.url ? privatePageUrl(state.page.url) : originalId
  return {
    ...state,
    page: { ...state.page, id: pageId, url: privatePageUrl(state.page.url) },
    versions: state.versions.map((version) => ({
      ...version,
      pageId: version.pageId === originalId ? pageId : version.pageId,
      snapshot: { ...version.snapshot, url: privatePageUrl(version.snapshot.url) },
      // Fingerprints can include captured HTML, text, attributes and form values. They are
      // unnecessary for a picture-based shared review and should stay on the user's device.
      domContext: { fingerprints: {} },
    })),
    review: { ...state.review, pageId: state.review.pageId === originalId ? pageId : state.review.pageId },
  }
}

/**
 * Keeps saved reviews on the Mesurer platform: its state, picture, and optional live image
 * layer go up together, and it comes back as the address it is seen at.
 */
export const createPlatformReviewPublisher =
  ({ apiOrigin, getCapability, fetch: send = fetch, signal }: PlatformReviewPublisherOptions) =>
  async ({ state, screenshot, live }: ReviewPublication) => {
    state = safeState(state)
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
    const imageLayer = live ? sanitizeLiveImageDocument(live) : undefined
    if (live && !imageLayer) throw new Error("Could not prepare the page's images for this review. Please try again.")
    if (imageLayer) form.set("live", new Blob([imageLayer], { type: "image/svg+xml" }), "live.svg")
    const response = await send(`${apiOrigin.replace(/\/+$/, "")}/api/toolbar/share`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getCapability()}`, "Idempotency-Key": state.review.id },
      body: form,
      signal,
      credentials: "omit",
      redirect: "error",
    })
    const body: unknown = await response.json().catch(() => null)
    const address = typeof body === "object" && body !== null && "url" in body ? body.url : undefined
    if (!response.ok) {
      const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `Review not saved (${response.status})`
      throw new Error(message)
    }
    if (typeof address !== "string") throw new Error("Mesurer returned an invalid review link")
    const url = new URL(address)
    if (url.origin !== new URL(apiOrigin).origin || !url.pathname.startsWith("/s/")) {
      throw new Error("Mesurer returned an invalid review link")
    }
    return url.href
  }
