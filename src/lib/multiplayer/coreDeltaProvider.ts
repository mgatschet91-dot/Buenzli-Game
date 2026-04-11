/**
 * Core Delta Provider
 * 
 * Multiplayer über den eigenen Core-Server.
 * Alle Kommunikation läuft über das Delta-Sync System:
 * 
 * Spieler A → Core Server → Spieler B
 *                ↓
 *          (Speichert + Leitet weiter)
 * 
 * Vorteile:
 * - Kein externer Dienst nötig
 * - Server hat volle Kontrolle
 * - Konfliktlösung auf dem Server
 * - Persistente Speicherung inklusive
 */

import {
  IMultiplayerProvider,
  MultiplayerProviderOptions,
  GameStatsData,
} from './provider';
import {
  GameAction,
  GameActionInput,
  Player,
  MultiplayerGameState,
  MultiplayerTool,
} from './types';
import {
  deltaQueue,
  sendDeltaBatch,
  DeltaAction,
  DeltaActionInput,
} from '../deltaSync';

const CLIENT_DEBUG_LOGS_ENABLED =
  typeof window !== 'undefined' &&
  (window.localStorage?.getItem('isocity_client_logs') === '1' ||
    window.localStorage?.getItem('isocity_debug_logs') === '1');
const console: Pick<Console, 'log' | 'warn' | 'error'> = CLIENT_DEBUG_LOGS_ENABLED
  ? globalThis.console
  : {
      log: () => {},
      warn: () => {},
      error: () => {},
    };

// Event-System für Debug-Panel Integration (gleich wie in deltaSync.ts)
type DeltaSyncLogEvent = {
  time: string;
  type: 'send' | 'receive' | 'action' | 'error' | 'info';
  message: string;
  data?: unknown;
};

// Use the same listener system - listeners are shared with deltaSync
const providerLogListeners: Array<(event: DeltaSyncLogEvent) => void> = [];

// Export function to add listeners (for Debug Panel)
export function addProviderLogListener(listener: (event: DeltaSyncLogEvent) => void): () => void {
  providerLogListeners.push(listener);
  return () => {
    const index = providerLogListeners.indexOf(listener);
    if (index > -1) providerLogListeners.splice(index, 1);
  };
}

function emitProviderLog(type: DeltaSyncLogEvent['type'], message: string, data?: unknown) {
  const event: DeltaSyncLogEvent = {
    time: new Date().toLocaleTimeString('de-CH'),
    type,
    message,
    data,
  };
  providerLogListeners.forEach(listener => listener(event));
}
import { setCurrentMunicipality } from '../api/database';
import { buildStateFromItems, type ItemsApiResponse } from '../buildStateFromItems';
import { getBuildingSize } from '../simulation';
import type { BuildingType, Tool } from '@/types/game';

const RAW_API_BASE =
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'http://127.0.0.1:4100';
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '').endsWith('/api/game')
  ? RAW_API_BASE.replace(/\/+$/, '')
  : `${RAW_API_BASE.replace(/\/+$/, '')}/api/game`;
const DEFAULT_MUNICIPALITY = process.env.NEXT_PUBLIC_DEFAULT_MUNICIPALITY || 'zurich';

function buildPlaceDelta(tool: string, x: number, y: number): DeltaActionInput {
  const size = getBuildingSize(tool as BuildingType);
  if (size.width > 1 || size.height > 1) {
    return {
      type: 'place',
      tool: tool as Tool,
      x,
      y,
      metadata: {
        footprintWidth: size.width,
        footprintHeight: size.height,
      },
    };
  }

  return { type: 'place', tool: tool as Tool, x, y };
}

export class CoreDeltaProvider implements IMultiplayerProvider {
  readonly roomCode: string;
  readonly peerId: string;
  readonly isCreator: boolean;
  
  private municipalitySlug: string;
  private cityName: string;
  private playerName: string;
  private options: MultiplayerProviderOptions;
  private connected: boolean = false;
  private players: Player[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed: boolean = false;
  private initialServerVersion: number = 0;
  
  // SICHERHEIT: Wenn true, kann dieser Client keine Änderungen speichern
  private isViewOnly: boolean = false;

  constructor(options: MultiplayerProviderOptions) {
    this.roomCode = options.roomCode;
    this.municipalitySlug = options.municipalitySlug || DEFAULT_MUNICIPALITY;
    this.cityName = options.cityName;
    this.playerName = options.playerName || this.getStoredPlayerName();
    this.options = options;
    this.peerId = this.generatePeerId();
    this.isCreator = !!options.initialGameState;
    this.isViewOnly = options.isViewOnly ?? false;
    
    // Setze die Municipality für alle API Calls
    setCurrentMunicipality(this.municipalitySlug);
    
    console.log('[CoreDeltaProvider] Initialisiert:', {
      roomCode: this.roomCode,
      municipalitySlug: this.municipalitySlug,
      cityName: this.cityName,
      playerName: this.playerName,
      isCreator: this.isCreator,
      isViewOnly: this.isViewOnly,
    });
  }
  
  /**
   * Hole Spielername aus localStorage oder generiere einen
   */
  private getStoredPlayerName(): string {
    if (typeof window === 'undefined') return 'Spieler';
    
    // Bereinige leere Werte aus localStorage
    const userNameValue = localStorage.getItem('isocity_user_name');
    if (userNameValue === '' || userNameValue === 'Player' || userNameValue === 'Spieler') {
      localStorage.removeItem('isocity_user_name');
    }
    
    // Versuche verschiedene localStorage-Keys (wichtig: isocity_user_name wird von der Auth gesetzt)
    // Prüfe auf nicht-leere Strings!
    const keys = ['isocity_user_name', 'isocity_player_name', 'player_name', 'userName'];
    
    for (const key of keys) {
      const value = localStorage.getItem(key);
      // Prüfe ob nicht null, nicht leer, und nicht "Player" (generischer Fallback)
      if (value && value.trim() !== '' && value !== 'Player' && value !== 'Spieler') {
        console.log('[CoreDeltaProvider] Spielername aus localStorage:', value, `(key: ${key})`);
        return value;
      }
    }
    
    // Generiere einen zufälligen Namen
    const adjectives = ['Schnell', 'Clever', 'Mutig', 'Stark', 'Flink'];
    const nouns = ['Baumeister', 'Architekt', 'Planer', 'Bürger', 'Pionier'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomName = `${adj}er ${noun}`;
    
    // Speichere für nächstes Mal
    localStorage.setItem('isocity_player_name', randomName);
    console.log('[CoreDeltaProvider] Zufälliger Spielername generiert:', randomName);
    
    return randomName;
  }

  private generatePeerId(): string {
    const STORAGE_KEY = 'meinort_client_id';
    
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingId = localStorage.getItem(STORAGE_KEY);
      if (existingId) {
        return existingId;
      }
      
      // Neue ID generieren und speichern
      const newId = this.generateRandomPeerId();
      localStorage.setItem(STORAGE_KEY, newId);
      return newId;
    }
    
    return this.generateRandomPeerId();
  }
  
  private generateRandomPeerId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().substring(0, 8);
    }
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Verbinde mit dem Raum
   */
  async connect(): Promise<void> {
    try {
      // 1. Raum joinen; wenn nicht vorhanden zuerst anlegen, dann erneut joinen.
      
      try {
        await this.joinRoom();
        console.log('[CoreDeltaProvider] Existierendem Raum beigetreten:', this.roomCode);
      } catch (joinError) {
        console.log('[CoreDeltaProvider] Raum existiert nicht, erstelle neu:', this.roomCode);

        await this.createRoom();
        console.log('[CoreDeltaProvider] Raum erstellt:', this.roomCode);

        // Server braucht ggf. kurz Zeit, um die Map zu generieren (ensureServerGeneratedRoomMap).
        // Retry mit exponential backoff (500ms, 1500ms, 3000ms).
        const retryDelays = [500, 1500, 3000];
        let joined = false;
        for (let i = 0; i < retryDelays.length; i++) {
          await new Promise((r) => setTimeout(r, retryDelays[i]));
          try {
            await this.joinRoom();
            joined = true;
            console.log(`[CoreDeltaProvider] Raum beigetreten nach Retry ${i + 1}`);
            break;
          } catch (retryErr) {
            console.warn(`[CoreDeltaProvider] joinRoom Retry ${i + 1}/${retryDelays.length} fehlgeschlagen:`, retryErr instanceof Error ? retryErr.message : retryErr);
          }
        }
        if (!joined) {
          throw new Error('SERVER_MAP_NOT_READY');
        }
      }
      
      // 2. Delta-Queue initialisieren (mit Echtzeit-Spieler-Updates, Spielername und Stats)
      deltaQueue.init(
        this.roomCode,
        this.municipalitySlug,
        sendDeltaBatch,
        (deltas) => this.handleRemoteDeltas(deltas),
        (players) => this.handlePlayersUpdate(players),
        this.playerName,
        (stats) => this.handleStatsUpdate(stats),
        this.isViewOnly
      );
      deltaQueue.setOnConnectionStatusChange((connected, reason) => {
        if (this.destroyed) return;
        if (this.connected !== connected) {
          this.connected = connected;
          this.options.onConnectionChange?.(connected, this.players.length);
        }
        if (!connected && reason) {
          emitProviderLog('error', `❌ WebSocket getrennt (${reason})`);
        }
      });

      // Sehr wichtig: Nach Initial-Load die Delta-Queue auf die bekannte
      // Server-Version setzen, damit nicht beim ersten Place die komplette
      // Historie (z.B. Terrain-Items) als "neu" zurückkommt.
      if (this.initialServerVersion > 0) {
        deltaQueue.setServerVersion(this.initialServerVersion);
      }
      
      // 3. Spieler registrieren
      await this.registerPlayer();
      
      // 4. Heartbeat starten (alle 10s)
      this.startHeartbeat();
      
      this.connected = true;
      this.options.onConnectionChange?.(true, this.players.length);
      
      console.log('[CoreDeltaProvider] Verbunden mit Raum:', this.roomCode);
      emitProviderLog('info', `🔗 Verbunden mit Raum ${this.roomCode}`, {
        roomCode: this.roomCode,
        municipality: this.municipalitySlug,
        players: this.players.length,
      });
    } catch (error) {
      console.error('[CoreDeltaProvider] Verbindungsfehler:', error);
      emitProviderLog('error', `❌ Verbindungsfehler`, { error: error instanceof Error ? error.message : 'Unbekannt' });
      this.options.onError?.(error instanceof Error ? error.message : 'Verbindungsfehler');
      throw error;
    }
  }
  
  /**
   * Raum erstellen (ohne Blob - Items sind die einzige Datenquelle)
   */
  private async createRoom(): Promise<void> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    
    const url = `${API_BASE_URL}/municipality/${this.municipalitySlug}/rooms`;
    
    console.log('[CoreDeltaProvider] Erstelle Raum:', {
      url: url,
      roomCode: this.roomCode,
      municipality: this.municipalitySlug,
      cityName: this.cityName,
    });
    
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'X-Game-Token': token } : {}),
        },
        body: JSON.stringify({
          room_code: this.roomCode,
          city_name: this.cityName,
          game_state: '{}', // Minimal-Platzhalter, Items sind die Quelle
        }),
      }
    );
    
    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
    
    if (!response.ok) {
      if (response.status === 409 || response.status === 422) {
        console.log('[CoreDeltaProvider] Raum existiert bereits');
        return;
      }
      
      console.error('[CoreDeltaProvider] Raum erstellen fehlgeschlagen:', {
        status: response.status,
        data: responseData,
      });
      
      throw new Error(`Raum konnte nicht erstellt werden: ${response.status}`);
    }
    
    console.log('[CoreDeltaProvider] Raum erfolgreich erstellt');
  }

  /**
   * Raum beitreten und State aus game_items laden (server-generiert).
   */
  private async joinRoom(): Promise<void> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    
    const loaded = await this.tryLoadFromItems(token);
    if (loaded) {
      console.log('[CoreDeltaProvider] ✅ Map aus game_items geladen');
      return;
    }
    throw new Error('SERVER_MAP_NOT_READY');
  }

  /**
   * Metadata (gridSize, stats, version) ohne Items laden → schneller Initial-Load.
   * Chunks werden danach lazy vom ChunkManager geladen.
   * @returns true wenn Raum existiert und Metadata geladen, false wenn Raum nicht gefunden
   */
  private async tryLoadFromItems(token: string | null): Promise<boolean> {
    try {
      // meta_only=1: Server gibt nur Metadata zurück (kein Item-Fetch → schnell)
      const url = `${API_BASE_URL}/municipality/${this.municipalitySlug}/items/${this.roomCode}?meta_only=1`;
      console.log('[CoreDeltaProvider] 🗄️ Lade Metadata (meta_only):', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'X-Game-Token': token } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('ROOM_NOT_FOUND');
        }
        console.warn('[CoreDeltaProvider] Items-Endpoint Fehler:', response.status);
        return false;
      }

      const json = await response.json();

      const isSuccessResponse = json.success || json.ok;
      if (!isSuccessResponse || !json.data) {
        console.warn('[CoreDeltaProvider] Items-Response nicht erfolgreich:', { success: json.success, ok: json.ok, hasData: !!json.data });
        return false;
      }

      const itemsData: ItemsApiResponse & { meta_only?: boolean } = json.data;

      // Kein gridSize = Server hat Map noch nicht generiert → Raum neu anlegen
      if (!itemsData.grid_size || itemsData.grid_size < 1) {
        return false;
      }

      console.log('[CoreDeltaProvider] 🗄️ Metadata geladen:', {
        gridSize: itemsData.grid_size,
        version: itemsData.version,
        city: itemsData.city_name,
      });
      this.initialServerVersion = Number(itemsData.version ?? 0);

      // Leeres Grid initialisieren (Items werden via ChunkManager lazy geladen)
      const emptyItemsData: ItemsApiResponse = { ...itemsData, items: [], item_count: 0 };
      const gameState = buildStateFromItems(emptyItemsData) as unknown as MultiplayerGameState;

      console.log('[CoreDeltaProvider] ✅ Leeres Grid aus Metadata erstellt:', {
        gridSize: gameState.gridSize,
      });

      emitProviderLog('info', `🗄️ Metadata geladen (${itemsData.grid_size}×${itemsData.grid_size}), Items werden lazy per Chunk geladen`, {
        gridSize: itemsData.grid_size,
        city: itemsData.city_name,
        version: this.initialServerVersion,
      });

      this.options.onStateReceived?.(gameState);
      return true;

    } catch (e) {
      if (e instanceof Error && e.message === 'ROOM_NOT_FOUND') {
        throw e;
      }
      console.error('[CoreDeltaProvider] Items-Laden fehlgeschlagen:', e);
      return false;
    }
  }

  /**
   * Spieler registrieren - DEAKTIVIERT, WebSocket übernimmt!
   * 
   * Die Spieler-Registrierung läuft komplett über WebSocket.
   * Kein HTTP-Call mehr nötig.
   */
  private async registerPlayer(): Promise<void> {
    // Lokalen Spieler zur Liste hinzufügen
    this.players = [{
      id: this.peerId,
      name: this.playerName,
      color: '#3b82f6',
      joinedAt: Date.now(),
      isHost: this.isCreator,
      isLocal: true,
    }];
    this.options.onPlayersChange?.(this.players);
    console.log('[CoreDeltaProvider] Spieler lokal registriert (WebSocket übernimmt Sync)');
  }
  
  /**
   * Aktualisiere Spielerliste mit isLocal-Flag
   */
  private updatePlayersWithLocalFlag(serverPlayers: Array<{id: string; name: string}>): void {
    const playersWithLocal: Player[] = serverPlayers.map(player => ({
      id: player.id,
      name: player.name,
      color: '#3b82f6',
      joinedAt: Date.now(),
      isHost: player.id === this.peerId && this.isCreator,
      isLocal: player.id === this.peerId,
    }));
    
    // Nur updaten wenn sich was geändert hat
    if (JSON.stringify(playersWithLocal) !== JSON.stringify(this.players)) {
      this.players = playersWithLocal;
      this.options.onPlayersChange?.(this.players);
      console.log('[CoreDeltaProvider] Spieler aktualisiert:', this.players.length, 'Spieler');
    }
  }
  
  /**
   * Callback für Echtzeit-Spieler-Updates vom Delta-Polling
   */
  private handlePlayersUpdate(players: Array<{id: string; name: string}>): void {
    this.updatePlayersWithLocalFlag(players);
  }

  /**
   * Callback für Stats-Updates von anderen Spielern
   */
  private handleStatsUpdate(stats: GameStatsData): void {
    console.log('[CoreDeltaProvider] 📊 Stats-Update empfangen:', {
      money: stats.money,
      population: stats.population,
      year: stats.year,
    });
    
    // Stats an den Context weiterleiten
    this.options.onStatsReceived?.(stats);
  }

  /**
   * Heartbeat - DEAKTIVIERT, alles läuft über WebSocket!
   * 
   * Spieler-Präsenz wird vom WebSocket-Server getrackt.
   * Die Core API wird für DB-Persistenz (Laden/Speichern) verwendet.
   */
  private startHeartbeat(): void {
    // KEIN HTTP-Heartbeat mehr - WebSocket übernimmt alles!
    console.log('[CoreDeltaProvider] Heartbeat deaktiviert - WebSocket übernimmt');
  }

  /**
   * Verarbeite Deltas von anderen Spielern
   */
  private handleRemoteDeltas(deltas: DeltaAction[]): void {
    console.log('[CoreDeltaProvider] 📥 handleRemoteDeltas aufgerufen, Anzahl:', deltas.length);
    
    if (deltas.length > 0) {
      emitProviderLog('receive', `📥 ${deltas.length} Delta(s) von anderen Spielern empfangen`, 
        deltas.map(d => ({
          type: d.type,
          ...('x' in d ? { x: d.x } : {}),
          ...('y' in d ? { y: d.y } : {}),
          playerId: d.playerId,
          ...(d.type === 'place' && 'tool' in d ? { tool: d.tool } : {}),
          ...(d.type === 'zone' && 'zone' in d ? { zone: d.zone } : {}),
        }))
      );
    }
    
    for (const delta of deltas) {
      // Konvertiere Delta zu GameAction
      let action: GameAction | null = null;
      
      if (delta.type === 'place' && 'tool' in delta) {
        action = {
          type: 'place',
          x: delta.x,
          y: delta.y,
          tool: delta.tool,
          playerId: delta.playerId || 'unknown',
          timestamp: delta.timestamp,
        };
      } else if (delta.type === 'bulldoze') {
        action = {
          type: 'bulldoze',
          x: delta.x,
          y: delta.y,
          playerId: delta.playerId || 'unknown',
          timestamp: delta.timestamp,
        };
      } else if (delta.type === 'zone' && 'zone' in delta) {
        // Zone zu Tool konvertieren
        const zoneToolMap: Record<string, MultiplayerTool> = {
          'residential': 'zone_residential',
          'commercial': 'zone_commercial',
          'industrial': 'zone_industrial',
          'none': 'zone_dezone',
        };
        action = {
          type: 'place',
          x: delta.x,
          y: delta.y,
          tool: zoneToolMap[delta.zone] || 'zone_dezone',
          playerId: delta.playerId || 'unknown',
          timestamp: delta.timestamp,
        };
      } else if (delta.type === 'bauzone' && 'enabled' in delta) {
        action = {
          type: 'place',
          x: delta.x,
          y: delta.y,
          tool: delta.enabled ? 'bauzone' : 'bauzone_remove',
          playerId: delta.playerId || 'unknown',
          timestamp: delta.timestamp,
        };
      }
      
      if (action) {
        this.options.onAction?.(action);
      }
    }
  }

  /**
   * Sende eine Aktion (wird via Delta-Queue an Server gesendet)
   */
  dispatchAction(action: GameActionInput): void {
    if (!this.connected || this.destroyed) {
      console.warn('[CoreDeltaProvider] ⚠️ dispatchAction ignoriert - connected:', this.connected, 'destroyed:', this.destroyed);
      return;
    }
    
    console.log('[CoreDeltaProvider] 📤 dispatchAction:', action.type);
    
    // Konvertiere GameAction zu Delta
    if (action.type === 'place' && 'tool' in action && (action.tool === 'bauzone' || action.tool === 'bauzone_remove')) {
      deltaQueue.push({ type: 'bauzone', x: action.x, y: action.y, enabled: action.tool === 'bauzone' });
      emitProviderLog('action', `⚡ BAUZONE: ${action.tool === 'bauzone' ? 'SET' : 'REMOVE'} @ (${action.x}, ${action.y})`);
    } else if (action.type === 'place' && 'tool' in action) {
      const zoneMap: Record<string, 'residential' | 'commercial' | 'industrial' | 'none'> = {
        'zone_residential': 'residential',
        'zone_commercial': 'commercial',
        'zone_industrial': 'industrial',
        'zone_dezone': 'none',
      };
      if (action.tool === 'zone_water' || action.tool === 'zone_land') {
        // Terrain-Wasser/Land als place-Delta senden
        deltaQueue.push({ type: 'place', tool: action.tool as Tool, x: action.x, y: action.y });
        emitProviderLog('action', `⚡ TERRAIN: ${action.tool} @ (${action.x}, ${action.y})`);
      } else if (action.tool.startsWith('zone_')) {
        const zone = zoneMap[action.tool];
        if (zone) {
          deltaQueue.push({ type: 'zone', zone, x: action.x, y: action.y });
          emitProviderLog('action', `⚡ ZONE: ${zone} @ (${action.x}, ${action.y})`);
        }
      } else {
        deltaQueue.push(buildPlaceDelta(action.tool, action.x, action.y));
        emitProviderLog('action', `⚡ PLACE: ${action.tool} @ (${action.x}, ${action.y})`);
      }
    } else if (action.type === 'bulldoze') {
      deltaQueue.push({ type: 'bulldoze', x: action.x, y: action.y });
      emitProviderLog('action', `⚡ BULLDOZE @ (${action.x}, ${action.y})`);
    } else if (action.type === 'placeBatch' && 'placements' in action) {
      emitProviderLog('action', `⚡ BATCH: ${action.placements.length} Platzierungen`);
      for (const p of action.placements) {
        const zoneMap: Record<string, 'residential' | 'commercial' | 'industrial' | 'none'> = {
          'zone_residential': 'residential',
          'zone_commercial': 'commercial',
          'zone_industrial': 'industrial',
          'zone_dezone': 'none',
        };
        if (p.tool === 'zone_water' || p.tool === 'zone_land') {
          deltaQueue.push({ type: 'place', tool: p.tool as Tool, x: p.x, y: p.y });
        } else if (p.tool.startsWith('zone_')) {
          const zone = zoneMap[p.tool];
          if (zone) deltaQueue.push({ type: 'zone', zone, x: p.x, y: p.y });
        } else {
          deltaQueue.push(buildPlaceDelta(p.tool, p.x, p.y));
        }
      }
    }
    // Andere Aktionen (setTaxRate, setBudget, etc.) werden noch nicht unterstützt
  }

  /**
   * Game State updaten - No-Op
   * 
   * Kein Blob-Backup mehr nötig: Alle Änderungen werden in Echtzeit
   * als einzelne game_items über das Delta-System in SQL geschrieben.
   */
  updateGameState(_state: MultiplayerGameState): void {
    // No-Op: Items werden in Echtzeit über receiveDeltaBatch gespeichert
  }

  /**
   * Verbindung trennen
   */
  destroy(): void {
    this.destroyed = true;
    
    // Heartbeat stoppen
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Delta-Queue stoppen
    deltaQueue.setOnConnectionStatusChange(null);
    deltaQueue.stop();
    
    // Spieler abmelden
    this.unregisterPlayer();
    
    this.connected = false;
    this.options.onConnectionChange?.(false, 0);
    
    console.log('[CoreDeltaProvider] Verbindung getrennt');
  }

  /**
   * Spieler abmelden - DEAKTIVIERT, WebSocket übernimmt!
   */
  private unregisterPlayer(): void {
    // WebSocket disconnect informiert automatisch den Server
    console.log('[CoreDeltaProvider] Spieler abgemeldet (WebSocket disconnect)');
  }
}
