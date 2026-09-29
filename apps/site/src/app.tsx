import { Mesurer } from "mesurer";
import MarketingPage from "./pages/marketing/site";
import ChangelogPage from "./pages/changelog";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import DocsPage from "./pages/docs";
import OldPage from "./pages/old";
import { useClientPath } from "./use-client-path";

export function App() {
  const path = useClientPath();
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
      <Mesurer initialState={{ minimized: true }} />
      {page}
    </>
  );
}
