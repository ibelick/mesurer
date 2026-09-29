import { useRef, useState } from "react";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";

const slides = [
  {
    title: "Inspect",
    description: "Check any element’s value, style or spacing.",
    image: "https://assets.querrel.com/mesurer/mesurer-1.webp",
  },
  {
    title: "Design",
    description: "Set guides and bring your canvas closer to production.",
    image: "https://assets.querrel.com/mesurer/mesurer-2.webp",
  },
  {
    title: "Annotate",
    description: "Scribble what you have in mind on the live interface.",
    image: "https://assets.querrel.com/mesurer/mesurer-3.webp",
  },
  {
    title: "Direct",
    description: "Give feedback that points directly at the element.",
    image: "https://assets.querrel.com/mesurer/mesurer-4.webp",
  },
  {
    title: "Share",
    description: "Interact seamlessly with human and agents.",
    image: "https://assets.querrel.com/mesurer/mesurer-5.webp",
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
      aria-label="Product screenshots"
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
            aria-label={`${slide.title} screenshot`}
          >
            <div className="aspect-[16/10] overflow-hidden rounded-[12px] bg-subtle">
              <img
                draggable={false}
                src={slide.image}
                alt={`${slide.title} feature in Mesurer`}
                className="size-full object-cover"
                width={1600}
                height={1000}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={index === 0 ? "high" : undefined}
              />
            </div>
            <figcaption className="mt-3 text-center text-sm">
              <span className="text-strong">{slide.title}.</span>{" "}
              <span className="text-muted">{slide.description}</span>
            </figcaption>
          </figure>
        ))}
        <div aria-hidden="true" className="w-[calc(6%-1rem)] shrink-0 sm:w-[calc(12%-1rem)] lg:w-[calc(18%-1rem)]" />
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-2xl justify-end gap-2 px-5">
        <button
          type="button"
          aria-label="Previous product video"
          disabled={activeIndex === 0}
          onClick={() => showSlide(activeIndex - 1)}
           className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-subtle hover:text-strong disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
         >
           <CaretLeftIcon aria-hidden="true" size={16} weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Next product video"
          disabled={activeIndex === slides.length - 1}
          onClick={() => showSlide(activeIndex + 1)}
           className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-subtle hover:text-strong disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
         >
           <CaretRightIcon aria-hidden="true" size={16} weight="bold" />
        </button>
      </div>
    </section>
  );
}
