import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { SettingsButton } from "../components/settings-button"
import { Tooltip } from "../components/tooltip"
import type { ToolbarTooltip } from "../hooks/use-toolbar-tooltip"
import { cn } from "../core/utils"

type CommentIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tooltip?: string
  tooltipId: string
  tooltipGroup: ToolbarTooltip
  wrapperClassName?: string
  children: ReactNode
}

export function CommentIconButton({
  label,
  tooltip = label,
  tooltipId,
  tooltipGroup,
  className,
  wrapperClassName,
  children,
  onClick,
  ...props
}: CommentIconButtonProps) {
  const anchorRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={anchorRef}
      className={cn(
        "msr:inline-flex msr:h-5 msr:w-5 msr:items-center msr:justify-center msr:leading-none",
        wrapperClassName?.includes("msr:absolute") ? "msr:absolute" : "msr:relative",
        wrapperClassName,
      )}
      onMouseEnter={() => tooltipGroup.onTooltipEnter(tooltipId)}
      onMouseLeave={() => tooltipGroup.onTooltipLeave(tooltipId)}
      onFocus={() => tooltipGroup.onTooltipEnter(tooltipId)}
      onBlur={() => tooltipGroup.onTooltipLeave(tooltipId)}
    >
      <SettingsButton
        shape="icon"
        variant="ghost"
        type="button"
        aria-label={label}
        className={cn("msr:leading-none", className)}
        onClick={onClick}
        {...props}
      >
        {children}
      </SettingsButton>
      <Tooltip
        label={tooltip}
        visible={tooltipGroup.visibleTooltipId === tooltipId}
        instant={tooltipGroup.tooltipInstant}
        side="top"
        anchorRef={anchorRef}
      />
    </div>
  )
}
