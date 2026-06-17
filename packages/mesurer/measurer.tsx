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
import { MEASURE_TRANSITION_MS } from "./core/constants";
import { ensureMeasurerStyles } from "./runtime/style-inject";
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
import { TextInspector } from "./runtime/text-inspector";
import type {
  DistanceOverlay,
  Guide,
  Measurement,
  Rect,
  ToolMode,
} from "./core/types";

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

  const enabledRef = useRef(false);
  const toolModeRef = useRef<ToolMode>(persistedState?.toolMode ?? "none");
  const guideOrientationRef = useRef<"vertical" | "horizontal">(
    persistedState?.guideOrientation ?? "vertical",
  );
  const measurementsRef = useRef<Measurement[]>(
    persistedState?.measurements ?? [],
  );
  const activeMeasurementRef = useRef<Measurement | null>(
    persistedState?.activeMeasurement ?? null,
  );
  const heldDistancesRef = useRef<DistanceOverlay[]>(
    persistedState?.heldDistances ?? [],
  );
  const guidesRef = useRef<Guide[]>(persistedState?.guides ?? []);
  const selectedGuideIdsRef = useRef<string[]>(
    persistedState?.selectedGuideIds ?? [],
  );

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

  enabledRef.current = enabled;
  toolModeRef.current = toolMode;
  guideOrientationRef.current = guideOrientation;
  measurementsRef.current = measurements;
  activeMeasurementRef.current = activeMeasurement;
  heldDistancesRef.current = heldDistances;
  guidesRef.current = guides;
  selectedGuideIdsRef.current = selectedGuideIds;

  const persistState = useCallback(() => {
    if (!persistOnReload) return;
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        "mesurer-state",
        JSON.stringify({
          version: 1,
          enabled: enabledRef.current,
          toolMode: toolModeRef.current,
          guideOrientation: guideOrientationRef.current,
          guides: guidesRef.current,
          selectedGuideIds: selectedGuideIdsRef.current,
          measurements: measurementsRef.current.map(stripMeasurement),
          activeMeasurement: activeMeasurementRef.current
            ? stripMeasurement(activeMeasurementRef.current)
            : null,
          heldDistances: heldDistancesRef.current.map(stripDistance),
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [persistOnReload]);

  const setEnabledPersisted = useCallback(
    (value: Parameters<typeof setEnabled>[0]) => {
      const next = typeof value === "function" ? value(enabledRef.current) : value;
      if (Object.is(next, enabledRef.current)) return;
      enabledRef.current = next;
      setEnabled(next);
      persistState();
    },
    [persistState, setEnabled],
  );

  const setToolModePersisted = useCallback(
    (value: Parameters<typeof setToolMode>[0]) => {
      const next = typeof value === "function" ? value(toolModeRef.current) : value;
      if (Object.is(next, toolModeRef.current)) return;
      toolModeRef.current = next;
      setToolMode(next);
      persistState();
    },
    [persistState, setToolMode],
  );

  const setGuideOrientationPersisted = useCallback(
    (value: Parameters<typeof setGuideOrientation>[0]) => {
      const next =
        typeof value === "function" ? value(guideOrientationRef.current) : value;
      if (Object.is(next, guideOrientationRef.current)) return;
      guideOrientationRef.current = next;
      setGuideOrientation(next);
      persistState();
    },
    [persistState, setGuideOrientation],
  );

  const setMeasurementsPersisted = useCallback(
    (value: Parameters<typeof setMeasurements>[0]) => {
      const next =
        typeof value === "function" ? value(measurementsRef.current) : value;
      if (Object.is(next, measurementsRef.current)) return;
      measurementsRef.current = next;
      setMeasurements(next);
      persistState();
    },
    [persistState, setMeasurements],
  );

  const setActiveMeasurementPersisted = useCallback(
    (value: Parameters<typeof setActiveMeasurement>[0]) => {
      const next =
        typeof value === "function"
          ? value(activeMeasurementRef.current)
          : value;
      if (Object.is(next, activeMeasurementRef.current)) return;
      activeMeasurementRef.current = next;
      setActiveMeasurement(next);
      persistState();
    },
    [persistState, setActiveMeasurement],
  );

  const setHeldDistancesPersisted = useCallback(
    (value: Parameters<typeof setHeldDistances>[0]) => {
      const next =
        typeof value === "function" ? value(heldDistancesRef.current) : value;
      if (Object.is(next, heldDistancesRef.current)) return;
      heldDistancesRef.current = next;
      setHeldDistances(next);
      persistState();
    },
    [persistState, setHeldDistances],
  );

  const setGuidesPersisted = useCallback(
    (value: Parameters<typeof setGuides>[0]) => {
      const next = typeof value === "function" ? value(guidesRef.current) : value;
      if (Object.is(next, guidesRef.current)) return;
      guidesRef.current = next;
      setGuides(next);
      persistState();
    },
    [persistState, setGuides],
  );

  const setSelectedGuideIdsPersisted = useCallback(
    (value: Parameters<typeof setSelectedGuideIds>[0]) => {
      const next =
        typeof value === "function" ? value(selectedGuideIdsRef.current) : value;
      if (Object.is(next, selectedGuideIdsRef.current)) return;
      selectedGuideIdsRef.current = next;
      setSelectedGuideIds(next);
      persistState();
    },
    [persistState, setSelectedGuideIds],
  );

  const {
    recordSnapshot,
    createActionCommit,
    setToolModeWithHistory,
    setGuideOrientationWithHistory,
    setEnabledWithHistory,
    undo,
    redo,
  } = useMeasurerHistory({
    toggles: {
      enabled,
      setEnabled: setEnabledPersisted,
      toolMode,
      setToolMode: setToolModePersisted,
      guideOrientation,
      setGuideOrientation: setGuideOrientationPersisted,
    },
    measurements: {
      measurements,
      setMeasurements: setMeasurementsPersisted,
      activeMeasurement,
      setActiveMeasurement: setActiveMeasurementPersisted,
      selectedMeasurements,
      setSelectedMeasurements,
      selectedMeasurement,
      setSelectedMeasurement,
      heldDistances,
      setHeldDistances: setHeldDistancesPersisted,
    },
    guides: {
      guides,
      setGuides: setGuidesPersisted,
      selectedGuideIds,
      setSelectedGuideIds: setSelectedGuideIdsPersisted,
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
    setActiveMeasurementPersisted(null);
    setMeasurementsPersisted([]);
    setSelectedMeasurement(null);
    setSelectedMeasurements([]);
    clearSelectionRect();
    setSelectedElement(null);
    setHoverRect(null);
    setHoverElement(null);
    setGuidesPersisted([]);
    setSelectedGuideIdsPersisted([]);
    setHeldDistancesPersisted([]);
  }, [
    clearGuideDragHold,
    clearSelectionRect,
    recordSnapshot,
    setActiveMeasurementPersisted,
    setEnd,
    setGuidesPersisted,
    setHeldDistancesPersisted,
    setHoverElement,
    setHoverRect,
    setIsDragging,
    setMeasurementsPersisted,
    setSelectedElement,
    setSelectedGuideIdsPersisted,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setStart,
  ]);

  const removeSelectedGuides = useCallback(() => {
    if (selectedGuideIds.length === 0) return false;
    recordSnapshot();
    setGuidesPersisted((prev) =>
      prev.filter((guide) => !selectedGuideIds.includes(guide.id)),
    );
    setSelectedGuideIdsPersisted([]);
    return true;
  }, [
    recordSnapshot,
    selectedGuideIds,
    setGuidesPersisted,
    setSelectedGuideIdsPersisted,
  ]);

  useHotkeys({
    clearAll,
    undo,
    redo,
    removeSelectedGuides,
    setEnabled: setEnabledWithHistory,
    setToolMode: setToolModeWithHistory,
    setAltPressed,
    isOverlayActive: () => enabled && (toolMode !== "none" || toolbarActive),
    setGuideOrientation: setGuideOrientationWithHistory,
    onInteract: () => setToolbarActive(true),
  });

  useResizeSync({
    setMeasurements: setMeasurementsPersisted,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setHeldDistances: setHeldDistancesPersisted,
    setSelectedMeasurement,
    setGuides: setGuidesPersisted,
    selectedElementRef,
  });

  useLiveElementTracking({
    enabled,
    selectedElementRef,
    hoverElementRef,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setHoverRect,
    setMeasurements: setMeasurementsPersisted,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setHeldDistances: setHeldDistancesPersisted,
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

  // Drive the vanilla-DOM text-inspector IIFE from the React tool mode.
  // The module owns its own listeners / DOM / styles; React only tells it
  // when to turn on and off. `cleanup()` wipes everything on unmount so
  // nothing leaks on SPA re-init or extension teardown.
  useEffect(() => {
    if (toolMode === "text-inspector") {
      TextInspector.enable();
    } else {
      TextInspector.disable();
    }
  }, [toolMode]);

  useEffect(() => {
    return () => {
      TextInspector.cleanup();
    };
  }, []);

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

    return () => {
      if (selectionAnimationCleanupTimeoutRef.current !== null) {
        window.clearTimeout(selectionAnimationCleanupTimeoutRef.current);
        selectionAnimationCleanupTimeoutRef.current = null;
      }
    };
  }, [
    selectionOriginRect,
    selectedMeasurement,
    selectedMeasurements,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectionOriginRect,
  ]);

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
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setGuides: setGuidesPersisted,
    setStart,
    setEnd,
    setIsDragging,
    setHeldDistances: setHeldDistancesPersisted,
    setDraggingGuideId,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setMeasurements: setMeasurementsPersisted,
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
      setHeldDistancesPersisted((prev) =>
        prev.filter((distance) => distance.id !== id),
      );
    },
    [recordSnapshot, setHeldDistancesPersisted],
  );

  const handleGuidePointerDown = useCallback(
    (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit();
      if (!enabled) return;
      event.stopPropagation();
      if (event.shiftKey) {
        commit();
        setSelectedGuideIdsPersisted((prev) =>
          prev.includes(guide.id)
            ? prev.filter((id) => id !== guide.id)
            : [...prev, guide.id],
        );
        return;
      }

      commit();
      setSelectedGuideIdsPersisted([guide.id]);
      scheduleGuideDragHold(guide.id, setDraggingGuideId);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      createActionCommit,
      enabled,
      scheduleGuideDragHold,
      setDraggingGuideId,
      setSelectedGuideIdsPersisted,
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
