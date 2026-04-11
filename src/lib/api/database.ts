/**
 * Database Utilities für IsoCity
 * 
 * Municipality-Management und Legacy-Stubs.
 * 
 * WICHTIG: Blob-basierte Speicherung ist entfernt.
 * Alle Map-Daten werden als einzelne game_items in SQL gespeichert.
 * Die Blob-Funktionen sind nur noch als No-Op Stubs für Legacy-Provider vorhanden.
 */

import { MultiplayerGameState } from '../multiplayer/types';

// Current municipality slug (wird vom Game gesetzt)
let currentMunicipalitySlug: string = 'zurich'; // Default

/**
 * Setze die aktuelle Gemeinde für alle API Calls
 */
export function setCurrentMunicipality(slug: string): void {
  currentMunicipalitySlug = slug;
}

export function getCurrentMunicipality(): string {
  return currentMunicipalitySlug;
}

// Maximum city size limit (Legacy, wird noch von anderen Providern referenziert)
const MAX_CITY_SIZE_BYTES = 20 * 1024 * 1024;

export class CitySizeLimitError extends Error {
  public readonly sizeBytes: number;
  public readonly limitBytes: number;
  
  constructor(sizeBytes: number, limitBytes: number = MAX_CITY_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(0);
    super(`City size (${sizeMB}MB) exceeds maximum allowed size (${limitMB}MB)`);
    this.name = 'CitySizeLimitError';
    this.sizeBytes = sizeBytes;
    this.limitBytes = limitBytes;
  }
}

// ==========================================
// LEGACY STUBS (No-Op) - Werden von alten Providern importiert
// Alle Map-Daten laufen jetzt über game_items (Delta-System)
// ==========================================

export interface GameRoomRow {
  room_code: string;
  city_name: string;
  game_state: string;
  created_at: string;
  updated_at: string;
  player_count: number;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function createGameRoom(
  _roomCode: string,
  _cityName: string,
  _gameState: MultiplayerGameState
): Promise<boolean> {
  console.warn('[Database] createGameRoom ist deprecated – Items sind die Datenquelle');
  return false;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function loadGameRoom(
  _roomCode: string
): Promise<{ gameState: MultiplayerGameState; cityName: string } | null> {
  console.warn('[Database] loadGameRoom ist deprecated – Items sind die Datenquelle');
  return null;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function updateGameRoom(
  _roomCode: string,
  _gameState: MultiplayerGameState
): Promise<boolean> {
  // No-Op: Kein Blob-Speichern mehr
  return true;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function roomExists(_roomCode: string): Promise<boolean> {
  return false;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function updatePlayerCount(
  _roomCode: string,
  _count: number
): Promise<void> {
  // No-Op
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function deleteGameRoom(_roomCode: string): Promise<boolean> {
  return false;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function listGameRooms(): Promise<GameRoomRow[]> {
  return [];
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function saveGameStateSecure(
  _roomCode: string,
  _gameState: MultiplayerGameState,
  _cityName?: string
): Promise<boolean> {
  return false;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function autoSaveGameState(
  _roomCode: string,
  _gameState: MultiplayerGameState
): Promise<boolean> {
  return false;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function sendBuildAction(
  _roomCode: string,
  _tool: string,
  _x: number,
  _y: number
): Promise<boolean> {
  return false;
}

/** @deprecated Blob-Speicherung entfernt. Stub für Legacy-Provider. */
export async function sendBatchActions(
  _roomCode: string,
  _actions: Array<{ type: 'build' | 'bulldoze'; tool?: string; x: number; y: number }>
): Promise<number> {
  return 0;
}
