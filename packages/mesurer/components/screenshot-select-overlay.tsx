import { forwardRef, type PointerEvent as ReactPointerEvent } from "react";
import { MeasureTag } from "./measure-tag";
import type { ScreenshotRect } from "../core/screenshot";
import { formatValue } from "../core/utils";

type ScreenshotSelectOverlayProps = {
  active: boolean;
  rect: ScreenshotRect | null;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export const ScreenshotSelectOverlay = forwardRef<
  HTMLDivElement,
  ScreenshotSelectOverlayProps
>(function ScreenshotSelectOverlay(
  { active, rect, onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  ref,
) {
  if (!active) return null;

  const hasRect = Boolean(rect && rect.width > 0 && rect.height > 0);

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Screenshot selection"
      className="mesurer-screenshot-select msr:absolute msr:inset-0 msr:z-[85] msr:cursor-crosshair msr:pointer-events-auto"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {hasRect && rect ? (
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
          <div
            className="msr:absolute msr:outline msr:outline-1 msr:outline-[#0d99ff]"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }}
          />
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
        </>
      ) : (
        <div className="msr:absolute msr:inset-0 msr:bg-black/40" />
      )}
      <div className="msr:pointer-events-none msr:absolute msr:bottom-4 msr:left-1/2 msr:-translate-x-1/2 msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white">
        Drag to select <span className="msr:font-normal msr:text-white/60">Esc</span> to cancel
      </div>
    </div>
  );
});
