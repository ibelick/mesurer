import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

const RECORDING_FRAME_WIDTH = 22 * 16
const RECORDING_FRAME_SHADOW = 28

// The toolbar marks the card's wrapper with the side of the card that faces the toolbar.
export const TOOLBAR_SIDE_ATTRIBUTE = "data-mesurer-toolbar-side"
type ToolbarFacingSide = "top" | "bottom" | "left" | "right"

// The iframe is larger than the card so its shadow can paint. The strip on the side facing the
// toolbar is clipped away; otherwise that transparent strip sits on the toolbar and swallows
// its clicks.
const shadowClip = (side: ToolbarFacingSide, shadow: number) =>
  ({
    top: `inset(${shadow}px 0 0 0)`,
    bottom: `inset(0 0 ${shadow}px 0)`,
    left: `inset(0 0 0 ${shadow}px)`,
    right: `inset(0 ${shadow}px 0 0)`,
  })[side]

const recordingTheme = (from?: Element | null) => {
  const theme = (from?.closest("[data-mesurer-root]") ?? document.querySelector("[data-mesurer-root]"))?.getAttribute("data-theme")
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system"
}

export function ExtensionRecordingFrame({
  playerUrl,
  onDiscard,
}: {
  playerUrl: string
  onDiscard: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameSize, setFrameSize] = useState({ width: RECORDING_FRAME_WIDTH, height: 280, menuExtra: 0 })
  const [toolbarSide, setToolbarSide] = useState<ToolbarFacingSide>("top")
  const [src, setSrc] = useState<string | null>(null)
  useLayoutEffect(() => {
    const url = new URL(playerUrl)
    url.searchParams.set("theme", recordingTheme(hostRef.current))
    setSrc(url.toString())
  }, [playerUrl])
  const postFrameState = useCallback(() => {
    const frame = frameRef.current
    const panel = (frame ?? hostRef.current)?.closest(`[${TOOLBAR_SIDE_ATTRIBUTE}]`)
    const side = (panel?.getAttribute(TOOLBAR_SIDE_ATTRIBUTE) ?? "top") as ToolbarFacingSide
    setToolbarSide(side)
    frame?.contentWindow?.postMessage({ type: "mesurer:recording-theme", theme: recordingTheme(frame ?? hostRef.current) }, "*")
    // Inside the frame the card hangs from the top unless the toolbar is below it; beside a
    // vertical toolbar it hangs from the top too.
    frame?.contentWindow?.postMessage({ type: "mesurer:recording-anchor", side: side === "bottom" ? "bottom" : "top" }, "*")
  }, [])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type === "mesurer:recording-discard") onDiscard()
      if (event.data?.type === "mesurer:recording-frame-intent" && typeof event.data.expanded === "boolean") {
        setFrameSize((current) => ({
          ...current,
          width: event.data.expanded ? 36 * 16 : RECORDING_FRAME_WIDTH,
          height: event.data.expanded ? Math.max(current.height, 520) : current.height,
        }))
      }
      if (
        event.data?.type === "mesurer:recording-frame-size" &&
        typeof event.data.width === "number" &&
        typeof event.data.height === "number" &&
        event.data.width >= 32 &&
        event.data.height >= 32
      ) {
        setFrameSize({
          width: event.data.width,
          height: event.data.height,
          menuExtra: typeof event.data.menuExtra === "number" ? event.data.menuExtra : 0,
        })
      }
    }
    window.addEventListener("message", onMessage)
    const root = (frameRef.current ?? hostRef.current)?.closest("[data-mesurer-root]")
    const panel = (frameRef.current ?? hostRef.current)?.closest(`[${TOOLBAR_SIDE_ATTRIBUTE}]`)
    const observer = new MutationObserver(postFrameState)
    if (root) observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] })
    if (panel) observer.observe(panel, { attributes: true, attributeFilter: [TOOLBAR_SIDE_ATTRIBUTE] })
    postFrameState()
    return () => {
      window.removeEventListener("message", onMessage)
      observer.disconnect()
    }
  }, [onDiscard, postFrameState, src])
  const menuAbove = toolbarSide === "bottom"
  const shadow = RECORDING_FRAME_SHADOW
  const frameWidth = frameSize.width + shadow * 2
  const frameHeight = frameSize.height + frameSize.menuExtra + shadow * 2
  return (
    <div
      ref={hostRef}
      className="msr:relative msr:max-w-[calc(100vw-16px)] msr:bg-transparent"
      style={{
        width: frameSize.width,
        height: frameSize.height,
      }}
    >
      {src ? (
        <div
          className="msr:pointer-events-none msr:absolute"
          style={{
            width: frameWidth,
            height: frameHeight,
            left: -shadow,
            top: menuAbove ? -(frameSize.menuExtra + shadow) : -shadow,
            clipPath: shadowClip(toolbarSide, shadow),
          }}
        >
          <iframe
            ref={frameRef}
            title="Recording preview"
            src={src}
            onLoad={postFrameState}
            allowTransparency
            className="msr:pointer-events-auto msr:absolute msr:inset-0 msr:size-full msr:border-0 msr:bg-transparent msr:shadow-none"
            style={{
              backgroundColor: "transparent",
              colorScheme: "light",
              border: 0,
              boxShadow: "none",
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
