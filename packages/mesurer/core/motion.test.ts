import { describe, expect, it, vi } from "vitest"
import { controlMotion, formatMotionTime, motionDuration, motionPlaybackProgress, readMotionKeyframes, scrubMotion, type MotionDetails } from "./motion"

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
  it("formats computed offsets and CSS property names without changing custom properties", () => {
    const animation = { effect: { getKeyframes: () => [
      { offset: null, computedOffset: 0, easing: "linear", composite: "auto", transform: "translateX(0px)", "--MyAngle": "0deg" },
      { offset: null, computedOffset: 1 / 3, easing: "ease-in", composite: "add", backgroundColor: "rgb(0, 0, 0)" },
      { offset: 1, computedOffset: 1, easing: "linear", composite: "replace", transform: "translateX(24px)" },
    ] } } as unknown as Animation
    expect(readMotionKeyframes(animation)).toEqual([
      { offset: "0%", value: "transform: translateX(0px); --MyAngle: 0deg;", displayValue: "transform: translateX(0px)\n--MyAngle: 0deg" },
      { offset: "33.33%", value: "background-color: rgb(0, 0, 0); animation-timing-function: ease-in; animation-composition: add;", displayValue: "background-color: rgb(0, 0, 0)\neasing: ease-in\ncomposition: add" },
      { offset: "100%", value: "transform: translateX(24px);", displayValue: "transform: translateX(24px)" },
    ])
  })

  it("preserves distinct declarations at duplicate offsets", () => {
    const animation = { effect: { getKeyframes: () => [
      { computedOffset: 0.5, opacity: "0.4" },
      { computedOffset: 0.5, transform: "scale(1.2)" },
    ] } } as unknown as Animation
    expect(readMotionKeyframes(animation)).toEqual([
      { offset: "50%", value: "opacity: 0.4;", displayValue: "opacity: 0.4" },
      { offset: "50%", value: "transform: scale(1.2);", displayValue: "transform: scale(1.2)" },
    ])
  })

  it("hides inherited easing in the display while preserving it in copied CSS", () => {
    const animation = { effect: { getKeyframes: () => [{ computedOffset: 0, opacity: "0.5", easing: "ease" }] } } as unknown as Animation
    expect(readMotionKeyframes(animation, "ease")[0]).toEqual({
      offset: "0%", value: "opacity: 0.5; animation-timing-function: ease;", displayValue: "opacity: 0.5",
    })
  })

  it("handles unavailable keyframes safely", () => {
    expect(readMotionKeyframes(null)).toEqual([])
    expect(readMotionKeyframes({ effect: null } as Animation)).toEqual([])
    expect(readMotionKeyframes({ effect: { getKeyframes: () => { throw new Error("unavailable") } } } as unknown as Animation)).toEqual([])
  })

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
  const animationAt = (currentTime: number, iterations = Infinity, playState = "running", delay = 0) => ({
    currentTime,
    playState,
    effect: { getTiming: () => ({ iterations, delay }) },
  }) as unknown as Animation

  it("wraps the playhead across multiple infinite animation cycles", () => {
    expect(motionPlaybackProgress(animationAt(1000), 4000)).toBe(0.25)
    expect(motionPlaybackProgress(animationAt(4000), 4000)).toBe(0)
    expect(motionPlaybackProgress(animationAt(9000), 4000)).toBe(0.25)
    expect(motionPlaybackProgress(animationAt(12000), 4000)).toBe(0)
  })

  it("preserves a paused scrub to the end and wraps when it resumes", () => {
    const animation = animationAt(4000, Infinity, "paused")
    expect(motionPlaybackProgress(animation, 4000)).toBe(1)
    Object.defineProperty(animation, "playState", { value: "running" })
    expect(motionPlaybackProgress(animation, 4000)).toBe(0)
    expect(animation.currentTime).toBe(4000)
  })

  it("keeps finite animations at their end rather than looping them", () => {
    expect(motionPlaybackProgress(animationAt(4000, 1, "finished"), 4000)).toBe(1)
    expect(motionPlaybackProgress(animationAt(12000, 3, "finished"), 12000)).toBe(1)
  })

  it("accounts for the initial delay without changing the animation clock", () => {
    expect(motionPlaybackProgress(animationAt(200, Infinity, "running", 500), 4000)).toBe(0)
    expect(motionPlaybackProgress(animationAt(4500, Infinity, "running", 500), 4000)).toBe(0)
    expect(motionPlaybackProgress(animationAt(5500, Infinity, "running", 500), 4000)).toBe(0.25)
  })

  it("scrubs delayed loops to the requested position before resuming", () => {
    const animation = { currentTime: 0, playState: "paused", pause: vi.fn(), effect: { getTiming: () => ({ iterations: Infinity, delay: 500 }) } }
    const element = { getAnimations: () => [animation] } as unknown as Element
    scrubMotion(element, 1, 4000)
    expect(animation.currentTime).toBe(4500)
    expect(motionPlaybackProgress(animation as unknown as Animation, 4000)).toBe(1)
    animation.playState = "running"
    expect(motionPlaybackProgress(animation as unknown as Animation, 4000)).toBe(0)
  })

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
