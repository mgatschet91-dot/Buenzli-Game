'use client';
import React from 'react';
import { useGame } from '@/context/GameContext';

export const WaterStatusWidget = React.memo(function WaterStatusWidget() {
  const { state } = useGame();
  const stats = state.stats as any;

  const RESERVOIR_CAP_PER_UNIT = 2000; // fest, kein Level-Scaling
  let clientStorageCap = 0;
  const pumpsByLevel: Record<number, number> = {};
  const reservoirsByLevel: Record<number, number> = {};
  for (const row of state.grid) {
    for (const t of row) {
      const b = t.building;
      const done = (b.constructionProgress ?? 100) >= 100;
      const lvl = Math.max(1, b.level || 1);
      if (b.type === 'water_tower' && !b.abandoned) {
        if (done) { pumpsByLevel[lvl] = (pumpsByLevel[lvl] || 0) + 1; }
        else { pumpsByLevel[-1] = (pumpsByLevel[-1] || 0) + 1; }
      } else if (b.type === 'water_reservoir' && !b.abandoned) {
        if (done) { clientStorageCap += RESERVOIR_CAP_PER_UNIT; reservoirsByLevel[1] = (reservoirsByLevel[1] || 0) + 1; }
        else { reservoirsByLevel[-1] = (reservoirsByLevel[-1] || 0) + 1; }
      }
    }
  }
  const totalPumps = Object.entries(pumpsByLevel).filter(([k]) => Number(k) > 0).reduce((s, [, v]) => s + v, 0);
  const buildingPumps = pumpsByLevel[-1] || 0;
  const totalReservoirs = Object.entries(reservoirsByLevel).filter(([k]) => Number(k) > 0).reduce((s, [, v]) => s + v, 0);
  const buildingReservoirs = reservoirsByLevel[-1] || 0;

  // Server ist autoritativ für Produktion/Verbrauch
  const production  = Number(stats.water_production ?? 0);
  const consumption = Number(stats.water_consumption ?? 0);
  const netDeficit  = Number(stats.water_net_deficit ?? 0);
  const balance     = production - consumption;
  const hour        = state.hour ?? 12;

  const balanceColor = balance >= 0 ? 'text-cyan-400' : 'text-red-400';

  const isPeakHour = (hour >= 6 && hour <= 9) || (hour >= 18 && hour <= 21);
  const isNight    = hour >= 23 || hour < 5;
  const demandNote = isPeakHour
    ? '~+20% Spitzenlast (Morgen/Abend)'
    : isNight
      ? '~−30% Nachtbetrieb'
      : null;

  // Echtes Defizit nur wenn Speicher auch leer ist
  const hasDeficit = netDeficit > 0;
  const deficitPct = consumption > 0 ? Math.round((netDeficit / consumption) * 100) : 0;

  function formatHours(h: number): string {
    if (h < 1 / 60) return '< 1 min';
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h > 48) return '> 2 Tage';
    const fullH = Math.floor(h);
    const mins  = Math.round((h - fullH) * 60);
    return mins > 0 ? `${fullH}h ${mins}min` : `${fullH}h`;
  }

  return (
    <div className="space-y-2">
      {/* Produktion / Verbrauch / Bilanz */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">Produktion</div>
          <div className="text-sm font-bold text-cyan-400">{Math.round(production)} m³/h</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">Verbrauch</div>
          <div className="text-sm font-bold text-yellow-400">{Math.round(consumption)} m³/h</div>
          {demandNote && <div className="text-[9px] text-orange-400">{demandNote}</div>}
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">Bilanz</div>
          <div className={`text-sm font-bold ${balanceColor}`}>
            {balance >= 0 ? '+' : ''}{Math.round(balance)} m³/h
          </div>
        </div>
      </div>

      {/* Wassertürme im Netz */}
      <div className="bg-slate-700/30 rounded px-2 py-1.5 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Wassertürme total</span>
          <span className="text-cyan-300 font-medium">{totalPumps + buildingPumps}</span>
        </div>
        {[1, 2, 3, 4, 5].map(lvl => {
          const count = pumpsByLevel[lvl] || 0;
          if (count === 0) return null;
          const prod = 80 * lvl;
          return (
            <div key={lvl} className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Level {lvl} · {prod} m³/h/Stk</span>
              <span className="text-cyan-400 font-medium">{count}× = {prod * count} m³/h</span>
            </div>
          );
        })}
        {buildingPumps > 0 && (
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-500">Im Bau / Upgrade</span>
            <span className="text-orange-400">{buildingPumps}×</span>
          </div>
        )}
        {totalPumps === 0 && buildingPumps === 0 && (
          <div className="text-[11px] text-slate-600 text-center">Keine Wassertürme</div>
        )}
      </div>

      {/* Wasserspeicher */}
      {(totalReservoirs > 0 || buildingReservoirs > 0) && (() => {
        const storageLevel = Number(stats.water_storage_level ?? 0);
        const storageCap   = Number(stats.water_storage_capacity ?? clientStorageCap);
        const fillPct      = storageCap > 0 ? storageLevel / storageCap * 100 : 0;

        const isDrawing = balance < 0 && storageLevel > 0 && storageLevel < storageCap && netDeficit === 0;
        const isFilling = balance > 0 && storageLevel < storageCap;
        const isFull    = fillPct >= 100 && !isDrawing && balance >= 0;

        const fillColor = isDrawing
          ? 'bg-amber-500 animate-pulse'
          : fillPct >= 80 ? 'bg-cyan-500' : fillPct >= 40 ? 'bg-cyan-600' : 'bg-cyan-800';

        const timeToEmpty = isDrawing && Math.abs(balance) > 0 ? storageLevel / Math.abs(balance) : null;
        const timeToFull  = isFilling && balance > 0 ? (storageCap - storageLevel) / balance : null;

        return (
          <div className="bg-slate-700/30 rounded px-2 py-1.5 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Wasserspeicher ({totalReservoirs}×)</span>
              <span className="text-cyan-300 font-medium">{storageCap.toLocaleString('de-CH')} m³ Kapazität</span>
            </div>
            <div className="space-y-0.5">
              <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${Math.min(100, fillPct)}%` }} />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">{storageLevel.toLocaleString('de-CH', {maximumFractionDigits:0})} m³ gespeichert</span>
                <span className="text-slate-400">{storageCap > 0 ? (storageLevel / storageCap * 100).toFixed(1) : '0.0'}% voll</span>
              </div>
            </div>
            {isDrawing && (
              <div className="flex justify-between items-center text-[10px] text-amber-400 bg-amber-500/10 rounded px-1.5 py-1">
                <span>↓ Aus Speicher: {Math.round(Math.abs(balance))} m³/h</span>
                {timeToEmpty !== null && (
                  <span className="text-amber-500">noch ~{formatHours(timeToEmpty)}</span>
                )}
              </div>
            )}
            {isFilling && (
              <div className="flex justify-between items-center text-[10px] text-cyan-400 bg-cyan-500/10 rounded px-1.5 py-1">
                <span>↑ Wird befüllt: +{Math.round(balance)} m³/h</span>
                {timeToFull !== null && timeToFull < 48 && (
                  <span className="text-cyan-500">voll in ~{formatHours(timeToFull)}</span>
                )}
              </div>
            )}
            {isFull && !isFilling && (
              <div className="text-[10px] text-green-400 text-center">Voll · kein Verbrauch</div>
            )}
            {buildingReservoirs > 0 && (
              <div className="text-[10px] text-orange-400">{buildingReservoirs}× im Bau</div>
            )}
          </div>
        );
      })()}

      {/* Defizit-Warnung oder OK */}
      {hasDeficit ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-red-400">Wasserdefizit</span>
            <span className="text-[10px] text-slate-500">−{Math.round(netDeficit)} m³/h</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Unterversorgung</span>
            <span className="text-red-400">{deficitPct}% der Nachfrage</span>
          </div>
          <div className="text-[10px] text-slate-500">Weitere Wassertürme bauen oder bestehende ausbauen</div>
        </div>
      ) : production === 0 ? (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1.5 text-xs text-orange-400 text-center">
          Keine Wassertürme — Versorgung aufbauen
        </div>
      ) : (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-1.5 text-xs text-cyan-400 text-center">
          Vollversorgt — alle Gebäude erhalten Wasser
        </div>
      )}
    </div>
  );
});
