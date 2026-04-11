'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_CORE_API_URL || 'http://127.0.0.1:4100';
    fetch(`${apiBase}/api/admin/frontend-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message || String(error),
        stack: error?.stack || null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        browser: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="min-h-screen hero-gradient flex flex-col items-center justify-center relative overflow-hidden p-6">

      {/* Zentrum */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-md text-center space-y-6">

          <div className="inline-block">
            <span
              className="text-[110px] font-black leading-none select-none"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #7f1d1d 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              500
            </span>
          </div>

          <div className="space-y-2 pt-4">
            <h1 className="text-2xl font-bold text-white">Serverfehler</h1>
            <p className="text-slate-200 text-sm leading-relaxed">
              Da ist etwas schiefgelaufen. Wir wurden automatisch benachrichtigt
              und schauen uns das so schnell wie möglich an.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && error?.message && (
            <div className="rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-3 text-left">
              <p className="text-[10px] text-red-400/60 font-semibold uppercase tracking-wider mb-1">Fehlerdetail (dev)</p>
              <p className="font-mono text-xs text-red-300 break-all">{error.message}</p>
            </div>
          )}

          {error?.digest && (
            <p className="text-[11px] text-muted-foreground/30 font-mono">ID: {error.digest}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-900 transition-colors"
            >
              🔄 Erneut versuchen
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/20 hover:border-amber-300/40 px-6 py-2.5 text-sm font-medium text-amber-200/70 hover:text-amber-200 transition-colors"
            >
              🏠 Zur Startseite
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
