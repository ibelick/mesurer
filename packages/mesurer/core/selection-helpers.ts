import { getRectFromDom } from "./dom"
import type { InspectMeasurement, Point } from "./types"

const getOverlayHost = (overlayNode: HTMLDivElement | null) => {
  if (!overlayNode) return null
  const rootNode = overlayNode.getRootNode()
  return rootNode.nodeType === 11 ? (rootNode as ShadowRoot).host : null
}

export const getPrimarySelectedMeasurement = (
  selectedMeasurements: InspectMeasurement[],
  selectedMeasurement: InspectMeasurement | null
) =>
  selectedMeasurements.length > 0
    ? selectedMeasurements[selectedMeasurements.length - 1]
    : selectedMeasurement

export const getSelectedMeasurementHit = (params: {
  point: Point
  selectedMeasurements: InspectMeasurement[]
  overlayNode: HTMLDivElement | null
  document?: Document
}) => {
  const ownerDocument = params.document ?? document
  const ElementConstructor = ownerDocument.defaultView?.Element ?? Element
  const overlayHost = getOverlayHost(params.overlayNode)
  const candidates = params.selectedMeasurements
    .map((measurement) => {
      const element = measurement.elementRef
      if (!element || !ownerDocument.contains(element)) return null
      const rect = getRectFromDom(element)
      return {
        measurement,
        element,
        rect,
        area: rect.width * rect.height,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.area - b.area)

  if (candidates.length === 0) return null

  const stack = ownerDocument.elementsFromPoint(params.point.x, params.point.y)
  for (const element of stack) {
    if (!(element instanceof ElementConstructor)) continue
    if (params.overlayNode && params.overlayNode.contains(element)) continue
    if (overlayHost && element === overlayHost) continue
    for (const candidate of candidates) {
      if (
        candidate.element === element ||
        candidate.element.contains(element)
      ) {
        return candidate.measurement
      }
    }
  }

  for (const candidate of candidates) {
    const { rect } = candidate
    const inRect =
      params.point.x >= rect.left &&
      params.point.x <= rect.left + rect.width &&
      params.point.y >= rect.top &&
      params.point.y <= rect.top + rect.height
    if (inRect) return candidate.measurement
  }

  return null
}
