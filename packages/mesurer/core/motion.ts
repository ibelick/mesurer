export type MotionKind = "animation" | "transition"

export type MotionDetails = {
  kind: MotionKind
  name: string
  duration: number
  delay: number
  easing: string
  properties: string[]
  iterationCount: string
  direction: string
  fillMode: string
  animation: Animation | null
}

const splitList = (value: string) => value.split(",").map((part) => part.trim())

const listValue = (values: string[], index: number) => values[index % values.length] ?? ""

const parseTime = (value: string) => {
  const match = value.trim().match(/^(-?[\d.]+)(ms|s)$/i)
  if (!match) return 0
  const amount = Number.parseFloat(match[1])
  return match[2].toLowerCase() === "s" ? amount * 1000 : amount
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))]

const motionKeyframes = (animation: Animation | null) => {
  const effect = animation?.effect as (KeyframeEffect & { getKeyframes: () => Keyframe[] }) | null
  if (!effect || typeof effect.getKeyframes !== "function") return []
  try {
    return effect.getKeyframes()
  } catch {
    return []
  }
}

const FRAME_METADATA = new Set(["offset", "easing", "composite", "computedOffset"])

export const motionCssProperty = (property: string) => property.startsWith("--")
  ? property
  : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const keyframeProperties = (animation: Animation | null) => unique(
  motionKeyframes(animation).flatMap((frame) => Object.keys(frame)).filter((property) => !FRAME_METADATA.has(property)),
)

export const readMotionKeyframes = (animation: Animation | null, easing?: string) => motionKeyframes(animation).map((frame) => {
  const declarations = Object.entries(frame)
    .filter(([property]) => !FRAME_METADATA.has(property))
    .map(([property, value]) => `${motionCssProperty(property)}: ${value};`)
  if (frame.easing && frame.easing !== "linear") declarations.push(`animation-timing-function: ${frame.easing};`)
  if (frame.composite && frame.composite !== "auto" && frame.composite !== "replace") declarations.push(`animation-composition: ${frame.composite};`)
  return {
    offset: `${Math.round(Number(frame.computedOffset ?? frame.offset ?? 0) * 10000) / 100}%`,
    value: declarations.join(" "),
    displayValue: declarations.filter((declaration) => declaration !== `animation-timing-function: ${easing};`)
      .map((declaration) => declaration.slice(0, -1).replace(/^animation-timing-function:/, "easing:").replace(/^animation-composition:/, "composition:"))
      .join("\n"),
  }
})

const getAnimations = (element: Element) => {
  try {
    return typeof element.getAnimations === "function" ? element.getAnimations() : []
  } catch {
    return []
  }
}

const animationFor = (animations: Animation[], name: string, index: number) => {
  const named = animations.filter((animation) => {
    const candidate = animation as Animation & { animationName?: string }
    return candidate.animationName === name
  })
  return named[index] ?? animations[index] ?? null
}

export const readMotionDetails = (element: Element, ownerWindow: Window): MotionDetails[] => {
  const style = ownerWindow.getComputedStyle(element)
  const animations = getAnimations(element)
  const names = splitList(style.animationName)
  const durations = splitList(style.animationDuration)
  const delays = splitList(style.animationDelay)
  const easings = splitList(style.animationTimingFunction)
  const iterations = splitList(style.animationIterationCount)
  const directions = splitList(style.animationDirection)
  const fills = splitList(style.animationFillMode)
  const animationDetails = names
    .map((name, index) => ({
      kind: "animation" as const,
      name,
      duration: parseTime(listValue(durations, index)),
      delay: parseTime(listValue(delays, index)),
      easing: listValue(easings, index),
      properties: keyframeProperties(animationFor(animations, name, index)),
      iterationCount: listValue(iterations, index),
      direction: listValue(directions, index),
      fillMode: listValue(fills, index),
      animation: animationFor(animations, name, index),
    }))
    .filter((motion) => motion.name !== "none")

  const transitionProperties = splitList(style.transitionProperty)
  const transitionDurations = splitList(style.transitionDuration)
  const transitionDelays = splitList(style.transitionDelay)
  const transitionEasings = splitList(style.transitionTimingFunction)
  const transitionAnimations = animations.filter((animation) => {
    const candidate = animation as Animation & { transitionProperty?: string }
    return Boolean(candidate.transitionProperty)
  })
  const transitionDetails = transitionProperties
    .map((property, index) => ({
      kind: "transition" as const,
      name: property,
      duration: parseTime(listValue(transitionDurations, index)),
      delay: parseTime(listValue(transitionDelays, index)),
      easing: listValue(transitionEasings, index),
      properties: property === "all" ? ["all"] : [property],
      iterationCount: "1",
      direction: "normal",
      fillMode: "both",
      animation: transitionAnimations[index] ?? null,
    }))
    .filter((motion) => motion.name !== "none" && motion.duration > 0)

  return [...animationDetails, ...transitionDetails]
}

export const motionDuration = (motion: MotionDetails) => {
  const iterations = Number.parseFloat(motion.iterationCount)
  return Number.isFinite(iterations) ? motion.duration * Math.max(1, iterations) : motion.duration
}

export const motionPlaybackProgress = (animation: Animation, duration: number) => {
  const time = animation.currentTime
  if (typeof time !== "number" || !Number.isFinite(time) || duration <= 0) return 0
  const timing = animation.effect?.getTiming()
  const elapsed = Math.max(0, time - (timing?.delay ?? 0))
  const looping = timing?.iterations === Infinity
  // Keep a scrub to the exact end visible until playback resumes.
  const position = looping && (animation.playState === "running" || elapsed > duration)
    ? elapsed % duration
    : elapsed
  return Math.min(1, position / duration)
}

export const formatMotionTime = (milliseconds: number) => {
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(milliseconds >= 10000 ? 0 : 1)}s`
  return `${Math.round(milliseconds)}ms`
}

export const controlMotion = (element: Element, action: "play" | "pause" | "replay", playbackRate = 1) => {
  for (const animation of getAnimations(element)) {
    animation.playbackRate = playbackRate
    if (action === "replay") {
      animation.cancel()
      animation.play()
    } else if (action === "play") {
      animation.play()
    } else {
      animation.pause()
    }
  }
}

export const scrubMotion = (element: Element, progress: number, duration: number) => {
  const currentTime = Math.max(0, Math.min(1, progress)) * duration
  for (const animation of getAnimations(element)) {
    animation.currentTime = currentTime + (animation.effect?.getTiming().delay ?? 0)
    animation.pause()
  }
}
