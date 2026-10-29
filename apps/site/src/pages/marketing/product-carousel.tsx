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
      className="relative left-1/2 mt-20 w-screen -translate-x-1/2"
      aria-label="Product screenshots"
      aria-roledescription="carousel"
    >
      <div ref={carouselRef} className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex snap-x snap-mandatory gap-10 overflow-x-auto overflow-y-clip [touch-action:pan-x_pan-y] overscroll-x-none scroll-smooth pb-1">
        {slides.map((slide, index) => (
          <figure
            key={slide.title}
            ref={(element) => {
              slideRefs.current[index] = element;
            }}
            className={`w-[1000px] shrink-0 snap-center ${index === 0 ? "ml-[max(12px,calc((100vw-1280px)/2))]" : ""}`}
            aria-label={`${slide.title} screenshot`}
          >
            <div className="relative h-[625px] w-[1000px] overflow-hidden rounded-md bg-subtle">
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
              <figcaption className="body-sm absolute inset-x-0 bottom-10 z-10 px-6 text-center">
                <span className="text-strong">{slide.title}.</span>{" "}
                <span className="text-muted">{slide.description}</span>
              </figcaption>
            </div>
          </figure>
        ))}
        <div aria-hidden="true" className="w-[max(12px,calc((100vw-1280px)/2))] shrink-0" />
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-7xl justify-end gap-2">
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
