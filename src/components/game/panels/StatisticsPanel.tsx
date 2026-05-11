'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { getStatsHistory, type StatsHistoryEntry } from '@/lib/api/municipalityAdminApi';
import { X } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function pct(v: number | undefined, fallback = 0) {
  return Math.round(v ?? fallback);
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-500'}`} />
  );
}

function GRow({ label, value, ok, hint }: { label: string; value: string; ok?: boolean; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1 border-b border-white/5 last:border-0">
      <div className="flex items-center min-w-0">
        {ok !== undefined && <StatusDot ok={ok} />}
        <span className="text-slate-300 text-xs truncate">{label}</span>
        {hint && <span className="ml-1.5 text-slate-500 text-[10px] truncate">{hint}</span>}
      </div>
      <span className={`text-xs font-mono font-semibold flex-shrink-0 ${
        ok === undefined ? 'text-slate-200' : ok ? 'text-emerald-400' : 'text-red-400'
      }`}>
        {value}
      </span>
    </div>
  );
}

function GSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-semibold">{title}</div>
      <div className="bg-white/5 rounded-lg px-3 py-1">{children}</div>
    </div>
  );
}

const UI_LABELS = {
  cityStatistics: msg('Stadtstatistiken'),
  population: msg('Bevölkerung'),
  jobs: msg('Arbeitsplätze'),
  treasury: msg('Haushalt'),
  daily: msg('Täglich'),
  money: msg('Geld'),
  happiness: msg('Glück'),
  notEnoughData: msg('Noch nicht genug Daten. Spiele weiter um historische Trends zu sehen.'),
  loading: msg('Statistiken laden...'),
  error: msg('Statistiken konnten nicht geladen werden.'),
  income: msg('Einnahmen'),
  expenses: msg('Ausgaben'),
  // Growth tab strings
  prerequisites:       msg('Voraussetzungen'),
  powerSurplus:        msg('Stromüberschuss'),
  ok:                  msg('OK'),
  missing:             msg('FEHLT'),
  waterSurplus:        msg('Wasserüberschuss'),
  serviceScores:       msg('Service-Scores (beeinflussen Wachstum)'),
  safetyPolice:        msg('Sicherheit (Polizei)'),
  policePenalty:       msg('Police-Malus'),
  noPenalty:           msg('Kein Malus'),
  spawnPenalty50:      msg('−50% Spawn-Chance'),
  spawnPenalty20:      msg('−20% Spawn-Chance'),
  satisfaction:        msg('Zufriedenheit'),
  health:              msg('Gesundheit'),
  education:           msg('Bildung'),
  demandSection:       msg('Nachfrage'),
  residentialDemand:   msg('Wohnen (demand)'),
  factorLabel:         msg('→ Faktor:'),
  spawnFactor:         msg('Spawn-Faktor (0–1)'),
  commercialDemand:    msg('Gewerbe (demand)'),
  industrialDemand:    msg('Industrie (demand)'),
  spawnChance:         msg('Spawn-Chance (Wohnzone / Tick)'),
  baseChance:          msg('Basis-Chance (6 Ticks)'),
  afterPolicePenalty:  msg('Nach Police-Malus'),
  emptyResZones:       msg('Leere Wohn-Zonen'),
  occupied:            msg('belegt'),
  populationSection:   msg('Bevölkerung'),
  inhabitants:         msg('Einwohner'),
  jobsLabel:           msg('Arbeitsplätze'),
  unemployed:          msg('Arbeitslose'),
  blockerNoPower:      msg('No power surplus → buildings not spawning'),
  blockerNoWater:      msg('No water surplus → buildings not spawning'),
  blockerSafetyCrit:   msg('Sicherheit {s}% < 20% → −50% Spawn-Malus'),
  blockerSafetyLow:    msg('Sicherheit {s}% < 40% → −20% Spawn-Malus'),
  blockerSatisfaction: msg('Satisfaction {s}% < 30% → low demand'),
  blockerDemandLow:    msg('Demand too low ({d}) → no growth possible'),
  blockerNoZones:      msg('No empty residential zones → nothing to build on'),
  allConditionsMet:    msg('✅ All conditions met — growth active'),
  blockersFound:       msg('⚠️ Blockers found:'),
  cityOverviewTitle:   msg('📊 Stadt Übersicht'),
  tabStatistics:       msg('📈 Statistik'),
  tabGrowth:           msg('🌱 Wachstum'),
  perDay:              msg('/Tag'),
};

// ── Wachstum-Tab (ehemals GrowthDebugPanel) ──────────────────────────────────

function WachstumTab() {
  const { state } = useGame();
  const { stats } = state;
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;

  const hasPower = (stats.power_production ?? 0) > (stats.power_consumption ?? 0);
  const hasWater = (stats.water_production ?? 0) > (stats.water_consumption ?? 0);

  const safety       = pct(stats.safety, 50);
  const satisfaction = pct(stats.happiness, 50);
  const health       = pct(stats.health, 50);
  const education    = pct(stats.education, 50);

  // Police-Malus — exakt wie Server (disasters.js):
  // < 20 → skip wenn random >= 0.5 → −50%
  // < 40 → skip wenn random >= 0.8 → −20%
  let policeLabel = mm(UI_LABELS.noPenalty);
  let policeMult  = 1.0;
  if (safety < 20)      { policeLabel = mm(UI_LABELS.spawnPenalty50); policeMult = 0.5; }
  else if (safety < 40) { policeLabel = mm(UI_LABELS.spawnPenalty20); policeMult = 0.8; }

  const demandRes   = stats.demand_residential ?? 0;
  const demandFactor = Math.max(0, Math.min(1, (demandRes + 30) / 80));
  const clientTickChance  = 0.05 * demandFactor;
  const effectiveChance   = Math.max(0.015, clientTickChance);
  const tickChancePct     = Math.round((1 - Math.pow(1 - effectiveChance, 6)) * 100);
  const effectiveSpawnPct = Math.round(tickChancePct * policeMult);

  const zonesRes    = stats.zones_residential ?? 0;
  const buildingsRes = stats.buildings_residential ?? 0;
  const emptyZones  = Math.max(0, zonesRes - buildingsRes);

  const blockers: string[] = [];
  if (!hasPower) blockers.push(mm(UI_LABELS.blockerNoPower));
  if (!hasWater) blockers.push(mm(UI_LABELS.blockerNoWater));
  if (safety < 20) blockers.push(`Safety ${safety}% < 20% → −50% spawn penalty`);
  else if (safety < 40) blockers.push(`Safety ${safety}% < 40% → −20% spawn penalty`);
  if (satisfaction < 30) blockers.push(`Satisfaction ${satisfaction}% < 30% → low demand`);
  if (demandFactor === 0) blockers.push(`Demand too low (${demandRes.toFixed(1)}) → no growth possible`);
  if (emptyZones === 0) blockers.push(mm(UI_LABELS.blockerNoZones));

  const allGood = blockers.length === 0;

  return (
    <div>
      <GSection title={mm(UI_LABELS.prerequisites)}>
        <GRow label={mm(UI_LABELS.powerSurplus)} value={hasPower ? mm(UI_LABELS.ok) : mm(UI_LABELS.missing)} ok={hasPower}
          hint={`${stats.power_production ?? 0} / ${stats.power_consumption ?? 0} MW`} />
        <GRow label={mm(UI_LABELS.waterSurplus)} value={hasWater ? mm(UI_LABELS.ok) : mm(UI_LABELS.missing)} ok={hasWater}
          hint={`${stats.water_production ?? 0} / ${stats.water_consumption ?? 0}`} />
      </GSection>

      <GSection title={mm(UI_LABELS.serviceScores)}>
        <GRow label={mm(UI_LABELS.safetyPolice)} value={`${safety}%`} ok={safety >= 40} />
        <GRow label={mm(UI_LABELS.policePenalty)} value={policeLabel} ok={policeMult === 1.0} />
        <GRow label={mm(UI_LABELS.satisfaction)} value={`${satisfaction}%`} ok={satisfaction >= 40} />
        <GRow label={mm(UI_LABELS.health)} value={`${health}%`} ok={health >= 40} />
        <GRow label={mm(UI_LABELS.education)} value={`${education}%`} ok={education >= 40} />
      </GSection>

      <GSection title={mm(UI_LABELS.demandSection)}>
        <GRow label={mm(UI_LABELS.residentialDemand)} value={demandRes.toFixed(1)}
          ok={demandFactor > 0} hint={`${mm(UI_LABELS.factorLabel)} ${demandFactor.toFixed(2)}`} />
        <GRow label={mm(UI_LABELS.spawnFactor)} value={demandFactor.toFixed(2)} ok={demandFactor > 0.3} />
        <GRow label={mm(UI_LABELS.commercialDemand)} value={(stats.demand_commercial ?? 0).toFixed(1)} />
        <GRow label={mm(UI_LABELS.industrialDemand)} value={(stats.demand_industrial ?? 0).toFixed(1)} />
      </GSection>

      <GSection title={mm(UI_LABELS.spawnChance)}>
        <GRow label={mm(UI_LABELS.baseChance)} value={`${tickChancePct}%`} ok={tickChancePct > 5} />
        <GRow label={mm(UI_LABELS.afterPolicePenalty)} value={`${effectiveSpawnPct}%`} ok={effectiveSpawnPct > 5} />
        <GRow label={mm(UI_LABELS.emptyResZones)} value={`${emptyZones}`} ok={emptyZones > 0}
          hint={`${buildingsRes}/${zonesRes} ${mm(UI_LABELS.occupied)}`} />
      </GSection>

      <GSection title={mm(UI_LABELS.populationSection)}>
        <GRow label={mm(UI_LABELS.inhabitants)} value={(stats.population ?? 0).toLocaleString()} />
        <GRow label={mm(UI_LABELS.jobsLabel)} value={(stats.jobs ?? 0).toLocaleString()} />
        <GRow label={mm(UI_LABELS.unemployed)} value={`${pct(stats.unemployment_rate)}%`}
          ok={(stats.unemployment_rate ?? 0) < 10} />
      </GSection>

      <div className={`rounded-lg px-3 py-2 text-xs ${allGood ? 'bg-emerald-900/40 border border-emerald-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
        {allGood ? (
          <span className="text-emerald-300 font-medium">{mm(UI_LABELS.allConditionsMet)}</span>
        ) : (
          <div>
            <div className="text-red-300 font-semibold mb-1">{mm(UI_LABELS.blockersFound)}</div>
            <ul className="space-y-0.5">
              {blockers.map((b, i) => (
                <li key={i} className="text-red-200 leading-tight">• {b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Statistik-Tab ─────────────────────────────────────────────────────────────

function StatistikTab() {
  const { state } = useGame();
  const { stats } = state;
  const multiplayer = useMultiplayerOptional();
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;

  const [chartTab, setChartTab] = useState<'population' | 'money' | 'happiness'>('population');
  const [history, setHistory] = useState<StatsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live-Snapshot: wird einmalig beim Öffnen gesetzt und dann alle 5 Minuten aktualisiert
  const makeSnapshot = useCallback((): StatsHistoryEntry => ({
    date: new Date().toISOString().slice(0, 10),
    population: stats.population,
    jobs: stats.jobs,
    money: stats.money,
    income: stats.income,
    expenses: stats.expenses,
    happiness: stats.happiness,
  }), [stats.population, stats.jobs, stats.money, stats.income, stats.expenses, stats.happiness]);

  const [todayEntry, setTodayEntry] = useState<StatsHistoryEntry>(makeSnapshot);

  // Alle 5 Minuten den Live-Punkt aktualisieren
  useEffect(() => {
    const id = setInterval(() => setTodayEntry(makeSnapshot()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [makeSnapshot]);

  const effectiveHistory = React.useMemo(() => {
    const merged = [...history];
    if (merged.length > 0 && merged[merged.length - 1].date.startsWith(todayEntry.date)) {
      merged[merged.length - 1] = todayEntry;
    } else {
      merged.push(todayEntry);
    }
    return merged;
  }, [history, todayEntry]);

  const loadHistory = useCallback(async () => {
    const slug = multiplayer?.municipalitySlug;
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const data = await getStatsHistory(slug, 90);
      setHistory(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [multiplayer?.municipalitySlug]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effectiveHistory.length < 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const parent = canvas.parentElement;
    const displayW = parent ? parent.clientWidth - 2 : 400;
    const displayH = 160;
    canvas.width  = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width  = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    ctx.scale(dpr, dpr);

    const width = displayW, height = displayH, padding = 36;
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, width, height);

    let data: number[] = [];
    let color = '#10b981';
    switch (chartTab) {
      case 'population': data = effectiveHistory.map(h => h.population); color = '#10b981'; break;
      case 'money':      data = effectiveHistory.map(h => h.money);      color = '#f59e0b'; break;
      case 'happiness':  data = effectiveHistory.map(h => h.happiness);  color = '#ec4899'; break;
    }
    const labels = effectiveHistory.map(h => {
      const d = new Date(h.date);
      return `${d.getDate()}.${d.getMonth() + 1}`;
    });

    if (data.length < 1) return;
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range  = maxVal - minVal || Math.max(1, maxVal * 0.1);

    ctx.strokeStyle = '#2d3748'; ctx.lineWidth = 0.5;
    ctx.fillStyle = '#718096'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - padding * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
      ctx.fillText(formatCompact(maxVal - range * (i / 4)), padding - 4, y + 3);
    }

    const labelStep = Math.max(1, Math.floor(labels.length / 8));
    const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
    ctx.textAlign = 'center'; ctx.fillStyle = '#718096';
    for (let i = 0; i < labels.length; i += labelStep) {
      const x = data.length === 1 ? width / 2 : padding + i * stepX;
      ctx.fillText(labels[i], x, height - 6);
    }

    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((val, i) => {
      const x = data.length === 1 ? width / 2 : padding + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (data.length <= 3) {
      ctx.fillStyle = color;
      data.forEach((val, i) => {
        const x = data.length === 1 ? width / 2 : padding + i * stepX;
        const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      });
    }

    if (data.length >= 2) {
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = padding + i * stepX;
        const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(padding + (data.length - 1) * stepX, height - padding);
      ctx.lineTo(padding, height - padding);
      ctx.closePath();
      ctx.fillStyle = color + '18'; ctx.fill();
    }
  }, [effectiveHistory, chartTab]);

  const balance = stats.income - stats.expenses;

  return (
    <div className="space-y-3">
      {/* Stat-Karten */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-slate-800/50 border-slate-700 p-3">
          <div className="text-slate-400 text-[10px] mb-1">{mm(UI_LABELS.population)}</div>
          <div className="font-mono font-semibold text-emerald-400 text-base truncate">{stats.population.toLocaleString()}</div>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700 p-3">
          <div className="text-slate-400 text-[10px] mb-1">{mm(UI_LABELS.jobs)}</div>
          <div className="font-mono font-semibold text-blue-400 text-base truncate">{stats.jobs.toLocaleString()}</div>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700 p-3">
          <div className="text-slate-400 text-[10px] mb-1">{mm(UI_LABELS.treasury)}</div>
          <div className="font-mono font-semibold text-amber-400 text-base truncate">Fr. {stats.money.toLocaleString()}</div>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700 p-3">
          <div className="text-slate-400 text-[10px] mb-1">{mm(UI_LABELS.daily)}</div>
          <div className={`font-mono font-semibold text-base truncate ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString()}{mm(UI_LABELS.perDay)}
          </div>
        </Card>
      </div>

      {/* Chart-Tabs */}
      <div className="grid w-full grid-cols-3 rounded-lg border border-slate-700 bg-slate-800/60 p-1 gap-1">
        {(['population', 'money', 'happiness'] as const).map(tab => (
          <button key={tab} onClick={() => setChartTab(tab)}
            className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
              chartTab === tab ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}>
            {mm(tab === 'population' ? UI_LABELS.population : tab === 'money' ? UI_LABELS.money : UI_LABELS.happiness)}
          </button>
        ))}
      </div>

      {/* Chart */}
      <Card className="bg-slate-800/50 border-slate-700 p-3">
        {loading ? (
          <div className="h-[160px] flex items-center justify-center text-slate-400 text-sm">{mm(UI_LABELS.loading)}</div>
        ) : error ? (
          <div className="h-[160px] flex items-center justify-center text-red-400 text-sm">{mm(UI_LABELS.error)}</div>
        ) : effectiveHistory.length < 1 ? (
          <div className="h-[160px] flex items-center justify-center text-slate-400 text-sm">{mm(UI_LABELS.notEnoughData)}</div>
        ) : (
          <canvas ref={canvasRef} width={400} height={160} className="w-full rounded-md" />
        )}
      </Card>
    </div>
  );
}

// ── Haupt-Panel ───────────────────────────────────────────────────────────────

export function StatisticsPanel() {
  const { setActivePanel } = useGame();
  const [mainTab, setMainTab] = useState<'statistik' | 'wachstum'>('statistik');
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="bg-slate-900 border border-white/10 text-white max-w-sm w-full p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-4 pt-4 pb-0 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <DialogTitle className="text-sm font-semibold text-white">
              {mm(UI_LABELS.cityOverviewTitle)}
            </DialogTitle>
            <button onClick={() => setActivePanel('none')} className="text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Haupt-Tabs */}
          <div className="grid grid-cols-2 gap-1 pb-3">
            {([
              { key: 'statistik', label: mm(UI_LABELS.tabStatistics) },
              { key: 'wachstum',  label: mm(UI_LABELS.tabGrowth)     },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setMainTab(key)}
                className={`text-xs py-2 px-3 rounded-lg font-medium transition-all ${
                  mainTab === key
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="px-4 py-3 overflow-y-auto max-h-[75vh]">
          {mainTab === 'statistik' ? <StatistikTab /> : <WachstumTab />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
