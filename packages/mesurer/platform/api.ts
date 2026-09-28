import { PlatformAuthError, type PlatformConnection, type PlatformProject, type PlatformUser } from "./types"

type PlatformAuthorization = PlatformConnection & {
  capability: string
}

type TokenResponse = PlatformAuthorization & { expiresIn: number; error?: string }

export type TestReviewPayload = {
  version: 1
  pageUrl: string
  origin: string
  title: string
  viewport: { width: number; height: number }
  annotations: []
  comments: Array<{
    id: string
    selector: string
    text: string
    status: "open" | "resolved"
    x: number
    y: number
    width: number
    height: number
  }>
  selectedElements: []
  measurements: []
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/

const isUser = (value: unknown): value is PlatformUser =>
  isRecord(value) &&
  typeof value.id === "string" && value.id.length > 0 &&
  typeof value.name === "string" && value.name.length > 0 &&
  typeof value.email === "string" && value.email.length > 0 &&
  (typeof value.image === "string" || value.image === null)

const isProject = (value: unknown): value is PlatformProject =>
  isRecord(value) &&
  typeof value.id === "string" && UUID_PATTERN.test(value.id) &&
  typeof value.name === "string" && value.name.length > 0

const readAuthorization = (result: unknown): PlatformAuthorization => {
  if (
    !isRecord(result) ||
    typeof result.capability !== "string" || !TOKEN_PATTERN.test(result.capability) ||
    typeof result.expiresIn !== "number" || !Number.isInteger(result.expiresIn) || result.expiresIn <= 0 ||
    typeof result.grantId !== "string" || !UUID_PATTERN.test(result.grantId) ||
    !isUser(result.user) ||
    !isProject(result.project)
  ) {
    throw new PlatformAuthError("token_exchange_failed", "Mesurer returned an invalid authorization response.")
  }
  const { capability, grantId, user, project } = result as TokenResponse
  return { capability, grantId, user, project }
}

export const exchangeAuthorizationCode = async ({
  apiOrigin,
  callbackOrigin,
  code,
  fetch,
  signal,
  verifier,
}: {
  apiOrigin: string
  callbackOrigin: string
  code: string
  fetch: typeof globalThis.fetch
  signal: AbortSignal
  verifier: string
}): Promise<PlatformAuthorization> => {
  let response: Response
  try {
    response = await fetch(`${apiOrigin}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "mesurer-npm-toolbar",
        code,
        codeVerifier: verifier,
        callbackOrigin,
      }),
      signal,
    })
  } catch (error) {
    if (signal.aborted && signal.reason instanceof PlatformAuthError) throw signal.reason
    throw new PlatformAuthError("api_unavailable", "The Mesurer authentication service is unavailable.", error)
  }

  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === "string"
      ? result.error
      : "Mesurer could not complete the authorization."
    throw new PlatformAuthError("token_exchange_failed", message)
  }
  return readAuthorization(result)
}

export const restorePlatformGrant = async ({
  apiOrigin,
  callbackOrigin,
  fetch,
  grantId,
  signal,
}: {
  apiOrigin: string
  callbackOrigin: string
  fetch: typeof globalThis.fetch
  grantId: string
  signal: AbortSignal
}): Promise<PlatformAuthorization> => {
  let response: Response
  try {
    response = await fetch(`${apiOrigin}/api/oauth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "mesurer-npm-toolbar", grantId, callbackOrigin }),
      signal,
    })
  } catch (error) {
    if (signal.aborted && signal.reason instanceof PlatformAuthError) throw signal.reason
    throw new PlatformAuthError("api_unavailable", "The Mesurer authentication service is unavailable.", error)
  }

  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new PlatformAuthError("token_exchange_failed", "Mesurer could not restore the authorization.")
  return readAuthorization(result)
}

export const createTestReviewLink = async ({
  apiOrigin,
  capability,
  fetch,
  payload,
  signal,
}: {
  apiOrigin: string
  capability: string
  fetch: typeof globalThis.fetch
  payload: TestReviewPayload
  signal: AbortSignal
}): Promise<string> => {
  let response: Response
  try {
    response = await fetch(`${apiOrigin}/api/toolbar/share`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${capability}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (signal.aborted && signal.reason instanceof PlatformAuthError) throw signal.reason
    throw new PlatformAuthError("api_unavailable", "The Mesurer sharing service is unavailable.", error)
  }

  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === "string"
      ? result.error
      : "Mesurer could not create the test review link."
    throw new PlatformAuthError("share_failed", message)
  }
  if (!isRecord(result) || typeof result.url !== "string") {
    throw new PlatformAuthError("share_failed", "Mesurer returned an invalid test review link.")
  }
  try {
    const url = new URL(result.url)
    if (!/^https?:$/.test(url.protocol)) throw new Error()
    return url.toString()
  } catch {
    throw new PlatformAuthError("share_failed", "Mesurer returned an invalid test review link.")
  }
}
