import { RESPONSIVE_DEVICES, RESPONSIVE_DEVICE_GROUPS, type ResponsiveDevice } from "../../core/responsive"
import { SettingsSelectCaret, settingsSelectClassName } from "../control-field"
import { stop } from "./shared"

// A menu of the known devices. `value` is the device shown as chosen; with none, `placeholder`
// stands in its place. `sizes` adds each device's size to its name, where nothing else shows it.
export function DeviceSelect({
  label,
  value = "",
  placeholder,
  sizes,
  disabled,
  onSelect,
}: {
  label: string
  value?: string
  placeholder: string
  sizes?: boolean
  disabled?: boolean
  onSelect: (device: ResponsiveDevice) => void
}) {
  return (
    <span className="msr:relative msr:block msr:min-w-0 msr:flex-1">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        className={settingsSelectClassName}
        onPointerDown={stop}
        onChange={(event) => {
          const device = RESPONSIVE_DEVICES.find((candidate) => candidate.id === event.currentTarget.value)
          if (device) onSelect(device)
        }}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {RESPONSIVE_DEVICE_GROUPS.map(([kind, group]) => (
          <optgroup key={kind} label={group}>
            {RESPONSIVE_DEVICES.filter((device) => device.kind === kind).map((device) => (
              <option key={device.id} value={device.id}>
                {sizes ? `${device.name} · ${device.width} × ${device.height}` : device.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <SettingsSelectCaret />
    </span>
  )
}
