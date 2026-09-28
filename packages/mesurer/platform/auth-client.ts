import { exchangeAuthorizationCode } from "./api"
import { getPlatformConfig } from "./config"
import { createPkce, randomBase64Url } from "./pkce"
import { createAuthorizationUrl, waitForAuthorization } from "./popup"
import { isGrantStorageKey, readGrantId, removeGrantId, writeGrantId } from "./storage"
import { PlatformAuthError, type PlatformAuthState, type PlatformEnvironment } from "./types"

type Listener = (state: PlatformAuthState) => void

export class PlatformAuthClient {
  private readonly ownerWindow: Window
  private readonly environment: PlatformEnvironment
  private readonly listeners = new Set<Listener>()
  private state: PlatformAuthState = { status: "disconnected" }
  private popup: Window | null = null
  private authorizationAbort: AbortController | null = null
  private attempt = 0
  private readonly storageListener = (event: StorageEvent) => {
    if (!isGrantStorageKey(event.key, this.environment)) return
    const storedGrantId = readGrantId(this.ownerWindow, this.environment)
    if (this.state.status === "connected" && storedGrantId === this.state.grantId) return
    if (this.state.status !== "disconnected") this.clearConnection()
  }
  private readonly disconnectListener = (event: Event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key ?? null
    if (isGrantStorageKey(key, this.environment)) this.clearConnection()
  }

  constructor(ownerWindow: Window, environment: PlatformEnvironment) {
    this.ownerWindow = ownerWindow
    this.environment = environment
  }

  getState = () => this.state

  subscribe = (listener: Listener) => {
    if (this.listeners.size === 0) {
      this.ownerWindow.addEventListener("storage", this.storageListener)
      this.ownerWindow.addEventListener("mesurer:platform-disconnect", this.disconnectListener)
    }
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.ownerWindow.removeEventListener("storage", this.storageListener)
        this.ownerWindow.removeEventListener("mesurer:platform-disconnect", this.disconnectListener)
      }
    }
  }

  connect = async () => {
    const attempt = ++this.attempt
    this.authorizationAbort?.abort()
    this.popup?.close()
    this.setState({ status: "connecting" })
    const config = getPlatformConfig(this.environment)
    const popup = this.ownerWindow.open(
      "",
      "mesurer-toolbar-authorization",
      "popup,width=640,height=760",
    )
    if (!popup) {
      this.setState({ status: "error", error: new PlatformAuthError("popup_blocked", "Allow popups to connect Mesurer.") })
      return null
    }
    this.popup = popup
    const authorizationAbort = new AbortController()
    this.authorizationAbort = authorizationAbort
    try {
      const [{ verifier, challenge }, state] = await Promise.all([
        createPkce(this.ownerWindow.crypto),
        Promise.resolve(randomBase64Url(32, this.ownerWindow.crypto)),
      ])
      const url = createAuthorizationUrl({
        callbackOrigin: config.callbackOrigin,
        challenge,
        declaredOrigin: this.ownerWindow.location.origin,
        grantId: readGrantId(this.ownerWindow, this.environment),
        state,
      })
      popup.location.href = url.toString()
      const code = await waitForAuthorization(
        this.ownerWindow,
        popup,
        config.callbackOrigin,
        state,
        authorizationAbort.signal,
      )
      popup.close()
      if (attempt !== this.attempt) return null
      const exchangeTimeout = this.ownerWindow.setTimeout(() => authorizationAbort.abort(
        new PlatformAuthError("token_exchange_timeout", "Mesurer authorization timed out while connecting."),
      ), 15_000)
      const connection = await exchangeAuthorizationCode({
        apiOrigin: config.apiOrigin,
        callbackOrigin: config.callbackOrigin,
        code,
        fetch: this.ownerWindow.fetch.bind(this.ownerWindow),
        signal: authorizationAbort.signal,
        verifier,
      }).finally(() => this.ownerWindow.clearTimeout(exchangeTimeout))
      if (attempt !== this.attempt) return null
      writeGrantId(this.ownerWindow, this.environment, connection.grantId)
      this.setState({ status: "connected", ...connection })
      return connection
    } catch (error) {
      if (attempt !== this.attempt) return null
      const authError = error instanceof PlatformAuthError
        ? error
        : new PlatformAuthError("token_exchange_failed", "Mesurer authorization failed.", error)
      this.setState({ status: "error", error: authError })
      return null
    } finally {
      if (attempt === this.attempt) {
        this.popup?.close()
        this.popup = null
        this.authorizationAbort = null
      }
    }
  }

  disconnect = () => {
    removeGrantId(this.ownerWindow, this.environment)
  }

  dispose = () => {
    this.attempt += 1
    this.authorizationAbort?.abort()
    this.authorizationAbort = null
    this.popup?.close()
    this.popup = null
    this.ownerWindow.removeEventListener("storage", this.storageListener)
    this.ownerWindow.removeEventListener("mesurer:platform-disconnect", this.disconnectListener)
    this.listeners.clear()
  }

  private setState(state: PlatformAuthState) {
    this.state = state
    for (const listener of this.listeners) listener(state)
  }

  private clearConnection() {
    this.attempt += 1
    this.authorizationAbort?.abort()
    this.authorizationAbort = null
    this.popup?.close()
    this.popup = null
    this.setState({ status: "disconnected" })
  }
}
