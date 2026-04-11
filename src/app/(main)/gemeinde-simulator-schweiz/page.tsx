import type { Metadata } from "next";
import Link from "next/link";

const CANONICAL = "https://buenzlifight.ch/gemeinde-simulator-schweiz";

export const metadata: Metadata = {
  title: "Gemeinde Simulator Schweiz – Iso City mit Steuern & Events | BünzliFight",
  description:
    "BünzliFight ist ein Schweizer Gemeinde Simulator als Iso-City: Steuern setzen, Events spielen, Gemeinden entwickeln und im Multiplayer dominieren. Jetzt kostenlos starten.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "Gemeinde Simulator Schweiz",
    "Schweizer Gemeinde Simulator",
    "Iso City Simulator",
    "Stadt Simulation Schweiz",
    "Bürgermeister Spiel",
    "Steuern Simulation Spiel",
    "Schweizer Strategiespiel",
    "BünzliFight",
  ],
  openGraph: {
    title: "Gemeinde Simulator Schweiz – Iso City mit Steuern & Events",
    description:
      "Iso-City im Schweizer Setting: Steuern, Verwaltung, Events und Multiplayer. Starte BünzliFight kostenlos.",
    url: CANONICAL,
    type: "website",
    siteName: "BünzliFight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "BünzliFight – Gemeinde Simulator Schweiz",
      },
    ],
  },
};

function JsonLd({ data }: { data: any }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function GemeindeSimulatorSchweizPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Was ist BünzliFight?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "BünzliFight ist ein Schweizer Gemeinde Simulator als Iso-City: Du verwaltest Gemeinden, setzt Steuern, reagierst auf Events und spielst im Multiplayer um Einfluss und Kontrolle.",
        },
      },
      {
        "@type": "Question",
        name: "Ist das ein Citybuilder wie SimCity?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ähnlich vom Gefühl her, aber mit Schweizer Gemeinde-Fokus: Verwaltung, Steuern, Finanzen, Ordnung, Reputation und Events stehen stärker im Mittelpunkt als reine Deko.",
        },
      },
      {
        "@type": "Question",
        name: "Kann ich kostenlos starten?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ja. Du kannst kostenlos starten und direkt loslegen. Später kann es optionale Extras geben, aber der Einstieg ist gratis.",
        },
      },
      {
        "@type": "Question",
        name: "Gibt es Städte wie Zürich, Bern oder Basel?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ja. Du kannst in bekannten Schweizer Städten starten oder dich in einer Gemeinde hochspielen. Jede Region fühlt sich anders an – mehr Prestige, mehr Konkurrenz oder mehr Underdog-Chance.",
        },
      },
    ],
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BünzliFight",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    description:
      "Schweizer Gemeinde Simulator als Iso-City mit Steuern, Events und Multiplayer.",
    url: CANONICAL,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CHF",
      category: "free",
    },
  };

  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={softwareJsonLd} />

      {/* Background (gleiches System wie bei dir) */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[6%] w-[34rem] h-[34rem] rounded-full bg-amber-300/10 blur-[170px]" />
        <div className="absolute bottom-[12%] right-[10%] w-[36rem] h-[36rem] rounded-full bg-emerald-300/8 blur-[180px]" />
        <div className="absolute top-[38%] right-[26%] w-80 h-80 rounded-full bg-red-500/7 blur-[150px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10 pb-24">
        {/* Mini-Navi */}
        <div className="flex items-center justify-between gap-4 mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-200 transition-colors group text-sm"
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
            Zurück
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs md:text-sm text-slate-300 hover:text-white transition-colors"
            >
              Login
            </Link>
            <span className="text-slate-600">•</span>
            <Link
              href="/"
              className="text-xs md:text-sm text-amber-200/90 hover:text-amber-100 transition-colors"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>

        {/* HERO */}
        <header className="mb-12">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            Iso-City • Schweiz • Steuern • Events • Multiplayer
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            Gemeinde Simulator Schweiz – BünzliFight
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-3xl">
            BünzliFight ist eine{" "}
            <strong>Schweizer Gemeinde-Simulation</strong> im Iso-City-Style:
            Du setzt Steuern, triffst Verwaltungs-Entscheidungen, reagierst auf Events
            und baust dir Einfluss auf – alleine oder im Multiplayer.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Jetzt spielen
            </Link>

            <Link
              href="/schweizer-gemeinde-spiele"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Schweizer Gemeinde-Spiele vergleichen
            </Link>
          </div>

          <div className="h-px w-28 bg-gradient-to-r from-amber-300/80 to-transparent mt-8" />
        </header>

        {/* FEATURE GRID */}
        <section className="mb-12 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-4">
            Was macht BünzliFight anders?
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Steuern & Verwaltung
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Du spielst nicht nur “bauen”, sondern entscheidest wie eine Gemeinde:
                Steuerpolitik, Ordnung, Infrastruktur-Prioritäten – alles hat Folgen.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Events statt Leerlauf
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Dinge passieren. Du reagierst, löst Probleme, nutzt Chancen – und bleibst
                im Flow, statt nur Menüs zu klicken.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Iso-City Look
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Schweizer Vibes im isometrischen City-Style. Kein austauschbarer Look,
                sondern ein eigener, spielbarer “Bünzli”-Kosmos.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Multiplayer & Kontrolle
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Du konkurrierst nicht nur gegen Zahlen – sondern gegen andere Spieler,
                Strategien und Entscheidungen. Prestige gewinnt, wer stabil bleibt.
              </p>
            </div>
          </div>
        </section>

        {/* CITY PAGES */}
        <section className="mb-12 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Starte in einer Stadt – oder baue dich hoch
          </h2>

          <p className="text-slate-200 text-sm leading-relaxed mb-6">
            Du kannst direkt “groß” einsteigen – oder bewusst als Underdog starten.
            Jede Stadt hat ihren eigenen Vibe.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <Link
              href="/zuerich-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-5 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">
                Zürich
              </div>
              <div className="text-white font-semibold mb-1">Prime City</div>
              <div className="text-slate-200 text-sm">
                Prestige, Konkurrenz, große Bühne.
              </div>
            </Link>

            <Link
              href="/bern-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-5 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">
                Bern
              </div>
              <div className="text-white font-semibold mb-1">Hauptstadt-Feeling</div>
              <div className="text-slate-200 text-sm">
                Verwaltung, Einfluss, Entscheidungen.
              </div>
            </Link>

            <Link
              href="/basel-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-5 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">
                Basel
              </div>
              <div className="text-white font-semibold mb-1">Dynamik & Events</div>
              <div className="text-slate-200 text-sm">
                Bewegung, Reaktion, Flow.
              </div>
            </Link>
          </div>

          <div className="mt-4">
            <Link
              href="/solothurn-gemeinde-simulator"
              className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors text-sm"
            >
              Solothurn: 11er-Challenge (Underdog-Start)
            </Link>
          </div>
        </section>

        {/* CONTENT / SEO TEXT */}
        <section className="mb-12 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Für wen ist ein Gemeinde Simulator interessant?
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <div className="text-white font-semibold mb-1">Für SimCity-Fans</div>
              <p className="text-slate-200 text-sm leading-relaxed">
                Wenn du Citybuilder liebst, aber mehr “Entscheidungen” willst als nur Bauen,
                dann passt das Schweizer Gemeinde-Setting perfekt.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <div className="text-white font-semibold mb-1">Für Strategie-Nerds</div>
              <p className="text-slate-200 text-sm leading-relaxed">
                Steuern, Reputation, Stabilität, Events – du spielst mit Systemen und
                lernst, wie deine Entscheidungen Kettenreaktionen auslösen.
              </p>
            </div>
          </div>

          <p className="mt-6 text-slate-300 text-sm leading-relaxed">
            Wenn du nach <strong>Gemeinde Simulator Schweiz</strong>, <strong>Schweizer Gemeinde Spiel</strong> oder
            <strong> Iso-City Simulation</strong> suchst, ist BünzliFight genau auf diese Nische gebaut:
            Schweizer Vibes, Verwaltung, Steuern, Events – und Multiplayer-Spannung.
          </p>
        </section>

        {/* FAQ visible */}
        <section className="mb-14">
          <h2 className="text-white font-display font-bold text-2xl md:text-3xl mb-6">
            FAQ
          </h2>

          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">Ist das eine offizielle Schweiz-Infoseite?</h3>
              <p>
                Nein – das ist eine Spielseite. BünzliFight ist ein Gemeinde-Simulator im Schweizer Setting.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">Brauche ich ein spezielles Setup?</h3>
              <p>
                Nein. Du kannst direkt im Browser starten. Registrieren, einloggen, losspielen.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">Kann ich später mehr Städte/Regionen hinzufügen?</h3>
              <p>
                Ja – Landingpages kannst du modular erweitern (Zürich, Bern, Basel, Genf usw.).
                Wichtig ist, dass jede Seite einen eigenen Hook hat (Prestige, Politik, Events, Underdog).
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Bereit, deine Gemeinde zu übernehmen?
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Iso-City. Steuern. Events. Multiplayer. Schweizer Bünzli-Vibes. Kostenlos starten.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-7 py-3 transition-colors"
              >
                Kostenlos starten
              </Link>
              <Link
                href="https://discord.gg/fSKcZrABEG"
                className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-7 py-3 transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                Discord beitreten
              </Link>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 text-center text-slate-500 text-[10px]">
            BünzliFight &copy; 2026
          </div>
        </section>
      </div>
    </main>
  );
}