type PreviewBounds = { left: number; top: number; width: number; height: number }

export function fitMotionPreview(bounds: PreviewBounds, width: number, height: number, padding = 12) {
  const scale = Math.min(1, Math.max(1, width - padding * 2) / Math.max(1, bounds.width), Math.max(1, height - padding * 2) / Math.max(1, bounds.height))
  return {
    scale,
    left: (width - bounds.width * scale) / 2 - bounds.left * scale,
    top: (height - bounds.height * scale) / 2 - bounds.top * scale,
  }
}
