/**
 * Delta Sync System für Multiplayer
 * 
 * Statt den kompletten Spielstand zu speichern, werden nur Änderungen (Deltas)
 * gesammelt und an den Server gesendet. Der Server wendet diese auf den
 * gespeicherten State an und löst Konflikte.
 * 
 * Vorteile:
 * - Weniger Datenübertragung (~99% weniger)
 * - Keine Überschreibung bei gleichzeitigem Bauen
 * - Änderungshistorie möglich
 */

import { Tool } from '@/types/game';
import { io, Socket } from 'socket.io-client';
import type { AvatarAppearanceConfig } from '@/lib/avatarConfig';
import { updateFromRepairQueue, setHasWerkhofNpc } from '@/lib/werkhofConditionStore';

export type ParkedVehicle    = { tileX: number; tileY: number; slot: number; color: string };
export type ParkingConfig    = { tileX: number; tileY: number; isFree: boolean; feeRate: number };
export type ParkingViolation = { tileX: number; tileY: number; slot: number; status: 'unpaid' | 'fined' };
export type ParkingFineEvent = { tileX: number; tileY: number; slot: number; fineAmount: number; companyName: string; communeShare: number; companyShare: number };

// WebSocket Server URL
const WS_SERVER_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://127.0.0.1:4100';
// Standard: Echtzeit strikt über WebSocket. Fallbacks nur wenn explizit aktiviert.
const ALLOW_HTTP_REALTIME_FALLBACK =
  process.env.NEXT_PUBLIC_ALLOW_HTTP_REALTIME_FALLBACK === 'true';

// ==========================================
// DEBUG KONFIGURATION
// ==========================================

// Debug-Modus: Aktiviere mit localStorage.setItem('DELTA_SYNC_DEBUG', 'true')
const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('DELTA_SYNC_DEBUG') === 'true';
};

// Farbige Console-Ausgabe für bessere Lesbarkeit + Event-Emission
const debugLog = {
  info: (msg: string, ...args: unknown[]) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('info', msg, args[0]);
    
    if (!isDebugEnabled()) return;
    console.log(
      `%c[DeltaSync] %c${msg}`,
      'color: #3b82f6; font-weight: bold',
      'color: #64748b',
      ...args
    );
  },
  action: (type: string, details: Record<string, unknown>) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('action', `⚡ ${type}`, details);
    
    if (!isDebugEnabled()) return;
    console.log(
      `%c[DeltaSync] %c⚡ ${type}`,
      'color: #3b82f6; font-weight: bold',
      'color: #22c55e; font-weight: bold',
      details
    );
  },
  send: (count: number, batch: unknown) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('send', `📤 Sende ${count} Delta(s)`, batch);
    
    if (!isDebugEnabled()) return;
    console.group(
      `%c[DeltaSync] %c📤 Sende ${count} Delta(s)`,
      'color: #3b82f6; font-weight: bold',
      'color: #f59e0b; font-weight: bold'
    );
    console.log('Batch:', batch);
    console.groupEnd();
  },
  receive: (count: number, deltas: unknown) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('receive', `📥 Empfange ${count} Delta(s) von anderen`, deltas);
    
    if (!isDebugEnabled()) return;
    console.group(
      `%c[DeltaSync] %c📥 Empfange ${count} Delta(s) von anderen Spielern`,
      'color: #3b82f6; font-weight: bold',
      'color: #8b5cf6; font-weight: bold'
    );
    console.log('Deltas:', deltas);
    console.groupEnd();
  },
  success: (msg: string, data?: unknown) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('info', `✅ ${msg}`, data);
    
    if (!isDebugEnabled()) return;
    console.log(
      `%c[DeltaSync] %c✅ ${msg}`,
      'color: #3b82f6; font-weight: bold',
      'color: #22c55e',
      data ?? ''
    );
  },
  conflict: (conflicts: unknown[]) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('error', `⚠️ ${conflicts.length} Konflikt(e)`, conflicts);
    
    if (!isDebugEnabled()) return;
    console.group(
      `%c[DeltaSync] %c⚠️ ${conflicts.length} Konflikt(e)`,
      'color: #3b82f6; font-weight: bold',
      'color: #ef4444; font-weight: bold'
    );
    conflicts.forEach((c, i) => console.log(`Konflikt ${i + 1}:`, c));
    console.groupEnd();
  },
  error: (msg: string, err?: unknown) => {
    // Immer Event emittieren (für Debug Panel)
    emitLogEvent('error', `❌ ${msg}`, err);
    
    console.error(
      `%c[DeltaSync] %c❌ ${msg}`,
      'color: #3b82f6; font-weight: bold',
      'color: #ef4444',
      err ?? ''
    );
  },
  status: () => {
    if (!isDebugEnabled()) return;
    const queue = deltaQueue;
    console.log(
      `%c[DeltaSync] %c📊 Status: ${queue.pendingCount} ausstehend, Client: ${queue.id}`,
      'color: #3b82f6; font-weight: bold',
      'color: #64748b'
    );
  },
};

// Event-System für Debug-Panel Integration
type DeltaSyncLogEvent = {
  time: string;
  type: 'send' | 'receive' | 'action' | 'error' | 'info';
  message: string;
  data?: unknown;
};

type DeltaSyncEventListener = (event: DeltaSyncLogEvent) => void;
const eventListeners: DeltaSyncEventListener[] = [];

export function addDeltaSyncLogListener(listener: DeltaSyncEventListener): () => void {
  eventListeners.push(listener);
  return () => {
    const index = eventListeners.indexOf(listener);
    if (index > -1) eventListeners.splice(index, 1);
  };
}

function emitLogEvent(type: DeltaSyncLogEvent['type'], message: string, data?: unknown) {
  const event: DeltaSyncLogEvent = {
    time: new Date().toLocaleTimeString('de-CH'),
    type,
    message,
    data,
  };
  eventListeners.forEach(listener => listener(event));
}

// Globale Funktion zum Aktivieren/Deaktivieren des Debug-Modus
if (typeof window !== 'undefined') {
  (window as unknown as { enableDeltaSyncDebug: () => void }).enableDeltaSyncDebug = () => {
    localStorage.setItem('DELTA_SYNC_DEBUG', 'true');
    console.log('%c[DeltaSync] Debug-Modus AKTIVIERT', 'color: #22c55e; font-weight: bold');
    console.log('Deaktivieren mit: disableDeltaSyncDebug()');
  };
  (window as unknown as { disableDeltaSyncDebug: () => void }).disableDeltaSyncDebug = () => {
    localStorage.removeItem('DELTA_SYNC_DEBUG');
    console.log('%c[DeltaSync] Debug-Modus DEAKTIVIERT', 'color: #ef4444; font-weight: bold');
  };
  (window as unknown as { deltaSyncStatus: () => void }).deltaSyncStatus = () => {
    debugLog.status();
  };
}

// ==========================================
// TYPES
// ==========================================

export type DeltaAction = 
  | {
      type: 'place';
      tool: Tool;
      x: number;
      y: number;
      metadata?: {
        footprintWidth?: number;
        footprintHeight?: number;
        [key: string]: unknown;
      };
      timestamp: number;
      playerId?: string;
    }
  | { type: 'bulldoze'; x: number; y: number; timestamp: number; playerId?: string }
  | { type: 'zone'; zone: 'residential' | 'commercial' | 'industrial' | 'none'; x: number; y: number; timestamp: number; playerId?: string }
  | { type: 'bauzone'; x: number; y: number; enabled: boolean; timestamp: number; playerId?: string }
  | { type: 'metadata_update'; x: number; y: number; metadata: Record<string, unknown>; timestamp: number; playerId?: string }
  | { type: 'stats_update'; timestamp: number; playerId?: string } & Partial<GameStatsData>;

export type DeltaActionInput =
  | { type: 'place'; tool: Tool; x: number; y: number; metadata?: { footprintWidth?: number; footprintHeight?: number; [key: string]: unknown } }
  | { type: 'bulldoze'; x: number; y: number }
  | { type: 'zone'; zone: 'residential' | 'commercial' | 'industrial' | 'none'; x: number; y: number }
  | { type: 'bauzone'; x: number; y: number; enabled: boolean }
  | { type: 'metadata_update'; x: number; y: number; metadata: Record<string, unknown> }
  | ({ type: 'stats_update' } & Partial<GameStatsData>);

/**
 * Alle Spielstatistiken die synchronisiert werden können
 */
export interface GameStatsData {
  // Finanzen
  money: number;
  income: number;
  expenses: number;
  taxRate: number;
  
  // Bevölkerung
  population: number;
  maxPopulation: number;
  populationGrowth: number;
  homeless: number;
  
  // Arbeitsmarkt
  jobs: number;
  employed: number;
  unemployed: number;
  unemploymentRate: number;
  
  // Zufriedenheit
  happiness: number;
  happinessResidential: number;
  happinessCommercial: number;
  happinessIndustrial: number;
  
  // Qualität
  health: number;
  education: number;
  safety: number;
  environment: number;
  
  // Infrastruktur
  powerProduction: number;
  powerConsumption: number;
  waterProduction: number;
  waterConsumption: number;
  waterBalance: number;

  // Gebäude
  buildingsTotal: number;
  buildingsResidential: number;
  buildingsCommercial: number;
  buildingsIndustrial: number;
  buildingsInfrastructure: number;
  buildingsDecoration: number;
  
  // Zonen
  zonesResidential: number;
  zonesCommercial: number;
  zonesIndustrial: number;
  
  // Spielzeit
  tick: number;
  gameSpeed: number;
  playTimeSeconds: number;
  totalTaxCollected?: number;
  totalSpent?: number;

  // Verkehr
  trafficCongestion?: number;

  // Zusätzliche persistente Map-/UI-Daten
  gameMapData?: Record<string, unknown>;
}

export interface DisasterStateUpdate {
  x: number;
  y: number;
  on_fire?: boolean;
  fire_progress?: number;
  elevation?: number;
  removed?: boolean;
  abandoned?: boolean;
}

export interface BuildingStateUpdate {
  x: number;
  y: number;
  level?: number;
  abandoned?: boolean;
  buildingType?: string;
  constructionProgress?: number;
  constructed?: boolean;
}

export interface CriminalNpcState {
  id: number;
  x: number;
  y: number;
  state: 'loitering' | 'dealing' | 'burglary' | 'fleeing';
  isDealer: boolean;
  beingChased: boolean;
  policeX: number | null;
  policeY: number | null;
  ticksAlive: number;
}

export interface CrimeEvent {
  type: 'spawn' | 'despawn' | 'chase_start' | 'caught';
  id: number;
  x: number;
  y: number;
  isDealer?: boolean;
  reason?: string;
  policeX?: number;
  policeY?: number;
  stolenTotal?: number;
}

export interface CrimeAuthoritativePayload {
  criminals: CriminalNpcState[];
  crimeEvents: CrimeEvent[];
  crimeGrid: number[] | null;
  gridSize: number;
  homeless: number;
  isNight: boolean;
  serverTimestamp: number;
}

export interface BuenzliNpcPayload {
  npcs: Array<{ id: number; x: number; y: number; eventType: string; severity: number; status: string; fixCost?: number }>;
}

export interface AvatarSyncState {
  id: string;
  ownerPlayerId: string;
  ownerName?: string;
  avatarConfig?: AvatarAppearanceConfig;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  path?: Array<{ x: number; y: number }>;
  updatedAt?: number;
}

export interface DeltaBatch {
  roomCode: string;
  municipalitySlug: string;
  deltas: DeltaAction[];
  clientVersion: number;  // Für Konfliktlösung
  clientId: string;       // Um eigene Deltas zu erkennen
}

export interface DeltaResponse {
  success: boolean;
  serverVersion: number;
  appliedDeltas: number;
  conflicts?: DeltaConflict[];
  rejectedDeltas?: Array<{
    type: string;
    x?: number;
    y?: number;
    tool?: string;
    reason?: string;
    required?: number;
    available?: number;
  }>;
  // Deltas von anderen Spielern die wir noch nicht haben
  newDeltas?: DeltaAction[];
}

export interface StatsUpdateAck {
  success: boolean;
  error?: string;
  debug?: {
    isViewOnly?: boolean;
    canSendStatsUpdates?: boolean;
    globalRole?: string;
  };
  data?: Record<string, unknown> | null;
}

export interface ConstructionSyncPosition {
  x: number;
  y: number;
  progress?: number;
  tool?: string;
  population?: number;
  jobs?: number;
  abandoned?: boolean;
  on_fire?: boolean;
  fire_progress?: number;
  level?: number;
  footprint_width?: number;
  footprint_height?: number;
  removed?: boolean;
  upgrade_started_at?: number | null;
  upgrade_target_level?: number | null;
  planted_at?: number | null;
}

export interface ConstructionSyncResponse {
  updated: number;
  deleted: number;
  authoritativeStats?: Record<string, unknown> | null;
}

export interface DeltaConflict {
  delta: DeltaAction;
  reason: string;
  resolution: 'applied' | 'rejected' | 'merged';
}

// ==========================================
// DELTA QUEUE (Frontend)
// ==========================================

class DeltaQueue {
  private queue: DeltaAction[] = [];
  private clientId: string;
  private clientVersion: number = 0;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private flushCallback: ((batch: DeltaBatch) => Promise<DeltaResponse | null>) | null = null;
  private roomCode: string = '';
  private municipalitySlug: string = '';
  private isFlushing: boolean = false;
  private isPolling: boolean = false;
  
  // WebSocket für Echtzeit-Sync (bevorzugt)
  private wsSocket: Socket | null = null;
  private useWebSocket: boolean = true;
  
  // SSE als Fallback
  private sseEventSource: EventSource | null = null;
  private useSSE: boolean = false; // SSE nur als Fallback
  private sseReconnectAttempts: number = 0;
  private sseReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Callback für neue Deltas von anderen Spielern
  private onRemoteDeltas: ((deltas: DeltaAction[]) => void) | null = null;
  
  // Callback für Spieler-Updates (Echtzeit)
  private onPlayersUpdate: ((players: DeltaPlayer[]) => void) | null = null;
  
  // Callback für Stats-Updates von anderen Spielern
  private onStatsUpdate: ((stats: GameStatsData) => void) | null = null;
  // Callback für Verbindungsstatus (WebSocket)
  private onConnectionStatusChange: ((connected: boolean, reason?: string) => void) | null = null;
  
  // Callback für server-autoritative Katastrophenupdates
  private onDisasterUpdate: ((changes: DisasterStateUpdate[]) => void) | null = null;

  // Callback für server-autoritative Gebäude-Upgrades (Level, Abandoned)
  private onBuildingUpdate: ((changes: BuildingStateUpdate[]) => void) | null = null;

  // Callback für server-autoritative LandValue-Grid Updates
  private onLandValueUpdate: ((data: { gridSize: number; values: number[] }) => void) | null = null;

  // Callback für server-autoritative Crime/Kriminalitäts-Updates
  private onCrimeUpdate: ((data: CrimeAuthoritativePayload) => void) | null = null;

  // Callback für server-autoritative Büenzli-NPC-Updates
  private onBuenzliUpdate: ((payload: BuenzliNpcPayload) => void) | null = null;

  // Callback für Party-Events (Mansion-Parties)
  private onPartyUpdate: ((data: { parties: import('@/components/game/types').MansionParty[] }) => void) | null = null;
  private onPartyPoliceWarning: ((data: { partyId: number; tileX: number; tileY: number; warningNumber: number; fineAmount: number; isShutdown: boolean; ownerUserId: number }) => void) | null = null;

  // Callbacks für Parkplatz-Events
  onParkedVehiclesUpdate?: (vehicles: ParkedVehicle[]) => void;
  onVehicleParked?: (v: ParkedVehicle & { isViolation?: boolean }) => void;
  onVehicleLeftParking?: (v: { tileX: number; tileY: number; slot: number }) => void;
  onParkingConfigsUpdate?: (configs: ParkingConfig[]) => void;
  onParkingConfigUpdated?: (cfg: ParkingConfig) => void;
  onParkingViolationsUpdate?: (violations: ParkingViolation[]) => void;
  onParkingFineIssued?: (data: ParkingFineEvent) => void;

  // Callback für Partnership-Discovered Events (Gemeinde entdeckt)
  private onPartnershipDiscovered: ((data: { partnerSlug: string; partnerName: string; direction: string; playerId?: string }) => void) | null = null;
  
  // Callback für Partnership-Connected Events (Handelsroute etabliert)
  private onPartnershipConnected: ((data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number; playerId?: string }) => void) | null = null;

  // Callback für Avatar Snapshot (initialer Raumzustand)
  private onAvatarSnapshot: ((avatars: AvatarSyncState[]) => void) | null = null;
  // Callback für Avatar Updates (spawn/move)
  private onAvatarUpdated: ((avatar: AvatarSyncState) => void) | null = null;
  // Callback für Avatar Entfernen
  private onAvatarRemoved: ((avatarId: string) => void) | null = null;
  // Callback für Room-Chat Nachrichten (raum-lokaler Chat)
  private onRoomChat: ((data: { text: string; userName: string; playerId: string; timestamp: number }) => void) | null = null;

  constructor() {
    // Persistente Client-ID aus localStorage oder neu generieren
    this.clientId = this.getOrCreateClientId();
  }

  private getOrCreateClientId(): string {
    const STORAGE_KEY = 'meinort_client_id';
    
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingId = localStorage.getItem(STORAGE_KEY);
      if (existingId) {
        return existingId;
      }
      
      // Neue ID generieren und speichern
      const newId = this.generateRandomId();
      localStorage.setItem(STORAGE_KEY, newId);
      return newId;
    }
    
    return this.generateRandomId();
  }

  private generateRandomId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().substring(0, 8);
    }
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Initialisiere die Queue für einen Raum
   * 
   * Das System funktioniert jetzt Server-basiert:
   * 1. Lokale Aktionen werden an den Server gesendet
   * 2. Server speichert UND gibt neue Deltas von anderen zurück
   * 3. Zusätzliches Polling holt verpasste Deltas
   */
  // Spielername für WebSocket
  private playerName: string = 'Spieler';
  // Ist dieser Spieler nur ein Besucher (view-only)?
  private isViewOnly: boolean = false;
  // Darf dieser Client serverseitig Stats-Updates senden?
  private canSendStatsUpdatesFlag: boolean = false;
  
  init(
    roomCode: string,
    municipalitySlug: string,
    flushCallback: (batch: DeltaBatch) => Promise<DeltaResponse | null>,
    onRemoteDeltas?: (deltas: DeltaAction[]) => void,
    onPlayersUpdate?: (players: DeltaPlayer[]) => void,
    playerName?: string,
    onStatsUpdate?: (stats: GameStatsData) => void,
    isViewOnly?: boolean
  ): void {
    this.roomCode = roomCode;
    this.municipalitySlug = municipalitySlug;
    this.flushCallback = flushCallback;
    this.onRemoteDeltas = onRemoteDeltas || null;
    this.onPlayersUpdate = onPlayersUpdate || null;
    this.playerName = playerName || 'Spieler';
    this.onStatsUpdate = onStatsUpdate || null;
    this.isViewOnly = isViewOnly || false;
    this.canSendStatsUpdatesFlag = !this.isViewOnly;
    
    console.log('[DeltaQueue] 🚀 INIT:', {
      roomCode,
      municipalitySlug,
      clientId: this.clientId,
      playerName: this.playerName,
      hasFlushCallback: !!flushCallback,
      hasRemoteDeltasCallback: !!onRemoteDeltas,
    });
    
    debugLog.info(`Initialisiert für Raum ${roomCode}`, {
      municipalitySlug,
      clientId: this.clientId,
    });
    
    // Starte Auto-Flush alle 500ms (schneller für bessere Reaktionszeit)
    this.startAutoFlush(500);
    
    // Versuche WebSocket zuerst (am schnellsten!)
    if (this.useWebSocket) {
      this.connectWebSocket();
    } else if (this.useSSE && typeof EventSource !== 'undefined' && ALLOW_HTTP_REALTIME_FALLBACK) {
      // SSE als Fallback
      this.connectSSE();
    } else if (ALLOW_HTTP_REALTIME_FALLBACK) {
      // Letzter Fallback: Polling
      this.startPolling(800);
    } else {
      emitLogEvent('error', '❌ Kein WebSocket aktiv (HTTP-Fallback deaktiviert)');
    }
    
    const mode = this.useWebSocket ? 'WebSocket' : this.useSSE ? 'SSE' : 'Polling';
    console.log('[DeltaQueue] ✅ Initialisiert, Modus:', mode);
  }
  
  /**
   * WebSocket-Verbindung für Echtzeit-Sync (schnellste Option!)
   */
  private connectWebSocket(): void {
    if (this.wsSocket?.connected) {
      console.log('[DeltaQueue] WebSocket bereits verbunden');
      return;
    }

    console.log('[DeltaQueue] 🔌 WebSocket verbinden:', WS_SERVER_URL);
    emitLogEvent('info', `🔌 WebSocket verbinden zu ${WS_SERVER_URL}`);

    try {
      this.wsSocket = io(WS_SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      // Verbindung hergestellt
      this.wsSocket.on('connect', () => {
        console.log('[DeltaQueue] ✅ WebSocket verbunden:', this.wsSocket?.id);
        emitLogEvent('info', '✅ WebSocket verbunden');

        // WICHTIG: Polling stoppen wenn WebSocket verbunden!
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
          console.log('[DeltaQueue] 🛑 Polling gestoppt (WebSocket aktiv)');
        }

        // Raum beitreten mit Spielername und Besucher-Status
        this.wsSocket?.emit('join-room', {
          roomCode: this.roomCode,
          municipalitySlug: this.municipalitySlug,
          clientId: this.clientId,
          name: this.playerName,
          isViewOnly: this.isViewOnly,
          authToken: typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null,
        });
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(true);
        }
      });

      // Raum beigetreten
      this.wsSocket.on('room-joined', (data) => {
        console.log('[DeltaQueue] 🏠 Raum beigetreten:', data);
        emitLogEvent('info', `🏠 Raum beigetreten (${data.playerCount} Spieler)`);
        this.canSendStatsUpdatesFlag = typeof data?.canSendStatsUpdates === 'boolean'
          ? data.canSendStatsUpdates
          : !this.isViewOnly;
        // Autoritative Stats aktiv beim Server anfordern (Quelle: game_stats)
        this.wsSocket?.emit('stats-request');
      });

      // Delta empfangen (einzeln)
      this.wsSocket.on('delta', (delta: DeltaAction) => {
        console.log('[DeltaQueue] 📥 WS Delta:', delta.type);
        debugLog.receive(1, [{ type: delta.type, playerId: delta.playerId }]);
        
        if (this.onRemoteDeltas) {
          this.onRemoteDeltas([delta]);
        }
      });

      // Deltas empfangen (batch)
      this.wsSocket.on('deltas', (deltas: DeltaAction[]) => {
        console.log('[DeltaQueue] 📥 WS Deltas:', deltas.length);
        debugLog.receive(deltas.length, deltas.map(d => ({ type: d.type, playerId: d.playerId })));
        
        if (this.onRemoteDeltas) {
          this.onRemoteDeltas(deltas);
        }
      });

      // Spieler beigetreten
      this.wsSocket.on('player-joined', (data) => {
        console.log('[DeltaQueue] 👋 Spieler beigetreten:', data.playerName);
        emitLogEvent('info', `👋 ${data.playerName} ist beigetreten (${data.playerCount} Spieler)`);
      });

      // Spieler verlassen
      this.wsSocket.on('player-left', (data) => {
        console.log('[DeltaQueue] 👋 Spieler verlassen:', data.playerName);
        emitLogEvent('info', `👋 ${data.playerName} hat verlassen (${data.playerCount} Spieler)`);
      });

      // Spielerliste vom Server empfangen
      this.wsSocket.on('players-list', (data: { players: Array<{id: string; name: string}>; count: number }) => {
        console.log('[DeltaQueue] 👥 Spielerliste aktualisiert:', data.count, 'Spieler');
        
        // Spieler mit isLocal-Flag versehen
        const playerArr = Array.isArray(data.players) ? data.players : [];
        const playersWithLocal = playerArr.map(p => ({
          ...p,
          isLocal: p.id === this.clientId,
        }));
        
        if (this.onPlayersUpdate) {
          this.onPlayersUpdate(playersWithLocal);
        }
      });

      // Stats-Update von anderem Spieler empfangen
      this.wsSocket.on('stats-update', (stats: GameStatsData & { playerId?: string }) => {
        if (this.onStatsUpdate) {
          this.onStatsUpdate(stats);
        }
      });

      // Autoritative Server-Stats empfangen (Server bestimmt den Stand)
      this.wsSocket.on('stats-authoritative', (stats: GameStatsData & { revision?: number; serverTimestamp?: number }) => {
        if (this.onStatsUpdate) {
          this.onStatsUpdate(stats);
        }
      });

      this.wsSocket.on(
        'disasters-authoritative',
        (payload: {
          changes?: DisasterStateUpdate[];
          serverTimestamp?: number;
          disasterType?: string;
          intensity?: number;
          impactX?: number;
          impactY?: number;
          impactRadius?: number;
        }) => {
          const disasterType = String(payload?.disasterType || '').trim().toLowerCase();
          const rawIntensity = Number(payload?.intensity);
          const intensity = Number.isFinite(rawIntensity)
            ? Math.max(1, Math.min(5, Math.round(rawIntensity)))
            : 3;
          if (disasterType === 'earthquake' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('isocity-earthquake-shake', {
              detail: {
                intensity,
                serverTimestamp: payload?.serverTimestamp ?? Date.now(),
              },
            }));
          }
          if (disasterType === 'fire_storm' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('isocity-firestorm-wave', {
              detail: {
                intensity,
                serverTimestamp: payload?.serverTimestamp ?? Date.now(),
              },
            }));
          }
          if (disasterType === 'meteor' && typeof window !== 'undefined') {
            const rawImpactX = Number(payload?.impactX);
            const rawImpactY = Number(payload?.impactY);
            const rawImpactRadius = Number(payload?.impactRadius);
            window.dispatchEvent(new CustomEvent('isocity-meteor-impact', {
              detail: {
                intensity,
                impactX: Number.isFinite(rawImpactX) ? Math.max(0, Math.round(rawImpactX)) : null,
                impactY: Number.isFinite(rawImpactY) ? Math.max(0, Math.round(rawImpactY)) : null,
                impactRadius: Number.isFinite(rawImpactRadius) ? Math.max(1, Math.round(rawImpactRadius)) : null,
                serverTimestamp: payload?.serverTimestamp ?? Date.now(),
              },
            }));
          }
          const changes = Array.isArray(payload?.changes) ? payload.changes : [];
          if (changes.length === 0) return;
          if (this.onDisasterUpdate) {
            this.onDisasterUpdate(changes);
          }
        }
      );

      // Server-autoritative Gebäude-Upgrades (Level, Abandoned-Status)
      this.wsSocket.on(
        'buildings-authoritative',
        (payload: { changes?: BuildingStateUpdate[]; serverTimestamp?: number }) => {
          const changes = Array.isArray(payload?.changes) ? payload.changes : [];
          if (changes.length === 0) return;
          console.log('[DeltaQueue] 🏗️ Building-Upgrades empfangen:', changes.length);
          emitLogEvent('receive', `🏗️ ${changes.length} Gebäude-Updates vom Server`);
          if (this.onBuildingUpdate) {
            this.onBuildingUpdate(changes);
          }
        }
      );

      // Server-autoritatives LandValue-Grid
      this.wsSocket.on(
        'landvalue-authoritative',
        (payload: { gridSize?: number; values?: number[]; serverTimestamp?: number }) => {
          const gridSize = Number(payload?.gridSize || 0);
          const values = Array.isArray(payload?.values) ? payload.values : [];
          if (gridSize <= 0 || values.length !== gridSize * gridSize) return;
          if (this.onLandValueUpdate) {
            this.onLandValueUpdate({ gridSize, values });
          }
        }
      );

      // Server-autoritative Crime/Kriminalitäts-Updates
      this.wsSocket.on(
        'criminals-authoritative',
        (payload: CrimeAuthoritativePayload) => {
          const criminals = Array.isArray(payload?.criminals) ? payload.criminals : [];
          const crimeEvents = Array.isArray(payload?.crimeEvents) ? payload.crimeEvents : [];
          if (criminals.length === 0 && crimeEvents.length === 0) return;
          if (crimeEvents.length > 0) {
            console.log('[DeltaQueue] 🔫 Crime-Events empfangen:', crimeEvents.length, 'Gangster aktiv:', criminals.length);
          }
          if (this.onCrimeUpdate) {
            this.onCrimeUpdate(payload);
          }
        }
      );

      // Server-autoritative Büenzli-NPC-Updates
      this.wsSocket.on(
        'buenzli-npc-authoritative',
        (payload: BuenzliNpcPayload) => {
          if (this.onBuenzliUpdate) {
            this.onBuenzliUpdate(payload);
          }
        }
      );

      // Mansion-Party State Updates
      this.wsSocket.on('party-authoritative', (payload: { parties: import('@/components/game/types').MansionParty[] }) => {
        if (this.onPartyUpdate) {
          this.onPartyUpdate(payload);
        }
      });

      this.wsSocket.on('party-police-warning', (payload: { partyId: number; tileX: number; tileY: number; warningNumber: number; fineAmount: number; isShutdown: boolean; ownerUserId: number }) => {
        if (this.onPartyPoliceWarning) {
          this.onPartyPoliceWarning(payload);
        }
      });

      // Parked vehicles
      this.wsSocket.on('parked-vehicles', (payload: { vehicles: Array<{ tile_x: number; tile_y: number; slot: number; color: string }> }) => {
        if (this.onParkedVehiclesUpdate) {
          const vehicles: ParkedVehicle[] = (payload.vehicles || []).map(v => ({
            tileX: v.tile_x,
            tileY: v.tile_y,
            slot: v.slot,
            color: v.color,
          }));
          this.onParkedVehiclesUpdate(vehicles);
        }
      });
      this.wsSocket.on('vehicle-parked', (v: { tileX: number; tileY: number; slot: number; color: string; isViolation?: boolean }) => {
        if (this.onVehicleParked) this.onVehicleParked(v);
      });
      this.wsSocket.on('vehicle-left-parking', (v: { tileX: number; tileY: number; slot: number }) => {
        if (this.onVehicleLeftParking) this.onVehicleLeftParking(v);
      });

      // Parking config
      this.wsSocket.on('parking-configs', (payload: { configs: Array<{ tile_x: number; tile_y: number; is_free: number; fee_rate: number }> }) => {
        if (this.onParkingConfigsUpdate) {
          this.onParkingConfigsUpdate((payload.configs || []).map(c => ({
            tileX: c.tile_x, tileY: c.tile_y, isFree: Boolean(c.is_free), feeRate: Number(c.fee_rate),
          })));
        }
      });
      this.wsSocket.on('parking-config-updated', (c: { tileX: number; tileY: number; isFree: boolean; feeRate: number }) => {
        if (this.onParkingConfigUpdated) this.onParkingConfigUpdated(c);
      });

      // Parking violations
      this.wsSocket.on('parking-violations', (payload: { violations: Array<{ tile_x: number; tile_y: number; slot: number; status: string }> }) => {
        if (this.onParkingViolationsUpdate) {
          this.onParkingViolationsUpdate((payload.violations || []).map(v => ({
            tileX: v.tile_x ?? (v as unknown as ParkingViolation).tileX,
            tileY: v.tile_y ?? (v as unknown as ParkingViolation).tileY,
            slot: v.slot,
            status: (v.status === 'fined' ? 'fined' : 'unpaid') as 'unpaid' | 'fined',
          })));
        }
      });
      this.wsSocket.on('parking-fine-issued', (data: ParkingFineEvent) => {
        if (this.onParkingFineIssued) this.onParkingFineIssued(data);
      });

      // Partnership-Discovered von anderem Spieler empfangen
      this.wsSocket.on('partnership-discovered', (data: { partnerSlug: string; partnerName: string; direction: string; playerId?: string }) => {
        console.log('[DeltaQueue] 🏘️ Partnership-Discovered empfangen:', data.partnerName);
        emitLogEvent('receive', `🏘️ ${data.partnerName} wurde entdeckt (von anderem Spieler)`);
        
        if (this.onPartnershipDiscovered) {
          this.onPartnershipDiscovered(data);
        }
      });

      // Partnership-Connected von anderem Spieler empfangen
      this.wsSocket.on('partnership-connected', (data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number; playerId?: string }) => {
        console.log('[DeltaQueue] 🤝 Partnership-Connected empfangen:', data.partnerName);
        emitLogEvent('receive', `🤝 Handelsroute mit ${data.partnerName} etabliert (von anderem Spieler)`);
        
        if (this.onPartnershipConnected) {
          this.onPartnershipConnected(data);
        }
      });

      // Bus-Lines-Updated: Buslinie erstellt/geloescht/geaendert
      this.wsSocket.on('bus-lines-updated', () => {
        window.dispatchEvent(new Event('bus-lines-updated'));
      });

      // Admin-Nachricht (system-notice)
      this.wsSocket.on('system-notice', (payload: { title?: string; message: string; format?: string; sentAt?: string }) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('system-notice', { detail: payload }));
        }
      });

      // Werkhof-Status: Reparaturqueue und Müllabfuhr
      this.wsSocket.on('werkhof-status', (payload: {
        repairQueue?: { x: number; y: number; condition: number; tool: string }[];
        hasWerkhof?: boolean;
        hasWerkhofNpc?: boolean;
        garbageDue?: boolean;
        serverTimestamp?: number;
      }) => {
        // Zustandsdaten im module-level Store ablegen (fuer TileInfoPanel)
        if (Array.isArray(payload?.repairQueue)) {
          updateFromRepairQueue(payload.repairQueue);
        }
        if (payload?.hasWerkhofNpc !== undefined) {
          setHasWerkhofNpc(Boolean(payload.hasWerkhofNpc));
        }
        window.dispatchEvent(new CustomEvent('werkhof-status', { detail: payload }));
      });

      // Avatar-System: kompletter Snapshot beim Join oder Re-Sync
      this.wsSocket.on('avatars-snapshot', (payload: { avatars?: AvatarSyncState[] }) => {
        const avatars = Array.isArray(payload?.avatars) ? payload.avatars : [];
        if (this.onAvatarSnapshot) {
          this.onAvatarSnapshot(avatars);
        }
      });

      // Avatar-System: einzelnes Update (spawn/move)
      this.wsSocket.on('avatar-updated', (payload: { avatar?: AvatarSyncState }) => {
        const avatar = payload?.avatar;
        if (!avatar) return;
        if (this.onAvatarUpdated) {
          this.onAvatarUpdated(avatar);
        }
      });

      // Avatar-System: Avatar entfernt (Owner hat Raum verlassen)
      this.wsSocket.on('avatar-removed', (payload: { avatarId?: string }) => {
        const avatarId = String(payload?.avatarId || '');
        if (!avatarId) return;
        if (this.onAvatarRemoved) {
          this.onAvatarRemoved(avatarId);
        }
      });

      // Navigator: Spielerzahl-Updates für öffentliche Räume (globaler Broadcast)
      this.wsSocket.on('navigator-room-count', (payload: {
        room_code?: string;
        municipality_slug?: string;
        municipality_name?: string;
        player_count?: number;
        room_name?: string;
        ts?: number;
      }) => {
        if (typeof window !== 'undefined' && payload?.room_code) {
          window.dispatchEvent(new CustomEvent('isocity-navigator-room-count', {
            detail: {
              room_code: String(payload.room_code),
              municipality_slug: String(payload.municipality_slug || ''),
              municipality_name: String(payload.municipality_name || ''),
              player_count: Math.max(0, Number(payload.player_count || 0)),
              room_name: String(payload.room_name || ''),
              ts: Number(payload.ts || Date.now()),
            },
          }));
        }
      });

      // Room-Chat: Nachrichten nur innerhalb des aktuellen Raums
      this.wsSocket.on('room-chat', (payload: { text?: string; userName?: string; playerId?: string; timestamp?: number }) => {
        if (!payload?.text) return;
        if (this.onRoomChat) {
          this.onRoomChat({
            text: String(payload.text),
            userName: String(payload.userName || 'Spieler'),
            playerId: String(payload.playerId || ''),
            timestamp: Number(payload.timestamp || Date.now()),
          });
        }
      });

      // ─── Messenger: WebSocket-Events ──────────────────────────
      const messengerEvents = [
        'messenger-message',
        'messenger-friends-list',
        'messenger-requests-list',
        'messenger-search-results',
        'messenger-chat-opened',
        'messenger-friend-request-received',
        'messenger-friend-accepted',
        'messenger-friend-removed',
        'messenger-friend-status',
        'messenger-error',
      ];
      for (const evt of messengerEvents) {
        this.wsSocket.on(evt, (data: unknown) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(evt, { detail: data }));
          }
        });
      }

      // ── Duplikat-Login: Server hat diesen Socket gekickt ──
      this.wsSocket.on('force-disconnect', (data: { reason?: string }) => {
        const msg = data?.reason || 'Du wurdest abgemeldet, da du dich an einem anderen Ort eingeloggt hast.';
        console.warn('[DeltaQueue] ⚠️ Force-Disconnect:', msg);
        emitLogEvent('error', `⚠️ ${msg}`);
        window.dispatchEvent(new CustomEvent('force-disconnect', { detail: { reason: msg } }));
        // Reconnect verhindern
        if (this.wsSocket) {
          this.wsSocket.disconnect();
        }
      });

      // ── Neuer Login auf anderem Gerät: Token revoked, Session ungültig ──
      this.wsSocket.on('force-logout', (data: { reason?: string }) => {
        const msg = data?.reason === 'new_login_elsewhere'
          ? 'Du wurdest abgemeldet, da du dich auf einem anderen Gerät eingeloggt hast.'
          : (data?.reason || 'Du wurdest abgemeldet.');
        console.warn('[DeltaQueue] 🔒 Force-Logout:', msg);
        emitLogEvent('error', `🔒 ${msg}`);
        // Reconnect verhindern
        if (this.wsSocket) {
          this.wsSocket.disconnect();
        }
        // Token aus localStorage löschen + UI informieren
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('isocity_auth_token');
            localStorage.removeItem('isocity_user_rank');
            localStorage.removeItem('isocity_global_role');
            localStorage.removeItem('isocity_municipality');
          } catch {}
          window.dispatchEvent(new CustomEvent('force-logout', { detail: { reason: msg } }));
        }
      });

      // ── Delta vom Server abgelehnt (Bauzone, Berechtigung, etc.) ──
      this.wsSocket.on('delta-rejected', (data: { reason?: string; delta?: unknown }) => {
        const reason = String(data?.reason || 'unknown');
        console.warn('[DeltaQueue] ⛔ Delta abgelehnt:', reason, data?.delta);
        emitLogEvent('error', `⛔ Aktion abgelehnt: ${reason}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('isocity-delta-rejected', {
            detail: { reason, delta: data?.delta },
          }));
        }
      });

      // Verbindung getrennt
      this.wsSocket.on('disconnect', (reason) => {
        console.log('[DeltaQueue] ❌ WebSocket getrennt:', reason);
        emitLogEvent('error', `❌ WebSocket getrennt: ${reason}`);
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(false, String(reason || 'disconnect'));
        }
      });

      // Fehler
      this.wsSocket.on('connect_error', (error) => {
        console.error('[DeltaQueue] ❌ WebSocket Verbindungsfehler:', error.message);
        emitLogEvent('error', `❌ WebSocket Fehler: ${error.message}`);
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(false, `connect_error:${String(error.message || 'unknown')}`);
        }
        if (ALLOW_HTTP_REALTIME_FALLBACK) {
          this.fallbackToSSE();
        }
      });

      // Reconnect erfolgreich
      this.wsSocket.on('reconnect', () => {
        console.log('[DeltaQueue] ✅ WebSocket reconnected');
        emitLogEvent('info', '✅ WebSocket wiederverbunden');
        
        // Raum erneut beitreten mit Spielername und Besucher-Status
        this.wsSocket?.emit('join-room', {
          roomCode: this.roomCode,
          municipalitySlug: this.municipalitySlug,
          clientId: this.clientId,
          name: this.playerName,
          isViewOnly: this.isViewOnly,
          authToken: typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null,
        });
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(true);
        }
      });

    } catch (error) {
      console.error('[DeltaQueue] WebSocket Initialisierungsfehler:', error);
      if (ALLOW_HTTP_REALTIME_FALLBACK) {
        this.fallbackToSSE();
      }
    }
  }

  /**
   * Fallback zu SSE wenn WebSocket nicht funktioniert
   */
  private fallbackToSSE(): void {
    this.useWebSocket = false;
    if (this.wsSocket) {
      this.wsSocket.disconnect();
      this.wsSocket = null;
    }
    
    console.log('[DeltaQueue] 📡 Wechsle zu SSE-Modus');
    emitLogEvent('info', '📡 Wechsle zu SSE-Modus');
    
    if (typeof EventSource !== 'undefined') {
      this.useSSE = true;
      this.connectSSE();
    } else {
      this.fallbackToPolling();
    }
  }

  /**
   * SSE-Verbindung für Echtzeit-Empfang (Fallback)
   */
  private connectSSE(): void {
    if (this.sseEventSource) {
      this.sseEventSource.close();
    }
    
    const url = `${API_BASE_URL}/municipality/${this.municipalitySlug}/deltas/${this.roomCode}/stream?client_id=${this.clientId}&since=${this.clientVersion}`;
    
    console.log('[DeltaQueue] 🔌 SSE verbinden:', url);
    
    try {
      this.sseEventSource = new EventSource(url);
      
      // Verbindung hergestellt
      this.sseEventSource.addEventListener('connected', (event) => {
        console.log('[DeltaQueue] ✅ SSE verbunden');
        this.sseReconnectAttempts = 0;
        emitLogEvent('info', '🔌 SSE-Verbindung hergestellt');
      });
      
      // Deltas empfangen
      this.sseEventSource.addEventListener('deltas', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          
          if (data.deltas && data.deltas.length > 0) {
            console.log('[DeltaQueue] 📥 SSE Deltas:', data.deltas.length);
            this.clientVersion = data.serverVersion;
            
            debugLog.receive(data.deltas.length, data.deltas.map((d: DeltaAction) => ({
              type: d.type,
              playerId: d.playerId,
              ...('x' in d ? { pos: `(${d.x},${d.y})` } : {}),
            })));
            
            if (this.onRemoteDeltas) {
              this.onRemoteDeltas(data.deltas);
            }
          }
        } catch (e) {
          console.error('[DeltaQueue] SSE Parse-Fehler:', e);
        }
      });
      
      // Server fordert Reconnect
      this.sseEventSource.addEventListener('reconnect', () => {
        console.log('[DeltaQueue] 🔄 SSE Reconnect angefordert');
        this.reconnectSSE();
      });
      
      // Fehler
      this.sseEventSource.onerror = (error) => {
        const state = this.sseEventSource?.readyState;
        const stateStr = state === 0 ? 'CONNECTING' : state === 1 ? 'OPEN' : state === 2 ? 'CLOSED' : 'UNKNOWN';
        console.error('[DeltaQueue] ❌ SSE Fehler:', { state: stateStr, url });
        emitLogEvent('error', `❌ SSE-Verbindung unterbrochen (${stateStr})`);
        this.scheduleSSEReconnect();
      };
      
    } catch (error) {
      console.error('[DeltaQueue] SSE Verbindungsfehler:', error);
      this.fallbackToPolling();
    }
  }
  
  /**
   * SSE Reconnect planen
   */
  private scheduleSSEReconnect(): void {
    if (this.sseReconnectAttempts >= 5) {
      console.log('[DeltaQueue] ⚠️ SSE fehlgeschlagen, wechsle zu Polling');
      this.fallbackToPolling();
      return;
    }
    
    this.sseReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.sseReconnectAttempts - 1), 10000);
    
    console.log(`[DeltaQueue] 🔄 SSE Reconnect in ${delay}ms (Versuch ${this.sseReconnectAttempts}/5)`);
    
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
    }
    
    this.sseReconnectTimeout = setTimeout(() => {
      this.reconnectSSE();
    }, delay);
  }
  
  /**
   * SSE Reconnect
   */
  private reconnectSSE(): void {
    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }
    this.connectSSE();
  }
  
  /**
   * Fallback zu Polling wenn SSE nicht funktioniert
   */
  private fallbackToPolling(): void {
    this.useSSE = false;
    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }
    console.log('[DeltaQueue] 📡 Wechsle zu Polling-Modus');
    emitLogEvent('info', '📡 Wechsle zu Polling-Modus');
    this.startPolling(800);
  }

  /**
   * Stoppe die Queue, WebSocket, SSE und Polling
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    // WebSocket schließen
    if (this.wsSocket) {
      this.wsSocket.disconnect();
      this.wsSocket = null;
    }
    if (this.onConnectionStatusChange) {
      this.onConnectionStatusChange(false, 'stopped');
    }
    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
      this.sseReconnectTimeout = null;
    }
    // Letzte Deltas noch senden
    this.flush();
    console.log('[DeltaQueue] 🛑 Gestoppt');
  }
  
  /**
   * Starte Polling für Updates von anderen Spielern
   */
  private startPolling(intervalMs: number): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.pollInterval = setInterval(async () => {
      await this.pollForUpdates();
    }, intervalMs);
    
    // Sofort einmal pollen
    this.pollForUpdates();
  }
  
  /**
   * Hole neue Deltas vom Server (von anderen Spielern)
   * NUR als Fallback wenn WebSocket nicht verbunden!
   */
  private async pollForUpdates(): Promise<void> {
    // WICHTIG: Kein Polling wenn WebSocket verbunden ist!
    if (this.wsSocket?.connected) {
      return;
    }
    
    if (this.isPolling || !this.roomCode || !this.municipalitySlug) return;
    
    this.isPolling = true;
    
    try {
      const result = await fetchNewDeltas(
        this.municipalitySlug,
        this.roomCode,
        this.clientVersion,
        this.clientId
      );
      
      if (result) {
        // Update Version
        this.clientVersion = result.serverVersion;
        
        // Callback für remote Deltas
        if (result.deltas.length > 0) {
          console.log('[DeltaQueue] 📥 Polling: Neue Deltas empfangen:', result.deltas.length);
          debugLog.receive(result.deltas.length, result.deltas.map(d => ({
            type: d.type,
            playerId: d.playerId,
            ...('x' in d ? { pos: `(${d.x},${d.y})` } : {}),
          })));
          
          if (this.onRemoteDeltas) {
            this.onRemoteDeltas(result.deltas);
          } else {
            console.warn('[DeltaQueue] ⚠️ Deltas empfangen aber kein onRemoteDeltas Callback!');
          }
        }
        
        // Callback für Spieler-Updates (immer, auch wenn keine neuen Deltas)
        if (result.players && this.onPlayersUpdate) {
          this.onPlayersUpdate(result.players);
        }
      }
    } catch (error) {
      console.error('[DeltaQueue] ❌ Polling-Fehler:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Füge eine Aktion zur Queue hinzu
   */
  push(action: DeltaActionInput): void {
    const delta: DeltaAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.clientId,
    } as DeltaAction;
    
    this.queue.push(delta);
    
    // SOFORT über WebSocket an andere Spieler senden (für Echtzeit-Feedback)
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('delta', delta);
    }
    
    // Debug: Zeige was zur Queue hinzugefügt wurde
    const actionDetails: Record<string, unknown> = { timestamp: delta.timestamp };
    if ('x' in delta && 'y' in delta) {
      actionDetails.position = `(${delta.x}, ${delta.y})`;
    }
    if ('tool' in delta) {
      actionDetails.tool = delta.tool;
    }
    if ('zone' in delta) {
      actionDetails.zone = delta.zone;
    }
    if ('money' in delta || 'population' in delta) {
      actionDetails.money = (delta as { money?: number }).money;
      actionDetails.population = (delta as { population?: number }).population;
    }
    debugLog.action(delta.type.toUpperCase(), {
      ...actionDetails,
      queueSize: this.queue.length,
      sentViaWS: this.wsSocket?.connected ?? false,
    });
    
    // Bei mehr als 10 Deltas sofort flushen (für DB-Persistenz)
    if (this.queue.length >= 10) {
      debugLog.info('Queue voll (≥10), sofortiger Flush...');
      this.flush();
    }
  }

  /**
   * Autobahn Verkehrsrichtung für eine Kachel persistieren.
   * Wird für jede betroffene Kachel einzeln aufgerufen.
   */
  sendAutobahnDirection(x: number, y: number, direction: 'north' | 'south' | 'east' | 'west' | null): void {
    this.push({
      type: 'metadata_update',
      x,
      y,
      metadata: { autobahnDirection: direction ?? null },
    });
  }

  /**
   * Sende Stats über WebSocket an andere Spieler (Echtzeit!)
   */
  sendStats(stats: Record<string, unknown>): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('stats-update', stats);
      console.log('[DeltaQueue] 📊 Stats via WebSocket gesendet');
    }
  }

  /**
   * Sende Budget-Funding-Aenderung an den Server (server-authoritative).
   * Server validiert, speichert und broadcastet an andere Clients.
   */
  sendBudgetUpdate(budget: Record<string, { funding: number }>): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('budget-update', { budget });
      console.log('[DeltaQueue] 💰 Budget via WebSocket gesendet');
    }
  }

  async sendStatsWithAck(stats: Record<string, unknown>): Promise<StatsUpdateAck | null> {
    if (!this.wsSocket?.connected) return null;
    try {
      const ack = await new Promise<StatsUpdateAck>((resolve) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve({ success: false, error: 'timeout' });
        }, 5000);
        this.wsSocket?.emit('stats-update', stats, (response: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          const safe = response && typeof response === 'object'
            ? (response as StatsUpdateAck)
            : { success: false, error: 'invalid_ack' };
          resolve(safe);
        });
      });
      return ack;
    } catch {
      return { success: false, error: 'emit_failed' };
    }
  }

  /**
   * Sende Construction-Sync direkt über WebSocket (mit Ack).
   * Gibt null zurück, wenn WS nicht verfügbar oder Ack fehlgeschlagen ist.
   */
  async sendConstructionSync(
    positions: ConstructionSyncPosition[]
  ): Promise<ConstructionSyncResponse | null> {
    if (!this.wsSocket?.connected) return null;
    if (!Array.isArray(positions) || positions.length <= 0) {
      return { updated: 0, deleted: 0, authoritativeStats: null };
    }
    try {
      const ack = await new Promise<{ success: boolean; data?: ConstructionSyncResponse; error?: string }>((resolve) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve({ success: false, error: 'timeout' });
        }, 5000);
        this.wsSocket?.emit('items-constructed-sync', { positions }, (response: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          const safe = response && typeof response === 'object'
            ? (response as { success?: boolean; data?: ConstructionSyncResponse; error?: string })
            : { success: false, error: 'invalid_ack' };
          resolve({
            success: Boolean(safe.success),
            data: safe.data,
            error: safe.error,
          });
        });
      });
      if (!ack.success) return null;
      return ack.data || { updated: 0, deleted: 0, authoritativeStats: null };
    } catch {
      return null;
    }
  }

  /**
   * Sende Partnership-Discovered Event über WebSocket (Gemeinde entdeckt)
   */
  sendPartnershipDiscovered(data: { partnerSlug: string; partnerName: string; direction: string }): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('partnership-discovered', data);
      console.log('[DeltaQueue] 🏘️ Partnership-Discovered via WebSocket gesendet:', data.partnerName);
      emitLogEvent('send', `🏘️ Stadt entdeckt: ${data.partnerName}`);
    }
  }

  /**
   * Sende Partnership-Connected Event über WebSocket (Handelsroute etabliert)
   */
  sendPartnershipConnected(data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number }): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('partnership-connected', data);
      console.log('[DeltaQueue] 🤝 Partnership-Connected via WebSocket gesendet:', data.partnerName);
      emitLogEvent('send', `🤝 Handelsroute etabliert: ${data.partnerName}`);
    }
  }

  /**
   * Setze Callback für Partnership-Discovered Events
   */
  setOnPartnershipDiscovered(callback: ((data: { partnerSlug: string; partnerName: string; direction: string; playerId?: string }) => void) | null): void {
    this.onPartnershipDiscovered = callback;
  }

  /**
   * Setze Callback für Partnership-Connected Events
   */
  setOnPartnershipConnected(callback: ((data: { partnerSlug: string; partnerName: string; bonusPaid: number; monthlyIncome: number; playerId?: string }) => void) | null): void {
    this.onPartnershipConnected = callback;
  }

  setOnAvatarSnapshot(callback: ((avatars: AvatarSyncState[]) => void) | null): void {
    this.onAvatarSnapshot = callback;
  }

  setOnAvatarUpdated(callback: ((avatar: AvatarSyncState) => void) | null): void {
    this.onAvatarUpdated = callback;
  }

  setOnAvatarRemoved(callback: ((avatarId: string) => void) | null): void {
    this.onAvatarRemoved = callback;
  }

  sendAvatarSpawn(data: { avatarId?: string; x: number; y: number; ownerName?: string; avatarConfig?: AvatarAppearanceConfig }): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('avatar-spawn-request', data);
    }
  }

  sendAvatarMove(data: { avatarId: string; x: number; y: number; path: Array<{ x: number; y: number }> }): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('avatar-move-request', data);
    }
  }

  /**
   * Sende Room-Chat Nachricht (nur im aktuellen Raum sichtbar)
   */
  sendRoomChat(text: string): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('room-chat', { text });
    }
  }

  emitParkVehicle(tileX: number, tileY: number, slot: number, color: string): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('park-vehicle', { tileX, tileY, slot, color });
    }
  }

  emitLeaveParking(tileX: number, tileY: number, slot: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('leave-parking', { tileX, tileY, slot });
    }
  }

  emitSetParkingConfig(tileX: number, tileY: number, isFree: boolean, feeRate: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('set-parking-config', { tileX, tileY, isFree, feeRate });
    }
  }

  /**
   * Service-Building Upgrade ueber Server starten (server-authoritative).
   * Gibt ein Promise zurueck mit der Server-Antwort.
   */
  sendUpgradeBuilding(x: number, y: number): Promise<{ success: boolean; data?: { upgradeStartedAt: number | null; upgradeTargetLevel: number; upgradeSeconds: number; newLevel: number }; error?: string }> {
    return new Promise((resolve) => {
      if (!this.wsSocket?.connected) {
        resolve({ success: false, error: 'not_connected' });
        return;
      }
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'timeout' });
      }, 5000);
      this.wsSocket.emit('upgrade-building', { x, y }, (response: unknown) => {
        clearTimeout(timeout);
        resolve(response as { success: boolean; data?: { upgradeStartedAt: number | null; upgradeTargetLevel: number; upgradeSeconds: number; newLevel: number }; error?: string });
      });
    });
  }

  /**
   * Gebaeude reparieren ueber Server (server-authoritative).
   */
  sendRepairBuilding(x: number, y: number): Promise<{ success: boolean; data?: { repairCost: number; constructionProgress: number; constructionStartedAt: number }; error?: string }> {
    return new Promise((resolve) => {
      if (!this.wsSocket?.connected) {
        resolve({ success: false, error: 'not_connected' });
        return;
      }
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'timeout' });
      }, 5000);
      this.wsSocket.emit('repair-building', { x, y }, (response: unknown) => {
        clearTimeout(timeout);
        resolve(response as { success: boolean; data?: { repairCost: number; constructionProgress: number; constructionStartedAt: number }; error?: string });
      });
    });
  }

  /**
   * Stadt erweitern ueber Server (server-authoritative).
   */
  sendExpandCity(): Promise<{ success: boolean; data?: { newGridSize: number; offset: number; cost: number }; error?: string }> {
    return new Promise((resolve) => {
      if (!this.wsSocket?.connected) {
        resolve({ success: false, error: 'not_connected' });
        return;
      }
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'timeout' });
      }, 10000);
      this.wsSocket.emit('expand-city', {}, (response: unknown) => {
        clearTimeout(timeout);
        resolve(response as { success: boolean; data?: { newGridSize: number; offset: number; cost: number }; error?: string });
      });
    });
  }

  // ─── Messenger Methoden ──────────────────────────────────
  messengerSend(conversationId: number, text: string): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-send', { conversationId, text });
    }
  }
  messengerLoadFriends(): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-load-friends');
    }
  }
  messengerLoadRequests(): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-load-requests');
    }
  }
  messengerSearch(query: string): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-search', { query });
    }
  }
  messengerSendFriendRequest(receiverId: number, message?: string): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-friend-request', { receiverId, message });
    }
  }
  messengerAcceptFriend(senderId: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-accept-friend', { senderId });
    }
  }
  messengerDenyFriend(senderId: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-deny-friend', { senderId });
    }
  }
  messengerRemoveFriend(friendId: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-remove-friend', { friendId });
    }
  }
  messengerStartChat(friendId: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('messenger-start-chat', { friendId });
    }
  }

  /**
   * Werkhof-Reparatur abgeschlossen (Gebäude auf 100% Zustand zurücksetzen)
   */
  werkhofRepairComplete(x: number, y: number): void {
    if (this.wsSocket?.connected) {
      this.wsSocket.emit('werkhof-repair-complete', { x, y });
    }
  }

  /**
   * Setze Callback für Room-Chat Nachrichten
   */
  setOnRoomChat(callback: ((data: { text: string; userName: string; playerId: string; timestamp: number }) => void) | null): void {
    this.onRoomChat = callback;
  }

  /**
   * Setze Callback für server-autoritative Katastrophenupdates
   */
  setOnDisasterUpdate(callback: ((changes: DisasterStateUpdate[]) => void) | null): void {
    this.onDisasterUpdate = callback;
  }

  setOnBuildingUpdate(callback: ((changes: BuildingStateUpdate[]) => void) | null): void {
    this.onBuildingUpdate = callback;
  }

  setOnCrimeUpdate(callback: ((data: CrimeAuthoritativePayload) => void) | null): void {
    this.onCrimeUpdate = callback;
  }

  setOnBuenzliUpdate(callback: ((payload: BuenzliNpcPayload) => void) | null): void {
    this.onBuenzliUpdate = callback;
  }

  setOnLandValueUpdate(callback: ((data: { gridSize: number; values: number[] }) => void) | null): void {
    this.onLandValueUpdate = callback;
  }

  setOnPartyUpdate(callback: ((data: { parties: import('@/components/game/types').MansionParty[] }) => void) | null): void {
    this.onPartyUpdate = callback;
  }

  setOnPartyPoliceWarning(callback: ((data: { partyId: number; tileX: number; tileY: number; warningNumber: number; fineAmount: number; isShutdown: boolean; ownerUserId: number }) => void) | null): void {
    this.onPartyPoliceWarning = callback;
  }

  setOnConnectionStatusChange(callback: ((connected: boolean, reason?: string) => void) | null): void {
    this.onConnectionStatusChange = callback;
  }

  /**
   * Prüfe ob WebSocket verbunden ist
   */
  isWebSocketConnected(): boolean {
    return this.wsSocket?.connected ?? false;
  }

  canSendStatsUpdates(): boolean {
    return this.canSendStatsUpdatesFlag;
  }

  /**
   * Sende alle gesammelten Deltas an den Server
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0 || !this.flushCallback) {
      return;
    }
    
    console.log('[DeltaQueue] 📤 Flush gestartet, Deltas:', this.queue.length);

    this.isFlushing = true;
    
    // Kopiere Queue und leere sie
    const deltasToSend = [...this.queue];
    this.queue = [];

    const batch: DeltaBatch = {
      roomCode: this.roomCode,
      municipalitySlug: this.municipalitySlug,
      deltas: deltasToSend,
      clientVersion: this.clientVersion,
      clientId: this.clientId,
    };

    // Debug: Zeige was gesendet wird
    debugLog.send(deltasToSend.length, {
      roomCode: batch.roomCode,
      clientVersion: batch.clientVersion,
      deltas: deltasToSend.map(d => ({
        type: d.type,
        ...('x' in d ? { pos: `(${d.x},${d.y})` } : {}),
        ...('tool' in d ? { tool: d.tool } : {}),
        ...('zone' in d ? { zone: d.zone } : {}),
      })),
    });

    try {
      const response = await this.flushCallback(batch);
      
      if (response) {
        // Update Version
        const oldVersion = this.clientVersion;
        this.clientVersion = response.serverVersion;
        
        debugLog.success(`Server hat ${response.appliedDeltas} Delta(s) angewendet`, {
          versionUpdate: `${oldVersion} → ${response.serverVersion}`,
        });
        
        // Verarbeite neue Deltas von anderen Spielern
        if (response.newDeltas && response.newDeltas.length > 0 && this.onRemoteDeltas) {
          // Filtere eigene Deltas raus
          const remoteDeltas = response.newDeltas.filter(d => d.playerId !== this.clientId);
          if (remoteDeltas.length > 0) {
            debugLog.receive(remoteDeltas.length, remoteDeltas.map(d => ({
              type: d.type,
              playerId: d.playerId,
              ...('x' in d ? { pos: `(${d.x},${d.y})` } : {}),
              ...('tool' in d ? { tool: d.tool } : {}),
            })));
            this.onRemoteDeltas(remoteDeltas);
          }
        }
        
        // Log Konflikte
        if (response.conflicts && response.conflicts.length > 0) {
          debugLog.conflict(response.conflicts);
        }
        if (response.rejectedDeltas && response.rejectedDeltas.length > 0) {
          debugLog.error(`⚠️ ${response.rejectedDeltas.length} Delta(s) vom Server abgelehnt`, response.rejectedDeltas);
        }
      }
    } catch (error) {
      debugLog.error('Flush fehlgeschlagen', error);
      // Deltas zurück in die Queue (am Anfang)
      this.queue = [...deltasToSend, ...this.queue];
      debugLog.info(`${deltasToSend.length} Delta(s) zurück in Queue`);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Starte automatisches Flushen
   */
  private startAutoFlush(intervalMs: number): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    this.flushInterval = setInterval(() => {
      this.flush();
    }, intervalMs);
  }
  
  /**
   * Setze die Server-Version (nach externem Load)
   */
  setServerVersion(version: number): void {
    this.clientVersion = version;
  }

  /**
   * Anzahl der ausstehenden Deltas
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Client ID für externe Verwendung
   */
  get id(): string {
    return this.clientId;
  }
}

// Singleton-Instanz
export const deltaQueue = new DeltaQueue();

export async function sendConstructionSyncBatch(
  positions: ConstructionSyncPosition[]
): Promise<ConstructionSyncResponse | null> {
  return deltaQueue.sendConstructionSync(positions);
}

// ==========================================
// API FUNKTIONEN
// ==========================================

function normalizeGameApiUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  return trimmed.endsWith('/api/game') ? trimmed : `${trimmed}/api/game`;
}
const API_BASE_URL = normalizeGameApiUrl(
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'http://127.0.0.1:4100'
);

/**
 * Sende Delta-Batch an den Server
 */
export async function sendDeltaBatch(batch: DeltaBatch): Promise<DeltaResponse | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/municipality/${batch.municipalitySlug}/deltas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'X-Game-Token': token } : {}),
        },
        body: JSON.stringify({
          room_code: batch.roomCode,
          deltas: batch.deltas,
          client_version: batch.clientVersion,
          client_id: batch.clientId,
        }),
      }
    );

    if (!response.ok) {
      console.error('[DeltaSync] Server-Fehler:', response.status);
      return null;
    }

    const json = await response.json();
    
    if (!json.success) {
      console.error('[DeltaSync] API-Fehler:', json.error);
      return null;
    }

    return json.data as DeltaResponse;
  } catch (error) {
    console.error('[DeltaSync] Netzwerk-Fehler:', error);
    return null;
  }
}

// Spieler-Type für Export
export interface DeltaPlayer {
  id: string;
  name: string;
  isLocal?: boolean;
}

// Response-Type mit Spielern
export interface DeltaPollResult {
  deltas: DeltaAction[];
  serverVersion: number;
  players?: DeltaPlayer[];
  playerCount?: number;
}

/**
 * Hole neue Deltas vom Server (Polling)
 */
export async function fetchNewDeltas(
  municipalitySlug: string,
  roomCode: string,
  sinceVersion: number,
  clientId: string
): Promise<DeltaPollResult | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/municipality/${municipalitySlug}/deltas/${roomCode}?since=${sinceVersion}&client_id=${clientId}`,
      {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'X-Game-Token': token } : {}),
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    
    if (!json.success) {
      return null;
    }

    return {
      deltas: json.data.deltas || [],
      serverVersion: json.data.server_version || sinceVersion,
      players: json.data.players || [],
      playerCount: json.data.player_count || 0,
    };
  } catch (error) {
    console.error('[DeltaSync] Polling-Fehler:', error);
    return null;
  }
}

// ==========================================
// HELPER
// ==========================================

/**
 * Prüfe ob zwei Deltas am gleichen Tile sind (Konflikt möglich)
 */
export function deltasConflict(a: DeltaAction, b: DeltaAction): boolean {
  if (a.type === 'stats_update' || b.type === 'stats_update') {
    return false; // Stats-Updates können gemerged werden
  }
  
  const aPos = 'x' in a ? { x: a.x, y: a.y } : null;
  const bPos = 'x' in b ? { x: b.x, y: b.y } : null;
  
  if (!aPos || !bPos) return false;
  
  return aPos.x === bPos.x && aPos.y === bPos.y;
}

/**
 * Löse Konflikt zwischen zwei Deltas (letztes gewinnt)
 */
export function resolveConflict(a: DeltaAction, b: DeltaAction): DeltaAction {
  // Neueres Delta gewinnt
  return a.timestamp > b.timestamp ? a : b;
}

// ==========================================
// STATS SYNC API
// ==========================================

/**
 * Synchronisiere Stats mit dem Server
 */
export async function syncStatsToServer(
  municipalitySlug: string,
  roomCode: string,
  stats: Partial<GameStatsData>
): Promise<boolean> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
  
  // Konvertiere camelCase zu snake_case für die API
  const apiStats: Record<string, number | undefined> = {
    money: stats.money,
    income: stats.income,
    expenses: stats.expenses,
    tax_rate: stats.taxRate,
    population: stats.population,
    max_population: stats.maxPopulation,
    population_growth: stats.populationGrowth,
    homeless: stats.homeless,
    jobs: stats.jobs,
    employed: stats.employed,
    unemployed: stats.unemployed,
    unemployment_rate: stats.unemploymentRate,
    happiness: stats.happiness,
    happiness_residential: stats.happinessResidential,
    happiness_commercial: stats.happinessCommercial,
    happiness_industrial: stats.happinessIndustrial,
    power_production: stats.powerProduction,
    power_consumption: stats.powerConsumption,
    water_production: stats.waterProduction,
    water_consumption: stats.waterConsumption,
    water_balance: stats.waterBalance,
    buildings_total: stats.buildingsTotal,
    buildings_residential: stats.buildingsResidential,
    buildings_commercial: stats.buildingsCommercial,
    buildings_industrial: stats.buildingsIndustrial,
    buildings_infrastructure: stats.buildingsInfrastructure,
    buildings_decoration: stats.buildingsDecoration,
    zones_residential: stats.zonesResidential,
    zones_commercial: stats.zonesCommercial,
    zones_industrial: stats.zonesIndustrial,
    tick: stats.tick,
    game_speed: stats.gameSpeed,
    play_time_seconds: stats.playTimeSeconds,
    total_tax_collected: stats.totalTaxCollected,
    total_spent: stats.totalSpent,
  };
  const mapData =
    typeof stats.gameMapData === 'object' && stats.gameMapData !== null
      ? stats.gameMapData
      : undefined;
  
  // Entferne undefined-Werte
  const filteredStats = Object.fromEntries(
    Object.entries(apiStats).filter(([, v]) => v !== undefined)
  );
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/municipality/${municipalitySlug}/stats/${roomCode}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'X-Game-Token': token } : {}),
        },
        body: JSON.stringify({
          ...filteredStats,
          ...(mapData ? { game_map_data: mapData } : {}),
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[DeltaSync] Stats-Sync Fehler:', error);
    return false;
  }
}

/**
 * Schneller Stats-Sync - NUR über WebSocket!
 * 
 * Keine HTTP-Calls mehr für Stats.
 * Stats werden in Echtzeit über WebSocket gesendet.
 * DB-Persistenz läuft über den Game-State-Save (alle paar Minuten).
 */
export async function quickSyncStats(
  _municipalitySlug: string,
  _roomCode: string,
  stats: {
    money: number;
    population: number;
    happiness: number;
    tick: number;
    income?: number;
    expenses?: number;
    jobs?: number;
    taxRate?: number;
    gameSpeed?: number;
    year?: number;
    month?: number;
  }
): Promise<boolean> {
  // NUR über WebSocket - kein HTTP mehr!
  if (deltaQueue.isWebSocketConnected()) {
    deltaQueue.sendStats(stats);
    return true;
  }
  
  // Kein WebSocket? Dann keine Echtzeit-Sync, aber kein Fehler
  // Stats werden über den normalen Game-State-Save persistiert
  return true;
}

/**
 * Lade Stats vom Server
 */
export async function loadStatsFromServer(
  municipalitySlug: string,
  roomCode: string
): Promise<GameStatsData | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/municipality/${municipalitySlug}/stats/${roomCode}`,
      {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'X-Game-Token': token } : {}),
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    
    if (!json.success || !json.data) {
      return null;
    }

    // Konvertiere API-Response zu GameStatsData
    const data = json.data;
    return {
      money: data.finances?.money ?? 50000,
      income: data.finances?.income ?? 0,
      expenses: data.finances?.expenses ?? 0,
      taxRate: data.finances?.tax_rate ?? 10,
      population: data.population?.current ?? 0,
      maxPopulation: data.population?.max ?? 0,
      populationGrowth: data.population?.growth ?? 0,
      homeless: data.population?.homeless ?? 0,
      jobs: data.employment?.jobs ?? 0,
      employed: data.employment?.employed ?? 0,
      unemployed: data.employment?.unemployed ?? 0,
      unemploymentRate: data.employment?.rate ?? 0,
      happiness: data.happiness?.overall ?? 50,
      happinessResidential: data.happiness?.residential ?? 50,
      happinessCommercial: data.happiness?.commercial ?? 50,
      happinessIndustrial: data.happiness?.industrial ?? 50,
      health: data.quality?.health ?? 50,
      education: data.quality?.education ?? 50,
      safety: data.quality?.safety ?? 50,
      environment: data.quality?.environment ?? 75,
      powerProduction: data.infrastructure?.power?.production ?? 0,
      powerConsumption: data.infrastructure?.power?.consumption ?? 0,
      waterProduction: data.infrastructure?.water?.production ?? 0,
      waterConsumption: data.infrastructure?.water?.consumption ?? 0,
      waterBalance: data.infrastructure?.water?.balance ?? 0,
      buildingsTotal: data.buildings?.total ?? 0,
      buildingsResidential: data.buildings?.residential ?? 0,
      buildingsCommercial: data.buildings?.commercial ?? 0,
      buildingsIndustrial: data.buildings?.industrial ?? 0,
      buildingsInfrastructure: data.buildings?.infrastructure ?? 0,
      buildingsDecoration: data.buildings?.decoration ?? 0,
      zonesResidential: data.zones?.residential ?? 0,
      zonesCommercial: data.zones?.commercial ?? 0,
      zonesIndustrial: data.zones?.industrial ?? 0,
      tick: data.time?.tick ?? 0,
      gameSpeed: data.time?.speed ?? 1,
      playTimeSeconds: data.time?.play_time ?? 0,
      totalTaxCollected: data.finances?.total_tax_collected ?? 0,
      totalSpent: data.finances?.total_spent ?? 0,
      gameMapData: data.game_map_data ?? null,
    };
  } catch (error) {
    console.error('[DeltaSync] Stats laden Fehler:', error);
    return null;
  }
}
