"use client";
import {
  useCallback,
  useEffect,
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
import { useScreenRecording } from "./hooks/use-screen-recording";
import { usePlayableMotion } from "./hooks/use-playable-motion";
import { InspectInfoCard } from "./components/inspect-info-card";
import { ScreenRecordingEditor, ScreenRecordingTimer } from "./components/screen-recording";
import { useSelectionAnimationCleanup } from "./hooks/use-selection-animation-cleanup";
import { useSelectedTypography } from "./hooks/use-selected-typography";
import { useSelectorCopy } from "./hooks/use-selector-copy";
import { useScrollOffset } from "./hooks/use-scroll-offset";
import { useCommentRuntime } from "./hooks/use-comment-runtime";
import { useSettingsDismiss } from "./hooks/use-settings-dismiss";
import { useXray } from "./hooks/use-xray";
import { useArrowsPointer } from "./hooks/use-arrows-pointer";
import { usePenPointer } from "./hooks/use-pen-pointer";
import { copyCommentsForAgent, useCommentPointer } from "./comments";
import { createLayoutGuide, type LayoutGuide } from "./core/layout-guides";
import { getRectFromPoints } from "./core/geometry";
import { attachPinnedGuideTarget } from "./core/distances";
import { useAnnotationSelection } from "./hooks/use-annotation-selection";
import { useAnnotationCallbacks } from "./hooks/use-annotation-callbacks";
import type { ColorPickerFormat } from "./core/colors";
import type { CommentThread, ToolMode } from "./core/types";
import type { CommentFilter } from "./comments/types";

export type ExtensionRecordingSession = {
  prepare: () => Promise<void>;
  start: (input: { rect: { left: number; top: number; width: number; height: number }; viewport: { width: number; height: number } }) => Promise<void>;
  stop: () => Promise<{ id: string; duration: number }>;
  abort: () => void;
  dispose?: () => void;
};
import {
  type MesurerPersistence,
  type MesurerStoredWorkspace,
  type GuideStyle,
  type RulerSettings,
  type ThemeMode,
} from "./core/persistence";
import {
  resolveTextFontFamily,
  type TextStyleSettings,
} from "./core/text-style";
import type { MesurerFeatures, ResolvedMesurerFeatures } from "./core/features";
import { useMesurerStorage } from "./hooks/use-mesurer-storage";
import { usePageWorkspaceSwitch } from "./hooks/use-page-workspace-switch";
export type MesurerProps = {
  highlightColor?: string;
  guideColor?: string;
  arrowColor?: string;
  guideHighlightEnabled?: boolean;
  hoverHighlightEnabled?: boolean;
  layoutDetailsEnabled?: boolean;
  persistOnReload?: boolean;
  persistSession?: boolean;
  shortcutsEnabled?: boolean;
  theme?: ThemeMode;
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
  extensionRecording?: ExtensionRecordingSession;
  extensionRecordingPlayer?: string;
  features?: MesurerFeatures;
  initialState?: {
    enabled?: boolean;
    minimized?: boolean;
    toolMode?: ToolMode;
    toolbarPosition?: { x: number; y: number };
    xrayVisible?: boolean;
    rulersVisible?: boolean;
    guideOrientation?: "vertical" | "horizontal";
    guides?: MesurerStoredWorkspace["guides"];
    selectedGuideIds?: string[];
    arrows?: MesurerStoredWorkspace["arrows"];
    selectedArrowIds?: string[];
    penStrokes?: MesurerStoredWorkspace["penStrokes"];
    selectedPenStrokeIds?: string[];
    textAnnotations?: MesurerStoredWorkspace["textAnnotations"];
    selectedTextIds?: string[];
    measurements?: MesurerStoredWorkspace["measurements"];
    activeMeasurement?: MesurerStoredWorkspace["activeMeasurement"];
    heldDistances?: MesurerStoredWorkspace["heldDistances"];
    comments?: CommentThread[];
    layoutGuides?: MesurerStoredWorkspace["layoutGuides"];
  };
};
export function MesurerClient({
  highlightColor,
  guideColor,
  arrowColor,
  guideHighlightEnabled,
  hoverHighlightEnabled,
  layoutDetailsEnabled,
  persistOnReload,
  persistSession = false,
  shortcutsEnabled: shortcutsEnabledDefault,
  theme: themeDefault,
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
  extensionRecording,
  extensionRecordingPlayer,
  features,
  initialState,
}: Required<
  Omit<
    MesurerProps,
    | "persistKey"
    | "persistSession"
    | "persistence"
    | "onPersistenceError"
    | "guideStyle"
    | "rulerSettings"
    | "textStyle"
    | "captureVisibleTab"
    | "extensionRecording"
    | "extensionRecordingPlayer"
    | "features"
    | "initialState"
  >
> &
  Pick<
    MesurerProps,
    | "persistKey"
    | "persistSession"
    | "persistence"
    | "onPersistenceError"
    | "captureVisibleTab"
    | "extensionRecording"
    | "extensionRecordingPlayer"
    | "initialState"
  > & {
    guideStyle: GuideStyle;
    rulerSettings: RulerSettings;
    textStyle: TextStyleSettings;
    features: ResolvedMesurerFeatures;
  }) {
  const ownerDocument = portalTarget.ownerDocument ?? document;
  const ownerWindow = ownerDocument.defaultView ?? window;
  const {
    pageKey,
    appliedPageKeyRef,
    pageWorkspacesRef,
    activePersistence,
    storedState,
    persistedState,
    persistedSettings,
  } = useMesurerStorage({ ownerWindow, persistKey, persistence, persistOnReload, persistSession });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const persistenceErrorHandlerRef = useRef(onPersistenceError);
  persistenceErrorHandlerRef.current = onPersistenceError;
  const closeScreenshotRef = useRef<() => void>(() => {});
  const clearWorkspaceTransientRef = useRef<() => void>(() => {});
  const cancelArrowInteractionRef = useRef<() => void>(() => {});
  const hasArrowInteractionRef = useRef<() => boolean>(() => false);
  const cancelPenInteractionRef = useRef<() => void>(() => {});
  const hasPenInteractionRef = useRef<() => boolean>(() => false);
  const workspacePersistTimeoutRef = useRef<number | null>(null);
  const applyingExternalPersistenceRef = useRef(false);
  const persistCommentsRef = useRef<(comments: CommentThread[]) => void>(() => {});
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
    initialState,
    initialComments: persistedState?.comments ?? initialState?.comments,
    onCommentsChange: (value) => persistCommentsRef.current(value),
  });
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("open");
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
    measurements,
    selectedMeasurement,
    setSelectedMeasurement,
    selectedMeasurements,
    setSelectedMeasurements,
    hoverRect,
    setHoverRect,
    heldDistances,
    guides,
    setGuides,
    draggingGuideId,
    setDraggingGuideId,
    selectedGuideIds,
    arrows,
    selectedArrowIds,
    textAnnotations,
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
    minimizedRef,
    minimized,
    settingsOpen,
    setSettingsOpen,
    openMenu,
    setOpenMenu,
    xrayVisible,
    setXrayVisible,
    guideOrientation,
    setGuideOrientation,
    comments,
    selectedId: selectedCommentId,
    setSelectedId: setSelectedCommentId,
    draft: commentDraft,
    createDraft: createCommentDraft,
    cancelDraft: cancelCommentDraft,
    commitDraft: commitCommentDraft,
    addMessage: addCommentMessage,
    deleteComment,
    deleteAllComments,
    resolveAllComments,
    deleteMessage: deleteCommentMessage,
    toggleResolved: toggleCommentResolved,
    updateTarget: updateCommentTarget,
    updateMessage: updateCommentMessage,
    layoutGuides,
    layoutGuidesRef,
  } = workspace;
  const copyAllComments = async () => {
    const copied = await copyCommentsForAgent(comments, ownerWindow);
    if (copied) ownerWindow.dispatchEvent(new Event("mesurer:comments-copied"));
    return copied;
  };
  const resolveAllCommentsWithFeedback = () => {
    if (!comments.some((comment) => comment.status === "open")) return;
    resolveAllComments();
    ownerWindow.dispatchEvent(new Event("mesurer:comments-resolved"));
  };
  const setCommentFilterAndSelection = useCallback((filter: CommentFilter) => {
    setCommentFilter(filter);
    const selectedComment = comments.find((comment) => comment.id === selectedCommentId);
    if (selectedComment && filter !== "all" && selectedComment.status !== filter) {
      setSelectedCommentId(null);
    }
  }, [comments, selectedCommentId]);
  const dismissSettings = useCallback(() => {
    setOpenMenu(null);
    setSettingsOpen(false);
  }, [setOpenMenu, setSettingsOpen]);
  useSettingsDismiss(ownerWindow, settingsOpen, dismissSettings);
  const { runtime: commentRuntime, snapshot: commentRuntimeSnapshot } =
    useCommentRuntime(comments, ownerDocument, ownerWindow);
  const commentPointer = useCommentPointer({
    overlayRef,
    ownerDocument,
    ownerWindow,
    runtime: commentRuntime,
    state: {
      draft: commentDraft,
      createDraft: createCommentDraft,
      cancelDraft: cancelCommentDraft,
      commitDraft: commitCommentDraft,
      updateTarget: updateCommentTarget,
    },
  });
  const textDraftInputRef = useRef<HTMLElement | null>(null);
  const textDraftRef = useRef(textDraft);
  const committedTextEditorsRef = useRef(new WeakSet<HTMLElement>());
  const suppressTextCreateRef = useRef(false);
  textDraftRef.current = textDraft;
  const settings = useMesurerSettings({
    activePersistence,
    persistedSettings,
    defaults: {
      highlightColor,
      guideColor,
      arrowColor,
      guideHighlightEnabled,
      hoverHighlightEnabled,
      layoutDetailsEnabled,
      infoCardMode: "click",
      persistOnReload,
      shortcutsEnabled: shortcutsEnabledDefault,
      theme: themeDefault,
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
  const { resetSettings, persistSettings, applyPersistedSettings } = settings;
  const workspaceLifecycle = useWorkspaceLifecycle({
    ownerWindow,
    activePersistence,
    settings: {
      persistOnReload: settings.persistOnReload,
      persistWorkspace: persistSession || settings.persistOnReload,
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
    appliedPageKeyRef,
    pageWorkspacesRef,
  });
  const {
    saveWorkspace,
    persistState,
    applyPersistenceSnapshot,
    applyPageArtifacts,
    clearWorkspace,
    clearPageArtifacts,
    readPageArtifacts,
    setEnabledPersisted,
    setMinimizedPersisted,
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
    setCommentsPersisted,
    setLayoutGuidesPersisted,
  } = workspaceLifecycle;
  persistCommentsRef.current = setCommentsPersisted;
  usePageWorkspaceSwitch({
    pageKey,
    appliedPageKeyRef,
    pageWorkspacesRef,
    activePersistence,
    persistWorkspace: persistSession || settings.persistOnReload,
    readPageArtifacts,
    applyPageArtifacts,
    clearPageArtifacts,
    saveWorkspace,
  });
  usePersistenceLifecycle({
    ownerWindow,
    activePersistence,
    persistSettings,
    persistState,
    persistWorkspace: persistSession || settings.persistOnReload,
    saveWorkspace,
    applyPersistenceSnapshot,
    storedState,
    persistenceErrorHandlerRef,
    applyingExternalPersistenceRef,
    workspacePersistTimeoutRef,
  });
  const { clearGuideDragHold, scheduleGuideDragHold } =
    useGuideDragHold(ownerWindow);
  const [guidePreview, setGuidePreview] = useState<{
    orientation: "vertical" | "horizontal";
    position: number;
  } | null>(null);
  const scrollOffset = useScrollOffset(ownerWindow);
  enabledRef.current = enabled;
  minimizedRef.current = minimized;
  xrayVisibleRef.current = xrayVisible;
  toolModeRef.current = toolMode;
  rulersVisibleRef.current = rulersVisible;
  guideOrientationRef.current = guideOrientation;
  measurementsRef.current = measurements;
  activeMeasurementRef.current = activeMeasurement;
  heldDistancesRef.current = heldDistances;
  useEffect(() => {
    if ((toolMode === "none" || !enabled) && heldDistances.length > 0) {
      setHeldDistancesPersisted([]);
    }
  }, [enabled, heldDistances.length, setHeldDistancesPersisted, toolMode]);
  guidesRef.current = guides;
  layoutGuidesRef.current = layoutGuides;
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
    undo,
    redo,
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
    comments: {
      comments,
      setComments: setCommentsPersisted,
    },
    layoutGuides: {
      layoutGuides,
      setLayoutGuides: setLayoutGuidesPersisted,
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
  const setLayoutGuidesWithHistory = useCallback(
    (value: SetStateAction<LayoutGuide[]>) => {
      recordSnapshot();
      setLayoutGuidesPersisted(value);
    },
    [recordSnapshot, setLayoutGuidesPersisted],
  );
  const toggleResolvedComment = useCallback((id: string) => {
    recordSnapshot();
    toggleCommentResolved(id);
  }, [recordSnapshot, toggleCommentResolved]);
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
    clickFormat: settings.colorPickerClickFormat,
    setEnabled: (value) => setEnabledWithHistory(value),
    setToolModeNone: () => setToolModeWithHistory("none"),
  });
  const closeColorPicker = useCallback(() => colorPicker.setActive(false), [colorPicker.setActive]);
  const screenshot = useScreenshot({
    ownerDocument,
    ownerWindow,
    overlayRef,
    captureVisibleTab,
    settings: settings.screenshotSettings,
    setEnabled: (value) => setEnabledWithHistory(value),
    setToolbarActive: (active) => {
      if (active) setMinimizedPersisted(false);
      setToolbarActive(active);
    },
    onPrepare: () => {
      colorPicker.setActive(false);
      setSettingsOpen(false);
    },
  });
  const screenRecording = useScreenRecording({
    ownerDocument,
    ownerWindow,
    extensionRecording,
    extensionRecordingPlayer,
    onPrepare: () => {
      colorPicker.setActive(false)
      screenshot.closeUi()
      setSettingsOpen(false)
    },
  })
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
      setOpenMenu(null);
      setSettingsOpen(false);
      return;
    }
    setOpenMenu({ type: "settings" });
    setSettingsFocus(
      settingsFocusSection(toolMode, {
        colorPicker: colorPicker.active,
        screenshot: screenshot.active,
        rulersVisible,
      }),
    );
    colorPicker.setActive(false);
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

  const [layoutGuidesVisible, setLayoutGuidesVisible] = useState(false);
  const toggleLayoutGuides = useCallback(() => {
    if (layoutGuidesVisible) {
      setLayoutGuidesVisible(false);
      if (openMenu?.type === "layout-guides") setOpenMenu(null);
      return;
    }
    setEnabledWithHistory(true);
    setSettingsOpen(false);
    colorPicker.setActive(false);
    screenshot.closeUi();
    if (layoutGuidesRef.current.length === 0) {
      setLayoutGuidesWithHistory([createLayoutGuide()]);
    }
    setLayoutGuidesVisible(true);
    setOpenMenu({ type: "layout-guides" });
  }, [
    colorPicker,
    layoutGuidesVisible,
    openMenu,
    screenshot,
    setEnabledWithHistory,
    setLayoutGuidesWithHistory,
    setOpenMenu,
    setSettingsOpen,
  ]);
  const closeLayoutGuidesMenu = useCallback(() => {
    if (openMenu?.type === "layout-guides") setOpenMenu(null);
  }, [openMenu, setOpenMenu]);

  const setArrowColor = useCallback(
    (value: SetStateAction<string>) => {
      const color = typeof value === "function"
        ? value(settings.arrowColor)
        : value;
      settings.setArrowColor(color);
      setArrowsPersisted((previous) =>
        previous.map((arrow) => ({ ...arrow, color })),
      );
    },
    [setArrowsPersisted, settings.setArrowColor, settings.arrowColor],
  );
  // How many annotations are selected, and whether they make a group: several of them, or
  // one together with a guide.
  const selectedShapeCount =
    selectedArrowIds.length + selectedTextIds.length + selectedPenStrokeIds.length;
  const selectionCount = selectedGuideIds.length + selectedShapeCount;
  const selectionIsGroup =
    selectedShapeCount > 1 || (selectedShapeCount > 0 && selectedGuideIds.length > 0);
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
    active:
      measurements.length > 0 ||
      selectedMeasurements.length > 0 ||
      heldDistances.length > 0 ||
      hoverRect !== null,
    selectionEnabled: toolMode === "select",
    guides,
    selectedMeasurements,
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
    selectionCount,
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
    hoverHighlightEnabled: settings.hoverHighlightEnabled,
    guideHighlightEnabled: settings.guideHighlightEnabled,
    highlightColor: settings.highlightColor,
    guideColor: settings.guideColor,
  });
  const { copySelector, isCopied: isSelectorCopied } = useSelectorCopy(ownerWindow);
  const selectedTypography = useSelectedTypography(selectedElement, ownerDocument, ownerWindow);
  const motionElement = selectedMeasurement?.elementRef ?? selectedElement;
  const { ready: selectedMotionPlayable, observedProperties: selectedObservedProperties, observedTargets: selectedObservedTargets } = usePlayableMotion(motionElement, motionElement?.ownerDocument.defaultView);
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
    minimized,
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
    onSelectElement: copySelector,
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
    color: settings.arrowColor,
    width: Math.max(settings.guideStyle.width, 1),
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
    color: settings.arrowColor,
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
    setMinimizedPersisted(false);
    setToolbarActive(true);
  }, [setMinimizedPersisted, setToolbarActive]);
  const minimizeMesurer = useCallback(() => {
    setSettingsOpen(false);
    setOpenMenu(null);
    setSelectedCommentId(null);
    cancelCommentDraft();
    commentRuntime.setHoverElement(null);
    colorPicker.setActive(false);
    screenshot.closeUi();
    if (screenRecording.recording) screenRecording.stop();
    else screenRecording.cancelSelection();
    clearSelection();
    setHoverRect(null);
    setHoverPointer(null);
    setHoverElement(null);
    setMinimizedPersisted(true);
  }, [
    cancelCommentDraft,
    clearSelection,
    colorPicker,
    commentRuntime,
    screenshot,
    screenRecording,
    setHoverElement,
    setHoverPointer,
    setHoverRect,
    setMinimizedPersisted,
    setOpenMenu,
    setSelectedCommentId,
    setSettingsOpen,
  ]);
  const closeScreenshotUi = screenshot.closeUi;
  useEffect(() => {
    if (!features.screenshot) closeScreenshotUi();
    if (!features.rulers) setRulersVisible(false);
    if (!features.settings) setSettingsOpen(false);
  }, [closeScreenshotUi, features.rulers, features.screenshot, features.settings, setRulersVisible, setSettingsOpen]);
  const { clearTransientState } = useInteractionLifecycle({
    enabled,
    toolMode,
    xrayVisible,
    rulersVisible,
    toolbarActive,
    minimized,
    shortcutsEnabled: settings.shortcutsEnabled,
    settingsOpen,
    layoutGuidesOpen: openMenu?.type === "layout-guides",
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
    commentDraftActive: commentDraft !== null,
    cancelCommentDraft,
    hasComments: () => comments.length > 0,
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
    screenRecording,
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
    onToggleLayoutGuides: toggleLayoutGuides,
    onCloseLayoutGuidesMenu: closeLayoutGuidesMenu,
    onCopyComments: copyAllComments,
    onResolveAllComments: resolveAllCommentsWithFeedback,
    dismissInspectorPins: () => {
      if (heldDistancesRef.current.length === 0) return false
      recordSnapshot()
      setHeldDistancesPersisted([])
      return true
    },
    selectedCommentId,
    closeComment: () => setSelectedCommentId(null),
    features,
  });
  const clearAllTransientState = useCallback(() => {
    clearTransientState();
    cancelCommentDraft();
    commentRuntime.setHoverElement(null);
  }, [cancelCommentDraft, clearTransientState, commentRuntime]);
  clearWorkspaceTransientRef.current = clearAllTransientState;
  const removeHeldDistance = useCallback(
    (id: string) => {
      recordSnapshot();
      setHeldDistancesPersisted((prev) =>
        prev.filter((distance) => distance.id !== id),
      );
    },
    [recordSnapshot, setHeldDistancesPersisted],
  );
  const removeGuides = useCallback(
    (ids: string[]) => {
      const guideIds = new Set(ids)
      if (!guides.some((guide) => guideIds.has(guide.id))) return;
      recordSnapshot();
      setGuides((prev) => prev.filter((guide) => !guideIds.has(guide.id)));
      setSelectedGuideIdsPersisted((prev) => prev.filter((guideId) => !guideIds.has(guideId)));
      setHeldDistancesPersisted((prev) =>
        prev.filter(
          (distance) =>
            !distance.guideIds?.some(
              (guideId) => guideId !== null && guideIds.has(guideId),
            ),
        ),
      );
    },
    [
      guides,
      recordSnapshot,
      setGuides,
      setHeldDistancesPersisted,
      setSelectedGuideIdsPersisted,
    ],
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
    selectionCount,
    scheduleGuideDragHold,
    clearGuideDragHold,
  });
  const overlayInteractive = enabled && !settingsOpen && !minimized
  const movingGroupRect = (() => {
    if (!selectionIsGroup) return null
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
    comments: {
      handlePointerDown: commentPointer.onPointerDown,
      handlePointerMove: commentPointer.onPointerMove,
      handlePointerUp: commentPointer.onPointerUp,
      handlePointerLeave: commentPointer.onPointerLeave,
      handlePointerCancel: commentPointer.onPointerCancel,
    },
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
      toolMode === "text" ||
      toolMode === "comments") &&
    settings.lastToolMode !== toolMode
  ) {
    settings.setLastToolMode(toolMode);
  }
  return (
    <MesurerPortal
      portalTarget={portalTarget}
      theme={settings.theme}
      enabled={enabled}
      rootRef={overlayRef}
      toolbarRef={toolbarRef}
      screenshotOverlayRef={screenshot.overlayRef}
      rulers={{
        ownerWindow,
        visible: enabled && features.rulers && rulersVisible,
        settings: settings.rulerSettings,
        interactive: !settingsOpen && !minimized,
        forceVisible: settingsOpen,
        onStartGuide: startGuideFromRuler,
        onMoveGuide: moveGuideFromRuler,
        onFinishGuide: finishGuideFromRuler,
        onCancelGuide: cancelGuideFromRuler,
        guides,
        selectedGuideIds,
      }}
      layoutGuides={layoutGuides}
      layoutGuidesVisible={layoutGuidesVisible}
      overlay={{
        enabled,
        interactive: overlayInteractive,
        minimized,
        toolMode,
        guidesEnabled,
        altPressed,
        isDragging,
        marqueeRect:
          isDragging && start && end ? getRectFromPoints(start, end) : null,
        groupBounds: movingGroupRect,
        groupFrameRotation: selectionIsGroup ? (groupRotateFrame?.rotation ?? 0) : 0,
        selectionCount,
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
        layoutDetailsEnabled: settings.layoutDetailsEnabled,
        pointers: {
          ...pointerHandlers,
        },
        selection: {
          activeRect,
          activeWidth,
          activeHeight,
          hoverRect: hoverRectToShow,
          hoverEdges: hoverEdgeVisibility,
          selected: displayedSelectedMeasurements,
          selectedEdges: selectedEdgeVisibility,
          selectorPreview:
            settings.infoCardMode === "hover" && hoverElement && hoverRect
              ? {
                  element: hoverElement,
                  rect: hoverRect,
                  copied: isSelectorCopied(hoverElement),
                }
              : null,
          ownerWindow,
          highlightColor: settings.highlightColor,
            selectedSelectorCopied: isSelectorCopied(selectedElement),
             selectedTypography,
             selectedMeasurementCount: selectedMeasurements.length,
             hideInfoCard: selectedMotionPlayable && !screenRecording.recording && !screenRecording.video,
          },
        distances: {
          held: heldDistances,
          optionPair: optionPairOverlay,
          guideDistance: guideDistanceOverlay,
          containerLines: optionContainerLines,
          onRemoveHeld: removeHeldDistance,
        },
        guides: {
          openMenu,
          setOpenMenu,
          items: overlayGuides,
          selectedIds: selectedGuideIds,
          moveOffset: selectionDragOffset,
           hover: hoverGuide,
           draggingId: draggingGuideId,
           highlightEnabled: settings.guideHighlightEnabled,
           selectEnabled: selectNewGuideEnabled,
           style: settings.guideStyle,
          pointerEvents:
            overlayInteractive && (toolMode !== "none" || (features.rulers && rulersVisible)),
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
           onRemoveGuides: removeGuides,
         },
        arrows: {
          items: arrows,
          selectedIds: selectedArrowIds,
          moveOffset: selectionDragOffset,
          preview: arrowsPointer.preview,
          scrollOffset,
          color: settings.arrowColor,
          onSelect: (id) => setSelectedArrowIdsPersisted([id]),
          onChange: (arrow) =>
            setArrowsPersisted((previous) =>
              previous.map((item) => (item.id === arrow.id ? arrow : item)),
            ),
          onChangeStart: recordSnapshot,
          editingArrowId: arrowsPointer.editingArrowId,
          interactive: overlayInteractive && toolMode === "selection",
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
          fontFamily: resolveTextFontFamily(settings.textStyle),
          color: settings.textStyle.color,
        },
        comments: comments.length > 0 || toolMode === "comments" ? {
          comments,
          commentFilter,
          rects: commentRuntimeSnapshot.rects,
          unresolvedIds: commentRuntimeSnapshot.unresolvedIds,
          hoverRect: commentRuntimeSnapshot.hoverRect,
          hoverPoint: commentRuntimeSnapshot.hoverPoint,
          draft: commentDraft,
          selectedId: selectedCommentId,
          draftText: commentPointer.draftText,
          onDraftTextChange: commentPointer.onDraftTextChange,
          onDraftKeyDown: commentPointer.onDraftKeyDown,
           onSelect: setSelectedCommentId,
           onClickComment: commentPointer.onClickComment,
          onClose: () => setSelectedCommentId(null),
          movingId: commentPointer.movingId,
          onStartMove: commentPointer.onStartMove,
          onMoveComment: commentPointer.onMoveComment,
           onEndMove: commentPointer.onEndMove,
           ownerDocument,
           onAddMessage: addCommentMessage,
            onToggleResolved: toggleResolvedComment,
            onDelete: deleteComment,
           onDeleteMessage: deleteCommentMessage,
           onEditMessage: updateCommentMessage,
           onDraftSubmit: commentPointer.onDraftSubmit,
           onDraftCancel: commentPointer.onDraftCancel,
        } : undefined,
      }}
        screenshot={screenRecording.selecting ? {
          active: true,
          mode: "recording",
          adjusting: screenRecording.adjusting,
          rect: screenRecording.rect,
          onConfirm: screenRecording.confirmRecording,
          viewport: screenRecording.viewportSize(),
          onSizeChange: screenRecording.setRectSize,
          onPositionChange: screenRecording.setRectPosition,
          onMoveStart: screenRecording.onMoveStart,
          onResizeStart: screenRecording.onResizeStart,
          onPointerDown: screenRecording.onPointerDown,
          onPointerMove: screenRecording.onPointerMove,
          onPointerUp: screenRecording.onPointerUp,
          onPointerCancel: screenRecording.onPointerCancel,
        } : {
          active: features.screenshot && screenshot.active,
          rect: features.screenshot ? screenshot.rect : null,
          onPointerDown: screenshot.handlePointerDown,
          onPointerMove: screenshot.handlePointerMove,
          onPointerUp: screenshot.handlePointerUp,
          onPointerCancel: screenshot.handlePointerCancel,
        }}
        screenRecording={{
          recording: screenRecording.recording,
          rect: screenRecording.recordingRect,
        }}
        toolbar={{
        eventTarget: ownerWindow,
        initialPosition: settings.toolbarPosition ?? initialState?.toolbarPosition ?? { x: 16, y: 16 },
        onPositionChange: settings.setToolbarPosition,
        dock: settings.toolbarDock,
        autoHide: settings.toolbarAutoHide,
        minimized,
        onInteract: activateToolbar,
        onRestore: restoreToolbar,
        onCancelTransient: clearAllTransientState,
        features,
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
          clearSelection,
        },
        layoutGuides: {
          items: layoutGuides,
          onChange: setLayoutGuidesWithHistory,
          onToggle: toggleLayoutGuides,
          visible: layoutGuidesVisible,
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
              formats={settings.colorPickerFormats}
              favoriteFormat={settings.colorPickerClickFormat}
              onClose={closeColorPicker}
            />
          ),
        },
        screenshot: {
          active: screenshot.active,
          error: screenshot.error,
          previewUrl: screenshot.previewUrl,
          copy: settings.screenshotSettings.copy,
          download: settings.screenshotSettings.download,
          shareMode: settings.screenshotSettings.shareMode,
          onClick: screenshot.toggleSelection,
          onCancel: screenshot.closeUi,
          onPreviewExited: screenshot.dismissPreview,
        },
        screenRecording: {
            selecting: screenRecording.selecting,
            recording: screenRecording.recording,
           elapsed: screenRecording.elapsed,
           error: screenRecording.error,
           panel: screenRecording.recording
             ? <ScreenRecordingTimer elapsed={screenRecording.elapsed} onStop={screenRecording.stop} />
             : screenRecording.video
               ? <ScreenRecordingEditor url={screenRecording.video.url} playerUrl={screenRecording.video.playerUrl} duration={screenRecording.video.duration} ownerDocument={ownerDocument} onDiscard={screenRecording.discard} onExport={screenRecording.exportClip} />
               : null,
           onClick: screenRecording.toggleSelection,
          onCancel: screenRecording.cancelSelection,
          onStop: screenRecording.stop,
         },
          motion: {
            element: motionElement,
            ownerWindow: motionElement?.ownerDocument.defaultView ?? ownerWindow,
             playable: selectedMotionPlayable,
              observedProperties: selectedObservedProperties,
              observedTargets: selectedObservedTargets,
             inspectDetails: (motionDetails) => displayedSelectedMeasurements[0] ? (
              <InspectInfoCard
                  embedded
                  motionDetails={motionDetails}
                ownerWindow={ownerWindow}
                rect={displayedSelectedMeasurements[0].rect}
                 element={motionElement}
                measurement={displayedSelectedMeasurements[0]}
                layoutDetailsEnabled={settings.layoutDetailsEnabled}
                copied={isSelectorCopied(selectedElement)}
                typography={selectedMeasurements.length === 1 ? selectedTypography : null}
              />
            ) : null,
          },
          comments: {
          count: comments.length,
          comments,
          unresolvedIds: commentRuntimeSnapshot.unresolvedIds,
          selectedId: selectedCommentId,
          onSelect: (id) => {
            setEnabled(true)
            setToolMode("comments")
            setSelectedCommentId(id)
            commentRuntime.getElement(id)?.scrollIntoView({ block: "center", inline: "center" })
          },
           onDelete: deleteComment,
           onDeleteAll: deleteAllComments,
           onResolveAll: resolveAllCommentsWithFeedback,
           onToggleResolved: toggleResolvedComment,
           statusFilter: commentFilter,
           onStatusFilterChange: setCommentFilterAndSelection,
          onCopy: copyAllComments,
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
                highlightColor: settings.highlightColor,
                setHighlightColor: settings.setHighlightColor,
                hoverHighlight: settings.hoverHighlightEnabled,
                setHoverHighlight: settings.setHoverHighlightEnabled,
                layoutDetailsEnabled: settings.layoutDetailsEnabled,
                setLayoutDetailsEnabled: settings.setLayoutDetailsEnabled,
                snapEnabled,
                setSnapEnabled,
                multiMeasureEnabled,
                setMultiMeasureEnabled,
                 infoCardMode: settings.infoCardMode,
                 setInfoCardMode: settings.setInfoCardMode,
              }}
              guides={{
                guideColor: settings.guideColor,
                setGuideColor: settings.setGuideColor,
                guideStyle: settings.guideStyle,
                setGuideStyle: settings.setGuideStyle,
                snapGuidesEnabled,
                setSnapGuidesEnabled,
                guideHighlightEnabled: settings.guideHighlightEnabled,
                setGuideHighlightEnabled: settings.setGuideHighlightEnabled,
                selectNewGuideEnabled,
                setSelectNewGuideEnabled,
              }}
              color={{
                colorFormats: settings.colorPickerFormats,
                setColorFormats: settings.setColorPickerFormats,
                colorClickFormat: settings.colorPickerClickFormat,
                setColorClickFormat: settings.setColorPickerClickFormat,
              }}
              camera={{
                settings: settings.screenshotSettings,
                setSettings: settings.setScreenshotSettings,
              }}
              rulers={{
                settings: settings.rulerSettings,
                setSettings: settings.setRulerSettings,
              }}
              text={{
                settings: settings.textStyle,
                setSettings: settings.setTextStyle,
              }}
              arrows={{
                color: settings.arrowColor,
                setColor: setArrowColor,
                snapArrowsEnabled,
                setSnapArrowsEnabled,
                arrowClickToPlace,
                setArrowClickToPlace,
              }}
              general={{
                persistOnReload: settings.persistOnReload,
                setPersistOnReload: settings.setPersistOnReload,
                shortcutsEnabled: settings.shortcutsEnabled,
                setShortcutsEnabled: settings.setShortcutsEnabled,
                theme: settings.theme,
                setTheme: settings.setTheme,
                toolbarDock: settings.toolbarDock,
                setToolbarDock: settings.setToolbarDock,
                toolbarAutoHide: settings.toolbarAutoHide,
                setToolbarAutoHide: settings.setToolbarAutoHide,
                onMinimize: minimizeMesurer,
                onResetSettings: resetSettings,
                onClearWorkspace: clearWorkspace,
              }}
            />
          ),
        },
        openMenu,
        setOpenMenu,
      }}
    />
  );
}
