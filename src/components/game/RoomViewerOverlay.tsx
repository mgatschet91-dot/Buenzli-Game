'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { IsometricRoomViewer } from './IsometricRoomViewer';
import { ShopPanel } from './ShopPanel';
import { InventoryPanel } from './InventoryPanel';
import { getAuthToken } from '@/lib/api/coreApi';
import { ArrowLeft, Home, Loader2, ShoppingBag, Archive, User, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomGeometry {
  grid_size:   number;
  wall_n:      number; wall_s: number; wall_e: number; wall_w: number;
  door_wall:   string; door_offset: number; door_width: number; door_height: number;
  floors:      { floor_index: number; y_height: number; x0: number; x1: number; z0: number; z1: number }[];
  staircases:  { x0: number; x1: number; z0: number; z1: number; from_floor: number; to_floor: number }[];
}

interface RoomData {
  model_name: string;
  avatar_code: string | null;
  owner_nickname: string;
  geometry?: RoomGeometry;
}

type SideTab = 'shop' | 'inventory' | 'avatar' | null;

export interface RoomViewerOverlayProps {
  userId: number;
  nickname: string;
  municipalitySlug: string;
  isOwner: boolean;
  onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

// ─── Component ────────────────────────────────────────────────────────────────

export function RoomViewerOverlay({
  userId,
  nickname,
  municipalitySlug,
  isOwner,
  onClose,
}: RoomViewerOverlayProps) {
  const [roomData, setRoomData]     = useState<RoomData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [avatarCode, setAvatarCode] = useState<string | null>(null);
  const [savingAvatar, setSaving]   = useState(false);
  const [activeTab, setActiveTab]   = useState<SideTab>(null);
  const [invRefresh, setInvRefresh] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [localNickname, setLocalNickname] = useState<string>('');
  const iframeRef                   = useRef<HTMLIFrameElement>(null);

  // ── Load room + avatar ───────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken() || '';
      const r = await fetch(
        `${API_BASE}/api/game/municipality/${municipalitySlug}/residence/room/${userId}`,
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
  }, [municipalitySlug, userId]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  // Owner: localNickname direkt aus prop setzen (Gäste bekommen es via my_nickname aus loadRoom)
  useEffect(() => {
    if (isOwner) setLocalNickname(nickname);
  }, [isOwner, nickname]);

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
      // Editor gespeichert → schließen + Raum neu laden
      if (e.data?.type === 'EDITOR_SAVED') {
        setEditorOpen(false);
        loadRoom();
      }
      // Editor geschlossen ohne Speichern
      if (e.data?.type === 'EDITOR_CLOSE') {
        setEditorOpen(false);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [loadRoom]);

  // ── Avatar change from iframe ────────────────────────────────────────────
  const handleAvatarChange = useCallback(async (code: string) => {
    setAvatarCode(code);
    if (!isOwner) return;
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

  // ── Tab buttons (Shop + Inventar nur für Eigentümer) ─────────────────────
  const TAB_BTNS: { id: SideTab; icon: React.ReactNode; label: string }[] = [
    ...(isOwner ? [
      { id: 'shop'      as SideTab, icon: <ShoppingBag className="w-4 h-4" />, label: 'Shop' },
      { id: 'inventory' as SideTab, icon: <Archive     className="w-4 h-4" />, label: 'Inventar' },
    ] : []),
    { id: 'avatar', icon: <User className="w-4 h-4" />, label: 'Avatar' },
  ];

  const sideOpen = activeTab !== null && activeTab !== 'avatar';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#16120e' }}>

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
          <Home className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-sm">{nickname}s Zimmer</span>
          {savingAvatar && <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-1" />}
        </div>

        {/* Bearbeiten-Button — nur für Eigentümer */}
        {isOwner && roomData && !loading ? (
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
              avatarCode={isOwner ? avatarCode : null}
              geometry={roomData.geometry}
              ownerId={userId}
              isOwner={isOwner}
              municipalitySlug={municipalitySlug}
              playerName={localNickname || (isOwner ? nickname : '')}
              ownerNickname={roomData?.owner_nickname || nickname}
              onAvatarChange={handleAvatarChange}
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
          </div>
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
                onPlace={(itemCode, quantity) => {
                  const win = (document.querySelector('#isometric-iframe') as HTMLIFrameElement | null)?.contentWindow;
                  // NPC: pending Metadaten mitsenden
                  let npcMeta = undefined;
                  if (itemCode === 'room_npc') {
                    const pending = JSON.parse(localStorage.getItem('pending_npc_meta') || '[]');
                    if (pending.length > 0) npcMeta = pending[0]; // peek, nicht shiften
                  }
                  win?.postMessage({ type: 'PLACE_ITEM', item_code: itemCode, quantity, npc_meta: npcMeta }, '*');
                }}
              />
            )}
          </div>
        )}

        {/* ── Editor-Overlay (nur Eigentümer) ── */}
        {editorOpen && (
          <div className="absolute inset-0 z-[300]">
            <iframe
              src={`/isometric/editor?token=${encodeURIComponent(getAuthToken() || '')}&api=${encodeURIComponent(API_BASE)}`}
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
