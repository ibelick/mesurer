import { CopyableValue } from "./copyable-value"
import { useTooltip } from "./tooltip"

export function InspectDetailRow({
  label,
  value,
  id,
  onCopy,
  tooltip,
  layoutDetail = false,
  valueClassName = "msr:min-w-0 msr:truncate msr:text-right msr:tabular-nums msr:text-ink-900 msr:hover:underline",
}: {
  label: string
  value: string
  id: string
  onCopy: () => void
  tooltip: ReturnType<typeof useTooltip>
  layoutDetail?: boolean
  valueClassName?: string
}) {
  return (
    <div className="msr:flex msr:w-full msr:items-baseline msr:justify-between msr:gap-2" {...(layoutDetail ? { "data-mesurer-layout-details": true } : {})}>
      <span className="msr:shrink-0 msr:text-ink-500">{label}</span>
      <CopyableValue id={id} value={value} onCopy={onCopy} tooltip={tooltip} className={valueClassName} />
    </div>
  )
}
