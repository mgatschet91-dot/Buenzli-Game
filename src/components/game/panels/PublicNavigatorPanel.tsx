'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Users, MapPin, Crown, Loader2, X } from 'lucide-react';
import * as publicMapsApi from '@/lib/api/publicMapsApi';
import { RegionalStatsWidget } from './RegionalStatsWidget';
import { MunicipalityRankingWidget } from './MunicipalityRankingWidget';

const UI_LABELS = {
  title: msg('Hotel Navigator'),
  publicSpaces: msg('Public Spaces'),
  guestRooms: msg('Guest Rooms'),
  publicRooms: msg('Public Rooms'),
  hideFullRooms: msg('Hide Full Rooms'),
  showFullRooms: msg('Show Full Rooms'),
  searchPlaceholder: msg('Type your search words here...'),
  search: msg('Search'),
  loading: msg('Loading public maps...'),
  empty: msg('No public maps found'),
  openMap: msg('Go'),
  full: msg('Full'),
  owner: msg('Owner'),
  players: msg('Players'),
  roomInfoTitle: msg('Public Rooms'),
  roomInfoText: msg('These are public rooms. Jump in and build with other players.'),
  adminCreateHint: msg('Nur Admins können später neue Maps mit Generatoren erstellen.'),
  adminCreateReady: msg('Admin-Modus: Map-Generator wird im nächsten Schritt aktiviert.'),
};

interface PublicNavigatorPanelProps {
  onVisitMunicipality?: (slug: string, roomCode?: string, roomName?: string) => void;
}

/** Typ für das WebSocket Navigator-Event */
interface NavigatorRoomCountEvent {
  room_code: string;
  municipality_slug: string;
  municipality_name: string;
  player_count: number;
  room_name: string;
  ts: number;
}


export function PublicNavigatorPanel({ onVisitMunicipality }: PublicNavigatorPanelProps) {
  const { state, setActivePanel } = useGame();
  const multiplayer = useMultiplayerOptional();
  const currentRoomCode = multiplayer?.roomCode ?? null;
  const m = useMessages();
  const [maps, setMaps] = useState<publicMapsApi.PublicMapEntry[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canCreateMaps, setCanCreateMaps] = useState(false);
  const [hideFullRooms, setHideFullRooms] = useState(false);

  const FULL_ROOM_THRESHOLD = 8;

  // Initiales Laden + Suche (mit Debounce) - einmalig pro Query
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await publicMapsApi.getPublicMaps(query, 80);
        if (response.success) {
          setMaps(Array.isArray(response.data.maps) ? response.data.maps : []);
          setCanCreateMaps(Boolean(response.data.can_create_maps));
        } else {
          setMaps([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMaps([]);
      } finally {
        setIsLoading(false);
      }
    }, query.trim().length > 0 ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [query]);

  // WebSocket-basierte Echtzeit-Aktualisierung der Spielerzahlen
  useEffect(() => {
    const handleNavigatorUpdate = (e: Event) => {
      const detail = (e as CustomEvent<NavigatorRoomCountEvent>).detail;
      if (!detail?.room_code) return;
      setMaps((prev) => {
        // Suche den Raum in der bestehenden Liste und aktualisiere player_count
        const idx = prev.findIndex(
          (entry) =>
            entry.room_code.toUpperCase() === detail.room_code.toUpperCase() &&
            entry.municipality_slug.toLowerCase() === detail.municipality_slug.toLowerCase()
        );
        if (idx < 0) return prev; // Raum nicht in der Liste (anderer Query-Filter)
        const updated = [...prev];
        updated[idx] = { ...updated[idx], player_count: detail.player_count };
        return updated;
      });
    };
    window.addEventListener('isocity-navigator-room-count', handleNavigatorUpdate);
    return () => {
      window.removeEventListener('isocity-navigator-room-count', handleNavigatorUpdate);
    };
  }, []);

  const sortedMaps = useMemo(
    () => [...maps].sort((a, b) => Number(b.player_count || 0) - Number(a.player_count || 0)),
    [maps]
  );
  const visibleMaps = useMemo(
    () => (hideFullRooms ? sortedMaps.filter((entry) => Number(entry.player_count || 0) < FULL_ROOM_THRESHOLD) : sortedMaps),
    [hideFullRooms, sortedMaps]
  );

  return (
    <Dialog open={state.activePanel === 'navigator'} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[760px] h-[680px] overflow-hidden p-0 border border-amber-300/70 dark:border-amber-500/40 bg-gradient-to-b from-amber-50/95 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl">
        <DialogHeader className="px-4 pt-3 pb-2 border-b border-amber-200/80 dark:border-amber-500/30">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <MapPin size={17} />
              {m(UI_LABELS.title)}
            </DialogTitle>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-7 w-7 text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded"
              onClick={() => setActivePanel('none')}
              title="Schliessen"
            >
              <X size={14} />
            </Button>
          </div>
        </DialogHeader>

        <div className="h-[calc(680px-56px)] p-3 bg-gradient-to-br from-amber-100/60 via-amber-50/40 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="h-full rounded-lg border border-amber-300/80 dark:border-amber-500/35 bg-white/95 dark:bg-slate-900 p-3 flex flex-col shadow-[0_0_0_1px_rgba(251,191,36,0.12)]">

            <div className="mb-2 space-y-2">
              <RegionalStatsWidget />
              <MunicipalityRankingWidget
                onVisit={(slug) => {
                  onVisitMunicipality?.(slug);
                  setActivePanel('none');
                }}
              />
            </div>

            <div className="rounded-md border border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-slate-950/80 p-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2 top-2.5 text-amber-600 dark:text-amber-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={String(m(UI_LABELS.searchPlaceholder))}
                    className="h-9 pl-7 text-sm border-amber-300/90 dark:border-amber-500/35 bg-white dark:bg-slate-950"
                  />
                </div>
                <Button className="h-9 px-4 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-500/40 dark:hover:bg-amber-800/50" onClick={() => setQuery((v) => v.trim())}>
                  {m(UI_LABELS.search)}
                </Button>
              </div>
            </div>

            <div className="mt-2 rounded-md border border-amber-200/80 dark:border-amber-500/25 bg-white dark:bg-slate-900 p-2 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80 dark:border-amber-500/25">
                <span className="text-base font-bold text-amber-800 dark:text-amber-200">{m(UI_LABELS.publicRooms)}</span>
                <button
                  type="button"
                  onClick={() => setHideFullRooms((v) => !v)}
                  className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
                >
                  {hideFullRooms ? m(UI_LABELS.showFullRooms) : m(UI_LABELS.hideFullRooms)}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-2">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-sm text-amber-700 dark:text-amber-300 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {m(UI_LABELS.loading)}
                  </div>
                ) : error ? (
                  <div className="text-sm text-red-500 px-1">{error}</div>
                ) : visibleMaps.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-amber-700/60 dark:text-amber-300/60">{m(UI_LABELS.empty)}</div>
                ) : (
                  visibleMaps.map((entry) => {
                    const isFull = Number(entry.player_count || 0) >= FULL_ROOM_THRESHOLD;
                    const isCurrentRoom = currentRoomCode != null && entry.room_code.toUpperCase() === currentRoomCode.toUpperCase();
                    const playerCount = Number(entry.player_count || 0);
                    const hasPlayers = playerCount > 0;
                    return (
                      <div
                        key={`${entry.municipality_slug}:${entry.room_code}`}
                        className={`rounded-full border px-3 py-2 flex items-center justify-between gap-3 ${
                          isCurrentRoom
                            ? 'border-amber-400 bg-amber-100 dark:bg-amber-900/30 ring-1 ring-amber-400/50'
                            : hasPlayers
                              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                            {entry.room_name}
                            {isCurrentRoom && (
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-200 bg-amber-200 dark:bg-amber-800/60 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                                Du bist hier
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] truncate flex items-center gap-1 ${
                            hasPlayers
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasPlayers ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {`Online: ${playerCount}`}
                          </div>
                        </div>
                        <Button
                          className={`h-8 min-w-[82px] rounded-full border-0 text-white font-semibold shrink-0 ${
                            isFull
                              ? 'bg-red-700 hover:bg-red-700'
                              : 'bg-emerald-500 hover:bg-emerald-600'
                          }`}
                          disabled={isFull}
                          onClick={() => {
                            onVisitMunicipality?.(entry.municipality_slug, entry.room_code, entry.room_name);
                            setActivePanel('none');
                          }}
                        >
                          {isFull ? m(UI_LABELS.full) : m(UI_LABELS.openMap)}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-2 p-2 rounded border border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-slate-800 flex items-center gap-2">
                <div className="h-10 w-10 rounded bg-amber-200/80 dark:bg-amber-700/40 flex items-center justify-center text-amber-800 dark:text-amber-200">
                  <Users size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-800 dark:text-amber-100">{m(UI_LABELS.roomInfoTitle)}</div>
                  <div className="text-xs text-amber-700/80 dark:text-amber-300/80">{m(UI_LABELS.roomInfoText)}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs">
              {canCreateMaps ? (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <Crown size={12} />
                  {m(UI_LABELS.adminCreateReady)}
                </span>
              ) : (
                <span className="text-amber-600/60 dark:text-amber-400/60">{m(UI_LABELS.adminCreateHint)}</span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

