import type { Metadata } from 'next';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Banking & Kredite – Persönliche Finanzen in BünzliFight',
  description:
    'So funktioniert das persönliche Bankkonto in BünzliFight: Kontostand, Transaktionshistorie, Kreditaufnahme und Gebühren im Schweizer Gemeinde Simulator.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Banking & Kredit', href: '/quick-guide/banking-kredit' },
];

export default function BankingKreditPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Banking & Kredite – Persönliche Finanzen in BünzliFight', description: 'Persönliches Bankkonto, Transaktionshistorie und Kreditaufnahme im Schweizer Gemeinde Simulator.', slug: '/quick-guide/banking-kredit' })) }} />
      <header className="mb-8">
        <p className="text-teal-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 06</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Banking & Kredit</h1>
        <div className="h-px w-16 bg-gradient-to-r from-teal-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Jeder Spieler hat ein persönliches Bankkonto — unabhängig von der Gemeindekasse.
          Hier fliessen dein Lohn, Firmengewinne und Ausgaben zusammen. Das Banking-Panel
          zeigt dir deinen Kontostand und die letzten Transaktionen.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-banking.gif" alt="BankingPanel in BünzliFight" label="Banking & Kredit" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Dein persönliches Konto</h2>
          <p>
            Im Banking-Panel siehst du auf einen Blick deinen aktuellen Kontostand,
            die maskierte Kontonummer und deine AHV-ID. Das Konto ist dein persönliches
            Vermögen — davon werden zum Beispiel Firmengründungskosten abgebucht.
          </p>
          <p className="mt-2">
            Der Status deines Kontos kann sein: <strong className="text-emerald-300">Aktiv</strong>,{' '}
            <strong className="text-amber-300">Gesperrt</strong> oder{' '}
            <strong className="text-red-400">Geschlossen</strong>. Bei einem gesperrten
            Konto können keine Transaktionen durchgeführt werden.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Transaktionshistorie</h2>
          <p>
            Das Panel zeigt die letzten 20 Transaktionen mit Datum, Betrag und Typ.
            Grüne Beträge sind Eingänge, rote Beträge sind Ausgaben. Folgende
            Transaktionstypen können auftreten:
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              ['Steuer', 'Abzug durch die Gemeinde'],
              ['Transfer', 'Überweisung an/von anderen Spielern'],
              ['Belohnung', 'Bonus für Achievements oder Events'],
              ['Gebühr', 'Verwaltungsgebühren und Strafzahlungen'],
              ['Gehalt', 'Lohn aus Firmenmitgliedschaft'],
              ['Gründungskosten', 'Abzug bei Firmengründung'],
              ['Ausgabe', 'Allgemeine Ausgaben im Spiel'],
              ['Einnahme', 'Allgemeine Einnahmen aus Aktivitäten'],
            ].map(([type, desc]) => (
              <div key={type} className="flex gap-2 rounded-sm border border-white/6 bg-black/15 px-3 py-2">
                <span className="text-teal-400 shrink-0 text-xs mt-0.5">—</span>
                <span className="text-xs"><strong className="text-white">{type}:</strong> {desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Gemeinde-Kredit vs. Firmenkredit</h2>
          <p>
            Es gibt zwei Kreditarten im Spiel:
          </p>
          <ul className="mt-2 space-y-2 pl-4">
            <li className="flex gap-2">
              <span className="text-teal-400 shrink-0">—</span>
              <span><strong className="text-white">Firmenkredit:</strong> Deine Firma leiht Geld von der Gemeindekasse. Wöchentliche Rückzahlung mit Zinsen. Kreditlimit abhängig vom Firmenstatus.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400 shrink-0">—</span>
              <span><strong className="text-white">Persönliches Konto:</strong> Hat kein Kreditlimit, aber Überziehung ist nicht möglich — du kannst nicht mehr ausgeben als du hast.</span>
            </li>
          </ul>
        </section>

        <section className="rounded-sm border border-teal-500/20 bg-teal-500/5 px-4 py-3">
          <h3 className="text-teal-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Achte beim Firmengründen auf deinen persönlichen Kontostand — die Kosten werden
            sofort abgebucht. Stelle sicher, dass du nach der Gründung noch genug Kapital
            hast, um erste Aktivitäten zu finanzieren.
          </p>
        </section>
      </div>

      <GuidePrevNext current="/quick-guide/banking-kredit" />
    </article>
  );
}
