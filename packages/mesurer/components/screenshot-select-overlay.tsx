import { forwardRef, type PointerEvent as ReactPointerEvent } from "react";
import { MeasureTag } from "./measure-tag";
import { RecordingSelectionPanel } from "./recording-selection-panel";
import type { ScreenshotRect } from "../core/screenshot";
import { formatValue } from "../core/utils";
import { RESIZE_HANDLES, resizeCursor, type ResizeHandle } from "../core/text-transform";

export function RegionDimMask({ rect }: { rect: ScreenshotRect }) {
  return (
    <>
      <div
        className="msr:absolute msr:left-0 msr:right-0 msr:top-0 msr:bg-black/40"
        style={{ height: rect.top }}
      />
      <div
        className="msr:absolute msr:left-0 msr:bg-black/40"
        style={{
          top: rect.top,
          width: rect.left,
          height: rect.height,
        }}
      />
      <div
        className="msr:absolute msr:right-0 msr:bg-black/40"
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          height: rect.height,
        }}
      />
      <div
        className="msr:absolute msr:bottom-0 msr:left-0 msr:right-0 msr:bg-black/40"
        style={{ top: rect.top + rect.height }}
      />
    </>
  );
}

const SelectionGrid = () => (
  <div className="msr:pointer-events-none msr:absolute msr:inset-0">
    <div className="msr:absolute msr:inset-y-0 msr:left-1/3 msr:w-0 msr:border-l msr:border-dashed msr:border-ink-500/30" />
    <div className="msr:absolute msr:inset-y-0 msr:left-2/3 msr:w-0 msr:border-l msr:border-dashed msr:border-ink-500/30" />
    <div className="msr:absolute msr:inset-x-0 msr:top-1/3 msr:h-0 msr:border-t msr:border-dashed msr:border-ink-500/30" />
    <div className="msr:absolute msr:inset-x-0 msr:top-2/3 msr:h-0 msr:border-t msr:border-dashed msr:border-ink-500/30" />
  </div>
);

const HANDLE_POSITION: Record<ResizeHandle, string> = {
  nw: "msr:left-0 msr:top-0 msr:-translate-x-1/2 msr:-translate-y-1/2",
  n: "msr:left-1/2 msr:top-0 msr:-translate-x-1/2 msr:-translate-y-1/2",
  ne: "msr:left-full msr:top-0 msr:-translate-x-1/2 msr:-translate-y-1/2",
  e: "msr:left-full msr:top-1/2 msr:-translate-x-1/2 msr:-translate-y-1/2",
  se: "msr:left-full msr:top-full msr:-translate-x-1/2 msr:-translate-y-1/2",
  s: "msr:left-1/2 msr:top-full msr:-translate-x-1/2 msr:-translate-y-1/2",
  sw: "msr:left-0 msr:top-full msr:-translate-x-1/2 msr:-translate-y-1/2",
  w: "msr:left-0 msr:top-1/2 msr:-translate-x-1/2 msr:-translate-y-1/2",
};

type ScreenshotSelectOverlayProps = {
  active: boolean;
  rect: ScreenshotRect | null;
  mode?: "screenshot" | "recording";
  adjusting?: boolean;
  onConfirm?: () => void;
  viewport?: { width: number; height: number };
  onSizeChange?: (width: number, height: number) => void;
  onPositionChange?: (left: number, top: number) => void;
  onMoveStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart?: (handle: ResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export const ScreenshotSelectOverlay = forwardRef<
  HTMLDivElement,
  ScreenshotSelectOverlayProps
>(function ScreenshotSelectOverlay(
  {
    active,
    rect,
    mode = "screenshot",
    adjusting = false,
    onConfirm,
    viewport,
    onSizeChange,
    onPositionChange,
    onMoveStart,
    onResizeStart,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  },
  ref,
) {
  if (!active) return null;

  const hasRect = Boolean(rect && rect.width > 0 && rect.height > 0);
  const recordingAdjust = mode === "recording" && adjusting && hasRect && rect;
  const rootCursor = recordingAdjust ? "msr:cursor-default" : "msr:cursor-crosshair";

  return (
    <div
      ref={ref}
      role="application"
      aria-label={mode === "recording" ? "Screen recording selection" : "Screenshot selection"}
      className={`mesurer-screenshot-select msr:absolute msr:inset-0 msr:z-[85] msr:pointer-events-auto ${rootCursor}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {hasRect && rect ? (
        <>
          <RegionDimMask rect={rect} />
          <div
            className="msr:absolute msr:bg-white/5 msr:outline msr:outline-1 msr:outline-[#0d99ff]"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }}
            onPointerDown={(event) => {
              if (!recordingAdjust || !onMoveStart) return;
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              onMoveStart(event);
            }}
          >
            {recordingAdjust ? <SelectionGrid /> : null}
            {recordingAdjust
              ? RESIZE_HANDLES.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    aria-label={`Resize ${handle}`}
                    className={`msr:absolute msr:size-2 msr:rounded-full msr:border msr:border-white msr:bg-ink-900 msr:shadow-[0_0_0_1px_rgba(0,0,0,0.25)] ${HANDLE_POSITION[handle]}`}
                    style={{ cursor: resizeCursor(handle, 0) }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onResizeStart?.(handle, event);
                    }}
                  />
                ))
              : null}
          </div>
          {!recordingAdjust ? (
            <MeasureTag
              className="msr:bg-[#0d99ff]"
              style={{
                left: rect.left + rect.width / 2,
                top: rect.top + rect.height + 6,
                transform: "translateX(-50%)",
              }}
            >
              {formatValue(rect.width)} × {formatValue(rect.height)}
            </MeasureTag>
          ) : null}
          {recordingAdjust && onConfirm && viewport && onSizeChange && onPositionChange ? (
            <RecordingSelectionPanel
              rect={rect}
              viewport={viewport}
              onSizeChange={onSizeChange}
              onPositionChange={onPositionChange}
              onConfirm={onConfirm}
            />
          ) : null}
        </>
      ) : (
        <div className="msr:absolute msr:inset-0 msr:bg-black/40" />
      )}
      <div className="msr:pointer-events-none msr:absolute msr:bottom-4 msr:left-1/2 msr:-translate-x-1/2 msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white">
        {recordingAdjust ? (
          <>
            Adjust region · <span className="msr:font-normal msr:text-white/60">Enter</span> to start ·{" "}
            <span className="msr:font-normal msr:text-white/60">Esc</span> to cancel
          </>
        ) : mode === "recording" ? (
          <>
            Drag to select a region · <span className="msr:font-normal msr:text-white/60">Esc</span> to cancel
          </>
        ) : (
          <>
            Drag to select <span className="msr:font-normal msr:text-white/60">Esc</span> to cancel
          </>
        )}
      </div>
    </div>
  );
});
