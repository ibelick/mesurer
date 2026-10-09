import { readToolbarMotionTiming } from "./toolbar-motion"

// Turning the toolbar between horizontal and vertical swings it a quarter turn: the two
// layouts are the same bar on its side, so the new one starts rotated back onto the old one
// and swings into place, while its icons counter-rotate to stay upright all the way.
export const TOOLBAR_TURN_ID = "mesurer-toolbar-turn"

// The swing follows a drag, so it is quicker than the toolbar's other motion.
const TURN_DURATION_SCALE = 0.55

// Everything that should stay upright while the bar swings under it.
const UPRIGHT_PARTS = [
  "[data-tool-id] button:not(.mesurer-toolbar-caret-btn)",
  ".mesurer-toolbar-tool-switch button",
  ".mesurer-toolbar-restore",
  ".mesurer-toolbar-caret",
].join(", ")

let running: Animation[] = []

const centerOf = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })

export type ToolbarTurn = { from: DOMRect; angle: number }

// Call before the orientation changes, while the old layout is still on screen.
export const captureToolbarTurn = (motion: HTMLElement): ToolbarTurn => {
  // A turn still in flight is stopped where it is: how far it had left to swing is kept, so
  // turning back picks the bar up from there instead of from the end of the swing.
  const angle = parseFloat(getComputedStyle(motion).rotate) || 0
  for (const animation of running) animation.cancel()
  running = []
  return { from: motion.getBoundingClientRect(), angle }
}

// Call once the new orientation has rendered.
export const playToolbarTurn = (motion: HTMLElement, { from, angle }: ToolbarTurn, vertical: boolean) => {
  const to = motion.getBoundingClientRect()
  // The bar starts a quarter turn back: counter-clockwise when it ends up vertical, so the
  // left end of the row is the top of the column. A swing cut short starts that much nearer.
  const quarter = vertical ? -90 : 90
  const back = quarter + angle
  // The one point that quarter turn can pivot on to lay the new box over the old one.
  const a = centerOf(from)
  const b = centerOf(to)
  const sum = a.x - b.x + (a.y - b.y)
  const difference = a.x - b.x - (a.y - b.y)
  const pivot = vertical
    ? { x: b.x + sum / 2, y: b.y - difference / 2 }
    : { x: b.x + difference / 2, y: b.y + sum / 2 }

  const { duration, easing } = readToolbarMotionTiming(motion)
  const timing = {
    id: TOOLBAR_TURN_ID,
    duration: duration * TURN_DURATION_SCALE * Math.abs(back / quarter),
    easing,
  }
  const transformOrigin = `${pivot.x - to.left}px ${pivot.y - to.top}px`
  running = [
    motion.animate(
      [
        { rotate: `${back}deg`, transformOrigin },
        { rotate: "0deg", transformOrigin },
      ],
      timing,
    ),
  ]
  for (const part of motion.querySelectorAll(UPRIGHT_PARTS)) {
    if (part.closest("[inert]")) continue
    running.push(part.animate([{ rotate: `${-back}deg` }, { rotate: "0deg" }], timing))
  }

  // The mode switch's pill normally slides to the active mode with its own transition, which
  // would send it the wrong way across a turning bar. It rides the swing on the active mode
  // instead, upright like the icon it sits behind.
  const pill = motion.querySelector(".mesurer-toolbar-tool-switch-pill")
  if (!pill) return
  // Reading the style first makes sure the slide has started, so it can be dropped.
  void getComputedStyle(pill).transform
  for (const animation of pill.getAnimations()) animation.cancel()
  const settled = getComputedStyle(pill).transform
  const place = settled === "none" ? "" : settled
  running.push(
    pill.animate(
      [{ transform: `${place} rotate(${-back}deg)` }, { transform: `${place} rotate(0deg)` }],
      timing,
    ),
  )
}
