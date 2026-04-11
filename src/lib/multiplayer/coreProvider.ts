/**
 * Core API Provider für IsoCity
 * 
 * Nutzt die Core API für Datenpersistenz.
 * 
 * Hinweis: Realtime-Multiplayer (WebSockets) ist noch nicht implementiert.
 * Dieser Provider funktioniert für Single-Player mit Server-Speicherung.
 */

import {
  GameAction,
  GameActionInput,
  Player,
  generatePlayerId,
  generatePlayerColor,
  generatePlayerName,
  MultiplayerGameState,
} from './types';
import {
  createGameRoom,
  loadGameRoom,
  updateGameRoom,
  updatePlayerCount,
  CitySizeLimitError,
  setCurrentMunicipality,
} from '../api/database';

// Throttle state saves
const STATE_SAVE_INTERVAL = 3000;

export interface MultiplayerProviderOptions {
  roomCode: string;
  cityName: string;
  municipalitySlug?: string; // Gemeinde-Slug für Core API
  playerName?: string;
  initialGameState?: MultiplayerGameState;
  isViewOnly?: boolean; // SICHERHEIT: Wenn true, kann dieser Spieler keine Änderungen speichern
  onConnectionChange?: (connected: boolean, peerCount: number) => void;
  onPlayersChange?: (players: Player[]) => void;
  onAction?: (action: GameAction) => void;
  onStateReceived?: (state: MultiplayerGameState) => void;
  onError?: (error: string) => void;
}

/**
 * Core API-basierter Provider
 * 
 * Funktioniert als Single-Player mit Server-Speicherung.
 * Keine Echtzeit-Synchronisation (kein WebSocket).
 */
export class CoreProvider {
  public readonly roomCode: string;
  public readonly peerId: string;
  public readonly isCreator: boolean;
  public readonly municipalitySlug: string;

  private player: Player;
  private options: MultiplayerProviderOptions;
  private players: Map<string, Player> = new Map();
  private gameState: MultiplayerGameState | null = null;
  private destroyed = false;
  private connected = false;
  private isViewOnly = false; // SICHERHEIT: Besucher können nichts speichern

  // State save throttling
  private lastStateSave = 0;
  private pendingStateSave: MultiplayerGameState | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MultiplayerProviderOptions) {
    this.options = options;
    this.roomCode = options.roomCode;
    this.peerId = generatePlayerId();
    this.gameState = options.initialGameState || null;
    this.isCreator = !!options.initialGameState;
    this.isViewOnly = options.isViewOnly || false;
    this.municipalitySlug = options.municipalitySlug || 
      process.env.NEXT_PUBLIC_DEFAULT_MUNICIPALITY || 
      'zurich';

    // Set municipality for API calls
    setCurrentMunicipality(this.municipalitySlug);

    // Create player info
    this.player = {
      id: this.peerId,
      name: options.playerName || generatePlayerName(),
      color: generatePlayerColor(),
      joinedAt: Date.now(),
      isHost: true, // In Single-Player mode, we're always the host
    };

    // Add self to players
    this.players.set(this.peerId, this.player);
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    try {
      if (this.isCreator && this.gameState) {
        // Creating a new room
        const success = await createGameRoom(
          this.roomCode,
          this.options.cityName,
          this.gameState
        );
        
        if (!success) {
          const errorMsg = 'Failed to create room in database';
          this.options.onError?.(errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log('[Core] Room created:', this.roomCode);
      } else {
        // Joining/loading an existing room
        const roomData = await loadGameRoom(this.roomCode);
        
        if (!roomData) {
          const errorMsg = 'Room not found';
          this.options.onError?.(errorMsg);
          throw new Error(errorMsg);
        }
        
        this.gameState = roomData.gameState;
        this.options.onStateReceived?.(roomData.gameState);
        console.log('[Core] Room loaded:', this.roomCode);
      }

      // Mark as connected
      this.connected = true;
      
      // Notify connection status
      this.options.onConnectionChange?.(true, 1);
      this.options.onPlayersChange?.(Array.from(this.players.values()));

      // Update player count
      await updatePlayerCount(this.roomCode, 1);

    } catch (e) {
      this.connected = false;
      if (e instanceof CitySizeLimitError) {
        this.options.onError?.(e.message);
      }
      throw e;
    }
  }

  /**
   * Dispatch an action (in single-player, just log it)
   * In multiplayer mode, this would broadcast to other players
   */
  dispatchAction(action: GameActionInput): void {
    if (this.destroyed) return;

    const fullAction: GameAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.peerId,
    };

    // In single-player mode, we don't broadcast
    // But we could log actions for debugging
    console.debug('[Core] Action dispatched:', fullAction.type);
  }

  /**
   * Update game state and save to database (throttled)
   */
  updateGameState(state: MultiplayerGameState): void {
    if (this.destroyed) return;
    
    this.gameState = state;

    const now = Date.now();
    const timeSinceLastSave = now - this.lastStateSave;

    if (timeSinceLastSave >= STATE_SAVE_INTERVAL) {
      this.saveStateToDatabase(state);
    } else {
      this.pendingStateSave = state;

      if (!this.saveTimeout) {
        this.saveTimeout = setTimeout(() => {
          this.saveTimeout = null;
          if (this.pendingStateSave && !this.destroyed) {
            this.saveStateToDatabase(this.pendingStateSave);
            this.pendingStateSave = null;
          }
        }, STATE_SAVE_INTERVAL - timeSinceLastSave);
      }
    }
  }

  private saveStateToDatabase(state: MultiplayerGameState): void {
    // SICHERHEIT: Besucher können nichts speichern
    if (this.isViewOnly) {
      console.log('[Core] ⚠️ Speichern blockiert (ViewOnly Modus)');
      return;
    }
    
    this.lastStateSave = Date.now();
    
    updateGameRoom(this.roomCode, state).catch((e) => {
      if (e instanceof CitySizeLimitError) {
        console.warn('[Core] City too large to save:', e.message);
        this.options.onError?.(e.message);
      } else {
        console.error('[Core] Failed to save state:', e);
      }
    });
  }

  /**
   * Force save current state immediately
   */
  async forceSave(): Promise<boolean> {
    // SICHERHEIT: Besucher können nichts speichern
    if (this.isViewOnly) {
      console.log('[Core] ⚠️ Force-Save blockiert (ViewOnly Modus)');
      return false;
    }
    
    if (!this.gameState) return false;
    
    try {
      const success = await updateGameRoom(this.roomCode, this.gameState);
      if (success) {
        this.lastStateSave = Date.now();
        console.log('[Core] Force saved successfully');
      }
      return success;
    } catch (e) {
      console.error('[Core] Force save failed:', e);
      return false;
    }
  }

  /**
   * Get current game state
   */
  getGameState(): MultiplayerGameState | null {
    return this.gameState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && !this.destroyed;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Save pending state (nur wenn berechtigt)
    if (!this.isViewOnly && this.pendingStateSave) {
      this.saveStateToDatabase(this.pendingStateSave);
      this.pendingStateSave = null;
    }

    // Clear timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.connected = false;
    console.log('[Core] Provider destroyed');
  }
}

/**
 * Create and connect a Core API provider
 */
export async function createCoreProvider(
  options: MultiplayerProviderOptions
): Promise<CoreProvider> {
  const provider = new CoreProvider(options);
  await provider.connect();
  return provider;
}

// Re-export for compatibility
export { CitySizeLimitError };
