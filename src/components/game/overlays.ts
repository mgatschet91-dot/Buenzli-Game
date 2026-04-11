/**
 * Overlay mode utilities and configuration.
 * Handles visualization overlays for power, water, services, pollution, trees, houses, parks, etc.
 */

import { Tile, BuildingType } from '@/types/game';
import { OverlayMode } from './types';
import { BUILDING_STATS } from '@/games/isocity/types/buildings';
import { RESIDENTIAL_BUILDING_TYPES } from './constants';

// ============================================================================
// Types
// ============================================================================

/** Service coverage data for a tile */
export type ServiceCoverage = {
  fire: number;
  police: number;
  health: number;
  education: number;
};

/** Configuration for an overlay mode */
export type OverlayConfig = {
  /** Display label */
  label: string;
  /** Tooltip/title text */
  title: string;
  /** Button background color when active */
  activeColor: string;
  /** Button hover color when active */
  hoverColor: string;
};

// ============================================================================
// Overlay Configuration
// ============================================================================

/** Configuration for each overlay mode */
export const OVERLAY_CONFIG: Record<OverlayMode, OverlayConfig> = {
  none: {
    label: 'None',
    title: 'No Overlay',
    activeColor: '',
    hoverColor: '',
  },
  power: {
    label: 'Power',
    title: 'Power Grid',
    activeColor: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
  },
  water: {
    label: 'Water',
    title: 'Water System',
    activeColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  fire: {
    label: 'Fire',
    title: 'Fire Coverage',
    activeColor: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
  },
  police: {
    label: 'Police',
    title: 'Police Coverage',
    activeColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  health: {
    label: 'Health',
    title: 'Health Coverage',
    activeColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
  },
  education: {
    label: 'Education',
    title: 'Education Coverage',
    activeColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
  },
  subway: {
    label: 'Subway',
    title: 'Subway Coverage',
    activeColor: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
  },
  pollution: {
    label: 'Pollution',
    title: 'Verschmutzung',
    activeColor: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-600',
  },
  trees: {
    label: 'Trees',
    title: 'Bäume & Vegetation',
    activeColor: 'bg-emerald-500',
    hoverColor: 'hover:bg-emerald-600',
  },
  houses: {
    label: 'Houses',
    title: 'Wohngebäude',
    activeColor: 'bg-cyan-500',
    hoverColor: 'hover:bg-cyan-600',
  },
  parks: {
    label: 'Parks',
    title: 'Parks & Erholung',
    activeColor: 'bg-lime-500',
    hoverColor: 'hover:bg-lime-600',
  },
};

/** Map of building tools to their corresponding overlay mode */
export const TOOL_TO_OVERLAY_MAP: Record<string, OverlayMode> = {
  power_plant: 'power',
  water_tower: 'water',
  fire_station: 'fire',
  police_station: 'police',
  hospital: 'health',
  school: 'education',
  university: 'education',
  subway_station: 'subway',
  subway: 'subway',
};

/** Get the button class name for an overlay button */
export function getOverlayButtonClass(mode: OverlayMode, isActive: boolean): string {
  if (!isActive || mode === 'none') return '';
  const config = OVERLAY_CONFIG[mode];
  return `${config.activeColor} ${config.hoverColor}`;
}

// ============================================================================
// Overlay Fill Style Calculation
// ============================================================================

/** Tiles that don't need service coverage (natural/infrastructure) */
const NON_BUILDING_TYPES = new Set([
  'empty', 'grass', 'water', 'road', 'rail', 'tree'
]);

/** Check if a tile has a building that needs service coverage */
function tileNeedsCoverage(tile: Tile): boolean {
  return !NON_BUILDING_TYPES.has(tile.building.type);
}

/** Warning color for uncovered buildings */
const UNCOVERED_WARNING = 'rgba(239, 68, 68, 0.45)'; // Red tint

/** No overlay needed (transparent) */
const NO_OVERLAY = 'rgba(0, 0, 0, 0)';

/**
 * Calculate the fill style color for an overlay tile.
 * 
 * New simplified logic:
 * - Buildings without coverage get a red warning tint
 * - Covered buildings and non-building tiles get no tint
 * - Radius circles are drawn separately to show coverage areas
 * 
 * @param mode - The current overlay mode
 * @param tile - The tile being rendered
 * @param coverage - Service coverage values for the tile
 * @returns CSS color string for the overlay fill
 */
export function getOverlayFillStyle(
  mode: OverlayMode,
  tile: Tile,
  coverage: ServiceCoverage
): string {
  // Only show warning on tiles that have buildings needing coverage
  const needsCoverage = tileNeedsCoverage(tile);
  
  switch (mode) {
    case 'power':
      // Red warning only on unpowered buildings
      if (!needsCoverage) return NO_OVERLAY;
      return tile.building.powered ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'water':
      // Red warning only on buildings without water
      if (!needsCoverage) return NO_OVERLAY;
      return tile.building.watered ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'fire':
      // Red warning only on buildings outside fire coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.fire > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'police':
      // Red warning only on buildings outside police coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.police > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'health':
      // Red warning only on buildings outside health coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.health > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'education':
      // Red warning only on buildings outside education coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.education > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'subway':
      // Underground view overlay - keep existing behavior
      return tile.hasSubway
        ? 'rgba(245, 158, 11, 0.7)'  // Bright amber for existing subway
        : 'rgba(40, 30, 20, 0.4)';   // Dark brown tint for "underground" view

    case 'pollution':
      // Heatmap-Darstellung der Verschmutzung pro Tile
      return getPollutionHeatmapColor(tile.pollution);

    case 'trees':
      // Bäume hervorheben, Rest abdunkeln
      if (TREE_BUILDING_TYPES.has(tile.building.type)) {
        return 'rgba(34, 197, 94, 0.30)'; // Grüne Hervorhebung
      }
      return tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'water'
        ? NO_OVERLAY
        : 'rgba(0, 0, 0, 0.15)'; // Nicht-Baum-Gebäude leicht abdunkeln

    case 'houses':
      // Wohngebäude hervorheben
      if (RESIDENTIAL_BUILDING_TYPES.has(tile.building.type)) {
        return 'rgba(6, 182, 212, 0.25)'; // Cyan Hervorhebung
      }
      return tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'water'
        ? NO_OVERLAY
        : 'rgba(0, 0, 0, 0.15)';

    case 'parks':
      // Parks hervorheben
      if (PARK_BUILDING_TYPES.has(tile.building.type)) {
        return 'rgba(132, 204, 22, 0.30)'; // Lime Hervorhebung
      }
      return tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'water'
        ? NO_OVERLAY
        : 'rgba(0, 0, 0, 0.15)';

    case 'none':
    default:
      return NO_OVERLAY;
  }
}

/**
 * Get the overlay mode that should be shown for a given tool.
 * Returns 'none' if the tool doesn't have an associated overlay.
 */
export function getOverlayForTool(tool: string): OverlayMode {
  return TOOL_TO_OVERLAY_MAP[tool] ?? 'none';
}

/** List of all overlay modes (for iteration) */
export const OVERLAY_MODES: OverlayMode[] = [
  'none', 'power', 'water', 'fire', 'police', 'health', 'education', 'subway',
  'pollution', 'trees', 'houses', 'parks'
];

// ============================================================================
// Service Radius Overlay Helpers
// ============================================================================

/** Map overlay modes to their corresponding service building types */
export const OVERLAY_TO_BUILDING_TYPES: Record<OverlayMode, string[]> = {
  none: [],
  power: [], // Strom ist globale Infrastruktur (unterirdisch), kein Radius mehr
  water: [], // Wasser ist globale Infrastruktur (Kapazitätssystem), kein Radius mehr
  fire: ['fire_station'],
  police: ['police_station'],
  health: ['hospital'],
  education: ['school', 'university'],
  subway: ['subway_station'],
  pollution: [], // handled specially - all buildings with pollution != 0
  trees: [],     // handled specially - all tree types
  houses: [],    // handled specially - all residential types
  parks: [],     // handled specially - all park types
};

/** Overlay circle stroke colors (light/visible colors) */
export const OVERLAY_CIRCLE_COLORS: Record<OverlayMode, string> = {
  none: 'transparent',
  power: 'rgba(251, 191, 36, 0.8)',    // Amber
  water: 'rgba(96, 165, 250, 0.8)',    // Blue
  fire: 'rgba(248, 113, 113, 0.8)',    // Light red
  police: 'rgba(147, 197, 253, 0.8)',  // Light blue
  health: 'rgba(134, 239, 172, 0.8)',  // Light green
  education: 'rgba(196, 181, 253, 0.8)', // Light purple
  subway: 'rgba(253, 224, 71, 0.8)',   // Yellow
  pollution: 'rgba(239, 115, 54, 0.8)',  // Orange-red
  trees: 'rgba(34, 197, 94, 0.8)',       // Green
  houses: 'rgba(6, 182, 212, 0.8)',      // Cyan
  parks: 'rgba(132, 204, 22, 0.8)',      // Lime
};

/** Building highlight glow colors */
export const OVERLAY_HIGHLIGHT_COLORS: Record<OverlayMode, string> = {
  none: 'transparent',
  power: 'rgba(251, 191, 36, 1)',      // Amber
  water: 'rgba(96, 165, 250, 1)',      // Blue  
  fire: 'rgba(239, 68, 68, 1)',        // Red
  police: 'rgba(59, 130, 246, 1)',     // Blue
  health: 'rgba(34, 197, 94, 1)',      // Green
  education: 'rgba(168, 85, 247, 1)',  // Purple
  subway: 'rgba(234, 179, 8, 1)',      // Yellow
  pollution: 'rgba(239, 115, 54, 1)',    // Orange-red
  trees: 'rgba(22, 163, 74, 1)',         // Dark green
  houses: 'rgba(8, 145, 178, 1)',        // Dark cyan
  parks: 'rgba(101, 163, 13, 1)',        // Dark lime
};

/** Overlay circle fill colors (subtle, for area visibility) */
export const OVERLAY_CIRCLE_FILL_COLORS: Record<OverlayMode, string> = {
  none: 'transparent',
  power: 'rgba(251, 191, 36, 0.12)',
  water: 'rgba(96, 165, 250, 0.12)',
  fire: 'rgba(248, 113, 113, 0.12)',
  police: 'rgba(147, 197, 253, 0.12)',
  health: 'rgba(134, 239, 172, 0.12)',
  education: 'rgba(196, 181, 253, 0.12)',
  subway: 'rgba(253, 224, 71, 0.12)',
  pollution: 'rgba(239, 115, 54, 0.10)',
  trees: 'rgba(34, 197, 94, 0.10)',
  houses: 'rgba(6, 182, 212, 0.10)',
  parks: 'rgba(132, 204, 22, 0.10)',
};

// ============================================================================
// Pollution / Trees / Houses / Parks Overlay Helpers
// ============================================================================

/** All tree building types */
export const TREE_BUILDING_TYPES = new Set<string>([
  'tree', 'tree_oak', 'tree_maple', 'tree_birch', 'tree_willow',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar',
  'tree_palm', 'tree_bamboo', 'tree_coconut',
  'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria',
  'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral',
  'flower_bed', 'flower_planter',
]);

// RESIDENTIAL_BUILDING_TYPES is imported from constants via index.ts re-exports

/** All park building types */
export const PARK_BUILDING_TYPES = new Set<string>([
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
  'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
  'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater',
  'greenhouse_garden', 'community_garden', 'pond_park', 'park_gate',
  'mountain_lodge', 'mountain_trailhead', 'campground', 'swimming_pool',
]);

/**
 * Berechnet den visuellen Einflussradius eines Gebäudes basierend auf seinem Verschmutzungswert.
 * Verschmutzer (positive Werte) → rötlicher Radius
 * Reiniger (negative Werte, z.B. Bäume/Parks) → grünlicher Radius
 * @returns Radius in Tiles, oder 0 falls kein Radius dargestellt werden soll
 */
export function getPollutionInfluenceRadius(buildingType: string): number {
  const stats = BUILDING_STATS[buildingType as BuildingType];
  if (!stats) return 0;
  const pollution = stats.pollution;
  if (pollution === 0) return 0;
  // Radius skaliert mit dem Absolutwert der Verschmutzung
  // Minimum 2 Tiles, Maximum 8 Tiles
  return Math.min(8, Math.max(2, Math.ceil(Math.abs(pollution) / 4)));
}

/**
 * Bestimmt die Heatmap-Farbe für den Verschmutzungswert eines Tiles.
 * Grün (sauber) → Gelb (mittel) → Rot (stark verschmutzt)
 */
export function getPollutionHeatmapColor(pollutionValue: number): string {
  if (pollutionValue <= 0) return 'rgba(34, 197, 94, 0.35)';   // Grün - sauber
  if (pollutionValue < 5)  return 'rgba(132, 204, 22, 0.30)';  // Lime - minimal
  if (pollutionValue < 15) return 'rgba(250, 204, 21, 0.35)';  // Gelb - leicht
  if (pollutionValue < 30) return 'rgba(251, 146, 60, 0.40)';  // Orange - mittel
  if (pollutionValue < 50) return 'rgba(239, 68, 68, 0.45)';   // Rot - stark
  return 'rgba(185, 28, 28, 0.55)';                             // Dunkelrot - sehr stark
}

/**
 * Gibt den Verschmutzungswert eines Gebäudetyps zurück (aus BUILDING_STATS).
 */
export function getBuildingPollutionValue(buildingType: string): number {
  const stats = BUILDING_STATS[buildingType as BuildingType];
  return stats?.pollution ?? 0;
}

/**
 * Gibt die Radius-Farbe basierend auf dem Verschmutzungswert zurück.
 * Positive Werte = Verschmutzer (rot/orange), Negative = Reiniger (grün)
 */
export function getPollutionRadiusColors(pollution: number): { stroke: string; fill: string; highlight: string } {
  if (pollution > 0) {
    // Verschmutzer - rot/orange Radius
    return {
      stroke: 'rgba(239, 68, 68, 0.7)',
      fill: 'rgba(239, 68, 68, 0.08)',
      highlight: 'rgba(239, 68, 68, 1)',
    };
  }
  // Reiniger - grüner Radius
  return {
    stroke: 'rgba(34, 197, 94, 0.7)',
    fill: 'rgba(34, 197, 94, 0.08)',
    highlight: 'rgba(34, 197, 94, 1)',
  };
}
