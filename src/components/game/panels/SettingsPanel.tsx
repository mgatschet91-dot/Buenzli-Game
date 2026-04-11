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
import { GraduationCap, UserRound, Pencil, Lock, Check, X, Loader2 } from 'lucide-react';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) { headers['Authorization'] = `Bearer ${token}`; headers['X-Game-Token'] = token; }
  return headers;
}

// Translatable UI labels
const UI_LABELS = {
  settings: msg('Settings'),
  gameSettings: msg('Game Settings'),
};

// Helper function to load example state with proper error handling
async function loadExampleState(
  filename: string,
  loadState: (stateString: string) => boolean,
  setActivePanel: (panel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings') => void
): Promise<void> {
  try {
    const response = await fetch(`/example-states/${filename}`);
    if (!response.ok) {
      console.error(`Failed to fetch ${filename}:`, response.status);
      alert(`Failed to load example state: ${response.status}`);
      return;
    }
    const exampleState = await response.json();
    const success = loadState(JSON.stringify(exampleState));
    if (success) {
      setActivePanel('none');
    } else {
      console.error('loadState returned false - invalid state format for', filename);
      alert('Failed to load example state: invalid format');
    }
  } catch (e) {
    console.error('Error loading example state:', e);
    alert(`Error loading example state: ${e}`);
  }
}

interface SettingsPanelProps {
  onViewProfile?: () => void;
}

export function SettingsPanel({ onViewProfile }: SettingsPanelProps = {}) {
  const { state, setActivePanel, loadState, renameWaterBody } = useGame();
  const { waterBodies } = state;
  const m = useMessages();

  // Water body editing state
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [waterNameInput, setWaterNameInput] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize showSpriteTest from query parameter
  const spriteTestFromUrl = searchParams?.get('spriteTest') === 'true';
  const [showSpriteTest, setShowSpriteTest] = useState(spriteTestFromUrl);
  const lastUrlValueRef = useRef(spriteTestFromUrl);
  const isUpdatingFromStateRef = useRef(false);
  
  // Sync state with query parameter when URL changes externally
  useEffect(() => {
    const spriteTestParam = searchParams?.get('spriteTest') === 'true';
    // Only update if URL value actually changed and we're not updating from state
    if (spriteTestParam !== lastUrlValueRef.current && !isUpdatingFromStateRef.current) {
      lastUrlValueRef.current = spriteTestParam;
      setTimeout(() => setShowSpriteTest(spriteTestParam), 0);
    }
  }, [searchParams]);
  
  // Sync query parameter when showSpriteTest changes (but avoid loops)
  useEffect(() => {
    const currentParam = searchParams?.get('spriteTest') === 'true';
    if (currentParam === showSpriteTest) return; // Already in sync
    
    isUpdatingFromStateRef.current = true;
    lastUrlValueRef.current = showSpriteTest;
    
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (showSpriteTest) {
      params.set('spriteTest', 'true');
    } else {
      params.delete('spriteTest');
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
    
    // Reset flag after URL update
    setTimeout(() => {
      isUpdatingFromStateRef.current = false;
    }, 0);
  }, [showSpriteTest, searchParams, router]);
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[540px] bg-slate-900/95 border-slate-700 text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">{m(UI_LABELS.settings)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Profile */}
          {onViewProfile && (
            <SettingsSection title="Profil">
              <button
                onClick={onViewProfile}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-sm text-slate-200 hover:text-white hover:border-blue-400/40 hover:from-blue-500/15 hover:to-purple-500/15 transition-all"
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

          {/* Account Settings */}
          <KontoSection />

          {/* Graphics Settings */}
          <SettingsSection title="Grafik">
            <SettingsToggle
              label="Wetter-Effekte"
              storageKey="meinort-weather-enabled"
              defaultValue={true}
            />
            <SettingsToggle
              label="Partikel-Effekte"
              storageKey="meinort-particles-enabled"
              defaultValue={true}
            />
            <SettingsToggle
              label="NPC-Animationen"
              storageKey="meinort-npc-animations"
              defaultValue={true}
            />
            <SettingsToggle
              label="Gebäude-Vorschau"
              storageKey="meinort-building-preview"
              defaultValue={true}
            />
            <SettingsToggle
              label="Schatten anzeigen"
              storageKey="meinort-shadows-enabled"
              defaultValue={true}
            />
          </SettingsSection>

          {/* Sound Settings */}
          <SettingsSection title="Sound">
            <SettingsToggle
              label="Sound-Effekte"
              storageKey="meinort-sfx-enabled"
              defaultValue={true}
            />
            <SettingsToggle
              label="Benachrichtigungs-Toene"
              storageKey="meinort-notification-sounds"
              defaultValue={true}
            />
          </SettingsSection>

          {/* Notification Settings */}
          <SettingsSection title="Benachrichtigungen">
            <SettingsToggle
              label="Event-Benachrichtigungen"
              storageKey="meinort-event-notifications"
              defaultValue={true}
            />
            <SettingsToggle
              label="Chat-Benachrichtigungen"
              storageKey="meinort-chat-notifications"
              defaultValue={true}
            />
            <SettingsToggle
              label="Handels-Benachrichtigungen"
              storageKey="meinort-trade-notifications"
              defaultValue={true}
            />
          </SettingsSection>

          {/* Game Settings */}
          <SettingsSection title={String(m(UI_LABELS.gameSettings))}>
            <SettingsToggle
              label="Schnelltasten-Hinweise"
              storageKey="meinort-hotkey-hints"
              defaultValue={true}
            />
            <button
              onClick={async () => {
                const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
                const token = getAuthToken();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) { headers['Authorization'] = `Bearer ${token}`; headers['X-Game-Token'] = token; }
                try {
                  await fetch(`${AUTH_API_BASE_URL}/api/tutorial/reset`, { method: 'POST', headers });
                } catch {}
                window.location.reload();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800/80 text-sm text-slate-200 hover:text-white transition-all"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
              Tutorial erneut starten
            </button>
          </SettingsSection>
        </div>
      </DialogContent>
      
      {showSpriteTest && (
        <SpriteTestPanel onClose={() => {
          setShowSpriteTest(false);
        }} />
      )}
    </Dialog>
  );
}

function KontoSection() {
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [newNickname, setNewNickname] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSuccess, setNicknameSuccess] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null); // null = not loaded yet

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [history, setHistory] = useState<{ old_nickname: string; changed_at: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load cooldown on open
  useEffect(() => {
    if (!nicknameOpen || daysLeft !== null) return;
    fetch(`${AUTH_API_BASE_URL}/api/auth/nickname-history`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .catch(() => ({ history: [] }))
      .then(json => {
        const entries: { old_nickname: string; changed_at: string }[] = json.history || [];
        setHistory(entries);
        if (entries.length > 0) {
          const lastChange = new Date(entries[0].changed_at);
          const diffDays = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
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
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nickname: newNickname }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setNicknameError(json.error || 'Fehler beim Speichern'); return; }
      setNicknameSuccess(true);
      setNewNickname('');
      setDaysLeft(30); // reset cooldown display
      setTimeout(() => { setNicknameSuccess(false); setNicknameOpen(false); }, 1500);
    } catch {
      setNicknameError('Verbindungsfehler');
    } finally {
      setNicknameLoading(false);
    }
  }

  async function handlePasswordChange() {
    setPasswordError('');
    if (newPassword !== confirmPassword) { setPasswordError('Passwörter stimmen nicht überein'); return; }
    if (newPassword.length < 8) { setPasswordError('Mindestens 8 Zeichen'); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setPasswordError(json.error || 'Fehler beim Speichern'); return; }
      setPasswordSuccess(true);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setPasswordSuccess(false); setPasswordOpen(false); }, 1500);
    } catch {
      setPasswordError('Verbindungsfehler');
    } finally {
      setPasswordLoading(false);
    }
  }

  function loadHistory() {
    setHistoryLoading(true);
    fetch(`${AUTH_API_BASE_URL}/api/auth/nickname-history`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .catch(() => ({ history: [] }))
      .then(json => setHistory(json.history || []))
      .finally(() => setHistoryLoading(false));
  }

  return (
    <SettingsSection title="Konto">
      {/* Nickname ändern */}
      <div className="rounded-lg bg-slate-800/60 overflow-hidden">
        <button
          onClick={() => { setNicknameOpen(o => !o); setNicknameError(''); setNewNickname(''); }}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-slate-400" />
            Nickname ändern
          </div>
          <div className="flex items-center gap-2">
            {daysLeft != null && daysLeft > 0 && !nicknameOpen && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">in {daysLeft}d</span>
            )}
            {nicknameOpen ? <X className="w-4 h-4 text-slate-500" /> : <span className="text-xs text-slate-500">›</span>}
          </div>
        </button>
        {nicknameOpen && (
          <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2.5">
            {daysLeft == null ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Lade...
              </div>
            ) : daysLeft > 0 ? (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
                Nächste Änderung in <strong>{daysLeft} Tag{daysLeft === 1 ? '' : 'en'}</strong> möglich (1x pro Monat).
              </div>
            ) : (
              <>
                <Input
                  value={newNickname}
                  onChange={e => setNewNickname(e.target.value)}
                  placeholder="Neuer Nickname"
                  className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
                  maxLength={32}
                  onKeyDown={e => e.key === 'Enter' && handleNicknameChange()}
                />
                <p className="text-[10px] text-slate-500">Kann nur 1× pro Monat geändert werden.</p>
                {nicknameError && <p className="text-xs text-red-400">{nicknameError}</p>}
                {nicknameSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Gespeichert!</p>}
                <Button
                  size="sm"
                  className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  onClick={handleNicknameChange}
                  disabled={nicknameLoading || !newNickname.trim()}
                >
                  {nicknameLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Speichern'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Nickname-Verlauf */}
      <div className="rounded-lg bg-slate-800/60 overflow-hidden">
        <button
          onClick={() => { if (!historyOpen) loadHistory(); setHistoryOpen(o => !o); }}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">🕓</span>
            Nickname-Verlauf
          </div>
          {historyOpen ? <X className="w-4 h-4 text-slate-500" /> : <span className="text-xs text-slate-500">›</span>}
        </button>
        {historyOpen && (
          <div className="px-3 pb-3 border-t border-slate-700/50 pt-2.5">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1"><Loader2 className="w-3 h-3 animate-spin" /> Lade...</div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-500">Noch keine Nickname-Änderungen.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs rounded bg-slate-900/50 px-2.5 py-1.5">
                    <span className="font-mono text-slate-200">{h.old_nickname}</span>
                    <span className="text-slate-500">{new Date(h.changed_at).toLocaleDateString('de-CH')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Passwort ändern */}
      <div className="rounded-lg bg-slate-800/60 overflow-hidden">
        <button
          onClick={() => { setPasswordOpen(o => !o); setPasswordError(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            Passwort ändern
          </div>
          {passwordOpen ? <X className="w-4 h-4 text-slate-500" /> : <span className="text-xs text-slate-500">›</span>}
        </button>
        {passwordOpen && (
          <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2.5">
            <Input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              placeholder="Aktuelles Passwort"
              className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Neues Passwort (min. 8 Zeichen)"
              className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Neues Passwort wiederholen"
              className="bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
            />
            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            {passwordSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Passwort geändert!</p>}
            <Button
              size="sm"
              className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              onClick={handlePasswordChange}
              disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}
            >
              {passwordLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Passwort ändern'}
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2.5 font-semibold">{title}</div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function SettingsToggle({ label, storageKey, defaultValue, inverted }: {
  label: string;
  storageKey: string;
  defaultValue: boolean;
  inverted?: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const val = stored === 'true';
      setEnabled(inverted ? !val : val);
    }
  }, [storageKey, inverted]);

  const handleToggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, inverted ? (!newValue).toString() : newValue.toString());
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800/80 transition-colors">
      <span className="text-sm text-slate-200">{label}</span>
      <button
        onClick={handleToggle}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

