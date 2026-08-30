export type Point = {
  x: number
  y: number
}

export type Arrow = {
  id: string
  start: Point
  end: Point
  control?: Point
  color: string
  width: number
  rotation?: number
}

export type PenStroke = {
  id: string
  points: Point[]
  color: string
  width: number
  rotation?: number
}

export type TextAnnotation = {
  id: string
  x: number
  y: number
  text: string
  scale?: number
  rotation?: number
  boxWidth?: number
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
  elementRef?: Element | null
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

export type LayoutGap = {
  row: number
  column: number
}

export type InspectMeasurement = {
  id: string
  rect: Rect
  paddingRect: Rect
  marginRect: Rect
  padding: BoxEdges
  margin: BoxEdges
  gap: LayoutGap | null
  label: string
  elementRef?: Element | null
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
  elementRefA?: Element | null
  elementRefB?: Element | null
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
  element?: Element | null
  guideId?: string
}

export type ToolMode =
  | "none"
  | "select"
  | "selection"
  | "guides"
  | "text-inspector"
  | "xray"
  | "rulers"
  | "arrows"
  | "pen"
  | "text"

export type PersistentToolMode = Exclude<ToolMode, "none" | "text-inspector" | "xray" | "rulers">
