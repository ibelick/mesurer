import type { PlatformConnection, PlatformEnvironment } from "./types"

const grantStorageKey = (environment: PlatformEnvironment) =>
  environment === "production" ? "mesurer-toolbar-grant" : `mesurer-toolbar-grant:${environment}`
const connectionStorageKey = (environment: PlatformEnvironment) => `${grantStorageKey(environment)}:connection`

export const readSavedConnection = (ownerWindow: Window, environment: PlatformEnvironment): PlatformConnection | undefined => {
  try {
    const value: unknown = JSON.parse(ownerWindow.localStorage.getItem(connectionStorageKey(environment)) ?? "null")
    if (!value || typeof value !== "object" || !("grantId" in value) || !("user" in value) || !("project" in value)) return undefined
    const { grantId, user, project } = value
    if (typeof grantId !== "string" || grantId !== readGrantId(ownerWindow, environment) ||
      !user || typeof user !== "object" || !("id" in user) || !("name" in user) || !("email" in user) ||
      typeof user.id !== "string" || typeof user.name !== "string" || typeof user.email !== "string" ||
      !project || typeof project !== "object" || !("id" in project) || !("name" in project) ||
      typeof project.id !== "string" || typeof project.name !== "string") return undefined
    return { grantId, user: { id: user.id, name: user.name, email: user.email, image: null }, project: { id: project.id, name: project.name } }
  } catch {
    return undefined
  }
}

export const writeSavedConnection = (ownerWindow: Window, environment: PlatformEnvironment, connection: PlatformConnection) => {
  try {
    const { grantId, user, project } = connection
    ownerWindow.localStorage.setItem(connectionStorageKey(environment), JSON.stringify({ grantId, user: { id: user.id, name: user.name, email: user.email }, project }))
  } catch {
    // The current page remains connected even if storage is unavailable.
  }
}

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
    ownerWindow.localStorage.removeItem(connectionStorageKey(environment))
  } catch {
    // There is no additional client-side credential to clear.
  }
  ownerWindow.dispatchEvent(new CustomEvent("mesurer:platform-disconnect", { detail: { key } }))
}

export const isGrantStorageKey = (key: string | null, environment: PlatformEnvironment) =>
  key === grantStorageKey(environment)
