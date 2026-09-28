import { PlatformAuthError } from "./types"

const AUTHORIZATION_MESSAGE = "mesurer:authorization"
const CODE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/
const POPUP_CLOSE_GRACE_MS = 500

type AuthorizationMessage = {
  type?: unknown
  code?: unknown
  state?: unknown
}

export const createAuthorizationUrl = ({
  callbackOrigin,
  challenge,
  declaredOrigin,
  grantId,
  state,
}: {
  callbackOrigin: string
  challenge: string
  declaredOrigin: string
  grantId?: string
  state: string
}) => {
  const url = new URL("/toolbar/authorize", callbackOrigin)
  url.search = new URLSearchParams({
    clientId: "mesurer-npm-toolbar",
    codeChallenge: challenge,
    state,
    callbackOrigin,
    declaredOrigin,
    ...(grantId ? { grantId } : {}),
  }).toString()
  return url
}

export const waitForAuthorization = (
  ownerWindow: Window,
  popup: Window,
  callbackOrigin: string,
  state: string,
  signal: AbortSignal,
  timeoutMs = 120_000,
) => new Promise<string>((resolve, reject) => {
  let settled = false
  let closeGrace: number | undefined
  const finish = (callback: () => void) => {
    if (settled) return
    settled = true
    ownerWindow.clearTimeout(timeout)
    ownerWindow.clearInterval(closedPoll)
    if (closeGrace !== undefined) ownerWindow.clearTimeout(closeGrace)
    ownerWindow.removeEventListener("message", receiveMessage)
    signal.removeEventListener("abort", abort)
    callback()
  }
  const abort = () => finish(() => reject(new PlatformAuthError("popup_closed", "Mesurer authorization was cancelled.")))
  const receiveMessage = (event: MessageEvent) => {
    if (event.source !== popup) return
    const data = event.data as AuthorizationMessage | null
    if (!data || data.type !== AUTHORIZATION_MESSAGE) return
    if (event.origin !== callbackOrigin) {
      finish(() => reject(new PlatformAuthError("callback_origin_mismatch", "The authorization response came from an unexpected origin.")))
      return
    }
    if (data.state !== state) {
      finish(() => reject(new PlatformAuthError("callback_state_mismatch", "The authorization response could not be verified.")))
      return
    }
    if (typeof data.code !== "string" || !CODE_PATTERN.test(data.code)) {
      finish(() => reject(new PlatformAuthError("invalid_callback", "The authorization response was invalid.")))
      return
    }
    finish(() => resolve(data.code as string))
  }
  const timeout = ownerWindow.setTimeout(() => {
    finish(() => reject(new PlatformAuthError("authorization_timeout", "Mesurer authorization timed out.")))
  }, timeoutMs)
  const closedPoll = ownerWindow.setInterval(() => {
    if (!popup.closed || closeGrace !== undefined) return
    // postMessage is asynchronous. Keep the listener alive briefly when the
    // authorization page posts its callback and immediately closes itself.
    closeGrace = ownerWindow.setTimeout(() => {
      finish(() => reject(new PlatformAuthError("popup_closed", "The authorization window was closed.")))
    }, POPUP_CLOSE_GRACE_MS)
  }, 250)
  ownerWindow.addEventListener("message", receiveMessage)
  signal.addEventListener("abort", abort, { once: true })
})
