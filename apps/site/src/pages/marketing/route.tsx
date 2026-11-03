import { Mesurer } from "mesurer";
import MarketingPage from "./home";

export default function MarketingRoute() {
  return (
    <>
      <Mesurer
        platform={{ environment: import.meta.env.DEV ? "development" : "production" }}
        initialState={{ minimized: true }}
      />
      <MarketingPage />
    </>
  );
}
