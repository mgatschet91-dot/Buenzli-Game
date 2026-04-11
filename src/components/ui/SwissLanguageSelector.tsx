'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LANDING_LOCALES, type LandingLocale } from '@/lib/i18n/landingTranslations';

interface SwissLanguageSelectorProps {
  locale: LandingLocale;
  onLocaleChange: (locale: LandingLocale) => void;
}

export function SwissLanguageSelector({ locale, onLocaleChange }: SwissLanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Klick außerhalb schließt das Dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = LANDING_LOCALES.find((l) => l.code === locale) ?? LANDING_LOCALES[0];

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/15 bg-black/30 backdrop-blur-sm text-white/80 hover:text-white hover:border-amber-300/40 hover:bg-black/50 transition-all text-xs"
        aria-label="Sprache wählen"
      >
        <span className="text-sm">{current.flag}</span>
        <span className="hidden sm:inline font-medium tracking-wide">{current.label}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-white/15 bg-slate-950/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {LANDING_LOCALES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                onLocaleChange(lang.code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                lang.code === locale
                  ? 'bg-amber-300/15 text-amber-200'
                  : 'text-white/70 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="font-medium tracking-wide">{lang.label}</span>
              {lang.code === locale && (
                <svg className="w-3.5 h-3.5 ml-auto text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
