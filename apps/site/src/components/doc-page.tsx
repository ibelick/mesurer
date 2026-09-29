import type { ReactNode } from "react";
import MarketingFooter from "../pages/marketing/footer";
import FinalCta from "../pages/marketing/final-cta";

export default function DocPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen pb-0 pt-20">
      <title>{`${title} | Mesurer`}</title>
      <div className="mx-auto flex max-w-2xl flex-col gap-14 px-5">
        <a href="/" aria-label="Mesurer home" className="inline-flex w-fit transition-opacity hover:opacity-70">
          <img src="/logo.svg" alt="" draggable={false} className="size-6" />
        </a>
        <section className="flex flex-col gap-6" aria-labelledby="doc-title">
          <div className="flex flex-col gap-2">
            <h1 id="doc-title" className="font-[450] text-strong">
              {title}
            </h1>
            <p className="text-muted">{description}</p>
          </div>
          {children}
        </section>
      </div>
      <FinalCta />
      <MarketingFooter />
    </main>
  );
}
