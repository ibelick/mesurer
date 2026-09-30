import Button from "./components/button";
import AgentPromptButton from "./components/agent-prompt-button";
import { getPackageVersion } from "../../utils/get-package-version";

const version = getPackageVersion();
const DOWNLOAD_COUNT = "330,601";
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function DigitReel({ digit, delay }: { digit: string; delay: number }) {
  return (
    <span className="inline-flex h-[1em] w-[1ch] shrink-0 overflow-hidden leading-none">
      <span
        className="mesurer-digit-reel flex flex-col leading-none"
        style={{
          ["--mesurer-digit-offset" as string]: `${-Number(digit)}em`,
          animationDelay: `${delay}ms`,
        }}
      >
        {DIGITS.map((value) => (
          <span key={value} className="block h-[1em] w-[1ch] shrink-0 text-center leading-none">
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

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
          <span className="inline-flex min-w-[7ch] items-center font-medium leading-none tabular-nums lining-nums text-strong">
            {DOWNLOAD_COUNT.split("").map((character, index) =>
              character === "," ? (
                <span key={`separator-${index}`}>{character}</span>
              ) : (
                <DigitReel key={`digit-${index}`} digit={character} delay={index * 45} />
              ),
            )}
          </span>
          <span>downloads</span>
        </p>
      </div>
    </section>
  );
}
