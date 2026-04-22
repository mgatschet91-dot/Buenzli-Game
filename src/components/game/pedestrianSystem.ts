/**
 * Dynamic Pedestrian System
 * 
 * Manages pedestrian behaviors including:
 * - Walking to destinations
 * - Entering and exiting buildings
 * - Participating in recreational activities
 * - Socializing with other pedestrians
 * - Varying activities based on building type
 */

import { Tile, BuildingType } from '@/types/game';
import {
  Pedestrian,
  PedestrianState,
  PedestrianActivity,
  PedestrianDestType,
  CarDirection,
  TILE_WIDTH,
  TILE_HEIGHT,
} from './types';
import {
  PEDESTRIAN_SKIN_COLORS,
  PEDESTRIAN_SHIRT_COLORS,
  PEDESTRIAN_PANTS_COLORS,
  PEDESTRIAN_HAT_COLORS,
  PEDESTRIAN_BUILDING_ENTER_TIME,
  PEDESTRIAN_APPROACH_TIME,
  PEDESTRIAN_MIN_ACTIVITY_TIME,
  PEDESTRIAN_MAX_ACTIVITY_TIME,
  PEDESTRIAN_BUILDING_MIN_TIME,
  PEDESTRIAN_BUILDING_MAX_TIME,
  PEDESTRIAN_SOCIAL_CHANCE,
  PEDESTRIAN_SOCIAL_DURATION,
  PEDESTRIAN_DOG_CHANCE,
  PEDESTRIAN_BAG_CHANCE,
  PEDESTRIAN_HAT_CHANCE,
  PEDESTRIAN_IDLE_CHANCE,
  PEDESTRIAN_BEACH_MIN_TIME,
  PEDESTRIAN_BEACH_MAX_TIME,
  PEDESTRIAN_BEACH_SWIM_CHANCE,
  PEDESTRIAN_MAT_COLORS,
} from './constants';
import { isRoadTile, getDirectionOptions, findPathOnRoads, getDirectionToTile, findNearestRoadToBuilding } from './utils';

// Building types that are recreational (pedestrians do activities here)
const RECREATION_BUILDINGS: BuildingType[] = [
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
  'playground_large', 'baseball_field_small', 'soccer_field_small',
  'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park',
  'mini_golf_course', 'bleachers_field', 'community_garden', 'pond_park',
  'amphitheater', 'community_center', 'campground', 'marina_docks_small',
  'pier_large', 'amusement_park', 'stadium', 'museum',
];

// Buildings pedestrians can enter and spend time inside
const ENTERABLE_BUILDINGS: BuildingType[] = [
  'shop_small', 'shop_medium', 'office_low', 'office_high', 'mall',
  'school', 'university', 'hospital', 'museum', 'community_center',
  'factory_small', 'factory_medium', 'factory_large', 'warehouse',
  'police_station', 'fire_station', 'city_hall', 'rail_station',
  'subway_station', 'mountain_lodge',
];

// Shop buildings where pedestrians visibly approach and shop
const SHOP_BUILDINGS: BuildingType[] = [
  'shop_small', 'shop_medium', 'mall',
];

// Map building types to possible activities
// IMPORTANT: Sports activities (basketball, tennis, soccer, baseball) should ONLY
// appear at their dedicated facilities, not at regular parks
const BUILDING_ACTIVITIES: Partial<Record<BuildingType, PedestrianActivity[]>> = {
  // Sports - ONLY at dedicated facilities
  'basketball_courts': ['playing_basketball', 'watching_game'],
  'tennis': ['playing_tennis', 'watching_game'],
  'soccer_field_small': ['playing_soccer', 'watching_game'],
  'baseball_field_small': ['playing_baseball', 'watching_game'],
  'football_field': ['playing_soccer', 'watching_game'],
  'baseball_stadium': ['watching_game', 'sitting_bench'],
  'stadium': ['watching_game', 'sitting_bench'],
  'bleachers_field': ['watching_game', 'sitting_bench'],

  // Recreation facilities
  'swimming_pool': ['swimming'],
  'skate_park': ['skateboarding', 'watching_game'],
  'playground_small': ['playground'],
  'playground_large': ['playground', 'sitting_bench'],
  'mini_golf_course': ['walking_dog', 'sitting_bench'],
  'go_kart_track': ['watching_game'],
  'roller_coaster_small': ['watching_game'],
  'amusement_park': ['walking_dog', 'sitting_bench', 'watching_game'],

  // Parks and relaxation - NO ball sports here
  'park': ['sitting_bench', 'picnicking', 'walking_dog'],
  'park_large': ['sitting_bench', 'picnicking', 'walking_dog'],
  'community_garden': ['sitting_bench', 'picnicking'],
  'pond_park': ['sitting_bench', 'picnicking', 'walking_dog'],
  'campground': ['sitting_bench', 'picnicking'],
  'amphitheater': ['watching_game', 'sitting_bench'],
  'greenhouse_garden': ['sitting_bench'],
  'mountain_trailhead': ['jogging', 'walking_dog'],

  // Waterfront
  'marina_docks_small': ['sitting_bench', 'walking_dog'],
  'pier_large': ['sitting_bench', 'walking_dog'],

  // Indoor activities (for when exiting)
  'shop_small': ['shopping'],
  'shop_medium': ['shopping'],
  'mall': ['shopping'],
  'office_low': ['working'],
  'office_high': ['working'],
  'office_building_small': ['working'],
  'factory_small': ['working'],
  'factory_medium': ['working'],
  'factory_large': ['working'],
  'warehouse': ['working'],
  'school': ['studying'],
  'university': ['studying'],
  'museum': ['watching_game', 'sitting_bench'],
  'community_center': ['sitting_bench', 'watching_game'],
  'subway_station': ['commuting'],
  'rail_station': ['commuting'],
};

// Activities that require the pedestrian to have a ball
const BALL_ACTIVITIES: PedestrianActivity[] = [
  'playing_basketball', 'playing_tennis', 'playing_soccer', 'playing_baseball'
];

/**
 * Get a random activity for a building type
 */
export function getActivityForBuilding(buildingType: BuildingType): PedestrianActivity {
  const activities = BUILDING_ACTIVITIES[buildingType];
  if (activities && activities.length > 0) {
    return activities[Math.floor(Math.random() * activities.length)];
  }
  return 'none';
}

/**
 * Check if a building type is recreational
 */
export function isRecreationalBuilding(buildingType: BuildingType): boolean {
  return RECREATION_BUILDINGS.includes(buildingType);
}

/**
 * Check if a building type can be entered by pedestrians
 */
export function canPedestrianEnterBuilding(buildingType: BuildingType): boolean {
  return ENTERABLE_BUILDINGS.includes(buildingType);
}

/**
 * Check if a building type is a shop (visible approach/shopping)
 */
export function isShopBuilding(buildingType: BuildingType): boolean {
  return SHOP_BUILDINGS.includes(buildingType);
}

/**
 * Generate random activity position offset within a tile
 * Spread pedestrians out within the tile bounds
 */
export function getRandomActivityOffset(): { x: number; y: number } {
  // Random offset to spread pedestrians within tile (stays inside diamond)
  return {
    x: (Math.random() - 0.5) * 20,
    y: (Math.random() - 0.5) * 10,
  };
}

// ==========================================
// NPC WORKER SYSTEM
// ==========================================

const NPC_SEARCH_RADIUS = 15;
const NPC_WORK_DURATION = 5; // Sekunden zum Baumfällen
const NPC_MAX_TREES = 2; // Max Bäume pro NPC (Holzfäller, normaler Modus)
const NPC_PLANT_DURATION = 4; // Sekunden zum Baumpflanzen
const NPC_MAX_PLANTS = 3; // Max Bäume pro NPC (Gärtner)

// === Holzfäller-Haus Plantagen-System Konstanten ===
// Kein Upgrade-System — stattdessen Arbeiter einzeln hinzufügen (1-4).
// building.level = Anzahl Arbeiter. Jeder Arbeiter = 1 Job in der Stadt.
export const WOODCUTTER_HOUSE_MAX_WORKERS = 4;
export const WOODCUTTER_WORKER_COST = 200; // $200 pro zusätzlichem Arbeiter
// growthMs = Echtzeit-Millisekunden bis ein Baum reif ist.
// Produktion: 6 Stunden = 4 Erntezyklen pro Tag
export const WOODCUTTER_GROWTH_MS = 6 * 60 * 60 * 1000; // 6h Echtzeit

export const WOODCUTTER_LEVEL_CONFIG: Record<number, {
  maxTrees: number;
  radius: number;
  growthMs: number;
  moneyPerHarvest: number;
  npcCount: number;
  plantDuration: number;
  chopDuration: number;
}> = {
  1: { maxTrees: 6,  radius: 4, growthMs: WOODCUTTER_GROWTH_MS, moneyPerHarvest: 150, npcCount: 1, plantDuration: 4, chopDuration: 5 },
  2: { maxTrees: 9,  radius: 5, growthMs: WOODCUTTER_GROWTH_MS, moneyPerHarvest: 175, npcCount: 2, plantDuration: 4, chopDuration: 5 },
  3: { maxTrees: 12, radius: 5, growthMs: WOODCUTTER_GROWTH_MS, moneyPerHarvest: 200, npcCount: 3, plantDuration: 4, chopDuration: 5 },
  4: { maxTrees: 16, radius: 6, growthMs: WOODCUTTER_GROWTH_MS, moneyPerHarvest: 250, npcCount: 4, plantDuration: 4, chopDuration: 5 },
};
// Chase System
const NPC_CHASE_ARREST_DISTANCE = 2; // Manhattan-Distanz zum Verhaften
const NPC_CHASE_REPATH_INTERVAL = 1.0; // Sekunden zwischen Pfad-Neuberechnungen
const NPC_CHASE_FLEE_DISTANCE = 10; // Tiles Fluchtdistanz für Gangster
const NPC_ARREST_DURATION = 2.5; // Sekunden für Verhaftungs-Animation
const NPC_POLICE_SPEED = 0.35; // Polizei ist VIEL schneller
const NPC_GANGSTER_SPEED = 0.17; // Gangster ist langsamer
const NPC_INSTANT_ARREST_CHANCE = 0.5; // 50% Chance: sofort verhaftet (ohne Verfolgung)
const NPC_CHASE_MAX_DURATION = 5.0; // Max 5 Sekunden Verfolgung, dann wird er gefasst
// Gangster Robbery System
const NPC_GANGSTER_ROBBERY_DURATION = 3.0; // Sekunden für einen Raubüberfall
const NPC_GANGSTER_ROBBERY_SUCCESS_CHANCE = 0.0; // 0% Erfolg = Polizei kommt IMMER
const NPC_GANGSTER_ROBBERY_COOLDOWN = 3; // Sekunden Abkühlung zwischen Raubzügen
const NPC_GANGSTER_SEARCH_RADIUS = 35; // Tiles Suchradius für Opfer
const NPC_GANGSTER_MAX_ROBBERIES = 5; // Max Raubüberfälle bevor er verschwindet

function emitGameNotification(title: string, message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('game-notification', { detail: { title, message } }));
  }
}

// Bünzli System — rein visueller Inspektor, keine erfundenen Verstösse
const NPC_BUENZLI_SPEED = 0.20; // Gemächlich aber sichtbar
const NPC_BUENZLI_INSPECT_DURATION = 3.5; // Sekunden pro Inspektion (visuell)
const NPC_BUENZLI_MAX_INSPECTIONS = 999; // Patrouilliert unbegrenzt — Server kontrolliert Lebensdauer
const NPC_BUENZLI_RESET_AFTER = 8; // Nach 8 Inspektionen Liste leeren + weiter laufen (keine Ecke)

// Gebäude die der Bünzli inspizieren kann (echte Gebäude, kein Gras/Wasser/Bäume/Strassen)
const BUENZLI_INSPECTABLE_BUILDINGS: string[] = [
  'house_small', 'house_medium', 'house_large', 'apartment_low', 'apartment_mid', 'apartment_high',
  'shop_small', 'shop_medium', 'mall', 'office_low', 'office_high',
  'park', 'park_large', 'school', 'university', 'hospital',
  'factory_small', 'factory_medium', 'factory_large', 'warehouse',
  'police_station', 'fire_station', 'city_hall', 'stadium', 'museum',
  'community_center', 'swimming_pool', 'playground_small', 'playground_large',
  'tennis', 'basketball_courts', 'skate_park',
];

/**
 * Baut einen direkten Grid-Pfad (Manhattan-Pfad) von A nach B.
 * NPC-Worker laufen direkt über Gras, brauchen keine Strasse.
 * Erst X-Richtung, dann Y-Richtung (jeder Schritt = 1 Tile).
 */
export function buildDirectGridPath(
  fromX: number, fromY: number,
  toX: number, toY: number
): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [{ x: fromX, y: fromY }];
  let cx = fromX;
  let cy = fromY;
  // Erst X-Richtung
  while (cx !== toX) {
    cx += cx < toX ? 1 : -1;
    path.push({ x: cx, y: cy });
  }
  // Dann Y-Richtung
  while (cy !== toY) {
    cy += cy < toY ? 1 : -1;
    path.push({ x: cx, y: cy });
  }
  return path;
}

// === Begehbare Tile-Typen für Plantagen-NPCs ===
const WALKABLE_TILE_TYPES = new Set([
  'grass', 'road', 'empty', 'bridge',
  'tree', 'tree_oak', 'tree_maple', 'tree_birch', 'tree_willow',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar',
  'tree_palm', 'tree_bamboo', 'tree_coconut',
  'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria',
  'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral',
  'flower_bed', 'flower_planter',
]);

/**
 * BFS-Pathfinding für Plantagen-NPCs.
 * Findet einen Pfad der Gebäude und Wasser umgeht.
 * Begehbar: Gras, Strassen, Bäume, Büsche, leer.
 * Nicht begehbar: Gebäude, Wasser, Schienen.
 * Das Ziel-Tile ist immer erlaubt (damit NPCs zum Baum/Gras laufen können).
 */
export function buildWalkablePath(
  grid: Tile[][],
  gridSize: number,
  fromX: number, fromY: number,
  toX: number, toY: number
): { x: number; y: number }[] {
  // Trivial: Start = Ziel
  if (fromX === toX && fromY === toY) return [{ x: fromX, y: fromY }];

  const DX = [-1, 1, 0, 0];
  const DY = [0, 0, -1, 1];
  const visited = new Map<number, number>(); // index → parentIndex
  const queue: number[] = [];
  const key = (x: number, y: number) => y * gridSize + x;

  const startKey = key(fromX, fromY);
  const endKey = key(toX, toY);
  visited.set(startKey, -1);
  queue.push(startKey);

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % gridSize;
    const cy = Math.floor(curr / gridSize);

    if (curr === endKey) {
      // Pfad rekonstruieren
      const path: { x: number; y: number }[] = [];
      let k = curr;
      while (k !== -1) {
        path.push({ x: k % gridSize, y: Math.floor(k / gridSize) });
        k = visited.get(k)!;
      }
      path.reverse();
      return path;
    }

    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;

      // Ziel-Tile immer erlaubt
      if (nk === endKey) {
        visited.set(nk, curr);
        queue.push(nk);
        continue;
      }

      // Nur begehbare Tiles
      const tileType = grid[ny]?.[nx]?.building?.type;
      if (!tileType || !WALKABLE_TILE_TYPES.has(tileType)) continue;

      visited.set(nk, curr);
      queue.push(nk);
    }

    // Sicherheitslimit (Performance)
    if (head > 2000) break;
  }

  // Kein Pfad gefunden → Fallback auf direkten Pfad (besser als gar nichts)
  return buildDirectGridPath(fromX, fromY, toX, toY);
}

/**
 * Finde den nächsten Baum in der Nähe einer Position
 * Gibt die Baum-Tile-Position und die nächste Strasse dazu zurück
 * NPC-Worker können auch über Gras laufen, also werden Bäume auch ohne
 * direkte Strassenanbindung gefunden (roadX/roadY = -1 als Fallback)
 */
export function findNearestTree(
  grid: Tile[][],
  gridSize: number,
  fromX: number,
  fromY: number,
  excludeTargets?: { x: number; y: number }[]
): { treeX: number; treeY: number; roadX: number; roadY: number } | null {
  let bestDist = Infinity;
  let bestResult: { treeX: number; treeY: number; roadX: number; roadY: number } | null = null;
  // Fallback: Baum ohne Strasse in der Nähe
  let fallbackDist = Infinity;
  let fallbackResult: { treeX: number; treeY: number; roadX: number; roadY: number } | null = null;

  const minX = Math.max(0, fromX - NPC_SEARCH_RADIUS);
  const maxX = Math.min(gridSize - 1, fromX + NPC_SEARCH_RADIUS);
  const minY = Math.max(0, fromY - NPC_SEARCH_RADIUS);
  const maxY = Math.min(gridSize - 1, fromY + NPC_SEARCH_RADIUS);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (grid[y][x].building.type !== 'tree') continue;

      // Exclude trees already targeted by other NPCs
      if (excludeTargets?.some(t => t.x === x && t.y === y)) continue;

      const dist = Math.abs(x - fromX) + Math.abs(y - fromY);

      // Finde nächste Strasse neben dem Baum
      const road = findNearestRoadToBuilding(grid, gridSize, x, y);
      if (road) {
        if (dist < bestDist) {
          bestDist = dist;
          bestResult = { treeX: x, treeY: y, roadX: road.x, roadY: road.y };
        }
      } else {
        // Kein Strassenanschluss - als Fallback merken (NPC kann trotzdem hinlaufen)
        if (dist < fallbackDist) {
          fallbackDist = dist;
          fallbackResult = { treeX: x, treeY: y, roadX: -1, roadY: -1 };
        }
      }
    }
  }

  return bestResult || fallbackResult;
}

/**
 * Erstelle einen NPC-Holzfäller-Pedestrian
 */
export function createWoodcutterNpc(
  id: number,
  spawnRoadX: number,
  spawnRoadY: number,
  treeX: number,
  treeY: number,
  path: { x: number; y: number }[],
  direction: CarDirection
): Pedestrian {
  const startTile = path[0] || { x: spawnRoadX, y: spawnRoadY };

  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: 0.15, // Etwas schneller als normale Fussgänger
    age: 0,
    maxAge: 999999, // NPCs altern nicht
    // Holzfäller-Look: Braunes Hemd, dunkle Hose
    skinColor: '#d4a76a',
    shirtColor: '#8B4513',   // Sattelbraun
    pantsColor: '#2d3748',   // Dunkle Hose
    hasHat: true,
    hatColor: '#b45309',     // Bernstein-Helm
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'tree',
    homeX: spawnRoadX,
    homeY: spawnRoadY,
    destX: treeX,
    destY: treeY,
    returningHome: false,
    path,
    pathIndex: 0,
    state: 'walking',
    activity: 'none',
    activityProgress: 0,
    activityDuration: NPC_WORK_DURATION,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog: false,
    hasBag: true, // Trägt eine Tasche (Werkzeug)
    hasBeachMat: false,
    matColor: '#8B4513',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    // NPC-spezifische Felder
    isNpcWorker: true,
    npcType: 'woodcutter',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
  };
}

/**
 * Sende einen NPC-Holzfäller zu einem neuen Baum
 * Gibt false zurück wenn kein Baum gefunden wurde
 */
export function sendWoodcutterToNextTree(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Sammle alle Ziel-Bäume anderer NPC-Holzfäller
  const excludeTargets = allPedestrians
    .filter(p => p.isNpcWorker && p.npcType === 'woodcutter' && p.id !== ped.id && !p.returningHome)
    .map(p => ({ x: p.destX, y: p.destY }));

  const target = findNearestTree(grid, gridSize, ped.tileX, ped.tileY, excludeTargets);
  if (!target) {
    console.log(`[NPC #${ped.id}] Kein Baum in Reichweite gefunden`);
    return false;
  }

  // Direkter Pfad zum Baum (NPC-Worker laufen über Gras, brauchen keine Strasse)
  const fullPath = buildDirectGridPath(ped.tileX, ped.tileY, target.treeX, target.treeY);

  if (fullPath.length < 2) {
    console.log(`[NPC #${ped.id}] Pfad zu kurz zum Baum (${target.treeX},${target.treeY})`);
    return false;
  }

  ped.destX = target.treeX;
  ped.destY = target.treeY;
  ped.destType = 'tree';
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.returningHome = false;
  ped.activity = 'none';
  ped.activityProgress = 0;
  ped.npcWorkProgress = 0;

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  console.log(`[NPC #${ped.id}] → Nächster Baum (${target.treeX},${target.treeY}), Pfad: ${fullPath.length} Tiles`);
  return true;
}

// ==========================================
// PLANTAGEN-HOLZFÄLLER SYSTEM (Haus-basiert)
// ==========================================

/**
 * Erstelle einen Plantagen-Holzfäller NPC der zu einem Holzfäller-Haus gehört
 */
export function createPlantationWoodcutterNpc(
  id: number,
  houseX: number,
  houseY: number,
  direction: CarDirection
): Pedestrian {
  return {
    id,
    tileX: houseX,
    tileY: houseY,
    direction,
    progress: 0,
    speed: 0.15,
    age: 0,
    maxAge: 999999, // Plantagen-NPCs despawnen nie (nur wenn Haus abgerissen)
    skinColor: '#d4a76a',
    shirtColor: '#8B4513',   // Sattelbraun
    pantsColor: '#2d3748',   // Dunkle Hose
    hasHat: true,
    hatColor: '#b45309',     // Bernstein-Helm
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'tree',
    homeX: houseX,
    homeY: houseY,
    destX: houseX,
    destY: houseY,
    returningHome: false,
    path: [{ x: houseX, y: houseY }],
    pathIndex: 0,
    state: 'idle',
    activity: 'none',
    activityProgress: 0,
    activityDuration: 2,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog: false,
    hasBag: true,
    hasBeachMat: false,
    matColor: '#8B4513',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    // NPC-Felder
    isNpcWorker: true,
    npcType: 'woodcutter',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
    // Plantagen-Felder
    npcPlantationMode: true,
    npcPlantationPhase: 'planting',
  };
}

/**
 * Finde ein leeres Gras-Tile im Plantagen-Radius für Bepflanzung
 */
export function findPlantationGrassSpot(
  grid: Tile[][],
  gridSize: number,
  houseX: number,
  houseY: number,
  radius: number,
  excludeTargets?: { x: number; y: number }[]
): { x: number; y: number } | null {
  let bestDist = Infinity;
  let bestSpot: { x: number; y: number } | null = null;

  const minX = Math.max(0, houseX - radius);
  const maxX = Math.min(gridSize - 1, houseX + radius);
  const minY = Math.max(0, houseY - radius);
  const maxY = Math.min(gridSize - 1, houseY + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === houseX && y === houseY) continue; // Nicht auf dem Haus pflanzen
      if (grid[y][x].building.type !== 'grass') continue;
      if (grid[y][x].zone && grid[y][x].zone !== 'none') continue;
      if (excludeTargets?.some(t => t.x === x && t.y === y)) continue;

      const dist = Math.abs(x - houseX) + Math.abs(y - houseY);
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        bestSpot = { x, y };
      }
    }
  }

  return bestSpot;
}

/**
 * Finde einen reifen Baum im Plantagen-Radius zum Ernten
 * Reif = plantedAt + growthMs <= jetzt (Echtzeit-basiert, funktioniert auch nach Offline)
 */
export function findMaturePlantationTree(
  grid: Tile[][],
  gridSize: number,
  houseX: number,
  houseY: number,
  radius: number,
  growthMs: number,
  excludeTargets?: { x: number; y: number }[]
): { x: number; y: number } | null {
  let bestDist = Infinity;
  let bestSpot: { x: number; y: number } | null = null;
  const now = Date.now();

  const minX = Math.max(0, houseX - radius);
  const maxX = Math.min(gridSize - 1, houseX + radius);
  const minY = Math.max(0, houseY - radius);
  const maxY = Math.min(gridSize - 1, houseY + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === houseX && y === houseY) continue;
      const tile = grid[y][x];
      // Nur Baum-Tiles (alle Baumarten)
      if (!tile.building.type.startsWith('tree') && tile.building.type !== 'tree') continue;
      // Reif prüfen: plantedAt-basiert (Echtzeit) oder age-Fallback (legacy)
      const plantedAt = tile.building.plantedAt;
      if (plantedAt) {
        if (now - plantedAt < growthMs) continue; // Noch nicht reif
      } else {
        // Fallback für alte Bäume ohne plantedAt: sofort erntbar
      }
      if (excludeTargets?.some(t => t.x === x && t.y === y)) continue;

      const dist = Math.abs(x - houseX) + Math.abs(y - houseY);
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        bestSpot = { x, y };
      }
    }
  }

  return bestSpot;
}

/**
 * Zähle Bäume im Plantagen-Radius
 */
export function countPlantationTrees(
  grid: Tile[][],
  gridSize: number,
  houseX: number,
  houseY: number,
  radius: number
): { total: number; mature: number; growing: number } {
  let total = 0;
  let mature = 0;
  let growing = 0;

  const minX = Math.max(0, houseX - radius);
  const maxX = Math.min(gridSize - 1, houseX + radius);
  const minY = Math.max(0, houseY - radius);
  const maxY = Math.min(gridSize - 1, houseY + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === houseX && y === houseY) continue;
      const dist = Math.abs(x - houseX) + Math.abs(y - houseY);
      if (dist > radius) continue;
      const tile = grid[y][x];
      if (tile.building.type.startsWith('tree') || tile.building.type === 'tree') {
        total++;
        const pa = tile.building.plantedAt;
        if (pa && Date.now() - pa >= WOODCUTTER_GROWTH_MS) {
          mature++;
        } else if (!pa) {
          mature++; // Legacy-Bäume ohne plantedAt = reif
        } else {
          growing++;
        }
      }
    }
  }

  return { total, mature, growing };
}

/**
 * Sende einen Plantagen-Holzfäller zum Pflanzen eines Baumes
 */
export function sendPlantationWorkerToPlant(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  const houseX = ped.homeX;
  const houseY = ped.homeY;
  const level = grid[houseY]?.[houseX]?.building?.level || 1;
  const config = WOODCUTTER_LEVEL_CONFIG[Math.min(level, 4)] || WOODCUTTER_LEVEL_CONFIG[1];

  // Andere Plantagenarbeiter-Ziele ausschliessen
  const excludeTargets = allPedestrians
    .filter(p => p.npcPlantationMode && p.id !== ped.id && !p.returningHome)
    .map(p => ({ x: p.destX, y: p.destY }));

  const spot = findPlantationGrassSpot(grid, gridSize, houseX, houseY, config.radius, excludeTargets);
  if (!spot) return false;

  const fullPath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, spot.x, spot.y);
  if (fullPath.length < 2) return false;

  ped.destX = spot.x;
  ped.destY = spot.y;
  ped.destType = 'tree';
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.returningHome = false;
  ped.activity = 'planting_tree';
  ped.activityProgress = 0;
  ped.npcWorkProgress = 0;
  ped.npcPlantationPhase = 'planting';

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  return true;
}

/**
 * Sende einen Plantagen-Holzfäller zum Ernten eines reifen Baumes
 */
export function sendPlantationWorkerToHarvest(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  const houseX = ped.homeX;
  const houseY = ped.homeY;
  const level = grid[houseY]?.[houseX]?.building?.level || 1;
  const config = WOODCUTTER_LEVEL_CONFIG[Math.min(level, 4)] || WOODCUTTER_LEVEL_CONFIG[1];

  const excludeTargets = allPedestrians
    .filter(p => p.npcPlantationMode && p.id !== ped.id && !p.returningHome)
    .map(p => ({ x: p.destX, y: p.destY }));

  const tree = findMaturePlantationTree(grid, gridSize, houseX, houseY, config.radius, config.growthMs, excludeTargets);
  if (!tree) return false;

  const fullPath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, tree.x, tree.y);
  if (fullPath.length < 2) return false;

  ped.destX = tree.x;
  ped.destY = tree.y;
  ped.destType = 'tree';
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.returningHome = false;
  ped.activity = 'chopping_tree';
  ped.activityProgress = 0;
  ped.npcWorkProgress = 0;
  ped.npcPlantationPhase = 'harvesting';

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  return true;
}

/**
 * Sende einen Plantagen-Holzfäller zurück zum Haus
 */
export function sendPlantationWorkerHome(ped: Pedestrian, grid?: Tile[][], gridSize?: number): boolean {
  const fullPath = (grid && gridSize)
    ? buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, ped.homeX, ped.homeY)
    : buildDirectGridPath(ped.tileX, ped.tileY, ped.homeX, ped.homeY);
  if (fullPath.length < 2) {
    // Schon am Haus
    ped.tileX = ped.homeX;
    ped.tileY = ped.homeY;
    ped.state = 'idle';
    ped.activity = 'none';
    ped.npcPlantationPhase = 'waiting';
    return true;
  }

  ped.destX = ped.homeX;
  ped.destY = ped.homeY;
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.returningHome = true;
  ped.activity = 'none';
  ped.activityProgress = 0;

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  return true;
}

// ==========================================
// NPC GÄRTNER SYSTEM (Bäume pflanzen)
// ==========================================

/**
 * Finde das nächste leere Gras-Tile in der Nähe einer Position
 * Bevorzugt Tiles neben Strassen oder Gebäuden (sieht besser aus)
 */
export function findNearestGrass(
  grid: Tile[][],
  gridSize: number,
  fromX: number,
  fromY: number,
  excludeTargets?: { x: number; y: number }[]
): { grassX: number; grassY: number } | null {
  let bestDist = Infinity;
  let bestResult: { grassX: number; grassY: number } | null = null;
  // Sekundäre Suche: Gras ohne Nachbar-Strasse
  let fallbackDist = Infinity;
  let fallbackResult: { grassX: number; grassY: number } | null = null;

  const minX = Math.max(0, fromX - NPC_SEARCH_RADIUS);
  const maxX = Math.min(gridSize - 1, fromX + NPC_SEARCH_RADIUS);
  const minY = Math.max(0, fromY - NPC_SEARCH_RADIUS);
  const maxY = Math.min(gridSize - 1, fromY + NPC_SEARCH_RADIUS);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Nur leere Gras-Tiles (kein Baum, kein Gebäude, kein Wasser, keine Strasse)
      if (grid[y][x].building.type !== 'grass') continue;
      // Keine Zonen-Tiles (nicht auf Wohn-/Gewerbe-/Industriegebiet pflanzen)
      if (grid[y][x].zone && grid[y][x].zone !== 'none') continue;

      // Bereits von anderem NPC angesteuert?
      if (excludeTargets?.some(t => t.x === x && t.y === y)) continue;

      const dist = Math.abs(x - fromX) + Math.abs(y - fromY);

      // Prüfe, ob ein Nachbar eine Strasse oder ein Gebäude hat (sieht schöner aus)
      let hasNearbyStructure = false;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          const neighborType = grid[ny][nx].building.type;
          if (neighborType !== 'grass' && neighborType !== 'water' && neighborType !== 'tree') {
            hasNearbyStructure = true;
            break;
          }
        }
      }

      if (hasNearbyStructure) {
        if (dist < bestDist) {
          bestDist = dist;
          bestResult = { grassX: x, grassY: y };
        }
      } else {
        if (dist < fallbackDist) {
          fallbackDist = dist;
          fallbackResult = { grassX: x, grassY: y };
        }
      }
    }
  }

  return bestResult || fallbackResult;
}

/**
 * Erstelle einen NPC-Gärtner-Pedestrian
 */
export function createGardenerNpc(
  id: number,
  spawnX: number,
  spawnY: number,
  grassX: number,
  grassY: number,
  path: { x: number; y: number }[],
  direction: CarDirection
): Pedestrian {
  const startTile = path[0] || { x: spawnX, y: spawnY };

  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: 0.12, // Etwas langsamer als der Holzfäller
    age: 0,
    maxAge: 999999, // NPCs altern nicht
    // Gärtner-Look: Grünes Hemd, beige Hose, Strohhut
    skinColor: '#d4a76a',
    shirtColor: '#2d8a4e',   // Sattgrün
    pantsColor: '#c4a66a',   // Beige/Khaki
    hasHat: true,
    hatColor: '#d4b896',     // Strohhut-Farbe
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'tree', // Wiederverwendung des tree-DestTypes
    homeX: spawnX,
    homeY: spawnY,
    destX: grassX,
    destY: grassY,
    returningHome: false,
    path,
    pathIndex: 0,
    state: 'walking',
    activity: 'none',
    activityProgress: 0,
    activityDuration: NPC_PLANT_DURATION,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog: false,
    hasBag: true, // Trägt eine Tasche (Samen/Erde)
    hasBeachMat: false,
    matColor: '#2d8a4e',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    // NPC-spezifische Felder
    isNpcWorker: true,
    npcType: 'gardener',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
  };
}

/**
 * Sende einen NPC-Gärtner zum nächsten leeren Gras-Tile
 * Gibt false zurück wenn keines gefunden wurde
 */
export function sendGardenerToNextGrass(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Sammle alle Ziel-Tiles anderer NPC-Gärtner
  const excludeTargets = allPedestrians
    .filter(p => p.isNpcWorker && p.npcType === 'gardener' && p.id !== ped.id && !p.returningHome)
    .map(p => ({ x: p.destX, y: p.destY }));

  const target = findNearestGrass(grid, gridSize, ped.tileX, ped.tileY, excludeTargets);
  if (!target) {
    console.log(`[NPC #${ped.id}] Kein leeres Gras-Tile in Reichweite gefunden`);
    return false;
  }

  // Direkter Pfad zum Gras-Tile
  const fullPath = buildDirectGridPath(ped.tileX, ped.tileY, target.grassX, target.grassY);

  if (fullPath.length < 2) {
    console.log(`[NPC #${ped.id}] Pfad zu kurz zum Gras-Tile (${target.grassX},${target.grassY})`);
    return false;
  }

  ped.destX = target.grassX;
  ped.destY = target.grassY;
  ped.destType = 'tree';
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.returningHome = false;
  ped.activity = 'none';
  ped.activityProgress = 0;
  ped.npcWorkProgress = 0;

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  console.log(`[NPC #${ped.id}] 🌱 → Nächstes Gras-Tile (${target.grassX},${target.grassY}), Pfad: ${fullPath.length} Tiles`);
  return true;
}

// ==========================================
// NPC CHASE SYSTEM (Polizei vs. Gangster)
// ==========================================

/**
 * Erstelle einen NPC-Polizisten
 */
export function createPoliceNpc(
  id: number,
  spawnX: number,
  spawnY: number,
  gangsterId: number,
  targetX: number,
  targetY: number,
  path: { x: number; y: number }[],
  direction: CarDirection
): Pedestrian {
  const startTile = path[0] || { x: spawnX, y: spawnY };
  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: NPC_POLICE_SPEED,
    age: 0,
    maxAge: 999999,
    // Polizei-Look: Dunkelblaue Uniform, Mütze
    skinColor: '#d4a76a',
    shirtColor: '#1e3a5f',   // Dunkelblau
    pantsColor: '#1a2744',   // Nachtblau
    hasHat: true,
    hatColor: '#1e3a5f',     // Polizei-Mütze
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'tree',
    homeX: spawnX,
    homeY: spawnY,
    destX: targetX,
    destY: targetY,
    returningHome: false,
    path,
    pathIndex: 0,
    state: 'walking',
    activity: 'chasing',
    activityProgress: 0,
    activityDuration: NPC_ARREST_DURATION,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: 0,
    hasBall: false,
    hasDog: false,
    hasBag: false,
    hasBeachMat: false,
    matColor: '#1e3a5f',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    isNpcWorker: true,
    npcType: 'police',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
    npcChaseTargetId: gangsterId,
    npcRepathTimer: 0,
  };
}

/**
 * Erstelle einen NPC-Gangster
 */
export function createGangsterNpc(
  id: number,
  spawnX: number,
  spawnY: number,
  policeId: number,
  targetX: number,
  targetY: number,
  path: { x: number; y: number }[],
  direction: CarDirection
): Pedestrian {
  const startTile = path[0] || { x: spawnX, y: spawnY };
  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: NPC_GANGSTER_SPEED,
    age: 0,
    maxAge: 999999,
    // Gangster-Look: Schwarzer Hoodie, dunkle Hose
    skinColor: '#c4956a',
    shirtColor: '#1a1a1a',   // Schwarz
    pantsColor: '#2d2d2d',   // Dunkelgrau
    hasHat: true,
    hatColor: '#1a1a1a',     // Schwarze Kapuze
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'tree',
    homeX: spawnX,
    homeY: spawnY,
    destX: targetX,
    destY: targetY,
    returningHome: false,
    path,
    pathIndex: 0,
    state: 'walking',
    activity: 'fleeing',
    activityProgress: 0,
    activityDuration: NPC_ARREST_DURATION,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog: false,
    hasBag: false,
    hasBeachMat: false,
    matColor: '#1a1a1a',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    isNpcWorker: true,
    npcType: 'gangster',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
    npcChaseTargetId: policeId,
    npcRepathTimer: 0,
  };
}

/**
 * Erstelle einen Obdachlosen-NPC (spawnt auf Strassen/Parks, sitzt idle herum)
 */
export function createHomelessNpc(
  id: number,
  spawnX: number,
  spawnY: number,
  direction: CarDirection
): Pedestrian {
  // Zufaelliges Aussehen (abgenutzt, dreckig)
  const skinColors = ['#c4956a', '#a07553', '#d4a373', '#8d6e4c'];
  const shirtColors = ['#5c5c3d', '#6b5b3a', '#4a4a2e', '#7a6b4f', '#3d3d2a'];
  const pantsColors = ['#4a4a3a', '#3d3d2d', '#5a5a4a', '#6b6b5b'];
  return {
    id,
    tileX: spawnX,
    tileY: spawnY,
    direction,
    progress: 0,
    speed: 0.15, // Sehr langsam
    age: 0,
    maxAge: 999999, // Kein Auto-Despawn
    skinColor: skinColors[Math.floor(Math.random() * skinColors.length)],
    shirtColor: shirtColors[Math.floor(Math.random() * shirtColors.length)],
    pantsColor: pantsColors[Math.floor(Math.random() * pantsColors.length)],
    hasHat: Math.random() < 0.4,
    hatColor: '#4a4a3a',
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'park',
    homeX: spawnX,
    homeY: spawnY,
    destX: spawnX,
    destY: spawnY,
    returningHome: false,
    path: [],
    pathIndex: 0,
    state: 'idle',
    activity: 'idle',
    activityProgress: 0,
    activityDuration: 999999,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: (Math.random() - 0.5) * 10,
    activityOffsetY: (Math.random() - 0.5) * 10,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog: false,
    hasBag: true, // Obdachlose haben oft eine Tasche
    hasBeachMat: false,
    matColor: '#5c5c3d',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    isNpcWorker: true,
    npcType: 'homeless',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
  };
}

// ── Party-Gast NPC ────────────────────────────────────────────────────────────

const PARTY_SHIRT_COLORS = ['#f43f5e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];
const PARTY_PANTS_COLORS = ['#1e1b4b', '#0f172a', '#7f1d1d', '#064e3b', '#1e3a5f'];
const PARTY_HAT_COLORS   = ['#f43f5e', '#a855f7', '#f59e0b', '#22c55e', '#3b82f6'];

export function createPartyGuestNpc(
  id: number,
  mansionTileX: number,
  mansionTileY: number,
  grid: Tile[][],
  gridSize: number
): Pedestrian | null {
  const roadTile = findNearestRoadToBuilding(grid, gridSize, mansionTileX, mansionTileY);
  if (!roadTile) return null;

  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, mansionTileX, mansionTileY);

  const ped: Pedestrian = {
    id,
    tileX: roadTile.x,
    tileY: roadTile.y,
    destX: mansionTileX,
    destY: mansionTileY,
    direction: 'south',
    progress: 0,
    speed: 0.18,
    age: 0,
    maxAge: 999999,
    skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
    shirtColor: PARTY_SHIRT_COLORS[Math.floor(Math.random() * PARTY_SHIRT_COLORS.length)],
    pantsColor: PARTY_PANTS_COLORS[Math.floor(Math.random() * PARTY_PANTS_COLORS.length)],
    hasHat: Math.random() < 0.45,
    hatColor: PARTY_HAT_COLORS[Math.floor(Math.random() * PARTY_HAT_COLORS.length)],
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: 'right',
    destType: 'park',
    homeX: roadTile.x,
    homeY: roadTile.y,
    returningHome: false,
    path: path || [],
    pathIndex: 0,
    state: path && path.length > 0 ? 'walking' : 'at_recreation',
    activity: path && path.length > 0 ? 'none' : 'dancing',
    activityProgress: 0,
    activityDuration: 999999,
    activityAnimTimer: Math.random() * Math.PI * 2,
    activityOffsetX: (Math.random() - 0.5) * 24,
    activityOffsetY: (Math.random() - 0.5) * 14,
    buildingEntryProgress: 0,
    socialTarget: null,
    hasBall: false,
    hasDog: false,
    hasBag: false,
    hasBeachMat: false,
    matColor: '#fff',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    isNpcWorker: true,
    npcType: 'party_guest',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
  };

  if (!path || path.length === 0) {
    ped.tileX = mansionTileX;
    ped.tileY = mansionTileY;
  }

  return ped;
}

// Party-Guest-Manager: Verwaltet Spawn/Despawn der Party-NPCs
// Key = `${tileX}_${tileY}`, Value = Set von NPC-IDs
export const partyGuestMap = new Map<string, Set<number>>();
let _partyGuestSpawnTimer = 0;
const PARTY_GUEST_SPAWN_INTERVAL = 5; // Sekunden zwischen Spawn
const PARTY_GUEST_MAX = 10;           // Max Gäste pro Party

export function updatePartyGuests(
  deltaTime: number,
  activeParties: { tileX: number; tileY: number; id: number; status: string }[],
  pedestrians: Pedestrian[],
  grid: Tile[][],
  gridSize: number,
  nextIdRef: { value: number }
): void {
  _partyGuestSpawnTimer += deltaTime;

  // Gäste von beendeten Parties: zum nächsten Strassentile laufen und dann verschwinden
  for (const [key, guestIds] of partyGuestMap.entries()) {
    const [tx, ty] = key.split('_').map(Number);
    const isActive = activeParties.some(p => p.tileX === tx && p.tileY === ty);
    if (!isActive) {
      for (const npcId of guestIds) {
        const npc = pedestrians.find(p => p.id === npcId);
        if (npc && (npc.state === 'at_recreation' || npc.activity === 'dancing')) {
          // Nächste Strassenkachel in der Nähe suchen
          let roadX = npc.tileX, roadY = npc.tileY;
          let found = false;
          outer: for (let r = 1; r <= 5; r++) {
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const nx = npc.tileX + dx;
                const ny = npc.tileY + dy;
                if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
                const tile = grid[ny]?.[nx];
                if (tile?.building?.type === 'road') {
                  roadX = nx; roadY = ny; found = true; break outer;
                }
              }
            }
          }
          if (found) {
            // Zum Auto/Strasse laufen, dann verschwinden
            const path = findPathOnRoads(grid, gridSize, npc.tileX, npc.tileY, roadX, roadY);
            npc.state = 'walking';
            npc.activity = 'none';
            npc.destX = roadX; npc.destY = roadY;
            npc.path = (path && path.length > 0) ? path : [{ x: roadX, y: roadY }];
            npc.pathIndex = 0;
            npc.maxAge = 60; // 60s um die Strasse zu erreichen, dann weg
            npc.isNpcWorker = false;
          } else {
            npc.maxAge = 0; // Kein Weg → sofort weg
          }
        } else if (npc) {
          npc.maxAge = Math.min(npc.maxAge, npc.age + 15); // schnell auslaufen lassen
          npc.isNpcWorker = false;
        }
      }
      partyGuestMap.delete(key);
    }
  }

  // Neue Gäste für aktive Parties spawnen
  if (_partyGuestSpawnTimer < PARTY_GUEST_SPAWN_INTERVAL) return;
  _partyGuestSpawnTimer = 0;

  for (const party of activeParties) {
    const key = `${party.tileX}_${party.tileY}`;
    if (!partyGuestMap.has(key)) partyGuestMap.set(key, new Set());
    const guestIds = partyGuestMap.get(key)!;

    // Tote NPCs aus dem Set entfernen
    for (const npcId of guestIds) {
      if (!pedestrians.some(p => p.id === npcId)) guestIds.delete(npcId);
    }

    if (guestIds.size >= PARTY_GUEST_MAX) continue;

    const npc = createPartyGuestNpc(nextIdRef.value++, party.tileX, party.tileY, grid, gridSize);
    if (npc) {
      pedestrians.push(npc);
      guestIds.add(npc.id);
    }
  }
}

/**
 * Berechne einen Fluchtpunkt für den Gangster (weg von der Polizei)
 */
export function findFleePoint(
  grid: Tile[][],
  gridSize: number,
  gangsterX: number,
  gangsterY: number,
  policeX: number,
  policeY: number
): { x: number; y: number } | null {
  // Richtung weg von der Polizei
  const dx = gangsterX - policeX;
  const dy = gangsterY - policeY;
  const dist = Math.max(1, Math.abs(dx) + Math.abs(dy));

  // Normalisieren und Fluchtdistanz anwenden
  const fleeDist = NPC_CHASE_FLEE_DISTANCE;
  const baseX = gangsterX + Math.round((dx / dist) * fleeDist);
  const baseY = gangsterY + Math.round((dy / dist) * fleeDist);

  // Zufälliger Offset für natürlichere Flucht
  const randX = baseX + Math.floor(Math.random() * 7) - 3;
  const randY = baseY + Math.floor(Math.random() * 7) - 3;

  // Auf Grid-Grenzen beschränken (2 Tiles vom Rand entfernt)
  const targetX = Math.max(2, Math.min(gridSize - 3, randX));
  const targetY = Math.max(2, Math.min(gridSize - 3, randY));

  // Prüfe ob das Ziel begehbar ist (kein Wasser/Gebäude)
  const targetType = grid[targetY]?.[targetX]?.building?.type;
  if (!targetType || !WALKABLE_TILE_TYPES.has(targetType)) {
    // Fallback: Zufälliger begehbarer Punkt im Grid
    for (let attempts = 0; attempts < 15; attempts++) {
      const rx = Math.floor(Math.random() * (gridSize - 4)) + 2;
      const ry = Math.floor(Math.random() * (gridSize - 4)) + 2;
      const t = grid[ry]?.[rx]?.building?.type;
      if (t && WALKABLE_TILE_TYPES.has(t)) {
        return { x: rx, y: ry };
      }
    }
    return null;
  }

  return { x: targetX, y: targetY };
}

/**
 * Sende Polizei zum Gangster (Pfad neu berechnen)
 * WICHTIG: Progress NICHT zurücksetzen, sonst bleibt die Polizei stecken!
 */
export function repathPoliceToGangster(
  ped: Pedestrian,
  gangster: Pedestrian
): void {
  const fullPath = buildDirectGridPath(ped.tileX, ped.tileY, gangster.tileX, gangster.tileY);
  if (fullPath.length >= 2) {
    ped.path = fullPath;
    ped.pathIndex = 0;
    // progress NICHT zurücksetzen - Polizei läuft weiter ohne Ruckler
    ped.destX = gangster.tileX;
    ped.destY = gangster.tileY;
    // tileX/tileY NICHT überschreiben - sind bereits korrekt
    if (fullPath.length > 1) {
      const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
      if (dir) ped.direction = dir;
    }
  }
}

/**
 * Sende Gangster auf Flucht (weg von Polizei)
 */
export function sendGangsterFleeing(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  police: Pedestrian
): boolean {
  const fleePoint = findFleePoint(grid, gridSize, ped.tileX, ped.tileY, police.tileX, police.tileY);
  if (!fleePoint) return false;

  const fullPath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, fleePoint.x, fleePoint.y);
  if (fullPath.length < 2) return false;

  ped.destX = fleePoint.x;
  ped.destY = fleePoint.y;
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.activity = 'fleeing';

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  return true;
}

/**
 * Finde einen Fussgänger in der Nähe des Gangsters als Raub-Opfer.
 * Nur normale Pedestrians (keine NPCs), die laufen oder idle sind.
 */
export function findRobberyTarget(
  gangster: Pedestrian,
  allPedestrians: Pedestrian[]
): Pedestrian | null {
  let bestTarget: Pedestrian | null = null;
  let bestDist = Infinity;

  let totalCount = 0;
  let npcCount = 0;
  let buildingCount = 0;
  let candidates = 0;

  for (const ped of allPedestrians) {
    totalCount++;
    if (ped.id === gangster.id) continue;
    if (ped.isNpcWorker) { npcCount++; continue; }
    if (ped.state === 'inside_building' || ped.state === 'entering_building' || ped.state === 'exiting_building') { buildingCount++; continue; }

    candidates++;
    const dist = Math.abs(ped.tileX - gangster.tileX) + Math.abs(ped.tileY - gangster.tileY);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = ped;
    }
  }

  if (!bestTarget) {
    console.log(`[ROBBERY] ❌ Gangster #${gangster.id} bei (${gangster.tileX},${gangster.tileY}): Kein Ziel! Total=${totalCount}, NPCs=${npcCount}, InBuilding=${buildingCount}, Candidates=${candidates}`);
    emitGameNotification('❌ Kein Opfer gefunden', `Total: ${totalCount}, NPCs: ${npcCount}, Gebäude: ${buildingCount}, Kandidaten: ${candidates}`);
  } else {
    console.log(`[ROBBERY] ✅ Gangster #${gangster.id}: Ziel #${bestTarget.id} gefunden! Dist=${bestDist}, Candidates=${candidates}/${totalCount}`);
  }

  return bestTarget;
}

/**
 * Sende Gangster zum Raub-Opfer.
 */
export function sendGangsterToRobberyTarget(
  ped: Pedestrian,
  target: Pedestrian,
  grid: Tile[][],
  gridSize: number
): boolean {
  if (ped.tileX === target.tileX && ped.tileY === target.tileY) {
    ped.destX = target.tileX;
    ped.destY = target.tileY;
    ped.path = [{ x: ped.tileX, y: ped.tileY }, { x: target.tileX, y: target.tileY }];
    ped.pathIndex = 1;
    ped.progress = 1;
    ped.state = 'walking';
    ped.activity = 'robbing';
    ped.npcRobberyTarget = target.id;
    return true;
  }
  const fullPath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, target.tileX, target.tileY);
  if (fullPath.length < 2) {
    console.log(`[ROBBERY] ⚠️ Kein Pfad zu Opfer #${target.id} (${target.tileX},${target.tileY}), PathLen=${fullPath.length}`);
    return false;
  }

  ped.destX = target.tileX;
  ped.destY = target.tileY;
  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.activity = 'robbing';
  ped.npcRobberyTarget = target.id;

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  return true;
}

// ==========================================
// NPC BÜNZLI SYSTEM
// ==========================================

/**
 * Finde nächstes inspizierbares Gebäude in der Nähe (mit Strassenanschluss)
 * Gibt das Gebäude UND das angrenzende Road-Tile zurück
 */
export function findNearestInspectableBuilding(
  grid: Tile[][],
  gridSize: number,
  fromX: number,
  fromY: number,
  excludeTargets?: { x: number; y: number }[]
): { buildingX: number; buildingY: number; roadX: number; roadY: number } | null {
  let bestDist = Infinity;
  let bestResult: { buildingX: number; buildingY: number; roadX: number; roadY: number } | null = null;
  const searchRadius = 40; // Großer Suchradius damit Büenzli die ganze Map patrouilliert

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const x = fromX + dx;
      const y = fromY + dy;
      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;

      const buildingType = grid[y][x].building.type;
      if (!BUENZLI_INSPECTABLE_BUILDINGS.includes(buildingType)) continue;

      // Bereits inspizierte Gebäude ausschliessen
      if (excludeTargets?.some(t => t.x === x && t.y === y)) continue;

      // Braucht angrenzende Strasse (Bünzli läuft auf der Strasse!)
      const road = findNearestRoadToBuilding(grid, gridSize, x, y);
      if (!road) continue;

      const dist = Math.abs(road.x - fromX) + Math.abs(road.y - fromY);
      if (dist >= 1 && dist < bestDist) {
        bestDist = dist;
        bestResult = { buildingX: x, buildingY: y, roadX: road.x, roadY: road.y };
      }
    }
  }

  return bestResult;
}

/**
 * Erstelle einen Bünzli-NPC
 */
export function createBuenzliNpc(
  id: number,
  spawnX: number,
  spawnY: number,
  targetX: number,
  targetY: number,
  path: { x: number; y: number }[],
  direction: CarDirection
): Pedestrian {
  const startTile = path[0] || { x: spawnX, y: spawnY };
  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: NPC_BUENZLI_SPEED,
    age: 0,
    maxAge: 999999,
    // Bünzli-Look: Weisses Hemd, dunkle Weste, ordentlich
    skinColor: '#f0c8a0',
    shirtColor: '#f0f0f0',   // Weisses Hemd
    pantsColor: '#2d3748',   // Dunkle Hose
    hasHat: false,
    hatColor: '#4a5568',
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: 'tree', // Wiederverwendung
    homeX: spawnX,
    homeY: spawnY,
    destX: targetX,
    destY: targetY,
    returningHome: false,
    path,
    pathIndex: 0,
    state: 'walking',
    activity: 'inspecting',
    activityProgress: 0,
    activityDuration: NPC_BUENZLI_INSPECT_DURATION,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog: false,
    hasBag: false,
    hasBeachMat: false,
    matColor: '#f0f0f0',
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
    isNpcWorker: true,
    npcType: 'buenzli',
    npcWorkProgress: 0,
    npcTreesChopped: 0,
    npcTreesPlanted: 0,
    npcInspectionsCount: 0,
    npcPendingViolations: [],
    npcInspectedBuildings: [],
  };
}

/**
 * Sende Bünzli zum nächsten Gebäude zur Inspektion (auf Strassen!)
 */
export function sendBuenzliToNextBuilding(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Sammle ALLE Gebäude die ausgeschlossen werden sollen:
  // 1) Aktuelle Ziele anderer Bünzlis
  const otherBuenzlis = allPedestrians
    .filter(p => p.isNpcWorker && p.npcType === 'buenzli' && p.id !== ped.id);
  const excludeTargets = otherBuenzlis.map(p => ({ x: p.destX, y: p.destY }));
  // 2) Bereits von DIESEM Bünzli inspizierte Gebäude
  const inspected = (ped as any).npcInspectedBuildings || [];
  for (const b of inspected) {
    excludeTargets.push({ x: b.x, y: b.y });
  }

  const target = findNearestInspectableBuilding(grid, gridSize, ped.tileX, ped.tileY, excludeTargets);
  if (!target) return false;

  // Pfad auf Strassen zum Road-Tile neben dem Gebäude
  const fullPath = findPathOnRoads(grid, gridSize, ped.tileX, ped.tileY, target.roadX, target.roadY);
  if (!fullPath) return false;

  ped.destX = target.buildingX; // Gebäude-Referenz behalten (für Inspektion)
  ped.destY = target.buildingY;

  if (fullPath.length < 2) {
    // Schon am Ziel-Road → direkt Inspektion starten (kein Laufweg nötig)
    ped.tileX = target.roadX;
    ped.tileY = target.roadY;
    ped.path = [{ x: target.roadX, y: target.roadY }];
    ped.pathIndex = 0;
    ped.progress = 0;
    ped.state = 'npc_working';
    ped.activity = 'inspecting';
    ped.activityProgress = 0;
    ped.activityDuration = NPC_BUENZLI_INSPECT_DURATION;
    ped.npcWorkProgress = 0;
    console.log(`[NPC #${ped.id}] 🔍 Bereits bei Gebäude (${target.buildingX},${target.buildingY}), starte Inspektion direkt`);
    return true;
  }

  ped.path = fullPath;
  ped.pathIndex = 0;
  ped.progress = 0;
  ped.tileX = fullPath[0].x;
  ped.tileY = fullPath[0].y;
  ped.state = 'walking';
  ped.returningHome = false;
  ped.activity = 'inspecting';
  ped.activityProgress = 0;
  ped.npcWorkProgress = 0;

  if (fullPath.length > 1) {
    const dir = getDirectionToTile(fullPath[0].x, fullPath[0].y, fullPath[1].x, fullPath[1].y);
    if (dir) ped.direction = dir;
  }

  console.log(`[NPC #${ped.id}] 🔍 → Gebäude (${target.buildingX},${target.buildingY}) via Strasse (${target.roadX},${target.roadY}), Pfad: ${fullPath.length} Tiles`);
  return true;
}

/**
 * Create a new pedestrian with full properties
 */
export function createPedestrian(
  id: number,
  homeX: number,
  homeY: number,
  destX: number,
  destY: number,
  destType: PedestrianDestType,
  path: { x: number; y: number }[],
  startIndex: number,
  direction: CarDirection
): Pedestrian {
  const hasDog = destType === 'park' && Math.random() < PEDESTRIAN_DOG_CHANCE;
  const hasBag = (destType === 'commercial' || destType === 'industrial') && Math.random() < PEDESTRIAN_BAG_CHANCE;
  const hasHat = Math.random() < PEDESTRIAN_HAT_CHANCE;

  const startTile = path[startIndex];

  return {
    id,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: Math.random(),
    speed: 0.12 + Math.random() * 0.08,
    age: 0,
    maxAge: 120 + Math.random() * 180, // 2-5 minutes lifespan
    skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
    shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
    pantsColor: PEDESTRIAN_PANTS_COLORS[Math.floor(Math.random() * PEDESTRIAN_PANTS_COLORS.length)],
    hasHat,
    hatColor: hasHat ? PEDESTRIAN_HAT_COLORS[Math.floor(Math.random() * PEDESTRIAN_HAT_COLORS.length)] : '#000000',
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType,
    homeX,
    homeY,
    destX,
    destY,
    returningHome: false,
    path,
    pathIndex: startIndex,
    // New behavioral properties
    state: 'walking',
    activity: 'none',
    activityProgress: 0,
    activityDuration: 0,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: Math.random() * Math.PI * 2,
    hasBall: false,
    hasDog,
    hasBag,
    // Beach properties
    hasBeachMat: false,
    matColor: PEDESTRIAN_MAT_COLORS[Math.floor(Math.random() * PEDESTRIAN_MAT_COLORS.length)],
    beachTileX: -1,
    beachTileY: -1,
    beachEdge: null,
  };
}

/**
 * Determine what should happen when pedestrian arrives at destination
 */
export function handleArrivalAtDestination(
  ped: Pedestrian,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[] = []
): void {
  // Debug-Avatar: Am Ziel stehen bleiben (kein Auto-Despawn, keine Aktivitäts-Logik).
  if (ped.isNpcWorker && ped.npcType === 'avatar_test') {
    ped.state = 'idle';
    ped.activity = 'none';
    ped.activityProgress = 0;
    ped.activityDuration = 999999;
    ped.progress = 0;
    return;
  }

  // NPC-Holzfäller: Am Ziel angekommen
  if (ped.isNpcWorker && ped.npcType === 'woodcutter') {
    // === PLANTAGEN-MODUS ===
    if (ped.npcPlantationMode) {
      const tile = grid[ped.destY]?.[ped.destX];

      // Zurück am Haus? → Idle, warten auf nächste Aufgabe
      if (ped.returningHome && ped.destX === ped.homeX && ped.destY === ped.homeY) {
        ped.state = 'idle';
        ped.activity = 'none';
        ped.activityProgress = 0;
        ped.activityDuration = 2;
        ped.returningHome = false;
        ped.npcPlantationPhase = 'waiting';
        return;
      }

      // Pflanz-Phase: Am Gras-Tile angekommen → Baum pflanzen
      if (ped.npcPlantationPhase === 'planting') {
        if (tile && tile.building.type === 'grass') {
          const houseLevel = grid[ped.homeY]?.[ped.homeX]?.building?.level || 1;
          const config = WOODCUTTER_LEVEL_CONFIG[Math.min(houseLevel, 4)] || WOODCUTTER_LEVEL_CONFIG[1];
          ped.tileX = ped.destX;
          ped.tileY = ped.destY;
          ped.state = 'npc_working';
          ped.activity = 'planting_tree';
          ped.activityProgress = 0;
          ped.activityDuration = config.plantDuration;
          ped.npcWorkProgress = 0;
          ped.activityOffsetX = 0;
          ped.activityOffsetY = 0;
          return;
        } else {
          // Tile nicht mehr leer → zurück zum Idle
          ped.state = 'idle';
          ped.activityProgress = 0;
          ped.activityDuration = 0.5;
          return;
        }
      }

      // Ernte-Phase: Am reifen Baum angekommen → Baum fällen
      if (ped.npcPlantationPhase === 'harvesting') {
        if (tile && (tile.building.type.startsWith('tree') || tile.building.type === 'tree')) {
          const houseLevel = grid[ped.homeY]?.[ped.homeX]?.building?.level || 1;
          const config = WOODCUTTER_LEVEL_CONFIG[Math.min(houseLevel, 4)] || WOODCUTTER_LEVEL_CONFIG[1];
          ped.tileX = ped.destX;
          ped.tileY = ped.destY;
          ped.state = 'npc_working';
          ped.activity = 'chopping_tree';
          ped.activityProgress = 0;
          ped.activityDuration = config.chopDuration;
          ped.npcWorkProgress = 0;
          ped.activityOffsetX = 8;
          ped.activityOffsetY = -4;
          return;
        } else {
          // Baum weg → zurück zum Idle
          ped.state = 'idle';
          ped.activityProgress = 0;
          ped.activityDuration = 0.5;
          return;
        }
      }

      // Fallback → Idle
      ped.state = 'idle';
      ped.activityProgress = 0;
      ped.activityDuration = 1;
      return;
    }

    // === NORMALER HOLZFÄLLER-MODUS ===
    const tile = grid[ped.destY]?.[ped.destX];
    if (tile && (tile.building.type.startsWith('tree') || tile.building.type === 'tree')) {
      ped.tileX = ped.destX;
      ped.tileY = ped.destY;
      ped.state = 'npc_working';
      ped.activity = 'chopping_tree';
      ped.activityProgress = 0;
      ped.activityDuration = NPC_WORK_DURATION;
      ped.npcWorkProgress = 0;
      ped.activityOffsetX = 8;
      ped.activityOffsetY = -4;
      console.log(`[NPC #${ped.id}] Am Baum (${ped.destX},${ped.destY}) angekommen, beginne Arbeit (${NPC_WORK_DURATION}s)`);
    } else {
      console.log(`[NPC #${ped.id}] Baum bei (${ped.destX},${ped.destY}) ist weg, suche nächsten...`);
      ped.state = 'idle';
      ped.activityProgress = 0;
      ped.activityDuration = 0.3;
    }
    return;
  }

  // NPC-Polizei: Am Ziel angekommen
  if (ped.isNpcWorker && ped.npcType === 'police') {
    // Transport abgeschlossen → am Polizeiauto angekommen → despawnen
    if (ped.activity === 'transporting') {
      const gangster = allPedestrians.find(p => p.id === ped.npcChaseTargetId);
      if (gangster) {
        gangster.activityProgress = 999;
      }
      console.log(`[NPC #${ped.id}] 🚔 Am Polizeiauto angekommen. Gangster eingeladen. Beide verschwinden.`);
      ped.activityProgress = 999;
      return;
    }
    ped.state = 'idle';
    ped.activityProgress = 0;
    ped.activityDuration = 0.2;
    return;
  }

  // NPC-Gangster: Am Ziel angekommen
  if (ped.isNpcWorker && ped.npcType === 'gangster') {
    // Transport: Am Polizeiauto angekommen → despawnen
    if (ped.activity === 'being_transported') {
      ped.activityProgress = 999;
      return;
    }
    // Hat ein Raub-Opfer und wird nicht gejagt → Raub beginnen
    if (ped.npcRobberyTarget && ped.npcRobberyTarget > 0 && !ped.npcChaseTargetId) {
      ped.state = 'npc_working';
      ped.activity = 'robbing';
      ped.activityProgress = 0;
      ped.activityDuration = NPC_GANGSTER_ROBBERY_DURATION;
      ped.npcWorkProgress = 0;
      ped.activityOffsetX = 0;
      ped.activityOffsetY = 0;
      console.log(`[NPC #${ped.id}] 💰 Gangster beginnt Raubüberfall auf Fussgänger #${ped.npcRobberyTarget}!`);
      emitGameNotification('💰 Raubüberfall!', `Gangster überfällt einen Passanten bei (${ped.tileX}, ${ped.tileY})!`);
      return;
    }
    ped.state = 'idle';
    ped.activityProgress = 0;
    ped.activityDuration = 0.3;
    return;
  }

  // NPC-Bünzli: An der Strasse neben Gebäude angekommen → Inspektion beginnen
  if (ped.isNpcWorker && ped.npcType === 'buenzli') {
    const tile = grid[ped.destY]?.[ped.destX];
    if (tile && BUENZLI_INSPECTABLE_BUILDINGS.includes(tile.building.type)) {
      // Bünzli bleibt auf der Strasse (tileX/Y NICHT auf Gebäude setzen!)
      ped.state = 'npc_working';
      ped.activity = 'inspecting';
      ped.activityProgress = 0;
      ped.activityDuration = NPC_BUENZLI_INSPECT_DURATION;
      ped.npcWorkProgress = 0;
      ped.activityOffsetX = 0;
      ped.activityOffsetY = 0;

    } else {
      // Gebäude nicht mehr vorhanden, suche nächstes
      ped.state = 'idle';
      ped.activityProgress = 0;
      ped.activityDuration = 0.3;
    }
    return;
  }

  // Party-Gast: Am Mansion angekommen → tanzen
  if (ped.isNpcWorker && ped.npcType === 'party_guest') {
    ped.tileX = ped.destX;
    ped.tileY = ped.destY;
    ped.state = 'at_recreation';
    ped.activity = 'dancing';
    ped.activityProgress = 0;
    ped.activityDuration = 999999;
    return;
  }

  // NPC-Gärtner: Am Gras-Tile angekommen → Baum pflanzen
  if (ped.isNpcWorker && ped.npcType === 'gardener') {
    const tile = grid[ped.destY]?.[ped.destX];
    if (tile && tile.building.type === 'grass') {
      ped.tileX = ped.destX;
      ped.tileY = ped.destY;
      ped.state = 'npc_working';
      ped.activity = 'planting_tree';
      ped.activityProgress = 0;
      ped.activityDuration = NPC_PLANT_DURATION;
      ped.npcWorkProgress = 0;
      ped.activityOffsetX = 6;
      ped.activityOffsetY = -3;
      console.log(`[NPC #${ped.id}] 🌱 Am Gras (${ped.destX},${ped.destY}) angekommen, beginne Pflanzung (${NPC_PLANT_DURATION}s)`);
    } else {
      // Tile ist nicht mehr frei, suche nächstes via Idle-State
      console.log(`[NPC #${ped.id}] Gras bei (${ped.destX},${ped.destY}) ist nicht mehr frei, suche nächstes...`);
      ped.state = 'idle';
      ped.activityProgress = 0;
      ped.activityDuration = 0.3;
    }
    return;
  }

  const tile = grid[ped.destY]?.[ped.destX];
  if (!tile) return;

  const buildingType = tile.building.type;

  // Check if this is a recreational area
  if (isRecreationalBuilding(buildingType)) {
    // Start a recreational activity
    const activity = getActivityForBuilding(buildingType);
    ped.state = 'at_recreation';
    ped.activity = activity;
    ped.activityProgress = 0;
    ped.activityDuration = PEDESTRIAN_MIN_ACTIVITY_TIME +
      Math.random() * (PEDESTRIAN_MAX_ACTIVITY_TIME - PEDESTRIAN_MIN_ACTIVITY_TIME);

    // Set up position within the activity area
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x;
    ped.activityOffsetY = offset.y;

    // Give them a ball if doing ball sports
    if (BALL_ACTIVITIES.includes(activity)) {
      ped.hasBall = true;
    }
  }
  // Check if this is a shop - use visible approaching state
  else if (isShopBuilding(buildingType)) {
    // Start approaching the shop entrance (visible queuing)
    ped.state = 'approaching_shop';
    ped.buildingEntryProgress = 0;
    ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
      Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);

    // Position at the shop entrance
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x * 0.5; // Smaller offset to stay near entrance
    ped.activityOffsetY = offset.y * 0.3;

    // Set activity to shopping
    ped.activity = 'shopping';
  }
  // Subway station: Pendler fahren weiter zur nächsten Station
  else if (buildingType === 'subway_station') {
    // Andere Stationen suchen
    const otherStations: { x: number; y: number }[] = [];
    for (let sy = 0; sy < gridSize && otherStations.length < 20; sy++) {
      for (let sx = 0; sx < gridSize; sx++) {
        if (grid[sy]?.[sx]?.building.type === 'subway_station' &&
            !(sx === ped.destX && sy === ped.destY)) {
          otherStations.push({ x: sx, y: sy });
        }
      }
    }

    ped.state = 'entering_building';
    ped.buildingEntryProgress = 0;
    ped.activity = 'commuting';

    if (otherStations.length > 0) {
      // Zufällige Ziel-Station wählen — NPC taucht dort wieder auf
      const exit = otherStations[Math.floor(Math.random() * otherStations.length)];
      ped.subwayExitX = exit.x;
      ped.subwayExitY = exit.y;
      ped.activityDuration = 1.5 + Math.random() * 2; // 1.5–3.5s Fahrzeit
    } else {
      // Nur eine Station → normal besuchen
      ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
        Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);
    }
  }
  // Check if this is an enterable building (non-shop)
  else if (canPedestrianEnterBuilding(buildingType)) {
    // Start entering the building
    ped.state = 'entering_building';
    ped.buildingEntryProgress = 0;
    ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
      Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);

    // Set activity based on building type
    ped.activity = getActivityForBuilding(buildingType);
  }
  // Otherwise just turn around and go home
  else {
    ped.returningHome = true;
  }
}

/**
 * Update a pedestrian's state machine
 */
export function updatePedestrianState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // NPC mit Despawn-Marker entfernen
  if (ped.activityProgress >= 900) {
    return false;
  }

  // Update age (NPC-Arbeiter altern nicht)
  if (!ped.isNpcWorker) {
    ped.age += delta;
    if (ped.age > ped.maxAge) {
      return false; // Pedestrian should be removed
    }
  }

  // Update activity animation timer
  ped.activityAnimTimer += delta * 4;

  switch (ped.state) {
    case 'walking':
      return updateWalkingState(ped, delta, speedMultiplier, grid, gridSize, allPedestrians);

    case 'approaching_shop':
      return updateApproachingShopState(ped, delta, speedMultiplier);

    case 'entering_building':
      return updateEnteringBuildingState(ped, delta, speedMultiplier);

    case 'inside_building':
      return updateInsideBuildingState(ped, delta, speedMultiplier, grid, gridSize);

    case 'exiting_building':
      return updateExitingBuildingState(ped, delta, speedMultiplier, grid, gridSize);

    case 'at_recreation':
      return updateRecreationState(ped, delta, speedMultiplier, grid, gridSize);

    case 'at_beach':
      return updateBeachState(ped, delta, speedMultiplier, grid, gridSize);

    case 'idle':
    case 'idle_outside':
      return updateIdleState(ped, delta, speedMultiplier, grid, gridSize, allPedestrians);

    case 'socializing':
      return updateSocializingState(ped, delta, speedMultiplier, allPedestrians);

    case 'npc_working':
      return updateNpcWorkingState(ped, delta, speedMultiplier, grid, gridSize, allPedestrians);

    // Bus transit states
    case 'waiting_at_stop':
      return updateWaitingAtStopState(ped, delta, speedMultiplier);

    case 'boarding_bus':
      return updateBoardingBusState(ped, delta, speedMultiplier);

    case 'riding_bus':
      return updateRidingBusState(ped, delta, speedMultiplier);

    case 'alighting_bus':
      return updateAlightingBusState(ped, delta, speedMultiplier);

    default:
      return true;
  }
}

// === Bus Transit State Handlers ===

function updateWaitingAtStopState(ped: Pedestrian, delta: number, speedMultiplier: number): boolean {
  // Stand idle at bus stop, increment wait timer
  ped.busWaitTimer = (ped.busWaitTimer || 0) + delta * speedMultiplier;
  // Give up after timeout — walk home
  if (ped.busWaitTimer > 60) {
    ped.state = 'walking';
    ped.returningHome = true;
    ped.busStopX = undefined;
    ped.busStopY = undefined;
    ped.targetBusLineId = undefined;
    ped.targetStopIndex = undefined;
  }
  return true;
}

function updateBoardingBusState(ped: Pedestrian, delta: number, speedMultiplier: number): boolean {
  // Fade-out animation (same speed as entering_building)
  ped.buildingEntryProgress += delta * speedMultiplier * 2.5;
  if (ped.buildingEntryProgress >= 1) {
    ped.buildingEntryProgress = 1;
    ped.state = 'riding_bus';
  }
  return true;
}

function updateRidingBusState(ped: Pedestrian, _delta: number, _speedMultiplier: number): boolean {
  // Invisible, riding in bus. processBusStop handles alighting.
  return true;
}

function updateAlightingBusState(ped: Pedestrian, delta: number, speedMultiplier: number): boolean {
  // Fade-in animation
  ped.buildingEntryProgress -= delta * speedMultiplier * 2.5;
  if (ped.buildingEntryProgress <= 0) {
    ped.buildingEntryProgress = 0;
    ped.state = 'walking';
    ped.returningHome = true;
    ped.busStopX = undefined;
    ped.busStopY = undefined;
    ped.targetBusLineId = undefined;
    ped.targetStopIndex = undefined;
    ped.ridingBusId = undefined;
    ped.busWaitTimer = undefined;
  }
  return true;
}

/**
 * Update walking state - the main movement logic
 * Optimized: reduced social/idle checks, simplified logic
 */
function updateWalkingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Update walk animation
  ped.walkOffset += delta * 8;

  // === NPC Chase: Polizei verfolgt Gangster / Gangster flieht ===
  if (ped.isNpcWorker && ped.npcType === 'police' && ped.activity !== 'transporting') {
    const targetId = ped.npcChaseTargetId || 0;
    let gangster = targetId > 0 ? allPedestrians.find(p => p.id === targetId) : null;

    // Gangster schon von ANDEREM Polizist verhaftet/transportiert? → Nicht weiter jagen
    // Aber: Wenn der Gangster sich ergeben hat (arrested) und DIESER Polizist zugewiesen ist → weiter hingehen
    if (gangster && (gangster.activity === 'arrested' || gangster.activity === 'being_transported')) {
      const isMyArrest = gangster.npcChaseTargetId === ped.id;
      if (!isMyArrest) {
        ped.npcChaseTargetId = 0;
        gangster = null;
      }
    }

    // Kein Gangster zugewiesen oder verschwunden? → Suche neuen
    if (!gangster) {
      const allPolice = allPedestrians.filter(p => p.isNpcWorker && p.npcType === 'police' && p.id !== ped.id);
      const chasedIds = new Set(allPolice.map(p => p.npcChaseTargetId).filter(id => id && id > 0));
      gangster = allPedestrians.find(p =>
        p.isNpcWorker && p.npcType === 'gangster' && !chasedIds.has(p.id)
        && p.activity !== 'arrested' && p.activity !== 'being_transported'
      ) || null;

      if (gangster) {
        ped.npcChaseTargetId = gangster.id;
        gangster.npcChaseTargetId = ped.id;
        gangster.activity = 'fleeing';
        ped.activity = 'chasing';
        console.log(`[NPC #${ped.id}] 🚔 Neuen Gangster #${gangster.id} gefunden!`);
        repathPoliceToGangster(ped, gangster);
      }
    }

    if (gangster) {
      const gangsterSurrendered = gangster.activity === 'arrested';
      const chaseDist = Math.abs(ped.tileX - gangster.tileX) + Math.abs(ped.tileY - gangster.tileY);

      // Verfolgungstimer nur bei echten Verfolgungen (nicht bei Ergebung)
      if (!gangsterSurrendered) {
        ped.activityAnimTimer = (ped.activityAnimTimer || 0) + delta * speedMultiplier;
      }
      const chaseTimeout = !gangsterSurrendered && ped.activityAnimTimer >= NPC_CHASE_MAX_DURATION;

      if (chaseDist <= NPC_CHASE_ARREST_DISTANCE || chaseTimeout) {
        if (chaseTimeout) {
          ped.tileX = gangster.tileX;
          ped.tileY = gangster.tileY;
        }

        ped.state = 'npc_working';
        ped.activity = 'arresting';
        ped.activityProgress = 0;
        ped.activityDuration = NPC_ARREST_DURATION;
        ped.npcWorkProgress = 0;
        ped.activityOffsetX = 0;
        ped.activityOffsetY = 0;

        gangster.state = 'npc_working';
        gangster.activity = 'arrested';
        gangster.activityProgress = 0;
        gangster.activityDuration = NPC_ARREST_DURATION;
        gangster.npcWorkProgress = 0;
        gangster.tileX = ped.tileX;
        gangster.tileY = ped.tileY;
        gangster.activityOffsetX = 6;
        gangster.activityOffsetY = 0;

        const reason = gangsterSurrendered ? 'ergeben' : chaseTimeout ? 'Zeit abgelaufen' : 'eingeholt';
        console.log(`[NPC #${ped.id}] 🚔 VERHAFTUNG! (${reason}) Gangster #${gangster.id}`);
        emitGameNotification('🚔 Verhaftung!', `Gangster gefasst (${reason}) bei (${ped.tileX}, ${ped.tileY})!`);
        return true;
      }

      // Periodisch Pfad zum Gangster neuberechnen
      ped.npcRepathTimer = (ped.npcRepathTimer || 0) + delta;
      if ((ped.npcRepathTimer || 0) >= NPC_CHASE_REPATH_INTERVAL) {
        ped.npcRepathTimer = 0;
        repathPoliceToGangster(ped, gangster);
      }
    }
  }

  // Gangster: Wenn Polizei in der Nähe, schneller fliehen + Raub-Logik
  if (ped.isNpcWorker && ped.npcType === 'gangster' && ped.activity !== 'being_transported') {
    const policeId = ped.npcChaseTargetId || 0;
    const police = policeId > 0 ? allPedestrians.find(p => p.id === policeId) : null;

    if (police) {
      const dist = Math.abs(ped.tileX - police.tileX) + Math.abs(ped.tileY - police.tileY);
      ped.speed = dist < 5 ? NPC_GANGSTER_SPEED * 1.3 : NPC_GANGSTER_SPEED;

      // Wird gejagt → Raub abbrechen
      if (ped.npcRobberyTarget && ped.npcRobberyTarget > 0) {
        ped.npcRobberyTarget = 0;
        ped.activity = 'fleeing';
      }
    } else if (ped.npcRobberyTarget && ped.npcRobberyTarget > 0 && ped.activity === 'robbing') {
      // Auf dem Weg zum Opfer → Pfad periodisch aktualisieren
      const victim = allPedestrians.find(p => p.id === ped.npcRobberyTarget);
      if (!victim || victim.age > victim.maxAge) {
        ped.npcRobberyTarget = 0;
        ped.activity = 'fleeing';
      } else {
        ped.npcRepathTimer = (ped.npcRepathTimer || 0) + delta;
        if ((ped.npcRepathTimer || 0) >= NPC_CHASE_REPATH_INTERVAL) {
          ped.npcRepathTimer = 0;
          const repath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, victim.tileX, victim.tileY);
          if (repath.length >= 2) {
            ped.path = repath;
            ped.pathIndex = 0;
            ped.destX = victim.tileX;
            ped.destY = victim.tileY;
            if (repath.length > 1) {
              const dir = getDirectionToTile(repath[0].x, repath[0].y, repath[1].x, repath[1].y);
              if (dir) ped.direction = dir;
            }
          }
        }
      }
    } else if (!ped.npcRobberyTarget || ped.npcRobberyTarget === 0) {
      // Kein Opfer, keine Polizei → WÄHREND des Laufens nach Opfern Ausschau halten
      ped.npcRepathTimer = (ped.npcRepathTimer || 0) + delta;
      const cooldownActive = (ped.npcRobberyTimer || 0) > 0;
      const maxReached = (ped.npcRobberiesCount || 0) >= NPC_GANGSTER_MAX_ROBBERIES;

      if (!cooldownActive && !maxReached && (ped.npcRepathTimer || 0) >= 1.0) {
        ped.npcRepathTimer = 0;
        const target = findRobberyTarget(ped, allPedestrians);
        if (target) {
          const sent = sendGangsterToRobberyTarget(ped, target, grid, gridSize);
          if (sent) {
            console.log(`[NPC #${ped.id}] 🎯 Gangster entdeckt Opfer #${target.id} beim Wandern!`);
          }
        }
      }
    }

    // Raub-Cooldown runterzählen (auch beim Laufen)
    if (ped.npcRobberyTimer && ped.npcRobberyTimer > 0) {
      ped.npcRobberyTimer -= delta;
    }
  }

  // NPC-Arbeiter sozialisieren nicht und machen keine Pausen
  if (!ped.isNpcWorker) {
    // Only check social/idle occasionally (based on pedestrian ID for distribution)
    // This spreads the checks across frames instead of all at once
    const checkFrame = (ped.id + Math.floor(ped.age * 10)) % 60 === 0;

    if (checkFrame) {
      // Check if we should stop to socialize (very rare)
      if (Math.random() < PEDESTRIAN_SOCIAL_CHANCE) {
        const nearbyPed = findNearbyPedestrianFast(ped, allPedestrians);
        if (nearbyPed) {
          // Set up socializing state for both pedestrians
          ped.state = 'socializing';
          ped.socialTarget = nearbyPed.id;
          ped.activityDuration = PEDESTRIAN_SOCIAL_DURATION;
          ped.activityProgress = 0;
          nearbyPed.state = 'socializing';
          nearbyPed.socialTarget = ped.id;
          nearbyPed.activityDuration = PEDESTRIAN_SOCIAL_DURATION;
          nearbyPed.activityProgress = 0;

          // Offset pedestrians so they face each other and don't overlap
          // Use activity offsets to position them on opposite sides
          const offsetDistance = 8; // pixels apart
          ped.activityOffsetX = -offsetDistance;
          ped.activityOffsetY = 0;
          nearbyPed.activityOffsetX = offsetDistance;
          nearbyPed.activityOffsetY = 0;

          return true;
        }
      }

      // Random chance to idle briefly (very rare)
      if (Math.random() < PEDESTRIAN_IDLE_CHANCE) {
        ped.state = 'idle';
        ped.activityDuration = 1 + Math.random() * 2;
        ped.activityProgress = 0;
        return true;
      }
    }
  }

  // Check if on road (skip if we recently checked - once per tile is enough)
  // NPC-Arbeiter dürfen auch neben Strassen stehen
  if (!ped.isNpcWorker && ped.progress < 0.1 && !isRoadTile(grid, gridSize, ped.tileX, ped.tileY)) {
    return false;
  }

  // Move along path
  ped.progress += ped.speed * delta * speedMultiplier;

  // Handle path progression
  while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
    ped.pathIndex++;
    ped.progress -= 1;

    const currentTile = ped.path[ped.pathIndex];
    if (currentTile.x < 0 || currentTile.x >= gridSize ||
      currentTile.y < 0 || currentTile.y >= gridSize) {
      return false;
    }

    ped.tileX = currentTile.x;
    ped.tileY = currentTile.y;

    // Check if reached end of path
    if (ped.pathIndex >= ped.path.length - 1) {
      if (!ped.returningHome) {
        // Arrived at destination
        handleArrivalAtDestination(ped, grid, gridSize, allPedestrians);
        return true;
      } else {
        // Arrived home
        return false;
      }
    }

    // Update direction
    if (ped.pathIndex + 1 < ped.path.length) {
      const nextTile = ped.path[ped.pathIndex + 1];
      const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
      if (dir) ped.direction = dir;
    }
  }

  // Handle reaching end of path
  if (ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
    if (!ped.returningHome) {
      handleArrivalAtDestination(ped, grid, gridSize, allPedestrians);
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Update approaching shop state - pedestrian walks from road to shop entrance
 */
function updateApproachingShopState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number
): boolean {
  // Animate walking motion
  ped.walkOffset += delta * 6; // Walking animation speed

  ped.buildingEntryProgress += delta * speedMultiplier / PEDESTRIAN_APPROACH_TIME;

  if (ped.buildingEntryProgress >= 1) {
    // Arrived at shop entrance, now enter the building
    ped.state = 'entering_building';
    ped.buildingEntryProgress = 0;
  }

  return true;
}

/**
 * Update entering building state
 */
function updateEnteringBuildingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number
): boolean {
  ped.buildingEntryProgress += delta * speedMultiplier / PEDESTRIAN_BUILDING_ENTER_TIME;

  if (ped.buildingEntryProgress >= 1) {
    ped.state = 'inside_building';
    ped.buildingEntryProgress = 1;
    ped.activityProgress = 0;
  }

  return true;
}

/**
 * Update inside building state
 */
function updateInsideBuildingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;

  if (ped.activityProgress >= 1) {
    // Subway transit: NPC teleportiert zur Ziel-Station
    if (ped.subwayExitX !== undefined && ped.subwayExitY !== undefined) {
      ped.tileX = ped.subwayExitX;
      ped.tileY = ped.subwayExitY;
      ped.destX = ped.subwayExitX;
      ped.destY = ped.subwayExitY;
      ped.subwayExitX = undefined;
      ped.subwayExitY = undefined;
    }

    // Time to leave the building
    ped.state = 'exiting_building';
    ped.buildingEntryProgress = 1;

    // If was shopping, now carry a shopping bag!
    if (ped.activity === 'shopping') {
      ped.hasBag = true;
    }
  }

  return true;
}

/**
 * Update exiting building state
 */
function updateExitingBuildingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.buildingEntryProgress -= delta * speedMultiplier / PEDESTRIAN_BUILDING_ENTER_TIME;

  if (ped.buildingEntryProgress <= 0) {
    ped.buildingEntryProgress = 0;
    ped.activity = 'none';

    // Start heading home
    const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
    if (returnPath && returnPath.length > 0) {
      ped.path = returnPath;
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.tileX = returnPath[0].x;
      ped.tileY = returnPath[0].y;
      ped.state = 'walking';
      ped.returningHome = true;

      if (returnPath.length > 1) {
        const nextTile = returnPath[1];
        const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    } else {
      return false; // No path home, remove pedestrian
    }
  }

  return true;
}

/**
 * Update recreation state
 */
function updateRecreationState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;

  // Animate based on activity
  if (ped.activity === 'jogging') {
    // Joggers move around within the area
    ped.walkOffset += delta * 10;
    const jogRadius = 15;
    ped.activityOffsetX = Math.sin(ped.activityAnimTimer * 0.5) * jogRadius;
    ped.activityOffsetY = Math.cos(ped.activityAnimTimer * 0.3) * jogRadius * 0.6;
  } else if (ped.activity === 'walking_dog') {
    // Dog walkers move slowly
    ped.walkOffset += delta * 4;
    const walkRadius = 10;
    ped.activityOffsetX = Math.sin(ped.activityAnimTimer * 0.2) * walkRadius;
    ped.activityOffsetY = Math.cos(ped.activityAnimTimer * 0.15) * walkRadius * 0.6;
  }

  if (ped.activityProgress >= 1) {
    // Done with activity, head home
    ped.hasBall = false;
    ped.activity = 'none';

    const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
    if (returnPath && returnPath.length > 0) {
      ped.path = returnPath;
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.tileX = returnPath[0].x;
      ped.tileY = returnPath[0].y;
      ped.state = 'walking';
      ped.returningHome = true;

      if (returnPath.length > 1) {
        const nextTile = returnPath[1];
        const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Update beach state (swimming or lying on mat)
 */
function updateBeachState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;

  // Animate based on activity
  if (ped.activity === 'beach_swimming') {
    // Swimmers bob and move in the water
    ped.walkOffset += delta * 3;
    // Gentle movement in the water, staying near the shore
    const swimRadius = 6;
    ped.activityOffsetX += (Math.sin(ped.activityAnimTimer * 0.3) * 0.1 - ped.activityOffsetX * 0.02) * delta * 10;
    ped.activityOffsetY += (Math.cos(ped.activityAnimTimer * 0.2) * 0.05 - ped.activityOffsetY * 0.02) * delta * 10;
    // Clamp to stay in reasonable area
    ped.activityOffsetX = Math.max(-swimRadius, Math.min(swimRadius, ped.activityOffsetX));
    ped.activityOffsetY = Math.max(-swimRadius * 0.5, Math.min(swimRadius * 0.5, ped.activityOffsetY));
  } else if (ped.activity === 'lying_on_mat') {
    // Person on mat barely moves - occasional shift
    if (Math.random() < 0.001) {
      ped.activityOffsetX += (Math.random() - 0.5) * 0.5;
      ped.activityOffsetY += (Math.random() - 0.5) * 0.25;
    }
  }

  if (ped.activityProgress >= 1) {
    // Done at beach, head home
    ped.activity = 'none';
    ped.hasBeachMat = false;
    ped.beachEdge = null;

    const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
    if (returnPath && returnPath.length > 0) {
      ped.path = returnPath;
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.tileX = returnPath[0].x;
      ped.tileY = returnPath[0].y;
      ped.state = 'walking';
      ped.returningHome = true;

      if (returnPath.length > 1) {
        const nextTile = returnPath[1];
        const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Update idle state
 */
function updateIdleState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Debug-Avatar bleibt im Idle stabil stehen, bis ein neuer Pfad gesetzt wird.
  if (ped.isNpcWorker && ped.npcType === 'avatar_test') {
    ped.activity = 'none';
    ped.activityProgress = 0;
    ped.activityDuration = 999999;
    ped.progress = 0;
    return true;
  }

  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;

  if (ped.activityProgress >= 1) {
    // NPC-Holzfäller: Suche nächsten Baum
    if (ped.isNpcWorker && ped.npcType === 'woodcutter') {
      // === PLANTAGEN-MODUS: Entscheidung basierend auf Plantagen-Status ===
      if (ped.npcPlantationMode) {
        const houseX = ped.homeX;
        const houseY = ped.homeY;
        const house = grid[houseY]?.[houseX];

        // Haus abgerissen? → NPC entfernen
        if (!house || house.building.type !== 'woodcutter_house') {
          console.log(`[Plantage #${ped.id}] Haus nicht mehr vorhanden, NPC wird entfernt`);
          return false;
        }

        const level = house.building.level || 1;
        const config = WOODCUTTER_LEVEL_CONFIG[Math.min(level, 4)] || WOODCUTTER_LEVEL_CONFIG[1];

        // Zähle Bäume im Radius
        let treeCount = 0;
        let matureCount = 0;
        const minX = Math.max(0, houseX - config.radius);
        const maxX = Math.min(gridSize - 1, houseX + config.radius);
        const minY = Math.max(0, houseY - config.radius);
        const maxY = Math.min(gridSize - 1, houseY + config.radius);
        for (let ty = minY; ty <= maxY; ty++) {
          for (let tx = minX; tx <= maxX; tx++) {
            if (tx === houseX && ty === houseY) continue;
            const dist = Math.abs(tx - houseX) + Math.abs(ty - houseY);
            if (dist > config.radius) continue;
            const t = grid[ty][tx];
            if (t.building.type.startsWith('tree') || t.building.type === 'tree') {
              treeCount++;
              // Reife-Check: plantedAt-basiert (Echtzeit)
              const pa = t.building.plantedAt;
              if (pa) {
                if (Date.now() - pa >= config.growthMs) matureCount++;
              } else {
                matureCount++; // Legacy-Bäume ohne plantedAt = sofort erntbar
              }
            }
          }
        }

        // Priorität: Reife Bäume ernten > Neue Bäume pflanzen > Warten
        if (matureCount > 0) {
          const found = sendPlantationWorkerToHarvest(ped, grid, gridSize, allPedestrians);
          if (found) return true;
        }

        if (treeCount < config.maxTrees) {
          const found = sendPlantationWorkerToPlant(ped, grid, gridSize, allPedestrians);
          if (found) return true;
        }

        // Nichts zu tun → Vor dem Haus warten (sichtbar versetzt)
        ped.npcPlantationPhase = 'waiting';
        ped.activityProgress = 0;
        ped.activityDuration = 3; // 3 Sekunden warten, dann nochmal pruefen
        ped.state = 'idle_outside';
        // NPC leicht versetzt vom Haus positionieren, damit sichtbar
        const idleOffsets = [
          { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 },
        ];
        const workerIdx = ped.id % idleOffsets.length;
        const off = idleOffsets[workerIdx];
        const idleX = Math.max(0, Math.min(gridSize - 1, houseX + off.dx));
        const idleY = Math.max(0, Math.min(gridSize - 1, houseY + off.dy));
        ped.tileX = idleX;
        ped.tileY = idleY;
        ped.destX = idleX;
        ped.destY = idleY;
        return true;
      }

      // === NORMALER MODUS (alter Free-Spawn Holzfäller) ===
      // Limit erreicht? → NPC entfernen
      if ((ped.npcTreesChopped || 0) >= NPC_MAX_TREES) {
        return false;
      }
      const found = sendWoodcutterToNextTree(ped, grid, gridSize, allPedestrians);
      if (!found) {
        // Kein Baum gefunden, kurze Pause dann nochmal versuchen
        ped.activityProgress = 0;
        ped.activityDuration = 3; // 3 Sekunden warten
      }
      return true;
    }

    // NPC-Polizei: Suche Gangster oder patrouilliere
    if (ped.isNpcWorker && ped.npcType === 'police') {
      const gangsterId = ped.npcChaseTargetId || 0;
      const gangster = gangsterId > 0 ? allPedestrians.find(p => p.id === gangsterId) : null;

      if (gangster) {
        // Gangster vorhanden → Pfad dorthin
        repathPoliceToGangster(ped, gangster);
        ped.state = 'walking';
        ped.activity = 'chasing';
      } else {
        // Kein Gangster → Suche neuen
        const allPolice = allPedestrians.filter(p => p.isNpcWorker && p.npcType === 'police' && p.id !== ped.id);
        const chasedIds = new Set(allPolice.map(p => p.npcChaseTargetId).filter(id => id && id > 0));
        const freeGangster = allPedestrians.find(p =>
          p.isNpcWorker && p.npcType === 'gangster' && !chasedIds.has(p.id)
          && p.activity !== 'arrested' && p.activity !== 'being_transported'
        );

        if (freeGangster) {
          ped.npcChaseTargetId = freeGangster.id;
          freeGangster.npcChaseTargetId = ped.id;
          freeGangster.activity = 'fleeing';
          ped.activity = 'chasing';
          repathPoliceToGangster(ped, freeGangster);
          ped.state = 'walking';
          console.log(`[NPC #${ped.id}] 🚔 Neuen Gangster #${freeGangster.id} gefunden!`);
        } else {
          // Patrouillieren (zufälliges Ziel)
          const rx = Math.max(2, Math.min(gridSize - 3, ped.tileX + Math.floor(Math.random() * 15) - 7));
          const ry = Math.max(2, Math.min(gridSize - 3, ped.tileY + Math.floor(Math.random() * 15) - 7));
          const patrolPath = buildDirectGridPath(ped.tileX, ped.tileY, rx, ry);
          if (patrolPath.length >= 2) {
            ped.path = patrolPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            ped.destX = rx;
            ped.destY = ry;
            ped.tileX = patrolPath[0].x;
            ped.tileY = patrolPath[0].y;
            ped.state = 'walking';
            ped.activity = 'chasing'; // Patrouilliert
            if (patrolPath.length > 1) {
              const dir = getDirectionToTile(patrolPath[0].x, patrolPath[0].y, patrolPath[1].x, patrolPath[1].y);
              if (dir) ped.direction = dir;
            }
          } else {
            ped.activityProgress = 0;
            ped.activityDuration = 2;
          }
        }
      }
      return true;
    }

    // NPC-Gangster: Wandern, Rauben oder Fliehen
    if (ped.isNpcWorker && ped.npcType === 'gangster') {
      const policeId = ped.npcChaseTargetId || 0;
      const police = policeId > 0 ? allPedestrians.find(p => p.id === policeId) : null;

      // Raub-Cooldown runterzählen
      if (ped.npcRobberyTimer && ped.npcRobberyTimer > 0) {
        ped.npcRobberyTimer -= delta * speedMultiplier;
      }

      if (police) {
        // Wird gejagt → fliehen!
        const found = sendGangsterFleeing(ped, grid, gridSize, police);
        if (!found) {
          ped.activityProgress = 0;
          ped.activityDuration = 0.5;
        }
      } else {
        // Kein Polizist jagt ihn → Raub-Opfer suchen oder wandern
        const cooldownActive = (ped.npcRobberyTimer || 0) > 0;
        const maxReached = (ped.npcRobberiesCount || 0) >= NPC_GANGSTER_MAX_ROBBERIES;

        if (maxReached) {
          emitGameNotification('💀 Gangster fertig', `Max ${NPC_GANGSTER_MAX_ROBBERIES} Überfälle erreicht (Count: ${ped.npcRobberiesCount || 0})`);
          return false;
        }

        if (!cooldownActive) {
          const target = findRobberyTarget(ped, allPedestrians);
          if (target) {
            const sent = sendGangsterToRobberyTarget(ped, target, grid, gridSize);
            if (sent) {
              console.log(`[NPC #${ped.id}] 🎯 Gangster hat Opfer #${target.id} bei (${target.tileX},${target.tileY}) im Visier!`);
              emitGameNotification('🎯 Opfer gefunden!', `Gangster geht zu Passant #${target.id} bei (${target.tileX},${target.tileY})`);
              return true;
            }
          }
        }

        // Kein Opfer gefunden oder Cooldown → Richtung Strassen wandern (dort sind Fussgänger)
        let rx = 0, ry = 0;
        let foundRoad = false;

        // Suche eine Strasse in der Nähe als Wanderziel (dort sind Passanten)
        for (let attempt = 0; attempt < 12; attempt++) {
          const range = 8 + attempt * 3;
          const tx = Math.max(2, Math.min(gridSize - 3, ped.tileX + Math.floor(Math.random() * range * 2) - range));
          const ty = Math.max(2, Math.min(gridSize - 3, ped.tileY + Math.floor(Math.random() * range * 2) - range));
          const tileType = grid[ty]?.[tx]?.building?.type;
          if (tileType === 'road' || tileType === 'bridge') {
            rx = tx;
            ry = ty;
            foundRoad = true;
            break;
          }
        }
        if (!foundRoad) {
          rx = Math.max(2, Math.min(gridSize - 3, ped.tileX + Math.floor(Math.random() * 21) - 10));
          ry = Math.max(2, Math.min(gridSize - 3, ped.tileY + Math.floor(Math.random() * 21) - 10));
        }

        const wanderPath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, rx, ry);
        if (wanderPath.length >= 2) {
          ped.path = wanderPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.destX = rx;
          ped.destY = ry;
          ped.tileX = wanderPath[0].x;
          ped.tileY = wanderPath[0].y;
          ped.state = 'walking';
          ped.activity = 'fleeing';
          if (wanderPath.length > 1) {
            const dir = getDirectionToTile(wanderPath[0].x, wanderPath[0].y, wanderPath[1].x, wanderPath[1].y);
            if (dir) ped.direction = dir;
          }
        } else {
          ped.activityProgress = 0;
          ped.activityDuration = 2;
        }
      }
      return true;
    }

    // NPC-Gärtner: Suche nächstes leeres Gras-Tile
    if (ped.isNpcWorker && ped.npcType === 'gardener') {
      // Limit erreicht? → NPC entfernen
      if ((ped.npcTreesPlanted || 0) >= NPC_MAX_PLANTS) {
        return false;
      }
      const found = sendGardenerToNextGrass(ped, grid, gridSize, allPedestrians);
      if (!found) {
        ped.activityProgress = 0;
        ped.activityDuration = 3;
      }
      return true;
    }

    // NPC-Bünzli: Suche nächstes Gebäude — patrouilliert unbegrenzt
    if (ped.isNpcWorker && ped.npcType === 'buenzli') {
      if (((ped as any).npcInspectedBuildings?.length || 0) >= NPC_BUENZLI_RESET_AFTER) {
        (ped as any).npcInspectedBuildings = [];
      }
      const found = sendBuenzliToNextBuilding(ped, grid, gridSize, allPedestrians);
      if (!found) {
        ped.activityProgress = 0;
        ped.activityDuration = 5;
      }
      return true;
    }

    ped.state = 'walking';
    ped.activityProgress = 0;
  }

  return true;
}

/**
 * Update NPC working state (z.B. Baum fällen)
 * Gibt ein Callback-Objekt zurück wenn der Baum gefällt ist (Grid muss extern aktualisiert werden)
 */
function updateNpcWorkingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number,
  allPedestrians: Pedestrian[]
): boolean {
  // Fortschritt beim Arbeiten
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;
  ped.npcWorkProgress = Math.min(100, (ped.npcWorkProgress || 0) + delta * speedMultiplier * (100 / ped.activityDuration));

  // Swing-Animation
  ped.walkOffset += delta * 12;

  if (ped.activityProgress >= 1) {
    // === POLIZEI / GANGSTER: Verhaftung abgeschlossen → Transport zum Polizeiauto ===
    if (ped.npcType === 'police' && ped.activity === 'arresting') {
      const gangster = allPedestrians.find(p => p.id === ped.npcChaseTargetId);
      const transportTarget = ped.npcTransportTarget;

      if (transportTarget) {
        const alreadyAtCar = ped.tileX === transportTarget.x && ped.tileY === transportTarget.y;

        if (alreadyAtCar) {
          emitGameNotification('🚔 Eingestiegen!', `Polizist & Gangster am Auto (${transportTarget.x},${transportTarget.y}) → abfahrt!`);
          if (gangster) gangster.activityProgress = 999;
          return false;
        }

        const transportPath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, transportTarget.x, transportTarget.y);
        if (transportPath.length >= 2) {
          ped.path = transportPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.destX = transportTarget.x;
          ped.destY = transportTarget.y;
          ped.tileX = transportPath[0].x;
          ped.tileY = transportPath[0].y;
          ped.state = 'walking';
          ped.activity = 'transporting';
          ped.activityProgress = 0;
          ped.speed = 0.15;
          if (transportPath.length > 1) {
            const dir = getDirectionToTile(transportPath[0].x, transportPath[0].y, transportPath[1].x, transportPath[1].y);
            if (dir) ped.direction = dir;
          }

          if (gangster) {
            gangster.path = transportPath;
            gangster.pathIndex = 0;
            gangster.progress = 0;
            gangster.destX = transportTarget.x;
            gangster.destY = transportTarget.y;
            gangster.tileX = transportPath[0].x;
            gangster.tileY = transportPath[0].y;
            gangster.state = 'walking';
            gangster.activity = 'being_transported';
            gangster.activityProgress = 0;
            gangster.speed = 0.15;
            if (transportPath.length > 1) {
              const dir = getDirectionToTile(transportPath[0].x, transportPath[0].y, transportPath[1].x, transportPath[1].y);
              if (dir) gangster.direction = dir;
            }
          }
          emitGameNotification('🚔 Transport', `Zum Auto bei (${transportTarget.x},${transportTarget.y}), Pfad: ${transportPath.length} Tiles`);
          return true;
        } else {
          emitGameNotification('🚔 Eingestiegen!', `Bereits am Auto → abfahrt!`);
          if (gangster) gangster.activityProgress = 999;
          return false;
        }
      } else {
        emitGameNotification('⚠️ Kein Transportziel', `Polizist hat kein Auto-Ziel!`);
      }

      if (gangster) {
        gangster.activityProgress = 999;
      }
      return false;
    }
    if (ped.npcType === 'gangster' && ped.activity === 'arrested') {
      // Warte auf Polizist (Transport wird vom Polizist gestartet)
      return true;
    }

    // === GANGSTER: Raubüberfall abgeschlossen → Erfolg/Misserfolg ===
    if (ped.npcType === 'gangster' && ped.activity === 'robbing') {
      const success = Math.random() < NPC_GANGSTER_ROBBERY_SUCCESS_CHANCE;

      if (success) {
        // Raub erfolgreich
        ped.npcRobberiesCount = (ped.npcRobberiesCount || 0) + 1;
        console.log(`[NPC #${ped.id}] 💰 Raub ERFOLGREICH! (${ped.npcRobberiesCount}/${NPC_GANGSTER_MAX_ROBBERIES})`);
        emitGameNotification('💰 Raub erfolgreich!', `Gangster hat ${ped.npcRobberiesCount}/${NPC_GANGSTER_MAX_ROBBERIES} Überfälle begangen!`);

        // Opfer verschwindet (flieht)
        const victim = allPedestrians.find(p => p.id === ped.npcRobberyTarget);
        if (victim) {
          victim.age = victim.maxAge + 1;
        }

        ped.npcRobberyTarget = 0;
        ped.npcRobberyTimer = NPC_GANGSTER_ROBBERY_COOLDOWN;

        // Max Raubüberfälle erreicht → Gangster verschwindet
        if ((ped.npcRobberiesCount || 0) >= NPC_GANGSTER_MAX_ROBBERIES) {
          console.log(`[NPC #${ped.id}] 💀 Gangster hat genug geraubt und verschwindet.`);
          return false;
        }

        // Weiter wandern
        ped.state = 'idle';
        ped.activity = 'fleeing';
        ped.activityProgress = 0;
        ped.activityDuration = 1.0;
      } else {
        // Raub FEHLGESCHLAGEN → Polizei alarmieren!
        console.log(`[NPC #${ped.id}] 🚨 Raub FEHLGESCHLAGEN bei (${ped.tileX},${ped.tileY})! Polizei wird alarmiert!`);
        emitGameNotification('🚨 Raub fehlgeschlagen!', `Polizei wird alarmiert bei (${ped.tileX}, ${ped.tileY})!`);

        // Crime-Incident am Tatort markieren (wird im Game-Loop von vehicleSystems gelesen)
        ped.npcTriggeredCrime = { x: ped.tileX, y: ped.tileY };

        // Opfer flieht
        const victim = allPedestrians.find(p => p.id === ped.npcRobberyTarget);
        if (victim) {
          victim.age = victim.maxAge + 1;
        }

        ped.npcRobberyTarget = 0;
        ped.npcRobberyTimer = NPC_GANGSTER_ROBBERY_COOLDOWN;

        // Gangster flieht panisch in zufällige Richtung
        const fleeX = Math.max(2, Math.min(gridSize - 3, ped.tileX + (Math.random() < 0.5 ? 1 : -1) * (8 + Math.floor(Math.random() * 6))));
        const fleeY = Math.max(2, Math.min(gridSize - 3, ped.tileY + (Math.random() < 0.5 ? 1 : -1) * (8 + Math.floor(Math.random() * 6))));
        const fleePath = buildWalkablePath(grid, gridSize, ped.tileX, ped.tileY, fleeX, fleeY);
        if (fleePath.length >= 2) {
          ped.path = fleePath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.destX = fleeX;
          ped.destY = fleeY;
          ped.tileX = fleePath[0].x;
          ped.tileY = fleePath[0].y;
          ped.state = 'walking';
          ped.activity = 'fleeing';
          ped.speed = NPC_GANGSTER_SPEED * 1.4;
          if (fleePath.length > 1) {
            const dir = getDirectionToTile(fleePath[0].x, fleePath[0].y, fleePath[1].x, fleePath[1].y);
            if (dir) ped.direction = dir;
          }
        } else {
          ped.state = 'idle';
          ped.activity = 'fleeing';
          ped.activityProgress = 0;
          ped.activityDuration = 0.5;
        }
      }
      return true;
    }

    // === HOLZFÄLLER: Baum fällen oder pflanzen ===
    if (ped.npcType === 'woodcutter') {
      // === PLANTAGEN-MODUS ===
      if (ped.npcPlantationMode) {
        const houseX = ped.homeX;
        const houseY = ped.homeY;
        const house = grid[houseY]?.[houseX];
        const level = house?.building?.level || 1;
        const config = WOODCUTTER_LEVEL_CONFIG[Math.min(level, 4)] || WOODCUTTER_LEVEL_CONFIG[1];

        if (ped.npcPlantationPhase === 'planting' && ped.activity === 'planting_tree') {
          // Baum pflanzen
          const gx = ped.destX;
          const gy = ped.destY;
          if (grid[gy]?.[gx]?.building.type === 'grass') {
            grid[gy][gx].building.type = 'tree';
            grid[gy][gx].building.level = 1;
            grid[gy][gx].building.population = 0;
            grid[gy][gx].building.jobs = 0;
            grid[gy][gx].building.age = 0;
            grid[gy][gx].building.plantedAt = Date.now(); // Echtzeit-Timestamp für Server-Sync
            console.log(`[Plantage #${ped.id}] Baum gepflanzt bei (${gx},${gy})`);
          }
          ped.npcTreesPlanted = (ped.npcTreesPlanted || 0) + 1;
        } else if (ped.npcPlantationPhase === 'harvesting' && ped.activity === 'chopping_tree') {
          // Baum ernten
          const tx = ped.destX;
          const ty = ped.destY;
          if (grid[ty]?.[tx] && (grid[ty][tx].building.type.startsWith('tree') || grid[ty][tx].building.type === 'tree')) {
            grid[ty][tx].building.type = 'grass';
            grid[ty][tx].building.level = 0;
            grid[ty][tx].building.population = 0;
            grid[ty][tx].building.jobs = 0;
            grid[ty][tx].building.age = 0;
            console.log(`[Plantage #${ped.id}] Baum geerntet bei (${tx},${ty}) → +$${config.moneyPerHarvest}`);
          }
          ped.npcTreesChopped = (ped.npcTreesChopped || 0) + 1;

          // Geld und Statistik auf dem Haus aktualisieren
          if (house && house.building.type === 'woodcutter_house') {
            house.building.plantationHarvests = (house.building.plantationHarvests || 0) + 1;
            house.building.plantationMoneyEarned = (house.building.plantationMoneyEarned || 0) + config.moneyPerHarvest;
          }
        }

        // Reset und zurück zum Idle (dort wird die nächste Aufgabe entschieden)
        ped.npcWorkProgress = 0;
        ped.activity = 'none';
        ped.activityProgress = 0;
        ped.state = 'idle';
        ped.activityDuration = 1;
        return true; // Plantagen-NPCs despawnen NIE (nur wenn Haus weg)
      }

      // === NORMALER HOLZFÄLLER-MODUS ===
      const treeX = ped.destX;
      const treeY = ped.destY;
      if (grid[treeY]?.[treeX] && (grid[treeY][treeX].building.type.startsWith('tree') || grid[treeY][treeX].building.type === 'tree')) {
        grid[treeY][treeX].building.type = 'grass';
        grid[treeY][treeX].building.level = 0;
        grid[treeY][treeX].building.population = 0;
        grid[treeY][treeX].building.jobs = 0;
        grid[treeY][treeX].building.age = 0;
        console.log(`[NPC #${ped.id}] Baum gefällt bei (${treeX},${treeY})`);
      }

      ped.npcTreesChopped = (ped.npcTreesChopped || 0) + 1;
      ped.npcWorkProgress = 0;
      ped.activity = 'none';
      ped.activityProgress = 0;

      if ((ped.npcTreesChopped || 0) >= NPC_MAX_TREES) {
        console.log(`[NPC #${ped.id}] Fertig! ${ped.npcTreesChopped} Bäume gefällt. NPC wird entfernt.`);
        return false;
      }

      const found = sendWoodcutterToNextTree(ped, grid, gridSize, allPedestrians);
      if (!found) {
        console.log(`[NPC #${ped.id}] Kein nächster Baum gefunden, warte...`);
        ped.state = 'idle';
        ped.activityDuration = 1;
        ped.activityProgress = 0;
      }
    }
    // === GÄRTNER: Baum pflanzen ===
    else if (ped.npcType === 'gardener') {
      const grassX = ped.destX;
      const grassY = ped.destY;
      if (grid[grassY]?.[grassX]?.building.type === 'grass') {
        // Grid direkt mutieren - Baum pflanzen!
        grid[grassY][grassX].building.type = 'tree';
        grid[grassY][grassX].building.level = 1;
        grid[grassY][grassX].building.population = 0;
        grid[grassY][grassX].building.jobs = 0;
        grid[grassY][grassX].building.age = 0;
        console.log(`[NPC #${ped.id}] 🌳 Baum gepflanzt bei (${grassX},${grassY})`);
      }

      ped.npcTreesPlanted = (ped.npcTreesPlanted || 0) + 1;

      // Reset working state
      ped.npcWorkProgress = 0;
      ped.activity = 'none';
      ped.activityProgress = 0;

      // Limit erreicht? → NPC verschwindet
      if ((ped.npcTreesPlanted || 0) >= NPC_MAX_PLANTS) {
        console.log(`[NPC #${ped.id}] ✅ Fertig! ${ped.npcTreesPlanted} Bäume gepflanzt. NPC wird entfernt.`);
        return false;
      }

      // Sofort nächstes Gras-Tile suchen
      const found = sendGardenerToNextGrass(ped, grid, gridSize, allPedestrians);
      if (!found) {
        console.log(`[NPC #${ped.id}] Kein nächstes Gras-Tile gefunden, warte...`);
        ped.state = 'idle';
        ped.activityDuration = 1;
        ped.activityProgress = 0;
      }
    }
    // === BÜNZLI: Inspektion abgeschlossen (rein visuell — keine erfundenen Verstösse!) ===
    else if (ped.npcType === 'buenzli' && ped.activity === 'inspecting') {
      ped.npcInspectionsCount = (ped.npcInspectionsCount || 0) + 1;

      // Inspiziertes Gebäude merken damit er nicht zurückläuft
      const inspected = (ped as any).npcInspectedBuildings || [];
      inspected.push({ x: ped.destX, y: ped.destY });
      (ped as any).npcInspectedBuildings = inspected;

      // Reset working state
      ped.npcWorkProgress = 0;
      ped.activity = 'none';
      ped.activityProgress = 0;

      // Nach NPC_BUENZLI_RESET_AFTER Inspektionen: Liste leeren → neue Zone erkunden
      if (((ped as any).npcInspectedBuildings?.length || 0) >= NPC_BUENZLI_RESET_AFTER) {
        (ped as any).npcInspectedBuildings = [];
      }
      // Nächstes Gebäude suchen (von AKTUELLER Position aus — läuft ewig weiter)
      const found = sendBuenzliToNextBuilding(ped, grid, gridSize, allPedestrians);
      if (!found) {
        // Kurz warten, dann nochmal versuchen
        ped.state = 'idle';
        ped.activityDuration = 5;
        ped.activityProgress = 0;
      }
    }
  }

  return true;
}

/**
 * Update socializing state
 */
function updateSocializingState(
  ped: Pedestrian,
  delta: number,
  speedMultiplier: number,
  allPedestrians: Pedestrian[]
): boolean {
  ped.activityProgress += delta * speedMultiplier / ped.activityDuration;

  // Check if partner is still socializing
  if (ped.socialTarget !== null) {
    const partner = allPedestrians.find(p => p.id === ped.socialTarget);
    if (!partner) {
      // Partner no longer exists, stop socializing
      ped.state = 'walking';
      ped.socialTarget = null;
      ped.activityProgress = 0;
      ped.activityOffsetX = 0;
      ped.activityOffsetY = 0;
      return true;
    }

    // If partner is no longer socializing with us (they may have just finished),
    // we should also finish but don't abruptly disappear - complete our transition
    if (partner.state !== 'socializing' || partner.socialTarget !== ped.id) {
      ped.state = 'walking';
      ped.socialTarget = null;
      ped.activityProgress = 0;
      ped.activityOffsetX = 0;
      ped.activityOffsetY = 0;
      return true;
    }
  }

  if (ped.activityProgress >= 1) {
    // Finished socializing - also signal partner to finish
    if (ped.socialTarget !== null) {
      const partner = allPedestrians.find(p => p.id === ped.socialTarget);
      if (partner && partner.state === 'socializing') {
        // Set partner's progress to complete so they finish on next update
        partner.activityProgress = 1;
      }
    }

    ped.state = 'walking';
    ped.socialTarget = null;
    ped.activityProgress = 0;
    ped.activityOffsetX = 0;
    ped.activityOffsetY = 0;
  }

  return true;
}

/**
 * Find a nearby pedestrian for socializing - optimized version
 * Only checks a limited number of pedestrians to avoid O(n²) behavior
 * Prefers adjacent tile matches to avoid same-position overlapping
 */
function findNearbyPedestrianFast(
  ped: Pedestrian,
  allPedestrians: Pedestrian[]
): Pedestrian | null {
  // Only check up to 20 pedestrians to avoid performance issues
  const checkLimit = Math.min(20, allPedestrians.length);
  const startIdx = ped.id % Math.max(1, allPedestrians.length - checkLimit);

  let sameTileMatch: Pedestrian | null = null;

  for (let i = 0; i < checkLimit; i++) {
    const idx = (startIdx + i) % allPedestrians.length;
    const other = allPedestrians[idx];

    if (other.id === ped.id) continue;
    if (other.state !== 'walking') continue;
    if (other.socialTarget !== null) continue;

    // Quick distance check - same tile or adjacent
    const dist = Math.abs(other.tileX - ped.tileX) + Math.abs(other.tileY - ped.tileY);

    if (dist === 1) {
      // Adjacent tile - prefer this to avoid overlap issues
      return other;
    } else if (dist === 0 && !sameTileMatch) {
      // Same tile - only use if no adjacent tile match found
      // Also check they're not on the same sidewalk side to reduce overlap
      if (other.sidewalkSide !== ped.sidewalkSide) {
        sameTileMatch = other;
      }
    }
  }

  return sameTileMatch;
}

/**
 * Spawn a pedestrian inside a shop/enterable building
 * They will be partway through their shopping/activity time
 */
export function spawnPedestrianInsideBuilding(
  id: number,
  buildingX: number,
  buildingY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  const tile = grid[buildingY]?.[buildingX];
  if (!tile) return null;

  // Verify this is an enterable building
  if (!canPedestrianEnterBuilding(tile.building.type)) return null;

  // Find nearest road to spawn on when they exit
  const roadTile = findNearestRoadToBuilding(grid, gridSize, buildingX, buildingY);
  if (!roadTile) return null;

  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;

  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    buildingX,
    buildingY,
    getDestTypeForBuilding(tile.building.type),
    path,
    0,
    'south'
  );

  // Start already inside the building
  ped.state = 'inside_building';
  ped.buildingEntryProgress = 1; // Fully inside
  ped.activity = getActivityForBuilding(tile.building.type);
  ped.activityProgress = Math.random() * 0.6; // Already partway through
  ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
    Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);

  // Position at the building (for when they exit)
  ped.tileX = roadTile.x;
  ped.tileY = roadTile.y;

  return ped;
}

/**
 * Spawn a pedestrian approaching a shop (visible at entrance)
 */
export function spawnPedestrianApproachingShop(
  id: number,
  shopX: number,
  shopY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  const tile = grid[shopY]?.[shopX];
  if (!tile) return null;

  // Verify this is a shop building
  if (!isShopBuilding(tile.building.type)) return null;

  // Find nearest road
  const roadTile = findNearestRoadToBuilding(grid, gridSize, shopX, shopY);
  if (!roadTile) return null;

  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;

  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    shopX,
    shopY,
    'commercial',
    path,
    0,
    'south'
  );

  // Start at approaching shop state
  ped.state = 'approaching_shop';
  ped.buildingEntryProgress = Math.random() * 0.8; // Partway through approach
  ped.activity = 'shopping';
  ped.activityDuration = PEDESTRIAN_BUILDING_MIN_TIME +
    Math.random() * (PEDESTRIAN_BUILDING_MAX_TIME - PEDESTRIAN_BUILDING_MIN_TIME);

  // Random offset at entrance
  const offset = getRandomActivityOffset();
  ped.activityOffsetX = offset.x * 0.5;
  ped.activityOffsetY = offset.y * 0.3;

  // Position at the ROAD near the shop (for walking animation from road to shop)
  ped.tileX = roadTile.x;
  ped.tileY = roadTile.y;

  return ped;
}

/**
 * Get destination type for a building type
 */
function getDestTypeForBuilding(buildingType: BuildingType): PedestrianDestType {
  if (buildingType === 'school' || buildingType === 'university') {
    return 'school';
  }
  if (buildingType === 'shop_small' || buildingType === 'shop_medium' ||
    buildingType === 'mall' || buildingType === 'office_low' ||
    buildingType === 'office_high') {
    return 'commercial';
  }
  if (buildingType === 'factory_small' || buildingType === 'factory_medium' ||
    buildingType === 'factory_large' || buildingType === 'warehouse') {
    return 'industrial';
  }
  return 'home';
}

/**
 * Spawn a pedestrian that exits from a building
 */
export function spawnPedestrianFromBuilding(
  id: number,
  buildingX: number,
  buildingY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  // Find nearest road to spawn on
  const roadTile = findNearestRoadToBuilding(grid, gridSize, buildingX, buildingY);
  if (!roadTile) return null;

  // Find path home
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;

  // Determine direction
  let direction: CarDirection = 'south';
  if (path.length > 1) {
    const nextTile = path[1];
    const dir = getDirectionToTile(roadTile.x, roadTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  }

  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    buildingX, // dest becomes where they came from
    buildingY,
    'home', // heading home
    path,
    0,
    direction
  );

  // Start in exiting state
  ped.state = 'exiting_building';
  ped.buildingEntryProgress = 1;
  ped.returningHome = true;

  return ped;
}

/**
 * Spawn a pedestrian at a recreational area already doing an activity
 */
export function spawnPedestrianAtRecreation(
  id: number,
  areaX: number,
  areaY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  const tile = grid[areaY]?.[areaX];
  if (!tile) return null;

  // Find a road near the recreation area for eventual path home
  const roadTile = findNearestRoadToBuilding(grid, gridSize, areaX, areaY);
  if (!roadTile) return null;

  // Find path home (for when they're done)
  const path = findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY);
  if (!path || path.length === 0) return null;

  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    areaX,
    areaY,
    'park',
    path,
    0,
    'south'
  );

  // Start already at recreation
  const activity = getActivityForBuilding(tile.building.type);
  ped.state = 'at_recreation';
  ped.activity = activity;
  ped.activityProgress = Math.random() * 0.5; // Already partway through
  ped.activityDuration = PEDESTRIAN_MIN_ACTIVITY_TIME +
    Math.random() * (PEDESTRIAN_MAX_ACTIVITY_TIME - PEDESTRIAN_MIN_ACTIVITY_TIME);

  const offset = getRandomActivityOffset();
  ped.activityOffsetX = offset.x;
  ped.activityOffsetY = offset.y;

  if (BALL_ACTIVITIES.includes(activity)) {
    ped.hasBall = true;
  }

  // Position at the recreation area
  ped.tileX = areaX;
  ped.tileY = areaY;

  return ped;
}

/**
 * Get visible pedestrians (filter out ones inside buildings)
 */
export function getVisiblePedestrians(pedestrians: Pedestrian[]): Pedestrian[] {
  return pedestrians.filter(ped => ped.state !== 'inside_building' && ped.state !== 'riding_bus');
}

/**
 * Get opacity for pedestrian (for enter/exit animations)
 * Shoppers stay visible at shop entrance (no fade), others fade in/out
 */
export function getPedestrianOpacity(ped: Pedestrian): number {
  // Shoppers stay visible at entrances - only fade when actually going inside
  if (ped.activity === 'shopping') {
    switch (ped.state) {
      case 'approaching_shop':
        return 1; // Fully visible while approaching
      case 'entering_building':
        // Only start fading at 50% progress (walk into door first)
        return ped.buildingEntryProgress < 0.5 ? 1 : 1 - (ped.buildingEntryProgress - 0.5) * 2;
      case 'exiting_building':
        // Fade in quickly at the start
        return ped.buildingEntryProgress > 0.5 ? 1 : ped.buildingEntryProgress * 2;
      case 'inside_building':
        return 0;
      default:
        return 1;
    }
  }

  // Non-shop buildings: simple fade
  switch (ped.state) {
    case 'entering_building':
      return 1 - ped.buildingEntryProgress;
    case 'exiting_building':
      return 1 - ped.buildingEntryProgress;
    case 'inside_building':
      return 0;
    // Bus transit states
    case 'boarding_bus':
      return 1 - ped.buildingEntryProgress; // Fade out as they board
    case 'alighting_bus':
      return 1 - ped.buildingEntryProgress; // Fade in as they exit (progress goes 1→0)
    case 'riding_bus':
      return 0; // Invisible while riding
    default:
      return 1;
  }
}

// ============================================================================
// Beach/Swimming Functions
// ============================================================================

/**
 * Beach tile info with edge direction
 */
export type BeachTileInfo = {
  waterX: number;      // Water tile X
  waterY: number;      // Water tile Y
  landX: number;       // Adjacent land tile X
  landY: number;       // Adjacent land tile Y
  edge: 'north' | 'east' | 'south' | 'west'; // Which edge of water tile faces land
};

/**
 * Find all beach tiles (water tiles with adjacent land, excluding marinas/piers)
 */
export function findBeachTiles(
  grid: Tile[][],
  gridSize: number
): BeachTileInfo[] {
  const beachTiles: BeachTileInfo[] = [];

  // Marina/pier building types to exclude
  const marinaPierTypes: BuildingType[] = ['marina_docks_small', 'pier_large'];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile || tile.building.type !== 'water') continue;

      // Check each adjacent tile for land
      const adjacentChecks: { dx: number; dy: number; edge: 'north' | 'east' | 'south' | 'west' }[] = [
        { dx: -1, dy: 0, edge: 'north' },
        { dx: 0, dy: -1, edge: 'east' },
        { dx: 1, dy: 0, edge: 'south' },
        { dx: 0, dy: 1, edge: 'west' },
      ];

      for (const check of adjacentChecks) {
        const adjX = x + check.dx;
        const adjY = y + check.dy;

        // Check bounds
        if (adjX < 0 || adjX >= gridSize || adjY < 0 || adjY >= gridSize) continue;

        const adjTile = grid[adjY]?.[adjX];
        if (!adjTile) continue;

        // Is it land (not water) and not a marina/pier?
        if (adjTile.building.type !== 'water' &&
          !marinaPierTypes.includes(adjTile.building.type)) {
          beachTiles.push({
            waterX: x,
            waterY: y,
            landX: adjX,
            landY: adjY,
            edge: check.edge,
          });
        }
      }
    }
  }

  return beachTiles;
}

/**
 * Get a random beach tile from the list
 */
export function getRandomBeachTile(beachTiles: BeachTileInfo[]): BeachTileInfo | null {
  if (beachTiles.length === 0) return null;
  return beachTiles[Math.floor(Math.random() * beachTiles.length)];
}

/**
 * Spawn a pedestrian at the beach already swimming or on a mat
 */
export function spawnPedestrianAtBeach(
  id: number,
  beachInfo: BeachTileInfo,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  // Try to find a return path home — optional, beach-goers despawn if no path found when done
  const roadTile = findNearestRoadToBuilding(grid, gridSize, beachInfo.landX, beachInfo.landY);
  const returnPath = roadTile
    ? (findPathOnRoads(grid, gridSize, roadTile.x, roadTile.y, homeX, homeY) ?? [])
    : [];
  // createPedestrian needs at least one tile in path — use beach land tile as fallback start
  const path = returnPath.length > 0
    ? returnPath
    : [{ x: beachInfo.landX, y: beachInfo.landY }];

  const ped = createPedestrian(
    id,
    homeX,
    homeY,
    beachInfo.landX,  // Destination is the land tile they'll return to
    beachInfo.landY,
    'beach',
    path,
    0,
    'south'
  );

  // Decide activity: swimming or lying on mat
  const isSwimming = Math.random() < PEDESTRIAN_BEACH_SWIM_CHANCE;

  ped.state = 'at_beach';
  ped.activity = isSwimming ? 'beach_swimming' : 'lying_on_mat';
  ped.activityProgress = Math.random() * 0.3; // Already partway through
  ped.activityDuration = PEDESTRIAN_BEACH_MIN_TIME +
    Math.random() * (PEDESTRIAN_BEACH_MAX_TIME - PEDESTRIAN_BEACH_MIN_TIME);

  // Store beach tile info
  ped.beachTileX = beachInfo.waterX;
  ped.beachTileY = beachInfo.waterY;
  ped.beachEdge = beachInfo.edge;

  // Position based on activity
  if (isSwimming) {
    // Swimmers are in the water, slightly away from shore
    // Random position within the water tile but biased toward the beach edge
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x * 0.5; // Reduced randomness
    ped.activityOffsetY = offset.y * 0.5;
  } else {
    // Mat users are on the beach (on land tile)
    ped.hasBeachMat = true;
    // Position on the beach edge
    const offset = getRandomActivityOffset();
    ped.activityOffsetX = offset.x * 0.8;
    ped.activityOffsetY = offset.y * 0.4;
  }

  // Position at the beach water tile for swimmers, land tile for mat users
  if (isSwimming) {
    ped.tileX = beachInfo.waterX;
    ped.tileY = beachInfo.waterY;
  } else {
    ped.tileX = beachInfo.landX;
    ped.tileY = beachInfo.landY;
  }

  return ped;
}

/**
 * Check if a pedestrian is a beach-goer (for filtering in draw calls)
 */
export function isBeachPedestrian(ped: Pedestrian): boolean {
  return ped.state === 'at_beach';
}

/**
 * Spawn a subway commuter: Fussgänger läuft zur Eingangs-Station, fährt dann zur Ausgangs-Station.
 * stationX/Y = Eingangs-Station (Ziel des Fusswegs)
 */
export function spawnSubwayCommuter(
  id: number,
  stationX: number,
  stationY: number,
  grid: Tile[][],
  gridSize: number,
  homeX: number,
  homeY: number
): Pedestrian | null {
  // Nächste Strasse beim Haus finden → Startpunkt
  const startRoad = findNearestRoadToBuilding(grid, gridSize, homeX, homeY);
  if (!startRoad) return null;

  // Pfad von Haus zur Station
  const path = findPathOnRoads(grid, gridSize, startRoad.x, startRoad.y, stationX, stationY);
  if (!path || path.length === 0) return null;

  let direction: CarDirection = 'south';
  if (path.length > 1) {
    const dir = getDirectionToTile(path[0].x, path[0].y, path[1].x, path[1].y);
    if (dir) direction = dir;
  }

  return createPedestrian(id, homeX, homeY, stationX, stationY, 'commercial', path, 0, direction);
}
