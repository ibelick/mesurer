import { useCallback, useRef } from "react"
import type { SetStateAction } from "react"
import type {
  DistanceOverlay,
  Guide,
  InspectMeasurement,
  Measurement,
  ToolMode,
} from "../types"

type GuideOrientation = "vertical" | "horizontal"

type MeasurerSnapshot = {
  enabled: boolean
  toolMode: ToolMode
  guideOrientation: GuideOrientation
  measurements: Measurement[]
  activeMeasurement: Measurement | null
  selectedMeasurements: InspectMeasurement[]
  selectedMeasurement: InspectMeasurement | null
  heldDistances: DistanceOverlay[]
  guides: Guide[]
  selectedGuideIds: string[]
  draggingGuideId: string | null
}

type UseMeasurerHistoryArgs = {
  toggles: {
    enabled: boolean
    setEnabled: (value: SetStateAction<boolean>) => void
    toolMode: ToolMode
    setToolMode: (value: SetStateAction<ToolMode>) => void
    guideOrientation: GuideOrientation
    setGuideOrientation: (value: SetStateAction<GuideOrientation>) => void
  }
  measurements: {
    measurements: Measurement[]
    setMeasurements: (value: SetStateAction<Measurement[]>) => void
    activeMeasurement: Measurement | null
    setActiveMeasurement: (value: SetStateAction<Measurement | null>) => void
    selectedMeasurements: InspectMeasurement[]
    setSelectedMeasurements: (
      value: SetStateAction<InspectMeasurement[]>
    ) => void
    selectedMeasurement: InspectMeasurement | null
    setSelectedMeasurement: (
      value: SetStateAction<InspectMeasurement | null>
    ) => void
    heldDistances: DistanceOverlay[]
    setHeldDistances: (value: SetStateAction<DistanceOverlay[]>) => void
  }
  guides: {
    guides: Guide[]
    setGuides: (value: SetStateAction<Guide[]>) => void
    selectedGuideIds: string[]
    setSelectedGuideIds: (value: SetStateAction<string[]>) => void
    draggingGuideId: string | null
    setDraggingGuideId: (value: SetStateAction<string | null>) => void
  }
  transient: {
    setStart: (value: SetStateAction<{ x: number; y: number } | null>) => void
    setEnd: (value: SetStateAction<{ x: number; y: number } | null>) => void
    setIsDragging: (value: SetStateAction<boolean>) => void
    setGuidePreview: (
      value: SetStateAction<{
        orientation: "vertical" | "horizontal"
        position: number
      } | null>
    ) => void
    setHoverRect: (
      value: SetStateAction<{
        left: number
        top: number
        width: number
        height: number
      } | null>
    ) => void
    setHoverElement: (value: HTMLElement | null) => void
    setSelectedElement: (value: HTMLElement | null) => void
    clearSelectionRect: () => void
  }
}

const HISTORY_LIMIT = 50

export const useMeasurerHistory = ({
  toggles,
  measurements,
  guides,
  transient,
}: UseMeasurerHistoryArgs) => {
  const {
    enabled,
    setEnabled,
    toolMode,
    setToolMode,
    guideOrientation,
    setGuideOrientation,
  } = toggles
  const {
    measurements: measurementEntries,
    setMeasurements,
    activeMeasurement,
    setActiveMeasurement,
    selectedMeasurements,
    setSelectedMeasurements,
    selectedMeasurement,
    setSelectedMeasurement,
    heldDistances,
    setHeldDistances,
  } = measurements
  const {
    guides: guideEntries,
    setGuides,
    selectedGuideIds,
    setSelectedGuideIds,
    draggingGuideId,
    setDraggingGuideId,
  } = guides
  const {
    setStart,
    setEnd,
    setIsDragging,
    setGuidePreview,
    setHoverRect,
    setHoverElement,
    setSelectedElement,
    clearSelectionRect,
  } = transient

  const historyRef = useRef<MeasurerSnapshot[]>([])
  const futureRef = useRef<MeasurerSnapshot[]>([])
  const historySignatureRef = useRef<string | null>(null)

  const captureSnapshot = useCallback((): MeasurerSnapshot => {
    return {
      enabled,
      toolMode,
      guideOrientation,
      measurements: [...measurementEntries],
      activeMeasurement,
      selectedMeasurements: [...selectedMeasurements],
      selectedMeasurement,
      heldDistances: [...heldDistances],
      guides: [...guideEntries],
      selectedGuideIds: [...selectedGuideIds],
      draggingGuideId,
    }
  }, [
    activeMeasurement,
    draggingGuideId,
    enabled,
    guideOrientation,
    guideEntries,
    heldDistances,
    measurementEntries,
    selectedGuideIds,
    selectedMeasurement,
    selectedMeasurements,
    toolMode,
  ])

  const getSnapshotSignature = useCallback((snapshot: MeasurerSnapshot) => {
    const serializeRect = (rect: {
      left: number
      top: number
      width: number
      height: number
    }) =>
      `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`
    return [
      snapshot.enabled ? "1" : "0",
      snapshot.toolMode,
      snapshot.guideOrientation,
      snapshot.measurements
        .map((item) => `${item.id}@${serializeRect(item.rect)}`)
        .join(","),
      snapshot.activeMeasurement
        ? `${snapshot.activeMeasurement.id}@${serializeRect(snapshot.activeMeasurement.rect)}`
        : "",
      snapshot.selectedMeasurements
        .map((item) => `${item.id}@${serializeRect(item.rect)}`)
        .join(","),
      snapshot.selectedMeasurement
        ? `${snapshot.selectedMeasurement.id}@${serializeRect(snapshot.selectedMeasurement.rect)}`
        : "",
      snapshot.heldDistances.map((item) => item.id).join(","),
      snapshot.guides.map((item) => `${item.id}:${item.position}`).join(","),
      snapshot.selectedGuideIds.join(","),
      snapshot.draggingGuideId ?? "",
    ].join("|")
  }, [])

  const recordSnapshot = useCallback(() => {
    const snapshot = captureSnapshot()
    const signature = getSnapshotSignature(snapshot)
    if (historySignatureRef.current === signature) return
    historyRef.current.push(snapshot)
    futureRef.current = []
    historySignatureRef.current = signature
    if (historyRef.current.length > HISTORY_LIMIT) {
      historyRef.current.shift()
    }
  }, [captureSnapshot, getSnapshotSignature])

  const restoreSnapshot = useCallback(
    (snapshot: MeasurerSnapshot) => {
      setEnabled(snapshot.enabled)
      setToolMode(snapshot.toolMode)
      setGuideOrientation(snapshot.guideOrientation)
      setMeasurements(snapshot.measurements)
      setActiveMeasurement(snapshot.activeMeasurement)
      setSelectedMeasurements(snapshot.selectedMeasurements)
      setSelectedMeasurement(snapshot.selectedMeasurement)
      setHeldDistances(snapshot.heldDistances)
      setGuides(snapshot.guides)
      setSelectedGuideIds(snapshot.selectedGuideIds)
      setDraggingGuideId(snapshot.draggingGuideId)
      setStart(null)
      setEnd(null)
      setIsDragging(false)
      setGuidePreview(null)
      setHoverRect(null)
      setHoverElement(null)
      clearSelectionRect()
      const nextSelectedElement =
        snapshot.selectedMeasurement?.elementRef ??
        snapshot.selectedMeasurements[snapshot.selectedMeasurements.length - 1]
          ?.elementRef ??
        null
      setSelectedElement(nextSelectedElement)
    },
    [
      clearSelectionRect,
      setActiveMeasurement,
      setDraggingGuideId,
      setEnabled,
      setEnd,
      setGuideOrientation,
      setGuidePreview,
      setGuides,
      setHeldDistances,
      setHoverRect,
      setIsDragging,
      setMeasurements,
      setSelectedGuideIds,
      setSelectedMeasurement,
      setSelectedMeasurements,
      setSelectedElement,
      setStart,
      setToolMode,
      setHoverElement,
    ]
  )

  const undo = useCallback(() => {
    const previousSnapshot = historyRef.current.pop()
    if (!previousSnapshot) return
    const currentSnapshot = captureSnapshot()
    futureRef.current.push(currentSnapshot)
    if (futureRef.current.length > HISTORY_LIMIT) {
      futureRef.current.shift()
    }
    historySignatureRef.current = null
    restoreSnapshot(previousSnapshot)
  }, [captureSnapshot, restoreSnapshot])

  const redo = useCallback(() => {
    const nextSnapshot = futureRef.current.pop()
    if (!nextSnapshot) return
    historyRef.current.push(captureSnapshot())
    if (historyRef.current.length > HISTORY_LIMIT) {
      historyRef.current.shift()
    }
    historySignatureRef.current = null
    restoreSnapshot(nextSnapshot)
  }, [captureSnapshot, restoreSnapshot])

  const setToolModeWithHistory = useCallback(
    (value: SetStateAction<ToolMode>) => {
      setToolMode((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        if (next === prev) return prev
        recordSnapshot()
        return next
      })
    },
    [recordSnapshot, setToolMode]
  )

  const setGuideOrientationWithHistory = useCallback(
    (value: SetStateAction<GuideOrientation>) => {
      setGuideOrientation((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        if (next === prev) return prev
        recordSnapshot()
        return next
      })
    },
    [recordSnapshot, setGuideOrientation]
  )

  const setEnabledWithHistory = useCallback(
    (value: SetStateAction<boolean>) => {
      setEnabled((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        if (next === prev) return prev
        recordSnapshot()
        return next
      })
    },
    [recordSnapshot, setEnabled]
  )

  const createActionCommit = useCallback(() => {
    let committed = false
    return () => {
      if (committed) return
      recordSnapshot()
      committed = true
    }
  }, [recordSnapshot])

  return {
    recordSnapshot,
    createActionCommit,
    setToolModeWithHistory,
    setGuideOrientationWithHistory,
    setEnabledWithHistory,
    undo,
    redo,
  }
}
