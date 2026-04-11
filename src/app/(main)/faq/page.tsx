import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ — Häufig gestellte Fragen',
  description:
    'Alles was du über BünzliFight wissen musst: Kostenloses Schweizer City-Builder-Spiel mit Echtzeit-Multiplayer. Demo jetzt spielbar.',
  openGraph: {
    title: 'BünzliFight FAQ — Häufig gestellte Fragen',
    description:
      'Was ist BünzliFight? Ist es kostenlos? Wie funktioniert Multiplayer? Alle Antworten zum Schweizer City-Builder.',
  },
};

const FAQ_ITEMS = [
  {
    question: 'Was ist BünzliFight?',
    answer:
      'BünzliFight ist ein kostenloses, browserbasiertes Schweizer City-Builder-Spiel. Du baust deine eigene Schweizer Gemeinde auf, verwaltest Ressourcen wie Steuern, Strom und Wasser, und spielst in Echtzeit-Multiplayer mit anderen Spielern zusammen. Das Spiel ist inspiriert von Klassikern wie SimCity und Cities: Skylines, aber mit einem einzigartigen Schweizer Setting.',
  },
  {
    question: 'Ist BünzliFight kostenlos?',
    answer:
      'Ja, BünzliFight ist komplett kostenlos spielbar. Es gibt keine Mikrotransaktionen und keine Pay-to-Win-Mechaniken. Das Spiel befindet sich aktuell in einer offenen Demo-Phase — jeder kann sich registrieren und sofort losspielen.',
  },
  {
    question: 'Was bedeutet «Demo-Phase»?',
    answer:
      'BünzliFight befindet sich in aktiver Entwicklung. In der Demo-Phase sind alle Features kostenlos spielbar, aber es kann zu Updates kommen, bei denen Spielstände zurückgesetzt werden. Neue Features, Gebäude und Spielmechaniken werden regelmässig hinzugefügt. Dein Feedback hilft uns, das Spiel zu verbessern!',
  },
  {
    question: 'Wie funktioniert das Multiplayer-System?',
    answer:
      'Jede Gemeinde ist ein Echtzeit-Multiplayer-Raum mit bis zu 25 Spielern. Spieler können verschiedene Rollen haben: Gemeindepräsident (Besitzer), Gemeinderat (Verwaltung), Bürger oder Beobachter. Ihr baut gemeinsam an eurer Stadt, handelt mit Nachbargemeinden und löst Verwaltungsprobleme zusammen.',
  },
  {
    question: 'Welche Gemeinden gibt es?',
    answer:
      'Du kannst einer bestehenden Schweizer Gemeinde beitreten oder deine eigene Gemeinde gründen. Verfügbare Gemeinden basieren auf echten Schweizer Orten wie Zürich, Bern, Luzern, Basel, Solothurn und Winterthur. Jede Gemeinde hat ein eigenes Wappen, eigene Finanzen und eine Verwaltungsstruktur.',
  },
  {
    question: 'Was kann ich in BünzliFight bauen?',
    answer:
      'Du kannst Wohnzonen, Gewerbe- und Industriegebiete anlegen, Strassen und Schienen bauen, sowie öffentliche Einrichtungen wie Schulen, Spitäler, Polizeistationen und Feuerwehren platzieren. Dazu kommen Parks, Sportanlagen, Museen, Flughäfen und sogar ein Weltraumprogramm. Alle Gebäude werden als isometrische 3D-Sprites dargestellt.',
  },
  {
    question: 'Auf welchen Geräten läuft BünzliFight?',
    answer:
      'BünzliFight läuft direkt im Browser — auf Desktop, Tablet und Smartphone. Es ist keine Installation nötig. Das Spiel hat eine optimierte Mobile-Ansicht mit Touch-Steuerung und angepasstem UI. Empfohlen wird ein moderner Browser wie Chrome, Firefox, Safari oder Edge.',
  },
  {
    question: 'Wie funktionieren Firmen und Handel?',
    answer:
      'Spieler können eigene Firmen gründen und Aufträge von der Gemeindeverwaltung annehmen, z.B. Infrastrukturprobleme beheben. Zwischen Gemeinden kann gehandelt werden — besuche Nachbargemeinden, schliesse Partnerschaften und tausche Ressourcen. Das Finanzsystem umfasst Steuern, Kredite, Ausgaben und eine detaillierte Buchhaltung.',
  },
  {
    question: 'Wie starte ich?',
    answer:
      'Gehe auf die Startseite, klicke auf «Registrieren», wähle einen Nicknamen und eine Gemeinde (oder gründe deine eigene) — fertig! Du kannst sofort loslegen und deine Stadt aufbauen. Es ist kein Download oder Installation nötig.',
  },
  {
    question: 'Gibt es Achievements?',
    answer:
      'Ja! BünzliFight hat ein Achievement-System mit Fortschrittsanzeige. Du schaltest Achievements frei, indem du Meilensteine erreichst — z.B. eine bestimmte Bevölkerungsgrösse, Gebäude bauen oder Finanzziele erreichen. Achievements werden mit Sounds und Animationen belohnt.',
  },
];

function ChevronIcon() {
  return (
    <svg
      className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      {/* Dark overlay that covers the hero-gradient bg image for readability */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-emerald-400/5 blur-[120px]" />
        <div className="absolute bottom-[15%] right-[8%] w-80 h-80 rounded-full bg-amber-300/5 blur-[130px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-12 pb-20">
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

        {/* Header */}
        <header className="mb-10">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            BünzliFight
          </p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
            Häufig gestellte Fragen
          </h1>
          <div className="h-px w-20 bg-gradient-to-r from-amber-300/80 to-transparent mt-4" />
          <p className="mt-4 text-slate-300 text-sm leading-relaxed max-w-xl">
            Alles was du über BünzliFight wissen musst — das kostenlose
            Schweizer City-Builder-Spiel mit Echtzeit-Multiplayer.
            Aktuell in der offenen Demo-Phase.
          </p>
        </header>

        {/* Demo Badge */}
        <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-5 py-3 mb-8">
          <p className="text-amber-100 text-sm font-medium">
            BünzliFight befindet sich in der{' '}
            <span className="font-bold text-white">offenen Demo-Phase</span>.
            Alle Features sind kostenlos spielbar.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <details
              key={i}
              className="group rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm open:bg-black/50 transition-colors"
            >
              <summary className="cursor-pointer px-5 py-4 font-medium text-white flex items-center justify-between gap-4 select-none text-[15px]">
                <span>{item.question}</span>
                <ChevronIcon />
              </summary>
              <div className="px-5 pb-5 text-slate-200 text-sm leading-relaxed">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-slate-300 text-sm mb-4">
            Bereit, deine eigene Schweizer Gemeinde zu bauen?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold tracking-wide hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-900/30"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Jetzt kostenlos spielen
            </Link>
            <Link
              href="/quick-guide"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-sm border border-white/15 text-slate-300 hover:text-white hover:border-white/30 font-medium tracking-wide transition-all text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Handbuch lesen
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 mb-1">
            <Link href="/impressum" className="hover:text-amber-200 transition-colors">Impressum</Link>
            <span className="text-white/10">|</span>
            <Link href="/datenschutz" className="hover:text-amber-200 transition-colors">Datenschutz</Link>
            <span className="text-white/10">|</span>
            <Link href="/quick-guide" className="hover:text-amber-200 transition-colors">Handbuch</Link>
          </div>
          <p className="text-slate-500 text-[10px]">
            BünzliFight &copy; 2026
          </p>
        </div>
      </div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
