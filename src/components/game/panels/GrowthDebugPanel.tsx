'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number | undefined, fallback = 0) {
  return Math.round(v ?? fallback);
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-500'}`}
    />
  );
}

function Row({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: string;
  ok?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1 border-b border-white/5 last:border-0">
      <div className="flex items-center min-w-0">
        {ok !== undefined && <StatusDot ok={ok} />}
        <span className="text-slate-300 text-xs truncate">{label}</span>
        {hint && <span className="ml-1.5 text-slate-500 text-[10px] truncate">{hint}</span>}
      </div>
      <span
        className={`text-xs font-mono font-semibold flex-shrink-0 ${
          ok === undefined ? 'text-slate-200' : ok ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-semibold">{title}</div>
      <div className="bg-white/5 rounded-lg px-3 py-1">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GrowthDebugPanel() {
  const { state, setActivePanel } = useGame();
  const { stats } = state;

  // ── Voraussetzungen ──
  const hasPower =
    (stats.power_production ?? 0) > (stats.power_consumption ?? 0);
  const hasWater =
    (stats.water_production ?? 0) > (stats.water_consumption ?? 0);

  // ── Service scores (0–100) ──
  const safety = pct(stats.safety, 50);        // happiness_safety → maps to police coverage
  const satisfaction = pct(stats.happiness, 50);
  const health = pct(stats.health, 50);
  const education = pct(stats.education, 50);

  // ── Police-Coverage Spawn-Penalty ──
  // Server: < 20 → 50% penalty; < 40 → 80% penalty
  let policeLabel = 'Kein Malus';
  let policeMult = 1.0;
  if (safety < 20) { policeLabel = '−50% Spawn-Chance'; policeMult = 0.5; }
  else if (safety < 40) { policeLabel = '−80% Spawn-Chance'; policeMult = 0.2; }

  // ── Demand-basierte Spawn-Chance (Wohnzone) ──
  const demandRes = stats.demand_residential ?? 0;
  const demandFactor = Math.max(0, Math.min(1, (demandRes + 30) / 80));
  const clientTickChance = 0.05 * demandFactor;
  const effectiveChance = Math.max(0.015, clientTickChance);
  // Server tickt alle 3s (6 × 500ms Ticks), kombiniert zur Tick-Chance
  const tickChancePct = Math.round((1 - Math.pow(1 - effectiveChance, 6)) * 100);
  // Effektiv nach Police-Malus
  const effectiveSpawnPct = Math.round(tickChancePct * policeMult);

  // ── Bauzonen ──
  const zonesRes = stats.zones_residential ?? 0;
  const buildingsRes = stats.buildings_residential ?? 0;
  const emptyZones = Math.max(0, zonesRes - buildingsRes);

  // ── Was fehlt (Blocker-Liste) ──
  const blockers: string[] = [];
  if (!hasPower) blockers.push('Kein Stromüberschuss → Gebäude bauen nicht');
  if (!hasWater) blockers.push('Kein Wasserüberschuss → Gebäude bauen nicht');
  if (safety < 25) blockers.push(`Sicherheit ${safety}% < 25% → massiver Spawn-Malus`);
  if (satisfaction < 30) blockers.push(`Zufriedenheit ${satisfaction}% < 30% → tiefe Nachfrage`);
  if (demandRes < 0) blockers.push(`Nachfrage Wohnen: ${demandRes.toFixed(1)} (negativ = zu viel Leerstand)`);
  if (emptyZones === 0) blockers.push('Keine leeren Wohnzonen → Nichts zum Bebauen');

  const allGood = blockers.length === 0;

  return (
    <Dialog open onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="bg-slate-900 border border-white/10 text-white max-w-sm w-full p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/10 flex-row items-center justify-between">
          <DialogTitle className="text-sm font-semibold text-white">
            🏗️ Wachstums-Diagnose
          </DialogTitle>
          <button
            onClick={() => setActivePanel('none')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </DialogHeader>

        <div className="px-4 py-3 overflow-y-auto max-h-[75vh]">

          {/* Voraussetzungen */}
          <Section title="Voraussetzungen">
            <Row label="Stromüberschuss" value={hasPower ? 'OK' : 'FEHLT'} ok={hasPower}
              hint={`${stats.power_production ?? 0} / ${stats.power_consumption ?? 0} MW`} />
            <Row label="Wasserüberschuss" value={hasWater ? 'OK' : 'FEHLT'} ok={hasWater}
              hint={`${stats.water_production ?? 0} / ${stats.water_consumption ?? 0}`} />
          </Section>

          {/* Service-Scores */}
          <Section title="Service-Scores (beeinflussen Wachstum)">
            <Row label="Sicherheit (Polizei)" value={`${safety}%`}
              ok={safety >= 40} hint={safety < 20 ? '< 20%' : safety < 40 ? '< 40%' : ''} />
            <Row label="Police-Malus" value={policeLabel} ok={policeMult === 1.0} />
            <Row label="Zufriedenheit" value={`${satisfaction}%`} ok={satisfaction >= 40} />
            <Row label="Gesundheit" value={`${health}%`} ok={health >= 40} />
            <Row label="Bildung" value={`${education}%`} ok={education >= 40} />
          </Section>

          {/* Nachfrage */}
          <Section title="Nachfrage">
            <Row label="Wohnen (demand)" value={demandRes.toFixed(1)}
              ok={demandRes > 0} hint="(+30) / 80 = DemandFactor" />
            <Row label="DemandFactor" value={demandFactor.toFixed(2)} ok={demandFactor > 0.3} />
            <Row label="Gewerbe (demand)" value={(stats.demand_commercial ?? 0).toFixed(1)} />
            <Row label="Industrie (demand)" value={(stats.demand_industrial ?? 0).toFixed(1)} />
          </Section>

          {/* Spawn-Chance */}
          <Section title="Spawn-Chance (Wohnzone / Tick)">
            <Row label="Basis-Chance (6 Ticks)" value={`${tickChancePct}%`} ok={tickChancePct > 5} />
            <Row label="Nach Police-Malus" value={`${effectiveSpawnPct}%`} ok={effectiveSpawnPct > 5} />
            <Row label="Leere Wohn-Zonen" value={`${emptyZones}`} ok={emptyZones > 0}
              hint={`${buildingsRes}/${zonesRes} belegt`} />
          </Section>

          {/* Population */}
          <Section title="Bevölkerung">
            <Row label="Einwohner" value={(stats.population ?? 0).toLocaleString()} />
            <Row label="Arbeitsplätze" value={(stats.jobs ?? 0).toLocaleString()} />
            <Row label="Arbeitslose" value={`${pct(stats.unemployment_rate)}%`}
              ok={(stats.unemployment_rate ?? 0) < 10} />
          </Section>

          {/* Fazit */}
          <div className={`rounded-lg px-3 py-2 mt-1 text-xs ${allGood ? 'bg-emerald-900/40 border border-emerald-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
            {allGood ? (
              <span className="text-emerald-300 font-medium">✅ Alle Bedingungen erfüllt — Wachstum aktiv</span>
            ) : (
              <div>
                <div className="text-red-300 font-semibold mb-1">⚠️ Blocker gefunden:</div>
                <ul className="space-y-0.5">
                  {blockers.map((b, i) => (
                    <li key={i} className="text-red-200 leading-tight">• {b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
