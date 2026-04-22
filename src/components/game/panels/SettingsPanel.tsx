'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SpriteTestPanel } from './SpriteTestPanel';
import { getAuthToken } from '@/lib/api/coreApi';
import {
  GraduationCap, UserRound, Pencil, Lock, Check, X, Loader2,
  Monitor, Volume2, Bell, Gamepad2, Settings, Cpu, Keyboard,
} from 'lucide-react';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || '';
const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) { headers['Authorization'] = `Bearer ${token}`; headers['X-Game-Token'] = token; }
  return headers;
}

// ── Tab-Definitionen ─────────────────────────────────────────────────────────
type TabId = 'spiel' | 'grafik' | 'audio' | 'benachrichtigungen' | 'tastatur' | 'konto' | 'client';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  electronOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'spiel',             label: 'Spiel',      icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'grafik',            label: 'Grafik',     icon: <Monitor className="w-4 h-4" /> },
  { id: 'audio',             label: 'Audio',      icon: <Volume2 className="w-4 h-4" /> },
  { id: 'benachrichtigungen',label: 'Meldungen',  icon: <Bell className="w-4 h-4" /> },
  { id: 'tastatur',          label: 'Tastatur',   icon: <Keyboard className="w-4 h-4" /> },
  { id: 'konto',             label: 'Konto',      icon: <UserRound className="w-4 h-4" /> },
  { id: 'client',            label: 'Client',     icon: <Cpu className="w-4 h-4" />, electronOnly: true },
];

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
interface SettingsPanelProps {
  onViewProfile?: () => void;
}

export function SettingsPanel({ onViewProfile }: SettingsPanelProps = {}) {
  const { state, setActivePanel, loadState, renameWaterBody } = useGame();
  const { waterBodies } = state;
  const m = useMessages();

  const [activeTab, setActiveTab] = useState<TabId>('spiel');

  const searchParams = useSearchParams();
  const router = useRouter();
  const spriteTestFromUrl = searchParams?.get('spriteTest') === 'true';
  const [showSpriteTest, setShowSpriteTest] = useState(spriteTestFromUrl);
  const lastUrlValueRef = useRef(spriteTestFromUrl);
  const isUpdatingFromStateRef = useRef(false);

  useEffect(() => {
    const val = searchParams?.get('spriteTest') === 'true';
    if (val !== lastUrlValueRef.current && !isUpdatingFromStateRef.current) {
      lastUrlValueRef.current = val;
      setTimeout(() => setShowSpriteTest(val), 0);
    }
  }, [searchParams]);

  useEffect(() => {
    const currentParam = searchParams?.get('spriteTest') === 'true';
    if (currentParam === showSpriteTest) return;
    isUpdatingFromStateRef.current = true;
    lastUrlValueRef.current = showSpriteTest;
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (showSpriteTest) params.set('spriteTest', 'true');
    else params.delete('spriteTest');
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
    setTimeout(() => { isUpdatingFromStateRef.current = false; }, 0);
  }, [showSpriteTest, searchParams, router]);

  const visibleTabs = TABS.filter(t => !t.electronOnly || IS_ELECTRON);

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[640px] w-full bg-[#0f172a] border-slate-700/80 text-white p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Einstellungen
          </DialogTitle>
        </DialogHeader>

        {/* Tab-Leiste */}
        <div className="flex gap-0.5 px-4 pt-3 border-b border-slate-700/60 overflow-x-auto">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-amber-300 border-amber-400 bg-slate-800/50'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab-Inhalt */}
        <div className="px-5 py-4 space-y-3 max-h-[62vh] overflow-y-auto">

          {/* ── SPIEL ── */}
          {activeTab === 'spiel' && (
            <>
              {onViewProfile && (
                <SettingsSection title="Profil">
                  <button
                    onClick={onViewProfile}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-sm text-slate-200 hover:text-white hover:border-blue-400/40 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Mein Profil</div>
                      <div className="text-[11px] text-slate-400">Stats, Badges und Firmen</div>
                    </div>
                  </button>
                </SettingsSection>
              )}
              <SettingsSection title="Steuerung & HUD">
                <SettingsToggle label="Schnelltasten-Hinweise" storageKey="meinort-hotkey-hints" defaultValue={true} />
                <SettingsToggle label="Gebäude-Vorschau beim Platzieren" storageKey="meinort-building-preview" defaultValue={true} />
                <SettingsToggle label="Tooltips anzeigen" storageKey="meinort-tooltips-enabled" defaultValue={true} />
                <SettingsToggle label="Mini-Karte anzeigen" storageKey="meinort-minimap-enabled" defaultValue={true} />
              </SettingsSection>
              <SettingsSection title="Tutorial & Hilfe">
                <button
                  onClick={async () => {
                    try { await fetch(`${AUTH_API_BASE_URL}/api/tutorial/reset`, { method: 'POST', headers: getAuthHeaders() }); } catch {}
                    window.location.reload();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800/80 text-sm text-slate-200 hover:text-white transition-all"
                >
                  <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                  Tutorial zurücksetzen & neu starten
                </button>
              </SettingsSection>
            </>
          )}

          {/* ── GRAFIK ── */}
          {activeTab === 'grafik' && (
            <>
              <SettingsSection title="Visuelle Effekte">
                <SettingsToggle label="Wetter-Effekte" storageKey="meinort-weather-enabled" defaultValue={true} />
                <SettingsToggle label="Partikel-Effekte" storageKey="meinort-particles-enabled" defaultValue={true} />
                <SettingsToggle label="Schatten anzeigen" storageKey="meinort-shadows-enabled" defaultValue={true} />
                <SettingsToggle label="NPC-Animationen" storageKey="meinort-npc-animations" defaultValue={true} />
                <SettingsToggle label="Gebäude-Animationen" storageKey="meinort-building-animations" defaultValue={true} />
              </SettingsSection>
              <SettingsSection title="Performance">
                <SettingsToggle label="Chunk-basiertes Laden (empfohlen)" storageKey="meinort-chunk-loading" defaultValue={true} />
                <SettingsToggle label="Niedrige Auflösung (schwacher PC)" storageKey="meinort-low-res" defaultValue={false} />
              </SettingsSection>
              {IS_ELECTRON && <ElectronDisplaySection />}
            </>
          )}

          {/* ── AUDIO ── */}
          {activeTab === 'audio' && (
            <>
              <SettingsSection title="Sound">
                <SettingsToggle label="Sound-Effekte" storageKey="meinort-sfx-enabled" defaultValue={true} />
                <SettingsToggle label="Hintergrundmusik" storageKey="meinort-music-enabled" defaultValue={false} />
                <SettingsToggle label="Umgebungsgeräusche" storageKey="meinort-ambient-enabled" defaultValue={true} />
                <SettingsToggle label="UI-Klickgeräusche" storageKey="meinort-ui-sounds" defaultValue={true} />
              </SettingsSection>
              <SettingsSection title="Benachrichtigungstöne">
                <SettingsToggle label="Event-Ton" storageKey="meinort-notification-sounds" defaultValue={true} />
                <SettingsToggle label="Chat-Ton" storageKey="meinort-chat-sound" defaultValue={true} />
                <SettingsToggle label="Ton bei Fertigstellung" storageKey="meinort-complete-sound" defaultValue={true} />
              </SettingsSection>
            </>
          )}

          {/* ── BENACHRICHTIGUNGEN ── */}
          {activeTab === 'benachrichtigungen' && (
            <>
              <SettingsSection title="In-Game Meldungen">
                <SettingsToggle label="Event-Benachrichtigungen" storageKey="meinort-event-notifications" defaultValue={true} />
                <SettingsToggle label="Katastrophen-Warnungen" storageKey="meinort-disaster-notifications" defaultValue={true} />
                <SettingsToggle label="Handels-Meldungen" storageKey="meinort-trade-notifications" defaultValue={true} />
                <SettingsToggle label="Gebäude fertig" storageKey="meinort-building-complete-notif" defaultValue={true} />
                <SettingsToggle label="Level-Aufstieg" storageKey="meinort-levelup-notif" defaultValue={true} />
              </SettingsSection>
              <SettingsSection title="Chat & Soziales">
                <SettingsToggle label="Chat-Benachrichtigungen" storageKey="meinort-chat-notifications" defaultValue={true} />
                <SettingsToggle label="Neue Mitbürger" storageKey="meinort-citizen-join-notif" defaultValue={true} />
                <SettingsToggle label="Partnerschafts-Anfragen" storageKey="meinort-partnership-notif" defaultValue={true} />
              </SettingsSection>
            </>
          )}

          {/* ── TASTATUR ── */}
          {activeTab === 'tastatur' && <TastaturSection />}

          {/* ── KONTO ── */}
          {activeTab === 'konto' && <KontoSection />}

          {/* ── CLIENT (Electron only) ── */}
          {activeTab === 'client' && IS_ELECTRON && <ClientSection />}

        </div>
      </DialogContent>

      {showSpriteTest && (
        <SpriteTestPanel onClose={() => setShowSpriteTest(false)} />
      )}
    </Dialog>
  );
}

// ── Tastatur-Tab ─────────────────────────────────────────────────────────────
const SHORTCUT_GROUPS = [
  {
    title: 'Kamera & Navigation',
    shortcuts: [
      { keys: ['W', 'A', 'S', 'D'],     desc: 'Karte bewegen' },
      { keys: ['↑', '↓', '←', '→'],    desc: 'Karte bewegen (Pfeiltasten)' },
      { keys: ['Scroll'],               desc: 'Zoom rein / raus' },
    ],
  },
  {
    title: 'Werkzeuge',
    shortcuts: [
      { keys: ['B'],          desc: 'Bulldozer aktivieren' },
      { keys: ['R'],          desc: 'Gebäude drehen / spiegeln' },
      { keys: ['Esc'],        desc: 'Auswahl aufheben / Panel schliessen' },
    ],
  },
];

function TastaturSection() {
  return (
    <div className="space-y-3">
      {SHORTCUT_GROUPS.map(group => (
        <SettingsSection key={group.title} title={group.title}>
          <div className="divide-y divide-slate-700/30 rounded-lg overflow-hidden">
            {group.shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-slate-800/60 hover:bg-slate-800/80 transition-colors">
                <span className="text-sm text-slate-200">{s.desc}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded bg-slate-900 border border-slate-600 text-[11px] font-mono text-slate-200 shadow-[0_2px_0_rgba(0,0,0,0.4)]">
                        {k}
                      </kbd>
                      {ki < s.keys.length - 1 && (
                        <span className="text-slate-600 text-[10px]">/</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>
      ))}
      <div className="px-3 py-2 text-[11px] text-slate-500 text-center">
        Tastenbelegung wird in einer späteren Version anpassbar sein.
      </div>
    </div>
  );
}

// ── Electron: Anzeige-Einstellungen ─────────────────────────────────────────
const RESOLUTIONS = [
  { label: '1280 × 720',  w: 1280, h: 720  },
  { label: '1440 × 900',  w: 1440, h: 900  },
  { label: '1600 × 900',  w: 1600, h: 900  },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '2560 × 1440', w: 2560, h: 1440 },
];

const RESOLUTION_STORE_KEY = 'electron_resolution';

function ElectronDisplaySection() {
  const [fullscreen, setFullscreen] = useState(false);
  const [resolution, setResolution] = useState('1440 × 900');

  useEffect(() => {
    window.electronWindow?.isFullscreen().then(f => setFullscreen(f ?? false));
    window.electronStore?.get(RESOLUTION_STORE_KEY).then(saved => {
      if (saved && RESOLUTIONS.find(r => r.label === saved)) {
        setResolution(saved);
        const r = RESOLUTIONS.find(r => r.label === saved)!;
        window.electronWindow?.setResolution(r.w, r.h);
      }
    });
  }, []);

  const toggleFullscreen = async () => {
    const next = !fullscreen;
    setFullscreen(next);
    await window.electronWindow?.setFullscreen(next);
  };

  const applyResolution = async (label: string, w: number, h: number) => {
    setResolution(label);
    await window.electronStore?.set(RESOLUTION_STORE_KEY, label);
    if (!fullscreen) await window.electronWindow?.setResolution(w, h);
  };

  return (
    <SettingsSection title="Fenster & Auflösung">
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/60">
        <span className="text-sm text-slate-200">Vollbild</span>
        <button
          onClick={toggleFullscreen}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${fullscreen ? 'bg-emerald-500' : 'bg-slate-600'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${fullscreen ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="rounded-lg bg-slate-800/60 overflow-hidden">
        <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700/50">
          Auflösung {fullscreen && <span className="text-slate-500 ml-1">(im Vollbild ignoriert)</span>}
        </div>
        <div className="divide-y divide-slate-700/30">
          {RESOLUTIONS.map(r => (
            <button
              key={r.label}
              onClick={() => applyResolution(r.label, r.w, r.h)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                resolution === r.label
                  ? 'bg-amber-400/10 text-amber-300'
                  : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
              }`}
            >
              {r.label}
              {resolution === r.label && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}

// ── Client-Tab (Electron) ────────────────────────────────────────────────────
function ClientSection() {
  const [steamUser, setSteamUser] = useState<{ name: string; steamId: string } | null>(null);
  const [steamLoading, setSteamLoading] = useState(true);

  useEffect(() => {
    if (!window.steam) { setSteamLoading(false); return; }
    window.steam.getUser().then(u => {
      setSteamUser(u);
      setSteamLoading(false);
    }).catch(() => setSteamLoading(false));
  }, []);

  return (
    <>
      <SettingsSection title="Steam-Konto">
        <div className="rounded-lg bg-slate-800/60 px-3 py-3 space-y-2.5">
          {steamLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Lade Steam-Daten...
            </div>
          ) : steamUser ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-[#1b2838] border border-[#4c6b8a]/50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#66c0f4]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-white">{steamUser.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{steamUser.steamId}</div>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded px-2 py-0.5">Verbunden</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              Steam nicht verfügbar — ist Steam gestartet?
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Anzeige">
        <ElectronDisplaySection />
      </SettingsSection>

      <SettingsSection title="App-Verhalten">
        <SettingsToggle label="Beim Schliessen minimieren (nicht beenden)" storageKey="meinort-minimize-on-close" defaultValue={false} />
        <SettingsToggle label="Beim Start automatisch anmelden" storageKey="meinort-auto-login" defaultValue={true} />
      </SettingsSection>
    </>
  );
}

// ── Konto-Tab ────────────────────────────────────────────────────────────────
function KontoSection() {
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [newNickname, setNewNickname] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSuccess, setNicknameSuccess] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [history, setHistory] = useState<{ old_nickname: string; changed_at: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isSteamAccount = IS_ELECTRON && typeof window !== 'undefined'
    && localStorage.getItem('isocity_auth_token') !== null;

  useEffect(() => {
    if (!nicknameOpen || daysLeft !== null) return;
    fetch(`${AUTH_API_BASE_URL}/api/auth/nickname-history`, { headers: getAuthHeaders() })
      .then(r => r.json()).catch(() => ({ history: [] }))
      .then(json => {
        const entries: { old_nickname: string; changed_at: string }[] = json.history || [];
        setHistory(entries);
        if (entries.length > 0) {
          const diffDays = (Date.now() - new Date(entries[0].changed_at).getTime()) / (1000 * 60 * 60 * 24);
          setDaysLeft(diffDays < 30 ? Math.ceil(30 - diffDays) : 0);
        } else {
          setDaysLeft(0);
        }
      });
  }, [nicknameOpen, daysLeft]);

  async function handleNicknameChange() {
    setNicknameError('');
    setNicknameLoading(true);
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/change-nickname`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ nickname: newNickname }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setNicknameError(json.error || 'Fehler beim Speichern'); return; }
      setNicknameSuccess(true);
      setNewNickname('');
      setDaysLeft(30);
      setTimeout(() => { setNicknameSuccess(false); setNicknameOpen(false); }, 1500);
    } catch { setNicknameError('Verbindungsfehler'); }
    finally { setNicknameLoading(false); }
  }

  async function handlePasswordChange() {
    setPasswordError('');
    if (newPassword !== confirmPassword) { setPasswordError('Passwörter stimmen nicht überein'); return; }
    if (newPassword.length < 8) { setPasswordError('Mindestens 8 Zeichen'); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/change-password`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setPasswordError(json.error || 'Fehler beim Speichern'); return; }
      setPasswordSuccess(true);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setPasswordSuccess(false); setPasswordOpen(false); }, 1500);
    } catch { setPasswordError('Verbindungsfehler'); }
    finally { setPasswordLoading(false); }
  }

  function loadHistory() {
    setHistoryLoading(true);
    fetch(`${AUTH_API_BASE_URL}/api/auth/nickname-history`, { headers: getAuthHeaders() })
      .then(r => r.json()).catch(() => ({ history: [] }))
      .then(json => setHistory(json.history || []))
      .finally(() => setHistoryLoading(false));
  }

  return (
    <>
      <SettingsSection title="Spieler-Identität">
        <ExpandRow
          icon={<Pencil className="w-4 h-4 text-slate-400" />}
          label="Nickname ändern"
          badge={daysLeft != null && daysLeft > 0 && !nicknameOpen ? `in ${daysLeft}d` : undefined}
          open={nicknameOpen}
          onToggle={() => { setNicknameOpen(o => !o); setNicknameError(''); setNewNickname(''); }}
        >
          {daysLeft == null ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Lade...
            </div>
          ) : daysLeft > 0 ? (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
              Nächste Änderung in <strong>{daysLeft} Tag{daysLeft === 1 ? '' : 'en'}</strong> möglich (1× pro Monat).
            </div>
          ) : (
            <>
              <Input value={newNickname} onChange={e => setNewNickname(e.target.value)}
                placeholder="Neuer Nickname" maxLength={32}
                className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && handleNicknameChange()} />
              <p className="text-[10px] text-slate-500">Kann nur 1× pro Monat geändert werden.</p>
              {nicknameError && <p className="text-xs text-red-400">{nicknameError}</p>}
              {nicknameSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Gespeichert!</p>}
              <Button size="sm" className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                onClick={handleNicknameChange} disabled={nicknameLoading || !newNickname.trim()}>
                {nicknameLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Speichern'}
              </Button>
            </>
          )}
        </ExpandRow>

        <ExpandRow
          icon={<span className="text-slate-400 text-sm leading-none">🕓</span>}
          label="Nickname-Verlauf"
          open={historyOpen}
          onToggle={() => { if (!historyOpen) loadHistory(); setHistoryOpen(o => !o); }}
        >
          {historyLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-1"><Loader2 className="w-3 h-3 animate-spin" /> Lade...</div>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-500">Noch keine Nickname-Änderungen.</p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs rounded bg-slate-900/50 px-2.5 py-1.5">
                  <span className="font-mono text-slate-200">{h.old_nickname}</span>
                  <span className="text-slate-500">{new Date(h.changed_at).toLocaleDateString('de-CH')}</span>
                </div>
              ))}
            </div>
          )}
        </ExpandRow>
      </SettingsSection>

      {!isSteamAccount && (
        <SettingsSection title="Sicherheit">
          <ExpandRow
            icon={<Lock className="w-4 h-4 text-slate-400" />}
            label="Passwort ändern"
            open={passwordOpen}
            onToggle={() => { setPasswordOpen(o => !o); setPasswordError(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
          >
            <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
              placeholder="Aktuelles Passwort"
              className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm" />
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Neues Passwort (min. 8 Zeichen)"
              className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm" />
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Neues Passwort wiederholen"
              className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handlePasswordChange()} />
            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            {passwordSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Passwort geändert!</p>}
            <Button size="sm" className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              onClick={handlePasswordChange} disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}>
              {passwordLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Passwort ändern'}
            </Button>
          </ExpandRow>
        </SettingsSection>
      )}

      {isSteamAccount && (
        <SettingsSection title="Sicherheit">
          <div className="px-3 py-2.5 rounded-lg bg-slate-800/60 text-xs text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#66c0f4] shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/>
            </svg>
            Passwort wird über Steam verwaltet.
          </div>
        </SettingsSection>
      )}

      <SettingsSection title="Abmelden">
        <button
          onClick={() => {
            localStorage.removeItem('isocity_auth_token');
            sessionStorage.removeItem('isocity_auth_token');
            window.location.href = IS_ELECTRON ? '/steam' : '/';
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
        >
          <X className="w-4 h-4 shrink-0" />
          Abmelden
        </button>
      </SettingsSection>
    </>
  );
}

// ── Shared UI ────────────────────────────────────────────────────────────────
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2.5 font-semibold">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ExpandRow({ icon, label, badge, open, onToggle, children }: {
  icon: React.ReactNode; label: string; badge?: string;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-800/60 overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors">
        <div className="flex items-center gap-2">{icon}{label}</div>
        <div className="flex items-center gap-2">
          {badge && <span className="text-[10px] text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">{badge}</span>}
          {open ? <X className="w-4 h-4 text-slate-500" /> : <span className="text-xs text-slate-500">›</span>}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingsToggle({ label, storageKey, defaultValue, inverted }: {
  label: string; storageKey: string; defaultValue: boolean; inverted?: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setEnabled(inverted ? stored !== 'true' : stored === 'true');
  }, [storageKey, inverted]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (typeof window !== 'undefined')
      localStorage.setItem(storageKey, inverted ? (!next).toString() : next.toString());
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800/80 transition-colors">
      <span className="text-sm text-slate-200">{label}</span>
      <button onClick={handleToggle}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
