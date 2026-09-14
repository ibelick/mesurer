export const MESURER_KEYBOARD_ATTR = "data-mesurer-keyboard-owned"
const LEGACY_MESURER_KEYBOARD_ATTR = "data-mesurer-kb"
export const MESURER_KEYBOARD_BRIDGE = "__MESURER_KEYBOARD_BRIDGE__"

type MesurerKeyboardBridgeEvent = {
  type: typeof MESURER_KEYBOARD_BRIDGE
  eventType: "keydown" | "keyup"
  key: string
  code: string
  location: number
  repeat: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

const MESURER_BRIDGED_KEYS = new Set([
  "1",
  "2",
  "a",
  "backspace",
  "c",
  "d",
  "delete",
  "escape",
  "g",
  "h",
  "i",
  "n",
  "p",
  "r",
  "s",
  "t",
  "v",
  "x",
])

const MESURER_MODIFIED_KEYS = new Set([",", "a", "z"])

export const getMesurerToolGroupShortcut = ({
  key,
  code,
}: Pick<MesurerKeyboardBridgeEvent, "key" | "code">) => {
  if (
    key === "1" ||
    key === "!" ||
    key === "&" ||
    code === "Digit1" ||
    code === "Numpad1"
  ) {
    return "1"
  }
  if (
    key === "2" ||
    key === "@" ||
    key === "é" ||
    code === "Digit2" ||
    code === "Numpad2"
  ) {
    return "2"
  }
  return null
}

export const isMesurerKeyboardBridgeKey = (
  key: string,
  modifiers: Pick<
    MesurerKeyboardBridgeEvent,
    "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
  > &
    Partial<Pick<MesurerKeyboardBridgeEvent, "code">>,
) => {
  const toolGroupShortcut = getMesurerToolGroupShortcut({
    key,
    code: modifiers.code ?? "",
  })
  return (
    !modifiers.altKey &&
    ((Boolean(toolGroupShortcut) && !modifiers.ctrlKey && !modifiers.metaKey) ||
      (MESURER_BRIDGED_KEYS.has(key.toLowerCase()) &&
        !modifiers.ctrlKey &&
        !modifiers.metaKey &&
        !modifiers.shiftKey) ||
      (MESURER_MODIFIED_KEYS.has(key.toLowerCase()) &&
        (modifiers.ctrlKey || modifiers.metaKey) &&
        (key.toLowerCase() === "z" || !modifiers.shiftKey)))
  )
}

export const isMesurerKeyboardBridge = (
  value: unknown,
): value is MesurerKeyboardBridgeEvent => {
  if (!value || typeof value !== "object") return false
  const event = value as Partial<MesurerKeyboardBridgeEvent>
  return (
    event.type === MESURER_KEYBOARD_BRIDGE &&
    (event.eventType === "keydown" || event.eventType === "keyup") &&
    typeof event.key === "string" &&
    typeof event.code === "string" &&
    typeof event.location === "number" &&
    typeof event.repeat === "boolean" &&
    typeof event.altKey === "boolean" &&
    typeof event.ctrlKey === "boolean" &&
    typeof event.metaKey === "boolean" &&
    typeof event.shiftKey === "boolean" &&
    isMesurerKeyboardBridgeKey(event.key, {
      code: event.code,
      altKey: event.altKey ?? false,
      ctrlKey: event.ctrlKey ?? false,
      metaKey: event.metaKey ?? false,
      shiftKey: event.shiftKey ?? false,
    })
  )
}

export const isEditableElement = (node: EventTarget | null) => {
  if (!(node instanceof Element)) return false
  const element = node as HTMLElement
  const editable = element.getAttribute("contenteditable")
  if (editable === "false") return false
  const tag = element.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (element.isContentEditable) return true
  return editable !== null
}

export const getDeepActiveElement = (eventTarget: Window) => {
  let active: Element | null = eventTarget.document.activeElement
  while (active) {
    if (active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement
      continue
    }
    if (active instanceof HTMLIFrameElement) {
      try {
        const inner = active.contentDocument?.activeElement
        if (inner && inner !== active.contentDocument?.documentElement) {
          active = inner
          continue
        }
      } catch {
        break
      }
    }
    break
  }
  return active
}

export const isInsideMesurer = (node: EventTarget | null) => {
  if (!(node instanceof Node)) return false
  let current: Node | null = node
  while (current) {
    if (current instanceof Element && current.classList.contains("mesurer-root")) {
      return true
    }
    if (current instanceof Document) {
      current = current.defaultView?.frameElement ?? null
      continue
    }
    const parent: Node | null = current.parentNode
    current = parent instanceof ShadowRoot ? parent.host : parent
  }
  return false
}

export const isMesurerUiNode = (node: EventTarget | null) => {
  if (isInsideMesurer(node)) return true
  if (!(node instanceof Element)) return false
  return Boolean(node.shadowRoot?.querySelector(".mesurer-root"))
}

export const isMesurerKeyboardEvent = (event: Event, eventTarget: Window) => {
  if (isInsideMesurer(getDeepActiveElement(eventTarget))) return true
  return event.composedPath().some((node) => isMesurerUiNode(node))
}

export const isTypingInMesurer = (event: KeyboardEvent, eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  if (isEditableElement(active) && isInsideMesurer(active)) return true
  return event.composedPath().some(
    (node) => isEditableElement(node) && isMesurerUiNode(node),
  )
}

export const isOverlayEscapeConsumed = (event: KeyboardEvent) =>
  event.composedPath().some((node) => {
    if (!(node instanceof Element)) return false
    const role = node.getAttribute("role")
    return role === "menu" || role === "listbox" || node.hasAttribute("data-mesurer-comment-delete-confirmation")
  })

export const isTypingInPage = (eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  return isEditableElement(active) && !isInsideMesurer(active)
}

export const isBrowserReservedChord = (event: KeyboardEvent) => {
  const hasMod =
    event.metaKey ||
    event.ctrlKey ||
    event.getModifierState("Meta") ||
    event.getModifierState("Control")
  if (!hasMod) return false
  const key = event.key.toLowerCase()
  return key !== "z" && key !== "a" && key !== ","
}

export const setMesurerKeyboardOwned = (document: Document, owned: boolean) => {
  document.documentElement.removeAttribute(LEGACY_MESURER_KEYBOARD_ATTR)
  if (owned) document.documentElement.setAttribute(MESURER_KEYBOARD_ATTR, "1")
  else document.documentElement.removeAttribute(MESURER_KEYBOARD_ATTR)
}

export const isMesurerKeyboardOwned = (eventTarget: Window) =>
  eventTarget.document.documentElement.hasAttribute(MESURER_KEYBOARD_ATTR)

export const getMesurerPageWindow = (view: Window | null) => {
  if (!view) return null
  try {
    if (view.frameElement) return view.parent
  } catch {
    return view
  }
  return view
}

export const isPageTextEntry = (node: EventTarget | null) => {
  if (!(node instanceof Element) || isInsideMesurer(node)) return false
  if (isEditableElement(node)) return true
  return Boolean(
    node.closest(
      '[contenteditable]:not([contenteditable="false"]), textarea, input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="reset"]):not([type="file"]), [role="textbox"]',
    ),
  )
}

export const findMesurerTypingTarget = (view: Window) => {
  const roots: ParentNode[] = [view.document]
  const host = view.document.getElementById("mesurer-extension-host")
  if (host?.shadowRoot) roots.push(host.shadowRoot)
  for (const root of roots) {
    const typing = root.querySelector<HTMLElement>(
      "[data-mesurer-text-input], [data-mesurer-comment-ui] textarea, [data-mesurer-comment-ui] [contenteditable='true']",
    )
    if (typing) return typing
  }
  return null
}

export const blurPageFocus = (eventTarget: Window) => {
  const active = getDeepActiveElement(eventTarget)
  if (!active || isInsideMesurer(active)) return
  if (active instanceof HTMLElement) active.blur()
}
