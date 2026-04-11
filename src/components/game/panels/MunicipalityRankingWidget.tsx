'use client';
import React, { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

interface RankEntry { name: string; slug: string; value: number; }
interface RankCategory { label: string; unit: string; entries: RankEntry[]; }
interface RankingData { [key: string]: RankCategory; }

const CATEGORY_ICONS: Record<string, string> = {
  population:       '👥',
  power_production: '⚡',
  solar_production: '☀️',
  water_production: '💧',
  jobs:             '💼',
  treasury:         '🏦',
};

const CATEGORY_COLORS: Record<string, string> = {
  population:       'text-slate-200',
  power_production: 'text-yellow-400',
  solar_production: 'text-orange-400',
  water_production: 'text-cyan-400',
  jobs:             'text-purple-400',
  treasury:         'text-emerald-400',
};

function fmt(n: number, unit: string): string {
  if (unit === 'CHF') return `CHF ${n.toLocaleString('de-CH')}`;
  return n.toLocaleString('de-CH') + (unit ? ` ${unit}` : '');
}

export function MunicipalityRankingWidget({ onVisit }: { onVisit?: (slug: string) => void }) {
  const [data, setData] = useState<RankingData | null>(null);
  const [activeKey, setActiveKey] = useState('population');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stats/ranking`);
        const json = await res.json();
        if (json.ok) setData(json.data);
      } catch (_) {}
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const keys = Object.keys(data);
  const active = data[activeKey];

  return (
    <div className="border border-slate-700/50 rounded-xl bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">🏆 Gemeinde-Ranking</span>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {keys.map(k => (
          <button
            key={k}
            onClick={() => setActiveKey(k)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              activeKey === k
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
            }`}
          >
            {CATEGORY_ICONS[k]} {data[k].label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {active && active.entries.length > 0 ? (
        <div className="space-y-1">
          {active.entries.map((e, i) => {
            const maxVal = active.entries[0].value;
            const pct = maxVal > 0 ? Math.max(4, Math.round((e.value / maxVal) * 100)) : 0;
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <div key={e.slug} className="flex items-center gap-2">
                <span className="text-sm w-5 shrink-0 text-center">{medals[i] ?? `${i + 1}.`}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <button
                      onClick={() => onVisit?.(e.slug)}
                      className="text-[11px] font-medium text-slate-200 hover:text-amber-300 truncate text-left transition-colors"
                    >
                      {e.name}
                    </button>
                    <span className={`text-[10px] font-bold tabular-nums shrink-0 ${CATEGORY_COLORS[activeKey]}`}>
                      {fmt(e.value, active.unit)}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: activeKey === 'power_production' ? '#facc15'
                          : activeKey === 'solar_production' ? '#fb923c'
                          : activeKey === 'water_production' ? '#22d3ee'
                          : activeKey === 'jobs' ? '#a78bfa'
                          : activeKey === 'treasury' ? '#34d399'
                          : '#94a3b8',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-slate-600 py-1">Noch keine Daten</div>
      )}
    </div>
  );
}
