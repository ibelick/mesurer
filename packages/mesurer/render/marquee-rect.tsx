import type { Rect } from "../core/types"

export function MarqueeRect({ rect, color }: { rect: Rect; color: string }) {
  return (
    <div
      aria-hidden="true"
      className="msr:pointer-events-none msr:absolute msr:border"
      data-mesurer-overlay-marquee="true"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderColor: color,
        backgroundColor: `${color}1f`,
      }}
    />
  )
}
