import type { MesurerStoredSettings } from "./persistence"
import type { DistanceOverlay, Measurement } from "./types"

export const TAB_ID_KEY = "mesurer:tab-id"
export const SETTINGS_STORAGE_KEY = "mesurer-settings"
export const LEGACY_STORAGE_KEY = "mesurer-state"

export const stripMeasurement = (measurement: Measurement): Measurement => ({
  ...measurement,
  elementRef: undefined,
})

export const stripDistance = (distance: DistanceOverlay): DistanceOverlay => ({
  ...distance,
  elementRefA: undefined,
  elementRefB: undefined,
  pinTargetRef: undefined,
})

export const getTabId = (ownerWindow: Window) => {
  try {
    const existing = ownerWindow.sessionStorage.getItem(TAB_ID_KEY)
    if (existing) return existing
    const id = ownerWindow.crypto.randomUUID()
    ownerWindow.sessionStorage.setItem(TAB_ID_KEY, id)
    return id
  } catch {
    return "session"
  }
}

export const sanitizeStoredSettings = (
  ownerWindow: Window,
  settings: MesurerStoredSettings,
): MesurerStoredSettings => {
  const supportsColor = (value: string | undefined) =>
    value !== undefined &&
    (
      ownerWindow as Window & {
        CSS?: { supports: (property: string, value: string) => boolean }
      }
    ).CSS?.supports("color", value) === true
  return {
    ...settings,
    ...(supportsColor(settings.highlightColor)
      ? {}
      : { highlightColor: undefined }),
    ...(supportsColor(settings.guideColor) ? {} : { guideColor: undefined }),
    ...(supportsColor(settings.arrowColor) ? {} : { arrowColor: undefined }),
    ...(settings.textStyle?.color && !supportsColor(settings.textStyle.color)
      ? { textStyle: { ...settings.textStyle, color: undefined } }
      : {}),
  }
}
