import type {
  DistanceOverlay,
  Guide,
  Arrow,
  PenStroke,
  Measurement,
  TextAnnotation,
  PersistentToolMode,
  ToolMode,
} from "./types"
import type { ColorPickerFormat } from "./colors"
import { normalizeTextStyle, type TextStyleSettings } from "./text-style"

export type { TextFont, TextStyleSettings } from "./text-style"

export const MESURER_STORAGE_VERSION = 2

export type GuidePattern = "solid" | "dashed" | "dotted"

export type GuideStyle = {
  opacity: number
  width: number
  pattern: GuidePattern
  dashLength: number
  gap: number
}

export const DEFAULT_GUIDE_STYLE: GuideStyle = {
  opacity: 1,
  width: 1,
  pattern: "solid",
  dashLength: 6,
  gap: 4,
}

export type RulerSettings = {
  opacity: number
  edgeReveal: boolean
}

export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  opacity: 1,
  edgeReveal: false,
}

export type ScreenshotSettings = {
  copy: boolean
  download: boolean
}

export const DEFAULT_SCREENSHOT_SETTINGS: ScreenshotSettings = {
  copy: true,
  download: false,
}

export type MesurerStoredSettings = {
  lastToolMode?: PersistentToolMode
  highlightColor?: string
  guideColor?: string
  arrowColor?: string
  guideHighlightEnabled?: boolean
  hoverHighlightEnabled?: boolean
  layoutDetailsEnabled?: boolean
  colorPickerFormats?: ColorPickerFormat[]
  colorPickerClickFormat?: ColorPickerFormat
  snapEnabled?: boolean
  snapGuidesEnabled?: boolean
  snapArrowsEnabled?: boolean
  arrowClickToPlace?: boolean
  selectNewGuideEnabled?: boolean
  multiMeasureEnabled?: boolean
  persistOnReload?: boolean
  guideStyle?: Partial<GuideStyle>
  rulerSettings?: Partial<RulerSettings>
  screenshotSettings?: Partial<ScreenshotSettings>
  textStyle?: Partial<TextStyleSettings>
}

export type MesurerStoredWorkspace = {
  enabled: boolean
  xrayVisible: boolean
  toolMode: ToolMode
  rulersVisible: boolean
  guideOrientation: "vertical" | "horizontal"
  guides: Guide[]
  selectedGuideIds: string[]
  arrows: Arrow[]
  selectedArrowIds: string[]
  selectedPenStrokeIds?: string[]
  selectedTextIds?: string[]
  penStrokes: PenStroke[]
  textAnnotations: TextAnnotation[]
  measurements: Measurement[]
  activeMeasurement: Measurement | null
  heldDistances: DistanceOverlay[]
}

export type MesurerPersistenceSnapshot = {
  settings: MesurerStoredSettings
  workspace: MesurerStoredWorkspace | null
}

export type PersistenceChangeSource = {
  settings?: boolean
  workspace?: boolean
}

export type MesurerPersistence = {
  load: () => MesurerPersistenceSnapshot | null
  saveSettings: (settings: MesurerStoredSettings) => void
  saveWorkspace: (workspace: MesurerStoredWorkspace) => void
  clearWorkspace: () => void
  clearSettings: () => void
  subscribe?: (
    listener: (
      snapshot: MesurerPersistenceSnapshot | null,
      source?: PersistenceChangeSource,
    ) => void,
  ) => () => void
  setErrorHandler?: (handler: ((error: unknown) => void) | undefined) => void
}

type StoredRecord = {
  version: number
  settings?: MesurerStoredSettings
  workspace?: MesurerStoredWorkspace | null
  enabled?: boolean
  xrayVisible?: boolean
  toolMode?: ToolMode
  rulersVisible?: boolean
  guideOrientation?: "vertical" | "horizontal"
  guides?: Guide[]
  selectedGuideIds?: string[]
  arrows?: Arrow[]
  selectedArrowIds?: string[]
  selectedPenStrokeIds?: string[]
  selectedTextIds?: string[]
  penStrokes?: PenStroke[]
  textAnnotations?: TextAnnotation[]
  measurements?: Measurement[]
  activeMeasurement?: Measurement | null
  heldDistances?: DistanceOverlay[]
}

const isFormat = (value: unknown): value is ColorPickerFormat =>
  value === "hex" || value === "rgb" || value === "hsl" || value === "oklch"

const clampToTwoDecimals = (value: number, min: number, max: number) =>
  Number(Math.min(max, Math.max(min, value)).toFixed(2))

const normalizeGuideStyle = (value: unknown): GuideStyle | undefined => {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  return {
    opacity: typeof input.opacity === "number" && Number.isFinite(input.opacity) ? clampToTwoDecimals(input.opacity, 0, 1) : DEFAULT_GUIDE_STYLE.opacity,
    width: typeof input.width === "number" && Number.isFinite(input.width) ? clampToTwoDecimals(input.width, 0.01, 4) : DEFAULT_GUIDE_STYLE.width,
    pattern: input.pattern === "dashed" || input.pattern === "dotted" ? input.pattern : DEFAULT_GUIDE_STYLE.pattern,
    dashLength: typeof input.dashLength === "number" && Number.isFinite(input.dashLength) ? clampToTwoDecimals(input.dashLength, 2, 24) : DEFAULT_GUIDE_STYLE.dashLength,
    gap: typeof input.gap === "number" && Number.isFinite(input.gap) ? clampToTwoDecimals(input.gap, 0, 24) : DEFAULT_GUIDE_STYLE.gap,
  }
}

const normalizeRulerSettings = (value: unknown): RulerSettings | undefined => {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  return {
    opacity: typeof input.opacity === "number" && Number.isFinite(input.opacity) ? clampToTwoDecimals(input.opacity, 0.2, 1) : DEFAULT_RULER_SETTINGS.opacity,
    edgeReveal: typeof input.edgeReveal === "boolean" ? input.edgeReveal : DEFAULT_RULER_SETTINGS.edgeReveal,
  }
}

const normalizeScreenshotSettings = (value: unknown): ScreenshotSettings | undefined => {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  const copy = typeof input.copy === "boolean" ? input.copy : DEFAULT_SCREENSHOT_SETTINGS.copy
  const download =
    typeof input.download === "boolean" ? input.download : DEFAULT_SCREENSHOT_SETTINGS.download
  if (!copy && !download) return { ...DEFAULT_SCREENSHOT_SETTINGS }
  return { copy, download }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isRect = (value: unknown): value is { left: number; top: number; width: number; height: number } => {
  if (!value || typeof value !== "object") return false
  const rect = value as Record<string, unknown>
  return isFiniteNumber(rect.left) && isFiniteNumber(rect.top) && isFiniteNumber(rect.width) && rect.width >= 0 && isFiniteNumber(rect.height) && rect.height >= 0
}

const isNormalizedRect = (value: unknown): value is { left: number; top: number; width: number; height: number } =>
  isRect(value)

const isMeasurement = (value: unknown): value is Measurement => {
  if (!value || typeof value !== "object") return false
  const measurement = value as Record<string, unknown>
  return (
    typeof measurement.id === "string" &&
    isRect(measurement.rect) &&
    isNormalizedRect(measurement.normalizedRect) &&
    isFiniteNumber(measurement.deltaX) &&
    isFiniteNumber(measurement.deltaY) &&
    (measurement.snapped === undefined || typeof measurement.snapped === "boolean")
  )
}

const isGuide = (value: unknown): value is Guide => {
  if (!value || typeof value !== "object") return false
  const guide = value as Record<string, unknown>
  return (
    typeof guide.id === "string" &&
    (guide.orientation === "vertical" || guide.orientation === "horizontal") &&
    isFiniteNumber(guide.position)
  )
}

const isArrow = (value: unknown): value is Arrow => {
  if (!value || typeof value !== "object") return false
  const arrow = value as Record<string, unknown>
  const start = arrow.start as Record<string, unknown> | undefined
  const end = arrow.end as Record<string, unknown> | undefined
  const control = arrow.control as Record<string, unknown> | undefined
  return (
    typeof arrow.id === "string" &&
    isFiniteNumber(start?.x) &&
    isFiniteNumber(start?.y) &&
    isFiniteNumber(end?.x) &&
    isFiniteNumber(end?.y) &&
    (control === undefined || (isFiniteNumber(control.x) && isFiniteNumber(control.y))) &&
    typeof arrow.color === "string" &&
    isFiniteNumber(arrow.width) &&
    arrow.width > 0
  )
}

const isPenStroke = (value: unknown): value is PenStroke => {
  if (!value || typeof value !== "object") return false
  const stroke = value as Record<string, unknown>
  return typeof stroke.id === "string" && typeof stroke.color === "string" && isFiniteNumber(stroke.width) && stroke.width > 0 && Array.isArray(stroke.points) && stroke.points.every((point) => {
    if (!point || typeof point !== "object") return false
    const item = point as Record<string, unknown>
    return isFiniteNumber(item.x) && isFiniteNumber(item.y)
  })
}

const isTextAnnotation = (value: unknown): value is TextAnnotation => {
  if (!value || typeof value !== "object") return false
  const annotation = value as Record<string, unknown>
  return (
    typeof annotation.id === "string" &&
    isFiniteNumber(annotation.x) &&
    isFiniteNumber(annotation.y) &&
    typeof annotation.text === "string" &&
    annotation.text.length > 0 &&
    (annotation.scale === undefined || (isFiniteNumber(annotation.scale) && annotation.scale > 0)) &&
    (annotation.rotation === undefined || isFiniteNumber(annotation.rotation)) &&
    (annotation.boxWidth === undefined || (isFiniteNumber(annotation.boxWidth) && annotation.boxWidth > 0))
  )
}

const isDistanceOverlay = (value: unknown): value is DistanceOverlay => {
  if (!value || typeof value !== "object") return false
  const distance = value as Record<string, unknown>
  const isDistanceLine = (line: unknown) => {
    if (line === null) return true
    if (!line || typeof line !== "object") return false
    const item = line as Record<string, unknown>
    return isFiniteNumber(item.x1) && isFiniteNumber(item.x2) && isFiniteNumber(item.y) && isFiniteNumber(item.value)
  }
  const isVerticalLine = (line: unknown) => {
    if (line === null) return true
    if (!line || typeof line !== "object") return false
    const item = line as Record<string, unknown>
    return isFiniteNumber(item.y1) && isFiniteNumber(item.y2) && isFiniteNumber(item.x) && isFiniteNumber(item.value)
  }
  return (
    typeof distance.id === "string" &&
    isRect(distance.rectA) &&
    isRect(distance.rectB) &&
    isNormalizedRect(distance.normalizedRectA) &&
    isNormalizedRect(distance.normalizedRectB) &&
    isDistanceLine(distance.horizontal) &&
    isVerticalLine(distance.vertical) &&
    Array.isArray(distance.connectors) &&
    distance.connectors.every((connector) => {
      if (!connector || typeof connector !== "object") return false
      const item = connector as Record<string, unknown>
      return isFiniteNumber(item.x1) && isFiniteNumber(item.y1) && isFiniteNumber(item.x2) && isFiniteNumber(item.y2)
    })
  )
}

export const normalizeStoredSettings = (value: unknown): MesurerStoredSettings => {
  if (!value || typeof value !== "object") return {}
  const input = value as Record<string, unknown>
  return {
    ...(input.lastToolMode === "select" || input.lastToolMode === "selection" || input.lastToolMode === "guides" || input.lastToolMode === "arrows" || input.lastToolMode === "pen" || input.lastToolMode === "text"
      ? { lastToolMode: input.lastToolMode }
      : {}),
    ...(typeof input.highlightColor === "string" ? { highlightColor: input.highlightColor } : {}),
    ...(typeof input.guideColor === "string" ? { guideColor: input.guideColor } : {}),
    ...(typeof input.arrowColor === "string" ? { arrowColor: input.arrowColor } : {}),
    ...(typeof input.guideHighlightEnabled === "boolean" ? { guideHighlightEnabled: input.guideHighlightEnabled } : {}),
    ...(typeof input.hoverHighlightEnabled === "boolean" ? { hoverHighlightEnabled: input.hoverHighlightEnabled } : {}),
    ...(typeof input.layoutDetailsEnabled === "boolean" ? { layoutDetailsEnabled: input.layoutDetailsEnabled } : {}),
    ...(Array.isArray(input.colorPickerFormats) && input.colorPickerFormats.some(isFormat)
      ? { colorPickerFormats: input.colorPickerFormats.filter(isFormat) }
      : {}),
    ...(isFormat(input.colorPickerClickFormat)
      ? { colorPickerClickFormat: input.colorPickerClickFormat }
      : {}),
    ...(typeof input.snapEnabled === "boolean" ? { snapEnabled: input.snapEnabled } : {}),
    ...(typeof input.snapGuidesEnabled === "boolean" ? { snapGuidesEnabled: input.snapGuidesEnabled } : {}),
    ...(typeof input.snapArrowsEnabled === "boolean" ? { snapArrowsEnabled: input.snapArrowsEnabled } : {}),
    ...(typeof input.arrowClickToPlace === "boolean" ? { arrowClickToPlace: input.arrowClickToPlace } : {}),
    ...(typeof input.selectNewGuideEnabled === "boolean" ? { selectNewGuideEnabled: input.selectNewGuideEnabled } : {}),
    ...(typeof input.multiMeasureEnabled === "boolean" ? { multiMeasureEnabled: input.multiMeasureEnabled } : {}),
    ...(typeof input.persistOnReload === "boolean" ? { persistOnReload: input.persistOnReload } : {}),
    ...(normalizeGuideStyle(input.guideStyle) ? { guideStyle: normalizeGuideStyle(input.guideStyle) } : {}),
    ...(normalizeRulerSettings(input.rulerSettings) ? { rulerSettings: normalizeRulerSettings(input.rulerSettings) } : {}),
    ...(normalizeScreenshotSettings(input.screenshotSettings)
      ? { screenshotSettings: normalizeScreenshotSettings(input.screenshotSettings) }
      : {}),
    ...(normalizeTextStyle(input.textStyle) ? { textStyle: normalizeTextStyle(input.textStyle) } : {}),
  }
}

export const normalizeStoredWorkspace = (value: unknown): MesurerStoredWorkspace | null => {
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  if (
    typeof input.enabled !== "boolean" ||
    (input.toolMode !== "none" && input.toolMode !== "select" && input.toolMode !== "selection" && input.toolMode !== "guides" && input.toolMode !== "text-inspector" && input.toolMode !== "xray" && input.toolMode !== "rulers" && input.toolMode !== "arrows" && input.toolMode !== "pen" && input.toolMode !== "text") ||
    typeof input.rulersVisible !== "boolean" ||
    (input.guideOrientation !== "vertical" && input.guideOrientation !== "horizontal") ||
    !Array.isArray(input.guides) ||
    !Array.isArray(input.selectedGuideIds) ||
    !Array.isArray(input.measurements) ||
    !Array.isArray(input.heldDistances)
  ) return null
  return {
    enabled: input.enabled,
    xrayVisible: typeof input.xrayVisible === "boolean" ? input.xrayVisible : input.toolMode === "xray",
    toolMode: input.toolMode,
    rulersVisible: input.rulersVisible,
    guideOrientation: input.guideOrientation,
    guides: input.guides.filter(isGuide),
    selectedGuideIds: input.selectedGuideIds.filter((id): id is string => typeof id === "string"),
    arrows: Array.isArray(input.arrows) ? input.arrows.filter(isArrow) : [],
    selectedArrowIds: Array.isArray(input.selectedArrowIds)
      ? input.selectedArrowIds.filter((id): id is string => typeof id === "string")
      : [],
    selectedPenStrokeIds: Array.isArray(input.selectedPenStrokeIds)
      ? input.selectedPenStrokeIds.filter((id): id is string => typeof id === "string")
      : [],
    selectedTextIds: Array.isArray(input.selectedTextIds)
      ? input.selectedTextIds.filter((id): id is string => typeof id === "string")
      : [],
    penStrokes: Array.isArray(input.penStrokes) ? input.penStrokes.filter(isPenStroke) : [],
    textAnnotations: Array.isArray(input.textAnnotations)
      ? input.textAnnotations.filter(isTextAnnotation)
      : [],
    measurements: input.measurements.filter(isMeasurement),
    activeMeasurement: isMeasurement(input.activeMeasurement) ? input.activeMeasurement : null,
    heldDistances: input.heldDistances.filter(isDistanceOverlay),
  }
}

export const normalizePersistenceSnapshot = (
  value: unknown,
): MesurerPersistenceSnapshot | null => {
  if (!value || typeof value !== "object") return null
  const record = value as StoredRecord
  if (record.version !== MESURER_STORAGE_VERSION) return null
  return {
    settings: normalizeStoredSettings(record.settings),
    workspace: normalizeStoredWorkspace(record.workspace),
  }
}

const migrate = (record: StoredRecord): MesurerPersistenceSnapshot | null => {
  if (record.version === MESURER_STORAGE_VERSION) {
    return normalizePersistenceSnapshot(record)
  }

  if (record.version !== 1) return null
  return {
    settings: {},
    workspace:
      record.enabled === undefined ||
      !record.toolMode ||
      !record.guideOrientation ||
      !record.guides ||
      !record.selectedGuideIds ||
      !record.measurements ||
      record.activeMeasurement === undefined ||
      !record.heldDistances
        ? null
        : normalizeStoredWorkspace({
             enabled: record.enabled,
             xrayVisible: record.toolMode === "xray",
            toolMode: record.toolMode,
            rulersVisible: record.rulersVisible ?? record.toolMode === "rulers",
            guideOrientation: record.guideOrientation,
            guides: record.guides,
            selectedGuideIds: record.selectedGuideIds,
            arrows: [],
             selectedArrowIds: [],
             selectedPenStrokeIds: [],
             selectedTextIds: [],
             penStrokes: [],
             textAnnotations: [],
            measurements: record.measurements,
            activeMeasurement: record.activeMeasurement,
            heldDistances: record.heldDistances,
          }),
  }
}

export const createLocalStoragePersistence = (
  ownerWindow: Window,
  workspaceKey: string,
  settingsKey = workspaceKey,
  legacyKey?: string,
): MesurerPersistence => {
  let errorHandler: ((error: unknown) => void) | undefined
  const readRecord = (key: string): MesurerPersistenceSnapshot | null => {
    try {
      const raw = ownerWindow.localStorage.getItem(key)
      if (!raw) return null
      return migrate(JSON.parse(raw) as StoredRecord)
    } catch (error) {
      errorHandler?.(error)
      return null
    }
  }

  const read = () => {
    const legacy = legacyKey ? readRecord(legacyKey) : null
    const settingsRecord = readRecord(settingsKey)
    const workspaceRecord = readRecord(workspaceKey)
    if (!settingsRecord && !workspaceRecord && !legacy) return null
    return {
      settings: settingsRecord?.settings ?? legacy?.settings ?? {},
      workspace: workspaceRecord?.workspace ?? legacy?.workspace ?? null,
    }
  }

  const writeRecord = (key: string, snapshot: MesurerPersistenceSnapshot) => {
    try {
      ownerWindow.localStorage.setItem(
        key,
        JSON.stringify({ version: MESURER_STORAGE_VERSION, ...snapshot }),
      )
    } catch (error) {
      // Storage can be unavailable in private or restricted contexts.
      errorHandler?.(error)
    }
  }

  return {
    load: read,
    saveSettings: (settings) => {
      if (settingsKey === workspaceKey) {
        writeRecord(workspaceKey, { settings, workspace: read()?.workspace ?? null })
        return
      }
      writeRecord(settingsKey, { settings, workspace: null })
    },
    saveWorkspace: (workspace) => {
      if (settingsKey === workspaceKey) {
        writeRecord(workspaceKey, { settings: read()?.settings ?? {}, workspace })
        return
      }
      writeRecord(workspaceKey, { settings: {}, workspace })
    },
    clearWorkspace: () => {
      if (settingsKey === workspaceKey) {
        const current = read()
        if (current) writeRecord(workspaceKey, { settings: current.settings, workspace: null })
        return
      }
      writeRecord(workspaceKey, { settings: {}, workspace: null })
    },
    clearSettings: () => {
      if (settingsKey === workspaceKey) {
        writeRecord(workspaceKey, { settings: {}, workspace: read()?.workspace ?? null })
        return
      }
      writeRecord(settingsKey, { settings: {}, workspace: null })
    },
    setErrorHandler: (handler) => {
      errorHandler = handler
    },
    subscribe: (listener) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== settingsKey && event.key !== workspaceKey && event.key !== legacyKey) return
        listener(read(), {
          settings: event.key === settingsKey || event.key === legacyKey || settingsKey === workspaceKey,
          workspace: event.key === workspaceKey || event.key === legacyKey || settingsKey === workspaceKey,
        })
      }
      ownerWindow.addEventListener("storage", handleStorage)
      return () => {
        ownerWindow.removeEventListener("storage", handleStorage)
      }
    },
  }
}
