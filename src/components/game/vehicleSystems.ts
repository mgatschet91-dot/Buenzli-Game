import React, { useCallback, useRef } from 'react';
import type { ParkedVehicle } from '@/lib/deltaSync';
import { Bus, BusLine, Car, CarDirection, EmergencyVehicle, EmergencyVehicleType, Pedestrian, PedestrianDestType, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { BUS_COLORS, BUS_MIN_POPULATION, BUS_MIN_ZOOM, BUS_SPEED_MAX, BUS_SPEED_MIN, BUS_SPAWN_INTERVAL_MAX, BUS_SPAWN_INTERVAL_MIN, BUS_STOP_DURATION_MAX, BUS_STOP_DURATION_MIN, BUS_MAX_LINES, BUS_MIN_STOPS_PER_LINE, BUS_MAX_STOPS_PER_LINE, BUS_PASSENGER_CAPACITY, BUS_LINE_COLORS, BUS_WAIT_TIMEOUT, CAR_COLORS, CAR_MIN_ZOOM, CAR_MIN_ZOOM_MOBILE, DIRECTION_META, MAX_BUSES, MAX_BUSES_MOBILE, PEDESTRIAN_MAX_COUNT, PEDESTRIAN_MAX_COUNT_MOBILE, PEDESTRIAN_MIN_ZOOM, PEDESTRIAN_MIN_ZOOM_MOBILE, PEDESTRIAN_ROAD_TILE_DENSITY, PEDESTRIAN_ROAD_TILE_DENSITY_MOBILE, PEDESTRIAN_SPAWN_BATCH_SIZE, PEDESTRIAN_SPAWN_BATCH_SIZE_MOBILE, PEDESTRIAN_SPAWN_INTERVAL, PEDESTRIAN_SPAWN_INTERVAL_MOBILE, VEHICLE_FAR_ZOOM_THRESHOLD } from './constants';
import { isRoadTile, isAutobahnTile, isDrivableTile, getDirectionOptions, getAutobahnDirectionOptions, pickNextDirection, findPathOnRoads, getDirectionToTile, gridToScreen } from './utils';
import { findBusStops, findResidentialBuildings, findPedestrianDestinations, findStations, findFires, findRecreationAreas, findEnterableBuildings, SPORTS_TYPES, ACTIVE_RECREATION_TYPES } from './gridFinders';
import { drawPedestrians as drawPedestriansUtil } from './drawPedestrians';
import { BuildingType, Tile } from '@/types/game';
import { getTrafficLightState, canProceedThroughIntersection, TRAFFIC_LIGHT_TIMING } from './trafficSystem';
import { isRailroadCrossing, shouldStopAtCrossing } from './railSystem';
import { CrimeType, getRandomCrimeType, getCrimeDuration } from './incidentData';
import {
  createPedestrian,
  updatePedestrianState,
  spawnPedestrianAtRecreation,
  spawnPedestrianFromBuilding,
  spawnPedestrianInsideBuilding,
  spawnPedestrianApproachingShop,
  findBeachTiles,
  getRandomBeachTile,
  spawnPedestrianAtBeach,
  createPoliceNpc,
  buildDirectGridPath,
  spawnSubwayCommuter,
} from './pedestrianSystem';

/** Train type for crossing detection (minimal interface) */
export interface TrainForCrossing {
  tileX: number;
  tileY: number;
  direction: CarDirection;
  progress: number;
  carriages: { tileX: number; tileY: number }[];
}

export interface VehicleSystemRefs {
  carsRef: React.MutableRefObject<Car[]>;
  carIdRef: React.MutableRefObject<number>;
  carSpawnTimerRef: React.MutableRefObject<number>;
  busesRef: React.MutableRefObject<Bus[]>;
  busIdRef: React.MutableRefObject<number>;
  busSpawnTimerRef: React.MutableRefObject<number>;
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>;
  emergencyVehicleIdRef: React.MutableRefObject<number>;
  emergencyDispatchTimerRef: React.MutableRefObject<number>;
  activeFiresRef: React.MutableRefObject<Set<string>>;
  activeCrimesRef: React.MutableRefObject<Set<string>>;
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, { x: number; y: number; type: CrimeType; timeRemaining: number }>>;
  crimeSpawnTimerRef: React.MutableRefObject<number>;
  pedestriansRef: React.MutableRefObject<Pedestrian[]>;
  pedestrianIdRef: React.MutableRefObject<number>;
  pedestrianSpawnTimerRef: React.MutableRefObject<number>;
  trafficLightTimerRef: React.MutableRefObject<number>;
  trainsRef: React.MutableRefObject<TrainForCrossing[]>;
  busLinesRef: React.MutableRefObject<BusLine[]>;
  busLinesGridVersionRef: React.MutableRefObject<number>;
  serverBusLinesRef: React.MutableRefObject<{ id: number; name: string; color: string; stops: { x: number; y: number; sequence_order: number }[] }[]>;
}

export interface VehicleSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  gridVersionRef: React.MutableRefObject<number>;
  cachedRoadTileCountRef: React.MutableRefObject<{ count: number; gridVersion: number }>;
  // PERF: Pre-computed intersection map to avoid repeated getDirectionOptions() calls per-car per-frame
  cachedIntersectionMapRef: React.MutableRefObject<{ map: Map<number, boolean>; gridVersion: number }>;
  state: {
    services: {
      police: number[][];
    };
    stats: {
      population: number;
      trafficCongestion?: number;
    };
  };
  isMobile: boolean;
  visualHour: number;
  // Parking system
  parkedVehiclesRef: React.MutableRefObject<ParkedVehicle[]>;
  emitParkVehicleRef: React.MutableRefObject<(tileX: number, tileY: number, slot: number, color: string) => void>;
  emitLeaveParkingRef: React.MutableRefObject<(tileX: number, tileY: number, slot: number) => void>;
}

export function useVehicleSystems(
  refs: VehicleSystemRefs,
  systemState: VehicleSystemState
) {
  const {
    carsRef,
    carIdRef,
    carSpawnTimerRef,
    busesRef,
    busIdRef,
    busSpawnTimerRef,
    emergencyVehiclesRef,
    emergencyVehicleIdRef,
    emergencyDispatchTimerRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
    crimeSpawnTimerRef,
    pedestriansRef,
    pedestrianIdRef,
    pedestrianSpawnTimerRef,
    trafficLightTimerRef,
    trainsRef,
    busLinesRef,
    busLinesGridVersionRef,
    serverBusLinesRef,
  } = refs;

  const { worldStateRef, gridVersionRef, cachedRoadTileCountRef, cachedIntersectionMapRef, state, isMobile, visualHour, parkedVehiclesRef, emitParkVehicleRef, emitLeaveParkingRef } = systemState;

  const spawnRandomCar = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    for (let attempt = 0; attempt < 20; attempt++) {
      const tileX = Math.floor(Math.random() * currentGridSize);
      const tileY = Math.floor(Math.random() * currentGridSize);
      if (!isRoadTile(currentGrid, currentGridSize, tileX, tileY) && !isAutobahnTile(currentGrid, currentGridSize, tileX, tileY)) continue;

      const onAutobahn = isAutobahnTile(currentGrid, currentGridSize, tileX, tileY);
      const options = onAutobahn
        ? getAutobahnDirectionOptions(currentGrid, currentGridSize, tileX, tileY)
        : getDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
      if (options.length === 0) continue;

      // Use stored autobahn direction if available, otherwise pick random
      const storedDir = onAutobahn ? currentGrid[tileY][tileX].building.autobahnDirection as CarDirection | undefined : undefined;
      const direction = storedDir && options.includes(storedDir) ? storedDir : options[Math.floor(Math.random() * options.length)];
      // Lane offset based on direction for proper right-hand traffic
      // Positive offset = right side of road in direction of travel
      const baseLaneOffset = 4 + Math.random() * 2;
      // North and East get positive offset, South and West get negative
      // On autobahn both lanes go same direction, use random sign for lane
      const laneSign = onAutobahn
        ? (Math.random() < 0.5 ? 1 : -1)
        : ((direction === 'north' || direction === 'east') ? 1 : -1);
      // Cars have a limited lifespan - shorter on mobile to reduce crowding
      // Autobahn cars get longer lifespan since they move faster
      const carMaxAge = onAutobahn
        ? (isMobile ? 35 + Math.random() * 20 : 60 + Math.random() * 40)
        : (isMobile
          ? 25 + Math.random() * 15   // 25-40 seconds on mobile
          : 45 + Math.random() * 30); // 45-75 seconds on desktop

      carsRef.current.push({
        id: carIdRef.current++,
        tileX,
        tileY,
        direction,
        progress: Math.random() * 0.8,
        speed: onAutobahn
          ? (0.55 + Math.random() * 0.35) * 0.7  // ~1.5x faster on autobahn
          : (0.35 + Math.random() * 0.35) * 0.7,
        age: 0,
        maxAge: carMaxAge,
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        laneOffset: laneSign * baseLaneOffset,
      });
      return true;
    }

    return false;
  }, [worldStateRef, carsRef, carIdRef, isMobile]);

  const PARTY_CAR_COLORS = ['#f43f5e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b'];

  const spawnPartyGuestCar = useCallback((mansionTileX: number, mansionTileY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    // Zuerst Strassenkacheln in der Nähe des Mansions sammeln (4–10 Tiles Abstand)
    // damit das Auto von "nahe" anreist und sicher am Mansion vorbeikommt
    const nearRoads: { x: number; y: number }[] = [];
    for (let r = 4; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // nur äusserer Ring
          const nx = mansionTileX + dx;
          const ny = mansionTileY + dy;
          if (nx < 0 || ny < 0 || nx >= currentGridSize || ny >= currentGridSize) continue;
          if (isRoadTile(currentGrid, currentGridSize, nx, ny)) {
            if (getDirectionOptions(currentGrid, currentGridSize, nx, ny).length > 0) {
              nearRoads.push({ x: nx, y: ny });
            }
          }
        }
      }
      if (nearRoads.length >= 6) break; // Genug Kandidaten gefunden
    }

    // Falls keine Strassenkacheln in der Nähe: globaler Fallback
    const candidates = nearRoads.length > 0 ? nearRoads : null;

    for (let attempt = 0; attempt < 30; attempt++) {
      let tileX: number, tileY: number;
      if (candidates && attempt < 20) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        tileX = pick.x;
        tileY = pick.y;
      } else {
        tileX = Math.floor(Math.random() * currentGridSize);
        tileY = Math.floor(Math.random() * currentGridSize);
      }
      if (!isRoadTile(currentGrid, currentGridSize, tileX, tileY)) continue;

      const options = getDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
      if (options.length === 0) continue;

      const direction = options[Math.floor(Math.random() * options.length)];
      const baseLaneOffset = 4 + Math.random() * 1.5;
      // Abwechselnd links/rechts parken (beide Strassenseiten)
      const rightSide = carIdRef.current % 2 === 0;
      const laneSign = rightSide ? 1 : -1;

      carsRef.current.push({
        id: carIdRef.current++,
        tileX,
        tileY,
        direction,
        progress: 0,
        speed: (0.35 + Math.random() * 0.25) * 0.7,
        age: 0,
        maxAge: 180, // 3 Minuten (genug Zeit um die Mansion zu erreichen)
        color: PARTY_CAR_COLORS[Math.floor(Math.random() * PARTY_CAR_COLORS.length)],
        laneOffset: laneSign * baseLaneOffset,
        isParty: true,
        partyMansionX: mansionTileX,
        partyMansionY: mansionTileY,
      });
      return true;
    }
    return false;
  }, [worldStateRef, carsRef, carIdRef]);

  const findResidentialBuildingsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findResidentialBuildings(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findPedestrianDestinationsCallback = useCallback((): { x: number; y: number; type: PedestrianDestType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findPedestrianDestinations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findBusStopsCallback = useCallback((): { x: number; y: number; explicit: boolean }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findBusStops(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const buildBusRoute = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return null;

    const allStops = findBusStopsCallback();
    if (allStops.length < 2) return null;

    // Prefer explicit bus_stop buildings when 2+ exist
    const explicitStops = allStops.filter(s => s.explicit);
    const stops = explicitStops.length >= 2 ? explicitStops : allStops;

    for (let attempt = 0; attempt < 10; attempt++) {
      const start = stops[Math.floor(Math.random() * stops.length)];
      let end = stops[Math.floor(Math.random() * stops.length)];
      if (start.x === end.x && start.y === end.y) {
        end = stops[(stops.indexOf(start) + 1) % stops.length];
      }

      const path = findPathOnRoads(currentGrid, currentGridSize, start.x, start.y, end.x, end.y);
      if (path && path.length > 0) {
        return { path, stops: [start, end] };
      }
    }

    return null;
  }, [worldStateRef, findBusStopsCallback]);

  const buildBusRouteFrom = useCallback((start: { x: number; y: number }) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return null;

    const allStops = findBusStopsCallback();
    if (allStops.length < 2) return null;

    // Prefer explicit bus_stop buildings when 2+ exist
    const explicitStops = allStops.filter(s => s.explicit);
    const stops = explicitStops.length >= 2 ? explicitStops : allStops;

    for (let attempt = 0; attempt < 10; attempt++) {
      const end = stops[Math.floor(Math.random() * stops.length)];
      if (end.x === start.x && end.y === start.y) continue;

      const path = findPathOnRoads(currentGrid, currentGridSize, start.x, start.y, end.x, end.y);
      if (path && path.length > 0) {
        return { path, stops: [start, end] };
      }
    }

    return null;
  }, [worldStateRef, findBusStopsCallback]);

  // Generate bus lines from placed bus stops (cached by grid version)
  // If server-defined bus lines exist, use those; otherwise auto-generate
  const generateBusLines = useCallback((): BusLine[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];

    const currentGV = gridVersionRef.current;
    if (busLinesGridVersionRef.current === currentGV && busLinesRef.current.length > 0) {
      return busLinesRef.current;
    }

    // ── Find bus_station on the map (start/end point for all lines) ──
    let busStationPos: { x: number; y: number } | null = null;
    for (let y = 0; y < currentGridSize && !busStationPos; y++) {
      for (let x = 0; x < currentGridSize && !busStationPos; x++) {
        if ((currentGrid[y][x]?.building?.type as string) === 'bus_station') {
          busStationPos = { x, y };
        }
      }
    }

    // ── Server-defined bus lines (from Transport company) ──
    const serverLines = serverBusLinesRef.current;
    if (serverLines && serverLines.length > 0) {
      const lines: BusLine[] = [];
      for (const sl of serverLines) {
        const sortedStops = [...sl.stops].sort((a, b) => a.sequence_order - b.sequence_order);
        const sequence = sortedStops.map(s => ({ x: s.x, y: s.y }));
        if (sequence.length < 2) continue;

        // Build route: bus_station → stop1 → stop2 → ... → stopN → bus_station
        const routePoints: { x: number; y: number }[] = [];
        if (busStationPos) routePoints.push(busStationPos);
        routePoints.push(...sequence);
        if (busStationPos) routePoints.push(busStationPos);

        // Build full path via roads
        const fullPath: { x: number; y: number }[] = [];
        let pathValid = true;
        for (let i = 0; i < routePoints.length - 1; i++) {
          const from = routePoints[i];
          const to = routePoints[i + 1];
          const segment = findPathOnRoads(currentGrid, currentGridSize, from.x, from.y, to.x, to.y);
          if (!segment || segment.length === 0) { pathValid = false; break; }
          if (fullPath.length > 0 && segment.length > 0) {
            fullPath.push(...segment.slice(1));
          } else {
            fullPath.push(...segment);
          }
        }
        if (!pathValid || fullPath.length < 4) continue;

        lines.push({
          id: sl.id,
          name: sl.name,
          color: sl.color,
          stopSequence: sequence,
          fullPath,
        });
      }
      if (lines.length > 0) {
        busLinesRef.current = lines;
        busLinesGridVersionRef.current = currentGV;
        return lines;
      }
    }

    // ── Fallback: Auto-generate bus lines from placed stops ──
    const allStops = findBusStopsCallback();
    if (allStops.length < BUS_MIN_STOPS_PER_LINE) {
      busLinesRef.current = [];
      busLinesGridVersionRef.current = currentGV;
      return [];
    }

    // Prefer explicit bus_stop buildings
    const explicitStops = allStops.filter(s => s.explicit);
    const stops = explicitStops.length >= BUS_MIN_STOPS_PER_LINE ? explicitStops : allStops;

    const used = new Set<string>();
    const lines: BusLine[] = [];

    for (let lineIdx = 0; lineIdx < BUS_MAX_LINES && stops.length - used.size >= BUS_MIN_STOPS_PER_LINE; lineIdx++) {
      // Find starting stop (first unused)
      let start: { x: number; y: number } | null = null;
      for (const s of stops) {
        if (!used.has(`${s.x},${s.y}`)) { start = s; break; }
      }
      if (!start) break;

      const sequence: { x: number; y: number }[] = [start];
      used.add(`${start.x},${start.y}`);

      // Greedily add nearest unused stops
      while (sequence.length < BUS_MAX_STOPS_PER_LINE) {
        const last = sequence[sequence.length - 1];
        let bestDist = Infinity;
        let bestStop: { x: number; y: number } | null = null;
        for (const s of stops) {
          const key = `${s.x},${s.y}`;
          if (used.has(key)) continue;
          const dist = Math.abs(s.x - last.x) + Math.abs(s.y - last.y);
          if (dist < bestDist) { bestDist = dist; bestStop = s; }
        }
        if (!bestStop || bestDist > 40) break; // Too far = stop adding
        sequence.push(bestStop);
        used.add(`${bestStop.x},${bestStop.y}`);
      }

      if (sequence.length < BUS_MIN_STOPS_PER_LINE) continue;

      // Build full path: bus_station → stop0 → stop1 → ... → stopN → bus_station
      const routePoints: { x: number; y: number }[] = [];
      if (busStationPos) routePoints.push(busStationPos);
      routePoints.push(...sequence);
      if (busStationPos) routePoints.push(busStationPos);
      // If no bus_station, loop back to first stop
      if (!busStationPos) routePoints.push(sequence[0]);

      const fullPath: { x: number; y: number }[] = [];
      let pathValid = true;
      for (let i = 0; i < routePoints.length - 1; i++) {
        const from = routePoints[i];
        const to = routePoints[i + 1];
        const segment = findPathOnRoads(currentGrid, currentGridSize, from.x, from.y, to.x, to.y);
        if (!segment || segment.length === 0) { pathValid = false; break; }
        // Avoid duplicating the start of each segment (it's the end of the previous)
        if (fullPath.length > 0 && segment.length > 0) {
          fullPath.push(...segment.slice(1));
        } else {
          fullPath.push(...segment);
        }
      }

      if (!pathValid || fullPath.length < 4) continue;

      lines.push({
        id: lineIdx,
        name: `Linie ${lineIdx + 1}`,
        color: BUS_LINE_COLORS[lineIdx % BUS_LINE_COLORS.length],
        stopSequence: sequence,
        fullPath,
      });
    }

    busLinesRef.current = lines;
    busLinesGridVersionRef.current = currentGV;
    return lines;
  }, [worldStateRef, gridVersionRef, busLinesRef, busLinesGridVersionRef, findBusStopsCallback, serverBusLinesRef]);

  const spawnBus = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    // Try line-based spawning first
    const lines = generateBusLines();
    if (lines.length === 0) {
      // Fallback to legacy random routing
      const route = buildBusRoute();
      if (!route) return false;

      const startTile = route.path[0];
      let direction: CarDirection = 'south';
      if (route.path.length > 1) {
        const dir = getDirectionToTile(startTile.x, startTile.y, route.path[1].x, route.path[1].y);
        if (dir) direction = dir;
      }
      const baseLaneOffset = 6 + Math.random() * 2.5;
      const laneSign = (direction === 'north' || direction === 'east') ? 1 : -1;
      busesRef.current.push({
        id: busIdRef.current++,
        tileX: startTile.x, tileY: startTile.y,
        direction, progress: 0,
        speed: BUS_SPEED_MIN + Math.random() * (BUS_SPEED_MAX - BUS_SPEED_MIN),
        age: 0, maxAge: 160 + Math.random() * 120,
        color: BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)],
        laneOffset: laneSign * baseLaneOffset,
        path: route.path, pathIndex: 0, stopTimer: 0, stops: route.stops,
        lineId: -1, passengerCount: 0, passengerCapacity: BUS_PASSENGER_CAPACITY,
        currentStopIndex: -1, boardingTimer: 0,
      });
      return true;
    }

    // Pick line with fewest active buses (load balance)
    const busCountPerLine = new Map<number, number>();
    for (const b of busesRef.current) {
      if (b.lineId >= 0) busCountPerLine.set(b.lineId, (busCountPerLine.get(b.lineId) || 0) + 1);
    }
    let bestLine = lines[0];
    let bestCount = busCountPerLine.get(bestLine.id) || 0;
    for (const line of lines) {
      const cnt = busCountPerLine.get(line.id) || 0;
      if (cnt < bestCount) { bestLine = line; bestCount = cnt; }
    }

    const route = bestLine.fullPath;
    if (route.length < 2) return false;

    // Start at a random position in the loop for variety
    const startIdx = Math.floor(Math.random() * Math.min(route.length - 1, bestLine.stopSequence.length));
    const startTile = route[startIdx] || route[0];
    let direction: CarDirection = 'south';
    const nextIdx = startIdx + 1 < route.length ? startIdx + 1 : 0;
    const dir = getDirectionToTile(startTile.x, startTile.y, route[nextIdx].x, route[nextIdx].y);
    if (dir) direction = dir;

    const baseLaneOffset = 6 + Math.random() * 2.5;
    const laneSign = (direction === 'north' || direction === 'east') ? 1 : -1;

    busesRef.current.push({
      id: busIdRef.current++,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: 0,
      speed: BUS_SPEED_MIN + Math.random() * (BUS_SPEED_MAX - BUS_SPEED_MIN),
      age: 0,
      maxAge: 200 + Math.random() * 200, // Longer lifespan for line buses
      color: bestLine.color,
      laneOffset: laneSign * baseLaneOffset,
      path: route,
      pathIndex: startIdx,
      stopTimer: 0,
      stops: bestLine.stopSequence,
      lineId: bestLine.id,
      passengerCount: 0,
      passengerCapacity: BUS_PASSENGER_CAPACITY,
      currentStopIndex: -1,
      boardingTimer: 0,
    });

    return true;
  }, [worldStateRef, buildBusRoute, generateBusLines, busesRef, busIdRef]);

  // Find recreation areas
  const findRecreationAreasCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findRecreationAreas(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find enterable buildings
  const findEnterableBuildingsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findEnterableBuildings(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Find beach tiles (water tiles adjacent to land)
  const findBeachTilesCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findBeachTiles(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnPedestrian = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    const residentials = findResidentialBuildingsCallback();
    if (residentials.length === 0) {
      return false;
    }

    const destinations = findPedestrianDestinationsCallback();
    if (destinations.length === 0) {
      return false;
    }

    // Choose spawn type - more variety in pedestrian spawning
    const spawnType = Math.random();

    // 20% - Pedestrian at the beach (swimming or on mat) — nur tagsüber (8–20 Uhr)
    if (spawnType < 0.20 && visualHour >= 8 && visualHour < 20) {
      const beachTiles = findBeachTilesCallback();
      if (beachTiles.length > 0) {
        const beachInfo = getRandomBeachTile(beachTiles);
        if (beachInfo) {
          const home = residentials[Math.floor(Math.random() * residentials.length)];
          const ped = spawnPedestrianAtBeach(
            pedestrianIdRef.current++,
            beachInfo,
            currentGrid,
            currentGridSize,
            home.x,
            home.y
          );
          if (ped) {
            pedestriansRef.current.push(ped);
            return true;
          }
        }
      }
      // Fall through if no beach tiles
    }

    // 15% - Pedestrian waiting at a bus stop (only when bus lines exist)
    if (spawnType < 0.35) {
      const lines = busLinesRef.current;
      if (lines.length > 0) {
        const line = lines[Math.floor(Math.random() * lines.length)];
        if (line.stopSequence.length >= 2) {
          const startIdx = Math.floor(Math.random() * line.stopSequence.length);
          let endIdx = Math.floor(Math.random() * line.stopSequence.length);
          if (endIdx === startIdx) endIdx = (startIdx + 1) % line.stopSequence.length;
          const stop = line.stopSequence[startIdx];
          const home = residentials[Math.floor(Math.random() * residentials.length)];

          const ped = createPedestrian(
            pedestrianIdRef.current++,
            home.x, home.y,       // homeX, homeY
            stop.x, stop.y,       // destX, destY
            'commercial',         // destType
            [{ x: stop.x, y: stop.y }], // path (just the stop tile)
            0,                    // startIndex
            'south',              // direction
          );
          if (ped) {
            ped.state = 'waiting_at_stop';
            ped.busStopX = stop.x;
            ped.busStopY = stop.y;
            ped.targetBusLineId = line.id;
            ped.targetStopIndex = endIdx;
            ped.busWaitTimer = 0;
            ped.path = [];
            ped.pathIndex = 0;
            pedestriansRef.current.push(ped);
            return true;
          }
        }
      }
      // Fall through to other spawn types if no lines
    }

    // 7% - Subway commuter: läuft zur Station, fährt weiter zur nächsten Station
    if (spawnType < 0.22) {
      const subwayStations: { x: number; y: number }[] = [];
      for (let sy = 0; sy < currentGridSize && subwayStations.length < 30; sy++) {
        for (let sx = 0; sx < currentGridSize; sx++) {
          if (currentGrid[sy]?.[sx]?.building.type === 'subway_station') {
            subwayStations.push({ x: sx, y: sy });
          }
        }
      }
      if (subwayStations.length >= 2) {
        const station = subwayStations[Math.floor(Math.random() * subwayStations.length)];
        const home = residentials[Math.floor(Math.random() * residentials.length)];
        const ped = spawnSubwayCommuter(
          pedestrianIdRef.current++,
          station.x, station.y,
          currentGrid, currentGridSize,
          home.x, home.y
        );
        if (ped) {
          pedestriansRef.current.push(ped);
          return true;
        }
      }
      // Fall through if no stations or spawn failed
    }

    // 55% - Normal walking pedestrian heading to a destination
    if (spawnType < 0.65) {
      const home = residentials[Math.floor(Math.random() * residentials.length)];

      let dest = destinations[Math.floor(Math.random() * destinations.length)];

      // 35% chance to pick a commercial destination (shop) - boost shopping activity
      const commercialDests = destinations.filter(d => d.type === 'commercial');
      if (Math.random() < 0.35 && commercialDests.length > 0) {
        // Prefer shops over offices for visible shopping
        const { grid: currentGrid } = worldStateRef.current;
        const shopDests = commercialDests.filter(d => {
          const tile = currentGrid[d.y]?.[d.x];
          const buildingType = tile?.building.type;
          return buildingType === 'shop_small' || buildingType === 'shop_medium' || buildingType === 'mall';
        });
        dest = shopDests.length > 0
          ? shopDests[Math.floor(Math.random() * shopDests.length)]
          : commercialDests[Math.floor(Math.random() * commercialDests.length)];
      }
      // 25% chance to re-roll and specifically pick a sports/active facility if available
      else if (Math.random() < 0.25 && dest.type === 'park') {
        const { grid: currentGrid } = worldStateRef.current;
        const boostedDests = destinations.filter(d => {
          if (d.type !== 'park') return false;
          const tile = currentGrid[d.y]?.[d.x];
          const buildingType = tile?.building.type;
          return buildingType && (SPORTS_TYPES.includes(buildingType) || ACTIVE_RECREATION_TYPES.includes(buildingType));
        });
        if (boostedDests.length > 0) {
          dest = boostedDests[Math.floor(Math.random() * boostedDests.length)];
        }
      }

      const path = findPathOnRoads(currentGrid, currentGridSize, home.x, home.y, dest.x, dest.y);
      if (!path || path.length === 0) {
        return false;
      }

      // For shop destinations, start closer to destination so we see arrivals more often
      let startIndex: number;
      if (dest.type === 'commercial' && path.length > 3) {
        // Start in the second half of the path (closer to shop)
        const minStart = Math.floor(path.length * 0.5);
        startIndex = minStart + Math.floor(Math.random() * (path.length - minStart));
      } else {
        startIndex = Math.floor(Math.random() * path.length);
      }
      const startTile = path[startIndex];

      let direction: CarDirection = 'south';
      if (startIndex + 1 < path.length) {
        const nextTile = path[startIndex + 1];
        const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
        if (dir) direction = dir;
      } else if (startIndex > 0) {
        const prevTile = path[startIndex - 1];
        const dir = getDirectionToTile(prevTile.x, prevTile.y, startTile.x, startTile.y);
        if (dir) direction = dir;
      }

      const ped = createPedestrian(
        pedestrianIdRef.current++,
        home.x,
        home.y,
        dest.x,
        dest.y,
        dest.type,
        path,
        startIndex,
        direction
      );

      pedestriansRef.current.push(ped);
      return true;
    }

    // 18% - Pedestrian already at a recreation area
    if (spawnType < 0.83) {
      const recreationAreas = findRecreationAreasCallback();
      if (recreationAreas.length === 0) return false;

      let area = recreationAreas[Math.floor(Math.random() * recreationAreas.length)];

      // 50% chance to re-roll and pick a sports/active facility if available
      if (Math.random() < 0.5) {
        const sportsAreas = recreationAreas.filter(a =>
          SPORTS_TYPES.includes(a.buildingType) || ACTIVE_RECREATION_TYPES.includes(a.buildingType)
        );
        if (sportsAreas.length > 0) {
          area = sportsAreas[Math.floor(Math.random() * sportsAreas.length)];
        }
      }
      const home = residentials[Math.floor(Math.random() * residentials.length)];

      const ped = spawnPedestrianAtRecreation(
        pedestrianIdRef.current++,
        area.x,
        area.y,
        currentGrid,
        currentGridSize,
        home.x,
        home.y
      );

      if (ped) {
        pedestriansRef.current.push(ped);
        return true;
      }
      return false;
    }

    // 5% - Pedestrian already inside a shop/building (shopping, working, etc.)
    if (spawnType < 0.88) {
      const enterableBuildings = findEnterableBuildingsCallback();
      if (enterableBuildings.length === 0) return false;

      // Prefer shops/commercial buildings for more visible shopping activity
      const shopBuildings = enterableBuildings.filter(b =>
        b.buildingType === 'shop_small' || b.buildingType === 'shop_medium' || b.buildingType === 'mall'
      );
      const buildingList = shopBuildings.length > 0 && Math.random() < 0.7 ? shopBuildings : enterableBuildings;

      const building = buildingList[Math.floor(Math.random() * buildingList.length)];
      const home = residentials[Math.floor(Math.random() * residentials.length)];

      const ped = spawnPedestrianInsideBuilding(
        pedestrianIdRef.current++,
        building.x,
        building.y,
        currentGrid,
        currentGridSize,
        home.x,
        home.y
      );

      if (ped) {
        pedestriansRef.current.push(ped);
        return true;
      }
      return false;
    }

    // 7% - Pedestrian approaching a shop (visible at entrance)
    if (spawnType < 0.95) {
      const enterableBuildings = findEnterableBuildingsCallback();
      const shopBuildings = enterableBuildings.filter(b =>
        b.buildingType === 'shop_small' || b.buildingType === 'shop_medium' || b.buildingType === 'mall'
      );

      if (shopBuildings.length === 0) return false;

      const shop = shopBuildings[Math.floor(Math.random() * shopBuildings.length)];
      const home = residentials[Math.floor(Math.random() * residentials.length)];

      const ped = spawnPedestrianApproachingShop(
        pedestrianIdRef.current++,
        shop.x,
        shop.y,
        currentGrid,
        currentGridSize,
        home.x,
        home.y
      );

      if (ped) {
        pedestriansRef.current.push(ped);
        return true;
      }
      return false;
    }

    // 5% - Pedestrian exiting from a building
    const enterableBuildings = findEnterableBuildingsCallback();
    if (enterableBuildings.length === 0) return false;

    const building = enterableBuildings[Math.floor(Math.random() * enterableBuildings.length)];
    const home = residentials[Math.floor(Math.random() * residentials.length)];

    const ped = spawnPedestrianFromBuilding(
      pedestrianIdRef.current++,
      building.x,
      building.y,
      currentGrid,
      currentGridSize,
      home.x,
      home.y
    );

    if (ped) {
      pedestriansRef.current.push(ped);
      return true;
    }
    return false;
  }, [worldStateRef, findResidentialBuildingsCallback, findPedestrianDestinationsCallback, findRecreationAreasCallback, findEnterableBuildingsCallback, findBeachTilesCallback, pedestriansRef, pedestrianIdRef, busLinesRef]);

  const findStationsCallback = useCallback((type: 'fire_station' | 'police_station'): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findStations(currentGrid, currentGridSize, type);
  }, [worldStateRef]);

  const findFiresCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findFires(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnCrimeIncidents = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    crimeSpawnTimerRef.current -= delta * speedMultiplier;

    if (crimeSpawnTimerRef.current > 0) return;
    crimeSpawnTimerRef.current = 3 + Math.random() * 2;

    const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];

    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        const isBuilding = tile.building.type !== 'grass' &&
          tile.building.type !== 'water' &&
          tile.building.type !== 'road' &&
          tile.building.type !== 'bridge' &&
          tile.building.type !== 'tree' &&
          tile.building.type !== 'empty';
        const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;

        if (isBuilding && hasActivity) {
          const policeCoverage = state.services.police[y]?.[x] || 0;
          eligibleTiles.push({ x, y, policeCoverage });
        }
      }
    }

    if (eligibleTiles.length === 0) return;

    const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
    const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;

    const population = state.stats.population;
    const maxActiveCrimes = Math.max(2, Math.floor(population / 500));

    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;

    const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;

    for (let i = 0; i < crimesToSpawn; i++) {
      if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
      if (Math.random() > baseChance) continue;

      const weightedTiles = eligibleTiles.filter(t => {
        const key = `${t.x},${t.y}`;
        if (activeCrimeIncidentsRef.current.has(key)) return false;
        const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
        return Math.random() < weight;
      });

      if (weightedTiles.length === 0) continue;

      const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
      const key = `${target.x},${target.y}`;

      const crimeType = getRandomCrimeType();
      const duration = getCrimeDuration(crimeType);

      activeCrimeIncidentsRef.current.set(key, {
        x: target.x,
        y: target.y,
        type: crimeType,
        timeRemaining: duration,
      });
    }
  }, [worldStateRef, crimeSpawnTimerRef, activeCrimeIncidentsRef, state.services.police, state.stats.population]);

  const updateCrimeIncidents = useCallback((delta: number) => {
    const { speed: currentSpeed } = worldStateRef.current;
    if (currentSpeed === 0) return;

    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    const keysToDelete: string[] = [];

    // PERF: Use for...of instead of forEach for Map iteration
    for (const [key, crime] of activeCrimeIncidentsRef.current) {
      if (activeCrimesRef.current.has(key)) continue;

      const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
      if (newTimeRemaining <= 0) {
        keysToDelete.push(key);
      } else {
        activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
      }
    }

    // PERF: Use for loop instead of forEach
    for (let i = 0; i < keysToDelete.length; i++) {
      activeCrimeIncidentsRef.current.delete(keysToDelete[i]);
    }
  }, [worldStateRef, activeCrimeIncidentsRef, activeCrimesRef]);

  const findCrimeIncidents = useCallback((): { x: number; y: number }[] => {
    return Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  }, [activeCrimeIncidentsRef]);

  const dispatchEmergencyVehicle = useCallback((
    type: EmergencyVehicleType,
    stationX: number,
    stationY: number,
    targetX: number,
    targetY: number
  ): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    const path = findPathOnRoads(currentGrid, currentGridSize, stationX, stationY, targetX, targetY);
    if (!path || path.length === 0) return false;

    const startTile = path[0];
    let direction: CarDirection = 'south';

    if (path.length >= 2) {
      const nextTile = path[1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    }

    emergencyVehiclesRef.current.push({
      id: emergencyVehicleIdRef.current++,
      type,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: 0,
      speed: type === 'fire_truck' ? 0.8
        : type === 'ambulance' ? 0.85
        : type === 'werkhof_truck' ? 0.6
        : type === 'garbage_truck' ? 0.4
        : 0.9,
      state: 'dispatching',
      stationX,
      stationY,
      targetX,
      targetY,
      path,
      pathIndex: 0,
      respondTime: 0,
      laneOffset: 0,
      flashTimer: 0,
    });

    return true;
  }, [worldStateRef, emergencyVehiclesRef, emergencyVehicleIdRef]);

  const updateEmergencyDispatch = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

    const fires = findFiresCallback();
    const fireStations = findStationsCallback('fire_station');

    for (const fire of fires) {
      const fireKey = `${fire.x},${fire.y}`;
      if (activeFiresRef.current.has(fireKey)) continue;

      let nearestStation: { x: number; y: number } | null = null;
      let nearestDist = Infinity;

      for (const station of fireStations) {
        const dist = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestStation = station;
        }
      }

      if (nearestStation) {
        if (dispatchEmergencyVehicle('fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y)) {
          activeFiresRef.current.add(fireKey);
        }
      }
    }

    const crimes = findCrimeIncidents();
    const policeStations = findStationsCallback('police_station');

    let dispatched = 0;
    const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2));
    for (const crime of crimes) {
      if (dispatched >= maxDispatchPerCheck) break;

      const crimeKey = `${crime.x},${crime.y}`;
      if (activeCrimesRef.current.has(crimeKey)) continue;

      let nearestStation: { x: number; y: number } | null = null;
      let nearestDist = Infinity;

      for (const station of policeStations) {
        const dist = Math.abs(station.x - crime.x) + Math.abs(station.y - crime.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestStation = station;
        }
      }

      if (nearestStation) {
        if (dispatchEmergencyVehicle('police_car', nearestStation.x, nearestStation.y, crime.x, crime.y)) {
          activeCrimesRef.current.add(crimeKey);
          dispatched++;
        }
      }
    }
  }, [worldStateRef, findFiresCallback, findCrimeIncidents, findStationsCallback, dispatchEmergencyVehicle, activeFiresRef, activeCrimesRef]);

  // ══════════════════════════════════════════════════════════════════════════════
  // WERKHOF-SYSTEM: Gebäudeinstandhaltung und Müllabfuhr
  // ══════════════════════════════════════════════════════════════════════════════

  // Refs fuer Werkhof-Zustand (module-local, kein Re-Render noetig)
  const werkhofRepairQueueRef = useRef<{ x: number; y: number; condition: number; tool: string }[]>([]);
  const activeRepairsRef = useRef<Set<string>>(new Set());
  const lastGarbageRunRef = useRef<number>(0);
  const garbageRouteRef = useRef<{ x: number; y: number }[]>([]);
  const garbageRouteIndexRef = useRef<number>(0);

  // Werkhof-Gebaeude auf der Karte finden
  const findWerkhofBuildings = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return [];
    const werkhofs: { x: number; y: number }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        if ((currentGrid[y][x]?.building?.type as string) === 'werkhof') {
          werkhofs.push({ x, y });
        }
      }
    }
    return werkhofs;
  }, [worldStateRef]);

  // Reparaturfahrten: Werkhof-LKW zu Gebaeude mit schlechtem Zustand schicken
  const dispatchWerkhofRepairs = useCallback(() => {
    const queue = werkhofRepairQueueRef.current;
    if (queue.length === 0) return;

    const werkhofs = findWerkhofBuildings();
    if (werkhofs.length === 0) return;

    for (const target of queue) {
      const repairKey = `${target.x},${target.y}`;
      if (activeRepairsRef.current.has(repairKey)) continue;

      // Naechsten Werkhof per Manhattan-Distanz finden
      let nearestWerkhof: { x: number; y: number } | null = null;
      let nearestDist = Infinity;
      for (const wh of werkhofs) {
        const dist = Math.abs(wh.x - target.x) + Math.abs(wh.y - target.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestWerkhof = wh;
        }
      }

      if (!nearestWerkhof) continue;

      if (dispatchEmergencyVehicle('werkhof_truck', nearestWerkhof.x, nearestWerkhof.y, target.x, target.y)) {
        activeRepairsRef.current.add(repairKey);
        console.log(`[WERKHOF] 🔧 Werkhof-LKW → (${target.x},${target.y}) Zustand: ${target.condition}%`);
      }
    }
  }, [findWerkhofBuildings, dispatchEmergencyVehicle]);

  // Müllabfuhr: Müllauto faehrt eine Route ab (alle 10 Minuten Echtzeit)
  const dispatchGarbageTruck = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return;

    const now = Date.now();
    const GARBAGE_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten
    if (now - lastGarbageRunRef.current < GARBAGE_INTERVAL_MS) return;

    const werkhofs = findWerkhofBuildings();
    if (werkhofs.length === 0) return;

    // Wohngebaeude in der Naehe des ersten Werkhofs sammeln
    const baseWerkhof = werkhofs[0];
    const residentials: { x: number; y: number }[] = [];
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const t = currentGrid[y][x].building.type;
        if (t === 'house_small' || t === 'house_medium' || t === 'apartment_low' || t === 'apartment_high' || t === 'mansion') {
          residentials.push({ x, y });
        }
      }
    }
    if (residentials.length === 0) return;

    // 5-8 zufaellige Stationen in der Naehe auswaehlen
    const nearby = residentials
      .map(r => ({ ...r, dist: Math.abs(r.x - baseWerkhof.x) + Math.abs(r.y - baseWerkhof.y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 20);

    const stopCount = 5 + Math.floor(Math.random() * 4);
    const stops: { x: number; y: number }[] = [];
    const usedIdx = new Set<number>();
    for (let i = 0; i < stopCount && i < nearby.length; i++) {
      const idx = Math.floor(Math.random() * nearby.length);
      if (usedIdx.has(idx)) { i--; continue; }
      usedIdx.add(idx);
      stops.push(nearby[idx]);
    }
    if (stops.length === 0) return;

    // Ersten Stop als Ziel setzen; Fahrzeug faehrt die Route selbst ab (via normal dispatching)
    const firstStop = stops[0];
    if (dispatchEmergencyVehicle('garbage_truck', baseWerkhof.x, baseWerkhof.y, firstStop.x, firstStop.y)) {
      lastGarbageRunRef.current = now;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-notification', {
          detail: { title: '🗑️ Müllabfuhr', message: 'Das Müllauto ist unterwegs!' }
        }));
      }
      console.log(`[WERKHOF] 🗑️ Müllauto startet von Werkhof (${baseWerkhof.x},${baseWerkhof.y})`);
    }
  }, [worldStateRef, findWerkhofBuildings, dispatchEmergencyVehicle]);

  // Window-Event fuer Werkhof-Status (von deltaSync.ts geliefert)
  const werkhofStatusHandlerRef = useRef<((e: Event) => void) | null>(null);

  // Werkhof-Status-Handler registrieren (einmalig)
  const initWerkhofListener = useCallback(() => {
    if (werkhofStatusHandlerRef.current) return; // Bereits registriert

    const handler = (e: Event) => {
      const payload = (e as CustomEvent).detail as {
        repairQueue?: { x: number; y: number; condition: number; tool: string }[];
        hasWerkhof?: boolean;
        garbageDue?: boolean;
      };
      if (payload?.repairQueue) {
        werkhofRepairQueueRef.current = payload.repairQueue;
      }
      if (payload?.hasWerkhof) {
        dispatchWerkhofRepairs();
        dispatchGarbageTruck();
      }
    };

    werkhofStatusHandlerRef.current = handler;
    if (typeof window !== 'undefined') {
      window.addEventListener('werkhof-status', handler);
    }
  }, [dispatchWerkhofRepairs, dispatchGarbageTruck]);

  // Werkhof-Listener beim ersten Aufruf aktivieren
  initWerkhofListener();

  // Werkhof-Reparatur: Fahrzeug-Ankunft und Reparatur-Abschluss verarbeiten
  // (wird in updateEmergencyVehicles ergaenzt – hier nur Hilfs-Callback)
  const onWerkhofTruckArrived = useCallback((targetX: number, targetY: number) => {
    const repairKey = `${targetX},${targetY}`;
    // Reparatur-Complete ans Server senden
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('werkhof-repair-complete', { detail: { x: targetX, y: targetY } }));
    }
    activeRepairsRef.current.delete(repairKey);
    // Reparaturwarteschlange bereinigen
    werkhofRepairQueueRef.current = werkhofRepairQueueRef.current.filter(
      r => !(r.x === targetX && r.y === targetY)
    );
  }, []);

  const updateEmergencyVehicles = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) {
      emergencyVehiclesRef.current = [];
      return;
    }

    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

    emergencyDispatchTimerRef.current -= delta;
    if (emergencyDispatchTimerRef.current <= 0) {
      updateEmergencyDispatch();
      emergencyDispatchTimerRef.current = 1.5;
    }

    const updatedVehicles: EmergencyVehicle[] = [];

    for (const vehicle of [...emergencyVehiclesRef.current]) {
      vehicle.flashTimer += delta * 8;

      if (vehicle.state === 'responding') {
        if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
          const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
          if (vehicle.type === 'fire_truck') {
            activeFiresRef.current.delete(targetKey);
          } else {
            activeCrimesRef.current.delete(targetKey);
            activeCrimeIncidentsRef.current.delete(targetKey);
          }
          continue;
        }

        vehicle.respondTime += delta * speedMultiplier;

        // Polizeiauto: Polizisten aussteigen lassen bei Ankunft
        if (vehicle.type === 'police_car' && !vehicle.spawnedPoliceNpcId && vehicle.respondTime > 0.3) {
          // Suche irgendeinen Gangster auf der Karte (egal wie weit)
          const nearbyGangster = pedestriansRef.current.find(p => {
            if (!p.isNpcWorker || p.npcType !== 'gangster') return false;
            if (p.activity === 'arrested' || p.activity === 'being_transported') return false;
            return true;
          });

          if (nearbyGangster) {
            const gangsterDist = Math.abs(nearbyGangster.tileX - vehicle.tileX) + Math.abs(nearbyGangster.tileY - vehicle.tileY);

            // Nur aussteigen wenn Gangster max 5 Tiles entfernt
            if (gangsterDist <= 5) {
              // Alten Verfolger abkoppeln (falls vorhanden)
              if (nearbyGangster.npcChaseTargetId && nearbyGangster.npcChaseTargetId > 0) {
                const oldPolice = pedestriansRef.current.find(op => op.id === nearbyGangster.npcChaseTargetId);
                if (oldPolice) {
                  oldPolice.npcChaseTargetId = 0;
                  oldPolice.activity = 'chasing';
                  oldPolice.state = 'idle';
                  oldPolice.activityProgress = 0;
                  oldPolice.activityDuration = 0.5;
                }
              }

              pedestrianIdRef.current++;
              const policeId = pedestrianIdRef.current;
              const policePath = buildDirectGridPath(vehicle.tileX, vehicle.tileY, nearbyGangster.tileX, nearbyGangster.tileY);
              let policeDir: 'north' | 'east' | 'south' | 'west' = 'south';
              if (policePath.length > 1) {
                const dir = getDirectionToTile(policePath[0].x, policePath[0].y, policePath[1].x, policePath[1].y);
                if (dir) policeDir = dir;
              }

              const policeNpc = createPoliceNpc(
                policeId,
                vehicle.tileX, vehicle.tileY,
                nearbyGangster.id,
                nearbyGangster.tileX, nearbyGangster.tileY,
                policePath,
                policeDir
              );
              policeNpc.npcTransportTarget = { x: vehicle.tileX, y: vehicle.tileY };

              // 50% Chance: Gangster ergibt sich sofort (bleibt stehen, Polizist läuft hin)
              const instantArrest = Math.random() < 0.5;
              if (instantArrest) {
                // Gangster ergibt sich – bleibt stehen, Polizist läuft normal zu ihm
                nearbyGangster.npcChaseTargetId = policeId;
                nearbyGangster.state = 'idle';
                nearbyGangster.activity = 'arrested';
                nearbyGangster.speed = 0;
                nearbyGangster.activityProgress = 0;
                nearbyGangster.activityDuration = 999;

                pedestriansRef.current = [...pedestriansRef.current, policeNpc];
                vehicle.spawnedPoliceNpcId = policeId;
                console.log(`[VEHICLE] 🚔 Polizist #${policeId} → Gangster #${nearbyGangster.id} ergibt sich!`);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('game-notification', { detail: { title: '🚔 Gangster ergibt sich!', message: 'Polizist läuft hin zur Verhaftung.' } }));
                }
              } else {
                // Normale Verfolgungsjagd
                nearbyGangster.npcChaseTargetId = policeId;
                nearbyGangster.activity = 'fleeing';
                policeNpc.npcRepathTimer = 0;

                pedestriansRef.current = [...pedestriansRef.current, policeNpc];
                vehicle.spawnedPoliceNpcId = policeId;
                console.log(`[VEHICLE] 🚔 Polizist #${policeId} → Verfolgungsjagd auf Gangster #${nearbyGangster.id}!`);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('game-notification', { detail: { title: '🚔 Verfolgungsjagd!', message: 'Polizist jagt den Gangster!' } }));
                }
              }
            }
          }
        }

        // Polizeiauto: Warte auf den Polizei-NPC (bis Verhaftung + Transport abgeschlossen)
        if (vehicle.type === 'police_car' && vehicle.spawnedPoliceNpcId) {
          const policeNpc = pedestriansRef.current.find(p => p.id === vehicle.spawnedPoliceNpcId);
          if (!policeNpc) {
            // Polizist ist weg (despawnt nach Transport) → Auto fährt zurück
            const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
            activeCrimeIncidentsRef.current.delete(targetKey);
            activeCrimesRef.current.delete(targetKey);

            const returnPath = findPathOnRoads(
              currentGrid, currentGridSize,
              vehicle.tileX, vehicle.tileY,
              vehicle.stationX, vehicle.stationY
            );
            if (returnPath && returnPath.length >= 2) {
              vehicle.path = returnPath;
              vehicle.pathIndex = 0;
              vehicle.state = 'returning';
              vehicle.progress = 0;
              const nextTile = returnPath[1];
              const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
              if (dir) vehicle.direction = dir;
            } else {
              continue;
            }
          }
          // Auto wartet → nicht nach respondDuration zurückfahren
          updatedVehicles.push(vehicle);
          continue;
        }

        // Werkhof-LKW: 60 Sekunden Reparaturzeit, dann Abschluss-Event
        if (vehicle.type === 'werkhof_truck' && vehicle.respondTime >= 60) {
          onWerkhofTruckArrived(vehicle.targetX, vehicle.targetY);
          const returnPath = findPathOnRoads(
            currentGrid, currentGridSize,
            vehicle.tileX, vehicle.tileY,
            vehicle.stationX, vehicle.stationY
          );
          if (returnPath && returnPath.length >= 2) {
            vehicle.path = returnPath;
            vehicle.pathIndex = 0;
            vehicle.state = 'returning';
            vehicle.progress = 0;
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
            if (dir) vehicle.direction = dir;
          } else {
            continue;
          }
          updatedVehicles.push(vehicle);
          continue;
        }

        // Müllauto: kurze Verweildauer (5s), dann weiterfahren
        if (vehicle.type === 'garbage_truck' && vehicle.respondTime >= 5) {
          const returnPath = findPathOnRoads(
            currentGrid, currentGridSize,
            vehicle.tileX, vehicle.tileY,
            vehicle.stationX, vehicle.stationY
          );
          if (returnPath && returnPath.length >= 2) {
            vehicle.path = returnPath;
            vehicle.pathIndex = 0;
            vehicle.state = 'returning';
            vehicle.progress = 0;
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
            if (dir) vehicle.direction = dir;
          } else {
            continue;
          }
          updatedVehicles.push(vehicle);
          continue;
        }

        const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5;

        if (vehicle.respondTime >= respondDuration) {
          const targetKey = `${vehicle.targetX},${vehicle.targetY}`;

          if (vehicle.type === 'police_car') {
            activeCrimeIncidentsRef.current.delete(targetKey);
          }

          const returnPath = findPathOnRoads(
            currentGrid, currentGridSize,
            vehicle.tileX, vehicle.tileY,
            vehicle.stationX, vehicle.stationY
          );

          if (returnPath && returnPath.length >= 2) {
            vehicle.path = returnPath;
            vehicle.pathIndex = 0;
            vehicle.state = 'returning';
            vehicle.progress = 0;

            const nextTile = returnPath[1];
            const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
            if (dir) vehicle.direction = dir;
          } else if (returnPath && returnPath.length === 1) {
            const targetKey2 = `${vehicle.targetX},${vehicle.targetY}`;
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey2);
            } else {
              activeCrimesRef.current.delete(targetKey2);
            }
            continue;
          } else {
            const targetKey2 = `${vehicle.targetX},${vehicle.targetY}`;
            if (vehicle.type === 'fire_truck') {
              activeFiresRef.current.delete(targetKey2);
            } else {
              activeCrimesRef.current.delete(targetKey2);
            }
            continue;
          }
        }

        updatedVehicles.push(vehicle);
        continue;
      }

      if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
        }
        continue;
      }

      if (vehicle.tileX < 0 || vehicle.tileX >= currentGridSize ||
        vehicle.tileY < 0 || vehicle.tileY >= currentGridSize) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
        }
        continue;
      }

      vehicle.progress += vehicle.speed * delta * speedMultiplier;

      let shouldRemove = false;

      if (vehicle.path.length === 1 && vehicle.state === 'dispatching') {
        vehicle.state = 'responding';
        vehicle.respondTime = 0;
        vehicle.progress = 0;
        updatedVehicles.push(vehicle);
        continue;
      }

      while (vehicle.progress >= 1 && vehicle.pathIndex < vehicle.path.length - 1) {
        vehicle.pathIndex++;
        vehicle.progress -= 1;

        const currentTile = vehicle.path[vehicle.pathIndex];

        if (currentTile.x < 0 || currentTile.x >= currentGridSize ||
          currentTile.y < 0 || currentTile.y >= currentGridSize) {
          shouldRemove = true;
          break;
        }

        vehicle.tileX = currentTile.x;
        vehicle.tileY = currentTile.y;

        if (vehicle.pathIndex >= vehicle.path.length - 1) {
          if (vehicle.state === 'dispatching') {
            vehicle.state = 'responding';
            vehicle.respondTime = 0;
            vehicle.progress = 0;
          } else if (vehicle.state === 'returning') {
            shouldRemove = true;
          }
          break;
        }

        if (vehicle.pathIndex + 1 < vehicle.path.length) {
          const nextTile = vehicle.path[vehicle.pathIndex + 1];
          const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
          if (dir) vehicle.direction = dir;
        }
      }

      if (shouldRemove) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
        }
        continue;
      }

      updatedVehicles.push(vehicle);
    }

    emergencyVehiclesRef.current = updatedVehicles;
  }, [worldStateRef, emergencyVehiclesRef, emergencyDispatchTimerRef, updateEmergencyDispatch, activeFiresRef, activeCrimesRef, activeCrimeIncidentsRef]);

  // Helper to check if a tile is an intersection (3+ connections)
  // PERF: Use cached intersection map to avoid repeated O(n) getDirectionOptions() calls per-car per-frame
  const isIntersection = useCallback((grid: Tile[][], gridSize: number, x: number, y: number): boolean => {
    if (!isRoadTile(grid, gridSize, x, y)) return false;

    // Check if cache is valid for current grid version
    const currentVersion = gridVersionRef.current;
    if (cachedIntersectionMapRef.current.gridVersion !== currentVersion) {
      // Rebuild the intersection cache for the entire grid
      const newMap = new Map<number, boolean>();
      for (let cy = 0; cy < gridSize; cy++) {
        for (let cx = 0; cx < gridSize; cx++) {
          if (isRoadTile(grid, gridSize, cx, cy)) {
            const options = getDirectionOptions(grid, gridSize, cx, cy);
            newMap.set(cy * gridSize + cx, options.length >= 3);
          }
        }
      }
      cachedIntersectionMapRef.current = { map: newMap, gridVersion: currentVersion };
    }

    // O(1) lookup from cache
    const key = y * gridSize + x;
    return cachedIntersectionMapRef.current.map.get(key) ?? false;
  }, [gridVersionRef, cachedIntersectionMapRef]);

  const updateCars = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;

    // Clear cars if zoomed out too far (use mobile threshold on mobile for better perf)
    // Also use far zoom threshold for desktop when very zoomed out (for large maps)
    const carMinZoom = isMobile ? CAR_MIN_ZOOM_MOBILE : CAR_MIN_ZOOM;
    const effectiveMinZoom = Math.max(carMinZoom, VEHICLE_FAR_ZOOM_THRESHOLD);
    if (currentZoom < effectiveMinZoom) {
      carsRef.current = [];
      return;
    }

    // Don't clear cars if grid is temporarily unavailable - just skip update
    if (!currentGrid || currentGridSize <= 0) {
      return;
    }

    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

    // Scale car count with road tiles (similar to pedestrians) for proper density on large maps
    // Use cached road tile count for performance
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          const type = currentGrid[y][x].building.type;
          if (type === 'road' || type === 'bridge' || type === 'autobahn') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }

    // Target ~0.5 cars per road tile on desktop, ~0.15 on mobile (for performance)
    // This ensures large maps with more roads get proportionally more cars
    const congestionVal = state?.stats?.trafficCongestion || 0;
    const congestionDensityBoost = 1 + Math.min(0.5, congestionVal / 200);
    const carDensity = (isMobile ? 0.15 : 0.5) * congestionDensityBoost;
    const targetCars = Math.floor(roadTileCount * carDensity);
    // Cap at 800 for desktop, 60 for mobile - minimum 10/15 for small cities
    const maxCars = isMobile
      ? Math.min(60, Math.max(10, targetCars))
      : Math.min(800, Math.max(15, targetCars));

    carSpawnTimerRef.current -= delta;
    if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
      // Spawn cars at a moderate rate - spawn more at once on large maps to catch up faster
      // Mobile: spawn fewer cars at once and slower intervals
      const deficit = maxCars - carsRef.current.length;
      const carsToSpawn = isMobile
        ? Math.min(1, deficit)
        : Math.min(deficit > 50 ? 4 : 2, deficit);
      let spawnedCount = 0;
      for (let i = 0; i < carsToSpawn; i++) {
        if (spawnRandomCar()) {
          spawnedCount++;
        }
      }
      // Mobile: slower spawn rate (0.8-1.2s vs 0.3-0.7s on desktop)
      carSpawnTimerRef.current = spawnedCount > 0
        ? (isMobile ? 0.8 + Math.random() * 0.4 : 0.3 + Math.random() * 0.4)
        : 0.1;
    }

    // Get current traffic light state
    const trafficTime = trafficLightTimerRef.current;
    const lightState = getTrafficLightState(trafficTime);

    // Build spatial index of all vehicles (cars + buses) for collision detection
    // PERF: Use numeric keys (y * gridSize + x) instead of string keys
    const carsByTile = new Map<number, Car[]>();
    for (const car of carsRef.current) {
      const key = car.tileY * currentGridSize + car.tileX;
      if (!carsByTile.has(key)) carsByTile.set(key, []);
      carsByTile.get(key)!.push(car);
    }
    // Add buses to same spatial index so cars yield to buses and vice versa
    for (const bus of busesRef.current) {
      const key = bus.tileY * currentGridSize + bus.tileX;
      if (!carsByTile.has(key)) carsByTile.set(key, []);
      carsByTile.get(key)!.push(bus as unknown as Car);
    }

    const updatedCars: Car[] = [];
    for (const car of [...carsRef.current]) {
      // Update car age and remove if too old
      car.age += delta * speedMultiplier;
      if (car.age > car.maxAge) {
        continue; // Car has exceeded its lifespan
      }

      // Party-Auto parkieren: nächstes freies Strassentile nahe Mansion finden und dort einparken
      if (car.isParty && !car.parked && car.partyMansionX !== undefined && car.partyMansionY !== undefined) {
        const dist = Math.abs(car.tileX - car.partyMansionX) + Math.abs(car.tileY - car.partyMansionY);
        if (dist <= 4) {
          // Alle Strassentiles im Umkreis 1-3 um Mansion suchen, nächstes freies nehmen
          // Seite bestimmen auf der dieses Auto fährt (positiv = rechts, negativ = links)
          const carSide = car.laneOffset >= 0 ? 'right' : 'left';
          let parkTileX = -1, parkTileY = -1, bestParkDist = 999;
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const nx = car.partyMansionX + dx;
              const ny = car.partyMansionY + dy;
              if (nx < 0 || ny < 0 || nx >= currentGridSize || ny >= currentGridSize) continue;
              if (!isRoadTile(currentGrid, currentGridSize, nx, ny)) continue;
              const tileDist = Math.abs(dx) + Math.abs(dy);
              if (tileDist >= bestParkDist) continue;
              // Pro Tile je eine Seite: Tile+Seite muss frei sein
              const occupied = updatedCars.some(c =>
                c.parked && c.tileX === nx && c.tileY === ny &&
                (c.laneOffset >= 0 ? 'right' : 'left') === carSide
              );
              if (!occupied) { bestParkDist = tileDist; parkTileX = nx; parkTileY = ny; }
            }
          }
          if (parkTileX >= 0) {
            // Auto auf das beste freie Tile teleportieren und einparken
            car.tileX = parkTileX; car.tileY = parkTileY;
            car.parked = true;
            // Parkdauer: 30s – 4 Minuten, dann wegfahren
            car.parkedUntilAge = car.age + 30 + Math.random() * 210;
            car.maxAge = car.parkedUntilAge + 90; // danach ganz verschwinden
            const curbOffset = 12 + Math.random() * 2;
            car.laneOffset = car.laneOffset >= 0 ? curbOffset : -curbOffset;
            car.progress = 0.45 + Math.random() * 0.1;
            // Zufällig: gerade (parallel) oder quer (90°) parkieren
            if (Math.random() < 0.5) {
              const perpDir: Record<string, string> = {
                north: car.laneOffset > 0 ? 'east' : 'west',
                south: car.laneOffset > 0 ? 'west' : 'east',
                east:  car.laneOffset > 0 ? 'south' : 'north',
                west:  car.laneOffset > 0 ? 'north' : 'south',
              };
              car.direction = (perpDir[car.direction] ?? car.direction) as typeof car.direction;
            }
            updatedCars.push(car);
            continue;
          }
          // Kein freies Tile → weiterfahren
        }
      }
      // Parkiertes Auto: warten bis parkedUntilAge, dann wieder losfahren
      if (car.parked) {
        if (car.parkedUntilAge !== undefined && car.age >= car.parkedUntilAge) {
          // Ausparken: normale Fahrspur-Offset wiederherstellen, losfahren
          car.parked = false;
          const normalOffset = 4 + Math.random() * 2;
          car.laneOffset = car.laneOffset >= 0 ? normalOffset : -normalOffset;
          // Gültige Fahrtrichtung auf aktuellem Tile finden
          const opts = getDirectionOptions(currentGrid, currentGridSize, car.tileX, car.tileY);
          if (opts.length > 0) {
            car.direction = opts[Math.floor(Math.random() * opts.length)] as typeof car.direction;
          }
          car.progress = 0;
          // fällt durch in normale Fahrt-Logik unten
        } else {
          updatedCars.push(car);
          continue;
        }
      }

      // Skip update if car is somehow off the road/autobahn, but keep it alive
      const onRoad = isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY);
      const carOnAutobahn = isAutobahnTile(currentGrid, currentGridSize, car.tileX, car.tileY);
      if (!onRoad && !carOnAutobahn) {
        // Car is off-road - try to find ANY nearby road and teleport there
        let relocated = false;
        for (let r = 1; r <= 5 && !relocated; r++) {
          for (let dy = -r; dy <= r && !relocated; dy++) {
            for (let dx = -r; dx <= r && !relocated; dx++) {
              if (Math.abs(dx) === r || Math.abs(dy) === r) {
                const nx = car.tileX + dx;
                const ny = car.tileY + dy;
                if (isDrivableTile(currentGrid, currentGridSize, nx, ny)) {
                  car.tileX = nx;
                  car.tileY = ny;
                  car.progress = 0.5;
                  const opts = getDirectionOptions(currentGrid, currentGridSize, nx, ny);
                  if (opts.length > 0) {
                    car.direction = opts[Math.floor(Math.random() * opts.length)];
                  }
                  relocated = true;
                }
              }
            }
          }
        }
        // Even if we couldn't relocate, still keep the car
        updatedCars.push(car);
        continue;
      }

      // Check if approaching an intersection with red light
      // Only stop BEFORE entering the intersection, never while inside it
      let shouldStop = false;

      const meta = DIRECTION_META[car.direction];
      const nextX = car.tileX + meta.step.x;
      const nextY = car.tileY + meta.step.y;
      const currentIsIntersection = isIntersection(currentGrid, currentGridSize, car.tileX, car.tileY);
      const nextIsIntersection = isIntersection(currentGrid, currentGridSize, nextX, nextY);

      // If we're NOT in an intersection and the next tile IS an intersection
      if (!currentIsIntersection && nextIsIntersection) {
        // Check immediately and stop well before the intersection
        if (!canProceedThroughIntersection(car.direction, lightState)) {
          shouldStop = true;
        }
      }

      // Check for railroad crossing ahead
      // Stop if approaching a crossing with a train nearby
      if (!shouldStop) {
        const trains = trainsRef.current;

        // Check current tile (if we're about to enter a crossing)
        if (isRailroadCrossing(currentGrid, currentGridSize, car.tileX, car.tileY)) {
          // We're on a crossing - check if a train is approaching/occupying it
          if (shouldStopAtCrossing(trains, car.tileX, car.tileY)) {
            // If we're early in crossing, stop immediately
            if (car.progress < 0.3) {
              shouldStop = true;
            }
            // Otherwise, keep moving through to clear the crossing
          }
        }

        // Check next tile (approaching a crossing)
        if (!shouldStop && car.progress > 0.5 && isRailroadCrossing(currentGrid, currentGridSize, nextX, nextY)) {
          if (shouldStopAtCrossing(trains, nextX, nextY)) {
            shouldStop = true;
          }
        }
      }

      // Check for car ahead - efficient spatial lookup
      // Only check cars going the SAME direction (same lane)
      if (!shouldStop) {
        // Check same tile for car ahead in same lane
        // PERF: Use numeric key lookup
        const sameTileCars = carsByTile.get(car.tileY * currentGridSize + car.tileX) || [];
        for (const other of sameTileCars) {
          if (other.id === car.id) continue;
          // Same direction (same lane) and ahead of us
          if (other.direction === car.direction && other.progress > car.progress) {
            const gap = other.progress - car.progress;
            if (gap < 0.25) {
              shouldStop = true;
              break;
            }
          }
        }

        // Check next tile for car in same lane we might hit
        if (!shouldStop && car.progress > 0.7) {
          // PERF: Use numeric key lookup
          const nextTileCars = carsByTile.get(nextY * currentGridSize + nextX) || [];
          for (const other of nextTileCars) {
            // Only stop for cars going same direction (same lane)
            if (other.direction === car.direction && other.progress < 0.3) {
              shouldStop = true;
              break;
            }
          }
        }
      }

      if (!shouldStop) {
        const congestion = state?.stats?.trafficCongestion || 0;
        // Autobahn cars skip traffic congestion slowdown
        const congestionSpeedFactor = carOnAutobahn ? 1 : Math.max(0.4, 1 - congestion * 0.006);
        car.progress += car.speed * delta * speedMultiplier * congestionSpeedFactor;
      }
      // When stopped, just don't move - no position changes

      let guard = 0;
      while (car.progress >= 1 && guard < 4) {
        guard++;
        const meta = DIRECTION_META[car.direction];
        const newTileX = car.tileX + meta.step.x;
        const newTileY = car.tileY + meta.step.y;

        // Check if next tile is valid (road for road cars, autobahn for autobahn cars)
        const nextValid = carOnAutobahn
          ? isAutobahnTile(currentGrid, currentGridSize, newTileX, newTileY)
          : isRoadTile(currentGrid, currentGridSize, newTileX, newTileY);
        if (!nextValid) {
          if (carOnAutobahn) {
            car.age = car.maxAge + 1; // Despawn at dead end
            break;
          }
          // Can't move forward - turn around on current tile
          const options = getDirectionOptions(currentGrid, currentGridSize, car.tileX, car.tileY);
          if (options.length > 0) {
            // Pick any valid direction (preferring not the one we were going)
            const otherOptions = options.filter(d => d !== car.direction);
            const newDir = otherOptions.length > 0
              ? otherOptions[Math.floor(Math.random() * otherOptions.length)]
              : options[Math.floor(Math.random() * options.length)];
            car.direction = newDir;
            car.progress = 0.1;
            const baseLaneOffset = 4 + Math.random() * 2;
            const laneSign = (newDir === 'north' || newDir === 'east') ? 1 : -1;
            car.laneOffset = laneSign * baseLaneOffset;
          } else {
            // No options at all - just stop and wait (maybe road will be rebuilt)
            car.progress = 0.5;
          }
          break;
        }

        // Move to the new tile
        car.tileX = newTileX;
        car.tileY = newTileY;
        car.progress -= 1;

        // Pick next direction (use autobahn-specific logic if on autobahn)
        if (carOnAutobahn) {
          const abOptions = getAutobahnDirectionOptions(currentGrid, currentGridSize, car.tileX, car.tileY);
          if (abOptions.length > 0) {
            // Prefer continuing in same direction
            const newDir = abOptions.includes(car.direction) ? car.direction : abOptions[Math.floor(Math.random() * abOptions.length)];
            // Keep same lane offset on autobahn (don't recalculate)
            car.direction = newDir;
          } else {
            car.age = car.maxAge + 1; // Dead end despawn
            break;
          }
        } else {
          const nextDirection = pickNextDirection(car.direction, currentGrid, currentGridSize, car.tileX, car.tileY);
          if (nextDirection) {
            if (nextDirection !== car.direction) {
              const baseLaneOffset = 4 + Math.random() * 2;
              const laneSign = (nextDirection === 'north' || nextDirection === 'east') ? 1 : -1;
              car.laneOffset = laneSign * baseLaneOffset;
            }
            car.direction = nextDirection;
          } else {
            // No preferred direction - just pick any valid one
            const options = getDirectionOptions(currentGrid, currentGridSize, car.tileX, car.tileY);
            if (options.length > 0) {
              const newDir = options[Math.floor(Math.random() * options.length)];
              car.direction = newDir;
              const baseLaneOffset = 4 + Math.random() * 2;
              const laneSign = (newDir === 'north' || newDir === 'east') ? 1 : -1;
              car.laneOffset = laneSign * baseLaneOffset;
            }
            // If no options, car will try again next frame (don't kill it)
          }
        }
      }

      // Parking lot check: non-party cars can park in adjacent parking lot tiles
      if (!car.parked && !car.isParty && Math.random() < 0.03) {
        const { grid: g, gridSize: gs } = worldStateRef.current;
        const parkingTypes: string[] = ['parking_spot', 'parking_lot', 'parking_lot_large'];
        const neighbors = [
          { x: car.tileX - 1, y: car.tileY },
          { x: car.tileX + 1, y: car.tileY },
          { x: car.tileX, y: car.tileY - 1 },
          { x: car.tileX, y: car.tileY + 1 },
        ];
        let parked = false;
        for (const nb of neighbors) {
          if (parked) break;
          if (nb.x < 0 || nb.y < 0 || nb.x >= gs || nb.y >= gs) continue;
          const nbTile = g[nb.y]?.[nb.x];
          if (!nbTile || !parkingTypes.includes(nbTile.building.type)) continue;
          // Find a free slot (0-7) on this tile — 4 Streifen × 2 Seiten
          const occupied = parkedVehiclesRef.current
            .filter((p) => p.tileX === nb.x && p.tileY === nb.y)
            .map((p) => p.slot);
          const freeSlot = [0, 1, 2, 3, 4, 5, 6, 7].find((s) => !occupied.includes(s));
          if (freeSlot === undefined) continue;
          // Park the car: emit to server and despawn from road
          emitParkVehicleRef.current(nb.x, nb.y, freeSlot, car.color);
          // Optimistically add to local ref so next car won't double-book the same slot
          parkedVehiclesRef.current = [
            ...parkedVehiclesRef.current,
            { tileX: nb.x, tileY: nb.y, slot: freeSlot, color: car.color },
          ];
          // Server-seitig abläuft (leave_after_seconds) — kein Client-Timeout nötig
          parked = true;
        }
        if (parked) {
          // Remove car from road traffic (despawn)
          continue;
        }
      }

      // Keep the car alive unless it exceeded maxAge (handled at top of loop)
      updatedCars.push(car);
    }

    carsRef.current = updatedCars;
  }, [worldStateRef, carsRef, carSpawnTimerRef, spawnRandomCar, trafficLightTimerRef, isIntersection, isMobile, trainsRef, gridVersionRef, cachedRoadTileCountRef, parkedVehiclesRef, emitParkVehicleRef, emitLeaveParkingRef]);

  // Process boarding/alighting at a bus stop
  const processBusStop = useCallback((bus: Bus, delta: number, speedMultiplier: number) => {
    const peds = pedestriansRef.current;

    // 1. Alighting: passengers whose target stop matches current stop
    let alightedCount = 0;
    for (const ped of peds) {
      if (alightedCount >= 2) break;
      if (ped.state === 'riding_bus' && ped.ridingBusId === bus.id && ped.targetStopIndex === bus.currentStopIndex) {
        ped.state = 'alighting_bus';
        ped.buildingEntryProgress = 1;
        ped.tileX = bus.tileX;
        ped.tileY = bus.tileY;
        ped.ridingBusId = undefined;
        bus.passengerCount = Math.max(0, bus.passengerCount - 1);
        alightedCount++;
      }
    }

    // 2. Boarding: waiting pedestrians at this stop for this line
    let boardedCount = 0;
    for (const ped of peds) {
      if (boardedCount >= 2) break;
      if (bus.passengerCount >= bus.passengerCapacity) break;
      if (ped.state === 'waiting_at_stop' && ped.targetBusLineId === bus.lineId &&
          Math.abs((ped.busStopX || 0) - bus.tileX) + Math.abs((ped.busStopY || 0) - bus.tileY) <= 1) {
        ped.state = 'boarding_bus';
        ped.buildingEntryProgress = 0;
        ped.ridingBusId = bus.id;
        boardedCount++;
      }
    }
  }, [pedestriansRef]);

  const updateBuses = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;

    if (currentZoom < BUS_MIN_ZOOM) {
      busesRef.current = [];
      return;
    }

    if (!currentGrid || currentGridSize <= 0) {
      busesRef.current = [];
      return;
    }

    // Skip population check if server bus lines exist (transport company manages buses)
    const hasServerLines = serverBusLinesRef.current && serverBusLinesRef.current.length > 0;
    if (!hasServerLines && state.stats.population < BUS_MIN_POPULATION) {
      busesRef.current = [];
      return;
    }

    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          const type = currentGrid[y][x].building.type;
          if (type === 'road' || type === 'bridge' || type === 'autobahn') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }

    const maxBuses = isMobile ? MAX_BUSES_MOBILE : MAX_BUSES;
    const roadFactor = Math.max(1, Math.floor(roadTileCount / 120));
    const populationFactor = Math.min(1, state.stats.population / 4000);
    const targetBuses = Math.min(maxBuses, Math.max(2, Math.floor(roadFactor * (1 + populationFactor * 2))));

    busSpawnTimerRef.current -= delta;
    if (busesRef.current.length < targetBuses && busSpawnTimerRef.current <= 0) {
      if (spawnBus()) {
        busSpawnTimerRef.current = BUS_SPAWN_INTERVAL_MIN + Math.random() * (BUS_SPAWN_INTERVAL_MAX - BUS_SPAWN_INTERVAL_MIN);
      } else {
        busSpawnTimerRef.current = 1.5;
      }
    }

    const trafficTime = trafficLightTimerRef.current;
    const lightState = getTrafficLightState(trafficTime);

    // Build spatial index of all vehicles for bus collision avoidance
    const carsByTile = new Map<number, { id: number; direction: string; progress: number }[]>();
    for (const car of carsRef.current) {
      const key = car.tileY * currentGridSize + car.tileX;
      if (!carsByTile.has(key)) carsByTile.set(key, []);
      carsByTile.get(key)!.push(car);
    }
    for (const b of busesRef.current) {
      const key = b.tileY * currentGridSize + b.tileX;
      if (!carsByTile.has(key)) carsByTile.set(key, []);
      carsByTile.get(key)!.push(b);
    }

    const updatedBuses: Bus[] = [];

    for (const bus of [...busesRef.current]) {
      bus.age += delta * speedMultiplier;
      if (bus.age > bus.maxAge) {
        continue;
      }

      if (bus.stopTimer > 0) {
        bus.stopTimer -= delta * speedMultiplier;
        // Process boarding/alighting while stopped at a line stop
        if (bus.lineId >= 0 && bus.currentStopIndex >= 0) {
          processBusStop(bus, delta, speedMultiplier);
        }
        updatedBuses.push(bus);
        continue;
      }

      let shouldStop = false;
      const meta = DIRECTION_META[bus.direction];
      const nextX = bus.tileX + meta.step.x;
      const nextY = bus.tileY + meta.step.y;
      const currentIsIntersection = isIntersection(currentGrid, currentGridSize, bus.tileX, bus.tileY);
      const nextIsIntersection = isIntersection(currentGrid, currentGridSize, nextX, nextY);

      if (!currentIsIntersection && nextIsIntersection) {
        if (!canProceedThroughIntersection(bus.direction, lightState)) {
          shouldStop = true;
        }
      }

      if (!shouldStop) {
        if (isRailroadCrossing(currentGrid, currentGridSize, bus.tileX, bus.tileY)) {
          if (shouldStopAtCrossing(trainsRef.current, bus.tileX, bus.tileY) && bus.progress < 0.3) {
            shouldStop = true;
          }
        }
        if (!shouldStop && bus.progress > 0.5 && isRailroadCrossing(currentGrid, currentGridSize, nextX, nextY)) {
          if (shouldStopAtCrossing(trainsRef.current, nextX, nextY)) {
            shouldStop = true;
          }
        }
      }

      // Check for vehicle ahead (cars or other buses)
      if (!shouldStop) {
        const sameTileVehicles = carsByTile.get(bus.tileY * currentGridSize + bus.tileX) || [];
        for (const other of sameTileVehicles) {
          if (other.id === bus.id) continue;
          if (other.direction === bus.direction && other.progress > bus.progress) {
            if (other.progress - bus.progress < 0.3) { shouldStop = true; break; }
          }
        }
      }
      if (!shouldStop && bus.progress > 0.6) {
        const nextTileVehicles = carsByTile.get(nextY * currentGridSize + nextX) || [];
        for (const other of nextTileVehicles) {
          if (other.direction === bus.direction && other.progress < 0.3) { shouldStop = true; break; }
        }
      }

      if (!shouldStop) {
        bus.progress += bus.speed * delta * speedMultiplier;
      }

      while (bus.progress >= 1 && bus.pathIndex < bus.path.length - 1) {
        bus.pathIndex++;
        bus.progress -= 1;
        const currentTile = bus.path[bus.pathIndex];
        bus.tileX = currentTile.x;
        bus.tileY = currentTile.y;

        // Check if we arrived at a line stop (bus_stop is adjacent to road, not on it)
        if (bus.lineId >= 0) {
          const line = busLinesRef.current.find(l => l.id === bus.lineId);
          if (line) {
            const stopIdx = line.stopSequence.findIndex(s => {
              const dx = Math.abs(s.x - bus.tileX);
              const dy = Math.abs(s.y - bus.tileY);
              return (dx + dy <= 1); // Adjacent or same tile
            });
            if (stopIdx !== -1 && bus.currentStopIndex !== stopIdx) {
              bus.currentStopIndex = stopIdx;
              // Shift bus towards the stop side
              const stop = line.stopSequence[stopIdx];
              const meta = DIRECTION_META[bus.direction];
              const stopDx = stop.x - bus.tileX;
              const stopDy = stop.y - bus.tileY;
              // Calculate offset towards the stop using the normal vector
              const dotNormal = stopDx * meta.normal.nx + stopDy * meta.normal.ny;
              if (dotNormal !== 0) {
                bus.laneOffset = Math.sign(dotNormal) * (6 + Math.random() * 2);
              }
              bus.stopTimer = BUS_STOP_DURATION_MIN + Math.random() * (BUS_STOP_DURATION_MAX - BUS_STOP_DURATION_MIN) + 1.5;
              bus.boardingTimer = 0;
              break; // Stop moving, process boarding next frame
            }
          }
        }

        if (bus.pathIndex + 1 < bus.path.length) {
          const nextTile = bus.path[bus.pathIndex + 1];
          const dir = getDirectionToTile(bus.tileX, bus.tileY, nextTile.x, nextTile.y);
          if (dir) {
            if (dir !== bus.direction) {
              const baseLaneOffset = 6 + Math.random() * 2.5;
              const laneSign = (dir === 'north' || dir === 'east') ? 1 : -1;
              bus.laneOffset = laneSign * baseLaneOffset;
            }
            bus.direction = dir;
          }
        }
      }

      if (bus.pathIndex >= bus.path.length - 1 && bus.progress >= 1) {
        bus.progress = 0;

        if (bus.lineId >= 0) {
          // Line bus: loop back to start of path
          bus.pathIndex = 0;
          const loopStart = bus.path[0];
          bus.tileX = loopStart.x;
          bus.tileY = loopStart.y;
          bus.currentStopIndex = -1;
          if (bus.path.length > 1) {
            const dir = getDirectionToTile(loopStart.x, loopStart.y, bus.path[1].x, bus.path[1].y);
            if (dir) {
              bus.direction = dir;
              const baseLaneOffset = 6 + Math.random() * 2.5;
              const laneSign = (dir === 'north' || dir === 'east') ? 1 : -1;
              bus.laneOffset = laneSign * baseLaneOffset;
            }
          }
        } else {
          // Legacy random bus: build new route
          bus.stopTimer = BUS_STOP_DURATION_MIN + Math.random() * (BUS_STOP_DURATION_MAX - BUS_STOP_DURATION_MIN);
          const currentStop = bus.stops[1] ?? { x: bus.tileX, y: bus.tileY };
          const nextRoute = buildBusRouteFrom(currentStop);
          if (!nextRoute) { continue; }
          const nextStart = nextRoute.path[0];
          bus.tileX = nextStart.x;
          bus.tileY = nextStart.y;
          bus.path = nextRoute.path;
          bus.pathIndex = 0;
          bus.stops = nextRoute.stops;
          if (nextRoute.path.length > 1) {
            const dir = getDirectionToTile(nextStart.x, nextStart.y, nextRoute.path[1].x, nextRoute.path[1].y);
            if (dir) {
              bus.direction = dir;
              const baseLaneOffset = 6 + Math.random() * 2.5;
              const laneSign = (dir === 'north' || dir === 'east') ? 1 : -1;
              bus.laneOffset = laneSign * baseLaneOffset;
            }
          }
        }
      }

      updatedBuses.push(bus);
    }

    busesRef.current = updatedBuses;
  }, [worldStateRef, state.stats.population, isMobile, busesRef, busSpawnTimerRef, spawnBus, buildBusRouteFrom, trafficLightTimerRef, trainsRef, gridVersionRef, cachedRoadTileCountRef, cachedIntersectionMapRef, isIntersection, busLinesRef, serverBusLinesRef, carsRef]);

  const updatePedestrians = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0) {
      // NPC-Arbeiter behalten
      pedestriansRef.current = pedestriansRef.current.filter(p => p.isNpcWorker);
      return;
    }

    const speedMultiplierValue = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

    // Clear pedestrians if zoomed out too far (use mobile threshold on mobile for better perf)
    // Also use far zoom threshold for desktop when very zoomed out (for large maps)
    // NPC-Arbeiter werden IMMER geupdated (auch bei Zoom-Out)
    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;
    const effectiveMinZoom = Math.max(pedestrianMinZoom, VEHICLE_FAR_ZOOM_THRESHOLD);
    if (currentZoom < effectiveMinZoom) {
      // NPC-Arbeiter updaten, normale Pedestrians einfrieren (nicht entfernen!)
      // Normale Pedestrians bleiben im Array damit NPCs sie als Ziele finden können
      const allPedsSnapshot = pedestriansRef.current;
      const npcWorkers = allPedsSnapshot.filter(p => p.isNpcWorker);
      const normalPeds = allPedsSnapshot.filter(p => !p.isNpcWorker);

      if (npcWorkers.length > 0) {
        const updatedNpcs: Pedestrian[] = [];
        for (const npc of npcWorkers) {
          const alive = updatePedestrianState(npc, delta, speedMultiplierValue, currentGrid, currentGridSize, allPedsSnapshot);
          if (alive) {
            if (npc.npcTriggeredCrime) {
              const crime = npc.npcTriggeredCrime;
              const crimeKey = `${crime.x},${crime.y}`;
              if (!activeCrimeIncidentsRef.current.has(crimeKey)) {
                activeCrimeIncidentsRef.current.set(crimeKey, {
                  x: crime.x,
                  y: crime.y,
                  type: 'mugging' as CrimeType,
                  timeRemaining: 40,
                });
              }
              npc.npcTriggeredCrime = undefined;
            }
            updatedNpcs.push(npc);
          }
        }
        pedestriansRef.current = [...normalPeds, ...updatedNpcs];
      } else {
        pedestriansRef.current = normalPeds;
      }
      return;
    }

    const speedMultiplier = speedMultiplierValue;

    // Cache road tile count (expensive to calculate every frame)
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          const type = currentGrid[y][x].building.type;
          if (type === 'road' || type === 'bridge' || type === 'autobahn') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }

    // Scale pedestrian count with city size (road tiles), with a reasonable cap
    // Mobile: use lower density and max count for performance
    const pedDensity = isMobile ? PEDESTRIAN_ROAD_TILE_DENSITY_MOBILE : PEDESTRIAN_ROAD_TILE_DENSITY;
    const pedMaxCount = isMobile ? PEDESTRIAN_MAX_COUNT_MOBILE : PEDESTRIAN_MAX_COUNT;
    const pedMinCount = isMobile ? 20 : 150;
    const targetPedestrians = roadTileCount * pedDensity;
    const maxPedestrians = Math.min(pedMaxCount, Math.max(pedMinCount, targetPedestrians));
    pedestrianSpawnTimerRef.current -= delta;

    if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
      // Spawn pedestrians in batches - smaller batches on mobile
      const batchSize = isMobile ? PEDESTRIAN_SPAWN_BATCH_SIZE_MOBILE : PEDESTRIAN_SPAWN_BATCH_SIZE;
      const spawnBatch = Math.min(batchSize, maxPedestrians - pedestriansRef.current.length);
      for (let i = 0; i < spawnBatch; i++) {
        spawnPedestrian();
      }
      pedestrianSpawnTimerRef.current = isMobile ? PEDESTRIAN_SPAWN_INTERVAL_MOBILE : PEDESTRIAN_SPAWN_INTERVAL;
    }

    // OPTIMIZED: Reuse array instead of spreading
    const allPedestrians = pedestriansRef.current;
    const updatedPedestrians: Pedestrian[] = [];

    // Pre-calculate traffic light state once per frame
    const trafficTime = trafficLightTimerRef.current;
    const lightState = getTrafficLightState(trafficTime);

    for (let i = 0; i < allPedestrians.length; i++) {
      const ped = allPedestrians[i];

      // Use the new state machine for pedestrian updates
      const alive = updatePedestrianState(
        ped,
        delta,
        speedMultiplier,
        currentGrid,
        currentGridSize,
        allPedestrians
      );

      if (alive) {
        // OPTIMIZED: Only check traffic lights for walking pedestrians approaching intersections
        // NPC-Arbeiter ignorieren Ampeln
        if (!ped.isNpcWorker && ped.state === 'walking' && ped.progress > 0.4 && ped.pathIndex + 1 < ped.path.length) {
          // Only 80% respect lights (skip check for some pedestrians)
          if ((ped.id % 5) !== 0) {
            const nextTile = ped.path[ped.pathIndex + 1];
            // Quick intersection check - only count if likely an intersection
            let roadCount = 0;
            if (isRoadTile(currentGrid, currentGridSize, nextTile.x - 1, nextTile.y)) roadCount++;
            if (roadCount < 3 && isRoadTile(currentGrid, currentGridSize, nextTile.x, nextTile.y - 1)) roadCount++;
            if (roadCount < 3 && isRoadTile(currentGrid, currentGridSize, nextTile.x + 1, nextTile.y)) roadCount++;
            if (roadCount < 3 && isRoadTile(currentGrid, currentGridSize, nextTile.x, nextTile.y + 1)) roadCount++;

            if (roadCount >= 3 && !canProceedThroughIntersection(ped.direction, lightState)) {
              // Stop at edge of sidewalk (0.5 = middle of tile, near sidewalk edge)
              ped.progress = Math.min(ped.progress, 0.5);
            }
          }
        }

        // Gangster hat Crime getriggert (fehlgeschlagener Raub) → Crime-Incident erstellen
        if (ped.npcTriggeredCrime) {
          const crime = ped.npcTriggeredCrime;
          const crimeKey = `${crime.x},${crime.y}`;
          if (!activeCrimeIncidentsRef.current.has(crimeKey)) {
            activeCrimeIncidentsRef.current.set(crimeKey, {
              x: crime.x,
              y: crime.y,
              type: 'mugging' as CrimeType,
              timeRemaining: 40,
            });
          }
          ped.npcTriggeredCrime = undefined;
        }

        updatedPedestrians.push(ped);
      }
    }

    pedestriansRef.current = updatedPedestrians;
  }, [worldStateRef, gridVersionRef, cachedRoadTileCountRef, pedestriansRef, pedestrianSpawnTimerRef, spawnPedestrian, trafficLightTimerRef, isMobile, activeCrimeIncidentsRef]);

  const drawCars = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Skip drawing cars when zoomed out too far
    const carMinZoom = isMobile ? CAR_MIN_ZOOM_MOBILE : CAR_MIN_ZOOM;
    if (currentZoom < carMinZoom) {
      return;
    }

    if (!currentGrid || currentGridSize <= 0 || carsRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    carsRef.current.forEach(car => {
      const { screenX, screenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[car.direction];
      const carX = centerX + meta.vec.dx * car.progress + meta.normal.nx * car.laneOffset;
      const carY = centerY + meta.vec.dy * car.progress + meta.normal.ny * car.laneOffset;

      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(meta.angle);

      const scale = 0.5; // 30% smaller than original

      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.moveTo(-10 * scale, -5 * scale);
      ctx.lineTo(10 * scale, -5 * scale);
      ctx.lineTo(12 * scale, 0);
      ctx.lineTo(10 * scale, 5 * scale);
      ctx.lineTo(-10 * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);

      ctx.fillStyle = '#111827';
      ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);

      ctx.restore();
    });

    ctx.restore();
  }, [worldStateRef, carsRef, isMobile]);

  const drawBuses = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    if (currentZoom < BUS_MIN_ZOOM) {
      return;
    }

    if (!currentGrid || currentGridSize <= 0 || busesRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;

    busesRef.current.forEach(bus => {
      const { screenX, screenY } = gridToScreen(bus.tileX, bus.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[bus.direction];
      const busX = centerX + meta.vec.dx * bus.progress + meta.normal.nx * bus.laneOffset;
      const busY = centerY + meta.vec.dy * bus.progress + meta.normal.ny * bus.laneOffset;

      if (busX < viewLeft - 60 || busX > viewRight + 60 || busY < viewTop - 80 || busY > viewBottom + 80) {
        return;
      }

      ctx.save();
      ctx.translate(busX, busY);
      ctx.rotate(meta.angle);

      const scale = 0.6;
      const bLen = 16; // bus body length (like fire_truck = 14)

      // Bus body (polygon shape like emergency vehicles)
      ctx.fillStyle = bus.color;
      ctx.beginPath();
      ctx.moveTo(-bLen * scale, -5 * scale);
      ctx.lineTo(bLen * scale, -5 * scale);
      ctx.lineTo((bLen + 2) * scale, 0);
      ctx.lineTo(bLen * scale, 5 * scale);
      ctx.lineTo(-bLen * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();

      // White roof stripe
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-bLen * scale * 0.8, -3 * scale, bLen * scale * 1.6, 6 * scale * 0.3);

      // Windows (4 blue rectangles along side)
      ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
      for (let i = 0; i < 4; i++) {
        const wx = (-bLen * 0.65 + i * bLen * 0.38) * scale;
        ctx.fillRect(wx, -3.5 * scale, bLen * 0.22 * scale, 7 * scale);
      }

      // Front windshield
      ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
      ctx.fillRect((bLen * 0.6) * scale, -3 * scale, bLen * 0.25 * scale, 6 * scale);

      // Rear dark section
      ctx.fillStyle = '#111827';
      ctx.fillRect(-bLen * scale * 0.95, -4.5 * scale, bLen * 0.08 * scale, 9 * scale);

      // Headlights
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect((bLen * 0.9) * scale, -2 * scale, 2 * scale, 1.5 * scale);
      ctx.fillRect((bLen * 0.9) * scale, 0.5 * scale, 2 * scale, 1.5 * scale);

      // Taillights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect((-bLen - 0.5) * scale, -2 * scale, 1.5 * scale, 1.5 * scale);
      ctx.fillRect((-bLen - 0.5) * scale, 0.5 * scale, 1.5 * scale, 1.5 * scale);

      ctx.restore();

      // Passenger count badge (show when bus has passengers and zoom is high enough)
      if (bus.passengerCount > 0 && currentZoom >= 1.2) {
        ctx.save();
        ctx.translate(busX, busY - 14);
        const countText = `🧑${bus.passengerCount}`;
        ctx.font = 'bold 6px sans-serif';
        const tw = ctx.measureText(countText).width;
        const badgeW = tw + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.roundRect(-badgeW / 2, -5, badgeW, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(countText, 0, 0);
        ctx.restore();
      }
    });

    ctx.restore();
  }, [worldStateRef, busesRef]);

  // Non-recreation pedestrians: Pixi (visible DOM canvas) at high zoom, Canvas 2D at low zoom.
  // Returns true if Pixi is handling the rendering (so the caller can skip carsCanvas drawing).
  const drawPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;
    if (!currentGrid || currentGridSize <= 0 || pedestriansRef.current.length === 0 || currentZoom < pedestrianMinZoom) {
      return;
    }

    // Canvas 2D fallback for all zoom levels (Pixi is driven from the render loop directly)
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - TILE_WIDTH,
      viewTop: -currentOffset.y / currentZoom - TILE_HEIGHT * 2,
      viewRight: viewWidth - currentOffset.x / currentZoom + TILE_WIDTH,
      viewBottom: viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2,
    };

    drawPedestriansUtil(ctx, pedestriansRef.current, viewBounds, currentZoom, 'non-recreation');
    ctx.restore();
  }, [worldStateRef, pedestriansRef, isMobile]);

  // Recreation pedestrians: always Canvas 2D (fewer of them, layered on airCanvas)
  const drawRecreationPedestrians = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || pedestriansRef.current.length === 0) {
      return;
    }

    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;
    const hasNpcWorkers = pedestriansRef.current.some(p => p.isNpcWorker);
    if (currentZoom < pedestrianMinZoom && !hasNpcWorkers) return;

    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - TILE_WIDTH,
      viewTop: -currentOffset.y / currentZoom - TILE_HEIGHT * 2,
      viewRight: viewWidth - currentOffset.x / currentZoom + TILE_WIDTH,
      viewBottom: viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2,
    };

    drawPedestriansUtil(ctx, pedestriansRef.current, viewBounds, currentZoom, 'recreation');
    ctx.restore();
  }, [worldStateRef, pedestriansRef, isMobile]);

  const drawEmergencyVehicles = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    if (!currentGrid || currentGridSize <= 0 || emergencyVehiclesRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;

    const isVehicleBehindBuilding = (tileX: number, tileY: number): boolean => {
      const vehicleDepth = tileX + tileY;

      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const checkX = tileX + dx;
          const checkY = tileY + dy;

          if (checkX < 0 || checkY < 0 || checkX >= currentGridSize || checkY >= currentGridSize) {
            continue;
          }

          const tile = currentGrid[checkY]?.[checkX];
          if (!tile) continue;

          const buildingType = tile.building.type;
          const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
          if (skipTypes.includes(buildingType)) {
            continue;
          }

          const buildingDepth = checkX + checkY;
          if (buildingDepth > vehicleDepth) {
            return true;
          }
        }
      }

      return false;
    };

    emergencyVehiclesRef.current.forEach(vehicle => {
      const { screenX, screenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[vehicle.direction];
      const vehicleX = centerX + meta.vec.dx * vehicle.progress + meta.normal.nx * vehicle.laneOffset;
      const vehicleY = centerY + meta.vec.dy * vehicle.progress + meta.normal.ny * vehicle.laneOffset;

      if (vehicleX < viewLeft - 40 || vehicleX > viewRight + 40 || vehicleY < viewTop - 60 || vehicleY > viewBottom + 60) {
        return;
      }

      ctx.save();
      ctx.translate(vehicleX, vehicleY);
      ctx.rotate(meta.angle);

      const scale = 0.6;

      const bodyColor = vehicle.type === 'fire_truck' ? '#dc2626'
        : vehicle.type === 'ambulance' ? '#f0f0f0'
        : vehicle.type === 'werkhof_truck' ? '#f59e0b'
        : vehicle.type === 'garbage_truck' ? '#4ade80'
        : '#1e40af';

      const length = vehicle.type === 'fire_truck' ? 14
        : vehicle.type === 'ambulance' ? 13
        : (vehicle.type === 'werkhof_truck' || vehicle.type === 'garbage_truck') ? 15
        : 11;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(-length * scale, -5 * scale);
      ctx.lineTo(length * scale, -5 * scale);
      ctx.lineTo((length + 2) * scale, 0);
      ctx.lineTo(length * scale, 5 * scale);
      ctx.lineTo(-length * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();

      if (vehicle.type === 'ambulance') {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-1 * scale, -3.5 * scale, 2 * scale, 7 * scale);
        ctx.fillRect(-3.5 * scale, -1 * scale, 7 * scale, 2 * scale);
      } else {
        ctx.fillStyle = vehicle.type === 'fire_truck' ? '#fbbf24' : '#ffffff';
        ctx.fillRect(-length * scale * 0.5, -3 * scale, length * scale, 6 * scale * 0.3);
      }

      ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
      ctx.fillRect(-2 * scale, -3 * scale, 5 * scale, 6 * scale);

      const flashOn = Math.sin(vehicle.flashTimer) > 0;
      const flashOn2 = Math.sin(vehicle.flashTimer + Math.PI) > 0;

      if (vehicle.type === 'fire_truck') {
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-6 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#ff0000' : '#880000';
        ctx.fillRect(3 * scale, -7 * scale, 3 * scale, 3 * scale);

        if (flashOn || flashOn2) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 6;
          ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.fillRect(-8 * scale, -8 * scale, 16 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      } else if (vehicle.type === 'ambulance') {
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#ffffff' : '#888888';
        ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);

        if (flashOn || flashOn2) {
          ctx.shadowColor = flashOn ? '#ff0000' : '#ffffff';
          ctx.shadowBlur = 6;
          ctx.fillStyle = flashOn ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      } else if (vehicle.type === 'werkhof_truck') {
        // Werkhof-LKW: orange Warnblinker
        ctx.fillStyle = flashOn ? '#f59e0b' : '#92400e';
        ctx.fillRect(-5 * scale, -7 * scale, 10 * scale, 3 * scale);
        if (flashOn) {
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      } else if (vehicle.type === 'garbage_truck') {
        // Müllauto: grüne Markierung, kein Blaulicht
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(-3 * scale, -7 * scale, 6 * scale, 3 * scale);
      } else {
        ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
        ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = flashOn2 ? '#0066ff' : '#003388';
        ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);

        if (flashOn || flashOn2) {
          ctx.shadowColor = flashOn ? '#ff0000' : '#0066ff';
          ctx.shadowBlur = 6;
          ctx.fillStyle = flashOn ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 100, 255, 0.4)';
          ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
          ctx.shadowBlur = 0;
        }
      }

      ctx.fillStyle = '#111827';
      ctx.fillRect(-length * scale, -4 * scale, 2 * scale, 8 * scale);

      ctx.restore();
    });

    ctx.restore();
  }, [worldStateRef, emergencyVehiclesRef]);

  const incidentAnimTimeRef = useRef(0);

  const drawIncidentIndicators = useCallback((ctx: CanvasRenderingContext2D, delta: number) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    if (!currentGrid || currentGridSize <= 0) return;

    incidentAnimTimeRef.current += delta;
    const animTime = incidentAnimTimeRef.current;

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH * 2;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 4;

    // PERF: Use for...of instead of forEach for Map iteration
    for (const crime of activeCrimeIncidentsRef.current.values()) {
      const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;

      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
        continue;
      }

      const pulse = Math.sin(animTime * 4) * 0.3 + 0.7;
      const outerPulse = Math.sin(animTime * 3) * 0.5 + 0.5;

      ctx.beginPath();
      ctx.arc(centerX, centerY - 8, 18 + outerPulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.25 * (1 - outerPulse)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      const gradient = ctx.createRadialGradient(centerX, centerY - 8, 0, centerX, centerY - 8, 14 * pulse);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${0.5 * pulse})`);
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.2 * pulse})`);
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.beginPath();
      ctx.arc(centerX, centerY - 8, 14 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.save();
      ctx.translate(centerX, centerY - 12);

      ctx.fillStyle = `rgba(30, 64, 175, ${0.9 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 2);
      ctx.quadraticCurveTo(0, 8, 0, 8);
      ctx.quadraticCurveTo(0, 8, -6, 2);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(147, 197, 253, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -4, 2, 5);
      ctx.beginPath();
      ctx.arc(0, 4, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        if (!tile.building.onFire) continue;

        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        const centerX = screenX + TILE_WIDTH / 2;
        const centerY = screenY + TILE_HEIGHT / 2;

        if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
          continue;
        }

        const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
        const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;

        ctx.beginPath();
        ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse)})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY - 15);

        ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 5);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(252, 165, 165, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
        ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
        ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
        ctx.quadraticCurveTo(-2.5, 0, 0, -3);
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  }, [worldStateRef, activeCrimeIncidentsRef]);

  // Debug: expose bus internals
  const debugBusInfo = useCallback(() => ({
    busCount: busesRef.current.length,
    buses: busesRef.current.map(b => ({
      id: b.id, lineId: b.lineId, passengers: b.passengerCount,
      capacity: b.passengerCapacity, stopTimer: b.stopTimer.toFixed(1),
      tileX: b.tileX, tileY: b.tileY, pathLen: b.path.length,
    })),
    busLines: busLinesRef.current.map(l => ({
      id: l.id, color: l.color, stops: l.stopSequence.length, pathLen: l.fullPath.length,
    })),
    waitingPeds: pedestriansRef.current.filter(p => p.state === 'waiting_at_stop').length,
    ridingPeds: pedestriansRef.current.filter(p => p.state === 'riding_bus').length,
  }), [busesRef, busLinesRef, pedestriansRef]);

  return {
    spawnRandomCar,
    spawnPartyGuestCar,
    spawnPedestrian,
    spawnCrimeIncidents,
    updateCrimeIncidents,
    findCrimeIncidents,
    dispatchEmergencyVehicle,
    updateEmergencyDispatch,
    updateEmergencyVehicles,
    updateCars,
    updateBuses,
    updatePedestrians,
    drawCars,
    drawBuses,
    drawPedestrians,
    drawRecreationPedestrians,
    drawEmergencyVehicles,
    drawIncidentIndicators,
    // Debug
    debugSpawnBus: spawnBus,
    debugBusInfo,
  };
}
