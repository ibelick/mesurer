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

export default function AgentWorkflow({
  id = "agent-workflow-title",
  title = "Stop describing what you can point at.",
  description = "Select anything on your interface. Mesurer gives your coding agent the context to make the right change.",
  cards: sectionCards = cards,
}: {
  id?: string;
  title?: string;
  description?: string;
  cards?: ReadonlyArray<{ title: string; description?: string; image?: string }>;
}) {
  return (
    <section className="relative mx-auto w-full max-w-7xl py-32" aria-labelledby={id}>
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-8">
          <h2 id={id} className="type-h2 w-full max-w-xl text-balance text-strong">
            {title}
          </h2>
          <p className="body-md ml-auto w-full max-w-xl text-pretty text-muted lg:text-right">{description}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:mt-20 lg:grid-cols-3">
          {sectionCards.map((card) => (
            <article key={card.title} className="flex min-w-0 flex-col rounded-sm bg-subtle p-2">
              <div className="flex flex-col px-4 pb-5 pt-4">
                <h3 className="text-sm-emphasis text-secondary">{card.title}</h3>
                {card.description ? <p className="body-sm mt-2 text-muted">{card.description}</p> : null}
              </div>
              <div className="aspect-[4/3] overflow-hidden bg-transparent">
                {card.image ? (
                  <img
                    src={card.image}
                    alt=""
                    draggable={false}
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
