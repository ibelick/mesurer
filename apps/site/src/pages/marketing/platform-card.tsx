import Button from "./components/button";

const platformFeatures = [
  {
    caption: "Save prototypes in your workspace",
    image: "https://assets.querrel.com/mesurer/save.webp",
  },
  {
    caption: "Organize your project folders",
    image: "https://assets.querrel.com/mesurer/organize.webp",
  },
  {
    caption: "Share links with clients, team and agents",
    image: "https://assets.querrel.com/mesurer/sharelink.webp",
  },
] as const;

export default function PlatformCard() {
  return (
    <section id="platform" className="relative mx-auto w-full max-w-7xl py-32" aria-label="Platform">
      <div className="flex flex-col gap-32">
        <article className="grid min-h-[400px] grid-cols-2 overflow-hidden rounded-sm border border-border">
          <div className="p-2">
            <img
              src="https://assets.querrel.com/mesurer/platform.webp"
              alt="Mesurer platform"
              draggable={false}
              className="h-full w-full rounded-l-sm object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flex h-full flex-col p-20">
            <span className="text-sm inline-flex h-6 w-fit items-center rounded-full bg-accent-subtle px-2.5 text-accent">
              Platform
            </span>
            <h3 className="type-h3 mt-4 text-strong">
              Organize projects and collaborate closer to prod
            </h3>
            <p className="body-md mt-3 text-muted">
              Publish links to your live prototypes and organize them in your workspace. Manage versioning, share links with stakeholders, and collaborate on projects with your team... Mesurer platform is a home for the next generation of software prototypes.
            </p>
            <Button variant="secondary" className="mt-auto self-end">
              Join the beta
            </Button>
          </div>
        </article>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {platformFeatures.map((feature) => (
            <article key={feature.caption} className="flex min-w-0 flex-col rounded-sm bg-subtle p-2">
              <div className="flex flex-col px-4 pb-5 pt-4">
                <h3 className="text-sm-emphasis text-secondary">{feature.caption}</h3>
              </div>
              <div className="aspect-[4/3] overflow-hidden bg-transparent">
                <img
                  src={feature.image}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
