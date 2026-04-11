'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  IMultiplayerProvider,
  createMultiplayerProvider,
  isRealtimeMultiplayerAvailable,
  getBackendType,
} from '@/lib/multiplayer/provider';
import {
  GameAction,
  GameActionInput,
  Player,
  ConnectionState,
  RoomData,
  MultiplayerGameState,
} from '@/lib/multiplayer/types';
import { useGT } from 'gt-next';

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

// Log backend type on load
if (typeof window !== 'undefined') {
  console.log('[Multiplayer] Backend:', getBackendType(), 
    isRealtimeMultiplayerAvailable() ? '(Realtime enabled)' : '(Single-player mode)');
}

// Generate a random 5-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Stats-Datentyp für Synchronisation (vereinfacht)
interface RemoteStats {
  money: number;
  population: number;
  year?: number;
  month?: number;
  taxRate?: number;
  gameMapData?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface MultiplayerContextValue {
  // Connection state
  connectionState: ConnectionState;
  roomCode: string | null;
  municipalitySlug: string;
  players: Player[];
  error: string | null;
  
  // SICHERHEIT: Wenn true, kann dieser Spieler keine Änderungen speichern
  isViewOnly: boolean;

  // Actions
  createRoom: (cityName: string, initialState: MultiplayerGameState, customRoomCode?: string, isViewOnly?: boolean) => Promise<string>;
  joinRoom: (roomCode: string, isViewOnly?: boolean) => Promise<RoomData>;
  createOrJoinRoom: (roomCode: string, cityName: string, initialState: MultiplayerGameState, isViewOnly?: boolean) => Promise<string>;
  leaveRoom: () => void;
  
  // Game action dispatch
  dispatchAction: (action: GameActionInput) => void;
  
  // Initial state for new players
  initialState: MultiplayerGameState | null;
  
  // Callback for when remote actions are received
  onRemoteAction: ((action: GameAction) => void) | null;
  setOnRemoteAction: (callback: ((action: GameAction) => void) | null) => void;
  
  // Stats sync - empfangene Stats von anderen Spielern
  remoteStats: RemoteStats | null;
  setOnStatsReceived: (callback: ((stats: RemoteStats) => void) | null) => void;
  
  // Update the game state (any player can do this now)
  updateGameState: (state: MultiplayerGameState) => void;
  
  // Provider instance (for advanced usage)
  provider: IMultiplayerProvider | null;
  
  // Legacy compatibility - always false now since there's no host
  isHost: boolean;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

/**
 * Hole den Municipality-Slug aus der URL
 */
function getMunicipalitySlugFromUrl(): string {
  if (typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/\/gemeinde\/([^\/]+)/);
    if (pathMatch?.[1]) return pathMatch[1];
  }
  return process.env.NEXT_PUBLIC_DEFAULT_MUNICIPALITY || 'zurich';
}

export function MultiplayerContextProvider({
  children,
  playerName,
  municipalitySlug: propMunicipalitySlug,
}: {
  children: React.ReactNode;
  playerName?: string;
  municipalitySlug?: string;
}) {
  const gt = useGT();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  
  // Municipality Slug - von Prop oder aus URL
  const municipalitySlug = propMunicipalitySlug || getMunicipalitySlugFromUrl();
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<MultiplayerGameState | null>(null);
  const [provider, setProvider] = useState<IMultiplayerProvider | null>(null);
  const [onRemoteAction, setOnRemoteAction] = useState<((action: GameAction) => void) | null>(null);
  const [remoteStats, setRemoteStats] = useState<RemoteStats | null>(null);
  
  // SICHERHEIT: Wenn true, kann dieser Spieler keine Änderungen speichern
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);

  const providerRef = useRef<IMultiplayerProvider | null>(null);
  const onRemoteActionRef = useRef<((action: GameAction) => void) | null>(null);
  const onStatsReceivedRef = useRef<((stats: RemoteStats) => void) | null>(null);
  
  // Queue für verpasste Aktionen (vor Callback-Registrierung)
  const pendingActionsRef = useRef<GameAction[]>([]);

  // Set up remote action callback
  const handleSetOnRemoteAction = useCallback(
    (callback: ((action: GameAction) => void) | null) => {
      onRemoteActionRef.current = callback;
      setOnRemoteAction(callback);
      
      // Verpasste Aktionen anwenden
      if (callback && pendingActionsRef.current.length > 0) {
        console.log(`[MultiplayerContext] 📬 Wende ${pendingActionsRef.current.length} verpasste Aktionen an`);
        for (const action of pendingActionsRef.current) {
          callback(action);
        }
        pendingActionsRef.current = [];
      }
    },
    []
  );

  // Set up remote stats callback
  const handleSetOnStatsReceived = useCallback(
    (callback: ((stats: RemoteStats) => void) | null) => {
      onStatsReceivedRef.current = callback;
    },
    []
  );
  
  // Sichere onAction-Handler die auch bei fehlendem Callback funktioniert
  const handleRemoteAction = useCallback((action: GameAction) => {
    if (onRemoteActionRef.current) {
      onRemoteActionRef.current(action);
    } else {
      // Callback noch nicht gesetzt - speichere für später
      console.log('[MultiplayerContext] ⏳ Aktion gepuffert (Callback nicht bereit):', action.type);
      pendingActionsRef.current.push(action);
    }
  }, []);

  // Create a room (first player to start a session)
  const createRoom = useCallback(
    async (cityName: string, gameState: MultiplayerGameState, customRoomCode?: string, viewOnly?: boolean): Promise<string> => {
      setConnectionState('connecting');
      setError(null);
      setRemoteStats(null);
      
      // SICHERHEIT: ViewOnly Status speichern
      const isViewOnlyMode = viewOnly ?? false;
      setIsViewOnly(isViewOnlyMode);

      try {
        // Use custom room code or generate a new one
        const newRoomCode = customRoomCode || generateRoomCode();

        // Create multiplayer provider with initial state
        // State will be saved to database
        const provider = await createMultiplayerProvider({
          roomCode: newRoomCode,
          cityName,
          playerName, // Use logged-in user's name
          municipalitySlug, // Wichtig für richtige Gemeinde-Zuordnung
          initialGameState: gameState,
          isViewOnly: isViewOnlyMode, // SICHERHEIT: Blockiert Speichern für nicht-berechtigte
          onConnectionChange: (connected) => {
            setConnectionState(connected ? 'connected' : 'disconnected');
          },
          onPlayersChange: (newPlayers) => {
            setPlayers(newPlayers);
          },
          onAction: handleRemoteAction,
          onStatsReceived: (stats) => {
            // Stats von anderem Spieler empfangen
            console.log('[MultiplayerContext] 📊 Stats empfangen:', stats);
            setRemoteStats(stats as unknown as RemoteStats);
            if (onStatsReceivedRef.current) {
              onStatsReceivedRef.current(stats as unknown as RemoteStats);
            }
          },
          onError: (errorMsg) => {
            setError(errorMsg);
            setConnectionState('error');
          },
        });

        providerRef.current = provider;
        setProvider(provider);
        setRoomCode(newRoomCode);
        setConnectionState('connected');

        return newRoomCode;
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : gt('Failed to create room'));
        throw err;
      }
    },
    [gt, playerName, municipalitySlug, handleRemoteAction]
  );

  // Join an existing room
  const joinRoom = useCallback(
    async (code: string, viewOnly?: boolean): Promise<RoomData> => {
      setConnectionState('connecting');
      setError(null);
      setRemoteStats(null);
      
      // SICHERHEIT: ViewOnly Status speichern
      const isViewOnlyMode = viewOnly ?? false;
      setIsViewOnly(isViewOnlyMode);

      try {
        const normalizedCode = code.toUpperCase();

        // Create multiplayer provider - state will be loaded from database
        const provider = await createMultiplayerProvider({
          roomCode: normalizedCode,
          cityName: gt('Co-op City'),
          playerName, // Use logged-in user's name
          municipalitySlug, // Wichtig für richtige Gemeinde-Zuordnung
          isViewOnly: isViewOnlyMode, // SICHERHEIT: Blockiert Speichern für nicht-berechtigte
          // No initialGameState - we'll load from database
          onConnectionChange: (connected) => {
            setConnectionState(connected ? 'connected' : 'disconnected');
          },
          onPlayersChange: (newPlayers) => {
            setPlayers(newPlayers);
          },
          onAction: handleRemoteAction,
          onStateReceived: (state) => {
            // State loaded from database
            setInitialState(state);
          },
          onStatsReceived: (stats) => {
            // Stats von anderem Spieler empfangen
            console.log('[MultiplayerContext] 📊 Stats empfangen:', stats);
            setRemoteStats(stats as unknown as RemoteStats);
            if (onStatsReceivedRef.current) {
              onStatsReceivedRef.current(stats as unknown as RemoteStats);
            }
          },
          onError: (errorMsg) => {
            setError(errorMsg);
            setConnectionState('error');
          },
        });

        providerRef.current = provider;
        setProvider(provider);
        setRoomCode(normalizedCode);
        setConnectionState('connected');

        // Return room data
        const room: RoomData = {
          code: normalizedCode,
          hostId: '',
          cityName: gt('Co-op City'),
          createdAt: Date.now(),
          playerCount: 1,
        };

        return room;
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : gt('Failed to join room'));
        throw err;
      }
    },
    [gt, playerName, municipalitySlug, handleRemoteAction]
  );

  // Create or join a room - tries to join first, creates if it doesn't exist
  const createOrJoinRoom = useCallback(
    async (code: string, cityName: string, initialState: MultiplayerGameState, viewOnly?: boolean): Promise<string> => {
      const normalizedCode = code.toUpperCase();
      
      try {
        // First try to join existing room
        console.log(`[Multiplayer] Trying to join room: ${normalizedCode}`);
        await joinRoom(normalizedCode, viewOnly);
        console.log(`[Multiplayer] Successfully joined existing room: ${normalizedCode}`);
        return normalizedCode;
      } catch (joinError) {
        // Room doesn't exist - create it
        console.log(`[Multiplayer] Room not found, creating: ${normalizedCode}`);
        try {
          await createRoom(cityName, initialState, normalizedCode, viewOnly);
          console.log(`[Multiplayer] Successfully created room: ${normalizedCode}`);
          return normalizedCode;
        } catch (createError) {
          console.error(`[Multiplayer] Failed to create room: ${normalizedCode}`, createError);
          throw createError;
        }
      }
    },
    [joinRoom, createRoom]
  );

  // Leave the current room
  const leaveRoom = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    setProvider(null);
    setConnectionState('disconnected');
    setRoomCode(null);
    setPlayers([]);
    setError(null);
    setInitialState(null);
    setRemoteStats(null);
  }, []);

  // Dispatch a game action to all peers
  const dispatchAction = useCallback(
    (action: GameActionInput) => {
      if (providerRef.current) {
        console.log('[MultiplayerContext] 📤 dispatchAction:', action.type, action);
        providerRef.current.dispatchAction(action);
      } else {
        console.warn('[MultiplayerContext] ⚠️ dispatchAction called but no provider!', action);
      }
    },
    []
  );

  // Update the game state (nur berechtigte Spieler können speichern)
  const updateGameState = useCallback(
    (state: MultiplayerGameState) => {
      // SICHERHEIT: ViewOnly-Benutzer (Gäste) können nicht speichern
      if (isViewOnly) {
        console.log('[MultiplayerContext] ⚠️ updateGameState blockiert (ViewOnly Modus)');
        return;
      }
      if (providerRef.current) {
        providerRef.current.updateGameState(state);
      }
    },
    [isViewOnly]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, []);

  const value: MultiplayerContextValue = {
    connectionState,
    roomCode,
    municipalitySlug,
    players,
    error,
    isViewOnly,
    createRoom,
    joinRoom,
    createOrJoinRoom,
    leaveRoom,
    dispatchAction,
    initialState,
    onRemoteAction,
    setOnRemoteAction: handleSetOnRemoteAction,
    remoteStats,
    setOnStatsReceived: handleSetOnStatsReceived,
    updateGameState,
    provider,
    isHost: false, // No longer meaningful - kept for compatibility
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerContextProvider');
  }
  return context;
}

// Optional hook that returns null if not in multiplayer context
export function useMultiplayerOptional() {
  return useContext(MultiplayerContext);
}
