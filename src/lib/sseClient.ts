/**
 * Server-Sent Events Client für Echtzeit-Delta-Sync
 * 
 * Statt Polling (viele HTTP-Requests) nutzen wir eine dauerhafte
 * Verbindung zum Server. Neue Deltas werden sofort gepusht.
 * 
 * Latenz: ~100ms statt ~1-2 Sekunden bei Polling!
 */

import { DeltaAction } from './deltaSync';

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

export interface SSEClientOptions {
  roomCode: string;
  municipalitySlug: string;
  clientId: string;
  sinceVersion?: number;
  onDeltas: (deltas: DeltaAction[], serverVersion: number) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private options: SSEClientOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private currentVersion = 0;
  private isDestroyed = false;

  constructor(options: SSEClientOptions) {
    this.options = options;
    this.currentVersion = options.sinceVersion || 0;
  }

  /**
   * Verbindung zum SSE-Stream herstellen
   */
  connect(): void {
    if (this.isDestroyed) return;
    
    const url = `${API_BASE_URL}/municipality/${this.options.municipalitySlug}/deltas/${this.options.roomCode}/stream?client_id=${this.options.clientId}&since=${this.currentVersion}`;
    
    console.log('[SSE] 🔌 Verbinde zu:', url);
    
    try {
      this.eventSource = new EventSource(url);
      
      // Connection opened
      this.eventSource.addEventListener('connected', (event) => {
        console.log('[SSE] ✅ Verbunden:', JSON.parse(event.data));
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.options.onConnected?.();
      });
      
      // Receive deltas
      this.eventSource.addEventListener('deltas', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] 📥 Deltas empfangen:', data.deltas?.length);
          
          if (data.deltas && data.deltas.length > 0) {
            this.currentVersion = data.serverVersion;
            this.options.onDeltas(data.deltas, data.serverVersion);
          }
        } catch (e) {
          console.error('[SSE] Fehler beim Parsen:', e);
        }
      });
      
      // Heartbeat
      this.eventSource.addEventListener('heartbeat', (event) => {
        // Just keep alive, no action needed
        // console.log('[SSE] 💓 Heartbeat');
      });
      
      // Server requests reconnect
      this.eventSource.addEventListener('reconnect', (event) => {
        console.log('[SSE] 🔄 Server fordert Reconnect an');
        this.reconnect();
      });
      
      // Error handling
      this.eventSource.onerror = (error) => {
        console.error('[SSE] ❌ Verbindungsfehler:', error);
        this.options.onDisconnected?.();
        
        // Try to reconnect
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      };
      
      // Open event
      this.eventSource.onopen = () => {
        console.log('[SSE] 🟢 Stream geöffnet');
      };
      
    } catch (error) {
      console.error('[SSE] ❌ Fehler beim Verbinden:', error);
      this.options.onError?.(error instanceof Error ? error : new Error('Connection failed'));
      this.scheduleReconnect();
    }
  }

  /**
   * Reconnect nach Verbindungsabbruch
   */
  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[SSE] ⛔ Max Reconnect-Versuche erreicht');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    
    console.log(`[SSE] 🔄 Reconnect in ${delay}ms (Versuch ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.reconnect();
      }
    }, delay);
  }

  /**
   * Reconnect
   */
  private reconnect(): void {
    this.disconnect();
    this.connect();
  }

  /**
   * Verbindung trennen
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[SSE] 🔴 Verbindung getrennt');
    }
  }

  /**
   * Client zerstören (cleanup)
   */
  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
  }

  /**
   * Aktuelle Server-Version setzen (nach manuellem Sync)
   */
  setVersion(version: number): void {
    this.currentVersion = version;
  }

  /**
   * Ist verbunden?
   */
  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

/**
 * Factory-Funktion für SSE-Client
 */
export function createSSEClient(options: SSEClientOptions): SSEClient {
  const client = new SSEClient(options);
  client.connect();
  return client;
}
