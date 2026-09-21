export default function PlatformSection() {
  return (
    <section className="relative left-1/2 mt-24 w-screen -translate-x-1/2 px-5" aria-labelledby="platform-title">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <h2 id="platform-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
            Built for software at scale.
          </h2>
          <p className="mt-2 text-pretty text-base leading-relaxed text-muted">
            Connect every interface, deployment, and agent to Mesurer.
          </p>
        </div>
        <div className="mt-10 aspect-[16/9] overflow-hidden rounded-[var(--radius)] border border-border bg-subtle" />
      </div>
    </section>
  );
}
