import type { PlatformEnvironment } from "./types"

const grantStorageKey = (environment: PlatformEnvironment) =>
  environment === "production" ? "mesurer-toolbar-grant" : `mesurer-toolbar-grant:${environment}`

export const readGrantId = (ownerWindow: Window, environment: PlatformEnvironment) => {
  try {
    return ownerWindow.localStorage.getItem(grantStorageKey(environment)) ?? undefined
  } catch {
    return undefined
  }
}

export const writeGrantId = (ownerWindow: Window, environment: PlatformEnvironment, grantId: string) => {
  try {
    ownerWindow.localStorage.setItem(grantStorageKey(environment), grantId)
  } catch {
    // Authentication remains usable for this page even when storage is blocked.
  }
}

export const removeGrantId = (ownerWindow: Window, environment: PlatformEnvironment) => {
  const key = grantStorageKey(environment)
  try {
    ownerWindow.localStorage.removeItem(key)
  } catch {
    // There is no additional client-side credential to clear.
  }
  ownerWindow.dispatchEvent(new CustomEvent("mesurer:platform-disconnect", { detail: { key } }))
}

export const isGrantStorageKey = (key: string | null, environment: PlatformEnvironment) =>
  key === grantStorageKey(environment)
