import { memo, type CSSProperties } from "react"
import { parseCssColor } from "../core/colors"
import type { LayoutGuide } from "../core/layout-guides"

type LayoutGuidesOverlayProps = {
  enabled: boolean
  guides: LayoutGuide[]
}

const fillFor = (guide: LayoutGuide) => {
  const sample = parseCssColor(guide.color)
  if (!sample) return `rgba(255, 0, 0, ${guide.opacity})`
  return `rgba(${Math.round(sample.red)}, ${Math.round(sample.green)}, ${Math.round(sample.blue)}, ${guide.opacity})`
}

const tracks = (count: number) => Array.from({ length: Math.max(1, Math.min(24, Math.round(count))) }, (_, index) => index)

const pack = (align: LayoutGuide["align"]) =>
  align === "max" ? "end" : align === "center" ? "center" : "start"

const axisStyle = (guide: LayoutGuide): CSSProperties => {
  const columns = guide.kind === "columns"
  const count = Math.max(1, Math.min(24, Math.round(guide.count)))
  const size = Math.max(1, guide.size)
  const stretch = guide.align === "stretch"
  const template = stretch ? `repeat(${count}, minmax(0, 1fr))` : `repeat(${count}, ${size}px)`
  const packed = pack(guide.align)
  return {
    position: "absolute",
    inset: 0,
    display: "grid",
    ...(columns
      ? {
          gridTemplateColumns: template,
          columnGap: guide.gutter,
          justifyContent: stretch ? undefined : packed,
          paddingLeft: stretch || guide.align === "min" ? guide.offset : 0,
          paddingRight: stretch || guide.align === "max" ? guide.offset : 0,
        }
      : {
          gridTemplateRows: template,
          rowGap: guide.gutter,
          alignContent: stretch ? undefined : packed,
          paddingTop: stretch || guide.align === "min" ? guide.offset : 0,
          paddingBottom: stretch || guide.align === "max" ? guide.offset : 0,
        }),
    transform:
      guide.align === "center"
        ? columns
          ? `translateX(${guide.offset}px)`
          : `translateY(${guide.offset}px)`
        : undefined,
  }
}

const trackStyle = (fill: string): CSSProperties => ({
  backgroundColor: fill,
  minWidth: 0,
  minHeight: 0,
  width: "100%",
  height: "100%",
})

export const LayoutGuidesOverlay = memo(function LayoutGuidesOverlay({ enabled, guides }: LayoutGuidesOverlayProps) {
  if (!enabled) return null
  const visible = guides.filter((guide) => guide.visible)
  if (visible.length === 0) return null
  return (
    <div className="mesurer-layout-guides" data-mesurer-layout-guides aria-hidden="true">
      {visible.map((guide) => {
        const fill = fillFor(guide)
        if (guide.kind === "grid") {
          const size = Math.max(1, guide.size)
          return (
            <div
              key={guide.id}
              className="mesurer-layout-guides-grid"
              data-mesurer-layout-band
              style={{
                backgroundImage: `linear-gradient(to right, ${fill} 1px, transparent 1px), linear-gradient(to bottom, ${fill} 1px, transparent 1px)`,
                backgroundSize: `${size}px ${size}px`,
              }}
            />
          )
        }
        return (
          <div key={guide.id} className="mesurer-layout-guides-layer" style={axisStyle(guide)}>
            {tracks(guide.count).map((index) => (
              <div
                key={index}
                data-mesurer-layout-band
                style={trackStyle(fill)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
})
