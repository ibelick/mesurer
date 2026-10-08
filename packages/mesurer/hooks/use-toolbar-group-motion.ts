import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import {
  lerp,
  nearlyEqual,
  progress,
  syncToolbarLayoutSizes,
  TOOLBAR_MOTION_FALLBACK_MS,
  TOOLBAR_RADIUS,
  toolbarMotionTiming,
  toolbarAxis,
  toolbarRadius,
  transformTranslate,
  type ToolbarAxis,
} from "../core/toolbar-motion"

type ToolGroup = "inspect" | "annotate"

type Playback = {
  layoutSize: number
  collapse: boolean
  group: boolean
  clipFrom: number
  clipTo: number
  radiusFrom: number
  radiusTo: number
}

// Sizes, offsets and scales run along the toolbar axis.
type Pose = {
  scale: number
  clipScale: number
  radius: number
  trailOffset: number
  trackOffset: number
  collapseOffset: number
  stageSize: number
  expandedSize: number
  collapse: boolean
  chromeSize: number
}

type Nodes = {
  chrome: HTMLElement
  clip: HTMLElement
  surface: HTMLElement
  track: HTMLElement
  trailing: HTMLElement
  collapse: HTMLElement
}

const readNodes = (
  motion: HTMLElement,
  stage: HTMLElement,
  trailing: HTMLElement,
  collapseStage: HTMLElement,
): Nodes | null => {
  const chrome = motion.querySelector(".mesurer-toolbar-chrome")
  const clip = motion.querySelector(".mesurer-toolbar-clip")
  const surface = motion.querySelector(".mesurer-toolbar-surface")
  const track = stage.querySelector(".mesurer-toolbar-tool-track")
  const collapse = collapseStage.querySelector(".mesurer-toolbar-minimize-track")
  if (
    !(chrome instanceof HTMLElement) ||
    !(clip instanceof HTMLElement) ||
    !(surface instanceof HTMLElement) ||
    !(track instanceof HTMLElement) ||
    !(collapse instanceof HTMLElement)
  ) {
    return null
  }
  return { chrome, clip, surface, track, trailing, collapse }
}

const commitAndCancel = (node: HTMLElement) => {
  for (const animation of node.getAnimations()) {
    try {
      animation.commitStyles()
    } catch {
      /* animation may already be finished */
    }
    animation.cancel()
  }
}

const commitMotion = (nodes: Nodes, stage: HTMLElement, collapseStage: HTMLElement) => {
  for (const node of Object.values(nodes)) commitAndCancel(node)
  commitAndCancel(stage)
  commitAndCancel(collapseStage)
}

const clearMotionStyles = (
  motion: HTMLElement,
  nodes: Nodes,
  stage: HTMLElement,
  collapseStage: HTMLElement,
) => {
  commitMotion(nodes, stage, collapseStage)
  // Both axes: an orientation swap can leave the other axis' size behind.
  for (const node of [collapseStage, stage, nodes.chrome]) {
    node.style.width = ""
    node.style.height = ""
  }
  nodes.chrome.style.borderRadius = ""
  nodes.clip.style.borderRadius = ""
  for (const node of Object.values(nodes)) {
    node.style.transition = ""
    node.style.transform = ""
    node.style.willChange = ""
  }
  stage.style.transition = ""
  collapseStage.style.transition = ""
  delete motion.dataset.resizing
}

const contentScaleFor = (clipScale: number) => (clipScale === 0 ? 1 : 1 / clipScale)

const applyPose = (
  axis: ToolbarAxis,
  nodes: Nodes,
  pose: Pick<
    Pose,
    "scale" | "clipScale" | "radius" | "trailOffset" | "trackOffset" | "collapseOffset"
  >,
  collapse: boolean,
  layoutSize = 0,
) => {
  if (collapse && layoutSize > 0) {
    nodes.chrome.style.transform = ""
    nodes.chrome.style[axis.size] = `${layoutSize * pose.scale}px`
    nodes.chrome.style.borderRadius = `${pose.radius}px`
  } else {
    nodes.chrome.style[axis.size] = ""
    nodes.chrome.style.transform = nearlyEqual(pose.scale, 1, 0.002)
      ? ""
      : `${axis.scale}(${pose.scale})`
    nodes.chrome.style.borderRadius = toolbarRadius(pose.radius, pose.scale, axis)
  }
  nodes.trailing.style.transform = `${axis.translate}(${pose.trailOffset}px)`
  nodes.track.style.transform = `${axis.translate}(${pose.trackOffset}px)`
  nodes.collapse.style.transform = `${axis.translate}(${pose.collapseOffset}px)`
  if (!collapse) {
    nodes.clip.style.transform = ""
    nodes.surface.style.transform = ""
    nodes.clip.style.borderRadius = ""
    return
  }
  nodes.clip.style.transform = `${axis.scale}(${pose.clipScale})`
  nodes.surface.style.transform = `${axis.scale}(${contentScaleFor(pose.clipScale)})`
  nodes.clip.style.borderRadius = toolbarRadius(pose.radius, pose.clipScale, axis)
}

const captureInterrupt = (
  axis: ToolbarAxis,
  motion: HTMLElement,
  nodes: Nodes,
  stage: HTMLElement,
  collapseStage: HTMLElement,
  play: Playback,
): Pose => {
  const view = motion.ownerDocument.defaultView
  const computed = view?.getComputedStyle.bind(view) ?? getComputedStyle
  const nextSize = motion[axis.offsetSize]
  const chromeSize = nodes.chrome.getBoundingClientRect()[axis.size]
  const scale = play.layoutSize > 0 ? chromeSize / play.layoutSize : 1
  const trailOffset = transformTranslate(computed(nodes.trailing).transform, axis)
  const trackOffset = transformTranslate(computed(nodes.track).transform, axis)
  const collapseOffset = transformTranslate(computed(nodes.collapse).transform, axis)
  return {
    scale: play.group ? 1 : scale,
    clipScale: play.collapse ? scale : 1,
    radius: lerp(
      play.radiusFrom,
      play.radiusTo,
      progress(scale, play.clipFrom, play.clipTo),
    ),
    trailOffset:
      play.group || play.collapse
        ? trailOffset
        : trailOffset + (play.layoutSize - nextSize),
    trackOffset,
    collapseOffset,
    stageSize: stage.getBoundingClientRect()[axis.size],
    expandedSize: collapseStage.getBoundingClientRect()[axis.size],
    collapse: play.collapse,
    chromeSize,
  }
}

const animateTransform = (
  node: HTMLElement,
  from: string,
  to: string,
  duration: number,
  easing: string,
) =>
  node.animate([{ transform: from }, { transform: to }], {
    duration,
    easing,
    fill: "both",
  })

const animateSize = (
  node: HTMLElement,
  size: ToolbarAxis["size"],
  from: number,
  to: number,
  duration: number,
  easing: string,
) =>
  node.animate([{ [size]: `${from}px` }, { [size]: `${to}px` }], {
    duration,
    easing,
    fill: "both",
  })

export const useToolbarGroupMotion = ({
  eventTarget,
  toolGroup,
  minimized,
  motionRef,
  stageRef,
  trailingRef,
  collapseRef,
  inspectPanelRef,
  annotatePanelRef,
  expandedPanelRef,
  iconSlotRef,
  vertical = false,
}: {
  eventTarget: Window
  toolGroup: ToolGroup
  minimized: boolean
  motionRef: RefObject<HTMLDivElement | null>
  stageRef: RefObject<HTMLDivElement | null>
  trailingRef: RefObject<HTMLDivElement | null>
  collapseRef: RefObject<HTMLDivElement | null>
  inspectPanelRef: RefObject<HTMLDivElement | null>
  annotatePanelRef: RefObject<HTMLDivElement | null>
  expandedPanelRef: RefObject<HTMLDivElement | null>
  iconSlotRef: RefObject<HTMLDivElement | null>
  // Vertical toolbars (docked left/right) run the same motion along the y axis.
  vertical?: boolean
}) => {
  const axis = toolbarAxis(vertical)
  const readyRef = useRef(false)
  const axisRef = useRef(axis)
  const barSizeRef = useRef(0)
  const groupRef = useRef(toolGroup)
  const minimizedRef = useRef(minimized)
  const playRef = useRef<Playback | null>(null)
  const interruptRef = useRef<Pose | null>(null)
  const genRef = useRef(0)

  const markReady = useCallback(() => {
    readyRef.current = true
    const motion = motionRef.current
    if (!motion) return
    motion.dataset.ready = "true"
    barSizeRef.current = motion[axis.offsetSize]
  }, [axis, motionRef])

  useLayoutEffect(() => {
    const motion = motionRef.current
    const stage = stageRef.current
    const trailing = trailingRef.current
    const collapseStage = collapseRef.current
    if (!motion || !stage || !trailing || !collapseStage) return
    const nodes = readNodes(motion, stage, trailing, collapseStage)
    if (!nodes) return

    const inspectPanel = inspectPanelRef.current
    const annotatePanel = annotatePanelRef.current
    const expandedPanel = expandedPanelRef.current
    const iconSlot = iconSlotRef.current
    if (
      !inspectPanel ||
      !annotatePanel ||
      !expandedPanel ||
      !iconSlot
    ) {
      return
    }

    const gen = ++genRef.current

    // An orientation swap starts from a clean slate: poses measured on one axis mean
    // nothing on the other.
    const turned = axisRef.current !== axis
    axisRef.current = axis
    if (turned) {
      interruptRef.current = null
      clearMotionStyles(motion, nodes, stage, collapseStage)
    }

    syncToolbarLayoutSizes({
      stage,
      collapseStage,
      inspectPanel,
      annotatePanel,
      expandedPanel,
      iconSlot,
      axis,
      destGroup: toolGroup,
    })

    const fromMinimized = minimizedRef.current
    const fromGroup = groupRef.current
    minimizedRef.current = minimized
    groupRef.current = toolGroup
    const closing = !fromMinimized && minimized
    const opening = fromMinimized && !minimized
    const interrupt = interruptRef.current
    interruptRef.current = null
    const expandedSize =
      parseFloat(collapseStage.style.getPropertyValue("--msr-expanded-size")) || 0
    const iconSize =
      parseFloat(collapseStage.style.getPropertyValue("--msr-icon-size")) || 0
    const inspectSize =
      parseFloat(stage.style.getPropertyValue("--msr-inspect-size")) || 0
    const annotateSize =
      parseFloat(stage.style.getPropertyValue("--msr-annotate-size")) || 0
    const toStageSize = toolGroup === "annotate" ? annotateSize : inspectSize
    const fromTrack = interrupt
      ? interrupt.trackOffset
      : fromGroup === "annotate"
        ? -inspectSize
        : 0
    const toTrack = toolGroup === "annotate" ? -inspectSize : 0
    const fromStageSize = interrupt
      ? interrupt.stageSize
      : fromGroup === "annotate"
        ? annotateSize
        : inspectSize
    const fromExpandedSize = interrupt
      ? interrupt.expandedSize
      : expandedSize > 0 && toStageSize > 0 && fromStageSize > 0
        ? expandedSize - toStageSize + fromStageSize
        : expandedSize
    const collapseMotion = closing || opening || Boolean(interrupt?.collapse)
    const groupSwitch =
      !collapseMotion &&
      fromStageSize > 0 &&
      toStageSize > 0 &&
      (Boolean(interrupt && !interrupt.collapse) ||
        fromGroup !== toolGroup ||
        !nearlyEqual(fromStageSize, toStageSize) ||
        !nearlyEqual(fromTrack, toTrack))
    if (closing && expandedSize > 0) {
      stage.style[axis.size] = ""
      collapseStage.style[axis.size] = `${expandedSize}px`
      void collapseStage.offsetWidth
    } else if (groupSwitch) {
      stage.style[axis.size] = `${fromStageSize}px`
      collapseStage.style[axis.size] = `${fromExpandedSize}px`
      void stage.offsetWidth
      void collapseStage.offsetWidth
    } else {
      stage.style[axis.size] = ""
      collapseStage.style[axis.size] = ""
    }

    const toSize = motion[axis.offsetSize]
    const toCollapse = minimized ? -expandedSize : 0

    const fromSize = barSizeRef.current
    const padding = Math.max(0, toSize - collapseStage[axis.offsetSize])
    const visualIconSize = iconSize + padding
    const closeScale =
      toSize > 0 && visualIconSize > 0 ? visualIconSize / toSize : 1
    const fromScale = interrupt
      ? toSize > 0
        ? interrupt.chromeSize / toSize
        : interrupt.scale
      : groupSwitch || !(fromSize > 0 && toSize > 0)
        ? 1
        : fromSize / toSize
    const toScale = minimized ? closeScale : 1
    const fromClip = interrupt
      ? interrupt.collapse && toSize > 0
        ? interrupt.chromeSize / toSize
        : interrupt.clipScale
      : collapseMotion
        ? fromScale
        : 1
    const toClip = collapseMotion ? toScale : 1
    const fromTrail = interrupt
      ? interrupt.trailOffset
      : collapseMotion || groupSwitch
        ? 0
        : fromSize - toSize
    const fromCollapse = interrupt
      ? interrupt.collapseOffset
      : fromMinimized
        ? -expandedSize
        : 0
    const fromRadius = interrupt ? interrupt.radius : TOOLBAR_RADIUS
    const toRadius = TOOLBAR_RADIUS
    const timing = toolbarMotionTiming(
      getComputedStyle(motion).getPropertyValue("--msr-toolbar-motion").trim() ||
        `${TOOLBAR_MOTION_FALLBACK_MS}ms ease`,
    )
    const duration = timing.duration
    const atRest =
      nearlyEqual(fromScale, toScale, 0.002) &&
      nearlyEqual(fromClip, toClip, 0.002) &&
      nearlyEqual(fromTrail, 0) &&
      nearlyEqual(fromTrack, toTrack) &&
      nearlyEqual(fromCollapse, toCollapse) &&
      nearlyEqual(fromRadius, toRadius, 0.05) &&
      nearlyEqual(fromStageSize, toStageSize) &&
      nearlyEqual(fromExpandedSize, expandedSize)

    const settle = () => {
      barSizeRef.current = motion[axis.offsetSize]
      groupRef.current = toolGroup
      minimizedRef.current = minimized
    }
    const rest = () => {
      playRef.current = null
      clearMotionStyles(motion, nodes, stage, collapseStage)
      settle()
    }

    const skipMotion =
      !readyRef.current ||
      turned ||
      eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      toSize < 1 ||
      (!interrupt && fromSize < 1) ||
      atRest
    if (skipMotion) {
      rest()
      return
    }

    commitMotion(nodes, stage, collapseStage)
    motion.dataset.resizing = collapseMotion ? "collapse" : "true"
    for (const node of Object.values(nodes)) {
      node.style.transition = "none"
    }
    stage.style.transition = "none"
    collapseStage.style.transition = "none"
    nodes.track.style.willChange = "transform"
    nodes.collapse.style.willChange = "transform"
    if (collapseMotion) {
      nodes.clip.style.willChange = "transform"
      nodes.surface.style.willChange = "transform"
    }
    const fromPose = {
      scale: fromScale,
      clipScale: fromClip,
      radius: fromRadius,
      trailOffset: fromTrail,
      trackOffset: fromTrack,
      collapseOffset: fromCollapse,
    }
    const toPose = {
      scale: toScale,
      clipScale: toClip,
      radius: toRadius,
      trailOffset: 0,
      trackOffset: toTrack,
      collapseOffset: toCollapse,
    }
    applyPose(axis, nodes, fromPose, collapseMotion, toSize)
    if (groupSwitch) {
      stage.style[axis.size] = `${fromStageSize}px`
      collapseStage.style[axis.size] = `${fromExpandedSize}px`
    }
    void stage.offsetWidth
    void collapseStage.offsetWidth
    void motion[axis.offsetSize]

    if (collapseMotion) nodes.chrome.style.willChange = axis.size
    const chromeMotion = collapseMotion
      ? animateSize(
          nodes.chrome,
          axis.size,
          toSize * fromScale,
          toSize * toScale,
          duration,
          timing.easing,
        )
      : animateTransform(
          nodes.chrome,
          `${axis.scale}(${fromScale})`,
          `${axis.scale}(${toScale})`,
          duration,
          timing.easing,
        )
    animateTransform(
      nodes.track,
      `${axis.translate}(${fromTrack}px)`,
      `${axis.translate}(${toTrack}px)`,
      duration,
      timing.easing,
    )
    animateTransform(
      nodes.collapse,
      `${axis.translate}(${fromCollapse}px)`,
      `${axis.translate}(${toCollapse}px)`,
      duration,
      timing.easing,
    )
    if (groupSwitch) {
      animateSize(stage, axis.size, fromStageSize, toStageSize, duration, timing.easing)
      animateSize(
        collapseStage,
        axis.size,
        fromExpandedSize,
        expandedSize,
        duration,
        timing.easing,
      )
    }

    playRef.current = {
      layoutSize: toSize,
      collapse: collapseMotion,
      group: groupSwitch,
      clipFrom: fromClip,
      clipTo: toClip,
      radiusFrom: fromRadius,
      radiusTo: toRadius,
    }

    const needsFollow =
      collapseMotion ||
      (!groupSwitch && !nearlyEqual(fromScale, toScale, 0.002))
    const followClip = () => {
      const t = chromeMotion.effect?.getComputedTiming().progress ?? 0
      const chromeScale = lerp(fromScale, toScale, t)
      const visual = lerp(
        fromRadius,
        toRadius,
        progress(chromeScale, fromScale, toScale),
      )
      if (!collapseMotion) {
        nodes.chrome.style.borderRadius = toolbarRadius(visual, chromeScale, axis)
        nodes.trailing.style.transform = `${axis.translate}(${toSize * chromeScale - toSize}px)`
        return
      }
      nodes.chrome.style.borderRadius = `${visual}px`
      nodes.clip.style.transform = `${axis.scale}(${chromeScale})`
      nodes.surface.style.transform = `${axis.scale}(${contentScaleFor(chromeScale)})`
      nodes.clip.style.borderRadius = toolbarRadius(visual, chromeScale, axis)
    }
    let frame = 0
    const stopFollow = () => {
      if (frame) eventTarget.cancelAnimationFrame(frame)
      frame = 0
    }
    if (needsFollow) {
      followClip()
      frame = eventTarget.requestAnimationFrame(function tick() {
        followClip()
        frame = eventTarget.requestAnimationFrame(tick)
      })
    }

    let finished = false
    const finish = () => {
      if (finished || gen !== genRef.current) return
      finished = true
      stopFollow()
      applyPose(axis, nodes, toPose, collapseMotion, toSize)
      rest()
    }
    const timeout = eventTarget.setTimeout(finish, duration + 32)
    return () => {
      eventTarget.clearTimeout(timeout)
      stopFollow()
      if (finished) return
      const play = playRef.current
      if (!motion.isConnected) {
        finish()
        return
      }
      if (!play) {
        clearMotionStyles(motion, nodes, stage, collapseStage)
        return
      }
      const pose = captureInterrupt(axis, motion, nodes, stage, collapseStage, play)
      commitMotion(nodes, stage, collapseStage)
      stage.style[axis.size] = `${pose.stageSize}px`
      collapseStage.style[axis.size] = `${pose.expandedSize}px`
      interruptRef.current = pose
      const layoutSize = motion[axis.offsetSize] || play.layoutSize
      applyPose(
        axis,
        nodes,
        {
          ...pose,
          scale: layoutSize > 0 ? pose.chromeSize / layoutSize : pose.scale,
          clipScale:
            pose.collapse && layoutSize > 0
              ? pose.chromeSize / layoutSize
              : pose.clipScale,
        },
        pose.collapse,
        layoutSize,
      )
      playRef.current = null
    }
  }, [
    annotatePanelRef,
    axis,
    collapseRef,
    eventTarget,
    expandedPanelRef,
    iconSlotRef,
    inspectPanelRef,
    markReady,
    minimized,
    motionRef,
    stageRef,
    toolGroup,
    trailingRef,
  ])

  return { markReady }
}
