'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'isocity-cookie-consent';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith('/steam') || window.location.pathname.startsWith('/isometric')) return;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored || Date.now() - Number(stored) > THIRTY_DAYS_MS) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-[slideUp_0.4s_ease-out]">
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="rounded-sm border border-amber-400/30 bg-slate-950/95 backdrop-blur-sm px-5 py-4 shadow-[0_-4px_30px_rgba(0,0,0,0.4)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-amber-200 text-sm font-medium">
              Cookies &amp; Datenschutz
            </p>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              BünzliFight verwendet keine Tracking-Cookies. Nur technisch notwendige Daten (Login-Token) werden lokal gespeichert.{' '}
              <Link
                href="/datenschutz"
                className="text-amber-200/70 hover:text-amber-100 underline underline-offset-2 transition-colors"
              >
                Mehr erfahren
              </Link>
            </p>
          </div>
          <button
            onClick={handleAccept}
            className="shrink-0 rounded-sm bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 px-5 py-2 text-amber-200 text-sm font-medium transition-colors cursor-pointer"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
