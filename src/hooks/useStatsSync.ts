/**
 * useStatsSync Hook
 * 
 * Synchronisiert Spielstatistiken automatisch mit dem Server.
 * 
 * Features:
 * - Automatischer Sync alle X Sekunden
 * - Debouncing für häufige Änderungen
 * - Offline-Queue (Änderungen werden gesammelt)
 * - Konfliktlösung (Server-Version gewinnt bei großen Differenzen)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import {
  quickSyncStats,
  syncStatsToServer,
  loadStatsFromServer,
  GameStatsData,
} from '@/lib/deltaSync';

const NON_BUILDING_TYPES = new Set([
  'empty', 'grass', 'water', 'road', 'bridge', 'rail', 'tree',
  'tree_oak', 'tree_maple', 'tree_birch', 'tree_willow',
  'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar',
  'tree_palm', 'tree_bamboo', 'tree_coconut',
  'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria',
  'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral',
  'flower_bed', 'flower_planter',
]);

const RESIDENTIAL_TYPES = new Set([
  'house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high',
]);

const COMMERCIAL_TYPES = new Set([
  'shop_small', 'shop_medium', 'office_low', 'office_high', 'mall',
]);

const INDUSTRIAL_TYPES = new Set([
  'factory_small', 'factory_medium', 'factory_large', 'warehouse',
]);

// Stats sind server-authoritative: Client darf keine Stats persistieren.
const CLIENT_STATS_UPLOAD_ENABLED = false;

interface UseStatsSyncOptions {
  /** Sync-Intervall in Millisekunden (default: 5000) */
  syncInterval?: number;
  /** Debounce-Zeit in Millisekunden (default: 1000) */
  debounceMs?: number;
  /** Municipality Slug */
  municipalitySlug?: string;
  /** Aktiviere Stats-Sync */
  enabled?: boolean;
  /** Falls true, sendet der Client lokale Stats als WS-Realtime-Updates */
  enableRealtimeSocketSync?: boolean;
}

export function useStatsSync(options: UseStatsSyncOptions = {}) {
  const {
    syncInterval = 5000,
    debounceMs = 1000,
    municipalitySlug,
    enabled = true,
    enableRealtimeSocketSync = false,
  } = options;

  const game = useGame();
  const gameState = game.state;
  const multiplayer = useMultiplayerOptional();
  
  const lastSyncRef = useRef<number>(0);
  const lastDbSyncRef = useRef<number>(0);
  const pendingChangesRef = useRef<Partial<GameStatsData> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dbIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bestimme Room Code und Municipality
  const roomCode = multiplayer?.roomCode;
  
  // Slug aus verschiedenen Quellen ermitteln
  const getSlug = (): string => {
    // 1. Explizit übergebener Slug
    if (municipalitySlug) return municipalitySlug;
    
    // 2. Aus Multiplayer-Context
    if (multiplayer?.municipalitySlug) return multiplayer.municipalitySlug;
    
    // 3. Aus der URL extrahieren
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/gemeinde\/([^\/]+)/);
      if (pathMatch?.[1]) return pathMatch[1];
    }
    
    // 4. Environment Variable Fallback
    return process.env.NEXT_PUBLIC_DEFAULT_MUNICIPALITY || 'default';
  };
  
  const slug = getSlug();
  const waterBodiesNameSignature = (gameState?.waterBodies ?? [])
    .map((b) => `${b.type}:${b.centerX},${b.centerY}:${b.name}`)
    .join('|');

  /**
   * Sammle aktuelle Stats vom Game
   */
  const collectCurrentStats = useCallback((): Partial<GameStatsData> | null => {
    if (!gameState?.stats) return null;

    const stats = gameState.stats;
    const grid = gameState.grid ?? [];
    const pop = Math.max(0, Math.round(stats.population ?? 0));
    const jobs = Math.max(0, Math.round(stats.jobs ?? 0));
    const employed = Math.min(pop, jobs);
    const unemployed = Math.max(0, pop - jobs);
    const unemploymentRate = pop > 0 ? Math.round((unemployed / pop) * 10000) / 100 : 0;

    const previousHistory = (gameState.history ?? []).length >= 2
      ? gameState.history[gameState.history.length - 2]
      : null;
    const populationGrowth = previousHistory
      ? pop - Math.round(previousHistory.population ?? pop)
      : 0;

    let zonesResidential = 0;
    let zonesCommercial = 0;
    let zonesIndustrial = 0;
    let buildingsTotal = 0;
    let buildingsResidential = 0;
    let buildingsCommercial = 0;
    let buildingsIndustrial = 0;
    let buildingsInfrastructure = 0;
    let buildingsDecoration = 0;
    let powerProduction = 0;
    let powerConsumption = 0;
    let waterProduction = 0;
    let waterConsumption = 0;
    let maxPopulation = 0;

    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const tile = row[x];

        if (tile.zone === 'residential') zonesResidential++;
        if (tile.zone === 'commercial') zonesCommercial++;
        if (tile.zone === 'industrial') zonesIndustrial++;

        const b = tile.building;
        const bType = b?.type;
        if (!bType || NON_BUILDING_TYPES.has(bType)) continue;

        buildingsTotal++;
        maxPopulation += Math.max(0, Math.round(b.population ?? 0));

        if (RESIDENTIAL_TYPES.has(bType) || tile.zone === 'residential') {
          buildingsResidential++;
        } else if (COMMERCIAL_TYPES.has(bType) || tile.zone === 'commercial') {
          buildingsCommercial++;
        } else if (INDUSTRIAL_TYPES.has(bType) || tile.zone === 'industrial') {
          buildingsIndustrial++;
        } else {
          // Alles andere als Infrastruktur/Deko trennen
          const isDecorationLike =
            bType.startsWith('park') ||
            bType.includes('garden') ||
            bType.includes('playground') ||
            bType.includes('stadium') ||
            bType.includes('pool') ||
            bType.includes('trail') ||
            bType.includes('pond') ||
            bType.includes('coaster');
          if (isDecorationLike) {
            buildingsDecoration++;
          } else {
            buildingsInfrastructure++;
          }
        }

        if (bType === 'power_plant') {
          powerProduction += 1000;
        }
        if (bType === 'water_tower') {
          waterProduction += 1000;
        }
        if (b.powered) {
          powerConsumption += 1;
        }
        if (b.watered) {
          waterConsumption += 1;
        }
      }
    }
    
    return {
      money: Math.round(stats.money ?? 0),
      income: Math.round(stats.income ?? 0),
      expenses: Math.round(stats.expenses ?? 0),
      population: pop,
      maxPopulation: Math.max(pop, maxPopulation),
      populationGrowth,
      homeless: Math.max(0, unemployed),
      jobs,
      employed,
      unemployed,
      unemploymentRate,
      happiness: Math.round(stats.happiness ?? 50),
      happinessResidential: Math.round(stats.happiness ?? 50),
      happinessCommercial: Math.round(stats.happiness ?? 50),
      happinessIndustrial: Math.round(stats.happiness ?? 50),
      powerProduction,
      powerConsumption,
      waterProduction,
      waterConsumption,
      buildingsTotal,
      buildingsResidential,
      buildingsCommercial,
      buildingsIndustrial,
      buildingsInfrastructure,
      buildingsDecoration,
      zonesResidential,
      zonesCommercial,
      zonesIndustrial,
      tick: gameState.tick ?? 0,
      taxRate: gameState.taxRate ?? 10,
      gameSpeed: gameState.speed ?? 1,
      playTimeSeconds: Math.max(0, Math.round((gameState.tick ?? 0) / 10)),
      gameMapData: {
        stats: {
          health: Math.round(stats.health ?? 50),
          education: Math.round(stats.education ?? 50),
          safety: Math.round(stats.safety ?? 50),
          environment: Math.round(stats.environment ?? 75),
          demand: {
            residential: Math.round(stats.demand?.residential ?? 50),
            commercial: Math.round(stats.demand?.commercial ?? 30),
            industrial: Math.round(stats.demand?.industrial ?? 40),
          },
        },
        settings: {
          taxRate: gameState.taxRate ?? 10,
          effectiveTaxRate: gameState.effectiveTaxRate ?? gameState.taxRate ?? 10,
          speed: gameState.speed ?? 1,
          disastersEnabled: gameState.disastersEnabled ?? true,
          selectedTool: gameState.selectedTool ?? 'select',
        },
        time: {
          year: gameState.year,
          month: gameState.month,
          day: gameState.day,
          hour: gameState.hour,
        },
        waterBodies: (gameState.waterBodies ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          centerX: b.centerX,
          centerY: b.centerY,
        })),
        budget: gameState.budget ?? null,
      },
    };
  }, [gameState]);

  /**
   * Synchronisiere Stats mit Server
   */
  const syncStats = useCallback(async (force = false) => {
    if (!CLIENT_STATS_UPLOAD_ENABLED) return;
    if (!enabled || !roomCode || !enableRealtimeSocketSync) return;

    const now = Date.now();
    
    // Verhindere zu häufige Syncs (außer bei force)
    if (!force && now - lastSyncRef.current < debounceMs) {
      return;
    }

    const stats = collectCurrentStats();
    if (!stats) return;

    // Quick-Sync für häufige Updates
    const syncData = {
      money: stats.money ?? 0,
      population: stats.population ?? 0,
      happiness: stats.happiness ?? 50,
      tick: stats.tick ?? 0,
      income: stats.income,
      expenses: stats.expenses,
      jobs: stats.jobs,
      taxRate: stats.taxRate,
      gameSpeed: stats.gameSpeed,
      year: gameState?.year,
      month: gameState?.month,
    };
    
    console.log('[useStatsSync] Syncing stats:', { slug, roomCode, stats: syncData });
    
    const success = await quickSyncStats(slug, roomCode, syncData);

    if (success) {
      lastSyncRef.current = now;
      pendingChangesRef.current = null;
      console.log('[useStatsSync] ✅ Stats synced successfully');
    } else {
      console.warn('[useStatsSync] ❌ Stats sync failed');
    }
  }, [enabled, roomCode, slug, debounceMs, collectCurrentStats, gameState?.year, gameState?.month, enableRealtimeSocketSync]);

  /**
   * Vollständiger Stats-Sync (alle Werte) - persistiert in die Datenbank via HTTP POST
   */
  const fullSync = useCallback(async () => {
    if (!CLIENT_STATS_UPLOAD_ENABLED) return;
    if (!enabled || !roomCode) return;

    const stats = collectCurrentStats();
    if (!stats) return;

    // Erweitere um alle verfügbaren Stats
    const fullStats: Partial<GameStatsData> = {
      ...stats,
      // Weitere Stats könnten hier hinzugefügt werden wenn verfügbar
    };

    console.log('[useStatsSync] 💾 DB-Sync: Speichere Stats in game_stats...', { slug, roomCode });
    const success = await syncStatsToServer(slug, roomCode, fullStats);
    if (success) {
      lastDbSyncRef.current = Date.now();
      console.log('[useStatsSync] ✅ DB-Sync erfolgreich');
    } else {
      console.warn('[useStatsSync] ❌ DB-Sync fehlgeschlagen');
    }
    lastSyncRef.current = Date.now();
  }, [enabled, roomCode, slug, collectCurrentStats]);

  /**
   * Lade Stats vom Server
   */
  const loadStats = useCallback(async (): Promise<GameStatsData | null> => {
    if (!roomCode) return null;
    return loadStatsFromServer(slug, roomCode);
  }, [roomCode, slug]);

  /**
   * Debounced Sync bei Änderungen
   */
  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      syncStats();
    }, debounceMs);
  }, [syncStats, debounceMs]);

  // Automatischer Sync-Intervall (WebSocket für Echtzeit)
  useEffect(() => {
    if (!enabled || !roomCode || !enableRealtimeSocketSync) return;

    // Initialer Sync
    syncStats(true);

    // Periodischer WebSocket-Sync (Echtzeit für andere Spieler)
    intervalRef.current = setInterval(() => {
      syncStats();
    }, syncInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [enabled, roomCode, syncInterval, syncStats, enableRealtimeSocketSync]);

  // Periodischer DB-Sync (alle 10 Sekunden in die game_stats Tabelle persistieren)
  useEffect(() => {
    if (!CLIENT_STATS_UPLOAD_ENABLED) return;
    if (!enabled || !roomCode) return;

    // Initialer DB-Sync nach kurzem Delay (damit Game-State geladen ist)
    const initialTimer = setTimeout(() => {
      fullSync();
    }, 3000);

    // Periodischer DB-Sync alle 10 Sekunden
    dbIntervalRef.current = setInterval(() => {
      fullSync();
    }, 10000);

    return () => {
      clearTimeout(initialTimer);
      if (dbIntervalRef.current) {
        clearInterval(dbIntervalRef.current);
      }
    };
  }, [enabled, roomCode, fullSync]);

  // Wichtige Settings sofort persistieren (statt auf das Intervall zu warten)
  useEffect(() => {
    if (!CLIENT_STATS_UPLOAD_ENABLED) return;
    if (!enabled || !roomCode || !gameState) return;
    const timer = setTimeout(() => {
      fullSync();
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    enabled,
    roomCode,
    gameState?.taxRate,
    gameState?.effectiveTaxRate,
    gameState?.speed,
    gameState?.disastersEnabled,
    gameState?.stats?.health,
    gameState?.stats?.education,
    gameState?.stats?.safety,
    gameState?.stats?.environment,
    gameState?.stats?.demand?.residential,
    gameState?.stats?.demand?.commercial,
    gameState?.stats?.demand?.industrial,
    waterBodiesNameSignature,
    fullSync,
  ]);

  // Sync bei GameState-Änderungen (debounced - WebSocket)
  useEffect(() => {
    if (!enabled || !roomCode || !gameState?.stats || !enableRealtimeSocketSync) return;
    debouncedSync();
  }, [
    enabled,
    roomCode,
    gameState?.stats?.money,
    gameState?.stats?.population,
    gameState?.stats?.happiness,
    gameState?.tick,
    enableRealtimeSocketSync,
    debouncedSync,
  ]);

  // Letzter DB-Sync beim Verlassen der Seite (beforeunload)
  useEffect(() => {
    if (!CLIENT_STATS_UPLOAD_ENABLED) return;
    if (!enabled || !roomCode) return;

    const handleBeforeUnload = () => {
      // Verwende sendBeacon für zuverlässigen Sync beim Schließen
      const stats = collectCurrentStats();
      if (!stats) return;

      const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
      const apiStats: Record<string, number | undefined> = {
        money: stats.money,
        income: stats.income,
        expenses: stats.expenses,
        tax_rate: stats.taxRate,
        population: stats.population,
        jobs: stats.jobs,
        happiness: stats.happiness,
        tick: stats.tick,
        game_speed: stats.gameSpeed,
      };
      const filteredStats = Object.fromEntries(
        Object.entries(apiStats).filter(([, v]) => v !== undefined)
      );

      const apiBaseUrl =
        process.env.NEXT_PUBLIC_CORE_API_URL ||
        process.env.NEXT_PUBLIC_AUTH_API_URL ||
        'http://127.0.0.1:4100';
      const gameApiBase = apiBaseUrl.endsWith('/api/game') ? apiBaseUrl : `${apiBaseUrl}/api/game`;
      const url = `${gameApiBase}/municipality/${slug}/stats/${roomCode}`;
      const payload = {
        ...filteredStats,
        ...(stats.gameMapData ? { game_map_data: stats.gameMapData } : {}),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      
      // sendBeacon ist zuverlässiger als fetch bei beforeunload
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['X-Game-Token'] = token;
      
      try {
        navigator.sendBeacon(url, blob);
        console.log('[useStatsSync] 💾 beforeunload: Stats via sendBeacon gesendet');
      } catch {
        // Fallback: nichts tun, Stats gehen ggf. verloren
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, roomCode, slug, collectCurrentStats]);

  return {
    /** Manueller Sync auslösen */
    sync: syncStats,
    /** Vollständiger Sync (alle Werte) */
    fullSync,
    /** Stats vom Server laden */
    loadStats,
    /** Ist Sync aktiviert */
    isEnabled: enabled && !!roomCode,
    /** Letzter Sync-Zeitpunkt */
    lastSync: lastSyncRef.current,
  };
}

export default useStatsSync;
