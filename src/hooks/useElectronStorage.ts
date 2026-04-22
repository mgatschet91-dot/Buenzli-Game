'use client';

import { useEffect } from 'react';

const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';
const SYNC_INTERVAL_MS = 8000; // alle 8s in Datei schreiben

// Schlüssel die NICHT gespeichert werden sollen
const SKIP_KEYS = new Set([
  'debug',
  'loglevel',
]);

function getAllLocalStorage(): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || SKIP_KEYS.has(key)) continue;
    const val = localStorage.getItem(key);
    if (val !== null) data[key] = val;
  }
  return data;
}

async function syncToFile() {
  if (!window.electronStore) return;
  try {
    await window.electronStore.bulkSave(getAllLocalStorage());
  } catch {}
}

/**
 * Beim Start: gamesave.json → localStorage laden
 * Danach:     localStorage → gamesave.json alle 8s + beim Schliessen
 */
export function useElectronStorage() {
  useEffect(() => {
    if (!IS_ELECTRON || typeof window === 'undefined' || !window.electronStore) return;

    // ── 1. Datei beim Start laden ──────────────────
    window.electronStore.getAll().then(saved => {
      Object.entries(saved).forEach(([key, val]) => {
        // Nur setzen wenn localStorage-Wert fehlt (nicht überschreiben)
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, val);
        }
      });
      console.log('[Storage] gamesave.json geladen →', Object.keys(saved).length, 'Einträge');
    }).catch(() => {});

    // ── 2. Periodisch speichern ────────────────────
    const interval = setInterval(syncToFile, SYNC_INTERVAL_MS);

    // ── 3. Beim Schliessen sofort speichern ────────
    const handleBeforeUnload = () => { syncToFile(); };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
