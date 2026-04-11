'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { X, Home } from 'lucide-react';

export function ResidencePlacementOverlay() {
  const { residencePlacement, cancelResidencePlacement } = useGame();

  if (!residencePlacement) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
      <div className="bg-slate-900/95 border-2 border-amber-500/60 rounded-2xl shadow-2xl backdrop-blur-sm min-w-[300px]">
        <div className="px-4 py-3 flex items-center gap-3">
          <Home className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-amber-300">Mansion platzieren</div>
            <div className="text-xs text-slate-400 mt-0.5">Klicke auf ein freies Tile auf der Karte</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
            onClick={cancelResidencePlacement}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="px-4 pb-3">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs border-slate-600 text-slate-300 hover:bg-slate-700/50"
            onClick={cancelResidencePlacement}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}
