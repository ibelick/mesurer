import Button from "./components/button";
import AgentPromptButton from "./components/agent-prompt-button";
import { getPackageVersion } from "../../utils/get-package-version";

const version = getPackageVersion();
// Counted from npm when the site is built; the count of 14 November 2026 when npm cannot be reached.
const DOWNLOAD_COUNT = (__MESURER_DOWNLOADS__ ?? 839_290).toLocaleString("en-US");

export default function Hero() {
  return (
    <section className="mx-auto mt-24 w-full max-w-2xl text-left" aria-labelledby="landing-title">
      <div className="flex max-w-[460px] flex-col">
        <h1 id="landing-title" className="text-balance text-[22px] font-medium leading-tight text-strong">
          Build precise software with your coding agent.
        </h1>
        <p className="mt-2 text-pretty text-[22px] leading-tight text-muted">
          Inspect, annotate, and direct changes directly on your live interface.
        </p>
        <nav className="mt-[38px] flex flex-wrap items-center justify-start gap-3" aria-label="Get Mesurer">
          <Button
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/chrome.svg" alt="" draggable={false} className="size-4 brightness-0 invert" />
            Add to Chrome
          </Button>
          <AgentPromptButton />
        </nav>
        <p className="mt-4 text-pretty text-xs leading-[1.35] text-muted">
          <a href="https://www.npmjs.com/package/mesurer" target="_blank" rel="noreferrer" className="font-medium text-strong underline decoration-border underline-offset-2 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong">
            v{version}
          </a>
          <span aria-hidden="true"> · </span>
          <span className="font-medium tabular-nums lining-nums text-strong">{DOWNLOAD_COUNT}</span> downloads
        </p>
      </div>
    </section>
  );
}
