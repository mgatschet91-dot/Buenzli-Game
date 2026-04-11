import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bern im Schweizer Gemeinde Simulator – Bürgermeister werden | BünzliFight",
  description:
    "Übernimm Bern im Multiplayer Gemeinde Simulator BünzliFight. Verwalte Steuern, Sicherheit, Wirtschaft und Infrastruktur – werde Bürgermeister von Bern.",
  openGraph: {
    title: "Bern im Schweizer Gemeinde Simulator | BünzliFight",
    description:
      "Übernimm Bern im Multiplayer Gemeinde Simulator. Steuern, Sicherheit, Wirtschaft & Infrastruktur – jetzt Bürgermeister werden.",
    url: "https://buenzlifight.ch/bern-gemeinde-simulator",
    type: "website",
    siteName: "BünzliFight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 643,
        height: 900,
        type: "image/png",
        alt: "BünzliFight – Bern im Gemeinde Simulator",
      },
    ],
  },
};

export default function BernLandingPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      {/* Background-Layer wie bei dir */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-emerald-400/5 blur-[120px]" />
        <div className="absolute bottom-[15%] right-[8%] w-80 h-80 rounded-full bg-amber-300/5 blur-[130px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-12 pb-24">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-200 transition-colors mb-10 group text-sm"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:-translate-x-1 transition-transform duration-300"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Zurück zum Spiel
        </Link>

        {/* HERO */}
        <header className="mb-10">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            Gemeinde-Bern
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            Bern im Schweizer Gemeinde Simulator
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-2xl">
            Übernimm die Hauptstadt der Schweiz im Multiplayer Gemeinde Simulator{" "}
            <span className="text-amber-200/90 font-medium">BünzliFight</span>.
            Verwalte Steuern, Sicherheit, Wirtschaft und Infrastruktur – und werde
            Bürgermeister von Bern.
          </p>

          <div className="h-px w-24 bg-gradient-to-r from-amber-300/80 to-transparent mt-6" />

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Jetzt Bern übernehmen
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Ich habe schon ein Konto
            </Link>
          </div>
        </header>

        {/* STATS CARD */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
          <h2 className="text-white font-medium text-base md:text-lg mb-4">
            Bern im Spiel – Aktuelle Simulation
          </h2>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-200">
            <li className="flex items-center justify-between gap-3 border border-white/5 bg-black/30 px-4 py-3 rounded-sm">
              <span className="text-slate-400">Virtuelle Einwohner</span>
              <span className="text-white font-semibold">12’840</span>
            </li>
            <li className="flex items-center justify-between gap-3 border border-white/5 bg-black/30 px-4 py-3 rounded-sm">
              <span className="text-slate-400">Aktive Spieler</span>
              <span className="text-white font-semibold">3</span>
            </li>
            <li className="flex items-center justify-between gap-3 border border-white/5 bg-black/30 px-4 py-3 rounded-sm">
              <span className="text-slate-400">Sicherheitswert</span>
              <span className="text-white font-semibold">68 / 100</span>
            </li>
            <li className="flex items-center justify-between gap-3 border border-white/5 bg-black/30 px-4 py-3 rounded-sm">
              <span className="text-slate-400">Wirtschaftsrang CH</span>
              <span className="text-white font-semibold">#7</span>
            </li>
            <li className="flex items-center justify-between gap-3 border border-white/5 bg-black/30 px-4 py-3 rounded-sm sm:col-span-2">
              <span className="text-slate-400">Freie Bauflächen</span>
              <span className="text-white font-semibold">42 Blöcke</span>
            </li>
          </ul>

          <p className="mt-5 text-xs text-slate-400">
            Tipp: Wenn Bern frei ist, kannst du die Gemeinde direkt übernehmen – sonst kämpfst du dich über Einfluss & Rankings nach oben.
          </p>
        </section>

        {/* WHY */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
          <h2 className="text-white font-medium text-base md:text-lg mb-4">
            Warum Bern verwalten?
          </h2>

          <ul className="list-disc list-inside space-y-2 text-sm text-slate-200 leading-relaxed">
            <li>Steuerpolitik beeinflusst nationale Rankings</li>
            <li>Bankensystem mit Kredit- und Schuldenmechanik</li>
            <li>Katastrophen-Events & Sicherheitsmanagement</li>
            <li>Wettbewerb mit Zürich und Basel</li>
          </ul>
        </section>

        {/* LINKS */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
          <h2 className="text-white font-medium text-base md:text-lg mb-4">
            Bern vs. andere Gemeinden
          </h2>

          <div className="space-y-2 text-sm">
            <Link href="/zuerich-gemeinde-simulator" className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors">
              Zürich im Gemeinde Simulator
            </Link>
            <br />
            <Link href="/basel-gemeinde-simulator" className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors">
              Basel im Gemeinde Simulator
            </Link>
            <br />
            <Link href="/solothurn-gemeinde-simulator" className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors">
              Solothurn neu aufbauen
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-white font-display font-bold text-2xl md:text-3xl mb-6">
            Häufige Fragen zu Bern im Simulator
          </h2>

          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Kann ich Bürgermeister von Bern werden?
              </h3>
              <p>
                Ja. Wenn die Position frei ist, kannst du Bern direkt übernehmen. Wenn nicht,
                musst du über Einfluss, Rankings und Ausbau mehr Kontrolle gewinnen.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist Bern schwieriger als andere Gemeinden?
              </h3>
              <p>
                Bern ist als Hauptstadt besonders umkämpft. Dafür hast du auch das höchste Potenzial
                für Wirtschaft, Kontrolle und Prestige.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist BünzliFight kostenlos spielbar?
              </h3>
              <p>
                Ja. Du kannst kostenlos starten und deine Gemeinde Schritt für Schritt ausbauen.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Bereit für Bern?
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Starte jetzt und übernimm die Kontrolle über die Hauptstadt – Steuern, Sicherheit, Wirtschaft, Events.
            </p>

            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-7 py-3 transition-colors"
            >
              Kostenlos starten
            </Link>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 text-center text-slate-500 text-[10px]">
            BünzliFight &copy; 2026
          </div>
        </section>
      </div>
    </main>
  );
}