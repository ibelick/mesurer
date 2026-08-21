import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DistanceOverlay, Guide, Measurement, Rect, ToolMode } from "../core/types";
import type { MesurerStoredWorkspace } from "../core/persistence";
import { useDragState } from "./use-drag-state";
import { useGuideState } from "./use-guide-state";
import { useMeasureToggles } from "./use-measure-toggles";
import { useMeasurementState } from "./use-measurement-state";
import { useMesurerLocalState } from "./use-mesurer-local-state";
import { useArrowState } from "./use-arrow-state";
import { useOverlayRefs } from "./use-overlay-refs";

type UseMesurerWorkspaceStateOptions = {
  persistedState: MesurerStoredWorkspace | null;
  snapEnabledDefault: boolean;
  snapGuidesEnabledDefault: boolean;
  selectNewGuideEnabledDefault: boolean;
  multiMeasureEnabledDefault: boolean;
};

export const useMesurerWorkspaceState = ({
  persistedState,
  snapEnabledDefault,
  snapGuidesEnabledDefault,
  selectNewGuideEnabledDefault,
  multiMeasureEnabledDefault,
}: UseMesurerWorkspaceStateOptions) => {
  const selectionRectRef = useRef<Rect | null>(null);
  const enabledRef = useRef(false);
  const toolModeRef = useRef<ToolMode>(
    persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode ?? "none",
  );
  const rulersVisibleRef = useRef(
    persistedState?.rulersVisible ?? persistedState?.toolMode === "rulers",
  );
  const xrayVisibleRef = useRef(
    persistedState?.xrayVisible ?? persistedState?.toolMode === "xray",
  );
  const guideOrientationRef = useRef<"vertical" | "horizontal">(
    persistedState?.guideOrientation ?? "vertical",
  );
  const measurementsRef = useRef<Measurement[]>(persistedState?.measurements ?? []);
  const activeMeasurementRef = useRef<Measurement | null>(
    persistedState?.activeMeasurement ?? null,
  );
  const heldDistancesRef = useRef<DistanceOverlay[]>(persistedState?.heldDistances ?? []);
  const guidesRef = useRef<Guide[]>(persistedState?.guides ?? []);
  const selectedGuideIdsRef = useRef<string[]>(persistedState?.selectedGuideIds ?? []);
  const arrowsRef = useRef(persistedState?.arrows ?? []);
  const selectedArrowIdsRef = useRef(persistedState?.selectedArrowIds ?? []);

  const { overlayRef, selectedElementRef, hoverElementRef } = useOverlayRefs();
  const localState = useMesurerLocalState({
    selectedElementRef,
    hoverElementRef,
    selectionRectRef,
  });
  const toggles = useMeasureToggles({
    initialEnabled: persistedState?.enabled,
    initialToolMode:
      persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode,
    initialRulersVisible:
      persistedState?.rulersVisible ?? persistedState?.toolMode === "rulers",
    initialSnapEnabled: snapEnabledDefault,
    initialSnapGuidesEnabled: snapGuidesEnabledDefault,
    initialSelectNewGuideEnabled: selectNewGuideEnabledDefault,
    initialMultiMeasureEnabled: multiMeasureEnabledDefault,
  });
  const drag = useDragState();
  const measurements = useMeasurementState({
    initialActiveMeasurement: persistedState?.activeMeasurement ?? null,
    initialMeasurements: persistedState?.measurements ?? [],
    initialHeldDistances: persistedState?.heldDistances ?? [],
  });
  const guides = useGuideState({
    initialGuides: persistedState?.guides ?? [],
    initialSelectedGuideIds: persistedState?.selectedGuideIds ?? [],
  });
  const arrows = useArrowState({
    initialArrows: persistedState?.arrows,
    initialSelectedArrowIds: persistedState?.selectedArrowIds,
  });
  const [toolbarActive, setToolbarActive] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [xrayVisible, setXrayVisible] = useState(xrayVisibleRef.current);
  const [guideOrientation, setGuideOrientation] = useState<"vertical" | "horizontal">(
    persistedState?.guideOrientation ?? "vertical",
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
    overlayRef,
    selectedElementRef,
    hoverElementRef,
    ...localState,
    ...toggles,
    ...drag,
    ...measurements,
    ...guides,
    ...arrows,
    toolbarActive,
    setToolbarActive,
    settingsOpen,
    setSettingsOpen,
    xrayVisible,
    setXrayVisible,
    guideOrientation,
    setGuideOrientation,
  };
};

export type MesurerWorkspaceState = ReturnType<typeof useMesurerWorkspaceState>;
