import type { Metadata } from 'next';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Firmen gründen & Handel – Wirtschaft in BünzliFight',
  description:
    'So gründest du Firmen, nimmst Gemeindeaufträge an und handelst mit Nachbargemeinden in BünzliFight. Alles über das Wirtschaftssystem des Schweizer Simulators.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Firmen & Handel', href: '/quick-guide/firmen-wirtschaft' },
];

export default function FirmenWirtschaftPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Firmen gründen & Handel – Wirtschaft in BünzliFight', description: 'So gründest du Firmen, nimmst Gemeindeaufträge an und handelst mit Nachbargemeinden im Schweizer Gemeinde Simulator.', slug: '/quick-guide/firmen-wirtschaft' })) }} />
      <header className="mb-8">
        <p className="text-amber-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 03</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Firmen & Handel</h1>
        <div className="h-px w-16 bg-gradient-to-r from-amber-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Neben der Gemeindeverwaltung gibt es eine zweite Wirtschaftsebene: Spieler können
          eigene Firmen gründen, Aufträge der Gemeindeverwaltung annehmen und mit
          Nachbargemeinden Handelspartnerschaften eingehen.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-economy.gif" alt="Firmen und Handel in BünzliFight" label="Firmen & Handel" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Firma gründen</h2>
          <p>
            Im Firmen-Panel kannst du mit einem Klick eine eigene Firma gründen. Die
            Gründungskosten werden von deinem <strong className="text-white">persönlichen
            Bankkonto</strong> abgebucht — nicht aus der Gemeindekasse. Du wählst einen
            Firmentyp und -namen, danach gehörst du automatisch als Eigentümer dazu.
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">Eigentümer:</strong> Vollzugriff, kann die Firma auflösen</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">Manager:</strong> Kann Mitglieder verwalten und Verträge abschliessen</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">Mitarbeiter:</strong> Kann Aufgaben erledigen und Lohn beziehen</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Gemeindeaufträge</h2>
          <p>
            Die Gemeindeverwaltung schreibt regelmässig Aufträge aus — zum Beispiel das
            Beheben von Infrastrukturproblemen, das Verwalten von Busstrecken oder
            administrative Aufgaben. Deine Firma kann diese Aufträge annehmen, erfüllen
            und erhält dafür eine Vergütung, die direkt in die Firmenkasse fliesst.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Firmenkredite</h2>
          <p>
            Benötigt deine Firma Startkapital? Im Firmen-Panel kannst du einen Kredit bei
            der Gemeinde beantragen. Die Gemeindekasse finanziert den Kredit, und deine
            Firma tilgt ihn wöchentlich mit Zinsen. Achte darauf, genug Einnahmen zu
            generieren, um die Rückzahlung zu sichern.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Handel mit Nachbargemeinden</h2>
          <p>
            Im Trade-Panel siehst du alle verfügbaren Gemeinden der Schweiz. Sende
            Handelsanfragen an Nachbargemeinden und baue Partnerschaften auf. Jede aktive
            Partnerschaft generiert täglich passives Handelseinkommen für beide Seiten.
            Du kannst auch Partnergemeinden besuchen und ihre Karten erkunden.
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>Entdeckte Gemeinden: sichtbar, aber noch kein Handel</span></li>
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">—</span><span>Anfrage gesendet: warte auf Bestätigung der anderen Seite</span></li>
            <li className="flex gap-2"><span className="text-emerald-400 shrink-0">—</span><span>Verbunden: aktive Partnerschaft, tägliche +200 CHF Einnahmen</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">NPC-Mitarbeiter</h2>
          <p>
            Im <strong className="text-white">NPCs-Tab</strong> deiner Firma kannst du Mitarbeiter einstellen, die Aufträge
            automatisch übernehmen — auch wenn du offline bist. Es gibt drei Typen:
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong className="text-white">Hilfsarbeiter:</strong> Günstig, niedrige Effizienz</span></li>
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">—</span><span><strong className="text-white">Facharbeiter:</strong> Mittlere Kosten, gute Leistung</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">Manager:</strong> Teuer, höchste Effizienz</span></li>
          </ul>
          <p className="mt-2">
            NPCs verdienen XP mit jedem abgeschlossenen Auftrag und steigen in Level auf — je
            höher das Level, desto schneller erledigen sie Aufgaben.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Werkhof & Stadtpatrouille</h2>
          <p>
            Der <strong className="text-white">Gemeindewerkhof</strong> ist eine spezielle Firma.
            Im NPCs-Tab kannst du einen Mitarbeiter per 🔧-Knopf zur <strong className="text-white">Stadtpatrouille</strong> ernennen.
            Dieser NPC fährt dann automatisch von Gebäude zu Gebäude und stellt den
            Gebäudezustand wieder her — auch wenn du nicht online bist.
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span>Repariert Gebäude unter 90% Zustand alle ~10 Minuten</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span>Nur tagsüber aktiv (07:00–22:00 Uhr)</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span>Kosten werden aus der Gemeindekasse abgebucht</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span>NPC verdient XP pro Reparatur</span></li>
          </ul>
        </section>

        <section className="rounded-sm border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <h3 className="text-amber-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Gründe möglichst früh eine Firma und nimm erste Gemeindeaufträge an. Das gibt
            dir ein eigenes Einkommen unabhängig vom Gemeindebudget — und du kannst
            Gewinne später reinvestieren oder Mitstreiter einladen.
          </p>
        </section>
      </div>

      <GuidePrevNext current="/quick-guide/firmen-wirtschaft" />
    </article>
  );
}
