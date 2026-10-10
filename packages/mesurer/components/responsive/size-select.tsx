import { RESPONSIVE_DEVICES, RESPONSIVE_DEVICE_GROUPS, responsiveDeviceFor, type ResponsiveSize } from "../../core/responsive"
import { SettingsSelectCaret, settingsSelectClassName } from "../control-field"
import { stop } from "./shared"

// A size picked from the menu: a device's, or only the width of one of the page's breakpoints.
export type SizeChoice = { width: number; height?: number }

const BREAKPOINT = "breakpoint-"

// What a size is called in the menu: its device, the breakpoint its width is, or nothing.
export const sizeName = (size: ResponsiveSize, breakpoints: readonly number[]) =>
  responsiveDeviceFor(size)?.name ?? (breakpoints.includes(size.width) ? `${size.width}px` : undefined)

// A menu of sizes to choose from: the page's own breakpoints, then the known devices. `size` is
// the one shown as chosen; with none, or one the menu does not have, `placeholder` stands in.
// `detailed` adds each device's size to its name, where nothing else shows it.
export function SizeSelect({
  label,
  size,
  breakpoints,
  placeholder,
  detailed,
  disabled,
  onSelect,
}: {
  label: string
  size?: ResponsiveSize
  breakpoints: readonly number[]
  placeholder: string
  detailed?: boolean
  disabled?: boolean
  onSelect: (choice: SizeChoice) => void
}) {
  const value = size
    ? (responsiveDeviceFor(size)?.id ?? (breakpoints.includes(size.width) ? `${BREAKPOINT}${size.width}` : ""))
    : ""
  return (
    <span className="msr:relative msr:block msr:min-w-0 msr:flex-1">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        className={settingsSelectClassName}
        onPointerDown={stop}
        onChange={(event) => {
          // Let go of the keyboard: a menu left in focus takes the next letter as a search for
          // one of its sizes, so a tool's shortcut would pick a device instead.
          event.currentTarget.blur()
          const chosen = event.currentTarget.value
          if (chosen.startsWith(BREAKPOINT)) return onSelect({ width: Number(chosen.slice(BREAKPOINT.length)) })
          const device = RESPONSIVE_DEVICES.find((candidate) => candidate.id === chosen)
          if (device) onSelect({ width: device.width, height: device.height })
        }}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {breakpoints.length ? (
          <optgroup label="Breakpoints">
            {breakpoints.map((breakpoint) => (
              <option key={breakpoint} value={`${BREAKPOINT}${breakpoint}`}>
                {breakpoint}px
              </option>
            ))}
          </optgroup>
        ) : null}
        {RESPONSIVE_DEVICE_GROUPS.map(([kind, group]) => (
          <optgroup key={kind} label={group}>
            {RESPONSIVE_DEVICES.filter((device) => device.kind === kind).map((device) => (
              <option key={device.id} value={device.id}>
                {detailed ? `${device.name} · ${device.width} × ${device.height}` : device.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <SettingsSelectCaret />
    </span>
  )
}
