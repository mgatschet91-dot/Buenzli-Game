import type { Metadata } from "next";
import Link from "next/link";

const CANONICAL = "https://buenzlifight.ch/basel-gemeinde-simulator";

export const metadata: Metadata = {
  title: "Basel im Gemeinde Simulator – Grenzstadt & Strategie | BünzliFight",
  description:
    "Basel im Schweizer Gemeinde Simulator BünzliFight: Übernimm die Grenzstadt am Rhein. Multiplayer, Verwaltung, Events – werde Bürgermeister von Basel. Kostenlos starten.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "Basel Gemeinde Simulator",
    "Basel Bürgermeister werden",
    "Basel Stadt Simulation",
    "Basel online Spiel",
    "Schweizer Gemeinde Spiel",
    "Gemeinde Simulation Schweiz",
    "BünzliFight Basel",
  ],
  openGraph: {
    title: "Basel im Gemeinde Simulator – Grenzstadt & Strategie",
    description:
      "Übernimm Basel im Multiplayer Gemeinde Simulator BünzliFight. Ideal für Strategie-Fans, die eine Grenzstadt managen wollen.",
    url: CANONICAL,
    type: "website",
    siteName: "BünzliFight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "BünzliFight – Basel im Gemeinde Simulator",
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

export default function BaselLandingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Warum Basel im BünzliFight spielen?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Basel ist die Grenzstadt am Rhein – perfekt für Spieler, die Strategie und Dynamik mögen. In BünzliFight verwaltest du Basel im Multiplayer Gemeinde Simulator mit Entscheidungen und Events.",
        },
      },
      {
        "@type": "Question",
        name: "Ist das eine offizielle Basel-Informationsseite?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Nein. Das ist eine Spiel-Landingpage für Basel im Schweizer Gemeinde Simulator BünzliFight, nicht eine offizielle Informationsseite.",
        },
      },
      {
        "@type": "Question",
        name: "Kann ich Basel kostenlos starten?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ja. Du kannst kostenlos starten und Basel im Spiel wählen. Danach baust du dir Schritt für Schritt deine Strategie auf.",
        },
      },
      {
        "@type": "Question",
        name: "Für wen ist Basel ideal?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Für Spieler, die eine lebendige Stadt mit viel Bewegung, Events und Konkurrenz wollen – aber nicht den reinen 'Prime City'-Stress wie Zürich.",
        },
      },
    ],
  };

  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: "Basel",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Basel",
      addressRegion: "BS",
      addressCountry: "CH",
    },
    url: CANONICAL,
  };

  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={placeJsonLd} />

      {/* Background (gleiches System wie bei dir) */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        {/* Basel: Night / Neon / Rhine vibe */}
        <div className="absolute top-[12%] left-[8%] w-[34rem] h-[34rem] rounded-full bg-indigo-300/10 blur-[170px]" />
        <div className="absolute bottom-[14%] right-[10%] w-[36rem] h-[36rem] rounded-full bg-emerald-300/8 blur-[180px]" />
        <div className="absolute top-[40%] right-[28%] w-80 h-80 rounded-full bg-amber-300/7 blur-[150px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-10 pb-24">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-200 transition-colors mb-8 group text-sm"
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

        {/* HERO */}
        <header className="mb-10">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            Basel • Grenzstadt • Rhein
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            Basel im Gemeinde Simulator – Grenzstadt & Strategie
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-3xl">
            Basel ist die Stadt für Leute, die Dynamik mögen: Grenzlage, Bewegung, Events,
            Entscheidungen mit Wirkung. Im <strong>Schweizer Gemeinde Simulator</strong>{" "}
            <span className="text-amber-200/90 font-semibold">BünzliFight</span> übernimmst du Basel im Multiplayer
            und spielst eine Strategie, die nicht langweilig wird.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Basel spielen – kostenlos starten
            </Link>

            <Link
              href="/faq"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              So funktioniert das Spiel
            </Link>
          </div>
        </header>

        {/* SECTION: Warum Basel */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Warum Basel?
          </h2>

          <p className="text-slate-200 text-sm leading-relaxed">
            Basel ist nicht „nur groß“. Basel ist <strong>Bewegung</strong>. Du hast das Gefühl, dass ständig etwas
            passiert – genau dafür ist diese Stadt im Game gemacht: Entscheidungen, Reaktionen, Events, Konkurrenz.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Dynamik
              </p>
              <p className="text-slate-200 text-sm">
                Basel fühlt sich aktiv an: du reagierst, optimierst und bleibst im Flow.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Grenzstadt-Vibe
              </p>
              <p className="text-slate-200 text-sm">
                Eine Stadt am Rhein: Einfluss, Spannung, Konkurrenz – perfekte Sandbox für Strategen.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Events
              </p>
              <p className="text-slate-200 text-sm">
                Ideal, wenn du nicht nur bauen willst, sondern auch live Entscheidungen treffen willst.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Multiplayer
              </p>
              <p className="text-slate-200 text-sm">
                Du spielst gegen Systeme und Menschen – das macht Basel spannend.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: Basel-Plan (eigener Hook) */}
        <section className="mb-10 rounded-sm border border-amber-400/25 bg-amber-500/10 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-2">
            Basel-Rhein-Plan: 5 Moves, die dich nach oben bringen
          </h2>

          <p className="text-amber-200/80 text-sm mb-5">
            Basel ist schnell. Darum brauchst du einen Plan, der nicht kompliziert ist.
          </p>

          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-200">
            <li>Start: Fokus wählen (Stabilität oder Wachstum)</li>
            <li>Events ernst nehmen (nicht ignorieren)</li>
            <li>Konsequent bleiben (keine Richtungswechsel alle 5 Minuten)</li>
            <li>Konkurrenz beobachten (Basel ist nie „allein“)</li>
            <li>Reputation aufbauen (Basel gewinnt über Konstanz)</li>
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Basel-Plan starten
            </Link>
            <Link
              href="/zuerich-gemeinde-simulator"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Zürich anschauen
            </Link>
          </div>
        </section>

        {/* SEO SECTION */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-medium text-base md:text-lg mb-4">
            Basel online spielen – Gemeinde Simulation Schweiz
          </h2>

          <p className="text-sm text-slate-200 leading-relaxed">
            Du suchst nach <strong>Basel Stadt Simulation</strong> oder einem{" "}
            <strong>Gemeinde Simulator in der Schweiz</strong>? BünzliFight ist ein Multiplayer-Spiel, in dem du Basel
            als Gemeinde steuerst – Strategie, Verwaltung und Events statt nur Deko.
          </p>
        </section>

        {/* FAQ visible */}
        <section className="mb-14">
          <h2 className="text-white font-display font-bold text-2xl md:text-3xl mb-6">
            FAQ: Basel im BünzliFight
          </h2>

          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist das eine offizielle Basel-Infoseite?
              </h3>
              <p>
                Nein. Das ist eine Spiel-Landingpage für Basel im Schweizer Gemeinde Simulator BünzliFight.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist Basel besser als Zürich?
              </h3>
              <p>
                Basel ist anders: mehr Dynamik und Event-Feeling. Zürich ist mehr Prime-City-Druck. Beides hat Stil.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Wie starte ich?
              </h3>
              <p>
                Registrieren, Basel wählen, loslegen. Danach spielst du deinen Basel-Rhein-Plan und baust Reputation auf.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Bereit für Basel?
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Rhein-Vibe, Events, Strategie – starte kostenlos und übernimm Basel.
            </p>

            <Link
              href="/"
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