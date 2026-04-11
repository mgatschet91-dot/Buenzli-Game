'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Bug, MapPin, RefreshCw, Loader2, Upload, CheckCircle, XCircle, TestTube,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Compass, BarChart3, Wrench,
  Radio, Database, UserRound, Save, Sparkles, Ruler, AlertTriangle, Layers,
} from 'lucide-react';
import type { ChunkManager, ChunkDebugInfo } from '@/lib/chunkManager';
import {
  checkApiConnection, getSwitzerlandStats, getCantonData, getBuildingTypes,
  getBackendType, ApiError,
} from '@/lib/api/coreApi';
import { getCurrentMunicipality, setCurrentMunicipality } from '@/lib/api/database';
import {
  deltaQueue, sendDeltaBatch, addDeltaSyncLogListener,
  DeltaAction, DeltaActionInput, DeltaBatch,
} from '@/lib/deltaSync';
import { addProviderLogListener } from '@/lib/multiplayer/coreDeltaProvider';
import * as partnershipApi from '@/lib/api/partnershipApi';
import * as publicMapsApi from '@/lib/api/publicMapsApi';
import {
  AvatarAppearanceConfig,
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearanceConfig,
  saveAvatarAppearanceToStorage,
  loadAvatarAppearanceFromStorage,
} from '@/lib/avatarConfig';
import { setDebugCloudOverride, getDebugCloudOverride } from '@/components/game/effectsSystems';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
function normalizeGameApiUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  return trimmed.endsWith('/api/game') ? trimmed : `${trimmed}/api/game`;
}
const API_BASE_URL = normalizeGameApiUrl(process.env.NEXT_PUBLIC_CORE_API_URL || AUTH_API_BASE_URL);

// ==========================================
// TYPES
// ==========================================

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  data?: unknown;
  duration?: number;
  url?: string;
  statusCode?: number;
  errorDetails?: unknown;
}

interface MigrationResult {
  city: string;
  success: boolean;
  message: string;
}

type AvatarColorFieldKey = 'skinColor' | 'shirtColor' | 'pantsColor' | 'hatColor' | 'hairColor' | 'eyeColor';

function AvatarLivePreview({ config }: { config: AvatarAppearanceConfig }) {
  const hatStyle = config.hatStyle;
  const eyeStyle = config.eyeStyle;
  const hairStyle = config.hairStyle;
  const headSquare = config.headShape === 'square';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Live Vorschau</div>
      <div className="flex items-center gap-3">
        <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
          <ellipse cx="42" cy="72" rx="16" ry="5" fill="rgba(0,0,0,0.25)" />
          {!headSquare ? (
            <circle cx="42" cy="30" r="12" fill={config.skinColor} />
          ) : (
            <rect x="30" y="18" width="24" height="24" rx="5" fill={config.skinColor} />
          )}

          {hairStyle === 'short' && (
            <ellipse cx="42" cy="20" rx="11.5" ry="4.8" fill={config.hairColor} />
          )}
          {hairStyle === 'long' && (
            <ellipse cx="42" cy="30" rx="13.2" ry="13.5" fill={config.hairColor} />
          )}
          {hairStyle === 'mohawk' && (
            <polygon points="40,15 44,15 43,30 41,30" fill={config.hairColor} />
          )}

          {eyeStyle === 'line' ? (
            <>
              <line x1="36" y1="30" x2="40" y2="30" stroke={config.eyeColor} strokeWidth="2" strokeLinecap="round" />
              <line x1="44" y1="30" x2="48" y2="30" stroke={config.eyeColor} strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="37" cy="30" r={eyeStyle === 'big' ? 2 : 1.4} fill={config.eyeColor} />
              <circle cx="47" cy="30" r={eyeStyle === 'big' ? 2 : 1.4} fill={config.eyeColor} />
            </>
          )}

          {hatStyle === 'cap' && (
            <>
              <ellipse cx="42" cy="18" rx="12" ry="5" fill={config.hatColor} />
              <ellipse cx="49" cy="21" rx="6" ry="2.5" fill={config.hatColor} />
            </>
          )}
          {hatStyle === 'beanie' && <ellipse cx="42" cy="17" rx="12" ry="6" fill={config.hatColor} />}
          {hatStyle === 'crown' && (
            <polygon points="30,22 34,14 38,22 42,12 46,22 50,14 54,22 54,26 30,26" fill={config.hatColor} />
          )}

          <ellipse cx="42" cy="49" rx="12" ry="15" fill={config.shirtColor} />
          <line x1="37" y1="62" x2="34" y2="74" stroke={config.pantsColor} strokeWidth="4" strokeLinecap="round" />
          <line x1="47" y1="62" x2="50" y2="74" stroke={config.pantsColor} strokeWidth="4" strokeLinecap="round" />
        </svg>
        <div className="text-[10px] leading-4 text-slate-400">
          <div>So sieht dein Avatar direkt im Spiel aus.</div>
          <div>Änderungen werden live angewendet.</div>
        </div>
      </div>
    </div>
  );
}

interface DeltaSyncDebugState {
  enabled: boolean;
  pendingCount: number;
  clientId: string;
  testRoomCode: string;
  testMunicipalitySlug: string;
  isTesting: boolean;
  lastTestResult: { success: boolean; message: string; data?: unknown } | null;
  logs: Array<{ time: string; type: 'send' | 'receive' | 'action' | 'error' | 'info'; message: string; data?: unknown }>;
}

type DebugDisasterType = 'fire_single' | 'fire_cluster' | 'fire_storm' | 'earthquake' | 'meteor' | 'extinguish_all';

interface DebugDisasterPreset {
  type: DebugDisasterType;
  label: string;
  hint: string;
  emoji: string;
  intensity: number;
}

// ==========================================
// DIRECTION CONFIG
// ==========================================

const DIR_CFG = {
  north: { arrow: '↑', label: 'Norden', Icon: ArrowUp, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', badge: 'bg-purple-500/20 border-purple-500/40 text-purple-300', mapPos: 'Oberer Kartenrand' },
  south: { arrow: '↓', label: 'Süden', Icon: ArrowDown, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', badge: 'bg-orange-500/20 border-orange-500/40 text-orange-300', mapPos: 'Unterer Kartenrand' },
  east:  { arrow: '→', label: 'Osten', Icon: ArrowRight, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', badge: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300', mapPos: 'Rechter Kartenrand' },
  west:  { arrow: '←', label: 'Westen', Icon: ArrowLeft, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', mapPos: 'Linker Kartenrand' },
} as const;

const DEBUG_DISASTER_PRESETS: DebugDisasterPreset[] = [
  { type: 'fire_single', label: 'Einzelbrand', hint: '1 Gebäude entzünden', emoji: '🔥', intensity: 1 },
  { type: 'fire_cluster', label: 'Brandherd', hint: 'Lokaler Cluster-Brand', emoji: '🔥', intensity: 2 },
  { type: 'fire_storm', label: 'Feuersturm', hint: 'Viele Brande gleichzeitig', emoji: '🌋', intensity: 4 },
  { type: 'earthquake', label: 'Erdbeben', hint: 'Zerstört zufällige Gebäude', emoji: '🌎', intensity: 3 },
  { type: 'meteor', label: 'Meteor', hint: 'Einschlag mit Radius + Krater', emoji: '☄️', intensity: 4 },
  { type: 'extinguish_all', label: 'Alle löschen', hint: 'Alle aktiven Feuer resetten', emoji: '🧯', intensity: 1 },
];

const DEBUG_PUBLIC_ROOM_SIZE_PRESETS = [
  { key: 'very_small', label: 'Sehr klein', size: 6, tiles: 36 },
  { key: 'small', label: 'Klein', size: 8, tiles: 64 },
  { key: 'medium', label: 'Mittel', size: 10, tiles: 100 },
  { key: 'large', label: 'Gross', size: 12, tiles: 144 },
] as const;

// ==========================================
// MAIN COMPONENT
// ==========================================

type DebugWeatherType = 'clear' | 'rain' | 'snow' | 'storm' | 'fog' | 'thunderstorm' | 'blizzard' | 'drizzle';

interface ApiDebugPanelProps {
  debugWeatherOverride?: DebugWeatherType | null;
  onDebugWeatherChange?: (weather: DebugWeatherType | null) => void;
  serverWeather?: { type: string; intensity: number; temperature?: number; temperatureMin?: number; temperatureMax?: number; windspeed?: number; isDay?: boolean } | null;
  chunkManager?: ChunkManager;
}

export function ApiDebugPanel({ debugWeatherOverride, onDebugWeatherChange, serverWeather, chunkManager }: ApiDebugPanelProps) {
  const game = useGame();
  const { state, setActivePanel, municipalitySlug, loadPartnershipsFromApi, setTool } = game;
  const { adjacentCities } = state;
  const multiplayer = useMultiplayerOptional();

  // --- API Tests ---
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState(getCurrentMunicipality());

  // --- City Generation ---
  const [isGeneratingCity, setIsGeneratingCity] = useState(false);
  const [cityGenResult, setCityGenResult] = useState<{ success: boolean; message: string } | null>(null);

  // --- Stats Sync ---
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [statsSyncResult, setStatsSyncResult] = useState<{ success: boolean; message: string; timestamp: number; data?: Record<string, unknown> } | null>(null);

  // --- Money Editor ---
  const [moneyInput, setMoneyInput] = useState('');
  const [moneyPopups, setMoneyPopups] = useState<Array<{ id: number; amount: number }>>([]);
  const moneyPopupIdRef = useRef(0);
  const moneyDisplayRef = useRef<HTMLSpanElement>(null);

  // --- Migration ---
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);
  const [migrationComplete, setMigrationComplete] = useState(false);

  // --- Game Items ---
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; data?: Record<string, unknown> } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; data?: Record<string, unknown> } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateResult, setRegenerateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [itemsStats, setItemsStats] = useState<{
    total: number;
    by_type: Record<string, number>;
    by_tool: Record<string, number>;
    by_zone: Record<string, number>;
    by_player: Array<{ player_id: string; user_id: number | null; count: number }>;
    recent: Array<{ id: number; action_type: string; tool: string | null; zone_type: string | null; x: number; y: number; player_id: string; version: number; created_at: string }>;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // --- Construction Sync Debug ---
  const [constructionDebug, setConstructionDebug] = useState<{
    scanned: boolean;
    buildings: Array<{ x: number; y: number; type: string; progress: number; zone: string }>;
    apiResult: { success: boolean; message: string; updated?: number } | null;
    isTesting: boolean;
  }>({ scanned: false, buildings: [], apiResult: null, isTesting: false });

  // --- Delta Sync ---
  const [deltaSyncDebug, setDeltaSyncDebug] = useState<DeltaSyncDebugState>({
    enabled: typeof window !== 'undefined' && localStorage.getItem('DELTA_SYNC_DEBUG') === 'true',
    pendingCount: 0, clientId: '', testRoomCode: 'TEST01',
    testMunicipalitySlug: getCurrentMunicipality(), isTesting: false, lastTestResult: null, logs: [],
  });
  const [disasterTriggerState, setDisasterTriggerState] = useState<{
    running: boolean;
    result: { success: boolean; message: string; data?: Record<string, unknown> } | null;
  }>({ running: false, result: null });
  const [meteorTargetMode, setMeteorTargetMode] = useState(false);

  // --- Discord Bot Test ---
  const [discordTestState, setDiscordTestState] = useState<{
    running: string | null;
    results: Array<{ type: string; success: boolean; message: string; time: string }>;
  }>({ running: null, results: [] });

  const triggerDiscordTest = useCallback(async (eventType: string, label: string, payload: Record<string, unknown>) => {
    const DISCORD_WEBHOOK_URL = 'http://127.0.0.1:4200/event';
    const slug = multiplayer?.municipalitySlug || deltaSyncDebug.testMunicipalitySlug || getCurrentMunicipality();
    setDiscordTestState(prev => ({ ...prev, running: eventType }));
    try {
      const body = {
        type: eventType,
        municipalityName: slug,
        roomCode: multiplayer?.roomCode || deltaSyncDebug.testRoomCode || 'TEST01',
        ...payload,
      };
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      const success = response.ok && json?.success;
      setDiscordTestState(prev => ({
        running: null,
        results: [{ type: eventType, success, message: success ? `${label} gesendet` : `Fehler: ${json?.error || response.status}`, time: new Date().toLocaleTimeString('de-CH') }, ...prev.results.slice(0, 19)],
      }));
    } catch (e) {
      setDiscordTestState(prev => ({
        running: null,
        results: [{ type: eventType, success: false, message: `${label}: ${e instanceof Error ? e.message : 'Netzwerk-Fehler'}`, time: new Date().toLocaleTimeString('de-CH') }, ...prev.results.slice(0, 19)],
      }));
    }
  }, [multiplayer?.municipalitySlug, multiplayer?.roomCode, deltaSyncDebug.testMunicipalitySlug, deltaSyncDebug.testRoomCode]);
  const [navigatorRegionName, setNavigatorRegionName] = useState('Public Region');
  const [navigatorRoomIndex, setNavigatorRoomIndex] = useState(1);
  const [navigatorRoomSizeKey, setNavigatorRoomSizeKey] = useState<(typeof DEBUG_PUBLIC_ROOM_SIZE_PRESETS)[number]['key']>('small');
  const [navigatorCreateState, setNavigatorCreateState] = useState<{
    running: boolean;
    result: { success: boolean; message: string; data?: Record<string, unknown> } | null;
  }>({ running: false, result: null });
  const deltaSyncLogsRef = useRef<DeltaSyncDebugState['logs']>([]);
  const avatarLiveApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Avatar Character Builder ---
  const [avatarConfig, setAvatarConfig] = useState<AvatarAppearanceConfig>(DEFAULT_AVATAR_APPEARANCE);
  const [avatarConfigLoading, setAvatarConfigLoading] = useState(false);
  const [avatarConfigSaving, setAvatarConfigSaving] = useState(false);
  const [avatarConfigStatus, setAvatarConfigStatus] = useState<{ success: boolean; message: string } | null>(null);

  // ==========================================
  // MONEY SOUND + ANIMATION
  // ==========================================

  const playMoneySound = useCallback((isPositive: boolean) => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      if (isPositive) {
        [0, 0.08].forEach((delay, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(i === 0 ? 1200 : 1600, now + delay);
          gain.gain.setValueAtTime(0.15, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
          osc.start(now + delay); osc.stop(now + delay + 0.15);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
      }
      setTimeout(() => ctx.close(), 500);
    } catch { /* Audio not available */ }
  }, []);

  const addMoneyWithEffect = useCallback((amount: number) => {
    game.addMoney(amount);
    playMoneySound(amount > 0);
    const id = ++moneyPopupIdRef.current;
    setMoneyPopups(prev => [...prev, { id, amount }]);
    setTimeout(() => setMoneyPopups(prev => prev.filter(p => p.id !== id)), 1200);
    if (moneyDisplayRef.current) {
      moneyDisplayRef.current.classList.remove('debug-money-pulse');
      void moneyDisplayRef.current.offsetWidth;
      moneyDisplayRef.current.classList.add('debug-money-pulse');
    }
  }, [game, playMoneySound]);

  // ==========================================
  // API TESTS
  // ==========================================

  const updateResult = useCallback((name: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, ...update } : r));
  }, []);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    const tests: TestResult[] = [
      { name: 'API Connection', status: 'pending' },
      { name: 'Backend Type', status: 'pending' },
      { name: 'Building Types', status: 'pending' },
      { name: 'Switzerland Stats', status: 'pending' },
      { name: 'Canton Data (ZH)', status: 'pending' },
      { name: 'Canton Data (SO)', status: 'pending' },
    ];
    setResults(tests);

    const runTest = async (name: string, fn: () => Promise<{ message: string; data?: unknown }>) => {
      const start = performance.now();
      try {
        const result = await fn();
        updateResult(name, { status: 'success', message: result.message, data: result.data, duration: Math.round(performance.now() - start) });
      } catch (e) {
        const isApi = e instanceof ApiError;
        updateResult(name, {
          status: 'error', message: e instanceof Error ? e.message : 'Unbekannt',
          duration: Math.round(performance.now() - start),
          url: isApi ? e.url : undefined, statusCode: isApi ? e.statusCode : undefined, errorDetails: isApi ? e.details : undefined,
        });
      }
    };

    await runTest('API Connection', async () => { const ok = await checkApiConnection(); return { message: ok ? 'API erreichbar' : 'Nicht erreichbar' }; });
    await runTest('Backend Type', async () => { const b = getBackendType(); return { message: b === 'core' ? 'Core (MySQL)' : 'Supabase', data: { backend: b } }; });
    await runTest('Building Types', async () => { const bt = await getBuildingTypes(); return { message: `${Object.values(bt).flat().length} Gebäude`, data: bt }; });
    await runTest('Switzerland Stats', async () => { const s = await getSwitzerlandStats(); return { message: `${s.overview.total_municipalities} Gemeinden`, data: s }; });
    await runTest('Canton Data (ZH)', async () => { const d = await getCantonData('ZH'); return { message: `${d.municipalities.length} Gemeinden`, data: d }; });
    await runTest('Canton Data (SO)', async () => { const d = await getCantonData('SO'); return { message: `${d.municipalities.length} Gemeinden`, data: d }; });
    setIsRunning(false);
  }, [updateResult]);

  // ==========================================
  // CITY GENERATION
  // ==========================================

  const generateAndSaveFullCity = useCallback(async () => {
    if (!multiplayer?.roomCode) { setCityGenResult({ success: false, message: 'Kein Multiplayer-Raum aktiv.' }); return; }
    setIsGeneratingCity(true); setCityGenResult(null);
    try {
      game.generateRandomCity();
      await new Promise(r => setTimeout(r, 100));
      const exportedState = game.exportState();
      const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
      const slug = multiplayer.municipalitySlug || getCurrentMunicipality();
      const response = await fetch(`${API_BASE_URL}/municipality/${slug}/rooms/${multiplayer.roomCode}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(token ? { 'X-Game-Token': token } : {}) },
        body: JSON.stringify({ game_state: exportedState }),
      });
      if (!response.ok) throw new Error(`Server: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setCityGenResult({ success: true, message: `Stadt für Raum ${multiplayer.roomCode} gespeichert!` });
        if (multiplayer.updateGameState) multiplayer.updateGameState(game.state);
      } else throw new Error(data.error || 'Unbekannt');
    } catch (e) { setCityGenResult({ success: false, message: e instanceof Error ? e.message : 'Fehler' }); }
    finally { setIsGeneratingCity(false); }
  }, [game, multiplayer]);

  // ==========================================
  // STATS SYNC
  // ==========================================

  const syncStatsViaWebSocket = useCallback(async () => {
    const snapshot = game.latestStateRef?.current || game.state;
    if (!snapshot?.stats) { setStatsSyncResult({ success: false, message: 'Keine Stats', timestamp: Date.now() }); return; }
    const hasStatsRights = deltaQueue.canSendStatsUpdates();
    if (!hasStatsRights) {
      setStatsSyncResult({
        success: false,
        message: 'Keine Rechte für Stats-Update (Admin/Moderator oder Gemeinde-Admin erforderlich).',
        timestamp: Date.now(),
      });
      return;
    }
    if (!deltaQueue.isWebSocketConnected()) {
      setStatsSyncResult({
        success: false,
        message: 'WebSocket nicht verbunden. Bitte neu verbinden.',
        timestamp: Date.now(),
      });
      return;
    }
    setIsSyncingStats(true); setStatsSyncResult(null);
    try {
      // Lass eventuelle UI-State-Updates in diesem Tick zuerst durchlaufen.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const latest = game.latestStateRef?.current || game.state;
      const s = latest?.stats || snapshot.stats;
      const room = multiplayer?.roomCode || deltaSyncDebug.testRoomCode || 'TEST01';
      const data = {
        money: Math.round(s.money ?? 0),
        income: Math.round(s.income ?? 0),
        expenses: Math.round(s.expenses ?? 0),
        population: Math.round(s.population ?? 0),
        jobs: Math.round(s.jobs ?? 0),
        happiness: Math.round(s.happiness ?? 50),
        tick: latest?.tick ?? snapshot.tick ?? 0,
        taxRate: latest?.taxRate ?? snapshot.taxRate ?? 10,
      };
      const ack = await deltaQueue.sendStatsWithAck(data);
      if (!ack) {
        setStatsSyncResult({
          success: false,
          message: 'Kein ACK vom Server (WS nicht verbunden?)',
          timestamp: Date.now(),
          data,
        });
        return;
      }
      if (!ack.success) {
        const dbg = ack.debug || {};
        setStatsSyncResult({
          success: false,
          message: `Blockiert: ${ack.error || 'unbekannt'} (role=${String(dbg.globalRole || 'n/a')}, viewOnly=${String(Boolean(dbg.isViewOnly))}, canSend=${String(Boolean(dbg.canSendStatsUpdates))})`,
          timestamp: Date.now(),
          data,
        });
        return;
      }
      const dbg = ack.debug || {};
      const authoritativeMoney = Number((dbg as Record<string, unknown>).authoritativeMoney);
      if (Number.isFinite(authoritativeMoney) && game.applyRemoteStats) {
        game.applyRemoteStats({ money: Math.round(authoritativeMoney) });
      }
      setStatsSyncResult({
        success: true,
        message: `Per WebSocket in Raum ${room} gesendet (req=${String((dbg as Record<string, unknown>).requestedMoney ?? 'n/a')}, stored=${String((dbg as Record<string, unknown>).storedMoney ?? 'n/a')}, auth=${String((dbg as Record<string, unknown>).authoritativeMoney ?? 'n/a')})`,
        timestamp: Date.now(),
        data: { ...(data || {}), server_debug: ack.debug || null },
      });
    } catch (e) { setStatsSyncResult({ success: false, message: e instanceof Error ? e.message : 'Fehler', timestamp: Date.now() }); }
    finally { setIsSyncingStats(false); }
  }, [game.state, deltaSyncDebug.testRoomCode]);

  const applyMoneyDeltaAndSync = useCallback(async (amount: number) => {
    const safeAmount = Math.round(Number(amount || 0));
    if (!Number.isFinite(safeAmount) || safeAmount === 0) return;
    addMoneyWithEffect(safeAmount);
    await syncStatsViaWebSocket();
  }, [addMoneyWithEffect, syncStatsViaWebSocket]);

  const setMoneyAbsoluteAndSync = useCallback(async (targetMoney: number) => {
    const latest = game.latestStateRef?.current || game.state;
    const currentMoney = Number(latest?.stats?.money ?? 0);
    const target = Math.round(Number(targetMoney || 0));
    if (!Number.isFinite(target)) return;
    const delta = target - currentMoney;
    await applyMoneyDeltaAndSync(delta);
  }, [game.latestStateRef, game.state, applyMoneyDeltaAndSync]);

  const applyAvatarConfigLocally = useCallback((config: AvatarAppearanceConfig) => {
    const normalized = normalizeAvatarAppearanceConfig(config);
    setAvatarConfig(normalized);
    saveAvatarAppearanceToStorage(normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('avatar-config-updated', { detail: { config: normalized } }));
    }
  }, []);

  const loadAvatarConfigFromServer = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    if (!token) {
      const localOnly = loadAvatarAppearanceFromStorage();
      setAvatarConfig(localOnly);
      setAvatarConfigStatus({ success: true, message: 'Lokale Avatar-Konfiguration geladen' });
      return;
    }
    setAvatarConfigLoading(true);
    setAvatarConfigStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/user-data/avatar-config`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Game-Token': token,
        },
      });
      if (!response.ok) throw new Error(`Server: ${response.status}`);
      const json = await response.json();
      if (!json?.success) throw new Error(json?.error || 'Avatar-Daten konnten nicht geladen werden');
      const normalized = normalizeAvatarAppearanceConfig(json?.data?.avatar_config || {});
      applyAvatarConfigLocally(normalized);
      setAvatarConfigStatus({ success: true, message: 'Avatar-Konfiguration geladen' });
    } catch (e) {
      const fallback = loadAvatarAppearanceFromStorage();
      setAvatarConfig(fallback);
      setAvatarConfigStatus({ success: false, message: e instanceof Error ? e.message : 'Fehler beim Laden' });
    } finally {
      setAvatarConfigLoading(false);
    }
  }, [applyAvatarConfigLocally]);

  const saveAvatarConfigToServer = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    const normalized = normalizeAvatarAppearanceConfig(avatarConfig);
    applyAvatarConfigLocally(normalized);
    if (!token) {
      setAvatarConfigStatus({ success: true, message: 'Nur lokal gespeichert (kein Login-Token)' });
      return;
    }
    setAvatarConfigSaving(true);
    setAvatarConfigStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/user-data/avatar-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Game-Token': token,
        },
        body: JSON.stringify({ avatar_config: normalized }),
      });
      if (!response.ok) throw new Error(`Server: ${response.status}`);
      const json = await response.json();
      if (!json?.success) throw new Error(json?.error || 'Avatar-Daten konnten nicht gespeichert werden');
      setAvatarConfigStatus({ success: true, message: 'Avatar-Konfiguration gespeichert' });
    } catch (e) {
      setAvatarConfigStatus({ success: false, message: e instanceof Error ? e.message : 'Fehler beim Speichern' });
    } finally {
      setAvatarConfigSaving(false);
    }
  }, [avatarConfig, applyAvatarConfigLocally]);

  // ==========================================
  // MIGRATION
  // ==========================================

  const migratePartnershipsToDb = async () => {
    if (!municipalitySlug) return;
    setIsMigrating(true); setMigrationResults([]); setMigrationComplete(false);
    const results: MigrationResult[] = [];
    for (const city of adjacentCities || []) {
      const slug = city.slug || city.name.toLowerCase().replace(/\s+/g, '-');
      try {
        if (city.discovered || city.connected) {
          const dr = await partnershipApi.discoverPartnership(municipalitySlug, slug, city.direction, city.name);
          if (city.connected) await partnershipApi.connectPartnership(municipalitySlug, slug);
          results.push({ city: city.name, success: true, message: city.connected ? 'Verbunden' : (dr.data.already_discovered ? 'Vorhanden' : 'Entdeckt') });
        } else {
          results.push({ city: city.name, success: true, message: 'Übersprungen' });
        }
      } catch (e) { results.push({ city: city.name, success: false, message: e instanceof Error ? e.message : 'Fehler' }); }
    }
    setMigrationResults(results); setMigrationComplete(true); setIsMigrating(false);
    await loadPartnershipsFromApi();
  };

  // ==========================================
  // DELTA SYNC
  // ==========================================

  const toggleDeltaSyncDebug = useCallback(() => {
    const n = !deltaSyncDebug.enabled;
    n ? localStorage.setItem('DELTA_SYNC_DEBUG', 'true') : localStorage.removeItem('DELTA_SYNC_DEBUG');
    setDeltaSyncDebug(prev => ({ ...prev, enabled: n }));
  }, [deltaSyncDebug.enabled]);

  const sendTestDelta = useCallback(async (type: 'place' | 'bulldoze' | 'zone') => {
    setDeltaSyncDebug(prev => ({ ...prev, isTesting: true, lastTestResult: null }));
    const addLog = (t: DeltaSyncDebugState['logs'][0]['type'], msg: string, data?: unknown) => {
      const log = { time: new Date().toLocaleTimeString('de-CH'), type: t, message: msg, data };
      deltaSyncLogsRef.current = [log, ...deltaSyncLogsRef.current.slice(0, 49)];
      setDeltaSyncDebug(prev => ({ ...prev, logs: deltaSyncLogsRef.current }));
    };
    const x = Math.floor(Math.random() * 50), y = Math.floor(Math.random() * 50);
    let td: DeltaActionInput;
    if (type === 'place') { td = { type: 'place', tool: 'road', x, y }; }
    else if (type === 'bulldoze') { td = { type: 'bulldoze', x, y }; }
    else { td = { type: 'zone', zone: 'residential', x, y }; }
    addLog('action', `⚡ TEST ${type.toUpperCase()} at (${x},${y})`, td);
    const delta: DeltaAction = { ...td, timestamp: Date.now(), playerId: deltaQueue.id || 'test' } as DeltaAction;
    const batch: DeltaBatch = { roomCode: deltaSyncDebug.testRoomCode, municipalitySlug: deltaSyncDebug.testMunicipalitySlug, deltas: [delta], clientVersion: 0, clientId: deltaQueue.id || 'test' };
    try {
      const r = await sendDeltaBatch(batch);
      if (r) { addLog('info', `✅ ${r.appliedDeltas} Delta(s) angewendet`, r); setDeltaSyncDebug(prev => ({ ...prev, isTesting: false, lastTestResult: { success: true, message: `Server-Version: ${r.serverVersion}`, data: r } })); }
      else { addLog('error', '❌ Keine Antwort'); setDeltaSyncDebug(prev => ({ ...prev, isTesting: false, lastTestResult: { success: false, message: 'Keine Antwort' } })); }
    } catch (e) { const m = e instanceof Error ? e.message : 'Fehler'; addLog('error', `❌ ${m}`); setDeltaSyncDebug(prev => ({ ...prev, isTesting: false, lastTestResult: { success: false, message: m } })); }
  }, [deltaSyncDebug.testRoomCode, deltaSyncDebug.testMunicipalitySlug]);

  const triggerDebugDisaster = useCallback(async (preset: DebugDisasterPreset) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    if (!token) {
      setDisasterTriggerState({
        running: false,
        result: { success: false, message: 'Kein Auth-Token gefunden' },
      });
      return;
    }
    const slug = multiplayer?.municipalitySlug || deltaSyncDebug.testMunicipalitySlug || getCurrentMunicipality();
    const roomCode = multiplayer?.roomCode || deltaSyncDebug.testRoomCode || 'TEST01';
    const addLog = (t: DeltaSyncDebugState['logs'][0]['type'], msg: string, data?: unknown) => {
      const log = { time: new Date().toLocaleTimeString('de-CH'), type: t, message: msg, data };
      deltaSyncLogsRef.current = [log, ...deltaSyncLogsRef.current.slice(0, 99)];
      setDeltaSyncDebug(prev => ({ ...prev, logs: deltaSyncLogsRef.current }));
    };

    setDisasterTriggerState({ running: true, result: null });
    addLog('action', `🌪️ Trigger Disaster: ${preset.type} (intensity=${preset.intensity})`, { slug, roomCode });

    try {
      const response = await fetch(
        `${API_BASE_URL}/municipality/${slug}/disasters/${roomCode}/trigger`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Game-Token': token,
          },
          body: JSON.stringify({
            type: preset.type,
            intensity: preset.intensity,
          }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) {
        const message = String(json?.error || `HTTP ${response.status}`);
        addLog('error', `❌ Disaster Trigger fehlgeschlagen: ${message}`, json);
        setDisasterTriggerState({
          running: false,
          result: { success: false, message },
        });
        return;
      }

      const updated = Number(json?.data?.updated || 0);
      const deleted = Number(json?.data?.deleted || 0);
      const changed = Number(json?.data?.changed_tiles || 0);
      const message = `${preset.label}: ${changed} Tiles geändert (upd ${updated} / del ${deleted})`;
      addLog('info', `✅ ${message}`, json?.data || null);
      setDisasterTriggerState({
        running: false,
        result: { success: true, message, data: json?.data || null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Netzwerk-Fehler';
      addLog('error', `❌ Disaster Trigger Fehler: ${message}`);
      setDisasterTriggerState({
        running: false,
        result: { success: false, message },
      });
    }
  }, [deltaSyncDebug.testMunicipalitySlug, deltaSyncDebug.testRoomCode, multiplayer?.municipalitySlug, multiplayer?.roomCode]);

  const createNavigatorRoom = useCallback(async () => {
    const addLog = (t: DeltaSyncDebugState['logs'][0]['type'], msg: string, data?: unknown) => {
      const log = { time: new Date().toLocaleTimeString('de-CH'), type: t, message: msg, data };
      deltaSyncLogsRef.current = [log, ...deltaSyncLogsRef.current.slice(0, 99)];
      setDeltaSyncDebug(prev => ({ ...prev, logs: deltaSyncLogsRef.current }));
    };

    setNavigatorCreateState({ running: true, result: null });
    try {
      const payload: publicMapsApi.CreatePublicMapPayload = {
        region_name: navigatorRegionName,
        room_index: Math.max(1, Math.min(99, Math.round(Number(navigatorRoomIndex || 1)))),
        size_key: navigatorRoomSizeKey,
        // Debug-Generator aktuell nur für Grösse: keine Wände/Objekte.
        generator: 'open',
      };
      addLog('action', `🗺️ Create Public Room (${payload.size_key}, size-only)`, payload);
      const json = await publicMapsApi.createPublicMap(payload);
      const roomCode = String(json?.data?.room_code || '');
      if (roomCode) {
        setDeltaSyncDebug(prev => ({ ...prev, testRoomCode: roomCode }));
      }
      setNavigatorCreateState({
        running: false,
        result: {
          success: true,
          message: String(json?.data?.message || 'Public Room erstellt'),
          data: (json?.data || null) as unknown as Record<string, unknown>,
        },
      });
      addLog('info', `✅ Public Room erstellt: ${roomCode || '—'}`, json?.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Fehler beim Erstellen';
      setNavigatorCreateState({
        running: false,
        result: { success: false, message },
      });
      addLog('error', `❌ Public Room Fehler: ${message}`);
    }
  }, [navigatorRegionName, navigatorRoomIndex, navigatorRoomSizeKey]);

  const toggleMeteorTargetMode = useCallback(() => {
    const next = !meteorTargetMode;
    setMeteorTargetMode(next);
    setTool('select');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('isocity-meteor-target-mode', {
        detail: { enabled: next, intensity: 4 },
      }));
    }
  }, [meteorTargetMode, setTool]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('isocity-meteor-target-mode', {
          detail: { enabled: false, intensity: 4 },
        }));
      }
    };
  }, []);

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    const update = () => setDeltaSyncDebug(prev => ({ ...prev, enabled: localStorage.getItem('DELTA_SYNC_DEBUG') === 'true', pendingCount: deltaQueue.pendingCount, clientId: deltaQueue.id }));
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const handler = (event: { time: string; type: 'send' | 'receive' | 'action' | 'error' | 'info'; message: string; data?: unknown }) => {
      deltaSyncLogsRef.current = [event, ...deltaSyncLogsRef.current.slice(0, 99)];
      setDeltaSyncDebug(prev => ({ ...prev, logs: deltaSyncLogsRef.current }));
    };
    const u1 = addDeltaSyncLogListener(handler);
    const u2 = addProviderLogListener(handler);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => { if (results.length === 0) runTests(); }, [results.length, runTests]);

  // ==========================================
  // HELPERS
  // ==========================================

  useEffect(() => {
    setAvatarConfig(loadAvatarAppearanceFromStorage());
  }, []);

  useEffect(() => {
    if (avatarLiveApplyTimeoutRef.current) {
      clearTimeout(avatarLiveApplyTimeoutRef.current);
    }
    const normalized = normalizeAvatarAppearanceConfig(avatarConfig);
    avatarLiveApplyTimeoutRef.current = setTimeout(() => {
      saveAvatarAppearanceToStorage(normalized);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('avatar-config-updated', { detail: { config: normalized } }));
      }
    }, 80);
    return () => {
      if (avatarLiveApplyTimeoutRef.current) {
        clearTimeout(avatarLiveApplyTimeoutRef.current);
      }
    };
  }, [avatarConfig]);

  const avatarColorFields: Array<{ label: string; key: AvatarColorFieldKey }> = [
    { label: 'Haut', key: 'skinColor' },
    { label: 'Shirt', key: 'shirtColor' },
    { label: 'Hose', key: 'pantsColor' },
    { label: 'Hut', key: 'hatColor' },
    { label: 'Haare', key: 'hairColor' },
    { label: 'Augen', key: 'eyeColor' },
  ];

  const connectedCities = adjacentCities?.filter(c => c.connected) || [];
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-2xl bg-slate-900/95 border-slate-700 text-white max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-700/50 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-orange-400" />
                Debug Panel
              </span>
              <div className="flex items-center gap-2 text-xs font-normal">
                <span className="text-emerald-400">✅ {successCount}</span>
                <span className="text-red-400">❌ {errorCount}</span>
                <span className="text-slate-500 font-mono">{municipalitySlug || '—'}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <style>{`
          @keyframes debug-money-pulse { 0% { transform: scale(1); } 30% { transform: scale(1.2); } 100% { transform: scale(1); } }
          @keyframes debug-money-float { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-40px); } }
          .debug-money-pulse { animation: debug-money-pulse 0.35s ease-out; }
        `}</style>

        <Tabs defaultValue="events" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-2 shrink-0">
            <TabsList className="w-full bg-slate-800/80 border border-slate-700">
              <TabsTrigger value="events" className="flex-1 text-[11px] data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />Events
              </TabsTrigger>
              <TabsTrigger value="neighbors" className="flex-1 text-[11px] data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Compass className="w-3.5 h-3.5 mr-1" />Nachbarn
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-1 text-[11px] data-[state=active]:bg-pink-600 data-[state=active]:text-white">
                <BarChart3 className="w-3.5 h-3.5 mr-1" />Stats
              </TabsTrigger>
              <TabsTrigger value="sync" className="flex-1 text-[11px] data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                <Radio className="w-3.5 h-3.5 mr-1" />Sync
              </TabsTrigger>
              <TabsTrigger value="discord" className="flex-1 text-[11px] data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Sparkles className="w-3.5 h-3.5 mr-1" />Discord
              </TabsTrigger>
              <TabsTrigger value="weather" className="flex-1 text-[11px] data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                ⛅ Wetter
              </TabsTrigger>
              <TabsTrigger value="bus" className="flex-1 text-[11px] data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                🚌 ÖV
              </TabsTrigger>
              <TabsTrigger value="chunks" className="flex-1 text-[11px] data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                <Layers className="w-3.5 h-3.5 mr-1" />Chunks
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ==================== NACHBARN ==================== */}
          <TabsContent value="neighbors" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            {/* Übersicht */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-slate-800/60 border-slate-700 p-2.5 text-center">
                <div className="text-xl font-bold text-white">{adjacentCities?.length ?? 0}</div>
                <div className="text-[10px] text-slate-400">Gesamt</div>
              </Card>
              <Card className="bg-emerald-900/30 border-emerald-500/30 p-2.5 text-center">
                <div className="text-xl font-bold text-emerald-400">{connectedCities.length}</div>
                <div className="text-[10px] text-emerald-300/70">Verbunden</div>
              </Card>
              <Card className="bg-blue-900/30 border-blue-500/30 p-2.5 text-center">
                <div className="text-xl font-bold text-blue-400">{adjacentCities?.filter(c => c.discovered).length ?? 0}</div>
                <div className="text-[10px] text-blue-300/70">Entdeckt</div>
              </Card>
            </div>

            {/* Mini-Kompass */}
            <Card className="bg-slate-800/60 border-slate-700 p-4">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Kartenrand-Übersicht</h4>
              <div className="relative w-full max-w-[220px] mx-auto" style={{ aspectRatio: '1' }}>
                <div className="absolute inset-[18%] border-2 border-slate-600/80 rounded bg-slate-800/60 flex items-center justify-center">
                  <span className="text-[9px] text-slate-500">Deine Stadt</span>
                </div>
                {(['north', 'south', 'east', 'west'] as const).map(dir => {
                  const city = adjacentCities?.find(c => c.direction === dir && c.connected);
                  const cfg = DIR_CFG[dir];
                  const pos = dir === 'north' ? 'top-0 left-1/2 -translate-x-1/2' :
                              dir === 'south' ? 'bottom-0 left-1/2 -translate-x-1/2' :
                              dir === 'east' ? 'right-0 top-1/2 -translate-y-1/2' :
                              'left-0 top-1/2 -translate-y-1/2';
                  return (
                    <div key={dir} className={`absolute ${pos} text-center`}>
                      {city ? (
                        <div className={`px-2 py-1 rounded border ${cfg.badge}`}>
                          <div className="text-[10px] font-bold">{cfg.arrow} {city.name}</div>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-600">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Liste */}
            {adjacentCities && adjacentCities.length > 0 ? (
              <div className="space-y-1.5">
                {adjacentCities.map((city, idx) => {
                  const cfg = DIR_CFG[city.direction] || DIR_CFG.north;
                  return (
                    <div key={city.id || idx} className={cn('p-2.5 rounded border text-xs', cfg.bg, cfg.border)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-base font-bold', cfg.color)}>{cfg.arrow}</span>
                          <div>
                            <span className="font-bold text-white">{city.name}</span>
                            <span className="text-slate-500 ml-1.5 text-[10px]">{cfg.mapPos}</span>
                          </div>
                        </div>
                        {city.connected ? (
                          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">🔗 Verbunden</span>
                        ) : city.discovered ? (
                          <span className="text-[10px] font-medium text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">👁 Entdeckt</span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Unbekannt</span>
                        )}
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500 font-mono">slug: {city.slug || '—'} · id: {city.id}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-slate-800/40 border-slate-700 p-5 text-center">
                <div className="text-2xl mb-1">🏔️</div>
                <div className="text-xs text-slate-400">Keine Nachbar-Gemeinden im State</div>
                <div className="text-[10px] text-slate-500 mt-1">Klick &quot;Sync&quot; um Daten von der API zu laden</div>
              </Card>
            )}

            <Button size="sm" onClick={() => loadPartnershipsFromApi().catch(() => {})} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw className="w-3.5 h-3.5 mr-2" />Partnerschaften aus API syncen
            </Button>

            <details className="text-[10px]">
              <summary className="text-slate-500 cursor-pointer hover:text-white">Raw JSON</summary>
              <pre className="mt-1 bg-slate-900/80 p-2 rounded overflow-auto max-h-28 text-emerald-300 font-mono">{JSON.stringify(adjacentCities ?? [], null, 2)}</pre>
            </details>
          </TabsContent>

          {/* ==================== STATS ==================== */}
          <TabsContent value="stats" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800/60 rounded p-2 relative overflow-visible">
                <span className="text-slate-400 block text-[10px]">💰 Money</span>
                <span ref={moneyDisplayRef} className="text-pink-400 font-mono font-bold inline-block">${game.state?.stats?.money?.toLocaleString() ?? 0}</span>
                {moneyPopups.map(p => (
                  <span key={p.id} className="absolute left-1/2 -translate-x-1/2 font-mono font-bold text-xs pointer-events-none" style={{ bottom: '100%', color: p.amount > 0 ? '#4ade80' : '#f87171', animation: 'debug-money-float 1.2s ease-out forwards' }}>
                    {p.amount > 0 ? '+' : ''}{p.amount.toLocaleString()}
                  </span>
                ))}
              </div>
              {[
                ['👥 Population', game.state?.stats?.population],
                ['😊 Happiness', Number.isFinite(Number(game.state?.stats?.happiness)) ? `${Math.round(Number(game.state?.stats?.happiness ?? 0))}%` : '—'],
                ['💼 Jobs', game.state?.stats?.jobs],
                ['📈 Income', game.state?.stats?.income ? `+Fr. ${game.state.stats.income.toLocaleString('de-CH')}` : '—'],
                ['📉 Expenses', game.state?.stats?.expenses ? `-Fr. ${Math.abs(game.state.stats.expenses).toLocaleString('de-CH')}` : '—'],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-slate-800/60 rounded p-2">
                  <span className="text-slate-400 block text-[10px]">{label}</span>
                  <span className="text-pink-400 font-mono font-bold">{typeof val === 'number' ? val.toLocaleString() : val ?? 0}</span>
                </div>
              ))}
            </div>

            {/* Money Editor */}
            <Card className="bg-slate-800/60 border-slate-700 p-3">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">💰 Geld ändern</h4>
              <div className="flex gap-2 mb-2">
                <input type="number" value={moneyInput} onChange={e => setMoneyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { const a = parseInt(moneyInput, 10); if (!isNaN(a)) { void setMoneyAbsoluteAndSync(a); setMoneyInput(''); } } }}
                  placeholder="Zielwert..." className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                <Button size="sm" onClick={() => { const a = parseInt(moneyInput, 10); if (!isNaN(a)) { void setMoneyAbsoluteAndSync(a); setMoneyInput(''); } }} className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7">Setzen</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {[1000, 10000, 50000, 100000, 500000, 1000000].map(a => (
                  <Button key={a} size="sm" variant="outline" onClick={() => { void applyMoneyDeltaAndSync(a); }} className="text-[10px] h-6 px-2 border-green-500/30 text-green-400 hover:bg-green-500/20">
                    +{a >= 1000000 ? `${a / 1000000}M` : `${a / 1000}K`}
                  </Button>
                ))}
                {[-1000, -10000, -50000].map(a => (
                  <Button key={a} size="sm" variant="outline" onClick={() => { void applyMoneyDeltaAndSync(a); }} className="text-[10px] h-6 px-2 border-red-500/30 text-red-400 hover:bg-red-500/20">
                    {a / 1000}K
                  </Button>
                ))}
              </div>
            </Card>

            {/* Stats Sync (WS only, admin only) */}
            <Card className="bg-slate-800/60 border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400">
                  <span className="font-mono">{multiplayer?.municipalitySlug || getCurrentMunicipality() || 'default'}</span> / <span className="font-mono text-pink-400 font-bold">{multiplayer?.roomCode || 'TEST01'}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mb-2">
                WS: {deltaQueue.isWebSocketConnected() ? 'verbunden' : 'getrennt'} · Rechte: {deltaQueue.canSendStatsUpdates() ? 'ok' : 'keine'}
              </div>
              <Button
                size="sm"
                onClick={syncStatsViaWebSocket}
                disabled={isSyncingStats || !deltaQueue.canSendStatsUpdates() || !deltaQueue.isWebSocketConnected()}
                className="w-full bg-pink-600 hover:bg-pink-700"
              >
                {isSyncingStats ? <>⏳ Sende...</> : <>📊 Stats per WebSocket senden</>}
              </Button>
              {statsSyncResult && (
                <div className={cn('mt-2 p-2 rounded text-[11px]', statsSyncResult.success ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300')}>
                  {statsSyncResult.success ? '✅' : '❌'} {statsSyncResult.message}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ==================== DELTA SYNC ==================== */}
          <TabsContent value="sync" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant={deltaSyncDebug.enabled ? 'default' : 'outline'} onClick={toggleDeltaSyncDebug}
                className={cn('text-xs h-7', deltaSyncDebug.enabled && 'bg-cyan-600 hover:bg-cyan-700')}>
                {deltaSyncDebug.enabled ? '🔍 Debug AN' : '🔍 Debug AUS'}
              </Button>
              <span className="text-[10px] text-slate-500">Zeigt Delta-Änderungen in Echtzeit</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-400 block text-[10px]">Client ID</span><code className="text-cyan-400 font-mono text-[10px]">{deltaSyncDebug.clientId || '—'}</code></div>
              <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-400 block text-[10px]">Ausstehend</span><span className={cn('font-bold', deltaSyncDebug.pendingCount > 0 ? 'text-yellow-400' : 'text-green-400')}>{deltaSyncDebug.pendingCount}</span></div>
              <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-400 block text-[10px]">Status</span><span className="text-green-400">● Aktiv</span></div>
            </div>

            {/* Test Deltas */}
            <Card className="bg-slate-800/60 border-slate-700 p-3">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Test Delta senden</h4>
              <div className="flex gap-2">
                {(['place', 'bulldoze', 'zone'] as const).map(t => (
                  <Button key={t} size="sm" variant="outline" onClick={() => sendTestDelta(t)} disabled={deltaSyncDebug.isTesting}
                    className="flex-1 text-[10px] h-7 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">
                    {t === 'place' ? '🏗️ Place' : t === 'bulldoze' ? '💥 Bulldoze' : '🏘️ Zone'}
                  </Button>
                ))}
              </div>
              {deltaSyncDebug.lastTestResult && (
                <div className={cn('mt-2 p-2 rounded text-[11px]', deltaSyncDebug.lastTestResult.success ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300')}>
                  {deltaSyncDebug.lastTestResult.message}
                </div>
              )}
            </Card>

            <Card className="bg-slate-800/60 border-red-500/30 p-3">
              <h4 className="text-[11px] font-semibold text-red-300 uppercase tracking-wider mb-2">Katastrophenliste (Debug Sync)</h4>
              <p className="text-[10px] text-slate-500 mb-2">
                Loest serverseitige Katastrophen aus und synced sie sofort an alle Clients im Raum.
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {DEBUG_DISASTER_PRESETS.map((preset) => (
                  <Button
                    key={preset.type}
                    size="sm"
                    variant="outline"
                    disabled={disasterTriggerState.running}
                    onClick={() => { void triggerDebugDisaster(preset); }}
                    className="justify-between h-8 border-red-500/30 text-red-200 hover:bg-red-500/15 text-[11px]"
                  >
                    <span>{preset.emoji} {preset.label}</span>
                    <span className="text-[10px] text-slate-400">{preset.hint}</span>
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={toggleMeteorTargetMode}
                className={cn(
                  'mt-2 w-full text-[11px] h-8',
                  meteorTargetMode ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                )}
              >
                {meteorTargetMode ? '☄️ Meteor Werkzeug: AN (Klick auf Map)' : '☄️ Meteor Werkzeug aktivieren'}
              </Button>
              {disasterTriggerState.result && (
                <div className={cn(
                  'mt-2 p-2 rounded text-[11px]',
                  disasterTriggerState.result.success
                    ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                    : 'bg-red-500/10 text-red-300 border border-red-500/20'
                )}>
                  {disasterTriggerState.result.success ? '✅' : '❌'} {disasterTriggerState.result.message}
                </div>
              )}
            </Card>

            {/* Logs */}
            <Card className="bg-slate-800/60 border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Live Logs ({deltaSyncDebug.logs.length})</h4>
                <Button size="sm" variant="ghost" onClick={() => { deltaSyncLogsRef.current = []; setDeltaSyncDebug(prev => ({ ...prev, logs: [] })); }} className="text-[10px] h-6 text-slate-500">Clear</Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-[10px]">
                {deltaSyncDebug.logs.length === 0 ? (
                  <div className="text-slate-500 py-2 text-center">Keine Logs</div>
                ) : deltaSyncDebug.logs.map((log, i) => (
                  <div key={i} className={cn('px-1.5 py-0.5 rounded',
                    log.type === 'send' && 'text-blue-300 bg-blue-500/5',
                    log.type === 'receive' && 'text-green-300 bg-green-500/5',
                    log.type === 'error' && 'text-red-300 bg-red-500/5',
                    log.type === 'action' && 'text-yellow-300',
                    log.type === 'info' && 'text-slate-300',
                  )}>
                    <span className="text-slate-500">{log.time}</span> {log.message}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ==================== DISCORD BOT TEST ==================== */}
          <TabsContent value="discord" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            <Card className="bg-slate-800/60 border-indigo-500/30 p-3">
              <h3 className="text-sm font-bold text-indigo-300 mb-1">Discord Bot Test-Triggers</h3>
              <p className="text-[11px] text-slate-400 mb-3">Sendet Test-Events direkt an den Discord Bot (Port 4200). Der Bot muss laufen!</p>

              {/* Katastrophen */}
              <h4 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-2">Katastrophen</h4>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {[
                  { type: 'fire', label: 'Feuer', emoji: '🔥', data: { affectedCount: 3, message: 'Test: 3 Gebäude brennen!' } },
                  { type: 'meteor', label: 'Meteor', emoji: '☄️', data: { affectedCount: 5, intensity: 4, message: 'Test: Meteoreinschlag!' } },
                  { type: 'earthquake', label: 'Erdbeben', emoji: '🌍', data: { affectedCount: 8, intensity: 3, message: 'Test: Erdbeben!' } },
                  { type: 'tornado', label: 'Tornado', emoji: '🌪️', data: { affectedCount: 4, intensity: 3, message: 'Test: Tornado!' } },
                  { type: 'flood', label: 'Flut', emoji: '🌊', data: { affectedCount: 6, intensity: 2, message: 'Test: Ueberschwemmung!' } },
                  { type: 'disaster', label: 'Zerstörung', emoji: '💥', data: { destroyedCount: 2, message: 'Test: 2 Gebäude zerstört!' } },
                ].map(preset => (
                  <Button
                    key={preset.type}
                    size="sm"
                    variant="outline"
                    disabled={discordTestState.running !== null}
                    onClick={() => triggerDiscordTest(preset.type, preset.label, preset.data)}
                    className="h-9 text-[11px] border-red-500/30 hover:bg-red-500/10 text-red-300 justify-start"
                  >
                    {discordTestState.running === preset.type ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <span className="mr-1.5">{preset.emoji}</span>}
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Gebäude */}
              <h4 className="text-[11px] font-semibold text-green-400 uppercase tracking-wider mb-2">Gebäude</h4>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {[
                  { type: 'building_complete', label: 'Bau fertig', emoji: '🏗️', data: { buildingType: 'residential', count: 1, message: 'Test: Gebäude fertiggestellt!' } },
                  { type: 'building_upgrade', label: 'Upgrade', emoji: '⬆️', data: { buildingType: 'commercial', level: 3, count: 1, message: 'Test: Gebäude auf Level 3!' } },
                  { type: 'building_abandoned', label: 'Verlassen', emoji: '🏚️', data: { buildingType: 'industrial', count: 2, message: 'Test: 2 Gebäude verlassen!' } },
                  { type: 'building_destroyed', label: 'Zerstört', emoji: '💥', data: { buildingType: 'residential', count: 1, message: 'Test: Gebäude zerstört!' } },
                ].map(preset => (
                  <Button
                    key={preset.type}
                    size="sm"
                    variant="outline"
                    disabled={discordTestState.running !== null}
                    onClick={() => triggerDiscordTest(preset.type, preset.label, preset.data)}
                    className="h-9 text-[11px] border-green-500/30 hover:bg-green-500/10 text-green-300 justify-start"
                  >
                    {discordTestState.running === preset.type ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <span className="mr-1.5">{preset.emoji}</span>}
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Partnerschaften */}
              <h4 className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider mb-2">Partnerschaften</h4>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {[
                  { type: 'partnership_discovered', label: 'Entdeckt', emoji: '🔍', data: { username: 'TestSpieler', message: 'Test: Neuer Handelspartner!', payload: { municipality_slug: 'zuerich', partner_slug: 'bern' } } },
                  { type: 'partnership_connected', label: 'Route aktiv', emoji: '🤝', data: { username: 'TestSpieler', message: 'Test: Handelsroute aktiv!', payload: { municipality_slug: 'zuerich', partner_slug: 'bern', monthly_income: 250 } } },
                  { type: 'partnership_request_incoming', label: 'Anfrage', emoji: '📨', data: { username: 'TestSpieler', message: 'Test: Partnerschaftsanfrage!', payload: { from_slug: 'zuerich', to_slug: 'bern' } } },
                  { type: 'partnership_request_accepted', label: 'Angenommen', emoji: '✅', data: { username: 'TestSpieler', message: 'Test: Anfrage akzeptiert!', payload: {} } },
                ].map(preset => (
                  <Button
                    key={preset.type}
                    size="sm"
                    variant="outline"
                    disabled={discordTestState.running !== null}
                    onClick={() => triggerDiscordTest(preset.type, preset.label, preset.data)}
                    className="h-9 text-[11px] border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-300 justify-start"
                  >
                    {discordTestState.running === preset.type ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <span className="mr-1.5">{preset.emoji}</span>}
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Alle auf einmal */}
              <Button
                size="sm"
                variant="outline"
                disabled={discordTestState.running !== null}
                onClick={async () => {
                  const allTests = [
                    { type: 'fire', label: 'Feuer', data: { affectedCount: 3, message: 'Alle-Test: Feuer!' } },
                    { type: 'building_complete', label: 'Bau fertig', data: { count: 2, message: 'Alle-Test: 2 Gebäude fertig!' } },
                    { type: 'partnership_connected', label: 'Partnerschaft', data: { message: 'Alle-Test: Handelsroute!', payload: { monthly_income: 100 } } },
                  ];
                  for (const t of allTests) {
                    await triggerDiscordTest(t.type, t.label, t.data);
                    await new Promise(r => setTimeout(r, 500));
                  }
                }}
                className="w-full h-10 text-xs border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Alle Events testen (4 Nachrichten)
              </Button>
            </Card>

            {/* Ergebnisse */}
            {discordTestState.results.length > 0 && (
              <Card className="bg-slate-800/60 border-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Test-Ergebnisse ({discordTestState.results.length})</h4>
                  <Button size="sm" variant="ghost" onClick={() => setDiscordTestState(prev => ({ ...prev, results: [] }))} className="text-[10px] h-6 text-slate-500">Clear</Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-[10px]">
                  {discordTestState.results.map((r, i) => (
                    <div key={i} className={cn('px-1.5 py-0.5 rounded', r.success ? 'text-green-300 bg-green-500/5' : 'text-red-300 bg-red-500/5')}>
                      <span className="text-slate-500">{r.time}</span> {r.success ? '✅' : '❌'} {r.message}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ==================== EVENTS DEBUG ==================== */}
          <TabsContent value="events" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            <EventsDebugSection />
          </TabsContent>

          {/* ==================== WETTER DEBUG ==================== */}
          <TabsContent value="weather" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            <Card className="bg-slate-800/60 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Wetter-Effekte (PixiJS)</h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Wähle einen Wettertyp aus, um ihn sofort als Override zu setzen. &quot;Auto&quot; setzt den automatischen Wetterwechsel zurück.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => onDebugWeatherChange?.(null)}
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-xs font-medium border transition-all',
                    !debugWeatherOverride
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
                  )}
                >
                  🔄 Auto
                </button>
                {([
                  { type: 'clear' as const, icon: '☀️', label: 'Klar' },
                  { type: 'drizzle' as const, icon: '🌦️', label: 'Niesel' },
                  { type: 'rain' as const, icon: '🌧️', label: 'Regen' },
                  { type: 'storm' as const, icon: '⛈️', label: 'Sturm' },
                  { type: 'thunderstorm' as const, icon: '⚡', label: 'Gewitter' },
                  { type: 'snow' as const, icon: '❄️', label: 'Schnee' },
                  { type: 'blizzard' as const, icon: '🌨️', label: 'Schneesturm' },
                  { type: 'fog' as const, icon: '🌫️', label: 'Nebel' },
                ]).map(w => (
                  <button
                    key={w.type}
                    onClick={() => onDebugWeatherChange?.(w.type)}
                    className={cn(
                      'px-3 py-2.5 rounded-lg text-xs font-medium border transition-all',
                      debugWeatherOverride === w.type
                        ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-600/20'
                        : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
                    )}
                  >
                    {w.icon} {w.label}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 border-t border-slate-700 pt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-400">Aktiv:</span>
                  <span className="text-white">{debugWeatherOverride ? `Override: ${debugWeatherOverride}` : 'Server-Wetter (Auto)'}</span>
                </div>
                {serverWeather && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-400">Server:</span>
                      <span className="text-emerald-400 font-medium">{serverWeather.type}</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">Intensität: {Math.round(serverWeather.intensity * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sky-400">🌡️ {serverWeather.temperature?.toFixed(1) ?? '?'}°C</span>
                      <span className="text-slate-500">({serverWeather.temperatureMin?.toFixed(1)}–{serverWeather.temperatureMax?.toFixed(1)}°C)</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">💨 {serverWeather.windspeed?.toFixed(1) ?? '?'} km/h</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-amber-400">{serverWeather.isDay ? '☀️ Tag' : '🌙 Nacht'}</span>
                    </div>
                    <div className="text-[9px] text-slate-600">Quelle: Open-Meteo (Bern, Zürich, Basel) — Refresh alle 10 Min</div>
                  </div>
                )}
                {!serverWeather && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-400">Kein Server-Wetter — lokaler Fallback aktiv</span>
                  </div>
                )}
                <div className="text-slate-500">
                  Effekte: Partikel-Regen/-Schnee, Blitz-Generierung, Nebel-Overlay, Sturm-Verdunklung — alles via PixiJS WebGL
                </div>
              </div>
            </Card>

            <CloudDebugControls />
          </TabsContent>

          {/* ==================== ÖV / BUS DEBUG ==================== */}
          <TabsContent value="bus" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            <BusDebugControls />
          </TabsContent>

          {/* ==================== CHUNK DEBUG ==================== */}
          <TabsContent value="chunks" className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            <ChunkDebugTab chunkManager={chunkManager} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function BusDebugControls() {
  const [busInfo, setBusInfo] = useState<ReturnType<() => { busCount: number; buses: unknown[]; busLines: unknown[]; waitingPeds: number; ridingPeds: number }> | null>(null);
  const [spawnResult, setSpawnResult] = useState<string>('');

  const refreshInfo = useCallback(() => {
    const dbg = (window as unknown as Record<string, { getInfo?: () => unknown; spawnBus?: () => boolean }>).__debugBus;
    if (dbg?.getInfo) {
      setBusInfo(dbg.getInfo() as ReturnType<() => { busCount: number; buses: unknown[]; busLines: unknown[]; waitingPeds: number; ridingPeds: number }>);
    } else {
      setBusInfo(null);
      setSpawnResult('⚠️ Bus-System nicht verfügbar (Karte nicht geladen?)');
    }
  }, []);

  useEffect(() => {
    refreshInfo();
    const interval = setInterval(refreshInfo, 2000);
    return () => clearInterval(interval);
  }, [refreshInfo]);

  const handleSpawnBus = useCallback(() => {
    const dbg = (window as unknown as Record<string, { getInfo?: () => unknown; spawnBus?: () => boolean }>).__debugBus;
    if (dbg?.spawnBus) {
      const ok = dbg.spawnBus();
      setSpawnResult(ok ? '✅ Bus gespawnt!' : '❌ Spawn fehlgeschlagen (keine Route gefunden)');
      setTimeout(refreshInfo, 200);
    } else {
      setSpawnResult('⚠️ Bus-System nicht verfügbar');
    }
  }, [refreshInfo]);

  const handleSpawnMultiple = useCallback(() => {
    const dbg = (window as unknown as Record<string, { getInfo?: () => unknown; spawnBus?: () => boolean }>).__debugBus;
    if (!dbg?.spawnBus) { setSpawnResult('⚠️ Bus-System nicht verfügbar'); return; }
    let spawned = 0;
    for (let i = 0; i < 5; i++) { if (dbg.spawnBus()) spawned++; }
    setSpawnResult(`✅ ${spawned}/5 Busse gespawnt`);
    setTimeout(refreshInfo, 200);
  }, [refreshInfo]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSpawnBus} className="bg-amber-600 hover:bg-amber-500 text-white">
          🚌 Bus spawnen
        </Button>
        <Button size="sm" onClick={handleSpawnMultiple} className="bg-amber-700 hover:bg-amber-600 text-white">
          🚌×5 Mehrere spawnen
        </Button>
        <Button size="sm" variant="outline" onClick={refreshInfo}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {spawnResult && (
        <div className="text-xs px-2 py-1 bg-slate-800 rounded border border-slate-700">{spawnResult}</div>
      )}

      {busInfo && (
        <>
          <Card className="p-3 bg-slate-800/60 border-slate-700">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-amber-400 font-bold text-lg">{busInfo.busCount}</div>
                <div className="text-slate-400">Busse</div>
              </div>
              <div>
                <div className="text-blue-400 font-bold text-lg">{(busInfo.busLines as unknown[]).length}</div>
                <div className="text-slate-400">Linien</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">{busInfo.waitingPeds}</div>
                <div className="text-slate-400">Wartend</div>
              </div>
              <div>
                <div className="text-purple-400 font-bold text-lg">{busInfo.ridingPeds}</div>
                <div className="text-slate-400">Im Bus</div>
              </div>
            </div>
          </Card>

          {(busInfo.busLines as { id: number; color: string; stops: number; pathLen: number }[]).length > 0 && (
            <Card className="p-3 bg-slate-800/60 border-slate-700">
              <div className="text-xs font-bold text-amber-400 mb-2">Buslinien</div>
              {(busInfo.busLines as { id: number; color: string; stops: number; pathLen: number }[]).map((line) => (
                <div key={line.id} className="flex items-center gap-2 text-xs py-1 border-b border-slate-700/50 last:border-0">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: line.color }} />
                  <span className="text-slate-300">Linie #{line.id}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">{line.stops} Stops</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">{line.pathLen} Tiles Pfad</span>
                </div>
              ))}
            </Card>
          )}

          {(busInfo.buses as { id: number; lineId: number; passengers: number; capacity: number; stopTimer: string; tileX: number; tileY: number; pathLen: number }[]).length > 0 && (
            <Card className="p-3 bg-slate-800/60 border-slate-700">
              <div className="text-xs font-bold text-amber-400 mb-2">Aktive Busse</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(busInfo.buses as { id: number; lineId: number; passengers: number; capacity: number; stopTimer: string; tileX: number; tileY: number; pathLen: number }[]).map((bus) => (
                  <div key={bus.id} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-slate-700/30 last:border-0">
                    <span className="text-slate-500">#{bus.id}</span>
                    <span className="text-amber-400">{bus.lineId >= 0 ? `L${bus.lineId}` : 'Frei'}</span>
                    <span className="text-green-400">🧑 {bus.passengers}/{bus.capacity}</span>
                    <span className="text-slate-400">({bus.tileX},{bus.tileY})</span>
                    {Number(bus.stopTimer) > 0 && <span className="text-red-400">⏸ {bus.stopTimer}s</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ==========================================
// CHUNK DEBUG TAB
// ==========================================

function ChunkDebugTab({ chunkManager }: { chunkManager?: ChunkManager }) {
  const [info, setInfo] = useState<ChunkDebugInfo | null>(null);

  const refresh = useCallback(() => {
    if (chunkManager) setInfo(chunkManager.getDebugInfo());
  }, [chunkManager]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!chunkManager || !info) {
    return (
      <div className="text-slate-400 text-sm text-center py-8">
        Kein ChunkManager aktiv (Karte nicht geladen?)
      </div>
    );
  }

  const total = info.numChunks * info.numChunks;
  const loadedCount = info.loadedChunks.size;
  const loadingCount = info.loadingChunks.size;
  const notLoadedCount = total - loadedCount - loadingCount;
  const viewport = info.lastViewport;
  const zoomPct = viewport ? Math.round(viewport.zoom * 100) : null;

  return (
    <div className="space-y-4">
      {/* === VIEWPORT INFO === */}
      <Card className="p-3 bg-slate-800/60 border-slate-700">
        <div className="text-xs font-bold text-violet-400 mb-2 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" /> Viewport &amp; Render
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-white font-bold font-mono text-base">{zoomPct !== null ? `${zoomPct}%` : '—'}</div>
            <div className="text-slate-400">Zoom</div>
          </div>
          <div>
            <div className="text-cyan-300 font-bold font-mono text-base">~{info.viewportTilesEstimate.toLocaleString()}</div>
            <div className="text-slate-400">Tiles in Sicht</div>
          </div>
          <div>
            <div className="text-white font-bold font-mono text-base">{info.gridSize}×{info.gridSize}</div>
            <div className="text-slate-400">Grid-Grösse</div>
          </div>
        </div>
        {viewport && (
          <div className="mt-2 text-[10px] text-slate-500 font-mono">
            offset ({Math.round(viewport.offset.x)}, {Math.round(viewport.offset.y)}) &nbsp;|&nbsp;
            canvas {Math.round(viewport.canvasSize.width)}×{Math.round(viewport.canvasSize.height)}
          </div>
        )}
      </Card>

      {/* === CHUNK STATS === */}
      <Card className="p-3 bg-slate-800/60 border-slate-700">
        <div className="text-xs font-bold text-violet-400 mb-2">Chunk-Status</div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
          <div>
            <div className="text-slate-300 font-bold font-mono text-base">{total}</div>
            <div className="text-slate-400">Total</div>
          </div>
          <div>
            <div className="text-green-400 font-bold font-mono text-base">{loadedCount}</div>
            <div className="text-slate-400">Geladen</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold font-mono text-base">{loadingCount}</div>
            <div className="text-slate-400">Lädt…</div>
          </div>
          <div>
            <div className="text-slate-500 font-bold font-mono text-base">{notLoadedCount}</div>
            <div className="text-slate-400">Ausstehend</div>
          </div>
        </div>
        <div className="text-[10px] text-slate-500">
          Chunk-Grösse: {info.chunkSize}×{info.chunkSize} Tiles &nbsp;|&nbsp; {info.numChunks}×{info.numChunks} Chunks
        </div>
      </Card>

      {/* === VISUAL CHUNK GRID === */}
      <Card className="p-3 bg-slate-800/60 border-slate-700">
        <div className="text-xs font-bold text-violet-400 mb-2">Chunk-Karte</div>
        <div className="flex justify-center">
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${info.numChunks}, 1fr)` }}
          >
            {Array.from({ length: info.numChunks }, (_, cy) =>
              Array.from({ length: info.numChunks }, (_, cx) => {
                const key = `${cx},${cy}`;
                const loaded = info.loadedChunks.has(key);
                const loading = info.loadingChunks.has(key);
                return (
                  <div
                    key={key}
                    title={`Chunk (${cx}, ${cy})${loaded ? ' ✓ geladen' : loading ? ' ⟳ lädt' : ' ○ ausstehend'}`}
                    className={cn(
                      'border border-slate-700/50 rounded-[2px] cursor-default',
                      loaded
                        ? 'bg-green-500/80'
                        : loading
                        ? 'bg-yellow-400/80 animate-pulse'
                        : 'bg-slate-700/50'
                    )}
                    style={{
                      width: Math.max(16, Math.min(40, Math.floor(280 / info.numChunks))),
                      height: Math.max(16, Math.min(40, Math.floor(280 / info.numChunks))),
                    }}
                  />
                );
              })
            ).flat()}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 justify-center">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/80 inline-block" /> Geladen</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400/80 inline-block" /> Lädt</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700/50 inline-block" /> Nicht geladen</span>
        </div>
      </Card>

      {/* === AKTIONEN === */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={refresh} className="flex-1">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-red-400 border-red-800 hover:bg-red-950"
          onClick={() => { chunkManager.forceReload(); refresh(); }}
        >
          Reset &amp; Neu laden
        </Button>
      </div>

      {/* === LOADED CHUNK LIST (wenn wenige) === */}
      {total <= 25 && (
        <Card className="p-3 bg-slate-800/60 border-slate-700">
          <div className="text-xs font-bold text-violet-400 mb-2">Chunk-Details</div>
          <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
            {Array.from({ length: info.numChunks }, (_, cy) =>
              Array.from({ length: info.numChunks }, (_, cx) => {
                const key = `${cx},${cy}`;
                const loaded = info.loadedChunks.has(key);
                const loading = info.loadingChunks.has(key);
                return (
                  <div
                    key={key}
                    className={cn(
                      'px-1 py-0.5 rounded text-center',
                      loaded ? 'bg-green-900/50 text-green-300' :
                      loading ? 'bg-yellow-900/50 text-yellow-300' :
                      'bg-slate-900/50 text-slate-500'
                    )}
                  >
                    {cx},{cy}
                  </div>
                );
              })
            ).flat()}
          </div>
        </Card>
      )}
    </div>
  );
}

type CloudTypeOption = 'cumulus' | 'stratus' | 'cirrus' | 'cumulonimbus' | 'altocumulus';

function CloudDebugControls() {
  const [activeType, setActiveType] = useState<CloudTypeOption | 'all' | null>(null);
  const [density, setDensity] = useState(1);

  useEffect(() => {
    const current = getDebugCloudOverride();
    if (current) {
      setActiveType(current.type as CloudTypeOption | 'all' | null);
      setDensity(current.density);
    }
  }, []);

  const applyOverride = useCallback((type: CloudTypeOption | 'all' | null, d: number) => {
    setActiveType(type);
    setDensity(d);
    if (type === null && d === 1) {
      setDebugCloudOverride(null);
    } else {
      setDebugCloudOverride({ type, density: d, clearExisting: true });
    }
  }, []);

  const cloudTypes: { type: CloudTypeOption; icon: string; label: string }[] = [
    { type: 'cumulus', icon: '☁️', label: 'Cumulus' },
    { type: 'stratus', icon: '🌥️', label: 'Stratus' },
    { type: 'cirrus', icon: '🌤️', label: 'Cirrus' },
    { type: 'cumulonimbus', icon: '🌩️', label: 'Cumulonim.' },
    { type: 'altocumulus', icon: '⛅', label: 'Altocumulus' },
  ];

  const densityPresets = [
    { value: 0.3, label: 'Wenig' },
    { value: 1, label: 'Normal' },
    { value: 2, label: 'Viel' },
    { value: 4, label: 'Extrem' },
  ];

  return (
    <Card className="bg-slate-800/60 border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Wolken (PixiJS WebGL)</h3>

      <div className="text-[11px] text-slate-400 mb-3">Wolkentyp erzwingen:</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => applyOverride(null, density)}
          className={cn(
            'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
            activeType === null
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
          )}
        >
          🔄 Auto
        </button>
        <button
          onClick={() => applyOverride('all', density)}
          className={cn(
            'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
            activeType === 'all'
              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
          )}
        >
          🎲 Alle
        </button>
        {cloudTypes.map(c => (
          <button
            key={c.type}
            onClick={() => applyOverride(c.type, density)}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
              activeType === c.type
                ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-600/20'
                : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
            )}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-slate-400 mb-2">Dichte:</div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {densityPresets.map(p => (
          <button
            key={p.value}
            onClick={() => applyOverride(activeType, p.value)}
            className={cn(
              'px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all',
              density === p.value
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-slate-500 border-t border-slate-700 pt-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-400">Typ:</span>
          <span className="text-white">{activeType ?? 'Auto (Tageszeit)'}</span>
          <span className="text-slate-600">|</span>
          <span className="font-medium text-slate-400">Dichte:</span>
          <span className="text-white">{density}x</span>
        </div>
        <div className="mt-1 text-slate-500">
          Wolken-Rendering via PixiJS: weiche Texturen, BlurFilter, Sprite-Pooling, GPU-Blending
        </div>
      </div>
    </Card>
  );
}

function EventsDebugSection() {
  const [events, setEvents] = useState<Array<{id: number; name: string; emoji: string; category: string; severity: string; status: string; municipality_name: string; spawned_at: string; location_x: number; location_y: number}>>([]);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
      const adminBase = process.env.NEXT_PUBLIC_CORE_API_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
      const res = await fetch(`${adminBase}/api/admin/events?status=detected`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setEvents(data.data.events);
      } else {
        setMsg(`Fehler: ${data.error}`);
      }
    } catch (e: unknown) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const pushEvent = async (eventId?: number) => {
    setPushing(eventId ?? -1);
    setMsg('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
      const adminBase2 = process.env.NEXT_PUBLIC_CORE_API_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
      const res = await fetch(`${adminBase2}/api/admin/events/push-to-verwaltung`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventId ? { event_id: eventId } : {}),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`${data.data.pushed} Event(s) an Verwaltung gepusht`);
        await loadEvents();
      } else {
        setMsg(`Fehler: ${data.error}`);
      }
    } catch (e: unknown) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setPushing(null);
    }
  };

  const severityColor: Record<string, string> = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };

  return (
    <>
      <Card className="bg-slate-800/60 border-orange-500/30 p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-orange-300">Detected Events → Verwaltung</h3>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={loadEvents} disabled={loading}
              className="h-7 text-[11px] border-slate-600">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
            <Button size="sm" onClick={() => pushEvent()} disabled={pushing !== null || events.length === 0}
              className="h-7 text-[11px] bg-orange-600 hover:bg-orange-500 text-white">
              {pushing === -1 ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 mr-1" />}
              Alle pushen ({events.length})
            </Button>
          </div>
        </div>

        {msg && (
          <div className={`text-xs px-2 py-1.5 rounded mb-2 ${msg.startsWith('Fehler') ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'}`}>
            {msg}
          </div>
        )}

        {events.length === 0 && !loading && (
          <p className="text-xs text-slate-500 text-center py-4">Keine detected Events vorhanden</p>
        )}

        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 transition-colors">
              <span className="text-lg">{ev.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white truncate">{ev.name}</span>
                  <span className={`text-[10px] font-mono ${severityColor[ev.severity] || 'text-slate-400'}`}>{ev.severity}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{ev.municipality_name}</span>
                  <span>({ev.location_x}, {ev.location_y})</span>
                  <span>{new Date(ev.spawned_at).toLocaleTimeString('de-CH')}</span>
                </div>
              </div>
              <Button size="sm" onClick={() => pushEvent(ev.id)} disabled={pushing !== null}
                className="h-6 px-2 text-[10px] bg-orange-600/80 hover:bg-orange-500 text-white shrink-0">
                {pushing === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '→ Melden'}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
