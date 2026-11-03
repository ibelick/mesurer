import type { PlatformEnvironment } from "./types"

export type PlatformConfig = {
  apiOrigin: string
  callbackOrigin: string
}

const PLATFORM_CONFIG: Record<PlatformEnvironment, PlatformConfig> = {
  production: {
    callbackOrigin: "https://mesurer.dev",
    apiOrigin: "https://mesurer.dev",
  },
  development: {
    callbackOrigin: "http://localhost:5174",
    // The platform's web app, which hands /api on to the development API the team shares
    // (`pnpm dev:team`), so that everyone's reviews are in the one database.
    apiOrigin: "http://localhost:5174",
  },
}

export const getPlatformConfig = (environment: PlatformEnvironment) =>
  PLATFORM_CONFIG[environment]
