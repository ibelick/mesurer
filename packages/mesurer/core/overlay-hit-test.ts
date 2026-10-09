const overlayFor = (overlayNode: HTMLDivElement) =>
  overlayNode.matches("[data-mesurer-overlay]")
    ? overlayNode
    : overlayNode.querySelector<HTMLElement>("[data-mesurer-overlay]")

const hitTestBlockers = (root: ParentNode) =>
  root.querySelectorAll<HTMLElement>(
    "[data-mesurer-overlay], [data-mesurer-comment-pin], [data-mesurer-comment-popover], [data-mesurer-comment-ui]",
  )

// The responsive previews stand over the whole page. While they do, the page behind them is not
// there to be hit: only what is in Mesurer's own tree (the previews) and in their documents is.
const withoutPageBehind = <T,>(root: Element, hit: T): T => {
  if (!root.querySelector("[data-mesurer-responsive]")) return hit
  const rootNode = root.getRootNode()
  const host = rootNode.nodeType === 11 ? (rootNode as ShadowRoot).host : null
  const behind = (element: unknown) => {
    const node = element as Element | null
    return Boolean(node?.ownerDocument) && node!.ownerDocument === root.ownerDocument && node !== host && !root.contains(node)
  }
  if (Array.isArray(hit)) return hit.filter((element) => !behind(element)) as T
  return behind(hit) ? (null as T) : hit
}

export const withOverlayHitTesting = <T,>(
  overlayNode: HTMLDivElement | null,
  read: () => T,
): T => {
  if (!overlayNode) return read()
  const overlay = overlayFor(overlayNode)
  const root = overlayNode.closest(".mesurer-root") ?? overlay ?? overlayNode
  const blockers = hitTestBlockers(root)
  const previous = Array.from(blockers, (element) => element.style.pointerEvents)
  for (const element of blockers) element.style.pointerEvents = "none"
  try {
    return withoutPageBehind(root, read())
  } finally {
    blockers.forEach((element, index) => {
      element.style.pointerEvents = previous[index] ?? ""
    })
  }
}
