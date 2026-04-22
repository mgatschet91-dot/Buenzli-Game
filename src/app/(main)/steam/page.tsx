'use client';

import React, { useState, useEffect } from 'react';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const TOKEN_KEY = 'isocity_auth_token';
const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

function launchGame() {
  window.location.href = '/';
}

// ── Launch Overlay ────────────────────────────────────────────────────────────
function LaunchOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#050b07] animate-in fade-in duration-300 overflow-hidden select-none">
      {/* Hintergrund */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/main-bg.webp')" }} />
        <div className="absolute inset-0 bg-[#050b07]/80" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-400/10 blur-[130px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-emerald-500/6 blur-[100px]" />
      </div>

      {/* Inhalt */}
      <div className="relative z-10 flex flex-col items-center gap-10">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-2xl animate-pulse scale-[1.6]" />
          <img
            src="/assets/logo.webp"
            alt="BünzliFight"
            className="relative w-28 h-28 object-contain drop-shadow-[0_0_40px_rgba(251,191,36,0.55)] animate-[logoFloat_3s_ease-in-out_infinite]"
          />
        </div>

        {/* Titel */}
        <div className="text-center space-y-2">
          <h1
            className="text-5xl font-bold tracking-wider text-white drop-shadow-[0_2px_20px_rgba(251,191,36,0.3)]"
            style={{ fontFamily: 'var(--font-display, serif)' }}
          >
            BünzliFight
          </h1>
          <p className="text-amber-200/30 text-xs tracking-[0.4em] uppercase font-mono">Dini Stadt · Dis Spiel</p>
        </div>

        {/* Ladebalken */}
        <div className="flex flex-col items-center gap-3 w-56">
          <div className="w-full h-px bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500/0 via-amber-400/80 to-amber-500/0 rounded-full animate-[scanBar_1.8s_ease-in-out_infinite]" />
          </div>
          <span className="text-white/20 text-[10px] font-mono tracking-[0.35em] animate-pulse">WIRD GELADEN</span>
        </div>
      </div>

      {/* Version */}
      <div className="absolute bottom-6 text-white/10 text-xs font-mono tracking-widest">buenzlifight.ch</div>

      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes scanBar {
          0%   { width: 0%;   margin-left: 0%;    opacity: 0; }
          20%  { opacity: 1; }
          50%  { width: 55%;  margin-left: 22%;  }
          80%  { opacity: 1; }
          100% { width: 0%;   margin-left: 100%;  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-amber-200/50 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/40 border border-amber-300/15 focus:border-amber-300/40 text-white px-4 py-4 text-lg outline-none rounded-sm placeholder:text-white/20 transition-colors"
      />
    </div>
  );
}

const RESOLUTIONS = [
  { label: '1280 × 720',  w: 1280, h: 720  },
  { label: '1440 × 900',  w: 1440, h: 900  },
  { label: '1600 × 900',  w: 1600, h: 900  },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '2560 × 1440', w: 2560, h: 1440 },
];

// ── Electron Einstellungen ────────────────────────────────────────────────────
function ElectronSettings() {
  const [fullscreen, setFullscreen] = useState(false);
  const [resolution, setResolution] = useState('1440 × 900');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.electronWindow?.isFullscreen().then(f => setFullscreen(f ?? false));
  }, []);

  const applyResolution = async (label: string, w: number, h: number) => {
    setResolution(label);
    if (!fullscreen) await window.electronWindow?.setResolution(w, h);
  };

  const toggleFullscreen = async () => {
    const next = !fullscreen;
    setFullscreen(next);
    await window.electronWindow?.setFullscreen(next);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 text-sm rounded-sm transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Einstellungen
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-64 bg-slate-950/95 border border-amber-300/20 rounded-sm shadow-2xl p-4 space-y-4">
          <div className="text-xs font-mono text-amber-300/50 uppercase tracking-widest">Anzeigeeinstellungen</div>

          {/* Vollbild */}
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Vollbild</span>
            <button onClick={toggleFullscreen}
              className={`w-11 h-6 rounded-full transition-colors relative ${fullscreen ? 'bg-amber-400' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${fullscreen ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Auflösung */}
          <div className="space-y-1.5">
            <span className="text-white/60 text-sm">Auflösung</span>
            <div className="space-y-1">
              {RESOLUTIONS.map(r => (
                <button key={r.label} onClick={() => applyResolution(r.label, r.w, r.h)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-sm transition-colors ${
                    resolution === r.label
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-300/30'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Electron Titlebar ─────────────────────────────────────────────────────────
function ElectronTitlebar() {
  if (!IS_ELECTRON) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-between px-3 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-white/30 text-xs font-mono tracking-widest">BÜENZLIFIGHT</span>
      <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={() => window.electronWindow?.minimize()}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-base leading-none">─</button>
        <button onClick={() => window.electronWindow?.maximize()}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-xs">□</button>
        <button onClick={() => window.electronWindow?.close()}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-red-500/80 transition-colors text-base leading-none">✕</button>
      </div>
    </div>
  );
}

// ── Municipality type ─────────────────────────────────────────────────────────
interface MunicipalityOption {
  id: number;
  name: string;
  slug: string;
  member_count: number;
}

// ── Municipality Picker (geteilt zwischen Register + Steam Setup) ─────────────
function MunicipalityPicker({
  municipalities, loading,
  selectedId, selectedName, onSelect,
  createOwn, onToggleCreate,
  newName, onNewName,
  search, onSearch,
}: {
  municipalities: MunicipalityOption[]; loading: boolean;
  selectedId: number | null; selectedName: string;
  onSelect: (id: number, name: string, slug: string) => void;
  createOwn: boolean; onToggleCreate: (v: boolean) => void;
  newName: string; onNewName: (v: string) => void;
  search: string; onSearch: (v: string) => void;
}) {
  const filtered = municipalities.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onToggleCreate(false)}
          className={`py-3 text-sm font-medium rounded-sm border transition-colors ${
            !createOwn ? 'bg-amber-400/10 border-amber-300/40 text-amber-200'
                       : 'bg-black/20 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'}`}>
          Gemeinde beitreten
        </button>
        <button onClick={() => { onToggleCreate(true); onSelect(0, '', ''); }}
          className={`py-3 text-sm font-medium rounded-sm border transition-colors ${
            createOwn ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-black/20 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'}`}>
          Eigene gründen
        </button>
      </div>

      {createOwn ? (
        <div className="space-y-2">
          <input type="text" value={newName} onChange={e => onNewName(e.target.value)}
            maxLength={100} placeholder="Name deiner Gemeinde..."
            className="w-full bg-black/40 border border-emerald-500/25 focus:border-emerald-400/50 text-white px-4 py-3.5 text-base outline-none rounded-sm placeholder:text-white/20 transition-colors"/>
          <p className="text-white/25 text-xs px-1">Du wirst als Bürgermeister eingetragen.</p>
        </div>
      ) : selectedId ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-sm bg-amber-400/10 border border-amber-300/30">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-300/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            <span className="text-amber-200 font-medium text-sm">{selectedName}</span>
          </div>
          <button onClick={() => { onSelect(0, '', ''); onSearch(''); }}
            className="text-white/30 hover:text-white/60 text-xs transition-colors">ändern</button>
        </div>
      ) : (
        <>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Suchen..." autoFocus
              className="w-full bg-black/30 border border-white/10 focus:border-amber-300/25 text-white pl-9 pr-4 py-2.5 text-sm outline-none rounded-sm placeholder:text-white/20 transition-colors"/>
          </div>
          {loading ? (
            <div className="text-white/25 text-sm py-6 text-center animate-pulse">Laden...</div>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-sm border border-white/5 divide-y divide-white/5">
              {filtered.map(m => (
                <button key={m.slug} onClick={() => { onSelect(m.id, m.name, m.slug); onSearch(''); }}
                  className="w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-2 text-white/55 hover:bg-white/5 hover:text-white/80">
                  <span className="font-medium text-sm">{m.name}</span>
                  <span className="text-xs text-white/25 shrink-0">{m.member_count} Mitgl.</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-white/25 text-sm py-4 text-center">Keine Treffer</div>
              )}
            </div>
          )}
          <p className="text-white/20 text-xs px-1">Nichts gewählt → automatisch Zürich zugewiesen</p>
        </>
      )}
    </div>
  );
}

// ── Steam Setup Screen ────────────────────────────────────────────────────────
function SteamSetupScreen({
  steamName, setupToken, isExisting, isGoogleSetup, onDone, onError,
}: {
  steamName: string; setupToken: string; isExisting?: boolean; isGoogleSetup?: boolean;
  onDone: (token: string, user: { id: number; nickname: string }) => void;
  onError: (msg: string) => void;
}) {
  const [username, setUsername] = useState(steamName);
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>([]);
  const [loadingMunis, setLoadingMunis] = useState(true);
  const [selectedId, setSelectedId] = useState(0);
  const [selectedName, setSelectedName] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [createOwn, setCreateOwn] = useState(false);
  const [newMuniName, setNewMuniName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${AUTH_API_BASE_URL}/api/municipalities/public`)
      .then(r => r.json())
      .then(d => { if (d.ok) setMunicipalities(d.municipalities || []); })
      .catch(() => {})
      .finally(() => setLoadingMunis(false));
  }, []);

  const handleConfirm = async () => {
    if (!username.trim() || username.trim().length < 2) { onError('Username muss mindestens 2 Zeichen haben'); return; }
    if (createOwn && newMuniName.trim().length < 2) { onError('Gemeindename muss mindestens 2 Zeichen haben'); return; }
    setLoading(true);
    try {
      let res: Response;
      if (isGoogleSetup) {
        res = await fetch(`${AUTH_API_BASE_URL}/api/auth/google/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${setupToken}` },
          body: JSON.stringify({
            nickname: username.trim(),
            municipality_id: createOwn ? null : (selectedId || null),
            create_municipality: createOwn,
            new_municipality_name: createOwn ? newMuniName.trim() : '',
          }),
        });
      } else {
        res = await fetch(`${AUTH_API_BASE_URL}/api/auth/steam/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupToken,
            username: username.trim(),
            municipalitySlug: createOwn ? '' : selectedSlug,
            newMunicipalityName: createOwn ? newMuniName.trim() : '',
          }),
        });
      }
      const data = await res.json();
      if (!data.ok || !data.token) { onError(data.error || 'Setup fehlgeschlagen'); setLoading(false); return; }
      onDone(data.token, data.user ?? { id: 0, nickname: data.nickname });
    } catch { onError('Verbindungsfehler — Server nicht erreichbar'); setLoading(false); }
  };

  return (
    <div className="rounded-sm bg-slate-950/75 backdrop-blur-sm border border-amber-300/20 shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="px-8 py-6 border-b border-amber-300/10">
        <div className="text-xs font-mono text-amber-300/50 uppercase tracking-widest mb-1">
          {isGoogleSetup ? 'Neues Google-Konto' : isExisting ? 'Profil vervollständigen' : 'Neues Steam-Konto'}
        </div>
        <div className="text-white/70 text-sm">
          {isExisting ? 'Passe deinen Namen an und wähle deine Gemeinde.' : 'Wähle deinen Spielernamen und tritt einer Gemeinde bei.'}
        </div>
      </div>
      <div className="p-8 space-y-7">
        <div className="space-y-2">
          <label className="text-xs font-mono text-amber-200/50 uppercase tracking-widest">Spielername</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} maxLength={32}
            className="w-full bg-black/40 border border-amber-300/15 focus:border-amber-300/40 text-white px-4 py-4 text-lg outline-none rounded-sm placeholder:text-white/20 transition-colors"/>
        </div>
        <div className="space-y-3">
          <label className="text-xs font-mono text-amber-200/50 uppercase tracking-widest">Gemeinde</label>
          <MunicipalityPicker
            municipalities={municipalities} loading={loadingMunis}
            selectedId={selectedId} selectedName={selectedName}
            onSelect={(id, name, slug) => { setSelectedId(id); setSelectedName(name); setSelectedSlug(slug); }}
            createOwn={createOwn} onToggleCreate={v => { setCreateOwn(v); setSelectedId(0); setSelectedName(''); setSelectedSlug(''); }}
            newName={newMuniName} onNewName={setNewMuniName}
            search={search} onSearch={setSearch}
          />
        </div>
        <button onClick={handleConfirm}
          disabled={loading || !username.trim() || (createOwn && !newMuniName.trim())}
          className="w-full py-5 bg-amber-400/90 hover:bg-amber-300 active:bg-amber-500 text-black font-bold text-xl tracking-widest uppercase rounded-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(251,191,36,0.25)]">
          {loading ? '...' : isExisting ? 'Speichern & Spielen' : 'Konto erstellen & Spielen'}
        </button>
      </div>
    </div>
  );
}

// ── Steam Einladungs-Banner ───────────────────────────────────────────────────
function InviteBanner({ municipalitySlug }: { municipalitySlug: string }) {
  if (!municipalitySlug) return null;
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 rounded-sm bg-emerald-900/30 border border-emerald-500/30 text-emerald-200 text-sm animate-in slide-in-from-top-2 duration-500">
      <svg className="w-5 h-5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <div>
        <span className="font-semibold">Du wurdest eingeladen!</span>
        <span className="text-emerald-300/70"> — Melde dich an um der Gemeinde </span>
        <span className="font-bold text-emerald-300">{municipalitySlug}</span>
        <span className="text-emerald-300/70"> beizutreten.</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SteamPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [authState, setAuthState] = useState<'checking' | 'ready'>('checking');

  // Steam Einladungs-Connect-String aus URL lesen (?join=+ref/CODE/slug)
  const [inviteMunicipalitySlug, setInviteMunicipalitySlug] = useState('');
  const [inviteRef, setInviteRef] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const join = params.get('join');
    if (!join) return;
    // Format: +ref/CODE/municipalitySlug  oder  +ref/CODE
    const match = join.match(/\+ref\/([^/]+)(?:\/([^/]+))?/);
    if (match) {
      if (match[1]) setInviteRef(match[1]);
      if (match[2]) {
        setInviteMunicipalitySlug(match[2]);
        // Direkt auf Register-Tab wechseln für neue User
        setTab('register');
      }
    }
  }, []);
  const [steamSetup, setSteamSetup] = useState<{ setupToken: string; steamName: string; isExisting?: boolean; isGoogleSetup?: boolean } | null>(null);
  // Register — Gemeinde
  const [regMunis, setRegMunis] = useState<MunicipalityOption[]>([]);
  const [regLoadingMunis, setRegLoadingMunis] = useState(false);
  const [regMuniId, setRegMuniId] = useState(0);
  const [regMuniName, setRegMuniName] = useState('');
  const [regCreateOwn, setRegCreateOwn] = useState(false);
  const [regNewMuniName, setRegNewMuniName] = useState('');
  const [regSearch, setRegSearch] = useState('');

  // Gemeinden laden wenn Register-Tab — danach Einladungs-Gemeinde vorauswählen
  useEffect(() => {
    if (tab !== 'register' || regMunis.length > 0) return;
    setRegLoadingMunis(true);
    fetch(`${AUTH_API_BASE_URL}/api/municipalities/public`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const munis: MunicipalityOption[] = d.municipalities || [];
        setRegMunis(munis);
        // Einladungs-Gemeinde vorauswählen
        if (inviteMunicipalitySlug) {
          const match = munis.find(m => m.slug === inviteMunicipalitySlug);
          if (match) { setRegMuniId(match.id); setRegMuniName(match.name); }
        }
      })
      .catch(() => {})
      .finally(() => setRegLoadingMunis(false));
  }, [tab, inviteMunicipalitySlug]);

  // Google-Callback: Token aus URL-Params lesen (Electron-Flow)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('google_token');
    const googleSetup = params.get('google_setup');
    const authError = params.get('auth_error');
    if (authError) { setError(`Google-Login fehlgeschlagen: ${authError}`); setAuthState('ready'); return; }
    if (googleToken) {
      // URL säubern
      window.history.replaceState({}, '', window.location.pathname);
      if (googleSetup) {
        const googleNickname = params.get('google_nickname') || '';
        localStorage.setItem(TOKEN_KEY, googleToken);
        setSteamSetup({ setupToken: googleToken, steamName: googleNickname, isExisting: false, isGoogleSetup: true });
        setAuthState('ready');
      } else {
        localStorage.setItem(TOKEN_KEY, googleToken);
        setLaunching(true);
        setTimeout(launchGame, 800);
      }
    }
  }, []);

  // Auto-Login
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { setAuthState('ready'); return; }
    fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.user && data.user.municipality_slug) {
          if (data.user.nickname) localStorage.setItem('isocity_user_name', data.user.nickname);
          if (data.user.id) localStorage.setItem('isocity_user_id', String(data.user.id));
          setLaunching(true);
          setTimeout(launchGame, 800);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setAuthState('ready');
        }
      })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setAuthState('ready'); });
  }, []);

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
      finishLogin(data.token, data.user);
    } catch { setError('Verbindungsfehler — Server nicht erreichbar'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!email || !password || !nickname) return;
    setLoading(true); setError('');
    try {
      const muniPayload = regCreateOwn
        ? { create_municipality: true, new_municipality_name: regNewMuniName.trim() }
        : regMuniId ? { municipality_id: regMuniId } : {};
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname, ...muniPayload }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Registrierung fehlgeschlagen'); return; }
      if (data.token) {
        finishLogin(data.token, data.user);
      } else {
        setTab('login');
        setError('Konto erstellt — jetzt anmelden');
      }
    } catch { setError('Verbindungsfehler'); }
    finally { setLoading(false); }
  };

  const handleGoogle = () => {
    const redirectTo = IS_ELECTRON ? 'http://127.0.0.1:3001/steam' : '';
    const params = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
    window.location.href = `${AUTH_API_BASE_URL}/api/auth/google${params}`;
  };

  const finishLogin = (token: string, user: { id: number; nickname: string }) => {
    localStorage.setItem(TOKEN_KEY, token);
    if (user.nickname) localStorage.setItem('isocity_user_name', user.nickname);
    if (user.id) localStorage.setItem('isocity_user_id', String(user.id));
    setLaunching(true);
    setTimeout(launchGame, 800);
  };

  const handleSteamLogin = async () => {
    if (!window.steam) return;
    setLoading(true); setError('');
    try {
      const [user, ticket] = await Promise.all([window.steam.getUser(), window.steam.getTicket()]);
      if (!user || !ticket) { setError('Steam nicht verfügbar – ist Steam gestartet?'); setLoading(false); return; }
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/steam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, steamName: user.name }),
      });
      const data = await res.json();
      if (data.newUser && data.setupToken) {
        setSteamSetup({ setupToken: data.setupToken, steamName: data.steamName || user.name, isExisting: !!data.isExisting });
        setLoading(false);
        return;
      }
      if (!data.ok || !data.token) { setError(data.error || 'Steam-Login fehlgeschlagen'); return; }
      finishLogin(data.token, data.user);
    } catch { setError('Verbindungsfehler — Server nicht erreichbar'); }
    finally { setLoading(false); }
  };

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-[#050b07] flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Hintergrund-Glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{ backgroundImage: "url('/assets/main-bg.webp')" }} />
          <div className="absolute inset-0 bg-[#050b07]/80" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-amber-400/8 blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full bg-emerald-500/6 blur-[100px]" />
        </div>

        {/* Inhalt */}
        <div className="relative z-10 flex flex-col items-center gap-10">
          {/* Logo mit Glow-Pulse */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-2xl animate-pulse scale-150" />
            <img
              src="/assets/logo.webp"
              alt="BünzliFight"
              className="relative w-28 h-28 object-contain drop-shadow-[0_0_40px_rgba(251,191,36,0.5)] animate-[logoFloat_3s_ease-in-out_infinite]"
            />
          </div>

          {/* Titel */}
          <div className="text-center space-y-2">
            <h1
              className="text-5xl font-bold tracking-wider text-white drop-shadow-[0_2px_20px_rgba(251,191,36,0.3)]"
              style={{ fontFamily: 'var(--font-display, serif)' }}
            >
              BünzliFight
            </h1>
            <p className="text-amber-200/30 text-xs tracking-[0.4em] uppercase font-mono">Dini Stadt · Dis Spiel</p>
          </div>

          {/* Ladebalken */}
          <div className="flex flex-col items-center gap-3 w-56">
            <div className="w-full h-px bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500/0 via-amber-400/80 to-amber-500/0 rounded-full animate-[scanBar_1.8s_ease-in-out_infinite]" />
            </div>
            <span className="text-white/20 text-[10px] font-mono tracking-[0.35em] animate-pulse">WIRD GELADEN</span>
          </div>
        </div>

        {/* Version unten */}
        <div className="absolute bottom-6 text-white/10 text-xs font-mono tracking-widest">buenzlifight.ch</div>

        <style>{`
          @keyframes logoFloat {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-8px); }
          }
          @keyframes scanBar {
            0%   { width: 0%;   margin-left: 0%;    opacity: 0; }
            20%  { opacity: 1; }
            50%  { width: 55%;  margin-left: 22%;  }
            80%  { opacity: 1; }
            100% { width: 0%;   margin-left: 100%;  opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none">
      <LaunchOverlay visible={launching} />
      <ElectronTitlebar />
      {IS_ELECTRON && (
        <div className="fixed bottom-4 right-4 z-50">
          <ElectronSettings />
        </div>
      )}
      {/* Background image */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/assets/main-bg.webp')" }} />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute top-[8%] left-[4%] w-80 h-80 rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute bottom-[8%] right-[4%] w-[28rem] h-[28rem] rounded-full bg-amber-300/10 blur-[140px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-8 space-y-10">
        {/* Einladungs-Banner */}
        {inviteMunicipalitySlug && <InviteBanner municipalitySlug={inviteMunicipalitySlug} />}

        {/* Logo + Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/assets/logo.webp" alt="BünzliFight" className="w-28 h-28 object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]" />
          </div>
          <div>
            <div className="text-sm tracking-[0.3em] uppercase text-amber-200/50 mb-2">Willkommen bei</div>
            <h1 className="text-7xl font-bold tracking-wider text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: 'var(--font-display, serif)' }}>
              BünzliFight
            </h1>
            <p className="text-white/30 text-base tracking-[0.2em] mt-2">DINI STADT · DIS SPIEL</p>
          </div>
        </div>

        {/* Steam Setup — neuer User */}
        {steamSetup && (
          <SteamSetupScreen
            steamName={steamSetup.steamName}
            setupToken={steamSetup.setupToken}
            isExisting={steamSetup.isExisting}
            isGoogleSetup={steamSetup.isGoogleSetup}
            onDone={(token, user) => { setSteamSetup(null); finishLogin(token, user); }}
            onError={msg => { setSteamSetup(null); setError(msg); }}
          />
        )}

        {/* Auth Panel */}
        {!steamSetup && (
        <div className="rounded-sm bg-slate-950/75 backdrop-blur-sm border border-amber-300/20 shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-amber-300/15">
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-5 text-lg font-medium tracking-widest uppercase transition-colors ${
                  tab === t
                    ? 'text-amber-300 bg-amber-300/5 border-b-2 border-amber-300/60'
                    : 'text-white/30 hover:text-white/60'
                }`}>
                {t === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <div className="p-8 space-y-5">
            {tab === 'register' && (
              <>
                <Field label="Nickname" value={nickname} onChange={setNickname} />
                <div className="space-y-2">
                  <label className="text-xs font-mono text-amber-200/50 uppercase tracking-widest">Gemeinde</label>
                  <MunicipalityPicker
                    municipalities={regMunis} loading={regLoadingMunis}
                    selectedId={regMuniId} selectedName={regMuniName}
                    onSelect={(id, name) => { setRegMuniId(id); setRegMuniName(name); }}
                    createOwn={regCreateOwn} onToggleCreate={v => { setRegCreateOwn(v); setRegMuniId(0); setRegMuniName(''); }}
                    newName={regNewMuniName} onNewName={setRegNewMuniName}
                    search={regSearch} onSearch={setRegSearch}
                  />
                </div>
              </>
            )}
            <Field label="E-Mail" value={email} onChange={setEmail} />
            <Field label="Passwort" value={password} onChange={setPassword} type="password" />

            {error && (
              <div className={`px-4 py-3 rounded-sm text-sm font-mono border ${
                error.includes('erstellt')
                  ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-900/30 border-red-500/30 text-red-300'
              }`}>{error}</div>
            )}

            <button
              onClick={tab === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              className="w-full py-5 bg-amber-400/90 hover:bg-amber-300 active:bg-amber-500 text-black font-bold text-xl tracking-widest uppercase rounded-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(251,191,36,0.25)]"
            >
              {loading ? '...' : tab === 'login' ? 'Spielen' : 'Konto erstellen'}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-amber-300/10" />
              <span className="text-white/20 text-sm">oder</span>
              <div className="flex-1 h-px bg-amber-300/10" />
            </div>

            <div className="grid gap-4 grid-cols-2">
              {/* Google */}
              <button onClick={handleGoogle}
                className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-white/70 hover:text-white text-base rounded-sm transition-all flex items-center justify-center gap-3">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Mit Google
              </button>

              {/* Steam — aktiv in Electron, Platzhalter im Web */}
              {IS_ELECTRON ? (
                <button onClick={handleSteamLogin} disabled={loading}
                  className="py-4 bg-[#1b2838] hover:bg-[#2a475e] border border-[#4c6b8a]/50 hover:border-[#66c0f4]/50 text-[#c6d4df] hover:text-white text-base rounded-sm transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/>
                  </svg>
                  Mit Steam anmelden
                </button>
              ) : (
                <button disabled
                  className="py-4 bg-white/[0.03] border border-white/[0.06] text-white/25 text-base rounded-sm flex items-center justify-center gap-3 cursor-not-allowed">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/>
                  </svg>
                  Steam (bald)
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        <p className="text-center text-white/15 text-sm font-mono">buenzlifight.ch</p>
      </div>
    </div>
  );
}
