'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { IsometricRoomViewer } from './IsometricRoomViewer';
import { ShopPanel } from './ShopPanel';
import { InventoryPanel } from './InventoryPanel';
import { RoomModerationPanel } from './RoomModerationPanel';
import { getAuthToken } from '@/lib/api/coreApi';
import { ArrowLeft, Home, Loader2, ShoppingBag, Archive, User, Pencil, Shield, Compass, MessageCircle, Heart, Camera, X as XIcon } from 'lucide-react';
import * as navigatorApi from '@/lib/api/navigatorApi';
import { NavigatorModal } from './panels/NavigatorModal';
import { MessengerPanel } from './panels/MessengerPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomGeometry {
  // Altes SQL-Format
  grid_size:   number;
  wall_n?: number; wall_s?: number; wall_e?: number; wall_w?: number;
  door_wall?: string; door_offset?: number; door_width?: number; door_height?: number;
  staircases?: { x0: number; x1: number; z0: number; z1: number; from_floor: number; to_floor: number }[];
  // Editor v:1-Format
  v?: number;
  floors?: unknown[];
  stairs?: unknown[];
  rollers?: unknown[];
  spawn?: unknown;
}

interface RoomData {
  model_name: string;
  avatar_code: string | null;
  owner_nickname: string;
  room_display_name?: string | null;
  roomDescription?: string | null;
  geometry?: RoomGeometry;
}

type SideTab = 'shop' | 'inventory' | 'avatar' | null;

interface RoomVisitor {
  playerId: string;
  userId: number | null;
  name: string;
}

export interface RoomViewerOverlayProps {
  userId: number;
  nickname: string;
  municipalitySlug: string;
  roomCode?: string;
  roomName?: string;
  isOwner: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onNavigateToRoom?: (slug: string, roomCode: string, roomName: string, ownerId?: number) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

// ─── Component ────────────────────────────────────────────────────────────────

export function RoomViewerOverlay({
  userId,
  nickname,
  municipalitySlug,
  roomCode,
  roomName,
  isOwner,
  isAdmin = false,
  onClose,
  onNavigateToRoom,
}: RoomViewerOverlayProps) {
  const isPubRoom = (roomCode || '').toUpperCase().startsWith('PUB');
  const [roomData, setRoomData]     = useState<RoomData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [avatarCode, setAvatarCode] = useState<string | null>(null);
  const [savingAvatar, setSaving]   = useState(false);
  const [activeTab, setActiveTab]   = useState<SideTab>(null);
  const [invRefresh, setInvRefresh] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [localNickname, setLocalNickname] = useState<string>('');
  const [visitors, setVisitors] = useState<RoomVisitor[]>([]);
  const [modOpen, setModOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [thumbSaving, setThumbSaving] = useState(false);
  const [thumbSaved, setThumbSaved] = useState(false);
  const [knockers, setKnockers] = useState<{ userId: number; nickname: string }[]>([]);
  const knockSocketRef = useRef<{ accept: (uid: number) => void; decline: (uid: number) => void } | null>(null);
  // Aktuell angezeigte Raum-User-ID (kann sich durch Teleportation ändern)
  const [currentUserId, setCurrentUserId] = useState(userId);
  const myId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || 0) : 0;
  const currentIsOwner = currentUserId === myId;
  // Admins/Mods haben in PUB-Räumen volle Eigentümer-Rechte
  const effectiveIsOwner = currentIsOwner || (isPubRoom && isAdmin);
  const iframeRef                   = useRef<HTMLIFrameElement>(null);

  // ── Load room + avatar ───────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    // PUB rooms: load layout_json from server (if any), furniture comes via socket
    if (isPubRoom) {
      const token = getAuthToken() || '';
      let geometry: RoomGeometry | undefined;
      try {
        const r = await fetch(
          `${API_BASE}/api/game/pub-room/layout?slug=${encodeURIComponent(municipalitySlug)}&room_code=${encodeURIComponent(roomCode || '')}`,
          { headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token } }
        );
        const d = await r.json();
        if (d.ok && d.data?.v === 1) geometry = d.data;
      } catch { /* ignorieren — Fallback auf socket-Geometrie */ }
      setRoomData({ model_name: 'model_standard', avatar_code: null, owner_nickname: roomName || 'Offizieller Raum', geometry });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken() || '';
      const r = await fetch(
        `${API_BASE}/api/game/municipality/${municipalitySlug}/residence/room/${currentUserId}`,
        { headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token } }
      );
      const d = await r.json();
      if (d.ok) {
        setRoomData(d.data);
        setAvatarCode(d.data.avatar_code || null);
        // my_nickname direkt aus Room-API — kein separater /api/auth/me fetch nötig
        if (d.data.my_nickname) setLocalNickname(d.data.my_nickname);
      } else {
        setError(d.error || 'Fehler beim Laden');
      }
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }, [municipalitySlug, currentUserId, isPubRoom, roomName]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  // Favoriten-Status prüfen (nicht für eigene Räume)
  useEffect(() => {
    if (!municipalitySlug || !roomCode || currentIsOwner) return;
    navigatorApi.getFavoriteKeys()
      .then(keys => setIsFav(keys.has(`${municipalitySlug}:${roomCode}`)))
      .catch(() => {});
  }, [municipalitySlug, roomCode, currentIsOwner]);

  const toggleFav = useCallback(async () => {
    const rn = roomData?.room_display_name || `${nickname}s Zimmer`;
    const mn = municipalitySlug;
    if (isFav) {
      setIsFav(false);
      await navigatorApi.removeFavorite(mn, roomCode || 'MAIN').catch(() => {});
    } else {
      setIsFav(true);
      await navigatorApi.addFavorite({
        municipality_slug: mn,
        municipality_name: mn,
        room_code: roomCode || 'MAIN',
        room_name: rn,
        owner_user_id: currentUserId,
      }).catch(() => {});
    }
  }, [isFav, municipalitySlug, roomCode, currentUserId, roomData, nickname]);

  // Owner: localNickname direkt aus prop setzen (Gäste bekommen es via my_nickname aus loadRoom)
  useEffect(() => {
    if (currentIsOwner) setLocalNickname(nickname);
  }, [currentIsOwner, nickname]);

  // ── ESC closes overlay ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── iframe notifies us when its avatar panel closes internally ───────────
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'AVATAR_EDITOR_CLOSED') setActiveTab(null);
      if (e.data?.type === 'EDITOR_SAVED') { setEditorOpen(false); loadRoom(); }
      if (e.data?.type === 'EDITOR_CLOSE') { setEditorOpen(false); }
      if (e.data?.type === 'ROOM_SCREENSHOT' && typeof e.data.dataUrl === 'string') {
        setScreenshotUrl(e.data.dataUrl);
        setThumbSaved(false);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [loadRoom]);

  const takeScreenshot = useCallback(() => {
    const iframe = document.querySelector('#isometric-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'TAKE_SCREENSHOT' }, '*');
  }, []);

  const playKnockSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let s = 0; s < ch.length; s++) ch[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / ch.length, 2);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 220;
        filter.Q.value = 0.8;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.06);
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(now + i * 0.18);
      }
    } catch { /* AudioContext evtl. nicht verfügbar */ }
  }, []);

  const handleKnockReceived = useCallback((fromUserId: number, fromNickname: string) => {
    setKnockers(prev => {
      if (prev.some(k => k.userId === fromUserId)) return prev;
      return [...prev, { userId: fromUserId, nickname: fromNickname }];
    });
    playKnockSound();
  }, [playKnockSound]);

  const acceptKnocker = useCallback((uid: number) => {
    knockSocketRef.current?.accept(uid);
    setKnockers(prev => prev.filter(k => k.userId !== uid));
  }, []);

  const declineKnocker = useCallback((uid: number) => {
    knockSocketRef.current?.decline(uid);
    setKnockers(prev => prev.filter(k => k.userId !== uid));
  }, []);

  const saveAsThumb = useCallback(async (dataUrl: string) => {
    setThumbSaving(true);
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/user/room/thumbnail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ dataUrl }),
      });
      if (r.ok) setThumbSaved(true);
    } finally { setThumbSaving(false); }
  }, []);


  // ── Avatar change from iframe ────────────────────────────────────────────
  const handleAvatarChange = useCallback(async (code: string) => {
    setAvatarCode(code);
    if (!currentIsOwner) return;
    setSaving(true);
    try {
      const token = getAuthToken() || '';
      await fetch(`${API_BASE}/api/game/user/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ avatar_code: code }),
      });
    } finally {
      setSaving(false);
    }
  }, [isOwner]);

  // ── Avatar tab button: toggle iframe's avatar editor ────────────────────
  const handleAvatarTab = useCallback(() => {
    const next: SideTab = activeTab === 'avatar' ? null : 'avatar';
    setActiveTab(next);
    const win = (document.querySelector('#isometric-iframe') as HTMLIFrameElement | null)?.contentWindow;
    if (win) {
      win.postMessage({ type: next === 'avatar' ? 'SHOW_AVATAR_EDITOR' : 'HIDE_AVATAR_EDITOR' }, '*');
    }
  }, [activeTab]);

  // ── Tab buttons (Shop + Inventar nur für Eigentümer / Admin in PUB-Räumen) ──
  const TAB_BTNS: { id: SideTab; icon: React.ReactNode; label: string }[] = [
    ...(effectiveIsOwner ? [
      { id: 'shop'      as SideTab, icon: <ShoppingBag className="w-4 h-4" />, label: 'Shop' },
      { id: 'inventory' as SideTab, icon: <Archive     className="w-4 h-4" />, label: 'Inventar' },
    ] : []),
    { id: 'avatar', icon: <User className="w-4 h-4" />, label: 'Avatar' },
  ];

  const visitorCount = visitors.filter(v => v.userId !== null).length;

  const sideOpen = activeTab !== null && activeTab !== 'avatar';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#16120e', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>

      {/* ── Topbar ── */}
      <div
        className="flex items-center justify-between px-4 shrink-0 border-b border-white/10"
        style={{ height: 48 }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Verlassen
        </button>

        <div className="flex items-center gap-2 text-slate-200">
          <Home className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm leading-tight">
              {isPubRoom
                ? (roomName || roomCode || 'Offizieller Raum')
                : (roomData?.room_display_name || `${nickname}s Zimmer`)}
            </span>
            {!isPubRoom && roomData?.roomDescription && (
              <span className="text-[10px] text-slate-400 leading-tight max-w-[220px] truncate">
                {roomData.roomDescription}
              </span>
            )}
          </div>
          {savingAvatar && <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-1" />}
          <button
            onClick={() => setNavOpen(o => !o)}
            title="Navigator"
            className={`ml-2 p-1.5 rounded transition-colors ${navOpen ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-amber-400 hover:bg-white/5'}`}
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMsgOpen(o => !o)}
            title="Nachrichten"
            className={`p-1.5 rounded transition-colors ${msgOpen ? 'text-sky-400 bg-sky-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-white/5'}`}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          {!currentIsOwner && !isPubRoom && (
            <button
              onClick={toggleFav}
              title={isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
              className="p-1.5 rounded transition-colors"
              style={{ color: isFav ? '#ef4444' : '#64748b' }}
            >
              <Heart className="w-4 h-4" fill={isFav ? '#ef4444' : 'none'} />
            </button>
          )}
        </div>

        {/* Bearbeiten-Button — Eigentümer oder Admin in PUB-Räumen */}
        {effectiveIsOwner && roomData && !loading ? (
          <button
            onClick={() => setEditorOpen(true)}
            title="Raum bearbeiten"
            className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors text-sm px-2 py-1 rounded hover:bg-white/5"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Bearbeiten</span>
          </button>
        ) : (
          <div style={{ width: 80 }} />
        )}
      </div>

      {/* ── Main area: room + optional side panel ── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* Room canvas (fills all remaining space) */}
        <div className="flex-1 min-w-0 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Lade Zimmer…</span>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm z-10">
              {error}
            </div>
          )}
          {roomData && !loading && (
            <IsometricRoomViewer
              modelName={roomData.model_name}
              avatarCode={effectiveIsOwner ? avatarCode : null}
              geometry={roomData.geometry as never}
              ownerId={currentUserId}
              isOwner={effectiveIsOwner}
              municipalitySlug={municipalitySlug}
              roomCode={roomCode}
              playerName={localNickname || (effectiveIsOwner ? nickname : '')}
              ownerNickname={roomData?.owner_nickname || nickname}
              onAvatarChange={handleAvatarChange}
              onTeleportToRoom={setCurrentUserId}
              onExit={onClose}
              onVisitorsChange={setVisitors}
              onKnockReceived={effectiveIsOwner ? handleKnockReceived : undefined}
              knockSocketRef={knockSocketRef}
            />
          )}

          {/* Floating tab buttons (right edge of room canvas) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 pr-1 z-20">
            {TAB_BTNS.map(btn => (
              <button
                key={btn.id}
                onClick={btn.id === 'avatar' ? handleAvatarTab : () => setActiveTab(activeTab === btn.id ? null : btn.id)}
                title={btn.label}
                className={`flex flex-col items-center gap-0.5 rounded-l-xl px-2 py-2.5 text-xs transition-colors shadow-lg ${
                  activeTab === btn.id
                    ? btn.id === 'shop'
                      ? 'bg-amber-700 text-white'
                      : btn.id === 'inventory'
                        ? 'bg-violet-800 text-white'
                        : 'bg-indigo-700 text-white'
                    : 'bg-black/60 text-slate-400 hover:text-slate-200 hover:bg-black/80'
                }`}
                style={{ border: '1px solid rgba(255,255,255,0.10)', borderRight: 'none' }}
              >
                {btn.icon}
                <span className="text-[9px] leading-none">{btn.label}</span>
              </button>
            ))}
            {/* Kamera-Button */}
            <button
              onClick={takeScreenshot}
              title="Foto machen"
              className="flex flex-col items-center gap-0.5 rounded-l-xl px-2 py-2.5 text-xs transition-colors shadow-lg bg-black/60 text-slate-400 hover:text-yellow-300 hover:bg-black/80"
              style={{ border: '1px solid rgba(255,255,255,0.10)', borderRight: 'none' }}
            >
              <Camera className="w-4 h-4" />
              <span className="text-[9px] leading-none">Foto</span>
            </button>

            {/* Moderation-Button — Eigentümer oder Admin in PUB-Räumen */}
            {effectiveIsOwner && (
              <button
                onClick={() => setModOpen(o => !o)}
                title="Moderation"
                className={`relative flex flex-col items-center gap-0.5 rounded-l-xl px-2 py-2.5 text-xs transition-colors shadow-lg ${
                  modOpen ? 'bg-rose-800 text-white' : 'bg-black/60 text-slate-400 hover:text-rose-300 hover:bg-black/80'
                }`}
                style={{ border: '1px solid rgba(255,255,255,0.10)', borderRight: 'none' }}
              >
                <Shield className="w-4 h-4" />
                <span className="text-[9px] leading-none">Mod</span>
                {visitorCount > 0 && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[8px] font-bold flex items-center justify-center">
                    {visitorCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Knock-Panel — floating, automatisch wenn jemand anklopft */}
          {knockers.length > 0 && effectiveIsOwner && (
            <div className="absolute top-2 right-12 z-40" style={{ minWidth: 240 }}>
              <div style={{
                background: '#1a1820', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}>
                <div style={{
                  background: '#1e40af', padding: '8px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>🚪</span>
                  <span style={{ color: '#bfdbfe', fontWeight: 700, fontSize: 13 }}>
                    {knockers.length === 1 ? 'Jemand möchte eintreten' : `${knockers.length} Personen warten`}
                  </span>
                </div>
                <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {knockers.map(k => (
                    <div key={k.userId} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                      padding: '6px 10px', border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>👤</span>
                      <span style={{ flex: 1, color: '#e2e8f0', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {k.nickname}
                      </span>
                      <button
                        onClick={() => acceptKnocker(k.userId)}
                        title="Einlassen"
                        style={{ background: '#16a34a', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => declineKnocker(k.userId)}
                        title="Ablehnen"
                        style={{ background: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                      >
                        ✗
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Moderation-Panel — floating, oben rechts */}
          {modOpen && effectiveIsOwner && (
            <div className="absolute top-2 right-12 z-30">
              <RoomModerationPanel
                visitors={visitors}
                onClose={() => setModOpen(false)}
              />
            </div>
          )}

        </div>

        {/* Side panel (Shop or Inventory) */}
        {sideOpen && (
          <div
            className="shrink-0 border-l border-white/10 flex flex-col overflow-hidden"
            style={{ width: 260 }}
          >
            {activeTab === 'shop' && (
              <ShopPanel
                onBuy={(_code, _name) => setInvRefresh(n => n + 1)}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryPanel
                refreshTrigger={invRefresh}
                onPlace={(itemCode, quantity, pairId) => {
                  const win = (document.querySelector('#isometric-iframe') as HTMLIFrameElement | null)?.contentWindow;
                  // NPC: pending Metadaten mitsenden
                  let npcMeta = undefined;
                  if (itemCode === 'room_npc') {
                    const pending = JSON.parse(localStorage.getItem('pending_npc_meta') || '[]');
                    if (pending.length > 0) npcMeta = pending[0]; // peek, nicht shiften
                  }
                  // Teleporter: pair_id an IsometricRoomViewer signalisieren (via parent window)
                  if (itemCode === 'teleporter' && pairId != null) {
                    window.postMessage({ type: '__TELEPORTER_PAIR_SET', pair_id: pairId }, '*');
                  }
                  win?.postMessage({ type: 'PLACE_ITEM', item_code: itemCode, quantity, npc_meta: npcMeta }, '*');
                }}
              />
            )}
          </div>
        )}

        {/* ── Navigator (floating, kein GameContext nötig) ── */}
        {navOpen && (
          <NavigatorModal
            isOpen={navOpen}
            onClose={() => setNavOpen(false)}
            onVisitMunicipality={(slug, roomCode, roomName, ownerId) => {
              setNavOpen(false);
              onNavigateToRoom?.(slug, roomCode ?? 'MAIN', roomName ?? slug, ownerId);
            }}
          />
        )}

        {/* ── Messenger (floating, draggable) ── */}
        {msgOpen && (
          <MessengerPanel
            onClose={() => setMsgOpen(false)}
            onOpenChat={(_friendId, _friendName) => {}}
          />
        )}

        {/* ── Kamera-Foto-Modal ── */}
        {screenshotUrl && (
          <div
            className="absolute inset-0 z-[350] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.82)' }}
            onClick={() => setScreenshotUrl(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
              }}
            >
              {/* Kamera-Gehäuse oben */}
              <div style={{
                width: 340, background: '#1a1a1a', borderRadius: '16px 16px 0 0',
                padding: '14px 14px 0',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Kamera-Linse Deko */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #4a9eff, #0a2a5e)',
                    border: '2px solid #333', boxShadow: '0 0 8px rgba(74,158,255,0.4)',
                  }} />
                  <span style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>MEINORT CAM</span>
                </div>
                {/* Auslöser-Punkt */}
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }} />
              </div>

              {/* Quadratisches Foto */}
              <div style={{
                width: 340, height: 340,
                background: '#000',
                border: '14px solid #1a1a1a',
                borderTop: '6px solid #1a1a1a',
                borderBottom: 0,
                overflow: 'hidden',
                position: 'relative',
              }}>
                <img
                  src={screenshotUrl}
                  alt="Foto"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Fadenkreuz-Overlay */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: '50%', left: 10, right: 10, height: 1, background: 'rgba(255,255,255,0.12)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: 10, bottom: 10, width: 1, background: 'rgba(255,255,255,0.12)' }} />
                  {/* Ecken */}
                  {[{ top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 }].map((pos, i) => (
                    <div key={i} style={{
                      position: 'absolute', ...pos,
                      width: 14, height: 14,
                      borderTop: i < 2 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                      borderBottom: i >= 2 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                      borderLeft: i % 2 === 0 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                      borderRight: i % 2 === 1 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                    }} />
                  ))}
                </div>
              </div>

              {/* Kamera-Gehäuse unten mit Buttons */}
              <div style={{
                width: 340, background: '#1a1a1a', borderRadius: '0 0 16px 16px',
                padding: '12px 14px 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                display: 'flex', gap: 8,
              }}>
                {effectiveIsOwner && !isPubRoom && (
                  <button
                    onClick={() => saveAsThumb(screenshotUrl)}
                    disabled={thumbSaving || thumbSaved}
                    style={{
                      flex: 1, height: 38, borderRadius: 8, border: 'none',
                      cursor: thumbSaved ? 'default' : 'pointer',
                      background: thumbSaved ? '#16a34a' : 'linear-gradient(135deg, #d97706, #b45309)',
                      color: '#fff', fontWeight: 700, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: thumbSaving ? 0.7 : 1,
                      boxShadow: thumbSaved ? 'none' : '0 2px 8px rgba(217,119,6,0.4)',
                    }}
                  >
                    {thumbSaved ? '✓ Gesetzt' : thumbSaving ? 'Speichern…' : '🖼 Als Thumbnail'}
                  </button>
                )}
                <button
                  onClick={() => setScreenshotUrl(null)}
                  style={{
                    width: 38, height: 38, borderRadius: 8, border: '1px solid #333',
                    cursor: 'pointer', background: '#2a2a2a', color: '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <XIcon size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Editor-Overlay (nur Eigentümer) ── */}
        {editorOpen && (
          <div className="absolute inset-0 z-[300]">
            <iframe
              src={`/isometric/editor?token=${encodeURIComponent(getAuthToken() || '')}&api=${encodeURIComponent(API_BASE)}${isPubRoom ? `&room_code=${encodeURIComponent(roomCode || '')}&slug=${encodeURIComponent(municipalitySlug)}` : ''}`}
              className="w-full h-full border-0"
              title="Room Editor"
              allow="autoplay"
            />
          </div>
        )}
      </div>
    </div>
  );
}
