import { mountMeasurer, type MeasurerController } from "mesurer"

const HOST_ID = "mesurer-extension-host"

type ExtensionRuntime = {
  controller: MeasurerController
  host: HTMLDivElement
}

declare global {
  interface Window {
    __MESURER_EXTENSION__?: ExtensionRuntime
  }
}

const getExistingRuntime = () => {
  const existing = window.__MESURER_EXTENSION__
  if (!existing) return null
  if (!existing.host.isConnected) {
    existing.controller.unmount()
    delete window.__MESURER_EXTENSION__
    return null
  }
  return existing
}

const createHost = () => {
  document.getElementById(HOST_ID)?.remove()

  const host = document.createElement("div")
  host.id = HOST_ID
  host.setAttribute("aria-hidden", "true")
  host.style.all = "initial"
  host.style.position = "fixed"
  host.style.inset = "0"
  host.style.zIndex = "2147483647"
  host.style.pointerEvents = "none"

  const shadowRoot = host.attachShadow({ mode: "open" })
  const mountTarget = document.createElement("div")
  const portalTarget = document.createElement("div")

  shadowRoot.append(mountTarget, portalTarget)
  document.documentElement.appendChild(host)

  return { host, shadowRoot, mountTarget, portalTarget }
}

const mountOrToggle = () => {
  if (window.top !== window.self) return
  if (!document.documentElement) return

  const existing = getExistingRuntime()
  if (existing) {
    existing.controller.toggle()
    return
  }

  const { host, shadowRoot, mountTarget, portalTarget } = createHost()
  const controller = mountMeasurer({
    mountTarget,
    portalTarget,
    styleTarget: shadowRoot,
    enabled: true,
    initialToolMode: "select",
    persistOnReload: false,
    storage: null,
  })

  window.__MESURER_EXTENSION__ = {
    controller,
    host,
  }
}

mountOrToggle()
