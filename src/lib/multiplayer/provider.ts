/**
 * Multiplayer Provider Factory
 * 
 * Wählt automatisch den richtigen Provider basierend auf Konfiguration:
 * - CoreDelta: Server-basiertes Multiplayer über Delta-Sync (empfohlen)
 * - Supabase: Wenn NEXT_PUBLIC_SUPABASE_URL konfiguriert ist (Realtime Multiplayer)
 * - Core: Fallback für Single-Player mit MySQL-Speicherung
 * 
 * Setze NEXT_PUBLIC_MULTIPLAYER_MODE='core-delta' für Server-basiertes Multiplayer
 */

import {
  GameAction,
  GameActionInput,
  Player,
  MultiplayerGameState,
} from './types';

// Check which backend is available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const multiplayerMode = process.env.NEXT_PUBLIC_MULTIPLAYER_MODE || 'auto';

// Bestimme welcher Provider verwendet wird
const useCoreDelta = multiplayerMode === 'core-delta' || multiplayerMode === 'laravel-delta';
const useSupabase = !useCoreDelta && !!(supabaseUrl && supabaseKey);

const backendName = useCoreDelta 
  ? 'Core Delta (Server-basiert)' 
  : useSupabase 
    ? 'Supabase (Realtime)' 
    : 'Core (MySQL)';


export interface MultiplayerProviderOptions {
  roomCode: string;
  cityName: string;
  municipalitySlug?: string;
  playerName?: string;
  initialGameState?: MultiplayerGameState;
  isViewOnly?: boolean; // SICHERHEIT: Wenn true, kann dieser Spieler keine Änderungen speichern
  onConnectionChange?: (connected: boolean, peerCount: number) => void;
  onPlayersChange?: (players: Player[]) => void;
  onAction?: (action: GameAction) => void;
  onStateReceived?: (state: MultiplayerGameState) => void;
  onStatsReceived?: (stats: GameStatsData) => void;
  onError?: (error: string) => void;
}

// Stats-Datentyp für Synchronisation
export interface GameStatsData {
  money: number;
  income: number;
  expenses: number;
  taxRate: number;
  population: number;
  maxPopulation: number;
  populationGrowth: number;
  homeless: number;
  jobs: number;
  employed: number;
  unemployed: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  year?: number;
  month?: number;
}

/**
 * Common interface for both providers
 */
export interface IMultiplayerProvider {
  readonly roomCode: string;
  readonly peerId: string;
  readonly isCreator: boolean;
  
  connect(): Promise<void>;
  dispatchAction(action: GameActionInput): void;
  updateGameState(state: MultiplayerGameState): void;
  destroy(): void;
}

/**
 * Create the appropriate provider based on configuration
 */
export async function createMultiplayerProvider(
  options: MultiplayerProviderOptions
): Promise<IMultiplayerProvider> {
  if (useCoreDelta) {
    const { CoreDeltaProvider } = await import('./coreDeltaProvider');
    const provider = new CoreDeltaProvider(options);
    await provider.connect();
    return provider;
  } else if (useSupabase) {
    const { MultiplayerProvider } = await import('./supabaseProvider');
    const provider = new MultiplayerProvider(options);
    await provider.connect();
    return provider;
  } else {
    const { CoreProvider } = await import('./coreProvider');
    const provider = new CoreProvider(options);
    await provider.connect();
    return provider;
  }
}

/**
 * Check if realtime multiplayer is available
 */
export function isRealtimeMultiplayerAvailable(): boolean {
  return useCoreDelta || useSupabase;
}

/**
 * Get the current backend type
 */
export function getBackendType(): 'core-delta' | 'supabase' | 'core' {
  if (useCoreDelta) return 'core-delta';
  if (useSupabase) return 'supabase';
  return 'core';
}

// Re-export types
export type { MultiplayerGameState, GameAction, GameActionInput, Player };
export { CitySizeLimitError } from '../api/database';
