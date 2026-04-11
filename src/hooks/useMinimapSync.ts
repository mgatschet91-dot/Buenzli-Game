'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { getApiBaseUrl, getAuthToken } from '@/lib/api/coreApi';
import { getCurrentMunicipality } from '@/lib/api/database';

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

// Service buildings for minimap color mapping
const SERVICE_BUILDINGS = new Set([
  'police_station', 'fire_station', 'hospital', 'school', 'university'
]);

// Park buildings for minimap color mapping
const PARK_BUILDINGS = new Set([
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small', 
  'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field', 
  'baseball_stadium', 'community_center', 'swimming_pool', 'skate_park', 
  'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
  'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground',
  'marina_docks_small', 'pier_large', 'roller_coaster_small', 'community_garden',
  'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead', 'office_building_small', 'woodcutter_house'
]);

interface UseMinimapSyncOptions {
  enabled?: boolean;
  intervalMinutes?: number;
  municipalitySlug?: string;
}

/**
 * Hook zum automatischen Speichern der Minimap auf dem Server
 * Sendet alle X Minuten ein PNG der Minimap an die API
 */
export function useMinimapSync({
  enabled = true,
  intervalMinutes = 10,
  municipalitySlug,
}: UseMinimapSyncOptions = {}) {
  const { state } = useGame();
  const { grid, gridSize } = state;
  const lastUploadRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generiere Minimap als Base64 PNG
  const generateMinimapPng = useCallback((): string | null => {
    if (!grid || gridSize === 0) return null;

    const exportSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scale = exportSize / gridSize;

    // Draw background
    ctx.fillStyle = '#0b1723';
    ctx.fillRect(0, 0, exportSize, exportSize);

    // Draw grid
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y]?.[x];
        if (!tile) continue;
        
        const buildingType = tile.building.type;
        let color = '#2d5a3d';

        if (buildingType === 'water') color = '#0ea5e9';
        else if (buildingType === 'road') color = '#6b7280';
        else if (buildingType === 'tree' || buildingType.startsWith('tree_')) color = '#166534';
        else if (buildingType.startsWith('bush_') || buildingType.startsWith('topiary_') || buildingType.startsWith('flower_')) color = '#15803d';
        else if (tile.building.onFire) color = '#ef4444';
        else if (tile.zone === 'residential' && buildingType !== 'grass') color = '#22c55e';
        else if (tile.zone === 'residential') color = '#14532d';
        else if (tile.zone === 'commercial' && buildingType !== 'grass') color = '#38bdf8';
        else if (tile.zone === 'commercial') color = '#1d4ed8';
        else if (tile.zone === 'industrial' && buildingType !== 'grass') color = '#f59e0b';
        else if (tile.zone === 'industrial') color = '#b45309';
        else if (SERVICE_BUILDINGS.has(buildingType)) color = '#c084fc';
        else if (buildingType === 'power_plant') color = '#f97316';
        else if (buildingType === 'water_tower') color = '#06b6d4';
        else if (PARK_BUILDINGS.has(buildingType)) color = '#84cc16';

        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    return canvas.toDataURL('image/png');
  }, [grid, gridSize]);

  // Upload Minimap zur API
  const uploadMinimap = useCallback(async () => {
    const slug = municipalitySlug || getCurrentMunicipality();
    if (!slug) {
      console.log('[MinimapSync] Keine Gemeinde gefunden, überspringe Upload');
      return;
    }

    const imageData = generateMinimapPng();
    if (!imageData) {
      console.log('[MinimapSync] Konnte Minimap nicht generieren');
      return;
    }

    const token = getAuthToken();
    if (!token) return; // Kein Token → still abbrechen, kein 401-Fehler

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/municipality/${slug}/minimap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Game-Token': token,
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) return; // Stille Fehlerbehandlung — kein Console-Spam

      const result = await response.json();

      if (result.success) {
        console.log('[MinimapSync] ✅ Minimap erfolgreich hochgeladen:', result.data?.url);
        lastUploadRef.current = Date.now();
      }
    } catch {
      // Netzwerkfehler still ignorieren
    }
  }, [generateMinimapPng, municipalitySlug]);

  // Automatischer Upload im Intervall
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    // Initial upload nach 30 Sekunden (um sicherzustellen, dass das Spiel geladen ist)
    const initialTimeout = setTimeout(() => {
      uploadMinimap();
    }, 30000);

    // Dann alle X Minuten
    intervalRef.current = setInterval(() => {
      uploadMinimap();
    }, intervalMs);

    console.log(`[MinimapSync] 🔄 Automatischer Upload alle ${intervalMinutes} Minuten aktiviert`);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMinutes, uploadMinimap]);

  return {
    uploadMinimap,
    lastUpload: lastUploadRef.current,
  };
}
