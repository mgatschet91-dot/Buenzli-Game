'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { useGame } from '@/context/GameContext';
import { GameAction, GameActionInput } from '@/lib/multiplayer/types';
import { Tool, Budget, GameState, SavedCityMeta, BuildingType } from '@/types/game';
import { deltaQueue, sendDeltaBatch, DeltaAction, DeltaActionInput, DisasterStateUpdate, BuildingStateUpdate, CrimeAuthoritativePayload, BuenzliNpcPayload } from '@/lib/deltaSync';
import { getBackendType } from '@/lib/multiplayer/provider';
import { getBuildingSize } from '@/lib/simulation';
import { spawnCarFromParkingRef } from '@/lib/parkingSpawnBridge';

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

// Batch placement buffer for reducing message count during drags
const BATCH_FLUSH_INTERVAL = 100; // ms - flush every 100ms during drag
const BATCH_MAX_SIZE = 100; // Max placements before force flush

function buildPlaceDelta(tool: Tool, x: number, y: number): DeltaActionInput {
  // Furni items: store classname in metadata for persistence
  if (typeof tool === 'string' && tool.startsWith('furni_')) {
    const furniClassname =
      (typeof window !== 'undefined' && window.sessionStorage.getItem('isocity_furni_classname')) ||
      tool.replace(/^furni_/, '');
    return {
      type: 'place',
      tool: 'furni' as Tool,
      x,
      y,
      metadata: {
        furniClassname,
        furniDirection: 2,
        furniState: 0,
      },
    };
  }

  const size = getBuildingSize(tool as BuildingType);
  if (size.width > 1 || size.height > 1) {
    return {
      type: 'place',
      tool,
      x,
      y,
      metadata: {
        footprintWidth: size.width,
        footprintHeight: size.height,
      },
    };
  }
  return { type: 'place', tool, x, y };
}

// Storage key for saved cities index (matches page.tsx)
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';

// Update the saved cities index with the current multiplayer city state
function updateSavedCitiesIndex(state: GameState, roomCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    // Load existing cities
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    const cities: SavedCityMeta[] = saved ? JSON.parse(saved) : [];
    
    // Create updated city meta
    const cityMeta: SavedCityMeta = {
      id: state.id || `city-${Date.now()}`,
      cityName: state.cityName || 'Co-op City',
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
      roomCode: roomCode,
    };
    
    // Find and update or add
    const existingIndex = cities.findIndex(c => c.roomCode === roomCode);
    if (existingIndex >= 0) {
      cities[existingIndex] = cityMeta;
    } else {
      cities.unshift(cityMeta);
    }
    
    // Keep only the last 20 cities and save
    localStorage.setItem(SAVED_CITIES_INDEX_KEY, JSON.stringify(cities.slice(0, 20)));
  } catch (e) {
    console.error('Failed to update saved cities index:', e);
  }
}

// Global flag to track if this client is the stats sender
// Used to prevent receiving our own stats and causing "jumping" numbers
let isStatsSender = false;

export function setIsStatsSender(value: boolean) {
  isStatsSender = value;
  console.log('[useMultiplayerSync] Stats-Sender Status:', value);
}

export function getIsStatsSender(): boolean {
  return isStatsSender;
}

/**
 * Hook to sync game actions with multiplayer.
 * 
 * When in multiplayer mode:
 * - Local actions are broadcast to peers via Supabase Realtime
 * - Remote actions are applied to local state
 * - Delta-Sync speichert Änderungen persistent auf dem Server
 */
export function useMultiplayerSync() {
  const multiplayer = useMultiplayerOptional();
  const game = useGame();
  const lastActionRef = useRef<string | null>(null);
  const initialStateLoadedRef = useRef(false);
  
  // PERF: Ref für game, damit useEffects nicht bei jedem State-Update re-evaluieren
  const gameRef = useRef(game);
  gameRef.current = game;
  
  // Batching for placements - use refs to avoid stale closures
  const placementBufferRef = useRef<Array<{ x: number; y: number; tool: Tool }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const multiplayerRef = useRef(multiplayer);
  
  // Delta Sync refs
  const deltaSyncInitializedRef = useRef(false);
  const municipalitySlugRef = useRef<string>('');
  
  // Keep multiplayer ref updated
  useEffect(() => {
    multiplayerRef.current = multiplayer;
  }, [multiplayer]);
  
  // Initialisiere Delta-Sync wenn im Multiplayer-Modus (nur für Supabase-Provider)
  // Der CoreDeltaProvider initialisiert die Delta-Queue selbst
  useEffect(() => {
    // Skip wenn CoreDeltaProvider verwendet wird (der macht das selbst)
    const backendType = getBackendType();
    if (backendType === 'core-delta') {
      console.log('[useMultiplayerSync] Delta-Sync wird vom CoreDeltaProvider gehandhabt');
      deltaSyncInitializedRef.current = true; // Markiere als initialisiert (extern)
      return;
    }
    
    if (!multiplayer || multiplayer.connectionState !== 'connected' || !multiplayer.roomCode) {
      // Cleanup wenn nicht mehr verbunden
      if (deltaSyncInitializedRef.current) {
        deltaQueue.stop();
        deltaSyncInitializedRef.current = false;
        console.log('[DeltaSync] Gestoppt (Multiplayer getrennt)');
      }
      return;
    }
    
    // Schon initialisiert?
    if (deltaSyncInitializedRef.current) return;
    
    // Municipality Slug aus URL oder localStorage holen
    const slug = typeof window !== 'undefined' 
      ? (window.location.pathname.split('/gemeinde/')[1]?.split('/')[0] || localStorage.getItem('isocity_municipality') || 'default')
      : 'default';
    municipalitySlugRef.current = slug;
    
    // Delta Queue initialisieren (für Supabase-Modus als zusätzliche Speicherung)
    const handleRemoteDeltas = (deltas: DeltaAction[]) => {
      // Wende remote Deltas auf den lokalen State an
      console.log('[DeltaSync] Empfange', deltas.length, 'Delta(s) von anderen Spielern');
      
      for (const delta of deltas) {
        if (delta.type === 'place' && 'tool' in delta) {
          // Pass tool directly to avoid React batching issues
          game.placeAtTile(delta.x, delta.y, true, delta.tool);
          console.log('[DeltaSync] ✅ Place:', delta.tool, 'at', delta.x, delta.y);
        } else if (delta.type === 'bulldoze') {
          game.placeAtTile(delta.x, delta.y, true, 'bulldoze');
          console.log('[DeltaSync] ✅ Bulldoze at', delta.x, delta.y);
        } else if (delta.type === 'zone' && 'zone' in delta) {
          const zoneTool = delta.zone === 'none' ? 'zone_dezone' 
            : delta.zone === 'residential' ? 'zone_residential'
            : delta.zone === 'commercial' ? 'zone_commercial'
            : 'zone_industrial';
          game.placeAtTile(delta.x, delta.y, true, zoneTool as Tool);
          console.log('[DeltaSync] ✅ Zone:', delta.zone, 'at', delta.x, delta.y);
        }
      }
    };
    
    deltaQueue.init(
      multiplayer.roomCode,
      slug,
      sendDeltaBatch,
      handleRemoteDeltas
    );
    
    deltaSyncInitializedRef.current = true;
    console.log('[DeltaSync] Initialisiert für Raum', multiplayer.roomCode, 'Gemeinde:', slug);
    
    return () => {
      deltaQueue.stop();
      deltaSyncInitializedRef.current = false;
    };
  }, [multiplayer?.connectionState, multiplayer?.roomCode, game]);

  // Load initial state when joining a room (received from server/other players)
  // This can happen even if we already loaded from cache - SERVER state takes priority!
  // WICHTIG: Verwendet softLoadState statt loadState, damit Entities (Autos, Fussgänger,
  // Flugzeuge etc.) NICHT gelöscht werden. Sonst sieht der Spieler bei jedem Sync ein
  // "Neuaufbauen" der Map, weil gameVersion erhöht wird und alle Entities verschwinden.
  const lastInitialStateRef = useRef<string | null>(null);
  // Merkt sich die zuletzt geladene Gemeinde – bei Wechsel erzwingen wir einen vollen Load
  // damit Passanten/Fahrzeuge der alten Gemeinde korrekt geleert werden.
  const lastLoadedSlugRef = useRef<string>('');

  // Bei Raumwechsel muss der Initial-State immer neu geladen werden.
  useEffect(() => {
    lastInitialStateRef.current = null;
    initialStateLoadedRef.current = false;
    // lastLoadedSlugRef NICHT zurücksetzen — wir brauchen den alten Wert um
    // Gemeinde-Wechsel zu erkennen (auch nach roomCode-Reset).
  }, [multiplayer?.roomCode, multiplayer?.municipalitySlug]);

  useEffect(() => {
    if (!multiplayer || !multiplayer.initialState) return;
    
    // Generiere einen eindeutigen Key basierend auf mehr als nur dem Tick
    // Verwende Grid-Größe, Population, Geld UND Tick für eine bessere Unterscheidung
    const state = multiplayer.initialState;
    const stateKey = JSON.stringify({
      roomCode: multiplayer.roomCode || '',
      municipalitySlug: multiplayer.municipalitySlug || '',
      cityName: ('cityName' in state ? state.cityName : '') || '',
      tick: state.tick || 0,
      gridSize: state.gridSize || 0,
      population: 'population' in (state.stats || {}) ? (state.stats as unknown as { population: number }).population : 0,
      money: 'money' in (state.stats || {}) ? (state.stats as unknown as { money: number }).money : 0,
    });
    
    // Prüfe ob wir diesen State schon geladen haben
    if (lastInitialStateRef.current === stateKey && initialStateLoadedRef.current) {
      console.log('[useMultiplayerSync] State already loaded, skipping...');
      return;
    }
    
    // WICHTIG: Den cityName aus dem municipalitySlug verwenden, nicht aus dem gespeicherten State!
    // Der gespeicherte Name kann veraltet sein (z.B. "Metropolis" statt "Solothurn").
    // Ausnahme: Public Rooms (PUB...) nutzen ihren eigenen Raumnamen.
    const stateToLoad = { ...multiplayer.initialState } as Record<string, unknown> & typeof multiplayer.initialState;
    const isPublicRoom = String(multiplayer.roomCode || '').toUpperCase().startsWith('PUB');
    if (!isPublicRoom && multiplayer.municipalitySlug && multiplayer.municipalitySlug !== 'demo') {
      const correctedName = multiplayer.municipalitySlug.charAt(0).toUpperCase() + multiplayer.municipalitySlug.slice(1);
      console.log(`[useMultiplayerSync] 📝 Korrigiere cityName: "${stateToLoad.cityName}" → "${correctedName}"`);
      stateToLoad.cityName = correctedName;
    }
    
    console.log('[useMultiplayerSync] 📥 Received state from server, loading...', {
      tick: state.tick,
      gridSize: state.gridSize,
      cityName: stateToLoad.cityName,
    });
    
    // SOFT LOAD: Server-State laden OHNE gameVersion zu erhöhen.
    // Dadurch bleiben bestehende Entities (Autos, Fussgänger, Flugzeuge etc.) erhalten
    // und die Map "baut sich nicht neu auf" bei jedem Sync.
    // Ausnahme: Bei Gemeinde-Wechsel immer voller Load, damit Entities der alten Gemeinde
    // korrekt geleert werden (Passanten, Fahrzeuge etc.).
    const stateString = JSON.stringify(stateToLoad);
    const g = gameRef.current;
    const currentGridSize = g.state?.gridSize || 0;
    const serverGridSize = stateToLoad.gridSize || 0;
    const currentSlug = multiplayer.municipalitySlug || '';
    // Slug-Wechsel: Erster Load ('') oder andere Gemeinde → voller Load nötig.
    const slugChanged = lastLoadedSlugRef.current !== currentSlug;

    let success: boolean;
    if (currentGridSize > 0 && currentGridSize === serverGridSize && !slugChanged) {
      // Gleiche Grid-Grösse, gleiche Gemeinde → Soft Load (Entities bleiben erhalten)
      success = g.softLoadState(stateString);
      console.log('[useMultiplayerSync] 🔄 Soft-Load verwendet (gleiche Grid-Grösse, gleiche Gemeinde)');
    } else {
      // Andere Grid-Grösse ODER Gemeinde-Wechsel → Voller Load (Entities werden zurückgesetzt)
      success = g.loadState(stateString);
      console.log('[useMultiplayerSync] 🔃 Voller Load verwendet (Grid-Grösse anders oder Gemeinde-Wechsel)');
    }

    if (success) {
      initialStateLoadedRef.current = true;
      lastInitialStateRef.current = stateKey;
      lastLoadedSlugRef.current = currentSlug;
      console.log('[useMultiplayerSync] ✅ Server state loaded successfully');
    } else {
      console.error('[useMultiplayerSync] ❌ Failed to load server state');
    }
  // PERF: game entfernt aus Dependencies - verwende gameRef statt game,
  // damit dieser Effect nicht bei jedem State-Update (500ms) re-evaluiert wird.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer?.initialState, multiplayer?.municipalitySlug]);

  // Apply a remote action to the local game state
  const applyRemoteAction = useCallback((action: GameAction) => {
    // Guard against null/undefined actions (can happen with malformed broadcasts)
    if (!action || !action.type) {
      console.warn('[useMultiplayerSync] Received invalid action:', action);
      return;
    }
    
    console.log('[useMultiplayerSync] 🎮 Wende Remote-Aktion an:', {
      type: action.type,
      ...(action.type === 'place' ? { tool: action.tool, x: action.x, y: action.y } : {}),
      ...(action.type === 'bulldoze' ? { x: action.x, y: action.y } : {}),
      playerId: action.playerId,
    });
    
    switch (action.type) {
      case 'place': {
        // Pass the tool directly to avoid React batching issues
        game.placeAtTile(action.x, action.y, true, action.tool as Tool);
        console.log('[useMultiplayerSync] ✅ Place angewendet:', action.tool, 'at', action.x, action.y);
        break;
      }
        
      case 'placeBatch': {
        // Apply multiple placements from a single message (e.g., road drag)
        for (const placement of action.placements) {
          game.placeAtTile(placement.x, placement.y, true, placement.tool as Tool);
        }
        console.log('[useMultiplayerSync] ✅ PlaceBatch angewendet:', action.placements.length, 'items');
        break;
      }
        
      case 'bulldoze': {
        // Pass bulldoze tool directly
        game.placeAtTile(action.x, action.y, true, 'bulldoze');
        console.log('[useMultiplayerSync] ✅ Bulldoze angewendet at', action.x, action.y);
        break;
      }
        
      case 'setTaxRate':
        // SICHERHEIT: Steueränderungen von anderen Spielern werden ignoriert
        // Nur der Besitzer/Verwaltung kann lokal Steuern ändern
        // Die Änderung wird über den Game-State-Save persistiert
        console.log('[useMultiplayerSync] ⚠️ Remote setTaxRate ignoriert (Sicherheit)');
        break;
        
      case 'setBudget':
        // SICHERHEIT: Budget-Änderungen von anderen Spielern werden ignoriert
        console.log('[useMultiplayerSync] ⚠️ Remote setBudget ignoriert (Sicherheit)');
        break;
        
      case 'setSpeed':
        game.setSpeed(action.speed);
        break;
        
      case 'setDisasters':
        game.setDisastersEnabled(action.enabled);
        break;
        
      case 'createBridges':
        // Create bridges along a drag path (for road/rail drags across water)
        game.finishTrackDrag(action.pathTiles, action.trackType, true); // isRemote = true
        break;
        
      case 'fullState':
        // Ignore - full state sync is handled separately via state-sync event
        // Blocking this prevents malicious players from overwriting game state
        break;
        
      case 'tick':
        // Apply tick data from host (for guests)
        // This would require more complex state merging
        // For now, we rely on periodic full state syncs
        break;
    }
  }, [game]);

  // Register callback to receive remote actions
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.setOnRemoteAction((action: GameAction) => {
      // Apply remote actions to local game state
      applyRemoteAction(action);
    });

    return () => {
      multiplayer.setOnRemoteAction(null);
    };
  }, [multiplayer, applyRemoteAction]);

  // Register callback to receive server-authoritative disaster updates
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.setOnDisasterUpdate(null);
      return;
    }

    deltaQueue.setOnDisasterUpdate((changes: DisasterStateUpdate[]) => {
      if (game.applyRemoteDisasters) {
        game.applyRemoteDisasters(changes);
      }
    });

    return () => {
      deltaQueue.setOnDisasterUpdate(null);
    };
  }, [multiplayer?.connectionState, game]);

  // Register callback to receive server-authoritative building upgrades (Level, Abandoned)
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.setOnBuildingUpdate(null);
      return;
    }

    deltaQueue.setOnBuildingUpdate((changes: BuildingStateUpdate[]) => {
      if (game.applyRemoteBuildingUpdates) {
        game.applyRemoteBuildingUpdates(changes);
      }
    });

    return () => {
      deltaQueue.setOnBuildingUpdate(null);
    };
  }, [multiplayer?.connectionState, game]);

  // Register callback to receive server-authoritative land value grid
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.setOnLandValueUpdate(null);
      return;
    }

    deltaQueue.setOnLandValueUpdate((data: { gridSize: number; values: number[] }) => {
      if (game.applyRemoteLandValueUpdate) {
        game.applyRemoteLandValueUpdate(data);
      }
    });

    return () => {
      deltaQueue.setOnLandValueUpdate(null);
    };
  }, [multiplayer?.connectionState, game]);

  // Register callback to receive server-authoritative crime updates
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.setOnCrimeUpdate(null);
      return;
    }

    deltaQueue.setOnCrimeUpdate((data: CrimeAuthoritativePayload) => {
      if (game.applyRemoteCrimeUpdate) {
        game.applyRemoteCrimeUpdate({
          criminals: data.criminals,
          crimeGrid: data.crimeGrid,
          gridSize: data.gridSize,
          crimeEvents: data.crimeEvents,
          homeless: data.homeless ?? 0,
        });
      }
    });

    return () => {
      deltaQueue.setOnCrimeUpdate(null);
    };
  }, [multiplayer?.connectionState, game]);

  // Register callback to receive server-authoritative buenzli NPC updates
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.setOnBuenzliUpdate(null);
      return;
    }

    deltaQueue.setOnBuenzliUpdate((data: BuenzliNpcPayload) => {
      if (game.applyRemoteBuenzliUpdate) {
        game.applyRemoteBuenzliUpdate(data);
      }
    });

    return () => {
      deltaQueue.setOnBuenzliUpdate(null);
    };
  }, [multiplayer?.connectionState, game]);

  // Register callback for Mansion Party state updates
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.setOnPartyUpdate(null);
      deltaQueue.setOnPartyPoliceWarning(null);
      return;
    }

    deltaQueue.setOnPartyUpdate((data) => {
      window.dispatchEvent(new CustomEvent('party-authoritative', { detail: data }));
    });

    deltaQueue.setOnPartyPoliceWarning((data) => {
      window.dispatchEvent(new CustomEvent('party-police-warning', { detail: data }));
    });

    return () => {
      deltaQueue.setOnPartyUpdate(null);
      deltaQueue.setOnPartyPoliceWarning(null);
    };
  }, [multiplayer?.connectionState]);

  // Register callbacks for parking lot vehicle events
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      deltaQueue.onParkedVehiclesUpdate = undefined;
      deltaQueue.onVehicleParked = undefined;
      deltaQueue.onVehicleLeftParking = undefined;
      return;
    }

    const { parkedVehiclesRef, parkingConfigRef, parkingViolationsRef, addNotificationFromParking } = game;

    deltaQueue.onParkedVehiclesUpdate = (vehicles) => {
      parkedVehiclesRef.current = vehicles;
    };
    deltaQueue.onVehicleParked = (v) => {
      parkedVehiclesRef.current = [
        ...parkedVehiclesRef.current.filter(
          (p) => !(p.tileX === v.tileX && p.tileY === v.tileY && p.slot === v.slot)
        ),
        v,
      ];
      // Schwarzparker sofort lokal als Verstoß merken
      if (v.isViolation) {
        parkingViolationsRef.current = [
          ...parkingViolationsRef.current.filter(
            (pv) => !(pv.tileX === v.tileX && pv.tileY === v.tileY && pv.slot === v.slot)
          ),
          { tileX: v.tileX, tileY: v.tileY, slot: v.slot, status: 'unpaid' as const },
        ];
      }
    };
    deltaQueue.onVehicleLeftParking = (v) => {
      // Farbe merken bevor wir das Auto entfernen
      const leaving = parkedVehiclesRef.current.find(
        (p) => p.tileX === v.tileX && p.tileY === v.tileY && p.slot === v.slot
      );
      parkedVehiclesRef.current = parkedVehiclesRef.current.filter(
        (p) => !(p.tileX === v.tileX && p.tileY === v.tileY && p.slot === v.slot)
      );
      // Violation auch entfernen wenn Auto weg ist
      parkingViolationsRef.current = parkingViolationsRef.current.filter(
        (pv) => !(pv.tileX === v.tileX && pv.tileY === v.tileY && pv.slot === v.slot)
      );
      // Auto wieder auf die Strasse spawnen
      const color = leaving?.color ?? '#cc4444';
      spawnCarFromParkingRef.current?.(v.tileX, v.tileY, color);
    };

    // Parking configs
    deltaQueue.onParkingConfigsUpdate = (configs) => {
      parkingConfigRef.current = configs;
    };
    deltaQueue.onParkingConfigUpdated = (cfg) => {
      parkingConfigRef.current = [
        ...parkingConfigRef.current.filter((c) => !(c.tileX === cfg.tileX && c.tileY === cfg.tileY)),
        cfg,
      ];
    };

    // Parking violations
    deltaQueue.onParkingViolationsUpdate = (violations) => {
      // Merge: neue dazu, bestehende behalten
      const existing = parkingViolationsRef.current;
      const merged = [...existing];
      for (const v of violations) {
        const idx = merged.findIndex((e) => e.tileX === v.tileX && e.tileY === v.tileY && e.slot === v.slot);
        if (idx >= 0) merged[idx] = v; else merged.push(v);
      }
      parkingViolationsRef.current = merged;
    };

    // Fine issued notification
    deltaQueue.onParkingFineIssued = (data) => {
      // Verstoß als 'fined' markieren
      parkingViolationsRef.current = parkingViolationsRef.current.map((pv) =>
        pv.tileX === data.tileX && pv.tileY === data.tileY && pv.slot === data.slot
          ? { ...pv, status: 'fined' as const }
          : pv
      );
      addNotificationFromParking(data);
    };

    return () => {
      deltaQueue.onParkedVehiclesUpdate = undefined;
      deltaQueue.onVehicleParked = undefined;
      deltaQueue.onVehicleLeftParking = undefined;
      deltaQueue.onParkingConfigsUpdate = undefined;
      deltaQueue.onParkingConfigUpdated = undefined;
      deltaQueue.onParkingViolationsUpdate = undefined;
      deltaQueue.onParkingFineIssued = undefined;
    };
  }, [multiplayer?.connectionState, game]);

  // Register callback to receive remote stats updates
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.setOnStatsReceived((stats) => {
      // Server-authoritative: auch der bisherige Sender übernimmt Server-Stand.
      console.log('[useMultiplayerSync] 🏛️ Autoritative Stats empfangen, wende an:', {
        money: stats.money,
        population: stats.population,
        taxRate: stats.taxRate,
      });
      
      // Stats im GameContext aktualisieren
      if (game.applyRemoteStats) {
        game.applyRemoteStats(stats);
      }

      // Willkommen-zurück-Benachrichtigung (Idle-Einnahmen vom Server)
      const idleEarnings = (stats as Record<string, unknown>).idle_earnings;
      const idleDays = (stats as Record<string, unknown>).idle_days;
      if (typeof idleEarnings === 'number' && idleEarnings !== 0 && typeof idleDays === 'number') {
        const timeText = idleDays >= 1
          ? `${Math.round(idleDays * 10) / 10} Tag${idleDays >= 1.5 ? 'e' : ''}`
          : idleDays * 24 >= 1
            ? `${Math.round(idleDays * 24)} Stunde${Math.round(idleDays * 24) !== 1 ? 'n' : ''}`
            : `${Math.round(idleDays * 24 * 60)} Minuten`;
        const earningsText = idleEarnings >= 0
          ? `+Fr. ${idleEarnings.toLocaleString('de-CH')}`
          : `-Fr. ${Math.abs(idleEarnings).toLocaleString('de-CH')}`;
        const icon = idleEarnings >= 0 ? 'money' : 'city';
        game.addNotification(
          'Willkommen zurück!',
          `Deine Stadt hat in ${timeText} ${earningsText} verdient`,
          icon,
        );
      }

      // Meilenstein-Benachrichtigungen
      const milestones = (stats as Record<string, unknown>).milestones_awarded;
      if (Array.isArray(milestones) && milestones.length > 0) {
        for (const ms of milestones) {
          const m = ms as { threshold: number; bonus: number; code: string };
          game.addNotification(
            `Meilenstein: ${m.threshold.toLocaleString()} Einwohner!`,
            `Bonus: +Fr. ${m.bonus.toLocaleString('de-CH')} fuer dine Gmeindekasse`,
            'money',
          );
        }
      }
    });

    return () => {
      multiplayer.setOnStatsReceived(null);
    };
  }, [multiplayer, game]);

  // Register callbacks for Partnership events (discover/connect cities)
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;

    // Callback: Wenn wir eine Stadt entdecken, an andere Spieler broadcasten
    game.setPartnershipDiscoveredCallback((data) => {
      console.log('[useMultiplayerSync] 🏘️ Partnership Discovered - broadcasten:', data.partnerName);
      deltaQueue.sendPartnershipDiscovered(data);
    });

    // Callback: Wenn wir eine Handelsroute etablieren, an andere Spieler broadcasten
    game.setPartnershipConnectedCallback((data) => {
      console.log('[useMultiplayerSync] 🤝 Partnership Connected - broadcasten:', data.partnerName);
      deltaQueue.sendPartnershipConnected(data);
    });

    // Listener: Wenn andere Spieler eine Stadt entdecken
    deltaQueue.setOnPartnershipDiscovered((data) => {
      console.log('[useMultiplayerSync] 🏘️ Remote Partnership Discovered:', data.partnerName);
      // Finde die Stadt im lokalen State und markiere sie als entdeckt
      const city = game.state.adjacentCities?.find(
        c => c.slug === data.partnerSlug || c.name === data.partnerName
      );
      if (city && !city.discovered) {
        game.discoverCity(city.id);
      }
      // Fallback: immer auch API-Quelle nachziehen (wichtig für neue Partner ausserhalb der initialen Nachbarliste)
      game.loadPartnershipsFromApi().catch(() => {});
    });

    // Listener: Wenn andere Spieler eine Handelsroute etablieren
    deltaQueue.setOnPartnershipConnected((data) => {
      console.log('[useMultiplayerSync] 🤝 Remote Partnership Connected:', data.partnerName);
      // Finde die Stadt im lokalen State und markiere sie als verbunden
      const city = game.state.adjacentCities?.find(
        c => c.slug === data.partnerSlug || c.name === data.partnerName
      );
      if (city && !city.connected) {
        game.connectToCity(city.id);
      }
      // Fallback: API-Stand immer synchronisieren, damit Map-Button sicher erscheint.
      game.loadPartnershipsFromApi().catch(() => {});
    });

    return () => {
      game.setPartnershipDiscoveredCallback(null);
      game.setPartnershipConnectedCallback(null);
      deltaQueue.setOnPartnershipDiscovered(null);
      deltaQueue.setOnPartnershipConnected(null);
    };
  }, [multiplayer, multiplayer?.connectionState, game]);
  
  // Flush batched placements - uses ref to avoid stale closure issues
  const flushPlacements = useCallback(() => {
    const mp = multiplayerRef.current;
    if (!mp || placementBufferRef.current.length === 0) return;
    
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    
    const placements = [...placementBufferRef.current];
    placementBufferRef.current = [];
    
    if (placements.length === 1) {
      // Single placement - send as regular place action
      const p = placements[0];
      mp.dispatchAction({ type: 'place', x: p.x, y: p.y, tool: p.tool });
    } else {
      // Multiple placements - send as batch
      mp.dispatchAction({ type: 'placeBatch', placements });
    }
  }, []);
  
  // Register callback to broadcast local placements
  // Bei CoreDeltaProvider: nur dispatchAction aufrufen (Provider sendet via Delta)
  // Bei Supabase: dispatchAction + separates Delta-Sync
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      game.setPlaceCallback(null);
      // Flush any pending placements
      if (placementBufferRef.current.length > 0) {
        placementBufferRef.current = [];
      }
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      return;
    }
    
    const backendType = getBackendType();
    const isCoreDelta = backendType === 'core-delta';
    
    console.log('[useMultiplayerSync] ✅ PlaceCallback registriert, Backend:', backendType);
    
    game.setPlaceCallback(({ x, y, tool }: { x: number; y: number; tool: Tool }) => {
      console.log('[useMultiplayerSync] 📍 PlaceCallback aufgerufen:', { x, y, tool });
      
      if (tool === 'bulldoze') {
        // Bulldoze is sent immediately (not batched)
        flushPlacements(); // Flush any pending placements first
        multiplayer.dispatchAction({ type: 'bulldoze', x, y });
        
        // Bei Supabase-Modus: Auch separat an Delta-Sync senden
        if (!isCoreDelta && deltaSyncInitializedRef.current) {
          deltaQueue.push({ type: 'bulldoze', x, y });
        }
      } else if (tool === 'bauzone' || tool === 'bauzone_remove') {
        flushPlacements();
        multiplayer.dispatchAction({ type: 'place', tool, x, y });
        if (!isCoreDelta && deltaSyncInitializedRef.current) {
          deltaQueue.push({ type: 'bauzone', x, y, enabled: tool === 'bauzone' });
        }
      } else if (tool !== 'select') {
        // Add to batch for Realtime
        placementBufferRef.current.push({ x, y, tool });
        
        // Bei Supabase-Modus: Auch separat an Delta-Sync senden
        if (!isCoreDelta && deltaSyncInitializedRef.current) {
          if (tool === 'zone_water' || tool === 'zone_land') {
            deltaQueue.push({ type: 'place', tool: tool as Tool, x, y });
          } else if (tool.startsWith('zone_')) {
            const zoneMap: Record<string, 'residential' | 'commercial' | 'industrial' | 'none'> = {
              'zone_residential': 'residential',
              'zone_commercial': 'commercial',
              'zone_industrial': 'industrial',
              'zone_dezone': 'none',
            };
            const zone = zoneMap[tool];
            if (zone) deltaQueue.push({ type: 'zone', zone, x, y });
          } else {
            deltaQueue.push(buildPlaceDelta(tool, x, y));
          }
        }
        
        // Force flush if batch is large
        if (placementBufferRef.current.length >= BATCH_MAX_SIZE) {
          flushPlacements();
        } else if (!flushTimeoutRef.current) {
          // Schedule flush after interval
          flushTimeoutRef.current = setTimeout(() => {
            flushTimeoutRef.current = null;
            flushPlacements();
          }, BATCH_FLUSH_INTERVAL);
        }
      }
    });
    
    return () => {
      // Flush remaining placements before disconnecting
      flushPlacements();
      game.setPlaceCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, game, flushPlacements]);

  // Register callback to broadcast bridge creation
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      game.setBridgeCallback(null);
      return;
    }
    
    game.setBridgeCallback(({ pathTiles, trackType }) => {
      multiplayer.dispatchAction({ type: 'createBridges', pathTiles, trackType });
    });
    
    return () => {
      game.setBridgeCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, game]);

  // Keep the game state synced with the Supabase database
  // The provider handles throttling internally (saves every 3 seconds max)
  // Also updates the local saved cities index so the city appears on the homepage
  const lastUpdateRef = useRef<number>(0);
  const lastIndexUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    
    // SICHERHEIT: ViewOnly-Benutzer (Gäste) senden keine Updates
    if (multiplayer.isViewOnly) return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return; // Throttle to 2 second intervals
    lastUpdateRef.current = now;
    
    // Update the game state - provider will save to Supabase database (throttled)
    multiplayer.updateGameState(game.state);
    
    // Also update the local saved cities index (less frequently - every 10 seconds)
    if (multiplayer.roomCode && now - lastIndexUpdateRef.current > 10000) {
      lastIndexUpdateRef.current = now;
      updateSavedCitiesIndex(game.state, multiplayer.roomCode);
    }
  }, [multiplayer, game.state]);

  // Broadcast a local action to peers
  const broadcastAction = useCallback((action: GameActionInput) => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    
    // Prevent broadcasting the same action twice
    const actionKey = JSON.stringify(action);
    if (lastActionRef.current === actionKey) return;
    lastActionRef.current = actionKey;
    
    // Clear the ref after a short delay to allow repeated actions
    setTimeout(() => {
      if (lastActionRef.current === actionKey) {
        lastActionRef.current = null;
      }
    }, 100);
    
    multiplayer.dispatchAction(action);
  }, [multiplayer]);

  // Helper to broadcast a placement action
  // Uses object parameter to prevent accidental coordinate swapping
  const broadcastPlace = useCallback(({ x, y, tool }: { x: number; y: number; tool: Tool }) => {
    if (tool === 'bulldoze') {
      broadcastAction({ type: 'bulldoze', x, y });
    } else if (tool !== 'select') {
      broadcastAction({ type: 'place', x, y, tool });
    }
  }, [broadcastAction]);

  // Helper to broadcast tax rate change
  const broadcastTaxRate = useCallback((rate: number) => {
    broadcastAction({ type: 'setTaxRate', rate });
  }, [broadcastAction]);

  // Helper to broadcast budget change
  const broadcastBudget = useCallback((key: keyof Budget, funding: number) => {
    broadcastAction({ type: 'setBudget', key, funding });
  }, [broadcastAction]);

  // Helper to broadcast speed change
  const broadcastSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    broadcastAction({ type: 'setSpeed', speed });
  }, [broadcastAction]);

  // Helper to broadcast disasters toggle
  const broadcastDisasters = useCallback((enabled: boolean) => {
    broadcastAction({ type: 'setDisasters', enabled });
  }, [broadcastAction]);

  // Check if we're in multiplayer mode
  const isMultiplayer = multiplayer?.connectionState === 'connected';
  const isHost = multiplayer?.isHost ?? false;
  const playerCount = multiplayer?.players.length ?? 0;
  const roomCode = multiplayer?.roomCode ?? null;
  const connectionState = multiplayer?.connectionState ?? 'disconnected';

  return {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    connectionState,
    players: multiplayer?.players ?? [],
    broadcastPlace,
    broadcastTaxRate,
    broadcastBudget,
    broadcastSpeed,
    broadcastDisasters,
    broadcastAction,
    leaveRoom: multiplayer?.leaveRoom ?? (() => {}),
  };
}
