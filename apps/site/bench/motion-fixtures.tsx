import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

function MotionFixture({ label, hint, children }: {
  label: string
  hint: string
  children: (active: boolean) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const reduced = useReducedMotion()
  return (
    <div ref={ref} className="bench-motion-fixture bench-motion-fixture-with-hint">
      <span className="bench-motion-fixture-label">{label}</span>
      {children(inView && !reduced)}
      <p className="bench-motion-fixture-hint">{hint}</p>
    </div>
  )
}

function AutomaticTransition({ active }: { active: boolean }) {
  const [shifted, setShifted] = useState(false)
  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => setShifted((value) => !value), 1800)
    return () => window.clearInterval(interval)
  }, [active])
  return <button type="button" className="bench-motion-js bench-motion-auto-transition" data-testid="motion-auto-transition" style={{ transform: active && shifted ? "translateX(28px) scale(1.12)" : "translateX(-28px) scale(1)", opacity: active && shifted ? 0.55 : 1, transition: active ? undefined : "none" }}>CSS transition</button>
}

function MixedMotion({ active }: { active: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !active) return
    const animation = element.animate([
      { transform: "translateX(-24px) rotate(-8deg)" },
      { transform: "translateX(24px) rotate(8deg)" },
    ], { duration: 2400, iterations: Infinity, direction: "alternate", easing: "ease-in-out" })
    animation.id = "bench-mixed-drift"
    return () => animation.cancel()
  }, [active])
  return <button ref={ref} type="button" className="bench-motion-js bench-motion-mixed" data-testid="motion-mixed" style={{ animationPlayState: active ? "running" : "paused" }}>CSS + JS</button>
}

export function MotionLibraryFixtures() {
  return <>
    <MotionFixture label="Motion / React tween" hint="Inspect browser animations, timing, opacity, and keyframes.">
      {(active) => <motion.button type="button" className="bench-motion-js" data-testid="motion-react-tween" initial={false} animate={active ? { transform: ["translateX(-24px)", "translateX(24px)"], opacity: [0.55, 1] } : { transform: "translateX(0px)", opacity: 1 }} transition={active ? { duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } : { duration: 0 }}>Motion tween</motion.button>}
    </MotionFixture>
    <MotionFixture label="Motion / React spring" hint="Inspect a real spring. JS-driven motion may be read-only.">
      {(active) => <motion.button type="button" className="bench-motion-js" data-testid="motion-react-spring" initial={false} animate={active ? { x: [-24, 24], rotate: [-8, 8] } : { x: 0, rotate: 0 }} transition={active ? { type: "spring", stiffness: 140, damping: 10, repeat: Infinity, repeatType: "mirror", repeatDelay: 0.4 } : { duration: 0 }}>Motion spring</motion.button>}
    </MotionFixture>
    <MotionFixture label="CSS transition / automatic trigger" hint="Changes every 1.8s. Inspect while the transition is active.">
      {(active) => <AutomaticTransition active={active} />}
    </MotionFixture>
    <MotionFixture label="Mixed / CSS opacity + JS transform" hint="Inspect two independent effects without duplicate detection.">
      {(active) => <MixedMotion active={active} />}
    </MotionFixture>
  </>
}
