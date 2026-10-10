// A responsive preview is a copy of the page, so the page's scripts run once per preview, as they
// would in as many tabs. What the page loads and saves is left to it: much of what a page reads
// it asks for the way it writes, and a preview that could not would come up empty. Only what it
// reports about the visit is held, so one visit is not counted once for each preview: beacons,
// and the requests sent to outlive the page that stand in for them.
// Marks a window that is already held, so holding it again (from the frame's side and from the
// page's own) wraps nothing twice.
const HELD = "__mesurerPreviewHeld"

export const holdPreviewSideEffects = (frameWindow: Window) => {
  const view = frameWindow as Window & typeof globalThis & { [HELD]?: boolean }
  if (view[HELD]) return
  view[HELD] = true

  // Taken as sent: told otherwise, the page would try again another way.
  view.navigator.sendBeacon = () => true

  const nativeFetch = view.fetch.bind(view)
  view.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const keepalive = init?.keepalive ?? (input instanceof view.Request && input.keepalive)
    if (!keepalive) return nativeFetch(input, init)
    // Made in the preview's own realm, so it is the page's own kind of response.
    return Promise.resolve(new view.Response(null, { status: 204 }))
  }
}

// How long a page on its way into a frame is waited for before giving up on it.
const ARRIVAL_MS = 10_000

// Holds whatever page a preview's frame shows, for as long as the frame is there. A page's
// scripts start as soon as it arrives and the frame's `load` comes after them, so each page is
// held when it replaces the one before, ahead of as much of its own work as can be: nothing
// tells a frame the moment its page starts, so it is looked for until it is there.
export const guardPreviewFrame = (frame: HTMLIFrameElement) => {
  const owner = frame.ownerDocument.defaultView
  if (!owner) return () => {}
  let heldPage: Document | null = null
  let timer: number | undefined
  const hold = () => {
    // None for a page that cannot be read, which is not this page and is left alone.
    const page = frame.contentDocument
    const view = page?.defaultView
    // A frame starts on a blank page of its own, which the real one replaces.
    if (!page || !view || page === heldPage || view.location.href === "about:blank") return false
    heldPage = page
    holdPreviewSideEffects(view)
    // A link followed in the preview, or a reload: the next page is held as it comes.
    view.addEventListener("pagehide", watch)
    return true
  }
  function watch() {
    owner!.clearInterval(timer)
    const until = Date.now() + ARRIVAL_MS
    timer = owner!.setInterval(() => {
      if (hold() || Date.now() > until) owner!.clearInterval(timer)
    }, 0)
  }
  // The latest a page is held, should it have been missed on its way in.
  frame.addEventListener("load", hold)
  watch()
  return () => {
    owner.clearInterval(timer)
    frame.removeEventListener("load", hold)
  }
}
