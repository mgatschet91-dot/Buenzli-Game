'use client';

import { useState, useCallback, useEffect } from 'react';
import { landingTranslations, type LandingLocale } from './landingTranslations';

const STORAGE_KEY = 'landing.locale';
const VALID_LOCALES = new Set<LandingLocale>(['de', 'gsw', 'fr', 'it', 'rm']);

export function useLandingLocale() {
  // Immer mit 'de' starten (SSR-sicher), dann per useEffect den gespeicherten Wert laden
  const [locale, setLocaleState] = useState<LandingLocale>('de');

  // Nach Hydration: localStorage-Wert einlesen
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LandingLocale | null;
    if (stored && VALID_LOCALES.has(stored)) {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((l: LandingLocale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string): string =>
      landingTranslations[locale]?.[key] ?? landingTranslations.de[key] ?? key,
    [locale],
  );

  return { locale, setLocale, t } as const;
}
