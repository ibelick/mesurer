import { SettingsSelectCaret, settingsSelectClassName } from "../control-field"
import { stop } from "./shared"

// The zooms to choose from, besides the automatic one.
const ZOOMS = [0.25, 0.5, 0.75, 1]

export const percent = (scale: number) => `${Math.round(scale * 100)}%`

// A menu of zooms. No value is the automatic one, named by `auto`.
export function ZoomSelect({
  label,
  value,
  auto,
  onChange,
}: {
  label: string
  value: number | null
  auto: string
  onChange: (zoom: number | null) => void
}) {
  return (
    <span className="msr:relative msr:block msr:shrink-0">
      <select
        aria-label={label}
        value={value ?? ""}
        className={settingsSelectClassName}
        onPointerDown={stop}
        onChange={(event) => onChange(event.currentTarget.value ? Number(event.currentTarget.value) : null)}
      >
        <option value="">{auto}</option>
        {ZOOMS.map((zoom) => (
          <option key={zoom} value={zoom}>
            {percent(zoom)}
          </option>
        ))}
      </select>
      <SettingsSelectCaret />
    </span>
  )
}
