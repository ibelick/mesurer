import { describe, expect, it, vi } from "vitest"
import { controlMotion, formatMotionTime, motionDuration, scrubMotion, type MotionDetails } from "./motion"

const motion = (overrides: Partial<MotionDetails> = {}): MotionDetails => ({
  kind: "animation",
  name: "bench-orbit",
  duration: 4000,
  delay: 250,
  easing: "linear",
  properties: ["transform"],
  iterationCount: "infinite",
  direction: "normal",
  fillMode: "both",
  animation: null,
  ...overrides,
})

describe("motion details", () => {
  it("formats timeline values compactly", () => {
    expect(formatMotionTime(250)).toBe("250ms")
    expect(formatMotionTime(4000)).toBe("4.0s")
  })

  it("uses one animation cycle for infinite animations", () => {
    expect(motionDuration(motion())).toBe(4000)
    expect(motionDuration(motion({ iterationCount: "3" }))).toBe(12000)
  })
})

describe("motion controls", () => {
  it("controls and scrubs every animation on an element", () => {
    const animations = [
      { playbackRate: 1, play: vi.fn(), pause: vi.fn(), cancel: vi.fn(), currentTime: 0 },
      { playbackRate: 1, play: vi.fn(), pause: vi.fn(), cancel: vi.fn(), currentTime: 0 },
    ]
    const element = { getAnimations: () => animations } as unknown as Element

    controlMotion(element, "replay", 0.5)
    expect(animations.every((animation) => animation.playbackRate === 0.5)).toBe(true)
    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true)
    expect(animations.every((animation) => animation.play.mock.calls.length === 1)).toBe(true)

    scrubMotion(element, 0.25, 4000)
    expect(animations.map((animation) => animation.currentTime)).toEqual([1000, 1000])
    expect(animations.every((animation) => animation.pause.mock.calls.length === 1)).toBe(true)
  })
})
