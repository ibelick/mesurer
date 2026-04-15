"use client";

import { memo } from "react";
import { MeasureTag } from "../components/measure-tag";
import type { DistanceOverlay } from "../types";
import { formatValue } from "../utils";

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
  return (
    <div
      className={
        onRemove ? "msr:pointer-events-auto" : "msr:pointer-events-none"
      }
      onClick={
        onRemove
          ? (event) => {
              event.stopPropagation();
              onRemove(distance.id);
            }
          : undefined
      }
    >
      <div
        className="msr:absolute msr:rounded msr:border msr:border-[#2563eb]/70"
        style={{
          left: distance.rectA.left,
          top: distance.rectA.top,
          width: distance.rectA.width,
          height: distance.rectA.height,
        }}
      />
      <div
        className="msr:absolute msr:rounded msr:border msr:border-[#2563eb]/70"
        style={{
          left: distance.rectB.left,
          top: distance.rectB.top,
          width: distance.rectB.width,
          height: distance.rectB.height,
        }}
      />
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
      {distance.horizontal && distance.horizontal.value > 0 ? (
        <>
          <div
            className="msr:absolute msr:h-px msr:bg-[#2563eb]"
            style={{
              left: Math.min(distance.horizontal.x1, distance.horizontal.x2),
              width: Math.abs(distance.horizontal.x2 - distance.horizontal.x1),
              top: distance.horizontal.y,
            }}
          />
          <MeasureTag
            className="msr:-translate-x-1/2 msr:bg-ink-900/90"
            style={{
              left: (distance.horizontal.x1 + distance.horizontal.x2) / 2,
              top: distance.horizontal.y + labelOffset,
            }}
          >
            {formatValue(distance.horizontal.value)}
          </MeasureTag>
        </>
      ) : null}
      {distance.vertical && distance.vertical.value > 0 ? (
        <>
          <div
            className="msr:absolute msr:w-px msr:bg-[#2563eb]"
            style={{
              top: Math.min(distance.vertical.y1, distance.vertical.y2),
              height: Math.abs(distance.vertical.y2 - distance.vertical.y1),
              left: distance.vertical.x,
            }}
          />
          <MeasureTag
            className="msr:-translate-y-1/2 msr:bg-ink-900/90"
            style={{
              left: distance.vertical.x + labelOffset,
              top: (distance.vertical.y1 + distance.vertical.y2) / 2,
            }}
          >
            {formatValue(distance.vertical.value)}
          </MeasureTag>
        </>
      ) : null}
    </div>
  );
});
