import { useState } from "react";
import { createRoot } from "react-dom/client";

function Fixture() {
  const [clicks, setClicks] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => setClicks((value) => value + 1)}
        style={{
          position: "absolute",
          left: 240,
          top: 240,
          width: 200,
          height: 100,
        }}
      >
        Underlying app button
      </button>
      <div
        data-testid="layout-flex"
        style={{
          position: "absolute",
          left: 520,
          top: 240,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 16,
          width: 200,
          boxSizing: "border-box",
          background: "#f4f4f5",
        }}
      >
        <span>Layout item one</span>
        <span>Layout item two</span>
      </div>
      <div
        data-testid="nested-target"
        style={{
          position: "absolute",
          left: 520,
          top: 420,
          width: 200,
          height: 120,
          padding: 20,
          boxSizing: "border-box",
          background: "#e4e4e7",
        }}
      >
        <button
          type="button"
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            background: "#d4d4d8",
          }}
        >
          Nested inner button
        </button>
      </div>
      <button
        type="button"
        style={{
          position: "absolute",
          left: 240,
          top: 520,
          width: 200,
          height: 100,
          fontSize: 18,
        }}
      >
        Secondary app button
      </button>
      <output data-testid="underlying-click-count">{clicks}</output>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
await import("../../../extension/src/content");
