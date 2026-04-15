"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { MEASURE_TRANSITION_MS } from "./constants";
import { ensureMeasurerStyles } from "./style-inject";
import { MESURER_STYLES } from "./styles.generated";
import { Toolbar } from "./components/toolbar";
import { useDragState } from "./hooks/use-drag-state";
import { useGuideDragHold } from "./hooks/use-guide-drag-hold";
import { useGuideState } from "./hooks/use-guide-state";
import { useHotkeys } from "./hooks/use-hotkeys";
import { useLiveElementTracking } from "./hooks/use-live-element-tracking";
import { useMeasureToggles } from "./hooks/use-measure-toggles";
import { useMeasurementState } from "./hooks/use-measurement-state";
import { useMeasurerDerived } from "./hooks/use-measurer-derived";
import { useMeasurerHistory } from "./hooks/use-measurer-history";
import { useMeasurerLocalState } from "./hooks/use-measurer-local-state";
import { useMeasurerPointer } from "./hooks/use-measurer-pointer";
import { useOverlayRefs } from "./hooks/use-overlay-refs";
import { useResizeSync } from "./hooks/use-resize-sync";
import { MeasurerOverlay } from "./render/measurer-overlay";
import type {
  DistanceOverlay,
  Guide,
  Measurement,
  Rect,
  ToolMode,
} from "./types";

type MeasurerProps = {
  highlightColor?: string;
  guideColor?: string;
  hoverHighlightEnabled?: boolean;
  persistOnReload?: boolean;
  portalTarget?: HTMLElement | ShadowRoot;
};

const subscribeHydration = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );

const stripMeasurement = (measurement: Measurement): Measurement => ({
  ...measurement,
  elementRef: undefined,
});

const stripDistance = (distance: DistanceOverlay): DistanceOverlay => ({
  ...distance,
  elementRefA: undefined,
  elementRefB: undefined,
});

function MeasurerClient({
  highlightColor,
  guideColor,
  hoverHighlightEnabled,
  persistOnReload,
  portalTarget,
}: Required<MeasurerProps>) {
  const selectionRectRef = useRef<Rect | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const selectionAnimationCleanupTimeoutRef = useRef<number | null>(null);

  const persistedState = useMemo(() => {
    if (!persistOnReload) return null;
    const stored = window.localStorage.getItem("mesurer-state");
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as {
        version: number;
        enabled: boolean;
        toolMode: ToolMode;
        guideOrientation: "vertical" | "horizontal";
        guides: Guide[];
        selectedGuideIds: string[];
        measurements: Measurement[];
        activeMeasurement: Measurement | null;
        heldDistances: DistanceOverlay[];
      };
      if (!parsed || parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [persistOnReload]);

  const { overlayRef, selectedElementRef, hoverElementRef } = useOverlayRefs();
  const {
    selectionOriginRect,
    setSelectionOriginRect,
    hoverPointer,
    setHoverPointer,
    hoverElement,
    setHoverElement,
    selectedElement,
    setSelectedElement,
    clearSelectionRect,
  } = useMeasurerLocalState({
    selectedElementRef,
    hoverElementRef,
    selectionRectRef,
  });

  const {
    enabled,
    setEnabled,
    holdEnabled,
    snapEnabled,
    altPressed,
    setAltPressed,
    toolMode,
    setToolMode,
    guidesEnabled,
    multiMeasureEnabled,
    snapGuidesEnabled,
  } = useMeasureToggles({
    initialEnabled: persistedState?.enabled,
    initialToolMode: persistedState?.toolMode,
  });
  const { start, setStart, end, setEnd, isDragging, setIsDragging } =
    useDragState();
  const {
    activeMeasurement,
    setActiveMeasurement,
    measurements,
    setMeasurements,
    selectedMeasurement,
    setSelectedMeasurement,
    selectedMeasurements,
    setSelectedMeasurements,
    hoverRect,
    setHoverRect,
    heldDistances,
    setHeldDistances,
  } = useMeasurementState({
    initialActiveMeasurement: persistedState?.activeMeasurement ?? null,
    initialMeasurements: persistedState?.measurements ?? [],
    initialHeldDistances: persistedState?.heldDistances ?? [],
  });
  const {
    guides,
    setGuides,
    draggingGuideId,
    setDraggingGuideId,
    selectedGuideIds,
    setSelectedGuideIds,
  } = useGuideState({
    initialGuides: persistedState?.guides ?? [],
    initialSelectedGuideIds: persistedState?.selectedGuideIds ?? [],
  });
  const [toolbarActive, setToolbarActive] = useState(true);
  const { clearGuideDragHold, scheduleGuideDragHold } = useGuideDragHold();
  const [guidePreview, setGuidePreview] = useState<{
    orientation: "vertical" | "horizontal";
    position: number;
  } | null>(null);
  const [guideOrientation, setGuideOrientation] = useState<
    "vertical" | "horizontal"
  >(persistedState?.guideOrientation ?? "vertical");

  const persistPayload = useMemo(() => {
    if (!persistOnReload) return null;
    return JSON.stringify({
      version: 1,
      enabled,
      toolMode,
      guideOrientation,
      guides,
      selectedGuideIds,
      measurements: measurements.map(stripMeasurement),
      activeMeasurement: activeMeasurement
        ? stripMeasurement(activeMeasurement)
        : null,
      heldDistances: heldDistances.map(stripDistance),
    });
  }, [
    activeMeasurement,
    enabled,
    guideOrientation,
    guides,
    heldDistances,
    measurements,
    persistOnReload,
    selectedGuideIds,
    toolMode,
  ]);

  useEffect(() => {
    if (!persistOnReload) return;
    if (typeof window === "undefined") return;
    if (!persistPayload) return;
    try {
      window.localStorage.setItem("mesurer-state", persistPayload);
    } catch {
      // ignore storage errors
    }

    const handlePageHide = () => {
      try {
        window.localStorage.setItem("mesurer-state", persistPayload);
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [persistOnReload, persistPayload]);

  const {
    recordSnapshot,
    createActionCommit,
    setToolModeWithHistory,
    setGuideOrientationWithHistory,
    setEnabledWithHistory,
  } = useMeasurerHistory({
    toggles: {
      enabled,
      setEnabled,
      toolMode,
      setToolMode,
      guideOrientation,
      setGuideOrientation,
    },
    measurements: {
      measurements,
      setMeasurements,
      activeMeasurement,
      setActiveMeasurement,
      selectedMeasurements,
      setSelectedMeasurements,
      selectedMeasurement,
      setSelectedMeasurement,
      heldDistances,
      setHeldDistances,
    },
    guides: {
      guides,
      setGuides,
      selectedGuideIds,
      setSelectedGuideIds,
      draggingGuideId,
      setDraggingGuideId,
    },
    transient: {
      setStart,
      setEnd,
      setIsDragging,
      setGuidePreview,
      setHoverRect,
      setHoverElement,
      setSelectedElement,
      clearSelectionRect,
    },
  });

  const clearAll = useCallback(() => {
    recordSnapshot();
    clearGuideDragHold();
    setStart(null);
    setEnd(null);
    setIsDragging(false);
    setActiveMeasurement(null);
    setMeasurements([]);
    setSelectedMeasurement(null);
    setSelectedMeasurements([]);
    clearSelectionRect();
    setSelectedElement(null);
    setHoverRect(null);
    setHoverElement(null);
    setGuides([]);
    setSelectedGuideIds([]);
    setHeldDistances([]);
  }, [
    clearGuideDragHold,
    clearSelectionRect,
    recordSnapshot,
    setActiveMeasurement,
    setEnd,
    setGuides,
    setHeldDistances,
    setHoverElement,
    setHoverRect,
    setIsDragging,
    setMeasurements,
    setSelectedElement,
    setSelectedGuideIds,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setStart,
  ]);

  const removeSelectedGuides = useCallback(() => {
    if (selectedGuideIds.length === 0) return false;
    recordSnapshot();
    setGuides((prev) =>
      prev.filter((guide) => !selectedGuideIds.includes(guide.id)),
    );
    setSelectedGuideIds([]);
    return true;
  }, [recordSnapshot, selectedGuideIds, setGuides, setSelectedGuideIds]);

  useHotkeys({
    clearAll,
    removeSelectedGuides,
    setEnabled: setEnabledWithHistory,
    setToolMode: setToolModeWithHistory,
    setAltPressed,
    isOverlayActive: () => enabled && (toolMode !== "none" || toolbarActive),
    setGuideOrientation: setGuideOrientationWithHistory,
    onInteract: () => setToolbarActive(true),
  });

  useResizeSync({
    setMeasurements,
    setActiveMeasurement,
    setHeldDistances,
    setSelectedMeasurement,
    setGuides,
    selectedElementRef,
  });

  useLiveElementTracking({
    enabled,
    selectedElementRef,
    hoverElementRef,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setHoverRect,
    setMeasurements,
    setActiveMeasurement,
    setHeldDistances,
  });

  useEffect(() => {
    if (!toolbarActive || toolMode !== "none") return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const toolbarNode = toolbarRef.current;
      if (toolbarNode && toolbarNode.contains(event.target as Node)) return;
      setToolbarActive(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [toolbarActive, toolMode]);

  useEffect(() => {
    if (hoverHighlightEnabled) return;
    setHoverRect(null);
  }, [hoverHighlightEnabled, setHoverRect]);

  useEffect(() => {
    const hasSelectionAnimationState =
      !!selectionOriginRect ||
      !!selectedMeasurement?.originRect ||
      selectedMeasurements.some((measurement) => !!measurement.originRect);

    if (!hasSelectionAnimationState) {
      if (selectionAnimationCleanupTimeoutRef.current !== null) {
        window.clearTimeout(selectionAnimationCleanupTimeoutRef.current);
        selectionAnimationCleanupTimeoutRef.current = null;
      }
      return;
    }

    if (selectionAnimationCleanupTimeoutRef.current !== null) return;

    selectionAnimationCleanupTimeoutRef.current = window.setTimeout(() => {
      selectionAnimationCleanupTimeoutRef.current = null;

      setSelectionOriginRect((prev) => (prev ? null : prev));

      setSelectedMeasurement((prev) => {
        if (!prev?.originRect) return prev;
        const { originRect: _originRect, ...next } = prev;
        return next;
      });

      setSelectedMeasurements((prev) => {
        let changed = false;
        const next = prev.map((measurement) => {
          if (!measurement.originRect) return measurement;
          changed = true;
          const { originRect: _originRect, ...rest } = measurement;
          return rest;
        });
        return changed ? next : prev;
      });
    }, MEASURE_TRANSITION_MS);
  }, [
    selectionOriginRect,
    selectedMeasurement,
    selectedMeasurements,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectionOriginRect,
  ]);

  useEffect(() => {
    return () => {
      if (selectionAnimationCleanupTimeoutRef.current !== null) {
        window.clearTimeout(selectionAnimationCleanupTimeoutRef.current);
      }
    };
  }, []);

  const displayedMeasurements = holdEnabled
    ? measurements
    : multiMeasureEnabled && measurements.length > 0
      ? measurements
      : activeMeasurement
        ? [activeMeasurement]
        : [];

  const {
    activeRect,
    activeWidth,
    activeHeight,
    displayedSelectedMeasurements,
    hoverGuide,
    optionPairOverlay,
    optionContainerLines,
    guideDistanceOverlay,
    outlineColor,
    fillColor,
    guideColorActive,
    guideColorHover,
    guideColorDefault,
    guideColorPreview,
    hoverRectToShow,
    selectedEdgeVisibility,
    hoverEdgeVisibility,
    measurementEdgeVisibility,
  } = useMeasurerDerived({
    start,
    end,
    selectedMeasurements,
    selectedMeasurement,
    selectionOriginRect,
    guides,
    selectedGuideIds,
    hoverPointer,
    hoverRect,
    hoverElement,
    selectedElement,
    altPressed,
    guidesEnabled,
    guidePreview,
    displayedMeasurements,
    hoverHighlightEnabled,
    highlightColor,
    guideColor,
  });

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  } = useMeasurerPointer({
    toolbarRef,
    overlayRef,
    selectionRectRef,
    createActionCommit,
    clearGuideDragHold,
    scheduleGuideDragHold,
    enabled,
    toolMode,
    guidesEnabled,
    snapEnabled,
    snapGuidesEnabled,
    altPressed,
    guideOrientation,
    hoverHighlightEnabled,
    start,
    end,
    isDragging,
    selectedMeasurements,
    selectedMeasurement,
    selectedGuideIds,
    guides,
    draggingGuideId,
    optionPairOverlay,
    setAltPressed,
    setGuidePreview,
    setSelectedGuideIds,
    setGuides,
    setStart,
    setEnd,
    setIsDragging,
    setHeldDistances,
    setDraggingGuideId,
    setActiveMeasurement,
    setMeasurements,
    setSelectedMeasurements,
    setSelectedMeasurement,
    setSelectionOriginRect,
    setSelectedElement,
    setHoverRect,
    setHoverElement,
    setHoverPointer,
    clearSelectionRect,
  });

  const removeHeldDistance = useCallback(
    (id: string) => {
      recordSnapshot();
      setHeldDistances((prev) => prev.filter((distance) => distance.id !== id));
    },
    [recordSnapshot, setHeldDistances],
  );

  const handleGuidePointerDown = useCallback(
    (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit();
      if (!enabled) return;
      event.stopPropagation();
      if (event.shiftKey) {
        commit();
        setSelectedGuideIds((prev) =>
          prev.includes(guide.id)
            ? prev.filter((id) => id !== guide.id)
            : [...prev, guide.id],
        );
        return;
      }

      commit();
      setSelectedGuideIds([guide.id]);
      scheduleGuideDragHold(guide.id, setDraggingGuideId);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      createActionCommit,
      enabled,
      scheduleGuideDragHold,
      setDraggingGuideId,
      setSelectedGuideIds,
    ],
  );

  const handleGuidePointerUp = useCallback(
    (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      clearGuideDragHold();
      setDraggingGuideId((prev) => (prev === guide.id ? null : prev));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [clearGuideDragHold, setDraggingGuideId],
  );

  return createPortal(
    <div
      ref={overlayRef}
      className="mesurer-root msr:pointer-events-none msr:fixed msr:inset-0 msr:z-50"
    >
      <MeasurerOverlay
        enabled={enabled}
        toolMode={toolMode}
        guidesEnabled={guidesEnabled}
        altPressed={altPressed}
        isDragging={isDragging}
        displayedMeasurements={displayedMeasurements}
        measurementEdgeVisibility={measurementEdgeVisibility}
        activeRect={activeRect}
        activeWidth={activeWidth}
        activeHeight={activeHeight}
        fillColor={fillColor}
        outlineColor={outlineColor}
        hoverRectToShow={hoverRectToShow}
        hoverEdgeVisibility={hoverEdgeVisibility}
        guidePreview={guidePreview}
        guideColorPreview={guideColorPreview}
        displayedSelectedMeasurements={displayedSelectedMeasurements}
        selectedEdgeVisibility={selectedEdgeVisibility}
        heldDistances={heldDistances}
        optionPairOverlay={optionPairOverlay}
        guideDistanceOverlay={guideDistanceOverlay}
        optionContainerLines={optionContainerLines}
        guides={guides}
        hoverGuide={hoverGuide}
        draggingGuideId={draggingGuideId}
        selectedGuideIds={selectedGuideIds}
        guideColorActive={guideColorActive}
        guideColorHover={guideColorHover}
        guideColorDefault={guideColorDefault}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onRemoveHeldDistance={removeHeldDistance}
        onGuidePointerDown={handleGuidePointerDown}
        onGuidePointerUp={handleGuidePointerUp}
        onGuidePointerCancel={handleGuidePointerUp}
      />

      <Toolbar
        ref={toolbarRef}
        toolMode={toolMode}
        setEnabled={setEnabledWithHistory}
        setToolMode={setToolModeWithHistory}
        guideOrientation={guideOrientation}
        setGuideOrientation={setGuideOrientationWithHistory}
        onInteract={() => setToolbarActive(true)}
      />
    </div>,
    portalTarget,
  );
}

export default function Measurer({
  highlightColor = "oklch(0.62 0.18 255)",
  guideColor = "oklch(0.63 0.26 29.23)",
  hoverHighlightEnabled = true,
  persistOnReload = false,
  portalTarget,
}: MeasurerProps) {
  if (typeof document !== "undefined") {
    ensureMeasurerStyles(MESURER_STYLES, portalTarget);
  }

  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <MeasurerClient
      highlightColor={highlightColor}
      guideColor={guideColor}
      hoverHighlightEnabled={hoverHighlightEnabled}
      persistOnReload={persistOnReload}
      portalTarget={portalTarget ?? document.body}
    />
  );
}
