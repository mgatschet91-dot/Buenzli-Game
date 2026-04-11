'use client';

import React, { useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { X, MapPin, Save } from 'lucide-react';

export function BusLineCreationOverlay() {
  const { busLineCreationMode, cancelBusLineCreation, finishBusLineCreation, removeBusLineStop } = useGame();
  const [saving, setSaving] = useState(false);

  if (!busLineCreationMode?.active) return null;

  const { stops, lineName, lineColor, editingLineId } = busLineCreationMode;
  const isEditing = !!editingLineId;
  const canFinish = stops.length >= 4;
  const isMax = stops.length >= 10;

  const handleFinish = async () => {
    setSaving(true);
    await finishBusLineCreation();
    setSaving(false);
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
      <div className="bg-slate-900/95 border-2 rounded-2xl shadow-2xl backdrop-blur-sm min-w-[340px] max-w-[520px]"
        style={{ borderColor: lineColor }}>
        {/* Header bar with line color */}
        <div className="px-4 py-2.5 flex items-center gap-3 border-b border-slate-700/40">
          <div className="w-4 h-4 rounded-full shrink-0 shadow-lg" style={{ backgroundColor: lineColor }} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-white truncate">{isEditing ? `✏️ ${lineName} bearbeiten` : lineName}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
            onClick={cancelBusLineCreation}
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Status + Stops */}
        <div className="px-4 py-3">
          {/* Instruction text */}
          <div className="text-xs text-slate-400 mb-3">
            {stops.length === 0
              ? '📍 Platziere Bushaltestellen neben Strassen und klicke sie an'
              : isMax
                ? '✅ Maximum 10 Haltestellen erreicht'
                : `📍 Klicke auf Bushaltestellen — noch ${Math.max(0, 4 - stops.length)} nötig (${stops.length}/10)`
            }
          </div>

          {/* Stop badges in a row */}
          {stops.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {stops.map((stop, i) => (
                <div
                  key={i}
                  className="h-6 px-2 rounded-full flex items-center gap-1 text-[10px] font-bold text-white cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ backgroundColor: lineColor }}
                  title="Klicken zum Entfernen"
                  onClick={() => removeBusLineStop(i)}
                >
                  <MapPin className="w-3 h-3" />
                  {i + 1}
                  <span className="text-white/60 font-normal">({stop.x},{stop.y})</span>
                  <X className="w-3 h-3 ml-0.5 opacity-60" />
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                backgroundColor: lineColor,
                width: `${Math.min(100, (stops.length / 4) * 100)}%`,
                opacity: canFinish ? 1 : 0.6,
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-xs border-slate-600 text-slate-300 hover:bg-slate-700/50"
              onClick={cancelBusLineCreation}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              className="flex-1 h-9 text-xs font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: canFinish ? '#16a34a' : lineColor }}
              onClick={handleFinish}
              disabled={!canFinish || saving}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Speichert...' : canFinish ? (isEditing ? `Änderungen speichern (${stops.length} Stops)` : `Linie speichern (${stops.length} Stops)`) : `Noch ${4 - stops.length} Stops nötig`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
