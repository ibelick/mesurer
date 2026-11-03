import { describe, expect, it } from "vitest"
import { getPlatformConfig } from "./config"

describe("platform environments", () => {
  it("keeps staging authorization and uploads on the isolated staging platform", () => {
    const staging = getPlatformConfig("staging")
    expect(staging.callbackOrigin).toBe("https://mesurer-web-staging.ibelick.workers.dev")
    expect(staging.apiOrigin).toBe(staging.callbackOrigin)
    expect(staging.apiOrigin).not.toBe(getPlatformConfig("production").apiOrigin)
  })
})
