import { Mesurer } from "mesurer";
import MarketingPage from "./home";

export default function MarketingRoute() {
  return (
    <>
      <Mesurer initialState={{ minimized: true }} />
      <MarketingPage />
    </>
  );
}
