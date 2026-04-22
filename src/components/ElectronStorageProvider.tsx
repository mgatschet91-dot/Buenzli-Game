'use client';

import { useElectronStorage } from '@/hooks/useElectronStorage';

/**
 * Aktiviert den localStorage ↔ gamesave.json Sync im Electron-Build.
 * Muss irgendwo im Client-Tree gerendert werden (z.B. im Root-Layout).
 */
export function ElectronStorageProvider() {
  useElectronStorage();
  return null;
}
