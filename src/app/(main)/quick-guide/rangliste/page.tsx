import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideMedia } from '../GuideMedia';
import { GuidePrevNext } from '../GuideSidebar';
import { breadcrumbSchema, articleSchema } from '../schema';

export const metadata: Metadata = {
  title: 'Rangliste & Wettbewerb – Gemeinden Schweiz Vergleich | BünzliFight',
  description:
    'Die Rangliste in BünzliFight: Vergleiche Spieler und Gemeinden nach XP, Bevölkerung und Zufriedenheit. So funktioniert das Punktesystem im Schweizer Simulator.',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
  { name: 'Rangliste', href: '/quick-guide/rangliste' },
];

export default function RanglistePage() {
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema({ title: 'Rangliste & Wettbewerb – Gemeinden Schweiz Vergleich', description: 'Spieler und Gemeinden nach XP, Bevölkerung und Zufriedenheit vergleichen im Schweizer Simulator.', slug: '/quick-guide/rangliste' })) }} />
      <header className="mb-8">
        <p className="text-rose-400/70 text-xs tracking-[0.3em] uppercase mb-2">Kapitel 07</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">Rangliste & Wettbewerb</h1>
        <div className="h-px w-16 bg-gradient-to-r from-rose-400/80 to-transparent mt-3" />
        <p className="mt-3 text-slate-300 text-sm leading-relaxed max-w-2xl">
          Das Ranglisten-Panel vergleicht alle aktiven Spieler und Gemeinden der Schweiz.
          Sieh wo du stehst, lerne von den Besten und arbeite daran, deine Gemeinde in die
          Top-10 zu bringen.
        </p>
      </header>

      <div className="mb-8 rounded-sm overflow-hidden border border-white/10">
        <GuideMedia src="/guide/guide-leaderboard.gif" alt="LeaderboardPanel in BünzliFight" label="Rangliste" />
      </div>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-2">Zwei Ranglisten</h2>
          <p>
            Das Panel hat zwei Tabs: eine für Spieler und eine für Gemeinden.
          </p>
          <ul className="mt-3 space-y-2 pl-4">
            <li className="flex gap-2">
              <span className="text-rose-400 shrink-0">—</span>
              <span>
                <strong className="text-white">Spieler-Rangliste:</strong> Sortiert nach Level
                und XP. Zeigt Nickname, zugehörige Gemeinde und Erfahrungspunkte. Je mehr du
                baust, verwaltest und Aufgaben erledigst, desto mehr XP erhältst du.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-rose-400 shrink-0">—</span>
              <span>
                <strong className="text-white">Gemeinde-Rangliste:</strong> Sortiert nach
                Bevölkerungsgrösse. Zeigt Gemeindename, Eigentümer, aktuelle Einwohnerzahl,
                Zufriedenheitsprozent und Gemeindekasse.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Top-3 Hervorhebung</h2>
          <p>
            Die ersten drei Plätze werden speziell hervorgehoben — Platz 1 in Gold,
            Platz 2 in Silber, Platz 3 in Bronze. Klicke auf einen Spieler-Eintrag,
            um sein Profil anzusehen.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Level-System</h2>
          <p>
            Dein persönliches Level steigt mit gesammelten Erfahrungspunkten. Die Level-Stufen
            werden mit zunehmendem Level schwieriger zu erreichen — die ersten Level gehen
            schnell, höhere Level erfordern konsequentes, langfristiges Spielen:
          </p>
          <ul className="mt-3 space-y-1.5 pl-4">
            {[
              ['Level 1 → 2', '30–90 Minuten aktives Spielen'],
              ['Level 2 → 3', '2–4 Stunden'],
              ['Level 3 → 4', '6–12 Stunden'],
              ['Level 4 → 5', '12–24 Stunden'],
            ].map(([lvl, time]) => (
              <li key={lvl} className="flex gap-2">
                <span className="text-rose-400 shrink-0">—</span>
                <span><strong className="text-white">{lvl}:</strong> {time}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-sm border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <h3 className="text-rose-200 font-semibold text-sm mb-1">Tipp</h3>
          <p className="text-sm text-slate-300">
            Die Gemeinde-Rangliste zeigt dir, welche Gemeinden besonders erfolgreich sind.
            Schau dir deren Handelspartnerliste an — erfolgreiche Gemeinden haben oft viele
            aktive Handelspartnerschaften, die passives Einkommen generieren.
          </p>
        </section>

        {/* Final CTA */}
        <div className="mt-8 text-center rounded-sm border border-white/10 bg-black/30 px-6 py-8">
          <p className="text-white font-semibold text-lg mb-2">Bereit, deine Gemeinde aufzubauen?</p>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            BünzliFight ist kostenlos spielbar — keine Installation, direkt im Browser.
            Registriere dich und starte noch heute.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold tracking-wide hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-900/30"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Jetzt kostenlos spielen
          </Link>
        </div>
      </div>

      <GuidePrevNext current="/quick-guide/rangliste" />
    </article>
  );
}
