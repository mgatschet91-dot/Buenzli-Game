/**
 * Gebäude- und Upgrade-Preise
 *
 * Wird EINMALIG beim Game-Start geladen (/_data/item-prices.json, statische Datei
 * die der Server beim Start aus der DB generiert). Danach nur im Arbeitsspeicher —
 * kein LocalStorage, kein Cache-Header-Problem.
 *
 * Verwendung:
 *   await initItemPrices();          // einmal beim Mount (Game.tsx)
 *   getBuildCost('power_plant')      // → 3000
 *   getUpgradeTimeSecs('hospital')   // → 14400
 */

export interface ItemPriceEntry {
  build_cost: number;
  upgrade_time_secs: number | null;
}

// Modul-Level Variable — lebt für die gesamte Browser-Session
let priceMap: Record<string, ItemPriceEntry> = {};
let loaded = false;

/** Preise einmalig laden. Weitere Aufrufe werden ignoriert. */
export async function initItemPrices(): Promise<void> {
  if (loaded) return;
  try {
    const res = await fetch('/_data/item-prices.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      priceMap = data as Record<string, ItemPriceEntry>;
    }
    loaded = true;
  } catch (err) {
    // Kein Hard-Fail — Preise sind nur für UI-Anzeige, Server validiert ohnehin
    console.warn('[itemPrices] Konnte Preisliste nicht laden:', err);
    loaded = true; // nicht nochmal versuchen
  }
}

/** Baukosten für ein Tool in CHF (0 wenn unbekannt) */
export function getBuildCost(tool: string): number {
  return priceMap[tool]?.build_cost ?? 0;
}

/** Upgrade-Dauer in Sekunden (null wenn kein Upgrade möglich) */
export function getUpgradeTimeSecs(tool: string): number | null {
  return priceMap[tool]?.upgrade_time_secs ?? null;
}

/** Gibt den gesamten Preiskatalog zurück */
export function getAllPrices(): Record<string, ItemPriceEntry> {
  return priceMap;
}

/** Ist die Preisliste schon geladen? */
export function isPricesLoaded(): boolean {
  return loaded;
}
