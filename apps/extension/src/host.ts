export const HOST_ID = "mesurer-extension-host";
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
let liveHost: HTMLElement | null = null;
let onHostInvalidated: (() => void) | null = null;
let recovering = false;

const lockHostStyles = (host: HTMLElement) => {
  host.removeAttribute("hidden");
  host.removeAttribute("inert");
  for (const [property, value] of HOST_STYLES) {
    host.style.setProperty(property, value, "important");
  }
};

const attachHost = (host: HTMLElement) => {
  const root = document.documentElement;
  if (!root) return;
  if (host.parentElement !== root) root.appendChild(host);
};

const ensureContainer = (shadowRoot: ShadowRoot) => {
  let container = shadowRoot.getElementById(ROOT_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = ROOT_ID;
    shadowRoot.appendChild(container);
  }
  return container;
};

const observeRoots = (observer: MutationObserver, host: HTMLElement) => {
  observer.disconnect();
  observer.observe(document, { childList: true });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true });
  if (document.body) observer.observe(document.body, { childList: true });
  observer.observe(host, {
    attributes: true,
    attributeFilter: ["style", "class", "hidden", "inert"],
  });
  if (host.shadowRoot) observer.observe(host.shadowRoot, { childList: true });
};

export const setHostInvalidatedHandler = (handler: (() => void) | null) => {
  onHostInvalidated = handler;
};

export const recoverHost = () => {
  if (recovering) {
    return liveHost
      ? {
          host: liveHost,
          container: liveHost.shadowRoot?.getElementById(ROOT_ID) ?? null,
          shadowRoot: liveHost.shadowRoot,
        }
      : null;
  }
  recovering = true;
  try {
    const host = document.getElementById(HOST_ID) ?? liveHost;
    if (!host) {
      onHostInvalidated?.();
      return null;
    }
    liveHost = host;
    lockHostStyles(host);
    attachHost(host);
    if (!host.isConnected) {
      onHostInvalidated?.();
      return null;
    }
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const hadContainer = Boolean(shadowRoot.getElementById(ROOT_ID));
    const container = ensureContainer(shadowRoot);
    if (!hadContainer) onHostInvalidated?.();
    return { host, container, shadowRoot };
  } finally {
    recovering = false;
  }
};

export const getOrCreateContainer = () => {
  let host = document.getElementById(HOST_ID) ?? liveHost;

  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
  }

  liveHost = host;
  lockHostStyles(host);
  attachHost(host);

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const container = ensureContainer(shadowRoot);

  if (!hostCleanups.has(host)) {
    let locking = false;
    const relock = () => {
      if (locking) return;
      locking = true;
      recoverHost();
      if (liveHost) observeRoots(observer, liveHost);
      queueMicrotask(() => {
        locking = false;
      });
    };
    const observer = new MutationObserver(relock);
    observeRoots(observer, host);
    const onPageShow = () => relock();
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPageShow);
    document.addEventListener("visibilitychange", onPageShow);
    hostCleanups.set(host, () => {
      observer.disconnect();
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPageShow);
      document.removeEventListener("visibilitychange", onPageShow);
    });
  }

  return { host, container, shadowRoot };
};

export const destroyHost = () => {
  const host = liveHost ?? document.getElementById(HOST_ID);
  liveHost = null;
  if (!host) return;
  hostCleanups.get(host)?.();
  hostCleanups.delete(host);
  host.remove();
};
