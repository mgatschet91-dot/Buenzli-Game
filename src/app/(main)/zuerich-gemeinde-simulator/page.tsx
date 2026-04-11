import type { Metadata } from "next";
import Link from "next/link";

const CANONICAL = "https://buenzlifight.ch/zuerich-gemeinde-simulator";

export const metadata: Metadata = {
  title: "Zürich im Gemeinde Simulator – Prestige & Kontrolle | BünzliFight",
  description:
    "Zürich im Schweizer Gemeinde Simulator BünzliFight: Übernimm die Prime City im Multiplayer. Strategie, Verwaltung, Events – werde Bürgermeister von Zürich. Kostenlos starten.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "Zürich Gemeinde Simulator",
    "Zürich Bürgermeister werden",
    "Zürich Stadt Simulation",
    "Zürich online Spiel",
    "Schweizer Gemeinde Spiel",
    "Gemeinde Simulation Schweiz",
    "BünzliFight Zürich",
  ],
  openGraph: {
    title: "Zürich im Gemeinde Simulator – Prestige & Kontrolle",
    description:
      "Übernimm Zürich im Multiplayer Gemeinde Simulator BünzliFight. Perfekt für Strategie-Fans, die die Prime City wollen.",
    url: CANONICAL,
    type: "website",
    siteName: "BünzliFight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "BünzliFight – Zürich im Gemeinde Simulator",
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

export default function ZuerichLandingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Warum ist Zürich ein besonderer Start im BünzliFight?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Zürich ist die Prime City im Schweizer Gemeinde Simulator: Prestige, Konkurrenz und viele Entscheidungen. Ideal für Spieler, die Strategie und Kontrolle wollen.",
        },
      },
      {
        "@type": "Question",
        name: "Brauche ich Erfahrung, um Zürich zu spielen?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Nicht zwingend. Du kannst kostenlos starten. Zürich ist anspruchsvoller als kleinere Gemeinden, aber perfekt, wenn du direkt groß einsteigen willst.",
        },
      },
      {
        "@type": "Question",
        name: "Ist das eine offizielle Zürich-Infoseite?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Nein. Das ist eine Spiel-Landingpage für Zürich im BünzliFight Gemeinde Simulator, nicht eine offizielle Informationsseite.",
        },
      },
      {
        "@type": "Question",
        name: "Wie starte ich in Zürich?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Registrieren, Zürich auswählen und loslegen. Danach baust du deine Strategie aus – Verwaltung, Events und Entscheidungen bestimmen deinen Aufstieg.",
        },
      },
    ],
  };

  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: "Zürich",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Zürich",
      addressRegion: "ZH",
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
        {/* Zürich: mehr "Neon / Finance / Prestige" Feeling */}
        <div className="absolute top-[10%] left-[8%] w-96 h-96 rounded-full bg-cyan-300/10 blur-[160px]" />
        <div className="absolute bottom-[15%] right-[10%] w-[32rem] h-[32rem] rounded-full bg-amber-300/8 blur-[170px]" />
        <div className="absolute top-[35%] right-[25%] w-80 h-80 rounded-full bg-emerald-300/8 blur-[150px]" />
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
            Zürich • Prime City • Multiplayer
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            Zürich im Gemeinde Simulator – Prestige & Kontrolle
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-3xl">
            Du willst direkt in die <strong>größte Bühne</strong>?
            Zürich ist die Prime City in BünzliFight: hohe Konkurrenz, hohe Wirkung,
            viele Entscheidungen. Wenn du Strategie liebst und nicht klein anfangen willst,
            ist Zürich dein Start.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Zürich spielen – kostenlos starten
            </Link>

            <Link
              href="/faq"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Was ist BünzliFight?
            </Link>
          </div>
        </header>

        {/* SECTION: Warum Zürich */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Warum Zürich im Schweizer Gemeinde Simulator?
          </h2>

          <p className="text-slate-200 text-sm leading-relaxed">
            Zürich ist kein „Chill-Start“. Es ist die Gemeinde für Spieler, die
            Verantwortung, Konkurrenz und Prestige wollen. Du baust dir Einfluss auf,
            optimierst deine Entscheidungen und zeigst, dass du die Prime City kontrollieren kannst.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Prestige
              </p>
              <p className="text-slate-200 text-sm">
                Zürich ist die Bühne. Wer hier überzeugt, überzeugt überall.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Konkurrenz
              </p>
              <p className="text-slate-200 text-sm">
                Mehr Rivalen = mehr Spannung. Zürich ist für echte Strategen.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Entscheidungen
              </p>
              <p className="text-slate-200 text-sm">
                Jede Entscheidung zählt. Kleine Fehler haben große Wirkung.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Multiplayer
              </p>
              <p className="text-slate-200 text-sm">
                Du spielst nicht gegen NPCs, sondern gegen echte Spieler und Systeme.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: Zürich Masterplan (anders als Solothurn) */}
        <section className="mb-10 rounded-sm border border-amber-400/25 bg-amber-500/10 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-2">
            Zürich-Masterplan: 7 Schritte zur Kontrolle
          </h2>

          <p className="text-amber-200/80 text-sm mb-5">
            Zürich ist hart. Darum: kein Chaos – ein Masterplan.
          </p>

          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-200">
            <li>Start klar: Ziel definieren (Prestige / Ordnung / Wachstum)</li>
            <li>Prioritäten setzen (nicht alles gleichzeitig)</li>
            <li>Ein System meistern (Verwaltung oder Events)</li>
            <li>Risiken klein halten, Stabilität aufbauen</li>
            <li>Rivalen verstehen: Konkurrenz beobachten</li>
            <li>Konstant bleiben: Entscheidungen mit Linie</li>
            <li>Zürich „besitzen“: Reputation durch Performance</li>
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Masterplan starten
            </Link>
            <Link
              href="/solothurn-gemeinde-simulator"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Lieber Solothurn (11er-Challenge)?
            </Link>
          </div>
        </section>

        {/* SEO SECTION (intent) */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-medium text-base md:text-lg mb-4">
            Zürich online spielen – Gemeinde Simulation Schweiz
          </h2>

          <p className="text-sm text-slate-200 leading-relaxed">
            Du suchst nach einem <strong>Gemeinde Simulator</strong> oder einer
            <strong> Stadt Simulation in der Schweiz</strong>? In BünzliFight steuerst du
            eine Gemeinde im Multiplayer. Zürich ist die Prime City – perfekt für Spieler, die
            Wettbewerb, Prestige und Strategie wollen.
          </p>
        </section>

        {/* FAQ (visible) */}
        <section className="mb-14">
          <h2 className="text-white font-display font-bold text-2xl md:text-3xl mb-6">
            FAQ: Zürich im BünzliFight
          </h2>

          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist das eine offizielle Zürich-Seite?
              </h3>
              <p>
                Nein. Das ist eine Spiel-Landingpage für Zürich im Schweizer Gemeinde Simulator BünzliFight.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist Zürich schwer zu spielen?
              </h3>
              <p>
                Zürich ist anspruchsvoll – aber genau darum spannend. Wenn du Strategie magst, ist es perfekt.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Wie starte ich?
              </h3>
              <p>
                Registrieren, Zürich wählen, loslegen. Danach entwickelst du deinen Masterplan und spielst Events.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Bereit für Zürich?
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Zürich ist Prime City. Starte jetzt und zeig, dass du Kontrolle hast.
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