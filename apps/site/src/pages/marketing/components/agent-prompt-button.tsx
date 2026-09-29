import { useState } from "react";

export const setupPrompt = "Set up Mesurer in this project: install the `mesurer` package, add `<Mesurer />` to the app, and explain how to use it.";

export function RiFileCopyLine({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.9998 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z" />
    </svg>
  );
}

export function RiCheckLine({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10.0007 15.1709L19.1924 5.97925L20.6066 7.39346L10.0007 17.9993L3.63672 11.6353L5.05093 10.2211L10.0007 15.1709Z" />
    </svg>
  );
}

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
      aria-label={state === "copied" ? "Prompt copied" : state === "error" ? "Copy failed" : "Copy setup prompt"}
      className="inline-flex select-none items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-base font-[450] leading-none text-neutral-900 transition-colors duration-150 ease-out border border-neutral-200 bg-white hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong active:opacity-75"
    >
      {state === "copied" ? <RiCheckLine /> : <RiFileCopyLine />}
      Copy setup prompt
    </button>
  );
}
