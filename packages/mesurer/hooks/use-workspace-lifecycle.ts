import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  MesurerPersistence,
  MesurerPersistenceSnapshot,
  MesurerStoredSettings,
  MesurerStoredWorkspace,
  PersistenceChangeSource,
} from "../core/persistence";
import { createPersistedSetter } from "../core/persisted-setter";
import { isPointerDragActive } from "../core/pointer-drag";
import {
  sanitizeStoredSettings,
  stripDistance,
  stripMeasurement,
} from "../core/workspace";
import type { MesurerWorkspaceState } from "./use-mesurer-workspace-state";

type SettingsState = {
  persistOnReload: boolean;
  applyPersistedSettings: (settings: MesurerStoredSettings) => void;
  persistSettings: () => void;
};

type Options = {
  ownerWindow: Window;
  activePersistence: MesurerPersistence;
  settings: SettingsState;
  workspace: MesurerWorkspaceState;
  closeScreenshotRef: MutableRefObject<() => void>;
  clearWorkspaceTransientRef: MutableRefObject<() => void>;
  setSelectedTextIds: Dispatch<SetStateAction<string[]>>;
  applyingExternalPersistenceRef: MutableRefObject<boolean>;
  workspacePersistTimeoutRef: MutableRefObject<number | null>;
  storedState: MesurerPersistenceSnapshot | null;
};

export const useWorkspaceLifecycle = ({
  ownerWindow,
  activePersistence,
  settings,
  workspace,
  closeScreenshotRef,
  clearWorkspaceTransientRef,
  setSelectedTextIds,
  applyingExternalPersistenceRef,
  workspacePersistTimeoutRef,
  storedState,
}: Options) => {
  const {
    enabledRef,
    xrayVisibleRef,
    toolModeRef,
    rulersVisibleRef,
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
    textAnnotationsRef,
    selectedTextIdsRef,
    setEnabled,
    setXrayVisible,
    setToolMode,
    setRulersVisible,
    setGuideOrientation,
    setMeasurements,
    setActiveMeasurement,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setHeldDistances,
    setGuides,
    setSelectedGuideIds,
    setArrows,
    setSelectedArrowIds,
    setTextAnnotations,
    setPenStrokes,
    setSelectedPenStrokeIds,
    setSelectedElement,
    setHoverElement,
    setHoverRect,
    setHoverPointer,
    clearSelectionRect,
  } = workspace;

  const saveWorkspace = useCallback(() => {
    if (!settings.persistOnReload) return;
    const value: MesurerStoredWorkspace = {
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
      selectedPenStrokeIds: selectedPenStrokeIdsRef.current,
      textAnnotations: textAnnotationsRef.current,
      selectedTextIds: selectedTextIdsRef.current,
      measurements: measurementsRef.current.map(stripMeasurement),
      activeMeasurement: activeMeasurementRef.current
        ? stripMeasurement(activeMeasurementRef.current)
        : null,
      heldDistances: heldDistancesRef.current.map(stripDistance),
    };
    activePersistence.saveWorkspace(value);
  }, [
    activePersistence,
    enabledRef,
    guidesRef,
    measurementsRef,
    settings.persistOnReload,
    arrowsRef,
    selectedGuideIdsRef,
    selectedArrowIdsRef,
    penStrokesRef,
    selectedPenStrokeIdsRef,
    textAnnotationsRef,
    selectedTextIdsRef,
    activeMeasurementRef,
    heldDistancesRef,
    toolModeRef,
    xrayVisibleRef,
    rulersVisibleRef,
    guideOrientationRef,
  ]);

  const persistState = useCallback(() => {
    if (!settings.persistOnReload) return;
    if (isPointerDragActive()) return;
    if (workspacePersistTimeoutRef.current !== null)
      ownerWindow.clearTimeout(workspacePersistTimeoutRef.current);
    workspacePersistTimeoutRef.current = ownerWindow.setTimeout(() => {
      workspacePersistTimeoutRef.current = null;
      saveWorkspace();
    }, 250);
  }, [
    ownerWindow,
    saveWorkspace,
    settings.persistOnReload,
    workspacePersistTimeoutRef,
  ]);

  const clearPersistedWorkspace = useCallback(() => {
    clearWorkspaceTransientRef.current();
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
    selectedTextIdsRef.current = [];
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
    setSelectedTextIds([]);
  }, [
    closeScreenshotRef,
    clearWorkspaceTransientRef,
    setActiveMeasurement,
    setArrows,
    setEnabled,
    setGuideOrientation,
    setGuides,
    setHeldDistances,
    setMeasurements,
    setRulersVisible,
    setSelectedArrowIds,
    setSelectedGuideIds,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    setTextAnnotations,
    setToolMode,
    setXrayVisible,
    activeMeasurementRef,
    arrowsRef,
    guideOrientationRef,
    guidesRef,
    heldDistancesRef,
    measurementsRef,
    penStrokesRef,
    rulersVisibleRef,
    selectedArrowIdsRef,
    selectedGuideIdsRef,
    selectedPenStrokeIdsRef,
    textAnnotationsRef,
    toolModeRef,
    xrayVisibleRef,
  ]);

  const applyPersistedWorkspace = useCallback(
    (value: MesurerStoredWorkspace) => {
      enabledRef.current = value.enabled;
      toolModeRef.current = value.toolMode;
      rulersVisibleRef.current = value.rulersVisible;
      xrayVisibleRef.current = value.xrayVisible;
      guideOrientationRef.current = value.guideOrientation;
      measurementsRef.current = value.measurements;
      activeMeasurementRef.current = value.activeMeasurement;
      heldDistancesRef.current = value.heldDistances;
      guidesRef.current = value.guides;
      selectedGuideIdsRef.current = value.selectedGuideIds;
      arrowsRef.current = value.arrows;
      selectedArrowIdsRef.current = value.selectedArrowIds;
      penStrokesRef.current = value.penStrokes;
      selectedPenStrokeIdsRef.current = value.selectedPenStrokeIds ?? [];
      textAnnotationsRef.current = value.textAnnotations;
      selectedTextIdsRef.current = value.selectedTextIds ?? [];
      if (!value.enabled) closeScreenshotRef.current();
      setEnabled(value.enabled);
      setToolMode(value.toolMode);
      setRulersVisible(value.rulersVisible);
      setXrayVisible(value.xrayVisible);
      setGuideOrientation(value.guideOrientation);
      setMeasurements(value.measurements);
      setActiveMeasurement(value.activeMeasurement);
      setGuides(value.guides);
      setSelectedGuideIds(value.selectedGuideIds);
      setArrows(value.arrows);
      setSelectedArrowIds(value.selectedArrowIds);
      setPenStrokes(value.penStrokes);
      setSelectedPenStrokeIds(value.selectedPenStrokeIds ?? []);
      setTextAnnotations(value.textAnnotations);
      setSelectedTextIds(value.selectedTextIds ?? []);
      setHeldDistances(value.heldDistances);
    },
    [
      closeScreenshotRef,
      enabledRef,
      setActiveMeasurement,
      setArrows,
      setEnabled,
      setGuideOrientation,
      setGuides,
      setHeldDistances,
      setMeasurements,
      setPenStrokes,
      setRulersVisible,
      setSelectedArrowIds,
      setSelectedGuideIds,
      setSelectedPenStrokeIds,
      setSelectedTextIds,
      setTextAnnotations,
      setToolMode,
      setXrayVisible,
      activeMeasurementRef,
      arrowsRef,
      guideOrientationRef,
      guidesRef,
      heldDistancesRef,
      measurementsRef,
      penStrokesRef,
      selectedArrowIdsRef,
      selectedGuideIdsRef,
      selectedPenStrokeIdsRef,
      selectedTextIdsRef,
      textAnnotationsRef,
      toolModeRef,
      xrayVisibleRef,
    ],
  );

  const applyPersistenceSnapshot = useCallback(
    (
      snapshot: MesurerPersistenceSnapshot | null,
      source?: PersistenceChangeSource,
    ) => {
      if (!snapshot) return;
      applyingExternalPersistenceRef.current = true;
      const nextSettings = sanitizeStoredSettings(
        ownerWindow,
        snapshot.settings,
      );
      settings.applyPersistedSettings(nextSettings);
      if (
        source?.workspace !== false &&
        snapshot.workspace &&
        (nextSettings.persistOnReload ?? settings.persistOnReload)
      ) {
        applyPersistedWorkspace(snapshot.workspace);
      }
      ownerWindow.setTimeout(() => {
        applyingExternalPersistenceRef.current = false;
      }, 0);
    },
    [
      applyingExternalPersistenceRef,
      applyPersistedWorkspace,
      ownerWindow,
      settings,
    ],
  );

  const setToolModePersisted = useCallback(
    (value: Parameters<typeof setToolMode>[0]) => {
      const next =
        typeof value === "function" ? value(toolModeRef.current) : value;
      if (Object.is(next, toolModeRef.current)) return;
      toolModeRef.current = next;
      setToolMode(next);
      if (next !== "select") {
        setSelectedElement(null);
        setHoverElement(null);
        setHoverRect(null);
        setHoverPointer(null);
        setSelectedMeasurement(null);
        setSelectedMeasurements([]);
        clearSelectionRect();
      }
      persistState();
    },
    [
      clearSelectionRect,
      persistState,
      setHoverElement,
      setHoverPointer,
      setHoverRect,
      setSelectedElement,
      setSelectedMeasurement,
      setSelectedMeasurements,
      setToolMode,
      toolModeRef,
    ],
  );

  const usePersistedSetter = <T>(
    ref: MutableRefObject<T>,
    setter: Dispatch<SetStateAction<T>>,
  ) =>
    useCallback(createPersistedSetter(ref, setter, persistState), [
      persistState,
      ref,
      setter,
    ]);
  const setEnabledPersisted = useCallback(
    (value: Parameters<typeof setEnabled>[0]) => {
      const next =
        typeof value === "function" ? value(enabledRef.current) : value;
      if (!next) closeScreenshotRef.current();
      return createPersistedSetter(enabledRef, setEnabled, persistState)(next);
    },
    [closeScreenshotRef, enabledRef, persistState, setEnabled],
  );
  const setRulersVisiblePersisted = usePersistedSetter(
    rulersVisibleRef,
    setRulersVisible,
  );
  const setGuideOrientationPersisted = usePersistedSetter(
    guideOrientationRef,
    setGuideOrientation,
  );
  const setMeasurementsPersisted = usePersistedSetter(
    measurementsRef,
    setMeasurements,
  );
  const setActiveMeasurementPersisted = usePersistedSetter(
    activeMeasurementRef,
    setActiveMeasurement,
  );
  const setHeldDistancesPersisted = usePersistedSetter(
    heldDistancesRef,
    setHeldDistances,
  );
  const setGuidesPersisted = usePersistedSetter(guidesRef, setGuides);
  const setSelectedGuideIdsPersisted = usePersistedSetter(
    selectedGuideIdsRef,
    setSelectedGuideIds,
  );
  const setArrowsPersisted = usePersistedSetter(arrowsRef, setArrows);
  const setSelectedArrowIdsPersisted = usePersistedSetter(
    selectedArrowIdsRef,
    setSelectedArrowIds,
  );
  const setTextAnnotationsPersisted = usePersistedSetter(
    textAnnotationsRef,
    setTextAnnotations,
  );
  const setPenStrokesPersisted = usePersistedSetter(
    penStrokesRef,
    setPenStrokes,
  );
  const setSelectedPenStrokeIdsPersisted = usePersistedSetter(
    selectedPenStrokeIdsRef,
    setSelectedPenStrokeIds,
  );
  const setSelectedTextIdsPersisted = usePersistedSetter(
    selectedTextIdsRef,
    setSelectedTextIds,
  );

  const clearWorkspace = useCallback(() => {
    clearPersistedWorkspace();
    activePersistence.clearWorkspace();
  }, [activePersistence, clearPersistedWorkspace]);
  return {
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
    storedState,
  };
};
