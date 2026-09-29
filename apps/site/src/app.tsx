import { lazy, Suspense, useEffect, useState } from "react";
import MarketingPage from "./pages/marketing/site";
import ChangelogPage from "./pages/changelog";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import DocsPage from "./pages/docs";
import OldPage from "./pages/old";
import { useClientPath } from "./use-client-path";

const Mesurer = lazy(() => import("mesurer").then((mod) => ({ default: mod.Mesurer })));

function MesurerToolbar() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.__MESURER_PRERENDER__) return;
    let cancelled = false;
    const start = () => {
      if (!cancelled) setReady(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(start, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <Mesurer initialState={{ minimized: true }} />
    </Suspense>
  );
}

export function App() {
  const path = useClientPath();
  const canonical = `https://mesurer.dev${path === "/" ? "" : path}`;
  const page =
    path === "/old" ? (
      <OldPage />
    ) : path === "/changelog" ? (
      <ChangelogPage />
    ) : path === "/privacy" ? (
      <PrivacyPage />
    ) : path === "/terms" ? (
      <TermsPage />
    ) : path === "/docs" || path.startsWith("/docs/") ? (
      <DocsPage />
    ) : (
      <MarketingPage />
    );

  return (
    <>
      <link rel="canonical" href={canonical} />
      <meta property="og:url" content={canonical} />
      <MesurerToolbar />
      {page}
    </>
  );
}
