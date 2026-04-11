/**
 * useConstructionSync
 * 
 * Erkennt wenn Gebäude fertig gebaut sind (constructionProgress === 100)
 * und meldet dies an die API → metadata.constructed = true in game_items.
 * 
 * So bleiben fertige Gebäude auch nach Reload fertig.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { sendConstructionSyncBatch, type ConstructionSyncPosition } from '@/lib/deltaSync';
import { getBuildingSize } from '@/lib/simulation';

// Wie oft prüfen wir auf fertige Gebäude (ms)
const CHECK_INTERVAL = 1000;

// Gebäude-Typen die keine Construction haben (überspringen)
const SKIP_TYPES = new Set([
  'grass', 'empty', 'water', 'road', 'bridge', 'tree', 'rail',
  'tree_oak', 'tree_maple', 'tree_birch', 'tree_willow',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar',
  'tree_palm', 'tree_bamboo', 'tree_coconut',
  'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria',
  'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral',
  'flower_bed', 'flower_planter',
]);

interface UseConstructionSyncOptions {
  enabled: boolean;
  municipalitySlug?: string;
}

export function useConstructionSync({ enabled, municipalitySlug }: UseConstructionSyncOptions) {
  const game = useGame();
  const multiplayer = useMultiplayerOptional();
  
  // Letzter gemeldeter Zustand pro Position → nur senden wenn sich was geändert hat
  const lastReportedRef = useRef<Map<string, string>>(new Map());
  // Pending Updates die noch gesendet werden müssen
  const pendingRef = useRef<ConstructionSyncPosition[]>([]);
  const sendingRef = useRef(false);
  
  // Refs für stabile Werte im Interval (vermeidet ständige Neuanlage)
  const multiplayerRef = useRef(multiplayer);
  multiplayerRef.current = multiplayer;

  const sendBatch = useCallback(async () => {
    if (sendingRef.current || pendingRef.current.length === 0) return;
    
    const roomCode = multiplayerRef.current?.roomCode;
    if (!roomCode) return;

    sendingRef.current = true;
    const positions = [...pendingRef.current];
    pendingRef.current = [];

    try {
      const wsResult = await sendConstructionSyncBatch(positions);
      if (wsResult) {
        return;
      }
      // WS-only: keine HTTP-Fallbacks. Bei fehlendem Ack bleibt alles in der Queue.
      pendingRef.current.push(...positions);
    } catch {
      // Bei Fehler: Positionen zurück in die Queue
      pendingRef.current.push(...positions);
    } finally {
      sendingRef.current = false;
    }
  }, []); // Keine deps → stabile Referenz, liest alles aus Refs

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      // latestStateRef statt game.state → kein stale closure, Interval wird nicht ständig neu erstellt
      const grid = game.latestStateRef?.current?.grid;
      if (!grid || grid.length === 0) return;

      let found = 0;
      const currentBuildingKeys = new Set<string>();
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          const tile = grid[y][x];
          const bType = tile.building?.type;
          
          if (!bType || SKIP_TYPES.has(bType)) continue;
          const key = `${x},${y}`;
          currentBuildingKeys.add(key);
          
          const progressRaw = Number(tile.building.constructionProgress ?? 0);
          // Keep 2 decimals so very long build times (hours) still persist regularly.
          const progress = Math.max(0, Math.min(100, Math.round(progressRaw * 100) / 100));
          const abandoned = !!tile.building.abandoned;
          const onFire = !!tile.building.onFire;
          const fireProgressRaw = tile.building.fireProgress ?? 0;
          const fireProgress = Math.max(0, Math.min(100, Math.round(fireProgressRaw)));
          const level = Math.max(0, Math.round(tile.building.level ?? 0));
          const population = Math.max(0, Math.round(Number(tile.building.population ?? 0)));
          const jobs = Math.max(0, Math.round(Number(tile.building.jobs ?? 0)));
          const footprint = getBuildingSize(bType);
          const footprintWidth = Math.max(1, Math.round(footprint.width ?? 1));
          const footprintHeight = Math.max(1, Math.round(footprint.height ?? 1));
          
          const upgradeStartedAt = tile.building.upgradeStartedAt ?? 0;
          const upgradeTargetLevel = tile.building.upgradeTargetLevel ?? 0;
          const plantedAt = tile.building.plantedAt ?? 0;
          
          const signature = `${bType}|${progress}|${abandoned ? 1 : 0}|${onFire ? 1 : 0}|${fireProgress}|${level}|${population}|${jobs}|${footprintWidth}x${footprintHeight}|${upgradeStartedAt}|${upgradeTargetLevel}|${plantedAt}`;
          const lastReported = lastReportedRef.current.get(key) ?? '';
          
          // Senden wenn sich der Runtime-Zustand geändert hat
          if (signature !== lastReported) {
            lastReportedRef.current.set(key, signature);
            pendingRef.current.push({
              x,
              y,
              progress,
              tool: bType,
              abandoned,
              on_fire: onFire,
              fire_progress: fireProgress,
              level,
              population,
              jobs,
              footprint_width: footprintWidth,
              footprint_height: footprintHeight,
              upgrade_started_at: upgradeStartedAt > 0 ? upgradeStartedAt : null,
              upgrade_target_level: upgradeTargetLevel > 0 ? upgradeTargetLevel : null,
              planted_at: plantedAt > 0 ? plantedAt : null,
            });
            found++;
          }
        }
      }

      // Gebäude wurde entfernt (z.B. abgebrannt -> grass): SQL-Eintrag löschen
      for (const [key] of lastReportedRef.current.entries()) {
        if (currentBuildingKeys.has(key)) continue;
        const [xStr, yStr] = key.split(',');
        const x = Number(xStr);
        const y = Number(yStr);
        if (Number.isNaN(x) || Number.isNaN(y)) continue;
        pendingRef.current.push({ x, y, removed: true });
        lastReportedRef.current.delete(key);
        found++;
      }

      // Batch senden wenn was ansteht
      if (pendingRef.current.length > 0) {
        sendBatch();
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [enabled, game.latestStateRef, sendBatch]);

  // Reset wenn Raum wechselt
  useEffect(() => {
    lastReportedRef.current.clear();
    pendingRef.current = [];
  }, [multiplayer?.roomCode]);
}
