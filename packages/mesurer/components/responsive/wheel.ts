type Axis = "x" | "y"

// Whether there is anything left of it to scroll that way.
const hasRoom = (node: Element, axis: Axis, delta: number) => {
  const at = axis === "x" ? node.scrollLeft : node.scrollTop
  const room = axis === "x" ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight
  return delta < 0 ? at > 0 : at < room - 1
}

// The nearest thing around `start`, itself included, with room left to scroll that way.
const scrollerFor = (start: Element | null, axis: Axis, delta: number): Element | null => {
  const view = start?.ownerDocument.defaultView
  if (!view) return null
  const overflowOf = (style: CSSStyleDeclaration) => (axis === "x" ? style.overflowX : style.overflowY)
  for (let node: Element | null = start; node; node = node.parentElement ?? (node.getRootNode() as Partial<ShadowRoot>).host ?? null) {
    const page: Document = node.ownerDocument
    let style = view.getComputedStyle(node)
    let scrolls = overflowOf(style) === "auto" || overflowOf(style) === "scroll"
    // The page itself scrolls unless it is told not to, and its body may be what tells it.
    if (node === page.scrollingElement) {
      if (style.overflowX === "visible" && style.overflowY === "visible" && page.body) style = view.getComputedStyle(page.body)
      scrolls = overflowOf(style) !== "hidden" && overflowOf(style) !== "clip"
    }
    if (scrolls && hasRoom(node, axis, delta)) return node
  }
  return null
}

const pathHits = (event: Event, selector: string) =>
  event.composedPath().some((node) => (node as Partial<Element>).matches?.(selector))

// What is under the pointer in the preview it is over, and how much smaller than it is that
// preview is drawn.
const underPointer = (event: WheelEvent, frames: Iterable<HTMLIFrameElement>) => {
  for (const frame of frames) {
    const box = frame.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) continue
    const drawn = box.width / frame.offsetWidth || 1
    const page = frame.contentDocument
    const element = page?.elementFromPoint((event.clientX - box.left) / drawn, (event.clientY - box.top) / drawn) ?? page?.scrollingElement ?? null
    return { element, drawn }
  }
  return { element: null, drawn: 1 }
}

// With no tool in hand a wheel turned over a preview goes to the page in it, and never reaches
// the row: a wheel in a frame is not heard outside it, and a page that does not scroll sideways
// (or forbids the scroll to carry on past it) keeps the row where it is. So a sideways turn
// there is the row's, as it is with a tool in hand, and up and down stays the page's.
export const passFrameWheelOn = (event: WheelEvent, row: Element | null) => {
  if (event.ctrlKey || !row || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
  const delta = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1)
  if (!delta || !hasRoom(row, "x", delta)) return
  // Kept from the page, and from the browser, which would go back a page in the history.
  event.preventDefault()
  row.scrollBy({ left: delta, behavior: "instant" })
}

// With a tool in hand the pointer is the tool's, over the previews too, and a wheel turned there
// never reaches the page in one, nor the row of them. It is passed on: up and down to what
// scrolls under the pointer in that preview and past its end to the row, sideways the other
// way round.
export const passWheelOn = (event: WheelEvent, frames: Iterable<HTMLIFrameElement>, row: Element | null) => {
  // Only what the overlay took, and not over a comment that is open on it. Anywhere else the
  // wheel already scrolls what it is over.
  if (!pathHits(event, "[data-mesurer-overlay]") || pathHits(event, "[data-mesurer-comment-popover]")) return
  // Pinching to zoom is the browser's.
  if (event.ctrlKey) return
  // The wheel is taken here, and said to be: one the page leaves alone is the browser's to use,
  // and sideways it goes back a page in the history rather than along the row.
  event.preventDefault()
  // A trackpad never moves quite straight. Only the way it mostly goes is followed, so going
  // down a preview does not also slide the row.
  const axis: Axis = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? "x" : "y"
  const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (row?.clientHeight ?? 1) : 1
  const delta = (axis === "x" ? event.deltaX : event.deltaY) * step
  if (!delta) return
  const { element, drawn } = underPointer(event, frames)
  // Sideways is the row's first, so the previews can be gone through from over any of them: a
  // page that is a little too wide would otherwise keep the wheel for itself.
  const rowFirst = axis === "x" && row !== null && hasRoom(row, axis, delta)
  const inPreview = rowFirst ? null : scrollerFor(element, axis, delta)
  // Instant: a page that scrolls smoothly would start over at every turn of the wheel.
  ;(inPreview ?? row)?.scrollBy({
    [axis === "x" ? "left" : "top"]: inPreview ? delta / drawn : delta,
    behavior: "instant",
  })
}
