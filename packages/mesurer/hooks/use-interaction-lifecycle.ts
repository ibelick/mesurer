import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  Arrow,
  Guide,
  InspectMeasurement,
  PenStroke,
  Point,
  Rect,
  TextAnnotation,
  ToolMode,
} from "../core/types";
import type { TextDraft } from "./use-annotation-callbacks";
import { useHotkeys } from "./use-hotkeys";
import { useOverlayKeyboard } from "./use-overlay-keyboard";

type Options = {
  enabled: boolean;
  toolMode: ToolMode;
  xrayVisible: boolean;
  rulersVisible: boolean;
  toolbarActive: boolean;
  minimized: boolean;
  shortcutsEnabled: boolean;
  settingsOpen: boolean;
  ownerDocument: Document;
  ownerWindow: Window;
  toolbarRef: MutableRefObject<HTMLDivElement | null>;
  overlayRef: MutableRefObject<HTMLDivElement | null>;
  scrollOffset: Point;
  guides: Guide[];
  arrows: Arrow[];
  penStrokes: PenStroke[];
  textAnnotations: TextAnnotation[];
  selectedGuideIds: string[];
  selectedArrowIds: string[];
  selectedPenStrokeIds: string[];
  selectedTextIds: string[];
  selectedMeasurements: InspectMeasurement[];
  selectedMeasurement: InspectMeasurement | null;
  selectedElement: Element | null;
  start: Point | null;
  arrowStart: Point | null;
  draggingGuideId: string | null;
  isDragging: boolean;
  textDraft: TextDraft | null;
  textDraftRef: MutableRefObject<TextDraft | null>;
  setTextDraft: Dispatch<SetStateAction<TextDraft | null>>;
  setStart: Dispatch<SetStateAction<Point | null>>;
  setEnd: Dispatch<SetStateAction<Point | null>>;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  setHoverRect: Dispatch<SetStateAction<Rect | null>>;
  setHoverPointer: Dispatch<SetStateAction<Point | null>>;
  setHoverElement: (element: Element | null) => void;
  setSelectedElement: (element: Element | null) => void;
  setArrowStart: Dispatch<SetStateAction<Point | null>>;
  setArrowMiddle: Dispatch<SetStateAction<Point | null>>;
  setArrowPreviewEnd: Dispatch<SetStateAction<Point | null>>;
  setXrayVisible: Dispatch<SetStateAction<boolean>>;
  setAltPressed: Dispatch<SetStateAction<boolean>>;
  pinDistance: () => boolean;
  setToolMode: (mode: ToolMode) => void;
  clearSelectionRect: () => void;
  clearGuideDragHold: () => void;
  cancelArrowInteraction: () => void;
  cancelPenInteraction: () => void;
  cancelMoveSession: () => void;
  hasArrowInteraction: () => boolean;
  hasPenInteraction: () => boolean;
  clearSelection: () => void;
  recordSnapshot: () => void;
  setSelectedGuideIds: Dispatch<SetStateAction<string[]>>;
  setSelectedArrowIds: Dispatch<SetStateAction<string[]>>;
  setSelectedTextIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPenStrokeIds: Dispatch<SetStateAction<string[]>>;
  setSelectedMeasurements: Dispatch<SetStateAction<InspectMeasurement[]>>;
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>;
  screenshot: {
    active: boolean;
    previewUrl: string | null;
    closeUi: () => void;
    toggleSelection: () => void;
  };
  colorPicker: {
    active: boolean;
    setActive: (active: boolean) => void;
    open: () => Promise<void>;
  };
  undo: () => void;
  redo: () => void;
  removeSelected: () => boolean;
  selectAllAnnotations: () => boolean;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  setRulersVisible: Dispatch<SetStateAction<boolean>>;
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>;
  onInteract: () => void;
  onMinimize: () => void;
  onToggleSettings: () => void;
  dismissInspectorPins: () => boolean;
};

export const useInteractionLifecycle = (options: Options) => {
  const {
    setStart,
    setEnd,
    setIsDragging,
    clearSelectionRect,
    clearGuideDragHold,
    setHoverRect,
    setHoverPointer,
    setHoverElement,
    setSelectedElement,
    setArrowStart,
    setArrowMiddle,
    setArrowPreviewEnd,
    setTextDraft,
  } = options;

  const clearTransientState = useCallback(() => {
    options.cancelArrowInteraction();
    options.cancelPenInteraction();
    options.cancelMoveSession();
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
    if (options.textDraftRef.current) {
      options.textDraftRef.current = null;
      setTextDraft(null);
    }
  }, [
    clearGuideDragHold,
    clearSelectionRect,
    options,
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
        options.arrowStart ||
          options.textDraft ||
          options.isDragging ||
          options.start ||
          options.draggingGuideId ||
          options.hasArrowInteraction() ||
          options.hasPenInteraction(),
      ),
    [options],
  );
  const isToolbarIdle = useCallback(
    () =>
      options.toolMode === "none" &&
      !options.xrayVisible &&
      !options.rulersVisible,
    [options],
  );
  const isActiveToolMode = useCallback(
    () =>
      options.toolMode !== "none" ||
      options.xrayVisible ||
      options.rulersVisible,
    [options],
  );
  const hasSelection = useCallback(
    () =>
      options.selectedGuideIds.length > 0 ||
      options.selectedArrowIds.length > 0 ||
      options.selectedTextIds.length > 0 ||
      options.selectedPenStrokeIds.length > 0,
    [options],
  );
  const exitActiveTool = useCallback(() => {
    clearTransientState();
    options.clearSelection();
    options.setXrayVisible(false);
    options.setRulersVisible(false);
    options.setToolMode("none");
  }, [clearTransientState, options]);
  const exitMesurerCompletely = useCallback(() => {
    clearTransientState();
    options.clearSelection();
    options.colorPicker.setActive(false);
    options.screenshot.closeUi();
    options.setXrayVisible(false);
    options.setRulersVisible(false);
    options.setToolMode("none");
  }, [clearTransientState, options]);

  const keyboardOwned =
    options.enabled &&
    !options.minimized &&
    (options.toolMode !== "none" || options.toolbarActive);
  const overlayActive =
    options.enabled && (options.toolMode !== "none" || options.toolbarActive);

  useOverlayKeyboard({
    eventTarget: options.ownerWindow,
    overlayActive: keyboardOwned,
  });

  useHotkeys({
    eventTarget: options.ownerWindow,
    overlayRef: options.overlayRef,
    enabled: options.enabled,
    clearTransientState,
    hasTransientInteraction,
    isActiveToolMode,
    isToolbarIdle,
    hasSelection,
    clearSelection: options.clearSelection,
    exitActiveTool,
    dismissInspectorPins: options.dismissInspectorPins,
    minimizeMesurer: options.onMinimize,
    shortcutsEnabled: options.shortcutsEnabled,
    minimized: options.minimized,
    undo: options.undo,
    redo: options.redo,
    removeSelected: options.removeSelected,
    selectAllAnnotations: options.selectAllAnnotations,
    setEnabled: options.setEnabled,
    setToolMode: options.setToolMode as Dispatch<SetStateAction<ToolMode>>,
    setXrayVisible: options.setXrayVisible,
    setRulersVisible: options.setRulersVisible,
    setAltPressed: options.setAltPressed,
    pinDistance: options.pinDistance,
    isOverlayActive: () => overlayActive,
    setGuideOrientation: options.setGuideOrientation,
    onInteract: options.onInteract,
    onColorPicker: () => {
      options.screenshot.closeUi();
      void options.colorPicker.open();
    },
    onScreenshot: options.screenshot.toggleSelection,
    onCloseScreenshot: options.screenshot.closeUi,
    isScreenshotActive: () =>
      options.screenshot.active || Boolean(options.screenshot.previewUrl),
    onToggleXray: () => {
      options.setEnabled(true);
      options.colorPicker.setActive(false);
      options.screenshot.closeUi();
      options.setXrayVisible((previous) => {
        const next = !previous;
        if (
          next &&
          (options.toolMode === "selection" ||
            options.toolMode === "arrows" ||
            options.toolMode === "pen" ||
            options.toolMode === "text")
        ) {
          options.setToolMode("select");
        }
        return next;
      });
    },
    onToggleRulers: () => {
      options.setEnabled(true);
      options.colorPicker.setActive(false);
      options.screenshot.closeUi();
      options.setRulersVisible((previous) => {
        const next = !previous;
        if (
          next &&
          (options.toolMode === "selection" ||
            options.toolMode === "arrows" ||
            options.toolMode === "pen" ||
            options.toolMode === "text")
        ) {
          options.setToolMode("select");
        }
        return next;
      });
    },
    onToggleSettings: options.onToggleSettings,
    isSettingsOpen: () => options.settingsOpen,
    onCloseColorPicker: () => options.colorPicker.setActive(false),
    isColorPickerActive: () => options.colorPicker.active,
  });

  return {
    clearTransientState,
    hasTransientInteraction,
    exitActiveTool,
    exitMesurerCompletely,
  };
};
