export default function PlatformSection() {
  return (
    <section className="relative mx-auto w-full max-w-7xl mt-24" aria-labelledby="platform-title">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-xl">
          <h2 id="platform-title" className="type-h2 text-balance text-strong">
            Built for software at scale.
          </h2>
          <p className="body-md mt-2 text-pretty text-muted">
            Connect every interface, deployment, and agent to Mesurer.
          </p>
        </div>
        <div className="mt-10 aspect-[16/9] overflow-hidden rounded-[var(--radius)] border border-border bg-subtle" />
      </div>
    </section>
  );
}
