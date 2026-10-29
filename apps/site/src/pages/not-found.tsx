import { useId } from "react";
import MarketingFooter from "./marketing/footer";
import Button from "./marketing/components/button";
import PageMetadata from "../components/page-metadata";

export default function NotFoundPage() {
  const id = useId().replace(/:/g, "");
  return (
    <main className="flex min-h-screen flex-col">
      <PageMetadata title="Page not found | Mesurer" description="This page does not exist." />
      <meta name="robots" content="noindex" />
      {/* The logo sits over the first screen, so the number is centred in all of it. */}
      <div className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5" data-not-found="">
        <a href="/" aria-label="Mesurer home" className="absolute left-5 top-20 inline-flex w-fit transition-opacity hover:opacity-70">
          <img src="/logo.svg" alt="" draggable={false} className="size-6" />
        </a>
        <section className="flex flex-1 flex-col items-center justify-center gap-12">
          {/* The digits drawn as outlines, dashed the way Mesurer outlines a selected element. */}
          <h1 id="not-found-title" aria-label="Page not found" className="type-h1 w-full max-w-[560px] select-none">
            <svg aria-hidden="true" viewBox="0 0 640 252" className="block h-auto w-full overflow-visible">
              <defs>
                <text id={`${id}-digits`} x="320" y="242" textAnchor="middle" fontSize="330" fontWeight="500">
                  404
                </text>
                {/* Inter's 4 is made of overlapping shapes: the stroke is kept outside the glyphs, so
                    only their outer edge is drawn and not the edges where the shapes overlap. */}
                <mask id={`${id}-outside`}>
                  <rect x="-40" y="-40" width="720" height="332" fill="white" />
                  <use href={`#${id}-digits`} fill="black" />
                </mask>
              </defs>
              <use href={`#${id}-digits`} fill="#1F78FF" fillOpacity="0.1" />
              <use
                href={`#${id}-digits`}
                fill="none"
                stroke="#1F78FF"
                strokeWidth="3"
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
                mask={`url(#${id}-outside)`}
              />
            </svg>
          </h1>
          <Button href="/">Back home</Button>
        </section>
      </div>
      <MarketingFooter />
    </main>
  );
}
