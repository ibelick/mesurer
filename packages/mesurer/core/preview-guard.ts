// A responsive preview is a copy of the page, so the page's scripts run once per preview. Anything
// they do that changes something outside the preview (a request that writes data, a beacon of
// analytics) would happen once for each of them. Reads are left alone, so the page still renders.
const HELD_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const held = new WeakSet<XMLHttpRequest>()

export const holdPreviewSideEffects = (frameWindow: Window) => {
  const view = frameWindow as Window & typeof globalThis
  const nativeFetch = view.fetch.bind(view)
  view.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof view.Request ? input.method : "GET")).toUpperCase()
    if (!HELD_METHODS.has(method)) return nativeFetch(input, init)
    // Made in the preview's own realm, so the page's own checks on the error still hold.
    return Promise.reject(new view.TypeError(`A ${method} from a responsive preview is not sent.`))
  }

  view.navigator.sendBeacon = () => false

  const XMLHttpRequestPrototype = view.XMLHttpRequest.prototype
  const nativeOpen = XMLHttpRequestPrototype.open
  const nativeSend = XMLHttpRequestPrototype.send
  XMLHttpRequestPrototype.open = function (this: XMLHttpRequest, method: string, ...rest: unknown[]) {
    if (HELD_METHODS.has(method.toUpperCase())) held.add(this)
    return (nativeOpen as (...args: unknown[]) => void).call(this, method, ...rest)
  } as typeof nativeOpen
  XMLHttpRequestPrototype.send = function (this: XMLHttpRequest, ...rest: unknown[]) {
    // Ends as a failed request, which is what the page expects when a request does not go through.
    if (held.has(this)) return this.abort()
    return (nativeSend as (...args: unknown[]) => void).apply(this, rest)
  } as typeof nativeSend
}
