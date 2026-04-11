import type { Metadata } from 'next';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Statistiken & Berichte – Gemeindewachstum analysieren | BünzliFight',
  description:
    'Das Statistik-Panel in BünzliFight: Bevölkerung, Finanzen und Zufriedenheit über 90 Tage verfolgen. So liest du die interaktiven Graphen richtig.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Statistiken', href: '/quick-guide/statistiken' },
];

export default function StatistikenPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Statistiken & Berichte – Gemeindewachstum analysieren', description: 'Bevölkerung, Finanzen und Zufriedenheit über 90 Tage in interaktiven Graphen verfolgen.', slug: '/quick-guide/statistiken' })) }} />
      <header className="mb-8">
        <p className="text-sky-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 05</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Statistiken & Berichte</h1>
        <div className="h-px w-16 bg-gradient-to-r from-sky-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Das Statistik-Panel zeigt dir den Verlauf deiner Gemeinde über bis zu 90 Tage.
          Erkenne Trends, identifiziere Probleme frühzeitig und optimiere deine Strategie
          auf Basis echter Daten.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-stats.gif" alt="StatisticsPanel in BünzliFight" label="Statistiken & Berichte" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Die 4 Kennzahlen-Karten</h2>
          <p>
            Oben im Panel findest du vier Karten mit den aktuellen Werten auf einen Blick:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ['Bevölkerung', 'Aktuelle Einwohnerzahl', 'sky'],
              ['Arbeitsplätze', 'Anzahl verfügbarer Jobs in der Gemeinde', 'emerald'],
              ['Gemeindekasse', 'Aktueller Stand des Kassenreservats in CHF', 'amber'],
              ['Tagesnetto', 'Einnahmen minus Ausgaben des heutigen Tages', 'violet'],
            ].map(([title, desc, color]) => (
              <div key={title} className="rounded-sm border border-white/8 bg-black/20 px-3 py-2.5">
                <p className={`font-semibold text-xs text-${color}-300`}>{title}</p>
                <p className="text-slate-500 text-[11px] mt-0.5 leading-tight">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Interaktive Graphen</h2>
          <p>
            Unter den Karten befinden sich drei Chart-Tabs, die jeweils den 90-Tage-Verlauf
            als Liniendiagramm darstellen. Bewege den Mauszeiger über den Graphen, um
            Tageswerte abzulesen:
          </p>
          <ul className="mt-3 space-y-2 pl-4">
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">—</span>
              <span><strong className="text-white">Bevölkerung:</strong> Zeigt das Einwohnerwachstum. Stagnation deutet auf fehlende Wohnzonen oder zu niedrige Zufriedenheit hin.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">—</span>
              <span><strong className="text-white">Finanzen:</strong> Entwicklung der Gemeindekasse. Ein steigender Trend ist gut — fallende Kurve bedeutet tägliche Defizite.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 shrink-0">—</span>
              <span><strong className="text-white">Zufriedenheit:</strong> Prozentsatz der zufriedenen Einwohner. Hohe Zufriedenheit erhöht Steuererträge und Bevölkerungswachstum.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Daten interpretieren</h2>
          <p>
            Die Graphen kombinieren historische Tagesdaten (aus der Datenbank) mit dem
            aktuellen Live-Wert. Grosse Sprünge im Graphen sind normal nach Ereignissen wie
            Katastrophen, neuen Gebäuden oder Budget-Anpassungen. Achte auf langfristige
            Trends statt auf kurzfristige Schwankungen.
          </p>
        </section>

        <section className="rounded-sm border border-sky-500/20 bg-sky-500/5 px-4 py-3">
          <h3 className="text-sky-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Wenn die Zufriedenheitskurve fällt, schau zuerst ins Budget-Panel. Oft liegt es
            an zu niedrigen Ausgaben für Polizei oder Gesundheit. Eine Anhebung auf 70–80 %
            stabilisiert die Kurve meist innerhalb weniger Spieltage.
          </p>
        </section>
      </div>

      <GuidePrevNext current="/quick-guide/statistiken" />
    </article>
  );
}
