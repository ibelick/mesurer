import type { ScreenshotRect } from "../core/screenshot"
import { ControlNumberInput, SettingsFieldRow } from "./control-field"
import { MenuSurface } from "./menu"
import { SettingsButton } from "./settings-button"

const RecordIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="msr:block">
    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
    <circle cx="5" cy="5" r="1.75" fill="currentColor" />
  </svg>
)

type RecordingSelectionPanelProps = {
  rect: ScreenshotRect
  viewport: { width: number; height: number }
  onSizeChange: (width: number, height: number) => void
  onPositionChange: (left: number, top: number) => void
  onConfirm: () => void
}

export function RecordingSelectionPanel({
  rect,
  viewport,
  onSizeChange,
  onPositionChange,
  onConfirm,
}: RecordingSelectionPanelProps) {
  const panelWidth = 200
  const centerX = rect.left + rect.width / 2
  const left = Math.min(
    Math.max(panelWidth / 2 + 8, centerX),
    viewport.width - panelWidth / 2 - 8,
  )
  const top = Math.min(rect.top + rect.height + 12, viewport.height - 120)

  const stopBubble = (event: { stopPropagation: () => void }) => event.stopPropagation()

  return (
    <MenuSurface
      role="dialog"
      aria-label="Recording region"
      className="msr:pointer-events-auto msr:absolute msr:z-[90] msr:flex msr:w-[200px] msr:flex-col msr:gap-2 msr:p-2"
      style={{ left, top, transform: "translateX(-50%)" }}
      onPointerDown={stopBubble}
      onClick={stopBubble}
    >
      <SettingsFieldRow label="Size" columns="msr:grid-cols-[44px_minmax(0,1fr)]">
        <div className="msr:flex msr:min-w-0 msr:items-center msr:gap-1">
          <div className="msr:min-w-0 msr:flex-1">
            <ControlNumberInput
              label="Width"
              value={rect.width}
              min={1}
              max={viewport.width}
              onChange={(width) => onSizeChange(width, rect.height)}
            />
          </div>
          <span className="msr:shrink-0 msr:text-[11px] msr:text-ink-500" aria-hidden="true">×</span>
          <div className="msr:min-w-0 msr:flex-1">
            <ControlNumberInput
              label="Height"
              value={rect.height}
              min={1}
              max={viewport.height}
              onChange={(height) => onSizeChange(rect.width, height)}
            />
          </div>
          <span className="msr:shrink-0 msr:px-0.5 msr:text-[11px] msr:text-ink-500">px</span>
        </div>
      </SettingsFieldRow>
      <SettingsFieldRow label="Position" columns="msr:grid-cols-[44px_minmax(0,1fr)]">
        <div className="msr:flex msr:min-w-0 msr:items-center msr:gap-1">
          <div className="msr:min-w-0 msr:flex-1">
            <ControlNumberInput
              label="Left"
              value={rect.left}
              min={0}
              max={Math.max(0, viewport.width - rect.width)}
              onChange={(left) => onPositionChange(left, rect.top)}
            />
          </div>
          <div className="msr:min-w-0 msr:flex-1">
            <ControlNumberInput
              label="Top"
              value={rect.top}
              min={0}
              max={Math.max(0, viewport.height - rect.height)}
              onChange={(top) => onPositionChange(rect.left, top)}
            />
          </div>
          <span className="msr:shrink-0 msr:px-0.5 msr:text-[11px] msr:text-ink-500">px</span>
        </div>
      </SettingsFieldRow>
      <SettingsButton
        type="button"
        className="msr:w-full msr:justify-center"
        leftIcon={<RecordIcon />}
        onClick={onConfirm}
      >
        Start recording
      </SettingsButton>
    </MenuSurface>
  )
}
