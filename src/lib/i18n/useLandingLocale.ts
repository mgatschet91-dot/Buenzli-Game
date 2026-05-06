'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSetLocale } from 'gt-next/client';
import { landingTranslations, type LandingLocale } from './landingTranslations';

const STORAGE_KEY = 'landing.locale';
const VALID_LOCALES = new Set<LandingLocale>(['de', 'gsw', 'en', 'fr', 'it']);

/** gsw zählt im Game-Client als Deutsch; alle anderen gehen 1:1 durch. */
function toAppLocale(l: LandingLocale): string {
  if (l === 'gsw') return 'de';
  return l;
}

/**
 * Eigener State mit localStorage-Persistenz — damit 'gsw' korrekt
 * gespeichert und auf der Hauptseite angezeigt wird, im Game-Client
 * aber als 'de' interpretiert wird.
 */
export function useLandingLocale() {
  const [locale, setLocaleState] = useState<LandingLocale>('de');
  const setGTLocale = useSetLocale();

  // Beim ersten Render aus localStorage lesen — kein setGTLocale hier,
  // damit gt-next keinen Reload triggert und eine Login-Schleife entsteht.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LandingLocale | null;
      if (stored && VALID_LOCALES.has(stored)) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage nicht verfügbar (SSR guard)
    }
  }, []);

  const setLocale = useCallback((l: LandingLocale) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
    setLocaleState(l);
    setGTLocale(toAppLocale(l)); // gsw → de für den Game-Client
  }, [setGTLocale]);

  const t = useCallback(
    (key: string): string =>
      landingTranslations[locale]?.[key] ?? landingTranslations.de[key] ?? key,
    [locale],
  );

  return { locale, setLocale, t } as const;
}
