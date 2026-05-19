'use client';

import React, { useState, useEffect } from 'react';
import { Compass, MessageCircle, User, Bell, Settings } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { NavigatorModal } from '@/components/game/panels/NavigatorModal';
import { MessengerPanel } from '@/components/game/panels/MessengerPanel';
import { PlayerProfilePanel } from '@/components/game/panels/PlayerProfilePanel';
import { SettingsPanel } from '@/components/game/panels/SettingsPanel';
import { getMyAuthProfile, getMyBankingProfile } from '@/lib/api/bankingApi';
import { getAuthToken } from '@/lib/api/coreApi';
import { normalizeAvatarAppearanceConfig } from '@/lib/avatarConfig';
import { renderAvatarHeadDataUrl } from '@/lib/myAvatarRenderer';

const GAME_API_BASE = (() => {
  const base = (process.env.NEXT_PUBLIC_CORE_API_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
  if (base.endsWith('/api/game')) return base;
  if (base.endsWith('/api')) return `${base}/game`;
  return `${base}/api/game`;
})();

function useAvatarHeadUrl(): string | null {
  const [headUrl, setHeadUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken() || (typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') || '' : '');
    if (!token) return;

    fetch(`${GAME_API_BASE}/user-data/avatar-config`, {
      headers: { Accept: 'application/json', 'X-Game-Token': token },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const config = normalizeAvatarAppearanceConfig(json?.data?.avatar_config || {});
        setHeadUrl(renderAvatarHeadDataUrl(config, 2));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return headUrl;
}

// ── Typen ─────────────────────────────────────────────────────────────────────
export interface LobbyScreenProps {
  username: string;
  onEnterRoom: (slug: string, roomCode: string, roomName: string, ownerId?: number) => void;
  isAdmin?: boolean;
  isMod?: boolean;
  unreadNotifications?: number;
}

// ── LobbyScreen (benötigt GameContext vom Parent-Provider) ────────────────────
export function LobbyScreen({ username, onEnterRoom, unreadNotifications = 0 }: LobbyScreenProps) {
  const { state, setActivePanel } = useGame();
  const avatarHeadUrl = useAvatarHeadUrl();

  const [playerLevel, setPlayerLevel] = useState(0);
  const [playerXp, setPlayerXp] = useState(0);
  const [playerNextXp, setPlayerNextXp] = useState<number | null>(null);
  const [playerBalance, setPlayerBalance] = useState<number | null>(null);

  useEffect(() => {
    getMyAuthProfile().then((p) => {
      setPlayerLevel(p.xp.level);
      setPlayerXp(p.xp.total_xp);
      setPlayerNextXp(p.xp.next_level_xp);
    }).catch(() => {});
    getMyBankingProfile().then((b) => setPlayerBalance(b.balance)).catch(() => {});
  }, []);

  const panelToMenu: Partial<Record<string, string>> = {
    navigator: 'navigator',
    chat:      'messenger',
    profile:   'profile',
    reports:   'notifs',
    settings:  'settings',
  };
  const activeMenu = panelToMenu[state.activePanel] ?? null;

  const menuItems = [
    {
      id: 'navigator',
      icon: <Compass size={22} />,
      label: 'Navigator',
      action: () => setActivePanel('navigator'),
    },
    {
      id: 'messenger',
      icon: <MessageCircle size={22} />,
      label: 'Nachrichten',
      action: () => setActivePanel('chat'),
    },
    {
      id: 'profile',
      icon: <User size={22} />,
      label: 'Profil',
      action: () => setActivePanel('profile'),
    },
    {
      id: 'notifs',
      icon: (
        <div className="relative">
          <Bell size={22} />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </div>
      ),
      label: 'Benachrichtigungen',
      action: () => setActivePanel('reports'),
    },
    {
      id: 'settings',
      icon: <Settings size={22} />,
      label: 'Einstellungen',
      action: () => setActivePanel('settings'),
    },
  ];

  const handleVisitRoom = (slug: string, roomCode?: string, roomName?: string, ownerId?: number) => {
    onEnterRoom(slug, roomCode ?? 'MAIN', roomName ?? slug, ownerId);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col">
      {/* Hintergrundbild */}
      <div
        className="absolute inset-0 hero-gradient"
        style={{ backgroundImage: "linear-gradient(180deg, hsl(220 20% 5% / 0.40) 0%, hsl(220 20% 5% / 0.60) 60%, hsl(220 20% 5% / 0.85) 100%), url('/assets/bg-hq-navi.png')" }}
      />

      {/* Dekorative Lichter */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      {/* Hauptinhalt */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-4 px-4">
        {/* Logo / Titel — mit dunklem Backdrop für Lesbarkeit */}
        <div className="text-center bg-black/50 backdrop-blur-sm rounded-2xl px-8 py-5 border border-white/10 shadow-2xl">
          <h1 className="text-4xl font-bold text-amber-300 tracking-tight drop-shadow-lg" style={{ fontFamily: 'var(--font-playfair), serif', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            Buenzlifight
          </h1>
          <p className="mt-2 text-base text-white/90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            Willkommen zurück, <span className="text-amber-300 font-semibold">{username}</span>!
          </p>
          <p className="mt-2 text-xs text-white/60">
            Öffne den Navigator um ein Zimmer zu betreten oder dein eigenes Haus zu besuchen.
          </p>
        </div>
      </div>

      {/* Navigator-Modal (rendert sich selbst wenn activePanel === 'navigator') */}
      <NavigatorModal onVisitMunicipality={handleVisitRoom} />

      {/* Messenger-Panel — floating, kein Backdrop damit Lobby bedienbar bleibt */}
      {state.activePanel === 'chat' && (
        <MessengerPanel
          onClose={() => setActivePanel('none')}
          onOpenChat={(_friendId, _friendName) => {}}
        />
      )}

      {/* Profil-Panel */}
      {state.activePanel === 'profile' && (
        <PlayerProfilePanel
          userId="me"
          onClose={() => setActivePanel('none')}
        />
      )}

      {/* Einstellungen-Panel */}
      {state.activePanel === 'settings' && (
        <SettingsPanel onViewProfile={() => setActivePanel('profile')} />
      )}

      {/* Habbo-Style Footer */}
      <div className="relative z-10 w-full" style={{ background: '#1d1e21', height: 60, display: 'flex', alignItems: 'center', flexShrink: 0 }}>

        {/* Avatar + Name + Level + XP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 8px', borderRight: '1px solid #333', height: '100%', flexShrink: 0 }}>
          {/* Avatar-Kopf */}
          <div style={{ width: 36, height: 54, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
            {avatarHeadUrl ? (
              <img src={avatarHeadUrl} alt="Me" draggable={false}
                style={{ width: 36, height: 50, objectFit: 'cover', objectPosition: 'center 15%', imageRendering: 'pixelated' }} />
            ) : (
              <img src="/images/bottom_bar/ghosthead.png" alt="Me" draggable={false}
                style={{ width: 36, height: 34, objectFit: 'none', objectPosition: '42% 27%' }} />
            )}
          </div>
          {/* Name + Level + XP-Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, maxWidth: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>
              {username}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 4, padding: '1px 5px', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                Lv. {playerLevel}
              </span>
              <div
                title={`${playerXp.toLocaleString('de-CH')} / ${playerNextXp ? playerNextXp.toLocaleString('de-CH') : '–'} XP`}
                style={{ flex: 1, height: 5, background: '#333', borderRadius: 3, overflow: 'hidden', minWidth: 60, maxWidth: 100 }}
              >
                <div style={{
                  height: '100%',
                  width: `${playerNextXp ? Math.min(100, Math.round((playerXp / playerNextXp) * 100)) : 100}%`,
                  background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                  borderRadius: 3,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: '#666', whiteSpace: 'nowrap' }}>
                {playerNextXp ? Math.min(100, Math.round((playerXp / playerNextXp) * 100)) : 100}%
              </span>
            </div>
          </div>
        </div>

        {/* Währungen */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0, borderRight: '1px solid #333' }}>
          {[
            { icon: '💰', label: 'Münzen', value: playerBalance != null ? Math.floor(playerBalance).toLocaleString('de-CH') : '–' },
            { icon: '🔥', label: 'Flammen', value: '0' },
            { icon: '⭐', label: 'Rare', value: '0' },
          ].map(({ icon, label, value }, i, arr) => (
            <div key={label} title={`${value} ${label}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: '100%', borderRight: i < arr.length - 1 ? '1px solid #2a2a2a' : 'none' }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 9, color: '#666', lineHeight: 1 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8e8', lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Nav-Icons (zentriert / flex-1) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              title={item.label}
              style={{
                padding: '0 16px',
                height: '100%',
                background: activeMenu === item.id ? 'rgba(255,255,255,0.12)' : 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                color: activeMenu === item.id ? '#fbbf24' : '#9ca3af',
                position: 'relative',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { if (activeMenu !== item.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (activeMenu !== item.id) (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <span style={{ fontSize: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap', lineHeight: 1 }}>{item.label}</span>
              {activeMenu === item.id && (
                <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fbbf24' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

