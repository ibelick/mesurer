export type Point = {
  x: number
  y: number
}

export type Rect = {
  left: number
  top: number
  width: number
  height: number
}

export type NormalizedRect = {
  left: number
  top: number
  width: number
  height: number
}

export type Measurement = {
  id: string
  rect: Rect
  normalizedRect: NormalizedRect
  elementRef?: HTMLElement | null
  originRect?: Rect
  deltaX: number
  deltaY: number
  snapped?: boolean
}

export type BoxEdges = {
  top: number
  right: number
  bottom: number
  left: number
}

export type InspectMeasurement = {
  id: string
  rect: Rect
  paddingRect: Rect
  marginRect: Rect
  padding: BoxEdges
  margin: BoxEdges
  label: string
  elementRef?: HTMLElement | null
  originRect?: Rect
}

export type Guide = {
  id: string
  orientation: "vertical" | "horizontal"
  position: number
}

export type DistanceOverlay = {
  id: string
  rectA: Rect
  rectB: Rect
  normalizedRectA: NormalizedRect
  normalizedRectB: NormalizedRect
  elementRefA?: HTMLElement | null
  elementRefB?: HTMLElement | null
  horizontal: {
    x1: number
    x2: number
    y: number
    value: number
  } | null
  vertical: {
    y1: number
    y2: number
    x: number
    value: number
  } | null
  connectors: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
  }>
}

export type OptionTarget = {
  rect: Rect
  element?: HTMLElement | null
  guideId?: string
}

export type ToolMode = "none" | "select" | "guides" | "text-inspector"
