import Button from "./components/button";
import AgentPromptButton from "./components/agent-prompt-button";

export default function FinalCta() {
  return (
    <section className="relative left-1/2 mt-24 h-[420px] w-screen -translate-x-1/2 overflow-hidden bg-subtle px-5 py-24 text-left" aria-labelledby="final-cta-title">
      <div className="relative z-10 mx-auto max-w-6xl">
        <h2 id="final-cta-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
          Build precise software with your coding agent.
        </h2>
        <div className="mt-[38px] flex flex-wrap items-center justify-start gap-3" aria-label="Get Mesurer">
          <Button
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/chrome.svg" alt="" draggable={false} className="size-4 brightness-0 invert" />
            Add to Chrome
          </Button>
          <AgentPromptButton />
        </div>
      </div>
      <img
        draggable={false}
        src="https://assets.querrel.com/mesurer/cta.webp"
        alt=""
        className="pointer-events-none absolute -right-10 top-1/2 z-0 h-[480px] w-auto -translate-y-1/2"
      />
    </section>
  );
}
