import type { Metadata } from 'next';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Gemeinde-Panel – Gemeindeverwaltung in BünzliFight',
  description:
    'Das Gemeinde-Panel erklärt: Mitglieder verwalten, Rollen vergeben, Finanzen überwachen und als Gemeindepräsident die Geschicke deiner Schweizer Gemeinde lenken.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Gemeinde-Panel', href: '/quick-guide/gemeinde-panel' },
];

export default function GemeindePanelPage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Gemeinde-Panel – Gemeindeverwaltung in BünzliFight', description: 'Mitglieder verwalten, Rollen vergeben und als Gemeindepräsident die Gemeinde lenken.', slug: '/quick-guide/gemeinde-panel' })) }} />
      <header className="mb-8">
        <p className="text-violet-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 04</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Gemeinde-Panel</h1>
        <div className="h-px w-16 bg-gradient-to-r from-violet-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Das Gemeinde-Panel ist das Verwaltungszentrum deiner Stadt. Hier behältst du den
          Überblick über Mitglieder, Rollen und den Gesamtzustand der Gemeinde — und
          kannst als Gemeindepräsident wichtige Entscheidungen treffen.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-gemeinde.gif" alt="GemeindePanel in BünzliFight" label="Gemeinde-Panel" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Mitglieder & Rollen</h2>
          <p>
            Jede Gemeinde kann bis zu 25 Spieler aufnehmen. Als Gemeindepräsident kannst du
            Beitrittsanfragen annehmen oder ablehnen und jedem Mitglied eine Rolle zuweisen:
          </p>
          <ul className="mt-3 space-y-2 pl-4">
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">—</span>
              <span><strong className="text-white">Gemeindepräsident:</strong> Vollzugriff. Kann Budget ändern, Mitglieder verwalten und alle Panels nutzen. Nur ein Spieler pro Gemeinde.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-400 shrink-0">—</span>
              <span><strong className="text-white">Gemeinderat:</strong> Zugriff auf Budget und Verwaltungsfunktionen. Kann Budget anpassen, aber keine Mitglieder entfernen.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">—</span>
              <span><strong className="text-white">Bürger:</strong> Kann bauen und Firmen gründen, hat aber keinen Zugriff auf das Gemeinde-Budget.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-500 shrink-0">—</span>
              <span><strong className="text-white">Beobachter:</strong> Kann die Gemeinde besichtigen und im Chat schreiben, aber nichts verändern.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Gemeinde-Übersicht</h2>
          <p>
            Oben im Panel siehst du die wichtigsten Kennzahlen deiner Gemeinde auf einen Blick:
            aktuelle Bevölkerungszahl, Gesamtzufriedenheit, Gemeindekasse und den täglichen
            Nettoertrag. Diese Zahlen aktualisieren sich alle 3 Sekunden in Echtzeit.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Eigene Gemeinde gründen</h2>
          <p>
            Du kannst entweder einer bestehenden Gemeinde beitreten oder deine eigene
            gründen. Bei einer eigenen Gemeinde wählst du den Namen, das Wappen und den
            Startort auf der Schweizer Karte. Du bist automatisch Gemeindepräsident und
            kannst andere Spieler einladen.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Services & Gebäude reparieren</h2>
          <p>
            Im Gemeinde-Panel siehst du den Zustand aller öffentlichen Gebäude. Beschädigte
            oder überlastete Einrichtungen können direkt von hier aus repariert oder
            aufgerüstet werden — sofern das Budget es erlaubt.
          </p>
        </section>

        <section className="rounded-sm border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <h3 className="text-violet-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Vergib die Rolle «Gemeinderat» an aktive Mitspieler — so können mehrere Personen
            gleichzeitig das Budget anpassen und auf Ereignisse reagieren, ohne dass du
            immer online sein musst.
          </p>
        </section>
      </div>

      <GuidePrevNext current="/quick-guide/gemeinde-panel" />
    </article>
  );
}
