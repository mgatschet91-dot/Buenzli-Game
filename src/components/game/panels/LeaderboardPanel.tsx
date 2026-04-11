'use client';

import React, { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CircleDashed, Trophy, Users, Crown, Medal } from 'lucide-react';
import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Game-Token'] = token;
  }
  return headers;
}

interface PlayerEntry {
  id: number;
  nickname: string;
  municipality_name: string | null;
  xp: number;
  level: number;
}

interface MunicipalityEntry {
  id: number;
  name: string;
  slug: string;
  population: number;
  money: number;
  happiness: number;
  owner_name: string | null;
}

type Tab = 'players' | 'municipalities';

interface LeaderboardPanelProps {
  onViewProfile?: (userId: number) => void;
}

export function LeaderboardPanel({ onViewProfile }: LeaderboardPanelProps = {}) {
  const { setActivePanel } = useGame();
  const [tab, setTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${AUTH_API_BASE_URL}/api/leaderboard?type=${tab}`, {
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Fehler');
        if (tab === 'players') {
          setPlayers(json.data.entries);
        } else {
          setMunicipalities(json.data.entries);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab]);

  const rankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-4 h-4 text-amber-400" />;
    if (index === 1) return <Medal className="w-4 h-4 text-slate-300" />;
    if (index === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs text-slate-500 font-mono w-4 text-center">{index + 1}</span>;
  };

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-md bg-slate-900/95 border-slate-700 text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Trophy className="w-5 h-5 text-amber-400" />
            Rangliste
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setTab('players')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'players' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Spieler
          </button>
          <button
            onClick={() => setTab('municipalities')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'municipalities' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Gemeinden
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <CircleDashed className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-1 pr-2">
              {tab === 'players' && players.map((p, i) => (
                <button
                  key={`player-${p.id}-${i}`}
                  onClick={() => onViewProfile?.(p.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                    i < 3 ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-800/30'
                  } ${onViewProfile ? 'hover:bg-slate-700/50 hover:border-slate-500 cursor-pointer' : ''}`}
                >
                  <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white truncate">{p.nickname}</div>
                    <div className="text-xs text-slate-400">{p.municipality_name || 'Keine Gemeinde'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">Lv. {p.level}</div>
                    <div className="text-xs text-slate-500">{(p.xp ?? 0).toLocaleString()} XP</div>
                  </div>
                </button>
              ))}

              {tab === 'municipalities' && municipalities.map((m, i) => (
                <div key={`municipality-${m.id}-${i}`} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                  i < 3 ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-800/30'
                }`}>
                  <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white truncate">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.owner_name || 'Kein Besitzer'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-400">{(m.population ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">
                      {m.happiness ?? 0}% 😊 · ${(m.money ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}

              {((tab === 'players' && players.length === 0) || (tab === 'municipalities' && municipalities.length === 0)) && (
                <p className="text-sm text-slate-400 text-center py-8">Noch keine Einträge</p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
