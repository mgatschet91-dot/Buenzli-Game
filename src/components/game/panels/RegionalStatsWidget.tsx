'use client';
import React, { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

interface RegionalStats {
  municipality_count: number;
  total_population: number;
  total_jobs: number;
  total_power_production: number;
  total_power_consumption: number;
  total_water_production: number;
  total_water_consumption: number;
  total_water_storage_capacity: number;
  total_water_storage_level: number;
  municipalities_power_deficit: number;
  municipalities_water_deficit: number;
}

function StatBox({ label, value, unit, sub, color = 'text-slate-200' }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2 flex flex-col gap-0.5 min-w-0">
      <div className="text-[10px] text-slate-500 truncate">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${color}`}>
        {value}{unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>}
      </div>
      {sub && <div className="text-[9px] text-slate-600">{sub}</div>}
    </div>
  );
}

export function RegionalStatsWidget() {
  const [stats, setStats] = useState<RegionalStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stats/regional`);
        const json = await res.json();
        if (!cancelled && json.ok) setStats(json.data);
      } catch (_) {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!stats || stats.municipality_count === 0) return null;

  const powerBalance = stats.total_power_production - stats.total_power_consumption;
  const waterBalance = stats.total_water_production - stats.total_water_consumption;
  const storagePct   = stats.total_water_storage_capacity > 0
    ? Math.round((stats.total_water_storage_level / stats.total_water_storage_capacity) * 100)
    : 0;

  return (
    <div className="border border-slate-700/50 rounded-xl bg-slate-900/40 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🇨🇭</span>
          <span className="text-xs font-semibold text-slate-300">Regionale Infrastruktur</span>
        </div>
        <span className="text-[10px] text-slate-600">{stats.municipality_count} Gemeinden</span>
      </div>

      {/* Strom */}
      <div>
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[10px] text-yellow-400 font-medium">⚡ Strom</span>
          {stats.municipalities_power_deficit > 0 && (
            <span className="text-[9px] text-red-400 bg-red-500/10 px-1 rounded">
              {stats.municipalities_power_deficit} mit Defizit
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatBox label="Produktion" value={stats.total_power_production.toLocaleString('de-CH')} unit="MW" color="text-yellow-400" />
          <StatBox label="Verbrauch"  value={stats.total_power_consumption.toLocaleString('de-CH')} unit="MW" color="text-orange-300" />
          <StatBox
            label="Bilanz"
            value={(powerBalance >= 0 ? '+' : '') + powerBalance.toLocaleString('de-CH')}
            unit="MW"
            color={powerBalance >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
      </div>

      {/* Wasser */}
      <div>
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[10px] text-cyan-400 font-medium">💧 Wasser</span>
          {stats.municipalities_water_deficit > 0 && (
            <span className="text-[9px] text-red-400 bg-red-500/10 px-1 rounded">
              {stats.municipalities_water_deficit} mit Defizit
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatBox label="Produktion" value={stats.total_water_production.toLocaleString('de-CH')} unit="m³/h" color="text-cyan-400" />
          <StatBox label="Verbrauch"  value={stats.total_water_consumption.toLocaleString('de-CH')} unit="m³/h" color="text-cyan-300" />
          <StatBox
            label="Bilanz"
            value={(waterBalance >= 0 ? '+' : '') + waterBalance.toLocaleString('de-CH')}
            unit="m³/h"
            color={waterBalance >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
        {stats.total_water_storage_capacity > 0 && (
          <div className="mt-1.5 space-y-0.5">
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${storagePct >= 80 ? 'bg-cyan-500' : storagePct >= 40 ? 'bg-cyan-600' : 'bg-cyan-800'}`}
                style={{ width: `${storagePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600">
              <span>Gesamtspeicher {stats.total_water_storage_level.toLocaleString('de-CH', { maximumFractionDigits: 0 })} / {stats.total_water_storage_capacity.toLocaleString('de-CH')} m³</span>
              <span>{storagePct}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Bevölkerung */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatBox label="Bevölkerung total" value={stats.total_population.toLocaleString('de-CH')} color="text-slate-200" />
        <StatBox label="Arbeitsplätze total" value={stats.total_jobs.toLocaleString('de-CH')} color="text-slate-200" />
      </div>
    </div>
  );
}
