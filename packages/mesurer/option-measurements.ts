import { GUIDE_SNAP_DISTANCE } from "./constants"
import { getDistanceOverlay } from "./distances"
import { getRectFromDom } from "./dom"
import { getGuideDistance, getGuideRect } from "./guides"
import type { Guide, InspectMeasurement, OptionTarget, Point } from "./types"

export const getHoveredGuide = (point: Point | null, guides: Guide[]) => {
  if (!point || guides.length === 0) return null
  let closest: Guide | null = null
  let closestDistance = GUIDE_SNAP_DISTANCE + 1
  for (const guide of guides) {
    const distance = getGuideDistance(guide, point)
    if (distance > GUIDE_SNAP_DISTANCE) continue
    if (distance < closestDistance) {
      closest = guide
      closestDistance = distance
    }
  }
  return closest
}

export const getSelectedGuide = (
  guides: Guide[],
  selectedGuideIds: string[]
) => {
  if (selectedGuideIds.length === 0) return null
  const lastId = selectedGuideIds[selectedGuideIds.length - 1]
  return guides.find((guide) => guide.id === lastId) ?? null
}

export const getOptionPairOverlay = (params: {
  altPressed: boolean
  primarySelectedMeasurement: InspectMeasurement | null
  selectedGuide: Guide | null
  hoverGuide: Guide | null
  hoverElement: HTMLElement | null
  selectedElementRef: HTMLElement | null
}) => {
  if (!params.altPressed) return null
  if (!params.selectedGuide && !params.primarySelectedMeasurement) return null

  const selectedElement = params.selectedGuide
    ? null
    : (params.primarySelectedMeasurement.elementRef ??
      params.selectedElementRef ??
      null)

  const selectedTarget: OptionTarget | null = params.selectedGuide
    ? {
        rect: getGuideRect(params.selectedGuide),
        guideId: params.selectedGuide.id,
      }
    : selectedElement
      ? params.primarySelectedMeasurement
      ? {
          rect: params.primarySelectedMeasurement.rect,
          element: selectedElement,
        }
      : null
      : null

  const hoverTarget: OptionTarget | null = params.hoverGuide
    ? { rect: getGuideRect(params.hoverGuide), guideId: params.hoverGuide.id }
    : params.hoverElement
      ? {
          rect: getRectFromDom(params.hoverElement),
          element: params.hoverElement,
        }
      : null

  if (!selectedTarget || !hoverTarget) return null

  if (selectedTarget.element && hoverTarget.element) {
    if (
      selectedTarget.element === hoverTarget.element ||
      selectedTarget.element.contains(hoverTarget.element) ||
      hoverTarget.element.contains(selectedTarget.element)
    ) {
      return null
    }
  }

  if (
    selectedTarget.guideId &&
    hoverTarget.guideId &&
    selectedTarget.guideId === hoverTarget.guideId
  ) {
    return null
  }

  return getDistanceOverlay(
    selectedTarget.rect,
    hoverTarget.rect,
    selectedTarget.element ?? null,
    hoverTarget.element ?? null
  )
}

export const getOptionContainerLines = (params: {
  altPressed: boolean
  primarySelectedMeasurement: InspectMeasurement | null
  optionPairOverlay: ReturnType<typeof getDistanceOverlay> | null
  selectedGuideIds: string[]
  selectedElement: HTMLElement | null
  hoverElement: HTMLElement | null
}) => {
  if (
    !params.altPressed ||
    !params.primarySelectedMeasurement ||
    params.optionPairOverlay
  )
    return null
  if (params.selectedGuideIds.length > 0) return null

  let containerElement: HTMLElement | null =
    params.selectedElement?.parentElement ?? null
  if (
    params.selectedElement &&
    params.hoverElement &&
    params.hoverElement !== params.selectedElement &&
    params.hoverElement.contains(params.selectedElement)
  ) {
    containerElement = params.hoverElement
  }

  const containerRect =
    containerElement &&
    containerElement !== document.body &&
    containerElement !== document.documentElement
      ? getRectFromDom(containerElement)
      : {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        }

  const rect = params.primarySelectedMeasurement.rect
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const containerRight = containerRect.left + containerRect.width
  const containerBottom = containerRect.top + containerRect.height

  const lineX = Math.max(containerRect.left, Math.min(centerX, containerRight))
  const lineY = Math.max(containerRect.top, Math.min(centerY, containerBottom))

  return {
    top: {
      y1: containerRect.top,
      y2: rect.top,
      x: lineX,
      value: Math.max(0, rect.top - containerRect.top),
    },
    bottom: {
      y1: bottom,
      y2: containerBottom,
      x: lineX,
      value: Math.max(0, containerBottom - bottom),
    },
    left: {
      x1: containerRect.left,
      x2: rect.left,
      y: lineY,
      value: Math.max(0, rect.left - containerRect.left),
    },
    right: {
      x1: right,
      x2: containerRight,
      y: lineY,
      value: Math.max(0, containerRight - right),
    },
  }
}
