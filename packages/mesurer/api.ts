export type MeasurerStorage = Pick<Storage, "getItem" | "setItem">

export type MeasurerStyleTarget = Document | ShadowRoot | HTMLElement

export type MeasurerPortalTarget = Element | DocumentFragment

export type MeasurerProps = {
  highlightColor?: string
  guideColor?: string
  hoverHighlightEnabled?: boolean
  persistOnReload?: boolean
  initialToolMode?: "none" | "select" | "guides"
}

export type MountMeasurerOptions = MeasurerProps & {
  mountTarget: Element | DocumentFragment
  portalTarget?: MeasurerPortalTarget | null
  styleTarget?: MeasurerStyleTarget | null
  storage?: MeasurerStorage | null
  enabled?: boolean
}

export type MeasurerController = {
  toggle: () => void
  enable: () => void
  disable: () => void
  unmount: () => void
}
