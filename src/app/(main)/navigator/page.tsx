'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { GameProvider } from '@/context/GameContext';
import { LobbyScreen } from '@/components/game/LobbyScreen';
import { RoomViewerOverlay } from '@/components/game/RoomViewerOverlay';
import { setAuthToken } from '@/lib/api/coreApi';
import { Loader2 } from 'lucide-react';

const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

// ── Typen ─────────────────────────────────────────────────────────────────────
interface AuthUser {
  id: number;
  nickname?: string;
  name?: string;
  municipality_id?: number;
  municipality_slug?: string;
  user_rank?: number;
  global_role?: string;
  avatar_config?: string;
}

interface ActiveRoom {
  ownerUserId: number;
  municipalitySlug: string;
  roomName: string;
  roomCode: string;
  isPublic: boolean;
}

// ── Ladebildschirm ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-3"
      style={{ backgroundImage: "linear-gradient(180deg, hsl(220 20% 5% / 0.95) 0%, hsl(220 20% 8% / 1) 100%), url('/assets/bg-hq-navi.png')", backgroundSize: 'cover' }}
    >
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      <p className="text-amber-300/80 text-sm">Navigator wird geladen...</p>
    </main>
  );
}

// ── Hauptinhalt ───────────────────────────────────────────────────────────────
function NavigatorContent() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);

  // Auth-Check — nur Token-Verify, keine Assets, kein PixiJS
  useEffect(() => {
    async function checkAuth() {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('isocity_auth_token')
        : null;

      if (!token) {
        router.replace('/');
        return;
      }

      try {
        const res = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const ok = data?.ok === true || (data?.success === true && data?.authenticated === true);
          if (ok && data.user) {
            setAuthToken(token);
            setUser(data.user as AuthUser);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }

      // Kein gültiges Token → zur Startseite
      localStorage.removeItem('isocity_auth_token');
      router.replace('/');
    }

    checkAuth();
  }, [router]);

  // Raum betreten — öffnet RoomViewerOverlay (IsometricRoomViewer, kein PixiJS)
  const handleEnterRoom = (slug: string, roomCode: string, roomName: string, ownerId?: number) => {
    const isPubRoom = roomCode.toUpperCase().startsWith('PUB');
    const isPublic = isPubRoom || roomCode !== 'MAIN';
    // PUB rooms use ownerId=0 so server skips personal-furniture snapshot (room will be empty or socket-loaded).
    // Personal rooms fallback to own userId if visiting own municipality.
    const ownerUserId = isPubRoom ? 0 : (ownerId ?? (slug === (user?.municipality_slug || '') ? (user?.id ?? 0) : 0));
    setActiveRoom({ ownerUserId, municipalitySlug: slug, roomName, roomCode, isPublic });
  };

  if (loading) return <LoadingScreen />;

  // Raum geöffnet → RoomViewerOverlay (leichtgewichtig, kein PixiJS)
  if (activeRoom) {
    return (
      <RoomViewerOverlay
        userId={activeRoom.ownerUserId}
        nickname={user?.nickname || user?.name || 'Spieler'}
        municipalitySlug={activeRoom.municipalitySlug}
        roomCode={activeRoom.roomCode}
        roomName={activeRoom.roomName}
        isOwner={activeRoom.ownerUserId === user?.id}
        isAdmin={String(user?.global_role || '').toLowerCase() === 'administrator' || String(user?.global_role || '').toLowerCase() === 'moderator'}
        onClose={() => setActiveRoom(null)}
        onNavigateToRoom={(slug, roomCode, roomName, ownerId) => handleEnterRoom(slug, roomCode, roomName, ownerId)}
      />
    );
  }

  // Lobby / Navigator-Hauptseite
  return (
    <GameProvider startFresh>
      <LobbyScreen
        username={user?.nickname || user?.name || 'Spieler'}
        onEnterRoom={handleEnterRoom}
        isAdmin={String(user?.global_role || '').toLowerCase() === 'administrator'}
        isMod={String(user?.global_role || '').toLowerCase() === 'moderator'}
      />
    </GameProvider>
  );
}

// ── Page Export ───────────────────────────────────────────────────────────────
export default function NavigatorPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NavigatorContent />
    </Suspense>
  );
}
