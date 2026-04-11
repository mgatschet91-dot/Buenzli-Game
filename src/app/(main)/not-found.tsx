import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden — BünzliFight',
  description: 'Die gesuchte Seite existiert nicht. Geh zurück zur BünzliFight-Startseite.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen hero-gradient flex flex-col items-center justify-center relative overflow-hidden p-6">

      {/* Zentrum */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-md text-center space-y-6">

          <div className="inline-block">
            <span
              className="text-[110px] font-black leading-none select-none"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #92400e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              404
            </span>
          </div>

          <div className="space-y-2 pt-4">
            <h1 className="text-2xl font-bold text-white">Seite nicht gefunden</h1>
            <p className="text-slate-200 text-sm leading-relaxed">
              Diese Seite existiert nicht oder wurde verschoben.<br />
              Vielleicht wurde der Link geändert — oder du hast dich vertippt.
            </p>
          </div>

          <div className="rounded-xl border border-amber-300/10 bg-black/20 px-5 py-4 text-left space-y-1.5">
            <p className="text-[10px] text-amber-200/40 font-semibold uppercase tracking-wider">Mögliche Ursachen</p>
            <ul className="text-sm text-slate-200 space-y-0.5 list-disc list-inside">
              <li>URL falsch eingetippt</li>
              <li>Gemeinde existiert nicht (mehr)</li>
              <li>Link ist veraltet</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-900 transition-colors"
            >
              🏠 Zur Startseite
            </Link>
            <Link
              href="/statistiken"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/20 hover:border-amber-300/40 px-6 py-2.5 text-sm font-medium text-amber-200/70 hover:text-amber-200 transition-colors"
            >
              📊 Statistiken
            </Link>
          </div>

        </div>
      </div>

      {/* Footer — gleich wie Index */}
      <div className="relative z-10 w-full pointer-events-none">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
      </div>
      <div className="relative z-10 text-center py-4 pointer-events-auto">
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40 mb-1">
          <Link href="/impressum" className="hover:text-amber-200/70 transition-colors">Impressum</Link>
          <span className="text-white/10">|</span>
          <Link href="/datenschutz" className="hover:text-amber-200/70 transition-colors">Datenschutz</Link>
          <span className="text-white/10">|</span>
          <Link href="/faq" className="hover:text-amber-200/70 transition-colors">FAQ</Link>
          <span className="text-white/10">|</span>
          <Link href="/quick-guide" className="hover:text-amber-200/70 transition-colors">Handbuch</Link>
        </div>
        <p className="text-muted-foreground/25 text-[10px]">BünzliFight &copy; 2026</p>
      </div>

    </main>
  );
}
