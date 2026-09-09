"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  SettingsPanel,
  settingsFocusSection,
  type SettingsFocusSection,
} from "./components/settings-panel";
import { ColorPicker } from "./components/color-picker";
import { MesurerPortal } from "./components/mesurer-portal";
import { useColorPicker } from "./hooks/use-color-picker";
import { useGuideDragHold } from "./hooks/use-guide-drag-hold";
import { useGuideWindowEvents } from "./hooks/use-guide-window-events";
import { useInteractionLifecycle } from "./hooks/use-interaction-lifecycle";
import { useWorkspaceLifecycle } from "./hooks/use-workspace-lifecycle";
import { useOverlayPointerHandlers } from "./hooks/use-overlay-pointer-handlers";
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
import { getRectFromPoints } from "./core/geometry";
import { attachPinnedGuideTarget } from "./core/distances";
import { useAnnotationSelection } from "./hooks/use-annotation-selection";
import { useAnnotationCallbacks } from "./hooks/use-annotation-callbacks";
import type { ColorPickerFormat } from "./core/colors";
import {
  createLocalStoragePersistence,
  type MesurerPersistence,
  type GuideStyle,
  type RulerSettings,
} from "./core/persistence";
import {
  resolveTextFontFamily,
  type TextStyleSettings,
} from "./core/text-style";
import {
  getTabId,
  LEGACY_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  sanitizeStoredSettings,
} from "./core/workspace";
export type MesurerProps = {
  highlightColor?: string;
  guideColor?: string;
  arrowColor?: string;
  guideHighlightEnabled?: boolean;
  hoverHighlightEnabled?: boolean;
  layoutDetailsEnabled?: boolean;
  persistOnReload?: boolean;
  shortcutsEnabled?: boolean;
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
export function MesurerClient({
  highlightColor,
  guideColor,
  arrowColor,
  guideHighlightEnabled,
  hoverHighlightEnabled,
  layoutDetailsEnabled,
  persistOnReload,
  shortcutsEnabled: shortcutsEnabledDefault,
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
    const next =
      persistence ??
      createLocalStoragePersistence(
        ownerWindow,
        storageKey,
        SETTINGS_STORAGE_KEY,
        legacyStorageKey,
      );
    return next;
  }, [legacyStorageKey, ownerWindow, persistence, storageKey]);
  useEffect(() => {
    activePersistence.setErrorHandler?.((error) =>
      persistenceErrorHandlerRef.current?.(error),
    );
    return () => activePersistence.setErrorHandler?.(undefined);
  }, [activePersistence]);
  const storedState = useMemo(
    () => activePersistence.load(),
    [activePersistence],
  );
  const persistedState =
    persistOnReload || storedState?.settings.persistOnReload
      ? (storedState?.workspace ?? null)
      : null;
  const persistedSettings = sanitizeStoredSettings(
    ownerWindow,
    storedState?.settings ?? {},
  );
  const closeScreenshotRef = useRef<() => void>(() => {});
  const clearWorkspaceTransientRef = useRef<() => void>(() => {});
  const cancelArrowInteractionRef = useRef<() => void>(() => {});
  const hasArrowInteractionRef = useRef<() => boolean>(() => false);
  const cancelPenInteractionRef = useRef<() => void>(() => {});
  const hasPenInteractionRef = useRef<() => boolean>(() => false);
  const workspacePersistTimeoutRef = useRef<number | null>(null);
  const applyingExternalPersistenceRef = useRef(false);
  const workspace = useMesurerWorkspaceState({
    persistedState,
    initialToolMode: persistedSettings.lastToolMode ?? "select",
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
    selectedTextIdsRef,
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
    minimized,
    setMinimized,
    settingsOpen,
    setSettingsOpen,
    xrayVisible,
    setXrayVisible,
    guideOrientation,
    setGuideOrientation,
  } = workspace;
  const textInspector = useTextInspector(
    portalTarget,
    toolMode,
    settingsOpen,
    minimized,
  );
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
    shortcutsEnabled: settingsShortcutsEnabled,
    setShortcutsEnabled: setSettingsShortcutsEnabled,
    lastToolMode: settingsLastToolMode,
    setLastToolMode: setSettingsLastToolMode,
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
      shortcutsEnabled: shortcutsEnabledDefault,
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
  const workspaceLifecycle = useWorkspaceLifecycle({
    ownerWindow,
    activePersistence,
    settings: {
      persistOnReload: settingsPersistOnReload,
      applyPersistedSettings,
      persistSettings,
    },
    workspace,
    closeScreenshotRef,
    clearWorkspaceTransientRef,
    setSelectedTextIds,
    applyingExternalPersistenceRef,
    workspacePersistTimeoutRef,
    storedState,
  });
  const {
    saveWorkspace,
    persistState,
    applyPersistenceSnapshot,
    clearWorkspace,
    setEnabledPersisted,
    setToolModePersisted,
    setRulersVisiblePersisted,
    setGuideOrientationPersisted,
    setMeasurementsPersisted,
    setActiveMeasurementPersisted,
    setHeldDistancesPersisted,
    setGuidesPersisted,
    setSelectedGuideIdsPersisted,
    setArrowsPersisted,
    setSelectedArrowIdsPersisted,
    setTextAnnotationsPersisted,
    setPenStrokesPersisted,
    setSelectedPenStrokeIdsPersisted,
    setSelectedTextIdsPersisted,
  } = workspaceLifecycle;
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
  const { clearGuideDragHold, scheduleGuideDragHold } =
    useGuideDragHold(ownerWindow);
  const [guidePreview, setGuidePreview] = useState<{
    orientation: "vertical" | "horizontal";
    position: number;
  } | null>(null);
  const [scrollOffset, setScrollOffset] = useState({
    x: ownerWindow.scrollX,
    y: ownerWindow.scrollY,
  });
  useLayoutEffect(() => {
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
  selectedTextIdsRef.current = selectedTextIds;
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
  const annotationSelection = useAnnotationSelection({
    enabled,
    toolMode,
    ownerDocument,
    overlayRef,
    toolbarRef,
    scrollOffset,
    guides,
    arrows,
    penStrokes,
    textAnnotations,
    selectedGuideIds,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
    clearSelectionRect,
    setStart,
    setEnd,
    setIsDragging,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setSelectedArrowIds: setSelectedArrowIdsPersisted,
    setSelectedTextIds: setSelectedTextIdsPersisted,
    setSelectedPenStrokeIds: setSelectedPenStrokeIdsPersisted,
    setSelectedMeasurements,
    setSelectedMeasurement,
    setSelectedElement,
    setGuides: setGuidesPersisted,
    setArrows: setArrowsPersisted,
    setPenStrokes: setPenStrokesPersisted,
    setTextAnnotations: setTextAnnotationsPersisted,
    recordSnapshot,
    setToolMode: setToolModeWithHistory,
  });
  const {
    clearSelection,
    removeSelected,
    selectAllAnnotations,
    groupBounds,
    groupRotateFrame,
    selectionDragOffset,
    moveSelectedAnnotations,
    beginMoveSession,
    moveFromSession,
    endMoveSession,
    cancelMoveSession,
    startGroupRotate,
    updateGroupRotate,
    endGroupRotate,
    startGroupResize,
    resizeSelectedAnnotations,
    endGroupResize,
  } = annotationSelection;
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
    setToolbarActive: (active) => {
      if (active) setMinimized(false);
      setToolbarActive(active);
    },
    onPrepare: () => {
      colorPicker.setActive(false);
      setSettingsOpen(false);
    },
  });
  closeScreenshotRef.current = screenshot.closeUi;
  const openColorPicker = useCallback(() => {
    screenshot.closeUi();
    void colorPicker.open();
  }, [colorPicker.open, screenshot.closeUi]);
  const [settingsFocus, setSettingsFocus] = useState<
    SettingsFocusSection | undefined
  >();
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

  const setArrowColor = useCallback(
    (value: SetStateAction<string>) => {
      const color = typeof value === "function"
        ? value(settingsArrowColor)
        : value;
      setSettingsArrowColor(color);
      setArrowsPersisted((previous) =>
        previous.map((arrow) => ({ ...arrow, color })),
      );
    },
    [setArrowsPersisted, setSettingsArrowColor, settingsArrowColor],
  );
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
    minimized,
    snapGuidesEnabled,
    guides,
    toolbarRef,
    overlayRef,
    createActionCommit,
    setGuides: setGuidesPersisted,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setToolbarActive,
    selectedGuideIds,
    selectionCount:
      selectedGuideIds.length +
      selectedArrowIds.length +
      selectedTextIds.length +
      selectedPenStrokeIds.length,
    moveSelectedAnnotations,
  });
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
    setSelectedTextIds: setSelectedTextIdsPersisted,
    setSelectedArrowIds: setSelectedArrowIdsPersisted,
    setSelectedPenStrokeIds: setSelectedPenStrokeIdsPersisted,
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
    setToolMode: setToolModeWithHistory,
    setArrows: setArrowsPersisted,
    onBeginMove: (id: string) => beginMoveSession({ arrowId: id }),
    onDragMove: moveFromSession,
    onMoveEnd: endMoveSession,
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
  const annotationCallbacks = useAnnotationCallbacks({
    textAnnotations,
    selectedTextIds,
    selectedPenStrokeIds,
    scrollOffset,
    textDraftRef,
    textDraftInputRef,
    committedTextEditorsRef,
    suppressTextCreateRef,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setSelectedArrowIds: setSelectedArrowIdsPersisted,
    setSelectedTextIds: setSelectedTextIdsPersisted,
    setSelectedPenStrokeIds: setSelectedPenStrokeIdsPersisted,
    setSelectedMeasurements,
    setSelectedMeasurement,
    setSelectedElement,
    clearSelectionRect,
    setTextDraft,
    setPenStrokes: setPenStrokesPersisted,
    setTextAnnotations: setTextAnnotationsPersisted,
    moveSelectedAnnotations,
    setToolMode: setToolModePersisted,
    recordSnapshot,
  });
  const {
    selectPenStroke,
    changePenStroke,
    finishTextDraft,
    activateTextEditor,
    selectTextAnnotation,
    moveTextAnnotation,
    transformTextAnnotation,
    editTextAnnotation,
    handleTextPointerDown,
    handleTextKeyDown,
  } = annotationCallbacks;
  const activateToolbar = useCallback(() => {
    setToolbarActive(true);
  }, [setToolbarActive]);
  const pinableOverlay = guidesEnabled
    ? (guideDistanceOverlay ?? optionPairOverlay)
    : (optionPairOverlay ?? guideDistanceOverlay);
  const pinDistance = useCallback(() => {
    if (!pinableOverlay) return false;
    recordSnapshot();
    setHeldDistancesPersisted((prev) => [
      ...prev,
      attachPinnedGuideTarget({
        distance: pinableOverlay,
        document: ownerDocument,
        overlayNode: overlayRef.current,
        pointer: hoverPointer,
      }),
    ]);
    return true;
  }, [
    hoverPointer,
    ownerDocument,
    pinableOverlay,
    recordSnapshot,
    setHeldDistancesPersisted,
  ]);
  const restoreToolbar = useCallback(() => {
    setMinimized(false);
    setToolbarActive(true);
  }, [setMinimized, setToolbarActive]);
  const minimizeMesurer = useCallback(() => {
    setSettingsOpen(false);
    colorPicker.setActive(false);
    screenshot.closeUi();
    setMinimized(true);
  }, [colorPicker, screenshot, setMinimized, setSettingsOpen]);
  const { clearTransientState } = useInteractionLifecycle({
    enabled,
    toolMode,
    xrayVisible,
    rulersVisible,
    toolbarActive,
    minimized,
    shortcutsEnabled: settingsShortcutsEnabled,
    settingsOpen,
    ownerDocument,
    ownerWindow,
    toolbarRef,
    overlayRef,
    scrollOffset,
    guides,
    arrows,
    penStrokes,
    textAnnotations,
    selectedGuideIds,
    selectedArrowIds,
    selectedPenStrokeIds,
    selectedTextIds,
    selectedMeasurements,
    selectedMeasurement,
    selectedElement,
    start,
    arrowStart,
    draggingGuideId,
    isDragging,
    textDraft,
    textDraftRef,
    setTextDraft,
    setStart,
    setEnd,
    setIsDragging,
    setHoverRect,
    setHoverPointer,
    setHoverElement,
    setSelectedElement,
    setArrowStart,
    setArrowMiddle,
    setArrowPreviewEnd,
    setXrayVisible,
    setAltPressed,
    pinDistance,
    setToolMode,
    clearSelectionRect,
    clearGuideDragHold,
    cancelArrowInteraction: arrowsPointer.cancelInteraction,
    cancelPenInteraction: penPointer.cancelInteraction,
    cancelMoveSession,
    hasArrowInteraction: arrowsPointer.hasActiveInteraction,
    hasPenInteraction: penPointer.hasActiveInteraction,
    clearSelection,
    recordSnapshot,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setSelectedArrowIds: setSelectedArrowIdsPersisted,
    setSelectedTextIds: setSelectedTextIdsPersisted,
    setSelectedPenStrokeIds: setSelectedPenStrokeIdsPersisted,
    setSelectedMeasurements,
    setSelectedMeasurement,
    screenshot,
    colorPicker,
    undo,
    redo,
    removeSelected,
    selectAllAnnotations,
    setEnabled: setEnabledPersisted,
    setRulersVisible,
    setGuideOrientation,
    onInteract: activateToolbar,
    onMinimize: minimizeMesurer,
    onToggleSettings: toggleSettings,
    dismissInspectorPins: () => textInspector.clear(),
  });
  clearWorkspaceTransientRef.current = clearTransientState;
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
    selectedGuideIds,
    selectionCount:
      selectedGuideIds.length +
      selectedArrowIds.length +
      selectedTextIds.length +
      selectedPenStrokeIds.length,
    scheduleGuideDragHold,
    clearGuideDragHold,
  });
  const overlayInteractive = enabled && !settingsOpen && !minimized
  const movingGroupRect = (() => {
    const showGroup =
      selectedArrowIds.length +
        selectedTextIds.length +
        selectedPenStrokeIds.length >
        1 ||
      ((selectedArrowIds.length > 0 ||
        selectedTextIds.length > 0 ||
        selectedPenStrokeIds.length > 0) &&
        selectedGuideIds.length > 0)
    if (!showGroup) return null
    const base = groupRotateFrame?.rect ?? groupBounds
    if (!base) return null
    if (selectionDragOffset.x === 0 && selectionDragOffset.y === 0) return base
    return {
      ...base,
      left: base.left + selectionDragOffset.x,
      top: base.top + selectionDragOffset.y,
    }
  })();
  const pointerHandlers = useOverlayPointerHandlers({
    toolMode,
    arrows: arrowsPointer,
    pen: penPointer,
    text: { handlePointerDown: handleTextPointerDown },
    measure: {
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    },
  });
  if (
    (toolMode === "select" ||
      toolMode === "selection" ||
      toolMode === "guides" ||
      toolMode === "arrows" ||
      toolMode === "pen" ||
      toolMode === "text") &&
    settingsLastToolMode !== toolMode
  ) {
    setSettingsLastToolMode(toolMode);
  }
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
        interactive: !settingsOpen && !minimized,
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
        marqueeRect:
          isDragging && start && end ? getRectFromPoints(start, end) : null,
        groupBounds: movingGroupRect,
        groupFrameRotation:
          selectedArrowIds.length +
            selectedTextIds.length +
            selectedPenStrokeIds.length >
            1 ||
          ((selectedArrowIds.length > 0 ||
            selectedTextIds.length > 0 ||
            selectedPenStrokeIds.length > 0) &&
            selectedGuideIds.length > 0)
            ? (groupRotateFrame?.rotation ?? 0)
            : 0,
        selectionCount:
          selectedGuideIds.length +
          selectedArrowIds.length +
          selectedTextIds.length +
          selectedPenStrokeIds.length,
        onResizeSelection: resizeSelectedAnnotations,
        onMoveSelection: moveFromSession,
        onMoveSelectionStart: () => {
          recordSnapshot()
          beginMoveSession()
        },
        onMoveSelectionEnd: endMoveSession,
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
          moveOffset: selectionDragOffset,
          hover: hoverGuide,
          draggingId: draggingGuideId,
          style: settingsGuideStyle,
          pointerEvents:
            overlayInteractive && (toolMode !== "none" || rulersVisible),
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
          moveOffset: selectionDragOffset,
          preview: arrowsPointer.preview,
          scrollOffset,
          color: settingsArrowColor,
          onSelect: (id) => setSelectedArrowIdsPersisted([id]),
          onChange: (arrow) =>
            setArrowsPersisted((previous) =>
              previous.map((item) => (item.id === arrow.id ? arrow : item)),
            ),
          onChangeStart: recordSnapshot,
          editingArrowId: arrowsPointer.editingArrowId,
        },
        pen: {
          strokes: penStrokes,
          preview: penPreview,
          scrollOffset,
          selectionMode: toolMode === "selection",
          selectedIds: selectedPenStrokeIds,
          moveOffset: selectionDragOffset,
          onSelect: selectPenStroke,
          onChange: changePenStroke,
          onChangeStart: recordSnapshot,
          onMoveStart: (id: string) => beginMoveSession({ penId: id }),
          onMove: (_id, dx, dy) => moveFromSession(dx, dy),
          onMoveEnd: endMoveSession,
        },
        text: {
          items: textAnnotations,
          draft: textDraft,
          draftInputRef: textDraftInputRef,
          interactive: toolMode === "selection",
          editable: toolMode === "text",
          selectedIds: selectedTextIds,
          moveOffset: selectionDragOffset,
          onSelect: selectTextAnnotation,
          onMoveStart: (id: string) => {
            recordSnapshot()
            beginMoveSession({ textId: id })
          },
          onMove: (_id, dx, dy) => moveFromSession(dx, dy),
          onMoveEnd: endMoveSession,
          onChangeStart: recordSnapshot,
          onTransform: transformTextAnnotation,
          onEdit: editTextAnnotation,
          scrollOffset,
          onDraftKeyDown: handleTextKeyDown,
          onDraftBlur: () => finishTextDraft(false, true),
          onActivateEditor: activateTextEditor,
          fontFamily: resolveTextFontFamily(settingsTextStyle),
          color: settingsTextStyle.color,
        },
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
        minimized,
        onInteract: activateToolbar,
        onRestore: restoreToolbar,
        onCancelTransient: clearTransientState,
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
          panel: (
            <ColorPicker
              active={colorPicker.active}
              sample={colorPicker.sample}
              unsupported={colorPicker.unsupported}
              ownerWindow={ownerWindow}
              formats={settingsColorFormats}
              favoriteFormat={settingsColorClickFormat}
              onClose={() => colorPicker.setActive(false)}
            />
          ),
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
                setColor: setArrowColor,
                snapArrowsEnabled,
                setSnapArrowsEnabled,
                arrowClickToPlace,
                setArrowClickToPlace,
              }}
              general={{
                persistOnReload: settingsPersistOnReload,
                setPersistOnReload: setSettingsPersistOnReload,
                shortcutsEnabled: settingsShortcutsEnabled,
                setShortcutsEnabled: setSettingsShortcutsEnabled,
                onMinimize: minimizeMesurer,
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
