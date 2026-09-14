const overlayFor = (overlayNode: HTMLDivElement) =>
  overlayNode.matches("[data-mesurer-overlay]")
    ? overlayNode
    : overlayNode.querySelector<HTMLElement>("[data-mesurer-overlay]")

export const withOverlayHitTesting = <T,>(
  overlayNode: HTMLDivElement | null,
  read: () => T,
): T => {
  if (!overlayNode) return read()
  const overlay = overlayFor(overlayNode)
  if (!overlay) return read()
  const previous = overlay.style.pointerEvents
  overlay.style.pointerEvents = "none"
  try {
    return read()
  } finally {
    overlay.style.pointerEvents = previous
  }
}
