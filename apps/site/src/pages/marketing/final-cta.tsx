import Button from "./components/button";

export default function FinalCta() {
  return (
    <section className="relative left-1/2 mt-24 w-screen -translate-x-1/2 bg-subtle px-5 py-24 text-center" aria-labelledby="final-cta-title">
      <div className="mx-auto max-w-2xl">
        <h2 id="final-cta-title" className="text-balance text-[22px] font-medium leading-[1.2] text-strong">
          Build precise software with your coding agent.
        </h2>
        <div className="mt-7">
          <Button href="#installation">Get started free</Button>
        </div>
      </div>
    </section>
  );
}
