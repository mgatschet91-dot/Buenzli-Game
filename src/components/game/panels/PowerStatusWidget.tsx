'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

export const PowerStatusWidget = React.memo(function PowerStatusWidget() {
  const { state } = useGame();
  const stats = state.stats as any;
  const [bufferPct, setBufferPct] = useState<number>(Number(stats.power_buffer_pct ?? 10));
  const [saving, setSaving] = useState(false);
  const [myOffersMw, setMyOffersMw] = useState(0);

  // Eigene Spot-Angebote laden um verkaufte MW abzuziehen
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch(`${AUTH_API_BASE_URL}/api/marketplace/energy/spot/my`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.data?.offers)) {
          const total = d.data.offers.reduce((s: number, o: any) => s + Number(o.max_mw ?? 0), 0);
          setMyOffersMw(total);
        }
      })
      .catch(() => {});
  }, []);

  const saveBuffer = useCallback(async (pct: number) => {
    setSaving(true);
    try {
      const token = getAuthToken();
      await fetch(`${AUTH_API_BASE_URL}/api/municipality/power-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}`, 'X-Game-Token': token } : {}) },
        body: JSON.stringify({ power_buffer_pct: pct }),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const production     = Number(stats.power_production ?? 0);
  const consumption    = Number(stats.power_consumption ?? 0);
  const effectiveProd  = Number(stats.power_production_effective ?? production);
  const balance        = Number(stats.power_balance_effective ?? (production - consumption));
  const importUnits    = Number(stats.power_import_units ?? 0);
  const importCost     = Number(stats.power_import_cost ?? 0);
  const pricePerUnit   = Number(stats.power_import_price_per_unit ?? 2);
  const soldMw         = Number(stats.power_sold_mw ?? 0);
  const boughtMw       = Number(stats.power_bought_mw ?? 0);
  const surplusPct     = Number(stats.power_surplus_pct ?? 0);
  const availToSell    = Number(stats.power_available_to_sell ?? 0);
  const bufferMw       = Number(stats.power_buffer_mw ?? 0);
  const multiplier     = Number(stats.power_season_multiplier ?? 1);
  const season         = stats.season ?? 'spring';
  const weatherType    = stats.weather_type ?? 'clear';
  const temperature    = stats.weather_temperature ?? null;

  const seasonLabel = season === 'winter' ? 'Winter' : season === 'summer' ? 'Sommer' : season === 'spring' ? 'Frühling' : 'Herbst';
  const weatherLabel = weatherType === 'clear' ? 'Klar' : weatherType === 'rain' ? 'Regen' : weatherType === 'snow' ? 'Schnee' : weatherType === 'storm' ? 'Sturm' : weatherType === 'blizzard' ? 'Blizzard' : weatherType === 'fog' ? 'Nebel' : weatherType;

  const hasImport        = importUnits > 0;
  const hasPartnerRabatt = pricePerUnit < 2;
  const hasSurplus       = availToSell > 0;
  const hasTrade         = soldMw > 0 || boughtMw > 0;
  const multiplierPct    = Math.round((multiplier - 1) * 100);
  const balanceColor     = balance >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="space-y-2">
      {/* Produktion / Verbrauch / Bilanz */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">Produktion</div>
          <div className="text-sm font-bold text-green-400">{effectiveProd} MW</div>
          {soldMw > 0 && <div className="text-[9px] text-slate-500">({production} − {soldMw} verk.)</div>}
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">Verbrauch</div>
          <div className="text-sm font-bold text-yellow-400">{consumption} MW</div>
          {multiplierPct > 0 && <div className="text-[9px] text-orange-400">+{multiplierPct}% {seasonLabel}</div>}
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-slate-400 mb-0.5">Bilanz</div>
          <div className={`text-sm font-bold ${balanceColor}`}>{balance >= 0 ? '+' : ''}{balance} MW</div>
          {surplusPct > 0 && <div className="text-[9px] text-slate-500">+{surplusPct}%</div>}
        </div>
      </div>

      {/* Wetter/Saison */}
      {temperature !== null && (
        <div className="flex items-center justify-between text-xs bg-slate-700/30 rounded px-2 py-1">
          <span className="text-slate-400">{seasonLabel} · {weatherLabel}</span>
          <span className="text-sky-300">{temperature}°C</span>
        </div>
      )}

      {/* Handel */}
      {hasTrade && (
        <div className="flex gap-2 text-xs">
          {boughtMw > 0 && (
            <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 text-center">
              <span className="text-blue-400">+{boughtMw} MW</span>
              <span className="text-slate-500 ml-1">eingekauft</span>
            </div>
          )}
          {soldMw > 0 && (
            <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1 text-center">
              <span className="text-yellow-400">−{soldMw} MW</span>
              <span className="text-slate-500 ml-1">verkauft</span>
            </div>
          )}
        </div>
      )}

      {/* Überschuss verkaufbar */}
      {hasSurplus && !hasImport && (
        <div className="bg-green-500/10 border border-green-500/20 rounded px-2 py-1.5 space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-green-400">Verkaufbar (nach Puffer)</span>
            <span className="text-xs font-medium text-green-300">{availToSell} MW</span>
          </div>
          {myOffersMw > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">davon am Markt angeboten</span>
              <span className="text-[10px] text-yellow-400">−{myOffersMw} MW</span>
            </div>
          )}
          {myOffersMw > 0 && (
            <div className="flex justify-between items-center border-t border-green-500/10 pt-0.5">
              <span className="text-[10px] text-slate-400">noch frei</span>
              <span className="text-[10px] font-semibold text-emerald-400">{Math.max(0, availToSell - myOffersMw)} MW</span>
            </div>
          )}
        </div>
      )}

      {/* Konfigurierbarer Puffer */}
      <div className="bg-slate-700/30 rounded px-2 py-1.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Reserve-Puffer</span>
          <span className="text-slate-300 font-medium">{bufferPct}% · {bufferMw} MW</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 5, 10, 15, 20, 25].map(pct => (
            <button
              key={pct}
              onClick={() => { setBufferPct(pct); saveBuffer(pct); }}
              className={`flex-1 text-[10px] rounded py-0.5 transition-colors ${
                bufferPct === pct
                  ? 'bg-sky-500 text-white font-bold'
                  : 'bg-slate-600/60 text-slate-400 hover:bg-slate-500/60'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
        {saving && <div className="text-[9px] text-slate-500 text-right">Speichern...</div>}
      </div>

      {/* Import */}
      {hasImport ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-red-400">Strom-Import aktiv</span>
            <span className="text-[10px] text-slate-500">{importUnits} MW</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Fr./MW</span>
            <span className={hasPartnerRabatt ? 'text-green-400' : 'text-slate-300'}>
              {pricePerUnit.toFixed(2)}{hasPartnerRabatt ? ' (Partner -20%)' : ''}
            </span>
          </div>
          <div className="flex justify-between text-xs font-medium border-t border-slate-700 pt-1">
            <span className="text-slate-400">Kosten/Tick</span>
            <span className="text-red-400">Fr. {importCost.toLocaleString('de-CH')}</span>
          </div>
          <div className="text-[10px] text-slate-500">Bau weitere Kraftwerke um Import zu reduzieren</div>
        </div>
      ) : !hasSurplus ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded px-2 py-1.5 text-xs text-green-400 text-center">
          Autark — kein Import nötig
        </div>
      ) : null}
    </div>
  );
});
