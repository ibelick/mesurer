type Testimonial = {
  quote: string;
  name: string;
  handle: string;
  url: string;
  avatar: string;
};

const testimonials: Testimonial[] = [
  {
    quote: "bro....THANK YOU.",
    name: "shadcn",
    handle: "@shadcn",
    url: "https://x.com/shadcn/status/2042512251077190037",
    avatar: "https://unavatar.io/x/shadcn",
  },
  {
    quote: "Duuuuuuude this is exactly what I needed. Ty",
    name: "David",
    handle: "@drgdfyi",
    url: "https://x.com/drgdfyi/status/2084931655937266160",
    avatar: "https://unavatar.io/x/drgdfyi",
  },
  {
    quote: "This is exactly what I've been looking for. Thanks",
    name: "Moumen Soliman",
    handle: "@moumensoliman",
    url: "https://x.com/moumensoliman/status/2085015782019236262",
    avatar: "https://unavatar.io/x/moumensoliman",
  },
  {
    quote: "oh nice! was working on something similar but i'm super glad i don't have to now lol",
    name: "daniel petho",
    handle: "@nonzeroexitcode",
    url: "https://x.com/nonzeroexitcode/status/2084938082181169646",
    avatar: "https://unavatar.io/x/nonzeroexitcode",
  },
  {
    quote: "woah was just wondering whether drag and multi-select could live side by side in a visual editor and then saw this. really well done :)",
    name: "Sam Gorman",
    handle: "@gormankind",
    url: "https://x.com/gormankind/status/2042519642628067562",
    avatar: "https://unavatar.io/x/gormankind",
  },
  {
    quote: "oh man this is awesome",
    name: "OrcDev",
    handle: "@orcdev",
    url: "https://x.com/orcdev/status/2042584106593071310",
    avatar: "https://unavatar.io/x/orcdev",
  },
];

export default function SocialProof() {
  return (
    <section className="relative mx-auto w-full max-w-7xl overflow-hidden pt-32 pb-64" aria-label="Testimonials">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:auto-rows-fr lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <a
              key={testimonial.name}
              href={testimonial.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-full min-h-[180px] flex-col rounded-xl border border-border p-5"
            >
              <article className="flex h-full flex-col">
                <blockquote className="grow overflow-hidden">
                  <p className="body-md line-clamp-5 text-pretty text-strong">{testimonial.quote}</p>
                </blockquote>
                <div className="mt-3 flex items-center gap-3">
                  <img
                    draggable={false}
                    src={testimonial.avatar}
                    alt=""
                    className="size-10 shrink-0 rounded-full object-cover"
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="body-sm text-strong">
                    {testimonial.name}
                    <span className="block text-muted">{testimonial.handle}</span>
                  </span>
                </div>
              </article>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
