import { useEffect, useState } from "react";

const FULL_PAGE_PREFIXES = ["/bench", "/e2e"];

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

const sameDocumentUrl = (url: URL) =>
  url.origin === window.location.origin &&
  !FULL_PAGE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));

const scrollInstant: ScrollIntoViewOptions = { behavior: "instant", block: "start" };

const jumpToHash = (hash: string) => {
  if (hash && hash !== "#") {
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) {
      target.scrollIntoView(scrollInstant);
      return;
    }
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};

const scrollAfterNavigate = (hash: string) => {
  window.requestAnimationFrame(() => {
    jumpToHash(hash);
    window.requestAnimationFrame(() => jumpToHash(hash));
  });
};

export function useClientPath() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const sync = (scroll: boolean) => {
      setPath(normalizePath(window.location.pathname));
      if (scroll) scrollAfterNavigate(window.location.hash);
    };

    const onPopState = () => sync(true);

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(anchor.href, window.location.href);
      if (!sameDocumentUrl(url)) return;
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      event.preventDefault();
      if (next !== current) window.history.pushState({}, "", next);
      sync(true);
    };

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return path;
}
