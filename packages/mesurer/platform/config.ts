import type { PlatformEnvironment } from "./types"

export type PlatformConfig = {
  apiOrigin: string
  callbackOrigin: string
}

const PLATFORM_CONFIG: Record<PlatformEnvironment, PlatformConfig> = {
  production: {
    callbackOrigin: "https://mesurer.dev",
    // TODO: Verify that api.mesurer.dev is provisioned and configured before production release.
    apiOrigin: "https://api.mesurer.dev",
  },
  development: {
    callbackOrigin: "http://localhost:5174",
    apiOrigin: "http://localhost:8787",
  },
}

export const getPlatformConfig = (environment: PlatformEnvironment) =>
  PLATFORM_CONFIG[environment]
