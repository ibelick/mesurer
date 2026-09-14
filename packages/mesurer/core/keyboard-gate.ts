import {
  isBrowserReservedChord,
  isInsideMesurer,
  isMesurerKeyboardBridgeKey,
  isMesurerKeyboardEvent,
  isMesurerUiNode,
  isTypingInMesurer,
  MESURER_KEYBOARD_BRIDGE,
  MESURER_KEYBOARD_ATTR,
} from "./keyboard-ownership"

const INSTALLED = "__MESURER_KEYBOARD_GATE_V3__"

type GateWindow = Window & { [INSTALLED]?: boolean }

const MESURER_KEYBOARD_EVENT_TYPES = new Set([
  "beforeinput",
  "blur",
  "compositionend",
  "compositionstart",
  "compositionupdate",
  "copy",
  "cut",
  "focus",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keypress",
  "keyup",
  "paste",
])

const MESURER_POINTER_EVENT_TYPES = new Set([
  "auxclick",
  "click",
  "contextmenu",
  "mousedown",
  "pointerdown",
  "touchstart",
])

const ownsKeyboard = (view: Window) =>
  view.document.documentElement.hasAttribute(MESURER_KEYBOARD_ATTR)

const isMesurerEventPath = (event: Event) =>
  event.composedPath().some((node) => isMesurerUiNode(node))

export const installKeyboardGate = (
  view: Window = window,
  {
    isolateMesurerEvents = false,
    isolationHostId,
  }: { isolateMesurerEvents?: boolean; isolationHostId?: string } = {},
) => {
  const gated = view as GateWindow
  if (gated[INSTALLED]) return
  gated[INSTALLED] = true

  const isIsolatedMesurerEvent = (event: Event) =>
    !isolationHostId ||
    event.composedPath().some(
      (node) => node instanceof Element && node.id === isolationHostId,
    )

  const blockPageKey = (event: Event) => {
    if (!ownsKeyboard(view)) {
      return
    }
    const mesurerEvent = isMesurerKeyboardEvent(event, view)
    if (mesurerEvent) {
      if (isolateMesurerEvents && !isIsolatedMesurerEvent(event)) return
      if (!isolateMesurerEvents || isTypingInMesurer(event as KeyboardEvent, view)) {
        return
      }
      if (event instanceof KeyboardEvent && isMesurerKeyboardBridgeKey(event.key, event)) {
        view.postMessage(
          {
            type: MESURER_KEYBOARD_BRIDGE,
            eventType: event.type,
            key: event.key,
            code: event.code,
            location: event.location,
            repeat: event.repeat,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
          },
          view.location.origin === "null" ? "*" : view.location.origin,
        )
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    if (isInsideMesurer(event.target)) return
    if (event instanceof KeyboardEvent) {
      if (isBrowserReservedChord(event)) return
      if (event.type === "keydown" || event.type === "keyup") {
        if (isolateMesurerEvents && isMesurerKeyboardBridgeKey(event.key, event)) {
          view.postMessage(
            {
              type: MESURER_KEYBOARD_BRIDGE,
              eventType: event.type,
              key: event.key,
              code: event.code,
              location: event.location,
              repeat: event.repeat,
              altKey: event.altKey,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
            },
            view.location.origin === "null" ? "*" : view.location.origin,
          )
        }
      }
    }
    event.preventDefault()
    if (isolateMesurerEvents) event.stopImmediatePropagation()
    else event.stopPropagation()
  }

  const blockPageFocus = (event: Event) => {
    if (
      !ownsKeyboard(view) ||
      isMesurerKeyboardEvent(event, view) ||
      isInsideMesurer(event.target)
    ) {
      return
    }
    if (event.type === "focus" || event.type === "focusin") {
      view.document.documentElement.removeAttribute(MESURER_KEYBOARD_ATTR)
      return
    }
    if (isolateMesurerEvents) event.stopImmediatePropagation()
    else event.stopPropagation()
  }

  const blockPageInput = (event: Event) => {
    if (
      !ownsKeyboard(view) ||
      isMesurerKeyboardEvent(event, view) ||
      isInsideMesurer(event.target)
    ) {
      return
    }
    event.preventDefault()
    if (isolateMesurerEvents) event.stopImmediatePropagation()
    else event.stopPropagation()
  }

  for (const type of ["keydown", "keypress", "keyup", "beforeinput"]) {
    view.addEventListener(type, blockPageKey, true)
  }
  for (const type of ["focus", "blur", "focusin", "focusout"]) {
    view.addEventListener(type, blockPageFocus, true)
  }
  for (const type of [
    "beforeinput",
    "input",
    "paste",
    "copy",
    "cut",
    "compositionstart",
    "compositionupdate",
    "compositionend",
  ]) {
    view.addEventListener(type, blockPageInput, true)
  }

  const shouldWrapType = (type: string) =>
    MESURER_POINTER_EVENT_TYPES.has(type) ||
    (isolateMesurerEvents && MESURER_KEYBOARD_EVENT_TYPES.has(type))

  const isPageScopedListenerTarget = (target: EventTarget) =>
    target === view ||
    target === view.document ||
    target === view.document.documentElement ||
    target === view.document.body

  const isFocusMovingIntoMesurer = (event: Event) => {
    if (event.type !== "blur" && event.type !== "focusout") return false
    return isMesurerUiNode((event as FocusEvent).relatedTarget)
  }

  const shouldSkipPageListener = (type: string, target: EventTarget, event: Event) => {
    if (!isPageScopedListenerTarget(target) || !isIsolatedMesurerEvent(event)) {
      return false
    }
    if (MESURER_POINTER_EVENT_TYPES.has(type)) {
      return isMesurerEventPath(event)
    }
    return ownsKeyboard(view) && (isMesurerEventPath(event) || isFocusMovingIntoMesurer(event))
  }

  const nativeAddEventListener = EventTarget.prototype.addEventListener
  const nativeRemoveEventListener = EventTarget.prototype.removeEventListener
  const wrappedListeners = new WeakMap<
    EventListenerOrEventListenerObject,
    Map<string, EventListener>
  >()
  const listenerKey = (
    type: string,
    options?: boolean | EventListenerOptions,
  ) => `${type}:${typeof options === "boolean" ? options : Boolean(options?.capture)}`

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (!listener || !shouldWrapType(type)) {
      return nativeAddEventListener.call(this, type, listener, options)
    }
    const key = listenerKey(type, options)
    let wrappers = wrappedListeners.get(listener)
    if (!wrappers) {
      wrappers = new Map()
      wrappedListeners.set(listener, wrappers)
    }
    let wrapped = wrappers.get(key)
    if (!wrapped) {
      const once = typeof options !== "boolean" && Boolean(options?.once)
      const signal = typeof options !== "boolean" ? options?.signal : undefined
      wrapped = function (this: EventTarget, event: Event) {
        if (shouldSkipPageListener(type, this, event)) {
          if (once && !signal?.aborted) {
            nativeAddEventListener.call(this, type, wrapped!, options)
          }
          return
        }
        if (typeof listener === "function") listener.call(this, event)
        else listener.handleEvent(event)
      }
      wrappers.set(key, wrapped)
      if (options && typeof options !== "boolean" && options.signal) {
        options.signal.addEventListener(
          "abort",
          () => wrappers?.delete(key),
          { once: true },
        )
      }
    }
    return nativeAddEventListener.call(this, type, wrapped, options)
  }

  EventTarget.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    const wrapped = listener
      ? wrappedListeners.get(listener)?.get(listenerKey(type, options))
      : undefined
    const result = nativeRemoveEventListener.call(
      this,
      type,
      wrapped ?? listener,
      options,
    )
    if (wrapped) wrappedListeners.get(listener!)?.delete(listenerKey(type, options))
    return result
  }

  const preservePageFocus = (event: Event) => {
    if (!isMesurerEventPath(event)) return
    if ("button" in event && (event as MouseEvent).button !== 0) return
    const target = event.composedPath()[0]
    if (
      target instanceof Element &&
      target.closest("input, textarea, select, [contenteditable]")
    ) {
      return
    }
    event.preventDefault()
  }
  nativeAddEventListener.call(view, "mousedown", preservePageFocus, true)
}
