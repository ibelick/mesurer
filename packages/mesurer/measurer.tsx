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
import { GUIDE_HITBOX_SIZE, MEASURE_TRANSITION_MS } from "./core/constants";
import { ensureMeasurerStyles } from "./runtime/style-inject";
import { MESURER_STYLES } from "./styles.generated";
import { Toolbar } from "./components/toolbar";
import { ColorPicker } from "./components/color-picker";
import { RulersOverlay } from "./components/rulers-overlay";
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
import { createId } from "./core/utils";
import {
  createTextInspector,
  type TextInspectorAPI,
} from "./runtime/text-inspector";
import type {
  DistanceOverlay,
  Guide,
  Measurement,
  Rect,
  ToolMode,
} from "./core/types";
import {
  formatColor,
  parseCssColor,
  type ColorPickerFormat,
  type ColorSample,
} from "./core/colors";

type MeasurerProps = {
  highlightColor?: string;
  guideColor?: string;
  hoverHighlightEnabled?: boolean;
  persistOnReload?: boolean;
  portalTarget?: HTMLElement | ShadowRoot;
  persistKey?: string;
  colorPickerFormats?: ColorPickerFormat[];
  colorPickerClickFormat?: ColorPickerFormat;
};

type EyeDropperResult = { sRGBHex: string };
type EyeDropperLike = { open: () => Promise<EyeDropperResult> };
type WindowWithEyeDropper = Window & {
  EyeDropper?: new () => EyeDropperLike;
};

let measurerInstanceCount = 0;
const XRAY_STYLE_ID = "mesurer-xray-styles";
const XRAY_STYLES = `
.xray-mode * {
  outline: solid 1px blue !important;
}
.xray-mode #mesurer-extension-host,
.xray-mode #mesurer-extension-host *,
.xray-mode .mesurer-root,
.xray-mode .mesurer-root *,
.xray-mode .mesurer-toolbar-surface,
.xray-mode .mesurer-toolbar-surface * {
  outline: none !important;
}
`;

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
  persistKey,
  colorPickerFormats,
  colorPickerClickFormat,
}: Required<Omit<MeasurerProps, "persistKey">> &
  Pick<MeasurerProps, "persistKey">) {
  const instanceIdRef = useRef<number | null>(null);
  if (instanceIdRef.current === null) {
    instanceIdRef.current = ++measurerInstanceCount;
  }
  const storageKey =
    persistKey ??
    (instanceIdRef.current === 1
      ? "mesurer-state"
      : `mesurer-state-${instanceIdRef.current}`);
  const ownerDocument = portalTarget.ownerDocument ?? document;
  const ownerWindow = ownerDocument.defaultView ?? window;
  const guideScrollRef = useRef({
    x: ownerWindow.scrollX,
    y: ownerWindow.scrollY,
  });
  const textInspectorRef = useRef<TextInspectorAPI | null>(null);
  if (!textInspectorRef.current) {
    textInspectorRef.current = createTextInspector({ portalTarget });
  }
  const textInspector = textInspectorRef.current!;
  const selectionRectRef = useRef<Rect | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const selectionAnimationCleanupTimeoutRef = useRef<number | null>(null);
  const guideDragRef = useRef<{
    id: string;
    orientation: "vertical" | "horizontal";
    pointerId: number;
    commit: () => void;
    committed: boolean;
  } | null>(null);
  const guideUserSelectRef = useRef<string | null>(null);

  const persistedState = useMemo(() => {
    if (!persistOnReload) return null;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return null;
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
         rulersVisible?: boolean;
      };
      if (!parsed || parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [persistOnReload, storageKey]);

  const enabledRef = useRef(false);
  const toolModeRef = useRef<ToolMode>(
    persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode ?? "none",
  );
  const rulersVisibleRef = useRef(
    persistedState?.rulersVisible ?? persistedState?.toolMode === "rulers",
  );
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
    rulersVisible,
    setRulersVisible,
    guidesEnabled,
    multiMeasureEnabled,
    snapGuidesEnabled,
  } = useMeasureToggles({
    initialEnabled: persistedState?.enabled,
    initialToolMode:
      persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode,
    initialRulersVisible:
      persistedState?.rulersVisible ?? persistedState?.toolMode === "rulers",
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
  const [colorPickerActive, setColorPickerActive] = useState(false);
  const [colorPickerSample, setColorPickerSample] = useState<ColorSample | null>(null);
  const [colorPickerUnsupported, setColorPickerUnsupported] = useState(false);
  const { clearGuideDragHold, scheduleGuideDragHold } = useGuideDragHold(ownerWindow);
  const [guidePreview, setGuidePreview] = useState<{
    orientation: "vertical" | "horizontal";
    position: number;
  } | null>(null);
  const [guideOrientation, setGuideOrientation] = useState<
    "vertical" | "horizontal"
  >(persistedState?.guideOrientation ?? "vertical");

  enabledRef.current = enabled;
  toolModeRef.current = toolMode;
  rulersVisibleRef.current = rulersVisible;
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
        storageKey,
        JSON.stringify({
          version: 1,
          enabled: enabledRef.current,
          toolMode: toolModeRef.current,
          rulersVisible: rulersVisibleRef.current,
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
  }, [persistOnReload, storageKey]);

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

  const setRulersVisiblePersisted = useCallback(
    (value: Parameters<typeof setRulersVisible>[0]) => {
      const next =
        typeof value === "function"
          ? value(rulersVisibleRef.current)
          : value;
      if (Object.is(next, rulersVisibleRef.current)) return;
      rulersVisibleRef.current = next;
      setRulersVisible(next);
      persistState();
    },
    [persistState, setRulersVisible],
  );

  const setToolModePersisted = useCallback(
    (value: Parameters<typeof setToolMode>[0]) => {
      const next = typeof value === "function" ? value(toolModeRef.current) : value;
      if (Object.is(next, toolModeRef.current)) return;
      toolModeRef.current = next;
      setToolMode(next);
      if (next === "text-inspector") {
        textInspector.enable();
      } else {
        textInspector.disable();
      }
      persistState();
    },
    [persistState, setToolMode, textInspector],
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
    undo: undoHistory,
    redo: redoHistory,
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

  const undo = useCallback(() => {
    if (toolMode === "text-inspector" && textInspector.undo()) return;
    undoHistory();
  }, [textInspector, toolMode, undoHistory]);

  const redo = useCallback(() => {
    if (toolMode === "text-inspector" && textInspector.redo()) return;
    redoHistory();
  }, [redoHistory, textInspector, toolMode]);

  const clearAll = useCallback(() => {
    if (toolMode === "text-inspector") {
      textInspector.clear();
    }
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
    textInspector,
    toolMode,
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

  const openColorPicker = useCallback(async () => {
    const EyeDropper = (ownerWindow as WindowWithEyeDropper).EyeDropper;
    setEnabledWithHistory(true);
    setToolModeWithHistory("none");
    setColorPickerActive(true);
    setColorPickerSample(null);
    setColorPickerUnsupported(!EyeDropper);
    if (!EyeDropper) return;

    try {
      const result = await new EyeDropper().open();
      const nextSample = parseCssColor(result.sRGBHex);
      if (!nextSample) return;
      setColorPickerSample(nextSample);
      const clipboardWrite = ownerWindow.navigator.clipboard?.writeText(
        formatColor(nextSample, colorPickerClickFormat),
      );
      void clipboardWrite?.catch(() => undefined);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setColorPickerActive(false);
      }
    }
  }, [colorPickerClickFormat, ownerWindow, setEnabledWithHistory, setToolModeWithHistory]);

  useHotkeys({
    eventTarget: ownerWindow,
    clearAll,
    undo,
    redo,
    removeSelectedGuides,
    setEnabled: setEnabledWithHistory,
    setToolMode: setToolModeWithHistory,
    setRulersVisible: setRulersVisiblePersisted,
    setAltPressed,
    isOverlayActive: () => enabled && (toolMode !== "none" || toolbarActive),
    setGuideOrientation: setGuideOrientationWithHistory,
    onInteract: () => setToolbarActive(true),
    onColorPicker: openColorPicker,
  });

  useResizeSync({
    document: ownerDocument,
    window: ownerWindow,
    setMeasurements: setMeasurementsPersisted,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setHeldDistances: setHeldDistancesPersisted,
    setSelectedMeasurement,
    setGuides: setGuidesPersisted,
    selectedElementRef,
  });

  useEffect(() => {
    const handleScroll = () => {
      const next = {
        x: ownerWindow.scrollX,
        y: ownerWindow.scrollY,
      };
      const deltaX = next.x - guideScrollRef.current.x;
      const deltaY = next.y - guideScrollRef.current.y;
      guideScrollRef.current = next;
      if (deltaX === 0 && deltaY === 0) return;

      setGuidesPersisted((prev) =>
        prev.map((guide) => ({
          ...guide,
          position:
            guide.position -
            (guide.orientation === "vertical" ? deltaX : deltaY),
        })),
      );
    };

    ownerWindow.addEventListener("scroll", handleScroll, true);
    return () => ownerWindow.removeEventListener("scroll", handleScroll, true);
  }, [ownerWindow, setGuidesPersisted]);

  useLiveElementTracking({
    document: ownerDocument,
    window: ownerWindow,
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

    ownerWindow.addEventListener("pointerdown", handlePointerDown);
    return () => {
      ownerWindow.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [ownerWindow, toolbarActive, toolMode]);

  useEffect(() => {
    if (!enabled) return;

    const handleGuidePointerDown = (event: globalThis.PointerEvent) => {
      if (toolbarRef.current?.contains(event.target as Node)) return;
      const guideTarget = event.composedPath().some(
        (target) =>
          target instanceof ownerWindow.Element &&
          target.hasAttribute("data-mesurer-guide"),
      );
      if (guideTarget && toolMode !== "none") return;

      const point = { x: event.clientX, y: event.clientY };
      const guide = guides.find((candidate) => {
        const distance =
          candidate.orientation === "vertical"
            ? Math.abs(candidate.position - point.x)
            : Math.abs(candidate.position - point.y);
        return distance <= GUIDE_HITBOX_SIZE / 2;
      });
      if (!guide) return;

      if (event.button === 0 && !event.shiftKey && toolMode === "none") {
        guideDragRef.current = {
          id: guide.id,
          orientation: guide.orientation,
          pointerId: event.pointerId,
          commit: createActionCommit(),
          committed: false,
        };
      }

      setSelectedGuideIdsPersisted((prev) =>
        event.shiftKey
          ? prev.includes(guide.id)
            ? prev.filter((id) => id !== guide.id)
            : [...prev, guide.id]
          : [guide.id],
      );
    };

    const handleGuidePointerMove = (event: globalThis.PointerEvent) => {
      const drag = guideDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const position =
        drag.orientation === "vertical" ? event.clientX : event.clientY;
      if (!drag.committed) {
        event.preventDefault();
        if (guideUserSelectRef.current === null) {
          guideUserSelectRef.current = ownerDocument.documentElement.style.userSelect;
          ownerDocument.documentElement.style.userSelect = "none";
        }
        ownerWindow.getSelection()?.removeAllRanges();
        drag.commit();
        drag.committed = true;
      }
      setGuidesPersisted((prev) =>
        prev.map((guide) =>
          guide.id === drag.id ? { ...guide, position } : guide,
        ),
      );
    };

    const handleGuidePointerEnd = (event: globalThis.PointerEvent) => {
      if (guideDragRef.current?.pointerId === event.pointerId) {
        guideDragRef.current = null;
        if (guideUserSelectRef.current !== null) {
          ownerDocument.documentElement.style.userSelect = guideUserSelectRef.current;
          guideUserSelectRef.current = null;
        }
      }
    };

    ownerWindow.addEventListener("pointerdown", handleGuidePointerDown, true);
    ownerWindow.addEventListener("pointermove", handleGuidePointerMove, true);
    ownerWindow.addEventListener("pointerup", handleGuidePointerEnd, true);
    ownerWindow.addEventListener("pointercancel", handleGuidePointerEnd, true);
    return () => {
      ownerWindow.removeEventListener(
        "pointerdown",
        handleGuidePointerDown,
        true,
      );
      ownerWindow.removeEventListener("pointermove", handleGuidePointerMove, true);
      ownerWindow.removeEventListener("pointerup", handleGuidePointerEnd, true);
      ownerWindow.removeEventListener(
        "pointercancel",
        handleGuidePointerEnd,
        true,
      );
      if (guideUserSelectRef.current !== null) {
        ownerDocument.documentElement.style.userSelect = guideUserSelectRef.current;
        guideUserSelectRef.current = null;
      }
    };
  }, [
    createActionCommit,
    enabled,
    guides,
    ownerWindow,
    setGuidesPersisted,
    setSelectedGuideIdsPersisted,
    toolMode,
  ]);

  // Drive the vanilla-DOM text-inspector IIFE from the React tool mode.
  // The module owns its own listeners / DOM / styles; React only tells it
  // when to turn on and off. `cleanup()` wipes everything on unmount so
  // nothing leaks on SPA re-init or extension teardown.
  useEffect(() => {
    if (toolMode === "text-inspector") {
      textInspector.enable();
    } else {
      textInspector.disable();
    }
  }, [textInspector, toolMode]);

  useEffect(() => {
    let style = ownerDocument.getElementById(XRAY_STYLE_ID);
    if (!style) {
      style = ownerDocument.createElement("style");
      style.id = XRAY_STYLE_ID;
      style.textContent = XRAY_STYLES;
      ownerDocument.head.appendChild(style);
    }
    if (toolMode === "xray") {
      ownerDocument.body.classList.add("xray-mode");
    } else {
      ownerDocument.body.classList.remove("xray-mode");
    }
    return () => {
      ownerDocument.body.classList.remove("xray-mode");
    };
  }, [ownerDocument, toolMode]);

  useEffect(() => {
    return () => {
      textInspector.destroy();
    };
  }, [textInspector]);

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
    document: ownerDocument,
    window: ownerWindow,
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
    document: ownerDocument,
    window: ownerWindow,
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

  const startGuideFromRuler = useCallback(
    (orientation: "vertical" | "horizontal", position: number) => {
      const id = createId();
      const commit = createActionCommit();
      commit();
      setSelectedGuideIdsPersisted([]);
      setGuidesPersisted((prev) => [...prev, { id, orientation, position }]);
      return id;
    },
    [
      createActionCommit,
      setGuidesPersisted,
      setSelectedGuideIdsPersisted,
    ],
  );

  const moveGuideFromRuler = useCallback(
    (id: string, position: number) => {
      setGuidesPersisted((prev) =>
        prev.map((guide) => (guide.id === id ? { ...guide, position } : guide)),
      );
    },
    [setGuidesPersisted],
  );

  const finishGuideFromRuler = useCallback(
    (id: string) => {
      setSelectedGuideIdsPersisted([id]);
    },
    [setSelectedGuideIdsPersisted],
  );

  const cancelGuideFromRuler = useCallback(
    (id: string) => {
      setGuidesPersisted((prev) => prev.filter((guide) => guide.id !== id));
    },
    [setGuidesPersisted],
  );

  const handleGuidePointerDown = useCallback(
    (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => {
      const commit = createActionCommit();
      if (!enabled) return;
      event.stopPropagation();
      event.preventDefault();
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
      {enabled && rulersVisible ? (
        <RulersOverlay
          onStartGuide={startGuideFromRuler}
          onMoveGuide={moveGuideFromRuler}
          onFinishGuide={finishGuideFromRuler}
          onCancelGuide={cancelGuideFromRuler}
          guides={guides}
          selectedGuideIds={selectedGuideIds}
        />
      ) : null}
      <MeasurerOverlay
        enabled={enabled}
        toolMode={toolMode}
        guidePointerEvents={enabled && (toolMode !== "none" || rulersVisible)}
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

      <ColorPicker
        active={colorPickerActive}
        sample={colorPickerSample}
        unsupported={colorPickerUnsupported}
        ownerWindow={ownerWindow}
        toolbarRef={toolbarRef}
        formats={colorPickerFormats}
        onClose={() => setColorPickerActive(false)}
      />

      <Toolbar
        ref={toolbarRef}
        eventTarget={ownerWindow}
        toolMode={toolMode}
        setEnabled={setEnabledWithHistory}
        setToolMode={setToolModeWithHistory}
        rulersVisible={rulersVisible}
        setRulersVisible={setRulersVisiblePersisted}
        guideOrientation={guideOrientation}
        setGuideOrientation={setGuideOrientationWithHistory}
        onInteract={() => setToolbarActive(true)}
        colorPickerActive={colorPickerActive}
        setColorPickerActive={setColorPickerActive}
        onColorPickerClick={openColorPicker}
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
  persistKey,
  colorPickerFormats = ["hex", "rgb", "oklch"],
  colorPickerClickFormat = "hex",
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
      persistKey={persistKey}
      colorPickerFormats={colorPickerFormats}
      colorPickerClickFormat={colorPickerClickFormat}
      portalTarget={portalTarget ?? document.body}
    />
  );
}
