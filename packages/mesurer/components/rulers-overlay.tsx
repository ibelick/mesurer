import { memo, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { Guide } from "../core/types";
import type { RulerSettings } from "../core/persistence";

const RULER_SIZE = 18;
const RULER_LENGTH = 4000;
const TICK_STEP = 5;
const RULER_EDGE_REVEAL_DISTANCE = 32;
const RULER_FADE_MS = 100;

type RulersOverlayProps = {
  ownerWindow: Window;
  settings: RulerSettings;
  onStartGuide: (
    orientation: "vertical" | "horizontal",
    position: number,
  ) => string;
  onMoveGuide: (id: string, position: number) => void;
  onFinishGuide: (id: string) => void;
  onCancelGuide: (id: string) => void;
  guides: Guide[];
  selectedGuideIds: string[];
  interactive?: boolean;
  forceVisible?: boolean;
};

const ticks = Array.from(
  { length: RULER_LENGTH / TICK_STEP + 1 },
  (_, index) => index * TICK_STEP,
);

export const RulersOverlay = memo(function RulersOverlay({
  ownerWindow,
  settings,
  onStartGuide,
  onMoveGuide,
  onFinishGuide,
  onCancelGuide,
  guides,
  selectedGuideIds,
  interactive = true,
  forceVisible = false,
}: RulersOverlayProps) {
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [dragOrientation, setDragOrientation] = useState<
    "vertical" | "horizontal" | null
  >(null);
  const [nearEdge, setNearEdge] = useState(false);
  const dragRef = useRef<{
    orientation: "vertical" | "horizontal";
    pointerId: number;
    id: string;
  } | null>(null);

  useLayoutEffect(() => {
    if (!settings.edgeReveal) return;
    const handlePointerMove = (event: Event) => {
      const pointer = event as globalThis.MouseEvent;
      const nearHorizontalEdge =
        pointer.clientX <= RULER_EDGE_REVEAL_DISTANCE ||
        pointer.clientX >= ownerWindow.innerWidth - RULER_EDGE_REVEAL_DISTANCE;
      const nearVerticalEdge =
        pointer.clientY <= RULER_EDGE_REVEAL_DISTANCE ||
        pointer.clientY >= ownerWindow.innerHeight - RULER_EDGE_REVEAL_DISTANCE;
      setNearEdge(nearHorizontalEdge || nearVerticalEdge);
    };
    ownerWindow.document.addEventListener("pointermove", handlePointerMove, true);
    ownerWindow.document.addEventListener("mousemove", handlePointerMove, true);
    return () => {
      ownerWindow.document.removeEventListener("pointermove", handlePointerMove, true);
      ownerWindow.document.removeEventListener("mousemove", handlePointerMove, true);
    };
  }, [ownerWindow, settings.edgeReveal]);

  const showRulers = forceVisible || !settings.edgeReveal || nearEdge;

  const beginGuideDrag = (
    orientation: "vertical" | "horizontal",
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const position = orientation === "horizontal" ? event.clientY : event.clientX;
    setDragPosition(position);
    setDragOrientation(orientation);
    dragRef.current = {
      orientation,
      pointerId: event.pointerId,
      id: onStartGuide(orientation, position),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGuide = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const position =
      drag.orientation === "horizontal" ? event.clientY : event.clientX;
    setDragPosition(position);
    onMoveGuide(drag.id, position);
  };

  const finishGuideDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const position =
      drag.orientation === "horizontal" ? event.clientY : event.clientX;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragPosition(null);
    setDragOrientation(null);
    onMoveGuide(drag.id, position);
    onFinishGuide(drag.id);
  };

  const cancelGuideDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragPosition(null);
    setDragOrientation(null);
    onCancelGuide(drag.id);
  };

  const selectedVerticalGuides = guides.filter(
    (guide) =>
      guide.orientation === "vertical" && selectedGuideIds.includes(guide.id),
  );
  const selectedHorizontalGuides = guides.filter(
    (guide) =>
      guide.orientation === "horizontal" && selectedGuideIds.includes(guide.id),
  );

  return (
    <div
      aria-hidden="true"
      data-mesurer-rulers="true"
      className="msr:pointer-events-none msr:absolute msr:inset-0 msr:select-none msr:text-[9px] msr:text-[#64748b]"
      style={{
        opacity: showRulers ? settings.opacity : 0,
        transition: `opacity ${RULER_FADE_MS}ms ease`,
      }}
    >
      <div
        className="msr:absolute msr:left-[18px] msr:right-0 msr:top-0 msr:overflow-hidden msr:bg-white"
        style={{
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
          height: RULER_SIZE,
          cursor: "ns-resize",
          pointerEvents: showRulers && interactive ? "auto" : "none",
        }}
        onPointerDown={(event) => beginGuideDrag("horizontal", event)}
        onPointerMove={moveGuide}
        onPointerUp={finishGuideDrag}
        onPointerCancel={cancelGuideDrag}
      >
        <svg
          className="msr:block msr:h-6"
          width={RULER_LENGTH}
          height={RULER_SIZE}
          viewBox={`0 0 ${RULER_LENGTH} ${RULER_SIZE}`}
        >
          <defs>
            <linearGradient
              id="ruler-label-fade-x"
              x1="0%"
              x2="100%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0" stopColor="white" stopOpacity="0" />
              <stop offset="0.2" stopColor="white" />
              <stop offset="0.8" stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((x) => {
            const major = x % 100 === 0;
            const medium = x % 50 === 0;
            return (
              <g key={x}>
                <line
                  x1={x}
                  y1={RULER_SIZE}
                  x2={x}
                  y2={major ? 8 : medium ? 13 : 17}
                  stroke="currentColor"
                  strokeWidth="1"
                />
                {major ? (
                  <text x={x} y="8" textAnchor="middle" fill="currentColor">
                    {x}
                  </text>
                ) : null}
              </g>
            );
          })}
          {selectedVerticalGuides.map((guide) => (
            <g key={guide.id}>
              <rect
                x={guide.position - RULER_SIZE - 8}
                y="-1"
                width="48"
                height="12"
                fill="url(#ruler-label-fade-x)"
              />
              <text
                x={guide.position - RULER_SIZE + 16}
                y="8"
                textAnchor="middle"
                fill="#ef4444"
                fontWeight="600"
              >
                {Math.round(guide.position - RULER_SIZE)}
              </text>
            </g>
          ))}
          {dragOrientation === "vertical" && dragPosition !== null ? (
            <g>
              <rect
                x={dragPosition - RULER_SIZE - 8}
                y="-1"
                width="48"
                height="12"
                fill="url(#ruler-label-fade-x)"
              />
              <text
                x={dragPosition - RULER_SIZE + 16}
                y="8"
                textAnchor="middle"
                fill="#ef4444"
                fontWeight="600"
              >
                {Math.round(dragPosition - RULER_SIZE)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      <div
        className="msr:absolute msr:bottom-0 msr:left-0 msr:top-[18px] msr:w-[18px] msr:overflow-hidden msr:bg-white"
        style={{
          boxShadow: "1px 0 3px rgba(0, 0, 0, 0.12)",
          width: RULER_SIZE,
          cursor: "ew-resize",
          pointerEvents: showRulers && interactive ? "auto" : "none",
        }}
        onPointerDown={(event) => beginGuideDrag("vertical", event)}
        onPointerMove={moveGuide}
        onPointerUp={finishGuideDrag}
        onPointerCancel={cancelGuideDrag}
      >
        <svg
          className="msr:block msr:w-6"
          width={RULER_SIZE}
          height={RULER_LENGTH}
          viewBox={`0 0 ${RULER_SIZE} ${RULER_LENGTH}`}
        >
          <defs>
            <linearGradient
              id="ruler-label-fade-y"
              y1="0%"
              y2="100%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0" stopColor="white" stopOpacity="0" />
              <stop offset="0.2" stopColor="white" />
              <stop offset="0.8" stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((y) => {
            const major = y % 100 === 0;
            const medium = y % 50 === 0;
            return (
              <g key={y}>
                <line
                  x1={RULER_SIZE}
                  y1={y}
                  x2={major ? 8 : medium ? 13 : 17}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                />
                {major ? (
                  <text
                    x="8"
                    y={y + 10}
                    fill="currentColor"
                    transform={`rotate(-90 8 ${y + 10})`}
                  >
                    {y}
                  </text>
                ) : null}
              </g>
            );
          })}
          {selectedHorizontalGuides.map((guide) => (
            <g key={guide.id}>
              <rect
                x="-3"
                y={guide.position - RULER_SIZE - 38}
                width="24"
                height="48"
                fill="url(#ruler-label-fade-y)"
              />
              <text
                x="9"
                y={guide.position - RULER_SIZE - 16}
                textAnchor="middle"
                fill="#ef4444"
                fontWeight="600"
                transform={`rotate(-90 9 ${guide.position - RULER_SIZE - 16})`}
              >
                {Math.round(guide.position - RULER_SIZE)}
              </text>
            </g>
          ))}
          {dragOrientation === "horizontal" && dragPosition !== null ? (
            <g>
              <rect
                x="-3"
                y={dragPosition - RULER_SIZE - 38}
                width="24"
                height="48"
                fill="url(#ruler-label-fade-y)"
              />
              <text
                x="9"
                y={dragPosition - RULER_SIZE - 16}
                textAnchor="middle"
                fill="#ef4444"
                fontWeight="600"
                transform={`rotate(-90 9 ${dragPosition - RULER_SIZE - 16})`}
              >
                {Math.round(dragPosition - RULER_SIZE)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      <div className="msr:absolute msr:left-0 msr:top-0 msr:size-[18px] msr:bg-white" />
    </div>
  );
});
