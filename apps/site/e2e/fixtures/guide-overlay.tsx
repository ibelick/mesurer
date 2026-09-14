import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { captureCommentTarget, resolveCommentTarget } from "../../../../packages/mesurer/comments/dom";

const stealPagePrompt = new URLSearchParams(location.search).has("prompt");

Object.assign(window, {
  __mesurerCommentTargetTest: { captureCommentTarget, resolveCommentTarget },
});

function ShadowCommentTarget() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || host.shadowRoot) return;
    const shadow = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Shadow comment button";
    button.style.cssText = "width: 200px; height: 100px; border: 0; background: #d4d4d8;";
    shadow.append(button);
  }, []);

  return <div ref={hostRef} id="shadow-comment-host" data-testid="shadow-comment-host" style={{ position: "absolute", left: 760, top: 240, width: 200, height: 100 }} />;
}

function Fixture() {
  const [clicks, setClicks] = useState(0);
  const [promptValue, setPromptValue] = useState("");

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
      <ShadowCommentTarget />
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
      <input
        data-testid="page-field"
        aria-label="Page field"
        style={{
          position: "absolute",
          left: 40,
          top: 640,
          width: 280,
          height: 32,
        }}
      />
      {stealPagePrompt ? (
        <textarea
          data-testid="page-prompt"
          aria-label="Page prompt"
          autoFocus
          value={promptValue}
          onChange={(event) => setPromptValue(event.target.value)}
          onBlur={(event) => event.currentTarget.focus()}
          style={{
            position: "absolute",
            left: 40,
            top: 40,
            width: 280,
            height: 48,
          }}
        />
      ) : null}
      <svg
        data-testid="svg-target"
        viewBox="0 0 240 120"
        style={{ position: "absolute", left: 40, top: 100, width: 240, height: 120 }}
      >
        <rect data-testid="svg-rect" x="20" y="20" width="200" height="80" fill="#a1a1aa" />
      </svg>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
await import("../../../extension/src/content");
