"use client";

import { memo, useRef, type PointerEvent } from "react";
import { MeasureTag } from "../components/measure-tag";
import { getPinnedLabelPoint, isElementRect } from "../core/distances";
import type { DistanceOverlay } from "../core/types";
import { formatValue } from "../core/utils";

type DistanceOverlayItemProps = {
  distance: DistanceOverlay;
  labelOffset: number;
  onRemove?: (id: string) => void;
};

export const DistanceOverlayItem = memo(function DistanceOverlayItem({
  distance,
  labelOffset,
  onRemove,
}: DistanceOverlayItemProps) {
  const showRectA = isElementRect(distance.rectA);
  const showRectB = isElementRect(distance.rectB);
  const pinPoint = getPinnedLabelPoint(distance);
  // A pin is created under a stationary cursor, so it only becomes removable
  // once the pointer has actually moved onto its label. Without this the click
  // that places the next guide would land on the fresh label and delete it.
  const armedRef = useRef(false);
  const arm = onRemove
    ? () => {
        armedRef.current = true;
      }
    : undefined;
  const handleRemove = onRemove
    ? (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !armedRef.current) return;
        event.stopPropagation();
        onRemove(distance.id);
      }
    : undefined;

  return (
    <div
      data-mesurer-held-distance={onRemove ? distance.id : undefined}
      data-mesurer-live-distance={onRemove ? undefined : ""}
      className="msr:pointer-events-none"
    >
      {showRectA ? (
        <div
          className="msr:absolute msr:rounded msr:border msr:border-[#2563eb]/70"
          style={{
            left: distance.rectA.left,
            top: distance.rectA.top,
            width: distance.rectA.width,
            height: distance.rectA.height,
          }}
        />
      ) : null}
      {showRectB ? (
        <div
          className="msr:absolute msr:rounded msr:border msr:border-[#2563eb]/70"
          style={{
            left: distance.rectB.left,
            top: distance.rectB.top,
            width: distance.rectB.width,
            height: distance.rectB.height,
          }}
        />
      ) : null}
      {distance.connectors.map((connector, index) =>
        Math.abs(connector.x1 - connector.x2) < 1 ? (
          <div
            key={`${distance.id}-connector-${index}`}
            className="msr:absolute msr:border-l msr:border-dashed msr:border-[#2563eb]/70"
            style={{
              left: connector.x1,
              top: Math.min(connector.y1, connector.y2),
              height: Math.abs(connector.y2 - connector.y1),
            }}
          />
        ) : (
          <div
            key={`${distance.id}-connector-${index}`}
            className="msr:absolute msr:border-t msr:border-dashed msr:border-[#2563eb]/70"
            style={{
              left: Math.min(connector.x1, connector.x2),
              top: connector.y1,
              width: Math.abs(connector.x2 - connector.x1),
            }}
          />
        ),
      )}
      {([distance.horizontal, ...(distance.extraHorizontals ?? [])]).map(
        (segment, index) =>
          segment && segment.value > 0 ? (
            <div key={`${distance.id}-h-${index}`}>
              <div
                className="msr:absolute msr:h-px msr:bg-[#2563eb]"
                style={{
                  left: Math.min(segment.x1, segment.x2),
                  width: Math.abs(segment.x2 - segment.x1),
                  top: segment.y,
                }}
              />
              <MeasureTag
                className="msr:-translate-x-1/2 msr:bg-ink-900/90"
                interactive={Boolean(onRemove)}
                style={{
                  left:
                    pinPoint?.x ?? (segment.x1 + segment.x2) / 2,
                  top: segment.y + labelOffset,
                }}
                onPointerEnter={arm}
                onPointerDown={handleRemove}
              >
                {formatValue(segment.value)}
              </MeasureTag>
            </div>
          ) : null,
      )}
      {([distance.vertical, ...(distance.extraVerticals ?? [])]).map(
        (segment, index) =>
          segment && segment.value > 0 ? (
            <div key={`${distance.id}-v-${index}`}>
              <div
                className="msr:absolute msr:w-px msr:bg-[#2563eb]"
                style={{
                  top: Math.min(segment.y1, segment.y2),
                  height: Math.abs(segment.y2 - segment.y1),
                  left: segment.x,
                }}
              />
              <MeasureTag
                className="msr:-translate-y-1/2 msr:bg-ink-900/90"
                interactive={Boolean(onRemove)}
                style={{
                  left: segment.x + labelOffset,
                  top:
                    pinPoint?.y ?? (segment.y1 + segment.y2) / 2,
                }}
                onPointerEnter={arm}
                onPointerDown={handleRemove}
              >
                {formatValue(segment.value)}
              </MeasureTag>
            </div>
          ) : null,
      )}
    </div>
  );
});
