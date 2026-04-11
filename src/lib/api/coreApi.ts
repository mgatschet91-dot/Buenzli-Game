/**
 * Core API Client für IsoCity Game
 * 
 * Alle Daten werden über die Core API gespeichert und geladen.
 */

// API Base URL (server-core). Falls nur Host angegeben ist, wird /api/game ergänzt.
function normalizeGameApiBaseUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  if (trimmed.endsWith('/api/game')) return trimmed;
  return `${trimmed}/api/game`;
}

const RAW_API_BASE_URL =
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'http://127.0.0.1:4100';

const API_BASE_URL = normalizeGameApiBaseUrl(RAW_API_BASE_URL);

// Types
export interface Municipality {
  id: number;
  name: string;
  slug: string;
  bfs_number: string;
  canton: string;
  canton_full: string;
  postal_code: string;
  is_city: boolean;
  is_canton_capital: boolean;
  language: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  owner: {
    id: number;
    nickname: string;
  } | null;
  coat_of_arms: {
    svg: string | null;
    image_url: string | null;
  } | null;
}

export interface GameStats {
  level: number;
  total_xp: number;
  xp_for_next_level: number;
  xp_progress: number;
  value: number;
  member_count: number;
  conquered_at: string | null;
  buildings: {
    total: number;
    by_type: Record<string, { count: number; total: number }>;
  };
  population: number;
  area_km2: number;
}

export interface GameResource {
  id: number;
  code: string;
  name: string;
  icon: string;
  type: string;
  canton: string | null;
  amount: number;
}

export interface GameBuilding {
  id: number;
  key: string;
  type: string;
  category: string;
  name: string;
  level: number;
  quantity: number;
  data: Record<string, unknown>;
  position: { x: number; y: number } | null;
  built_at: string | null;
  upgraded_at: string | null;
}

export interface GameMember {
  id: number;
  nickname: string;
  role: 'owner' | 'administrator' | 'member';
  xp_contributed: number;
  joined_at: string;
}

export interface GameQuest {
  id: number;
  name: string;
  description: string;
  icon: string;
  type: string;
  category: string;
  required_level: number;
  rewards: {
    xp: number;
    money: number;
    resources: Record<string, number> | null;
  };
  requirements: Array<{
    resource: {
      id: number;
      code: string;
      name: string;
      icon: string;
    };
    amount: number;
    source_type: string;
    is_optional: boolean;
  }>;
  status: {
    completed: boolean;
    can_repeat: boolean;
    available: boolean;
    prerequisite_met: boolean;
  };
}

export interface GameState {
  municipality: Municipality;
  stats: GameStats;
  resources: GameResource[];
  buildings: GameBuilding[];
  members: GameMember[];
  player: PlayerData | null;
  available_quests: GameQuest[];
}

export interface PlayerData {
  id: number;
  nickname: string;
  is_owner: boolean;
  membership: {
    role: string;
    xp_contributed: number;
    joined_at: string;
  } | null;
  resources: Array<{
    code: string;
    name: string;
    icon: string;
    amount: number;
  }>;
}

export interface Administration {
  owner: { id: number; nickname: string } | null;
  administrators: Array<{ id: number; nickname: string }>;
  member_count: number;
  administrator_count: number;
}

export interface MapData {
  municipality: Municipality;
  map: {
    geojson: unknown;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    } | null;
    center: {
      lat: number;
      lng: number;
    };
  };
  buildings: GameBuilding[];
  stats: GameStats;
  resources: GameResource[];
  administration?: Administration;
}

export interface CantonData {
  canton: {
    code: string;
    name: string;
    municipality_count: number;
  };
  stats: {
    total_xp: number;
    total_value: number;
    average_level: number;
    total_buildings: number;
    total_population: number;
  };
  municipalities: Array<{
    id: number;
    name: string;
    slug: string;
    bfs_number: string;
    is_capital: boolean;
    population: number;
    coordinates: { lat: number; lng: number };
    level: number;
    owner: { id: number; nickname: string } | null;
  }>;
}

export interface BuildingType {
  key: string;
  name: string;
  icon: string;
  base_cost: number;
}

export interface BuildingTypesCatalog {
  residential: BuildingType[];
  commercial: BuildingType[];
  industrial: BuildingType[];
  infrastructure: BuildingType[];
  public_service: BuildingType[];
  parks: BuildingType[];
  tourism: BuildingType[];
  special: BuildingType[];
}

export interface SwitzerlandStats {
  overview: {
    total_municipalities: number;
    total_xp: number;
    total_value: number;
    total_buildings: number;
    active_players: number;
  };
  cantons: Array<{
    code: string;
    name: string;
    stats: {
      total_xp: number;
      total_value: number;
      average_level: number;
      total_buildings: number;
      total_population: number;
    };
  }>;
}

// API Response type
interface ApiResponse<T> {
  /** Backend verwendet ok:true oder success:true — beide werden akzeptiert */
  ok?: boolean;
  success?: boolean;
  data?: T;
  error?: string;
}

// Error class with full details
export class CoreApiError extends Error {
  public readonly statusCode: number;
  public readonly url: string;
  public readonly details?: unknown;
  
  constructor(message: string, statusCode: number, url: string, details?: unknown) {
    super(message);
    this.name = 'CoreApiError';
    this.statusCode = statusCode;
    this.url = url;
    this.details = details;
  }
}

/** @deprecated Use CoreApiError instead */
export const LaravelApiError = CoreApiError;
/** @deprecated Use CoreApiError instead */
export type LaravelApiError = CoreApiError;

export const ApiError = CoreApiError;
export type ApiError = CoreApiError;

/**
 * Generic fetch wrapper with error handling
 * Automatically includes auth token if available
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  // Token aus localStorage holen (client-side only)
  const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Auth-Token automatisch hinzufügen wenn vorhanden
        ...(token && { 'X-Game-Token': token }),
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new CoreApiError(
        errorData.error || errorData.message || `API Error: ${response.status}`,
        response.status,
        url,
        errorData
      );
    }
    
    const json: ApiResponse<T> = await response.json();
    
    // Backend gibt entweder ok:true oder success:true zurück
    if (!json.ok && !json.success) {
      throw new CoreApiError(json.error || 'Unknown error', 400, url);
    }
    
    return json.data as T;
  } catch (error) {
    if (error instanceof CoreApiError) {
      throw error;
    }
    throw new CoreApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      url
    );
  }
}

// ==========================================
// PUBLIC API FUNCTIONS
// ==========================================

/**
 * Lade Gebäude-Typen Katalog
 */
export async function getBuildingTypes(): Promise<BuildingTypesCatalog> {
  return apiFetch<BuildingTypesCatalog>('/building-types');
}

/**
 * Lade Schweiz-Übersicht
 */
export async function getSwitzerlandStats(): Promise<SwitzerlandStats> {
  try {
    return await apiFetch<SwitzerlandStats>('/switzerland');
  } catch (error) {
    if (error instanceof CoreApiError && error.statusCode === 404) {
      return {
        overview: {
          total_municipalities: 0,
          total_xp: 0,
          total_value: 0,
          total_buildings: 0,
          active_players: 0,
        },
        cantons: [],
      };
    }
    throw error;
  }
}

/**
 * Lade Kanton mit allen Gemeinden
 */
export async function getCantonData(cantonCode: string): Promise<CantonData> {
  try {
    return await apiFetch<CantonData>(`/canton/${cantonCode.toUpperCase()}`);
  } catch (error) {
    if (error instanceof CoreApiError && error.statusCode === 404) {
      return {
        canton: {
          code: cantonCode.toUpperCase(),
          name: cantonCode.toUpperCase(),
          municipality_count: 0,
        },
        stats: {
          total_xp: 0,
          total_value: 0,
          average_level: 0,
          total_buildings: 0,
          total_population: 0,
        },
        municipalities: [],
      };
    }
    throw error;
  }
}

// ==========================================
// MUNICIPALITY API FUNCTIONS
// ==========================================

/**
 * Lade Map-Daten für eine Gemeinde
 */
export async function getMapData(municipalitySlug: string): Promise<MapData> {
  return apiFetch<MapData>(`/municipality/${municipalitySlug}/map`);
}

/**
 * Lade vollständigen Spielstatus
 */
export async function getGameState(municipalitySlug: string): Promise<GameState> {
  return apiFetch<GameState>(`/municipality/${municipalitySlug}/state`);
}

/**
 * Lade Statistiken
 */
export async function getStats(municipalitySlug: string): Promise<GameStats> {
  return apiFetch<GameStats>(`/municipality/${municipalitySlug}/stats`);
}

/**
 * Lade Ressourcen
 */
export async function getResources(municipalitySlug: string): Promise<GameResource[]> {
  return apiFetch<GameResource[]>(`/municipality/${municipalitySlug}/resources`);
}

/**
 * Lade Gebäude
 */
export async function getBuildings(municipalitySlug: string): Promise<GameBuilding[]> {
  return apiFetch<GameBuilding[]>(`/municipality/${municipalitySlug}/buildings`);
}

/**
 * Lade Gebäude gruppiert nach Kategorie
 */
export async function getBuildingsGrouped(municipalitySlug: string): Promise<Array<{
  category: string;
  count: number;
  total_quantity: number;
  buildings: GameBuilding[];
}>> {
  return apiFetch(`/municipality/${municipalitySlug}/buildings/grouped`);
}

/**
 * Lade Mitglieder
 */
export async function getMembers(municipalitySlug: string): Promise<GameMember[]> {
  return apiFetch<GameMember[]>(`/municipality/${municipalitySlug}/members`);
}

/**
 * Lade verfügbare Quests
 */
export async function getQuests(municipalitySlug: string): Promise<GameQuest[]> {
  return apiFetch<GameQuest[]>(`/municipality/${municipalitySlug}/quests`);
}

/**
 * Lade abgeschlossene Quests
 */
export async function getCompletedQuests(municipalitySlug: string): Promise<Array<{
  quest: {
    id: number;
    name: string;
    icon: string;
    type: string;
    category: string;
  };
  completed_by: {
    id: number;
    nickname: string;
  };
  completed_at: string;
}>> {
  return apiFetch(`/municipality/${municipalitySlug}/quests/completed`);
}

/**
 * Lade Spieler-Daten
 */
export async function getPlayerData(municipalitySlug: string): Promise<PlayerData> {
  return apiFetch<PlayerData>(`/municipality/${municipalitySlug}/player`);
}

// ==========================================
// GAME ROOM FUNCTIONS (für Multiplayer/Speicherung)
// ==========================================

export interface GameRoom {
  room_code: string;
  municipality_slug: string;
  city_name: string;
  game_state: string; // Compressed JSON
  player_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Erstelle einen neuen Spielraum
 */
export async function createGameRoom(
  municipalitySlug: string,
  roomCode: string,
  cityName: string,
  gameState: string
): Promise<GameRoom> {
  return apiFetch<GameRoom>(`/municipality/${municipalitySlug}/rooms`, {
    method: 'POST',
    body: JSON.stringify({
      room_code: roomCode,
      city_name: cityName,
      game_state: gameState,
    }),
  });
}

/**
 * Lade einen Spielraum
 */
export async function loadGameRoom(
  municipalitySlug: string,
  roomCode: string
): Promise<GameRoom | null> {
  try {
    return await apiFetch<GameRoom>(`/municipality/${municipalitySlug}/rooms/${roomCode}`);
  } catch (error) {
    if (error instanceof CoreApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Update Spielraum
 */
export async function updateGameRoom(
  municipalitySlug: string,
  roomCode: string,
  gameState: string
): Promise<boolean> {
  try {
    await apiFetch(`/municipality/${municipalitySlug}/rooms/${roomCode}`, {
      method: 'PUT',
      body: JSON.stringify({ game_state: gameState }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prüfe ob Raum existiert
 */
export async function roomExists(
  municipalitySlug: string,
  roomCode: string
): Promise<boolean> {
  try {
    await apiFetch(`/municipality/${municipalitySlug}/rooms/${roomCode}/exists`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update Spieleranzahl
 */
export async function updatePlayerCount(
  municipalitySlug: string,
  roomCode: string,
  count: number
): Promise<void> {
  try {
    await apiFetch(`/municipality/${municipalitySlug}/rooms/${roomCode}/players`, {
      method: 'PATCH',
      body: JSON.stringify({ player_count: count }),
    });
  } catch {
    // Silently fail - player count is not critical
  }
}

// ==========================================
// SERVER-SEITIGE SPEICHERUNG (Sichere Endpunkte)
// ==========================================

export interface SaveResult {
  success: boolean;
  room_code: string;
  buildings_synced: number;
  updated_at: string;
}

export interface AutoSaveResult {
  saved: boolean;
  reason?: string;
  updated_at?: string;
}

export interface BuildActionResult {
  success: boolean;
  action: string;
  tool: string;
  position: { x: number; y: number };
}

/**
 * Speichere Spielstand sicher über den Server
 * 
 * Der Server validiert den Spielstand und synchronisiert
 * Gebäude mit dem Municipality Inventory.
 */
export async function saveGameStateSecure(
  municipalitySlug: string,
  roomCode: string,
  gameState: string,
  cityName?: string
): Promise<SaveResult> {
  return apiFetch<SaveResult>(`/municipality/${municipalitySlug}/save`, {
    method: 'POST',
    body: JSON.stringify({
      room_code: roomCode,
      game_state: gameState,
      city_name: cityName,
    }),
  });
}

/**
 * Lade Spielstand vom Server
 */
export async function loadGameStateSecure(
  municipalitySlug: string,
  roomCode: string
): Promise<GameRoom | null> {
  try {
    return await apiFetch<GameRoom>(`/municipality/${municipalitySlug}/load/${roomCode}`);
  } catch (error) {
    if (error instanceof CoreApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Auto-Save: Leichtgewichtiger periodischer Save
 * 
 * Nutzt optional einen Checksum um unnötige Saves zu vermeiden.
 */
export async function autoSave(
  municipalitySlug: string,
  roomCode: string,
  gameState: string,
  checksum?: string
): Promise<AutoSaveResult> {
  return apiFetch<AutoSaveResult>(`/municipality/${municipalitySlug}/autosave`, {
    method: 'POST',
    body: JSON.stringify({
      room_code: roomCode,
      game_state: gameState,
      checksum: checksum,
    }),
  });
}

/**
 * Verarbeite eine Bau-Aktion serverseitig
 * 
 * Jede Bau-Aktion wird vom Server validiert.
 */
export async function processBuildAction(
  municipalitySlug: string,
  roomCode: string,
  tool: string,
  x: number,
  y: number
): Promise<BuildActionResult> {
  return apiFetch<BuildActionResult>(`/municipality/${municipalitySlug}/action/build`, {
    method: 'POST',
    body: JSON.stringify({
      room_code: roomCode,
      tool: tool,
      x: x,
      y: y,
    }),
  });
}

/**
 * Verarbeite mehrere Aktionen als Batch
 */
export async function processBatchActions(
  municipalitySlug: string,
  roomCode: string,
  actions: Array<{
    type: 'build' | 'bulldoze';
    tool?: string;
    x: number;
    y: number;
  }>
): Promise<{ processed: number; results: BuildActionResult[] }> {
  return apiFetch(`/municipality/${municipalitySlug}/action/batch`, {
    method: 'POST',
    body: JSON.stringify({
      room_code: roomCode,
      actions: actions,
    }),
  });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Prüfe ob API erreichbar ist
 */
export async function checkApiConnection(): Promise<boolean> {
  try {
    await getBuildingTypes();
    return true;
  } catch {
    return false;
  }
}

/**
 * Setze Auth Token für authentifizierte Requests
 */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Gibt den aktuellen Backend-Typ zurück
 */
/**
 * Gibt die API Base URL zurück
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getBackendType(): 'core' | 'supabase' {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return (supabaseUrl && supabaseKey) ? 'supabase' : 'core';
}

// Export default object for convenience
export default {
  getBuildingTypes,
  getSwitzerlandStats,
  getCantonData,
  getMapData,
  getGameState,
  getStats,
  getResources,
  getBuildings,
  getBuildingsGrouped,
  getMembers,
  getQuests,
  getCompletedQuests,
  getPlayerData,
  createGameRoom,
  loadGameRoom,
  updateGameRoom,
  roomExists,
  updatePlayerCount,
  checkApiConnection,
  setAuthToken,
  getAuthToken,
};
