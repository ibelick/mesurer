import { createTestReviewLink, exchangeAuthorizationCode } from "./api"
import type { CommentThread } from "../core/types"
import { getPlatformConfig } from "./config"
import { createPkce, randomBase64Url } from "./pkce"
import { createAuthorizationUrl, waitForAuthorization } from "./popup"
import { isGrantStorageKey, readGrantId, removeGrantId, writeGrantId } from "./storage"
import { createTestReviewPayload } from "./review-payload"
import { createPlatformReviewPublisher, type ReviewPublication } from "../core/review/platform"
import { PlatformAuthError, type PlatformAuthState, type PlatformEnvironment } from "./types"

type Listener = (state: PlatformAuthState) => void

const FRESH_CAPABILITY_MS = 30_000

export class PlatformAuthClient {
  private readonly ownerWindow: Window
  private readonly environment: PlatformEnvironment
  private readonly listeners = new Set<Listener>()
  private state: PlatformAuthState = { status: "disconnected" }
  private popup: Window | null = null
  private authorizationAbort: AbortController | null = null
  private shareAbort: AbortController | null = null
  private capability: string | null = null
  // When what allows a review was given. It lasts two minutes on the platform, and a review
  // takes a while to make: one that is not fresh is asked for again, not counted on.
  private capabilityAt = 0
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

  hasSavedGrant = () => Boolean(readGrantId(this.ownerWindow, this.environment))

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

  // With `reviewWindow`, the authorization is made in that window, which is the tab a review
  // will open in: the platform keeps it open afterwards, waiting, and it is not closed here. A
  // browser opens one window for a press, so the two cannot each have their own.
  connect = async (reviewWindow?: Window) => {
    const attempt = ++this.attempt
    this.authorizationAbort?.abort()
    this.shareAbort?.abort()
    this.capability = null
    this.popup?.close()
    this.popup = null
    this.setState({ status: "connecting" })
    const config = getPlatformConfig(this.environment)
    const popup = reviewWindow ?? this.ownerWindow.open(
      "",
      "mesurer-toolbar-authorization",
      "popup,width=640,height=760",
    )
    if (!popup) {
      this.setState({ status: "error", error: new PlatformAuthError("popup_blocked", "Allow popups to connect Mesurer.") })
      return null
    }
    if (!reviewWindow) this.popup = popup
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
        ...(reviewWindow ? { then: "review" as const } : null),
      })
      popup.location.href = url.toString()
      const code = await waitForAuthorization(
        this.ownerWindow,
        popup,
        config.callbackOrigin,
        state,
        authorizationAbort.signal,
      )
      if (!reviewWindow) popup.close()
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
      this.capability = connection.capability
      this.capabilityAt = Date.now()
      const identity = {
        grantId: connection.grantId,
        user: connection.user,
        project: connection.project,
      }
      this.setState({ status: "connected", share: { status: "idle" }, ...identity })
      return identity
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

  createTestReviewLink = async (comments: CommentThread[] = []) => {
    if (!await this.ensureShareCapability()) return null
    const connectedState = this.state
    const capability = this.capability
    if (connectedState.status !== "connected" || !capability) return null
    const config = getPlatformConfig(this.environment)
    const shareAbort = new AbortController()
    this.shareAbort?.abort()
    this.shareAbort = shareAbort
    const timeout = this.ownerWindow.setTimeout(() => shareAbort.abort(
      new PlatformAuthError("share_timeout", "Mesurer took too long to create the test review link."),
    ), 15_000)
    this.setState({ ...connectedState, share: { status: "creating" } })
    try {
      const url = await createTestReviewLink({
        apiOrigin: config.apiOrigin,
        capability,
        fetch: this.ownerWindow.fetch.bind(this.ownerWindow),
        payload: createTestReviewPayload(this.ownerWindow, comments),
        signal: shareAbort.signal,
      })
      const completedState = this.state
      if (completedState.status !== "connected" || this.capability !== capability) return null
      this.setState({ ...completedState, share: { status: "created", url } })
      return url
    } catch (error) {
      const failedState = this.state
      if (failedState.status !== "connected" || this.capability !== capability) return null
      const shareError = error instanceof PlatformAuthError
        ? error
        : new PlatformAuthError("share_failed", "Mesurer could not create the test review link.", error)
      this.setState({ ...failedState, share: { status: "error", error: shareError } })
      return null
    } finally {
      this.ownerWindow.clearTimeout(timeout)
      if (this.shareAbort === shareAbort) this.shareAbort = null
      if (this.capability === capability) this.capability = null
    }
  }

  /**
   * Makes ready to keep one review, as Save is pressed: what allows it is asked for now, while
   * the press still lets the authorization window open, and used once the review is made.
   * Says whether there is anything to keep it with.
   */
  prepareReview = (reviewWindow?: Window) => this.ensureShareCapability(reviewWindow)

  /** Keeps a review on the platform, and gives the address it is seen at. */
  publishReview = async (review: ReviewPublication) => {
    const connectedState = this.state
    const capability = this.capability
    if (connectedState.status !== "connected" || !capability) {
      throw new PlatformAuthError("share_failed", "Connect Mesurer to save this review.")
    }
    const config = getPlatformConfig(this.environment)
    const shareAbort = new AbortController()
    this.shareAbort?.abort()
    this.shareAbort = shareAbort
    // A review carries a picture of the whole page: it is given longer than a test link.
    const timeout = this.ownerWindow.setTimeout(() => shareAbort.abort(
      new PlatformAuthError("share_timeout", "Mesurer took too long to save the review."),
    ), 60_000)
    this.setState({ ...connectedState, share: { status: "creating" } })
    try {
      const url = await createPlatformReviewPublisher({
        apiOrigin: config.apiOrigin,
        getCapability: async () => capability,
        fetch: this.ownerWindow.fetch.bind(this.ownerWindow),
        signal: shareAbort.signal,
      })(review)
      const completedState = this.state
      if (completedState.status === "connected" && this.capability === capability) {
        this.setState({ ...completedState, share: { status: "created", url } })
      }
      return url
    } catch (error) {
      const shareError = shareAbort.signal.reason instanceof PlatformAuthError
        ? shareAbort.signal.reason
        : error instanceof PlatformAuthError
          ? error
          : new PlatformAuthError("share_failed", error instanceof Error ? error.message : "Mesurer could not save the review.", error)
      const failedState = this.state
      if (failedState.status === "connected" && this.capability === capability) {
        this.setState({ ...failedState, share: { status: "error", error: shareError } })
      }
      throw shareError
    } finally {
      this.ownerWindow.clearTimeout(timeout)
      if (this.shareAbort === shareAbort) this.shareAbort = null
      // Good for one review only, kept or not.
      if (this.capability === capability) this.capability = null
    }
  }

  dispose = () => {
    this.attempt += 1
    this.authorizationAbort?.abort()
    this.authorizationAbort = null
    this.shareAbort?.abort()
    this.shareAbort = null
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

  private async ensureShareCapability(reviewWindow?: Window) {
    if (this.state.status === "connected") {
      if (this.state.share.status === "creating") return false
      if (this.capability && Date.now() - this.capabilityAt < FRESH_CAPABILITY_MS) return true
    } else if (this.state.status === "connecting") {
      return false
    } else if (!reviewWindow && (this.state.status !== "disconnected" || !this.hasSavedGrant())) {
      // With no window to sign in or consent in, only a saved consent can be reused. A review's
      // own window can show either, so saving works from any state.
      return false
    }
    return Boolean(await this.connect(reviewWindow)) && this.capability !== null
  }

  private clearConnection() {
    this.attempt += 1
    this.authorizationAbort?.abort()
    this.authorizationAbort = null
    this.shareAbort?.abort()
    this.shareAbort = null
    this.popup?.close()
    this.popup = null
    this.capability = null
    this.setState({ status: "disconnected" })
  }
}
