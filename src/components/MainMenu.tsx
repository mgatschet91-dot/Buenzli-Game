'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GameProvider } from '@/context/GameContext';
import { MultiplayerContextProvider, useMultiplayer } from '@/context/MultiplayerContext';
import { useGame } from '@/context/GameContext';
import Game from '@/components/Game';
import { setCurrentMunicipality } from '@/lib/api/database';
import { setAuthToken, getMapData, ApiError } from '@/lib/api/coreApi';
import { preloadGameAssets } from '@/components/game/imageLoader';
import { getActiveSpritePack } from '@/lib/renderConfig';
import { WATER_ASSET_PATH, AIRPLANE_SPRITE_SRC } from '@/components/game/constants';
import Link from 'next/link';
import { useLandingLocale } from '@/lib/i18n/useLandingLocale';
import { SwissLanguageSelector } from '@/components/ui/SwissLanguageSelector';

type AuthView = 'menu' | 'login' | 'forgot' | 'register' | 'loading' | 'game';
type ServerState = 'checking' | 'online' | 'offline';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
function normalizeGameApiBaseUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  if (trimmed.endsWith('/api/game')) return trimmed;
  return `${trimmed}/api/game`;
}
const API_BASE_URL = normalizeGameApiBaseUrl(process.env.NEXT_PUBLIC_CORE_API_URL || AUTH_API_BASE_URL);
const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://127.0.0.1:4100';

interface GameUser {
  id: number;
  name: string;
  nickname: string;
  email: string;
  municipality_id: number | null;
  municipality_slug?: string | null;
  municipality_name?: string | null;
}

interface MunicipalityData {
  id: number;
  name: string;
  canton: string;
  owner: { id: number; nickname: string } | null;
  memberCount: number;
  administratorCount: number;
  administrators: Array<{ id: number; nickname: string }>;
  coatOfArms: { svg: string | null; image_url: string | null } | null;
}

interface CoreMunicipality {
  id: number;
  name: string;
  slug: string;
  canton_code: string;
  canton_name: string;
  members_count?: number;
}

const MAX_MEMBERS_PER_MUNICIPALITY = 25;
const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';

// ==========================================
// TOKEN STORAGE HELPERS
// ==========================================
const TOKEN_KEY = 'isocity_auth_token';
const REMEMBER_KEY = 'isocity_remember';

/** Speichert Token: localStorage (dauerhaft) oder sessionStorage (nur diese Sitzung) */
function saveAuthToken(token: string, remember: boolean) {
  if (typeof window === 'undefined') return;
  // Alten Token aus beiden Storages entfernen
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_KEY, '1');
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

/** Liest Token aus localStorage ODER sessionStorage */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

/** Entfernt Token aus beiden Storages */
function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

/** Prüft ob "Angemeldet bleiben" aktiv war */
function wasRememberMe(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(REMEMBER_KEY) === '1';
}

function resolveMunicipalityForUser(user: Partial<GameUser>): { slug: string; name: string } | null {
  const explicitSlug = user.municipality_slug?.trim();
  const explicitName = user.municipality_name?.trim();
  if (explicitSlug) {
    return {
      slug: explicitSlug,
      name: explicitName || explicitSlug,
    };
  }
  return null;
}

function createFallbackMunicipalityData(slug: string, user?: GameUser | null): MunicipalityData {
  const displayName = user?.municipality_name?.trim() || slug;
  return {
    id: Number(user?.municipality_id || 0),
    name: displayName,
    canton: '',
    owner: null,
    memberCount: 1,
    administratorCount: 0,
    administrators: [],
    coatOfArms: null,
  };
}

// Generate a deterministic room code from municipality slug
function slugToRoomCode(slug: string): string {
  const normalized = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 5)
    .padEnd(5, 'X');
  return normalized;
}

// ==========================================
// FLOATING PARTICLES
// ==========================================
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-particle rounded-full"
          style={{
            left: `${8 + (i * 7.5) % 90}%`,
            width: `${2 + (i % 3) * 2}px`,
            height: `${2 + (i % 3) * 2}px`,
            background: i % 3 === 0 ? 'hsl(145 55% 55% / 0.35)' : i % 3 === 1 ? 'hsl(38 92% 62% / 0.32)' : 'hsl(12 82% 62% / 0.28)',
            animationDuration: `${8 + i * 2}s`,
            animationDelay: `${i * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

// ==========================================
// ANIMATED CITY ICON
// ==========================================
// ==========================================
// SERVER STATUS
// ==========================================
function ServerStatus({ mounted, t }: { mounted: boolean; t: (key: string) => string }) {
  const [apiStatus, setApiStatus] = useState<ServerState>('checking');
  const [syncStatus, setSyncStatus] = useState<ServerState>('checking');

  const checkServers = useCallback(async () => {
    try { const res = await fetch(`${AUTH_API_BASE_URL}/health`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }); setApiStatus(res.ok ? 'online' : 'offline'); } catch { setApiStatus('offline'); }
    try { const res = await fetch(`${WS_URL}/health`, { signal: AbortSignal.timeout(4000) }); setSyncStatus(res.ok ? 'online' : 'offline'); } catch { setSyncStatus('offline'); }
  }, []);

  useEffect(() => { checkServers(); const i = setInterval(checkServers, 30000); return () => clearInterval(i); }, [checkServers]);

  const dot = (s: ServerState) => s === 'checking' ? 'bg-yellow-500/60 animate-pulse' : s === 'online' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.4)]';
  const txt = (s: ServerState) => s === 'checking' ? t('status.checking') : s === 'online' ? t('status.online') : t('status.offline');
  const clr = (s: ServerState) => s === 'checking' ? 'text-yellow-500/60' : s === 'online' ? 'text-green-500/80' : 'text-red-500/70';

  return (
    <div className={`z-20 transition-all duration-1000 delay-2000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="flex items-center gap-4 md:gap-6 text-[11px] tracking-wider uppercase flex-wrap justify-center">
        <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full transition-all duration-500 ${dot(apiStatus)}`} /><span className="text-muted-foreground/40">API</span><span className={`font-medium transition-colors duration-500 ${clr(apiStatus)}`}>{txt(apiStatus)}</span></div>
        <div className="w-px h-3 bg-border/20" />
        <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full transition-all duration-500 ${dot(syncStatus)}`} /><span className="text-muted-foreground/40">Sync</span><span className={`font-medium transition-colors duration-500 ${clr(syncStatus)}`}>{txt(syncStatus)}</span></div>
        <div className="w-px h-3 bg-border/20" />
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-300/70" /><span className="text-muted-foreground/40">Game</span><span className="text-muted-foreground/60 font-mono">v2.1</span></div>
      </div>
    </div>
  );
}

// ==========================================
// LOADING SCREEN (nach Login/Register)
// ==========================================
function LoadingScreen({ message, municipalityName, progress, t }: { message: string; municipalityName?: string; progress?: number; t: (key: string) => string }) {
  const pct = progress != null ? Math.round(progress * 100) : null;

  return (
    <main className="min-h-screen hero-gradient geo-pattern flex flex-col items-center justify-center relative overflow-hidden">
      <Particles />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] animate-pulseGlow" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 animate-fadeIn">
        <img 
          src="/assets/logo.png" 
          alt="BünzliFight Logo" 
          className="h-40 w-auto object-contain animate-riseIn"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />

        {municipalityName && (
          <p className="text-foreground/90 text-lg font-medium animate-riseIn" style={{ animationDelay: '0.2s' }}>
            {t('loading.welcome_in')} <span className="text-primary">{municipalityName}</span>
          </p>
        )}

        <div className="w-64 animate-riseIn" style={{ animationDelay: '0.3s' }}>
          <div className="h-1.5 bg-background/30 rounded-full overflow-hidden border border-border/20">
            <div
              className="h-full bg-gradient-to-r from-primary/80 via-primary to-primary/80 rounded-full transition-all duration-500 ease-out"
              style={{ width: pct != null ? `${pct}%` : '30%', animation: pct == null ? 'pulse 1.5s ease-in-out infinite' : undefined }}
            />
          </div>
        </div>

        <p className="text-foreground/80 text-sm animate-riseIn" style={{ animationDelay: '0.4s' }}>
          {message}
        </p>
      </div>
    </main>
  );
}

// ==========================================
// AUTO-JOIN MULTIPLAYER GAME
// (Verbindet automatisch zum Multiplayer-Raum)
// ==========================================
function AutoJoinMultiplayerGame({
  roomCode,
  cityName,
  cityNameOverride,
  canton,
  currentSlug,
  onExit,
  onBackToHome,
  cannotEditSettings,
  isFullyViewOnly,
  disablePartnerships,
  isOwner,
  canUseDebug,
  ownerName,
  municipalityName,
  memberCount,
  administrators,
  coatOfArms,
  onVisitMunicipality,
  onSessionInvalid,
}: {
  roomCode: string;
  cityName: string;
  cityNameOverride?: string;
  canton: string;
  currentSlug: string;
  onExit: () => void;
  onBackToHome?: () => void;
  cannotEditSettings: boolean;
  isFullyViewOnly: boolean;
  disablePartnerships?: boolean;
  isOwner: boolean;
  canUseDebug?: boolean;
  ownerName?: string;
  municipalityName?: string;
  memberCount?: number;
  administrators?: Array<{ id: number; nickname: string }>;
  coatOfArms?: { svg: string | null; image_url: string | null } | null;
  onVisitMunicipality?: (slug: string, roomCode?: string, roomName?: string) => void;
  onSessionInvalid?: (reason: string) => void;
}) {
  const multiplayer = useMultiplayer();
  const { state, setAdjacentCities, loadPartnershipsFromApi } = useGame();
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const lastConnectionKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const connectionKey = `${currentSlug}:${roomCode}:${isFullyViewOnly ? '1' : '0'}`;
    if (lastConnectionKeyRef.current === connectionKey) return;
    lastConnectionKeyRef.current = connectionKey;

    async function connectToRoom() {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        // Beim Wechsel von Navigator-Maps immer bestehende Verbindung sauber trennen.
        multiplayer.leaveRoom();

        // Lade Kanton-basierte Nachbar-Gemeinden (falls vorhanden)
        if (disablePartnerships) {
          setAdjacentCities([]);
        } else if (canton) {
          try {
            const { getCantonData } = await import('@/lib/api/coreApi');
            const cantonData = await getCantonData(canton);

            if (cantonData?.municipalities && cantonData.municipalities.length > 0) {
              const { generateAdjacentCitiesFromCanton } = await import('@/lib/simulation');
              const newAdjacentCities = generateAdjacentCitiesFromCanton(
                cantonData.municipalities.map((m) => ({ name: m.name, slug: m.slug })),
                currentSlug
              );

              const existingCities = state.adjacentCities || [];
              const mergedCities = newAdjacentCities.map((newCity) => {
                const existing = existingCities.find((e) => e.id === newCity.id || e.name === newCity.name);
                if (existing) {
                  return { ...newCity, discovered: existing.discovered || false, connected: existing.connected || false };
                }
                return newCity;
              });

              setAdjacentCities(mergedCities);
            }
          } catch (err) {
            console.error('[Gemeinde] Konnte Kanton-Gemeinden nicht laden:', err);
          }
        }
        
        // Partnerschaften nur laden, wenn sie im aktuellen Modus aktiv sind.
        if (!disablePartnerships) {
          try {
            await loadPartnershipsFromApi();
          } catch (err) {
            console.error('[MainMenu] Konnte Partnerschaften nicht laden:', err);
          }
        }

        const gameState = { ...state, cityName };

        await multiplayer.createOrJoinRoom(roomCode, cityName, gameState, isFullyViewOnly);
      } catch (err) {
        console.error('[Gemeinde] Failed to connect to room:', err);
        setConnectionError('Multiplayer-Verbindung fehlgeschlagen');
      }

      setIsConnecting(false);
    }

    connectToRoom();
  }, [roomCode, cityName, canton, currentSlug, multiplayer, state, setAdjacentCities, loadPartnershipsFromApi, isFullyViewOnly, disablePartnerships]);

  if (connectionError) {
    console.warn('[Gemeinde] Playing in offline mode:', connectionError);
  }

  return (
    <Game
      onExit={onExit}
      onBackToHome={onBackToHome}
      onSessionInvalid={onSessionInvalid}
      isViewOnly={cannotEditSettings}
      isFullyViewOnly={isFullyViewOnly}
      disablePartnerships={disablePartnerships}
      isOwner={isOwner}
      canUseDebug={canUseDebug}
      ownerName={ownerName}
      municipalityName={municipalityName}
      memberCount={memberCount}
      administrators={administrators}
      coatOfArms={coatOfArms}
      onVisitMunicipality={onVisitMunicipality}
      cityNameOverride={cityNameOverride}
    />
  );
}

// ==========================================
// GAME SESSION WRAPPER
// (Verwaltet Providers und Berechtigungen)
// ==========================================
function GameSession({
  slug,
  user,
  municipalityData,
  onExit,
  onSessionInvalid,
  onVisitMunicipality,
  isVisiting,
  onBackToHome,
  homeCity,
  roomCodeOverride,
  roomNameOverride,
  disablePartnerships,
}: {
  slug: string;
  user: GameUser;
  municipalityData: MunicipalityData;
  onExit: () => void;
  onSessionInvalid?: (reason: string) => void;
  onVisitMunicipality?: (slug: string, roomCode?: string, roomName?: string) => void;
  isVisiting?: boolean;
  onBackToHome?: () => void;
  homeCity?: string;
  roomCodeOverride?: string;
  roomNameOverride?: string;
  disablePartnerships?: boolean;
}) {
  const isOwner = user.id === municipalityData.owner?.id;
  const isAdmin = municipalityData.administrators?.some((admin) => admin.id === user.id) ?? false;
  const isMember = user.municipality_id === municipalityData.id;
  const userRank = Number((user as unknown as Record<string, unknown>).user_rank || 0);
  const isGlobalAdmin = String((user as unknown as Record<string, unknown>).global_role || '').toLowerCase() === 'administrator';
  const canUseDebug = userRank >= 7 || isGlobalAdmin;
  const canEditSettings = isOwner || isAdmin || isGlobalAdmin;
  const showVisitReadOnly = Boolean(isVisiting) && !disablePartnerships && !isGlobalAdmin;
  const canGoBackHome = Boolean(isVisiting && onBackToHome);
  const isFullyViewOnly = showVisitReadOnly ? true : (!isMember && !isOwner && !isAdmin && !isGlobalAdmin);
  const municipalityRole: 'owner' | 'council' | 'citizen' | 'observer' =
    showVisitReadOnly ? 'observer' : isGlobalAdmin ? 'owner' : isOwner ? 'owner' : isAdmin ? 'council' : isMember ? 'citizen' : 'observer';
  const roomCode = (roomCodeOverride && roomCodeOverride.trim()) ? roomCodeOverride.trim().toUpperCase() : slugToRoomCode(slug);

  return (
    <MultiplayerContextProvider playerName={user.nickname || user.name} municipalitySlug={slug}>
      <GameProvider
        startFresh={false}
        municipalitySlug={slug}
        cityName={municipalityData.name || slug}
        userId={user.id}
        isOwner={showVisitReadOnly ? false : isOwner}
        municipalityRole={municipalityRole}
        canton={municipalityData.canton}
        disablePartnerships={disablePartnerships}
      >
        <main className="h-screen w-screen overflow-hidden relative">
          {/* Besucher-Banner (klassischer Nur-Ansicht-Besuch) */}
          {showVisitReadOnly && onBackToHome && (
            <div className="absolute top-0 left-0 right-0 z-[100] bg-gradient-to-r from-cyan-600/95 via-cyan-500/95 to-cyan-600/95 backdrop-blur-sm border-b border-cyan-400/30 shadow-lg shadow-cyan-900/20">
              <div className="flex items-center justify-between px-4 py-2.5 max-w-screen-xl mx-auto">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                  <span className="text-white/90 text-sm font-medium tracking-wide">
                    Besuch in <span className="font-bold text-white">{municipalityData.name}</span>
                    <span className="text-white/60 ml-2 text-xs">(Nur Ansicht)</span>
                  </span>
                </div>
                <button
                  onClick={onBackToHome}
                  className="flex items-center gap-2 px-4 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-md text-white text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Zurück nach {homeCity || 'meiner Stadt'}
                </button>
              </div>
            </div>
          )}
          {/* Public-Room Besuch: Zurück-Button wird jetzt in Game.tsx unter der Spieler-Anzeige gerendert */}
          <AutoJoinMultiplayerGame
            roomCode={roomCode}
            cityName={municipalityData.name || slug}
            cityNameOverride={roomNameOverride}
            canton={municipalityData.canton || ''}
            currentSlug={slug}
            onExit={onExit}
            onBackToHome={isVisiting ? onBackToHome : undefined}
            cannotEditSettings={showVisitReadOnly ? true : !canEditSettings}
            isFullyViewOnly={isFullyViewOnly}
            disablePartnerships={disablePartnerships}
            isOwner={showVisitReadOnly ? false : isOwner}
            canUseDebug={canUseDebug}
            ownerName={municipalityData.owner?.nickname}
            municipalityName={municipalityData.name}
            memberCount={municipalityData.memberCount}
            administrators={municipalityData.administrators}
            coatOfArms={municipalityData.coatOfArms}
            onVisitMunicipality={showVisitReadOnly ? undefined : onVisitMunicipality}
            onSessionInvalid={onSessionInvalid}
          />
        </main>
      </GameProvider>
    </MultiplayerContextProvider>
  );
}

// ==========================================
// MAIN MENU COMPONENT
// ==========================================
export default function MainMenu() {
  const { locale, setLocale, t } = useLandingLocale();
  const [view, setView] = useState<AuthView>('menu');
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingMunicipality, setLoadingMunicipality] = useState('');
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotEmail, setForgotEmail] = useState('');
  const [registerData, setRegisterData] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    email: '',
    password: '',
    password_confirmation: '',
    gender: 'male',
    birthday: '',
    municipality_id: '',
  });
  const [availableMunicipalities, setAvailableMunicipalities] = useState<CoreMunicipality[]>([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [createMunicipality, setCreateMunicipality] = useState(false);
  const [newMunicipalityName, setNewMunicipalityName] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  // Referral-System State
  const [referralCode, setReferralCode] = useState('');
  const [referralBannerNickname, setReferralBannerNickname] = useState('');
  const [showReferralOverlay, setShowReferralOverlay] = useState(false);
  const [referredByNickname, setReferredByNickname] = useState('');
  const [referralMunicipalitySlug, setReferralMunicipalitySlug] = useState('');
  const [isGoogleSetup, setIsGoogleSetup] = useState(false);

  useEffect(() => {
    if (!showReferralOverlay) return;
    const t = setTimeout(() => setShowReferralOverlay(false), 4500);
    return () => clearTimeout(t);
  }, [showReferralOverlay]);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Game-Session State
  const [gameUser, setGameUser] = useState<GameUser | null>(null);
  const [gameSlug, setGameSlug] = useState<string>('');
  const [gameMunicipalityData, setGameMunicipalityData] = useState<MunicipalityData | null>(null);

  // Besucher-Modus State (Trade-Partner besuchen)
  const [visitingSlug, setVisitingSlug] = useState<string>('');
  const [visitingRoomCode, setVisitingRoomCode] = useState<string>('');
  const [visitingFromPublicRoom, setVisitingFromPublicRoom] = useState(false);
  const [visitingMunicipalityData, setVisitingMunicipalityData] = useState<MunicipalityData | null>(null);
  const [visitingRoomName, setVisitingRoomName] = useState('');
  const [visitingSessionNonce, setVisitingSessionNonce] = useState(0);
  const [visitingLoading, setVisitingLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ==========================================
  // GEMEINDEN AUS CORE-SERVER LADEN (REGISTER)
  // ==========================================
  useEffect(() => {
    if (view !== 'register') return;
    if (availableMunicipalities.length > 0) return;

    let cancelled = false;
    setMunicipalitiesLoading(true);

    fetch(`${AUTH_API_BASE_URL}/api/municipalities`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.municipalities) ? data.municipalities : [];
        setAvailableMunicipalities(list);
        // Referral-Gemeinde automatisch vorauswählen (kein Dropdown)
        if (referralMunicipalitySlug && list.length > 0) {
          const slug = referralMunicipalitySlug.toLowerCase();
          const match =
            list.find((m: CoreMunicipality) => m.slug?.toLowerCase() === slug) ||
            list.find((m: CoreMunicipality) => m.name.toLowerCase() === slug) ||
            list.find((m: CoreMunicipality) => m.name.toLowerCase().startsWith(slug));
          if (match) {
            setRegisterData((prev) => ({ ...prev, municipality_id: String(match.id) }));
            setMunicipalitySearch(match.name);
          }
        }
      })
      .catch((err) => {
        console.warn('[MainMenu] Gemeinden konnten nicht geladen werden:', err);
      })
      .finally(() => {
        if (!cancelled) setMunicipalitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, availableMunicipalities.length]);

  // ==========================================
  // AUTO-LOGIN: Token aus localStorage prüfen
  // ==========================================
  useEffect(() => {
    async function tryAutoLogin() {
      if (typeof window === 'undefined') {
        setView('menu');
        return;
      }

      // ── Google OAuth Callback: ?google_token=JWT ──
      const urlParams = new URLSearchParams(window.location.search);
      const googleToken = urlParams.get('google_token');
      const googleError = urlParams.get('google_error');
      const googleSetup = urlParams.get('google_setup');
      const googleNickname = urlParams.get('google_nickname');
      if (googleToken || googleError) {
        // URL bereinigen
        window.history.replaceState({}, '', window.location.pathname);
        if (googleError) {
          setView('login');
          setError(googleError);
          return;
        }
        if (googleSetup === '1') {
          // Neuer User: Nickname + Gemeinde noch auswählen
          saveAuthToken(googleToken!, true);
          if (googleNickname) setRegisterData(d => ({ ...d, nickname: decodeURIComponent(googleNickname) }));
          // REV-State aus localStorage wiederherstellen (ging durch OAuth-Redirect verloren)
          const savedRefCode = localStorage.getItem('google_oauth_referral_code');
          const savedMSlug = localStorage.getItem('google_oauth_municipality_slug');
          if (savedRefCode) { setReferralCode(savedRefCode); localStorage.removeItem('google_oauth_referral_code'); }
          if (savedMSlug) { setReferralMunicipalitySlug(savedMSlug); localStorage.removeItem('google_oauth_municipality_slug'); }
          setIsGoogleSetup(true);
          setView('register');
          setError('');
          return;
        }
        // Bestehender User: direkt einloggen
        saveAuthToken(googleToken!, true);
        setView('loading');
        setLoadingMessage(t('loading.checking'));
        try {
          const resp = await fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${googleToken}` },
          });
          const data = await resp.json();
          const municipality = resolveMunicipalityForUser(data?.user);
          if (municipality && data?.user) {
            const user: GameUser = { ...data.user, municipality_slug: municipality.slug, municipality_name: municipality.name };
            localStorage.setItem('isocity_municipality', municipality.slug);
            if (user.id) localStorage.setItem('isocity_user_id', String(user.id));
            if (user.nickname) localStorage.setItem('isocity_user_name', user.nickname);
            setLoadingMunicipality(municipality.name);
            setLoadingMessage(t('loading.city'));
            loadGameAndStart(municipality.slug, user, googleToken!);
            return;
          }
        } catch { /* ignore */ }
        setView('menu');
        return;
      }

      const token = getAuthToken();
      if (!token) {
        // Deep-Link: /#registration → direkt Registrierung anzeigen
        const hash = window.location.hash?.toLowerCase();
        if (hash === '#registration' || hash === '#register' || hash === '#registrieren') {
          setView('register');
        } else if (hash.startsWith('#ref/')) {
          // Format: #ref/CODE oder #ref/CODE/gemeinde-slug
          const parts = window.location.hash.slice(5).split('/');
          const refCode = (parts[0] || '').toUpperCase();
          const mSlug = (parts[1] || '').toLowerCase();
          if (/^[A-Z0-9]{8}$/.test(refCode)) {
            setReferralCode(refCode);
            setView('register');
            fetch(`${AUTH_API_BASE_URL}/api/referral/validate?code=${refCode}`, {
              headers: { Accept: 'application/json' },
            }).then(r => r.json()).then(d => {
              if (d.ok && d.referrer_nickname) setReferralBannerNickname(d.referrer_nickname);
            }).catch(() => {});
          } else {
            setView('menu');
          }
          if (mSlug) setReferralMunicipalitySlug(mSlug);
        } else {
          setView('menu');
        }
        return;
      }

      // Zeige Ladebildschirm während Auto-Login
      setView('loading');
      setLoadingMessage(t('loading.checking'));
      setLoadingMunicipality('');

      try {
        // Token verifizieren
        const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Token ungültig -- entfernen und Menü zeigen
          clearAuthToken();
          if (IS_ELECTRON) { window.location.href = '/steam'; return; }
          setView('menu');
          return;
        }

        const data = await response.json();

        const authOk = (data?.ok === true) || (data?.success === true && data?.authenticated === true);
        if (!authOk || !data.user) {
          clearAuthToken();
          if (IS_ELECTRON) { window.location.href = '/steam'; return; }
          setView('menu');
          return;
        }

        // Falls Server neuen Token mitgibt (Refresh), speichern
        if (data.token) {
          saveAuthToken(data.token, wasRememberMe());
        }

        const municipality = resolveMunicipalityForUser(data.user);
        if (!municipality) {
          console.warn('[AutoLogin] Keine Gemeinde zugeordnet, zeige Menü');
          clearAuthToken();
          if (IS_ELECTRON) { window.location.href = '/steam'; return; }
          setView('menu');
          return;
        }

        const user: GameUser = {
          ...data.user,
          municipality_slug: municipality.slug,
          municipality_name: municipality.name,
        };

        const userName = user.nickname || user.name;
        if (userName) localStorage.setItem('isocity_user_name', userName);
        if (user.id) localStorage.setItem('isocity_user_id', String(user.id));
        if (data.user?.referral_code) localStorage.setItem('meinort_referral_code', data.user.referral_code);

        localStorage.setItem('isocity_municipality', municipality.slug);
        setLoadingMunicipality(municipality.name);
        setLoadingMessage(t('loading.city'));
        loadGameDirect(municipality.slug, user, token);
      } catch {
        // Netzwerkfehler -> Menü anzeigen, Token behalten
        console.warn('[AutoLogin] Konnte Token nicht prüfen, zeige Menü');
        if (IS_ELECTRON) { window.location.href = '/steam'; return; }
        setView('menu');
      }
    }

    tryAutoLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================
  // GEMEINDE-DATEN LADEN (direkt, ohne Delay)
  // ==========================================
  async function loadGameDirect(slug: string, user: GameUser, token: string) {
    setAuthToken(token);
    setCurrentMunicipality(slug);
    setLoadingProgress(0);

    const pack = getActiveSpritePack();
    const spritePreload = preloadGameAssets(pack, WATER_ASSET_PATH, AIRPLANE_SPRITE_SRC, (loaded, total) => {
      setLoadingProgress(loaded / total);
    });

    let municipalityData: MunicipalityData = createFallbackMunicipalityData(slug, user);
    try {
      const mapData = await getMapData(slug);
      municipalityData = {
        id: mapData.municipality.id,
        name: mapData.municipality.name,
        canton: mapData.municipality.canton,
        owner: mapData.municipality.owner || mapData.administration?.owner || null,
        memberCount: mapData.administration?.member_count || 1,
        administratorCount: mapData.administration?.administrator_count || 0,
        administrators: mapData.administration?.administrators || [],
        coatOfArms: mapData.municipality.coat_of_arms || null,
      };
    } catch (err) {
      console.warn('[MainMenu] getMapData fehlgeschlagen, starte mit Fallback:', err);
    }

    await spritePreload;

    setGameUser(user);
    setGameSlug(slug);
    setGameMunicipalityData(municipalityData);
    setView('game');
  }

  // ==========================================
  // GEMEINDE-DATEN LADEN & SPIEL STARTEN (mit Animation)
  // ==========================================
  async function loadGameAndStart(slug: string, user: GameUser, token: string) {
    setLoadingMessage(t('loading.municipality'));
    setLoadingProgress(0);

    setAuthToken(token);
    setCurrentMunicipality(slug);

    const pack = getActiveSpritePack();
    const spritePreload = preloadGameAssets(pack, WATER_ASSET_PATH, AIRPLANE_SPRITE_SRC, (loaded, total) => {
      setLoadingProgress(loaded / total);
    });

    let municipalityData: MunicipalityData = createFallbackMunicipalityData(slug, user);
    try {
      const mapData = await getMapData(slug);
      municipalityData = {
        id: mapData.municipality.id,
        name: mapData.municipality.name,
        canton: mapData.municipality.canton,
        owner: mapData.municipality.owner || mapData.administration?.owner || null,
        memberCount: mapData.administration?.member_count || 1,
        administratorCount: mapData.administration?.administrator_count || 0,
        administrators: mapData.administration?.administrators || [],
        coatOfArms: mapData.municipality.coat_of_arms || null,
      };
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setError(t('error.municipality_not_found'));
      } else {
        console.warn('[MainMenu] getMapData fehlgeschlagen, starte mit Fallback:', err);
      }
    }

    await spritePreload;

    setGameUser(user);
    setGameSlug(slug);
    setGameMunicipalityData(municipalityData);
    setView('game');
  }

  // ==========================================
  // LOGIN HANDLER
  // ==========================================
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...loginData, remember_me: rememberMe }),
      });

      const data = await res.json();
      const loginOk = (data?.ok === true) || (data?.success === true);

      if (!res.ok || !loginOk) {
        setError(data.error || t('error.login_failed'));
        setSubmitting(false);
        return;
      }
      if (!data?.token || !data?.user) {
        setError(t('error.login_incomplete'));
        setSubmitting(false);
        return;
      }

      // Token und User speichern
      saveAuthToken(data.token, rememberMe);
      const municipality = resolveMunicipalityForUser(data.user);
      if (!municipality) {
        setError(t('error.no_municipality'));
        clearAuthToken();
        setSubmitting(false);
        return;
      }

      const user: GameUser = {
        ...data.user,
        municipality_slug: municipality.slug,
        municipality_name: municipality.name,
      };
      localStorage.setItem('isocity_municipality', municipality.slug);
      if (user.id) localStorage.setItem('isocity_user_id', String(user.id));
      const userName = user.nickname || user.name;
      if (userName) localStorage.setItem('isocity_user_name', userName);
      if (data.user?.referral_code) localStorage.setItem('meinort_referral_code', data.user.referral_code);

      setLoadingMunicipality(municipality.name);
      setLoadingMessage(t('loading.city'));
      setView('loading');

      loadGameAndStart(municipality.slug, user, data.token);
    } catch {
      setError(t('error.server_offline'));
      setSubmitting(false);
    }
  }

  // ==========================================
  // REGISTER HANDLER
  // ==========================================
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (registerData.password !== registerData.password_confirmation) {
      setError(t('error.passwords_mismatch'));
      setSubmitting(false);
      return;
    }

    if (!createMunicipality && !registerData.municipality_id) {
      setError(t('error.select_municipality'));
      setSubmitting(false);
      return;
    }

    if (createMunicipality && newMunicipalityName.trim().length < 2) {
      setError(t('error.municipality_name_short'));
      setSubmitting(false);
      return;
    }

    // Prüfe ob ausgewählte Gemeinde voll ist
    if (!createMunicipality && registerData.municipality_id) {
      const sel = availableMunicipalities.find((m) => String(m.id) === registerData.municipality_id);
      if (sel && (sel.members_count ?? 0) >= MAX_MEMBERS_PER_MUNICIPALITY) {
        setError(t('error.municipality_full'));
        setSubmitting(false);
        return;
      }
    }

    try {
      // Google-Setup: separater Endpoint, kein Passwort nötig
      if (isGoogleSetup) {
        const token = localStorage.getItem('isocity_auth_token') || sessionStorage.getItem('isocity_auth_token') || '';
        const setupBody: Record<string, unknown> = { nickname: registerData.nickname };
        if (createMunicipality) {
          setupBody.create_municipality = true;
          setupBody.new_municipality_name = newMunicipalityName.trim();
        } else {
          setupBody.municipality_id = registerData.municipality_id;
        }
        if (referralCode) setupBody.referral_code = referralCode;
        const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/google/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(setupBody),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setError(data?.error || 'Setup fehlgeschlagen');
          setSubmitting(false);
          return;
        }
        saveAuthToken(data.token, true);
        setIsGoogleSetup(false);
        // User-Info laden und Spiel starten
        const meRes = await fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${data.token}` },
        });
        const meData = await meRes.json();
        const municipality = resolveMunicipalityForUser(meData?.user);
        if (municipality && meData?.user) {
          const user: GameUser = { ...meData.user, municipality_slug: municipality.slug, municipality_name: municipality.name };
          localStorage.setItem('isocity_municipality', municipality.slug);
          if (user.id) localStorage.setItem('isocity_user_id', String(user.id));
          if (user.nickname) localStorage.setItem('isocity_user_name', user.nickname);
          loadGameAndStart(municipality.slug, user, data.token);
        }
        return;
      }

      const registerBody: Record<string, unknown> = {
        email: registerData.email,
        password: registerData.password,
        nickname: registerData.nickname,
      };

      if (createMunicipality) {
        registerBody.create_municipality = true;
        registerBody.new_municipality_name = newMunicipalityName.trim();
      } else {
        registerBody.municipality_id = registerData.municipality_id;
      }
      if (referralCode) registerBody.referral_code = referralCode;

      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(registerBody),
      });

      const data = await res.json();
      const registerOk = (data?.ok === true) || (data?.success === true);

      if (!res.ok || !registerOk) {
        if (data.errors) {
          const firstError = Object.values(data.errors).flat()[0] as string;
          setError(firstError);
        } else {
          setError(data.error || data.message || t('error.register_failed'));
        }
        setSubmitting(false);
        return;
      }
      if (!data?.token || !data?.user) {
        setError(t('error.register_incomplete'));
        setSubmitting(false);
        return;
      }

      saveAuthToken(data.token, true);
      const municipality = resolveMunicipalityForUser(data.user);
      if (!municipality) {
        setError(t('error.municipality_assign_failed'));
        clearAuthToken();
        setSubmitting(false);
        return;
      }

      const user: GameUser = {
        ...data.user,
        municipality_slug: municipality.slug,
        municipality_name: municipality.name,
      };
      localStorage.setItem('isocity_municipality', municipality.slug);
      if (user.id) localStorage.setItem('isocity_user_id', String(user.id));
      const userName = user.nickname || user.name;
      if (userName) localStorage.setItem('isocity_user_name', userName);
      if (data.user?.referral_code) localStorage.setItem('meinort_referral_code', data.user.referral_code);

      if (data.referral?.referred_by) {
        setReferredByNickname(data.referral.referred_by);
        setShowReferralOverlay(true);
      }

      setLoadingMunicipality(municipality.name);
      setLoadingMessage(t('loading.welcome'));
      setView('loading');

      loadGameAndStart(municipality.slug, user, data.token);
    } catch {
      setError(t('error.server_offline'));
      setSubmitting(false);
    }
  }

  function handleOpenForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    const email = forgotEmail.trim();
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    if (typeof window !== 'undefined') {
      window.location.href = `${AUTH_API_BASE_URL}/forgot-password${query}`;
    }
  }

  // ==========================================
  // SPIEL VERLASSEN -> Zurück zum Hauptmenü
  // ==========================================
  function handleExitGame() {
    if (IS_ELECTRON) { clearAuthToken(); window.location.href = '/steam'; return; }
    clearAuthToken();
    setAuthToken('');
    setGameUser(null);
    setGameSlug('');
    setGameMunicipalityData(null);
    setVisitingSlug('');
    setVisitingRoomCode('');
    setVisitingFromPublicRoom(false);
    setVisitingMunicipalityData(null);
    setVisitingRoomName('');
    setVisitingSessionNonce(0);
    setVisitingLoading(false);
    setSubmitting(false);
    setError('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isocity_municipality');
      localStorage.removeItem('isocity_user_name');
      localStorage.removeItem('isocity_user_id');
      localStorage.removeItem('meinort_referral_code');
    }
    if (IS_ELECTRON) { window.location.href = '/steam'; return; }
    setView('menu');
  }

  function handleSessionInvalid(reason: string) {
    clearAuthToken();
    setGameUser(null);
    setGameSlug('');
    setGameMunicipalityData(null);
    setVisitingSlug('');
    setVisitingRoomCode('');
    setVisitingFromPublicRoom(false);
    setVisitingMunicipalityData(null);
    setVisitingRoomName('');
    setVisitingSessionNonce(0);
    setVisitingLoading(false);
    setSubmitting(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isocity_municipality');
    }
    if (IS_ELECTRON) { window.location.href = '/steam'; return; }
    setError(`${t('error.session_ended')} (${reason})`);
    setView('login');
  }

  // ==========================================
  // GEMEINDE BESUCHEN (von Trade-Panel)
  // ==========================================
  async function handleVisitMunicipality(slug: string, roomCode?: string, roomName?: string) {
    if (visitingLoading) return;
    setVisitingLoading(true);

    try {
      const token = getAuthToken();
      if (token) setAuthToken(token);

      let visitData: MunicipalityData = createFallbackMunicipalityData(slug, gameUser);
      try {
        const mapData = await getMapData(slug);
        visitData = {
          id: mapData.municipality.id,
          name: mapData.municipality.name,
          canton: mapData.municipality.canton,
          owner: mapData.municipality.owner || mapData.administration?.owner || null,
          memberCount: mapData.administration?.member_count || 1,
          administratorCount: mapData.administration?.administrator_count || 0,
          administrators: mapData.administration?.administrators || [],
          coatOfArms: mapData.municipality.coat_of_arms || null,
        };
      } catch (err) {
        console.warn('[MainMenu] Besuchs-MapData fehlgeschlagen, nutze Fallback:', err);
      }

      setVisitingSlug(slug);
      const normalizedRoomCode = String(roomCode || slugToRoomCode(slug)).trim().toUpperCase();
      setVisitingRoomCode(normalizedRoomCode);
      setVisitingFromPublicRoom(false);
      setVisitingRoomName(String(roomName || '').trim());
      setVisitingSessionNonce((prev) => prev + 1);
      setVisitingMunicipalityData(visitData);
    } catch (err) {
      console.error('Failed to load visited municipality:', err);
    }

    setVisitingLoading(false);
  }

  // ==========================================
  // ZURÜCK ZUR EIGENEN STADT (nach Besuch)
  // ==========================================
  function handleBackToHome() {
    setVisitingSlug('');
    setVisitingRoomCode('');
    setVisitingFromPublicRoom(false);
    setVisitingMunicipalityData(null);
    setVisitingRoomName('');
    setVisitingSessionNonce(0);
  }

  // ==========================================
  // GAME VIEW (direkt auf /, kein URL-Wechsel!)
  // ==========================================
  if (view === 'game' && gameUser && gameSlug && gameMunicipalityData) {
    // Besucher-Modus: andere Gemeinde ansehen
    if (visitingSlug && visitingMunicipalityData) {
      return (
        <GameSession
          key={`visit-${visitingSlug}-${visitingRoomCode || 'MAIN'}-${visitingSessionNonce}`}
          slug={visitingSlug}
          roomCodeOverride={visitingRoomCode || undefined}
          roomNameOverride={visitingRoomName || undefined}
          user={gameUser}
          municipalityData={visitingMunicipalityData}
          onExit={handleExitGame}
          onSessionInvalid={handleSessionInvalid}
          onVisitMunicipality={handleVisitMunicipality}
          isVisiting={true}
          disablePartnerships={visitingFromPublicRoom}
          onBackToHome={handleBackToHome}
          homeCity={gameMunicipalityData.name}
        />
      );
    }

    if (visitingLoading) {
      return <LoadingScreen message={t('loading.municipality_short')} t={t} />;
    }

    // Eigene Stadt
    return (
      <GameSession
        key={`home-${gameSlug}`}
        slug={gameSlug}
        user={gameUser}
        municipalityData={gameMunicipalityData}
        onExit={handleExitGame}
        onSessionInvalid={handleSessionInvalid}
        onVisitMunicipality={handleVisitMunicipality}
      />
    );
  }


  // ==========================================
  // LOADING SCREEN
  // ==========================================
  if (view === 'loading') {
    return <LoadingScreen message={loadingMessage} municipalityName={loadingMunicipality} progress={loadingProgress ?? undefined} t={t} />;
  }

  // ==========================================
  // HAUPTMENÜ
  // ==========================================
  if (view === 'menu') {
    return (
      <main className="fixed inset-0 hero-gradient overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <Particles />
          <div className="absolute top-[8%] left-[4%] w-80 h-80 rounded-full bg-emerald-400/12 blur-[120px] animate-float" />
          <div className="absolute bottom-[8%] right-[4%] w-[28rem] h-[28rem] rounded-full bg-amber-300/12 blur-[140px] animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[46rem] h-[46rem] rounded-full bg-black/25 blur-[180px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/55" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-10">
          <div className="h-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent animate-expandWidth" />
        </div>

        {/* Language Selector */}
        <div className="fixed top-4 right-4 z-20">
          <SwissLanguageSelector locale={locale} onLocaleChange={setLocale} />
        </div>

        <section className="relative z-10 flex-1 flex items-center px-4 md:px-8 py-6 md:py-16">
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
            <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <span className="inline-flex items-center px-3 py-1 rounded-full border border-amber-300/40 bg-black/25 text-[11px] tracking-[0.18em] uppercase text-amber-200/95">
                {t('hero.badge')}
              </span>
              <h1 className="mt-3 md:mt-4 text-4xl md:text-7xl font-display font-bold leading-[0.95] tracking-[0.08em] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]">
                BünzliFight
              </h1>
              <p className="mt-3 md:mt-5 text-sm md:text-lg text-slate-200/90 leading-relaxed max-w-xl">
                {t('hero.description')}
              </p>
              <div className="mt-4 md:mt-7 w-44 hidden md:block">
                <div className="h-px w-44 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
              </div>
              <p className="mt-2 md:mt-4 text-xs tracking-[0.22em] uppercase text-slate-300/70 hidden md:block">
                {t('hero.slogan')}
              </p>
              {/* Changelog - dynamisch aus API, collapsed on mobile */}
              <ChangelogSection title={t('changelog.title')} />
            </div>

            <div className={`w-full max-w-md md:ml-auto transition-all duration-1000 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="rounded-sm p-5 md:p-7 bg-slate-950/65 backdrop-blur-sm border border-amber-300/25 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                <div className="flex flex-col gap-4 md:gap-5">
                    <img
                      src="/assets/logo.png"
                      alt="BünzliFight Logo"
                      className="h-16 md:h-20 w-auto object-contain mx-auto"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="text-center">
                      <h2 className="text-xl md:text-3xl font-display font-bold tracking-wide text-foreground">{t('auth.welcome')}</h2>
                      <p className="mt-1.5 md:mt-2 text-sm text-muted-foreground">{t('auth.subtitle')}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button
                        size="xl"
                        className="w-full relative group overflow-hidden rounded-sm h-13"
                        onClick={() => { setError(''); setView('login'); }}
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 rounded-sm transition-all duration-300 group-hover:from-emerald-500 group-hover:via-emerald-400 group-hover:to-emerald-500" />
                        <span className="relative flex items-center gap-3 font-semibold tracking-wide text-base">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                          {t('auth.login')}
                        </span>
                      </Button>
                      <Button
                        size="xl"
                        variant="outline"
                        className="w-full relative group rounded-sm border-amber-300/40 hover:border-amber-200/70 h-13 hover:bg-amber-100/10"
                        onClick={() => { setError(''); setView('register'); }}
                      >
                        <span className="flex items-center gap-3 tracking-wide text-base">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                          {t('auth.register')}
                        </span>
                      </Button>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo-Hinweis + FAQ CTA */}
        {!IS_ELECTRON && <div className="relative z-10 mx-auto max-w-4xl px-4 md:px-8 py-2">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-center sm:text-left">
              <p className="text-amber-200 text-sm font-medium">
                {t('demo.title')}
              </p>
              <p className="text-amber-200/60 text-xs">
                {t('demo.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="https://discord.gg/fSKcZrABEG"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#5865F2] hover:text-[#7289DA] text-xs font-medium transition-colors group whitespace-nowrap"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
                Discord
              </a>
              <span className="text-white/15">|</span>
              <Link
                href="/faq"
                className="inline-flex items-center gap-1.5 text-amber-200/80 hover:text-amber-100 text-xs font-medium transition-colors group whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                FAQ
                <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            </div>
          </div>
        </div>}

        <div className="relative z-10 pointer-events-none">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
        </div>
        <div className="relative z-10 flex items-center justify-center py-2">
          <ServerStatus mounted={mounted} t={t} />
        </div>
        {!IS_ELECTRON && (
          <div className={`relative z-10 text-center pb-4 transition-all duration-1000 delay-2200 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40 mb-1">
              <Link href="/impressum" className="hover:text-amber-200/70 transition-colors">{t('footer.impressum')}</Link>
              <span className="text-white/10">|</span>
              <Link href="/datenschutz" className="hover:text-amber-200/70 transition-colors">{t('footer.datenschutz')}</Link>
              <span className="text-white/10">|</span>
              <Link href="/faq" className="hover:text-amber-200/70 transition-colors">FAQ</Link>
              <span className="text-white/10">|</span>
              <Link href="/quick-guide" className="hover:text-amber-200/70 transition-colors">Handbuch</Link>
              <span className="text-white/10">|</span>
              <Link href="/kontakt" className="hover:text-amber-200/70 transition-colors">Kontakt</Link>
            </div>
            <p className="text-muted-foreground/25 text-[10px]">BünzliFight &copy; 2026</p>
          </div>
        )}
      </main>
    );
  }

  // ==========================================
  // LOGIN VIEW
  // ==========================================
  if (view === 'login') {
    return (
      <main className="fixed inset-0 hero-gradient overflow-y-auto overflow-x-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <Particles />
          <div className="absolute top-[20%] left-[10%] w-64 h-64 rounded-full bg-emerald-400/12 blur-[100px] animate-float" />
          <div className="absolute bottom-[20%] right-[10%] w-64 h-64 rounded-full bg-amber-300/12 blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

        {/* Language Selector */}
        <div className="fixed top-4 right-4 z-20">
          <SwissLanguageSelector locale={locale} onLocaleChange={setLocale} />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12 animate-cardReveal">
          <button onClick={() => { setView('menu'); setError(''); }} className="flex items-center gap-2 text-muted-foreground hover:text-amber-200 transition-colors mb-8 group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform duration-300"><polyline points="15 18 9 12 15 6" /></svg>
            <span className="text-sm tracking-wide">{t('login.back')}</span>
          </button>

          <div className="rounded-sm p-6 md:p-8 bg-slate-950/65 backdrop-blur-sm border border-amber-300/25 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-6">
                <div className="text-center mb-2">
                  <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-2 animate-riseIn" style={{ animationDelay: '0.1s' }}>BünzliFight</p>
                  <h2 className="text-3xl font-display font-bold tracking-wide text-foreground animate-riseIn" style={{ animationDelay: '0.15s' }}>{t('login.title')}</h2>
                  <div className="overflow-hidden mx-auto mt-3"><div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-amber-300/80 to-transparent animate-expandWidth" style={{ animationDelay: '0.3s' }} /></div>
                  <p className="text-muted-foreground text-sm mt-3 animate-riseIn" style={{ animationDelay: '0.25s' }}>{t('login.subtitle')}</p>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-sm px-4 py-3 text-sm text-destructive animate-riseIn">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                  <div className="space-y-2 animate-riseIn" style={{ animationDelay: '0.3s' }}>
                    <Label htmlFor="login-email" className="text-muted-foreground text-xs tracking-wider uppercase">{t('login.email')}</Label>
                    <Input id="login-email" type="email" required placeholder={t('login.email.placeholder')} value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-12 rounded-sm transition-all duration-300 focus:shadow-[0_0_20px_rgba(251,191,36,0.18)]" disabled={submitting} />
                  </div>
                  <div className="space-y-2 animate-riseIn" style={{ animationDelay: '0.4s' }}>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-muted-foreground text-xs tracking-wider uppercase">{t('login.password')}</Label>
                      <button
                        type="button"
                        className="text-xs text-amber-200/80 hover:text-amber-100 transition-colors"
                        onClick={() => {
                          setError('');
                          setForgotEmail(loginData.email || '');
                          setView('forgot');
                        }}
                      >
                        {t('login.forgot')}
                      </button>
                    </div>
                    <Input id="login-password" type="password" required placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-12 rounded-sm transition-all duration-300 focus:shadow-[0_0_20px_rgba(251,191,36,0.18)]" disabled={submitting} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer animate-riseIn" style={{ animationDelay: '0.5s' }}>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded-sm border-border bg-background/50 accent-amber-300" />
                    <span className="text-sm text-muted-foreground">{t('login.remember')}</span>
                  </label>
                  <div className="animate-riseIn" style={{ animationDelay: '0.55s' }}>
                    <Button type="submit" size="lg" className="w-full rounded-sm mt-2 h-12 font-semibold tracking-wide group relative overflow-hidden" disabled={submitting}>
                      <span className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 rounded-sm transition-all duration-300 group-hover:from-emerald-500 group-hover:via-emerald-400 group-hover:to-emerald-500" />
                      {submitting ? (
                        <span className="relative flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                          {t('login.submitting')}
                        </span>
                      ) : (
                        <span className="relative flex items-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                          {t('login.submit')}
                        </span>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="flex items-center gap-4 animate-riseIn" style={{ animationDelay: '0.6s' }}><div className="flex-1 h-px bg-border/30" /><span className="text-xs text-muted-foreground/50 tracking-wider uppercase">{t('login.or')}</span><div className="flex-1 h-px bg-border/30" /></div>

                {/* Google Login Button */}
                <button
                  onClick={() => { if (referralCode) localStorage.setItem('google_oauth_referral_code', referralCode); if (referralMunicipalitySlug) localStorage.setItem('google_oauth_municipality_slug', referralMunicipalitySlug); window.location.href = `${AUTH_API_BASE_URL}/api/auth/google`; }}
                  className="flex items-center justify-center gap-3 w-full h-12 rounded-sm border border-border/50 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-slate-200 animate-riseIn"
                  style={{ animationDelay: '0.62s' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Mit Google anmelden
                </button>

                <p className="text-center text-sm text-muted-foreground animate-riseIn" style={{ animationDelay: '0.65s' }}>{t('login.no_account')}{' '}<button onClick={() => { setView('register'); setError(''); }} className="text-amber-200/85 hover:text-amber-100 font-medium transition-colors">{t('login.to_register')}</button></p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0"><div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" /></div>
      </main>
    );
  }

  // ==========================================
  // FORGOT PASSWORD VIEW
  // ==========================================
  if (view === 'forgot') {
    return (
      <main className="fixed inset-0 hero-gradient overflow-y-auto overflow-x-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <Particles />
          <div className="absolute top-[20%] left-[10%] w-64 h-64 rounded-full bg-emerald-400/12 blur-[100px] animate-float" />
          <div className="absolute bottom-[20%] right-[10%] w-64 h-64 rounded-full bg-amber-300/12 blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

        {/* Language Selector */}
        <div className="fixed top-4 right-4 z-20">
          <SwissLanguageSelector locale={locale} onLocaleChange={setLocale} />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12 animate-cardReveal">
          <button onClick={() => { setView('login'); setError(''); }} className="flex items-center gap-2 text-muted-foreground hover:text-amber-200 transition-colors mb-8 group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform duration-300"><polyline points="15 18 9 12 15 6" /></svg>
            <span className="text-sm tracking-wide">{t('forgot.back')}</span>
          </button>

          <div className="rounded-sm p-8 bg-slate-950/65 backdrop-blur-sm border border-amber-300/25 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-6">
              <div className="text-center mb-1">
                <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-2 animate-riseIn" style={{ animationDelay: '0.1s' }}>BünzliFight</p>
                <h2 className="text-3xl font-display font-bold tracking-wide text-foreground animate-riseIn" style={{ animationDelay: '0.15s' }}>{t('forgot.title')}</h2>
                <div className="overflow-hidden mx-auto mt-3"><div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-amber-300/80 to-transparent animate-expandWidth" style={{ animationDelay: '0.3s' }} /></div>
                <p className="text-muted-foreground text-sm mt-3 animate-riseIn" style={{ animationDelay: '0.25s' }}>
                  {t('forgot.subtitle')}
                </p>
              </div>

              <form onSubmit={handleOpenForgotPassword} className="flex flex-col gap-5">
                <div className="space-y-2 animate-riseIn" style={{ animationDelay: '0.3s' }}>
                  <Label htmlFor="forgot-email" className="text-muted-foreground text-xs tracking-wider uppercase">{t('forgot.email')}</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder={t('login.email.placeholder')}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-amber-300/70 h-12 rounded-sm transition-all duration-300 focus:shadow-[0_0_20px_rgba(251,191,36,0.18)]"
                  />
                </div>
                <div className="animate-riseIn" style={{ animationDelay: '0.4s' }}>
                  <Button type="submit" size="lg" className="w-full rounded-sm mt-2 h-12 font-semibold tracking-wide group relative overflow-hidden">
                    <span className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 rounded-sm transition-all duration-300 group-hover:from-emerald-500 group-hover:via-emerald-400 group-hover:to-emerald-500" />
                    <span className="relative flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      {t('forgot.submit')}
                    </span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0"><div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" /></div>
      </main>
    );
  }

  // ==========================================
  // REGISTER VIEW
  // ==========================================
  return (
    <main className="fixed inset-0 hero-gradient overflow-y-auto overflow-x-hidden">
      {/* Konfetti-Overlay nach Referral-Registrierung */}
      {showReferralOverlay && referredByNickname && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm pointer-events-none">
          <div className="confetti-container" aria-hidden="true">
            {Array.from({ length: 22 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${4 + i * 4.2}%`,
                  background: ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'][i % 6],
                  animationDuration: `${1.4 + (i % 7) * 0.3}s`,
                  animationDelay: `${(i % 5) * 0.08}s`,
                  width: `${8 + (i % 3) * 4}px`,
                  height: `${8 + (i % 3) * 4}px`,
                  borderRadius: i % 2 === 0 ? '2px' : '50%',
                }}
              />
            ))}
          </div>
          <div className="relative z-10 text-center px-6 max-w-xs animate-riseIn">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-amber-300 mb-3">Herzlich willkommen!</h3>
            <p className="text-slate-200 text-base leading-relaxed">
              Du wurdest geworben von{' '}
              <span className="font-bold text-emerald-400">{referredByNickname}</span>
              , du bekommst{' '}
              <span className="font-bold text-amber-300">800 Fr</span>{' '}
              Startguthaben!
            </p>
          </div>
        </div>
      )}

      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <Particles />
        <div className="absolute top-[15%] right-[5%] w-64 h-64 rounded-full bg-emerald-400/12 blur-[100px] animate-float" />
        <div className="absolute bottom-[10%] left-[10%] w-72 h-72 rounded-full bg-amber-300/12 blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      {/* Language Selector */}
      <div className="fixed top-4 right-4 z-20">
        <SwissLanguageSelector locale={locale} onLocaleChange={setLocale} />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto px-3 md:px-4 py-6 md:py-12 animate-cardReveal">
        <button onClick={() => { setView('menu'); setError(''); }} className="flex items-center gap-2 text-muted-foreground hover:text-amber-200 transition-colors mb-4 md:mb-6 group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform duration-300"><polyline points="15 18 9 12 15 6" /></svg>
          <span className="text-sm tracking-wide">{t('register.back')}</span>
        </button>

        <div className="rounded-sm p-5 md:p-8 bg-slate-950/65 backdrop-blur-sm border border-amber-300/25 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:gap-6">
              <div className="text-center mb-1 md:mb-2">
                <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-2 animate-riseIn" style={{ animationDelay: '0.1s' }}>BünzliFight</p>
                <h2 className="text-2xl md:text-3xl font-display font-bold tracking-wide text-foreground animate-riseIn" style={{ animationDelay: '0.15s' }}>{t('register.title')}</h2>
                <div className="overflow-hidden mx-auto mt-3"><div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-amber-300/80 to-transparent animate-expandWidth" style={{ animationDelay: '0.3s' }} /></div>
                <p className="text-muted-foreground text-sm mt-3 animate-riseIn" style={{ animationDelay: '0.25s' }}>{t('register.subtitle')}</p>
              </div>

              {referralCode && (
                <>
                  {/* Konfetti auf dem Register-Formular */}
                  <div className="confetti-container" aria-hidden="true">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div
                        key={i}
                        className="confetti-piece"
                        style={{
                          left: `${5 + i * 5.2}%`,
                          background: ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'][i % 6],
                          animationDuration: `${1.6 + (i % 6) * 0.35}s`,
                          animationDelay: `${i * 0.07}s`,
                          width: `${7 + (i % 3) * 4}px`,
                          height: `${7 + (i % 3) * 4}px`,
                          borderRadius: i % 2 === 0 ? '2px' : '50%',
                        }}
                      />
                    ))}
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-sm px-4 py-4 text-sm text-emerald-200 flex items-start gap-3 animate-riseIn">
                    <span className="text-2xl shrink-0">🎁</span>
                    <div>
                      {referralBannerNickname ? (
                        <p>Du wurdest von <strong className="text-emerald-300">{referralBannerNickname}</strong> eingeladen!</p>
                      ) : (
                        <p className="font-semibold text-emerald-300">Einladungsbonus aktiv!</p>
                      )}
                      <p className="mt-0.5">Du erhältst <strong className="text-amber-300">800 Fr</strong> Startguthaben statt der üblichen 500 Fr.</p>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-sm px-4 py-3 text-sm text-destructive animate-riseIn">
                  {error}
                </div>
              )}

              {/* Google-Setup Banner */}
              {isGoogleSetup && (
                <div className="flex items-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/30 px-3 py-2 mb-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span className="text-xs text-blue-300">Mit Google angemeldet — wähl dini Gmeind und bestätige dinen Usernamen</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="flex flex-col gap-3 md:gap-4">
                {/* Vorname/Nachname nur bei normaler Registrierung */}
                {!isGoogleSetup && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-riseIn" style={{ animationDelay: '0.3s' }}>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-firstname" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.firstname')}</Label>
                      <Input id="reg-firstname" type="text" required placeholder="Max" value={registerData.first_name} onChange={(e) => setRegisterData({ ...registerData, first_name: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-lastname" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.lastname')}</Label>
                      <Input id="reg-lastname" type="text" required placeholder="Muster" value={registerData.last_name} onChange={(e) => setRegisterData({ ...registerData, last_name: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                    </div>
                  </div>
                )}

                <div className="space-y-2 animate-riseIn" style={{ animationDelay: '0.35s' }}>
                  <Label htmlFor="reg-nickname" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.nickname')}</Label>
                  <Input id="reg-nickname" type="text" required placeholder="CityBuilder2026" value={registerData.nickname} onChange={(e) => setRegisterData({ ...registerData, nickname: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                </div>

                {/* Email, Geschlecht, Geburtstag, Passwort nur bei normaler Registrierung */}
                {!isGoogleSetup && (<>
                  <div className="space-y-2 animate-riseIn" style={{ animationDelay: '0.4s' }}>
                    <Label htmlFor="reg-email" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.email')}</Label>
                    <Input id="reg-email" type="email" required placeholder={t('login.email.placeholder')} value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-riseIn" style={{ animationDelay: '0.45s' }}>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-gender" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.gender')}</Label>
                      <select id="reg-gender" required value={registerData.gender} onChange={(e) => setRegisterData({ ...registerData, gender: e.target.value })} className="flex h-11 w-full rounded-sm border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-200/20 text-foreground" disabled={submitting}>
                        <option value="male">{t('register.gender.male')}</option><option value="female">{t('register.gender.female')}</option><option value="other">{t('register.gender.other')}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-birthday" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.birthday')}</Label>
                      <Input id="reg-birthday" type="date" required value={registerData.birthday} onChange={(e) => setRegisterData({ ...registerData, birthday: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-riseIn" style={{ animationDelay: '0.5s' }}>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.password')}</Label>
                      <Input id="reg-password" type="password" required placeholder="••••••••" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password-confirm" className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.password_confirm')}</Label>
                      <Input id="reg-password-confirm" type="password" required placeholder="••••••••" value={registerData.password_confirmation} onChange={(e) => setRegisterData({ ...registerData, password_confirmation: e.target.value })} className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm" disabled={submitting} />
                    </div>
                  </div>
                </>)}

                <div className="space-y-2 animate-riseIn" style={{ animationDelay: '0.55s' }}>
                  <Label className="text-muted-foreground text-xs tracking-wider uppercase">{t('register.municipality')}</Label>

                  {!createMunicipality ? (
                    <>
                      {/* Ausgewählte Gemeinde anzeigen */}
                      {registerData.municipality_id ? (() => {
                        const sel = availableMunicipalities.find((m) => String(m.id) === registerData.municipality_id);
                        if (!sel) return null;
                        const count = sel.members_count ?? 0;
                        const pct = Math.round((count / MAX_MEMBERS_PER_MUNICIPALITY) * 100);
                        return (
                          <div className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-emerald-400 text-sm shrink-0">&#10003;</span>
                                <span className="text-sm font-medium text-foreground truncate">{sel.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">({sel.canton_code})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setRegisterData({ ...registerData, municipality_id: '' }); setMunicipalitySearch(''); }}
                                className="text-muted-foreground hover:text-foreground text-lg leading-none ml-2 shrink-0"
                              >&times;</button>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{t('register.members')}</span>
                                <span className={`font-mono font-semibold ${count >= MAX_MEMBERS_PER_MUNICIPALITY ? 'text-red-400' : count >= MAX_MEMBERS_PER_MUNICIPALITY * 0.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {count} / {MAX_MEMBERS_PER_MUNICIPALITY}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-background/80 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${count >= MAX_MEMBERS_PER_MUNICIPALITY ? 'bg-red-500' : count >= MAX_MEMBERS_PER_MUNICIPALITY * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })() : (
                        /* Autocomplete Suchfeld */
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder={municipalitiesLoading ? t('register.loading_municipalities') : t('register.search_municipality')}
                            value={municipalitySearch}
                            onChange={(e) => setMunicipalitySearch(e.target.value)}
                            className="bg-background/50 border-border/50 focus:border-amber-300/70 h-11 rounded-sm"
                            disabled={submitting || municipalitiesLoading}
                            autoComplete="off"
                          />

                          {/* Autocomplete Ergebnisse */}
                          {municipalitySearch.trim().length >= 1 && !registerData.municipality_id && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-52 overflow-y-auto rounded-sm border border-border/50 bg-[hsl(222_47%_11%/0.98)] shadow-xl backdrop-blur-sm">
                              {(() => {
                                const q = municipalitySearch.toLowerCase().trim();
                                const filtered = availableMunicipalities
                                  .filter((m) =>
                                    m.name.toLowerCase().includes(q) ||
                                    m.canton_code.toLowerCase() === q ||
                                    m.canton_name.toLowerCase().includes(q)
                                  )
                                  .sort((a, b) => {
                                    const an = a.name.toLowerCase();
                                    const bn = b.name.toLowerCase();
                                    // Exakter Name-Treffer zuerst, dann "beginnt mit", dann Rest
                                    const aScore = an === q ? 0 : an.startsWith(q) ? 1 : 2;
                                    const bScore = bn === q ? 0 : bn.startsWith(q) ? 1 : 2;
                                    if (aScore !== bScore) return aScore - bScore;
                                    return an.localeCompare(bn, 'de-CH');
                                  })
                                  .slice(0, 15);

                                if (filtered.length === 0) {
                                  return (
                                    <div className="px-3 py-3 text-xs text-muted-foreground/60">{t('register.no_municipalities')}</div>
                                  );
                                }

                                return filtered.map((m) => {
                                  const count = m.members_count ?? 0;
                                  const isFull = count >= MAX_MEMBERS_PER_MUNICIPALITY;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      disabled={isFull}
                                      onClick={() => {
                                        setRegisterData({ ...registerData, municipality_id: String(m.id) });
                                        setMunicipalitySearch(m.name);
                                      }}
                                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 border-b border-border/20 last:border-b-0 transition-colors ${isFull ? 'opacity-40 cursor-not-allowed' : 'hover:bg-amber-300/10 cursor-pointer'}`}
                                    >
                                      <div className="min-w-0">
                                        <span className="text-sm text-foreground font-medium">{m.name}</span>
                                        <span className="text-xs text-muted-foreground ml-1.5">({m.canton_code})</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`text-xs font-mono ${isFull ? 'text-red-400' : count >= MAX_MEMBERS_PER_MUNICIPALITY * 0.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                          {count}/{MAX_MEMBERS_PER_MUNICIPALITY}
                                        </span>
                                        {isFull && <span className="text-[10px] text-red-400 font-semibold uppercase">{t('register.full')}</span>}
                                      </div>
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground/50">{t('register.first_player_owner')}</p>
                    </>
                  ) : (
                    <>
                      {/* Neue Gemeinde erstellen - Eingabefeld */}
                      <Input
                        type="text"
                        placeholder={t('register.custom_municipality_placeholder')}
                        value={newMunicipalityName}
                        onChange={(e) => setNewMunicipalityName(e.target.value)}
                        className="bg-background/50 border-border/50 focus:border-emerald-400/70 h-11 rounded-sm"
                        disabled={submitting}
                        required={createMunicipality}
                        minLength={2}
                        maxLength={100}
                      />
                      <p className="text-xs text-muted-foreground/50">{t('register.auto_owner')}</p>
                    </>
                  )}

                  {/* Gemeinde erstellen Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mt-2 py-2 px-3 rounded-sm border border-dashed border-border/40 hover:border-amber-300/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={createMunicipality}
                      onChange={(e) => {
                        setCreateMunicipality(e.target.checked);
                        if (e.target.checked) {
                          setRegisterData({ ...registerData, municipality_id: '' });
                          setMunicipalitySearch('');
                        } else {
                          setNewMunicipalityName('');
                        }
                      }}
                      className="w-4 h-4 rounded-sm border-border bg-background/50 accent-amber-300"
                      disabled={submitting}
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {t('register.create_municipality')}
                    </span>
                  </label>
                </div>

                <label className="flex items-start gap-2 cursor-pointer mt-1 animate-riseIn" style={{ animationDelay: '0.6s' }}>
                  <input type="checkbox" required className="w-4 h-4 mt-0.5 rounded-sm border-border bg-background/50 accent-amber-300" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{t('register.accept_terms')}{' '}<button type="button" onClick={(ev) => { ev.preventDefault(); setShowTerms(true); }} className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors">{t('register.terms')}</button>{' '}{t('register.and')}{' '}<button type="button" onClick={(ev) => { ev.preventDefault(); setShowPrivacy(true); }} className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors">{t('register.privacy')}</button></span>
                </label>

                <div className="animate-riseIn" style={{ animationDelay: '0.65s' }}>
                  <Button type="submit" size="lg" className="w-full rounded-sm mt-2 h-12 font-semibold tracking-wide group relative overflow-hidden" disabled={submitting}>
                    <span className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 rounded-sm transition-all duration-300 group-hover:from-emerald-500 group-hover:via-emerald-400 group-hover:to-emerald-500" />
                    {submitting ? (
                      <span className="relative flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                        {t('register.submitting')}
                      </span>
                    ) : (
                      <span className="relative flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                        {isGoogleSetup ? 'Abschliessen & Losspielen' : t('register.submit')}
                      </span>
                    )}
                  </Button>
                </div>
              </form>

              {!isGoogleSetup && (<>
              <div className="flex items-center gap-4 animate-riseIn" style={{ animationDelay: '0.7s' }}><div className="flex-1 h-px bg-border/30" /><span className="text-xs text-muted-foreground/50 tracking-wider uppercase">{t('register.or')}</span><div className="flex-1 h-px bg-border/30" /></div>

              {/* Google Register Button */}
              <button
                onClick={() => { if (referralCode) localStorage.setItem('google_oauth_referral_code', referralCode); if (referralMunicipalitySlug) localStorage.setItem('google_oauth_municipality_slug', referralMunicipalitySlug); window.location.href = `${AUTH_API_BASE_URL}/api/auth/google`; }}
                className="flex items-center justify-center gap-3 w-full h-12 rounded-sm border border-border/50 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-slate-200 animate-riseIn"
                style={{ animationDelay: '0.72s' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Mit Google registrieren
              </button>
              </>)}

              <p className="text-center text-sm text-muted-foreground animate-riseIn" style={{ animationDelay: '0.75s' }}>{t('register.has_account')}{' '}<button onClick={() => { setView('login'); setError(''); }} className="text-amber-200/85 hover:text-amber-100 font-medium transition-colors">{t('register.to_login')}</button></p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0"><div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" /></div>

      {/* ==================== NUTZUNGSBEDINGUNGEN MODAL ==================== */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-sm border border-border/50 bg-[hsl(222_47%_11%/0.98)] shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/30 bg-[hsl(222_47%_11%/0.98)]">
              <h2 className="text-lg font-semibold text-foreground">{t('modal.terms.title')}</h2>
              <button type="button" onClick={() => setShowTerms(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p className="text-xs text-muted-foreground/50">Stand: Februar 2026</p>

              <section>
                <h3 className="text-foreground font-medium mb-1">Privates Hobbyprojekt</h3>
                <p>BuenzliFight ist ein privates, nicht-kommerzielles Hobbyprojekt von Marc Gatschet (Bielstrasse 2, 2540 Grenchen, Schweiz). Es handelt sich nicht um ein Angebot einer Firma oder eines Unternehmens.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">1. Geltungsbereich</h3>
                <p>Diese Nutzungsbedingungen gelten für die Nutzung von BünzliFight (nachfolgend &quot;Spiel&quot;). Mit der Registrierung akzeptierst du diese Bedingungen.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">2. Registrierung &amp; Konto</h3>
                <p>Für die Nutzung ist ein Konto erforderlich. Du bist für die Sicherheit deiner Zugangsdaten selbst verantwortlich. Jeder Spieler darf nur ein Konto besitzen.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">3. Spielregeln</h3>
                <p>Jede Gemeinde kann maximal 25 Mitglieder haben. Der erste Spieler einer Gemeinde wird automatisch deren Besitzer. Unfaires Verhalten, Betrug oder Beleidigungen führen zur Sperrung des Kontos.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">4. Verfügbarkeit</h3>
                <p>Das Spiel befindet sich in der Entwicklung. Es kann jederzeit zu Ausfällen, Änderungen oder Resets kommen. Es besteht kein Anspruch auf eine bestimmte Verfügbarkeit.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">5. Haftung</h3>
                <p>Die Nutzung erfolgt auf eigene Verantwortung. Als Privatperson und Hobby-Entwickler übernehme ich keine Haftung für Datenverlust, Spielunterbrechungen oder sonstige Schäden.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">6. Änderungen</h3>
                <p>Ich behalte mir vor, diese Nutzungsbedingungen jederzeit zu ändern. Wesentliche Änderungen werden im Spiel kommuniziert.</p>
              </section>
            </div>
            <div className="sticky bottom-0 px-6 py-3 border-t border-border/30 bg-[hsl(222_47%_11%/0.98)]">
              <button type="button" onClick={() => setShowTerms(false)} className="w-full py-2.5 rounded-sm bg-amber-300/15 hover:bg-amber-300/25 text-amber-200 text-sm font-medium transition-colors">{t('modal.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DATENSCHUTZRICHTLINIEN MODAL ==================== */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPrivacy(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-sm border border-border/50 bg-[hsl(222_47%_11%/0.98)] shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/30 bg-[hsl(222_47%_11%/0.98)]">
              <h2 className="text-lg font-semibold text-foreground">{t('modal.privacy.title')}</h2>
              <button type="button" onClick={() => setShowPrivacy(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p className="text-xs text-muted-foreground/50">Stand: Februar 2026</p>

              <section>
                <h3 className="text-foreground font-medium mb-1">Verantwortliche Person</h3>
                <p>Marc Gatschet, Bielstrasse 2, 2540 Grenchen, Schweiz. Dies ist ein privates Hobbyprojekt — kein Angebot einer Firma. Kontakt: admin@buenzlifight.ch</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">1. Welche Daten werden erhoben?</h3>
                <p>Bei der Registrierung speichere ich: E-Mail-Adresse, Nickname, Vorname, Nachname, Geschlecht, Geburtsdatum und die gewählte Gemeinde. Beim Spielen werden Spielfortschritte und Aktionen gespeichert.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">2. Zweck der Datenverarbeitung</h3>
                <p>Deine Daten werden ausschliesslich für den Betrieb des Spiels verwendet: Kontoverwaltung, Spielstand-Speicherung, Gemeinde-Zuordnung und Anzeige im Spiel. Es findet keine Datenverarbeitung zu Werbezwecken oder Marketing statt.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">3. Speicherung &amp; Sicherheit</h3>
                <p>Passwörter werden verschlüsselt (gehasht) gespeichert. Deine Daten werden auf Servern in der Schweiz bzw. Europa gehostet. Als Hobby-Entwickler treffe ich angemessene technische Massnahmen zum Schutz deiner Daten.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">4. Weitergabe an Dritte</h3>
                <p>Deine Daten werden nicht an Dritte verkauft oder weitergegeben. Ausnahmen bestehen nur bei gesetzlicher Pflicht.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">5. Deine Rechte</h3>
                <p>Du hast das Recht auf Auskunft, Berichtigung und Löschung deiner Daten. Kontaktiere mich hierzu per E-Mail an admin@buenzlifight.ch.</p>
              </section>

              <section>
                <h3 className="text-foreground font-medium mb-1">6. Cookies &amp; Lokale Speicherung</h3>
                <p>Es werden keine Tracking-Cookies eingesetzt. Für die Sitzungsverwaltung wird ein Auth-Token im localStorage gespeichert. Die vollständige Datenschutzerklärung findest du unter /datenschutz.</p>
              </section>
            </div>
            <div className="sticky bottom-0 px-6 py-3 border-t border-border/30 bg-[hsl(222_47%_11%/0.98)]">
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-full py-2.5 rounded-sm bg-amber-300/15 hover:bg-amber-300/25 text-amber-200 text-sm font-medium transition-colors">{t('modal.close')}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Changelog Section (dynamisch aus API) ──────────────────────────
function ChangelogSection({ title }: { title: string }) {
  const [entries, setEntries] = useState<Array<{ version: string; tag: string; message: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${AUTH_API_BASE_URL}/api/changelog`)
      .then(r => r.json())
      .then(json => {
        if (json.ok && Array.isArray(json.data?.entries)) {
          setEntries(json.data.entries);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const TAG_STYLES: Record<string, { label: string; color: string }> = {
    neu: { label: 'Neu', color: 'text-emerald-300' },
    fix: { label: 'Fix', color: 'text-cyan-300' },
    entfernt: { label: 'Entfernt', color: 'text-slate-400' },
  };

  // Gruppiere nach Version
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    if (!acc[e.version]) acc[e.version] = [];
    acc[e.version].push(e);
    return acc;
  }, {});

  if (!loaded || entries.length === 0) return null;

  return (
    <details className="mt-4 md:mt-5 max-w-xl rounded-sm border border-white/15 bg-black/35 backdrop-blur-sm group">
      <summary className="p-3 md:p-4 cursor-pointer list-none flex items-center justify-between">
        <p className="text-[11px] tracking-[0.2em] uppercase text-amber-200/90">{title}</p>
        <svg className="w-4 h-4 text-amber-200/60 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="px-3 pb-3 md:px-4 md:pb-4 space-y-1.5 md:space-y-2 text-xs md:text-sm text-slate-200/90">
        {Object.entries(grouped).map(([version, versionEntries], i) => (
          <React.Fragment key={version}>
            <p className={`text-[10px] tracking-[0.15em] uppercase text-amber-200/60 ${i > 0 ? 'pt-2' : 'pt-1'}`}>{version}</p>
            {versionEntries.map((entry, j) => {
              const style = TAG_STYLES[entry.tag] || TAG_STYLES.neu;
              return (
                <p key={j}><span className={`${style.color} font-medium`}>{style.label}:</span> {entry.message}</p>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </details>
  );
}
