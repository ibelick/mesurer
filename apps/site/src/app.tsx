import { lazy, Suspense, useEffect } from "react";
import { Mesurer } from "mesurer";
import MarketingPage from "./pages/marketing/home";
import { useClientPath } from "./use-client-path";

const routeLoaders = {
  changelog: () => import("./pages/changelog"),
  privacy: () => import("./pages/privacy"),
  terms: () => import("./pages/terms"),
  docs: () => import("./pages/docs"),
} as const;
const ChangelogPage = lazy(routeLoaders.changelog);
const PrivacyPage = lazy(routeLoaders.privacy);
const TermsPage = lazy(routeLoaders.terms);
const DocsPage = lazy(routeLoaders.docs);
const OldPage = lazy(() => import("./pages/old"));

const prefetchRoute = (pathname: string) => {
  if (pathname === "/changelog") return routeLoaders.changelog();
  if (pathname === "/privacy") return routeLoaders.privacy();
  if (pathname === "/terms") return routeLoaders.terms();
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return routeLoaders.docs();
  return null;
};

function RoutePrefetcher() {
  useEffect(() => {
    if (window.__MESURER_PRERENDER__) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const preloadOnIntent = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin) void prefetchRoute(url.pathname);
    };
    document.addEventListener("pointerover", preloadOnIntent, { passive: true });
    document.addEventListener("focusin", preloadOnIntent);
    return () => {
      document.removeEventListener("pointerover", preloadOnIntent);
      document.removeEventListener("focusin", preloadOnIntent);
    };
  }, []);
  return null;
}

function Analytics() {
  useEffect(() => {
    if (window.__MESURER_PRERENDER__) return;
    const add = () => {
      if (document.querySelector('script[src="https://assets.onedollarstats.com/stonks.js"]')) return;
      const script = document.createElement("script");
      script.src = "https://assets.onedollarstats.com/stonks.js";
      script.defer = true;
      document.head.appendChild(script);
    };
    const options: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("pointerdown", add, options);
    window.addEventListener("keydown", add, options);
    return () => {
      window.removeEventListener("pointerdown", add, options);
      window.removeEventListener("keydown", add, options);
    };
  }, []);
  return null;
}

export function App() {
  const path = useClientPath();
  const canonical = `https://mesurer.dev${path === "/" ? "" : path}`;
  const page =
    path === "/changelog" ? (
      <ChangelogPage />
    ) : path === "/privacy" ? (
      <PrivacyPage />
    ) : path === "/terms" ? (
      <TermsPage />
    ) : path === "/docs" || path.startsWith("/docs/") ? (
      <DocsPage />
    ) : path === "/old" ? (
      <OldPage />
    ) : (
      <MarketingPage />
    );

  return (
    <>
      <link rel="canonical" href={canonical} />
      <meta property="og:url" content={canonical} />
      <Analytics />
      <RoutePrefetcher />
      <Mesurer initialState={{ minimized: true }} />
      <Suspense fallback={null}>{page}</Suspense>
    </>
  );
}
