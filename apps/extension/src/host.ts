export const HOST_ID = "mesurer-extension-host";
export const HOST_TAG = "mesurer-host";
export const ROOT_ID = "mesurer-extension-root";

const HOST_STYLES: Array<[string, string]> = [
  ["all", "initial"],
  ["display", "block"],
  ["position", "fixed"],
  ["inset", "0px"],
  ["top", "0px"],
  ["right", "0px"],
  ["bottom", "0px"],
  ["left", "0px"],
  ["width", "100vw"],
  ["height", "100vh"],
  ["max-width", "none"],
  ["max-height", "none"],
  ["min-width", "0px"],
  ["min-height", "0px"],
  ["margin", "0px"],
  ["padding", "0px"],
  ["border", "0px"],
  ["outline", "none"],
  ["overflow", "visible"],
  ["opacity", "1"],
  ["visibility", "visible"],
  ["pointer-events", "none"],
  ["z-index", "2147483647"],
  ["isolation", "isolate"],
  ["transform", "none"],
  ["translate", "none"],
  ["rotate", "none"],
  ["scale", "none"],
  ["filter", "none"],
  ["backdrop-filter", "none"],
  ["mix-blend-mode", "normal"],
  ["clip-path", "none"],
  ["mask-image", "none"],
  ["zoom", "1"],
  ["contain", "none"],
  ["background", "transparent"],
  ["box-shadow", "none"],
  ["color-scheme", "light"],
  ["color", "#0f172a"],
  ["font-family", "ui-sans-serif, system-ui, sans-serif"],
  ["font-size", "16px"],
  ["font-weight", "400"],
  ["line-height", "1.5"],
  ["letter-spacing", "normal"],
  ["direction", "ltr"],
];

const hostCleanups = new WeakMap<HTMLElement, () => void>();

const defineHostElement = () => {
  if (customElements.get(HOST_TAG)) return;
  customElements.define(HOST_TAG, class extends HTMLElement {});
};

const lockHostStyles = (host: HTMLElement) => {
  host.removeAttribute("hidden");
  host.removeAttribute("inert");
  for (const [property, value] of HOST_STYLES) {
    host.style.setProperty(property, value, "important");
  }
};

const attachHost = (host: HTMLElement) => {
  const root = document.documentElement;
  if (host.parentElement !== root) root.appendChild(host);
};

export const getOrCreateContainer = () => {
  defineHostElement();

  let host = document.getElementById(HOST_ID);
  if (host && host.localName !== HOST_TAG) {
    host.remove();
    host = null;
  }

  if (!host) {
    host = document.createElement(HOST_TAG);
    host.id = HOST_ID;
  }

  lockHostStyles(host);
  attachHost(host);

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });

  let container = shadowRoot.getElementById(ROOT_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = ROOT_ID;
    shadowRoot.appendChild(container);
  }

  if (!hostCleanups.has(host)) {
    let locking = false;
    const relock = () => {
      if (locking) return;
      locking = true;
      attachHost(host);
      lockHostStyles(host);
      queueMicrotask(() => {
        locking = false;
      });
    };
    const observer = new MutationObserver(relock);
    observer.observe(host, {
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "inert"],
    });
    observer.observe(document.documentElement, { childList: true });
    hostCleanups.set(host, () => observer.disconnect());
  }

  return { host, container, shadowRoot };
};

export const destroyHost = () => {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  hostCleanups.get(host)?.();
  hostCleanups.delete(host);
  host.remove();
};
