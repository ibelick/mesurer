const feedbackUrl = "https://github.com/ibelick/mesurer/issues/new?title=Feedback&body=**What%20happened%3F**%0A%0A%0A**What%20would%20help%3F**%0A%0A%0A**Context**%20%28browser%2C%20URL%29%0A";

const linkClassName = "text-sm text-muted transition-colors hover:text-strong";

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={linkClassName}
    >
      {children}
    </a>
  );
}

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative left-1/2 mt-24 w-screen -translate-x-1/2 px-5 pb-10 pt-7" aria-label="Site footer">
      <div className="mx-auto max-w-6xl">
        <nav className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6" aria-label="Footer navigation">
          <div className="flex flex-col items-start gap-3">
            <a href="#overview" className="inline-flex items-center gap-2 text-base font-medium text-strong transition-opacity hover:opacity-70">
              <img src="/logo.svg" alt="" className="size-6" />
              <span className="text-base tracking-tight">Mesurer</span>
            </a>
            <p className="max-w-[180px] text-sm leading-[1.35] text-muted">Build precise software with your coding agent.</p>
            <p className="text-sm text-muted">© {currentYear}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-2 text-sm font-medium text-strong">Product</h2>
            <FooterLink href="#overview">Overview</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-2 text-sm font-medium text-strong">Developers</h2>
            <FooterLink href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac" external>Chrome Extension</FooterLink>
            <FooterLink href="https://www.npmjs.com/package/mesurer" external>npm</FooterLink>
            <FooterLink href="https://github.com/ibelick/mesurer" external>GitHub</FooterLink>
            <span className="text-sm text-muted">CLI</span>
            <span className="text-sm text-muted">MCP</span>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-2 text-sm font-medium text-strong">Resources</h2>
            <FooterLink href="#installation">Getting started</FooterLink>
            <FooterLink href="#commands">Shortcuts</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-2 text-sm font-medium text-strong">Connect</h2>
            <FooterLink href={feedbackUrl} external>Feedback</FooterLink>
            <FooterLink href="https://x.com/mesurerdev" external>X (Twitter)</FooterLink>
            <FooterLink href="https://github.com/ibelick/mesurer" external>GitHub</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-2 text-sm font-medium text-strong">Legal</h2>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </div>
        </nav>
      </div>
    </footer>
  );
}
