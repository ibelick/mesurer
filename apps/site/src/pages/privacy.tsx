import Privacy from "../components/privacy";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-5 py-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-14">
        <a href="/" className="w-fit text-sm text-muted transition-colors hover:text-strong">
          ← Mesurer
        </a>
        <section className="flex flex-col gap-6" aria-labelledby="privacy-title">
          <div className="flex flex-col gap-2">
            <h1 id="privacy-title" className="font-[450] text-strong">Privacy Policy</h1>
            <p className="text-muted">Data handling and extension permissions.</p>
          </div>
          <Privacy />
        </section>
      </div>
    </main>
  );
}
