'use client';

import React from 'react';
import { msg } from 'gt-next';
import { useMessages } from 'gt-next';
import { ChevronDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CloseIcon,
  PowerIcon,
  WaterIcon,
  FireIcon,
  SafetyIcon,
  HealthIcon,
  EducationIcon,
  SubwayIcon,
  PollutionIcon,
  TreeIcon,
  HouseIcon,
  ParkIcon,
} from '@/components/ui/Icons';
import { OverlayMode } from './types';
import { OVERLAY_CONFIG, getOverlayButtonClass } from './overlays';

// ============================================================================
// Types
// ============================================================================

export interface OverlayModeToggleProps {
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

/** Map overlay modes to their icons */
const OVERLAY_ICONS: Record<OverlayMode, React.ReactNode> = {
  none: <CloseIcon size={14} />,
  power: <PowerIcon size={14} />,
  water: <WaterIcon size={14} />,
  fire: <FireIcon size={14} />,
  police: <SafetyIcon size={14} />,
  health: <HealthIcon size={14} />,
  education: <EducationIcon size={14} />,
  subway: <SubwayIcon size={14} />,
  pollution: <PollutionIcon size={14} />,
  trees: <TreeIcon size={14} />,
  houses: <HouseIcon size={14} />,
  parks: <ParkIcon size={14} />,
};

// ============================================================================
// Translatable Labels
// ============================================================================

const VIEW_OVERLAY_LABEL = msg('View Overlay');

// ============================================================================
// Component
// ============================================================================

/**
 * Overlay mode toggle component.
 * Allows users to switch between different visualization overlays
 * (power grid, water system, service coverage, etc.)
 */
export const OverlayModeToggle = React.memo(function OverlayModeToggle({
  overlayMode,
  setOverlayMode,
}: OverlayModeToggleProps) {
  const m = useMessages();
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isExpanded) {
    return (
      <Card className="fixed bottom-4 left-60 p-1 shadow-xl bg-card/85 backdrop-blur-md border-border/70 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="h-7 w-7 p-0"
          title={m(msg('Overlay einblenden'))}
        >
          <Layers size={14} />
        </Button>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 left-60 p-1.5 shadow-xl bg-card/85 backdrop-blur-md border-border/70 z-20">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
          {m(VIEW_OVERLAY_LABEL)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="h-5 w-5 p-0"
          title={m(msg('Overlay ausblenden'))}
        >
          <ChevronDown size={12} />
        </Button>
      </div>
      {/* Infrastruktur-Overlays */}
      <div className="flex gap-0.5">
        {(['none', 'power', 'water', 'fire', 'police', 'health', 'education', 'subway'] as OverlayMode[]).map((mode) => {
          const config = OVERLAY_CONFIG[mode];
          const isActive = overlayMode === mode;
          return (
            <Button
              key={mode}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setOverlayMode(mode);
                setIsExpanded(false);
              }}
              className={`h-7 px-2 ${getOverlayButtonClass(mode, isActive)}`}
              title={config.title}
            >
              {OVERLAY_ICONS[mode]}
            </Button>
          );
        })}
      </div>
      {/* Umwelt & Gebäude-Overlays */}
      <div className="flex gap-0.5 mt-0.5">
        {(['pollution', 'trees', 'houses', 'parks'] as OverlayMode[]).map((mode) => {
          const config = OVERLAY_CONFIG[mode];
          const isActive = overlayMode === mode;
          return (
            <Button
              key={mode}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setOverlayMode(mode);
                setIsExpanded(false);
              }}
              className={`h-7 px-2 ${getOverlayButtonClass(mode, isActive)}`}
              title={config.title}
            >
              <span className="flex items-center gap-1">
                {OVERLAY_ICONS[mode]}
                <span className="text-[9px]">{config.label}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
});
