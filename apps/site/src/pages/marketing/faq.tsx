const questions = [
  {
    question: "What is Mesurer?",
    answer: "Mesurer is a visual toolkit for inspecting, annotating, and reviewing interfaces while you build software.",
  },
  {
    question: "Does Mesurer work with any coding agent?",
    answer: "Yes. Mesurer turns visual feedback into context you can copy into the coding agent you already use.",
  },
  {
    question: "Do I need to install Mesurer in my project?",
    answer: "No. The Chrome Extension works on any interface. Install the npm package when you want Mesurer directly inside your product.",
  },
  {
    question: "What can I use for free?",
    answer: "The Free plan includes Inspect, Annotate, Comments, Agent context, and Copy for agent.",
  },
  {
    question: "Why would I need Pro or Team?",
    answer: "Pro adds unlimited reviews, Mesurer Links, private projects, versions and history, and cloud sync. Team adds shared projects, team reviews, permissions, shared history, and support for up to 10 members.",
  },
  {
    question: "Is Mesurer open source?",
    answer: "Yes. Mesurer is built in the open and available on GitHub.",
  },
  {
    question: "How does Mesurer handle my code and data?",
    answer: "The Chrome Extension runs in your browser, while the npm package runs in your product. The current free workflow keeps its state locally in the browser or application; cloud sync and hosted projects are part of the paid product direction.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="relative left-1/2 mt-24 w-screen -translate-x-1/2 px-5" aria-labelledby="faq-title">
      <div className="mx-auto max-w-3xl">
        <div className="max-w-xl">
          <p className="mb-3 text-sm font-medium text-muted">FAQ</p>
          <h2 id="faq-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
            Focused on removing adoption and purchase friction.
          </h2>
        </div>

        <div className="mt-10 border-t border-border">
          {questions.map((item) => (
            <details key={item.question} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-medium text-strong marker:hidden focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong">
                {item.question}
                <span aria-hidden="true" className="text-xl font-normal leading-none text-muted transition-transform duration-150 group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-2xl pb-5 pr-10 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
