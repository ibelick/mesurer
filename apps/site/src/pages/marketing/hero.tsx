import Button from "./components/button";
import ProductCarousel from "./product-carousel";
import { getPackageVersion } from "../../utils/get-package-version";

const version = getPackageVersion();
// Counted from npm when the site is built; the count of 13 October 2026 when npm cannot be reached.
const DOWNLOAD_COUNT = (__MESURER_DOWNLOADS__ ?? 481_670).toLocaleString("en-US");
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function DigitReel({ digit, delay }: { digit: string; delay: number }) {
  return (
    <span className="inline-flex h-[1lh] w-[1ch] shrink-0 overflow-hidden">
      <span
        className="mesurer-digit-reel flex flex-col"
        style={{
          ["--mesurer-digit-offset" as string]: `${-Number(digit)}lh`,
          animationDelay: `${delay}ms`,
        }}
      >
        {DIGITS.map((value) => (
          <span key={value} className="block h-[1lh] w-[1ch] shrink-0 text-center">
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col py-32 text-left" aria-labelledby="landing-title">
      <div className="flex w-full max-w-xl min-w-0 flex-col">
        <h1 id="landing-title" className="type-h1 text-balance text-strong">
          Build precise software with your coding agent.
        </h1>
        <nav className="mt-6 flex flex-wrap items-center justify-start gap-3" aria-label="Get Mesurer">
          <Button
            size="large"
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/chrome.svg" alt="" draggable={false} className="size-5 brightness-0 invert" />
            Add to Chrome
          </Button>
          <p className="body-sm text-pretty text-muted">
            <a href="https://www.npmjs.com/package/mesurer" target="_blank" rel="noreferrer" className="body-sm-emphasis text-strong underline decoration-border underline-offset-2 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong">
              v{version}
            </a>
            <span aria-hidden="true"> · </span>
            <span className="body-sm-emphasis inline-flex min-w-[7ch] items-baseline tabular-nums lining-nums text-strong">
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
        </nav>
      </div>
      <ProductCarousel />
    </section>
  );
}
