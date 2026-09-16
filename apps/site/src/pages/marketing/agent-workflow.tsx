const cards = [
  {
    title: "Understand the interface",
    description: "Mesurer captures the exact element, styles, position, and surrounding context.",
  },
  {
    title: "Show what you mean",
    description: "Comments and annotations let you communicate visually instead of describing everything.",
  },
  {
    title: "Give it to your agent",
    description: "Turn your visual intent and interface context into something your coding agent can act on.",
  },
] as const;

export default function AgentWorkflow() {
  return (
    <section className="relative left-1/2 mt-24 w-screen -translate-x-1/2 px-5" aria-labelledby="agent-workflow-title">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <h2 id="agent-workflow-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
            Stop describing what you can point at.
          </h2>
          <p className="mt-2 text-pretty text-base leading-relaxed text-muted">
            Select anything on your interface. Mesurer gives your coding agent the context to make the right change.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article key={card.title} className="flex min-w-0 flex-col rounded-2xl bg-subtle p-2">
              <div className="flex flex-col px-4 pb-5 pt-4">
                <h3 className="text-base font-medium text-strong">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{card.description}</p>
              </div>
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-border bg-bg text-xs text-muted">
                Visual placeholder
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
