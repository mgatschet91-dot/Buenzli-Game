'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
  ShareIcon,
  CheckIcon,
} from '@/components/ui/Icons';
import { copyShareUrl } from '@/lib/shareState';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useRealTime } from '@/hooks/useRealTime';
import { NoticeCenter } from '@/components/ui/NoticeCenter';
import { AchievementCenter } from '@/components/ui/AchievementCenter';

// UI labels (deutsch, da Spiel-Sprache Schweizerdeutsch/Deutsch ist)
const UI_LABELS = {
  population: 'Einwohner',
  jobs: 'Jobs',
  funds: 'Geld',
  monthly: 'Täglich',
  tax: 'Steuer',
  happiness: 'Zufriedenheit',
  health: 'Gesundheit',
  education: 'Bildung',
  safety: 'Sicherheit',
  environment: 'Umwelt',
  // Happiness breakdown
  happinessBreakdown: 'Zufriedenheit Aufschlüsselung',
  breakdownSafety:    'Sicherheit (×15%)',
  breakdownHealth:    'Gesundheit (×20%)',
  breakdownEducation: 'Bildung (×15%)',
  breakdownEnv:       'Umwelt (×15%)',
  breakdownWork:      'Arbeit (×20%)',
  breakdownTaxes:     'Steuern',
  breakdownWeather:   'Wetter',
  breakdownCrime:     'Kriminalität',
  breakdownUnemploy:  'Arbeitslosigkeit',
  unemployedLabel:    'Arbeitslose',
  // Seasons
  seasonWinter:  'Winter',
  seasonSpring:  'Frühling',
  seasonSummer:  'Sommer',
  seasonAutumn:  'Herbst',
  // Weather types
  weatherRain:        'Regen',
  weatherDrizzle:     'Nieselregen',
  weatherSnow:        'Schnee',
  weatherBlizzard:    'Blizzard',
  weatherStorm:       'Sturm',
  weatherThunderstorm: 'Gewitter',
  weatherFog:         'Nebel',
  weatherClear:       'Klar',
  // Misc
  liveIndicator: 'LIVE',
};

// ============================================================================
// TIME OF DAY ICON
// ============================================================================

interface TimeOfDayIconProps {
  hour: number;
}

export const TimeOfDayIcon = ({ hour }: TimeOfDayIconProps) => {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;
  
  if (isNight) {
    // Moon icon
    return (
      <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    // Sunrise/sunset icon
    return (
      <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  } else {
    // Sun icon
    return (
      <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  }
};

// ============================================================================
// STAT BADGE
// ============================================================================

// ============================================================================
// STAT BADGE
// ============================================================================

interface StatBadgeProps {
  value: string;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function StatBadge({ value, label, variant = 'default' }: StatBadgeProps) {
  const colorClass = variant === 'success' ? 'text-green-600 dark:text-green-400' :
                     variant === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                     variant === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200';

  return (
    <div className="flex flex-col items-start min-w-[70px]">
      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className={`text-sm font-mono tabular-nums font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

/**
 * Zeigt eine Zahl, die sich nur alle ~10-12 Sekunden (3-4 Server-Ticks) aktualisiert.
 * Kein Zählen, kein Springen — einfach ruhig und gelegentlich anders.
 */
function useThrottledNumber(value: number, intervalMs = 10000): number {
  const [displayed, setDisplayed] = useState(value);
  const pendingRef = useRef(value);
  const initializedRef = useRef(value > 0);

  // Neuesten Wert merken — beim ersten echten Wert sofort zeigen (kein Warten nach Reload)
  useEffect(() => {
    pendingRef.current = value;
    if (!initializedRef.current && value > 0) {
      initializedRef.current = true;
      setDisplayed(value);
    }
  }, [value]);

  // Alle intervalMs den angezeigten Wert auf den neuesten setzen
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayed(pendingRef.current);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return displayed;
}

function ThrottledStatBadge({
  rawValue,
  label,
  variant = 'default',
  format,
  intervalMs,
}: {
  rawValue: number;
  label: string;
  variant?: StatBadgeProps['variant'];
  format: (n: number) => string;
  intervalMs?: number;
}) {
  const throttled = useThrottledNumber(rawValue, intervalMs);
  return <StatBadge value={format(throttled)} label={label} variant={variant} />;
}

// ============================================================================
// DEMAND INDICATOR
// ============================================================================

interface DemandIndicatorProps {
  label: string;
  demand: number;
  color: string;
}

export function DemandIndicator({ label, demand, color }: DemandIndicatorProps) {
  const height = Math.abs(demand) / 2;
  const isPositive = demand >= 0;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold ${color}`}>{label}</span>
      <div className="w-3 h-8 bg-slate-100 dark:bg-slate-700 relative rounded-sm overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300 dark:bg-slate-600" />
        <div
          className={`absolute left-0 right-0 ${color.replace('text-', 'bg-')}`}
          style={{
            height: `${height}%`,
            top: isPositive ? `${50 - height}%` : '50%',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MINI STAT (for StatsPanel)
// ============================================================================

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

export function MiniStat({ icon, label, value }: MiniStatProps) {
  const color = value >= 70 ? 'text-green-600 dark:text-green-400' : value >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-mono ${color}`}>{Math.round(value)}%</span>
    </div>
  );
}

// ============================================================================
// STATS PANEL
// ============================================================================

function PenaltyRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={isPositive ? 'text-green-400' : 'text-red-400'}>{isPositive ? '+' : ''}{Math.round(value)}</span>
    </div>
  );
}

export const StatsPanel = React.memo(function StatsPanel() {
  const { state } = useGame();
  const { stats } = state;

  const unemploymentRate = Number(stats.unemployment_rate || 0);
  const unemploymentColor = unemploymentRate <= 5 ? 'text-green-600 dark:text-green-400' : unemploymentRate <= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  // Happiness Breakdown (Server-Werte, Fallback 0)
  const taxComp = Number((stats as any).happiness_tax_component ?? 0);
  const weatherPen = Number((stats as any).happiness_weather_penalty ?? 0);
  const crimePen = Number((stats as any).happiness_crime_penalty ?? 0);
  const unemployPen = Number((stats as any).happiness_unemployment_penalty ?? 0);

  return (
    <div className="h-8 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center gap-8 text-xs relative z-40">
      {/* Zufriedenheit mit Breakdown-Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <MiniStat icon={<HappyIcon size={12} />} label={UI_LABELS.happiness} value={stats.happiness} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-52">
          <div className="space-y-1 py-0.5">
            <div className="font-semibold text-xs mb-1 text-slate-200">{UI_LABELS.happinessBreakdown}</div>
            <PenaltyRow label={UI_LABELS.breakdownSafety} value={Math.round((stats.safety ?? 50) * 0.15)} />
            <PenaltyRow label={UI_LABELS.breakdownHealth} value={Math.round((stats.health ?? 50) * 0.20)} />
            <PenaltyRow label={UI_LABELS.breakdownEducation} value={Math.round((stats.education ?? 50) * 0.15)} />
            <PenaltyRow label={UI_LABELS.breakdownEnv} value={Math.round((stats.environment ?? 75) * 0.15)} />
            <PenaltyRow label={UI_LABELS.breakdownWork} value={Math.round((Number((stats as any).happiness_job_satisfaction ?? stats.happiness)) * 0.20)} />
            <div className="border-t border-slate-600 my-1" />
            <PenaltyRow label={UI_LABELS.breakdownTaxes} value={taxComp} />
            {weatherPen !== 0 && <PenaltyRow label={UI_LABELS.breakdownWeather} value={weatherPen} />}
            {crimePen !== 0 && <PenaltyRow label={UI_LABELS.breakdownCrime} value={crimePen} />}
            {unemployPen !== 0 && <PenaltyRow label={UI_LABELS.breakdownUnemploy} value={unemployPen} />}
          </div>
        </TooltipContent>
      </Tooltip>
      <MiniStat icon={<HealthIcon size={12} />} label={UI_LABELS.health} value={stats.health} />
      <MiniStat icon={<EducationIcon size={12} />} label={UI_LABELS.education} value={stats.education} />
      <MiniStat icon={<SafetyIcon size={12} />} label={UI_LABELS.safety} value={stats.safety} />
      <MiniStat icon={<EnvironmentIcon size={12} />} label={UI_LABELS.environment} value={stats.environment} />
      <div className="flex items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
        </span>
        <span className="text-slate-500 dark:text-slate-400">{UI_LABELS.unemployedLabel}</span>
        <span className={`font-mono ${unemploymentColor}`}>{unemploymentRate.toFixed(1)}%</span>
      </div>
    </div>
  );
});

// ============================================================================
// TOP BAR
// ============================================================================

interface TopBarProps {
  isViewOnly?: boolean;
  cityNameOverride?: string;
  serverWeather?: { type: string; intensity: number; temperature?: number; windspeed?: number; isDay?: boolean } | null;
}

export const TopBar = React.memo(function TopBar({ isViewOnly = false, cityNameOverride, serverWeather }: TopBarProps) {
  const { state, setTaxRate } = useGame();
  const { stats, taxRate, cityName } = state;
  const displayCityName = cityNameOverride && cityNameOverride.trim().length > 0 ? cityNameOverride : cityName;

  // Echte Systemzeit
  const realTime = useRealTime();

  const displayHour = realTime.hour;
  const displayMinute = realTime.minute;
  const displayMonth = realTime.month;
  const displayYear = realTime.year;
  const displayDay = realTime.day;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${String(displayDay).padStart(2, '0')}.${String(displayMonth).padStart(2, '0')}.${displayYear}`;

  // Jahreszeit aus dem Monat ableiten (Nordhalbkugel / Schweiz)
  const season = displayMonth === 12 || displayMonth <= 2 ? { label: UI_LABELS.seasonWinter, color: 'text-sky-300' }
    : displayMonth <= 5 ? { label: UI_LABELS.seasonSpring, color: 'text-green-400' }
    : displayMonth <= 8 ? { label: UI_LABELS.seasonSummer, color: 'text-yellow-400' }
    : { label: UI_LABELS.seasonAutumn, color: 'text-orange-400' };

  // Wetter: serverWeather (vom Echtzeit-Hook) hat Vorrang, Fallback auf State
  const weatherType = serverWeather?.type ?? (state as any).weatherType ?? 'clear';
  const weatherTemp = serverWeather?.temperature ?? (state as any).weatherTemperature ?? null;
  const weatherWind = serverWeather?.windspeed ?? null;
  const weatherLabel = weatherType === 'rain' ? UI_LABELS.weatherRain
    : weatherType === 'drizzle' ? UI_LABELS.weatherDrizzle
    : weatherType === 'snow' ? UI_LABELS.weatherSnow
    : weatherType === 'blizzard' ? UI_LABELS.weatherBlizzard
    : weatherType === 'storm' ? UI_LABELS.weatherStorm
    : weatherType === 'thunderstorm' ? UI_LABELS.weatherThunderstorm
    : weatherType === 'fog' ? UI_LABELS.weatherFog
    : UI_LABELS.weatherClear;
  const hasWeather = serverWeather != null || (state as any).weatherType != null;

  return (
    <div className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm relative z-40">
      <div className="flex items-center gap-8">
        <div className="py-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-slate-800 dark:text-white font-bold tracking-tight text-base">{displayCityName}</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-mono tabular-nums">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{monthNames[displayMonth - 1]} {displayYear}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formattedDate}</p>
              </TooltipContent>
            </Tooltip>
            {/* Jahreszeit-Indikator */}
            <span className={`${season.color}`}>· {season.label}</span>
            <TimeOfDayIcon hour={displayHour} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Wetter aus der Schweiz */}
          {hasWeather && (
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1 bg-sky-500/15 border border-sky-400/25">
              <span className="text-xs font-medium text-sky-300">{weatherLabel}</span>
              {weatherTemp != null && (
                <span className="text-xs text-slate-300">{Number(weatherTemp).toFixed(1)}°C</span>
              )}
              {weatherWind != null && (
                <span className="text-[10px] text-slate-400">{Number(weatherWind).toFixed(0)}km/h</span>
              )}
            </div>
          )}
          {/* LIVE Indikator */}
          <div className="flex items-center gap-1 rounded-lg px-1.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{UI_LABELS.liveIndicator}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <ThrottledStatBadge
          rawValue={stats.population}
          label={UI_LABELS.population}
          format={(n) => n.toLocaleString()}
          intervalMs={10000}
        />
        <ThrottledStatBadge
          rawValue={stats.jobs}
          label={UI_LABELS.jobs}
          format={(n) => n.toLocaleString()}
          intervalMs={11000}
        />
        <ThrottledStatBadge
          rawValue={stats.money}
          label={UI_LABELS.funds}
          variant={stats.money < 0 ? 'destructive' : stats.money < 1000 ? 'warning' : 'success'}
          format={(n) => `Fr. ${n.toLocaleString('de-CH')}`}
          intervalMs={9000}
        />
      </div>

      <div className="flex items-center gap-2">
        <ThrottledStatBadge
          rawValue={stats.income - stats.expenses}
          label={UI_LABELS.monthly}
          variant={stats.income - stats.expenses >= 0 ? 'success' : 'destructive'}
          format={(n) => `Fr. ${n.toLocaleString('de-CH')}`}
          intervalMs={12000}
        />
        
        <Separator orientation="vertical" className="h-8 bg-slate-200 dark:bg-slate-700" />
        
        {/* DemandIndicator (R/C/I) — deaktiviert, passt nicht ins aktuelle Spielkonzept
        <div className="flex items-center gap-1.5">
          <DemandIndicator label="R" demand={stats.demand?.residential ?? 0} color="text-green-500" />
          <DemandIndicator label="C" demand={stats.demand?.commercial ?? 0} color="text-amber-500" />
          <DemandIndicator label="I" demand={stats.demand?.industrial ?? 0} color="text-orange-400" />
        </div>
        <Separator orientation="vertical" className="h-8 bg-slate-200 dark:bg-slate-700" />
        */}
        
        <Separator orientation="vertical" className="h-8 bg-slate-200 dark:bg-slate-700" />
        
        <AchievementCenter />
        
        <NoticeCenter />
        
        <LanguageSelector iconOnly={false} variant="ghost" iconSize={14} />
      </div>
    </div>
  );
});
