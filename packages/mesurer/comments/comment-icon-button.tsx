import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { SettingsButton } from "../components/settings-button"
import { Tooltip, useTooltip } from "../components/tooltip"
import { cn } from "../core/utils"

type CommentIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tooltip?: string
  wrapperClassName?: string
  children: ReactNode
}

export function CommentIconButton({
  label,
  tooltip = label,
  className,
  wrapperClassName,
  children,
  onClick,
  ...props
}: CommentIconButtonProps) {
  const tooltipState = useTooltip()
  const anchorRef = useRef<HTMLDivElement>(null)
  const tooltipId = tooltip

  return (
    <div
      ref={anchorRef}
      className={cn(
        "msr:relative msr:inline-flex msr:h-5 msr:w-5 msr:items-center msr:justify-center msr:leading-none",
        wrapperClassName,
      )}
      onMouseEnter={() => tooltipState.onTooltipEnter(tooltipId)}
      onMouseLeave={tooltipState.onTooltipLeave}
      onFocus={() => tooltipState.onTooltipEnter(tooltipId)}
      onBlur={tooltipState.onTooltipLeave}
    >
      <SettingsButton
        shape="icon"
        variant="ghost"
        type="button"
        aria-label={label}
        className={cn("msr:leading-none", className)}
        onClick={(event) => {
          tooltipState.onTooltipLeave()
          onClick?.(event)
        }}
        {...props}
      >
        {children}
      </SettingsButton>
      <Tooltip
        label={tooltip}
        visible={tooltipState.visibleTooltipId === tooltipId}
        instant={tooltipState.tooltipInstant}
        side="top"
        anchorRef={anchorRef}
      />
    </div>
  )
}
