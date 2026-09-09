import type { Dispatch, SetStateAction } from "react"
import { useLayoutEffect, useRef } from "react"
import {
  getMesurerToolGroupShortcut,
  isInsideMesurer,
  isMesurerKeyboardBridge,
  isMesurerKeyboardBridgeKey,
  isMesurerKeyboardOwned,
  isOverlayEscapeConsumed,
  isTypingInMesurer,
  isTypingInPage,
} from "../core/keyboard-ownership"
import type { ToolMode } from "../core/types"

const DOUBLE_ESCAPE_MS = 1000
const SHORTCUT_TOOL_MODES: Partial<Record<string, ToolMode>> = {
  a: "text-inspector",
  d: "arrows",
  g: "guides",
  i: "select",
  n: "pen",
  s: "selection",
  t: "text",
}

const isEscapeKey = (event: KeyboardEvent) =>
  event.key === "Escape" || event.code === "Escape"

const keyboardEventSignature = (
  eventType: "keydown" | "keyup",
  event: Pick<
    KeyboardEvent,
    | "key"
    | "code"
    | "location"
    | "repeat"
    | "altKey"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
  >,
) =>
  [
    eventType,
    event.key,
    event.code,
    event.location,
    event.repeat,
    event.altKey,
    event.ctrlKey,
    event.metaKey,
    event.shiftKey,
  ].join(":")

type HotkeyOptions = {
  eventTarget: Window
  overlayRef: { current: HTMLElement | null }
  enabled: boolean
  clearTransientState: () => void
  hasTransientInteraction: () => boolean
  isActiveToolMode: () => boolean
  isToolbarIdle: () => boolean
  hasSelection: () => boolean
  clearSelection: () => void
  exitActiveTool: () => void
  dismissInspectorPins: () => boolean
  minimizeMesurer: () => void
  shortcutsEnabled: boolean
  minimized: boolean
  undo: () => void
  redo: () => void
  removeSelected: () => boolean
  selectAllAnnotations: () => boolean
  setEnabled: Dispatch<SetStateAction<boolean>>
  setToolMode: Dispatch<SetStateAction<ToolMode>>
  setXrayVisible: Dispatch<SetStateAction<boolean>>
  setRulersVisible: Dispatch<SetStateAction<boolean>>
  setAltPressed: Dispatch<SetStateAction<boolean>>
  pinDistance: () => boolean
  isOverlayActive: () => boolean
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>
  onInteract: () => void
  onColorPicker: () => void
  onScreenshot: () => void
  onCloseScreenshot: () => void
  isScreenshotActive: () => boolean
  onToggleXray: () => void
  onToggleRulers: () => void
  onToggleSettings: () => void
  isSettingsOpen: () => boolean
  onCloseColorPicker: () => void
  isColorPickerActive: () => boolean
}

const attachCapture = (
  roots: EventTarget[],
  type: string,
  listener: EventListener,
) => {
  for (const root of roots) root.addEventListener(type, listener, true)
  return () => {
    for (const root of roots) root.removeEventListener(type, listener, true)
  }
}

export const useHotkeys = (options: HotkeyOptions) => {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const lastEscapeAtRef = useRef<number | null>(null)
  const nativeKeyboardEventsRef = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    const target = options.eventTarget
    const seen = new WeakSet<Event>()
    const handleKeyDown = (event: KeyboardEvent, bridged = false) => {
      if (seen.has(event)) return
      seen.add(event)
      if (!bridged && isMesurerKeyboardBridgeKey(event.key, event)) {
        nativeKeyboardEventsRef.current.set(
          keyboardEventSignature("keydown", event),
          performance.now(),
        )
      }
      const current = optionsRef.current
      if (
        !bridged &&
        isTypingInPage(target) &&
        !isMesurerKeyboardOwned(target) &&
        !isEscapeKey(event)
      ) return
      if (isEscapeKey(event)) {
        if (event.repeat) return
        if (current.minimized) return
        const pageOwnsKeyboard =
          isTypingInPage(target) && !isMesurerKeyboardOwned(target)
        if (pageOwnsKeyboard) {
          lastEscapeAtRef.current = null
          if (current.isToolbarIdle()) return
        }
        const now = performance.now()
        const doubleEscape =
          lastEscapeAtRef.current !== null &&
          now - lastEscapeAtRef.current < DOUBLE_ESCAPE_MS
        if (doubleEscape) {
          event.preventDefault()
          lastEscapeAtRef.current = null
          current.minimizeMesurer()
          return
        }
        if (isTypingInMesurer(event, target) && !current.isSettingsOpen()) return
        if (isOverlayEscapeConsumed(event)) return
        event.preventDefault()
        if (current.isSettingsOpen()) {
          lastEscapeAtRef.current = now
          current.onToggleSettings()
          return
        }
        if (current.isScreenshotActive()) {
          lastEscapeAtRef.current = now
          current.onCloseScreenshot()
          return
        }
        if (current.isColorPickerActive()) {
          lastEscapeAtRef.current = now
          current.onCloseColorPicker()
          return
        }
        if (!current.isToolbarIdle()) {
          if (current.hasTransientInteraction()) {
            current.clearTransientState()
          } else if (current.dismissInspectorPins()) {
            // keep typography mode; pins go first
          } else if (current.hasSelection()) {
            current.clearSelection()
          } else if (current.isActiveToolMode()) {
            current.exitActiveTool()
            if (!isTypingInPage(target)) {
              current.overlayRef.current?.focus({ preventScroll: true })
            }
          }
          lastEscapeAtRef.current = now
          return
        }
        lastEscapeAtRef.current = null
        current.minimizeMesurer()
        return
      }
      if (isTypingInMesurer(event, target)) {
        return
      }
      if (isTypingInPage(target) && !isMesurerKeyboardOwned(target)) return
      if (current.minimized) return

      if (!current.shortcutsEnabled) return

      const hasPrimaryModifier =
        event.metaKey ||
        event.ctrlKey ||
        event.getModifierState("Meta") ||
        event.getModifierState("Control")
      const isSelectAll =
        hasPrimaryModifier &&
        ((event.key && event.key.toLowerCase() === "a") || event.code === "KeyA")

      if (isSelectAll) {
        const didSelect = current.selectAllAnnotations()
        if (didSelect || current.isOverlayActive()) {
          event.preventDefault()
          event.stopImmediatePropagation()
          current.overlayRef.current?.focus({ preventScroll: true })
        }
        return
      }

      if (hasPrimaryModifier) {
        if (event.key === ",") {
          event.preventDefault()
          current.onInteract()
          current.onCloseScreenshot()
          current.onToggleSettings()
          return
        }
        if (event.key.toLowerCase() !== "z") return
        if (event.shiftKey) {
          event.preventDefault()
          current.redo()
          return
        }
        event.preventDefault()
        current.undo()
        return
      }

      if (event.key.toLowerCase() === "m") {
        current.setEnabled((prev) => !prev)
      }

      const key = event.key.toLowerCase()
      const toolGroupShortcut = getMesurerToolGroupShortcut(event)
      if (event.key === "Alt") {
        current.setAltPressed(true)
      }
      if (event.altKey) {
        // Option+S pins the distance currently previewed under Option.
        // Matched on `code`: macOS reports event.key as "ß" while Option is held.
        if (event.code === "KeyS" && current.pinDistance()) {
          event.preventDefault()
        }
        return
      }

      if (key === "p") {
        event.preventDefault()
        current.onInteract()
        current.onCloseScreenshot()
        current.onColorPicker()
        return
      }

      if (key === "c") {
        event.preventDefault()
        current.onInteract()
        current.onScreenshot()
        return
      }

      if (key === "x" || key === "r") {
        event.preventDefault()
        current.onInteract()
        current.setEnabled(true)
        current.clearTransientState()
        current.onCloseColorPicker()
        current.onCloseScreenshot()
        if (key === "x") current.onToggleXray()
        else current.onToggleRulers()
        return
      }

      if (toolGroupShortcut) {
        event.preventDefault()
        event.stopImmediatePropagation()
        current.onInteract()
        current.clearTransientState()
        current.setEnabled(true)
        current.onCloseColorPicker()
        current.onCloseScreenshot()
        current.setXrayVisible(false)
        current.setRulersVisible(false)
        current.setToolMode(toolGroupShortcut === "1" ? "select" : "selection")
        return
      }

      if (current.isOverlayActive()) {
        const requestedToolMode = SHORTCUT_TOOL_MODES[key]
        if (requestedToolMode) {
          event.preventDefault()
          event.stopImmediatePropagation()
          current.onInteract()
          current.clearTransientState()
          current.onCloseScreenshot()
          current.setToolMode((prev) =>
            prev === requestedToolMode ? "none" : requestedToolMode,
          )
          return
        }

        if (key === "h") {
          current.setGuideOrientation("horizontal")
          current.onInteract()
        }

        if (key === "v") {
          current.setGuideOrientation("vertical")
          current.onInteract()
        }
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        if (current.removeSelected()) event.preventDefault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent, bridged = false) => {
      if (!bridged && isMesurerKeyboardBridgeKey(event.key, event)) {
        nativeKeyboardEventsRef.current.set(
          keyboardEventSignature("keyup", event),
          performance.now(),
        )
      }
      if (!bridged && isTypingInPage(target) && !isMesurerKeyboardOwned(target)) return
      if (event.key === "Alt") {
        optionsRef.current.setAltPressed(false)
      }
    }

    const handleKeyboardBridge = (event: MessageEvent) => {
      if (
        event.source !== target ||
        event.origin !== target.location.origin ||
        !isMesurerKeyboardOwned(target)
      ) return
      const data = event.data
      if (!isMesurerKeyboardBridge(data)) return
      const signature = keyboardEventSignature(data.eventType, data)
      const nativeEventAt = nativeKeyboardEventsRef.current.get(signature)
      if (
        nativeEventAt !== undefined &&
        performance.now() - nativeEventAt < 250
      ) {
        nativeKeyboardEventsRef.current.delete(signature)
        return
      }
      const bridged = new KeyboardEvent(data.eventType, {
        key: data.key,
        code: data.code,
        location: data.location,
        repeat: data.repeat,
        altKey: data.altKey,
        ctrlKey: data.ctrlKey,
        metaKey: data.metaKey,
        shiftKey: data.shiftKey,
      })
      if (data.eventType === "keydown") handleKeyDown(bridged, true)
      else handleKeyUp(bridged, true)
    }

    const clearDoubleEscape = (event: Event) => {
      if (isInsideMesurer(event.target)) lastEscapeAtRef.current = null
    }

    const roots: EventTarget[] = [target, target.document, target.document.documentElement]
    const overlayRoot = options.overlayRef.current?.getRootNode()
    if (overlayRoot && overlayRoot !== target.document) roots.push(overlayRoot)

    const detachKeyDown = attachCapture(roots, "keydown", handleKeyDown as EventListener)
    const detachKeyUp = attachCapture(roots, "keyup", handleKeyUp as EventListener)
    const detachPointerDown = attachCapture(
      roots,
      "pointerdown",
      clearDoubleEscape as EventListener,
    )
    target.addEventListener("message", handleKeyboardBridge)
    return () => {
      detachKeyDown()
      detachKeyUp()
      detachPointerDown()
      target.removeEventListener("message", handleKeyboardBridge)
    }
  }, [options.enabled, options.eventTarget, options.overlayRef])
}
