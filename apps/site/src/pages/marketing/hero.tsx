import { useEffect, useState } from "react";
import Button from "./components/button";
import AgentPromptButton from "./components/agent-prompt-button";

const formatDownloads = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

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

function DownloadCount() {
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("https://api.npmjs.org/downloads/point/last-year/mesurer", {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load npm downloads");
        return response.json() as Promise<{ downloads?: number }>;
      })
      .then((data) => {
        if (typeof data.downloads === "number") setDownloadCount(data.downloads);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDownloadError(true);
      });

    return () => controller.abort();
  }, []);

  const formattedCount = downloadError
    ? "—"
    : downloadCount === null
      ? null
      : formatDownloads(downloadCount);

  return (
    <span
      className="inline-flex items-center font-medium leading-none text-strong tabular-nums lining-nums"
      aria-label={
        downloadError
          ? "Download count unavailable"
          : formattedCount
            ? `${formattedCount} downloads`
            : "Loading download count"
      }
    >
      <span aria-hidden="true" className="inline-flex items-center leading-none">
        {formattedCount === null
          ? "\u00a0"
          : formattedCount.split("").map((character, index) =>
              character === "," || character === "—" ? (
                <span key={`separator-${index}`}>{character}</span>
              ) : (
                <DigitReel key={`digit-${index}`} digit={character} delay={index * 45} />
              ),
            )}
      </span>
    </span>
  );
}

export default function Hero() {
  return (
    <section className="mx-auto mt-[38px] w-full max-w-2xl text-left" aria-labelledby="landing-title">
      <div className="flex max-w-[460px] flex-col">
        <h1 id="landing-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
          Build precise software with your coding agent.
        </h1>
        <p className="mt-2 text-pretty text-[22px] leading-[1.23] text-muted">
          Inspect, annotate, and direct changes directly on your live interface.
        </p>
        <div className="mt-[38px] flex flex-wrap items-center justify-start gap-[18px]" aria-label="Get Mesurer">
          <Button
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/chrome.svg" alt="" className="size-4 brightness-0 invert" />
            Add to Chrome
          </Button>
          <AgentPromptButton />
        </div>
        <p className="mt-4 text-pretty text-xs leading-[1.35] text-muted">
          <a href="#features" className="font-medium text-strong underline decoration-border underline-offset-2 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong">
            See how it works
          </a>
          <span aria-hidden="true"> · </span>
          <DownloadCount /> downloads
        </p>
      </div>
    </section>
  );
}
