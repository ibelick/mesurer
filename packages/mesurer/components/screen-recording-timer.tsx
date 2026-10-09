import { SettingsButton } from "./settings-button"

const twoDigits = (value: number) => String(Math.floor(value)).padStart(2, "0")

// The card shown while a recording runs: how long it has been going, and a way to stop it.
export function ScreenRecordingTimer({ elapsed, onStop }: { elapsed: number; onStop: () => void }) {
  return (
    <section
      className="mesurer-menu-surface msr:flex msr:items-center msr:gap-2 msr:rounded-lg msr:bg-white msr:px-3 msr:py-2 msr:shadow-floating"
      aria-label="Screen recording"
    >
      <span className="msr:size-1.5 msr:rounded-full msr:bg-[var(--msr-danger-solid-bg)]" />
      <span className="msr:font-mono msr:text-[11px] msr:tabular-nums msr:text-ink-800">
        {twoDigits(elapsed / 60)}:{twoDigits(elapsed % 60)}
      </span>
      <SettingsButton variant="danger-solid" onClick={onStop}>Stop</SettingsButton>
    </section>
  )
}
