import { createRoot } from "react-dom/client";
import { Mesurer } from "mesurer";

createRoot(document.getElementById("root")!).render(
  <Mesurer
    features={{
      screenshot: false,
      rulers: false,
      settings: false,
    }}
  />,
);
