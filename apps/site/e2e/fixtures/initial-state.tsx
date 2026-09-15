import { createRoot } from "react-dom/client";
import { Mesurer } from "mesurer";

createRoot(document.getElementById("root")!).render(
  <Mesurer
    initialState={{
      minimized: true,
      toolbarPosition: { x: 32, y: 24 },
      arrows: [
        {
          id: "initial-arrow",
          start: { x: 120, y: 120 },
          end: { x: 280, y: 180 },
          color: "#0d99ff",
          width: 2,
        },
      ],
      textAnnotations: [
        {
          id: "initial-text",
          x: 120,
          y: 220,
          text: "Initial annotation",
        },
      ],
    }}
  />,
);
