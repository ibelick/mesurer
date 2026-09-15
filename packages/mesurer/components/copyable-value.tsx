import { Tooltip, useTooltip } from "./tooltip"

type CopyableValueProps = {
  id: string
  value: string
  onCopy: () => void
  tooltip: ReturnType<typeof useTooltip>
  className?: string
}

export function CopyableValue({
  id,
  value,
  onCopy,
  tooltip,
  className,
}: CopyableValueProps) {
  const copied = tooltip.copiedTooltipId === id

  return (
    <span
      className="msr:relative msr:inline-flex msr:min-w-0"
    >
      <button
        type="button"
        className={className ?? "msr:truncate msr:text-right msr:text-ink-50 msr:hover:underline"}
        onMouseEnter={() => {
          if (!copied) tooltip.onTooltipEnter(id, true)
        }}
        onFocus={() => {
          if (!copied) tooltip.onTooltipEnter(id, true)
        }}
        onBlur={tooltip.onTooltipLeave}
        onMouseLeave={tooltip.onTooltipLeave}
        onClick={() => {
          onCopy()
          tooltip.onTooltipCopied(id)
        }}
      >
        {value}
      </button>
      <Tooltip
        label={copied ? "Copied!" : "Click to copy"}
        visible={copied || tooltip.visibleTooltipId === id}
        instant={copied || tooltip.tooltipInstant}
        side="bottom"
        className="msr:z-10"
      />
    </span>
  )
}
