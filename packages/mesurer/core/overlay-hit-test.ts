const overlayFor = (overlayNode: HTMLDivElement) =>
  overlayNode.matches("[data-mesurer-overlay]")
    ? overlayNode
    : overlayNode.querySelector<HTMLElement>("[data-mesurer-overlay]")

const hitTestBlockers = (root: ParentNode) =>
  root.querySelectorAll<HTMLElement>(
    "[data-mesurer-overlay], [data-mesurer-comment-pin], [data-mesurer-comment-popover], [data-mesurer-comment-ui]",
  )

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
    return read()
  } finally {
    blockers.forEach((element, index) => {
      element.style.pointerEvents = previous[index] ?? ""
    })
  }
}
