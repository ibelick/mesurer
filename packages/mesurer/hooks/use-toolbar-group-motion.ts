import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import {
  lerp,
  nearlyEqual,
  progress,
  syncToolbarLayoutWidths,
  TOOLBAR_MOTION_FALLBACK_MS,
  TOOLBAR_RADIUS,
  toolbarMotionTiming,
  toolbarRadius,
  transformTranslateX,
} from "../core/toolbar-motion"

type ToolGroup = "inspect" | "annotate"

type Playback = {
  layoutWidth: number
  collapse: boolean
  group: boolean
  clipFrom: number
  clipTo: number
  radiusFrom: number
  radiusTo: number
}

type Pose = {
  scaleX: number
  clipScale: number
  radius: number
  trailX: number
  trackX: number
  collapseX: number
  stageW: number
  expandedW: number
  collapse: boolean
  chromeWidth: number
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
  collapseStage.style.width = ""
  stage.style.width = ""
  nodes.chrome.style.borderRadius = ""
  nodes.chrome.style.width = ""
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
  nodes: Nodes,
  pose: Pick<Pose, "scaleX" | "clipScale" | "radius" | "trailX" | "trackX" | "collapseX">,
  collapse: boolean,
  layoutWidth = 0,
) => {
  if (collapse && layoutWidth > 0) {
    nodes.chrome.style.transform = ""
    nodes.chrome.style.width = `${layoutWidth * pose.scaleX}px`
    nodes.chrome.style.borderRadius = `${pose.radius}px`
  } else {
    nodes.chrome.style.width = ""
    nodes.chrome.style.transform = nearlyEqual(pose.scaleX, 1, 0.002)
      ? ""
      : `scaleX(${pose.scaleX})`
    nodes.chrome.style.borderRadius = toolbarRadius(pose.radius, pose.scaleX)
  }
  nodes.trailing.style.transform = `translateX(${pose.trailX}px)`
  nodes.track.style.transform = `translateX(${pose.trackX}px)`
  nodes.collapse.style.transform = `translateX(${pose.collapseX}px)`
  if (!collapse) {
    nodes.clip.style.transform = ""
    nodes.surface.style.transform = ""
    nodes.clip.style.borderRadius = ""
    return
  }
  nodes.clip.style.transform = `scaleX(${pose.clipScale})`
  nodes.surface.style.transform = `scaleX(${contentScaleFor(pose.clipScale)})`
  nodes.clip.style.borderRadius = toolbarRadius(pose.radius, pose.clipScale)
}

const captureInterrupt = (
  motion: HTMLElement,
  nodes: Nodes,
  stage: HTMLElement,
  collapseStage: HTMLElement,
  play: Playback,
): Pose => {
  const view = motion.ownerDocument.defaultView
  const computed = view?.getComputedStyle.bind(view) ?? getComputedStyle
  const nextWidth = motion.offsetWidth
  const chromeWidth = nodes.chrome.getBoundingClientRect().width
  const scaleX = play.layoutWidth > 0 ? chromeWidth / play.layoutWidth : 1
  const trailX = transformTranslateX(computed(nodes.trailing).transform)
  const trackX = transformTranslateX(computed(nodes.track).transform)
  const collapseX = transformTranslateX(computed(nodes.collapse).transform)
  return {
    scaleX: play.group ? 1 : scaleX,
    clipScale: play.collapse ? scaleX : 1,
    radius: lerp(
      play.radiusFrom,
      play.radiusTo,
      progress(scaleX, play.clipFrom, play.clipTo),
    ),
    trailX: play.group || play.collapse ? trailX : trailX + (play.layoutWidth - nextWidth),
    trackX,
    collapseX,
    stageW: stage.getBoundingClientRect().width,
    expandedW: collapseStage.getBoundingClientRect().width,
    collapse: play.collapse,
    chromeWidth,
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

const animateWidth = (
  node: HTMLElement,
  from: number,
  to: number,
  duration: number,
  easing: string,
) =>
  node.animate([{ width: `${from}px` }, { width: `${to}px` }], {
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
}) => {
  const readyRef = useRef(false)
  const barWidthRef = useRef(0)
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
    barWidthRef.current = motion.offsetWidth
  }, [motionRef])

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

    syncToolbarLayoutWidths({
      stage,
      collapseStage,
      inspectPanel,
      annotatePanel,
      expandedPanel,
      iconSlot,
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
    const expandedWidth =
      parseFloat(collapseStage.style.getPropertyValue("--msr-expanded-w")) || 0
    const iconWidth =
      parseFloat(collapseStage.style.getPropertyValue("--msr-icon-w")) || 0
    const inspectWidth =
      parseFloat(stage.style.getPropertyValue("--msr-inspect-w")) || 0
    const annotateWidth =
      parseFloat(stage.style.getPropertyValue("--msr-annotate-w")) || 0
    const toStageW = toolGroup === "annotate" ? annotateWidth : inspectWidth
    const fromTrack = interrupt
      ? interrupt.trackX
      : fromGroup === "annotate"
        ? -inspectWidth
        : 0
    const toTrack = toolGroup === "annotate" ? -inspectWidth : 0
    const fromStageW = interrupt
      ? interrupt.stageW
      : fromGroup === "annotate"
        ? annotateWidth
        : inspectWidth
    const fromExpandedW = interrupt
      ? interrupt.expandedW
      : expandedWidth > 0 && toStageW > 0 && fromStageW > 0
        ? expandedWidth - toStageW + fromStageW
        : expandedWidth
    const collapseMotion = closing || opening || Boolean(interrupt?.collapse)
    const groupSwitch =
      !collapseMotion &&
      fromStageW > 0 &&
      toStageW > 0 &&
      (Boolean(interrupt && !interrupt.collapse) ||
        fromGroup !== toolGroup ||
        !nearlyEqual(fromStageW, toStageW) ||
        !nearlyEqual(fromTrack, toTrack))
    if (closing && expandedWidth > 0) {
      stage.style.width = ""
      collapseStage.style.width = `${expandedWidth}px`
      void collapseStage.offsetWidth
    } else if (groupSwitch) {
      stage.style.width = `${fromStageW}px`
      collapseStage.style.width = `${fromExpandedW}px`
      void stage.offsetWidth
      void collapseStage.offsetWidth
    } else {
      stage.style.width = ""
      collapseStage.style.width = ""
    }

    const toWidth = motion.offsetWidth
    const toCollapse = minimized ? -expandedWidth : 0

    const fromWidth = barWidthRef.current
    const padding = Math.max(0, toWidth - collapseStage.offsetWidth)
    const visualIconWidth = iconWidth + padding
    const closeScale =
      toWidth > 0 && visualIconWidth > 0 ? visualIconWidth / toWidth : 1
    const fromScale = interrupt
      ? toWidth > 0
        ? interrupt.chromeWidth / toWidth
        : interrupt.scaleX
      : groupSwitch || !(fromWidth > 0 && toWidth > 0)
        ? 1
        : fromWidth / toWidth
    const toScale = minimized ? closeScale : 1
    const fromClip = interrupt
      ? interrupt.collapse && toWidth > 0
        ? interrupt.chromeWidth / toWidth
        : interrupt.clipScale
      : collapseMotion
        ? fromScale
        : 1
    const toClip = collapseMotion ? toScale : 1
    const fromTrail = interrupt
      ? interrupt.trailX
      : collapseMotion || groupSwitch
        ? 0
        : fromWidth - toWidth
    const fromCollapse = interrupt
      ? interrupt.collapseX
      : fromMinimized
        ? -expandedWidth
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
      nearlyEqual(fromStageW, toStageW) &&
      nearlyEqual(fromExpandedW, expandedWidth)

    const settle = () => {
      barWidthRef.current = motion.offsetWidth
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
      eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      toWidth < 1 ||
      (!interrupt && fromWidth < 1) ||
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
      scaleX: fromScale,
      clipScale: fromClip,
      radius: fromRadius,
      trailX: fromTrail,
      trackX: fromTrack,
      collapseX: fromCollapse,
    }
    const toPose = {
      scaleX: toScale,
      clipScale: toClip,
      radius: toRadius,
      trailX: 0,
      trackX: toTrack,
      collapseX: toCollapse,
    }
    applyPose(nodes, fromPose, collapseMotion, toWidth)
    if (groupSwitch) {
      stage.style.width = `${fromStageW}px`
      collapseStage.style.width = `${fromExpandedW}px`
    }
    void stage.offsetWidth
    void collapseStage.offsetWidth
    void motion.offsetWidth

    if (collapseMotion) nodes.chrome.style.willChange = "width"
    const chromeMotion = collapseMotion
      ? animateWidth(
          nodes.chrome,
          toWidth * fromScale,
          toWidth * toScale,
          duration,
          timing.easing,
        )
      : animateTransform(
          nodes.chrome,
          `scaleX(${fromScale})`,
          `scaleX(${toScale})`,
          duration,
          timing.easing,
        )
    animateTransform(
      nodes.track,
      `translateX(${fromTrack}px)`,
      `translateX(${toTrack}px)`,
      duration,
      timing.easing,
    )
    animateTransform(
      nodes.collapse,
      `translateX(${fromCollapse}px)`,
      `translateX(${toCollapse}px)`,
      duration,
      timing.easing,
    )
    if (groupSwitch) {
      animateWidth(stage, fromStageW, toStageW, duration, timing.easing)
      animateWidth(
        collapseStage,
        fromExpandedW,
        expandedWidth,
        duration,
        timing.easing,
      )
    }

    playRef.current = {
      layoutWidth: toWidth,
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
        nodes.chrome.style.borderRadius = toolbarRadius(visual, chromeScale)
        nodes.trailing.style.transform = `translateX(${toWidth * chromeScale - toWidth}px)`
        return
      }
      nodes.chrome.style.borderRadius = `${visual}px`
      nodes.clip.style.transform = `scaleX(${chromeScale})`
      nodes.surface.style.transform = `scaleX(${contentScaleFor(chromeScale)})`
      nodes.clip.style.borderRadius = toolbarRadius(visual, chromeScale)
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
      applyPose(nodes, toPose, collapseMotion, toWidth)
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
      const pose = captureInterrupt(motion, nodes, stage, collapseStage, play)
      commitMotion(nodes, stage, collapseStage)
      stage.style.width = `${pose.stageW}px`
      collapseStage.style.width = `${pose.expandedW}px`
      interruptRef.current = pose
      const layoutWidth = motion.offsetWidth || play.layoutWidth
      applyPose(
        nodes,
        {
          ...pose,
          scaleX: layoutWidth > 0 ? pose.chromeWidth / layoutWidth : pose.scaleX,
          clipScale:
            pose.collapse && layoutWidth > 0
              ? pose.chromeWidth / layoutWidth
              : pose.clipScale,
        },
        pose.collapse,
        layoutWidth,
      )
      playRef.current = null
    }
  }, [
    annotatePanelRef,
    collapseRef,
    eventTarget,
    expandedPanelRef,
    iconSlotRef,
    inspectPanelRef,
    minimized,
    motionRef,
    stageRef,
    toolGroup,
    trailingRef,
  ])

  return { markReady }
}
