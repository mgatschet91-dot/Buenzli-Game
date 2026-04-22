'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool } from '@/types/game';
import { useMobile } from '@/hooks/useMobile';
import { MobileToolbar } from '@/components/mobile/MobileToolbar';
import { MobileTopBar } from '@/components/mobile/MobileTopBar';
import { msg, useMessages, useGT } from 'gt-next';

// Import shadcn components
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCheatCodes } from '@/hooks/useCheatCodes';
import { VinnieDialog } from '@/components/VinnieDialog';
import { CommandMenu } from '@/components/ui/CommandMenu';
// DebugPanel wird jetzt über setActivePanel('debug') geöffnet (ApiDebugPanel)
import { useMultiplayerSync, setIsStatsSender } from '@/hooks/useMultiplayerSync';
import { useCopyRoomLink } from '@/hooks/useCopyRoomLink';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { useStatsSync } from '@/hooks/useStatsSync';
import { useMinimapSync } from '@/hooks/useMinimapSync';
import { useConstructionSync } from '@/hooks/useConstructionSync';
import { ShareModal } from '@/components/multiplayer/ShareModal';
import { Copy, Check } from 'lucide-react';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useResidences } from '@/lib/hooks/useResidences';
import { setServerItemDetails } from '@/lib/simulation';
import { useServerTime } from '@/hooks/useServerTime';
import { getAuthToken, setAuthToken } from '@/lib/api/coreApi';

// Import game components
import { OverlayMode } from '@/components/game/types';
import { getOverlayForTool } from '@/components/game/overlays';
import { OverlayModeToggle } from '@/components/game/OverlayModeToggle';
import { Sidebar } from '@/components/game/Sidebar';
import {
  StatisticsPanel,
  SettingsPanel,
  AdvisorsPanel,
  TradePanel,
  ApiDebugPanel,
  ChatPanel,
} from '@/components/game/panels';
import { MiniMap } from '@/components/game/MiniMap';
import { TopBar, StatsPanel } from '@/components/game/TopBar';
import { PublicRoomFooterBar } from '@/components/game/PublicRoomFooterBar';
import { MessengerContainer } from '@/components/game/panels/MessengerPanel';
import { FirmaPanel } from '@/components/game/panels/FirmaPanel';
import { BusLineCreationOverlay } from '@/components/game/BusLineCreationOverlay';
import { ResidencePlacementOverlay } from '@/components/game/ResidencePlacementOverlay';
import { GemeindePanel } from '@/components/game/panels/GemeindePanel';
import { TutorialOverlay } from '@/components/game/panels/TutorialOverlay';
import { LeaderboardPanel } from '@/components/game/panels/LeaderboardPanel';
import { AdminPanel } from '@/components/game/panels/AdminPanel';
import { SystemNoticeBanner } from '@/components/game/panels/SystemNoticeBanner';
import { PixiWeatherOverlay, type WeatherType as PixiWeatherType } from '@/components/game/PixiWeatherOverlay';
import { DisasterOverlay, type ActiveDisaster } from '@/components/game/DisasterOverlay';
import { PlayerProfilePanel } from '@/components/game/panels/PlayerProfilePanel';
import { MarketplacePanel } from '@/components/game/panels/MarketplacePanel';
import { ReporterPanel } from '@/components/game/panels/ReporterPanel';
import { BankingPanel } from '@/components/game/panels/BankingPanel';
import { UserPanel } from '@/components/game/panels/UserPanel';
import { MusicPlayerWidget } from '@/components/game/panels/MusicPlayerWidget';
import { GrowthDebugPanel } from '@/components/game/panels/GrowthDebugPanel';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';
import { ChunkManager, CHUNK_SIZE } from '@/lib/chunkManager';

// Cargo type names for notifications
const CARGO_TYPE_NAMES = [msg('containers'), msg('bulk materials'), msg('oil')];

interface GameProps {
  onExit?: () => void;
  onBackToHome?: () => void;   // Zurück zur eigenen Gemeinde (bei Besuch/Public Room)
  onSessionInvalid?: (reason: string) => void;
  isViewOnly?: boolean;        // Kann Steuern/Budget nicht ändern (für Mitglieder)
  isFullyViewOnly?: boolean;   // Kann gar nichts tun (für Nicht-Mitglieder/Besucher)
  disablePartnerships?: boolean;
  isOwner?: boolean;           // Ist der Benutzer der Eigentümer der Gemeinde
  canUseDebug?: boolean;       // Nur globaler Admin Rank 7 darf Debug sehen
  ownerName?: string;
  municipalityName?: string;
  memberCount?: number;
  administrators?: Array<{ id: number; nickname: string }>;
  coatOfArms?: { svg: string | null; image_url: string | null } | null;
  onVisitMunicipality?: (slug: string, roomCode?: string, roomName?: string) => void;
  cityNameOverride?: string;
}

async function convertSvgToPngDataUrl(svg: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('SVG-Konvertierung ist nur im Browser verfügbar');
  }
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('SVG konnte nicht geladen werden'));
      image.src = objectUrl;
    });

    const width = img.naturalWidth || 256;
    const height = img.naturalHeight || 320;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas-Kontext nicht verfügbar');
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Game({ onExit, onBackToHome, onSessionInvalid, isViewOnly = false, isFullyViewOnly = false, disablePartnerships = false, isOwner = true, canUseDebug = false, ownerName, municipalityName, memberCount, administrators, coatOfArms, onVisitMunicipality, cityNameOverride }: GameProps) {
  const gt = useGT();
  const m = useMessages();
  const { state, setTool, setActivePanel, addMoney, addNotification, setSpeed, municipalitySlug, loadPartnershipsFromApi, applyGridPatch, isStateReady } = useGame();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const isInitialMount = useRef(true);
  const taxRateSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedTaxRateRef = useRef<number | null>(null);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDisasterId, setSelectedDisasterId] = useState<string | null>(null);
  const disastersRef = useRef<ActiveDisaster[]>([]);
  const mansionPartiesRef = useRef<import('@/components/game/types').MansionParty[]>([]);
  const [mansionParties, setMansionParties] = useState<import('@/components/game/types').MansionParty[]>([]);
  const [earthquakeShakeLevel, setEarthquakeShakeLevel] = useState(0);
  const [firestormWaveLevel, setFirestormWaveLevel] = useState(0);
  const [meteorTargetMode, setMeteorTargetMode] = useState<{ enabled: boolean; intensity: number }>({ enabled: false, intensity: 4 });
  const [meteorImpactState, setMeteorImpactState] = useState<{ active: boolean; intensity: number; x: number; y: number; radius: number }>({
    active: false,
    intensity: 0,
    x: 50,
    y: 50,
    radius: 3,
  });
  const [clientCoatOfArms, setClientCoatOfArms] = useState<{ svg: string | null; image_url: string | null } | null>(coatOfArms ?? null);
  const multiplayer = useMultiplayerOptional();
  const CORE_API_BASE_URL =
    process.env.NEXT_PUBLIC_CORE_API_URL ||
    process.env.NEXT_PUBLIC_AUTH_API_URL ||
    'http://127.0.0.1:4100';
  const API_GAME_BASE = CORE_API_BASE_URL.replace(/\/+$/, '').endsWith('/api/game')
    ? CORE_API_BASE_URL.replace(/\/+$/, '')
    : `${CORE_API_BASE_URL.replace(/\/+$/, '')}/api/game`;

  // Chunk Manager: lädt nur sichtbare Bereiche der Map vom Server
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const lastGridSizeRef = useRef(0);

  // ChunkManager einmalig initialisieren sobald gridSize bekannt
  const gridSize = state?.gridSize ?? 0;
  const chunkMunicipalitySlug = multiplayer?.municipalitySlug ?? municipalitySlug ?? '';
  const chunkRoomCode = multiplayer?.roomCode ?? '';

  if (gridSize > 0 && chunkMunicipalitySlug && chunkRoomCode) {
    if (lastGridSizeRef.current !== gridSize) {
      // Grid-Größe hat sich geändert → ChunkManager zurücksetzen
      chunkManagerRef.current = null;
      lastGridSizeRef.current = gridSize;
    }
    if (!chunkManagerRef.current) {
      const slug = chunkMunicipalitySlug;
      const rc = chunkRoomCode;
      chunkManagerRef.current = new ChunkManager({
        gridSize,
        chunkSize: CHUNK_SIZE,
        fetchChunk: async (cx: number, cy: number) => {
          const token = typeof window !== 'undefined' ? window.localStorage?.getItem('isocity_auth_token') : null;
          const url = `${API_GAME_BASE}/municipality/${slug}/items/${rc}?cx=${cx}&cy=${cy}&chunk_size=${CHUNK_SIZE}`;
          const res = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              ...(token ? { 'X-Game-Token': token } : {}),
            },
          });
          if (!res.ok) return [];
          const json = await res.json();
          return json.data?.items ?? [];
        },
        onChunkLoaded: (items) => {
          applyGridPatch(items);
        },
      });
      // Kein markAllLoaded() mehr — Chunks werden lazy per Viewport geladen
    }
  }
  
  // Cheat code system
  const {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  } = useCheatCodes();

  // Messenger State
  const [showMessenger, setShowMessenger] = useState(false);
  const [messengerUnreadCount, setMessengerUnreadCount] = useState(0);

  useEffect(() => {
    const onUnread = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setMessengerUnreadCount(prev => prev + (data?.count || 1));
    };
    window.addEventListener('messenger-has-unread', onUnread);
    return () => window.removeEventListener('messenger-has-unread', onUnread);
  }, []);

  useEffect(() => {
    if (showMessenger) setMessengerUnreadCount(0);
  }, [showMessenger]);

  const toggleMessenger = useCallback(() => setShowMessenger(v => !v), []);

  // Profile State
  const [profileUserId, setProfileUserId] = useState<number | 'me' | null>(null);

  // Residences
  const effectiveMunicipalitySlug = multiplayer?.municipalitySlug ?? municipalitySlug ?? null;
  const { residences, reload: reloadResidences } = useResidences(effectiveMunicipalitySlug);

  useEffect(() => {
    const onUpdated = () => reloadResidences();
    window.addEventListener('player-residences-updated', onUpdated);
    return () => window.removeEventListener('player-residences-updated', onUpdated);
  }, [reloadResidences]);

  // Party-State: empfange Updates vom Server (via deltaSync → window event)
  useEffect(() => {
    const onPartyUpdate = (e: Event) => {
      const parties = (e as CustomEvent<{ parties: import('@/components/game/types').MansionParty[] }>).detail?.parties ?? [];
      const wasEmpty = mansionPartiesRef.current.length === 0;
      mansionPartiesRef.current = parties;
      setMansionParties(parties);
      // Beim ersten Empfang (Room-Join mit aktiver Party): geparkte Autos vorspawnen
      if (wasEmpty && parties.length > 0) {
        window.dispatchEvent(new CustomEvent('party-spawn-parked-cars', { detail: { parties } }));
      }
    };
    const onPartyWarning = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;

      // Polizei-Auto für alle Spieler im Room zum Party-Haus schicken
      if (typeof data.tileX === 'number' && typeof data.tileY === 'number') {
        window.dispatchEvent(new CustomEvent('isocity-dispatch-emergency', {
          detail: { type: 'police_car', targetX: data.tileX, targetY: data.tileY },
        }));
      }

      // Toast + Busse nur dem Party-Besitzer anzeigen
      const myUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id')) : 0;
      if (data.ownerUserId !== myUserId) return;
      let msg: string;
      if (data.shutdownReason === 'no_money') {
        msg = `🚔 Party aufgelöst! Zu wenig Geld auf dem Konto`;
      } else if (data.isShutdown) {
        msg = `🚔 Party aufgelöst! CHF ${data.fineAmount} Busse abgezogen`;
      } else {
        msg = `🚔 Polizei-Warnung ${data.warningNumber}/3 — CHF ${data.fineAmount} Busse abgezogen`;
      }
      window.dispatchEvent(new CustomEvent('isocity-toast', { detail: { message: msg, type: data.isShutdown ? 'error' : 'warning' } }));
    };
    window.addEventListener('party-authoritative', onPartyUpdate);
    window.addEventListener('party-police-warning', onPartyWarning);
    return () => {
      window.removeEventListener('party-authoritative', onPartyUpdate);
      window.removeEventListener('party-police-warning', onPartyWarning);
    };
  }, []);

  useEffect(() => {
    const onOpenProfile = (e: Event) => {
      const userId = (e as CustomEvent).detail?.userId;
      if (userId) setProfileUserId(Number(userId));
    };
    window.addEventListener('open-player-profile', onOpenProfile);
    return () => window.removeEventListener('open-player-profile', onOpenProfile);
  }, []);

  useEffect(() => {
    setClientCoatOfArms(coatOfArms ?? null);
  }, [coatOfArms]);

  const handleSaveCoatOfArms = useCallback(async (svg: string | null) => {
    if (!municipalitySlug) {
      addNotification('Wappen', 'Gemeinde-Slug fehlt. Speichern nicht möglich.', 'default');
      return;
    }
    const authToken = getAuthToken();
    if (!authToken) {
      addNotification('Wappen', 'Nicht eingeloggt. Bitte neu anmelden.', 'default');
      return;
    }

    try {
      if (!svg) {
        const resetResponse = await fetch(
          `${CORE_API_BASE_URL}/api/game/municipality/${municipalitySlug}/coat-of-arms`,
          {
            method: 'DELETE',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        const resetJson = await resetResponse.json().catch(() => ({}));
        if (!resetResponse.ok || resetJson?.success !== true) {
          throw new Error(resetJson?.error || `HTTP ${resetResponse.status}`);
        }
        const nextCoat = resetJson?.data?.coat_of_arms || { svg: null, image_url: null };
        setClientCoatOfArms(nextCoat);
        addNotification('Wappen zurückgesetzt', 'Server-Wappen wurde entfernt.', 'shield');
        return;
      }

      const pngDataUrl = await convertSvgToPngDataUrl(svg);
      const response = await fetch(
        `${CORE_API_BASE_URL}/api/game/municipality/${municipalitySlug}/coat-of-arms`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ png_data_url: pngDataUrl }),
        }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success !== true) {
        throw new Error(json?.error || `HTTP ${response.status}`);
      }
      const nextCoat = json?.data?.coat_of_arms || { svg: null, image_url: null };
      setClientCoatOfArms(nextCoat);
      addNotification('Wappen gespeichert', 'Wappen wurde als PNG im Core-Server gespeichert.', 'shield');
    } catch (err) {
      addNotification(
        'Wappen speichern fehlgeschlagen',
        err instanceof Error ? err.message : 'Unbekannter Fehler',
        'default'
      );
    }
  }, [municipalitySlug, CORE_API_BASE_URL, addNotification]);
  

  // Load server-driven item details once (e.g. build_time_seconds for large projects)
  // ── Duplikat-Login: User wurde von anderem Tab/Client disconnected ──
  useEffect(() => {
    const onForceDisconnect = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const reason = detail?.reason || 'Du wurdest abgemeldet, da du dich an einem anderen Ort eingeloggt hast.';
      addNotification('Verbindung', reason, 'default');
      // Optional: nach kurzer Verzögerung zum Login weiterleiten
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 3000);
    };
    window.addEventListener('force-disconnect', onForceDisconnect);
    return () => window.removeEventListener('force-disconnect', onForceDisconnect);
  }, [addNotification]);


  useEffect(() => {
    let cancelled = false;
    fetch(`${CORE_API_BASE_URL}/api/game/item-details`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (cancelled || !json || !Array.isArray(json.items)) return;
        setServerItemDetails(json.items);
      })
      .catch(() => {
        // Optional override, keep default simulation speeds on failure
      });
    return () => {
      cancelled = true;
    };
  }, [CORE_API_BASE_URL]);
  
  // Multiplayer sync
  const {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    connectionState,
    players,
    broadcastPlace,
    leaveRoom,
  } = useMultiplayerSync();

  const normalizePlayerName = useCallback((value: string | undefined | null) => {
    return (value ?? '').trim().toLowerCase();
  }, []);

  const ownerNameKey = useMemo(() => normalizePlayerName(ownerName), [normalizePlayerName, ownerName]);
  const administratorNameKeys = useMemo(() => {
    return new Set(
      (administrators ?? [])
        .map((admin) => normalizePlayerName(admin.nickname))
        .filter((entry) => entry.length > 0)
    );
  }, [administrators, normalizePlayerName]);

  const getPlayerRoleBadge = useCallback((playerName: string) => {
    const key = normalizePlayerName(playerName);
    if (key && ownerNameKey && key === ownerNameKey) {
      return {
        label: 'Eigentuemer',
        className: 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
      };
    }
    if (key && administratorNameKeys.has(key)) {
      return {
        label: 'Verwaltung',
        className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
      };
    }
    return {
      label: 'Mitglied',
      className: 'bg-slate-700/40 text-slate-300 border border-slate-500/35',
    };
  }, [administratorNameKeys, normalizePlayerName, ownerNameKey]);

  const sessionInvalidTriggeredRef = useRef(false);
  const offlineSinceRef = useRef<number | null>(null);
  const wsOfflineSinceRef = useRef<number | null>(null);
  const wsOfflineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsOfflineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsOfflineFlowRunningRef = useRef(false);
  const wsOfflineGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockBaselineOffsetRef = useRef<number | null>(null);
  const wallClockRef = useRef<number>(Date.now());
  const monotonicRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const [wsOfflineUi, setWsOfflineUi] = useState<{
    visible: boolean;
    secondsRemaining: number;
    reloadAttempted: boolean;
    reason: string;
  }>({
    visible: false,
    secondsRemaining: 0,
    reloadAttempted: false,
    reason: '',
  });
  const [debugAccessFromAuth, setDebugAccessFromAuth] = useState(false);
  const isDev = process.env.NODE_ENV !== 'production';
  const effectiveCanUseAdmin = canUseDebug || debugAccessFromAuth;
  const effectiveCanUseDebug = isDev && effectiveCanUseAdmin;
  const [debugWeatherOverride, setDebugWeatherOverride] = useState<PixiWeatherType | null>(null);

  const handleSessionInvalid = useCallback((reason: string) => {
    if (sessionInvalidTriggeredRef.current) return;
    sessionInvalidTriggeredRef.current = true;
    try {
      localStorage.removeItem('isocity_auth_token');
      localStorage.removeItem('isocity_user_rank');
      localStorage.removeItem('isocity_global_role');
      localStorage.removeItem('isocity_municipality');
    } catch {
      // ignore storage errors
    }
    setAuthToken(null);
    if (onSessionInvalid) {
      onSessionInvalid(reason);
      return;
    }
    onExit?.();
  }, [onExit, onSessionInvalid]);

  // ── Force-Logout: Neuer Login auf anderem Gerät ──
  useEffect(() => {
    const onForceLogout = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const reason = detail?.reason || 'Du wurdest abgemeldet, da du dich auf einem anderen Gerät eingeloggt hast.';
      handleSessionInvalid(reason);
    };
    window.addEventListener('force-logout', onForceLogout);
    return () => window.removeEventListener('force-logout', onForceLogout);
  }, [handleSessionInvalid]);

  useEffect(() => {
    const token = getAuthToken() || (typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null);
    if (!token) return;
    let cancelled = false;
    fetch(`${CORE_API_BASE_URL}/api/auth/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((json) => {
        if (cancelled || !json?.user) return;
        const rank = Number(json.user.user_rank || 0);
        const globalRole = String(json.user.global_role || '').toLowerCase();
        setDebugAccessFromAuth((Number.isFinite(rank) && rank >= 7) || globalRole === 'administrator');
      })
      .catch(() => {
        // Debug fallback bleibt bei den bereits bekannten Berechtigungen.
      });
    return () => {
      cancelled = true;
    };
  }, [CORE_API_BASE_URL]);

  const goToMainMenu = useCallback(() => {
    try {
      leaveRoom();
    } catch {
      // ignore
    }
    if (onExit) {
      onExit();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [leaveRoom, onExit]);

  const handleLogout = useCallback(async () => {
    const token = getAuthToken() || (typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null);
    try {
      if (token) {
        await fetch(`${CORE_API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Logout soll lokal trotzdem abgeschlossen werden.
    }

    try {
      leaveRoom();
    } catch {
      // ignore
    }

    try {
      localStorage.removeItem('isocity_auth_token');
      localStorage.removeItem('isocity_user_name');
      localStorage.removeItem('isocity_user_rank');
      localStorage.removeItem('isocity_global_role');
      localStorage.removeItem('isocity_municipality');
      localStorage.removeItem('isocity_user_id');
    } catch {
      // ignore storage errors
    }
    setAuthToken(null);

    if (onExit) {
      onExit();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [CORE_API_BASE_URL, leaveRoom, onExit]);

  const { time: serverTime, isConnected: isServerTimeConnected } = useServerTime({
    enabled: !!roomCode,
    municipalitySlug: multiplayer?.municipalitySlug,
  });

  const serverWeather = serverTime?.weather ?? null;

  // Security guard: wenn Server längere Zeit offline ist -> Session beenden
  useEffect(() => {
    if (!roomCode) return;
    if (isServerTimeConnected) {
      offlineSinceRef.current = null;
      return;
    }
    const now = Date.now();
    if (!offlineSinceRef.current) {
      offlineSinceRef.current = now;
      return;
    }
    if (now - offlineSinceRef.current > 45000) {
      handleSessionInvalid('Server nicht erreichbar');
    }
  }, [roomCode, isServerTimeConnected, handleSessionInvalid]);

  // WebSocket-Offline-Flow:
  // 1) Offline-Hinweis anzeigen
  // 2) Einmal automatisch reloaden
  // 3) Wenn weiterhin offline: zurück ins Hauptmenü
  useEffect(() => {
    const RELOAD_FLAG_KEY = 'isocity_ws_reload_attempted';
    const clearOfflineTimers = () => {
      if (wsOfflineTimeoutRef.current) {
        clearTimeout(wsOfflineTimeoutRef.current);
        wsOfflineTimeoutRef.current = null;
      }
      if (wsOfflineIntervalRef.current) {
        clearInterval(wsOfflineIntervalRef.current);
        wsOfflineIntervalRef.current = null;
      }
    };

    if (!roomCode) {
      clearOfflineTimers();
      wsOfflineSinceRef.current = null;
      wsOfflineFlowRunningRef.current = false;
      setWsOfflineUi((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    if (connectionState === 'connected' || connectionState === 'connecting') {
      clearOfflineTimers();
      // Grace-Timer abbrechen falls kurzer Reconnect innerhalb von 3s
      if (wsOfflineGraceTimerRef.current) {
        clearTimeout(wsOfflineGraceTimerRef.current);
        wsOfflineGraceTimerRef.current = null;
      }
      wsOfflineSinceRef.current = null;
      wsOfflineFlowRunningRef.current = false;
      setWsOfflineUi((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      try {
        sessionStorage.removeItem(RELOAD_FLAG_KEY);
      } catch {
        // ignore
      }
      return;
    }

    // Grace-Period: Overlay erst nach 3s zeigen, damit kurze Reconnects nicht aufblinken
    if (!wsOfflineSinceRef.current && !wsOfflineGraceTimerRef.current) {
      wsOfflineSinceRef.current = Date.now();
      wsOfflineGraceTimerRef.current = setTimeout(() => {
        wsOfflineGraceTimerRef.current = null;
        const alreadyReloaded =
          typeof window !== 'undefined' &&
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem(RELOAD_FLAG_KEY) === '1';
        const seconds = alreadyReloaded ? 5 : 8;
        setWsOfflineUi({
          visible: true,
          secondsRemaining: seconds,
          reloadAttempted: alreadyReloaded,
          reason: connectionState === 'error' ? 'Verbindungsfehler' : 'WebSocket getrennt',
        });
        addNotification(
          'Server offline',
          alreadyReloaded
            ? 'Server weiterhin nicht erreichbar. Rückkehr ins Hauptmenü wird vorbereitet.'
            : 'Verbindung unterbrochen. Seite wird automatisch neu geladen.',
          'default'
        );
      }, 3000);
    }

    if (wsOfflineFlowRunningRef.current) return;
    wsOfflineFlowRunningRef.current = true;

    const alreadyReloaded =
      typeof window !== 'undefined' &&
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(RELOAD_FLAG_KEY) === '1';
    const timeoutMs = (alreadyReloaded ? 5 : 8) * 1000;
    const startedAt = Date.now();

    clearOfflineTimers();
    wsOfflineIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
      setWsOfflineUi((prev) => ({
        ...prev,
        visible: true,
        secondsRemaining: remaining,
        reloadAttempted: alreadyReloaded,
      }));
    }, 250);

    wsOfflineTimeoutRef.current = setTimeout(() => {
      clearOfflineTimers();
      if (typeof window !== 'undefined') {
        if (!alreadyReloaded) {
          try {
            sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
          } catch {
            // ignore
          }
          window.location.reload();
          return;
        }
        try {
          sessionStorage.removeItem(RELOAD_FLAG_KEY);
        } catch {
          // ignore
        }
      }
      addNotification('Server offline', 'Server weiterhin nicht erreichbar. Zurück zum Hauptmenü.', 'default');
      goToMainMenu();
    }, timeoutMs);

    return () => {
      clearOfflineTimers();
      wsOfflineFlowRunningRef.current = false;
    };
  }, [roomCode, connectionState, addNotification, goToMainMenu]);

  const wsOfflineOverlay = wsOfflineUi.visible ? (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div className="rounded-lg border border-rose-700/40 bg-slate-900/95 px-5 py-4 text-center shadow-xl max-w-md">
        <div className="text-sm font-semibold text-rose-200">Server offline</div>
        <div className="mt-1 text-xs text-slate-300">
          {wsOfflineUi.reason || 'Verbindung zum WebSocket-Server getrennt.'}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {wsOfflineUi.reloadAttempted
            ? `Rückkehr ins Hauptmenü in ${wsOfflineUi.secondsRemaining}s ...`
            : `Automatischer Reload in ${wsOfflineUi.secondsRemaining}s ...`}
        </div>
      </div>
    </div>
  ) : null;

  // Security guard: wenn Client-Uhr stark manipuliert wird -> Session beenden
  useEffect(() => {
    if (!roomCode) return;
    const interval = setInterval(() => {
      const nowWall = Date.now();
      const nowMono = typeof performance !== 'undefined' ? performance.now() : nowWall;
      const deltaWall = nowWall - wallClockRef.current;
      const deltaMono = nowMono - monotonicRef.current;
      wallClockRef.current = nowWall;
      monotonicRef.current = nowMono;

      // Sprung zwischen wall-clock und monotonic clock deutet auf Uhr-Manipulation hin
      if (Math.abs(deltaWall - deltaMono) > 15000) {
        handleSessionInvalid('Zeitmanipulation erkannt');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [roomCode, handleSessionInvalid]);

  // Security guard: Serverzeit-Offset darf nicht abrupt springen
  useEffect(() => {
    if (!roomCode || !serverTime?.serverTimestamp) return;
    const offset = Date.now() - Number(serverTime.serverTimestamp);
    if (clockBaselineOffsetRef.current === null) {
      clockBaselineOffsetRef.current = offset;
      return;
    }
    if (Math.abs(offset - clockBaselineOffsetRef.current) > 20000) {
      handleSessionInvalid('Serverzeit-Integritaet verletzt');
      return;
    }
    // Baseline sanft nachziehen, damit kleine Netzwerklatenz nicht triggert
    clockBaselineOffsetRef.current = Math.round((clockBaselineOffsetRef.current * 0.85) + (offset * 0.15));
  }, [roomCode, serverTime?.serverTimestamp, handleSessionInvalid]);
  
  // Bestimme ob dieser Client Stats senden soll:
  // 1. Besitzer/Admin sendet immer (hat Priorität)
  // 2. Wenn kein Besitzer/Admin online: der Spieler mit der kleinsten ID sendet (deterministisch)
  const playersWithLocal = players as Array<{ id: string; name: string; joinedAt?: number; isLocal?: boolean }>;
  const localPlayer = playersWithLocal.find(p => p.isLocal);
  
  // Sortiere nach ID (alphabetisch) - deterministisch, alle Clients bekommen das gleiche Ergebnis
  const sortedPlayersById = [...playersWithLocal].sort((a, b) => a.id.localeCompare(b.id));
  const isFirstPlayerById = sortedPlayersById.length > 0 && sortedPlayersById[0]?.id === localPlayer?.id;
  
  // Sende Stats wenn: Besitzer/Admin ODER (erster Spieler nach ID wenn kein Besitzer/Admin)
  const shouldSendStats = !isViewOnly || (isViewOnly && isFirstPlayerById);
  
  // Setze globale Flag für Sender-Rolle.
  // Anzeige bleibt trotzdem servergeführt (Remote-Stats-Override wird nicht gelöscht).
  useEffect(() => {
    const isSender = !!roomCode && shouldSendStats;
    setIsStatsSender(isSender);
    
    // Cleanup: Wenn unmounted, nicht mehr Sender
    return () => {
      setIsStatsSender(false);
    };
  }, [roomCode, isViewOnly, localPlayer?.id, playersWithLocal.length, isFirstPlayerById, shouldSendStats]);
  
  // Partnerschaften sofort laden wenn Game gemountet wird
  // Game wird erst nach Login + Multiplayer-Connect angezeigt -> Auth ist bereit
  useEffect(() => {
    if (disablePartnerships) return;
    if (!municipalitySlug) return;
    loadPartnershipsFromApi()
      .catch((err: unknown) => console.error('[Game] ❌ Partnerschaften laden fehlgeschlagen:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disablePartnerships, municipalitySlug, loadPartnershipsFromApi]);

  // Stats sync to server (saves game_stats to database)
  // Nur EIN Spieler sendet, um "Springen" zu vermeiden
  useStatsSync({
    enabled: !!roomCode && shouldSendStats,
    syncInterval: 1000, // Sync jede Sekunde für flüssige Darstellung
    municipalitySlug: multiplayer?.municipalitySlug,
    enableRealtimeSocketSync: false, // Realtime-Zahlen kommen vom Server über WS aus game_stats
  });

  // Construction sync: Meldet fertig gebaute Gebäude an die API
  useConstructionSync({
    enabled: !!roomCode,
    municipalitySlug: multiplayer?.municipalitySlug,
  });

  // Minimap auto-sync to server (saves PNG every 10 minutes)
  // Nur EIN Spieler speichert
  useMinimapSync({
    enabled: !!roomCode && shouldSendStats,
    intervalMinutes: 10,
    municipalitySlug: multiplayer?.municipalitySlug,
  });

  // Steuer-Regler serverseitig persistieren (autoritative Stats).
  useEffect(() => {
    // Steuerregler-Sync nur für Besitzer/Verwaltung (isViewOnly=false).
    if (!roomCode || !multiplayer?.municipalitySlug || isViewOnly || isFullyViewOnly) return;
    const currentTaxRate = Math.max(0, Math.min(100, Math.round(state.taxRate ?? 10)));
    if (lastSyncedTaxRateRef.current === currentTaxRate) return;

    if (taxRateSyncTimeoutRef.current) {
      clearTimeout(taxRateSyncTimeoutRef.current);
    }

    taxRateSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
        const response = await fetch(
          `${CORE_API_BASE_URL}/api/game/municipality/${multiplayer.municipalitySlug}/stats/${roomCode}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { 'X-Game-Token': token } : {}),
            },
            body: JSON.stringify({ taxRate: currentTaxRate }),
          }
        );
        if (response.ok) {
          lastSyncedTaxRateRef.current = currentTaxRate;
        }
      } catch {
        // Bei Netzwerkfehlern wird beim nächsten Regler-Event erneut versucht.
      }
    }, 180);

    return () => {
      if (taxRateSyncTimeoutRef.current) {
        clearTimeout(taxRateSyncTimeoutRef.current);
        taxRateSyncTimeoutRef.current = null;
      }
    };
  }, [CORE_API_BASE_URL, multiplayer?.municipalitySlug, roomCode, state.taxRate, isViewOnly, isFullyViewOnly]);
  
  const { copied: copiedRoomLink, handleCopyRoomLink } = useCopyRoomLink(roomCode, 'coop');
  
  // Chat-Benachrichtigungen (Ungelesen-Zähler + Sound)
  const { unreadCount: chatUnreadCount } = useChatNotifications({
    municipalitySlug: municipalitySlug ?? null,
    isChatOpen: state.activePanel === 'chat',
    isGuestMode: isFullyViewOnly,
    currentUserId: (state as unknown as { player?: { id: number } }).player?.id,
    pollInterval: 15000,
  });
  const initialSelectedToolRef = useRef<Tool | null>(null);
  const previousSelectedToolRef = useRef<Tool | null>(null);
  const hasCapturedInitialTool = useRef(false);
  const currentSelectedToolRef = useRef<Tool>(state.selectedTool);

  // In fremden Gemeinden immer mit Inspector starten.
  // Läuft auch nach isStateReady (nach localStorage-Load) und nach jedem Tool-Wechsel
  // (z.B. nach softLoadState der den gespeicherten selectedTool überschreibt).
  useEffect(() => {
    if (!isFullyViewOnly || !isStateReady) return;
    if (state.selectedTool !== 'inspect') {
      setTool('inspect');
    }
  }, [isFullyViewOnly, isStateReady, state.selectedTool, setTool]);
  
  // Keep currentSelectedToolRef in sync with state
  useEffect(() => {
    currentSelectedToolRef.current = state.selectedTool;
  }, [state.selectedTool]);

  useEffect(() => {
    if (!effectiveCanUseDebug && state.activePanel === 'debug') {
      setActivePanel('none');
    }
  }, [effectiveCanUseDebug, state.activePanel, setActivePanel]);

  // Besucher: member-only Panels blockieren (API-Fehler vermeiden)
  // Erlaubt: settings, leaderboard, statistics (oeffentliche Gemeinde-Daten)
  const visitorBlockedPanels = useMemo(() => new Set([
    'chat', 'firma', 'gemeinde', 'marketplace', 'reports',
    'banking', 'user', 'trade', 'advisors',
  ]), []);
  useEffect(() => {
    if (isFullyViewOnly && visitorBlockedPanels.has(state.activePanel)) {
      setActivePanel('none');
    }
  }, [isFullyViewOnly, state.activePanel, setActivePanel, visitorBlockedPanels]);
  
  // Track the initial selectedTool after localStorage loads (with a small delay to allow state to load)
  useEffect(() => {
    if (!hasCapturedInitialTool.current) {
      // Use a timeout to ensure localStorage state has loaded
      const timeoutId = setTimeout(() => {
        initialSelectedToolRef.current = currentSelectedToolRef.current;
        previousSelectedToolRef.current = currentSelectedToolRef.current;
        hasCapturedInitialTool.current = true;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run once on mount
  
  // Auto-set overlay when selecting utility tools (but not on initial page load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Select tool always resets overlay to none (user is explicitly switching to select)
    if (state.selectedTool === 'select') {
      setTimeout(() => {
        setOverlayMode('none');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Don't auto-set overlay until we've captured the initial tool
    if (!hasCapturedInitialTool.current) {
      return;
    }
    
    // Don't auto-set overlay if this matches the initial tool from localStorage
    if (initialSelectedToolRef.current !== null && 
        initialSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Don't auto-set overlay if tool hasn't changed
    if (previousSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Update previous tool reference
    previousSelectedToolRef.current = state.selectedTool;
    
    setTimeout(() => {
      const nextOverlay = getOverlayForTool(state.selectedTool);
      // Subway overlay should only be shown when the user activates it manually.
      if (nextOverlay === 'subway') {
        return;
      }
      setOverlayMode(nextOverlay);
    }, 0);
  }, [state.selectedTool]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (overlayMode !== 'none') {
          setOverlayMode('none');
        } else if (state.activePanel !== 'none') {
          setActivePanel('none');
        } else if (selectedTile) {
          setSelectedTile(null);
        } else if (state.selectedTool !== 'select') {
          setTool('select');
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      } else if (e.key === '+' && e.shiftKey) {
        // Shift++: Open Debug Panel (nur Rank 7 / Global Admin)
        if (!effectiveCanUseDebug) return;
        e.preventDefault();
        setActivePanel(state.activePanel === 'debug' ? 'none' : 'debug');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activePanel, state.selectedTool, state.speed, selectedTile, setActivePanel, setTool, setSpeed, overlayMode, effectiveCanUseDebug]);

  // Handle cheat code triggers
  useEffect(() => {
    if (!triggeredCheat) return;

    switch (triggeredCheat.type) {
      case 'konami':
        addMoney(triggeredCheat.amount);
        addNotification(
          gt('Retro Cheat Activated!'),
          gt('Your accountants are confused but not complaining. You received $50,000!'),
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'motherlode':
        addMoney(triggeredCheat.amount);
        addNotification(
          gt('Motherlode!'),
          gt('Your treasury just got a lot heavier. You received $1,000,000!'),
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'vinnie':
        // Vinnie dialog is handled by VinnieDialog component
        clearTriggeredCheat();
        break;
    }
  }, [triggeredCheat, addMoney, addNotification, clearTriggeredCheat]);
  
  // Track barge deliveries to show occasional notifications
  const bargeDeliveryCountRef = useRef(0);
  const earthquakeShakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firestormWaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteorImpactTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteorCastInFlightRef = useRef(false);
  const lastMeteorCastKeyRef = useRef<string>('');
  
  // Handle barge cargo delivery - adds money to the city treasury
  const handleBargeDelivery = useCallback((cargoValue: number, cargoType: number) => {
    addMoney(cargoValue);
    bargeDeliveryCountRef.current++;

    // Show a notification every 5 deliveries to avoid spam
    if (bargeDeliveryCountRef.current % 5 === 1) {
      const cargoName = CARGO_TYPE_NAMES[cargoType] || msg('cargo');
      addNotification(
        gt('Cargo Delivered'),
        gt('A shipment of {cargoName} has arrived at the marina. +${cargoValue} trade revenue.', { cargoName: m(cargoName), cargoValue }),
        'ship'
      );
    }
  }, [addMoney, addNotification, gt, m]);

  useEffect(() => {
    const onEarthquakeShake = (event: Event) => {
      const custom = event as CustomEvent<{ intensity?: number }>;
      const raw = Number(custom?.detail?.intensity);
      const intensity = Number.isFinite(raw) ? Math.max(1, Math.min(5, Math.round(raw))) : 3;
      setEarthquakeShakeLevel(intensity);

      if (earthquakeShakeTimeoutRef.current) {
        clearTimeout(earthquakeShakeTimeoutRef.current);
      }
      const durationMs = 520 + intensity * 120;
      earthquakeShakeTimeoutRef.current = setTimeout(() => {
        setEarthquakeShakeLevel(0);
        earthquakeShakeTimeoutRef.current = null;
      }, durationMs);
    };

    const onFirestormWave = (event: Event) => {
      const custom = event as CustomEvent<{ intensity?: number }>;
      const raw = Number(custom?.detail?.intensity);
      const intensity = Number.isFinite(raw) ? Math.max(1, Math.min(5, Math.round(raw))) : 4;
      setFirestormWaveLevel(intensity);

      if (firestormWaveTimeoutRef.current) {
        clearTimeout(firestormWaveTimeoutRef.current);
      }
      const durationMs = 1350 + intensity * 260;
      firestormWaveTimeoutRef.current = setTimeout(() => {
        setFirestormWaveLevel(0);
        firestormWaveTimeoutRef.current = null;
      }, durationMs);
    };

    const onMeteorImpact = (event: Event) => {
      const custom = event as CustomEvent<{ intensity?: number; impactX?: number | null; impactY?: number | null; impactRadius?: number | null }>;
      const rawIntensity = Number(custom?.detail?.intensity);
      const intensity = Number.isFinite(rawIntensity) ? Math.max(1, Math.min(5, Math.round(rawIntensity))) : 4;
      const rawImpactX = Number(custom?.detail?.impactX);
      const rawImpactY = Number(custom?.detail?.impactY);
      const rawImpactRadius = Number(custom?.detail?.impactRadius);
      const gridSize = Math.max(1, Math.round(Number(state.gridSize || 50)));
      const impactXPercent = Number.isFinite(rawImpactX)
        ? Math.max(8, Math.min(92, (rawImpactX / Math.max(1, gridSize - 1)) * 100))
        : 50;
      const impactYPercent = Number.isFinite(rawImpactY)
        ? Math.max(10, Math.min(90, (rawImpactY / Math.max(1, gridSize - 1)) * 100))
        : 55;
      const impactRadius = Number.isFinite(rawImpactRadius) ? Math.max(1, Math.min(9, Math.round(rawImpactRadius))) : 4;

      setMeteorImpactState({
        active: true,
        intensity,
        x: impactXPercent,
        y: impactYPercent,
        radius: impactRadius,
      });

      if (meteorImpactTimeoutRef.current) {
        clearTimeout(meteorImpactTimeoutRef.current);
      }
      const durationMs = 9000;
      meteorImpactTimeoutRef.current = setTimeout(() => {
        setMeteorImpactState((prev) => ({ ...prev, active: false }));
        meteorImpactTimeoutRef.current = null;
      }, durationMs);
    };
    const onMeteorTargetMode = (event: Event) => {
      const custom = event as CustomEvent<{ enabled?: boolean; intensity?: number }>;
      const enabled = Boolean(custom?.detail?.enabled);
      const rawIntensity = Number(custom?.detail?.intensity);
      const intensity = Number.isFinite(rawIntensity) ? Math.max(1, Math.min(5, Math.round(rawIntensity))) : 4;
      setMeteorTargetMode({ enabled, intensity });
      if (enabled) {
        setSelectedTile(null);
        lastMeteorCastKeyRef.current = '';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('isocity-earthquake-shake', onEarthquakeShake as EventListener);
      window.addEventListener('isocity-firestorm-wave', onFirestormWave as EventListener);
      window.addEventListener('isocity-meteor-impact', onMeteorImpact as EventListener);
      window.addEventListener('isocity-meteor-target-mode', onMeteorTargetMode as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('isocity-earthquake-shake', onEarthquakeShake as EventListener);
        window.removeEventListener('isocity-firestorm-wave', onFirestormWave as EventListener);
        window.removeEventListener('isocity-meteor-impact', onMeteorImpact as EventListener);
        window.removeEventListener('isocity-meteor-target-mode', onMeteorTargetMode as EventListener);
      }
      if (earthquakeShakeTimeoutRef.current) {
        clearTimeout(earthquakeShakeTimeoutRef.current);
        earthquakeShakeTimeoutRef.current = null;
      }
      if (firestormWaveTimeoutRef.current) {
        clearTimeout(firestormWaveTimeoutRef.current);
        firestormWaveTimeoutRef.current = null;
      }
      if (meteorImpactTimeoutRef.current) {
        clearTimeout(meteorImpactTimeoutRef.current);
        meteorImpactTimeoutRef.current = null;
      }
    };
  }, [state.gridSize]);

  const castMeteorAtTile = useCallback(async (x: number, y: number, intensity: number) => {
    if (meteorCastInFlightRef.current) return;
    meteorCastInFlightRef.current = true;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
      if (!token) {
        addNotification('Meteor', 'Kein Auth-Token gefunden', 'default');
        return;
      }
      const slug = multiplayer?.municipalitySlug || municipalitySlug || 'default';
      const roomCode = multiplayer?.roomCode || 'MAIN';
      const response = await fetch(`${CORE_API_BASE_URL}/api/game/municipality/${slug}/disasters/${roomCode}/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Game-Token': token,
        },
        body: JSON.stringify({
          type: 'meteor',
          intensity,
          target_x: x,
          target_y: y,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) {
        addNotification('Meteor fehlgeschlagen', String(json?.error || `HTTP ${response.status}`), 'default');
      }
    } catch (err) {
      addNotification('Meteor fehlgeschlagen', err instanceof Error ? err.message : 'Netzwerk-Fehler', 'default');
    } finally {
      meteorCastInFlightRef.current = false;
    }
  }, [CORE_API_BASE_URL, addNotification, municipalitySlug, multiplayer?.municipalitySlug, multiplayer?.roomCode]);

  useEffect(() => {
    if (!meteorTargetMode.enabled) return;
    if (!selectedTile) return;
    const key = `${selectedTile.x},${selectedTile.y}`;
    if (lastMeteorCastKeyRef.current === key) return;
    lastMeteorCastKeyRef.current = key;
    void castMeteorAtTile(selectedTile.x, selectedTile.y, meteorTargetMode.intensity);
  }, [meteorTargetMode.enabled, meteorTargetMode.intensity, selectedTile, castMeteorAtTile]);

  const earthquakeShakeClass = earthquakeShakeLevel > 0 ? 'isocity-earthquake-shake' : '';
  const earthquakeShakeStyle: React.CSSProperties | undefined = earthquakeShakeLevel > 0
    ? ({ ['--eq-shake-intensity' as string]: `${2 + earthquakeShakeLevel * 1.7}px` } as React.CSSProperties)
    : undefined;
  const earthquakeShakeCss = `
    @keyframes isocity-earthquake-shake {
      0% { transform: translate3d(0, 0, 0) rotate(0deg); }
      10% { transform: translate3d(calc(var(--eq-shake-intensity) * -1), calc(var(--eq-shake-intensity) * 0.8), 0) rotate(-0.35deg); }
      20% { transform: translate3d(calc(var(--eq-shake-intensity) * 0.9), calc(var(--eq-shake-intensity) * -0.7), 0) rotate(0.35deg); }
      30% { transform: translate3d(calc(var(--eq-shake-intensity) * -0.8), calc(var(--eq-shake-intensity) * -0.4), 0) rotate(-0.25deg); }
      40% { transform: translate3d(calc(var(--eq-shake-intensity) * 0.8), calc(var(--eq-shake-intensity) * 0.7), 0) rotate(0.3deg); }
      50% { transform: translate3d(calc(var(--eq-shake-intensity) * -0.6), calc(var(--eq-shake-intensity) * 0.5), 0) rotate(-0.2deg); }
      60% { transform: translate3d(calc(var(--eq-shake-intensity) * 0.6), calc(var(--eq-shake-intensity) * -0.6), 0) rotate(0.2deg); }
      70% { transform: translate3d(calc(var(--eq-shake-intensity) * -0.45), calc(var(--eq-shake-intensity) * -0.35), 0) rotate(-0.15deg); }
      80% { transform: translate3d(calc(var(--eq-shake-intensity) * 0.4), calc(var(--eq-shake-intensity) * 0.3), 0) rotate(0.12deg); }
      90% { transform: translate3d(calc(var(--eq-shake-intensity) * -0.2), calc(var(--eq-shake-intensity) * 0.1), 0) rotate(-0.05deg); }
      100% { transform: translate3d(0, 0, 0) rotate(0deg); }
    }
    .isocity-earthquake-shake {
      animation: isocity-earthquake-shake 110ms linear 7;
      will-change: transform;
      transform-origin: center center;
    }
    @keyframes isocity-firestorm-sweep {
      0% { transform: translate3d(-130%, 0, 0) skewX(-12deg); opacity: 0; }
      10% { opacity: 0.2; }
      35% { opacity: 0.55; }
      60% { opacity: 0.5; }
      100% { transform: translate3d(130%, 0, 0) skewX(-12deg); opacity: 0; }
    }
    @keyframes isocity-firestorm-flicker {
      0%, 100% { opacity: 0.2; }
      30% { opacity: 0.5; }
      50% { opacity: 0.35; }
      75% { opacity: 0.6; }
    }
    .isocity-firestorm-overlay {
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 96;
      overflow: hidden;
    }
    .isocity-firestorm-overlay::before,
    .isocity-firestorm-overlay::after {
      content: '';
      position: absolute;
      top: -25%;
      left: 0;
      width: 55%;
      height: 150%;
      background: linear-gradient(
        90deg,
        rgba(255, 80, 0, 0) 0%,
        rgba(255, 90, 0, 0.45) 25%,
        rgba(255, 170, 0, 0.8) 50%,
        rgba(255, 60, 0, 0.55) 72%,
        rgba(255, 80, 0, 0) 100%
      );
      mix-blend-mode: screen;
      filter: blur(6px);
      animation: isocity-firestorm-sweep 1450ms cubic-bezier(0.17, 0.84, 0.44, 1) forwards;
    }
    .isocity-firestorm-overlay::after {
      animation-delay: 180ms;
      opacity: 0.75;
      filter: blur(10px);
      background: linear-gradient(
        90deg,
        rgba(255, 130, 0, 0) 0%,
        rgba(255, 140, 0, 0.35) 22%,
        rgba(255, 200, 80, 0.65) 48%,
        rgba(255, 90, 0, 0.45) 74%,
        rgba(255, 130, 0, 0) 100%
      );
    }
    .isocity-firestorm-heat {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at center, rgba(255, 120, 0, 0.18) 0%, rgba(255, 120, 0, 0.08) 35%, rgba(0, 0, 0, 0) 70%),
        radial-gradient(ellipse at 20% 80%, rgba(255, 80, 0, 0.2) 0%, rgba(0, 0, 0, 0) 60%),
        radial-gradient(ellipse at 80% 20%, rgba(255, 170, 0, 0.15) 0%, rgba(0, 0, 0, 0) 60%);
      animation: isocity-firestorm-flicker 320ms ease-in-out infinite;
    }
    @keyframes isocity-meteor-fall {
      0% {
        left: -18%;
        top: -28%;
        opacity: 0;
        transform: scale(0.7) rotate(-18deg);
      }
      8% { opacity: 1; }
      70% { opacity: 1; }
      100% {
        left: var(--meteor-impact-x);
        top: var(--meteor-impact-y);
        opacity: 0;
        transform: scale(1.05) rotate(-18deg);
      }
    }
    @keyframes isocity-meteor-blast {
      0% { transform: translate(-50%, -50%) scale(0.15); opacity: 0; }
      18% { opacity: 0.95; }
      100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
    }
    @keyframes isocity-meteor-crater-flash {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
      8% { opacity: 0.78; }
      70% { opacity: 0.62; }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
    }
    .isocity-meteor-overlay {
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 97;
      overflow: hidden;
    }
    .isocity-meteor-object {
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: radial-gradient(circle at 35% 35%, #fff7d6 0%, #ffcf66 24%, #ff8c00 58%, #a83200 100%);
      box-shadow:
        0 0 16px rgba(255, 183, 77, 0.9),
        -12px -8px 22px rgba(255, 94, 0, 0.65),
        -26px -14px 42px rgba(255, 72, 0, 0.35);
      animation: isocity-meteor-fall 720ms cubic-bezier(0.15, 0.82, 0.34, 1) forwards;
    }
    .isocity-meteor-blast {
      position: absolute;
      left: var(--meteor-impact-x);
      top: var(--meteor-impact-y);
      width: var(--meteor-blast-size);
      height: var(--meteor-blast-size);
      border-radius: 999px;
      background:
        radial-gradient(circle, rgba(255, 245, 220, 0.95) 0%, rgba(255, 196, 79, 0.8) 28%, rgba(255, 103, 0, 0.45) 60%, rgba(255, 70, 0, 0) 100%);
      mix-blend-mode: screen;
      animation: isocity-meteor-blast 860ms ease-out forwards;
    }
    .isocity-meteor-crater {
      position: absolute;
      left: var(--meteor-impact-x);
      top: var(--meteor-impact-y);
      width: var(--meteor-crater-size);
      height: var(--meteor-crater-size);
      border-radius: 999px;
      background:
        radial-gradient(circle at 50% 50%, rgba(27, 20, 16, 0.9) 0%, rgba(30, 18, 10, 0.82) 35%, rgba(50, 28, 14, 0.35) 65%, rgba(0, 0, 0, 0) 100%);
      box-shadow:
        0 0 0 2px rgba(255, 120, 40, 0.22),
        0 0 22px rgba(255, 98, 0, 0.28);
      animation: isocity-meteor-crater-flash 9000ms linear forwards;
    }
  `;
  const firestormOverlay = firestormWaveLevel > 0 ? (
    <div className="isocity-firestorm-overlay">
      <div className="isocity-firestorm-heat" />
    </div>
  ) : null;
  const meteorOverlay = meteorImpactState.active ? (
    <div
      className="isocity-meteor-overlay"
      style={
        {
          ['--meteor-impact-x' as string]: `${meteorImpactState.x}%`,
          ['--meteor-impact-y' as string]: `${meteorImpactState.y}%`,
          ['--meteor-blast-size' as string]: `${140 + meteorImpactState.intensity * 26}px`,
          ['--meteor-crater-size' as string]: `${65 + meteorImpactState.radius * 16}px`,
        } as React.CSSProperties
      }
    >
      <div className="isocity-meteor-object" />
      <div className="isocity-meteor-blast" />
      <div className="isocity-meteor-crater" />
    </div>
  ) : null;

  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <style>{earthquakeShakeCss}</style>
        <div
          className={`relative w-full h-full overflow-hidden bg-background flex flex-col ${earthquakeShakeClass}`}
          style={earthquakeShakeStyle}
        >
          {firestormOverlay}
          {meteorOverlay}
          {/* View Only Banner (Mobile) - nur für echte Besucher (Nicht-Mitglieder) */}
          {isFullyViewOnly && (
            <div className="bg-amber-500/90 text-black px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-medium">
              <span>👀</span>
              <span>Besuchermodus</span>
            </div>
          )}
          {/* Zurück-Banner für Gemeinde-Besuche (Mobile) */}
          {!disablePartnerships && onBackToHome && (
            <div className="bg-sky-600/90 text-white px-3 py-1 flex items-center text-xs">
              <span className="font-medium truncate">{municipalityName || 'Fremde Gemeinde'}</span>
            </div>
          )}
          
          {/* Mobile Top Bar - nicht in Public Rooms */}
          {!disablePartnerships && (
            <MobileTopBar 
              selectedTile={!isFullyViewOnly && selectedTile && state.selectedTool === 'select' ? state.grid[selectedTile.y][selectedTile.x] : null}
              services={state.services}
              onCloseTile={() => setSelectedTile(null)}
              onShare={isFullyViewOnly ? undefined : () => setShowShareModal(true)}
              onExit={onExit}
              isViewOnly={isViewOnly}
              cityNameOverride={cityNameOverride}
              serverWeather={serverWeather}
            />
          )}
          
          {/* Share Modal for mobile co-op (nicht im Guest-Mode) */}
          {multiplayer && !isFullyViewOnly && (
            <ShareModal
              open={showShareModal}
              onOpenChange={setShowShareModal}
            />
          )}
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={disablePartnerships ? undefined : { paddingTop: '72px', paddingBottom: '76px' }}>
            <CanvasIsometricGrid
              overlayMode={overlayMode}
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              isMobile={true}
              onBargeDelivery={handleBargeDelivery}
              ownerName={ownerName}
              municipalityName={municipalityName}
              memberCount={memberCount}
              administrators={administrators}
              coatOfArms={clientCoatOfArms}
              canEditCoatOfArms={!isViewOnly && !isFullyViewOnly}
              onSaveCoatOfArms={handleSaveCoatOfArms}
              isFullyViewOnly={isFullyViewOnly}
              showPublicRoomWalls={disablePartnerships}
              onVisitMunicipality={onVisitMunicipality}
              serverWeather={serverWeather}
              disastersRef={disastersRef}
              mansionPartiesRef={mansionPartiesRef}
              selectedDisasterId={selectedDisasterId}
              onSelectDisaster={setSelectedDisasterId}
              chunkManager={chunkManagerRef.current ?? undefined}
              playerResidences={residences}
              currentRoomCode={roomCode ?? 'MAIN'}
              onViewPlayerProfile={(userId) => setProfileUserId(userId)}
            />
            {/* Multiplayer Players Indicator - Mobile (nicht im Guest-Mode) */}
            {isMultiplayer && players.length > 0 && !isFullyViewOnly && (
              <div className="absolute top-2 right-2 z-20">
                <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-2 py-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>{players.length} Spieler online</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {players.map((player) => (
                      <div key={player.id} className="flex items-center gap-1 text-[10px] text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="truncate max-w-[90px]">{player.name}</span>
                        <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] leading-none ${getPlayerRoleBadge(player.name).className}`}>
                          {getPlayerRoleBadge(player.name).label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile Bottom Toolbar - nicht in Public Rooms */}
          {!disablePartnerships && (
            <MobileToolbar 
              onOpenPanel={(panel) => setActivePanel(panel)}
              overlayMode={overlayMode}
              setOverlayMode={setOverlayMode}
              chatUnreadCount={chatUnreadCount}
              isOwner={isOwner}
              isViewOnly={isViewOnly || isFullyViewOnly}
              onShare={isFullyViewOnly ? undefined : () => setShowShareModal(true)}
              onExit={onExit}
            />
          )}

          {/* Habbo-Style Footer Bar - nur in Public Rooms */}
          {disablePartnerships && (
            <PublicRoomFooterBar onBackToHome={onBackToHome ?? onExit} onToggleMessenger={toggleMessenger} />
          )}

          {/* Floating Messenger Button (Mobile, nur wenn keine PublicRoomFooterBar) */}
          {!disablePartnerships && (
            <button
              onClick={toggleMessenger}
              className={`fixed bottom-20 left-3 z-50 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 border ${
                showMessenger
                  ? 'bg-amber-500 border-amber-600 text-white shadow-amber-500/30'
                  : 'bg-white/90 dark:bg-slate-800/90 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-700 backdrop-blur-sm'
              }`}
              title="Messenger"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {messengerUnreadCount > 0 && !showMessenger && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800">
                  {messengerUnreadCount > 99 ? '99+' : messengerUnreadCount}
                </span>
              )}
            </button>
          )}

          {/* Weather & Disasters */}
          {!disablePartnerships && <PixiWeatherOverlay debugOverride={debugWeatherOverride} serverWeather={serverWeather} waitForServer />}
          {/* Disaster system deactivated — will be continued later
          {!disablePartnerships && (
            <DisasterOverlay
              viewport={viewport}
              selectedDisasterId={selectedDisasterId}
              onSelectDisaster={setSelectedDisasterId}
              disastersRef={disastersRef}
              mansionPartiesRef={mansionPartiesRef}
              onDispatch={(type, targetX, targetY) => {
                window.dispatchEvent(new CustomEvent('isocity-dispatch-emergency', { detail: { type, targetX, targetY } }));
              }}
            />
          )}
          */}
          
          {/* Panels - render as fullscreen modals on mobile */}
          {!disablePartnerships && state.activePanel === 'statistics' && <StatisticsPanel />}
          {!isFullyViewOnly && !disablePartnerships && state.activePanel === 'advisors' && <AdvisorsPanel />}
          {state.activePanel === 'settings' && <SettingsPanel onViewProfile={() => setProfileUserId('me')} />}
          {!isFullyViewOnly && !disablePartnerships && state.activePanel === 'trade' && <TradePanel onVisitMunicipality={onVisitMunicipality} />}
          {isDev && state.activePanel === 'growth_debug' && <GrowthDebugPanel />}
          {effectiveCanUseDebug && state.activePanel === 'debug' && <ApiDebugPanel debugWeatherOverride={debugWeatherOverride} onDebugWeatherChange={setDebugWeatherOverride} serverWeather={serverWeather} chunkManager={chunkManagerRef.current ?? undefined} />}
          {effectiveCanUseAdmin && state.activePanel === 'admin' && <AdminPanel onVisitMunicipality={onVisitMunicipality} />}
          {!isFullyViewOnly && state.activePanel === 'chat' && <ChatPanel />}
          {!isFullyViewOnly && state.activePanel === 'firma' && <FirmaPanel />}
          <BusLineCreationOverlay />
          <ResidencePlacementOverlay />
          {!isFullyViewOnly && state.activePanel === 'gemeinde' && <GemeindePanel />}
          {state.activePanel === 'leaderboard' && <LeaderboardPanel onViewProfile={(id) => setProfileUserId(id)} />}
          {!isFullyViewOnly && state.activePanel === 'marketplace' && <MarketplacePanel />}
          {!isFullyViewOnly && state.activePanel === 'reports' && <ReporterPanel />}
          {!isFullyViewOnly && state.activePanel === 'banking' && <BankingPanel />}
          {!isFullyViewOnly && state.activePanel === 'user' && (
            <UserPanel
              onOpenSettings={() => setActivePanel('settings')}
              onOpenReports={() => setActivePanel('reports')}
              onOpenAdvisors={() => setActivePanel('advisors')}
              onLogout={handleLogout}
            />
          )}
          
          {/* Tutorial */}
          {!disablePartnerships && !isFullyViewOnly && <TutorialOverlay />}

          {/* Messenger - nur fuer Mitglieder */}
          {!isFullyViewOnly && <MessengerContainer visible={showMessenger} onClose={() => setShowMessenger(false)} />}
          
          <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
          {profileUserId && <PlayerProfilePanel userId={profileUserId} onClose={() => setProfileUserId(null)} />}
          
          {wsOfflineOverlay}
        </div>
      </TooltipProvider>
    );
  }

  const showDesktopSidebar = !isFullyViewOnly;

  // Desktop layout
  return (
    <TooltipProvider>
      <style>{earthquakeShakeCss}</style>
      <div
        className={`relative w-full h-full min-h-[720px] overflow-hidden bg-background flex ${earthquakeShakeClass}`}
        style={earthquakeShakeStyle}
      >
        {firestormOverlay}
        {meteorOverlay}
        {showDesktopSidebar && (
          <Sidebar onExit={handleLogout} isFullyViewOnly={isFullyViewOnly} hideTradeAction={disablePartnerships} isOwner={isOwner} canUseDebug={effectiveCanUseAdmin} chatUnreadCount={chatUnreadCount} onToggleMessenger={toggleMessenger} messengerUnreadCount={messengerUnreadCount} showMessenger={showMessenger} onVisitMunicipality={onVisitMunicipality} />
        )}
        
        <div className={`flex-1 flex flex-col ${showDesktopSidebar ? 'ml-56' : ''}`}>
          {/* View Only Banner - nur für echte Besucher (Nicht-Mitglieder) */}
          {isFullyViewOnly && (
            <div className="bg-amber-500/90 text-black px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
              <span className="text-lg">👀</span>
              <span>Besuchermodus - Du kannst hier nur zuschauen</span>
            </div>
          )}
          {/* Zurück-Banner für Gemeinde-Besuche (Admin oder Besucher) */}
          {!disablePartnerships && onBackToHome && (
            <div className="bg-sky-600/90 text-white px-4 py-1.5 flex items-center text-sm">
              <span className="font-medium">Du besuchst: {municipalityName || 'Fremde Gemeinde'}</span>
            </div>
          )}
          {!disablePartnerships && <TopBar isViewOnly={isViewOnly} cityNameOverride={cityNameOverride} serverWeather={serverWeather} />}
          {!disablePartnerships && <StatsPanel />}
          <div className="flex-1 relative overflow-hidden">
            <CanvasIsometricGrid
              overlayMode={overlayMode}
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
              onBargeDelivery={handleBargeDelivery}
              ownerName={ownerName}
              municipalityName={municipalityName}
              memberCount={memberCount}
              administrators={administrators}
              coatOfArms={clientCoatOfArms}
              canEditCoatOfArms={!isViewOnly && !isFullyViewOnly}
              onSaveCoatOfArms={handleSaveCoatOfArms}
              isFullyViewOnly={isFullyViewOnly}
              showPublicRoomWalls={disablePartnerships}
              onVisitMunicipality={onVisitMunicipality}
              serverWeather={serverWeather}
              disastersRef={disastersRef}
              mansionPartiesRef={mansionPartiesRef}
              selectedDisasterId={selectedDisasterId}
              onSelectDisaster={setSelectedDisasterId}
              chunkManager={chunkManagerRef.current ?? undefined}
              playerResidences={residences}
              currentRoomCode={roomCode ?? 'MAIN'}
              onViewPlayerProfile={(userId) => setProfileUserId(userId)}
            />
            {!disablePartnerships && !isFullyViewOnly && <OverlayModeToggle overlayMode={overlayMode} setOverlayMode={setOverlayMode} />}
            {!disablePartnerships && <MiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />}
            
            {/* Multiplayer Players Indicator (Desktop) */}
            {isMultiplayer && players.length > 0 && !isFullyViewOnly && (
              <div className="absolute top-4 right-4 z-20">
                <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 shadow-lg min-w-[120px]">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span>{players.length} Spieler online</span>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {players.map((player) => (
                      <div key={player.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="truncate max-w-[140px]">{player.name}</span>
                        <span className={`ml-auto px-2 py-0.5 rounded text-[10px] leading-none ${getPlayerRoleBadge(player.name).className}`}>
                          {getPlayerRoleBadge(player.name).label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Habbo-Style Footer Bar - nur in Public Rooms (Desktop) */}
        {disablePartnerships && (
          <PublicRoomFooterBar onBackToHome={onBackToHome ?? onExit} onToggleMessenger={toggleMessenger} />
        )}
        
        {!disablePartnerships && state.activePanel === 'statistics' && <StatisticsPanel />}
        {!isFullyViewOnly && !disablePartnerships && state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel onViewProfile={() => setProfileUserId('me')} />}
        {!isFullyViewOnly && !disablePartnerships && state.activePanel === 'trade' && <TradePanel onVisitMunicipality={onVisitMunicipality} />}
        {state.activePanel === 'growth_debug' && <GrowthDebugPanel />}
        {effectiveCanUseDebug && state.activePanel === 'debug' && <ApiDebugPanel debugWeatherOverride={debugWeatherOverride} onDebugWeatherChange={setDebugWeatherOverride} serverWeather={serverWeather} chunkManager={chunkManagerRef.current ?? undefined} />}
        {effectiveCanUseAdmin && state.activePanel === 'admin' && <AdminPanel onVisitMunicipality={onVisitMunicipality} />}
        {!isFullyViewOnly && state.activePanel === 'chat' && <ChatPanel />}
        {!isFullyViewOnly && state.activePanel === 'firma' && <FirmaPanel />}
        <BusLineCreationOverlay />
        <SystemNoticeBanner />
        {!isFullyViewOnly && state.activePanel === 'gemeinde' && <GemeindePanel />}
        {state.activePanel === 'leaderboard' && <LeaderboardPanel onViewProfile={(id) => setProfileUserId(id)} />}
        {!isFullyViewOnly && state.activePanel === 'marketplace' && <MarketplacePanel />}
        {!isFullyViewOnly && state.activePanel === 'reports' && <ReporterPanel />}
        {!isFullyViewOnly && state.activePanel === 'banking' && <BankingPanel />}
        {!isFullyViewOnly && state.activePanel === 'user' && (
          <UserPanel
            onOpenSettings={() => setActivePanel('settings')}
            onOpenReports={() => setActivePanel('reports')}
            onOpenAdvisors={() => setActivePanel('advisors')}
            onLogout={handleLogout}
          />
        )}
        
        {/* Weather & Disasters (Desktop) */}
        {!disablePartnerships && <PixiWeatherOverlay debugOverride={debugWeatherOverride} serverWeather={serverWeather} waitForServer />}
        {/* Disaster system deactivated — will be continued later
        {!disablePartnerships && (
          <DisasterOverlay
            viewport={viewport}
            selectedDisasterId={selectedDisasterId}
            onSelectDisaster={setSelectedDisasterId}
            disastersRef={disastersRef}
            onDispatch={(type, targetX, targetY) => {
              window.dispatchEvent(new CustomEvent('isocity-dispatch-emergency', { detail: { type, targetX, targetY } }));
            }}
          />
        )}
        */}
        
        {/* Tutorial */}
        {!disablePartnerships && !isFullyViewOnly && <TutorialOverlay />}

        {/* Messenger - nur fuer Mitglieder */}
        {!isFullyViewOnly && <MessengerContainer visible={showMessenger} onClose={() => setShowMessenger(false)} />}
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        {profileUserId && <PlayerProfilePanel userId={profileUserId} onClose={() => setProfileUserId(null)} />}
        <CommandMenu />
        
        {/* Party Music Player - nur sichtbar wenn Party aktiv */}
        {!disablePartnerships && mansionParties.some(p => p.status !== 'shutdown') && (
          <div className="fixed bottom-4 right-4 z-50 pointer-events-auto">
            <MusicPlayerWidget />
          </div>
        )}

        {wsOfflineOverlay}
      </div>
    </TooltipProvider>
  );
}
