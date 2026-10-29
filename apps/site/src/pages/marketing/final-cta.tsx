import Button from "./components/button";

export default function FinalCta() {
  return (
    <section
      className="relative left-1/2 min-h-[420px] w-screen -translate-x-1/2 overflow-hidden bg-strong-bg px-3 py-32 text-left"
      aria-labelledby="final-cta-title"
    >
      <img
        draggable={false}
        src="https://assets.querrel.com/mesurer/cta-logo.webp"
        alt=""
        className="pointer-events-none absolute top-1/2 right-0 z-0 h-[480px] w-auto max-w-none -translate-y-1/2 lg:-right-10"
        loading="lazy"
        decoding="async"
      />
      <div className="relative z-10 mx-auto max-w-7xl">
        <h2
          id="final-cta-title"
          className="type-h2 max-w-[14rem] text-balance text-strong sm:max-w-xs md:max-w-sm lg:max-w-xl"
        >
          Build precise software with your coding agent.
        </h2>
        <nav
          className="mt-[38px] flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          aria-label="Get Mesurer"
        >
          <Button
            size="large"
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/chrome.svg" alt="" draggable={false} className="size-4 brightness-0 invert" />
            Add to Chrome
          </Button>
        </nav>
      </div>
    </section>
  );
}
