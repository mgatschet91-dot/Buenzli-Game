import type { Metadata } from 'next';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Budget & Steuern verwalten – BünzliFight Gemeinde Simulator',
  description:
    'So funktioniert das Budget-System in BünzliFight: Steuereinnahmen, 8 Ausgaben-Kategorien mit Schiebereglern und Tipps für eine gesunde Gemeindefinanzierung.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Budget & Steuern', href: '/quick-guide/budget-finanzen' },
];

export default function BudgetFinanzenPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Budget & Steuern verwalten – BünzliFight Gemeinde Simulator', description: 'So funktioniert das Budget-System: Steuereinnahmen, 8 Ausgaben-Kategorien mit Schiebereglern und Tipps für gesunde Gemeindefinanzen.', slug: '/quick-guide/budget-finanzen' })) }} />
      <header className="mb-8">
        <p className="text-cyan-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 02</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Budget & Steuern</h1>
        <div className="h-px w-16 bg-gradient-to-r from-cyan-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Das Budget-Panel ist deine Schaltzentrale für die Gemeindefinanzen. Hier siehst du
          auf einen Blick wie viel Geld täglich einkommt, wie es ausgegeben wird — und du
          steuerst mit 8 Schiebereglern, wohin das Geld fliesst.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-budget.gif" alt="BudgetPanel in BünzliFight" label="Budget & Steuern" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Einnahmen</h2>
          <p>
            Die Gemeinde finanziert sich primär durch Steuern. Je mehr Einwohner, Gewerbe
            und Industrie du hast, desto mehr fliesst täglich in die Gemeindekasse:
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-cyan-400 shrink-0">—</span><span><strong className="text-white">Einkommenssteuer:</strong> Anteil vom Einkommen jedes Einwohners</span></li>
            <li className="flex gap-2"><span className="text-cyan-400 shrink-0">—</span><span><strong className="text-white">Gewerbesteuer:</strong> Abgaben von Geschäften und Büros</span></li>
            <li className="flex gap-2"><span className="text-cyan-400 shrink-0">—</span><span><strong className="text-white">Liegenschaftssteuer:</strong> Steuer auf bebaute Grundstücke</span></li>
            <li className="flex gap-2"><span className="text-cyan-400 shrink-0">—</span><span><strong className="text-white">Gebäudeerträge:</strong> Direkte Einnahmen aus Gemeindegebäuden</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Die 8 Ausgaben-Kategorien</h2>
          <p>
            Mit jedem Schieberegler legst du fest, wie viel Prozent des Budgets eine
            Abteilung erhält. Ein höheres Budget verbessert den Service und steigert die
            Bevölkerungszufriedenheit — zu wenig Geld führt dagegen zu Problemen:
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ['Polizei', 'Niedrig → mehr Kriminalität, Einbrüche'],
              ['Feuerwehr', 'Niedrig → Brandgefahr steigt, Schäden teurer'],
              ['Gesundheit', 'Niedrig → Krankheiten, geringere Lebenserwartung'],
              ['Bildung', 'Niedrig → weniger qualifizierte Einwohner'],
              ['Transport', 'Niedrig → Stau, Pendler unzufrieden'],
              ['Parks', 'Niedrig → Lebensqualität sinkt'],
              ['Strom', 'Niedrig → Stromausfälle in Teilen der Stadt'],
              ['Wasser', 'Niedrig → Versorgungsengpässe'],
            ].map(([cat, warn]) => (
              <div key={cat} className="rounded-sm border border-white/8 bg-black/20 px-3 py-2">
                <p className="text-white font-medium text-xs">{cat}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">{warn}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Tagesabschluss</h2>
          <p>
            Der Server berechnet alle 3 Sekunden den aktuellen Stand. Im Budget-Panel
            siehst du oben rechts das tägliche Netto — also Einnahmen minus Ausgaben.
            Ein positives Netto füllt das Gemeinde-Kassenreservat, ein negatives leert es.
            Läuft die Kasse leer, können keine neuen Gebäude mehr gebaut werden.
          </p>
        </section>

        <section className="rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
          <h3 className="text-cyan-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Setze Polizei, Feuerwehr und Gesundheit nie unter 60 %. Diese drei Bereiche
            haben die grössten Auswirkungen auf die Zufriedenheit und verhindern kostspielige
            Katastrophen-Events.
          </p>
        </section>
      </div>

      <GuidePrevNext current="/quick-guide/budget-finanzen" />
    </article>
  );
}
