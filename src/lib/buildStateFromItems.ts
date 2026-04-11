/**
 * Build Game State from game_items
 * 
 * Rekonstruiert einen vollständigen GameState aus den einzelnen
 * game_items Einträgen in der Datenbank.
 * 
 * Statt den komprimierten JSON-Blob zu laden, wird ein leeres Grid
 * erstellt und alle Items (Gebäude, Zonen) darauf platziert.
 */

import type {
  GameState,
  Tile,
  Building,
  BuildingType,
  ZoneType,
  Stats,
  Budget,
  ServiceCoverage,
  WaterBody,
} from '@/types/game';
import { generateWaterName } from '@/lib/names';
import { calcPopJobsStatic } from '@/lib/buildingOccupancy';

// ==========================================
// TYPES (API-Response)
// ==========================================

export interface GameItemFromApi {
  id: number;
  action_type: 'place' | 'bulldoze' | 'zone' | 'bauzone' | 'stats_update';
  tool: string | null;
  zone_type: string | null;
  x: number;
  y: number;
  player_id: string;
  user_id: number | null;
  version: number;
  metadata?: {
    elevation?: number;
    paintColor?: string;
    hasSubway?: boolean;
    hasRailOverlay?: boolean;
    [key: string]: unknown;
  } | null;
}

export interface ItemsApiResponse {
  room_code: string;
  municipality_slug: string;
  municipality_name: string;
  grid_size: number;
  version: number;
  item_count: number;
  items: GameItemFromApi[];
  stats: {
    money: number;
    population: number;
    income: number;
    expenses: number;
    jobs: number;
    happiness: number;
    health?: number;
    education?: number;
    safety?: number;
    environment?: number;
    demand?: {
      residential: number;
      commercial: number;
      industrial: number;
    };
    tax_rate?: number;
    effective_tax_rate?: number;
    game_speed?: number;
    budget?: Budget;
    settings?: {
      taxRate?: number;
      effectiveTaxRate?: number;
      speed?: number;
      disastersEnabled?: boolean;
      selectedTool?: string;
    };
    water_bodies?: Array<{
      id?: string;
      name: string;
      type: 'lake' | 'ocean' | 'river';
      centerX: number;
      centerY: number;
    }>;
  } | null;
  city_name: string;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Building types that don't require construction (already complete when placed)
const NO_CONSTRUCTION_TYPES: string[] = [
  'grass', 'empty', 'water', 'road', 'bridge', 'tree',
  'tree_oak', 'tree_maple', 'tree_birch', 'tree_willow',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar',
  'tree_palm', 'tree_bamboo', 'tree_coconut',
  'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria',
  'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral',
  'flower_bed', 'flower_planter',
  'furni', // Habbo-style furniture – instant placement
  'mansion', // Premium-Gebäude – sofort fertig gebaut
];

function createBuilding(type: BuildingType, savedProgress?: number, tileX = 0, tileY = 0): Building {
  // Terrain (grass, water, tree, road etc.) → sofort fertig (100)
  // Gebäude → gespeicherten Progress nehmen, oder 0 wenn keiner da
  let constructionProgress: number;
  if (NO_CONSTRUCTION_TYPES.includes(type) || type.startsWith('furni_')) {
    constructionProgress = 100;
  } else if (savedProgress !== undefined) {
    constructionProgress = savedProgress;
  } else {
    constructionProgress = 0;
  }

  // Population + Jobs direkt berechnen wenn Gebäude fertig gebaut
  const level = type === 'grass' || type === 'empty' || type === 'water' ? 0 : 1;
  let population = 0;
  let jobs = 0;
  if (constructionProgress >= 100 && type !== 'grass' && type !== 'empty' && type !== 'water') {
    const pj = calcPopJobsStatic(type, level, tileX, tileY);
    population = pj.population;
    jobs = pj.jobs;
  }

  return {
    type,
    level,
    population,
    jobs,
    powered: false,
    watered: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress,
    abandoned: false,
  };
}

function applyBuildingRuntimeMetadata(building: Building, metadata?: Record<string, unknown> | null, tileX = 0, tileY = 0): Building {
  if (!metadata) return building;

  if (typeof metadata.abandoned === 'boolean') {
    building.abandoned = metadata.abandoned;
  }
  if (typeof metadata.onFire === 'boolean') {
    building.onFire = metadata.onFire;
  }
  if (typeof metadata.fireProgress === 'number') {
    building.fireProgress = Math.max(0, Math.min(100, Math.round(metadata.fireProgress)));
  }
  if (typeof metadata.level === 'number') {
    building.level = Math.max(0, Math.round(metadata.level));
  }

  // Population + Jobs berechnen wenn Gebäude fertig gebaut ist (nach Level-Restore)
  if (building.constructionProgress >= 100 && !building.abandoned
      && building.type !== 'grass' && building.type !== 'empty' && building.type !== 'water') {
    const pj = calcPopJobsStatic(building.type, building.level, tileX, tileY);
    building.population = pj.population;
    building.jobs = pj.jobs;
  }

  // Plantagen-Baum: Pflanz-Zeitpunkt aus DB laden
  const plantedAt = metadata.plantedAt ?? metadata.planted_at;
  if (typeof plantedAt === 'number' && plantedAt > 0) {
    building.plantedAt = plantedAt;
  }

  // Upgrade-Bauzeit Felder aus DB laden
  const upgradeStartedAt = metadata.upgradeStartedAt ?? metadata.upgrade_started_at;
  if (typeof upgradeStartedAt === 'number' && upgradeStartedAt > 0) {
    building.upgradeStartedAt = upgradeStartedAt;
  }
  const upgradeTargetLevel = metadata.upgradeTargetLevel ?? metadata.upgrade_target_level;
  if (typeof upgradeTargetLevel === 'number' && upgradeTargetLevel > 0) {
    building.upgradeTargetLevel = upgradeTargetLevel;
  }

  // Autobahn-Verkehrsrichtung
  if (typeof metadata.autobahnDirection === 'string') {
    const validDirs = ['north', 'south', 'east', 'west'];
    if (validDirs.includes(metadata.autobahnDirection)) {
      building.autobahnDirection = metadata.autobahnDirection as 'north' | 'south' | 'east' | 'west';
    }
  }

  // Furni-spezifische Felder
  if (typeof metadata.furniClassname === 'string') {
    building.furniClassname = metadata.furniClassname;
  }
  // Fallback: derive furniClassname from building type if tool starts with furni_
  if (!building.furniClassname && typeof building.type === 'string' && building.type.startsWith('furni_')) {
    building.furniClassname = building.type.replace(/^furni_/, '');
  }
  if (typeof metadata.furniDirection === 'number') {
    building.furniDirection = metadata.furniDirection;
  }
  if (typeof metadata.furniState === 'number') {
    building.furniState = metadata.furniState;
  }

  return building;
}

function applyBuildingFootprint(
  grid: Tile[][],
  gridSize: number,
  anchorX: number,
  anchorY: number,
  metadata?: Record<string, unknown> | null
): void {
  const width = Math.max(1, Math.round((metadata?.footprintWidth as number | undefined) ?? 1));
  const height = Math.max(1, Math.round((metadata?.footprintHeight as number | undefined) ?? 1));
  if (width === 1 && height === 1) return;

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tx = anchorX + dx;
      const ty = anchorY + dy;
      if (tx < 0 || tx >= gridSize || ty < 0 || ty >= gridSize) continue;
      if (dx === 0 && dy === 0) continue;
      grid[ty][tx].building = createBuilding('empty');
      grid[ty][tx].building.metadata = { originX: anchorX, originY: anchorY };
      // Keep zone clear for service footprints (same behavior as runtime placement)
      grid[ty][tx].zone = 'none';
    }
  }
}

function createTile(x: number, y: number, buildingType: BuildingType = 'grass'): Tile {
  return {
    x,
    y,
    zone: 'none',
    building: createBuilding(buildingType),
    landValue: 50,
    pollution: 0,
    crime: 0,
    traffic: 0,
    hasSubway: false,
  };
}

function createEmptyGrid(size: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      row.push(createTile(x, y, 'grass'));
    }
    grid.push(row);
  }
  return grid;
}

function createInitialStats(statsFromDb?: ItemsApiResponse['stats']): Stats {
  return {
    population: statsFromDb?.population ?? 0,
    jobs: statsFromDb?.jobs ?? 0,
    money: statsFromDb?.money ?? 0,
    income: statsFromDb?.income ?? 0,
    expenses: statsFromDb?.expenses ?? 0,
    tax_income: (statsFromDb as Record<string, unknown>)?.tax_income as number ?? 0,
    tax_income_population: (statsFromDb as Record<string, unknown>)?.tax_income_population as number ?? 0,
    tax_income_business: (statsFromDb as Record<string, unknown>)?.tax_income_business as number ?? 0,
    tax_income_property: (statsFromDb as Record<string, unknown>)?.tax_income_property as number ?? 0,
    building_income: (statsFromDb as Record<string, unknown>)?.building_income as number ?? 0,
    company_tax_income: (statsFromDb as Record<string, unknown>)?.company_tax_income as number ?? 0,
    budget_expenses: (statsFromDb as Record<string, unknown>)?.budget_expenses as number ?? 0,
    budget_cost_police: (statsFromDb as Record<string, unknown>)?.budget_cost_police as number ?? 0,
    budget_cost_fire: (statsFromDb as Record<string, unknown>)?.budget_cost_fire as number ?? 0,
    budget_cost_health: (statsFromDb as Record<string, unknown>)?.budget_cost_health as number ?? 0,
    budget_cost_education: (statsFromDb as Record<string, unknown>)?.budget_cost_education as number ?? 0,
    budget_cost_transportation: (statsFromDb as Record<string, unknown>)?.budget_cost_transportation as number ?? 0,
    budget_cost_parks: (statsFromDb as Record<string, unknown>)?.budget_cost_parks as number ?? 0,
    budget_cost_power: (statsFromDb as Record<string, unknown>)?.budget_cost_power as number ?? 0,
    budget_cost_water: (statsFromDb as Record<string, unknown>)?.budget_cost_water as number ?? 0,
    maintenance_expenses: (statsFromDb as Record<string, unknown>)?.maintenance_expenses as number ?? 0,
    administration_base_expenses: (statsFromDb as Record<string, unknown>)?.administration_base_expenses as number ?? 0,
    civic_overhead_expenses: (statsFromDb as Record<string, unknown>)?.civic_overhead_expenses as number ?? 0,
    utility_overhead_expenses: (statsFromDb as Record<string, unknown>)?.utility_overhead_expenses as number ?? 0,
    happiness: statsFromDb?.happiness ?? 50,
    health: statsFromDb?.health ?? 50,
    education: statsFromDb?.education ?? 50,
    safety: statsFromDb?.safety ?? 50,
    environment: statsFromDb?.environment ?? 75,
    demand: {
      residential: statsFromDb?.demand?.residential ?? 50,
      commercial: statsFromDb?.demand?.commercial ?? 30,
      industrial: statsFromDb?.demand?.industrial ?? 40,
    },
    employed: (statsFromDb as Record<string, unknown>)?.employed as number ?? 0,
    unemployed: (statsFromDb as Record<string, unknown>)?.unemployed as number ?? 0,
    unemployment_rate: (statsFromDb as Record<string, unknown>)?.unemployment_rate as number ?? 0,
    workforce: (statsFromDb as Record<string, unknown>)?.workforce as number ?? 0,
    workforce_rate: (statsFromDb as Record<string, unknown>)?.workforce_rate as number ?? 0,
    children: (statsFromDb as Record<string, unknown>)?.children as number ?? 0,
    seniors: (statsFromDb as Record<string, unknown>)?.seniors as number ?? 0,
    students: (statsFromDb as Record<string, unknown>)?.students as number ?? 0,
    social_fund: (statsFromDb as Record<string, unknown>)?.social_fund as number ?? 0,
    social_contribution_rate: (statsFromDb as Record<string, unknown>)?.social_contribution_rate as number ?? 5,
    welfare_per_unemployed: (statsFromDb as Record<string, unknown>)?.welfare_per_unemployed as number ?? 8,
    social_fund_income: (statsFromDb as Record<string, unknown>)?.social_fund_income as number ?? 0,
    social_fund_expenses: (statsFromDb as Record<string, unknown>)?.social_fund_expenses as number ?? 0,
    social_expenses: (statsFromDb as Record<string, unknown>)?.social_expenses as number ?? 0,
    welfare_coverage: (statsFromDb as Record<string, unknown>)?.welfare_coverage as number ?? 100,
    school_capacity: (statsFromDb as Record<string, unknown>)?.school_capacity as number ?? 0,
    uni_capacity: (statsFromDb as Record<string, unknown>)?.uni_capacity as number ?? 0,
    education_overcrowding: (statsFromDb as Record<string, unknown>)?.education_overcrowding as number ?? 0,
    health_capacity: (statsFromDb as Record<string, unknown>)?.health_capacity as number ?? 0,
    health_demand: (statsFromDb as Record<string, unknown>)?.health_demand as number ?? 0,
    health_adequacy: (statsFromDb as Record<string, unknown>)?.health_adequacy as number ?? 0,
  };
}

function createInitialBudget(budgetFromDb?: Budget | null): Budget {
  if (budgetFromDb) {
    return budgetFromDb;
  }
  return {
    police: { name: 'Police', funding: 100, cost: 0 },
    fire: { name: 'Fire', funding: 100, cost: 0 },
    health: { name: 'Health', funding: 100, cost: 0 },
    education: { name: 'Education', funding: 100, cost: 0 },
    transportation: { name: 'Transportation', funding: 100, cost: 0 },
    parks: { name: 'Parks', funding: 100, cost: 0 },
    power: { name: 'Power', funding: 100, cost: 0 },
    water: { name: 'Water', funding: 100, cost: 0 },
  };
}

function createServiceCoverage(size: number): ServiceCoverage {
  const createGrid = () => {
    const grid: number[][] = new Array(size);
    for (let y = 0; y < size; y++) {
      grid[y] = new Array(size).fill(0);
    }
    return grid;
  };
  
  const createBoolGrid = () => {
    const grid: boolean[][] = new Array(size);
    for (let y = 0; y < size; y++) {
      grid[y] = new Array(size).fill(false);
    }
    return grid;
  };

  return {
    police: createGrid(),
    fire: createGrid(),
    health: createGrid(),
    education: createGrid(),
    power: createBoolGrid(),
    water: createBoolGrid(),
  };
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==========================================
// WATER BODY DETECTION
// ==========================================

/**
 * Gruppiere Wasser-Tiles zu zusammenhängenden WaterBodies
 * (Flood-Fill Algorithmus)
 */
function buildWaterBodies(waterTiles: Array<{ x: number; y: number }>, gridSize: number): WaterBody[] {
  if (waterTiles.length === 0) return [];
  
  // Set für schnelle Lookups
  const waterSet = new Set(waterTiles.map(t => `${t.x},${t.y}`));
  const visited = new Set<string>();
  const bodies: WaterBody[] = [];
  
  for (const tile of waterTiles) {
    const key = `${tile.x},${tile.y}`;
    if (visited.has(key)) continue;
    
    // Flood-Fill: Finde zusammenhängende Wasser-Tiles
    const bodyTiles: Array<{ x: number; y: number }> = [];
    const queue = [tile];
    
    while (queue.length > 0) {
      const current = queue.pop()!;
      const ck = `${current.x},${current.y}`;
      if (visited.has(ck)) continue;
      visited.add(ck);
      bodyTiles.push(current);
      
      // Nachbarn prüfen (4 Richtungen)
      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
      ];
      
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < gridSize && n.y >= 0 && n.y < gridSize) {
          const nk = `${n.x},${n.y}`;
          if (waterSet.has(nk) && !visited.has(nk)) {
            queue.push(n);
          }
        }
      }
    }
    
    if (bodyTiles.length > 0) {
      // Center berechnen
      const centerX = Math.round(bodyTiles.reduce((s, t) => s + t.x, 0) / bodyTiles.length);
      const centerY = Math.round(bodyTiles.reduce((s, t) => s + t.y, 0) / bodyTiles.length);
      
      // Am Rand = Ocean, sonst Lake
      const isEdge = bodyTiles.some(t => t.x === 0 || t.x === gridSize - 1 || t.y === 0 || t.y === gridSize - 1);
      
      bodies.push({
        id: generateUUID(),
        name: generateWaterName(isEdge ? 'ocean' : 'lake'),
        type: isEdge ? 'ocean' : 'lake',
        tiles: bodyTiles,
        centerX,
        centerY,
      });
    }
  }
  
  return bodies;
}

function applySavedWaterBodyNames(
  generated: WaterBody[],
  saved?: Array<{ name: string; type: 'lake' | 'ocean' | 'river'; centerX: number; centerY: number }>
): WaterBody[] {
  if (!saved || saved.length === 0 || generated.length === 0) return generated;

  const usedGenerated = new Set<number>();

  for (const savedBody of saved) {
    let bestIdx = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < generated.length; i++) {
      if (usedGenerated.has(i)) continue;
      if (generated[i].type !== savedBody.type) continue;

      const dx = generated[i].centerX - savedBody.centerX;
      const dy = generated[i].centerY - savedBody.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      generated[bestIdx].name = savedBody.name;
      usedGenerated.add(bestIdx);
    }
  }

  return generated;
}

// ==========================================
// MAIN FUNCTION
// ==========================================

/**
 * Baut einen vollständigen GameState aus game_items Daten auf.
 * 
 * 1. Erstellt ein leeres Grid (alles Gras)
 * 2. Platziert alle Gebäude aus den Items
 * 3. Setzt alle Zonen aus den Items
 * 4. Erstellt Default-Stats/Budget/Services
 * 
 * @param data API-Response von GET /items/{roomCode}
 * @returns Vollständiger GameState
 */
export function buildStateFromItems(data: ItemsApiResponse): GameState {
  const gridSize = data.grid_size || 50;
  
  console.log('[buildStateFromItems] Rekonstruiere Map aus', data.item_count, 'Items, Grid:', gridSize, 'x', gridSize);
  
  // 1. Leeres Grid erstellen
  const grid = createEmptyGrid(gridSize);
  
  // 2. Alle Items auf das Grid anwenden
  let placedBuildings = 0;
  let placedZones = 0;
  let terrainTiles = 0;
  let skipped = 0;
  
  // WaterBodies für den GameState sammeln
  const waterTiles: Array<{ x: number; y: number }> = [];
  
  // Sortierung: zone-Actions zuerst, dann place, dann bulldoze.
  // So überschreiben place-Actions immer die Zone (zone='none'),
  // und Service-Buildings landen nie fälschlich in einer Zone.
  const actionOrder: Record<string, number> = { zone: 0, bauzone: 0, place: 1, bulldoze: 2, stats_update: 3 };
  const sortedItems = [...data.items].sort(
    (a, b) => (actionOrder[a.action_type] ?? 9) - (actionOrder[b.action_type] ?? 9)
  );

  for (const item of sortedItems) {
    const { x, y } = item;
    
    // Bounds-Check
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
      skipped++;
      continue;
    }
    
    if (item.action_type === 'place' && item.tool) {
      // Gebäude/Strasse/Wasser/Bäume/Infrastruktur platzieren
      // Bau-Fortschritt aus metadata laden (0-100)
      const savedProgress = item.metadata?.constructionProgress as number | undefined
        ?? (item.metadata?.constructed === true ? 100 : undefined);
      // Place-Aktion bedeutet immer: kein Zone-State auf diesem Tile
      // (wichtig z.B. für power_plant, sonst bleibt Bau in zoned-Logik hängen)
      grid[y][x].zone = 'none';
      grid[y][x].building = applyBuildingRuntimeMetadata(
        createBuilding(item.tool as BuildingType, savedProgress, x, y),
        (item.metadata as Record<string, unknown> | null) ?? null,
        x, y
      );
      applyBuildingFootprint(
        grid,
        gridSize,
        x,
        y,
        (item.metadata as Record<string, unknown> | null) ?? null
      );
      placedBuildings++;

      // Wasser-Tiles merken für waterBodies
      if (item.tool === 'water') {
        waterTiles.push({ x, y });
      }
    } else if (item.action_type === 'zone' && item.zone_type) {
      // Zone setzen
      grid[y][x].zone = item.zone_type as ZoneType;
      placedZones++;

      // Wenn ein Gebäude in der Zone evolviert war (z.B. residential_small),
      // wird es aus metadata.buildingType wiederhergestellt
      const evolvedType = item.metadata?.buildingType as string | undefined;
      if (evolvedType) {
        const savedProgress = item.metadata?.constructionProgress as number | undefined
          ?? (item.metadata?.constructed === true ? 100 : undefined);
        grid[y][x].building = applyBuildingRuntimeMetadata(
          createBuilding(evolvedType as BuildingType, savedProgress, x, y),
          (item.metadata as Record<string, unknown> | null) ?? null,
          x, y
        );
        applyBuildingFootprint(
          grid,
          gridSize,
          x,
          y,
          (item.metadata as Record<string, unknown> | null) ?? null
        );
        placedBuildings++;
      }
    } else if (item.action_type === 'bauzone') {
      const enabled = item.metadata?.enabled !== false;
      grid[y][x].bauzone = enabled || undefined;
    } else if (item.action_type === 'bulldoze') {
      // Bulldoze = zurück zu Gras
      grid[y][x].building = createBuilding('grass');
      grid[y][x].zone = 'none';
    }
    
    // Terrain-Metadaten anwenden (Elevation, PaintColor, Subway, Rail)
    if (item.metadata) {
      if (item.metadata.elevation !== undefined && Number.isFinite(Number(item.metadata.elevation))) {
        grid[y][x].elevation = Math.max(-6, Math.min(6, Math.round(Number(item.metadata.elevation))));
        terrainTiles++;
      }
      if (item.metadata.paintColor) {
        grid[y][x].paintColor = item.metadata.paintColor as Tile['paintColor'];
      }
      if (item.metadata.hasSubway) {
        grid[y][x].hasSubway = true;
      }
      if (item.metadata.hasRailOverlay) {
        grid[y][x].hasRailOverlay = true;
      }
    }
  }
  
  // WaterBodies aus den gesammelten Wasser-Tiles generieren
  const savedWaterBodies = data.stats?.water_bodies;
  const waterBodies = applySavedWaterBodyNames(
    buildWaterBodies(waterTiles, gridSize),
    savedWaterBodies
  );
  
  console.log('[buildStateFromItems] Ergebnis:', {
    placedBuildings,
    placedZones,
    terrainTiles,
    waterTiles: waterTiles.length,
    waterBodies: waterBodies.length,
    skipped,
    cityName: data.city_name,
  });
  
  // 3. Default City erstellen
  const defaultCity = {
    id: generateUUID(),
    name: data.city_name || 'City',
    bounds: {
      minX: 0,
      minY: 0,
      maxX: gridSize - 1,
      maxY: gridSize - 1,
    },
    economy: {
      population: data.stats?.population || 0,
      jobs: data.stats?.jobs || 0,
      income: data.stats?.income || 0,
      expenses: data.stats?.expenses || 0,
      happiness: data.stats?.happiness || 50,
      lastCalculated: 0,
    },
    color: '#3b82f6',
  };
  
  // 4. Vollständigen GameState zusammenbauen
  const gameState: GameState = {
    id: generateUUID(),
    grid,
    gridSize,
    cityName: data.city_name || 'City',
    year: 2026,
    month: 1,
    day: 1,
    hour: 12,
    tick: 0,
    speed: (data.stats?.game_speed as 0 | 1 | 2 | 3) ?? (data.stats?.settings?.speed as 0 | 1 | 2 | 3) ?? 1,
    selectedTool: 'select',
    taxRate: data.stats?.tax_rate ?? data.stats?.settings?.taxRate ?? 9,
    effectiveTaxRate: data.stats?.effective_tax_rate ?? data.stats?.settings?.effectiveTaxRate ?? data.stats?.tax_rate ?? 9,
    stats: createInitialStats(data.stats),
    budget: createInitialBudget(data.stats?.budget ?? null),
    services: createServiceCoverage(gridSize),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: data.stats?.settings?.disastersEnabled ?? true,
    adjacentCities: [],  // Werden von der API separat geladen
    waterBodies,
    gameVersion: 0,
    cities: [defaultCity],
    weatherType: 'clear',
    weatherIntensity: 0,
    weatherTemperature: null,
  };
  
  return gameState;
}

// ==========================================
// CHUNK PATCH FUNCTION
// ==========================================

/**
 * Wendet eine Liste von Items auf ein bestehendes Grid an (Chunk-Loading).
 *
 * Im Gegensatz zu buildStateFromItems erstellt diese Funktion KEIN neues Grid,
 * sondern patcht das übergebene Grid in-place. Sie wird genutzt wenn neue
 * Chunks nachgeladen werden.
 *
 * @param grid    Bestehendes Grid (wird direkt mutiert)
 * @param gridSize  Grösse des Grids
 * @param items   Items die auf das Grid angewendet werden sollen
 */
export function applyItemsToGrid(
  grid: Tile[][],
  gridSize: number,
  items: GameItemFromApi[]
): void {
  const actionOrder: Record<string, number> = { zone: 0, bauzone: 0, place: 1, bulldoze: 2, stats_update: 3 };
  const sortedItems = [...items].sort(
    (a, b) => (actionOrder[a.action_type] ?? 9) - (actionOrder[b.action_type] ?? 9)
  );

  for (const item of sortedItems) {
    const { x, y } = item;
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
    if (!grid[y]?.[x]) continue;

    if (item.action_type === 'place' && item.tool) {
      const savedProgress = item.metadata?.constructionProgress as number | undefined
        ?? (item.metadata?.constructed === true ? 100 : undefined);
      grid[y][x].zone = 'none';
      grid[y][x].building = applyBuildingRuntimeMetadata(
        createBuilding(item.tool as BuildingType, savedProgress, x, y),
        (item.metadata as Record<string, unknown> | null) ?? null,
        x, y
      );
      applyBuildingFootprint(grid, gridSize, x, y, (item.metadata as Record<string, unknown> | null) ?? null);
    } else if (item.action_type === 'zone' && item.zone_type) {
      grid[y][x].zone = item.zone_type as ZoneType;
      const evolvedType = item.metadata?.buildingType as string | undefined;
      if (evolvedType) {
        const savedProgress = item.metadata?.constructionProgress as number | undefined
          ?? (item.metadata?.constructed === true ? 100 : undefined);
        grid[y][x].building = applyBuildingRuntimeMetadata(
          createBuilding(evolvedType as BuildingType, savedProgress, x, y),
          (item.metadata as Record<string, unknown> | null) ?? null,
          x, y
        );
        applyBuildingFootprint(grid, gridSize, x, y, (item.metadata as Record<string, unknown> | null) ?? null);
      }
    } else if (item.action_type === 'bauzone') {
      const enabled = item.metadata?.enabled !== false;
      grid[y][x].bauzone = enabled || undefined;
    } else if (item.action_type === 'bulldoze') {
      grid[y][x].building = createBuilding('grass');
      grid[y][x].zone = 'none';
    }

    if (item.metadata) {
      if (item.metadata.elevation !== undefined && Number.isFinite(Number(item.metadata.elevation))) {
        grid[y][x].elevation = Math.max(-6, Math.min(6, Math.round(Number(item.metadata.elevation))));
      }
      if (item.metadata.paintColor) {
        grid[y][x].paintColor = item.metadata.paintColor as Tile['paintColor'];
      }
      if (item.metadata.hasSubway) {
        grid[y][x].hasSubway = true;
      }
      if (item.metadata.hasRailOverlay) {
        grid[y][x].hasRailOverlay = true;
      }
    }
  }
}
