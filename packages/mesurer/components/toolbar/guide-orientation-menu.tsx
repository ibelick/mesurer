import { forwardRef, useState, type CSSProperties } from "react";
import { cn } from "../../core/utils";
import { CheckIcon, MinusIcon, RulersIcon } from "../icons";
import { MenuItem, ToolbarMenu } from "../menu";

export type GuideChoice = "rulers" | "horizontal" | "vertical";

const CHOICES: { id: GuideChoice; label: string; key: string }[] = [
  { id: "rulers", label: "Rulers", key: "r" },
  { id: "horizontal", label: "Horizontal", key: "h" },
  { id: "vertical", label: "Vertical", key: "v" },
];

// The menu under the guides tool: rulers, or guides drawn across or down the page. It is
// driven from the keyboard with the arrows and Enter, or with each choice's own letter.
export const GuideOrientationMenu = forwardRef<
  HTMLDivElement,
  {
    style: CSSProperties;
    side: "top" | "bottom";
    // Whether rulers are offered at all.
    rulers: boolean;
    control: "guides" | "rulers";
    orientation: "horizontal" | "vertical";
    onSelect: (choice: GuideChoice) => void;
    onClose: () => void;
  }
>(function GuideOrientationMenu({ style, side, rulers, control, orientation, onSelect, onClose }, ref) {
  const choices = rulers ? CHOICES : CHOICES.slice(1);
  const checked = control === "rulers" ? "rulers" : orientation;
  // The highlight starts on what is in use.
  const [activeIndex, setActiveIndex] = useState(() =>
    choices.findIndex((choice) => choice.id === (rulers ? checked : orientation)),
  );
  return (
    <ToolbarMenu
      ref={ref}
      floating
      floatingStyle={style}
      side={side}
      tabIndex={0}
      onKeyDown={(event) => {
        const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        const byLetter = choices.find((choice) => choice.key === event.key.toLowerCase());
        if (step) {
          event.preventDefault();
          setActiveIndex((index) => (index + step + choices.length) % choices.length);
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (choices[activeIndex]) onSelect(choices[activeIndex].id);
        } else if (byLetter) {
          event.preventDefault();
          onSelect(byLetter.id);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {choices.map((choice, index) => (
        <MenuItem
          key={choice.id}
          className={cn(
            "msr:group msr:flex msr:w-full msr:items-center msr:gap-2 msr:rounded-[4px] msr:px-2 msr:py-1 msr:text-left msr:text-[11px] msr:leading-4",
            activeIndex === index || checked === choice.id
              ? "msr:bg-accent msr:text-white"
              : "msr:text-ink-700 msr:hover:bg-accent msr:hover:text-white",
          )}
          onClick={() => onSelect(choice.id)}
        >
          <CheckIcon size={12} className={checked === choice.id ? "msr:opacity-100" : "msr:opacity-0"} />
          {choice.id === "rulers" ? (
            <RulersIcon size={12} />
          ) : (
            <MinusIcon size={12} className={choice.id === "vertical" ? "msr:rotate-90" : undefined} />
          )}
          <span className="msr:flex-1">{choice.label}</span>
          <span>{choice.key.toUpperCase()}</span>
        </MenuItem>
      ))}
    </ToolbarMenu>
  );
});
