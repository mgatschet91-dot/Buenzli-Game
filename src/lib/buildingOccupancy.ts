/**
 * Dynamische Gebäude-Belegung (Occupancy)
 *
 * Berechnet wie voll ein Gebäude tatsächlich belegt ist —
 * basierend auf Tile-Position (deterministisch), Grundstückswert,
 * Glück der Stadt und Versorgungsstatus.
 *
 * Alle Funktionen sind rein (pure) und haben keine Side Effects.
 */

import { BUILDING_STATS } from '@/games/isocity/types/buildings';
import type { BuildingType } from '@/types/game';

// ---------------------------------------------------------------------------
// Deterministisches Tile-Noise (positionsbasiert, stabil über Neuladen)
// ---------------------------------------------------------------------------

/**
 * Gibt einen stabilen Pseudo-Zufallswert [0, 1) für eine Tile-Position zurück.
 * Gleiche Koordinaten → immer gleicher Wert. Kein Math.random().
 */
export function tileNoise(x: number, y: number): number {
  let h = (((x * 374761393) + (y * 1073741827)) >>> 0);
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

// ---------------------------------------------------------------------------
// Occupancy-Rate berechnen
// ---------------------------------------------------------------------------

/**
 * Berechnet die Belegungsrate eines fertig gebauten Gebäudes.
 *
 * Faktoren:
 *  • Positional Noise  → jedes Gebäude ist etwas anders (stabil, deterministisch)
 *  • Land Value        → teure Lagen ziehen mehr Bewohner an
 *  • Happiness         → unglückliche Stadt verliert Einwohner
 *  • Power + Water     → fehlende Versorgung reduziert Belegung stark
 *
 * @returns Wert zwischen ~0.15 (katastrophal) und 1.0 (perfekt)
 */
export function calcOccupancyRate(
  x: number,
  y: number,
  landValue: number,
  happiness: number,
  powered: boolean,
  watered: boolean,
): number {
  // Basis-Noise: deterministisch, Range [0.55, 1.00]
  const noise = 0.55 + tileNoise(x, y) * 0.45;

  // Grundstückswert-Faktor: LV 0 → 0.60x, LV 50 → 0.88x, LV 100+ → 1.05x
  // Schlechte Lage zieht weniger Leute an, gute Lage etwas mehr.
  const lvClamped = Math.max(0, Math.min(200, landValue));
  const landValueFactor = 0.60 + (lvClamped / 150) * 0.45;

  // Happiness-Faktor: 20 → 0.72x, 50 → 0.87x, 80+ → 1.00x
  const happinessClamped = Math.max(0, Math.min(100, happiness));
  const happinessFactor = 0.72 + (happinessClamped / 100) * 0.28;

  // Versorgung: kein Strom/Wasser → stark reduziert
  // Beide fehlen: 0.35x, eines fehlt: 0.65x, beide vorhanden: 1.0x
  let utilityFactor: number;
  if (powered && watered) {
    utilityFactor = 1.0;
  } else if (powered || watered) {
    utilityFactor = 0.65;
  } else {
    utilityFactor = 0.35;
  }

  const rate = noise * landValueFactor * happinessFactor * utilityFactor;

  // Absolute Grenzen: nie über 1.0, nie unter 0.15
  return Math.max(0.15, Math.min(1.0, rate));
}

// ---------------------------------------------------------------------------
// Population + Jobs aus BUILDING_STATS + Occupancy
// ---------------------------------------------------------------------------

/**
 * Berechnet Population und Jobs für ein fertig gebautes Gebäude.
 * maxPop × 0.8 ist die physische Kapazität (nie 100% durch Design),
 * die Occupancy-Rate skaliert das weiter je nach Zustand der Stadt.
 */
export function calcPopJobsWithOccupancy(
  type: BuildingType,
  level: number,
  x: number,
  y: number,
  landValue: number,
  happiness: number,
  powered: boolean,
  watered: boolean,
): { population: number; jobs: number } {
  const stats = BUILDING_STATS[type];
  if (!stats) return { population: 0, jobs: 0 };

  const lvl = Math.max(1, level || 1);
  const occupancy = calcOccupancyRate(x, y, landValue, happiness, powered, watered);

  return {
    population: stats.maxPop > 0 ? Math.floor(stats.maxPop * 0.8 * lvl * occupancy) : 0,
    jobs:       stats.maxJobs > 0 ? Math.floor(stats.maxJobs * 0.8 * lvl * occupancy) : 0,
  };
}

/**
 * Vereinfachte Version ohne dynamische Faktoren —
 * für Initial-Load wo LV/Happiness noch nicht bekannt sind.
 * Nimmt Standard-Annahmen: LV=50, Happiness=60, Strom+Wasser vorhanden.
 */
export function calcPopJobsStatic(
  type: BuildingType,
  level: number,
  x: number,
  y: number,
): { population: number; jobs: number } {
  return calcPopJobsWithOccupancy(type, level, x, y, 50, 60, true, true);
}
