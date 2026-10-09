import { forwardRef, useRef, type ReactNode } from "react";
import { cn } from "../../core/utils";
import { CaretDownIcon } from "../icons";
import { Tooltip } from "../tooltip";
import type { ToolbarTooltipProps } from "./types";

type ToolbarButtonProps = {
  id: string;
  active: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
  tooltipVisible: boolean;
  tooltip: ToolbarTooltipProps;
  children: ReactNode;
  className?: string;
};

export function ToolbarButton({
  id,
  active,
  label,
  shortcut,
  onClick,
  tooltipVisible,
  tooltip,
  children,
  className,
}: ToolbarButtonProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={anchorRef}
      className="msr:relative"
      data-tool-id={id}
      onMouseEnter={() => tooltip.onTooltipEnter(id)}
      onMouseLeave={() => tooltip.onTooltipLeave(id)}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${label} (${shortcut})`}
        className={cn(
          "msr:flex msr:size-8 msr:select-none msr:items-center msr:justify-center msr:rounded-control msr:outline-none",
          active
            ? "msr:bg-[#0d99ff] msr:text-white"
            : "msr:bg-transparent msr:text-ink-900 msr:hover:bg-black/4",
          className,
        )}
        onClick={onClick}
      >
        {children}
      </button>
      <Tooltip
        label={label}
        shortcut={shortcut}
        visible={tooltipVisible}
        instant={tooltip.tooltipInstant}
        side={tooltip.tooltipSide}
        anchorRef={anchorRef}
      />
    </div>
  );
}

export function ToolbarGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("mesurer-toolbar-flow msr:flex msr:items-center msr:gap-1 msr:py-1", className)}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider() {
  return (
    <div
      aria-hidden="true"
      className="mesurer-toolbar-divider"
    />
  );
}

// The small caret beside a tool that opens its menu.
export const ToolbarCaretButton = forwardRef<
  HTMLButtonElement,
  { label: string; open: boolean; onClick: () => void }
>(function ToolbarCaretButton({ label, open, onClick }, ref) {
  return (
    <button
      type="button"
      ref={ref}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      data-mesurer-menu-trigger
      className={cn(
        "mesurer-toolbar-caret-btn msr:relative msr:z-80 msr:flex msr:h-8 msr:w-4 msr:items-center msr:justify-center msr:rounded-control msr:text-ink-900 msr:outline-none msr:hover:bg-black/4",
        open && "msr:bg-black/4",
      )}
      onClick={onClick}
    >
      <CaretDownIcon size={8} aria-hidden="true" className="mesurer-toolbar-caret" />
    </button>
  );
});
