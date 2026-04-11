'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGame } from '@/context/GameContext';
import { getMunicipalityCompanies, type MunicipalityCompany } from '@/lib/api/companyApi';
import { getMunicipalityBusLines, type ServerBusLine } from '@/lib/api/busLineApi';
import { setFirmaPrefill } from '@/lib/firmaPrefill';

interface BusStationSectionProps {
  municipalityName?: string;
  isViewOnly?: boolean;
  onClose: () => void;
}

export function BusStationSection({ municipalityName, isViewOnly, onClose }: BusStationSectionProps) {
  const { setActivePanel } = useGame();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<MunicipalityCompany[]>([]);
  const [lines, setLines] = useState<ServerBusLine[]>([]);

  useEffect(() => {
    if (!municipalityName) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getMunicipalityCompanies(municipalityName, 'transport'),
      getMunicipalityBusLines(municipalityName),
    ])
      .then(([c, l]) => {
        if (cancelled) return;
        setCompanies(c);
        setLines(l);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Fehler beim Laden');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [municipalityName]);

  function openFirmaPanel() {
    setFirmaPrefill({ typeCode: 'transport' });
    setActivePanel('firma');
    onClose();
  }

  const totalActiveStops = lines.reduce((sum, l) => sum + (l.stops?.length ?? 0), 0);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
        <span className="animate-spin">⟳</span>
        Lade Liniendaten...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400 py-1">{error}</div>
    );
  }

  // No transport company at all
  if (companies.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🚌</span>
          <span className="text-xs font-semibold text-slate-300">Öffentlicher Verkehr</span>
        </div>
        <div className="rounded border border-slate-700/60 bg-slate-800/40 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Keine ÖV-Firma in dieser Gemeinde.</p>
          <p className="text-xs text-slate-500">Gründe eine Transport-Firma, um Buslinien zu betreiben und Fahrgäste zu befördern.</p>
          {!isViewOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs w-full border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
              onClick={openFirmaPanel}
            >
              🚌 ÖV-Firma gründen →
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Companies exist but no active lines
  if (lines.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🚌</span>
          <span className="text-xs font-semibold text-slate-300">Öffentlicher Verkehr</span>
        </div>
        {companies.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs">
            <span>{c.emoji}</span>
            <span className="text-slate-300 font-medium">{c.name}</span>
            <Badge variant="outline" className="h-4 text-[10px] px-1 border-slate-600 text-slate-400">
              Lv.{c.level}
            </Badge>
          </div>
        ))}
        <div className="rounded border border-slate-700/60 bg-slate-800/40 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Noch keine aktiven Buslinien.</p>
          {!isViewOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs w-full border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
              onClick={openFirmaPanel}
            >
              Linien verwalten →
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Companies + active lines — show stats + line list
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">🚌</span>
        <span className="text-xs font-semibold text-slate-300">Öffentlicher Verkehr</span>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded bg-slate-800/60 px-1 py-1.5">
          <div className="text-sm font-bold text-slate-100">{lines.length}</div>
          <div className="text-[10px] text-muted-foreground">Routen</div>
        </div>
        <div className="rounded bg-slate-800/60 px-1 py-1.5">
          <div className="text-sm font-bold text-slate-100">{totalActiveStops}</div>
          <div className="text-[10px] text-muted-foreground">Haltestellen</div>
        </div>
        <div className="rounded bg-slate-800/60 px-1 py-1.5">
          <div className="text-sm font-bold text-slate-100">{companies.length}</div>
          <div className="text-[10px] text-muted-foreground">Firmen</div>
        </div>
      </div>

      {/* Line list */}
      <div className="space-y-1">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-2 rounded bg-slate-800/40 px-2 py-1">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: line.color || '#94a3b8' }}
            />
            <span className="text-xs text-slate-200 flex-1 truncate">{line.name}</span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {line.stops?.length ?? 0} Halt.
            </span>
          </div>
        ))}
      </div>

      {!isViewOnly && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] w-full text-slate-400 hover:text-slate-200"
          onClick={openFirmaPanel}
        >
          Firmen verwalten →
        </Button>
      )}
    </div>
  );
}
