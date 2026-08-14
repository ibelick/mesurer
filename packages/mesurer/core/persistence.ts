import type {
  DistanceOverlay,
  Guide,
  Measurement,
  ToolMode,
} from "./types"
import type { ColorPickerFormat } from "./colors"

export const MESURER_STORAGE_VERSION = 2

export type MesurerStoredSettings = {
  highlightColor?: string
  guideColor?: string
  hoverHighlightEnabled?: boolean
  colorPickerFormats?: ColorPickerFormat[]
  colorPickerClickFormat?: ColorPickerFormat
  snapEnabled?: boolean
  snapGuidesEnabled?: boolean
  multiMeasureEnabled?: boolean
  persistOnReload?: boolean
}

export type MesurerStoredWorkspace = {
  enabled: boolean
  toolMode: ToolMode
  rulersVisible: boolean
  guideOrientation: "vertical" | "horizontal"
  guides: Guide[]
  selectedGuideIds: string[]
  measurements: Measurement[]
  activeMeasurement: Measurement | null
  heldDistances: DistanceOverlay[]
}

export type MesurerPersistenceSnapshot = {
  settings: MesurerStoredSettings
  workspace: MesurerStoredWorkspace | null
}

export type MesurerPersistence = {
  load: () => MesurerPersistenceSnapshot | null
  saveSettings: (settings: MesurerStoredSettings) => void
  saveWorkspace: (workspace: MesurerStoredWorkspace) => void
  clearWorkspace: () => void
  clearSettings: () => void
  subscribe?: (listener: (snapshot: MesurerPersistenceSnapshot | null) => void) => () => void
  setErrorHandler?: (handler: ((error: unknown) => void) | undefined) => void
}

type StoredRecord = {
  version: number
  settings?: MesurerStoredSettings
  workspace?: MesurerStoredWorkspace | null
  enabled?: boolean
  toolMode?: ToolMode
  rulersVisible?: boolean
  guideOrientation?: "vertical" | "horizontal"
  guides?: Guide[]
  selectedGuideIds?: string[]
  measurements?: Measurement[]
  activeMeasurement?: Measurement | null
  heldDistances?: DistanceOverlay[]
}

const isFormat = (value: unknown): value is ColorPickerFormat =>
  value === "hex" || value === "rgb" || value === "hsl" || value === "oklch"

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
    ...(typeof input.highlightColor === "string" ? { highlightColor: input.highlightColor } : {}),
    ...(typeof input.guideColor === "string" ? { guideColor: input.guideColor } : {}),
    ...(typeof input.hoverHighlightEnabled === "boolean" ? { hoverHighlightEnabled: input.hoverHighlightEnabled } : {}),
    ...(Array.isArray(input.colorPickerFormats)
      ? { colorPickerFormats: input.colorPickerFormats.filter(isFormat) }
      : {}),
    ...(isFormat(input.colorPickerClickFormat)
      ? { colorPickerClickFormat: input.colorPickerClickFormat }
      : {}),
    ...(typeof input.snapEnabled === "boolean" ? { snapEnabled: input.snapEnabled } : {}),
    ...(typeof input.snapGuidesEnabled === "boolean" ? { snapGuidesEnabled: input.snapGuidesEnabled } : {}),
    ...(typeof input.multiMeasureEnabled === "boolean" ? { multiMeasureEnabled: input.multiMeasureEnabled } : {}),
    ...(typeof input.persistOnReload === "boolean" ? { persistOnReload: input.persistOnReload } : {}),
  }
}

export const normalizeStoredWorkspace = (value: unknown): MesurerStoredWorkspace | null => {
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  if (
    typeof input.enabled !== "boolean" ||
    (input.toolMode !== "none" && input.toolMode !== "select" && input.toolMode !== "guides" && input.toolMode !== "text-inspector" && input.toolMode !== "xray" && input.toolMode !== "rulers") ||
    typeof input.rulersVisible !== "boolean" ||
    (input.guideOrientation !== "vertical" && input.guideOrientation !== "horizontal") ||
    !Array.isArray(input.guides) ||
    !Array.isArray(input.selectedGuideIds) ||
    !Array.isArray(input.measurements) ||
    !Array.isArray(input.heldDistances)
  ) return null
  return {
    enabled: input.enabled,
    toolMode: input.toolMode,
    rulersVisible: input.rulersVisible,
    guideOrientation: input.guideOrientation,
    guides: input.guides.filter(isGuide),
    selectedGuideIds: input.selectedGuideIds.filter((id): id is string => typeof id === "string"),
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
            toolMode: record.toolMode,
            rulersVisible: record.rulersVisible ?? record.toolMode === "rulers",
            guideOrientation: record.guideOrientation,
            guides: record.guides,
            selectedGuideIds: record.selectedGuideIds,
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
        listener(read())
      }
      ownerWindow.addEventListener("storage", handleStorage)
      return () => {
        ownerWindow.removeEventListener("storage", handleStorage)
      }
    },
  }
}
