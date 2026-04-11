import type { Metadata } from 'next';
import Link from 'next/link';
import { breadcrumbSchema, itemListSchema } from './schema';

export const metadata: Metadata = {
  title: 'BünzliFight Handbuch – Gemeinde Simulator Schweiz',
  description:
    'Lerne alles über BünzliFight: Karte bauen, Budget verwalten, Firmen gründen, Statistiken lesen und mit anderen Gemeinden handeln. Dein komplettes Spielhandbuch.',
  openGraph: {
    title: 'BünzliFight Handbuch – Gemeinde Simulator Schweiz',
    description: 'Der vollständige Guide für den kostenlosen Schweizer City-Builder-Simulator.',
  },
};

const CHAPTERS = [
  {
    num: '01',
    label: 'Karte & Bauen',
    href: '/quick-guide/karte-bauen',
    desc: 'Zonen platzieren, Strassen bauen, Gebäude errichten — die isometrische Karte erkunden.',
    color: 'emerald',
  },
  {
    num: '02',
    label: 'Budget & Steuern',
    href: '/quick-guide/budget-finanzen',
    desc: 'Steuereinnahmen optimieren und die 8 Ausgaben-Kategorien mit Schiebereglern steuern.',
    color: 'cyan',
  },
  {
    num: '03',
    label: 'Firmen & Handel',
    href: '/quick-guide/firmen-wirtschaft',
    desc: 'Eigene Firmen gründen, Aufträge annehmen und mit Nachbargemeinden handeln.',
    color: 'amber',
  },
  {
    num: '04',
    label: 'Gemeinde-Panel',
    href: '/quick-guide/gemeinde-panel',
    desc: 'Mitglieder verwalten, Rollen vergeben und die Gemeinde-Übersicht im Blick behalten.',
    color: 'violet',
  },
  {
    num: '05',
    label: 'Statistiken',
    href: '/quick-guide/statistiken',
    desc: 'Bevölkerung, Zufriedenheit und Finanzen über 90 Tage in interaktiven Graphen verfolgen.',
    color: 'sky',
  },
  {
    num: '06',
    label: 'Banking & Kredit',
    href: '/quick-guide/banking-kredit',
    desc: 'Persönliches Bankkonto, Transaktionshistorie und Kreditaufnahme für deine Gemeinde.',
    color: 'teal',
  },
  {
    num: '07',
    label: 'Rangliste',
    href: '/quick-guide/rangliste',
    desc: 'Vergleiche dich mit anderen Spielern und Gemeinden der ganzen Schweiz.',
    color: 'rose',
  },
];

const colorMap: Record<string, string> = {
  emerald: 'border-emerald-500/30 hover:border-emerald-400/50 hover:bg-emerald-500/5',
  cyan: 'border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5',
  amber: 'border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-500/5',
  violet: 'border-violet-500/30 hover:border-violet-400/50 hover:bg-violet-500/5',
  sky: 'border-sky-500/30 hover:border-sky-400/50 hover:bg-sky-500/5',
  teal: 'border-teal-500/30 hover:border-teal-400/50 hover:bg-teal-500/5',
  rose: 'border-rose-500/30 hover:border-rose-400/50 hover:bg-rose-500/5',
};

const numColorMap: Record<string, string> = {
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
  sky: 'text-sky-400',
  teal: 'text-teal-400',
  rose: 'text-rose-400',
};

const BREADCRUMB = [
  { name: 'Home', href: '/' },
  { name: 'Handbuch', href: '/quick-guide' },
];

const CHAPTER_LIST = CHAPTERS.map((c) => ({ name: c.label, href: c.href }));

export default function QuickGuidePage() {
  return (
    <div>
      {/* Header */}
      <header className="mb-10">
        <p className="text-emerald-400/80 text-xs tracking-[0.3em] uppercase mb-3">Handbuch</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
          Willkommen im BünzliFight Handbuch
        </h1>
        <div className="h-px w-20 bg-gradient-to-r from-emerald-400/80 to-transparent mt-4" />
        <p className="mt-4 text-slate-300 text-sm leading-relaxed max-w-2xl">
          BünzliFight ist ein kostenloser, browserbasierter Schweizer City-Builder mit
          Echtzeit-Multiplayer. Dieses Handbuch erklärt alle wichtigen Features Schritt für
          Schritt — von der isometrischen Karte über das Budget-System bis hin zu Firmen,
          Handel und der Rangliste.
        </p>
      </header>

      {/* Demo badge */}
      <div className="rounded-sm border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 mb-10">
        <p className="text-emerald-100 text-sm">
          BünzliFight befindet sich in der{' '}
          <span className="font-bold text-white">offenen Demo-Phase</span> — alle Features sind
          kostenlos spielbar, keine Installation nötig.
        </p>
      </div>

      {/* Chapter grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CHAPTERS.map((ch) => (
          <Link
            key={ch.href}
            href={ch.href}
            className={`group block rounded-sm border bg-black/30 backdrop-blur-sm p-5 transition-all duration-200 ${colorMap[ch.color]}`}
          >
            <div className="flex items-start gap-4">
              <span className={`font-mono text-2xl font-bold leading-none mt-0.5 ${numColorMap[ch.color]}`}>
                {ch.num}
              </span>
              <div>
                <h2 className="text-white font-semibold text-base group-hover:text-amber-100 transition-colors">
                  {ch.label}
                </h2>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{ch.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(BREADCRUMB)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema(CHAPTER_LIST)) }} />

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="text-slate-400 text-sm mb-4">Bereit, deine Gemeinde aufzubauen?</p>
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
  );
}
