import type { Metadata } from "next";
import Link from "next/link";

const CANONICAL = "https://buenzlifight.ch/solothurn-gemeinde-simulator";

export const metadata: Metadata = {
  title: "Solothurn im Gemeinde Simulator – Die 11er-Challenge | BünzliFight",
  description:
    "Solothurn im Schweizer Gemeinde Simulator BünzliFight: Starte die 11er-Challenge und werde Bürgermeister. Multiplayer, Steuern, Sicherheit, Events – jetzt kostenlos starten.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "Solothurn Gemeinde Simulator",
    "Solothurn Bürgermeister werden",
    "Solothurn online Spiel",
    "Schweizer Gemeinde Spiel",
    "Gemeinde Simulation Schweiz",
    "BünzliFight Solothurn",
  ],
  openGraph: {
    title: "Solothurn im Gemeinde Simulator – Die 11er-Challenge",
    description:
      "Starte die 11er-Challenge in Solothurn und werde Bürgermeister im Schweizer Gemeinde Simulator BünzliFight.",
    url: CANONICAL,
    type: "website",
    siteName: "BünzliFight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "BünzliFight – Solothurn im Gemeinde Simulator",
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

export default function SolothurnLandingPage() {
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
            "BünzliFight ist ein Schweizer Gemeinde Simulator als Multiplayer-Spiel. Du verwaltest Gemeinden, triffst Entscheidungen und spielst Events – mit Fokus auf Verwaltung, Wirtschaft und Strategie.",
        },
      },
      {
        "@type": "Question",
        name: "Was bedeutet die 11er-Challenge in Solothurn?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Die 11er-Challenge ist ein spielerischer Einstieg: 11 klare Ziele und Entscheidungen, die dich in Solothurn Schritt für Schritt zum Bürgermeister-Status bringen. Ohne Grind, mit Struktur.",
        },
      },
      {
        "@type": "Question",
        name: "Kann ich Solothurn kostenlos spielen?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ja. Du kannst kostenlos starten und sofort loslegen. Optional gibt es später Extras – aber der Einstieg ist gratis.",
        },
      },
      {
        "@type": "Question",
        name: "Für wen ist Solothurn als Start ideal?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Solothurn ist ideal, wenn du Strategie magst und eine Gemeinde bewusst aufbauen willst – statt nur zu klicken. Der Fokus liegt auf Entscheidungen und einem klaren Plan.",
        },
      },
    ],
  };

  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: "Solothurn",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Solothurn",
      addressRegion: "SO",
      addressCountry: "CH",
    },
    url: CANONICAL,
  };

  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={placeJsonLd} />

      {/* Background (wie dein Style) */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[6%] w-80 h-80 rounded-full bg-amber-300/10 blur-[140px]" />
        <div className="absolute bottom-[15%] right-[10%] w-96 h-96 rounded-full bg-emerald-300/8 blur-[160px]" />
        <div className="absolute top-[35%] right-[22%] w-72 h-72 rounded-full bg-red-500/8 blur-[150px]" />
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
            Solothurn • Schweizer Gemeinde Simulator
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            Solothurn im Gemeinde Simulator – die 11er-Challenge
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-3xl">
            Du willst nicht irgendeinen Citybuilder, sondern eine{" "}
            <strong>Schweizer Gemeinde Simulation</strong>, bei der Entscheidungen zählen?
            Dann starte in Solothurn mit der{" "}
            <span className="text-amber-200/90 font-semibold">11er-Challenge</span>:
            ein klarer Einstieg mit 11 Schritten – perfekt für neue Spieler.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Jetzt kostenlos starten
            </Link>

            <Link
              href="/faq"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Wie das Spiel funktioniert
            </Link>
          </div>
        </header>

        {/* SECTION: Warum Solothurn */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Warum Solothurn?
          </h2>

          <p className="text-slate-200 text-sm leading-relaxed">
            Solothurn ist der perfekte Startpunkt, weil du hier eine Gemeinde mit Plan aufbauen kannst.
            Nicht „schnell klicken“, sondern bewusst entscheiden: Prioritäten setzen, Risiken abwägen,
            Fortschritt spüren. Genau dafür ist die 11er-Challenge da.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Einstieg
              </p>
              <p className="text-slate-200 text-sm">
                11 Schritte = klare Struktur. Du weißt immer, was als Nächstes Sinn macht.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Multiplayer
              </p>
              <p className="text-slate-200 text-sm">
                Du spielst nicht allein. Gemeinden entwickeln sich durch Community & Entscheidungen.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Strategie
              </p>
              <p className="text-slate-200 text-sm">
                Verwaltung, Wirtschaft, Sicherheit, Events – alles greift ineinander.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Schweizer Vibes
              </p>
              <p className="text-slate-200 text-sm">
                Schweizer Setting, Gemeinde-Feeling, typisch bünzlig – aber als Game.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: 11er-Challenge */}
        <section className="mb-10 rounded-sm border border-amber-400/25 bg-amber-500/10 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-2">
            Die 11er-Challenge
          </h2>

          <p className="text-amber-200/80 text-sm mb-5">
            Keine Zahlen-Show. Nur ein sauberer Einstieg: 11 Mini-Ziele, die dich ins Spiel reinziehen.
          </p>

          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-200">
            <li>Gemeinde wählen & Ziel setzen</li>
            <li>Erste Entscheidung treffen (Prioritäten)</li>
            <li>Community-Mechanik checken</li>
            <li>Ein System verstehen (z. B. Verwaltung)</li>
            <li>Eine Verbesserung umsetzen</li>
            <li>Ein Risiko managen</li>
            <li>Ein Event erleben</li>
            <li>Deine Strategie anpassen</li>
            <li>Ein Ranking/Status entdecken</li>
            <li>Erste Routine entwickeln</li>
            <li>Solothurn offiziell „unter Kontrolle“ bringen</li>
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Challenge starten
            </Link>
            <Link
              href="/bern-gemeinde-simulator"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Lieber Bern statt Solothurn?
            </Link>
          </div>
        </section>

        {/* FAQ (visible) */}
        <section className="mb-14">
          <h2 className="text-white font-display font-bold text-2xl md:text-3xl mb-6">
            FAQ: Solothurn im BünzliFight
          </h2>

          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">Ist das eine echte Solothurn-Seite?</h3>
              <p>
                Nein – das ist eine Spielseite. Sie zeigt dir den Einstieg in Solothurn im Gemeinde Simulator.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">Warum die Zahl 11?</h3>
              <p>
                11 ist die Glückszahl – und hier ein einfacher, motivierender Einstieg mit klaren Schritten.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">Kann ich sofort starten?</h3>
              <p>
                Ja. Registrieren, Solothurn auswählen und loslegen – ohne komplizierte Setup-Hürden.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Starte jetzt in Solothurn
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Kostenlos starten. 11 Schritte. Solothurn übernehmen.
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