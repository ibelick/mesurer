import { createRoot } from "react-dom/client"
import type { MeasurerController, MountMeasurerOptions } from "./api"
import { dispatchMeasurerCommand } from "./commands"
import { MeasurerRoot } from "./measurer-root"

const clearTarget = (target?: Element | DocumentFragment | null) => {
  if (!target || !("replaceChildren" in target)) return
  target.replaceChildren()
}

export const mountMeasurer = ({
  mountTarget,
  portalTarget,
  styleTarget,
  storage,
  enabled = true,
  ...props
}: MountMeasurerOptions): MeasurerController => {
  const commandTarget = new EventTarget()
  const root = createRoot(mountTarget)
  let unmounted = false

  root.render(
    <MeasurerRoot
      {...props}
      initialEnabled={enabled}
      portalTarget={portalTarget ?? mountTarget}
      styleTarget={styleTarget}
      storage={storage}
      commandTarget={commandTarget}
    />
  )

  const dispatch = (type: Parameters<typeof dispatchMeasurerCommand>[1]) => {
    if (unmounted) return
    dispatchMeasurerCommand(commandTarget, type)
  }

  return {
    toggle: () => dispatch("toggle"),
    enable: () => dispatch("enable"),
    disable: () => dispatch("disable"),
    unmount: () => {
      if (unmounted) return
      unmounted = true
      root.unmount()
      clearTarget(mountTarget)
      if (portalTarget && portalTarget !== mountTarget) {
        clearTarget(portalTarget)
      }
    },
  }
}
