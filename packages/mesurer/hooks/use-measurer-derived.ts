import { useMemo } from "react"
import { getDistanceOverlay } from "../distances"
import { getEdgeVisibilityForRects } from "../edge-visibility"
import { getGuideRect } from "../guides"
import {
  getHoveredGuide,
  getOptionContainerLines,
  getOptionPairOverlay,
  getSelectedGuide,
} from "../option-measurements"
import { getPrimarySelectedMeasurement } from "../selection-helpers"
import type { InspectMeasurement, Point, Rect } from "../types"
import { formatValue } from "../utils"

type UseMeasurerDerivedArgs = {
  start: Point | null
  end: Point | null
  selectedMeasurements: InspectMeasurement[]
  selectedMeasurement: InspectMeasurement | null
  selectionOriginRect: Rect | null
  guides: Array<{
    id: string
    orientation: "vertical" | "horizontal"
    position: number
  }>
  selectedGuideIds: string[]
  hoverPointer: Point | null
  hoverRect: Rect | null
  hoverElement: HTMLElement | null
  selectedElement: HTMLElement | null
  altPressed: boolean
  guidesEnabled: boolean
  guidePreview: {
    orientation: "vertical" | "horizontal"
    position: number
  } | null
  displayedMeasurements: Array<{ rect: Rect }>
  hoverHighlightEnabled: boolean
  highlightColor: string
  guideColor: string
}

export const useMeasurerDerived = ({
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
}: UseMeasurerDerivedArgs) => {
  const activeRect = useMemo(() => {
    if (!start || !end) return null
    return {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    }
  }, [end, start])

  const activeWidth = activeRect ? formatValue(activeRect.width) : 0
  const activeHeight = activeRect ? formatValue(activeRect.height) : 0

  const groupedSelection = useMemo(() => {
    if (selectedMeasurements.length <= 1) return null
    const selectionKey = selectedMeasurements
      .map((measurement) => measurement.id)
      .join("|")
    const rects = selectedMeasurements.map((measurement) => measurement.rect)
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    rects.forEach((rect) => {
      left = Math.min(left, rect.left)
      top = Math.min(top, rect.top)
      right = Math.max(right, rect.left + rect.width)
      bottom = Math.max(bottom, rect.top + rect.height)
    })
    const unionRect = {
      left,
      top,
      width: right - left,
      height: bottom - top,
    }
    const base = selectedMeasurements[selectedMeasurements.length - 1]
    return {
      ...base,
      id: `group-${selectionKey}`,
      rect: unionRect,
      paddingRect: unionRect,
      marginRect: unionRect,
      originRect: selectionOriginRect ?? undefined,
    }
  }, [selectedMeasurements, selectionOriginRect])

  const displayedSelectedMeasurements = useMemo(
    () =>
      groupedSelection
        ? [groupedSelection]
        : selectedMeasurements.length > 0
          ? selectedMeasurements
          : selectedMeasurement
            ? [selectedMeasurement]
            : [],
    [groupedSelection, selectedMeasurement, selectedMeasurements]
  )

  const selectedGuide = useMemo(
    () => getSelectedGuide(guides, selectedGuideIds),
    [guides, selectedGuideIds]
  )

  const hoverGuide = useMemo(
    () => getHoveredGuide(hoverPointer, guides),
    [guides, hoverPointer]
  )

  const primarySelectedMeasurement = useMemo(
    () =>
      getPrimarySelectedMeasurement(selectedMeasurements, selectedMeasurement),
    [selectedMeasurement, selectedMeasurements]
  )
  const effectivePrimarySelected =
    groupedSelection ?? primarySelectedMeasurement

  const optionPairOverlay = useMemo(() => {
    return getOptionPairOverlay({
      altPressed,
      primarySelectedMeasurement: effectivePrimarySelected,
      selectedGuide,
      hoverGuide,
      hoverElement,
      selectedElementRef: selectedElement,
    })
  }, [
    altPressed,
    effectivePrimarySelected,
    hoverElement,
    hoverGuide,
    selectedElement,
    selectedGuide,
  ])

  const optionContainerLines = useMemo(() => {
    return getOptionContainerLines({
      altPressed,
      primarySelectedMeasurement: effectivePrimarySelected,
      optionPairOverlay,
      selectedGuideIds,
      selectedElement,
      hoverElement,
    })
  }, [
    altPressed,
    effectivePrimarySelected,
    hoverElement,
    optionPairOverlay,
    selectedElement,
    selectedGuideIds,
  ])

  const guideDistanceOverlay = useMemo(() => {
    if (!altPressed || !guidesEnabled) return null

    if (
      selectedGuide &&
      hoverGuide &&
      selectedGuide.id !== hoverGuide.id
    ) {
      return getDistanceOverlay(
        getGuideRect(selectedGuide),
        getGuideRect(hoverGuide)
      )
    }

    if (!guidePreview) return null

    const previewGuide = {
      id: "preview",
      orientation: guidePreview.orientation,
      position: guidePreview.position,
    }
    const sameOrientation = guides.filter(
      (guide) => guide.orientation === guidePreview.orientation
    )
    if (sameOrientation.length === 0) return null

    const nearest = sameOrientation.reduce(
      (closest, guide) => {
        const distance = Math.abs(guide.position - previewGuide.position)
        if (!closest) return { guide, distance }
        return distance < closest.distance ? { guide, distance } : closest
      },
      null as {
        guide: (typeof sameOrientation)[number]
        distance: number
      } | null
    )

    if (!nearest) return null
    return getDistanceOverlay(
      getGuideRect(previewGuide),
      getGuideRect(nearest.guide)
    )
  }, [
    altPressed,
    guidePreview,
    guides,
    guidesEnabled,
    hoverGuide,
    selectedGuide,
  ])

  const {
    outlineColor,
    fillColor,
    guideColorActive,
    guideColorHover,
    guideColorDefault,
    guideColorPreview,
  } = useMemo(
    () => ({
      outlineColor: `color-mix(in oklch, ${highlightColor} 80%, transparent)`,
      fillColor: `color-mix(in oklch, ${highlightColor} 8%, transparent)`,
      guideColorActive: `color-mix(in oklch, ${guideColor} 100%, transparent)`,
      guideColorHover: `color-mix(in oklch, ${guideColor} 90%, transparent)`,
      guideColorDefault: `color-mix(in oklch, ${guideColor} 70%, transparent)`,
      guideColorPreview: `color-mix(in oklch, ${guideColor} 50%, transparent)`,
    }),
    [guideColor, highlightColor]
  )

  const selectedRects = useMemo(
    () => displayedSelectedMeasurements.map((measurement) => measurement.rect),
    [displayedSelectedMeasurements]
  )

  const hoverRectToShow =
    hoverHighlightEnabled && hoverRect && selectedMeasurements.length <= 1
      ? hoverRect
      : null

  const selectionEdgeVisibility = useMemo(
    () => getEdgeVisibilityForRects(selectedRects),
    [selectedRects]
  )

  const selectedEdgeVisibility = selectionEdgeVisibility.slice(
    0,
    selectedRects.length
  )

  const hoverEdgeVisibility = hoverRectToShow
    ? { top: true, right: true, bottom: true, left: true }
    : null

  const measurementEdgeVisibility = useMemo(
    () => getEdgeVisibilityForRects(displayedMeasurements.map((m) => m.rect)),
    [displayedMeasurements]
  )

  return {
    activeRect,
    activeWidth,
    activeHeight,
    displayedSelectedMeasurements,
    selectedGuide,
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
  }
}
