export type MotionKind = "animation" | "transition" | "web-animation"
export const OBSERVED_MOTION_PROPERTIES = ["transform", "translate", "rotate", "scale", "opacity", "filter", "clip-path", "width", "height", "top", "left", "content"]

const controlledAnimations = new WeakSet<Animation>()

// Finite, running script-created effects may be transient pieces of a JS
// lifecycle. CSS effects and animations explicitly controlled here remain seekable.
export const hasTransientScriptMotion = (element: Element, animations = scopedMotionAnimations(element)) => animations.some((animation) => {
  if (controlledAnimations.has(animation) || "animationName" in animation || "transitionProperty" in animation || animation.playState !== "running") return false
  try {
    const timing = animation.effect?.getTiming()
    return Boolean(timing && timing.iterations !== Infinity)
  } catch { return false }
})

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

// Commas inside cubic-bezier(), steps(), or linear() are not list separators.
const splitList = (value: string) => value.split(/,(?![^()]*\))/).map((part) => part.trim())

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

export const getMotionAnimations = (element: Element) => {
  const read = (target: Element) => {
    try { return typeof target.getAnimations === "function" ? target.getAnimations({ subtree: true }) : [] }
    catch { try { return target.getAnimations() } catch { return [] } }
  }
  const animations = new Set(read(element))
  // getAnimations({subtree:true}) does not cross open shadow boundaries.
  const nodes = [element]
  for (let index = 0; index < nodes.length && index < 128; index++) {
    const node = nodes[index]
    const shadow = [...(node.shadowRoot?.children ?? [])]
    for (const child of shadow) for (const animation of read(child)) animations.add(animation)
    nodes.push(...[...(node.children ?? []), ...shadow].slice(0, 128 - nodes.length))
  }
  return [...animations]
}

// How many levels below the inspected element its motion still counts for it: the element, its
// children and its grandchildren. Deeper motion belongs to a more specific element.
export const MOTION_LEVELS = 2

// How many levels below `element` `target` sits, or null when it is outside MOTION_LEVELS.
export const motionLevel = (element: Element, target: Element): number | null => {
  let level = 0
  let node: Element | null = target
  while (node && node !== element && level <= MOTION_LEVELS) {
    node = node.parentElement ?? (node.getRootNode?.() as ShadowRoot | undefined)?.host ?? null
    level++
  }
  return node === element && level <= MOTION_LEVELS ? level : null
}

// The animations that make the element's motion: its own and those of its children within
// MOTION_LEVELS. Pseudo-element animations are left out.
export const scopedMotionAnimations = (element: Element, animations = getMotionAnimations(element)) =>
  animations.filter((animation) => {
    const effect = animation.effect as KeyframeEffect | null
    if (effect?.pseudoElement) return false
    return !effect?.target || motionLevel(element, effect.target) !== null
  })

// Only the element's own animations, for the rows that name its CSS animations and transitions.
export const ownMotionAnimations = (element: Element, animations = getMotionAnimations(element)) =>
  animations.filter((animation) => {
    const effect = animation.effect as KeyframeEffect | null
    return (!effect?.target || effect.target === element) && !effect?.pseudoElement
  })

const animationFor = (animations: Animation[], name: string, index: number) => {
  const named = animations.filter((animation) => {
    const candidate = animation as Animation & { animationName?: string }
    return candidate.animationName === name
  })
  return named[index] ?? null
}

export const readMotionDetails = (element: Element, ownerWindow: Window): MotionDetails[] => {
  ownerWindow = element.ownerDocument?.defaultView ?? ownerWindow
  const style = ownerWindow.getComputedStyle(element)
  const animations = getMotionAnimations(element)
  const ownAnimations = ownMotionAnimations(element, animations)
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
      properties: keyframeProperties(animationFor(ownAnimations, name, names.slice(0, index).filter((candidate) => candidate === name).length)),
      iterationCount: listValue(iterations, index),
      direction: listValue(directions, index),
      fillMode: listValue(fills, index),
      animation: animationFor(ownAnimations, name, names.slice(0, index).filter((candidate) => candidate === name).length),
    }))
    .filter((motion) => motion.name !== "none")

  const transitionProperties = splitList(style.transitionProperty)
  const transitionDurations = splitList(style.transitionDuration)
  const transitionDelays = splitList(style.transitionDelay)
  const transitionEasings = splitList(style.transitionTimingFunction)
  const transitionAnimations = ownAnimations.filter((animation) => {
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
      animation: transitionAnimations.find((animation) => (animation as CSSTransition).transitionProperty === property) ?? (property === "all" ? transitionAnimations[0] : null) ?? null,
    }))
     .filter((motion) => motion.name !== "none" && motion.duration > 0 && motion.animation !== null)

  const claimed = new Set([...animationDetails, ...transitionDetails].map((motion) => motion.animation))
  const webAnimations = scopedMotionAnimations(element, animations).filter((animation) => !claimed.has(animation))
    .flatMap((animation, index) => {
      let timing: EffectTiming | undefined
      try { timing = animation.effect?.getTiming() } catch { return [] }
      if (!timing) return []
      const properties = keyframeProperties(animation)
      return [{
        kind: "animationName" in animation ? "animation" as const : "transitionProperty" in animation ? "transition" as const : "web-animation" as const,
        name: (animation as CSSAnimation).animationName || (animation as CSSTransition).transitionProperty || animation.id || `js-${motionCssProperty(properties[0] || "animation")}-${index + 1}`,
        duration: typeof timing.duration === "number" && Number.isFinite(timing.duration) ? timing.duration : 0,
        delay: timing.delay ?? 0,
        easing: timing.easing || "linear",
        properties,
        iterationCount: timing.iterations === Infinity ? "infinite" : String(timing.iterations ?? 1),
        direction: timing.direction || "normal",
        fillMode: timing.fill === "auto" ? "none" : timing.fill || "none",
        animation,
      }]
    })
  return [...animationDetails, ...transitionDetails, ...webAnimations]
}

export const motionDuration = (motion: MotionDetails) => {
  const iterations = Number.parseFloat(motion.iterationCount)
  return Number.isFinite(iterations) ? motion.duration * Math.max(0, iterations) : motion.duration
}

const animationDuration = (animation: Animation, fallback: number) => {
  const timing = animation.effect?.getTiming()
  if (typeof timing?.duration !== "number" || !Number.isFinite(timing.duration)) return fallback
  return timing.duration * (timing.iterations === Infinity ? 1 : Math.max(0, timing.iterations ?? 1))
}

export const motionPlaybackState = (animations: Animation[], duration: number) => {
  const active = animations.filter((animation) => animation.playState === "running")
  const reference = (active.length ? active : animations).reduce<Animation | null>((longest, animation) => !longest || animationDuration(animation, duration) > animationDuration(longest, duration) ? animation : longest, null)
  return {
    playing: active.length > 0,
    progress: reference ? motionPlaybackProgress(reference, duration) : 0,
  }
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
  for (const animation of getMotionAnimations(element)) {
    controlledAnimations.add(animation)
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
  scrubAnimations(getMotionAnimations(element), progress, duration)
}

export const scrubAnimations = (animations: Animation[], progress: number, duration: number) => {
  const currentTime = Math.max(0, Math.min(1, progress)) * duration
  for (const animation of animations) {
    controlledAnimations.add(animation)
    const timing = animation.effect?.getTiming()
    const elapsed = timing?.iterations === Infinity ? currentTime : Math.min(currentTime, animationDuration(animation, duration))
    animation.currentTime = elapsed + (timing?.delay ?? 0)
    animation.pause()
  }
}
