/**
 * WebSocket Multiplayer Provider
 * 
 * Nutzt Socket.io für Echtzeit-Synchronisierung.
 * Viel schneller und zuverlässiger als SSE/Polling!
 * 
 * Speicherung läuft weiterhin über die Core API.
 */

import { io, Socket } from 'socket.io-client';
import { DeltaAction } from '../deltaSync';

// WebSocket Server URL
const WS_SERVER_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://127.0.0.1:4100';

export interface WebSocketProviderOptions {
  roomCode: string;
  municipalitySlug: string;
  clientId: string;
  playerName?: string;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onDelta?: (delta: DeltaAction) => void;
  onDeltas?: (deltas: DeltaAction[]) => void;
  onPlayerJoined?: (data: { playerId: string; playerName: string; playerCount: number }) => void;
  onPlayerLeft?: (data: { playerId: string; playerName: string; playerCount: number }) => void;
  onStatsUpdate?: (stats: Record<string, unknown>) => void;
  onReconnect?: () => void;
  onError?: (error: string) => void;
}

export class WebSocketProvider {
  private socket: Socket | null = null;
  private options: WebSocketProviderOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnected = false;

  constructor(options: WebSocketProviderOptions) {
    this.options = options;
  }

  /**
   * Verbindung herstellen
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Bereits verbunden');
      return;
    }

    console.log('[WebSocket] 🔌 Verbinde zu', WS_SERVER_URL);

    this.socket = io(WS_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupEventHandlers();
  }

  /**
   * Event-Handler einrichten
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Verbindung hergestellt
    this.socket.on('connect', () => {
      console.log('[WebSocket] ✅ Verbunden:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Raum beitreten
      this.joinRoom();

      this.options.onConnect?.();
    });

    // Raum beigetreten
    this.socket.on('room-joined', (data) => {
      console.log('[WebSocket] 🏠 Raum beigetreten:', data);
    });

    // Delta empfangen (einzeln)
    this.socket.on('delta', (delta: DeltaAction) => {
      console.log('[WebSocket] 📥 Delta empfangen:', delta.type);
      this.options.onDelta?.(delta);
    });

    // Deltas empfangen (batch)
    this.socket.on('deltas', (deltas: DeltaAction[]) => {
      console.log('[WebSocket] 📥 Deltas empfangen:', deltas.length);
      this.options.onDeltas?.(deltas);
    });

    // Stats-Update
    this.socket.on('stats-update', (stats) => {
      this.options.onStatsUpdate?.(stats);
    });

    // Spieler beigetreten
    this.socket.on('player-joined', (data) => {
      console.log('[WebSocket] 👋 Spieler beigetreten:', data.playerName);
      this.options.onPlayerJoined?.(data);
    });

    // Spieler verlassen
    this.socket.on('player-left', (data) => {
      console.log('[WebSocket] 👋 Spieler verlassen:', data.playerName);
      this.options.onPlayerLeft?.(data);
    });

    // Fehler
    this.socket.on('error', (error) => {
      console.error('[WebSocket] ❌ Fehler:', error);
      this.options.onError?.(error.message || 'Unbekannter Fehler');
    });

    // Verbindung getrennt
    this.socket.on('disconnect', (reason) => {
      const reasonMap: Record<string, string> = {
        'transport close': 'Netzwerkausfall',
        'ping timeout': 'Server antwortet nicht (Timeout)',
        'server namespace disconnect': 'Vom Server getrennt (z.B. force-disconnect)',
        'io client disconnect': 'Client hat getrennt',
        'transport error': 'Transportfehler',
      };
      console.warn('[WebSocket] Getrennt —', reasonMap[reason] || reason);
      this.isConnected = false;
      this.options.onDisconnect?.(reason);
    });

    // Reconnect-Versuch
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log('[WebSocket] 🔄 Reconnect Versuch:', attempt);
      this.reconnectAttempts = attempt;
    });

    // Reconnect erfolgreich
    this.socket.on('reconnect', () => {
      console.log('[WebSocket] ✅ Reconnect erfolgreich');
      this.joinRoom();
      this.options.onReconnect?.();
    });

    // Reconnect fehlgeschlagen
    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] ❌ Reconnect endgültig fehlgeschlagen');
      this.options.onError?.('Verbindung konnte nicht wiederhergestellt werden');
    });
  }

  /**
   * Raum beitreten
   */
  private joinRoom(): void {
    if (!this.socket?.connected) return;

    this.socket.emit('join-room', {
      roomCode: this.options.roomCode,
      municipalitySlug: this.options.municipalitySlug,
      clientId: this.options.clientId,
      name: this.options.playerName,
    });
  }

  /**
   * Delta senden
   */
  sendDelta(delta: DeltaAction): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] Nicht verbunden, Delta wird nicht gesendet');
      return;
    }

    this.socket.emit('delta', delta);
  }

  /**
   * Mehrere Deltas senden
   */
  sendDeltas(deltas: DeltaAction[]): void {
    if (!this.socket?.connected || deltas.length === 0) return;

    this.socket.emit('deltas', deltas);
  }

  /**
   * Stats-Update senden
   */
  sendStatsUpdate(stats: Record<string, unknown>): void {
    if (!this.socket?.connected) return;

    this.socket.emit('stats-update', stats);
  }

  /**
   * Verbindungsstatus
   */
  get connected(): boolean {
    return this.isConnected && (this.socket?.connected ?? false);
  }

  /**
   * Verbindung trennen
   */
  disconnect(): void {
    if (this.socket) {
      console.log('[WebSocket] 🔌 Verbindung trennen');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Singleton-Instanz für einfache Nutzung
let wsProviderInstance: WebSocketProvider | null = null;

export function getWebSocketProvider(): WebSocketProvider | null {
  return wsProviderInstance;
}

export function createWebSocketProvider(options: WebSocketProviderOptions): WebSocketProvider {
  // Alte Instanz beenden
  if (wsProviderInstance) {
    wsProviderInstance.disconnect();
  }

  wsProviderInstance = new WebSocketProvider(options);
  return wsProviderInstance;
}

export function disconnectWebSocket(): void {
  if (wsProviderInstance) {
    wsProviderInstance.disconnect();
    wsProviderInstance = null;
  }
}
