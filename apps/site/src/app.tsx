import MarketingPage from "./pages/marketing/site";
import ChangelogPage from "./pages/changelog";
import PrivacyPage from "./pages/privacy";
import OldPage from "./pages/old";

export function App() {
  if (window.location.pathname === "/old") return <OldPage />;
  if (window.location.pathname === "/changelog") return <ChangelogPage />;
  if (window.location.pathname === "/privacy") return <PrivacyPage />;
  return <MarketingPage />;
}
