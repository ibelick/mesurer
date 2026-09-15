import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CommentThread, DistanceOverlay, Guide, Measurement, Rect, TextAnnotation, ToolMode } from "../core/types";
import type { MesurerStoredWorkspace } from "../core/persistence";
import { useDragState } from "./use-drag-state";
import { useGuideState } from "./use-guide-state";
import { useMeasureToggles } from "./use-measure-toggles";
import { useMeasurementState } from "./use-measurement-state";
import { useMesurerLocalState } from "./use-mesurer-local-state";
import { useArrowState } from "./use-arrow-state";
import { usePenState } from "./use-pen-state";
import { useTextAnnotationState } from "./use-text-annotation-state";
import { useOverlayRefs } from "./use-overlay-refs";
import { useCommentState } from "../comments/state";

type UseMesurerWorkspaceStateOptions = {
  persistedState: MesurerStoredWorkspace | null;
  initialToolMode: ToolMode;
  snapEnabledDefault: boolean;
  snapGuidesEnabledDefault: boolean;
  snapArrowsEnabledDefault: boolean;
  arrowClickToPlaceDefault: boolean;
  selectNewGuideEnabledDefault: boolean;
  multiMeasureEnabledDefault: boolean;
  initialState?: Partial<MesurerStoredWorkspace> & { minimized?: boolean };
  initialComments?: CommentThread[];
  onCommentsChange?: (comments: CommentThread[]) => void;
};

export const useMesurerWorkspaceState = ({
  persistedState,
  initialToolMode,
  snapEnabledDefault,
  snapGuidesEnabledDefault,
  snapArrowsEnabledDefault,
  arrowClickToPlaceDefault,
  selectNewGuideEnabledDefault,
  multiMeasureEnabledDefault,
  initialState,
  initialComments,
  onCommentsChange,
}: UseMesurerWorkspaceStateOptions) => {
  const selectionRectRef = useRef<Rect | null>(null);
  const enabledRef = useRef(false);
  const toolModeRef = useRef<ToolMode>(
    persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode ?? initialState?.toolMode ?? initialToolMode,
  );
  const rulersVisibleRef = useRef(
    persistedState?.rulersVisible ?? initialState?.rulersVisible ?? persistedState?.toolMode === "rulers",
  );
  const xrayVisibleRef = useRef(
    persistedState?.xrayVisible ?? initialState?.xrayVisible ?? persistedState?.toolMode === "xray",
  );
  const guideOrientationRef = useRef<"vertical" | "horizontal">(
    persistedState?.guideOrientation ?? initialState?.guideOrientation ?? "vertical",
  );
  const measurementsRef = useRef<Measurement[]>(persistedState?.measurements ?? initialState?.measurements ?? []);
  const activeMeasurementRef = useRef<Measurement | null>(
    persistedState?.activeMeasurement ?? initialState?.activeMeasurement ?? null,
  );
  const heldDistancesRef = useRef<DistanceOverlay[]>(persistedState?.heldDistances ?? initialState?.heldDistances ?? []);
  const guidesRef = useRef<Guide[]>(persistedState?.guides ?? initialState?.guides ?? []);
  const selectedGuideIdsRef = useRef<string[]>(persistedState?.selectedGuideIds ?? initialState?.selectedGuideIds ?? []);
  const arrowsRef = useRef(persistedState?.arrows ?? initialState?.arrows ?? []);
  const selectedArrowIdsRef = useRef(persistedState?.selectedArrowIds ?? initialState?.selectedArrowIds ?? []);
  const penStrokesRef = useRef(persistedState?.penStrokes ?? initialState?.penStrokes ?? []);
  const selectedPenStrokeIdsRef = useRef<string[]>(persistedState?.selectedPenStrokeIds ?? initialState?.selectedPenStrokeIds ?? []);

  const { overlayRef, selectedElementRef, hoverElementRef } = useOverlayRefs();
  const localState = useMesurerLocalState({
    selectedElementRef,
    hoverElementRef,
    selectionRectRef,
  });
  const toggles = useMeasureToggles({
    initialEnabled: persistedState?.enabled ?? initialState?.enabled,
    initialToolMode:
      persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode ?? initialState?.toolMode ?? initialToolMode,
    initialRulersVisible:
      persistedState?.rulersVisible ?? initialState?.rulersVisible ?? persistedState?.toolMode === "rulers",
    initialSnapEnabled: snapEnabledDefault,
    initialSnapGuidesEnabled: snapGuidesEnabledDefault,
    initialSnapArrowsEnabled: snapArrowsEnabledDefault,
    initialArrowClickToPlace: arrowClickToPlaceDefault,
    initialSelectNewGuideEnabled: selectNewGuideEnabledDefault,
    initialMultiMeasureEnabled: multiMeasureEnabledDefault,
  });
  const drag = useDragState();
  const measurements = useMeasurementState({
    initialActiveMeasurement: persistedState?.activeMeasurement ?? initialState?.activeMeasurement ?? null,
    initialMeasurements: persistedState?.measurements ?? initialState?.measurements ?? [],
    initialHeldDistances: persistedState?.heldDistances ?? initialState?.heldDistances ?? [],
  });
  const guides = useGuideState({
    initialGuides: persistedState?.guides ?? initialState?.guides ?? [],
    initialSelectedGuideIds: persistedState?.selectedGuideIds ?? initialState?.selectedGuideIds ?? [],
  });
  const arrows = useArrowState({
    initialArrows: persistedState?.arrows ?? initialState?.arrows,
    initialSelectedArrowIds: persistedState?.selectedArrowIds ?? initialState?.selectedArrowIds,
  });
  const pen = usePenState(
    persistedState?.penStrokes ?? initialState?.penStrokes,
    persistedState?.selectedPenStrokeIds ?? initialState?.selectedPenStrokeIds,
  );
  const text = useTextAnnotationState(
    persistedState?.textAnnotations ?? initialState?.textAnnotations,
    persistedState?.selectedTextIds ?? initialState?.selectedTextIds,
  );
  const comments = useCommentState(initialComments ?? persistedState?.comments ?? initialState?.comments ?? [], onCommentsChange);
  const [toolbarActive, setToolbarActive] = useState(true);
  const [minimized, setMinimized] = useState(initialState?.minimized ?? false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [xrayVisible, setXrayVisible] = useState(xrayVisibleRef.current);
  const [guideOrientation, setGuideOrientation] = useState<"vertical" | "horizontal">(
    persistedState?.guideOrientation ?? initialState?.guideOrientation ?? "vertical",
  );

  return {
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
    overlayRef,
    selectedElementRef,
    hoverElementRef,
    ...localState,
    ...toggles,
    ...drag,
    ...measurements,
    ...guides,
    ...arrows,
    ...pen,
    ...text,
    ...comments,
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
  };
};

export type MesurerWorkspaceState = ReturnType<typeof useMesurerWorkspaceState>;
