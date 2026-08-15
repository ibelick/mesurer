import type {
  PointerEventHandler,
  PointerEvent as ReactPointerEvent,
} from "react";
import { memo } from "react";
import { MeasureTag } from "../components/measure-tag";
import { MeasurementBox } from "../components/measurement-box";
import { SelectedMeasurementBox } from "../components/selected-measurement-box";
import {
  GUIDE_HITBOX_SIZE,
  MEASURE_LABEL_OFFSET,
  MEASURE_TRANSITION_MS,
} from "../core/constants";
import type { EdgeVisibility } from "../core/edge-visibility";
import type {
  DistanceOverlay,
  Guide,
  InspectMeasurement,
  Measurement,
  Rect,
  ToolMode,
} from "../core/types";
import type { GuideStyle } from "../core/persistence";
import { formatValue } from "../core/utils";
import { DistanceOverlayItem } from "./distance-overlay-item";

type GuidePreview = {
  orientation: "vertical" | "horizontal";
  position: number;
};

type OptionContainerLines = {
  top: { y1: number; y2: number; x: number; value: number };
  bottom: { y1: number; y2: number; x: number; value: number };
  left: { x1: number; x2: number; y: number; value: number };
  right: { x1: number; x2: number; y: number; value: number };
};

type MeasurerOverlayProps = {
  enabled: boolean;
  toolMode: ToolMode;
  guidePointerEvents: boolean;
  guidesEnabled: boolean;
  altPressed: boolean;
  isDragging: boolean;
  displayedMeasurements: Measurement[];
  measurementEdgeVisibility: EdgeVisibility[];
  activeRect: Rect | null;
  activeWidth: number;
  activeHeight: number;
  fillColor: string;
  outlineColor: string;
  hoverRectToShow: Rect | null;
  hoverEdgeVisibility: EdgeVisibility | null;
  guidePreview: GuidePreview | null;
  guideColorPreview: string;
  displayedSelectedMeasurements: InspectMeasurement[];
  selectedEdgeVisibility: EdgeVisibility[];
  heldDistances: DistanceOverlay[];
  optionPairOverlay: DistanceOverlay | null;
  guideDistanceOverlay: DistanceOverlay | null;
  optionContainerLines: OptionContainerLines | null;
  guides: Guide[];
  hoverGuide: Guide | null;
  draggingGuideId: string | null;
  selectedGuideIds: string[];
  guideColorActive: string;
  guideColorHover: string;
  guideColorDefault: string;
  guideStyle: GuideStyle;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerLeave: PointerEventHandler<HTMLDivElement>;
  onRemoveHeldDistance: (id: string) => void;
  onGuidePointerDown: (
    guide: Guide,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onGuidePointerUp: (
    guide: Guide,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onGuidePointerCancel: (
    guide: Guide,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
};

export const MeasurerOverlay = memo(function MeasurerOverlay({
  enabled,
  toolMode,
  guidePointerEvents,
  guidesEnabled,
  altPressed,
  isDragging,
  displayedMeasurements,
  measurementEdgeVisibility,
  activeRect,
  activeWidth,
  activeHeight,
  fillColor,
  outlineColor,
  hoverRectToShow,
  hoverEdgeVisibility,
  guidePreview,
  guideColorPreview,
  displayedSelectedMeasurements,
  selectedEdgeVisibility,
  heldDistances,
  optionPairOverlay,
  guideDistanceOverlay,
  optionContainerLines,
  guides,
  hoverGuide,
  draggingGuideId,
  selectedGuideIds,
  guideColorActive,
  guideColorHover,
  guideColorDefault,
  guideStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onRemoveHeldDistance,
  onGuidePointerDown,
  onGuidePointerUp,
  onGuidePointerCancel,
}: MeasurerOverlayProps) {
  const overlayVisible = enabled;
  const overlayInteractive =
    overlayVisible &&
    toolMode !== "none" &&
    toolMode !== "text-inspector" &&
    toolMode !== "xray" &&
    toolMode !== "rulers";
  const selectionVisible = toolMode === "select";

  return (
    <div
      className={`msr:absolute msr:inset-0 ${
        overlayVisible
          ? `msr:pointer-events-auto ${
              guidesEnabled
                ? hoverGuide || draggingGuideId
                  ? "msr:cursor-default"
                  : "msr:cursor-crosshair"
                : "msr:cursor-default"
            } msr:opacity-100`
          : "msr:pointer-events-none msr:opacity-0"
      }`}
      style={{ pointerEvents: overlayInteractive ? "auto" : "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      {selectionVisible
        ? displayedMeasurements.map((measurement, index) => (
            <MeasurementBox
              key={measurement.id}
              measurement={measurement}
              transitionMs={MEASURE_TRANSITION_MS}
              labelOffset={MEASURE_LABEL_OFFSET}
              edgeVisibility={measurementEdgeVisibility[index]}
            />
          ))
        : null}

      {selectionVisible && activeRect && isDragging ? (
        <>
          <div
            className="msr:pointer-events-none msr:absolute"
            style={{
              left: activeRect.left,
              top: activeRect.top,
              width: activeRect.width,
              height: activeRect.height,
              backgroundColor: fillColor,
            }}
          >
            <div
              className="msr:absolute msr:left-0 msr:top-0 msr:h-px msr:w-full"
              style={{ backgroundColor: outlineColor }}
            />
            <div
              className="msr:absolute msr:right-0 msr:top-0 msr:h-full msr:w-px"
              style={{ backgroundColor: outlineColor }}
            />
            <div
              className="msr:absolute msr:bottom-0 msr:left-0 msr:h-px msr:w-full"
              style={{ backgroundColor: outlineColor }}
            />
            <div
              className="msr:absolute msr:left-0 msr:top-0 msr:h-full msr:w-px"
              style={{ backgroundColor: outlineColor }}
            />
          </div>
          <MeasureTag
            className="msr:-translate-x-1/2 msr:bg-ink-900/90"
            style={{
              left: activeRect.left + activeRect.width / 2,
              top: activeRect.top + activeRect.height + MEASURE_LABEL_OFFSET,
            }}
          >
            {activeWidth} x {activeHeight}
          </MeasureTag>
        </>
      ) : null}

      {selectionVisible && hoverRectToShow ? (
        <div
          className="msr:pointer-events-none msr:absolute"
          style={{
            left: hoverRectToShow.left,
            top: hoverRectToShow.top,
            width: hoverRectToShow.width,
            height: hoverRectToShow.height,
            backgroundColor: fillColor,
          }}
        >
          {hoverEdgeVisibility?.top ? (
            <div
               className="msr:absolute msr:left-0 msr:top-0 msr:h-px msr:w-full"
              style={{ backgroundColor: outlineColor }}
            />
          ) : null}
          {hoverEdgeVisibility?.right ? (
            <div
               className="msr:absolute msr:right-0 msr:top-0 msr:h-full msr:w-px"
              style={{ backgroundColor: outlineColor }}
            />
          ) : null}
          {hoverEdgeVisibility?.bottom ? (
            <div
               className="msr:absolute msr:bottom-0 msr:left-0 msr:h-px msr:w-full"
              style={{ backgroundColor: outlineColor }}
            />
          ) : null}
          {hoverEdgeVisibility?.left ? (
            <div
               className="msr:absolute msr:left-0 msr:top-0 msr:h-full msr:w-px"
              style={{ backgroundColor: outlineColor }}
            />
          ) : null}
        </div>
      ) : null}

      {guidesEnabled && guidePreview ? (
        <div
          className="msr:pointer-events-none msr:absolute"
          style={
            guidePreview.orientation === "vertical"
              ? {
                  left: guidePreview.position - GUIDE_HITBOX_SIZE / 2,
                  top: 0,
                  width: GUIDE_HITBOX_SIZE,
                  height: "100%",
                }
              : {
                  top: guidePreview.position - GUIDE_HITBOX_SIZE / 2,
                  left: 0,
                  height: GUIDE_HITBOX_SIZE,
                  width: "100%",
                }
          }
        >
          <div
            className="msr:absolute"
            style={
              guidePreview.orientation === "vertical"
                ? {
                    left: GUIDE_HITBOX_SIZE / 2 - 1,
                    top: 0,
                    width: 2,
                    height: "100%",
                    backgroundColor: guideColorPreview,
                  }
                : {
                    top: GUIDE_HITBOX_SIZE / 2 - 1,
                    left: 0,
                    height: 2,
                    width: "100%",
                    backgroundColor: guideColorPreview,
                  }
            }
          />
        </div>
      ) : null}

      {selectionVisible
        ? displayedSelectedMeasurements.map((measurement, index) => (
            <SelectedMeasurementBox
              key={measurement.id}
              measurement={measurement}
              transitionMs={MEASURE_TRANSITION_MS}
              labelOffset={MEASURE_LABEL_OFFSET}
              edgeVisibility={selectedEdgeVisibility[index]}
            />
          ))
        : null}

      {heldDistances.map((distance) => (
        <DistanceOverlayItem
          key={`held-${distance.id}`}
          distance={distance}
          labelOffset={MEASURE_LABEL_OFFSET}
          onRemove={onRemoveHeldDistance}
        />
      ))}

      {selectionVisible && altPressed && optionPairOverlay ? (
        <DistanceOverlayItem
          key={`option-${optionPairOverlay.id}`}
          distance={optionPairOverlay}
          labelOffset={MEASURE_LABEL_OFFSET}
        />
      ) : null}

      {guidesEnabled && altPressed && guideDistanceOverlay ? (
        <DistanceOverlayItem
          key={`guide-preview-${guideDistanceOverlay.id}`}
          distance={guideDistanceOverlay}
          labelOffset={MEASURE_LABEL_OFFSET}
        />
      ) : null}

      {selectionVisible && altPressed && optionContainerLines ? (
        <>
          {optionContainerLines.top.value > 0 ? (
            <>
              <div
                className="msr:absolute msr:w-px msr:bg-[#2563eb]"
                style={{
                  top: optionContainerLines.top.y1,
                  height:
                    optionContainerLines.top.y2 - optionContainerLines.top.y1,
                  left: optionContainerLines.top.x,
                }}
              />
              <MeasureTag
                className="msr:-translate-y-1/2 msr:bg-ink-900/90"
                style={{
                  left: optionContainerLines.top.x + MEASURE_LABEL_OFFSET,
                  top:
                    (optionContainerLines.top.y1 +
                      optionContainerLines.top.y2) /
                    2,
                }}
              >
                {formatValue(optionContainerLines.top.value)}
              </MeasureTag>
            </>
          ) : null}

          {optionContainerLines.bottom.value > 0 ? (
            <>
              <div
                className="msr:absolute msr:w-px msr:bg-[#2563eb]"
                style={{
                  top: optionContainerLines.bottom.y1,
                  height:
                    optionContainerLines.bottom.y2 -
                    optionContainerLines.bottom.y1,
                  left: optionContainerLines.bottom.x,
                }}
              />
              <MeasureTag
                className="msr:-translate-y-1/2 msr:bg-ink-900/90"
                style={{
                  left: optionContainerLines.bottom.x + MEASURE_LABEL_OFFSET,
                  top:
                    (optionContainerLines.bottom.y1 +
                      optionContainerLines.bottom.y2) /
                    2,
                }}
              >
                {formatValue(optionContainerLines.bottom.value)}
              </MeasureTag>
            </>
          ) : null}

          {optionContainerLines.left.value > 0 ? (
            <>
              <div
                className="msr:absolute msr:h-px msr:bg-[#2563eb]"
                style={{
                  left: optionContainerLines.left.x1,
                  width:
                    optionContainerLines.left.x2 - optionContainerLines.left.x1,
                  top: optionContainerLines.left.y,
                }}
              />
              <MeasureTag
                className="msr:-translate-x-1/2 msr:bg-ink-900/90"
                style={{
                  left:
                    (optionContainerLines.left.x1 +
                      optionContainerLines.left.x2) /
                    2,
                  top: optionContainerLines.left.y + MEASURE_LABEL_OFFSET,
                }}
              >
                {formatValue(optionContainerLines.left.value)}
              </MeasureTag>
            </>
          ) : null}

          {optionContainerLines.right.value > 0 ? (
            <>
              <div
                className="msr:absolute msr:h-px msr:bg-[#2563eb]"
                style={{
                  left: optionContainerLines.right.x1,
                  width:
                    optionContainerLines.right.x2 -
                    optionContainerLines.right.x1,
                  top: optionContainerLines.right.y,
                }}
              />
              <MeasureTag
                className="msr:-translate-x-1/2 msr:bg-ink-900/90"
                style={{
                  left:
                    (optionContainerLines.right.x1 +
                      optionContainerLines.right.x2) /
                    2,
                  top: optionContainerLines.right.y + MEASURE_LABEL_OFFSET,
                }}
              >
                {formatValue(optionContainerLines.right.value)}
              </MeasureTag>
            </>
          ) : null}
        </>
      ) : null}

      {guides.map((guide) => {
        const isSelected = selectedGuideIds.includes(guide.id);
        const isHovered = hoverGuide?.id === guide.id;
        const strokeColor = isSelected
          ? guideColorActive
          : isHovered
            ? guideColorHover
            : guideColorDefault;
        const strokeWidth = Math.max(guideStyle.width, isSelected || isHovered ? 2 : guideStyle.width);
        const isSolid = guideStyle.pattern === "solid";
        const backgroundImage = guideStyle.pattern === "solid"
          ? undefined
          : guideStyle.pattern === "dotted"
            ? `radial-gradient(circle, ${strokeColor} 0 ${strokeWidth / 2}px, transparent ${strokeWidth / 2 + 0.5}px)`
            : `repeating-linear-gradient(${guide.orientation === "vertical" ? "to bottom" : "to right"}, ${strokeColor} 0 ${guideStyle.dashLength}px, transparent ${guideStyle.dashLength}px ${guideStyle.dashLength + guideStyle.gap}px)`;
        const backgroundSize = guideStyle.pattern === "dotted"
          ? guide.orientation === "vertical"
            ? `${strokeWidth}px ${guideStyle.dashLength + guideStyle.gap}px`
            : `${guideStyle.dashLength + guideStyle.gap}px ${strokeWidth}px`
          : undefined;

        return (
          <div
            key={guide.id}
            className="msr:absolute"
            data-mesurer-guide="true"
            style={
              guide.orientation === "vertical"
                ? {
                    left: guide.position - GUIDE_HITBOX_SIZE / 2,
                    top: 0,
                    width: GUIDE_HITBOX_SIZE,
                    height: "100%",
                    pointerEvents: guidePointerEvents ? "auto" : "none",
                  }
                : {
                    top: guide.position - GUIDE_HITBOX_SIZE / 2,
                    left: 0,
                    height: GUIDE_HITBOX_SIZE,
                    width: "100%",
                    pointerEvents: guidePointerEvents ? "auto" : "none",
                  }
            }
            onPointerDown={(event) => onGuidePointerDown(guide, event)}
            onPointerUp={(event) => onGuidePointerUp(guide, event)}
            onPointerCancel={(event) => onGuidePointerCancel(guide, event)}
          >
            <div
              className="msr:absolute"
              style={
                guide.orientation === "vertical"
                  ? {
                      left: GUIDE_HITBOX_SIZE / 2 - 1,
                      top: 0,
                      width: strokeWidth,
                      height: "100%",
                      backgroundColor: isSolid ? strokeColor : "transparent",
                      backgroundImage,
                      backgroundSize,
                      opacity: guideStyle.opacity,
                    }
                  : {
                      top: GUIDE_HITBOX_SIZE / 2 - 1,
                      left: 0,
                      height: strokeWidth,
                      width: "100%",
                      backgroundColor: isSolid ? strokeColor : "transparent",
                      backgroundImage,
                      backgroundSize,
                      opacity: guideStyle.opacity,
                    }
              }
            />
          </div>
        );
      })}
    </div>
  );
});
