'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { Flame, Wind, Waves, Mountain, AlertTriangle, X, Wrench, MapPin, Clock, Siren, Shield, Heart } from 'lucide-react';
import { gridToScreen } from '@/components/game/utils';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';

export type DisasterType = 'fire' | 'earthquake' | 'tornado' | 'flood' | 'meteor';

interface DisasterVariant {
  name: string;
  description: string;
}

const DISASTER_VARIANTS: Record<DisasterType, DisasterVariant[]> = {
  fire: [
    { name: 'Gebäudebrand', description: 'Flammen breiten sich über mehrere Stockwerke aus. Sofortige Evakuierung nötig.' },
    { name: 'Chemiebrand', description: 'Giftige Chemikalien brennen. Gefährliche Dämpfe breiten sich aus.' },
    { name: 'Elektrobrand', description: 'Kurzschluss in der Elektrik. Rauch quillt aus dem Gebäude.' },
    { name: 'Industriebrand', description: 'Fabrikbrand mit starker Rauchentwicklung. Gefahrstoffe beteiligt.' },
    { name: 'Küchenbrand', description: 'Fettbrand ausser Kontrolle. Lüftung beeinträchtigt.' },
    { name: 'Gasbrand', description: 'Gasleck entzündet. Dauerflamme an der Leitung. Absperrventil nötig.' },
    { name: 'Brandstiftung', description: 'Vorsätzlich gelegtes Feuer. Brandbeschleuniger eingesetzt.' },
  ],
  earthquake: [
    { name: 'Leichtes Beben', description: 'Erschütterungen spürbar. Vereinzelte Risse in Gebäuden.' },
    { name: 'Starkes Erdbeben', description: 'Heftige Erschütterungen! Einsturzgefahr bei älteren Gebäuden.' },
    { name: 'Nachbeben', description: 'Weitere Erschütterungen nach dem Hauptbeben. Gebäude instabil.' },
    { name: 'Erdrutsch', description: 'Boden gibt nach. Strassen blockiert, Gebäude bedroht.' },
  ],
  tornado: [
    { name: 'Windhose', description: 'Starker Wirbelsturm fegt über das Gebiet. Trümmer fliegen umher.' },
    { name: 'Sturmböe', description: 'Orkanartige Böen reissen Dächer ab. Bäume entwurzelt.' },
    { name: 'Hagelsturm', description: 'Schwerer Hagel beschädigt Fahrzeuge und Gebäude.' },
  ],
  flood: [
    { name: 'Flusshochwasser', description: 'Der Fluss ist über die Ufer getreten. Keller volllaufen.' },
    { name: 'Sturzflut', description: 'Plötzliche Wassermassen durch Starkregen. Strassen überschwemmt.' },
    { name: 'Rohrbruch', description: 'Hauptwasserleitung gebrochen. Strassen stehen unter Wasser.' },
    { name: 'Dammbruch', description: 'Damm hat nachgegeben. Evakuierung des Gebiets notwendig.' },
  ],
  meteor: [
    { name: 'Meteoreinschlag', description: 'Ein Meteor ist eingeschlagen! Krater und Druckwelle.' },
    { name: 'Trümmerregen', description: 'Meteoritenfragmente regnen auf die Stadt herab.' },
    { name: 'Feuerball', description: 'Glühender Asteroid explodiert über dem Stadtgebiet.' },
  ],
};

function pickVariant(type: DisasterType): DisasterVariant {
  const variants = DISASTER_VARIANTS[type];
  return variants[Math.floor(Math.random() * variants.length)];
}

export interface ActiveDisaster {
  id: string;
  type: DisasterType;
  x: number;
  y: number;
  severity: number;
  startedAt: number;
  damage: number;
  repairCost: number;
  repairing: boolean;
  variantName: string;
  variantDesc: string;
}

export const DISASTER_INFO: Record<DisasterType, {
  name: string;
  emoji: string;
  accent: string;
  particleColor: string;
  description: string;
}> = {
  fire: {
    name: 'Grossbrand',
    emoji: '🔥',
    accent: 'text-orange-400',
    particleColor: '#f97316',
    description: 'Ein Feuer wütet in der Stadt!',
  },
  earthquake: {
    name: 'Erdbeben',
    emoji: '🌍',
    accent: 'text-amber-400',
    particleColor: '#d97706',
    description: 'Die Erde bebt! Gebäude sind beschädigt.',
  },
  tornado: {
    name: 'Tornado',
    emoji: '🌪️',
    accent: 'text-slate-300',
    particleColor: '#94a3b8',
    description: 'Ein Tornado fegt über die Stadt!',
  },
  flood: {
    name: 'Überschwemmung',
    emoji: '🌊',
    accent: 'text-blue-400',
    particleColor: '#3b82f6',
    description: 'Überschwemmung! Gebäude unter Wasser.',
  },
  meteor: {
    name: 'Meteoreinschlag',
    emoji: '☄️',
    accent: 'text-red-400',
    particleColor: '#ef4444',
    description: 'Ein Meteor ist eingeschlagen!',
  },
};

const DISASTER_CHANCE_PER_MIN = 0.5;
export const DISASTER_DURATION_MS = 5 * 60 * 1000;

function SeverityDots({ level, max = 3 }: { level: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < level ? 'bg-current' : 'bg-white/10'}`} />
      ))}
    </div>
  );
}

function TimeBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setPct(Math.max(0, 100 - (elapsed / durationMs) * 100));
    }, 250);
    return () => clearInterval(tick);
  }, [startedAt, durationMs]);

  const remainSec = Math.ceil(((pct / 100) * durationMs) / 1000);
  const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-slate-400 font-mono w-7 text-right shrink-0">{remainSec}s</span>
    </div>
  );
}

// ─── Dispatch services per disaster type ───

type DispatchOption = {
  type: 'fire_truck' | 'police_car' | 'ambulance';
  label: string;
  icon: typeof Flame;
  bgClass: string;
  borderClass: string;
  textClass: string;
  hoverBgClass: string;
  hoverTextClass: string;
};

const DISPATCH_FIRE: DispatchOption = { type: 'fire_truck', label: 'Feuerwehr', icon: Flame, bgClass: 'bg-orange-600/20', borderClass: 'border-orange-500/20', textClass: 'text-orange-300', hoverBgClass: 'hover:bg-orange-600/30', hoverTextClass: 'hover:text-orange-200' };
const DISPATCH_POLICE: DispatchOption = { type: 'police_car', label: 'Polizei', icon: Shield, bgClass: 'bg-blue-600/20', borderClass: 'border-blue-500/20', textClass: 'text-blue-300', hoverBgClass: 'hover:bg-blue-600/30', hoverTextClass: 'hover:text-blue-200' };
const DISPATCH_AMBULANCE: DispatchOption = { type: 'ambulance', label: 'Sanitäter', icon: Heart, bgClass: 'bg-rose-600/20', borderClass: 'border-rose-500/20', textClass: 'text-rose-300', hoverBgClass: 'hover:bg-rose-600/30', hoverTextClass: 'hover:text-rose-200' };

const DISASTER_DISPATCH: Record<DisasterType, DispatchOption[]> = {
  fire: [DISPATCH_FIRE, DISPATCH_AMBULANCE],
  earthquake: [DISPATCH_FIRE, DISPATCH_POLICE, DISPATCH_AMBULANCE],
  tornado: [DISPATCH_POLICE, DISPATCH_AMBULANCE],
  flood: [DISPATCH_FIRE, DISPATCH_AMBULANCE],
  meteor: [DISPATCH_FIRE, DISPATCH_POLICE, DISPATCH_AMBULANCE],
};

// ─── Popup component shown when a disaster marker is clicked ───

interface DisasterPopupProps {
  disaster: ActiveDisaster;
  screenX: number;
  screenY: number;
  onClose: () => void;
  onRepair: (id: string) => void;
  onDispatch: (type: 'fire_truck' | 'police_car' | 'ambulance', targetX: number, targetY: number) => void;
}

function DisasterPopup({ disaster, screenX, screenY, onClose, onRepair, onDispatch }: DisasterPopupProps) {
  const info = DISASTER_INFO[disaster.type];
  const dispatchOptions = DISASTER_DISPATCH[disaster.type];

  return (
    <div
      className="absolute z-[110] pointer-events-auto"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translate(-50%, -100%) translateY(-20px)',
      }}
    >
      <div className="relative bg-slate-900/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl shadow-black/50 w-[280px] overflow-hidden">
        <div className={`h-1 w-full ${
          disaster.type === 'fire' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
          disaster.type === 'earthquake' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
          disaster.type === 'tornado' ? 'bg-gradient-to-r from-slate-400 to-gray-500' :
          disaster.type === 'flood' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
          'bg-gradient-to-r from-red-500 to-rose-500'
        }`} />

        <div className="p-3.5">
          {/* Header */}
          <div className="flex items-start gap-2.5 mb-2.5">
            <span className="text-2xl leading-none mt-0.5">{info.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`font-bold text-sm ${info.accent}`}>{disaster.variantName}</span>
                <SeverityDots level={disaster.severity} />
              </div>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{disaster.variantDesc}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-0.5 -mt-0.5 -mr-0.5 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info */}
          <div className="flex items-center gap-3 mb-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />({disaster.x}, {disaster.y})</span>
            <span>Schaden: {disaster.damage}</span>
            <span className="text-amber-400 font-medium">{disaster.repairCost.toLocaleString()} CHF</span>
          </div>

          {/* Countdown */}
          <div className="mb-3">
            <TimeBar startedAt={disaster.startedAt} durationMs={DISASTER_DURATION_MS} />
          </div>

          {/* Aktionen */}
          {disaster.repairing ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs py-1">
              <Wrench className="w-3.5 h-3.5 animate-spin" />
              <span>Wird repariert...</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Dispatch buttons per event type */}
              <div className="flex gap-1.5">
                {dispatchOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => onDispatch(opt.type, disaster.x, disaster.y)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md ${opt.bgClass} ${opt.hoverBgClass} border ${opt.borderClass} ${opt.textClass} ${opt.hoverTextClass} text-[11px] font-medium transition-colors`}
                    >
                      <Icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {/* Repair + Close */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => onRepair(disaster.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-300 hover:text-emerald-200 text-[11px] font-medium transition-colors"
                >
                  <Wrench className="w-3 h-3" />
                  Reparieren
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Arrow pointing down */}
        <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 rotate-45 bg-slate-900/95 border-r border-b border-white/10" />
      </div>
    </div>
  );
}

// ─── Main overlay component ───

interface DisasterOverlayProps {
  onDispatch?: (type: 'fire_truck' | 'police_car' | 'ambulance', targetX: number, targetY: number) => void;
  viewport?: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null;
  selectedDisasterId?: string | null;
  onSelectDisaster?: (id: string | null) => void;
  disastersRef?: React.MutableRefObject<ActiveDisaster[]>;
}

export function DisasterOverlay({ onDispatch, viewport, selectedDisasterId, onSelectDisaster, disastersRef }: DisasterOverlayProps) {
  const { state } = useGame();
  const [disasters, setDisasters] = useState<ActiveDisaster[]>([]);

  // Keep the external ref in sync
  useEffect(() => {
    if (disastersRef) disastersRef.current = disasters;
  }, [disasters, disastersRef]);

  const spawnDisaster = useCallback(() => {
    if (Math.random() > DISASTER_CHANCE_PER_MIN) return;

    const types: DisasterType[] = ['fire', 'earthquake', 'tornado', 'flood', 'meteor'];
    const type = types[Math.floor(Math.random() * types.length)];
    const severity = Math.floor(Math.random() * 3) + 1;
    const gs = state.gridSize || 30;
    const margin = Math.floor(gs * 0.15);
    const x = margin + Math.floor(Math.random() * (gs - margin * 2));
    const y = margin + Math.floor(Math.random() * (gs - margin * 2));

    const variant = pickVariant(type);
    const disaster: ActiveDisaster = {
      id: `disaster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      x,
      y,
      severity,
      startedAt: Date.now(),
      damage: severity * Math.floor(Math.random() * 3 + 1),
      repairCost: severity * 500 + Math.floor(Math.random() * 1000),
      repairing: false,
      variantName: variant.name,
      variantDesc: variant.description,
    };

    setDisasters(prev => [...prev, disaster]);

    if (type === 'fire') {
      window.dispatchEvent(new CustomEvent('isocity-set-building-fire', { detail: { x, y } }));
    }
  }, [state.gridSize]);

  // Spawn initial preview disasters after a short delay so gridSize is loaded
  const didSpawnPreviewRef = useRef(false);
  useEffect(() => {
    if (didSpawnPreviewRef.current || !state.gridSize || state.gridSize < 5) return;
    didSpawnPreviewRef.current = true;
    const gs = state.gridSize;
    const center = Math.floor(gs / 2);
    const spread = Math.floor(gs * 0.2);
    const fireVariant = pickVariant('fire');
    const previews: ActiveDisaster[] = [
      {
        id: `preview_fire_${Date.now()}`,
        type: 'fire',
        x: Math.max(1, Math.min(gs - 2, center + Math.round(Math.cos(0) * spread * 0.4))),
        y: Math.max(1, Math.min(gs - 2, center + Math.round(Math.sin(0) * spread * 0.4))),
        severity: 2,
        startedAt: Date.now(),
        damage: 4,
        repairCost: 1500,
        repairing: false,
        variantName: fireVariant.name,
        variantDesc: fireVariant.description,
      },
    ];
    console.log('[DisasterOverlay] Spawning', previews.length, 'preview disasters at center', center, 'gridSize', gs);
    setDisasters(previews);
    window.dispatchEvent(new CustomEvent('isocity-set-building-fire', { detail: { x: previews[0].x, y: previews[0].y } }));
  }, [state.gridSize]);

  // Disabled auto-spawning for now — only the single preview fire event is active
  // useEffect(() => {
  //   const interval = setInterval(spawnDisaster, 20 * 1000);
  //   return () => clearInterval(interval);
  // }, [spawnDisaster]);

  useEffect(() => {
    const cleanup = setInterval(() => {
      setDisasters(prev => {
        const filtered = prev.filter(d => Date.now() - d.startedAt < DISASTER_DURATION_MS || d.repairing);
        if (filtered.length !== prev.length && onSelectDisaster) {
          const ids = new Set(filtered.map(d => d.id));
          if (selectedDisasterId && !ids.has(selectedDisasterId)) {
            onSelectDisaster(null);
          }
        }
        return filtered;
      });
    }, 5000);
    return () => clearInterval(cleanup);
  }, [selectedDisasterId, onSelectDisaster]);

  const handleRepair = useCallback((id: string) => {
    setDisasters(prev => prev.map(d => d.id === id ? { ...d, repairing: true } : d));
    if (onSelectDisaster) onSelectDisaster(null);
    setTimeout(() => {
      setDisasters(prev => prev.filter(d => d.id !== id));
    }, 3000);
  }, [onSelectDisaster]);

  const handleDispatch = useCallback((type: 'fire_truck' | 'police_car' | 'ambulance', targetX: number, targetY: number) => {
    if (onDispatch) onDispatch(type, targetX, targetY);
  }, [onDispatch]);

  // Find the selected disaster and compute its screen position
  const selectedDisaster = selectedDisasterId ? disasters.find(d => d.id === selectedDisasterId) : null;

  if (!selectedDisaster || !viewport) return null;

  const { screenX: tileScreenX, screenY: tileScreenY } = gridToScreen(selectedDisaster.x, selectedDisaster.y, 0, 0);
  const popupX = (tileScreenX + TILE_WIDTH / 2) * viewport.zoom + viewport.offset.x;
  const popupY = (tileScreenY) * viewport.zoom + viewport.offset.y;

  return (
    <div className="absolute inset-0 z-[105] pointer-events-none overflow-hidden">
      <DisasterPopup
        disaster={selectedDisaster}
        screenX={popupX}
        screenY={popupY}
        onClose={() => onSelectDisaster?.(null)}
        onRepair={handleRepair}
        onDispatch={handleDispatch}
      />
    </div>
  );
}
