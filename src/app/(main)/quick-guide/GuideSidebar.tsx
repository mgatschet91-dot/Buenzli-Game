'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const GUIDE_NAV = [
  { label: 'Übersicht', href: '/quick-guide' },
  { label: 'Karte & Bauen', href: '/quick-guide/karte-bauen' },
  { label: 'Budget & Steuern', href: '/quick-guide/budget-finanzen' },
  { label: 'Firmen & Handel', href: '/quick-guide/firmen-wirtschaft' },
  { label: 'Gemeinde-Panel', href: '/quick-guide/gemeinde-panel' },
  { label: 'Sicherheit & NPCs', href: '/quick-guide/sicherheit-npcs' },
  { label: 'Statistiken', href: '/quick-guide/statistiken' },
  { label: 'Banking & Kredit', href: '/quick-guide/banking-kredit' },
  { label: 'Rangliste', href: '/quick-guide/rangliste' },
];

export function GuideSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col gap-1 w-52 shrink-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold px-3 mb-1">
          Kapitel
        </p>
        {GUIDE_NAV.map((item, i) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={`text-[10px] font-mono w-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile horizontal scroll nav */}
      <nav className="lg:hidden flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {GUIDE_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-200'
                  : 'text-slate-400 border border-white/10 hover:text-slate-200'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function GuidePrevNext({ current }: { current: string }) {
  const idx = GUIDE_NAV.findIndex((n) => n.href === current);
  const prev = idx > 0 ? GUIDE_NAV[idx - 1] : null;
  const next = idx < GUIDE_NAV.length - 1 ? GUIDE_NAV[idx + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-12 pt-6 border-t border-white/10">
      {prev ? (
        <Link
          href={prev.href}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-200 transition-colors group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>
            <span className="block text-[10px] text-slate-600 uppercase tracking-wider">Zurück</span>
            {prev.label}
          </span>
        </Link>
      ) : <div />}

      {next ? (
        <Link
          href={next.href}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-200 transition-colors group text-right"
        >
          <span>
            <span className="block text-[10px] text-slate-600 uppercase tracking-wider">Weiter</span>
            {next.label}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      ) : <div />}
    </div>
  );
}
