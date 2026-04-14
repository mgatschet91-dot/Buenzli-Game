/**
 * Einfache Bridge: CanvasIsometricGrid registriert eine Spawn-Funktion,
 * useMultiplayerSync ruft sie auf wenn ein geparktes Auto wegfährt.
 */
export const spawnCarFromParkingRef: {
  current: ((tileX: number, tileY: number, color: string) => void) | null;
} = { current: null };
