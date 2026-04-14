'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CoasterProvider } from '@/context/CoasterContext';
import { MultiplayerContextProvider, useMultiplayerOptional } from '@/context/MultiplayerContext';
import CoasterGame from '@/components/coaster/Game';
import { CoasterCoopModal } from '@/components/coaster/multiplayer/CoasterCoopModal';
import {
  buildSavedParkMeta,
  COASTER_AUTOSAVE_KEY,
  COASTER_SAVED_PARK_PREFIX,
  deleteCoasterStateFromStorage,
  loadCoasterStateFromStorage,
  readSavedParksIndex,
  removeSavedParkMeta,
  SavedParkMeta,
  saveParkToIndex,
  upsertSavedParkMeta,
  writeSavedParksIndex,
  saveCoasterStateToStorage,
} from '@/games/coaster/saveUtils';
import { GameState as CoasterGameState } from '@/games/coaster/types';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const TOKEN_KEY = 'isocity_auth_token';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

// ── Minecraft-style Button ────────────────────────────────────────────────────
function MCButton({ children, onClick, disabled, variant = 'stone', className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'stone' | 'green' | 'red' | 'dark';
  className?: string;
}) {
  const base = 'relative w-full text-center py-3 px-6 text-lg font-bold tracking-wide select-none transition-all duration-75 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-2';
  const variants: Record<string, string> = {
    stone: 'bg-[#8b8b8b] hover:bg-[#9e9e9e] active:bg-[#7a7a7a] border-t-[#c6c6c6] border-l-[#c6c6c6] border-r-[#555] border-b-[#555] text-white shadow-[inset_-2px_-2px_0_#555,inset_2px_2px_0_#c6c6c6]',
    green: 'bg-[#5a8a3a] hover:bg-[#6a9e46] active:bg-[#4a7a2e] border-t-[#8dc45a] border-l-[#8dc45a] border-r-[#2a4a1e] border-b-[#2a4a1e] text-white shadow-[inset_-2px_-2px_0_#2a4a1e,inset_2px_2px_0_#8dc45a]',
    red: 'bg-[#8a3a3a] hover:bg-[#9e4646] active:bg-[#7a2e2e] border-t-[#c45a5a] border-l-[#c45a5a] border-r-[#4a1e1e] border-b-[#4a1e1e] text-white shadow-[inset_-2px_-2px_0_#4a1e1e,inset_2px_2px_0_#c45a5a]',
    dark: 'bg-[#3a3a3a] hover:bg-[#4a4a4a] active:bg-[#2e2e2e] border-t-[#666] border-l-[#666] border-r-[#111] border-b-[#111] text-white/80 shadow-[inset_-2px_-2px_0_#111,inset_2px_2px_0_#666]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ── Input Field ───────────────────────────────────────────────────────────────
function MCInput({ placeholder, value, onChange, type = 'text' }: {
  placeholder?: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#111] border-2 border-t-[#333] border-l-[#333] border-r-[#999] border-b-[#999] text-white px-3 py-2.5 text-base outline-none focus:border-[#5b9bd5] placeholder:text-white/30 font-mono"
    />
  );
}

// ── Auth Panel ────────────────────────────────────────────────────────────────
function AuthPanel({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember_me: true }),
      });
      const data = await res.json();
      if (!data.ok || !data.token) { setError(data.error || 'Login fehlgeschlagen'); return; }
      localStorage.setItem(TOKEN_KEY, data.token);
      if (data.user?.nickname) localStorage.setItem('isocity_user_name', data.user.nickname);
      if (data.user?.id) localStorage.setItem('isocity_user_id', String(data.user.id));
      onLoggedIn();
    } catch { setError('Verbindungsfehler'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!email || !password || !nickname) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Registrierung fehlgeschlagen'); return; }
      // Auto-login nach Registrierung
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        if (data.user?.nickname) localStorage.setItem('isocity_user_name', data.user.nickname);
        if (data.user?.id) localStorage.setItem('isocity_user_id', String(data.user.id));
        onLoggedIn();
      } else {
        setTab('login');
        setError('');
      }
    } catch { setError('Verbindungsfehler'); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${AUTH_API_BASE_URL}/api/auth/google?redirect=/steam`;
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      {/* Tabs */}
      <div className="flex border-2 border-[#555]">
        {(['login', 'register'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 py-2.5 text-base font-bold tracking-wide transition-colors ${tab === t ? 'bg-[#8b8b8b] text-white' : 'bg-[#3a3a3a] text-white/50 hover:text-white/80'}`}>
            {t === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="space-y-2 bg-[#1a1a1a] border-2 border-[#555] p-4">
        {tab === 'register' && (
          <MCInput placeholder="Nickname" value={nickname} onChange={setNickname} />
        )}
        <MCInput placeholder="E-Mail" value={email} onChange={setEmail} />
        <MCInput placeholder="Passwort" value={password} onChange={setPassword} type="password" />

        {error && (
          <div className="bg-red-900/60 border border-red-500/50 px-3 py-2 text-red-300 text-sm font-mono">{error}</div>
        )}

        <MCButton
          variant="green"
          onClick={tab === 'login' ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading ? '...' : tab === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </MCButton>

        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-[#555]" />
          <span className="text-white/30 text-xs font-mono">oder</span>
          <div className="flex-1 h-px bg-[#555]" />
        </div>

        {/* Google Login */}
        <MCButton variant="stone" onClick={handleGoogleLogin}>
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Mit Google anmelden
          </span>
        </MCButton>

        {/* Steam Login - Placeholder */}
        <MCButton variant="dark" onClick={() => {}}>
          <span className="flex items-center justify-center gap-2 opacity-50">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38l3.03-6.13a3.5 3.5 0 1 1 4.54-4.54l6.06-3.02C20.2 3.44 16.3 0 12 0z"/></svg>
            Mit Steam anmelden (bald)
          </span>
        </MCButton>
      </div>
    </div>
  );
}

// ── Game Menu ─────────────────────────────────────────────────────────────────
function GameMenu({ hasSaved, savedParks, onContinue, onNewPark, onCoop, onLoadExample, onLogout }: {
  hasSaved: boolean;
  savedParks: SavedParkMeta[];
  onContinue: () => void;
  onNewPark: () => void;
  onCoop: () => void;
  onLoadExample: () => void;
  onLogout: () => void;
}) {
  const nickname = typeof window !== 'undefined' ? localStorage.getItem('isocity_user_name') : null;
  return (
    <div className="w-full max-w-xs mx-auto space-y-2">
      {nickname && (
        <div className="text-center text-white/50 text-sm font-mono mb-4">
          Angemeldet als <span className="text-white/80">{nickname}</span>
        </div>
      )}
      <MCButton variant="green" onClick={hasSaved ? onContinue : onNewPark}>
        {hasSaved ? 'Weiterspielen' : 'Neuer Park'}
      </MCButton>
      {hasSaved && <MCButton variant="stone" onClick={onNewPark}>Neuer Park</MCButton>}
      <MCButton variant="dark" onClick={onLoadExample}>Beispiel laden</MCButton>
      <div className="pt-2 border-t border-[#444]">
        <MCButton variant="red" onClick={onLogout}>Abmelden</MCButton>
      </div>
      {savedParks.length > 0 && (
        <div className="pt-2">
          <div className="text-xs text-white/30 font-mono uppercase tracking-wider mb-1">Gespeicherte Parks</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedParks.slice(0, 5).map(park => (
              <button key={park.id} onClick={onContinue}
                className="w-full text-left px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-white/70 text-sm font-mono truncate">
                {park.name || 'Park'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page Content ─────────────────────────────────────────────────────────
function SteamPageContent() {
  const multiplayer = useMultiplayerOptional();
  const [showGame, setShowGame] = useState(false);
  const [startFresh, setStartFresh] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  const [loadParkId, setLoadParkId] = useState<string | null>(null);
  const [showCoopModal, setShowCoopModal] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'loggedIn'>('checking');

  const refreshSavedParks = useCallback(() => {
    let parks = readSavedParksIndex();
    const autosaveState = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
    if (autosaveState) {
      const autosaveMeta = buildSavedParkMeta(autosaveState);
      parks = upsertSavedParkMeta(autosaveMeta, parks);
      writeSavedParksIndex(parks);
    }
    setSavedParks(parks);
    setHasSaved(parks.length > 0);
  }, []);

  // Auto-Login
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { setAuthState('guest'); return; }
    fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.user) {
          if (data.user.nickname) localStorage.setItem('isocity_user_name', data.user.nickname);
          if (data.user.id) localStorage.setItem('isocity_user_id', String(data.user.id));
          setAuthState('loggedIn');
          refreshSavedParks();
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setAuthState('guest');
        }
      })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setAuthState('guest'); });
  }, [refreshSavedParks]);

  // URL-Param: ?room=XXXXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && roomCode.length === 5) window.location.replace(`/steam/coop/${roomCode.toUpperCase()}`);
  }, []);

  const handleLoggedIn = () => { setAuthState('loggedIn'); refreshSavedParks(); };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('isocity_user_name');
    localStorage.removeItem('isocity_user_id');
    setAuthState('guest');
  };

  const handleExitGame = () => {
    multiplayer?.leaveRoom();
    setShowGame(false); setStartFresh(false); setLoadParkId(null); setPendingRoomCode(null);
    refreshSavedParks();
    window.history.replaceState({}, '', '/steam');
  };

  const handleCoopStart = (_isHost: boolean, initialState?: CoasterGameState, roomCode?: string) => {
    if (initialState) {
      try {
        saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, initialState);
        if (roomCode) saveParkToIndex(initialState, roomCode);
      } catch { /* ignore */ }
      setStartFresh(false);
    } else { setStartFresh(true); }
    setLoadParkId(null); setShowGame(true);
  };

  const handleLoadExample = async () => {
    try {
      const res = await fetch('/example-states-coaster/example_state.json');
      const state = await res.json();
      saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, state);
      refreshSavedParks(); setStartFresh(false); setLoadParkId(null); setShowGame(true);
    } catch { /* ignore */ }
  };

  if (showGame) {
    return (
      <CoasterProvider startFresh={startFresh} loadParkId={loadParkId}>
        <main className="h-screen w-screen overflow-hidden">
          <CoasterGame onExit={handleExitGame} />
        </main>
      </CoasterProvider>
    );
  }

  return (
    <>
      {/* Background */}
      <main className="min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a3a2a 0%, #0d1a12 60%, #060e09 100%)' }}>

        {/* Pixel grid overlay */}
        <div className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 8px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 8px)' }} />

        {/* Title */}
        <div className="mb-10 text-center select-none">
          <h1 className="text-7xl sm:text-8xl md:text-9xl font-bold text-white tracking-widest drop-shadow-[0_4px_0_rgba(0,0,0,0.8)]"
            style={{ textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 4px 6px 8px rgba(0,0,0,0.6)' }}>
            Steam
          </h1>
          <p className="text-white/30 text-sm font-mono tracking-widest mt-2">THEME PARK BUILDER</p>
        </div>

        {/* Panel */}
        <div className="w-full max-w-sm">
          {authState === 'checking' && (
            <div className="text-center text-white/40 font-mono text-sm py-8 animate-pulse">Lade...</div>
          )}
          {authState === 'guest' && <AuthPanel onLoggedIn={handleLoggedIn} />}
          {authState === 'loggedIn' && (
            <GameMenu
              hasSaved={hasSaved}
              savedParks={savedParks}
              onContinue={() => {
                if (savedParks.length > 0) { setStartFresh(false); setLoadParkId(savedParks[0].id); }
                else { setStartFresh(true); setLoadParkId(null); }
                setShowGame(true);
              }}
              onNewPark={() => { setStartFresh(true); setLoadParkId(null); setShowGame(true); }}
              onCoop={() => {}}
              onLoadExample={handleLoadExample}
              onLogout={handleLogout}
            />
          )}
        </div>

        <div className="mt-8 text-white/20 text-xs font-mono">buenzlifight.ch</div>
      </main>

      <CoasterCoopModal
        open={showCoopModal}
        onOpenChange={setShowCoopModal}
        onStartGame={handleCoopStart}
        pendingRoomCode={pendingRoomCode}
      />
    </>
  );
}

export default function SteamPage() {
  const [playerName, setPlayerName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof window !== 'undefined')
      setPlayerName(localStorage.getItem('isocity_user_name') || undefined);
  }, []);
  return (
    <MultiplayerContextProvider playerName={playerName}>
      <SteamPageContent />
    </MultiplayerContextProvider>
  );
}
