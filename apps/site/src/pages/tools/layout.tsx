import type { ReactNode } from "react";
import PageMetadata from "../../components/page-metadata";
import MarketingFooter from "../marketing/footer";
import Button from "../marketing/components/button";
import AgentPromptButton from "../marketing/components/agent-prompt-button";
import { TOOLS, toolHref } from "./tools";

const SITE = "https://mesurer.dev";
const chromeStoreUrl = "https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac";

export type Faq = { question: string; answer: string };

function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav className="flex items-center gap-2 text-muted" aria-label="Breadcrumb">
      <a href="/" aria-label="Mesurer home" className="inline-flex transition-opacity hover:opacity-70">
        <img src="/logo.svg" alt="" draggable={false} className="size-6" />
      </a>
      <span aria-hidden="true">/</span>
      {current ? (
        <>
          <a href="/tools" className="transition-colors hover:text-strong">Tools</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-strong">{current}</span>
        </>
      ) : (
        <span aria-current="page" className="text-strong">Tools</span>
      )}
    </nav>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-h2 text-strong">{title}</h2>
      <div className="flex flex-col gap-3 text-pretty text-muted">{children}</div>
    </section>
  );
}

/** A worked sum or code example, preserving whitespace. */
export function Formula({ children }: { children: string }) {
  return <pre className="body-sm m-0 overflow-x-auto rounded-md bg-subtle px-3 py-2 text-strong">{children}</pre>;
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="body-sm w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="body-sm-emphasis border-b border-border py-2 pr-4 text-strong">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-border py-2 pr-4 align-middle text-secondary">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Sent to the extension from every tool, the way the home page ends.
export function MesurerCta({ children }: { children: ReactNode }) {
  return (
    <aside className="relative overflow-hidden rounded-xl bg-subtle p-6" aria-labelledby="tool-cta-title">
      <img
        src="https://assets.querrel.com/mesurer/cta.webp"
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute top-1/2 -right-16 hidden h-[280px] w-auto max-w-none -translate-y-1/2 sm:block"
      />
      <div className="relative flex max-w-sm flex-col items-start gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="tool-cta-title" className="type-h2 text-strong">Mesurer</h2>
          <p className="m-0 text-pretty text-muted">{children}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-3" aria-label="Get Mesurer">
          <Button href={chromeStoreUrl} target="_blank" rel="noreferrer">
            <img src="/chrome.svg" alt="" draggable={false} className="size-4 brightness-0 invert" />
            Add to Chrome
          </Button>
          <AgentPromptButton />
        </nav>
      </div>
    </aside>
  );
}

// Under a tool, the four nearest it in the list, which is kept with like beside like. With no
// tool given, all of them.
export function OtherTools({ current }: { current?: string }) {
  const at = TOOLS.findIndex((tool) => tool.slug === current);
  const tools =
    at < 0
      ? TOOLS
      : TOOLS.map((tool, index) => ({ tool, index }))
          .filter(({ index }) => index !== at)
          .sort((a, b) => Math.abs(a.index - at) - Math.abs(b.index - at) || a.index - b.index)
          .slice(0, 4)
          .sort((a, b) => a.index - b.index)
          .map(({ tool }) => tool);
  const row = "group flex items-baseline justify-between gap-6 border-b border-border py-3";
  return (
    <ul className="m-0 flex list-none flex-col border-t border-border p-0">
      {tools.map((tool) => (
        <li key={tool.slug}>
          <a href={toolHref(tool.slug)} className={row}>
            <span className="shrink-0 text-strong">{tool.name}</span>
            <span className="truncate text-muted transition-colors group-hover:text-strong">{tool.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// Each answer opens under its question. They are all in the page whether open or not.
function FaqList({ faq }: { faq: Faq[] }) {
  return (
    <div className="flex flex-col border-t border-border">
      {faq.map(({ question, answer }) => (
        <details key={question} className="group border-b border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-strong outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
            <h3 className="type-h3 m-0">{question}</h3>
            <span className="relative size-3 shrink-0 text-muted" aria-hidden="true">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-150 group-open:rotate-90" />
            </span>
          </summary>
          <p className="m-0 max-w-xl pb-4 text-pretty text-muted">{answer}</p>
        </details>
      ))}
    </div>
  );
}

const headingClassName = "type-h1 text-balance text-strong";
const ledeClassName = "body-md m-0 mt-2 max-w-xl text-pretty text-muted";

export default function ToolPage({
  slug,
  name,
  title,
  description,
  heading,
  intro,
  tool,
  children,
  faq,
  cta,
}: {
  slug: string;
  /** The tool's short name, for the breadcrumb and what search engines are told. */
  name: string;
  /** The page's title, as search results show it. */
  title: string;
  description: string;
  heading: string;
  intro: string;
  tool: ReactNode;
  /** What is written under the tool. */
  children: ReactNode;
  faq: Faq[];
  cta: ReactNode;
}) {
  const url = `${SITE}${toolHref(slug)}`;
  return (
    <main className="min-h-dvh pb-0 pt-20">
      <PageMetadata title={title} description={description} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name,
              url,
              description,
              applicationCategory: "DesignApplication",
              operatingSystem: "Any",
              browserRequirements: "Requires JavaScript",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@type": "Organization", name: "Mesurer", url: SITE },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Mesurer", item: SITE },
                { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
                { "@type": "ListItem", position: 3, name, item: url },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: faq.map(({ question, answer }) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: { "@type": "Answer", text: answer },
              })),
            },
          ],
        }}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-12 px-5 pb-32">
        <Breadcrumb current={name} />
        <header>
          <h1 id="tool-title" className={headingClassName}>{heading}</h1>
          <p className={ledeClassName}>{intro}</p>
        </header>
        {tool}
        {children}
        <section className="flex flex-col gap-3">
          <h2 className="type-h2 text-strong">Questions</h2>
          <FaqList faq={faq} />
        </section>
        <MesurerCta>{cta}</MesurerCta>
        <section className="flex flex-col gap-3">
          <h2 className="type-h2 text-strong">More tools</h2>
          <OtherTools current={slug} />
        </section>
      </div>
      <MarketingFooter />
    </main>
  );
}

export function ToolsHub() {
  const title = "Free Design Tools | Mesurer";
  const description =
    "Free tools for designers and developers: a color picker, an aspect ratio calculator, and converters for images, colors, and CSS units. No sign-up.";
  return (
    <main className="min-h-dvh pb-0 pt-20">
      <PageMetadata title={title} description={description} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Free design tools",
          url: `${SITE}/tools`,
          description,
          hasPart: TOOLS.map((tool) => ({ "@type": "WebApplication", name: tool.name, url: `${SITE}${toolHref(tool.slug)}` })),
        }}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-12 px-5 pb-32">
        <Breadcrumb />
        <header>
          <h1 id="tool-title" className={headingClassName}>Free design tools</h1>
          <p className={ledeClassName}>Simple, free tools for designers and developers.</p>
        </header>
        <OtherTools />
        <MesurerCta>Measure spacing, sample colors, and inspect type on any live page.</MesurerCta>
      </div>
      <MarketingFooter />
    </main>
  );
}
