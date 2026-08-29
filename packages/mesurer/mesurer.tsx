"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { ensureMesurerStyles } from "./runtime/style-inject";
import { MESURER_STYLES } from "./styles.generated";
import {
  SettingsPanel,
  settingsFocusSection,
  type SettingsFocusSection,
} from "./components/settings-panel";
import { MesurerPortal } from "./components/mesurer-portal";
import { useColorPicker } from "./hooks/use-color-picker";
import { useGuideDragHold } from "./hooks/use-guide-drag-hold";
import { useGuideWindowEvents } from "./hooks/use-guide-window-events";
import { useHotkeys } from "./hooks/use-hotkeys";
import { useHydrated } from "./hooks/use-hydrated";
import { useLiveElementTracking } from "./hooks/use-live-element-tracking";
import { useMesurerDerived } from "./hooks/use-mesurer-derived";
import { useMesurerHistory } from "./hooks/use-mesurer-history";
import { useMesurerSettings } from "./hooks/use-mesurer-settings";
import { useMesurerWorkspaceState } from "./hooks/use-mesurer-workspace-state";
import { useMesurerPointer } from "./hooks/use-mesurer-pointer";
import { usePersistenceLifecycle } from "./hooks/use-persistence-lifecycle";
import { useResizeSync } from "./hooks/use-resize-sync";
import { useRulerGuides } from "./hooks/use-ruler-guides";
import { useScreenshot } from "./hooks/use-screenshot";
import { useSelectionAnimationCleanup } from "./hooks/use-selection-animation-cleanup";
import { useTextInspector } from "./hooks/use-text-inspector";
import { useXray } from "./hooks/use-xray";
import { useArrowsPointer } from "./hooks/use-arrows-pointer";
import { usePenPointer } from "./hooks/use-pen-pointer";
import { createPersistedSetter } from "./core/persisted-setter";
import { getRectFromPoints } from "./core/geometry";
import { applyGroupResize, applyGroupRotation, type GroupResizeSnapshot, type GroupRotateSnapshot } from "./core/group-transform";
import { textAnnotationBounds, type ResizeHandle } from "./core/text-transform";
import { createId } from "./core/utils";
import { readEditableText } from "./render/text-layer";
import { arrowBounds, transformedArrowBounds } from "./core/arrow-transform";
import { penBounds, transformedPenBounds } from "./core/pen-transform";
import type { ColorPickerFormat } from "./core/colors";
import {
  createLocalStoragePersistence,
  DEFAULT_GUIDE_STYLE,
  type MesurerPersistence,
  type MesurerPersistenceSnapshot,
  type PersistenceChangeSource,
  type MesurerStoredWorkspace,
  type GuideStyle,
  DEFAULT_RULER_SETTINGS,
  type RulerSettings,
} from "./core/persistence";
import { DEFAULT_TEXT_STYLE, resolveTextFontFamily, type TextStyleSettings } from "./core/text-style";
import {
  getTabId,
  LEGACY_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  sanitizeStoredSettings,
  stripDistance,
  stripMeasurement,
} from "./core/workspace";

export type MesurerProps = {
  highlightColor?: string;
  guideColor?: string;
  arrowColor?: string;
  guideHighlightEnabled?: boolean;
  hoverHighlightEnabled?: boolean;
  layoutDetailsEnabled?: boolean;
  persistOnReload?: boolean;
  portalTarget?: HTMLElement | ShadowRoot;
  persistKey?: string;
  colorPickerFormats?: ColorPickerFormat[];
  colorPickerClickFormat?: ColorPickerFormat;
  snapEnabled?: boolean;
  snapGuidesEnabled?: boolean;
  snapArrowsEnabled?: boolean;
  arrowClickToPlace?: boolean;
  selectNewGuideEnabled?: boolean;
  multiMeasureEnabled?: boolean;
  guideStyle?: Partial<GuideStyle>;
  rulerSettings?: Partial<RulerSettings>;
  textStyle?: Partial<TextStyleSettings>;
  persistence?: MesurerPersistence;
  onPersistenceError?: (error: unknown) => void;
  captureVisibleTab?: () => Promise<Blob>;
};

let mesurerInstanceCount = 0;

function MesurerClient({
  highlightColor,
  guideColor,
  arrowColor,
  guideHighlightEnabled,
  hoverHighlightEnabled,
  layoutDetailsEnabled,
  persistOnReload,
  portalTarget,
  persistKey,
  colorPickerFormats,
  colorPickerClickFormat,
  snapEnabled: snapEnabledDefault,
  snapGuidesEnabled: snapGuidesEnabledDefault,
  snapArrowsEnabled: snapArrowsEnabledDefault,
  arrowClickToPlace: arrowClickToPlaceDefault,
  selectNewGuideEnabled: selectNewGuideEnabledDefault,
  multiMeasureEnabled: multiMeasureEnabledDefault,
  guideStyle: guideStyleDefault,
  rulerSettings: rulerSettingsDefault,
  textStyle: textStyleDefault,
  persistence,
  onPersistenceError,
  captureVisibleTab,
}: Required<
  Omit<
    MesurerProps,
    | "persistKey"
    | "persistence"
    | "onPersistenceError"
    | "guideStyle"
    | "rulerSettings"
    | "textStyle"
    | "captureVisibleTab"
  >
> &
  Pick<
    MesurerProps,
    "persistKey" | "persistence" | "onPersistenceError" | "captureVisibleTab"
  > & {
    guideStyle: GuideStyle;
    rulerSettings: RulerSettings;
    textStyle: TextStyleSettings;
  }) {
  const instanceIdRef = useRef<number | null>(null);
  if (instanceIdRef.current === null) {
    instanceIdRef.current = ++mesurerInstanceCount;
  }
  const ownerDocument = portalTarget.ownerDocument ?? document;
  const ownerWindow = ownerDocument.defaultView ?? window;
  const tabIdRef = useRef<string | null>(null);
  if (tabIdRef.current === null) tabIdRef.current = getTabId(ownerWindow);
  const storageKey =
    persistKey ??
    (instanceIdRef.current === 1
      ? `mesurer-state:${tabIdRef.current}`
      : `mesurer-state:${tabIdRef.current}:${instanceIdRef.current}`);
  const legacyStorageKey = persistKey ? undefined : LEGACY_STORAGE_KEY;
  const toolbarRef = useRef<HTMLDivElement>(null);

  const persistenceErrorHandlerRef = useRef(onPersistenceError);
  persistenceErrorHandlerRef.current = onPersistenceError;
  const activePersistence = useMemo(() => {
    const next = persistence ?? createLocalStoragePersistence(ownerWindow, storageKey, SETTINGS_STORAGE_KEY, legacyStorageKey);
    next.setErrorHandler?.((error) => persistenceErrorHandlerRef.current?.(error));
    return next;
  }, [legacyStorageKey, ownerWindow, persistence, storageKey]);
  const storedState = useMemo(
    () => activePersistence.load(),
    [activePersistence],
  );
  const persistedState =
    persistOnReload || storedState?.settings.persistOnReload
      ? storedState?.workspace ?? null
      : null;
  const persistedSettings = sanitizeStoredSettings(ownerWindow, storedState?.settings ?? {});

  const closeScreenshotRef = useRef<() => void>(() => {});
  const closeColorPickerRef = useRef<() => void>(() => {});
  const cancelArrowInteractionRef = useRef<() => void>(() => {});
  const hasArrowInteractionRef = useRef<() => boolean>(() => false);
  const cancelPenInteractionRef = useRef<() => void>(() => {});
  const hasPenInteractionRef = useRef<() => boolean>(() => false);
  const workspacePersistTimeoutRef = useRef<number | null>(null);
  const applyingExternalPersistenceRef = useRef(false);
  const workspace = useMesurerWorkspaceState({
    persistedState,
    snapEnabledDefault: persistedSettings.snapEnabled ?? snapEnabledDefault,
    snapGuidesEnabledDefault:
      persistedSettings.snapGuidesEnabled ?? snapGuidesEnabledDefault,
    snapArrowsEnabledDefault:
      persistedSettings.snapArrowsEnabled ?? snapArrowsEnabledDefault,
    arrowClickToPlaceDefault:
      persistedSettings.arrowClickToPlace ?? arrowClickToPlaceDefault,
    selectNewGuideEnabledDefault:
      persistedSettings.selectNewGuideEnabled ?? selectNewGuideEnabledDefault,
    multiMeasureEnabledDefault:
      persistedSettings.multiMeasureEnabled ?? multiMeasureEnabledDefault,
    initialTextAnnotations: persistedState?.textAnnotations,
  });
  const {
    selectionRectRef,
    enabledRef,
    toolModeRef,
    rulersVisibleRef,
    xrayVisibleRef,
    guideOrientationRef,
    measurementsRef,
    activeMeasurementRef,
    heldDistancesRef,
    guidesRef,
    selectedGuideIdsRef,
    arrowsRef,
    selectedArrowIdsRef,
    penStrokesRef,
    selectedPenStrokeIdsRef,
    penStrokes,
    selectedPenStrokeIds,
    setSelectedPenStrokeIds,
    setPenStrokes,
    penPreview,
    setPenPreview,
    textAnnotationsRef,
    overlayRef,
    selectedElementRef,
    hoverElementRef,
    selectionOriginRect,
    setSelectionOriginRect,
    hoverPointer,
    setHoverPointer,
    hoverElement,
    setHoverElement,
    selectedElement,
    setSelectedElement,
    clearSelectionRect,
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
    setSnapGuidesEnabled,
    snapArrowsEnabled,
    setSnapArrowsEnabled,
    arrowClickToPlace,
    setArrowClickToPlace,
    selectNewGuideEnabled,
    setSelectNewGuideEnabled,
    setSnapEnabled,
    setMultiMeasureEnabled,
    start,
    setStart,
    end,
    setEnd,
    isDragging,
    setIsDragging,
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
    guides,
    setGuides,
    draggingGuideId,
    setDraggingGuideId,
    selectedGuideIds,
    setSelectedGuideIds,
    arrows,
    selectedArrowIds,
    setArrows,
    setSelectedArrowIds,
    textAnnotations,
    setTextAnnotations,
    textDraft,
    setTextDraft,
    selectedTextIds,
    setSelectedTextIds,
    arrowStart,
    setArrowStart,
    arrowMiddle,
    setArrowMiddle,
    arrowPreviewEnd,
    setArrowPreviewEnd,
    toolbarActive,
    setToolbarActive,
    settingsOpen,
    setSettingsOpen,
    xrayVisible,
    setXrayVisible,
    guideOrientation,
    setGuideOrientation,
  } = workspace;
  const textInspector = useTextInspector(portalTarget, toolMode, settingsOpen);
  const textDraftInputRef = useRef<HTMLElement | null>(null);
  const textDraftRef = useRef(textDraft);
  const committedTextEditorsRef = useRef(new WeakSet<HTMLElement>());
  const suppressTextCreateRef = useRef(false);
  textDraftRef.current = textDraft;
  const {
    highlightColor: settingsHighlightColor,
    setHighlightColor: setSettingsHighlightColor,
    guideColor: settingsGuideColor,
    setGuideColor: setSettingsGuideColor,
    arrowColor: settingsArrowColor,
    setArrowColor: setSettingsArrowColor,
    guideHighlightEnabled: settingsGuideHighlightEnabled,
    setGuideHighlightEnabled: setSettingsGuideHighlightEnabled,
    hoverHighlightEnabled: settingsHoverHighlight,
    setHoverHighlightEnabled: setSettingsHoverHighlight,
    layoutDetailsEnabled: settingsLayoutDetailsEnabled,
    setLayoutDetailsEnabled: setSettingsLayoutDetailsEnabled,
    persistOnReload: settingsPersistOnReload,
    setPersistOnReload: setSettingsPersistOnReload,
    colorPickerFormats: settingsColorFormats,
    setColorPickerFormats: setSettingsColorFormats,
    colorPickerClickFormat: settingsColorClickFormat,
    setColorPickerClickFormat: setSettingsColorClickFormat,
    guideStyle: settingsGuideStyle,
    setGuideStyle: setSettingsGuideStyle,
    rulerSettings: settingsRulerSettings,
    setRulerSettings: setSettingsRulerSettings,
    screenshotSettings: settingsScreenshot,
    setScreenshotSettings: setSettingsScreenshot,
    textStyle: settingsTextStyle,
    setTextStyle: setSettingsTextStyle,
    resetSettings,
    persistSettings,
    applyPersistedSettings,
  } = useMesurerSettings({
    activePersistence,
    persistedSettings,
    defaults: {
      highlightColor,
      guideColor,
      arrowColor,
      guideHighlightEnabled,
      hoverHighlightEnabled,
      layoutDetailsEnabled,
      persistOnReload,
      colorPickerFormats,
      colorPickerClickFormat,
      guideStyle: guideStyleDefault,
      rulerSettings: rulerSettingsDefault,
      textStyle: textStyleDefault,
      snapEnabled: snapEnabledDefault,
      snapGuidesEnabled: snapGuidesEnabledDefault,
      snapArrowsEnabled: snapArrowsEnabledDefault,
      arrowClickToPlace: arrowClickToPlaceDefault,
      selectNewGuideEnabled: selectNewGuideEnabledDefault,
      multiMeasureEnabled: multiMeasureEnabledDefault,
    },
    toggles: {
      snapEnabled,
      setSnapEnabled,
      snapGuidesEnabled,
      setSnapGuidesEnabled,
      snapArrowsEnabled,
      setSnapArrowsEnabled,
      arrowClickToPlace,
      setArrowClickToPlace,
      selectNewGuideEnabled,
      setSelectNewGuideEnabled,
      multiMeasureEnabled,
      setMultiMeasureEnabled,
    },
  });
  const { clearGuideDragHold, scheduleGuideDragHold } = useGuideDragHold(ownerWindow);
  const [guidePreview, setGuidePreview] = useState<{
    orientation: "vertical" | "horizontal";
    position: number;
  } | null>(null);
  const [scrollOffset, setScrollOffset] = useState({
    x: ownerWindow.scrollX,
    y: ownerWindow.scrollY,
  });

  useEffect(() => {
    const updateScrollOffset = () => {
      setScrollOffset({ x: ownerWindow.scrollX, y: ownerWindow.scrollY });
    };
    updateScrollOffset();
    ownerWindow.addEventListener("scroll", updateScrollOffset, true);
    ownerWindow.addEventListener("resize", updateScrollOffset);
    return () => {
      ownerWindow.removeEventListener("scroll", updateScrollOffset, true);
      ownerWindow.removeEventListener("resize", updateScrollOffset);
    };
  }, [ownerWindow]);

  enabledRef.current = enabled;
  xrayVisibleRef.current = xrayVisible;
  toolModeRef.current = toolMode;
  rulersVisibleRef.current = rulersVisible;
  guideOrientationRef.current = guideOrientation;
  measurementsRef.current = measurements;
  activeMeasurementRef.current = activeMeasurement;
  heldDistancesRef.current = heldDistances;
  guidesRef.current = guides;
  selectedGuideIdsRef.current = selectedGuideIds;
  arrowsRef.current = arrows;
  selectedArrowIdsRef.current = selectedArrowIds;
  penStrokesRef.current = penStrokes;
  selectedPenStrokeIdsRef.current = selectedPenStrokeIds;
  textAnnotationsRef.current = textAnnotations;

  const saveWorkspace = useCallback(() => {
    if (!settingsPersistOnReload) return;
    const workspace: MesurerStoredWorkspace = {
      enabled: enabledRef.current,
      xrayVisible: xrayVisibleRef.current,
      toolMode: toolModeRef.current,
      rulersVisible: rulersVisibleRef.current,
      guideOrientation: guideOrientationRef.current,
      guides: guidesRef.current,
      selectedGuideIds: selectedGuideIdsRef.current,
      arrows: arrowsRef.current,
      selectedArrowIds: selectedArrowIdsRef.current,
      penStrokes: penStrokesRef.current,
      textAnnotations: textAnnotationsRef.current,
      measurements: measurementsRef.current.map(stripMeasurement),
      activeMeasurement: activeMeasurementRef.current
        ? stripMeasurement(activeMeasurementRef.current)
        : null,
      heldDistances: heldDistancesRef.current.map(stripDistance),
    };
    activePersistence.saveWorkspace(workspace);
  }, [activePersistence, settingsPersistOnReload]);

  const persistState = useCallback(() => {
    if (!settingsPersistOnReload) return;
    if (workspacePersistTimeoutRef.current !== null) {
      ownerWindow.clearTimeout(workspacePersistTimeoutRef.current);
    }
    workspacePersistTimeoutRef.current = ownerWindow.setTimeout(() => {
      workspacePersistTimeoutRef.current = null;
      saveWorkspace();
    }, 250);
  }, [ownerWindow, saveWorkspace, settingsPersistOnReload]);

  const clearPersistedWorkspace = useCallback(() => {
    toolModeRef.current = "none";
    rulersVisibleRef.current = false;
    xrayVisibleRef.current = false;
    guideOrientationRef.current = "vertical";
    measurementsRef.current = [];
    activeMeasurementRef.current = null;
    heldDistancesRef.current = [];
    guidesRef.current = [];
    selectedGuideIdsRef.current = [];
    arrowsRef.current = [];
    selectedArrowIdsRef.current = [];
    textAnnotationsRef.current = [];
    penStrokesRef.current = [];
    selectedPenStrokeIdsRef.current = [];
    closeScreenshotRef.current();
    setEnabled(false);
    setToolMode("none");
    setRulersVisible(false);
    setXrayVisible(false);
    setGuideOrientation("vertical");
    setMeasurements([]);
    setActiveMeasurement(null);
    setSelectedMeasurement(null);
    setSelectedMeasurements([]);
    setHeldDistances([]);
    setGuides([]);
    setSelectedGuideIds([]);
    setArrows([]);
    setSelectedArrowIds([]);
    setTextAnnotations([]);
      setPenStrokes([]);
      setSelectedPenStrokeIds([]);
  }, [setActiveMeasurement, setArrows, setEnabled, setGuideOrientation, setGuides, setHeldDistances, setMeasurements, setRulersVisible, setSelectedArrowIds, setSelectedGuideIds, setSelectedMeasurement, setSelectedMeasurements, setSelectedPenStrokeIds, setTextAnnotations, setToolMode]);

  const clearWorkspace = useCallback(() => {
    clearPersistedWorkspace();
    activePersistence.clearWorkspace();
  }, [activePersistence, clearPersistedWorkspace]);

  const applyPersistedWorkspace = useCallback((workspace: MesurerStoredWorkspace) => {
    enabledRef.current = workspace.enabled;
    toolModeRef.current = workspace.toolMode;
    rulersVisibleRef.current = workspace.rulersVisible;
    xrayVisibleRef.current = workspace.xrayVisible;
    guideOrientationRef.current = workspace.guideOrientation;
    measurementsRef.current = workspace.measurements;
    activeMeasurementRef.current = workspace.activeMeasurement;
    heldDistancesRef.current = workspace.heldDistances;
    guidesRef.current = workspace.guides;
    selectedGuideIdsRef.current = workspace.selectedGuideIds;
    arrowsRef.current = workspace.arrows;
    selectedArrowIdsRef.current = workspace.selectedArrowIds;
    penStrokesRef.current = workspace.penStrokes;
    textAnnotationsRef.current = workspace.textAnnotations;
    if (!workspace.enabled) closeScreenshotRef.current();
    setEnabled(workspace.enabled);
    setToolMode(workspace.toolMode);
    setRulersVisible(workspace.rulersVisible);
    setXrayVisible(workspace.xrayVisible);
    setGuideOrientation(workspace.guideOrientation);
    setMeasurements(workspace.measurements);
    setActiveMeasurement(workspace.activeMeasurement);
    setGuides(workspace.guides);
    setSelectedGuideIds(workspace.selectedGuideIds);
    setArrows(workspace.arrows);
    setSelectedArrowIds(workspace.selectedArrowIds);
    setPenStrokes(workspace.penStrokes);
    setSelectedPenStrokeIds([]);
    setTextAnnotations(workspace.textAnnotations);
    setHeldDistances(workspace.heldDistances);
  }, [setActiveMeasurement, setArrows, setEnabled, setGuideOrientation, setGuides, setHeldDistances, setMeasurements, setRulersVisible, setSelectedArrowIds, setSelectedGuideIds, setTextAnnotations, setToolMode]);

  const applyPersistenceSnapshot = useCallback((
    snapshot: MesurerPersistenceSnapshot | null,
    source?: PersistenceChangeSource,
  ) => {
    if (!snapshot) return;

    applyingExternalPersistenceRef.current = true;
    const settings = sanitizeStoredSettings(ownerWindow, snapshot.settings);
    applyPersistedSettings(settings);

    const workspace = snapshot.workspace;
    if (source?.workspace !== false && workspace && (settings.persistOnReload ?? settingsPersistOnReload)) {
      applyPersistedWorkspace(workspace);
    }
    ownerWindow.setTimeout(() => {
      applyingExternalPersistenceRef.current = false;
    }, 0);
  }, [applyPersistedSettings, applyPersistedWorkspace, ownerWindow, settingsPersistOnReload]);

  usePersistenceLifecycle({
    ownerWindow,
    activePersistence,
    persistSettings,
    persistState,
    settingsPersistOnReload,
    saveWorkspace,
    applyPersistenceSnapshot,
    storedState,
    applyingExternalPersistenceRef,
    workspacePersistTimeoutRef,
  });

  const setEnabledPersisted = useCallback(
    (value: Parameters<typeof setEnabled>[0]) => {
      const next = typeof value === "function" ? value(enabledRef.current) : value;
      if (!next) closeScreenshotRef.current();
      return createPersistedSetter(enabledRef, setEnabled, persistState)(next);
    },
    [persistState, setEnabled],
  );

  const setRulersVisiblePersisted = useCallback(
    createPersistedSetter(rulersVisibleRef, setRulersVisible, persistState),
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
    createPersistedSetter(guideOrientationRef, setGuideOrientation, persistState),
    [persistState, setGuideOrientation],
  );

  const setMeasurementsPersisted = useCallback(
    createPersistedSetter(measurementsRef, setMeasurements, persistState),
    [persistState, setMeasurements],
  );

  const setActiveMeasurementPersisted = useCallback(
    createPersistedSetter(activeMeasurementRef, setActiveMeasurement, persistState),
    [persistState, setActiveMeasurement],
  );

  const setHeldDistancesPersisted = useCallback(
    createPersistedSetter(heldDistancesRef, setHeldDistances, persistState),
    [persistState, setHeldDistances],
  );

  const setGuidesPersisted = useCallback(
    createPersistedSetter(guidesRef, setGuides, persistState),
    [persistState, setGuides],
  );

  const setSelectedGuideIdsPersisted = useCallback(
    createPersistedSetter(selectedGuideIdsRef, setSelectedGuideIds, persistState),
    [persistState, setSelectedGuideIds],
  );

  const setArrowsPersisted = useCallback(
    createPersistedSetter(arrowsRef, setArrows, persistState),
    [persistState, setArrows],
  );

  const setSelectedArrowIdsPersisted = useCallback(
    createPersistedSetter(selectedArrowIdsRef, setSelectedArrowIds, persistState),
    [persistState, setSelectedArrowIds],
  );

  const setTextAnnotationsPersisted = useCallback(
    createPersistedSetter(textAnnotationsRef, setTextAnnotations, persistState),
    [persistState, setTextAnnotations],
  );

  const setPenStrokesPersisted = useCallback(
    createPersistedSetter(penStrokesRef, setPenStrokes, persistState),
    [persistState, setPenStrokes],
  );

  const {
    recordSnapshot,
    createActionCommit,
    setToolModeWithHistory,
    setGuideOrientationWithHistory,
    setEnabledWithHistory,
    undo: undoHistory,
    redo: redoHistory,
  } = useMesurerHistory({
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
    arrows: {
      arrows,
      setArrows: setArrowsPersisted,
      selectedArrowIds,
      setSelectedArrowIds: setSelectedArrowIdsPersisted,
    },
    text: {
      textAnnotations,
      setTextAnnotations: setTextAnnotationsPersisted,
    },
    pen: {
      penStrokes,
      setPenStrokes: setPenStrokesPersisted,
      selectedPenStrokeIds,
      setSelectedPenStrokeIds,
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
    setArrowsPersisted([]);
    setSelectedArrowIdsPersisted([]);
    setTextAnnotationsPersisted([]);
    setSelectedTextIds([]);
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
    setArrowsPersisted,
    setSelectedArrowIdsPersisted,
    setTextAnnotationsPersisted,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedTextIds,
    setStart,
    textInspector,
    toolMode,
  ]);

  const clearTransientState = useCallback(() => {
    cancelArrowInteractionRef.current();
    cancelPenInteractionRef.current();
    clearGuideDragHold();
    setStart(null);
    setEnd(null);
    setIsDragging(false);
    clearSelectionRect();
    setHoverRect(null);
    setHoverPointer(null);
    setHoverElement(null);
    setArrowStart(null);
    setArrowMiddle(null);
    setArrowPreviewEnd(null);
    if (textDraftRef.current) {
      textDraftRef.current = null;
      setTextDraft(null);
    }
  }, [
    clearGuideDragHold,
    clearSelectionRect,
    setArrowMiddle,
    setArrowPreviewEnd,
    setArrowStart,
    setEnd,
    setHoverElement,
    setHoverPointer,
    setHoverRect,
    setIsDragging,
    setStart,
    setTextDraft,
  ]);

  const hasTransientInteraction = useCallback(
    () =>
      Boolean(
        arrowStart ||
        textDraft ||
        isDragging ||
        start ||
        draggingGuideId ||
        hasArrowInteractionRef.current() ||
        hasPenInteractionRef.current(),
      ),
    [arrowStart, draggingGuideId, isDragging, start, textDraft],
  );

  const isActiveToolMode = useCallback(
    () =>
      (toolMode !== "none" && toolMode !== "selection") ||
      xrayVisible ||
      rulersVisible,
    [rulersVisible, toolMode, xrayVisible],
  );

  const hasSelection = useCallback(
    () =>
      selectedGuideIds.length > 0 ||
      selectedArrowIds.length > 0 ||
      selectedTextIds.length > 0 ||
      selectedPenStrokeIds.length > 0 ||
      selectedMeasurements.length > 0 ||
      Boolean(selectedElement) ||
      Boolean(selectedMeasurement),
    [
      selectedArrowIds.length,
      selectedElement,
      selectedGuideIds.length,
      selectedMeasurement,
      selectedMeasurements.length,
      selectedTextIds.length,
      selectedPenStrokeIds.length,
    ],
  );

  const clearSelection = useCallback(() => {
    setSelectedGuideIdsPersisted([]);
    setSelectedArrowIdsPersisted([]);
    setSelectedTextIds([]);
    setSelectedPenStrokeIds([]);
    setSelectedMeasurements([]);
    setSelectedMeasurement(null);
    setSelectedElement(null);
    clearSelectionRect();
    setStart(null);
    setEnd(null);
    setIsDragging(false);
  }, [
    clearSelectionRect,
    setEnd,
    setIsDragging,
    setSelectedArrowIdsPersisted,
    setSelectedElement,
    setSelectedGuideIdsPersisted,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedTextIds,
    setSelectedPenStrokeIds,
    setStart,
  ]);

  useEffect(() => {
    if (!enabled || toolMode !== "selection") return;
    const gesture = { pointerId: -1, x: 0, y: 0, moved: false };
    const isInside = (x: number, y: number, rect: { left: number; top: number; width: number; height: number }) =>
      x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
    const isAnnotationAt = (x: number, y: number) => {
      if (textAnnotations.some((item) => {
        const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${item.id}"]`);
        return node instanceof HTMLElement && isInside(x, y, node.getBoundingClientRect());
      })) return true;
      if (penStrokes.some((stroke) => {
        const bounds = transformedPenBounds(stroke);
        return isInside(x, y, { left: bounds.x - scrollOffset.x, top: bounds.y - scrollOffset.y, width: bounds.width, height: bounds.height });
      })) return true;
      return arrows.some((arrow) => {
        const bounds = transformedArrowBounds(arrow);
        return isInside(x, y, { left: bounds.x - scrollOffset.x, top: bounds.y - scrollOffset.y, width: bounds.width, height: bounds.height });
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      gesture.pointerId = event.pointerId;
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      gesture.moved = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId) return;
      gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== gesture.pointerId || gesture.moved) return;
      const target = event.target;
      if (target instanceof Node && toolbarRef.current?.contains(target)) return;
      if (!isAnnotationAt(event.clientX, event.clientY)) clearSelection();
    };
    ownerDocument.addEventListener("pointerdown", onPointerDown);
    ownerDocument.addEventListener("pointermove", onPointerMove);
    ownerDocument.addEventListener("pointerup", onPointerUp);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown);
      ownerDocument.removeEventListener("pointermove", onPointerMove);
      ownerDocument.removeEventListener("pointerup", onPointerUp);
    };
  }, [arrows, clearSelection, enabled, ownerDocument, overlayRef, penStrokes, scrollOffset.x, scrollOffset.y, textAnnotations, toolbarRef, toolMode]);

  const exitActiveTool = useCallback(() => {
    clearTransientState();
    clearSelection();
    setXrayVisible(false);
    setToolModePersisted("selection");
  }, [clearSelection, clearTransientState, setToolModePersisted, setXrayVisible]);

  const exitMesurerCompletely = useCallback(() => {
    clearTransientState();
    clearSelection();
    closeColorPickerRef.current();
    closeScreenshotRef.current();
    setXrayVisible(false);
    setRulersVisiblePersisted(false);
    setToolModePersisted("none");
  }, [
    clearSelection,
    clearTransientState,
    setRulersVisiblePersisted,
    setToolModePersisted,
    setXrayVisible,
  ]);


  const removeSelected = useCallback(() => {
    const hasGuides = selectedGuideIds.length > 0;
    const hasArrows = selectedArrowIds.length > 0;
    const hasText = selectedTextIds.length > 0;
    const hasPen = selectedPenStrokeIds.length > 0;
    if (!hasGuides && !hasArrows && !hasText && !hasPen) return false;
    recordSnapshot();
    if (hasGuides) {
      setGuidesPersisted((prev) =>
        prev.filter((guide) => !selectedGuideIds.includes(guide.id)),
      );
      setSelectedGuideIdsPersisted([]);
    }
    if (hasArrows) {
      setArrowsPersisted((previous) =>
        previous.filter((arrow) => !selectedArrowIds.includes(arrow.id)),
      );
      setSelectedArrowIdsPersisted([]);
    }
    if (hasText) {
      setTextAnnotationsPersisted((previous) =>
        previous.filter((item) => !selectedTextIds.includes(item.id)),
      );
      setSelectedTextIds([]);
    }
    if (hasPen) {
      setPenStrokesPersisted((previous) => previous.filter((stroke) => !selectedPenStrokeIds.includes(stroke.id)));
      setSelectedPenStrokeIds([]);
    }
    return true;
  }, [
    recordSnapshot,
    selectedArrowIds,
    selectedGuideIds,
    selectedTextIds,
    selectedPenStrokeIds,
    setArrowsPersisted,
    setGuidesPersisted,
    setSelectedArrowIdsPersisted,
    setSelectedGuideIdsPersisted,
    setSelectedTextIds,
    setTextAnnotationsPersisted,
    setPenStrokesPersisted,
    setSelectedPenStrokeIds,
  ]);

  const selectAllAnnotations = useCallback(() => {
    if (toolMode !== "selection") return false;
    recordSnapshot();
    setSelectedGuideIdsPersisted(guides.map((guide) => guide.id));
    setSelectedArrowIdsPersisted(arrows.map((arrow) => arrow.id));
    setSelectedTextIds(textAnnotations.map((item) => item.id));
    setSelectedPenStrokeIds(penStrokes.map((stroke) => stroke.id));
    setSelectedMeasurements([]);
    setSelectedMeasurement(null);
    setSelectedElement(null);
    clearSelectionRect();
    ownerDocument.defaultView?.getSelection()?.removeAllRanges();
    return true;
  }, [arrows, clearSelectionRect, guides, ownerDocument, penStrokes, recordSnapshot, setSelectedArrowIdsPersisted, setSelectedGuideIdsPersisted, setSelectedMeasurement, setSelectedMeasurements, setSelectedPenStrokeIds, setSelectedTextIds, textAnnotations, toolMode]);

  const groupBounds = useMemo(() => {
    if (toolMode !== "selection") return null;
    const renderedTextBounds = (id: string) => {
      const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${id}"]`);
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.left + scrollOffset.x, y: rect.top + scrollOffset.y, width: rect.width, height: rect.height };
    };
    const rects = [
      ...arrows.filter((item) => selectedArrowIds.includes(item.id)).map((item) => transformedArrowBounds(item)),
      ...penStrokes.filter((item) => selectedPenStrokeIds.includes(item.id)).map((item) => transformedPenBounds(item)),
      ...textAnnotations.filter((item) => selectedTextIds.includes(item.id)).map((item) => renderedTextBounds(item.id) ?? textAnnotationBounds(item)),
    ];
    if (rects.length < 2) return null;
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    return { left, top, width: right - left, height: bottom - top };
  }, [arrows, penStrokes, scrollOffset.x, scrollOffset.y, selectedArrowIds, selectedPenStrokeIds, selectedTextIds, textAnnotations, toolMode]);

  const groupRotateSnapshotRef = useRef<GroupRotateSnapshot | null>(null);
  const groupResizeSnapshotRef = useRef<GroupResizeSnapshot | null>(null);
  const groupSelectionKeyRef = useRef("");
  const [groupRotateFrame, setGroupRotateFrame] = useState<{
    rect: { left: number; top: number; width: number; height: number };
    rotation: number;
  } | null>(null);

  useEffect(() => {
    const key = [selectedArrowIds, selectedPenStrokeIds, selectedTextIds]
      .map((ids) => [...ids].sort().join(","))
      .join("|");
    if (groupSelectionKeyRef.current && groupSelectionKeyRef.current !== key && !groupRotateSnapshotRef.current && !groupResizeSnapshotRef.current) {
      setGroupRotateFrame(null);
    }
    groupSelectionKeyRef.current = key;
  }, [selectedArrowIds, selectedPenStrokeIds, selectedTextIds]);

  const moveSelectedAnnotations = useCallback((dx: number, dy: number) => {
    setGroupRotateFrame((frame) => frame ? { ...frame, rect: { ...frame.rect, left: frame.rect.left + dx, top: frame.rect.top + dy } } : frame);
    setGuidesPersisted((previous) => previous.map((guide) => selectedGuideIds.includes(guide.id)
      ? { ...guide, position: guide.position + (guide.orientation === "vertical" ? dx : dy) }
      : guide));
    setArrowsPersisted((previous) => previous.map((arrow) => selectedArrowIds.includes(arrow.id)
      ? { ...arrow, start: { x: arrow.start.x + dx, y: arrow.start.y + dy }, end: { x: arrow.end.x + dx, y: arrow.end.y + dy }, control: arrow.control ? { x: arrow.control.x + dx, y: arrow.control.y + dy } : undefined }
      : arrow));
    setTextAnnotationsPersisted((previous) => previous.map((item) => selectedTextIds.includes(item.id)
      ? { ...item, x: item.x + dx, y: item.y + dy }
      : item));
    setPenStrokesPersisted((previous) => previous.map((stroke) => selectedPenStrokeIds.includes(stroke.id)
      ? { ...stroke, points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
      : stroke));
  }, [selectedArrowIds, selectedGuideIds, selectedPenStrokeIds, selectedTextIds, setArrowsPersisted, setGuidesPersisted, setPenStrokesPersisted, setTextAnnotationsPersisted]);

  const startGroupRotate = useCallback((center: { x: number; y: number }, startAngle: number, rect: { left: number; top: number; width: number; height: number }) => {
    const selectedTexts = textAnnotations.filter((item) => selectedTextIds.includes(item.id));
    recordSnapshot();
    groupRotateSnapshotRef.current = {
      center,
      startAngle,
      rect,
      arrows: arrows.filter((item) => selectedArrowIds.includes(item.id)),
      penStrokes: penStrokes.filter((item) => selectedPenStrokeIds.includes(item.id)),
      texts: selectedTexts.map((item) => {
        const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${item.id}"]`);
        const bounds = node instanceof HTMLElement
          ? { x: item.x, y: item.y, width: node.offsetWidth, height: node.offsetHeight }
          : textAnnotationBounds(item);
        return { item, bounds };
      }),
      initialRotation: groupRotateFrame?.rotation ?? 0,
    };
    setGroupRotateFrame({ rect, rotation: groupRotateFrame?.rotation ?? 0 });
  }, [
    arrows,
    groupBounds,
    groupRotateFrame,
    penStrokes,
    recordSnapshot,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
    textAnnotations,
  ]);

  const updateGroupRotate = useCallback((pointerAngle: number) => {
    const snapshot = groupRotateSnapshotRef.current;
    if (!snapshot) return;
    const rotated = applyGroupRotation(snapshot, pointerAngle);
    setGroupRotateFrame({ rect: snapshot.rect, rotation: (snapshot.initialRotation ?? 0) + rotated.degrees });
    setArrowsPersisted((previous) =>
      previous.map((arrow) => rotated.arrows.get(arrow.id) ?? arrow),
    );
    setPenStrokesPersisted((previous) =>
      previous.map((stroke) => rotated.penStrokes.get(stroke.id) ?? stroke),
    );
    setTextAnnotationsPersisted((previous) =>
      previous.map((item) => rotated.texts.get(item.id) ?? item),
    );
  }, [setArrowsPersisted, setPenStrokesPersisted, setTextAnnotationsPersisted]);

  const endGroupRotate = useCallback(() => {
    groupRotateSnapshotRef.current = null;
  }, []);

  const startGroupResize = useCallback((handle: ResizeHandle, rect: { left: number; top: number; width: number; height: number }, rotation: number) => {
    const selectedTexts = textAnnotations.filter((item) => selectedTextIds.includes(item.id));
    groupResizeSnapshotRef.current = {
      rect,
      rotation,
      arrows: arrows.filter((item) => selectedArrowIds.includes(item.id)),
      penStrokes: penStrokes.filter((item) => selectedPenStrokeIds.includes(item.id)),
      texts: selectedTexts.map((item) => {
        const node = overlayRef.current?.querySelector(`[data-mesurer-text-id="${item.id}"]`);
        const bounds = node instanceof HTMLElement
          ? { x: item.x, y: item.y, width: node.offsetWidth, height: node.offsetHeight }
          : textAnnotationBounds(item);
        return { item, bounds };
      }),
    };
    recordSnapshot();
  }, [arrows, penStrokes, recordSnapshot, selectedArrowIds, selectedPenStrokeIds, selectedTextIds, textAnnotations]);

  const resizeSelectedAnnotations = useCallback((handle: ResizeHandle, event: ReactPointerEvent<HTMLElement>) => {
    const snapshot = groupResizeSnapshotRef.current;
    if (!snapshot) return;
    const pointer = { x: event.clientX + scrollOffset.x, y: event.clientY + scrollOffset.y };
    const resized = applyGroupResize(snapshot, handle, pointer);
    setGroupRotateFrame((frame) => frame ? { ...frame, rect: resized.rect } : frame);
    setArrowsPersisted((previous) => previous.map((arrow) => resized.arrows.get(arrow.id) ?? arrow));
    setPenStrokesPersisted((previous) => previous.map((stroke) => resized.penStrokes.get(stroke.id) ?? stroke));
    setTextAnnotationsPersisted((previous) => previous.map((item) => resized.texts.get(item.id) ?? item));
  }, [scrollOffset.x, scrollOffset.y, setArrowsPersisted, setPenStrokesPersisted, setTextAnnotationsPersisted]);

  const endGroupResize = useCallback(() => {
    groupResizeSnapshotRef.current = null;
  }, []);

  const colorPicker = useColorPicker({
    ownerWindow,
    clickFormat: settingsColorClickFormat,
    setEnabled: (value) => setEnabledWithHistory(value),
    setToolModeNone: () => setToolModeWithHistory("none"),
  });

  const screenshot = useScreenshot({
    ownerDocument,
    ownerWindow,
    overlayRef,
    captureVisibleTab,
    settings: settingsScreenshot,
    setEnabled: (value) => setEnabledWithHistory(value),
    setToolbarActive,
    onPrepare: () => {
      colorPicker.setActive(false);
      setSettingsOpen(false);
    },
  });
  closeScreenshotRef.current = screenshot.closeUi;
  closeColorPickerRef.current = () => colorPicker.setActive(false);

  const openColorPicker = useCallback(() => {
    screenshot.closeUi();
    void colorPicker.open();
  }, [colorPicker.open, screenshot.closeUi]);

  const [settingsFocus, setSettingsFocus] = useState<SettingsFocusSection | undefined>();

  const toggleSettings = useCallback(() => {
    if (settingsOpen) {
      screenshot.closeUi();
      setSettingsOpen(false);
      return;
    }
    setSettingsFocus(
      settingsFocusSection(toolMode, {
        colorPicker: colorPicker.active,
        screenshot: screenshot.active,
        rulersVisible,
      }),
    );
    screenshot.closeUi();
    setSettingsOpen(true);
  }, [
    colorPicker.active,
    rulersVisible,
    screenshot.active,
    screenshot.closeUi,
    settingsOpen,
    toolMode,
  ]);

  useHotkeys({
    eventTarget: ownerWindow,
    clearTransientState,
    hasTransientInteraction,
    isActiveToolMode,
    hasSelection,
    clearSelection,
    exitActiveTool,
    exitMesurerCompletely,
    undo,
    redo,
    removeSelected,
    selectAllAnnotations,
    setEnabled: setEnabledWithHistory,
    setToolMode: setToolModeWithHistory,
    setRulersVisible: setRulersVisiblePersisted,
    setAltPressed,
    isOverlayActive: () => enabled && (toolMode !== "none" || toolbarActive),
    setGuideOrientation: setGuideOrientationWithHistory,
    onInteract: () => setToolbarActive(true),
    onColorPicker: openColorPicker,
    onScreenshot: screenshot.toggleSelection,
    onCloseScreenshot: screenshot.closeUi,
    isScreenshotActive: () => screenshot.active || Boolean(screenshot.previewUrl),
    onToggleXray: () => setXrayVisible((previous) => !previous),
    onToggleSettings: toggleSettings,
    isSettingsOpen: () => settingsOpen,
    onCloseColorPicker: () => colorPicker.setActive(false),
    isColorPickerActive: () => colorPicker.active,
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

  useLiveElementTracking({
    document: ownerDocument,
    window: ownerWindow,
    enabled,
    selectionEnabled: toolMode === "select",
    selectedElementRef,
    hoverElementRef,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setHoverRect,
    setMeasurements: setMeasurementsPersisted,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setHeldDistances: setHeldDistancesPersisted,
  });

  useXray(ownerDocument, xrayVisible);
  useGuideWindowEvents({
    ownerDocument,
    ownerWindow,
    enabled,
    settingsOpen,
    toolMode,
    toolbarActive,
    snapGuidesEnabled,
    guides,
    toolbarRef,
    overlayRef,
    createActionCommit,
    setGuides: setGuidesPersisted,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setToolbarActive,
  });

  const selectionToolRef = useRef(toolMode);

  if (selectionToolRef.current !== toolMode) {
    selectionToolRef.current = toolMode;
    if (toolMode !== "select") {
      setSelectedElement(null);
      setHoverElement(null);
      setHoverRect(null);
      setHoverPointer(null);
      setSelectedMeasurement(null);
      setSelectedMeasurements([]);
      clearSelectionRect();
      setSelectedPenStrokeIds([]);
    }
  }

  useSelectionAnimationCleanup({
    ownerWindow,
    selectionOriginRect,
    selectedMeasurement,
    selectedMeasurements,
    setSelectionOriginRect,
    setSelectedMeasurement,
    setSelectedMeasurements,
  });

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
    guidePreviewEmphasized,
    hoverRectToShow,
    selectedEdgeVisibility,
    hoverEdgeVisibility,
    measurementEdgeVisibility,
  } = useMesurerDerived({
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
    hoverHighlightEnabled: settingsHoverHighlight,
    guideHighlightEnabled: settingsGuideHighlightEnabled,
    highlightColor: settingsHighlightColor,
    guideColor: settingsGuideColor,
  });

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  } = useMesurerPointer({
    document: ownerDocument,
    window: ownerWindow,
    toolbarRef,
    overlayRef,
    selectionRectRef,
    createActionCommit,
    clearGuideDragHold,
    scheduleGuideDragHold,
    enabled,
    settingsOpen,
    toolMode,
    guidesEnabled,
    snapEnabled,
    snapGuidesEnabled,
    selectNewGuideEnabled,
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
    selectionMode: toolMode === "selection",
    scrollOffset,
    textAnnotations,
    arrows,
    penStrokes,
    setSelectedTextIds,
    setSelectedArrowIds: setSelectedArrowIdsPersisted,
    setSelectedPenStrokeIds,
  });

  const arrowsPointer = useArrowsPointer({
    enabled,
    settingsOpen,
    snapArrowsEnabled,
    arrowClickToPlace,
    color: settingsArrowColor,
    width: Math.max(settingsGuideStyle.width, 1),
    overlayRef,
    ownerDocument,
    guides,
    createActionCommit,
    setArrows: setArrowsPersisted,
    onMove: (id, dx, dy) => moveSelectedAnnotations(dx, dy),
    setSelectedArrowIds: setSelectedArrowIdsPersisted,
    clearOtherSelections: () => {
      setSelectedGuideIdsPersisted([]);
      setSelectedTextIds([]);
      setSelectedPenStrokeIds([]);
      setSelectedMeasurements([]);
      setSelectedMeasurement(null);
      setSelectedElement(null);
      clearSelectionRect();
      ownerDocument.defaultView?.getSelection()?.removeAllRanges();
    },
    setToolMode: setToolModePersisted,
    arrows,
    selectedArrowIds,
    arrowStart,
    arrowMiddle,
    arrowPreviewEnd,
    setArrowStart,
    setArrowMiddle,
    setArrowPreviewEnd,
    scrollOffset,
  });
  cancelArrowInteractionRef.current = arrowsPointer.cancelInteraction;
  hasArrowInteractionRef.current = arrowsPointer.hasActiveInteraction;

  const penPointer = usePenPointer({
    enabled,
    settingsOpen,
    toolMode,
    color: settingsArrowColor,
    scrollOffset,
    createActionCommit,
    setPenStrokes: setPenStrokesPersisted,
    setPenPreview,
  });
  cancelPenInteractionRef.current = penPointer.cancelInteraction;
  hasPenInteractionRef.current = penPointer.hasActiveInteraction;

  const selectPenStroke = useCallback((id: string, additive = false) => {
    if (additive) {
      setSelectedPenStrokeIds((previous) => previous.includes(id)
        ? previous.filter((selectedId) => selectedId !== id)
        : [...previous, id]);
      return;
    }
    if (!selectedPenStrokeIds.includes(id)) {
      setSelectedGuideIdsPersisted([]);
      setSelectedArrowIdsPersisted([]);
      setSelectedTextIds([]);
      setSelectedMeasurements([]);
      setSelectedMeasurement(null);
      setSelectedElement(null);
      clearSelectionRect();
      setSelectedPenStrokeIds([id]);
    }
  }, [clearSelectionRect, selectedPenStrokeIds, setSelectedArrowIdsPersisted, setSelectedElement, setSelectedGuideIdsPersisted, setSelectedMeasurement, setSelectedMeasurements, setSelectedPenStrokeIds, setSelectedTextIds]);

  const changePenStroke = useCallback((next: import("./core/types").PenStroke) => {
    setPenStrokesPersisted((previous) => previous.map((stroke) => stroke.id === next.id ? next : stroke));
  }, [setPenStrokesPersisted]);

  const finishTextDraft = useCallback((selectAfterCommit = false) => {
    const draft = textDraftRef.current;
    if (!draft) return;
    const editor = textDraftInputRef.current;
    if (editor && committedTextEditorsRef.current.has(editor)) return;
    const value = readEditableText(editor);
    textDraftRef.current = null;
    if (editor) committedTextEditorsRef.current.add(editor);
    setTextDraft(null);
    suppressTextCreateRef.current = true;
    queueMicrotask(() => {
      suppressTextCreateRef.current = false;
    });
    if (value.trim()) {
      recordSnapshot();
      const id = draft.id ?? createId();
      if (draft.id) {
        setTextAnnotationsPersisted((previous) => previous.map((item) =>
          item.id === draft.id ? { ...item, text: value } : item,
        ));
      } else {
        setTextAnnotationsPersisted((previous) => [
          ...previous,
          { id, x: draft.x, y: draft.y, text: value },
        ]);
      }
      setSelectedTextIds(selectAfterCommit ? [id] : []);
    }
  }, [recordSnapshot, setSelectedTextIds, setTextAnnotationsPersisted, setTextDraft]);

  const activateTextEditor = useCallback((element: HTMLElement) => {
    committedTextEditorsRef.current.delete(element);
  }, []);

  const selectTextAnnotation = useCallback((id: string, additive = false) => {
    if (textDraftRef.current) finishTextDraft();
    if (additive) {
      setSelectedTextIds((previous) => previous.includes(id)
        ? previous.filter((selectedId) => selectedId !== id)
        : [...previous, id]);
      return;
    }
    if (!selectedTextIds.includes(id)) {
      setSelectedGuideIdsPersisted([]);
      setSelectedArrowIdsPersisted([]);
      setSelectedPenStrokeIds([]);
      setSelectedMeasurements([]);
      setSelectedMeasurement(null);
      setSelectedElement(null);
      clearSelectionRect();
      setSelectedTextIds([id]);
    }
  }, [clearSelectionRect, finishTextDraft, selectedTextIds, setSelectedArrowIdsPersisted, setSelectedElement, setSelectedGuideIdsPersisted, setSelectedMeasurement, setSelectedMeasurements, setSelectedPenStrokeIds, setSelectedTextIds]);

  const moveTextAnnotation = useCallback((id: string, x: number, y: number) => {
    const item = textAnnotations.find((candidate) => candidate.id === id);
    if (!item) return;
    moveSelectedAnnotations(x - item.x, y - item.y);
  }, [moveSelectedAnnotations, textAnnotations]);

  const transformTextAnnotation = useCallback((
    id: string,
    next: { x: number; y: number; scale?: number; rotation?: number; boxWidth?: number },
  ) => {
    setTextAnnotationsPersisted((previous) => previous.map((item) =>
      item.id === id ? { ...item, ...next } : item,
    ));
  }, [setTextAnnotationsPersisted]);

  const editTextAnnotation = useCallback((id: string, caretX: number, caretY: number) => {
    if (textDraftRef.current?.id === id) return;
    if (textDraftRef.current) finishTextDraft();
    const item = textAnnotations.find((annotation) => annotation.id === id);
    if (!item) return;
    setSelectedTextIds([]);
    const next = {
      id,
      x: item.x,
      y: item.y,
      caretX,
      caretY,
    };
    textDraftRef.current = next;
    setTextDraft(next);
  }, [finishTextDraft, setSelectedTextIds, setTextDraft, textAnnotations]);

  const handleTextPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const suppressCreate = suppressTextCreateRef.current;
    suppressTextCreateRef.current = false;
    if (textDraftRef.current) {
      finishTextDraft();
      return;
    }
    if (suppressCreate) return;
    setSelectedTextIds([]);
    const next = { key: createId(), x: event.clientX + scrollOffset.x, y: event.clientY + scrollOffset.y };
    textDraftRef.current = next;
    setTextDraft(next);
  }, [finishTextDraft, scrollOffset.x, scrollOffset.y, setSelectedTextIds, setTextDraft]);

  const handleTextKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      finishTextDraft();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishTextDraft(textDraftRef.current ? !textDraftRef.current.id : false);
      setToolModePersisted("selection");
    }
  }, [finishTextDraft, setToolModePersisted]);

  const removeHeldDistance = useCallback(
    (id: string) => {
      recordSnapshot();
      setHeldDistancesPersisted((prev) =>
        prev.filter((distance) => distance.id !== id),
      );
    },
    [recordSnapshot, setHeldDistancesPersisted],
  );

  const {
    startGuideFromRuler,
    moveGuideFromRuler,
    finishGuideFromRuler,
    cancelGuideFromRuler,
    handleGuidePointerDown,
    handleGuidePointerUp,
    overlayGuides,
  } = useRulerGuides({
    ownerDocument,
    ownerWindow,
    overlayRef,
    enabled,
    snapGuidesEnabled,
    selectNewGuideEnabled,
    settingsOpen,
    guides,
    createActionCommit,
    setGuides: setGuidesPersisted,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setDraggingGuideId,
    scheduleGuideDragHold,
    clearGuideDragHold,
  });

  const overlayInteractive = enabled && !settingsOpen;
  const pointerHandlers = toolMode === "arrows"
    ? {
        onPointerDown: arrowsPointer.handlePointerDown,
        onPointerMove: arrowsPointer.handlePointerMove,
        onPointerUp: arrowsPointer.handlePointerUp,
        onPointerLeave: arrowsPointer.handlePointerLeave,
        onPointerCancel: arrowsPointer.handlePointerCancel,
      }
      : toolMode === "pen"
        ? {
            onPointerDown: penPointer.handlePointerDown,
            onPointerMove: penPointer.handlePointerMove,
            onPointerUp: penPointer.handlePointerUp,
            onPointerLeave: penPointer.handlePointerLeave,
            onPointerCancel: penPointer.handlePointerCancel,
          }
      : toolMode === "text"
        ? {
            onPointerDown: handleTextPointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerLeave: handlePointerLeave,
            onPointerCancel: handlePointerUp,
          }
        : {
        onPointerDown: toolMode === "selection"
          ? (event: ReactPointerEvent<HTMLDivElement>) => {
              if (event.target instanceof Element && event.target.closest("[data-mesurer-group-frame]")) return
              if (!arrowsPointer.handleSelectionPointerDown(event)) handlePointerDown(event)
            }
          : handlePointerDown,
        onPointerMove: toolMode === "selection"
          ? (event: ReactPointerEvent<HTMLDivElement>) => {
              if (event.target instanceof Element && event.target.closest("[data-mesurer-group-frame]")) return
              if (!arrowsPointer.handleSelectionPointerMove(event)) handlePointerMove(event)
            }
          : handlePointerMove,
        onPointerUp: toolMode === "selection"
          ? (event: ReactPointerEvent<HTMLDivElement>) => {
              if (event.target instanceof Element && event.target.closest("[data-mesurer-group-frame]")) return
              if (!arrowsPointer.handleSelectionPointerUp(event)) handlePointerUp(event)
            }
          : handlePointerUp,
        onPointerLeave: handlePointerLeave,
        onPointerCancel: toolMode === "selection"
          ? (event: ReactPointerEvent<HTMLDivElement>) => {
              if (event.target instanceof Element && event.target.closest("[data-mesurer-group-frame]")) return
              if (!arrowsPointer.handleSelectionPointerUp(event)) handlePointerUp(event)
            }
          : handlePointerUp,
      };

  return (
    <MesurerPortal
      portalTarget={portalTarget}
      rootRef={overlayRef}
      toolbarRef={toolbarRef}
      screenshotOverlayRef={screenshot.overlayRef}
      rulers={{
        ownerWindow,
        visible: enabled && rulersVisible,
        settings: settingsRulerSettings,
        interactive: !settingsOpen,
        forceVisible: settingsOpen,
        onStartGuide: startGuideFromRuler,
        onMoveGuide: moveGuideFromRuler,
        onFinishGuide: finishGuideFromRuler,
        onCancelGuide: cancelGuideFromRuler,
        guides,
        selectedGuideIds,
      }}
      overlay={{
        enabled,
        interactive: overlayInteractive,
        toolMode,
        guidesEnabled,
        altPressed,
        isDragging,
        marqueeRect: isDragging && start && end ? getRectFromPoints(start, end) : null,
        groupBounds: selectedArrowIds.length + selectedTextIds.length + selectedPenStrokeIds.length > 1
          ? groupRotateFrame?.rect ?? groupBounds
          : null,
        groupFrameRotation: selectedArrowIds.length + selectedTextIds.length + selectedPenStrokeIds.length > 1
          ? groupRotateFrame?.rotation ?? 0
          : 0,
         selectionCount: selectedGuideIds.length + selectedArrowIds.length + selectedTextIds.length + selectedPenStrokeIds.length,
         onResizeSelection: resizeSelectedAnnotations,
         onMoveSelection: moveSelectedAnnotations,
         onMoveSelectionStart: recordSnapshot,
        onStartGroupResize: startGroupResize,
        onEndGroupResize: endGroupResize,
        onStartGroupRotate: startGroupRotate,
        onUpdateGroupRotate: updateGroupRotate,
        onEndGroupRotate: endGroupRotate,
        fillColor,
        outlineColor,
        layoutDetailsEnabled: settingsLayoutDetailsEnabled,
        pointers: {
          ...pointerHandlers,
        },
        selection: {
          measurements: displayedMeasurements,
          measurementEdges: measurementEdgeVisibility,
          activeRect,
          activeWidth,
          activeHeight,
          hoverRect: hoverRectToShow,
          hoverEdges: hoverEdgeVisibility,
          selected: displayedSelectedMeasurements,
          selectedEdges: selectedEdgeVisibility,
        },
        distances: {
          held: heldDistances,
          optionPair: optionPairOverlay,
          guideDistance: guideDistanceOverlay,
          containerLines: optionContainerLines,
          onRemoveHeld: removeHeldDistance,
        },
        guides: {
          items: overlayGuides,
          selectedIds: selectedGuideIds,
          hover: hoverGuide,
          draggingId: draggingGuideId,
          style: settingsGuideStyle,
          pointerEvents: overlayInteractive && (toolMode !== "none" || rulersVisible),
          colors: {
            active: guideColorActive,
            hover: guideColorHover,
            default: guideColorDefault,
            preview: guideColorPreview,
            previewEmphasized: guidePreviewEmphasized,
          },
          preview: guidePreview,
          onPointerDown: handleGuidePointerDown,
          onPointerUp: handleGuidePointerUp,
          onPointerCancel: handleGuidePointerUp,
        },
        arrows: {
          items: arrows,
          selectedIds: selectedArrowIds,
          preview: arrowsPointer.preview,
          scrollOffset,
          color: settingsArrowColor,
          onSelect: (id) => setSelectedArrowIdsPersisted([id]),
          onChange: (arrow) => setArrowsPersisted((previous) => previous.map((item) => item.id === arrow.id ? arrow : item)),
          onChangeStart: recordSnapshot,
          editingArrowId: arrowsPointer.editingArrowId,
        },
        pen: {
          strokes: penStrokes,
          preview: penPreview,
          scrollOffset,
          selectionMode: toolMode === "selection",
          selectedIds: selectedPenStrokeIds,
          onSelect: selectPenStroke,
          onChange: changePenStroke,
          onChangeStart: recordSnapshot,
          onMove: (id, dx, dy) => moveSelectedAnnotations(dx, dy),
        },
        text: {
          items: textAnnotations,
          draft: textDraft,
          draftInputRef: textDraftInputRef,
          interactive: toolMode === "selection",
          editable: toolMode === "text",
          selectedIds: selectedTextIds,
          onSelect: selectTextAnnotation,
          onMoveStart: recordSnapshot,
          onMove: moveTextAnnotation,
          onTransform: transformTextAnnotation,
          onEdit: editTextAnnotation,
          scrollOffset,
          onDraftKeyDown: handleTextKeyDown,
          onDraftBlur: finishTextDraft,
          onActivateEditor: activateTextEditor,
          fontFamily: resolveTextFontFamily(settingsTextStyle),
          color: settingsTextStyle.color,
        },
      }}
      colorPicker={{
        active: colorPicker.active,
        sample: colorPicker.sample,
        unsupported: colorPicker.unsupported,
        ownerWindow,
        formats: settingsColorFormats,
        favoriteFormat: settingsColorClickFormat,
        onClose: () => colorPicker.setActive(false),
      }}
      screenshot={{
        active: screenshot.active,
        rect: screenshot.rect,
        onPointerDown: screenshot.handlePointerDown,
        onPointerMove: screenshot.handlePointerMove,
        onPointerUp: screenshot.handlePointerUp,
        onPointerCancel: screenshot.handlePointerCancel,
      }}
      toolbar={{
        eventTarget: ownerWindow,
        onInteract: () => setToolbarActive(true),
        tools: {
          mode: toolMode,
          setMode: setToolModeWithHistory,
          setEnabled: setEnabledWithHistory,
          xrayVisible,
          setXrayVisible,
          rulersVisible,
          setRulersVisible: setRulersVisiblePersisted,
          guideOrientation,
          setGuideOrientation: setGuideOrientationWithHistory,
        },
        colorPicker: {
          active: colorPicker.active,
          setActive: colorPicker.setActive,
          onClick: openColorPicker,
        },
        screenshot: {
          active: screenshot.active,
          error: screenshot.error,
          previewUrl: screenshot.previewUrl,
          copy: settingsScreenshot.copy,
          download: settingsScreenshot.download,
          onClick: screenshot.toggleSelection,
          onCancel: screenshot.closeUi,
          onPreviewExited: screenshot.dismissPreview,
        },
        settings: {
          open: settingsOpen,
          setOpen: setSettingsOpen,
          onToggle: toggleSettings,
          panel: (
            <SettingsPanel
              ownerWindow={ownerWindow}
              focusSection={settingsFocus}
              select={{
                highlightColor: settingsHighlightColor,
                setHighlightColor: setSettingsHighlightColor,
                hoverHighlight: settingsHoverHighlight,
                setHoverHighlight: setSettingsHoverHighlight,
                layoutDetailsEnabled: settingsLayoutDetailsEnabled,
                setLayoutDetailsEnabled: setSettingsLayoutDetailsEnabled,
                snapEnabled,
                setSnapEnabled,
                multiMeasureEnabled,
                setMultiMeasureEnabled,
              }}
              guides={{
                guideColor: settingsGuideColor,
                setGuideColor: setSettingsGuideColor,
                guideStyle: settingsGuideStyle,
                setGuideStyle: setSettingsGuideStyle,
                snapGuidesEnabled,
                setSnapGuidesEnabled,
                guideHighlightEnabled: settingsGuideHighlightEnabled,
                setGuideHighlightEnabled: setSettingsGuideHighlightEnabled,
                selectNewGuideEnabled,
                setSelectNewGuideEnabled,
              }}
              color={{
                colorFormats: settingsColorFormats,
                setColorFormats: setSettingsColorFormats,
                colorClickFormat: settingsColorClickFormat,
                setColorClickFormat: setSettingsColorClickFormat,
              }}
              camera={{
                settings: settingsScreenshot,
                setSettings: setSettingsScreenshot,
              }}
              rulers={{
                settings: settingsRulerSettings,
                setSettings: setSettingsRulerSettings,
              }}
              text={{
                settings: settingsTextStyle,
                setSettings: setSettingsTextStyle,
              }}
              arrows={{
                color: settingsArrowColor,
                setColor: setSettingsArrowColor,
                snapArrowsEnabled,
                setSnapArrowsEnabled,
                arrowClickToPlace,
                setArrowClickToPlace,
              }}
              general={{
                persistOnReload: settingsPersistOnReload,
                setPersistOnReload: setSettingsPersistOnReload,
                onResetSettings: resetSettings,
                onClearWorkspace: clearWorkspace,
              }}
            />
          ),
        },
      }}
    />
  );
}

export default function Mesurer({
  highlightColor = "oklch(0.62 0.18 255)",
  guideColor = "oklch(0.63 0.26 29.23)",
  arrowColor = "oklch(0.63 0.26 29.23)",
  guideHighlightEnabled = true,
  hoverHighlightEnabled = true,
  layoutDetailsEnabled = true,
  persistOnReload = false,
  portalTarget,
  persistKey,
  colorPickerFormats = ["hex", "rgb", "oklch"],
  colorPickerClickFormat = "hex",
  snapEnabled = true,
  snapGuidesEnabled = true,
  snapArrowsEnabled = true,
  arrowClickToPlace = false,
  selectNewGuideEnabled = true,
  multiMeasureEnabled = false,
  guideStyle,
  rulerSettings,
  textStyle,
  persistence,
  onPersistenceError,
  captureVisibleTab,
}: MesurerProps) {
  if (typeof document !== "undefined") {
    ensureMesurerStyles(MESURER_STYLES, portalTarget);
  }

  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <MesurerClient
      highlightColor={highlightColor}
      guideColor={guideColor}
      arrowColor={arrowColor}
      guideHighlightEnabled={guideHighlightEnabled}
      hoverHighlightEnabled={hoverHighlightEnabled}
      layoutDetailsEnabled={layoutDetailsEnabled}
      persistOnReload={persistOnReload}
      persistKey={persistKey}
      colorPickerFormats={colorPickerFormats}
      colorPickerClickFormat={colorPickerClickFormat}
      snapEnabled={snapEnabled}
      snapGuidesEnabled={snapGuidesEnabled}
      snapArrowsEnabled={snapArrowsEnabled}
      arrowClickToPlace={arrowClickToPlace}
      selectNewGuideEnabled={selectNewGuideEnabled}
      multiMeasureEnabled={multiMeasureEnabled}
      guideStyle={{ ...DEFAULT_GUIDE_STYLE, ...guideStyle }}
      rulerSettings={{ ...DEFAULT_RULER_SETTINGS, ...rulerSettings }}
      textStyle={{ ...DEFAULT_TEXT_STYLE, ...textStyle }}
      persistence={persistence}
      onPersistenceError={onPersistenceError}
      captureVisibleTab={captureVisibleTab}
      portalTarget={portalTarget ?? document.body}
    />
  );
}
