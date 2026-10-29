import { TOOLS, toolHref } from "../tools/tools";

const feedbackUrl = "https://github.com/ibelick/mesurer/issues/new?title=Feedback&body=**What%20happened%3F**%0A%0A%0A**What%20would%20help%3F**%0A%0A%0A**Context**%20%28browser%2C%20URL%29%0A";

// The four tools most looked for. The rest are a link away, under "All tools".
const FOOTER_TOOLS = ["color-picker", "webp-to-png", "heic-to-jpg", "aspect-ratio-calculator"];
const footerTools = FOOTER_TOOLS.flatMap((slug) => TOOLS.filter((tool) => tool.slug === slug));

const linkClassName = "text-sm leading-snug tracking-normal text-strong transition-colors hover:text-secondary";

function FooterLink({
  href,
  children,
  external = false,
  scrollBehavior,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  scrollBehavior?: "smooth";
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      data-scroll-behavior={scrollBehavior}
      className={linkClassName}
    >
      {children}
    </a>
  );
}

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative left-1/2 mt-12 mb-12 w-screen -translate-x-1/2 px-3 py-32" aria-label="Site footer">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-start gap-3">
            <a href="/" className="body-md-emphasis inline-flex w-fit items-center gap-2 text-strong transition-opacity hover:opacity-70">
              <img src="/logo.svg" alt="" draggable={false} className="size-6" />
              <span>Mesurer</span>
            </a>
            <span className="body-sm text-muted">© {currentYear}</span>
          </div>
          <nav className="flex gap-16" aria-label="Footer navigation">
            <div className="flex flex-col items-start gap-2">
              <h2 className="text-sm-emphasis mb-1 text-muted">Product</h2>
              <FooterLink href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac" external>Chrome extension</FooterLink>
              <FooterLink href="https://www.npmjs.com/package/mesurer" external>Npm package</FooterLink>
            <FooterLink href="/#platform" scrollBehavior="smooth">Platform</FooterLink>
              <FooterLink href="/changelog">Changelog</FooterLink>
            </div>
            <div className="flex flex-col items-start gap-2">
              <h2 className="text-sm-emphasis mb-1 text-muted">Resources</h2>
              <FooterLink href="/docs">Getting started</FooterLink>
              <FooterLink href="/docs/props">Props</FooterLink>
              <FooterLink href="/docs/shortcuts">Shortcuts</FooterLink>
              <FooterLink href="/llms.txt" external>llms.txt</FooterLink>
            </div>
            <div className="flex flex-col items-start gap-2">
              <h2 className="text-sm-emphasis mb-1 text-muted">Tools</h2>
              {footerTools.map((tool) => (
                <FooterLink key={tool.slug} href={toolHref(tool.slug)}>{tool.name}</FooterLink>
              ))}
              <FooterLink href="/tools">All tools</FooterLink>
            </div>
            <div className="flex flex-col items-start gap-2">
              <h2 className="text-sm-emphasis mb-1 text-muted">About</h2>
              <FooterLink href="https://x.com/mesurerdev" external>X (Twitter)</FooterLink>
              <FooterLink href="https://github.com/ibelick/mesurer" external>GitHub</FooterLink>
              <FooterLink href={feedbackUrl} external>Feedback</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
