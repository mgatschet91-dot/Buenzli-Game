/**
 * Werkhof-Zustandsspeicher (module-level, kein React State)
 * Speichert den Gebäudezustand (condition 0-100) aus dem werkhof-status Event.
 * Wird von TileInfoPanel gelesen, von der werkhof-status-Verarbeitung befüllt.
 */

// Key: "x,y" -> condition (0-100)
const conditionMap = new Map<string, number>();

let _hasWerkhofNpc = false;
export function setHasWerkhofNpc(val: boolean): void { _hasWerkhofNpc = val; }
export function getHasWerkhofNpc(): boolean { return _hasWerkhofNpc; }

export function setCondition(x: number, y: number, condition: number): void {
  conditionMap.set(`${x},${y}`, condition);
}

export function getCondition(x: number, y: number): number | undefined {
  return conditionMap.get(`${x},${y}`);
}

export function updateFromRepairQueue(
  repairQueue: { x: number; y: number; condition: number; tool: string }[]
): void {
  for (const entry of repairQueue) {
    conditionMap.set(`${entry.x},${entry.y}`, entry.condition);
  }
}

export function clearCondition(x: number, y: number): void {
  conditionMap.delete(`${x},${y}`);
}
