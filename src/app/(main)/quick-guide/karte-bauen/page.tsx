import type { Metadata } from 'next';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Karte & Bauen – Zonen im Schweizer Gemeinde Simulator | BünzliFight',
  description:
    'Lerne, wie du in BünzliFight Zonen platzierst, Strassen baust und Gebäude auf der isometrischen Karte errichtest. Schritt-für-Schritt Bauanleitung.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Karte & Bauen', href: '/quick-guide/karte-bauen' },
];

export default function KarteBauenPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Karte & Bauen – Zonen im Schweizer Gemeinde Simulator', description: 'Lerne, wie du in BünzliFight Zonen platzierst, Strassen baust und Gebäude auf der isometrischen Karte errichtest.', slug: '/quick-guide/karte-bauen' })) }} />
      <header className="mb-8">
        <p className="text-emerald-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 01</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Karte & Bauen</h1>
        <div className="h-px w-16 bg-gradient-to-r from-emerald-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Das Herzstück von BünzliFight ist die isometrische Karte. Hier baust du deine
          Schweizer Gemeinde auf — von den ersten Wohnzonen bis zur voll ausgebauten Stadt
          mit Industrie, Schienen und öffentlichen Einrichtungen.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-map.gif" alt="Karte und Bautools in BünzliFight" label="Karte & Bauen" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Die isometrische Ansicht</h2>
          <p>
            Die Karte zeigt deine Gemeinde in einer isometrischen 3D-Perspektive. Du kannst mit
            dem Mausrad zoomen, per Drag scrollen und auf einzelne Felder klicken, um Gebäude
            zu platzieren oder Informationen abzurufen. Alle Gebäude sind als detaillierte
            Pixel-Sprites dargestellt — inspiriert von klassischen Schweizer Architekturstilen.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Zonen platzieren</h2>
          <p>
            Das Fundament jeder Gemeinde sind die drei Zonentypen. Wähle ein Zonen-Tool
            aus der Toolbar und klicke auf ein freies Feld der Karte:
          </p>
          <ul className="mt-3 space-y-2 pl-4">
            <li className="flex gap-2"><span className="text-emerald-400 shrink-0">—</span><span><strong className="text-white">Wohnzone (R):</strong> Bevölkerung wächst hier. Je mehr Wohnzonen, desto mehr Einwohner und Steuereinnahmen.</span></li>
            <li className="flex gap-2"><span className="text-cyan-400 shrink-0">—</span><span><strong className="text-white">Gewerbezone (C):</strong> Läden, Büros und Dienstleistungen. Schafft Arbeitsplätze und erhöht die Gemeindeeinnahmen.</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">Industriezone (I):</strong> Fabriken und Produktion. Hohe Einnahmen, aber auch höheres Lärmaufkommen und Verschmutzung.</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Strassen & Infrastruktur</h2>
          <p>
            Zonen müssen mit dem Strassennetz verbunden sein, damit sie wachsen können.
            Baue Strassen zwischen den Zonen und verbinde sie mit dem bestehenden Netz.
            Schienen ermöglichen später den Personennahverkehr und erhöhen die Attraktivität
            angrenzender Bereiche deutlich.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Öffentliche Gebäude & Services</h2>
          <p>
            Eine Gemeinde braucht mehr als Wohnhäuser. Platziere öffentliche Einrichtungen,
            um die Zufriedenheit deiner Bevölkerung zu steigern:
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            {[
              ['Polizeistation', 'Senkt Kriminalität, erhöht Sicherheitsgefühl'],
              ['Feuerwehr', 'Verhindert Brandkatastrophen und schützt Gebäude'],
              ['Spital / Klinik', 'Verbessert Gesundheit und Lebenserwartung'],
              ['Schule / Universität', 'Erhöht Bildungsniveau und Einwohnerzufriedenheit'],
              ['Park / Grünfläche', 'Steigert Attraktivität umliegender Zonen'],
              ['Kraftwerk', 'Versorgt die Gemeinde mit Strom'],
              ['Wasserwerk', 'Sichert die Trinkwasserversorgung'],
            ].map(([name, desc]) => (
              <li key={name} className="flex gap-2">
                <span className="text-slate-500 shrink-0">—</span>
                <span><strong className="text-white">{name}:</strong> {desc}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Gebäude-Info & Zustand</h2>
          <p>
            Klicke auf ein beliebiges Gebäude auf der Karte, um das <strong className="text-white">Info-Panel</strong> zu öffnen.
            Dort siehst du Bevölkerung, Jobs, Wasserverbrauch, Verschmutzung und den aktuellen
            <strong className="text-white"> Gebäudezustand (Leben)</strong>. Mit der Zeit sinkt der Zustand — Gebäude
            unter 90% erscheinen in der Werkhof-Reparaturliste.
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-emerald-400 shrink-0">—</span><span><strong className="text-white">🔧 Selbst reparieren:</strong> Kostet 50% der Baukosten, stellt sofort wieder her</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">🤖 Bot repariert automatisch:</strong> Erscheint wenn eine Stadtpatrouille aktiv ist</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Gebäude-Upgrades</h2>
          <p>
            Viele Gebäude können auf bis zu <strong className="text-white">Level 5</strong> aufgewertet werden.
            Das Upgrade läuft automatisch im Hintergrund ab — du siehst den Fortschritt direkt
            auf dem Gebäude. Höhere Level bedeuten mehr Kapazität, mehr Einwohner oder bessere Services.
          </p>
        </section>

        <section className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <h3 className="text-emerald-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Baue Wohnzonen immer in der Nähe von Parks und weg von Industriezonen.
            Zufriedene Einwohner zahlen mehr Steuern und die Bevölkerung wächst schneller.
          </p>
        </section>
      </div>

      <GuidePrevNext current="/quick-guide/karte-bauen" />
    </article>
  );
}
