'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tile } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  PopulationIcon,
  MoneyIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
  CloseIcon,
  PowerIcon,
  WaterIcon,
} from '@/components/ui/Icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRealTime } from '@/hooks/useRealTime';
import { NoticeCenter } from '@/components/ui/NoticeCenter';
import { AchievementCenter } from '@/components/ui/AchievementCenter';

// Translatable UI labels
const UI_LABELS = {
  pop: msg('Pop'),
  funds: msg('Funds'),
  tax: msg('Tax'),
  taxRate: msg('Tax Rate'),
  emptyLot: msg('Empty Lot'),
  jobsLower: msg('jobs'),
  jobs: msg('Jobs'),
  hasPower: msg('Has power'),
  noPower: msg('No power'),
  hasWater: msg('Has water'),
  noWater: msg('No water'),
  happiness: msg('Happiness'),
  health: msg('Health'),
  education: msg('Education'),
  safety: msg('Safety'),
  environment: msg('Environ'),
  population: msg('Population'),
  monthlyIncome: msg('Monthly Income'),
  monthlyExpenses: msg('Monthly Expenses'),
  weeklyNet: msg('Weekly Net'),
  exitToMainMenu: msg('Exit to Main Menu'),
  exitDialogTitle: msg('Exit to Main Menu'),
  exitDialogDescription: msg('Would you like to save your city before exiting?'),
  exitWithoutSaving: msg('Exit Without Saving'),
  saveAndExit: msg('Save & Exit'),
  zone: msg('Zone'),
};

// Sun/Moon icon for time of day
function TimeOfDayIcon({ hour }: { hour: number }) {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;

  if (isNight) {
    return (
      <svg className="w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    return (
      <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  } else {
    return (
      <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  }
}

function DemandBar({ label, demand, color }: { label: string; demand: number; color: string }) {
  const percentage = Math.min(100, Math.abs(demand));
  const isPositive = demand >= 0;

  return (
    <div className="flex items-center gap-1">
      <span className={`text-[9px] font-bold ${color} w-2`}>{label}</span>
      <div className="w-8 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? color.replace('text-', 'bg-') : 'bg-red-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function MobileTopBar({ 
  selectedTile, 
  services, 
  onCloseTile,
  onShare,
  onExit,
  isViewOnly = false,
  cityNameOverride,
  serverWeather,
}: { 
  selectedTile: Tile | null;
  services: { police: number[][]; fire: number[][]; health: number[][]; education: number[][]; power: boolean[][]; water: boolean[][] };
  onCloseTile: () => void;
  onShare?: () => void;
  onExit?: () => void;
  isViewOnly?: boolean;
  cityNameOverride?: string;
  serverWeather?: { type: string; intensity: number; temperature?: number; windspeed?: number; isDay?: boolean } | null;
}) {
  const { state, setTaxRate } = useGame();
  const { stats, taxRate, cityName } = state;
  const displayCityName = cityNameOverride && cityNameOverride.trim().length > 0 ? cityNameOverride : cityName;
  const [showDetails, setShowDetails] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const m = useMessages();
  const router = useRouter();
  
  // Echte Systemzeit
  const realTime = useRealTime();
  
  const displayHour = realTime.hour;
  const displayMinute = realTime.minute;
  const displayMonth = realTime.month;
  const displayYear = realTime.year;
  const displayDay = realTime.day;

  // Exit: Zur Hauptseite weiterleiten
  const handleExit = useCallback(() => {
    setShowExitDialog(false);
    router.push('/');
  }, [router]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <>
      {/* Main Top Bar */}
      <Card className="fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 bg-card/95 backdrop-blur-sm safe-area-top">
        <div className="flex items-center justify-between px-2 py-1.5 gap-1.5">
          {/* Left: City name, date, Pop/Funds stats */}
          <button
            className="flex items-center gap-2 min-w-0 flex-1 active:opacity-70 p-0 m-0 overflow-hidden"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex flex-col items-start min-w-0 shrink-0" style={{ maxWidth: '25vw' }}>
              <span className="text-foreground font-semibold text-[11px] truncate w-full">
                {displayCityName}
              </span>
              <span className="text-muted-foreground text-[9px] font-mono whitespace-nowrap">
                {displayDay}.{displayMonth}.
              </span>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[11px] font-mono font-semibold text-foreground whitespace-nowrap">
                <PopulationIcon size={10} className="inline mr-0.5 text-muted-foreground" />
                {stats.population >= 1000 ? `${(stats.population / 1000).toFixed(1)}k` : stats.population}
              </span>
              <span className={`text-[11px] font-mono font-semibold whitespace-nowrap ${stats.money < 0 ? 'text-red-500' : stats.money < 1000 ? 'text-amber-500' : 'text-green-500'}`}>
                {stats.money >= 1000000 ? `${(stats.money / 1000000).toFixed(1)}M` : stats.money >= 1000 ? `${(stats.money / 1000).toFixed(0)}k` : `${stats.money}`} Fr.
              </span>
            </div>
          </button>

          {/* Right: Time, Weather, Notifications, Achievements */}
          <div className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1 rounded-sm px-1.5 h-6 ${
              displayHour >= 6 && displayHour < 21 
                ? 'bg-amber-500/20 border border-amber-500/30' 
              : 'bg-slate-700/40 border border-slate-500/30'
            }`}>
              <span className={`text-[10px] font-medium ${
                displayHour >= 6 && displayHour < 21 ? 'text-amber-400' : 'text-slate-300'
              }`}>
                {String(displayHour).padStart(2, '0')}:{String(displayMinute).padStart(2, '0')}
              </span>
            </div>
            {serverWeather && (
              <div className="flex items-center gap-1 rounded-sm px-1.5 h-6 bg-sky-500/15 border border-sky-400/25">
                <span className="text-[10px]">{
                  serverWeather.type === 'rain' ? '🌧️' :
                  serverWeather.type === 'drizzle' ? '🌦️' :
                  serverWeather.type === 'snow' ? '❄️' :
                  serverWeather.type === 'blizzard' ? '🌨️' :
                  serverWeather.type === 'storm' ? '⛈️' :
                  serverWeather.type === 'thunderstorm' ? '⚡' :
                  serverWeather.type === 'fog' ? '🌫️' :
                  serverWeather.isDay ? '☀️' : '🌙'
                }</span>
                <span className="text-[10px] font-medium text-sky-300">{serverWeather.temperature?.toFixed(1) ?? '?'}°</span>
              </div>
            )}
            <NoticeCenter className="scale-90" />
            <AchievementCenter className="scale-90" />
          </div>
        </div>

        {/* Steuer & Einnahmen — ins MobileToolbar-Menü (City Management) verschoben */}

        {/* Tile Info Row - Mobile Only - horizontally scrollable */}
        {selectedTile && (
          <div className="border-t border-sidebar-border/50 bg-gradient-to-b from-secondary/60 to-secondary/20 px-2 py-1 flex items-center gap-2 text-[10px] overflow-x-auto scrollbar-none">
            {/* Name */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-2 h-2 rounded-full ${
                selectedTile.zone === 'residential' ? 'bg-green-500' :
                selectedTile.zone === 'commercial' ? 'bg-amber-500' :
                selectedTile.zone === 'industrial' ? 'bg-amber-500' : 'bg-muted-foreground/40'
              }`} />
              <span className="text-[11px] font-medium text-foreground capitalize whitespace-nowrap">
                {selectedTile.building.type === 'empty'
                  ? (selectedTile.zone === 'none' ? m(UI_LABELS.emptyLot) : `${selectedTile.zone} ${m(UI_LABELS.zone)}`)
                  : selectedTile.building.type.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="w-px h-3 bg-border/40 shrink-0" />

            {/* Population & Jobs */}
            {selectedTile.building.population > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <PopulationIcon size={10} className="text-muted-foreground" />
                <span className="text-foreground font-mono">{selectedTile.building.population}</span>
              </div>
            )}
            {selectedTile.building.jobs > 0 && (
              <span className="text-foreground font-mono shrink-0">{selectedTile.building.jobs} {m(UI_LABELS.jobsLower)}</span>
            )}

            {/* Utilities - compact icons */}
            <div className="flex items-center gap-1 shrink-0">
              <span className={selectedTile.building.powered ? 'text-yellow-400' : 'text-muted-foreground/40'} title={selectedTile.building.powered ? String(m(UI_LABELS.hasPower)) : String(m(UI_LABELS.noPower))}>
                <PowerIcon size={11} />
              </span>
              <span className={selectedTile.building.watered ? 'text-emerald-300' : 'text-muted-foreground/40'} title={selectedTile.building.watered ? String(m(UI_LABELS.hasWater)) : String(m(UI_LABELS.noWater))}>
                <WaterIcon size={11} />
              </span>
            </div>

            {/* Land value */}
            <div className="flex items-center gap-0.5 shrink-0">
              <MoneyIcon size={10} className="text-muted-foreground" />
              <span className="font-mono text-foreground">{selectedTile.landValue}</span>
            </div>

            {/* Pollution */}
            {selectedTile.pollution > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  selectedTile.pollution > 50 ? 'bg-red-500' :
                  selectedTile.pollution > 25 ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                <span className={`font-mono ${
                  selectedTile.pollution > 50 ? 'text-red-400' :
                  selectedTile.pollution > 25 ? 'text-amber-400' : 'text-green-400'
                }`}>{Math.round(selectedTile.pollution)}%</span>
              </div>
            )}

            {/* Spacer + Close */}
            <div className="flex-1 min-w-2" />
            <button
              onClick={onCloseTile}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}
      </Card>

      {/* Expanded Details Panel */}
      {showDetails && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm pt-[72px]"
          onClick={() => setShowDetails(false)}
        >
          <Card
            className="mx-2 mt-2 rounded-xl overflow-hidden max-h-[calc(100vh-120px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stats grid - 3+2 layout for better readability */}
            <div className="p-3 grid grid-cols-3 gap-2">
              <StatItem
                icon={<HappyIcon size={16} />}
                label={String(m(UI_LABELS.happiness))}
                value={stats.happiness}
                color={stats.happiness >= 70 ? 'text-green-500' : stats.happiness >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<HealthIcon size={16} />}
                label={String(m(UI_LABELS.health))}
                value={stats.health}
                color={stats.health >= 70 ? 'text-green-500' : stats.health >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<EducationIcon size={16} />}
                label={String(m(UI_LABELS.education))}
                value={stats.education}
                color={stats.education >= 70 ? 'text-green-500' : stats.education >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<SafetyIcon size={16} />}
                label={String(m(UI_LABELS.safety))}
                value={stats.safety}
                color={stats.safety >= 70 ? 'text-green-500' : stats.safety >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<EnvironmentIcon size={16} />}
                label={String(m(UI_LABELS.environment))}
                value={stats.environment}
                color={stats.environment >= 70 ? 'text-green-500' : stats.environment >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
            </div>

            <Separator />

            {/* Detailed finances - compact */}
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m(UI_LABELS.population)}</span>
                  <span className="text-xs font-mono text-foreground">{stats.population.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m(UI_LABELS.jobs)}</span>
                  <span className="text-xs font-mono text-foreground">{stats.jobs.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m(UI_LABELS.monthlyIncome)}</span>
                  <span className="text-xs font-mono text-green-400">${stats.income.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m(UI_LABELS.monthlyExpenses)}</span>
                  <span className="text-xs font-mono text-red-400">${stats.expenses.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
                <span className="text-xs font-medium text-muted-foreground">{m(UI_LABELS.weeklyNet)}</span>
                <span className={`text-sm font-mono font-semibold ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.floor((stats.income - stats.expenses) / 4).toLocaleString()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Tax slider */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{m(UI_LABELS.taxRate)}</span>
                <span className="text-sm font-mono font-semibold text-foreground">{taxRate}%</span>
                {isViewOnly && <span className="text-amber-500 text-xs">🔒</span>}
              </div>
              {isViewOnly ? (
                <div className="text-amber-500 text-xs text-center py-2">
                  Nur Besitzer oder Verwaltung können Steuern ändern
                </div>
              ) : (
                <>
                  <Slider
                    value={[taxRate]}
                    onValueChange={(value) => setTaxRate(value[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Exit confirmation dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-sm bg-slate-900/95 border-slate-700/70 text-white backdrop-blur-sm p-6 gap-0">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-lg font-display font-bold tracking-wide text-white">Spiel beenden?</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              Du wirst zum Hauptmenü weitergeleitet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowExitDialog(false)}
              className="text-slate-300 hover:text-white hover:bg-slate-700/60 border border-slate-700/50"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleExit}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold border-0"
            >
              Ja, beenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{Math.round(value)}%</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default MobileTopBar;
