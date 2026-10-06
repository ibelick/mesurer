import { describe, expect, it, vi } from "vitest"
import { controlMotion, formatMotionTime, getMotionAnimations, hasTransientScriptMotion, motionDuration, motionPlaybackProgress, motionPlaybackState, readMotionDetails, readMotionKeyframes, scrubMotion, type MotionDetails } from "./motion"

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
  it("recognizes transient script effects without treating controlled or CSS effects as managed", () => {
    const animation = { playState: "running", effect: { getTiming: () => ({ duration: 1000, iterations: 1 }) }, pause: vi.fn() } as unknown as Animation
    const element = { getAnimations: () => [animation] } as unknown as Element
    expect(hasTransientScriptMotion(element)).toBe(true)
    controlMotion(element, "pause")
    expect(hasTransientScriptMotion(element)).toBe(false)
    const css = { ...animation, animationName: "fade" } as unknown as Animation
    expect(hasTransientScriptMotion(element, [css])).toBe(false)
    const loop = { playState: "running", effect: { getTiming: () => ({ duration: 1000, iterations: Infinity }) } } as unknown as Animation
    expect(hasTransientScriptMotion(element, [loop])).toBe(false)
  })
  const readDetails = (animations: Animation[], overrides: Record<string, string> = {}) => readMotionDetails(
    { getAnimations: () => animations } as unknown as Element,
    { getComputedStyle: () => ({
      animationName: "none", animationDuration: "0s", animationDelay: "0s", animationTimingFunction: "ease",
      animationIterationCount: "1", animationDirection: "normal", animationFillMode: "none",
      transitionProperty: "none", transitionDuration: "0s", transitionDelay: "0s", transitionTimingFunction: "ease", ...overrides,
    }) } as unknown as Window,
  )
  const webAnimation = (overrides: Record<string, unknown> = {}) => ({
    id: "", playState: "running", effect: {
      getTiming: () => ({ duration: 1800, delay: -200, iterations: Infinity, direction: "alternate", fill: "both", easing: "ease-out" }),
      getKeyframes: () => [{ computedOffset: 0, transform: "scale(1)" }, { computedOffset: 1, transform: "scale(1.2)" }],
    }, ...overrides,
  }) as unknown as Animation

  it("detects unnamed Web Animations without CSS declarations", () => {
    const animation = webAnimation()
    expect(readDetails([animation])).toEqual([{
      kind: "web-animation", name: "js-transform-1", duration: 1800, delay: -200, easing: "ease-out",
      properties: ["transform"], iterationCount: "infinite", direction: "alternate", fillMode: "both", animation,
    }])
  })

  it("keeps named CSS animations distinct from JavaScript animations", () => {
    const js = webAnimation({ id: "motion-react-animation" })
    const css = webAnimation({ animationName: "bounce" })
    const details = readDetails([js, css], { animationName: "bounce", animationDuration: "2s" })
    expect(details.map(({ kind }) => kind)).toEqual(["animation", "web-animation"])
    expect(details[0].animation).toBe(css)
    expect(details[1].animation).toBe(js)
    expect(details[1].name).toBe("motion-react-animation")
  })

  it("matches repeated CSS names by occurrence rather than unrelated animation order", () => {
    const first = webAnimation({ animationName: "bounce" })
    const second = webAnimation({ animationName: "bounce" })
    const details = readDetails([webAnimation(), first, second], { animationName: "bounce, bounce" })
    expect(details[0].animation).toBe(first)
    expect(details[1].animation).toBe(second)
    expect(details).toHaveLength(3)
  })

  it("matches transitions by property and does not duplicate them as Web Animations", () => {
    const opacity = webAnimation({ transitionProperty: "opacity" })
    const transform = webAnimation({ transitionProperty: "transform" })
    const details = readDetails([opacity, transform], { transitionProperty: "transform, opacity", transitionDuration: "1s" })
    expect(details.map(({ animation }) => animation)).toEqual([transform, opacity])
    expect(details.every(({ kind }) => kind === "transition")).toBe(true)
  })

  it("preserves easing functions containing commas across multiple transitions", () => {
    const details = readDetails([], {
      transitionProperty: "transform, opacity, filter", transitionDuration: "1s",
      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1), steps(4, jump-end), linear(0, 0.5 40%, 1)",
    })
    expect(details.map(({ easing }) => easing)).toEqual([
      "cubic-bezier(0.22, 1, 0.36, 1)", "steps(4, jump-end)", "linear(0, 0.5 40%, 1)",
    ])
  })

  it("ignores effects without timing and does not invent an auto duration", () => {
    const animation = webAnimation({ effect: { getTiming: () => ({ duration: "auto", fill: "auto" }) } })
    expect(readDetails([animation])[0]).toMatchObject({ duration: 0, fillMode: "none", properties: [] })
    expect(readDetails([{ effect: null } as Animation])).toEqual([])
  })

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
    expect(motionDuration(motion({ iterationCount: "0.5" }))).toBe(2000)
  })
})

describe("motion controls", () => {
  it("uses the longest animation as timeline reference and considers every play state", () => {
    const short = { currentTime: 1000, playState: "finished", effect: { getTiming: () => ({ duration: 1000, iterations: 1 }) } } as unknown as Animation
    const long = { currentTime: 2000, playState: "running", effect: { getTiming: () => ({ duration: 4000, iterations: Infinity }) } } as unknown as Animation
    expect(motionPlaybackState([short, long], 4000)).toEqual({ progress: 0.5, playing: true })
    expect(motionPlaybackState([long, short], 4000)).toEqual({ progress: 0.5, playing: true })
    expect(motionPlaybackState([], 4000)).toEqual({ progress: 0, playing: false })
    Object.defineProperty(short, "playState", { value: "running" })
    Object.defineProperty(long, "playState", { value: "paused" })
    expect(motionPlaybackState([short, long], 4000)).toEqual({ progress: 0.25, playing: true })
  })

  it("clamps finished finite animations while scrubbing a longer shared timeline", () => {
    const short = { currentTime: 0, pause: vi.fn(), effect: { getTiming: () => ({ duration: 1000, iterations: 1, delay: 200 }) } }
    const long = { currentTime: 0, pause: vi.fn(), effect: { getTiming: () => ({ duration: 4000, iterations: Infinity, delay: -300 }) } }
    const element = { getAnimations: vi.fn(() => [short, long]) } as unknown as Element
    scrubMotion(element, 0.75, 4000)
    expect(short.currentTime).toBe(1200)
    expect(long.currentTime).toBe(2700)
    expect(short.pause).toHaveBeenCalledOnce()
    expect(long.pause).toHaveBeenCalledOnce()
  })

  it("requests descendant animations and handles missing or throwing APIs", () => {
    const animation = {} as Animation
    const getAnimations = vi.fn(() => [animation])
    expect(getMotionAnimations({ getAnimations } as unknown as Element)).toEqual([animation])
    expect(getAnimations).toHaveBeenCalledWith({ subtree: true })
    expect(getMotionAnimations({} as Element)).toEqual([])
    const unsupported = vi.fn().mockImplementationOnce(() => { throw new Error("no options") }).mockReturnValue([animation])
    expect(getMotionAnimations({ getAnimations: unsupported } as unknown as Element)).toEqual([animation])
    expect(getMotionAnimations({ getAnimations: () => { throw new Error("unavailable") } } as unknown as Element)).toEqual([])
  })

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
