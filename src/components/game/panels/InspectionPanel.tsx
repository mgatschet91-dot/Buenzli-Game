'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, AlertTriangle, CheckCircle2, Shield, CircleDashed, X } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { msg, useMessages } from 'gt-next';
import {
  startInspection as apiStartInspection,
  getActiveInspection,
  getInspectionResults,
  cancelInspection as apiCancelInspection,
  reportEvent,
  type BuenzliEvent,
  type ReportResult,
} from '@/lib/api/eventApi';

interface InspectionPanelProps {
  inspectTileX: number;
  inspectTileY: number;
  onClose: () => void;
  onInspectionComplete?: () => void;
  isVisiting?: boolean;
  currentMunicipalityName?: string;
}

const INSPECTION_CONTEXT_STORAGE_KEY = 'isocity_inspection_context';
const EXTERNAL_REPORT_PAYOUT_RATIO = 0.08;
const EXTERNAL_REPORT_PAYOUT_MIN = 250;
const EXTERNAL_REPORT_PAYOUT_MAX = 5000;

type StoredInspectionContext = {
  inspectionId: number;
  municipalityName: string | null;
  isForeign: boolean;
  savedAt: number;
};

const UI_LABELS = {
  title:            msg('Buenzli-Inspektion'),
  tileLabel:        msg('Feld'),
  radiusLabel:      msg('Radius'),
  retry:            msg('Nochmal versuchen'),
  checking:         msg('Prüfe...'),
  foreignMunicip:   msg('Fremde Gemeinde'),
  externalReports:  msg('— Externe Meldungen möglich'),
  activeMunicip:    msg('Aktive Gemeinde:'),
  foreignDesc:      msg('Untersuche diese fremde Gemeinde. Gefundene Vergehen können extern gemeldet werden.'),
  ownDesc:          msg('Der Buenzli wird 10 Min. nach Vergehen suchen.'),
  startButton:      msg('Inspektion starten'),
  searching:        msg('Suche läuft...'),
  progress1:        msg('Der Buenzli schaut sich um...'),
  progress2:        msg('Er überprüft die Gebäude...'),
  progress3:        msg('Er macht sich Notizen...'),
  progress4:        msg('Fast abgeschlossen...'),
  cancel:           msg('Abbrechen'),
  loading:          msg('Laden...'),
  allClean:         msg('Alles sauber!'),
  close:            msg('Schliessen'),
  violationsFound:  msg('Vergehen gefunden!'),
  estimatedReward:  msg('Bei Annahme: ca.'),
  rewardLabel:      msg('Belohnung'),
  extReportBtn:     msg('Ext. Report'),
  reportBtn:        msg('Melden'),
  investigateBtn:   msg('Prüfen'),
  fixNote:          msg('Beheben erfolgt über die Gemeinde-Verwaltung.'),
  reported:         msg('Gemeldet!'),
  xpLabel:          msg('XP'),
  chfLabel:         msg('CHF'),
  foreignBonus:     msg('Fremd-Gemeinde Bonus!'),
  payoutNote:       msg('Auszahlung erfolgt erst, wenn die Gemeinde den Report akzeptiert. Du bekommst dann eine Benachrichtigung mit dem Betrag.'),
  doneButton:       msg('Fertig'),
  severityCritical: msg('Kritisch'),
  severityHigh:     msg('Hoch'),
  severityMedium:   msg('Mittel'),
  severityLow:      msg('Niedrig'),
  severityMinimal:  msg('Gering'),
  errorStart:       msg('Fehler beim Starten'),
  errorUnknown:     msg('Unbekannter Fehler'),
};

export function InspectionPanel({
  inspectTileX,
  inspectTileY,
  onClose,
  onInspectionComplete,
  isVisiting = false,
  currentMunicipalityName,
}: InspectionPanelProps) {
  const { municipalitySlug } = useGame();
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;

  const [inspectionId, setInspectionId] = useState<number | null>(null);
  const [tileX, setTileX] = useState(inspectTileX);
  const [tileY, setTileY] = useState(inspectTileY);
  const [radius, setRadius] = useState(5);
  const [inspectionMunicipalityName, setInspectionMunicipalityName] = useState<string | null>(null);
  const [inspectionIsForeign, setInspectionIsForeign] = useState(false);
  const [completesAt, setCompletesAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [durationMs, setDurationMs] = useState(10 * 60 * 1000);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [phase, setPhase] = useState<'loading' | 'idle' | 'searching' | 'results' | 'reported'>('loading');
  const [foundEvents, setFoundEvents] = useState<BuenzliEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchedRef = useRef(false);

  const saveInspectionContext = useCallback((context: StoredInspectionContext) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(INSPECTION_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    } catch {
      // ignore storage errors
    }
  }, []);

  const readInspectionContext = useCallback((): StoredInspectionContext | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(INSPECTION_CONTEXT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredInspectionContext>;
      if (typeof parsed.inspectionId !== 'number') return null;
      return {
        inspectionId: parsed.inspectionId,
        municipalityName: typeof parsed.municipalityName === 'string' ? parsed.municipalityName : null,
        isForeign: Boolean(parsed.isForeign),
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      };
    } catch {
      return null;
    }
  }, []);

  const clearInspectionContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(INSPECTION_CONTEXT_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Beim Öffnen oder Feld-Wechsel: Server-State prüfen
  useEffect(() => {
    let cancelled = false;

    // Bei Feld-Wechsel: angeklicktes Feld sofort updaten
    setTileX(inspectTileX);
    setTileY(inspectTileY);

    getActiveInspection()
      .then(insp => {
        if (cancelled) return;
        if (insp && (insp.status === 'searching' || insp.status === 'completed')) {
          const stored = readInspectionContext();
          const nameFromApi = insp.municipality_name ?? null;
          const nameFromStorage = stored && stored.inspectionId === insp.id ? stored.municipalityName : null;
          const foreignFromApi = Boolean(insp.is_foreign);
          const foreignFromStorage = Boolean(stored && stored.inspectionId === insp.id && stored.isForeign);

          setInspectionId(insp.id);
          setTileX(insp.tile_x);
          setTileY(insp.tile_y);
          setRadius(insp.radius);
          setInspectionMunicipalityName(nameFromApi || nameFromStorage || null);
          setInspectionIsForeign(foreignFromApi || foreignFromStorage);
          const completes = new Date(insp.completes_at).getTime();
          setCompletesAt(completes);
          setStartedAt(new Date(insp.started_at).getTime());
          if (insp.status === 'completed' || insp.remaining_ms <= 0) {
            setPhase('results');
            setRemainingMs(0);
          } else {
            setPhase('searching');
            setRemainingMs(insp.remaining_ms);
          }
        } else {
          // Keine laufende Inspektion — idle mit dem neu angeklickten Feld
          setPhase('idle');
          setInspectionId(null);
          setInspectionMunicipalityName(null);
          setInspectionIsForeign(false);
          clearInspectionContext();
          setCompletesAt(null);
          setStartedAt(null);
          setFoundEvents([]);
          setReportResult(null);
          setError(null);
          fetchedRef.current = false;
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('idle');
      });
    return () => { cancelled = true; };
  }, [inspectTileX, inspectTileY, readInspectionContext, clearInspectionContext]);

  // Timer für die Suche
  useEffect(() => {
    if (phase !== 'searching' || !completesAt) return;
    const tick = () => {
      const remaining = Math.max(0, completesAt - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0) {
        setPhase('results');
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, completesAt]);

  // Ergebnisse vom Server laden wenn Phase 'results' wird
  useEffect(() => {
    if (phase !== 'results' || fetchedRef.current || !inspectionId) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    getInspectionResults(inspectionId)
      .then(data => {
        setFoundEvents(data.events);
        setLoading(false);
        onInspectionComplete?.();
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
        fetchedRef.current = false;
      });
  }, [phase, inspectionId, onInspectionComplete]);

  // Inspektion starten (Server-seitig)
  const handleStartInspection = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await apiStartInspection(inspectTileX, inspectTileY, municipalitySlug ?? undefined);
      setInspectionId(result.inspection_id);
      setTileX(result.tile_x);
      setTileY(result.tile_y);
      setRadius(result.radius);
      const nextForeign = Boolean(result.is_foreign) || isVisiting;
      const nextMunicipalityName = result.municipality_name ?? currentMunicipalityName ?? null;
      setInspectionMunicipalityName(nextMunicipalityName);
      setInspectionIsForeign(nextForeign);
      saveInspectionContext({
        inspectionId: result.inspection_id,
        municipalityName: nextMunicipalityName,
        isForeign: nextForeign,
        savedAt: Date.now(),
      });
      setDurationMs(result.duration_ms);
      const completes = new Date(result.completes_at).getTime();
      setCompletesAt(completes);
      setStartedAt(new Date(result.started_at).getTime());
      setRemainingMs(result.duration_ms);
      setPhase('searching');
      setFoundEvents([]);
      setReportResult(null);
      fetchedRef.current = false;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : mm(UI_LABELS.errorStart as Parameters<typeof m>[0]));
    } finally {
      setLoading(false);
    }
  }, [inspectTileX, inspectTileY, isVisiting, currentMunicipalityName, municipalitySlug, saveInspectionContext, m]);

  // Report mit inspection_id an Server senden
  const handleReport = useCallback(async (eventId: number, type: 'confirm' | 'investigate') => {
    setReportingId(eventId);
    setError(null);
    try {
      const result = await reportEvent(eventId, type, undefined, inspectionId ?? undefined);
      setReportResult(result);
      setPhase('reported');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : mm(UI_LABELS.errorUnknown as Parameters<typeof m>[0]));
    } finally {
      setReportingId(null);
    }
  }, [inspectionId, m]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Inspektion abbrechen (Server-seitig)
  const handleCancel = useCallback(async () => {
    if (inspectionId) {
      try {
        await apiCancelInspection(inspectionId);
      } catch {
        // Ignorieren — Panel trotzdem schliessen
      }
    }
    setInspectionId(null);
    setInspectionMunicipalityName(null);
    setInspectionIsForeign(false);
    clearInspectionContext();
    setPhase('idle');
    setRemainingMs(0);
    setFoundEvents([]);
    fetchedRef.current = false;
  }, [inspectionId, clearInspectionContext]);

  const formatTime = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = startedAt && completesAt
    ? Math.min(100, ((Date.now() - startedAt) / (completesAt - startedAt)) * 100)
    : 0;

  const severityColor = (severity: number) => {
    if (severity >= 4) return 'text-red-400';
    if (severity >= 3) return 'text-orange-400';
    if (severity >= 2) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const severityLabel = (severity: number) => {
    if (severity >= 5) return mm(UI_LABELS.severityCritical as Parameters<typeof m>[0]);
    if (severity >= 4) return mm(UI_LABELS.severityHigh as Parameters<typeof m>[0]);
    if (severity >= 3) return mm(UI_LABELS.severityMedium as Parameters<typeof m>[0]);
    if (severity >= 2) return mm(UI_LABELS.severityLow as Parameters<typeof m>[0]);
    return mm(UI_LABELS.severityMinimal as Parameters<typeof m>[0]);
  };

  const estimateExternalReportPayout = (fixCost: number): number => {
    const raw = Math.round(Number(fixCost || 0) * EXTERNAL_REPORT_PAYOUT_RATIO);
    return Math.max(EXTERNAL_REPORT_PAYOUT_MIN, Math.min(EXTERNAL_REPORT_PAYOUT_MAX, raw));
  };

  const shouldShowForeignMunicipality = !!inspectionMunicipalityName && inspectionIsForeign;

  return (
    <div
      className={`fixed right-52 z-50 w-72 bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl text-white ${
        isVisiting ? 'top-48' : 'top-28'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">{mm(UI_LABELS.title as Parameters<typeof m>[0])}</span>
        </div>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Tile info */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{mm(UI_LABELS.tileLabel as Parameters<typeof m>[0])} <span className="text-blue-400 font-mono font-medium">{tileX},{tileY}</span></span>
          <span className="text-slate-600">|</span>
          <span>{mm(UI_LABELS.radiusLabel as Parameters<typeof m>[0])} <span className="text-amber-400 font-mono font-medium">{radius}</span></span>
        </div>

        {error && (
          <div className="px-2 py-1.5 bg-red-500/15 border border-red-500/30 rounded text-red-400 text-xs">
            {error}
            <button
              className="mt-1 w-full text-center text-red-300 underline text-[10px]"
              onClick={() => {
                fetchedRef.current = false;
                setLoading(false);
                setFoundEvents([]);
                setError(null);
              }}
            >
              {mm(UI_LABELS.retry as Parameters<typeof m>[0])}
            </button>
          </div>
        )}

        {/* LOADING initial */}
        {phase === 'loading' && (
          <div className="text-center text-slate-400 py-4">
            <CircleDashed className="w-5 h-5 animate-spin mx-auto mb-1" />
            <span className="text-xs">{mm(UI_LABELS.checking as Parameters<typeof m>[0])}</span>
          </div>
        )}

        {/* Visiting Badge */}
        {isVisiting && (
          <div className="px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-300 flex items-center gap-2">
            <span className="font-bold">{mm(UI_LABELS.foreignMunicip as Parameters<typeof m>[0])}</span>
            <span className="text-purple-400/70">{mm(UI_LABELS.externalReports as Parameters<typeof m>[0])}</span>
          </div>
        )}

        {/* Zeige aktive Gemeinde nur, wenn es nicht die eigene ist */}
        {shouldShowForeignMunicipality && (
          <div className="px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-200">
            {mm(UI_LABELS.activeMunicip as Parameters<typeof m>[0])} <span className="font-semibold">{inspectionMunicipalityName}</span>
          </div>
        )}

        {/* IDLE */}
        {phase === 'idle' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              {isVisiting
                ? mm(UI_LABELS.foreignDesc as Parameters<typeof m>[0])
                : mm(UI_LABELS.ownDesc as Parameters<typeof m>[0])}
            </p>
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white"
              onClick={handleStartInspection}
              disabled={loading}
            >
              {loading ? (
                <CircleDashed className="w-3 h-3 animate-spin mr-1.5" />
              ) : (
                <Search className="w-3 h-3 mr-1.5" />
              )}
              {mm(UI_LABELS.startButton as Parameters<typeof m>[0])}
            </Button>
          </div>
        )}

        {/* SEARCHING */}
        {phase === 'searching' && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs">
              <Clock className="w-3 h-3 animate-pulse" />
              <span className="font-medium">{mm(UI_LABELS.searching as Parameters<typeof m>[0])}</span>
            </div>

            <div className="space-y-1">
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{Math.round(progress)}%</span>
                <span>{formatTime(remainingMs)}</span>
              </div>
            </div>

            <p className="text-[10px] text-white italic">
              {progress < 25
                ? mm(UI_LABELS.progress1 as Parameters<typeof m>[0])
                : progress < 50
                ? mm(UI_LABELS.progress2 as Parameters<typeof m>[0])
                : progress < 75
                ? mm(UI_LABELS.progress3 as Parameters<typeof m>[0])
                : mm(UI_LABELS.progress4 as Parameters<typeof m>[0])}
            </p>

            <button
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
              onClick={handleCancel}
            >
              {mm(UI_LABELS.cancel as Parameters<typeof m>[0])}
            </button>
          </div>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <div className="space-y-2">
            {loading && (
              <div className="text-center text-slate-400 py-4">
                <CircleDashed className="w-5 h-5 animate-spin mx-auto mb-1" />
                <span className="text-xs">{mm(UI_LABELS.loading as Parameters<typeof m>[0])}</span>
              </div>
            )}

            {!loading && !error && foundEvents.length === 0 && (
              <div className="text-center py-3 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs text-emerald-300 font-medium">{mm(UI_LABELS.allClean as Parameters<typeof m>[0])}</p>
                <button
                  className="text-xs text-slate-400 hover:text-white underline"
                  onClick={onClose}
                >
                  {mm(UI_LABELS.close as Parameters<typeof m>[0])}
                </button>
              </div>
            )}

            {!loading && !error && foundEvents.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  {foundEvents.length} {mm(UI_LABELS.violationsFound as Parameters<typeof m>[0])}
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-0.5">
                  {foundEvents.map(event => (
                    <div
                      key={event.id}
                      className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base flex-shrink-0">{event.emoji}</span>
                          <div className="min-w-0">
                            <div className="font-medium text-xs text-white truncate">{event.name}</div>
                            <div className="text-[10px] text-slate-500">{event.category}</div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`flex-shrink-0 text-[9px] px-1 py-0 border-current ${severityColor(event.severity)}`}
                        >
                          {severityLabel(event.severity)}
                        </Badge>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-snug">{event.description}</p>
                      {isVisiting && (
                        <div className="text-[10px] text-purple-300">
                          {mm(UI_LABELS.estimatedReward as Parameters<typeof m>[0])} <span className="font-mono font-semibold">{estimateExternalReportPayout(event.fix_cost).toLocaleString()} CHF</span> {mm(UI_LABELS.rewardLabel as Parameters<typeof m>[0])}
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className={`flex-1 h-6 text-[10px] text-white px-2 ${
                            isVisiting ? 'bg-purple-600 hover:bg-purple-500' : 'bg-amber-600 hover:bg-amber-500'
                          }`}
                          disabled={reportingId !== null}
                          onClick={() => handleReport(event.id, 'confirm')}
                        >
                          {reportingId === event.id ? (
                            <CircleDashed className="w-2.5 h-2.5 animate-spin mr-1" />
                          ) : (
                            <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                          )}
                          {isVisiting ? mm(UI_LABELS.extReportBtn as Parameters<typeof m>[0]) : mm(UI_LABELS.reportBtn as Parameters<typeof m>[0])}
                        </Button>
                        {!isVisiting && event.category === 'Verwaltung' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-6 text-[10px] border-purple-500/40 text-purple-300 hover:bg-purple-500/15 px-2"
                            disabled={reportingId !== null}
                            onClick={() => handleReport(event.id, 'investigate')}
                          >
                            <Shield className="w-2.5 h-2.5 mr-1" />
                            {mm(UI_LABELS.investigateBtn as Parameters<typeof m>[0])}
                          </Button>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 pt-0.5">
                        {mm(UI_LABELS.fixNote as Parameters<typeof m>[0])}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* REPORTED */}
        {phase === 'reported' && reportResult && (
          <div className="text-center py-2 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm text-emerald-300 font-medium">{mm(UI_LABELS.reported as Parameters<typeof m>[0])}</p>

            <div className="bg-emerald-900/30 border border-emerald-700 rounded p-2 text-left space-y-1">
              {reportResult.xp && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{mm(UI_LABELS.xpLabel as Parameters<typeof m>[0])}</span>
                  <span className="text-amber-400 font-bold">+{reportResult.xp.xp}</span>
                </div>
              )}
              {reportResult.coins && reportResult.coins.user > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{mm(UI_LABELS.chfLabel as Parameters<typeof m>[0])}</span>
                  <span className="text-yellow-400 font-bold">+{reportResult.coins.user}</span>
                </div>
              )}
              {reportResult.is_foreign_report && (
                <div className="flex items-center gap-1 text-[10px] text-purple-300 pt-1 border-t border-emerald-700/50">
                  <Shield className="w-2.5 h-2.5" />
                  {mm(UI_LABELS.foreignBonus as Parameters<typeof m>[0])}
                </div>
              )}
              {reportResult.is_foreign_report && (
                <div className="text-[10px] text-slate-400 pt-1">
                  {mm(UI_LABELS.payoutNote as Parameters<typeof m>[0])}
                </div>
              )}
            </div>

            <Button
              size="sm"
              className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={onClose}
            >
              {mm(UI_LABELS.doneButton as Parameters<typeof m>[0])}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
