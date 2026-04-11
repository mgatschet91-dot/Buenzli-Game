import type { Metadata } from 'next';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Sicherheit & NPCs – Kriminalität und Notfalldienste | BünzliFight',
  description:
    'Wie Kriminalität, Polizeijagden, Obdachlose und Notfallfahrzeuge in BünzliFight funktionieren.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Sicherheit & NPCs', href: '/quick-guide/sicherheit-npcs' },
];

export default function SicherheitNpcsPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Sicherheit & NPCs', description: 'Kriminalität, Polizeijagden und Notfallfahrzeuge in BünzliFight.', slug: '/quick-guide/sicherheit-npcs' })) }} />
      <header className="mb-8">
        <p className="text-red-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 05</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Sicherheit & NPCs</h1>
        <div className="h-px w-16 bg-gradient-to-r from-red-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Deine Gemeinde lebt — Kriminelle treiben ihr Unwesen, Notfallfahrzeuge rasen durch
          die Strassen, und Obdachlose suchen einen Platz. Alles läuft automatisch im Hintergrund ab.
        </p>
      </header>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Kriminalität</h2>
          <p>
            Auf der Karte spawnen regelmässig <strong className="text-white">Kriminelle NPCs</strong> — erkennbar
            an kleinen Figuren mit Tooltip beim Hovern. Es gibt zwei Typen:
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-red-400 shrink-0">—</span><span><strong className="text-white">Gangster:</strong> Brechen nachts in Gebäude ein, verursachen Schaden an der Gemeindekasse</span></li>
            <li className="flex gap-2"><span className="text-orange-400 shrink-0">—</span><span><strong className="text-white">Dealer:</strong> Treibt sich tagsüber herum, verursacht keinen direkten Schaden</span></li>
          </ul>
          <p className="mt-2">
            Nach ca. 12 Sekunden schickt die Polizeistation automatisch ein Fahrzeug zur Jagd.
            Wird der Kriminelle erwischt, bekommt die Gemeinde eine kleine Belohnung.
            Hat die Gemeinde keine Polizeistation — oder ist sie zu weit entfernt — entkommen Kriminelle ungestört.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Notfallfahrzeuge</h2>
          <p>
            Verschiedene Fahrzeuge reagieren automatisch auf Ereignisse in der Stadt:
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            <li className="flex gap-2"><span className="text-blue-400 shrink-0">—</span><span><strong className="text-white">🚓 Polizeiauto:</strong> Jagt Kriminelle ab der Polizeistation</span></li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">—</span><span><strong className="text-white">🚒 Feuerwehr:</strong> Rückt bei Bränden aus</span></li>
            <li className="flex gap-2"><span className="text-white shrink-0">—</span><span><strong className="text-white">🚑 Ambulanz:</strong> Reagiert auf medizinische Ereignisse</span></li>
            <li className="flex gap-2"><span className="text-amber-400 shrink-0">—</span><span><strong className="text-white">🚛 Werkhof-LKW:</strong> Fährt zu beschädigten Gebäuden wenn die Stadtpatrouille aktiv ist</span></li>
          </ul>
          <p className="mt-2">
            Fahrzeuge folgen dem Strassennetz — ohne verbundene Strassen können sie ihr Ziel nicht erreichen.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Obdachlose</h2>
          <p>
            Bei hoher Armut oder schlechter Versorgung tauchen <strong className="text-white">Obdachlose NPCs</strong> auf
            der Karte auf. Sie sind rein visuell — hover über sie für einen Tooltip. Mehr
            Sozialeinrichtungen und eine bessere Wirtschaft reduzieren ihre Anzahl.
          </p>
        </section>

        <section className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3">
          <h3 className="text-red-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Baue Polizeistationen gut verteilt über die Karte — je näher an Wohn- und Gewerbezonen,
            desto schneller reagieren sie auf Einbrüche und desto weniger Schaden entsteht.
          </p>
        </section>

      </div>

      <GuidePrevNext current="/quick-guide/sicherheit-npcs" />
    </article>
  );
}
