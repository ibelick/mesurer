import { forwardRef, type CSSProperties } from "react";
import { CameraIcon, CheckIcon, RecordIcon } from "../icons";
import { MenuItem, MenuSurface, ToolbarMenu, ToolbarMenuItem } from "../menu";

// The menu under the capture tool: a screenshot, or a recording that it starts or stops.
export const CaptureMenu = forwardRef<
  HTMLDivElement,
  {
    style: CSSProperties;
    side: "top" | "bottom";
    recording: boolean;
    onScreenshot: () => void;
    onRecord: () => void;
    onClose: () => void;
  }
>(function CaptureMenu({ style, side, recording, onScreenshot, onRecord, onClose }, ref) {
  // Each choice closes the menu first, then acts.
  const choose = (act: () => void) => () => {
    onClose();
    act();
  };
  return (
    <ToolbarMenu
      ref={ref}
      floating
      floatingStyle={style}
      side={side}
      align="right"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <ToolbarMenuItem onClick={choose(onScreenshot)}>
        <CameraIcon size={12} />
        <span className="msr:flex-1">Screenshot</span>
        <span>C</span>
      </ToolbarMenuItem>
      <ToolbarMenuItem onClick={choose(onRecord)}>
        <RecordIcon size={12} />
        <span className="msr:flex-1">{recording ? "Stop recording" : "Screen record"}</span>
        <span>V</span>
      </ToolbarMenuItem>
    </ToolbarMenu>
  );
});

// The menu under the comments tool: open the list, or copy every comment.
export const CommentsMenu = forwardRef<
  HTMLDivElement,
  {
    style: CSSProperties;
    // Nothing to show or copy yet.
    empty: boolean;
    copied: boolean;
    copyShortcut: string;
    onShowAll: () => void;
    onCopy: () => void;
  }
>(function CommentsMenu({ style, empty, copied, copyShortcut, onShowAll, onCopy }, ref) {
  return (
    <MenuSurface
      ref={ref}
      className="msr:pointer-events-auto msr:fixed msr:flex msr:w-44 msr:flex-col msr:gap-px"
      style={style}
      data-mesurer-comment-ui
    >
      <MenuItem disabled={empty} onClick={onShowAll}>
        <span className="msr:flex-1">Show all comments</span>
      </MenuItem>
      <MenuItem disabled={empty} onClick={onCopy}>
        <span className="msr:flex-1">Copy comments</span>
        {copied ? <CheckIcon size={12} /> : <span>{copyShortcut}</span>}
      </MenuItem>
    </MenuSurface>
  );
});
