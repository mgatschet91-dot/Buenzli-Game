'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { GameErrorBoundary } from '@/components/GameErrorBoundary';
import { GameProvider } from '@/context/GameContext';
import { MultiplayerContextProvider, useMultiplayer } from '@/context/MultiplayerContext';
import Game from '@/components/Game';
import { useRouter, useSearchParams } from 'next/navigation';
import { setCurrentMunicipality } from '@/lib/api/database';
import { setAuthToken, getMapData, getCantonData, ApiError } from '@/lib/api/coreApi';
import { useGame } from '@/context/GameContext';
import { preloadGameAssets } from '@/components/game/imageLoader';
import { getActiveSpritePack } from '@/lib/renderConfig';
import { WATER_ASSET_PATH, AIRPLANE_SPRITE_SRC } from '@/components/game/constants';
import { generateAdjacentCitiesFromCanton } from '@/lib/simulation';

interface GameUser {
  id: number;
  name: string;
  nickname: string;
  email: string;
  municipality_id: number | null;
  municipality_slug?: string | null;
  municipality_name?: string | null;
  global_role?: string | null;
  user_rank?: number | null;
}

interface AuthStatus {
  authenticated: boolean;
  user: GameUser | null;
  loading: boolean;
  token: string | null;
}

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function slugToRoomCode(slug: string): string {
  const normalized = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 5)
    .padEnd(5, 'X');
  return normalized;
}

function LoadingScreen({ message = 'Laden...', progress }: { message?: string; progress?: number }) {
  return (
    <main className="min-h-screen hero-gradient flex flex-col items-center justify-center gap-5">
      <h1 className="text-4xl font-display font-bold tracking-[0.12em] animate-blueShimmer">BuenzliFight</h1>
      {typeof progress === 'number' ? (
        <div className="w-48 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : (
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      )}
      <p className="text-muted-foreground/70 text-sm">{message}</p>
    </main>
  );
}

// ── AutoJoinMultiplayerGame ──────────────────────────────────────────────────
// Canton-Daten werden jetzt VOR dem Game-Mount geladen und als initialAdjacentCities
// direkt an GameProvider übergeben. Diese Komponente muss nur noch Partnerships
// laden und den Multiplayer-Room verbinden.

function AutoJoinMultiplayerGame({
  roomCode,
  cityName,
  currentSlug,
  onExit,
  onBackToHome,
  cannotEditSettings,
  isFullyViewOnly,
  isOwner,
  canUseDebug,
  ownerName,
  municipalityName,
  memberCount,
  administrators,
  coatOfArms,
}: {
  roomCode: string;
  cityName: string;
  currentSlug: string;
  onExit: () => void;
  onBackToHome?: () => void;
  cannotEditSettings: boolean;
  isFullyViewOnly: boolean;
  isOwner: boolean;
  canUseDebug: boolean;
  ownerName?: string;
  municipalityName?: string;
  memberCount?: number;
  administrators?: Array<{ id: number; nickname: string }>;
  coatOfArms?: { svg: string | null; image_url: string | null } | null;
}) {
  const multiplayer = useMultiplayer();
  const { state, loadPartnershipsFromApi } = useGame();
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const hasAttemptedConnection = React.useRef(false);

  useEffect(() => {
    if (hasAttemptedConnection.current) return;
    hasAttemptedConnection.current = true;

    async function connectToRoom() {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        // Partnerships laden (Canton-Daten sind bereits als initialAdjacentCities im GameProvider)
        try {
          await loadPartnershipsFromApi();
        } catch (err) {
          console.error('[Gemeinde] Konnte Partnerschaften nicht laden:', err);
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
  }, [roomCode, cityName, currentSlug, multiplayer, state, loadPartnershipsFromApi, isFullyViewOnly]);

  if (isConnecting) {
    return <LoadingScreen message={`Verbinde mit ${cityName}...`} />;
  }

  if (connectionError) {
    console.warn('[Gemeinde] Playing in offline mode:', connectionError);
  }

  return <Game onExit={onExit} onBackToHome={onBackToHome} isViewOnly={cannotEditSettings} isFullyViewOnly={isFullyViewOnly} isOwner={isOwner} canUseDebug={canUseDebug} ownerName={ownerName} municipalityName={municipalityName} memberCount={memberCount} administrators={administrators} coatOfArms={coatOfArms} />;
}

// ── Inner content with auth + municipality loading ───────────────────────────

function GemeindeGameContent({ slug, onNotAuthenticated }: { slug: string; onNotAuthenticated: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');

  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    user: null,
    loading: true,
    token: null,
  });
  const [municipalityData, setMunicipalityData] = useState<{
    id: number;
    name: string;
    canton: string;
    owner: { id: number; nickname: string } | null;
    memberCount: number;
    administratorCount: number;
    administrators: Array<{ id: number; nickname: string }>;
    coatOfArms: { svg: string | null; image_url: string | null } | null;
  } | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Pre-gefetchte Canton-Gemeinden für Adjacent Cities
  const [cantonMunicipalities, setCantonMunicipalities] = useState<Array<{ name: string; slug: string }> | null>(null);
  const [cantonDataReady, setCantonDataReady] = useState(false);

  // ── Auth Check ──
  useEffect(() => {
    async function checkAuth() {
      const token = urlToken || (typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null);

      if (token) {
        try {
          const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const authOk = (data?.ok === true) || (data?.success === true && data?.authenticated === true);
            if (authOk && data.user) {
              if (typeof window !== 'undefined') {
                localStorage.setItem('isocity_auth_token', token);
                const userName = data.user?.nickname || data.user?.name;
                if (userName && userName.trim() !== '') {
                  localStorage.setItem('isocity_user_name', userName);
                }
                if (data.user?.id) localStorage.setItem('isocity_user_id', String(data.user.id));
                localStorage.setItem('isocity_user_rank', String(Number(data.user?.user_rank || 0)));
                localStorage.setItem('isocity_global_role', String(data.user?.global_role || 'user'));
              }
              setAuthToken(token);

              if (urlToken) {
                window.history.replaceState({}, '', `/gemeinde/${slug}`);
              }

              setAuthStatus({ authenticated: true, user: data.user, loading: false, token });
              return;
            }
          }

          if (typeof window !== 'undefined') {
            localStorage.removeItem('isocity_auth_token');
            localStorage.removeItem('isocity_user_rank');
            localStorage.removeItem('isocity_global_role');
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('isocity_auth_token');
            localStorage.removeItem('isocity_user_rank');
            localStorage.removeItem('isocity_global_role');
          }
        }
      }

      setAuthStatus({ authenticated: false, user: null, loading: false, token: null });
      onNotAuthenticated();
    }

    checkAuth();
  }, [urlToken, slug, onNotAuthenticated]);

  // ── Parallel Preloading: Assets + Canton-Daten (gleichzeitig) ──
  useEffect(() => {
    if (!authStatus.authenticated || !municipalityData) return;

    const canton = municipalityData.canton;

    // 1) Sprites & Game-Assets
    const pack = getActiveSpritePack();
    preloadGameAssets(pack, WATER_ASSET_PATH, AIRPLANE_SPRITE_SRC, (loaded, total) => {
      setLoadingProgress(loaded / total);
    }).then(() => {
      setAssetsReady(true);
    }).catch((err) => {
      console.warn('[GemeindeGame] Asset preload fehlgeschlagen, starte trotzdem:', err);
      setAssetsReady(true);
    });

    // 2) Canton-Daten (für initialAdjacentCities an GameProvider)
    if (canton) {
      getCantonData(canton).then(data => {
        if (data?.municipalities && data.municipalities.length > 0) {
          setCantonMunicipalities(
            data.municipalities.map(m => ({ name: m.name, slug: m.slug }))
          );
        }
        setCantonDataReady(true);
      }).catch(() => { setCantonDataReady(true); });
    } else {
      setCantonDataReady(true);
    }
  }, [authStatus.authenticated, municipalityData, slug]);

  // ── Municipality-Daten laden ──
  useEffect(() => {
    async function loadMunicipality() {
      if (!slug) return;
      setCurrentMunicipality(slug);

      try {
        const mapData = await getMapData(slug);
        setMunicipalityData({
          id: mapData.municipality.id,
          name: mapData.municipality.name,
          canton: mapData.municipality.canton,
          owner: mapData.municipality.owner || mapData.administration?.owner || null,
          memberCount: mapData.administration?.member_count || 1,
          administratorCount: mapData.administration?.administrator_count || 0,
          administrators: mapData.administration?.administrators || [],
          coatOfArms: mapData.municipality.coat_of_arms || null,
        });
      } catch (error) {
        console.error('Failed to load municipality:', error);
        if (error instanceof ApiError && error.statusCode === 404) {
          setMunicipalityData(null);
        }
      }
    }

    loadMunicipality();
  }, [slug]);

  // ── Pre-compute Adjacent Cities aus Canton-Daten ──
  const initialAdjacentCities = useMemo(() => {
    if (!cantonMunicipalities || cantonMunicipalities.length === 0) return undefined;
    return generateAdjacentCitiesFromCanton(cantonMunicipalities, slug);
  }, [cantonMunicipalities, slug]);

  const handleExitGame = () => {
    router.push('/');
  };

  // ── Render: Loading States ──
  if (authStatus.loading) {
    return <LoadingScreen message="Pruefe Anmeldung..." />;
  }

  if (!authStatus.authenticated) {
    return <LoadingScreen message="Laden..." />;
  }

  if (!municipalityData) {
    return <LoadingScreen message={`Lade ${slug}...`} />;
  }

  if (!assetsReady || !cantonDataReady) {
    const msg = !assetsReady ? 'Lade Spielgrafiken...' : 'Lade Kanton-Daten...';
    return <LoadingScreen message={msg} progress={loadingProgress} />;
  }

  // ── Alles geladen – Game starten ──
  const isOwner = authStatus.user?.id === municipalityData.owner?.id;
  const isAdmin = municipalityData.administrators?.some(
    (admin) => admin.id === authStatus.user?.id
  ) ?? false;
  const isMember = authStatus.user?.municipality_id === municipalityData.id;
  const userRank = Number(authStatus.user?.user_rank || 0);
  const isGlobalAdministrator = String(authStatus.user?.global_role || '').toLowerCase() === 'administrator';
  const canUseDebug = userRank >= 7 || isGlobalAdministrator;
  const canEditSettings = isOwner || isAdmin || isGlobalAdministrator;
  const isFullyViewOnly = !isMember && !isOwner && !isAdmin && !isGlobalAdministrator;
  const municipalityRole: 'owner' | 'council' | 'citizen' | 'observer' =
    isOwner ? 'owner' : isAdmin ? 'council' : isMember ? 'citizen' : 'observer';

  const roomCode = slugToRoomCode(slug);
  const isVisitingForeignMunicipality = !isMember && !isOwner;
  const ownSlug = authStatus.user?.municipality_slug;
  const handleBackToHome = isVisitingForeignMunicipality && ownSlug
    ? () => router.push(`/gemeinde/${ownSlug}`)
    : undefined;

  return (
    <GameErrorBoundary municipalitySlug={slug}>
    <MultiplayerContextProvider playerName={authStatus.user?.nickname || authStatus.user?.name}>
      <GameProvider
        startFresh={false}
        municipalitySlug={slug}
        cityName={municipalityData.name || slug}
        userId={authStatus.user?.id}
        isOwner={isOwner}
        municipalityRole={municipalityRole}
        canton={municipalityData.canton}
        initialAdjacentCities={initialAdjacentCities}
      >
        <main className="h-screen w-screen overflow-hidden">
          <AutoJoinMultiplayerGame
            roomCode={roomCode}
            cityName={municipalityData.name || slug}
            currentSlug={slug}
            onExit={handleExitGame}
            onBackToHome={handleBackToHome}
            cannotEditSettings={!canEditSettings}
            isFullyViewOnly={isFullyViewOnly}
            isOwner={isOwner}
            canUseDebug={canUseDebug}
            ownerName={municipalityData.owner?.nickname}
            municipalityName={municipalityData.name}
            memberCount={municipalityData.memberCount}
            administrators={municipalityData.administrators}
            coatOfArms={municipalityData.coatOfArms}
          />
        </main>
      </GameProvider>
    </MultiplayerContextProvider>
    </GameErrorBoundary>
  );
}

export default function GemeindeGame({ slug, onNotAuthenticated }: { slug: string; onNotAuthenticated: () => void }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GemeindeGameContent slug={slug} onNotAuthenticated={onNotAuthenticated} />
    </Suspense>
  );
}
