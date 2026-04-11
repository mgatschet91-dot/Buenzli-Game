import type { Metadata } from "next";
import Link from "next/link";

const CANONICAL = "https://buenzlifight.ch/schweizer-gemeinde-spiele";

export const metadata: Metadata = {
  title: "Schweizer Gemeinde Spiele – Vergleich & Alternativen | BünzliFight",
  description:
    "Schweizer Gemeinde Spiele im Vergleich: Welche Spiele gibt es? Überblick, Unterschiede, Alternativen – und warum BünzliFight als Iso-City Gemeinde Simulator spannend ist. Kostenlos starten.",
  alternates: { canonical: CANONICAL },
  keywords: [
    "schweizer gemeinde spiele",
    "schweizer gemeinden spiel",
    "gemeinde spiel schweiz",
    "gemeinde simulator schweiz",
    "dswdsgkk alternative",
    "gemeinde kaufen spiel",
    "schweizer simulationsspiel",
    "bünzlifight",
  ],
  openGraph: {
    title: "Schweizer Gemeinde Spiele – Vergleich & Alternativen",
    description:
      "Welche Schweizer Gemeinde-Spiele gibt es? Überblick, Vergleich und Alternativen – inkl. BünzliFight als Iso-City Simulator.",
    url: CANONICAL,
    type: "website",
    siteName: "BünzliFight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Schweizer Gemeinde Spiele – Vergleich",
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

export default function SchweizerGemeindeSpielePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Gibt es überhaupt Schweizer Gemeinde Spiele?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ja. Es gibt verschiedene Spiele und Simulationen mit Schweiz- und Gemeinde-Fokus – von Echtzeit- und Bietspielen bis hin zu Verwaltungssimulationen. BünzliFight setzt das als Iso-City Gemeinde Simulator im Multiplayer um.",
        },
      },
      {
        "@type": "Question",
        name: "Was ist der Unterschied zwischen Gemeinde-Spiel und Citybuilder?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Citybuilder fokussieren häufig auf Bauen und Wachstum. Gemeinde-Spiele betonen stärker Verwaltung, Regeln, Steuern, Entscheidungen, Events und Wettbewerb zwischen Gemeinden.",
        },
      },
      {
        "@type": "Question",
        name: "Ist das eine offizielle Informationsseite der Schweiz?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Nein. Diese Seite ist eine Spiel-Übersicht und ein Vergleich von Games/Simulationen. Sie ist kein offizielles Portal und keine Quelle für amtliche Daten.",
        },
      },
      {
        "@type": "Question",
        name: "Welche Seite ist die wichtigste für BünzliFight?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Für den Einstieg und die Erklärung des Spiels ist die Hauptseite 'Gemeinde Simulator Schweiz' am wichtigsten. Von hier aus kannst du Städte-Landingpages wie Zürich, Bern oder Basel öffnen.",
        },
      },
    ],
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Schweizer Gemeinde Spiele – Vergleich & Alternativen",
    url: CANONICAL,
    description:
      "Vergleichsseite zu Schweizer Gemeinde-Spielen und Simulationen, inkl. BünzliFight als Iso-City Gemeinde Simulator.",
  };

  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={collectionJsonLd} />

      {/* Background (gleiches System wie bei dir) */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[6%] w-[34rem] h-[34rem] rounded-full bg-amber-300/10 blur-[170px]" />
        <div className="absolute bottom-[14%] right-[10%] w-[36rem] h-[36rem] rounded-full bg-emerald-300/8 blur-[180px]" />
        <div className="absolute top-[40%] right-[26%] w-80 h-80 rounded-full bg-cyan-300/7 blur-[150px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10 pb-24">
        {/* Top links */}
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
              href="/gemeinde-simulator-schweiz"
              className="text-xs md:text-sm text-amber-200/90 hover:text-amber-100 transition-colors"
            >
              Gemeinde Simulator Schweiz
            </Link>
            <span className="text-slate-600">•</span>
            <Link
              href="/register"
              className="text-xs md:text-sm text-slate-300 hover:text-white transition-colors"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>

        {/* HERO */}
        <header className="mb-12">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            Vergleich • Alternativen • Schweiz
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            Schweizer Gemeinde Spiele
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-3xl">
            Du suchst ein <strong>Schweizer Gemeinde Spiel</strong> oder eine{" "}
            <strong>Gemeinde Simulation</strong>? Hier findest du einen Überblick über
            bekannte Ansätze (Echtzeit/Bietspiel, Verwaltungssimulation) und eine moderne
            Alternative: <span className="text-amber-200/90 font-semibold">BünzliFight</span>{" "}
            als Iso-City Gemeinde Simulator im Multiplayer.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link
              href="/gemeinde-simulator-schweiz"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              BünzliFight anschauen
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Direkt kostenlos starten
            </Link>
          </div>

          <div className="h-px w-28 bg-gradient-to-r from-amber-300/80 to-transparent mt-8" />
        </header>

        {/* NOTE / DISCLAIMER */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Hinweis
          </h2>
          <p className="text-slate-200 text-sm leading-relaxed">
            Diese Seite ist eine <strong>Spiel-Übersicht</strong> und ein Vergleich von Spiel-Konzepten.
            Sie ist <strong>kein offizielles Portal</strong> und liefert keine amtlichen Informationen.
          </p>
        </section>

        {/* COMPARISON CARDS */}
        <section className="mb-12 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-4">
            Arten von Schweizer Gemeinde-Spielen
          </h2>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Echtzeit / Bietspiel
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Fokus auf “Gemeinden kaufen/ersteigern”, Besitz, Wettbewerb und Dynamik.
                Gut für schnelle Runden und Rankings.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Verwaltung / Management
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Fokus auf Entscheidungen wie Budget, Services, Nachhaltigkeit und Planung.
                Eher “Simulation” als reines Spielgefühl.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">
                Iso-City Simulator
              </p>
              <p className="text-slate-200 text-sm leading-relaxed">
                Mischung aus City-Feeling und Gemeinde-Systemen: Steuern, Events, Entscheidungen
                – sichtbar in einer isometrischen Stadtwelt.
              </p>
            </div>
          </div>
        </section>

        {/* WHY BUENZLIFIGHT */}
        <section className="mb-12 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-4">
            Warum BünzliFight in diese Nische passt
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <div className="text-white font-semibold mb-1">Schweizer Gemeinde-Fokus</div>
              <p className="text-slate-200 text-sm leading-relaxed">
                Nicht “irgendeine Stadt”, sondern Schweizer Vibes, typische Themen und ein klarer Gemeinde-Loop.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <div className="text-white font-semibold mb-1">Steuern & Entscheidungen</div>
              <p className="text-slate-200 text-sm leading-relaxed">
                Du spielst nicht nur “bauen”, sondern steuertest Systeme: Regeln, Verwaltung, Stabilität und Reputation.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <div className="text-white font-semibold mb-1">Events statt Leerlauf</div>
              <p className="text-slate-200 text-sm leading-relaxed">
                Events machen das Spiel lebendig: reagieren, lösen, optimieren – statt einfach nur Menüs klicken.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/35 p-5">
              <div className="text-white font-semibold mb-1">City Pages als Einstieg</div>
              <p className="text-slate-200 text-sm leading-relaxed">
                Starte direkt in Zürich, Bern oder Basel – oder wähle einen Underdog-Start wie Solothurn.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/gemeinde-simulator-schweiz"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Gemeinde Simulator Schweiz öffnen
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Kostenlos starten
            </Link>
          </div>
        </section>

        {/* ENTRY LINKS */}
        <section className="mb-12 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Direkte Einstiege
          </h2>

          <div className="grid gap-3 md:grid-cols-4">
            <Link
              href="/zuerich-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-4 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">Zürich</div>
              <div className="text-white font-semibold">Prime City</div>
            </Link>

            <Link
              href="/bern-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-4 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">Bern</div>
              <div className="text-white font-semibold">Hauptstadt</div>
            </Link>

            <Link
              href="/basel-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-4 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">Basel</div>
              <div className="text-white font-semibold">Dynamik</div>
            </Link>

            <Link
              href="/solothurn-gemeinde-simulator"
              className="rounded-sm border border-white/10 bg-black/35 p-4 hover:bg-black/45 transition-colors"
            >
              <div className="text-amber-200/90 text-xs tracking-[0.25em] uppercase mb-2">Solothurn</div>
              <div className="text-white font-semibold">11er-Challenge</div>
            </Link>
          </div>
        </section>

        {/* FAQ visible */}
        <section className="mb-14">
          <h2 className="text-white font-display font-bold text-2xl md:text-3xl mb-6">
            FAQ
          </h2>

          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Kann ich über diese Seite auch andere Spiele finden?
              </h3>
              <p>
                Ja. Diese Seite ist als Überblick gedacht. Wenn du speziell nach einem Gemeinde Simulator im Iso-City-Style
                suchst, ist BünzliFight die passende Alternative.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Ist „Gemeinde Simulator Schweiz“ ein eigenes Keyword?
              </h3>
              <p>
                Ja – und es ist stark, weil es Game-Intent enthält. Darum verlinken wir von hier gezielt auf die Hauptseite.
              </p>
            </div>

            <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
              <h3 className="text-white font-medium mb-2">
                Wie spiele ich BünzliFight?
              </h3>
              <p>
                Einfach registrieren und loslegen. Du startest im Browser und kannst später in Städte-Landingpages tiefer einsteigen.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Lust auf den Schweizer Gemeinde Simulator?
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Iso-City, Steuern, Events und Multiplayer – starte jetzt kostenlos in BünzliFight.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-7 py-3 transition-colors"
              >
                Kostenlos starten
              </Link>
              <Link
                href="/gemeinde-simulator-schweiz"
                className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-7 py-3 transition-colors"
              >
                Mehr Infos
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