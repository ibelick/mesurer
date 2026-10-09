import { MeasureTag } from "../components/measure-tag"
import { MEASURE_LABEL_OFFSET } from "../core/constants"
import { formatValue } from "../core/utils"

export type OptionContainerLines = {
  top: { y1: number; y2: number; x: number; value: number }
  bottom: { y1: number; y2: number; x: number; value: number }
  left: { x1: number; x2: number; y: number; value: number }
  right: { x1: number; x2: number; y: number; value: number }
}

export function OptionContainerLinesOverlay({
  lines,
}: {
  lines: OptionContainerLines
}) {
  return (
    <>
      {lines.top.value > 0 ? (
        <>
          <div
            className="msr:absolute msr:w-px msr:bg-[#2563eb]"
            style={{
              top: lines.top.y1,
              height: lines.top.y2 - lines.top.y1,
              left: lines.top.x,
            }}
          />
          <MeasureTag
            className="msr:-translate-y-1/2 msr:bg-ink-900/90 msr:dark:bg-black/90 msr:dark:text-white"
            style={{
              left: lines.top.x + MEASURE_LABEL_OFFSET,
              top: (lines.top.y1 + lines.top.y2) / 2,
            }}
          >
            {formatValue(lines.top.value)}
          </MeasureTag>
        </>
      ) : null}

      {lines.bottom.value > 0 ? (
        <>
          <div
            className="msr:absolute msr:w-px msr:bg-[#2563eb]"
            style={{
              top: lines.bottom.y1,
              height: lines.bottom.y2 - lines.bottom.y1,
              left: lines.bottom.x,
            }}
          />
          <MeasureTag
            className="msr:-translate-y-1/2 msr:bg-ink-900/90 msr:dark:bg-black/90 msr:dark:text-white"
            style={{
              left: lines.bottom.x + MEASURE_LABEL_OFFSET,
              top: (lines.bottom.y1 + lines.bottom.y2) / 2,
            }}
          >
            {formatValue(lines.bottom.value)}
          </MeasureTag>
        </>
      ) : null}

      {lines.left.value > 0 ? (
        <>
          <div
            className="msr:absolute msr:h-px msr:bg-[#2563eb]"
            style={{
              left: lines.left.x1,
              width: lines.left.x2 - lines.left.x1,
              top: lines.left.y,
            }}
          />
          <MeasureTag
            className="msr:-translate-x-1/2 msr:bg-ink-900/90 msr:dark:bg-black/90 msr:dark:text-white"
            style={{
              left: (lines.left.x1 + lines.left.x2) / 2,
              top: lines.left.y + MEASURE_LABEL_OFFSET,
            }}
          >
            {formatValue(lines.left.value)}
          </MeasureTag>
        </>
      ) : null}

      {lines.right.value > 0 ? (
        <>
          <div
            className="msr:absolute msr:h-px msr:bg-[#2563eb]"
            style={{
              left: lines.right.x1,
              width: lines.right.x2 - lines.right.x1,
              top: lines.right.y,
            }}
          />
          <MeasureTag
            className="msr:-translate-x-1/2 msr:bg-ink-900/90 msr:dark:bg-black/90 msr:dark:text-white"
            style={{
              left: (lines.right.x1 + lines.right.x2) / 2,
              top: lines.right.y + MEASURE_LABEL_OFFSET,
            }}
          >
            {formatValue(lines.right.value)}
          </MeasureTag>
        </>
      ) : null}
    </>
  )
}
