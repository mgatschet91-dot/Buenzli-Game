/**
 * Villa-Katalog: 25 Designs aus mansion_alternates.png (5 Zeilen × 5 Spalten)
 *
 * Anforderungen:
 *  - min_rank:           Mindest-Rang des Spielers (user_rank Feld)
 *  - requires_council:   Braucht Rolle 'council' oder 'owner' in der Gemeinde
 *  - requires_president: Nur Gemeindepresident ('owner')
 */

export type VillaRequirement = {
  min_rank?: number;
  requires_council?: boolean;
  requires_president?: boolean;
};

export interface VillaVariant {
  row: number;
  col: number;
  name: string;
  price: number;           // CHF vom Privatkonto → Gemeindekasse
  tier: 1 | 2 | 3 | 4 | 5;
  requirement: VillaRequirement;
  description: string;
}

export const VILLA_CATALOG: VillaVariant[] = [
  // ─── Tier 1: Offen für alle (Rang 1) ────────────────────────────
  { row: 0, col: 0, name: 'Villa Bleu',        price: 5_000,  tier: 1, requirement: {},              description: 'Elegante blaue Villa mit Pool' },
  { row: 0, col: 1, name: 'Stadtpalais',       price: 7_500,  tier: 1, requirement: {},              description: 'Klassisches Stadtpalais mit Garten' },
  { row: 0, col: 2, name: 'Pool-Residenz',     price: 10_000, tier: 1, requirement: {},              description: 'Moderne Residenz mit großem Pool' },
  { row: 0, col: 3, name: 'Sommerhaus',        price: 12_000, tier: 1, requirement: {},              description: 'Helles Sommerhaus mit Terrasse' },
  { row: 0, col: 4, name: 'Gartenpalais',      price: 15_000, tier: 1, requirement: {},              description: 'Historisches Palais mit Parkanlage' },

  // ─── Tier 2: Rang 2 erforderlich ─────────────────────────────────
  { row: 1, col: 0, name: 'Luxusvilla',        price: 25_000, tier: 2, requirement: { min_rank: 2 }, description: 'Exklusive Villa mit Grünanlage' },
  { row: 1, col: 1, name: 'Pavillonvilla',     price: 32_000, tier: 2, requirement: { min_rank: 2 }, description: 'Villa mit eleganten Pavillons' },
  { row: 1, col: 2, name: 'Beachvilla',        price: 38_000, tier: 2, requirement: { min_rank: 2 }, description: 'Großzügige Villa in mediterranem Stil' },
  { row: 1, col: 3, name: 'Kolonialvilla',     price: 42_000, tier: 2, requirement: { min_rank: 2 }, description: 'Stattliches Kolonialhaus mit Veranda' },
  { row: 1, col: 4, name: 'Herrschaftshaus',   price: 48_000, tier: 2, requirement: { min_rank: 2 }, description: 'Imposantes Herrschaftsanwesen' },

  // ─── Tier 3: Rang 3 erforderlich ─────────────────────────────────
  { row: 2, col: 0, name: 'Grandvilla',        price: 65_000, tier: 3, requirement: { min_rank: 3 }, description: 'Prunkvolle Grand Villa mit Kuppeldach' },
  { row: 2, col: 1, name: 'Parkpalais',        price: 78_000, tier: 3, requirement: { min_rank: 3 }, description: 'Neoklassisches Palais im Park' },
  { row: 2, col: 2, name: 'Seevilla',          price: 88_000, tier: 3, requirement: { min_rank: 3 }, description: 'Repräsentative Villa mit Seeblick' },
  { row: 2, col: 3, name: 'Schlossreplika',    price: 95_000, tier: 3, requirement: { min_rank: 3 }, description: 'Schlossnachbau im historischen Stil' },
  { row: 2, col: 4, name: 'Fürstenvilla',      price: 110_000, tier: 3, requirement: { min_rank: 3 }, description: 'Fürstliche Villa mit Mauerwerk' },

  // ─── Tier 4: Verwaltung (council/owner) ──────────────────────────
  { row: 3, col: 0, name: 'Residenz Imperial', price: 150_000, tier: 4, requirement: { requires_council: true }, description: 'Imposante Imperialresidenz' },
  { row: 3, col: 1, name: 'Residenz Baroque',  price: 175_000, tier: 4, requirement: { requires_council: true }, description: 'Barockresidenz mit Hauptfassade' },
  { row: 3, col: 2, name: 'Residenz Colonial', price: 185_000, tier: 4, requirement: { requires_council: true }, description: 'Koloniale Verwaltungsresidenz' },
  { row: 3, col: 3, name: 'Residenz Versailles', price: 220_000, tier: 4, requirement: { requires_council: true }, description: 'Anlehnung an Versailles' },
  { row: 3, col: 4, name: 'Residenz Royal',    price: 260_000, tier: 4, requirement: { requires_council: true }, description: 'Königliche Prachtresidenz' },

  // ─── Tier 5: Nur Gemeindepresident ───────────────────────────────
  { row: 4, col: 0, name: 'Schloss Meinort',   price: 300_000, tier: 5, requirement: { requires_president: true }, description: 'Das Schloss der Gemeindegründer' },
  { row: 4, col: 1, name: 'Schloss Alpenblick', price: 350_000, tier: 5, requirement: { requires_president: true }, description: 'Alpines Herrenschloss' },
  { row: 4, col: 2, name: 'Schloss Föhn',       price: 400_000, tier: 5, requirement: { requires_president: true }, description: 'Gotisches Schloss mit Türmen' },
  { row: 4, col: 3, name: 'Schloss Helvetia',   price: 450_000, tier: 5, requirement: { requires_president: true }, description: 'Nationales Symbolschloss' },
  { row: 4, col: 4, name: 'Schloss Bundesrat',  price: 500_000, tier: 5, requirement: { requires_president: true }, description: 'Residenz des Bürgermeisters' },
];

export const TIER_COLORS: Record<number, string> = {
  1: 'text-slate-300 border-slate-500',
  2: 'text-green-300 border-green-600',
  3: 'text-blue-300 border-blue-600',
  4: 'text-purple-300 border-purple-600',
  5: 'text-amber-300 border-amber-500',
};

export const TIER_LABELS: Record<number, string> = {
  1: 'Standard',
  2: 'Rang 2',
  3: 'Rang 3',
  4: 'Verwaltung',
  5: 'Präsident',
};

export const TIER_BG: Record<number, string> = {
  1: 'bg-slate-800/60',
  2: 'bg-green-900/30',
  3: 'bg-blue-900/30',
  4: 'bg-purple-900/30',
  5: 'bg-amber-900/30',
};
