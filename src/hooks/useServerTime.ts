/**
 * useServerTime Hook
 * 
 * Synchronisiert die Spielzeit mit dem Server.
 * Alle Spieler haben exakt die gleiche Zeit - keine Pause/Speed-Kontrolle.
 * 
 * Konfiguration (vom Server):
 * - 1 Spieltag = 5 Minuten Echtzeit
 * - 1 Tick = 12.5 Sekunden
 * - 24 Ticks pro Tag
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { getCurrentMunicipality } from '@/lib/api/database';

function normalizeGameApiUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  return trimmed.endsWith('/api/game') ? trimmed : `${trimmed}/api/game`;
}
const API_BASE_URL = normalizeGameApiUrl(
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'http://127.0.0.1:4100'
);

/**
 * Hole den Municipality-Slug aus verschiedenen Quellen
 */
function getMunicipalitySlug(override?: string): string {
  // 1. Expliziter Override
  if (override) return override;
  
  // 2. Aus der URL extrahieren (höchste Priorität, da am aktuellsten)
  if (typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/\/gemeinde\/([^\/]+)/);
    if (pathMatch?.[1]) return pathMatch[1];
  }
  
  // 3. Aus der globalen Variable (setCurrentMunicipality wurde aufgerufen)
  const current = getCurrentMunicipality();
  if (current) return current;
  
  // 4. Aus localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('isocity_municipality');
    if (stored) return stored;
  }
  
  // 5. Environment Variable Fallback
  return process.env.NEXT_PUBLIC_DEFAULT_MUNICIPALITY || 'default';
}

export interface ServerWeatherData {
  type: string;
  intensity: number;
  temperature: number;
  temperatureMin: number;
  temperatureMax: number;
  windspeed: number;
  winddirection: number;
  isDay: boolean;
}

export interface ServerTimeData {
  tick: number;
  hour: number;
  day: number;
  month: number;
  year: number;
  totalDays: number;
  totalTicks: number;
  nextTickInMs: number;
  serverTimestamp: number;
  weather: ServerWeatherData | null;
  config: {
    secondsPerDay: number;
    ticksPerDay: number;
    daysPerMonth: number;
    monthsPerYear: number;
  };
}

interface UseServerTimeOptions {
  /** Municipality Slug */
  municipalitySlug?: string;
  /** Aktiviere Server-Zeit-Sync */
  enabled?: boolean;
  /** Callback wenn ein neuer Tick kommt */
  onTick?: (time: ServerTimeData) => void;
}

export function useServerTime(options: UseServerTimeOptions = {}) {
  const {
    municipalitySlug,
    enabled = true,
    onTick,
  } = options;

  const multiplayer = useMultiplayerOptional();
  const roomCode = multiplayer?.roomCode;
  // Verwende Slug aus Multiplayer-Context wenn verfügbar, sonst aus Parameter/URL
  const slug = municipalitySlug || multiplayer?.municipalitySlug || getMunicipalitySlug();

  const [serverTime, setServerTime] = useState<ServerTimeData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const onTickRef = useRef(onTick);
  
  // Update ref when callback changes
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  /**
   * Hole Zeit vom Server
   */
  const fetchServerTime = useCallback(async (): Promise<ServerTimeData | null> => {
    if (!roomCode) {
      setIsConnected(false);
      return null;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    const url = `${API_BASE_URL}/municipality/${slug}/time/${roomCode}`;

    try {
      const response = await fetch(
        url,
        {
          headers: {
            'Accept': 'application/json',
            ...(token ? { 'X-Game-Token': token } : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const json = await response.json();

      if (!json.success || !json.data) {
        throw new Error('Invalid response from server');
      }

      const data = json.data;
      return {
        tick: data.tick,
        hour: data.hour,
        day: data.day,
        month: data.month,
        year: data.year,
        totalDays: data.total_days,
        totalTicks: data.total_ticks,
        nextTickInMs: data.next_tick_in_ms,
        serverTimestamp: data.server_timestamp,
        weather: data.weather ? {
          type: data.weather.type ?? 'clear',
          intensity: data.weather.intensity ?? 0,
          temperature: data.weather.temperature ?? 0,
          temperatureMin: data.weather.temperature_min ?? data.weather.temperature ?? 0,
          temperatureMax: data.weather.temperature_max ?? data.weather.temperature ?? 0,
          windspeed: data.weather.windspeed ?? 0,
          winddirection: data.weather.winddirection ?? 225,
          isDay: !!data.weather.is_day,
        } : null,
        config: {
          secondsPerDay: data.config.seconds_per_day,
          ticksPerDay: data.config.ticks_per_day,
          daysPerMonth: data.config.days_per_month,
          monthsPerYear: data.config.months_per_year,
        },
      };
    } catch (err) {
      console.error('[useServerTime] Fetch error:', err);
      setIsConnected(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [roomCode, slug]);

  /**
   * Berechne lokale Zeit basierend auf Server-Zeit
   * (für flüssige Updates zwischen Server-Syncs)
   */
  const calculateLocalTime = useCallback((baseTime: ServerTimeData, elapsedMs: number): ServerTimeData => {
    const msPerTick = (baseTime.config.secondsPerDay / baseTime.config.ticksPerDay) * 1000;
    const additionalTicks = Math.floor(elapsedMs / msPerTick);
    const newTotalTicks = baseTime.totalTicks + additionalTicks;
    
    // Berechne neue Zeit
    const ticksPerDay = baseTime.config.ticksPerDay;
    const daysPerMonth = baseTime.config.daysPerMonth;
    const monthsPerYear = baseTime.config.monthsPerYear;
    
    const totalDays = Math.floor(newTotalTicks / ticksPerDay);
    const hour = newTotalTicks % ticksPerDay;
    const dayInYear = totalDays % (daysPerMonth * monthsPerYear);
    const day = (dayInYear % daysPerMonth) + 1;
    const month = Math.floor(dayInYear / daysPerMonth) + 1;
    const year = 2026 + Math.floor(totalDays / (daysPerMonth * monthsPerYear));
    
    const nextTickInMs = msPerTick - (elapsedMs % msPerTick);

    return {
      ...baseTime,
      tick: newTotalTicks,
      hour,
      day,
      month,
      year,
      totalDays,
      totalTicks: newTotalTicks,
      nextTickInMs,
    };
  }, []);

  /**
   * Starte Tick-Timer für lokale Updates
   */
  const startTickTimer = useCallback((time: ServerTimeData) => {
    if (tickTimerRef.current) {
      clearTimeout(tickTimerRef.current);
    }

    const scheduleNextTick = (currentTime: ServerTimeData) => {
      tickTimerRef.current = setTimeout(() => {
        // Berechne nächsten Tick
        const msPerTick = (currentTime.config.secondsPerDay / currentTime.config.ticksPerDay) * 1000;
        const newTime = calculateLocalTime(currentTime, msPerTick);
        
        // Update State
        setServerTime(newTime);
        lastTickRef.current = newTime.totalTicks;
        
        // Callback
        if (onTickRef.current) {
          onTickRef.current(newTime);
        }
        
        // Nächsten Tick planen
        scheduleNextTick(newTime);
      }, currentTime.nextTickInMs);
    };

    scheduleNextTick(time);
  }, [calculateLocalTime]);

  // Initialer Sync und periodischer Re-Sync
  useEffect(() => {
    if (!enabled || !roomCode) return;

    let mounted = true;

    const sync = async () => {
      const time = await fetchServerTime();
      if (!mounted || !time) return;

      setServerTime(time);
      setIsConnected(true);
      setError(null);

      // Trigger Tick-Callback wenn sich der Tick geändert hat
      if (time.totalTicks !== lastTickRef.current) {
        lastTickRef.current = time.totalTicks;
        if (onTickRef.current) {
          onTickRef.current(time);
        }
      }

      // Starte lokalen Tick-Timer
      startTickTimer(time);
    };

    // Initialer Sync
    sync();

    // Periodischer Re-Sync alle 30 Sekunden (für Drift-Korrektur)
    syncIntervalRef.current = setInterval(sync, 30000);

    return () => {
      mounted = false;
      if (tickTimerRef.current) {
        clearTimeout(tickTimerRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [enabled, roomCode, fetchServerTime, startTickTimer]);

  return {
    /** Aktuelle Server-Zeit */
    time: serverTime,
    /** Ist mit Server verbunden */
    isConnected,
    /** Fehler (falls vorhanden) */
    error,
    /** Manueller Re-Sync */
    resync: fetchServerTime,
    /** Zeit-Konfiguration */
    config: serverTime?.config ?? null,
  };
}

export default useServerTime;
