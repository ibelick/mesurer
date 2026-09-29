import Button from "./components/button";
import AgentPromptButton from "./components/agent-prompt-button";

export default function FinalCta() {
  return (
    <section
      className="relative left-1/2 mt-24 h-[420px] w-screen -translate-x-1/2 overflow-hidden bg-subtle px-5 py-24 text-left"
      aria-labelledby="final-cta-title"
    >
      <img
        draggable={false}
        src="https://assets.querrel.com/mesurer/cta.webp"
        alt=""
        className="pointer-events-none absolute top-1/2 right-0 z-0 h-[480px] w-auto max-w-none -translate-y-1/2 lg:-right-10"
        loading="lazy"
        decoding="async"
      />
      <div className="relative z-10 mx-auto max-w-6xl">
        <h2
          id="final-cta-title"
          className="max-w-[14rem] text-balance text-[22px] font-medium leading-[1.2] text-strong sm:max-w-xs md:max-w-sm lg:max-w-xl"
        >
          Build precise software with your coding agent.
        </h2>
        <nav
          className="mt-[38px] flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          aria-label="Get Mesurer"
        >
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
      </div>
    </section>
  );
}
