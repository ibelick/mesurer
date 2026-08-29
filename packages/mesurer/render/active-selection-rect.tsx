import { MeasureTag } from "../components/measure-tag"
import { MEASURE_LABEL_OFFSET } from "../core/constants"

type ActiveSelectionRectProps = {
  left: number
  top: number
  width: number
  height: number
  labelWidth: number
  labelHeight: number
  fillColor: string
  outlineColor: string
}

export function ActiveSelectionRect({
  left,
  top,
  width,
  height,
  labelWidth,
  labelHeight,
  fillColor,
  outlineColor,
}: ActiveSelectionRectProps) {
  return (
    <>
      <div
        className="msr:pointer-events-none msr:absolute"
        data-mesurer-active-selection="true"
        style={{
          left,
          top,
          width,
          height,
          backgroundColor: fillColor,
        }}
      >
        <div
          className="msr:absolute msr:left-0 msr:top-0 msr:h-px msr:w-full"
          style={{ backgroundColor: outlineColor }}
        />
        <div
          className="msr:absolute msr:right-0 msr:top-0 msr:h-full msr:w-px"
          style={{ backgroundColor: outlineColor }}
        />
        <div
          className="msr:absolute msr:bottom-0 msr:left-0 msr:h-px msr:w-full"
          style={{ backgroundColor: outlineColor }}
        />
        <div
          className="msr:absolute msr:left-0 msr:top-0 msr:h-full msr:w-px"
          style={{ backgroundColor: outlineColor }}
        />
      </div>
      <MeasureTag
        className="msr:-translate-x-1/2 msr:bg-ink-900/90"
        style={{
          left: left + width / 2,
          top: top + height + MEASURE_LABEL_OFFSET,
        }}
      >
        {labelWidth} x {labelHeight}
      </MeasureTag>
    </>
  )
}
