import Changelog from "../components/changelog";

export default function ChangelogPage() {
  return (
    <main className="min-h-screen px-5 py-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-14">
        <a href="/" className="w-fit text-sm text-muted transition-colors hover:text-strong">
          ← Mesurer
        </a>
        <section className="flex flex-col gap-6" aria-labelledby="changelog-title">
          <div className="flex flex-col gap-2">
            <h1 id="changelog-title" className="font-[450] text-strong">Changelog</h1>
            <p className="text-muted">Release notes for the package.</p>
          </div>
          <Changelog />
        </section>
      </div>
    </main>
  );
}
