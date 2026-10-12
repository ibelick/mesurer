import { Mesurer } from "mesurer";
import MarketingPage from "./home";

export default function MarketingRoute() {
  return (
    <>
      {/* Signing in to the platform and saving a review to it are tried against the local one, on
          the dev server only: the built site has none of it. */}
      <Mesurer
        platform={import.meta.env.DEV ? { environment: "development" } : false}
        features={{ review: import.meta.env.DEV }}
        initialState={{ minimized: true }}
      />
      <MarketingPage />
    </>
  );
}
