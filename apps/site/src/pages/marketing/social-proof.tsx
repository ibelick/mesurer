type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

const testimonials: Testimonial[] = [
  {
    quote: "Mesurer gives our agents the missing visual context. We can point at the problem instead of trying to describe it.",
    name: "Maya Chen",
    role: "Product engineer",
    initials: "MC",
  },
  {
    quote: "The fastest way for our team to turn a rough interface into a precise review is to open Mesurer and start annotating.",
    name: "Jon Bell",
    role: "Design systems lead",
    initials: "JB",
  },
  {
    quote: "It feels like a shared language between the browser, the person reviewing it, and the coding agent making the change.",
    name: "Sofia Martin",
    role: "Founder, Northstar",
    initials: "SM",
  },
  {
    quote: "Comments pinned to the live interface make small visual fixes dramatically easier to understand and ship.",
    name: "Theo Wright",
    role: "Staff engineer",
    initials: "TW",
  },
  {
    quote: "Mesurer keeps the feedback loop close to the thing we are building. No screenshots, tabs, or translation layer required.",
    name: "Ari Patel",
    role: "Independent builder",
    initials: "AP",
  },
  {
    quote: "Our review process is more direct now: inspect the element, leave the context, and let the agent take it from there.",
    name: "Nora Adams",
    role: "Frontend developer",
    initials: "NA",
  },
];

export default function SocialProof() {
  return (
    <section className="relative left-1/2 mt-24 w-screen -translate-x-1/2 overflow-hidden px-5" aria-labelledby="social-proof-title">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-prose text-center">
          <h2 id="social-proof-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
            The new way to build software.
          </h2>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <article
              key={testimonial.name}
              className={`${index > 2 ? "hidden md:flex" : "flex"} min-h-[180px] flex-col rounded-[var(--radius)] border border-border p-5`}
            >
              <figure className="flex h-full flex-col">
                <blockquote className="grow overflow-hidden">
                  <p className="line-clamp-5 text-pretty text-base leading-relaxed text-strong">“{testimonial.quote}”</p>
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-subtle text-xs font-medium text-strong" aria-hidden="true">
                    {testimonial.initials}
                  </span>
                  <span className="text-sm text-strong">
                    {testimonial.name}
                    <span className="block text-muted">{testimonial.role}</span>
                  </span>
                </figcaption>
              </figure>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
