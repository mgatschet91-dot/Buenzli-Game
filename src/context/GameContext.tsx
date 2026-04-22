// Consolidated GameContext for the SimCity-like game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { serializeAndCompressAsync } from '@/lib/saveWorkerManager';
import { simulateTick, initializeSteadyStatePollution } from '@/lib/simulation';
import {
  Budget,
  Building,
  BuildingType,
  GameState,
  SavedCityMeta,
  Tool,
  TOOL_INFO,
  ZoneType,
  AdjacentCity,
  TilePaintColor,
} from '@/types/game';
import {
  bulldozeTile,
  createInitialGameState,
  DEFAULT_GRID_SIZE,
  expandGrid,
  placeBuilding,
  placeSubway,
  placeWaterTerraform,
  placeLandTerraform,
  generateRandomAdvancedCity,
  createBridgesOnPath,
  upgradeServiceBuilding,
  repairBuilding,
} from '@/lib/simulation';
import { playPlacementSound } from '@/lib/placementSounds';
import { applyItemsToGrid, type GameItemFromApi } from '@/lib/buildStateFromItems';
import {
  SPRITE_PACKS,
  DEFAULT_SPRITE_PACK_ID,
  getSpritePack,
  setActiveSpritePack,
  SpritePack,
} from '@/lib/renderConfig';
import * as partnershipApi from '@/lib/api/partnershipApi';
import { getZoneSettings, type BauzoneMode } from '@/lib/api/municipalityAdminApi';
import { deltaQueue, type BuenzliNpcPayload, type ParkedVehicle, type ParkingConfig, type ParkingViolation, type ParkingFineEvent } from '@/lib/deltaSync';
import { calcPopJobsWithOccupancy } from '@/lib/buildingOccupancy';

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITY_STORAGE_KEY = 'isocity-saved-city'; // For restoring after viewing shared city
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index'; // Index of all saved cities
const SAVED_CITY_PREFIX = 'isocity-city-'; // Prefix for individual saved city states
const SPRITE_PACK_STORAGE_KEY = 'isocity-sprite-pack';
const DAY_NIGHT_MODE_STORAGE_KEY = 'isocity-day-night-mode';

export type DayNightMode = 'auto' | 'day' | 'night';

type RemoteDisasterStateUpdate = {
  x: number;
  y: number;
  on_fire?: boolean;
  fire_progress?: number;
  elevation?: number;
  removed?: boolean;
  abandoned?: boolean;
};

type RemoteBuildingStateUpdate = {
  x: number;
  y: number;
  level?: number;
  abandoned?: boolean;
  buildingType?: string;
  constructionProgress?: number;
  constructed?: boolean;
};

type RemoteCriminalNpc = {
  id: number;
  x: number;
  y: number;
  state: 'loitering' | 'dealing' | 'burglary' | 'fleeing';
  isDealer: boolean;
  beingChased: boolean;
  policeX: number | null;
  policeY: number | null;
  ticksAlive: number;
};

type RemoteCrimeEvent = {
  type: 'spawn' | 'despawn' | 'chase_start' | 'caught';
  id: number;
  x: number;
  y: number;
  isDealer?: boolean;
  reason?: string;
  policeX?: number;
  policeY?: number;
  stolenTotal?: number;
};

// Info about a saved city (for restore functionality)
export type SavedCityInfo = {
  cityName: string;
  population: number;
  money: number;
  savedAt: number;
} | null;

type GameContextValue = {
  state: GameState;
  // PERF: Ref to latest state for real-time access without React re-renders
  // Canvas should use this instead of state.grid for smooth updates
  latestStateRef: React.RefObject<GameState>;
  setTool: (tool: Tool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setTaxRate: (rate: number) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  setBudgetFunding: (key: keyof Budget, funding: number) => void;
  setSocialContributionRate: (rate: number) => void;
  setWelfarePerUnemployed: (amount: number) => void;
  upgradeServiceBuilding: (x: number, y: number) => boolean; // Returns true if upgrade succeeded
  repairAtTile: (x: number, y: number) => boolean; // Repair abandoned building, returns true if succeeded
  flipBuildingAtTile: (x: number, y: number) => boolean; // Flip/rotate building, returns true if succeeded
  placeAtTile: (x: number, y: number, isRemote?: boolean, overrideTool?: Tool) => void;
  setPlaceCallback: (callback: ((args: { x: number; y: number; tool: Tool }) => void) | null) => void;
  finishTrackDrag: (pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote?: boolean) => void; // Create bridges after road/rail drag
  setBridgeCallback: (callback: ((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null) => void;
  connectToCity: (cityId: string) => void;
  discoverCity: (cityId: string) => void;
  checkAndDiscoverCities: (onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void) => void;
  setDisastersEnabled: (enabled: boolean) => void;
  newGame: (name?: string, size?: number) => void;
  loadState: (stateString: string) => boolean;
  softLoadState: (stateString: string) => boolean; // Wie loadState, aber OHNE gameVersion-Increment (Entities bleiben erhalten)
  applyGridPatch: (items: import('@/lib/buildStateFromItems').GameItemFromApi[]) => void; // Patcht einzelne Tiles (Chunk Loading)
  exportState: () => string;
  generateRandomCity: () => void;
  expandCity: () => void;
  shrinkCity: () => boolean;
  hasExistingGame: boolean;
  isStateReady: boolean; // True when initial state loading is complete
  isSaving: boolean;
  addMoney: (amount: number) => void;
  addNotification: (title: string, description: string, icon: string) => void;
  clearNotifications: () => void;
  // Sprite pack management
  currentSpritePack: SpritePack;
  availableSpritePacks: SpritePack[];
  setSpritePack: (packId: string) => void;
  // Day/night mode override
  dayNightMode: DayNightMode;
  setDayNightMode: (mode: DayNightMode) => void;
  visualHour: number; // The hour to use for rendering (respects day/night mode override)
  // Save/restore city for shared links
  saveCurrentCityForRestore: () => void;
  restoreSavedCity: () => boolean;
  getSavedCityInfo: () => SavedCityInfo;
  clearSavedCity: () => void;
  // Multi-city save system
  savedCities: SavedCityMeta[];
  saveCity: () => void;
  loadSavedCity: (cityId: string) => boolean;
  deleteSavedCity: (cityId: string) => void;
  renameSavedCity: (cityId: string, newName: string) => void;
  // Multiplayer stats sync
  applyRemoteStats?: (stats: {
    money?: number;
    population?: number;
    income?: number;
    expenses?: number;
    tax_income?: number;
    tax_income_population?: number;
    tax_income_business?: number;
    tax_income_property?: number;
    building_income?: number;
    company_tax_income?: number;
    budget_expenses?: number;
    budget_cost_police?: number;
    budget_cost_fire?: number;
    budget_cost_health?: number;
    budget_cost_education?: number;
    budget_cost_transportation?: number;
    budget_cost_parks?: number;
    budget_cost_power?: number;
    budget_cost_water?: number;
    maintenance_expenses?: number;
    administration_base_expenses?: number;
    civic_overhead_expenses?: number;
    utility_overhead_expenses?: number;
    jobs?: number;
    happiness?: number;
    employed?: number;
    unemployed?: number;
    unemploymentRate?: number;
    workforce?: number;
    workforceRate?: number;
    children?: number;
    seniors?: number;
    students?: number;
    socialFund?: number;
    socialContributionRate?: number;
    welfarePerUnemployed?: number;
    socialFundIncome?: number;
    socialFundExpenses?: number;
    socialExpenses?: number;
    welfareCoverage?: number;
    schoolCapacity?: number;
    uniCapacity?: number;
    educationOvercrowding?: number;
    healthCapacity?: number;
    healthDemand?: number;
    healthAdequacy?: number;
    year?: number;
    month?: number;
    weatherType?: string;
    weatherIntensity?: number;
    weatherTemperature?: number | null;
    taxRate?: number;
    tick?: number;
    gameSpeed?: number;
    gameMapData?: Record<string, unknown> | null;
  }) => void;
  applyRemoteDisasters?: (changes: RemoteDisasterStateUpdate[]) => void;
  applyRemoteBuildingUpdates?: (changes: RemoteBuildingStateUpdate[]) => void;
  applyRemoteLandValueUpdate?: (data: { gridSize: number; values: number[] }) => void;
  applyRemoteCrimeUpdate?: (data: { criminals: RemoteCriminalNpc[]; crimeGrid: number[] | null; gridSize: number; crimeEvents: RemoteCrimeEvent[]; homeless?: number; isNight?: boolean }) => void;
  applyRemoteBuenzliUpdate?: (data: BuenzliNpcPayload) => void;
  clearRemoteStatsOverride?: () => void; // Deaktiviert Remote-Stats-Override (wenn wir Stats-Sender werden)
  // Nachbar-Gemeinden aktualisieren (für Kanton-basierte Gemeinden)
  setAdjacentCities: (cities: AdjacentCity[]) => void;
  // Gewässer umbenennen
  renameWaterBody: (id: string, newName: string) => void;
  // Partnership-Callbacks für WebSocket-Events
  setPartnershipDiscoveredCallback: (callback: ((data: { partnerSlug: string; partnerName: string; direction: string }) => void) | null) => void;
  setPartnershipConnectedCallback: (callback: ((data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number }) => void) | null) => void;
  // API-basierte Partnership-Funktionen
  discoverCityWithApi: (cityId: string) => Promise<void>;
  connectToCityWithApi: (cityId: string) => Promise<void>;
  loadPartnershipsFromApi: () => Promise<void>;
  municipalitySlug?: string;
  municipalityRole: 'owner' | 'council' | 'citizen' | 'observer';
  canton?: string;
  bauzoneMode: 'disabled' | 'members' | 'all';
  setBauzoneMode: (mode: 'disabled' | 'members' | 'all') => void;
  setBuildingLabel: (x: number, y: number, label: string) => void;
  setAutobahnDirection: (x: number, y: number, direction: 'north' | 'south' | 'east' | 'west' | null) => void;
  // Transport / Bus line system
  hasTransportCompany: boolean;
  hasBusStation: boolean;
  transportCompanyId: number | null;
  busLineCreationMode: {
    active: boolean;
    companyId: number;
    stops: { x: number; y: number }[];
    lineName: string;
    lineColor: string;
    editingLineId?: number;
  } | null;
  startBusLineCreation: (companyId: number, lineName: string, lineColor: string, existingStops?: { x: number; y: number }[], editingLineId?: number) => void;
  addBusLineStop: (x: number, y: number) => void;
  removeBusLineStop: (index: number) => void;
  cancelBusLineCreation: () => void;
  finishBusLineCreation: () => Promise<unknown>;
  loadTransportCompanyStatus: () => Promise<void>;
  // Residence placement mode
  residencePlacement: { variantRow: number; variantCol: number } | null;
  startResidencePlacement: (variantRow: number, variantCol: number) => void;
  cancelResidencePlacement: () => void;
  // Habbo-style room viewer
  activeRoom: { userId: number; nickname: string } | null;
  openResidenceRoom: (userId: number, nickname: string) => void;
  closeResidenceRoom: () => void;
  // Parking system
  parkedVehiclesRef: React.MutableRefObject<ParkedVehicle[]>;
  emitParkVehicle: (tileX: number, tileY: number, slot: number, color: string) => void;
  emitLeaveParking: (tileX: number, tileY: number, slot: number) => void;
  parkingConfigRef: React.MutableRefObject<ParkingConfig[]>;
  parkingViolationsRef: React.MutableRefObject<ParkingViolation[]>;
  emitSetParkingConfig: (tileX: number, tileY: number, isFree: boolean, feeRate: number) => void;
  addNotificationFromParking: (data: ParkingFineEvent) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function createBurnedGroundBuilding(): Building {
  return {
    type: 'grass',
    level: 1,
    population: 0,
    jobs: 0,
    powered: false,
    watered: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}

const BUDGET_KEYS: Array<keyof Budget> = [
  'police',
  'fire',
  'health',
  'education',
  'transportation',
  'parks',
  'power',
  'water',
];

function mergeBudgetFromServer(base: Budget, incoming: unknown): Budget {
  if (!isRecord(incoming)) return base;

  let changed = false;
  const next: Budget = { ...base };

  for (const key of BUDGET_KEYS) {
    const src = incoming[key];
    if (!isRecord(src)) continue;

    const funding = toFiniteNumberOrUndefined(src.funding);
    const cost = toFiniteNumberOrUndefined(src.cost);
    const name = typeof src.name === 'string' && src.name.trim().length > 0
      ? src.name
      : base[key].name;

    const merged = {
      ...base[key],
      name,
      ...(funding !== undefined ? { funding: clamp(Math.round(funding), 0, 100) } : {}),
      ...(cost !== undefined ? { cost: Math.round(cost) } : {}),
    };

    if (
      merged.name !== base[key].name ||
      merged.funding !== base[key].funding ||
      merged.cost !== base[key].cost
    ) {
      changed = true;
      next[key] = merged;
    }
  }

  return changed ? next : base;
}

const toolBuildingMap: Partial<Record<Tool, BuildingType>> = {
  road: 'road',
  rail: 'rail',
  rail_station: 'rail_station',
  tree: 'tree',
  police_station: 'police_station',
  fire_station: 'fire_station',
  hospital: 'hospital',
  school: 'school',
  university: 'university',
  park: 'park',
  park_large: 'park_large',
  tennis: 'tennis',
  power_plant: 'power_plant',
  water_tower: 'water_tower',
  water_reservoir: 'water_reservoir',
  subway_station: 'subway_station',
  stadium: 'stadium',
  museum: 'museum',
  airport: 'airport',
  space_program: 'space_program',
  city_hall: 'city_hall',
  amusement_park: 'amusement_park',
  // New parks
  basketball_courts: 'basketball_courts',
  playground_small: 'playground_small',
  playground_large: 'playground_large',
  baseball_field_small: 'baseball_field_small',
  soccer_field_small: 'soccer_field_small',
  football_field: 'football_field',
  baseball_stadium: 'baseball_stadium',
  community_center: 'community_center',
  office_building_small: 'office_building_small',
  swimming_pool: 'swimming_pool',
  skate_park: 'skate_park',
  mini_golf_course: 'mini_golf_course',
  bleachers_field: 'bleachers_field',
  go_kart_track: 'go_kart_track',
  amphitheater: 'amphitheater',
  greenhouse_garden: 'greenhouse_garden',
  animal_pens_farm: 'animal_pens_farm',
  cabin_house: 'cabin_house',
  campground: 'campground',
  marina_docks_small: 'marina_docks_small',
  pier_large: 'pier_large',
  roller_coaster_small: 'roller_coaster_small',
  community_garden: 'community_garden',
  pond_park: 'pond_park',
  park_gate: 'park_gate',
  mountain_lodge: 'mountain_lodge',
  mountain_trailhead: 'mountain_trailhead',
  woodcutter_house: 'woodcutter_house',
  // Standalone buildings
  bank_house: 'bank_house',
  fcbasel_stadium: 'fcbasel_stadium',
  st_ursen_kathedrale: 'st_ursen_kathedrale',
  bus_stop: 'bus_stop',
  bus_station: 'bus_station',
  primetower: 'primetower',
  // Parking
  parking_spot: 'parking_spot',
  parking_lot: 'parking_lot',
  parking_lot_large: 'parking_lot_large',
  // Trees & vegetation from trees.webp
  tree_oak: 'tree_oak',
  tree_maple: 'tree_maple',
  tree_birch: 'tree_birch',
  tree_willow: 'tree_willow',
  tree_pine: 'tree_pine',
  tree_spruce: 'tree_spruce',
  tree_fir: 'tree_fir',
  tree_cedar: 'tree_cedar',
  tree_palm: 'tree_palm',
  tree_bamboo: 'tree_bamboo',
  tree_coconut: 'tree_coconut',
  tree_cherry: 'tree_cherry',
  tree_magnolia: 'tree_magnolia',
  tree_jacaranda: 'tree_jacaranda',
  tree_wisteria: 'tree_wisteria',
  bush_hedge: 'bush_hedge',
  bush_flowering: 'bush_flowering',
  topiary_ball: 'topiary_ball',
  topiary_spiral: 'topiary_spiral',
  flower_bed: 'flower_bed',
  flower_planter: 'flower_planter',
};

const toolZoneMap: Partial<Record<Tool, ZoneType>> = {
  zone_residential: 'residential',
  zone_commercial: 'commercial',
  zone_industrial: 'industrial',
  zone_dezone: 'none',
};

// Load game state from localStorage
// Supports both compressed (lz-string) and uncompressed (legacy) formats
function loadGameState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Try to decompress first (new format)
      // If it fails or returns null/garbage, fall back to parsing as plain JSON (legacy format)
      let jsonString = decompressFromUTF16(saved);
      
      // Check if decompression returned valid-looking JSON (should start with '{')
      // lz-string can return garbage strings when given invalid input
      if (!jsonString || !jsonString.startsWith('{')) {
        // Check if the saved string itself looks like JSON (legacy uncompressed format)
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          // Data is corrupted - clear it and return null
          console.error('Corrupted save data detected, clearing...');
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }
      
      const parsed = JSON.parse(jsonString);
      // Validate it has essential properties
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        // Migrate park_medium to park_large
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building?.type === 'park_medium') {
                parsed.grid[y][x].building.type = 'park_large';
              }
            }
          }
        }
        // Migrate: Standalone-Buildings hatten früher shouldRoadMirror-basiertes auto-flip.
        // Jetzt wird shouldRoadMirror für Standalone ignoriert (R-Taste fix).
        // Damit bestehende Gebäude visuell gleich aussehen, wird das alte mirrorSeed-Ergebnis
        // als explizites flipped-Flag gesetzt (nur wenn flipped noch nicht explizit gesetzt wurde).
        const STANDALONE_BUILDING_TYPES = new Set([
          'bank_house', 'bus_stop', 'bus_station', 'solar_panel', 'fcbasel_stadium', 'st_ursen_kathedrale', 'primetower', 'disco_solothurn',
        ]);
        if (parsed.grid) {
          for (let gy = 0; gy < parsed.grid.length; gy++) {
            for (let gx = 0; gx < parsed.grid[gy].length; gx++) {
              const tile = parsed.grid[gy][gx];
              if (tile?.building && STANDALONE_BUILDING_TYPES.has(tile.building.type) && tile.building.flipped === undefined) {
                // Replicate the old mirrorSeed formula to preserve previous appearance
                const mirrorSeed = (gx * 47 + gy * 83) % 100;
                tile.building.flipped = mirrorSeed < 50;
              }
            }
          }
        }
        // Migrate selectedTool if it's park_medium
        if (parsed.selectedTool === 'park_medium') {
          parsed.selectedTool = 'park_large';
        }
        // WICHTIG: adjacentCities werden IMMER frisch von der API geladen
        // um sicherzustellen, dass echte Gemeinde-Namen verwendet werden (nicht generierte englische Namen)
        // Die discovered/connected Flags werden über die Partnerschafts-API wiederhergestellt
        parsed.adjacentCities = [];
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Immer Panels beim Laden schließen (nicht den gespeicherten Zustand wiederherstellen)
        parsed.activePanel = 'none';
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          // Create a default city covering the entire map
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure hour exists for day/night cycle
        if (parsed.hour === undefined) {
          parsed.hour = 12; // Default to noon
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9; // Start at current tax rate
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Ensure gameVersion exists for backward compatibility
        if (parsed.gameVersion === undefined) {
          parsed.gameVersion = 0;
        }
        // Migrate to include UUID if missing
        if (!parsed.id) {
          parsed.id = generateUUID();
        }
        
        // OFFLINE CATCH-UP: Wird jetzt server-seitig berechnet (idle_earnings in stats-authoritative)
        // Der Server berechnet die Idle-Einnahmen basierend auf game_stats.updated_at
        // und sendet sie beim ersten join-room als idle_earnings im WS-Event mit.

        // Verschmutzung auf Steady-State initialisieren (nicht bei 0 starten)
        if (parsed.grid && parsed.gridSize) {
          initializeSteadyStatePollution(parsed.grid, parsed.gridSize);
        }

        return parsed as GameState;
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to load game state:', e);
    // Clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (clearError) {
      console.error('Failed to clear corrupted game state:', clearError);
    }
  }
  return null;
}

// Optimize game state for saving by removing unnecessary/transient data
function optimizeStateForSave(state: GameState): GameState {
  // Create a shallow copy to avoid mutating the original
  const optimized = { ...state };
  
  // Clear notifications (they're transient)
  optimized.notifications = [];
  
  // Clear advisor messages (they're regenerated each tick)
  optimized.advisorMessages = [];
  
  // Limit history to last 50 entries (instead of 100)
  if (optimized.history && optimized.history.length > 50) {
    optimized.history = optimized.history.slice(-50);
  }
  
  // Speichere den Zeitstempel für Offline-Catch-up
  optimized.lastSaveTimestamp = Date.now();
  
  return optimized;
}

// Try to free up localStorage space by clearing old/unused data
function tryFreeLocalStorageSpace(): void {
  try {
    // Clear any old saved city restore data
    localStorage.removeItem(SAVED_CITY_STORAGE_KEY);
    
    // Clear sprite test data if any
    localStorage.removeItem('isocity_sprite_test');
    
    // Clear any other temporary keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('isocity_temp_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.error('Failed to free localStorage space:', e);
  }
}

// Save game state to localStorage with lz-string compression
// Compression typically reduces size by 60-80%, allowing much larger cities
// PERF: Uses Web Worker for BOTH serialization and compression - no main thread blocking!
async function saveGameStateAsync(state: GameState): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Validate state before saving
  if (!state || !state.grid || !state.gridSize || !state.stats) {
    console.error('Invalid game state, cannot save', { state, hasGrid: !!state?.grid, hasGridSize: !!state?.gridSize, hasStats: !!state?.stats });
    return;
  }
  
  try {
    // Step 1: Optimize state (fast, stays on main thread)
    const optimizedState = optimizeStateForSave(state);
    
    // Step 2: Serialize + Compress using Web Worker (BOTH operations off main thread!)
    const compressed = await serializeAndCompressAsync(optimizedState);
    
    // Check size limit
    if (compressed.length > 5 * 1024 * 1024) {
      console.error('Compressed game state too large to save:', compressed.length, 'chars');
      return;
    }
    
    // Step 3: Write to localStorage (fast)
    try {
      localStorage.setItem(STORAGE_KEY, compressed);
    } catch (quotaError) {
      if (quotaError instanceof DOMException && (quotaError.code === 22 || quotaError.code === 1014)) {
        console.warn('localStorage quota exceeded, trying to free space...');
        tryFreeLocalStorageSpace();
        try {
          localStorage.setItem(STORAGE_KEY, compressed);
        } catch {
          console.error('localStorage still full after cleanup');
        }
      }
    }
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

// Wrapper that takes a callback for compatibility with existing code
function saveGameState(state: GameState, callback?: () => void): void {
  saveGameStateAsync(state).finally(() => {
    callback?.();
  });
}

// Clear saved game state
function clearGameState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear game state:', e);
  }
}

// ── Adjacent Cities localStorage Cache ──────────────────────────────────────
// Cacht die adjacentCities pro Municipality-Slug damit sie beim nächsten Laden
// sofort verfügbar sind (kein "Partner Gemeinden laden..."-Flash)
const ADJACENT_CITIES_CACHE_KEY = 'meinort-adjacent-cities';

function loadCachedAdjacentCities(slug: string): AdjacentCity[] {
  if (typeof window === 'undefined' || !slug) return [];
  try {
    const raw = localStorage.getItem(`${ADJACENT_CITIES_CACHE_KEY}-${slug}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function saveCachedAdjacentCities(slug: string, cities: AdjacentCity[]): void {
  if (typeof window === 'undefined' || !slug || !cities || cities.length === 0) return;
  try {
    localStorage.setItem(`${ADJACENT_CITIES_CACHE_KEY}-${slug}`, JSON.stringify(cities));
  } catch { /* ignore */ }
}

// Load sprite pack from localStorage
function loadSpritePackId(): string {
  if (typeof window === 'undefined') return DEFAULT_SPRITE_PACK_ID;
  try {
    const saved = localStorage.getItem(SPRITE_PACK_STORAGE_KEY);
    if (saved && SPRITE_PACKS.some(p => p.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load sprite pack preference:', e);
  }
  return DEFAULT_SPRITE_PACK_ID;
}

// Save sprite pack to localStorage
function saveSpritePackId(packId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPRITE_PACK_STORAGE_KEY, packId);
  } catch (e) {
    console.error('Failed to save sprite pack preference:', e);
  }
}

// Load day/night mode from localStorage
function loadDayNightMode(): DayNightMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(DAY_NIGHT_MODE_STORAGE_KEY);
    if (saved === 'auto' || saved === 'day' || saved === 'night') {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load day/night mode preference:', e);
  }
  return 'auto';
}

// Save day/night mode to localStorage
function saveDayNightMode(mode: DayNightMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAY_NIGHT_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.error('Failed to save day/night mode preference:', e);
  }
}

// Save current city for later restoration (when viewing shared cities)
function saveCityForRestore(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    const savedData = {
      state: state,
      info: {
        cityName: state.cityName,
        population: state.stats.population,
        money: state.stats.money,
        savedAt: Date.now(),
      },
    };
    const compressed = compressToUTF16(JSON.stringify(savedData));
    localStorage.setItem(SAVED_CITY_STORAGE_KEY, compressed);
  } catch (e) {
    console.error('Failed to save city for restore:', e);
  }
}

// Helper to decompress saved city data (supports both compressed and legacy formats)
function decompressSavedCity(saved: string): { state?: GameState; info?: SavedCityInfo } | null {
  // Try to decompress first (new format)
  let jsonString = decompressFromUTF16(saved);
  if (!jsonString) {
    // Legacy uncompressed format
    jsonString = saved;
  }
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

// Load saved city info (just metadata, not full state)
function loadSavedCityInfo(): SavedCityInfo {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = decompressSavedCity(saved);
      if (parsed?.info) {
        return parsed.info as SavedCityInfo;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city info:', e);
  }
  return null;
}

// Load full saved city state
function loadSavedCityState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = decompressSavedCity(saved);
      if (parsed?.state && parsed.state.grid && parsed.state.gridSize && parsed.state.stats) {
        return parsed.state as GameState;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city state:', e);
  }
  return null;
}

// Clear saved city
function clearSavedCityStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_CITY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved city:', e);
  }
}

// Generate a UUID v4
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Load saved cities index from localStorage
function loadSavedCitiesIndex(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as SavedCityMeta[];
      }
    }
  } catch (e) {
    console.error('Failed to load saved cities index:', e);
  }
  return [];
}

// Save saved cities index to localStorage
function saveSavedCitiesIndex(cities: SavedCityMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_CITIES_INDEX_KEY, JSON.stringify(cities));
  } catch (e) {
    console.error('Failed to save cities index:', e);
  }
}

// Save a city state to localStorage with compression
// PERF: Uses Web Worker for BOTH serialization and compression - no main thread blocking!
async function saveCityStateAsync(cityId: string, state: GameState): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Both JSON.stringify and compression happen in the worker
    const compressed = await serializeAndCompressAsync(state);
    
    if (compressed.length > 5 * 1024 * 1024) {
      console.error('Compressed city state too large to save');
      return;
    }
    
    localStorage.setItem(SAVED_CITY_PREFIX + cityId, compressed);
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.code === 1014)) {
      console.error('localStorage quota exceeded');
    } else {
      console.error('Failed to save city state:', e);
    }
  }
}

// Wrapper for compatibility
function saveCityState(cityId: string, state: GameState): void {
  saveCityStateAsync(cityId, state);
}

// Load a saved city state from localStorage (supports compressed and legacy formats)
function loadCityState(cityId: string): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_PREFIX + cityId);
    if (saved) {
      // Try to decompress first (new format)
      // lz-string can return garbage when given invalid input, so check for valid JSON start
      let jsonString = decompressFromUTF16(saved);
      
      // Check if decompression returned valid-looking JSON
      if (!jsonString || !jsonString.startsWith('{')) {
        // Check if saved string itself is JSON (legacy uncompressed format)
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          // Data is corrupted
          console.error('Corrupted city save data for:', cityId);
          return null;
        }
      }
      
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.grid && parsed.gridSize && parsed.stats) {
        return parsed as GameState;
      }
    }
  } catch (e) {
    console.error('Failed to load city state:', e);
  }
  return null;
}

// Delete a saved city from localStorage
function deleteCityState(cityId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_CITY_PREFIX + cityId);
  } catch (e) {
    console.error('Failed to delete city state:', e);
  }
}

interface GameProviderProps {
  children: React.ReactNode;
  startFresh?: boolean;
  municipalitySlug?: string;
  cityName?: string;
  userId?: number;
  isOwner?: boolean;
  municipalityRole?: 'owner' | 'council' | 'citizen' | 'observer';
  canton?: string;
  disablePartnerships?: boolean;
  /** Pre-gefetchte Adjacent Cities (z.B. aus Canton-Daten) – werden sofort gesetzt statt auf API zu warten */
  initialAdjacentCities?: AdjacentCity[];
}

export function GameProvider({ children, startFresh = false, municipalitySlug, cityName: propCityName, userId, isOwner, municipalityRole = 'citizen', canton, disablePartnerships = false, initialAdjacentCities }: GameProviderProps) {
  // Start with a default state, we'll load from localStorage after mount (unless startFresh is true)
  const [state, setState] = useState<GameState>(() => createInitialGameState(DEFAULT_GRID_SIZE, propCityName || 'IsoCity'));
  
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);

  // Bauzone mode loaded from server settings
  const [bauzoneMode, setBauzoneMode] = useState<'disabled' | 'members' | 'all'>('disabled');
  // Transport company state (for bus_stop tool visibility + line creation)
  const [hasTransportCompany, setHasTransportCompany] = useState(false);
  const [hasBusStation, setHasBusStation] = useState(false);
  const transportCompanyIdRef = useRef<number | null>(null);
  const [residencePlacement, setResidencePlacement] = useState<{ variantRow: number; variantCol: number } | null>(null);

  const startResidencePlacement = useCallback((variantRow: number, variantCol: number) => {
    setResidencePlacement({ variantRow, variantCol });
    setState(prev => ({ ...prev, activePanel: 'none', selectedTool: 'select' as Tool }));
  }, []);

  const cancelResidencePlacement = useCallback(() => {
    setResidencePlacement(null);
  }, []);

  // Habbo-style room viewer state
  const [activeRoom, setActiveRoom] = useState<{ userId: number; nickname: string } | null>(null);

  const openResidenceRoom = useCallback((userId: number, nickname: string) => {
    setActiveRoom({ userId, nickname });
  }, []);

  const closeResidenceRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  const [busLineCreationMode, setBusLineCreationMode] = useState<{
    active: boolean;
    companyId: number;
    stops: { x: number; y: number }[];
    lineName: string;
    lineColor: string;
    editingLineId?: number; // If set, we're editing an existing line
  } | null>(null);
  const busLineCreationModeRef = useRef(busLineCreationMode);
  busLineCreationModeRef.current = busLineCreationMode;
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
  // Callback for multiplayer action broadcast
  const placeCallbackRef = useRef<((args: { x: number; y: number; tool: Tool }) => void) | null>(null);
  const bridgeCallbackRef = useRef<((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null>(null);
  
  // Partnership callbacks for WebSocket events
  const partnershipDiscoveredCallbackRef = useRef<((data: { partnerSlug: string; partnerName: string; direction: string }) => void) | null>(null);
  const partnershipConnectedCallbackRef = useRef<((data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number }) => void) | null>(null);

  // Parking system: list of vehicles currently parked on parking lot tiles
  const parkedVehiclesRef = useRef<ParkedVehicle[]>([]);
  const parkingConfigRef = useRef<ParkingConfig[]>([]);
  const parkingViolationsRef = useRef<ParkingViolation[]>([]);

  // Remote Stats Override - wenn gesetzt, werden diese Stats nach jedem Tick angewendet
  // Das verhindert das "Springen" der Zahlen bei Multiplayer
  const remoteStatsOverrideRef = useRef<{
    money?: number;
    population?: number;
    income?: number;
    expenses?: number;
    tax_income?: number;
    tax_income_population?: number;
    tax_income_business?: number;
    tax_income_property?: number;
    building_income?: number;
    company_tax_income?: number;
    budget_expenses?: number;
    budget_cost_police?: number;
    budget_cost_fire?: number;
    budget_cost_health?: number;
    budget_cost_education?: number;
    budget_cost_transportation?: number;
    budget_cost_parks?: number;
    budget_cost_power?: number;
    budget_cost_water?: number;
    maintenance_expenses?: number;
    administration_base_expenses?: number;
    civic_overhead_expenses?: number;
    utility_overhead_expenses?: number;
    jobs?: number;
    happiness?: number;
    employed?: number;
    unemployed?: number;
    unemploymentRate?: number;
    workforce?: number;
    workforceRate?: number;
    children?: number;
    seniors?: number;
    students?: number;
    socialFund?: number;
    socialContributionRate?: number;
    welfarePerUnemployed?: number;
    socialFundIncome?: number;
    socialFundExpenses?: number;
    socialExpenses?: number;
    welfareCoverage?: number;
    schoolCapacity?: number;
    uniCapacity?: number;
    educationOvercrowding?: number;
    healthCapacity?: number;
    healthDemand?: number;
    healthAdequacy?: number;
    year?: number;
    month?: number;
    weatherType?: string;
    weatherIntensity?: number;
    weatherTemperature?: number | null;
    taxRate?: number;
    tick?: number;
    gameSpeed?: number;
    effectiveTaxRate?: number;
    disastersEnabled?: boolean;
    budget?: Budget;
    power_production?: number;
    power_consumption?: number;
    power_season_multiplier?: number;
    power_import_units?: number;
    power_import_cost?: number;
    power_import_price_per_unit?: number;
    power_sold_mw?: number;
    power_bought_mw?: number;
    power_production_effective?: number;
    power_balance_effective?: number;
    power_surplus_pct?: number;
    power_available_to_sell?: number;
    power_buffer_mw?: number;
    power_buffer_pct?: number;
    water_production?: number;
    water_consumption?: number;
    water_net_deficit?: number;
    water_storage_level?: number;
    water_storage_capacity?: number;
    demand_residential?: number;
    demand_commercial?: number;
    demand_industrial?: number;
    zones_residential?: number;
    zones_commercial?: number;
    zones_industrial?: number;
    buildings_residential?: number;
    buildings_commercial?: number;
    buildings_industrial?: number;
  } | null>(null);
  
  // Sprite pack state
  const [currentSpritePack, setCurrentSpritePack] = useState<SpritePack>(() => getSpritePack(DEFAULT_SPRITE_PACK_ID));
  
  // Day/night mode state
  const [dayNightMode, setDayNightModeState] = useState<DayNightMode>('auto');
  
  // Saved cities state for multi-city save system
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  
  // Load game state and sprite pack from localStorage on mount (client-side only)
  useEffect(() => {
    // Load sprite pack preference
    const savedPackId = loadSpritePackId();
    const pack = getSpritePack(savedPackId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);
    
    // Load day/night mode preference
    const savedDayNightMode = loadDayNightMode();
    setDayNightModeState(savedDayNightMode);
    
    // Load saved cities index
    const cities = loadSavedCitiesIndex();
    setSavedCities(cities);
    
    // Load game state (unless startFresh is true - used for co-op to start with a new city)
    if (!startFresh) {
      const saved = loadGameState();
      if (saved) {
        // Adjacent Cities Priorität:
        // 1. Pre-gefetchte Canton-Daten (initialAdjacentCities)
        // 2. localStorage-Cache (letzter bekannter Stand)
        // 3. Leer [] (wird vom Partnership-Auto-Refresh gefüllt)
        const citiesFromProps = initialAdjacentCities && initialAdjacentCities.length > 0
          ? initialAdjacentCities
          : loadCachedAdjacentCities(municipalitySlug || '');
        if (citiesFromProps.length > 0) {
          saved.adjacentCities = citiesFromProps;
        }
        skipNextSaveRef.current = true; // Set skip flag BEFORE updating state
        setState(saved);
        setHasExistingGame(true);
      } else {
        // Kein gespeicherter State – adjacentCities trotzdem setzen
        const citiesFromProps = initialAdjacentCities && initialAdjacentCities.length > 0
          ? initialAdjacentCities
          : loadCachedAdjacentCities(municipalitySlug || '');
        if (citiesFromProps.length > 0) {
          setState(prev => ({ ...prev, adjacentCities: citiesFromProps }));
        }
        setHasExistingGame(false);
      }
    } else {
      setHasExistingGame(false);
    }
    // Mark as loaded immediately - the skipNextSaveRef will handle skipping the first save
    hasLoadedRef.current = true;
    // Mark state as ready - consumers should wait for this before using state
    setIsStateReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFresh]);

  // Load bauzone mode from server when municipalitySlug is available
  useEffect(() => {
    if (!municipalitySlug) return;
    getZoneSettings(municipalitySlug)
      .then(d => setBauzoneMode(d.bauzone_mode))
      .catch(() => {});
  }, [municipalitySlug]);

  // Load transport company status for bus_stop tool visibility
  const loadTransportCompanyStatus = useCallback(async () => {
    try {
      const { getMyCompanies } = await import('@/lib/api/companyApi');
      const companies = await getMyCompanies();
      const transportCompany = companies.find(c => c.type_code === 'transport' && c.is_active);
      setHasTransportCompany(!!transportCompany);
      transportCompanyIdRef.current = transportCompany?.id ?? null;
    } catch {
      setHasTransportCompany(false);
      transportCompanyIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!municipalitySlug) return;
    loadTransportCompanyStatus();
  }, [municipalitySlug, loadTransportCompanyStatus]);

  // Check if a bus_station exists on the grid (only once when state is ready)
  const hasBusStationCheckedRef = useRef(false);
  useEffect(() => {
    if (!isStateReady || hasBusStationCheckedRef.current) return;
    hasBusStationCheckedRef.current = true;
    const grid = state.grid;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
        if ((grid[y][x]?.building?.type as string) === 'bus_station') {
          setHasBusStation(true);
          return;
        }
      }
    }
  }, [isStateReady, state.grid]);

  // Überschreibe cityName mit dem Gemeinde-Namen wenn vorhanden
  useEffect(() => {
    if (!disablePartnerships && propCityName && isStateReady && state.cityName !== propCityName) {
      console.log(`[GameProvider] Überschreibe cityName: "${state.cityName}" → "${propCityName}"`);
      skipNextSaveRef.current = true; // Nicht speichern bei Namensänderung
      setState(prev => ({ ...prev, cityName: propCityName }));
    }
  }, [disablePartnerships, propCityName, isStateReady, state.cityName]);
  
  // Track the state that needs to be saved
  const lastSaveTimeRef = useRef<number>(0);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Update the state to save whenever state changes
  // PERF: Just mark that state has changed - defer expensive deep copy to actual save time
  const stateChangedRef = useRef(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  
  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }
    
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      lastSaveTimeRef.current = Date.now();
      return;
    }
    
    // PERF: Just mark that state changed instead of expensive deep copy every time
    stateChangedRef.current = true;
  }, [state]);
  
  // PERF: Track if a save is in progress to avoid overlapping saves
  const saveInProgressRef = useRef(false);
  
  // Separate effect that actually performs saves on an interval
  useEffect(() => {
    // Wait for initial load - just check once after a short delay
    const checkLoadedTimeout = setTimeout(() => {
      if (!hasLoadedRef.current) {
        return;
      }
      
      // Clear any existing save interval
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      
      // Set up interval to save every 5 seconds
      // PERF: Save operation is broken into chunks internally to avoid blocking
      saveIntervalRef.current = setInterval(() => {
        // Don't save if we just loaded
        if (skipNextSaveRef.current) {
          skipNextSaveRef.current = false;
          return;
        }
        
        // Don't save if a save is already in progress
        if (saveInProgressRef.current) {
          return;
        }
        
        // Don't save if state hasn't changed
        if (!stateChangedRef.current) {
          return;
        }
        
        // Mark save as in progress
        saveInProgressRef.current = true;
        stateChangedRef.current = false;
        setIsSaving(true);
        
        // PERF: No need for structuredClone here - the worker handles everything
        // postMessage internally clones the data when sending to the worker
        saveGameState(latestStateRef.current, () => {
          lastSaveTimeRef.current = Date.now();
          setHasExistingGame(true);
          setIsSaving(false);
          saveInProgressRef.current = false;
        });
      }, 5000); // Save every 5 seconds
    }, 200); // Wait 200ms for initial load
    
    return () => {
      clearTimeout(checkLoadedTimeout);
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // PERF: Track tick count to only sync UI-visible changes to React periodically
  const tickCountRef = useRef(0);
  const lastUiSyncRef = useRef(0);
  
  // Simulation loop - ALWAYS RUNS (Server-synchronisierte Zeit - keine Pause möglich)
  // Grid updates go to ref (canvas reads from ref), React only gets UI updates
  useEffect(() => {
    // Check if running on mobile for performance optimization
    const isMobileDevice = typeof window !== 'undefined' && (
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );

    // Festes Intervall: 500ms Desktop, 750ms Mobile (keine Speed-Kontrolle mehr)
    const interval = isMobileDevice ? 750 : 500;

    const timer = setInterval(() => {
      tickCountRef.current++;
      const now = performance.now();
      
      // PERF: Run simulation and update ref immediately (for canvas)
      // Stelle sicher dass speed immer 1 ist (keine Pause)
      const currentState = latestStateRef.current;
      if (currentState.speed === 0) {
        currentState.speed = 1;
      }
      
      let newState = simulateTick(currentState);
      
      // WICHTIG: Wenn Remote-Stats verfügbar sind, überschreibe die lokalen Stats
      // Das verhindert das "Springen" der Zahlen bei Multiplayer
      const remoteStats = remoteStatsOverrideRef.current;
      if (remoteStats) {
        newState = {
          ...newState,
          stats: {
            ...newState.stats,
            ...(remoteStats.money !== undefined ? { money: remoteStats.money } : {}),
            ...(remoteStats.population !== undefined ? { population: remoteStats.population } : {}),
            ...(remoteStats.income !== undefined ? { income: remoteStats.income } : {}),
            ...(remoteStats.expenses !== undefined ? { expenses: remoteStats.expenses } : {}),
            ...((remoteStats as any).tax_income !== undefined ? { tax_income: (remoteStats as any).tax_income } : {}),
            ...((remoteStats as any).tax_income_population !== undefined ? { tax_income_population: (remoteStats as any).tax_income_population } : {}),
            ...((remoteStats as any).tax_income_business !== undefined ? { tax_income_business: (remoteStats as any).tax_income_business } : {}),
            ...((remoteStats as any).tax_income_property !== undefined ? { tax_income_property: (remoteStats as any).tax_income_property } : {}),
            ...((remoteStats as any).building_income !== undefined ? { building_income: (remoteStats as any).building_income } : {}),
            ...((remoteStats as any).company_tax_income !== undefined ? { company_tax_income: (remoteStats as any).company_tax_income } : {}),
            ...((remoteStats as any).budget_expenses !== undefined ? { budget_expenses: (remoteStats as any).budget_expenses } : {}),
            ...((remoteStats as any).budget_cost_police !== undefined ? { budget_cost_police: (remoteStats as any).budget_cost_police } : {}),
            ...((remoteStats as any).budget_cost_fire !== undefined ? { budget_cost_fire: (remoteStats as any).budget_cost_fire } : {}),
            ...((remoteStats as any).budget_cost_health !== undefined ? { budget_cost_health: (remoteStats as any).budget_cost_health } : {}),
            ...((remoteStats as any).budget_cost_education !== undefined ? { budget_cost_education: (remoteStats as any).budget_cost_education } : {}),
            ...((remoteStats as any).budget_cost_transportation !== undefined ? { budget_cost_transportation: (remoteStats as any).budget_cost_transportation } : {}),
            ...((remoteStats as any).budget_cost_parks !== undefined ? { budget_cost_parks: (remoteStats as any).budget_cost_parks } : {}),
            ...((remoteStats as any).budget_cost_power !== undefined ? { budget_cost_power: (remoteStats as any).budget_cost_power } : {}),
            ...((remoteStats as any).budget_cost_water !== undefined ? { budget_cost_water: (remoteStats as any).budget_cost_water } : {}),
            ...((remoteStats as any).maintenance_expenses !== undefined ? { maintenance_expenses: (remoteStats as any).maintenance_expenses } : {}),
            ...((remoteStats as any).administration_base_expenses !== undefined ? { administration_base_expenses: (remoteStats as any).administration_base_expenses } : {}),
            ...((remoteStats as any).civic_overhead_expenses !== undefined ? { civic_overhead_expenses: (remoteStats as any).civic_overhead_expenses } : {}),
            ...((remoteStats as any).utility_overhead_expenses !== undefined ? { utility_overhead_expenses: (remoteStats as any).utility_overhead_expenses } : {}),
            ...(remoteStats.jobs !== undefined ? { jobs: remoteStats.jobs } : {}),
            ...(remoteStats.happiness !== undefined ? { happiness: remoteStats.happiness } : {}),
            // Power-Felder vom Server beibehalten (werden von simulateTick auf 0 gesetzt)
            ...((remoteStats as any).power_production !== undefined ? { power_production: (remoteStats as any).power_production } : {}),
            ...((remoteStats as any).power_consumption !== undefined ? { power_consumption: (remoteStats as any).power_consumption } : {}),
            ...((remoteStats as any).power_production_effective !== undefined ? { power_production_effective: (remoteStats as any).power_production_effective } : {}),
            ...((remoteStats as any).power_balance_effective !== undefined ? { power_balance_effective: (remoteStats as any).power_balance_effective } : {}),
            ...((remoteStats as any).power_season_multiplier !== undefined ? { power_season_multiplier: (remoteStats as any).power_season_multiplier } : {}),
            ...((remoteStats as any).power_import_units !== undefined ? { power_import_units: (remoteStats as any).power_import_units } : {}),
            ...((remoteStats as any).power_import_cost !== undefined ? { power_import_cost: (remoteStats as any).power_import_cost } : {}),
            ...((remoteStats as any).power_import_price_per_unit !== undefined ? { power_import_price_per_unit: (remoteStats as any).power_import_price_per_unit } : {}),
            ...((remoteStats as any).power_sold_mw !== undefined ? { power_sold_mw: (remoteStats as any).power_sold_mw } : {}),
            ...((remoteStats as any).power_bought_mw !== undefined ? { power_bought_mw: (remoteStats as any).power_bought_mw } : {}),
            ...((remoteStats as any).power_surplus_pct !== undefined ? { power_surplus_pct: (remoteStats as any).power_surplus_pct } : {}),
            ...((remoteStats as any).power_available_to_sell !== undefined ? { power_available_to_sell: (remoteStats as any).power_available_to_sell } : {}),
            ...((remoteStats as any).power_buffer_mw !== undefined ? { power_buffer_mw: (remoteStats as any).power_buffer_mw } : {}),
            ...((remoteStats as any).power_buffer_pct !== undefined ? { power_buffer_pct: (remoteStats as any).power_buffer_pct } : {}),
            ...((remoteStats as any).water_production !== undefined ? { water_production: (remoteStats as any).water_production } : {}),
            ...((remoteStats as any).water_consumption !== undefined ? { water_consumption: (remoteStats as any).water_consumption } : {}),
            ...((remoteStats as any).water_net_deficit !== undefined ? { water_net_deficit: (remoteStats as any).water_net_deficit } : {}),
            ...((remoteStats as any).water_storage_level !== undefined ? { water_storage_level: (remoteStats as any).water_storage_level } : {}),
            ...((remoteStats as any).water_storage_capacity !== undefined ? { water_storage_capacity: (remoteStats as any).water_storage_capacity } : {}),
            ...((remoteStats as any).safety !== undefined ? { safety: (remoteStats as any).safety } : {}),
            ...((remoteStats as any).health !== undefined ? { health: (remoteStats as any).health } : {}),
            ...((remoteStats as any).education !== undefined ? { education: (remoteStats as any).education } : {}),
            ...((remoteStats as any).environment !== undefined ? { environment: (remoteStats as any).environment } : {}),
            ...((remoteStats as any).happinessTaxComponent !== undefined ? { happiness_tax_component: (remoteStats as any).happinessTaxComponent } : {}),
            ...((remoteStats as any).happinessWeatherPenalty !== undefined ? { happiness_weather_penalty: (remoteStats as any).happinessWeatherPenalty } : {}),
            ...((remoteStats as any).happinessCrimePenalty !== undefined ? { happiness_crime_penalty: (remoteStats as any).happinessCrimePenalty } : {}),
            ...((remoteStats as any).happinessUnemploymentPenalty !== undefined ? { happiness_unemployment_penalty: (remoteStats as any).happinessUnemploymentPenalty } : {}),
            ...((remoteStats as any).employed !== undefined ? { employed: (remoteStats as any).employed } : {}),
            ...((remoteStats as any).unemployed !== undefined ? { unemployed: (remoteStats as any).unemployed } : {}),
            ...((remoteStats as any).unemploymentRate !== undefined ? { unemployment_rate: (remoteStats as any).unemploymentRate } : {}),
            ...((remoteStats as any).workforce !== undefined ? { workforce: (remoteStats as any).workforce } : {}),
            ...((remoteStats as any).workforceRate !== undefined ? { workforce_rate: (remoteStats as any).workforceRate } : {}),
            ...((remoteStats as any).children !== undefined ? { children: (remoteStats as any).children } : {}),
            ...((remoteStats as any).seniors !== undefined ? { seniors: (remoteStats as any).seniors } : {}),
            ...((remoteStats as any).students !== undefined ? { students: (remoteStats as any).students } : {}),
            ...((remoteStats as any).socialFund !== undefined ? { social_fund: (remoteStats as any).socialFund } : {}),
            ...((remoteStats as any).socialContributionRate !== undefined ? { social_contribution_rate: (remoteStats as any).socialContributionRate } : {}),
            ...((remoteStats as any).welfarePerUnemployed !== undefined ? { welfare_per_unemployed: (remoteStats as any).welfarePerUnemployed } : {}),
            ...((remoteStats as any).socialFundIncome !== undefined ? { social_fund_income: (remoteStats as any).socialFundIncome } : {}),
            ...((remoteStats as any).socialFundExpenses !== undefined ? { social_fund_expenses: (remoteStats as any).socialFundExpenses } : {}),
            ...((remoteStats as any).socialExpenses !== undefined ? { social_expenses: (remoteStats as any).socialExpenses } : {}),
            ...((remoteStats as any).welfareCoverage !== undefined ? { welfare_coverage: (remoteStats as any).welfareCoverage } : {}),
            ...((remoteStats as any).schoolCapacity !== undefined ? { school_capacity: (remoteStats as any).schoolCapacity } : {}),
            ...((remoteStats as any).uniCapacity !== undefined ? { uni_capacity: (remoteStats as any).uniCapacity } : {}),
            ...((remoteStats as any).educationOvercrowding !== undefined ? { education_overcrowding: (remoteStats as any).educationOvercrowding } : {}),
            ...((remoteStats as any).healthCapacity !== undefined ? { health_capacity: (remoteStats as any).healthCapacity } : {}),
            ...((remoteStats as any).healthDemand !== undefined ? { health_demand: (remoteStats as any).healthDemand } : {}),
            ...((remoteStats as any).healthAdequacy !== undefined ? { health_adequacy: (remoteStats as any).healthAdequacy } : {}),
          },
          ...(remoteStats.year !== undefined ? { year: remoteStats.year } : {}),
          ...(remoteStats.month !== undefined ? { month: remoteStats.month } : {}),
          ...(remoteStats.weatherType !== undefined ? { weatherType: remoteStats.weatherType } : {}),
          ...(remoteStats.weatherIntensity !== undefined ? { weatherIntensity: remoteStats.weatherIntensity } : {}),
          ...(remoteStats.weatherTemperature !== undefined ? { weatherTemperature: remoteStats.weatherTemperature } : {}),
          ...(remoteStats.taxRate !== undefined ? { taxRate: remoteStats.taxRate } : {}),
          ...(remoteStats.tick !== undefined ? { tick: remoteStats.tick } : {}),
          ...(remoteStats.gameSpeed !== undefined
            ? { speed: clamp(Math.round(remoteStats.gameSpeed), 0, 3) as 0 | 1 | 2 | 3 }
            : {}),
          ...(remoteStats.effectiveTaxRate !== undefined
            ? { effectiveTaxRate: clamp(Math.round(remoteStats.effectiveTaxRate), 0, 100) }
            : {}),
          ...(typeof remoteStats.disastersEnabled === 'boolean'
            ? { disastersEnabled: remoteStats.disastersEnabled }
            : {}),
          ...(remoteStats.budget ? { budget: remoteStats.budget } : {}),
        };
      }
      
      latestStateRef.current = newState;
      stateChangedRef.current = true;
      
      // PERF: Only sync to React every 500ms to avoid expensive reconciliation
      // Canvas reads from latestStateRef so it sees updates immediately
      // React state is only needed for UI elements (stats, budget display)
      if (now - lastUiSyncRef.current >= 500) {
        lastUiSyncRef.current = now;
        // WICHTIG: Updater-Funktion statt direktem Wert verwenden!
        // setState(newState) würde ausstehende placeAtTile-Änderungen überschreiben.
        // setState(() => latestStateRef.current) liest den AKTUELLSTEN Wert,
        // inklusive Änderungen die placeAtTile zwischenzeitlich in latestStateRef geschrieben hat.
        setState(() => latestStateRef.current);
      }
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, []); // Keine Abhängigkeit von speed mehr - läuft immer

  const setTool = useCallback((tool: Tool) => {
    setState((prev) => ({ ...prev, selectedTool: tool, activePanel: 'none' }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setTaxRate = useCallback((rate: number) => {
    const clampedRate = clamp(rate, 0, 100);
    latestStateRef.current = {
      ...latestStateRef.current,
      taxRate: clampedRate,
    };
    setState((prev) => ({ ...prev, taxRate: clampedRate }));
    // Steuersatz server-authoritativ speichern (wie Budget-Regler).
    deltaQueue.sendStats({ taxRate: clampedRate });
  }, []);

  const setActivePanel = useCallback(
    (panel: GameState['activePanel']) => {
      setState((prev) => ({ ...prev, activePanel: panel }));
    },
    [],
  );

  const setBudgetFunding = useCallback(
    (key: keyof Budget, funding: number) => {
      const clamped = clamp(funding, 0, 100);
      latestStateRef.current = {
        ...latestStateRef.current,
        budget: {
          ...latestStateRef.current.budget,
          [key]: { ...latestStateRef.current.budget[key], funding: clamped },
        },
      };
      setState((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [key]: { ...prev.budget[key], funding: clamped },
        },
      }));
      // Budget-Änderung an Server senden (server-authoritative)
      const fullBudget = latestStateRef.current.budget;
      const budgetPayload: Record<string, { funding: number }> = {};
      for (const k of Object.keys(fullBudget) as (keyof Budget)[]) {
        budgetPayload[k] = { funding: fullBudget[k].funding };
      }
      deltaQueue.sendBudgetUpdate(budgetPayload);
    },
    [],
  );

  const setSocialContributionRate = useCallback((rate: number) => {
    const clamped = clamp(Math.round(rate), 0, 15);
    latestStateRef.current = {
      ...latestStateRef.current,
      stats: { ...latestStateRef.current.stats, social_contribution_rate: clamped },
    };
    setState((prev) => ({
      ...prev,
      stats: { ...prev.stats, social_contribution_rate: clamped },
    }));
    deltaQueue.sendStats({ socialContributionRate: clamped });
  }, []);

  const setWelfarePerUnemployed = useCallback((amount: number) => {
    const clamped = clamp(Math.round(amount), 0, 50);
    latestStateRef.current = {
      ...latestStateRef.current,
      stats: { ...latestStateRef.current.stats, welfare_per_unemployed: clamped },
    };
    setState((prev) => ({
      ...prev,
      stats: { ...prev.stats, welfare_per_unemployed: clamped },
    }));
    deltaQueue.sendStats({ welfarePerUnemployed: clamped });
  }, []);

  const placeAtTile = useCallback((x: number, y: number, isRemote = false, overrideTool?: Tool) => {
    // ── Bus line creation mode: clicking a bus_stop adds it as a line stop ──
    if (busLineCreationModeRef.current?.active && !isRemote) {
      const tile = latestStateRef.current.grid[y]?.[x];
      if (tile && (tile.building.type as string) === 'bus_stop') {
        setBusLineCreationMode(prev => {
          if (!prev?.active) return prev;
          if (prev.stops.some(s => s.x === x && s.y === y)) return prev;
          return { ...prev, stops: [...prev.stops, { x, y }] };
        });
        return;
      }
      // Fall through to normal placement — if a bus_stop gets placed,
      // automatically add it to the line afterwards
    }

    // For multiplayer broadcast, we need to capture the tool synchronously
    // before React batches the setState. We read from the latest state ref.
    const currentTool = latestStateRef.current.selectedTool;
    let placementSucceeded = false;
    let placedTool: Tool = currentTool;

    setState((prev) => {
      // Use overrideTool for remote actions (avoids React batching issues)
      const tool = overrideTool || prev.selectedTool;
      if (tool === 'select') return prev;
      // NPC-Tools werden im Pedestrian-System behandelt, nicht im GameState
      if (tool === 'npc_woodcutter' || tool === 'npc_gardener' || tool === 'npc_police_chase' || tool === 'npc_gangster' || tool === 'npc_buenzli') return prev;
      // Inspect-Tool wird in CanvasIsometricGrid behandelt
      if (tool === 'inspect') return prev;

      // ── Bauzone tools (set/remove building zone markers) ──────────
      if (tool === 'bauzone' || tool === 'bauzone_remove') {
        const bTile = prev.grid[y]?.[x];
        if (!bTile) return prev;
        const wantBauzone = tool === 'bauzone';
        if (!!bTile.bauzone === wantBauzone) return prev;
        const newGrid = prev.grid.map((row, gy) =>
          gy === y
            ? row.map((t, gx) =>
                gx === x ? { ...t, bauzone: wantBauzone || undefined } : t
              )
            : row
        );
        placementSucceeded = true;
        placedTool = tool;
        const bzState = { ...prev, grid: newGrid };
        latestStateRef.current = bzState;
        return bzState;
      }

      // ── Furni placement (Habbo-style furniture) ──────────────────
      if (typeof tool === 'string' && tool.startsWith('furni_')) {
        const tile = prev.grid[y]?.[x];
        if (!tile) return prev;
        // Can only place furni on grass or empty tiles
        if (tile.building.type !== 'grass' && tile.building.type !== 'empty') return prev;
        // Extract classname from tool: "furni_ads_calip_cola" → "ads_calip_cola"
        const furniClassname =
          (typeof window !== 'undefined' && window.sessionStorage.getItem('isocity_furni_classname')) ||
          tool.replace(/^furni_/, '');

        const furniBuilding: Building = {
          type: 'furni',
          level: 1,
          population: 0,
          jobs: 0,
          powered: false,
          watered: false,
          onFire: false,
          fireProgress: 0,
          age: 0,
          constructionProgress: 100,
          abandoned: false,
          furniClassname,
          furniDirection: 2,
          furniState: 0,
        };

        const newGrid = prev.grid.map((row, gy) =>
          gy === y
            ? row.map((t, gx) =>
                gx === x
                  ? { ...t, building: furniBuilding, zone: 'none' as const }
                  : t
              )
            : row
        );

        placementSucceeded = true;
        placedTool = tool;
        const furniState = { ...prev, grid: newGrid };
        latestStateRef.current = furniState;
        return furniState;
      }

      const info = TOOL_INFO[tool];
      const cost = info?.cost ?? 0;
      const tile = prev.grid[y]?.[x];

      if (!tile) return prev;
      if (cost > 0 && prev.stats.money < cost) return prev;

      // Prevent wasted spend if nothing would change
      if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
        return prev;
      }

      // ── Bauzone enforcement based on mode ──
      if (bauzoneMode !== 'disabled') {
        const mustFollow =
          bauzoneMode === 'all' ? municipalityRole !== 'owner'
          : bauzoneMode === 'members' ? municipalityRole === 'citizen'
          : false;
        if (mustFollow) {
          const bauzoneExists = prev.grid.some(row => row.some(t => t.bauzone));
          if (bauzoneExists && !tile.bauzone) {
            return prev;
          }
        }
      }

      const building = toolBuildingMap[tool];
      const zone = toolZoneMap[tool];

      if (zone && tile.zone === zone) return prev;
      if (building && tile.building.type === building) return prev;

      // Landmark-Gebäude: nur in der richtigen Stadt baubar & nur 1x
      const LANDMARK_CITY: Record<string, string> = {
        fcbasel_stadium: 'basel',
        st_ursen_kathedrale: 'solothurn',
        primetower: 'zurich',
        disco_solothurn: 'solothurn',
      };
      if (building && LANDMARK_CITY[building]) {
        // Falsche Stadt → blockieren
        if (municipalitySlug !== LANDMARK_CITY[building]) return prev;
        // Bereits vorhanden → blockieren
        const alreadyExists = prev.grid.some(row => row.some(t => t.building.type === building));
        if (alreadyExists) return prev;
      }
      
      // Handle subway tool separately (underground placement)
      if (tool === 'subway') {
        // Can't place subway under water
        if (tile.building.type === 'water') return prev;

        // Tile already has subway line → place a station on top if surface is free
        if (tile.hasSubway) {
          const buildable = ['grass', 'tree', 'tree_pine', 'tree_palm', 'tree_deciduous'];
          if (!buildable.includes(tile.building.type)) return prev;
          const stationCost = TOOL_INFO['subway_station']?.cost ?? 750;
          if (prev.stats.money < stationCost) return prev;
          const nextState = placeBuilding(prev, x, y, 'subway_station', null);
          if (nextState === prev) return prev;
          placementSucceeded = true;
          placedTool = 'subway_station';
          const stationState = {
            ...nextState,
            stats: { ...nextState.stats, money: nextState.stats.money - stationCost },
          };
          latestStateRef.current = stationState;
          return stationState;
        }

        const nextState = placeSubway(prev, x, y);
        if (nextState === prev) return prev;

        placementSucceeded = true;
        placedTool = tool;
        const subwayState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
        latestStateRef.current = subwayState;
        return subwayState;
      }
      
      // Handle water terraform tool separately
      if (tool === 'zone_water') {
        // Already water - do nothing
        if (tile.building.type === 'water') return prev;
        // Don't allow terraforming bridges - would break them
        if (tile.building.type === 'bridge') return prev;
        
        const nextState = placeWaterTerraform(prev, x, y);
        if (nextState === prev) return prev;
        
        placementSucceeded = true;
        placedTool = tool;
        const waterState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
        latestStateRef.current = waterState;
        return waterState;
      }
      
      // Handle land terraform tool separately
      if (tool === 'zone_land') {
        // Only works on water
        if (tile.building.type !== 'water') return prev;
        
        const nextState = placeLandTerraform(prev, x, y);
        if (nextState === prev) return prev;
        
        placementSucceeded = true;
        placedTool = tool;
        const landState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
        latestStateRef.current = landState;
        return landState;
      }

      // Handle terrain elevation tools
      if (tool === 'terrain_raise' || tool === 'terrain_lower' || tool === 'terrain_lower2' || tool === 'terrain_hill' || tool === 'terrain_mountain' || tool === 'terrain_flatten') {
        // Can't modify water tiles
        if (tile.building.type === 'water') return prev;
        // Can't raise terrain on buildings (only grass/trees/empty) - lower/flatten allowed on any land
        const isRaising = tool === 'terrain_raise' || tool === 'terrain_hill' || tool === 'terrain_mountain';
        if (isRaising && tile.building.type !== 'grass' && tile.building.type !== 'tree' && tile.building.type !== 'empty') return prev;
        
        const currentElevation = tile.elevation || 0;
        let targetElevation: number;
        
        if (tool === 'terrain_raise') {
          targetElevation = Math.min(6, currentElevation + 1);
        } else if (tool === 'terrain_lower') {
          targetElevation = Math.max(-6, currentElevation - 1);
        } else if (tool === 'terrain_lower2') {
          targetElevation = Math.max(-6, currentElevation - 2);
        } else if (tool === 'terrain_hill') {
          targetElevation = 2;
        } else if (tool === 'terrain_mountain') {
          targetElevation = 4;
        } else {
          // terrain_flatten
          targetElevation = 0;
        }
        
        // Nothing to change
        if (currentElevation === targetElevation) return prev;
        
        const newGrid = prev.grid.map((row, gy) =>
          gy === y
            ? row.map((t, gx) =>
                gx === x
                  ? { ...t, elevation: targetElevation }
                  : t
              )
            : row
        );
        
        placementSucceeded = true;
        placedTool = tool;
        const terrainState = {
          ...prev,
          grid: newGrid,
          stats: cost > 0 ? { ...prev.stats, money: prev.stats.money - cost } : prev.stats,
        };
        latestStateRef.current = terrainState;
        return terrainState;
      }
      
      // Handle paint tools
      const paintToolMap: Partial<Record<Tool, TilePaintColor | 'reset'>> = {
        paint_green: 'green',
        paint_sand: 'sand',
        paint_dirt: 'dirt',
        paint_snow: 'snow',
        paint_dark_grass: 'dark_grass',
        paint_rock: 'rock',
        paint_reset: 'reset',
      };
      
      const paintColor = paintToolMap[tool];
      if (paintColor !== undefined) {
        // Can't paint water tiles
        if (tile.building.type === 'water') return prev;
        
        const newPaintColor = paintColor === 'reset' ? undefined : paintColor;
        // Nothing to change
        if (tile.paintColor === newPaintColor) return prev;
        
        const newGrid = prev.grid.map((row, gy) =>
          gy === y
            ? row.map((t, gx) =>
                gx === x
                  ? { ...t, paintColor: newPaintColor }
                  : t
              )
            : row
        );
        
        placementSucceeded = true;
        placedTool = tool;
        const paintState = {
          ...prev,
          grid: newGrid,
          stats: cost > 0 ? { ...prev.stats, money: prev.stats.money - cost } : prev.stats,
        };
        latestStateRef.current = paintState;
        return paintState;
      }

      let nextState: GameState;

      if (tool === 'bulldoze') {
        nextState = bulldozeTile(prev, x, y);
      } else if (zone) {
        nextState = placeBuilding(prev, x, y, null, zone);
      } else if (building) {
        nextState = placeBuilding(prev, x, y, building, null);
      } else {
        return prev;
      }

      if (nextState === prev) return prev;

      if (cost > 0) {
        nextState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      placementSucceeded = true;
      placedTool = tool;

      // WICHTIG: latestStateRef sofort aktualisieren, damit der Simulations-Timer
      // bei seinem nächsten Tick den neuen Grid-State (mit Zonen-/Gebäude-Änderung)
      // sieht und ihn nicht mit dem alten State überschreibt.
      latestStateRef.current = nextState;

      return nextState;
    });
    
    // Play placement sound on successful local placement
    if (placementSucceeded && !isRemote) {
      playPlacementSound(placedTool);
      // Update hasBusStation when a bus_station is placed
      if (placedTool === 'bus_station') setHasBusStation(true);
      // Auto-add newly placed bus_stop to line in creation mode
      if (placedTool === 'bus_stop' && busLineCreationModeRef.current?.active) {
        setBusLineCreationMode(prev => {
          if (!prev?.active) return prev;
          if (prev.stops.some(s => s.x === x && s.y === y)) return prev;
          return { ...prev, stops: [...prev.stops, { x, y }] };
        });
      }
    }

    // Inventory flow: wenn ein Item via "Place to room" armed wurde,
    // beim ersten erfolgreichen Platzieren serverseitig Menge reduzieren.
    if (placementSucceeded && !isRemote && typeof window !== 'undefined') {
      const armedInventoryItem = window.sessionStorage.getItem('isocity_inventory_place_item');
      if (armedInventoryItem && armedInventoryItem === placedTool) {
        window.sessionStorage.removeItem('isocity_inventory_place_item');
        window.sessionStorage.removeItem('isocity_furni_classname');
        const token = window.localStorage.getItem('isocity_auth_token');
        const baseUrl =
          process.env.NEXT_PUBLIC_CORE_API_URL ||
          process.env.NEXT_PUBLIC_AUTH_API_URL ||
          'http://127.0.0.1:4100';

        if (token) {
          void fetch(`${baseUrl}/api/game/user-data/inventory`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-Game-Token': token,
            },
            body: JSON.stringify({
              item_code: armedInventoryItem,
              delta: -1,
            }),
          })
            .then(() => {
              window.dispatchEvent(new CustomEvent('isocity-inventory-updated'));
            })
            .catch(() => {
              // Bei API-Fehlern keine harte Unterbrechung des Gameflows.
            });
        }

        // Nach einem platzierten Inventory-Item wieder in den Select-Modus.
        setState((prev) => ({ ...prev, selectedTool: 'select' }));
      }
    }

    // Broadcast to multiplayer if this is a local action (not remote)
    // We use the tool captured before setState since React 18 batches async
    if (!isRemote && currentTool !== 'select' && placeCallbackRef.current) {
      placeCallbackRef.current({ x, y, tool: currentTool });
    }
  }, []);

  const upgradeServiceBuildingHandler = useCallback((x: number, y: number) => {
    // Server-authoritative: Upgrade-Request an Server senden
    deltaQueue.sendUpgradeBuilding(x, y).then((response) => {
      if (!response.success) {
        console.warn('[Upgrade] Server hat abgelehnt:', response.error);
        return;
      }
      const serverData = response.data;
      if (!serverData) return;

      // Server hat OK gegeben → lokalen State updaten
      setState((prev) => {
        const tile = prev.grid[y]?.[x];
        if (!tile) return prev;
        const newGrid = prev.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
        const b = newGrid[y][x].building;

        if (serverData.upgradeStartedAt) {
          // Upgrade mit Wartezeit
          b.upgradeStartedAt = serverData.upgradeStartedAt;
          b.upgradeTargetLevel = serverData.upgradeTargetLevel;
          b.constructionProgress = 0;
        } else {
          // Sofort-Upgrade (z.B. woodcutter_house)
          b.level = serverData.newLevel;
        }
        return { ...prev, grid: newGrid };
      });
    });
    return true;
  }, []);

  const repairAtTileHandler = useCallback((x: number, y: number) => {
    // Server-authoritative: Repair-Request an Server senden
    deltaQueue.sendRepairBuilding(x, y).then((response) => {
      if (!response.success) {
        console.warn('[Repair] Server hat abgelehnt:', response.error);
        return;
      }
      const serverData = response.data;
      if (!serverData) return;

      // Server hat OK gegeben → lokalen State updaten
      setState((prev) => {
        const tile = prev.grid[y]?.[x];
        if (!tile) return prev;
        const next = repairBuilding(prev, x, y);
        return next;
      });
    });
    return true;
  }, []);

  const flipBuildingAtTileHandler = useCallback((x: number, y: number) => {
    let flipSucceeded = false;
    setState((prev) => {
      const tile = prev.grid[y]?.[x];
      if (!tile || tile.building.type === 'grass' || tile.building.type === 'water') return prev;
      // Nicht drehen: Strassen, Schienen, Brücken
      const nonFlippable = ['road', 'rail', 'subway', 'bridge', 'grass', 'water', 'empty'];
      if (nonFlippable.includes(tile.building.type)) return prev;
      const newGrid = prev.grid.map((row) => row.map((t) => ({
        ...t,
        building: { ...t.building },
      })));
      newGrid[y][x].building.flipped = !newGrid[y][x].building.flipped;
      flipSucceeded = true;
      return {
        ...prev,
        grid: newGrid,
        gameVersion: (prev.gameVersion || 0) + 1,
      };
    });
    return flipSucceeded;
  }, []);

  // Called after a road/rail drag operation to create bridges for water crossings
  const finishTrackDrag = useCallback((pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote = false) => {
    setState((prev) => createBridgesOnPath(prev, pathTiles, trackType));
    
    // Broadcast to multiplayer if this is a local action (not remote)
    if (!isRemote && bridgeCallbackRef.current) {
      bridgeCallbackRef.current({ pathTiles, trackType });
    }
  }, []);

  const connectToCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.connected) return prev;

      // Mark city as connected (and discovered if not already) and add trade income
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, connected: true, discovered: true } : c
      );

      // Add trade income bonus (one-time bonus + monthly income)
      const tradeBonus = 5000;
      const tradeIncome = 200; // Monthly income from trade

      return {
        ...prev,
        adjacentCities: updatedCities,
        stats: {
          ...prev.stats,
          money: prev.stats.money + tradeBonus,
          income: prev.stats.income + tradeIncome,
        },
        notifications: [
          {
            id: `city-connect-${Date.now()}`,
            title: 'City Connected!',
            description: `Trade route established with ${city.name}. +$${tradeBonus} bonus and +$${tradeIncome}/month income.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  // Aktualisiere Nachbar-Gemeinden (für Kanton-basierte Gemeinden)
  const setAdjacentCities = useCallback((cities: AdjacentCity[]) => {
    setState((prev) => ({
      ...prev,
      adjacentCities: cities,
    }));
  }, []);

  // Gewässer umbenennen (See/Ozean)
  const renameWaterBody = useCallback((id: string, newName: string) => {
    setState((prev) => {
      const idx = prev.waterBodies.findIndex(wb => wb.id === id);
      if (idx === -1) return prev;
      const updated = [...prev.waterBodies];
      updated[idx] = { ...updated[idx], name: newName };
      return { ...prev, waterBodies: updated };
    });
  }, []);

  const discoverCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.discovered) return prev;

      // Mark city as discovered
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, discovered: true } : c
      );

      return {
        ...prev,
        adjacentCities: updatedCities,
        notifications: [
          {
            id: `city-discover-${Date.now()}`,
            title: 'City Discovered!',
            description: `Your road has reached the ${city.direction} border! You can now connect to ${city.name}.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  // DEAKTIVIERT: Auto-Discovery über Straßen am Kartenrand
  // Nachbar-Gemeinden werden NUR über das Trade-Partner-System (API) verwaltet.
  // Die Funktion bleibt als No-Op erhalten, damit bestehende Aufrufe nicht crashen.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkAndDiscoverCities = useCallback((_onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void): void => {
    // No-Op: Partnerschaften werden über loadPartnershipsFromApi() geladen
  }, []);

  const setDisastersEnabled = useCallback((_enabled: boolean) => {
    // Client darf Katastrophen nicht mehr steuern.
    // Quelle ist ausschließlich der Server (game_map_data.settings.disastersEnabled).
    if (typeof window !== 'undefined') {
      console.log('[GameContext] ℹ️ setDisastersEnabled ignoriert (server-authoritative)');
    }
  }, []);
  
  const setPlaceCallback = useCallback((callback: ((args: { x: number; y: number; tool: Tool }) => void) | null) => {
    placeCallbackRef.current = callback;
  }, []);

  const setBridgeCallback = useCallback((callback: ((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null) => {
    bridgeCallbackRef.current = callback;
  }, []);

  // Partnership callbacks für WebSocket-Events
  const setPartnershipDiscoveredCallback = useCallback((callback: ((data: { partnerSlug: string; partnerName: string; direction: string }) => void) | null) => {
    partnershipDiscoveredCallbackRef.current = callback;
  }, []);

  const setPartnershipConnectedCallback = useCallback((callback: ((data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number }) => void) | null) => {
    partnershipConnectedCallbackRef.current = callback;
  }, []);

  // API-basierte Partnership-Funktionen
  const loadPartnershipsFromApi = useCallback(async () => {
    if (disablePartnerships) {
      setState((prev) => {
        if ((prev.adjacentCities?.length || 0) === 0 && Number(prev.tradeIncome || 0) === 0) return prev;
        return {
          ...prev,
          adjacentCities: [],
          tradeIncome: 0,
        };
      });
      return;
    }
    if (!municipalitySlug) {
      console.log('[GameContext] ⚠️ Kein municipalitySlug - Partnerschaften können nicht geladen werden');
      return;
    }

    try {
      const response = await partnershipApi.getPartnerships(municipalitySlug);
      
      if (response.success && response.data.partnerships) {
        setState((prev) => {
          // NEUE Arrays mit neuen Objekten erstellen (React Immutability!)
          const usedPartnerSlugs = new Set<string>();

          // 1. Bestehende adjacentCities aktualisieren (neue Objekte, keine Mutation)
          const updatedCities = prev.adjacentCities.map(city => {
            const dbPartnership = response.data.partnerships.find(
              p => (city.slug && p.partner.slug === city.slug) ||
                   p.partner.name.toLowerCase() === city.name.toLowerCase()
            );
            if (dbPartnership) {
              usedPartnerSlugs.add(dbPartnership.partner.slug);
              return {
                ...city,  // Neues Objekt!
                slug: dbPartnership.partner.slug,
                direction: dbPartnership.direction,
                discovered: dbPartnership.status === 'discovered' || dbPartnership.status === 'connected',
                connected: dbPartnership.status === 'connected',
              };
            }
            return city;
          });

          // 2. Neue Partnerships hinzufügen die NICHT in adjacentCities existieren
          for (const p of response.data.partnerships) {
            if (usedPartnerSlugs.has(p.partner.slug)) continue;
            
            const alreadyExists = updatedCities.some(
              c => c.slug === p.partner.slug ||
                   c.name.toLowerCase() === p.partner.name.toLowerCase()
            );
            if (!alreadyExists) {
              updatedCities.push({
                id: p.partner.slug,
                name: p.partner.name,
                slug: p.partner.slug,
                direction: p.direction,
                discovered: p.status === 'discovered' || p.status === 'connected',
                connected: p.status === 'connected',
              });

            }
          }

          // In localStorage cachen für nächsten Seitenlade (sofort verfügbar)
          if (municipalitySlug) {
            saveCachedAdjacentCities(municipalitySlug, updatedCities);
          }

          return {
            ...prev,
            adjacentCities: updatedCities,
            stats: {
              ...prev.stats,
              income: prev.stats.income - (prev.tradeIncome || 0) + response.data.total_trade_income,
            },
            tradeIncome: response.data.total_trade_income,
          };
        });


      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('[GameContext] ⚠️ Partnerships noch nicht verfügbar (404), starte ohne Trade-Daten');
      } else {
        console.error('[GameContext] ❌ Fehler beim Laden der Partnerschaften:', error);
      }
    }
  }, [disablePartnerships, municipalitySlug]);

  // Auto-Refresh der Partnerschaften: damit neue Verbindungen (z.B. nach Anfrage-Akzeptanz)
  // auch ohne Seitenreload auf beiden Gemeinden in der Map sichtbar werden.
  useEffect(() => {
    if (disablePartnerships) return;
    if (!municipalitySlug) return;
    const tick = () => {
      loadPartnershipsFromApi().catch(() => {
        // Fehler bewusst schlucken, nächster Tick versucht erneut.
      });
    };
    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, [disablePartnerships, municipalitySlug, loadPartnershipsFromApi]);

  // Werkhof-Reparatur-Abschluss: Window-Event vom Werkhof-LKW (vehicleSystems.ts) → Socket
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { x: number; y: number } | undefined;
      if (!detail) return;
      deltaQueue.werkhofRepairComplete(detail.x, detail.y);
    };
    window.addEventListener('werkhof-repair-complete', handler);
    return () => window.removeEventListener('werkhof-repair-complete', handler);
  }, []);

  const discoverCityWithApi = useCallback(async (cityId: string) => {
    if (!municipalitySlug) {
      console.log('[GameContext] ⚠️ Kein municipalitySlug - Discover nicht möglich');
      // Fallback auf lokale Logik
      discoverCity(cityId);
      return;
    }

    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.discovered) return prev;

      // Lokale State-Aktualisierung sofort
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, discovered: true } : c
      );

      // API-Call im Hintergrund
      const partnerSlug = city.slug || city.name.toLowerCase().replace(/\s+/g, '-');
      partnershipApi.discoverPartnership(municipalitySlug, partnerSlug, city.direction, city.name)
        .then((response) => {
          console.log('[GameContext] ✅ Partnerschaft entdeckt (API):', response.data.message);
          
          // WebSocket-Broadcast
          if (partnershipDiscoveredCallbackRef.current) {
            partnershipDiscoveredCallbackRef.current({
              partnerSlug,
              partnerName: city.name,
              direction: city.direction,
            });
          }
        })
        .catch((error) => {
          console.error('[GameContext] ❌ Fehler beim Discover (API):', error);
        });

      return {
        ...prev,
        adjacentCities: updatedCities,
        notifications: [
          {
            id: `city-discover-${Date.now()}`,
            title: 'Stadt entdeckt!',
            description: `Deine Straße hat die ${city.direction === 'north' ? 'nördliche' : city.direction === 'south' ? 'südliche' : city.direction === 'east' ? 'östliche' : 'westliche'} Grenze erreicht! Du kannst jetzt eine Verbindung zu ${city.name} herstellen.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9),
        ],
      };
    });
  }, [municipalitySlug, discoverCity]);

  const connectToCityWithApi = useCallback(async (cityId: string) => {
    if (!municipalitySlug) {
      console.log('[GameContext] ⚠️ Kein municipalitySlug - Connect nicht möglich');
      // Fallback auf lokale Logik
      connectToCity(cityId);
      return;
    }

    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.connected) return prev;

      // Lokale State-Aktualisierung sofort
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, connected: true, discovered: true } : c
      );

      const tradeBonus = 5000;
      const tradeIncome = 200;

      // API-Call im Hintergrund
      const partnerSlug = city.slug || city.name.toLowerCase().replace(/\s+/g, '-');
      partnershipApi.connectPartnership(municipalitySlug, partnerSlug)
        .then((response) => {
          console.log('[GameContext] ✅ Handelsroute etabliert (API):', response.data.message);
          
          // WebSocket-Broadcast
          if (partnershipConnectedCallbackRef.current) {
            partnershipConnectedCallbackRef.current({
              partnerSlug,
              partnerName: city.name,
              bonusPaid: response.data.bonus_paid,
              monthlyIncome: response.data.monthly_income,
            });
          }
        })
        .catch((error) => {
          console.error('[GameContext] ❌ Fehler beim Connect (API):', error);
        });

      return {
        ...prev,
        adjacentCities: updatedCities,
        stats: {
          ...prev.stats,
          money: prev.stats.money + tradeBonus,
          income: prev.stats.income + tradeIncome,
        },
        tradeIncome: (prev.tradeIncome || 0) + tradeIncome,
        notifications: [
          {
            id: `city-connect-${Date.now()}`,
            title: 'Handelsroute etabliert!',
            description: `Handelsroute mit ${city.name} etabliert! +${tradeBonus} Fr. Bonus und +${tradeIncome} Fr./Monat Handelseinkommen.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9),
        ],
      };
    });
  }, [municipalitySlug, connectToCity]);

  const setSpritePack = useCallback((packId: string) => {
    const pack = getSpritePack(packId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);
    saveSpritePackId(packId);
  }, []);

  const setDayNightMode = useCallback((mode: DayNightMode) => {
    setDayNightModeState(mode);
    saveDayNightMode(mode);
  }, []);

  // Compute the visual hour based on the day/night mode override
  // This doesn't affect time progression, just the rendering
  const visualHour = dayNightMode === 'auto' 
    ? state.hour 
    : dayNightMode === 'day' 
      ? 12  // Noon - full daylight
      : 22; // Night time

  const newGame = useCallback((name?: string, size?: number) => {
    clearGameState(); // Clear saved state when starting fresh
    const fresh = createInitialGameState(size ?? DEFAULT_GRID_SIZE, name || 'IsoCity');
    // Increment gameVersion from current state to ensure vehicles/entities are cleared
    setState((prev) => ({
      ...fresh,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
  }, []);

  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      // Validate it has essential properties
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        // WICHTIG: adjacentCities werden IMMER frisch von der API geladen
        parsed.adjacentCities = [];
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Immer Panels beim Laden schließen (nicht den gespeicherten Zustand wiederherstellen)
        parsed.activePanel = 'none';
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9;
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Increment gameVersion to clear vehicles/entities when loading a new state
        setState((prev) => ({
          ...(parsed as GameState),
          gameVersion: (prev.gameVersion ?? 0) + 1,
        }));
        // Sofort in localStorage speichern → kein Level-Flash beim nächsten Laden
        saveGameState(parsed as GameState);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Soft Load: Ersetzt den State OHNE gameVersion zu erhöhen.
  // Dadurch werden Entities (Autos, Fussgänger, Flugzeuge etc.) NICHT gelöscht.
  // Ideal für Multiplayer-Sync, wo die Map dieselbe ist aber der Server-State aktueller sein kann.
  const softLoadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        parsed.adjacentCities = [];
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        parsed.activePanel = 'none';
        if (!parsed.cities) {
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9;
        }
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100;
              }
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // WICHTIG: gameVersion wird NICHT erhöht → Entities bleiben erhalten!
        setState((prev) => ({
          ...(parsed as GameState),
          gameVersion: prev.gameVersion ?? 0, // gameVersion beibehalten!
        }));
        // Sofort in localStorage speichern → kein Level-Flash beim nächsten Laden
        saveGameState(parsed as GameState);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Chunk-Loading: Patcht einzelne Tiles ohne den vollständigen State zu ersetzen.
  // Wird verwendet wenn neue Chunks vom Server geladen werden.
  const applyGridPatch = useCallback((items: GameItemFromApi[]) => {
    if (!items || items.length === 0) return;
    setState((prev) => {
      const gridSize = prev.gridSize;
      // Bestimme welche Rows betroffen sind (für minimales Kopieren)
      const affectedRows = new Set(items.map(i => i.y).filter(y => y >= 0 && y < gridSize));
      const newGrid = prev.grid.map((row, rowIdx) =>
        affectedRows.has(rowIdx) ? [...row] : row
      );
      applyItemsToGrid(newGrid, gridSize, items);
      return { ...prev, grid: newGrid };
    });
  }, []);

  const exportState = useCallback((): string => {
    return JSON.stringify(state);
  }, [state]);

  const generateRandomCity = useCallback(() => {
    clearGameState(); // Clear saved state when generating a new city
    const randomCity = generateRandomAdvancedCity(DEFAULT_GRID_SIZE);
    // Increment gameVersion to ensure vehicles/entities are cleared
    setState((prev) => ({
      ...randomCity,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
  }, []);

  // Expand the city grid by 15 tiles (appended to right + bottom, no shifting)
  const expandCity = useCallback(() => {
    // Server-authoritative: Expand-Request an Server senden
    deltaQueue.sendExpandCity().then((response) => {
      if (!response.success) {
        console.warn('[ExpandCity] Server hat abgelehnt:', response.error);
        if (response.error === 'insufficient_funds' || response.error === 'not_connected') {
          setState((prev) => ({
            ...prev,
            notifications: [
              {
                id: `expand-city-failed-${Date.now()}`,
                title: response.error === 'not_connected' ? 'Nicht verbunden' : 'Zu wenig Geld',
                description: response.error === 'not_connected'
                  ? 'Server-Verbindung fehlt.'
                  : `Stadterweiterung kostet Fr. ${TOOL_INFO.expand_city.cost.toLocaleString('de-CH')}.`,
                icon: 'default',
                timestamp: Date.now(),
              },
              ...prev.notifications.slice(0, 9),
            ],
          }));
        }
        return;
      }

      // Server hat OK gegeben → lokalen State updaten
      setState((prev) => {
        const { grid: newGrid, newSize } = expandGrid(prev.grid, prev.gridSize, 15);

        // Service-Grids erweitern: alte Werte bleiben an gleicher Position (kein Offset!)
        const expandServiceGrid = (oldGrid: number[][]): number[][] => {
          const result: number[][] = [];
          for (let y = 0; y < newSize; y++) {
            const row = new Array(newSize).fill(0);
            if (y < prev.gridSize && oldGrid?.[y]) {
              for (let x = 0; x < prev.gridSize && x < oldGrid[y].length; x++) {
                row[x] = oldGrid[y][x] ?? 0;
              }
            }
            result.push(row);
          }
          return result;
        };

        const expandBoolGrid = (oldGrid: boolean[][]): boolean[][] => {
          const result: boolean[][] = [];
          for (let y = 0; y < newSize; y++) {
            const row = new Array(newSize).fill(false);
            if (y < prev.gridSize && oldGrid?.[y]) {
              for (let x = 0; x < prev.gridSize && x < oldGrid[y].length; x++) {
                row[x] = oldGrid[y][x] ?? false;
              }
            }
            result.push(row);
          }
          return result;
        };

        return {
          ...prev,
          grid: newGrid,
          gridSize: newSize,
          services: {
            power: expandBoolGrid(prev.services.power),
            water: expandBoolGrid(prev.services.water),
            fire: expandServiceGrid(prev.services.fire),
            police: expandServiceGrid(prev.services.police),
            health: expandServiceGrid(prev.services.health),
            education: expandServiceGrid(prev.services.education),
          },
          bounds: {
            minX: 0,
            minY: 0,
            maxX: newSize - 1,
            maxY: newSize - 1,
          },
          gameVersion: (prev.gameVersion ?? 0) + 1,
        };
      });
    });
  }, []);

  // Shrink the city grid by 15 tiles on each side (30x30 total reduction)
  const shrinkCity = useCallback((): boolean => {
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `shrink-city-disabled-${Date.now()}`,
          title: 'Nicht verfügbar',
          description: 'Stadt verkleinern ist deaktiviert.',
          icon: 'default',
          timestamp: Date.now(),
        },
        ...prev.notifications.slice(0, 9),
      ],
    }));
    return false;
  }, []);

  const addMoney = useCallback((amount: number) => {
    setState((prev) => {
      const next = {
        ...prev,
        stats: {
          ...prev.stats,
          money: prev.stats.money + amount,
        },
      };
      latestStateRef.current = next;
      return next;
    });
  }, []);

  const addNotification = useCallback((title: string, description: string, icon: string) => {
    setState((prev) => {
      const newNotifications = [
        {
          id: `cheat-${Date.now()}-${Math.random()}`,
          title,
          description,
          icon,
          timestamp: Date.now(),
        },
        ...prev.notifications,
      ];
      // Keep only recent notifications
      while (newNotifications.length > 10) {
        newNotifications.pop();
      }
      return {
        ...prev,
        notifications: newNotifications,
      };
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  // Save current city for restore (when viewing shared cities)
  const saveCurrentCityForRestore = useCallback(() => {
    saveCityForRestore(state);
  }, [state]);

  // Restore saved city
  const restoreSavedCity = useCallback((): boolean => {
    const savedState = loadSavedCityState();
    if (savedState) {
      skipNextSaveRef.current = true;
      setState(savedState);
      clearSavedCityStorage();
      return true;
    }
    return false;
  }, []);

  // Get saved city info
  const getSavedCityInfo = useCallback((): SavedCityInfo => {
    return loadSavedCityInfo();
  }, []);

  // Clear saved city
  const clearSavedCity = useCallback(() => {
    clearSavedCityStorage();
  }, []);

  // Save current city to the multi-save system
  const saveCity = useCallback(() => {
    const cityMeta: SavedCityMeta = {
      id: state.id,
      cityName: state.cityName,
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };
    
    // Save the city state
    saveCityState(state.id, state);
    
    // Update the index
    setSavedCities((prev) => {
      // Check if this city already exists in the list
      const existingIndex = prev.findIndex((c) => c.id === state.id);
      let newCities: SavedCityMeta[];
      
      if (existingIndex >= 0) {
        // Update existing entry
        newCities = [...prev];
        newCities[existingIndex] = cityMeta;
      } else {
        // Add new entry
        newCities = [...prev, cityMeta];
      }
      
      // Sort by savedAt descending (most recent first)
      newCities.sort((a, b) => b.savedAt - a.savedAt);
      
      // Persist to localStorage
      saveSavedCitiesIndex(newCities);
      
      return newCities;
    });
  }, [state]);

  // Load a saved city from the multi-save system
  const loadSavedCity = useCallback((cityId: string): boolean => {
    const cityState = loadCityState(cityId);
    if (!cityState) return false;
    
    // Ensure the loaded state has an ID
    if (!cityState.id) {
      cityState.id = cityId;
    }
    
    // Perform migrations for backward compatibility
    // WICHTIG: adjacentCities werden IMMER frisch von der API geladen
    cityState.adjacentCities = [];
    if (!cityState.waterBodies) {
      cityState.waterBodies = [];
    }
    // Ensure cities exists for multi-city support
    if (!cityState.cities) {
      cityState.cities = [{
        id: cityState.id || 'default-city',
        name: cityState.cityName || 'City',
        bounds: {
          minX: 0,
          minY: 0,
          maxX: (cityState.gridSize || 50) - 1,
          maxY: (cityState.gridSize || 50) - 1,
        },
        economy: {
          population: cityState.stats?.population || 0,
          jobs: cityState.stats?.jobs || 0,
          income: cityState.stats?.income || 0,
          expenses: cityState.stats?.expenses || 0,
          happiness: cityState.stats?.happiness || 50,
          lastCalculated: 0,
        },
        color: '#3b82f6',
      }];
    }
    if (cityState.effectiveTaxRate === undefined) {
      cityState.effectiveTaxRate = cityState.taxRate ?? 9;
    }
    if (cityState.grid) {
      for (let y = 0; y < cityState.grid.length; y++) {
        for (let x = 0; x < cityState.grid[y].length; x++) {
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.constructionProgress === undefined) {
            cityState.grid[y][x].building.constructionProgress = 100;
          }
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.abandoned === undefined) {
            cityState.grid[y][x].building.abandoned = false;
          }
        }
      }
    }
    
    skipNextSaveRef.current = true;
    setState((prev) => ({
      ...cityState,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
    
    // Also update the current game in local storage
    saveGameState(cityState);
    
    return true;
  }, []);

  // Delete a saved city from the multi-save system
  const deleteSavedCity = useCallback((cityId: string) => {
    // Delete the city state
    deleteCityState(cityId);
    
    // Update the index
    setSavedCities((prev) => {
      const newCities = prev.filter((c) => c.id !== cityId);
      saveSavedCitiesIndex(newCities);
      return newCities;
    });
  }, []);

  // Rename a saved city
  const renameSavedCity = useCallback((cityId: string, newName: string) => {
    // Load the city state, update the name, and save it back
    const cityState = loadCityState(cityId);
    if (cityState) {
      cityState.cityName = newName;
      saveCityState(cityId, cityState);
    }
    
    // Update the index
    setSavedCities((prev) => {
      const newCities = prev.map((c) =>
        c.id === cityId ? { ...c, cityName: newName } : c
      );
      saveSavedCitiesIndex(newCities);
      return newCities;
    });
    
    // If the current game is the one being renamed, update its state too
    if (state.id === cityId) {
      setState((prev) => ({ ...prev, cityName: newName }));
    }
  }, [state.id]);

  // Set a custom label for a building
  const setBuildingLabel = useCallback((x: number, y: number, label: string) => {
    setState((prev) => {
      const newGrid = prev.grid.map((row, rowIndex) =>
        row.map((tile, colIndex) => {
          if (rowIndex === y && colIndex === x && tile.building && (tile.building.type as string) !== 'none') {
            return {
              ...tile,
              building: {
                ...tile.building,
                customName: label || undefined, // Remove label if empty
              },
            };
          }
          return tile;
        })
      );
      return { ...prev, grid: newGrid };
    });
  }, []);

  const setAutobahnDirection = useCallback((startX: number, startY: number, direction: 'north' | 'south' | 'east' | 'west' | null) => {
    // Collect connected tiles first (before setState, based on current ref)
    const currentGrid = latestStateRef.current?.grid;
    const currentGridSize = latestStateRef.current?.gridSize ?? 0;
    const connectedTiles: [number, number][] = [];
    if (currentGrid) {
      const visited = new Set<string>();
      const floodQueue: [number, number][] = [[startX, startY]];
      while (floodQueue.length > 0) {
        const [cx, cy] = floodQueue.pop()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        if (cx < 0 || cy < 0 || cx >= currentGridSize || cy >= currentGridSize) continue;
        if (currentGrid[cy]?.[cx]?.building.type !== 'autobahn') continue;
        visited.add(key);
        connectedTiles.push([cx, cy]);
        floodQueue.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
      }
    }

    setState((prev) => {
      const grid = prev.grid;
      const gridSize = prev.gridSize;
      // Flood fill to find all connected autobahn tiles
      const connected = new Set<string>();
      const queue: [number, number][] = [[startX, startY]];
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        const key = `${cx},${cy}`;
        if (connected.has(key)) continue;
        if (cx < 0 || cy < 0 || cx >= gridSize || cy >= gridSize) continue;
        if (grid[cy][cx].building.type !== 'autobahn') continue;
        connected.add(key);
        queue.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
      }
      // Update all connected tiles
      const newGrid = grid.map((row, rowIndex) =>
        row.map((tile, colIndex) => {
          if (connected.has(`${colIndex},${rowIndex}`)) {
            return {
              ...tile,
              building: {
                ...tile.building,
                autobahnDirection: direction ?? undefined,
              },
            };
          }
          return tile;
        })
      );
      return { ...prev, grid: newGrid };
    });

    // Server persistieren: für jedes verbundene Autobahn-Tile ein metadata_update senden
    for (const [tx, ty] of connectedTiles) {
      deltaQueue.sendAutobahnDirection(tx, ty, direction);
    }
  }, []);

  // ── Bus Line Creation Mode callbacks ──────────────────
  const startBusLineCreation = useCallback((companyId: number, lineName: string, lineColor: string, existingStops?: { x: number; y: number }[], editingLineId?: number) => {
    setBusLineCreationMode({ active: true, companyId, stops: existingStops || [], lineName, lineColor, editingLineId });
    setState(prev => ({ ...prev, activePanel: 'none', selectedTool: 'bus_stop' as Tool }));
  }, []);

  const addBusLineStop = useCallback((x: number, y: number) => {
    setBusLineCreationMode(prev => {
      if (!prev?.active) return prev;
      // Prevent duplicate stops
      if (prev.stops.some(s => s.x === x && s.y === y)) return prev;
      const newStops = [...prev.stops, { x, y }];
      return { ...prev, stops: newStops };
    });
  }, []);

  const removeBusLineStop = useCallback((index: number) => {
    setBusLineCreationMode(prev => {
      if (!prev?.active) return prev;
      const newStops = prev.stops.filter((_, i) => i !== index);
      return { ...prev, stops: newStops };
    });
  }, []);

  const cancelBusLineCreation = useCallback(() => {
    setBusLineCreationMode(null);
  }, []);

  const finishBusLineCreation = useCallback(async () => {
    if (!busLineCreationMode?.active || busLineCreationMode.stops.length < 4) return null;
    try {
      if (busLineCreationMode.editingLineId) {
        // Update existing line
        const { updateBusLine } = await import('@/lib/api/busLineApi');
        const line = await updateBusLine(busLineCreationMode.companyId, busLineCreationMode.editingLineId, {
          stops: busLineCreationMode.stops,
        });
        setBusLineCreationMode(null);
        window.dispatchEvent(new Event('bus-lines-updated'));
        return line;
      } else {
        // Create new line
        const { createBusLine } = await import('@/lib/api/busLineApi');
        const line = await createBusLine(busLineCreationMode.companyId, {
          name: busLineCreationMode.lineName,
          color: busLineCreationMode.lineColor,
          stops: busLineCreationMode.stops,
        });
        setBusLineCreationMode(null);
        window.dispatchEvent(new Event('bus-lines-updated'));
        return line;
      }
    } catch (err) {
      console.error('Bus line save failed:', err);
      return null;
    }
  }, [busLineCreationMode]);

  const emitParkVehicle = useCallback((tileX: number, tileY: number, slot: number, color: string) => {
    deltaQueue.emitParkVehicle(tileX, tileY, slot, color);
  }, []);

  const emitLeaveParking = useCallback((tileX: number, tileY: number, slot: number) => {
    deltaQueue.emitLeaveParking(tileX, tileY, slot);
  }, []);

  const emitSetParkingConfig = useCallback((tileX: number, tileY: number, isFree: boolean, feeRate: number) => {
    deltaQueue.emitSetParkingConfig(tileX, tileY, isFree, feeRate);
  }, []);

  const addNotificationFromParking = useCallback((data: ParkingFineEvent) => {
    addNotification(
      `🚔 Parkbusse CHF ${data.fineAmount}`,
      `${data.companyName} – Gemeinde +${data.communeShare} CHF, Firma +${data.companyShare} CHF`,
      '🚔'
    );
  }, [addNotification]);

  const value: GameContextValue = {
    state,
    latestStateRef,
    setTool,
    setSpeed,
    setTaxRate,
    setActivePanel,
    setBudgetFunding,
    setSocialContributionRate,
    setWelfarePerUnemployed,
    placeAtTile,
    upgradeServiceBuilding: upgradeServiceBuildingHandler,
    repairAtTile: repairAtTileHandler,
    flipBuildingAtTile: flipBuildingAtTileHandler,
    setPlaceCallback,
    finishTrackDrag,
    setBridgeCallback,
    connectToCity,
    discoverCity,
    checkAndDiscoverCities,
    setDisastersEnabled,
    newGame,
    loadState,
    softLoadState,
    applyGridPatch,
    exportState,
    generateRandomCity,
    expandCity,
    shrinkCity,
    hasExistingGame,
    isStateReady,
    isSaving,
    addMoney,
    addNotification,
    clearNotifications,
    // Sprite pack management
    currentSpritePack,
    availableSpritePacks: SPRITE_PACKS,
    setSpritePack,
    // Day/night mode override
    dayNightMode,
    setDayNightMode,
    visualHour,
    // Save/restore city for shared links
    saveCurrentCityForRestore,
    restoreSavedCity,
    getSavedCityInfo,
    clearSavedCity,
    // Multi-city save system
    savedCities,
    saveCity,
    loadSavedCity,
    deleteSavedCity,
    renameSavedCity,
    // Building label
    setBuildingLabel,
    setAutobahnDirection,
    // Transport / Bus line system
    hasTransportCompany,
    hasBusStation,
    transportCompanyId: transportCompanyIdRef.current,
    busLineCreationMode,
    startBusLineCreation,
    addBusLineStop,
    removeBusLineStop,
    cancelBusLineCreation,
    finishBusLineCreation,
    loadTransportCompanyStatus,
    // Residence placement mode
    residencePlacement,
    startResidencePlacement,
    cancelResidencePlacement,
    // Habbo-style room viewer
    activeRoom,
    openResidenceRoom,
    closeResidenceRoom,
    // Parking system
    parkedVehiclesRef,
    emitParkVehicle,
    emitLeaveParking,
    parkingConfigRef,
    parkingViolationsRef,
    emitSetParkingConfig,
    addNotificationFromParking,
    // Nachbar-Gemeinden aktualisieren
    setAdjacentCities,
    // Gewässer umbenennen
    renameWaterBody,
    applyRemoteDisasters: useCallback((changes: RemoteDisasterStateUpdate[]) => {
      if (!Array.isArray(changes) || changes.length === 0) return;

      const applyChanges = (base: GameState): GameState => {
        let grid = base.grid;
        let gridChanged = false;
        const changedRows = new Map<number, typeof base.grid[number]>();

        const ensureMutableRow = (y: number) => {
          let row = changedRows.get(y);
          if (row) return row;
          row = [...grid[y]];
          changedRows.set(y, row);
          if (!gridChanged) {
            grid = [...grid];
            gridChanged = true;
          }
          grid[y] = row;
          return row;
        };

        for (const change of changes) {
          const x = Number(change?.x);
          const y = Number(change?.y);
          if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
          if (y < 0 || y >= grid.length || x < 0 || x >= (grid[y]?.length ?? 0)) continue;

          const currentTile = grid[y]?.[x];
          if (!currentTile?.building) continue;

          let nextBuilding = currentTile.building;
          let changed = false;

          if (change.removed) {
            nextBuilding = createBurnedGroundBuilding();
            changed = true;
          } else {
            const withFire = typeof change.on_fire === 'boolean'
              ? Boolean(change.on_fire)
              : nextBuilding.onFire;
            const withProgress =
              typeof change.fire_progress !== 'undefined' && change.fire_progress !== null
                ? clamp(Math.round(Number(change.fire_progress)), 0, 100)
                : nextBuilding.fireProgress;
            const withAbandoned = typeof change.abandoned === 'boolean'
              ? Boolean(change.abandoned)
              : nextBuilding.abandoned;

            if (withFire !== nextBuilding.onFire || withProgress !== nextBuilding.fireProgress || withAbandoned !== nextBuilding.abandoned) {
              const wasAbandoned = nextBuilding.abandoned;
              nextBuilding = {
                ...nextBuilding,
                onFire: withFire,
                fireProgress: withProgress,
                abandoned: withAbandoned,
              };
              if (withAbandoned && !wasAbandoned) {
                nextBuilding.population = 0;
                nextBuilding.jobs = 0;
              }
              changed = true;
            }
          }

          const incomingElevation = Number(change?.elevation);
          const currentElevation = Math.max(-6, Math.min(6, Math.round(Number(currentTile.elevation || 0))));
          const nextElevation = Number.isFinite(incomingElevation)
            ? Math.max(-6, Math.min(6, Math.round(incomingElevation)))
            : currentElevation;
          const elevationChanged = nextElevation !== currentElevation;

          if (!changed && !elevationChanged) continue;
          const row = ensureMutableRow(y);
          row[x] = {
            ...currentTile,
            building: nextBuilding,
            ...(elevationChanged ? { elevation: nextElevation } : {}),
            ...(change.removed ? { zone: 'none' } : {}),
          };
        }

        return gridChanged ? { ...base, grid } : base;
      };

      setState((prev) => applyChanges(prev));
      latestStateRef.current = applyChanges(latestStateRef.current);
    }, []),
    // Server-autoritative Gebäude-Upgrades (Level, Abandoned, Baufortschritt) anwenden
    applyRemoteBuildingUpdates: useCallback((changes: RemoteBuildingStateUpdate[]) => {
      if (!Array.isArray(changes) || changes.length === 0) return;

      const applyChanges = (base: GameState): GameState => {
        let grid = base.grid;
        let gridChanged = false;
        const changedRows = new Map<number, typeof base.grid[number]>();

        const ensureMutableRow = (y: number) => {
          let row = changedRows.get(y);
          if (row) return row;
          row = [...grid[y]];
          changedRows.set(y, row);
          if (!gridChanged) {
            grid = [...grid];
            gridChanged = true;
          }
          grid[y] = row;
          return row;
        };

        for (const change of changes) {
          const x = Number(change?.x);
          const y = Number(change?.y);
          if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
          if (y < 0 || y >= grid.length || x < 0 || x >= (grid[y]?.length ?? 0)) continue;

          const currentTile = grid[y]?.[x];
          if (!currentTile?.building) continue;

          let nextBuilding = { ...currentTile.building };
          let changed = false;

          // Gebäudetyp vom Server (z.B. Zone mit grass → echtes Gebäude, oder Konsolidierung)
          // Der Server weist beim Platzieren einer Zone sofort einen buildingType zu,
          // progressed den Bau, und konsolidiert kleine Gebäude zu grösseren (Multi-Tile)
          if (typeof change.buildingType === 'string' && change.buildingType.length > 0) {
            const serverType = change.buildingType as BuildingType;
            if (serverType !== nextBuilding.type && serverType !== 'grass') {
              nextBuilding.type = serverType;
              if (serverType === 'empty') {
                // Konsolidierungs-Platzhalter: Tile ist Teil eines Multi-Tile-Gebäudes
                nextBuilding.level = 0;
                nextBuilding.population = 0;
                nextBuilding.jobs = 0;
                nextBuilding.age = 0;
              } else if (currentTile.building.type === 'grass' || currentTile.building.type === 'empty'
                || currentTile.building.type === 'house_small' || currentTile.building.type === 'house_medium'
                || currentTile.building.type === 'shop_small' || currentTile.building.type === 'shop_medium'
                || currentTile.building.type === 'factory_small') {
                // Neues oder konsolidiertes Gebäude — Defaults setzen
                nextBuilding.level = typeof change.level === 'number' ? clamp(change.level, 1, 5) : 1;
                nextBuilding.population = 0;
                nextBuilding.jobs = 0;
                nextBuilding.onFire = false;
                nextBuilding.fireProgress = 0;
                nextBuilding.age = 0;
                nextBuilding.abandoned = false;
              }
              changed = true;
            }
          }

          // Baufortschritt vom Server
          if (typeof change.constructionProgress === 'number') {
            const serverProgress = Math.max(0, Math.min(100, Math.round(change.constructionProgress * 100) / 100));
            if (serverProgress !== nextBuilding.constructionProgress) {
              nextBuilding.constructionProgress = serverProgress;
              changed = true;
            }
          }

          // Level-Upgrade vom Server
          if (typeof change.level === 'number' && change.level !== nextBuilding.level) {
            nextBuilding.level = clamp(Math.round(change.level), 1, 5);
            changed = true;
          }

          // Abandoned-Status vom Server
          if (typeof change.abandoned === 'boolean' && change.abandoned !== nextBuilding.abandoned) {
            nextBuilding.abandoned = change.abandoned;
            changed = true;
          }

          // Population + Jobs neu berechnen wenn Gebäude fertig gebaut oder Level geändert
          if (changed && nextBuilding.constructionProgress >= 100 && !nextBuilding.abandoned
              && nextBuilding.type !== 'grass' && nextBuilding.type !== 'empty' && nextBuilding.type !== 'water') {
            const happiness = remoteStatsOverrideRef.current?.happiness ?? latestStateRef.current?.stats?.happiness ?? 60;
            const landValue = currentTile.landValue ?? 50;
            const pj = calcPopJobsWithOccupancy(
              nextBuilding.type as BuildingType,
              nextBuilding.level || 1,
              x, y,
              landValue,
              happiness,
              nextBuilding.powered ?? true,
              nextBuilding.watered ?? true,
            );
            nextBuilding.population = pj.population;
            nextBuilding.jobs = pj.jobs;
          }

          if (!changed) continue;
          const row = ensureMutableRow(y);
          row[x] = { ...currentTile, building: nextBuilding };
        }

        return gridChanged ? { ...base, grid } : base;
      };

      setState((prev) => applyChanges(prev));
      latestStateRef.current = applyChanges(latestStateRef.current);
    }, []),
    // Server-autoritatives LandValue-Grid auf alle Tiles anwenden
    applyRemoteLandValueUpdate: useCallback((data: { gridSize: number; values: number[] }) => {
      const { gridSize, values } = data;
      if (!gridSize || !values || values.length !== gridSize * gridSize) return;

      const happiness = remoteStatsOverrideRef.current?.happiness ?? latestStateRef.current?.stats?.happiness ?? 60;

      const applyLV = (base: GameState): GameState => {
        let grid = base.grid;
        let gridChanged = false;
        const changedRows = new Map<number, typeof base.grid[number]>();

        for (let y = 0; y < gridSize && y < grid.length; y++) {
          for (let x = 0; x < gridSize && x < (grid[y]?.length ?? 0); x++) {
            const newLV = values[y * gridSize + x];
            const tile = grid[y][x];
            if (tile.landValue === newLV) continue;

            if (!gridChanged) {
              grid = [...grid];
              gridChanged = true;
            }
            let row = changedRows.get(y);
            if (!row) {
              row = [...grid[y]];
              changedRows.set(y, row);
              grid[y] = row;
            }

            // LandValue updaten + Population/Jobs neu berechnen wenn Gebäude fertig
            const b = tile.building;
            let updatedBuilding = b;
            if (b && b.constructionProgress >= 100 && !b.abandoned
                && b.type !== 'grass' && b.type !== 'empty' && b.type !== 'water') {
              const pj = calcPopJobsWithOccupancy(
                b.type as BuildingType,
                b.level || 1,
                x, y,
                newLV,
                happiness,
                b.powered ?? true,
                b.watered ?? true,
              );
              // Nur schreiben wenn sich was geändert hat
              if (pj.population !== b.population || pj.jobs !== b.jobs) {
                updatedBuilding = { ...b, population: pj.population, jobs: pj.jobs };
              }
            }

            row[x] = { ...tile, landValue: newLV, building: updatedBuilding };
          }
        }
        return gridChanged ? { ...base, grid } : base;
      };

      setState((prev) => applyLV(prev));
      latestStateRef.current = applyLV(latestStateRef.current);
    }, []),
    // Server-autoritatives Crime-Grid auf Tiles anwenden + Criminal-NPCs tracken
    applyRemoteCrimeUpdate: useCallback((data: { criminals: RemoteCriminalNpc[]; crimeGrid: number[] | null; gridSize: number; crimeEvents: RemoteCrimeEvent[]; homeless?: number; isNight?: boolean }) => {
      const { crimeGrid, gridSize, criminals: criminalsList, crimeEvents, homeless, isNight } = data;

      // Crime-Grid auf Tiles anwenden
      if (crimeGrid && gridSize > 0 && crimeGrid.length === gridSize * gridSize) {
        const applyCrime = (base: GameState): GameState => {
          let grid = base.grid;
          let gridChanged = false;
          const changedRows = new Map<number, typeof base.grid[number]>();

          for (let y = 0; y < gridSize && y < grid.length; y++) {
            for (let x = 0; x < gridSize && x < (grid[y]?.length ?? 0); x++) {
              const newCrime = crimeGrid[y * gridSize + x];
              const tile = grid[y][x];
              if (tile.crime === newCrime) continue;
              if (!gridChanged) {
                grid = [...grid];
                gridChanged = true;
              }
              let row = changedRows.get(y);
              if (!row) {
                row = [...grid[y]];
                changedRows.set(y, row);
                grid[y] = row;
              }
              row[x] = { ...tile, crime: newCrime };
            }
          }
          return gridChanged ? { ...base, grid } : base;
        };

        setState((prev) => applyCrime(prev));
        latestStateRef.current = applyCrime(latestStateRef.current);
      }

      // Criminal-NPCs, Events und Homeless-Count werden via CustomEvent an das Pedestrian-System weitergegeben
      if (criminalsList.length > 0 || crimeEvents.length > 0 || (homeless ?? 0) > 0) {
        window.dispatchEvent(new CustomEvent('crime-authoritative-update', {
          detail: { criminals: criminalsList, crimeEvents, homeless: homeless ?? 0, isNight: isNight ?? false }
        }));
      }
    }, []),
    // Server-autoritative Büenzli-NPC-Updates an das Pedestrian-System weiterleiten
    applyRemoteBuenzliUpdate: useCallback((data: BuenzliNpcPayload) => {
      if (data.npcs && data.npcs.length >= 0) {
        window.dispatchEvent(new CustomEvent('buenzli-npc-authoritative-update', {
          detail: data
        }));
      }
    }, []),
    // Multiplayer stats sync - empfangene Stats von anderen Spielern anwenden
    applyRemoteStats: useCallback((stats: {
      money?: number; 
      population?: number; 
      income?: number;
      expenses?: number;
      tax_income?: number;
      tax_income_population?: number;
      tax_income_business?: number;
      tax_income_property?: number;
      building_income?: number;
      company_tax_income?: number;
      budget_expenses?: number;
      budget_cost_police?: number;
      budget_cost_fire?: number;
      budget_cost_health?: number;
      budget_cost_education?: number;
      budget_cost_transportation?: number;
      budget_cost_parks?: number;
      budget_cost_power?: number;
      budget_cost_water?: number;
      maintenance_expenses?: number;
      administration_base_expenses?: number;
      civic_overhead_expenses?: number;
      utility_overhead_expenses?: number;
      jobs?: number;
      happiness?: number;
      employed?: number;
      unemployed?: number;
      unemploymentRate?: number;
      workforce?: number;
      workforceRate?: number;
      children?: number;
      seniors?: number;
      students?: number;
      socialFund?: number;
      socialContributionRate?: number;
      welfarePerUnemployed?: number;
      socialFundIncome?: number;
      socialFundExpenses?: number;
      socialExpenses?: number;
      welfareCoverage?: number;
      schoolCapacity?: number;
      uniCapacity?: number;
      educationOvercrowding?: number;
      healthCapacity?: number;
      healthDemand?: number;
      healthAdequacy?: number;
      year?: number;
      month?: number;
      weatherType?: string;
      weatherIntensity?: number;
      weatherTemperature?: number | null;
      taxRate?: number;
      tick?: number;
      gameSpeed?: number;
      gameMapData?: Record<string, unknown> | null;
      power_production?: number;
      power_consumption?: number;
      power_season_multiplier?: number;
      power_import_units?: number;
      power_import_cost?: number;
      power_import_price_per_unit?: number;
      power_sold_mw?: number;
      power_bought_mw?: number;
      power_production_effective?: number;
      power_balance_effective?: number;
      power_surplus_pct?: number;
      power_available_to_sell?: number;
      power_buffer_mw?: number;
      power_buffer_pct?: number;
      water_production?: number;
      water_consumption?: number;
      water_net_deficit?: number;
      water_storage_level?: number;
      water_storage_capacity?: number;
      demand_residential?: number;
      demand_commercial?: number;
      demand_industrial?: number;
      zones_residential?: number;
      zones_commercial?: number;
      zones_industrial?: number;
      buildings_residential?: number;
      buildings_commercial?: number;
      buildings_industrial?: number;
    }) => {
      const mapData = isRecord(stats.gameMapData) ? stats.gameMapData : null;
      const settings = mapData && isRecord(mapData.settings) ? mapData.settings : null;
      const budgetFromServer = mapData ? mergeBudgetFromServer(latestStateRef.current.budget, mapData.budget) : latestStateRef.current.budget;
      const hasBudgetUpdate = budgetFromServer !== latestStateRef.current.budget;

      const effectiveTaxRate = settings ? toFiniteNumberOrUndefined(settings.effectiveTaxRate) : undefined;
      const disastersEnabled = settings && typeof settings.disastersEnabled === 'boolean'
        ? settings.disastersEnabled
        : undefined;
      
      // WICHTIG: Speichere die Stats in der Override-Ref
      // Damit werden sie nach jedem Simulationstick erneut angewendet
      // Population + Jobs: kleiner Zufallsoffset damit die Zahl nach jedem Tick lebt
      // Skaliert mit Stadtgrösse: kleine Stadt ±1%, grosse Stadt ±3%
      const _popBase = stats.population ?? 0;
      const _jobsBase = stats.jobs ?? 0;
      const _popRange = _popBase < 200 ? 0.01 : _popBase < 2000 ? 0.02 : 0.03;
      const _jobsRange = _jobsBase < 200 ? 0.01 : _jobsBase < 2000 ? 0.02 : 0.03;
      const _popFluctuation = Math.round(_popBase * (Math.random() - 0.5) * _popRange * 2);
      const _jobsFluctuation = Math.round(_jobsBase * (Math.random() - 0.5) * _jobsRange * 2);
      remoteStatsOverrideRef.current = {
        money: stats.money,
        population: _popBase > 0 ? Math.max(0, _popBase + _popFluctuation) : 0,
        income: stats.income,
        expenses: stats.expenses,
        tax_income: stats.tax_income,
        tax_income_population: stats.tax_income_population,
        tax_income_business: stats.tax_income_business,
        tax_income_property: stats.tax_income_property,
        building_income: stats.building_income,
        company_tax_income: stats.company_tax_income,
        budget_expenses: stats.budget_expenses,
        budget_cost_police: stats.budget_cost_police,
        budget_cost_fire: stats.budget_cost_fire,
        budget_cost_health: stats.budget_cost_health,
        budget_cost_education: stats.budget_cost_education,
        budget_cost_transportation: stats.budget_cost_transportation,
        budget_cost_parks: stats.budget_cost_parks,
        budget_cost_power: stats.budget_cost_power,
        budget_cost_water: stats.budget_cost_water,
        maintenance_expenses: stats.maintenance_expenses,
        administration_base_expenses: stats.administration_base_expenses,
        civic_overhead_expenses: stats.civic_overhead_expenses,
        utility_overhead_expenses: stats.utility_overhead_expenses,
        jobs: _jobsBase > 0 ? Math.max(0, _jobsBase + _jobsFluctuation) : 0,
        happiness: stats.happiness,
        employed: stats.employed,
        unemployed: stats.unemployed,
        unemploymentRate: stats.unemploymentRate,
        workforce: stats.workforce,
        workforceRate: stats.workforceRate,
        children: stats.children,
        seniors: stats.seniors,
        students: stats.students,
        socialFund: stats.socialFund,
        socialContributionRate: stats.socialContributionRate,
        welfarePerUnemployed: stats.welfarePerUnemployed,
        socialFundIncome: stats.socialFundIncome,
        socialFundExpenses: stats.socialFundExpenses,
        socialExpenses: stats.socialExpenses,
        welfareCoverage: stats.welfareCoverage,
        schoolCapacity: stats.schoolCapacity,
        uniCapacity: stats.uniCapacity,
        educationOvercrowding: stats.educationOvercrowding,
        healthCapacity: stats.healthCapacity,
        healthDemand: stats.healthDemand,
        healthAdequacy: stats.healthAdequacy,
        year: stats.year,
        month: stats.month,
        taxRate: stats.taxRate,
        tick: stats.tick,
        gameSpeed: stats.gameSpeed,
        effectiveTaxRate,
        disastersEnabled,
        budget: hasBudgetUpdate ? budgetFromServer : undefined,
        power_production: stats.power_production,
        power_consumption: stats.power_consumption,
        power_season_multiplier: stats.power_season_multiplier,
        power_import_units: stats.power_import_units,
        power_import_cost: stats.power_import_cost,
        power_import_price_per_unit: stats.power_import_price_per_unit,
        power_sold_mw: stats.power_sold_mw,
        power_bought_mw: stats.power_bought_mw,
        power_production_effective: stats.power_production_effective,
        power_balance_effective: stats.power_balance_effective,
        power_surplus_pct: stats.power_surplus_pct,
        power_available_to_sell: stats.power_available_to_sell,
        power_buffer_mw: stats.power_buffer_mw,
        power_buffer_pct: stats.power_buffer_pct,
        water_production: stats.water_production,
        water_consumption: stats.water_consumption,
        water_net_deficit: stats.water_net_deficit,
        water_storage_level: stats.water_storage_level,
        water_storage_capacity: stats.water_storage_capacity,
      };

      setState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          ...(stats.money !== undefined ? { money: stats.money } : {}),
          ...(stats.population !== undefined ? { population: stats.population } : {}),
          ...(stats.income !== undefined ? { income: stats.income } : {}),
          ...(stats.expenses !== undefined ? { expenses: stats.expenses } : {}),
          ...(stats.tax_income !== undefined ? { tax_income: stats.tax_income } : {}),
          ...(stats.tax_income_population !== undefined ? { tax_income_population: stats.tax_income_population } : {}),
          ...(stats.tax_income_business !== undefined ? { tax_income_business: stats.tax_income_business } : {}),
          ...(stats.tax_income_property !== undefined ? { tax_income_property: stats.tax_income_property } : {}),
          ...(stats.building_income !== undefined ? { building_income: stats.building_income } : {}),
          ...(stats.company_tax_income !== undefined ? { company_tax_income: stats.company_tax_income } : {}),
          ...(stats.budget_expenses !== undefined ? { budget_expenses: stats.budget_expenses } : {}),
          ...(stats.budget_cost_police !== undefined ? { budget_cost_police: stats.budget_cost_police } : {}),
          ...(stats.budget_cost_fire !== undefined ? { budget_cost_fire: stats.budget_cost_fire } : {}),
          ...(stats.budget_cost_health !== undefined ? { budget_cost_health: stats.budget_cost_health } : {}),
          ...(stats.budget_cost_education !== undefined ? { budget_cost_education: stats.budget_cost_education } : {}),
          ...(stats.budget_cost_transportation !== undefined ? { budget_cost_transportation: stats.budget_cost_transportation } : {}),
          ...(stats.budget_cost_parks !== undefined ? { budget_cost_parks: stats.budget_cost_parks } : {}),
          ...(stats.budget_cost_power !== undefined ? { budget_cost_power: stats.budget_cost_power } : {}),
          ...(stats.budget_cost_water !== undefined ? { budget_cost_water: stats.budget_cost_water } : {}),
          ...(stats.maintenance_expenses !== undefined ? { maintenance_expenses: stats.maintenance_expenses } : {}),
          ...(stats.administration_base_expenses !== undefined ? { administration_base_expenses: stats.administration_base_expenses } : {}),
          ...(stats.civic_overhead_expenses !== undefined ? { civic_overhead_expenses: stats.civic_overhead_expenses } : {}),
          ...(stats.utility_overhead_expenses !== undefined ? { utility_overhead_expenses: stats.utility_overhead_expenses } : {}),
          ...(stats.jobs !== undefined ? { jobs: stats.jobs } : {}),
          ...(stats.happiness !== undefined ? { happiness: stats.happiness } : {}),
          ...(stats.power_production !== undefined ? { power_production: stats.power_production } : {}),
          ...(stats.power_consumption !== undefined ? { power_consumption: stats.power_consumption } : {}),
          ...(stats.power_season_multiplier !== undefined ? { power_season_multiplier: stats.power_season_multiplier } : {}),
          ...(stats.power_import_units !== undefined ? { power_import_units: stats.power_import_units } : {}),
          ...(stats.power_import_cost !== undefined ? { power_import_cost: stats.power_import_cost } : {}),
          ...(stats.power_import_price_per_unit !== undefined ? { power_import_price_per_unit: stats.power_import_price_per_unit } : {}),
          ...(stats.power_sold_mw !== undefined ? { power_sold_mw: stats.power_sold_mw } : {}),
          ...(stats.power_bought_mw !== undefined ? { power_bought_mw: stats.power_bought_mw } : {}),
          ...(stats.power_production_effective !== undefined ? { power_production_effective: stats.power_production_effective } : {}),
          ...(stats.power_balance_effective !== undefined ? { power_balance_effective: stats.power_balance_effective } : {}),
          ...(stats.power_surplus_pct !== undefined ? { power_surplus_pct: stats.power_surplus_pct } : {}),
          ...(stats.power_available_to_sell !== undefined ? { power_available_to_sell: stats.power_available_to_sell } : {}),
          ...(stats.power_buffer_mw !== undefined ? { power_buffer_mw: stats.power_buffer_mw } : {}),
          ...(stats.power_buffer_pct !== undefined ? { power_buffer_pct: stats.power_buffer_pct } : {}),
          ...(stats.water_production !== undefined ? { water_production: stats.water_production } : {}),
          ...(stats.water_consumption !== undefined ? { water_consumption: stats.water_consumption } : {}),
          ...(stats.water_net_deficit !== undefined ? { water_net_deficit: stats.water_net_deficit } : {}),
          ...(stats.water_storage_level !== undefined ? { water_storage_level: stats.water_storage_level } : {}),
          ...(stats.water_storage_capacity !== undefined ? { water_storage_capacity: stats.water_storage_capacity } : {}),
          ...(stats.demand_residential !== undefined ? { demand_residential: stats.demand_residential } : {}),
          ...(stats.demand_commercial !== undefined ? { demand_commercial: stats.demand_commercial } : {}),
          ...(stats.demand_industrial !== undefined ? { demand_industrial: stats.demand_industrial } : {}),
          ...(stats.zones_residential !== undefined ? { zones_residential: stats.zones_residential } : {}),
          ...(stats.zones_commercial !== undefined ? { zones_commercial: stats.zones_commercial } : {}),
          ...(stats.zones_industrial !== undefined ? { zones_industrial: stats.zones_industrial } : {}),
          ...(stats.buildings_residential !== undefined ? { buildings_residential: stats.buildings_residential } : {}),
          ...(stats.buildings_commercial !== undefined ? { buildings_commercial: stats.buildings_commercial } : {}),
          ...(stats.buildings_industrial !== undefined ? { buildings_industrial: stats.buildings_industrial } : {}),
        },
        ...(stats.year !== undefined ? { year: stats.year } : {}),
        ...(stats.month !== undefined ? { month: stats.month } : {}),
        ...(stats.taxRate !== undefined ? { taxRate: stats.taxRate } : {}),
        ...(stats.tick !== undefined ? { tick: stats.tick } : {}),
        ...(stats.gameSpeed !== undefined ? { speed: clamp(Math.round(stats.gameSpeed), 0, 3) as 0 | 1 | 2 | 3 } : {}),
        ...(effectiveTaxRate !== undefined ? { effectiveTaxRate: clamp(Math.round(effectiveTaxRate), 0, 100) } : {}),
        ...(typeof disastersEnabled === 'boolean' ? { disastersEnabled } : {}),
        ...(hasBudgetUpdate ? { budget: budgetFromServer } : {}),
      }));
      // Aktualisiere auch die latestStateRef für das Canvas
      latestStateRef.current = {
        ...latestStateRef.current,
        stats: {
          ...latestStateRef.current.stats,
          ...(stats.money !== undefined ? { money: stats.money } : {}),
          ...(stats.population !== undefined ? { population: stats.population } : {}),
          ...(stats.income !== undefined ? { income: stats.income } : {}),
          ...(stats.expenses !== undefined ? { expenses: stats.expenses } : {}),
          ...(stats.tax_income !== undefined ? { tax_income: stats.tax_income } : {}),
          ...(stats.tax_income_population !== undefined ? { tax_income_population: stats.tax_income_population } : {}),
          ...(stats.tax_income_business !== undefined ? { tax_income_business: stats.tax_income_business } : {}),
          ...(stats.tax_income_property !== undefined ? { tax_income_property: stats.tax_income_property } : {}),
          ...(stats.building_income !== undefined ? { building_income: stats.building_income } : {}),
          ...(stats.company_tax_income !== undefined ? { company_tax_income: stats.company_tax_income } : {}),
          ...(stats.budget_expenses !== undefined ? { budget_expenses: stats.budget_expenses } : {}),
          ...(stats.budget_cost_police !== undefined ? { budget_cost_police: stats.budget_cost_police } : {}),
          ...(stats.budget_cost_fire !== undefined ? { budget_cost_fire: stats.budget_cost_fire } : {}),
          ...(stats.budget_cost_health !== undefined ? { budget_cost_health: stats.budget_cost_health } : {}),
          ...(stats.budget_cost_education !== undefined ? { budget_cost_education: stats.budget_cost_education } : {}),
          ...(stats.budget_cost_transportation !== undefined ? { budget_cost_transportation: stats.budget_cost_transportation } : {}),
          ...(stats.budget_cost_parks !== undefined ? { budget_cost_parks: stats.budget_cost_parks } : {}),
          ...(stats.budget_cost_power !== undefined ? { budget_cost_power: stats.budget_cost_power } : {}),
          ...(stats.budget_cost_water !== undefined ? { budget_cost_water: stats.budget_cost_water } : {}),
          ...(stats.maintenance_expenses !== undefined ? { maintenance_expenses: stats.maintenance_expenses } : {}),
          ...(stats.administration_base_expenses !== undefined ? { administration_base_expenses: stats.administration_base_expenses } : {}),
          ...(stats.civic_overhead_expenses !== undefined ? { civic_overhead_expenses: stats.civic_overhead_expenses } : {}),
          ...(stats.utility_overhead_expenses !== undefined ? { utility_overhead_expenses: stats.utility_overhead_expenses } : {}),
          ...(stats.jobs !== undefined ? { jobs: stats.jobs } : {}),
          ...(stats.happiness !== undefined ? { happiness: stats.happiness } : {}),
          ...(stats.power_production !== undefined ? { power_production: stats.power_production } : {}),
          ...(stats.power_consumption !== undefined ? { power_consumption: stats.power_consumption } : {}),
          ...(stats.power_season_multiplier !== undefined ? { power_season_multiplier: stats.power_season_multiplier } : {}),
          ...(stats.power_import_units !== undefined ? { power_import_units: stats.power_import_units } : {}),
          ...(stats.power_import_cost !== undefined ? { power_import_cost: stats.power_import_cost } : {}),
          ...(stats.power_import_price_per_unit !== undefined ? { power_import_price_per_unit: stats.power_import_price_per_unit } : {}),
          ...(stats.power_sold_mw !== undefined ? { power_sold_mw: stats.power_sold_mw } : {}),
          ...(stats.power_bought_mw !== undefined ? { power_bought_mw: stats.power_bought_mw } : {}),
          ...(stats.power_production_effective !== undefined ? { power_production_effective: stats.power_production_effective } : {}),
          ...(stats.power_balance_effective !== undefined ? { power_balance_effective: stats.power_balance_effective } : {}),
          ...(stats.power_surplus_pct !== undefined ? { power_surplus_pct: stats.power_surplus_pct } : {}),
          ...(stats.power_available_to_sell !== undefined ? { power_available_to_sell: stats.power_available_to_sell } : {}),
          ...(stats.power_buffer_mw !== undefined ? { power_buffer_mw: stats.power_buffer_mw } : {}),
          ...(stats.power_buffer_pct !== undefined ? { power_buffer_pct: stats.power_buffer_pct } : {}),
          ...(stats.water_production !== undefined ? { water_production: stats.water_production } : {}),
          ...(stats.water_consumption !== undefined ? { water_consumption: stats.water_consumption } : {}),
          ...(stats.water_net_deficit !== undefined ? { water_net_deficit: stats.water_net_deficit } : {}),
          ...(stats.water_storage_level !== undefined ? { water_storage_level: stats.water_storage_level } : {}),
          ...(stats.water_storage_capacity !== undefined ? { water_storage_capacity: stats.water_storage_capacity } : {}),
          ...(stats.demand_residential !== undefined ? { demand_residential: stats.demand_residential } : {}),
          ...(stats.demand_commercial !== undefined ? { demand_commercial: stats.demand_commercial } : {}),
          ...(stats.demand_industrial !== undefined ? { demand_industrial: stats.demand_industrial } : {}),
          ...(stats.zones_residential !== undefined ? { zones_residential: stats.zones_residential } : {}),
          ...(stats.zones_commercial !== undefined ? { zones_commercial: stats.zones_commercial } : {}),
          ...(stats.zones_industrial !== undefined ? { zones_industrial: stats.zones_industrial } : {}),
          ...(stats.buildings_residential !== undefined ? { buildings_residential: stats.buildings_residential } : {}),
          ...(stats.buildings_commercial !== undefined ? { buildings_commercial: stats.buildings_commercial } : {}),
          ...(stats.buildings_industrial !== undefined ? { buildings_industrial: stats.buildings_industrial } : {}),
        },
        ...(stats.year !== undefined ? { year: stats.year } : {}),
        ...(stats.month !== undefined ? { month: stats.month } : {}),
        ...(stats.taxRate !== undefined ? { taxRate: stats.taxRate } : {}),
        ...(stats.tick !== undefined ? { tick: stats.tick } : {}),
        ...(stats.gameSpeed !== undefined ? { speed: clamp(Math.round(stats.gameSpeed), 0, 3) as 0 | 1 | 2 | 3 } : {}),
        ...(effectiveTaxRate !== undefined ? { effectiveTaxRate: clamp(Math.round(effectiveTaxRate), 0, 100) } : {}),
        ...(typeof disastersEnabled === 'boolean' ? { disastersEnabled } : {}),
        ...(hasBudgetUpdate ? { budget: budgetFromServer } : {}),
      };
    }, []),
    // Deaktiviert Remote-Stats-Override (wenn wir Stats-Sender werden)
    clearRemoteStatsOverride: useCallback(() => {
      console.log('[GameContext] 🧹 Remote-Stats-Override gelöscht (wir sind jetzt Stats-Sender)');
      remoteStatsOverrideRef.current = null;
    }, []),
    // Partnership-Callbacks für WebSocket-Events
    setPartnershipDiscoveredCallback,
    setPartnershipConnectedCallback,
    // API-basierte Partnership-Funktionen
    discoverCityWithApi,
    connectToCityWithApi,
    loadPartnershipsFromApi,
    municipalitySlug,
    municipalityRole,
    canton,
    bauzoneMode,
    setBauzoneMode,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}
