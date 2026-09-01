import { useRef } from "react";
import { cn } from "../core/utils";
import { AnnotateIcon, SelectInspectIcon } from "./icons";
import { Tooltip } from "./tooltip";

export type ToolGroup = "inspect" | "annotate";
type ToolGroupTooltip = {
  tooltipInstant: boolean;
  tooltipSide: "top" | "bottom";
  onTooltipEnter: (id: string) => void;
  onTooltipLeave: (id: string) => void;
};

export function ToolGroupSwitch({
  value,
  onChange,
  tooltip,
  tooltipVisibleId,
  tooltipsEnabled,
}: {
  value: ToolGroup;
  onChange: (value: ToolGroup) => void;
  tooltip: ToolGroupTooltip;
  tooltipVisibleId: string | null;
  tooltipsEnabled: boolean;
}) {
  const inspectRef = useRef<HTMLDivElement | null>(null);
  const annotateRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      className="mesurer-toolbar-tool-switch msr:flex msr:flex-none msr:items-center msr:gap-[2px] msr:rounded-[8px] msr:bg-ink-50 msr:p-[2px]"
      data-value={value}
      role="group"
      aria-label="Tool group"
    >
      <span className="mesurer-toolbar-tool-switch-pill" aria-hidden="true" />
      <div
        ref={inspectRef}
        className="msr:relative"
        onMouseEnter={() => tooltip.onTooltipEnter("tool-group-inspect")}
        onMouseLeave={() => tooltip.onTooltipLeave("tool-group-inspect")}
      >
        <button
          type="button"
          aria-label="Select and inspect tools (1)"
          aria-keyshortcuts="1"
          aria-pressed={value === "inspect"}
          className={cn(
            "msr:flex msr:size-7 msr:items-center msr:justify-center msr:rounded-[6px] msr:text-[11px] msr:font-medium msr:outline-none msr:focus-visible:outline msr:focus-visible:outline-1 msr:focus-visible:outline-ink-500 msr:focus-visible:outline-offset-1",
            value === "inspect"
              ? "msr:bg-transparent msr:text-ink-900"
              : "msr:text-ink-700 msr:hover:bg-ink-200/50",
          )}
          onClick={() => onChange("inspect")}
        >
          <SelectInspectIcon size={20} />
        </button>
        <Tooltip
          label="Select & Inspect"
          shortcut="1"
          visible={tooltipsEnabled && tooltipVisibleId === "tool-group-inspect"}
          instant={tooltip.tooltipInstant}
          side={tooltip.tooltipSide}
          anchorRef={inspectRef}
        />
      </div>
      <div
        ref={annotateRef}
        className="msr:relative"
        onMouseEnter={() => tooltip.onTooltipEnter("tool-group-annotate")}
        onMouseLeave={() => tooltip.onTooltipLeave("tool-group-annotate")}
      >
        <button
          type="button"
          aria-label="Annotate tools (2)"
          aria-keyshortcuts="2"
          aria-pressed={value === "annotate"}
          className={cn(
            "msr:flex msr:size-7 msr:items-center msr:justify-center msr:rounded-[6px] msr:text-[11px] msr:font-medium msr:outline-none msr:focus-visible:outline msr:focus-visible:outline-1 msr:focus-visible:outline-ink-500 msr:focus-visible:outline-offset-1",
            value === "annotate"
              ? "msr:bg-transparent msr:text-ink-900"
              : "msr:text-ink-700 msr:hover:bg-ink-200/50",
          )}
          onClick={() => onChange("annotate")}
        >
          <AnnotateIcon size={20} />
        </button>
        <Tooltip
          label="Annotate"
          shortcut="2"
          visible={tooltipsEnabled && tooltipVisibleId === "tool-group-annotate"}
          instant={tooltip.tooltipInstant}
          side={tooltip.tooltipSide}
          anchorRef={annotateRef}
        />
      </div>
    </div>
  );
}
