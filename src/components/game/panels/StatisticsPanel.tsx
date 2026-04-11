'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { getStatsHistory, type StatsHistoryEntry } from '@/lib/api/municipalityAdminApi';

const UI_LABELS = {
  cityStatistics: msg('City Statistics'),
  population: msg('Population'),
  jobs: msg('Jobs'),
  treasury: msg('Treasury'),
  daily: msg('Daily'),
  money: msg('Money'),
  happiness: msg('Happiness'),
  notEnoughData: msg('Not enough data yet. Keep playing to see historical trends.'),
  loading: msg('Loading statistics...'),
  error: msg('Failed to load statistics.'),
  income: msg('Income'),
  expenses: msg('Expenses'),
};

export function StatisticsPanel() {
  const { state, setActivePanel } = useGame();
  const { stats } = state;
  const multiplayer = useMultiplayerOptional();
  const [activeTab, setActiveTab] = useState<'population' | 'money' | 'happiness'>('population');
  const m = useMessages();

  const [history, setHistory] = useState<StatsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Aktuellen Live-Wert als "Heute"-Punkt erstellen
  const todayEntry: StatsHistoryEntry = {
    date: new Date().toISOString().slice(0, 10),
    population: stats.population,
    jobs: stats.jobs,
    money: stats.money,
    income: stats.income,
    expenses: stats.expenses,
    happiness: stats.happiness,
  };

  // Effektive History: Server-Daten + Live-Wert als letzten Punkt
  const effectiveHistory = React.useMemo(() => {
    const merged = [...history];
    const todayDate = todayEntry.date;
    // Wenn der letzte Snapshot von heute ist, ersetzen wir ihn mit dem Live-Wert
    if (merged.length > 0 && merged[merged.length - 1].date.startsWith(todayDate)) {
      merged[merged.length - 1] = todayEntry;
    } else {
      // Sonst haengen wir den heutigen Live-Wert an
      merged.push(todayEntry);
    }
    return merged;
  }, [history, todayEntry.population, todayEntry.money, todayEntry.happiness, todayEntry.date]);

  const loadHistory = useCallback(async () => {
    const slug = multiplayer?.municipalitySlug;
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await getStatsHistory(slug, 90);
      setHistory(data);
    } catch (err) {
      console.error('[StatisticsPanel] History laden fehlgeschlagen:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [multiplayer?.municipalitySlug]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effectiveHistory.length < 1) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const parent = canvas.parentElement;
    const displayW = parent ? parent.clientWidth - 2 : 400;
    const displayH = 200;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    ctx.scale(dpr, dpr);

    const width = displayW;
    const height = displayH;
    const padding = 40;

    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, width, height);

    let data: number[] = [];
    let labels: string[] = [];
    let color = '#10b981';

    switch (activeTab) {
      case 'population':
        data = effectiveHistory.map(h => h.population);
        color = '#10b981';
        break;
      case 'money':
        data = effectiveHistory.map(h => h.money);
        color = '#f59e0b';
        break;
      case 'happiness':
        data = effectiveHistory.map(h => h.happiness);
        color = '#ec4899';
        break;
    }
    labels = effectiveHistory.map(h => {
      const d = new Date(h.date);
      return `${d.getDate()}.${d.getMonth() + 1}`;
    });

    if (data.length < 1) return;

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    // Wenn alle Werte gleich sind, etwas Padding damit der Wert nicht am Rand klebt
    const range = maxVal - minVal || Math.max(1, maxVal * 0.1);

    // Grid lines + labels
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#718096';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - padding * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      const val = maxVal - (range * (i / 4));
      ctx.fillText(formatCompact(val), padding - 4, y + 3);
    }

    // X-axis date labels (max ~8)
    const labelStep = Math.max(1, Math.floor(labels.length / 8));
    ctx.textAlign = 'center';
    ctx.fillStyle = '#718096';
    const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
    for (let i = 0; i < labels.length; i += labelStep) {
      const x = data.length === 1 ? width / 2 : padding + i * stepX;
      ctx.fillText(labels[i], x, height - 8);
    }

    // Line chart
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((val, i) => {
      const x = data.length === 1 ? width / 2 : padding + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Punkt-Marker bei wenig Datenpunkten
    if (data.length <= 3) {
      ctx.fillStyle = color;
      data.forEach((val, i) => {
        const x = data.length === 1 ? width / 2 : padding + i * stepX;
        const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Fill under curve (nur bei >= 2 Punkten)
    if (data.length >= 2) {
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = padding + i * stepX;
        const y = padding + (height - padding * 2) * (1 - (val - minVal) / range);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      const lastX = padding + (data.length - 1) * stepX;
      ctx.lineTo(lastX, height - padding);
      ctx.lineTo(padding, height - padding);
      ctx.closePath();
      ctx.fillStyle = color + '18';
      ctx.fill();
    }

  }, [effectiveHistory, activeTab]);

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-xl bg-slate-900/95 border-slate-700 text-white overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">{m(UI_LABELS.cityStatistics)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3">
              <div className="text-slate-400 text-[10px] sm:text-xs mb-1">{m(UI_LABELS.population)}</div>
              <div className="font-mono tabular-nums font-semibold text-emerald-400 text-sm sm:text-base truncate">{stats.population.toLocaleString()}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3">
              <div className="text-slate-400 text-[10px] sm:text-xs mb-1">{m(UI_LABELS.jobs)}</div>
              <div className="font-mono tabular-nums font-semibold text-blue-400 text-sm sm:text-base truncate">{stats.jobs.toLocaleString()}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3">
              <div className="text-slate-400 text-[10px] sm:text-xs mb-1">{m(UI_LABELS.treasury)}</div>
              <div className="font-mono tabular-nums font-semibold text-amber-400 text-sm sm:text-base truncate">Fr. {stats.money.toLocaleString('de-CH')}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3">
              <div className="text-slate-400 text-[10px] sm:text-xs mb-1">{m(UI_LABELS.daily)}</div>
              <div className={`font-mono tabular-nums font-semibold text-sm sm:text-base truncate ${stats.income - stats.expenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${(stats.income - stats.expenses).toLocaleString()}/Tag
              </div>
            </Card>
          </div>

          <div className="grid w-full grid-cols-3 rounded-lg border border-slate-700 bg-slate-800/60 p-1 gap-1">
            {(['population', 'money', 'happiness'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs sm:text-sm py-2 px-2 sm:px-3 rounded-md font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                }`}
              >
                {m(tab === 'population' ? UI_LABELS.population : tab === 'money' ? UI_LABELS.money : UI_LABELS.happiness)}
              </button>
            ))}
          </div>

          <Card className="bg-slate-800/50 border-slate-700 p-4">
            {loading ? (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
                {m(UI_LABELS.loading)}
              </div>
            ) : error ? (
              <div className="h-[200px] flex items-center justify-center text-red-400 text-sm">
                {m(UI_LABELS.error)}
              </div>
            ) : effectiveHistory.length < 1 ? (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
                {m(UI_LABELS.notEnoughData)}
              </div>
            ) : (
              <canvas ref={canvasRef} width={400} height={200} className="w-full rounded-md" />
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}
