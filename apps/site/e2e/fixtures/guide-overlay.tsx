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
