'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CircleDashed, CheckCircle2, Clock, AlertTriangle, FileCheck, Star,
  TrendingUp, XCircle,
} from 'lucide-react';
import { fetchMyReports, type MyReport, type ReportSummary, type EventStatus } from '@/lib/api/verwaltungsApi';

export function ReporterPanel() {
  const { setActivePanel } = useGame();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMyReports();
      setReports(data.reports);
      setSummary(data.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const statusLabel = (s: EventStatus): string => {
    switch (s) {
      case 'detected': return 'Entdeckt';
      case 'reported': return 'Gemeldet';
      case 'investigating': return 'Untersuchung';
      case 'assigned': return 'In Arbeit';
      case 'resolved': return 'Behoben';
      case 'expired': return 'Abgelaufen';
      case 'failed': return 'Fehlgeschlagen';
      case 'false_alarm': return 'Fehlalarm';
      default: return s;
    }
  };

  const statusIcon = (s: EventStatus) => {
    switch (s) {
      case 'detected': return <Clock className="w-3 h-3 text-blue-400" />;
      case 'reported': return <FileCheck className="w-3 h-3 text-amber-400" />;
      case 'investigating': return <CircleDashed className="w-3 h-3 text-purple-400 animate-spin" />;
      case 'assigned': return <CircleDashed className="w-3 h-3 text-cyan-400" />;
      case 'resolved': return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case 'expired': return <Clock className="w-3 h-3 text-slate-400" />;
      case 'failed': return <XCircle className="w-3 h-3 text-red-400" />;
      case 'false_alarm': return <AlertTriangle className="w-3 h-3 text-gray-400" />;
      default: return null;
    }
  };

  const statusColor = (s: EventStatus): string => {
    switch (s) {
      case 'resolved': return 'text-emerald-400 border-emerald-400/30';
      case 'assigned': return 'text-cyan-400 border-cyan-400/30';
      case 'reported': return 'text-amber-400 border-amber-400/30';
      case 'expired': return 'text-slate-400 border-slate-400/30';
      case 'failed': return 'text-red-400 border-red-400/30';
      case 'false_alarm': return 'text-gray-400 border-gray-400/30';
      default: return 'text-blue-400 border-blue-400/30';
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-lg bg-slate-900/95 border-slate-700 text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="text-2xl">📋</span>
            <span>Meine Reports</span>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center px-2 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-[10px] text-slate-400">Gesamt</div>
              <div className="font-mono font-bold text-lg text-white">{summary.total_reports}</div>
            </div>
            <div className="text-center px-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400">Korrekt</div>
              <div className="font-mono font-bold text-lg text-emerald-400">{summary.correct_reports}</div>
            </div>
            <div className="text-center px-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="text-[10px] text-amber-400">Ausstehend</div>
              <div className="font-mono font-bold text-lg text-amber-400">{summary.pending_reports}</div>
            </div>
            <div className="text-center px-2 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="text-[10px] text-blue-400 flex items-center justify-center gap-0.5">
                <Star className="w-2.5 h-2.5" /> XP
              </div>
              <div className="font-mono font-bold text-lg text-blue-400">{summary.total_xp_earned}</div>
            </div>
          </div>
        )}

        {/* Reports List */}
        <ScrollArea className="max-h-[55vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <CircleDashed className="w-8 h-8 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">Du hast noch keine Events gemeldet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Starte eine Inspektion, um Vergehen zu finden!
              </p>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {reports.map(report => (
                <div
                  key={report.report_id}
                  className={`p-3 rounded-lg border transition-all ${
                    report.event_status === 'resolved'
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : report.event_status === 'assigned'
                      ? 'border-cyan-500/20 bg-cyan-500/5'
                      : 'border-slate-700 bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{report.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-white truncate">{report.event_name}</div>
                      <div className="text-[10px] text-slate-500">
                        {report.municipality_name} · {report.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {statusIcon(report.event_status)}
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColor(report.event_status)}`}>
                        {statusLabel(report.event_status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>{new Date(report.reported_at).toLocaleDateString('de-CH')}</span>
                    <span>Schwere {report.severity}/5</span>
                    <span>Typ: {report.report_type === 'confirm' ? 'Meldung' : report.report_type === 'investigate' ? 'Investigation' : report.report_type}</span>
                  </div>

                  {/* XP/Status info */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {report.xp_awarded > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-400 font-medium">
                        <TrendingUp className="w-3 h-3" /> +{report.xp_awarded} XP
                      </span>
                    )}
                    {report.xp_awarded < 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-red-400 font-medium">
                        <TrendingUp className="w-3 h-3" /> {report.xp_awarded} XP
                      </span>
                    )}
                    {report.is_correct === 1 && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Korrekt
                      </span>
                    )}
                    {report.is_correct === 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-red-400">
                        <XCircle className="w-3 h-3" /> Fehlalarm
                      </span>
                    )}
                    {report.is_correct === null && report.event_status !== 'resolved' && (
                      <span className="flex items-center gap-0.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3" /> Ausstehend
                      </span>
                    )}
                    {report.event_status === 'resolved' && report.resolved_at && (
                      <span className="text-xs text-emerald-400/70">
                        Behoben: {new Date(report.resolved_at).toLocaleDateString('de-CH')}
                      </span>
                    )}
                  </div>

                  {report.comment && (
                    <div className="mt-1.5 text-xs text-slate-400 italic border-t border-slate-700 pt-1.5">
                      &quot;{report.comment}&quot;
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
