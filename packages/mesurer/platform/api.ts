import { PlatformAuthError, type PlatformConnection, type PlatformProject, type PlatformUser } from "./types"

type TokenResponse = PlatformConnection & {
  capability: string
  expiresIn: number
  error?: string
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
}): Promise<PlatformConnection> => {
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

  // The authentication-only client intentionally drops the single-use share capability.
  const { grantId, user, project } = result as TokenResponse
  return { grantId, user, project }
}
