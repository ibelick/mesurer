import { memo, type CSSProperties } from "react"
import { parseCssColor } from "../core/colors"
import type { LayoutGuide } from "../core/layout-guides"

type LayoutGuidesOverlayProps = {
  guides: LayoutGuide[]
}

const fillFor = (guide: LayoutGuide) => {
  const sample = parseCssColor(guide.color)
  if (!sample) return `rgba(255, 0, 0, ${guide.opacity})`
  return `rgba(${Math.round(sample.red)}, ${Math.round(sample.green)}, ${Math.round(sample.blue)}, ${guide.opacity})`
}

const tracks = (count: number) => Array.from({ length: Math.max(1, Math.round(count)) }, (_, index) => index)

const axisStyle = (guide: LayoutGuide): CSSProperties => {
  const columns = guide.kind === "columns"
  const count = Math.max(1, Math.round(guide.count))
  if (guide.align === "stretch") {
    return {
      position: "absolute",
      inset: 0,
      display: "grid",
      ...(columns
        ? {
            gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
            columnGap: guide.gutter,
            paddingLeft: guide.offset,
            paddingRight: guide.offset,
          }
        : {
            gridTemplateRows: `repeat(${count}, minmax(0, 1fr))`,
            rowGap: guide.gutter,
            paddingTop: guide.offset,
            paddingBottom: guide.offset,
          }),
    }
  }
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: columns ? "row" : "column",
    justifyContent:
      guide.align === "max" ? "flex-end" : guide.align === "center" ? "center" : "flex-start",
    alignItems: "stretch",
    gap: guide.gutter,
    paddingTop: !columns && guide.align === "min" ? guide.offset : 0,
    paddingBottom: !columns && guide.align === "max" ? guide.offset : 0,
    paddingLeft: columns && guide.align === "min" ? guide.offset : 0,
    paddingRight: columns && guide.align === "max" ? guide.offset : 0,
    transform:
      guide.align === "center"
        ? columns
          ? `translateX(${guide.offset}px)`
          : `translateY(${guide.offset}px)`
        : undefined,
  }
}

const trackStyle = (guide: LayoutGuide, fill: string): CSSProperties => {
  if (guide.align === "stretch") return { backgroundColor: fill, minWidth: 0, minHeight: 0 }
  if (guide.kind === "columns") return { width: guide.size, flex: "none", backgroundColor: fill }
  return { height: guide.size, flex: "none", backgroundColor: fill }
}

export const LayoutGuidesOverlay = memo(function LayoutGuidesOverlay({ guides }: LayoutGuidesOverlayProps) {
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
                style={trackStyle(guide, fill)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
})
