import { describe, expect, it, vi } from "vitest"
import { controlMotion, formatMotionTime, motionDuration, motionPlaybackProgress, scrubMotion, type MotionDetails } from "./motion"

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
