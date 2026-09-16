import { useState } from "react";

const setupPrompt = "Set up Mesurer in this project: install the `mesurer` package, add `<Mesurer />` to the app, and explain how to use it.";

export default function AgentPromptButton() {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(setupPrompt);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copyPrompt()}
      className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-base font-[450] leading-none text-neutral-900 transition-colors duration-150 ease-out border border-neutral-200 bg-white hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong active:opacity-75"
    >
      {state === "copied" ? "Prompt copied" : state === "error" ? "Copy failed" : "Copy setup prompt"}
    </button>
  );
}
