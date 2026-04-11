import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum von BünzliFight — ein privates Hobbyprojekt von Marc Gatschet.',
};

export default function ImpressumPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-emerald-400/5 blur-[120px]" />
        <div className="absolute bottom-[15%] right-[8%] w-80 h-80 rounded-full bg-amber-300/5 blur-[130px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-12 pb-20">
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

        <header className="mb-10">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            BünzliFight
          </p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
            Impressum
          </h1>
          <div className="h-px w-20 bg-gradient-to-r from-amber-300/80 to-transparent mt-4" />
        </header>

        <div className="space-y-8 text-sm text-slate-200 leading-relaxed">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-5 py-4">
            <p className="text-amber-100 text-sm font-medium mb-1">Privates Hobbyprojekt</p>
            <p className="text-amber-200/70 text-xs">
              BünzliFight ist ein rein privates, nicht-kommerzielles Hobbyprojekt. Es handelt sich
              nicht um ein Angebot einer Firma oder eines Unternehmens.
            </p>
          </div>

          <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
            <h2 className="text-white font-medium text-base mb-3">Verantwortlich für den Inhalt</h2>
            <div className="space-y-1">
              <p className="text-white font-medium">Marc Gatschet</p>
              <p>Bielstrasse 2</p>
              <p>2540 Grenchen</p>
              <p>Schweiz</p>
            </div>
          </section>

          <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
            <h2 className="text-white font-medium text-base mb-3">Kontakt</h2>
            <p>
              Bei Fragen, Anliegen oder Auskunftsbegehren kannst du mich per E-Mail erreichen:
            </p>
            <p className="mt-2">
              <a
                href="mailto:admin@buenzlifight.ch"
                className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors"
              >
                admin@buenzlifight.ch
              </a>
            </p>
          </section>

          <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
            <h2 className="text-white font-medium text-base mb-3">Hinweis</h2>
            <p>
              Dieses Projekt wird von mir als Privatperson in meiner Freizeit entwickelt und betrieben.
              Es ist kein gewerbliches Angebot. Es bestehen keine kommerziellen Absichten —
              das Spiel ist kostenlos und wird es bleiben.
            </p>
            <p className="mt-3">
              Da es sich um ein privates Hobbyprojekt handelt, gelten keine Gewährleistungs- oder
              Verfügbarkeitsgarantien. Das Spiel befindet sich in aktiver Entwicklung und kann
              jederzeit verändert oder eingestellt werden.
            </p>
          </section>

          <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
            <h2 className="text-white font-medium text-base mb-3">Haftungsausschluss</h2>
            <p>
              Der Autor übernimmt keine Gewähr für die Richtigkeit, Vollständigkeit und
              Aktualität der bereitgestellten Inhalte. Die Nutzung der Inhalte erfolgt auf
              eigene Gefahr. Für externe Links wird keine Haftung übernommen.
            </p>
          </section>

          <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
            <h2 className="text-white font-medium text-base mb-3">Urheberrecht</h2>
            <p>
              Die durch mich erstellten Inhalte und Werke auf dieser Seite unterliegen dem
              Schweizer Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und
              jede Art der Verwertung ausserhalb der Grenzen des Urheberrechts bedürfen
              meiner schriftlichen Zustimmung.
            </p>
          </section>
        </div>

        <div className="mt-12 flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link href="/datenschutz" className="hover:text-amber-200 transition-colors">
            Datenschutz
          </Link>
          <span className="text-white/15">|</span>
          <Link href="/faq" className="hover:text-amber-200 transition-colors">
            FAQ
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-slate-500 text-[10px]">
          BünzliFight &copy; 2026
        </div>
      </div>
    </main>
  );
}
