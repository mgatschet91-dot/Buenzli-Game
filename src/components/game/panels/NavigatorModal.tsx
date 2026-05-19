'use client';

import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { GameContext } from '@/context/GameContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Compass, Home, Search, Users, Loader2, X, Star, Globe, Zap, Info, HelpCircle, Heart, Clock } from 'lucide-react';
import * as navigatorApi from '@/lib/api/navigatorApi';

// ── Relative Zeit ─────────────────────────────────────────────────────────────
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`;
  return `vor ${Math.floor(diff / 86400)} Tagen`;
}

// Thumbnail-Platzhalter zyklisch aus Navigator-Modellen
const THUMB_MODELS = [
  '/images/navigator/model_0.png',
  '/images/navigator/model_a.png',
  '/images/navigator/model_b.png',
  '/images/navigator/model_c.png',
];
function thumbFor(idx: number) { return THUMB_MODELS[idx % THUMB_MODELS.length]; }

const API_CORE = (process.env.NEXT_PUBLIC_CORE_API_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100').replace(/\/+$/, '');
function roomThumbUrl(ownerId: number) { return `${API_CORE}/room-thumbs/${ownerId}.jpg`; }

// ── Typen ─────────────────────────────────────────────────────────────────────
type NavigatorTab = 'rooms' | 'houses' | 'mine' | 'recent';

interface NavigatorModalProps {
  onVisitMunicipality?: (slug: string, roomCode?: string, roomName?: string, ownerId?: number) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavigatorRoomCountEvent {
  room_code: string;
  municipality_slug: string;
  player_count: number;
}

// ── RoomThumbnailCard ─────────────────────────────────────────────────────────
function RoomThumbnailCard({
  slug, roomCode, roomName, playerCount, thumbIdx, isPublic, isLocked, subtitle, description, ownerId, hasThumbnail, onEnter,
}: {
  slug: string; roomCode: string; roomName: string;
  playerCount: number; thumbIdx: number;
  isPublic?: boolean; isLocked?: boolean; subtitle?: string; description?: string | null;
  ownerId?: number; hasThumbnail?: boolean;
  onEnter: (slug: string, roomCode: string, roomName: string, ownerId?: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const hasPlayers = playerCount > 0;
  const realThumb = hasThumbnail && ownerId && !thumbError ? roomThumbUrl(ownerId) : null;

  return (
    <div
      style={{ width: 148, cursor: 'pointer', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEnter(slug, roomCode, roomName, ownerId)}
      title={`${roomName}${subtitle ? ` · ${subtitle}` : ''}`}
    >
      {/* Thumbnail */}
      <div style={{
        position: 'relative',
        width: 148, height: 110,
        borderRadius: 6,
        overflow: 'hidden',
        border: hovered ? '2px solid #f59e0b' : '2px solid var(--nav-card-border, rgba(251,191,36,0.2))',
        background: 'var(--nav-input-bg, #fef3c7)',
        transition: 'border-color 0.15s',
      }}>
        <img
          src={realThumb || thumbFor(thumbIdx)}
          alt={roomName}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: realThumb ? 'auto' : 'pixelated', opacity: hovered ? 1 : 0.85, transition: 'opacity 0.15s' }}
          onError={(e) => {
            if (realThumb) { setThumbError(true); return; }
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Öffentlich-Badge */}
        {isPublic && (
          <div style={{
            position: 'absolute', top: 5, left: 5,
            background: 'rgba(14,165,233,0.9)', color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Users size={8} /> Öffentlich
          </div>
        )}

        {/* Schloss-Badge */}
        {isLocked && (
          <div style={{
            position: 'absolute', top: 5, right: 5,
            background: 'rgba(239,68,68,0.9)', color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
          }}>
            🔒
          </div>
        )}

        {/* Spielerzahl */}
        <div style={{
          position: 'absolute', bottom: 5, left: 5,
          background: hasPlayers ? 'rgba(16,185,129,0.9)' : 'rgba(0,0,0,0.65)',
          color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '2px 6px', borderRadius: 4,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Users size={9} /> {playerCount}
        </div>

        {/* Info-Button */}
        <div style={{
          position: 'absolute', bottom: 5, right: 5,
          background: 'rgba(0,0,0,0.55)', color: '#94a3b8',
          borderRadius: '50%', width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'help',
        }} title={[subtitle, description].filter(Boolean).join('\n') || roomName}>
          <Info size={11} />
        </div>

        {/* Hover-Overlay */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(245,158,11,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              background: '#f59e0b', color: '#000', fontWeight: 800,
              fontSize: 12, padding: '5px 14px', borderRadius: 5,
            }}>Eintreten</span>
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        marginTop: 4, fontSize: 11, fontWeight: 600,
        color: hovered ? '#f59e0b' : '#cbd5e1',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 148, lineHeight: 1.3,
        transition: 'color 0.15s',
      }}>
        {roomName}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 148, marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ opacity: 0.7 }}>📍</span>{subtitle}
        </div>
      )}
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 4px', userSelect: 'none' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--nav-section-line, rgba(251,191,36,0.25))' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--nav-section-line, rgba(251,191,36,0.25))' }} />
    </div>
  );
}

// ── NavigatorModal ────────────────────────────────────────────────────────────
export function NavigatorModal({ onVisitMunicipality, isOpen: isOpenProp, onClose: onCloseProp }: NavigatorModalProps) {
  const gameCtx = useContext(GameContext);
  const isOpen = isOpenProp !== undefined ? isOpenProp : (gameCtx?.state.activePanel === 'navigator' || false);
  const handleClose = onCloseProp ?? (() => gameCtx?.setActivePanel('none'));

  const [tab, setTab] = useState<NavigatorTab>('rooms');
  const searchRef = useRef<HTMLInputElement>(null);

  // Haupt-Übersicht
  const [publicRooms, setPublicRooms]   = useState<navigatorApi.ActiveRoomEntry[]>([]);
  const [privateActive, setPrivateActive] = useState<navigatorApi.ActiveRoomEntry[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Private Häuser
  const [houses, setHouses] = useState<navigatorApi.NavigatorHouseEntry[]>([]);
  const [housesQuery, setHousesQuery] = useState('');
  const [housesLoading, setHousesLoading] = useState(false);

  // Meine Räume
  const [myRooms, setMyRooms] = useState<navigatorApi.MyRoomEntry[]>([]);
  const [myRoomsLoading, setMyRoomsLoading] = useState(false);

  // Favoriten (geladen wenn mine-Tab aktiv)
  const [favorites, setFavorites] = useState<navigatorApi.FavoriteRoomEntry[]>([]);
  const [favsLoading, setFavsLoading] = useState(false);

  // Verlauf
  const [recentRooms, setRecentRooms] = useState<navigatorApi.RecentRoomEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Echtzeit-Spielerzähler
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NavigatorRoomCountEvent>).detail;
      if (!detail?.room_code) return;
      setHouses((prev) => {
        const idx = prev.findIndex(
          (h) => h.room_code.toUpperCase() === detail.room_code.toUpperCase() &&
                 h.municipality_slug.toLowerCase() === detail.municipality_slug.toLowerCase()
        );
        if (idx < 0) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], player_count: detail.player_count };
        return updated;
      });
    };
    window.addEventListener('isocity-navigator-room-count', handler);
    return () => window.removeEventListener('isocity-navigator-room-count', handler);
  }, []);

  useEffect(() => {
    if (!isOpen || tab !== 'rooms') return;
    setRoomsLoading(true);
    navigatorApi.getRoomsOverview()
      .then(({ publicRooms: pub, privateRooms: priv }) => {
        setPublicRooms(pub);
        setPrivateActive(priv);
      })
      .catch((err) => { console.error('[Navigator] getRoomsOverview failed:', err); setPublicRooms([]); setPrivateActive([]); })
      .finally(() => setRoomsLoading(false));
  }, [isOpen, tab]);

  useEffect(() => {
    if (!isOpen || tab !== 'houses') return;
    const timer = window.setTimeout(async () => {
      setHousesLoading(true);
      try { setHouses(await navigatorApi.getNavigatorHouses(housesQuery, 80)); }
      catch { /* silent */ }
      finally { setHousesLoading(false); }
    }, housesQuery.trim().length > 0 ? 200 : 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, tab, housesQuery]);

  useEffect(() => {
    if (!isOpen || tab !== 'mine') return;
    setMyRoomsLoading(true);
    navigatorApi.getMyRooms()
      .then(setMyRooms)
      .catch((err) => { console.error('[Navigator] getMyRooms failed:', err); setMyRooms([]); })
      .finally(() => setMyRoomsLoading(false));
    setFavsLoading(true);
    navigatorApi.getFavorites()
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setFavsLoading(false));
  }, [isOpen, tab]);

  useEffect(() => {
    if (!isOpen || tab !== 'recent') return;
    setRecentLoading(true);
    navigatorApi.getRecentRooms(10)
      .then(setRecentRooms)
      .catch(() => setRecentRooms([]))
      .finally(() => setRecentLoading(false));
  }, [isOpen, tab]);

  const removeFav = useCallback(async (slug: string, roomCode: string) => {
    setFavorites(prev => prev.filter(f => !(f.municipality_slug === slug && f.room_code === roomCode)));
    await navigatorApi.removeFavorite(slug, roomCode).catch(() => {});
  }, []);

  useEffect(() => { if (!isOpen) setTab('rooms'); }, [isOpen]);

  // Suchfeld fokussieren wenn Häuser-Tab aktiv
  useEffect(() => {
    if (isOpen && tab === 'houses') setTimeout(() => searchRef.current?.focus(), 80);
  }, [isOpen, tab]);

  const handleEnter = useCallback((slug: string, roomCode: string, roomName: string, ownerId?: number) => {
    onVisitMunicipality?.(slug, roomCode, roomName, ownerId);
    handleClose();
  }, [onVisitMunicipality, handleClose]);

  const TABS = [
    { id: 'rooms'  as NavigatorTab, icon: <Globe size={13} />, label: 'Räume' },
    { id: 'houses' as NavigatorTab, icon: <Home size={13} />,  label: 'Private Häuser' },
    { id: 'mine'   as NavigatorTab, icon: <Star size={13} />,  label: 'Meine Räume' },
    { id: 'recent' as NavigatorTab, icon: <Clock size={13} />, label: 'Verlauf' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent
        className="p-0 overflow-hidden shadow-2xl"
        style={{
          maxWidth: 540, width: 540,
          height: 680,
          background: 'var(--nav-bg, #fffbeb)',
          border: '1.5px solid #fbbf24',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) { :root { --nav-bg: #0f172a; --nav-header: #1e293b; --nav-border: rgba(251,191,36,0.3); --nav-tab-active-bg: rgba(251,191,36,0.15); --nav-content: #0f172a; --nav-text: #e2e8f0; --nav-muted: #64748b; --nav-input-bg: #1e293b; --nav-input-border: rgba(251,191,36,0.25); --nav-card-border: rgba(255,255,255,0.08); --nav-bottom: #1e293b; --nav-section-line: rgba(255,255,255,0.08); } }
          @media (prefers-color-scheme: light) { :root { --nav-bg: #fffbeb; --nav-header: #fef3c7; --nav-border: rgba(217,119,6,0.4); --nav-tab-active-bg: rgba(251,191,36,0.2); --nav-content: #fffbeb; --nav-text: #1c1917; --nav-muted: #78716c; --nav-input-bg: #fff; --nav-input-border: rgba(217,119,6,0.5); --nav-card-border: rgba(0,0,0,0.1); --nav-bottom: #fef3c7; --nav-section-line: rgba(0,0,0,0.1); } }
          .dark { --nav-bg: #0f172a; --nav-header: #1e293b; --nav-border: rgba(251,191,36,0.3); --nav-tab-active-bg: rgba(251,191,36,0.15); --nav-content: #0f172a; --nav-text: #e2e8f0; --nav-muted: #64748b; --nav-input-bg: #1e293b; --nav-input-border: rgba(251,191,36,0.25); --nav-card-border: rgba(255,255,255,0.08); --nav-bottom: #1e293b; --nav-section-line: rgba(255,255,255,0.08); }
        `}</style>

        {/* ── Titelleiste ──────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--nav-header)',
          borderBottom: '1px solid var(--nav-border)',
          padding: '0 10px',
          height: 40,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
          borderRadius: '9px 9px 0 0',
        }}>
          <VisuallyHidden><DialogTitle>Navigator</DialogTitle></VisuallyHidden>
          <div style={{
            width: 26, height: 26, borderRadius: 5,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Compass size={14} color="#fff" />
          </div>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#b45309' }}>
            Navigator
          </span>
          <button
            type="button"
            title="Hilfe"
            style={{ background: 'transparent', border: '1px solid var(--nav-border)', borderRadius: 4, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#92400e' }}
          >
            <HelpCircle size={12} />
          </button>
          <button
            type="button"
            onClick={() => handleClose()}
            title="Schliessen"
            style={{ background: '#dc2626', border: '1px solid #b91c1c', borderRadius: 4, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
          >
            <X size={12} />
          </button>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 2, padding: '8px 10px 0',
          background: 'var(--nav-header)',
          borderBottom: '1px solid var(--nav-border)',
          flexShrink: 0,
        }}>
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px 7px',
                fontSize: 12, fontWeight: 600,
                borderRadius: '6px 6px 0 0',
                border: 'none', cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
                background: tab === id ? 'var(--nav-tab-active-bg)' : 'transparent',
                color: tab === id ? '#b45309' : 'var(--nav-muted)',
                borderBottom: tab === id ? '2px solid #f59e0b' : '2px solid transparent',
              }}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* ── Suchleiste (Häuser-Tab) ───────────────────────────────────────── */}
        {tab === 'houses' && (
          <div style={{ padding: '8px 10px 4px', background: 'var(--nav-content)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: '#d97706' }} />
              <input
                ref={searchRef}
                type="text"
                value={housesQuery}
                onChange={(e) => setHousesQuery(e.target.value)}
                placeholder="Räume filtern nach Gemeinde oder Spieler..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  height: 32, paddingLeft: 28, paddingRight: 10,
                  background: 'var(--nav-input-bg)', border: '1px solid var(--nav-input-border)',
                  borderRadius: 5, color: 'var(--nav-text)', fontSize: 12,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#f59e0b'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--nav-input-border)'; }}
              />
            </div>
          </div>
        )}

        {/* ── Inhalt ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px 4px', background: 'var(--nav-content)' }}>

          {/* ── Tab: Räume ─────────────────────────────────────────────────── */}
          {tab === 'rooms' && (
            roomsLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#d97706', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" /> Lade Räume...
              </div>
            ) : (
              <div>
                {/* Öffentliche Räume — immer angezeigt */}
                <SectionHeader label="Öffentliche Räume" />
                {publicRooms.length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: '#92400e', fontSize: 12 }}>
                    Keine öffentlichen Räume verfügbar
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                    {publicRooms.map((r, i) => (
                      <RoomThumbnailCard
                        key={`${r.municipality_slug}:${r.room_code}`}
                        slug={r.municipality_slug} roomCode={r.room_code} roomName={r.room_name}
                        playerCount={r.player_count} thumbIdx={i} isPublic
                        subtitle={r.municipality_name} ownerId={r.owner_id ?? undefined}
                        onEnter={handleEnter}
                      />
                    ))}
                  </div>
                )}

                {/* Aktive private Zimmer — nur wenn jemand online */}
                {privateActive.length > 0 && (
                  <>
                    <SectionHeader label="Gerade aktive Zimmer" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                      {privateActive.map((r, i) => (
                        <RoomThumbnailCard
                          key={`${r.municipality_slug}:${r.room_code}`}
                          slug={r.municipality_slug} roomCode={r.room_code} roomName={r.room_name}
                          playerCount={r.player_count} thumbIdx={publicRooms.length + i}
                          subtitle={`${r.owner_nickname ?? ''} · ${r.municipality_name}`}
                          ownerId={r.owner_id ?? undefined}
                          onEnter={handleEnter}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          )}

          {/* ── Tab: Private Häuser ─────────────────────────────────────────── */}
          {tab === 'houses' && (
            housesLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#f59e0b', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" /> Lade Häuser...
              </div>
            ) : houses.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#92400e', fontSize: 13 }}>
                Keine Häuser gefunden
              </div>
            ) : (
              <>
                <SectionHeader label="Private Häuser" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                  {houses.map((h, i) => (
                    <RoomThumbnailCard
                      key={`${h.owner?.id}:${h.municipality_slug}:${h.room_code}`}
                      slug={h.municipality_slug} roomCode={h.room_code}
                      roomName={h.room_name || `${h.owner?.nickname ?? '?'}'s Zimmer`}
                      playerCount={h.player_count} thumbIdx={i}
                      isLocked={h.is_locked}
                      description={h.room_description}
                      hasThumbnail={h.has_thumbnail}
                      subtitle={[h.municipality_name, h.owner?.nickname ? `von ${h.owner.nickname}` : null].filter(Boolean).join(' · ')}
                      ownerId={h.owner?.id}
                      onEnter={handleEnter}
                    />
                  ))}
                </div>
              </>
            )
          )}

          {/* ── Tab: Meine Räume ───────────────────────────────────────────── */}
          {tab === 'mine' && (
            myRoomsLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#f59e0b', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" /> Lade Räume...
              </div>
            ) : myRooms.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#92400e', fontSize: 13 }}>
                Noch kein eigenes Zimmer vorhanden
              </div>
            ) : (
              <>
                {myRooms.filter((r) => r.type === 'private').length > 0 && (
                  <>
                    <SectionHeader label="Meine Zimmer" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                      {myRooms.filter((r) => r.type === 'private').map((r, i) => (
                        <RoomThumbnailCard
                          key={`${r.municipality_slug}:${r.room_code}`}
                          slug={r.municipality_slug} roomCode={r.room_code} roomName={r.room_name}
                          playerCount={r.player_count} thumbIdx={i}
                          isLocked={r.is_locked}
                          description={r.room_description}
                          ownerId={r.owner_id ?? undefined}
                          subtitle={[
                            r.municipality_name,
                            r.last_visited_at ? `Zuletzt ${relativeTime(r.last_visited_at)}` : null,
                            r.visit_count ? `${r.visit_count}× besucht` : null,
                          ].filter(Boolean).join(' · ')}
                          onEnter={handleEnter}
                        />
                      ))}
                    </div>
                  </>
                )}
                {myRooms.filter((r) => r.type === 'public').length > 0 && (
                  <>
                    <SectionHeader label="Öffentliche Räume (Bürgermeister)" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                      {myRooms.filter((r) => r.type === 'public').map((r, i) => (
                        <RoomThumbnailCard
                          key={`${r.municipality_slug}:${r.room_code}`}
                          slug={r.municipality_slug} roomCode={r.room_code} roomName={r.room_name}
                          playerCount={r.player_count} thumbIdx={i} isPublic
                          subtitle={r.municipality_name}
                          onEnter={handleEnter}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* ── Favoriten ──────────────────────────────────────────── */}
                <SectionHeader label={`Favoriten${favorites.length > 0 ? ` (${favorites.length})` : ''}`} />
                {favsLoading ? (
                  <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                    <Loader2 size={13} className="animate-spin" /> Lade…
                  </div>
                ) : favorites.length === 0 ? (
                  <div style={{ padding: '10px 0 4px', color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Heart size={13} />
                    Noch keine Favoriten — besuche einen Raum und klicke das ♥ in der Titelleiste
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                    {favorites.map((f, i) => (
                      <div key={`${f.municipality_slug}:${f.room_code}`} style={{ position: 'relative' }}>
                        <RoomThumbnailCard
                          slug={f.municipality_slug} roomCode={f.room_code} roomName={f.room_name}
                          playerCount={f.player_count} thumbIdx={i}
                          isLocked={f.is_locked}
                          ownerId={f.owner_user_id ?? undefined}
                          subtitle={[f.municipality_name, f.owner_nickname ? `von ${f.owner_nickname}` : null].filter(Boolean).join(' · ')}
                          onEnter={handleEnter}
                        />
                        {/* Herz-Button zum Entfernen */}
                        <button
                          onClick={() => removeFav(f.municipality_slug, f.room_code)}
                          title="Aus Favoriten entfernen"
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            background: 'rgba(239,68,68,0.85)', border: 'none',
                            borderRadius: '50%', width: 22, height: 22,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#fff', zIndex: 10,
                          }}
                        >
                          <Heart size={11} fill="#fff" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}

          {/* ── Tab: Verlauf ──────────────────────────────────────────────────── */}
          {tab === 'recent' && (
            recentLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#f59e0b', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" /> Lade Verlauf...
              </div>
            ) : recentRooms.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#92400e', fontSize: 13 }}>
                <Clock size={24} style={{ opacity: 0.4 }} />
                Noch keine besuchten Räume
              </div>
            ) : (
              <>
                <SectionHeader label="Zuletzt besucht" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 8px' }}>
                  {recentRooms.map((r, i) => (
                    <RoomThumbnailCard
                      key={`recent:${r.municipality_slug}:${r.room_code}:${i}`}
                      slug={r.municipality_slug} roomCode={r.room_code} roomName={r.room_name}
                      playerCount={0} thumbIdx={i}
                      ownerId={r.owner_user_id ?? undefined}
                      subtitle={[
                        r.municipality_name,
                        r.visited_at ? relativeTime(r.visited_at) : null,
                      ].filter(Boolean).join(' · ')}
                      onEnter={handleEnter}
                    />
                  ))}
                </div>
              </>
            )
          )}

        </div>

        {/* ── Bottom-Buttons ────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, padding: '8px 10px',
          background: 'var(--nav-bottom)', borderTop: '1px solid var(--nav-border)',
          flexShrink: 0, borderRadius: '0 0 9px 9px',
        }}>
          <button
            type="button"
            onClick={() => handleEnter('', 'MAIN', 'Mein Zimmer')}
            style={{
              flex: 1, height: 38, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Home size={14} /> Mein Zimmer
          </button>
          <button
            type="button"
            onClick={() => setTab('rooms')}
            style={{
              flex: 1, height: 38, borderRadius: 5, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Zap size={14} /> Aktive Räume
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
