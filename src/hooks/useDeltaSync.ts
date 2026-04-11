/**
 * Hook für Delta-basierte Multiplayer-Synchronisation
 * 
 * Statt den kompletten Spielstand zu speichern, werden nur Änderungen (Deltas)
 * gesammelt und an den Server gesendet. Das verhindert Konflikte bei
 * gleichzeitigem Bauen von mehreren Spielern.
 */

import { useCallback, useEffect, useRef } from 'react';
import { deltaQueue, sendDeltaBatch, DeltaAction, DeltaBatch } from '@/lib/deltaSync';
import { Tool } from '@/types/game';

interface UseDeltaSyncOptions {
  enabled: boolean;
  roomCode: string;
  municipalitySlug: string;
  onRemoteAction?: (action: DeltaAction) => void;
}

export function useDeltaSync({
  enabled,
  roomCode,
  municipalitySlug,
  onRemoteAction,
}: UseDeltaSyncOptions) {
  const onRemoteActionRef = useRef(onRemoteAction);
  onRemoteActionRef.current = onRemoteAction;
  
  // Initialisiere Delta Queue wenn aktiviert
  useEffect(() => {
    if (!enabled || !roomCode || !municipalitySlug) {
      return;
    }

    const handleRemoteDeltas = (deltas: DeltaAction[]) => {
      // Wende jedes Delta auf den lokalen State an
      for (const delta of deltas) {
        if (onRemoteActionRef.current) {
          onRemoteActionRef.current(delta);
        }
      }
    };

    deltaQueue.init(
      roomCode,
      municipalitySlug,
      sendDeltaBatch,
      handleRemoteDeltas
    );

    return () => {
      deltaQueue.stop();
    };
  }, [enabled, roomCode, municipalitySlug]);

  /**
   * Sende ein Place-Delta
   */
  const pushPlaceDelta = useCallback((tool: Tool, x: number, y: number) => {
    if (!enabled) return;
    
    deltaQueue.push({
      type: 'place',
      tool,
      x,
      y,
    });
  }, [enabled]);

  /**
   * Sende ein Bulldoze-Delta
   */
  const pushBulldozeDelta = useCallback((x: number, y: number) => {
    if (!enabled) return;
    
    deltaQueue.push({
      type: 'bulldoze',
      x,
      y,
    });
  }, [enabled]);

  /**
   * Sende ein Zone-Delta
   */
  const pushZoneDelta = useCallback((zone: 'residential' | 'commercial' | 'industrial' | 'none', x: number, y: number) => {
    if (!enabled) return;
    
    deltaQueue.push({
      type: 'zone',
      zone,
      x,
      y,
    });
  }, [enabled]);

  /**
   * Sende ein Stats-Update-Delta
   */
  const pushStatsUpdate = useCallback((money?: number, population?: number) => {
    if (!enabled) return;
    
    deltaQueue.push({
      type: 'stats_update',
      money,
      population,
    });
  }, [enabled]);

  /**
   * Manuell Deltas flushen
   */
  const flush = useCallback(() => {
    deltaQueue.flush();
  }, []);

  /**
   * Anzahl ausstehender Deltas
   */
  const getPendingCount = useCallback(() => {
    return deltaQueue.pendingCount;
  }, []);

  return {
    pushPlaceDelta,
    pushBulldozeDelta,
    pushZoneDelta,
    pushStatsUpdate,
    flush,
    getPendingCount,
    clientId: deltaQueue.id,
  };
}

export type { DeltaAction };
