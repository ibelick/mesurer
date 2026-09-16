import { useRef, useState } from "react";

const slides = [
  {
    title: "Inspect",
    description: "Understand every element before you change it.",
  },
  {
    title: "Annotate",
    description: "Make visual feedback precise and impossible to miss.",
  },
  {
    title: "Direct",
    description: "Turn observations into clear instructions for your agent.",
  },
  {
    title: "Review",
    description: "Track the details that make an interface feel finished.",
  },
  {
    title: "Share",
    description: "Give your team one shared view of the work.",
  },
] as const;

export default function ProductCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);

  const showSlide = (index: number) => {
    setActiveIndex(index);
    const carousel = carouselRef.current;
    const slide = slideRefs.current[index];
    if (!carousel || !slide) return;
    const left = slide.offsetLeft - (carousel.clientWidth - slide.clientWidth) / 2;
    carousel.scrollTo({
      left,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <section
      className="relative left-1/2 mt-12 w-screen -translate-x-1/2"
      aria-label="Product videos"
      aria-roledescription="carousel"
    >
      <div ref={carouselRef} className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-clip [touch-action:pan-x_pan-y] overscroll-x-none scroll-smooth pb-1">
        <div aria-hidden="true" className="w-[calc(6%-1rem)] shrink-0 sm:w-[calc(12%-1rem)] lg:w-[calc(18%-1rem)]" />
        {slides.map((slide, index) => (
          <figure
            key={slide.title}
            ref={(element) => {
              slideRefs.current[index] = element;
            }}
            className="w-[88%] shrink-0 snap-center sm:w-[76%] lg:w-[64%]"
            aria-label={`${slide.title} video`}
          >
            <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[var(--radius)] border border-border bg-subtle">
              <span className="text-sm font-medium text-muted">{slide.title}</span>
            </div>
            <figcaption className="mt-3 text-center text-sm">
              <span className="text-strong">{slide.title}.</span>{" "}
              <span className="text-muted">{slide.description}</span>
            </figcaption>
          </figure>
        ))}
        <div aria-hidden="true" className="w-[calc(6%-1rem)] shrink-0 sm:w-[calc(12%-1rem)] lg:w-[calc(18%-1rem)]" />
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-2xl justify-end gap-2">
        <button
          type="button"
          aria-label="Previous product video"
          disabled={activeIndex === 0}
          onClick={() => showSlide(activeIndex - 1)}
          className="inline-flex size-9 items-center justify-center rounded-[var(--radius)] border border-border text-muted transition-colors hover:bg-subtle hover:text-strong disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          aria-label="Next product video"
          disabled={activeIndex === slides.length - 1}
          onClick={() => showSlide(activeIndex + 1)}
          className="inline-flex size-9 items-center justify-center rounded-[var(--radius)] border border-border text-muted transition-colors hover:bg-subtle hover:text-strong disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
