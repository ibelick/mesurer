export type PlatformEnvironment = "production" | "development"

export type PlatformUser = {
  id: string
  name: string
  email: string
  image: string | null
}

export type PlatformProject = {
  id: string
  name: string
}

export type PlatformConnection = {
  grantId: string
  user: PlatformUser
  project: PlatformProject
}

export type PlatformShareState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "created"; url: string }
  | { status: "error"; error: PlatformAuthError }

export type PlatformAuthState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | ({ status: "connected"; share: PlatformShareState } & PlatformConnection)
  | { status: "error"; error: PlatformAuthError }

export type PlatformAuthErrorCode =
  | "popup_blocked"
  | "popup_closed"
  | "authorization_timeout"
  | "callback_origin_mismatch"
  | "callback_state_mismatch"
  | "invalid_callback"
  | "token_exchange_timeout"
  | "token_exchange_failed"
  | "share_failed"
  | "share_timeout"
  | "api_unavailable"

export class PlatformAuthError extends Error {
  readonly code: PlatformAuthErrorCode
  readonly cause?: unknown

  constructor(code: PlatformAuthErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = "PlatformAuthError"
    this.code = code
    this.cause = cause
  }
}
