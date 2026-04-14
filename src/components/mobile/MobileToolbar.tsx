'use client';

import React, { useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';
import { OverlayMode } from '@/components/game/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import {
  CloseIcon,
  RoadIcon,
  RailIcon,
  SubwayIcon,
  TreeIcon,
  PowerIcon,
  WaterIcon,
  ChartIcon,
  TrophyIcon,
  SettingsIcon,
  FireIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
} from '@/components/ui/Icons';
import { MessageCircle, Handshake, Users, LogOut } from 'lucide-react';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { AchievementCenter } from '@/components/ui/AchievementCenter';

// Tool category icons
const CategoryIcons: Record<string, React.ReactNode> = {
  'TOOLS': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  'ZONES': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  'ZONING': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l16 16M20 4L4 20" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  'SERVICES': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  ),
  'PARKS': <TreeIcon size={20} />,
  'SPORTS': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M6 12h12" />
    </svg>
  ),
  'WATERFRONT': <WaterIcon size={20} />,
  'COMMUNITY': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'UTILITIES': <PowerIcon size={20} />,
  'SPECIAL': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  'VERWALTUNG': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6M9 12h6M9 15h4" />
    </svg>
  ),
};

// Tool icons for quick access (Partial because not all tools need custom icons)
const QuickToolIcons: Partial<Record<Tool, React.ReactNode>> = {
  select: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l16 8-8 3-3 8z" />
    </svg>
  ),
  bulldoze: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M6 6v14a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  ),
  road: <RoadIcon size={20} />,
  autobahn: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l4 16M16 4l4 16M12 4v3M12 10v3M12 16v4" />
    </svg>
  ),
  rail: <RailIcon size={20} />,
  subway: <SubwayIcon size={20} />,
  tree: <TreeIcon size={20} />,
  zone_residential: (
    <div className="w-5 h-5 rounded-sm bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">R</div>
  ),
  zone_commercial: (
    <div className="w-5 h-5 rounded-sm bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">C</div>
  ),
  zone_industrial: (
    <div className="w-5 h-5 rounded-sm bg-amber-500 flex items-center justify-center text-[10px] font-bold text-white">I</div>
  ),
  zone_dezone: (
    <div className="w-5 h-5 rounded-sm bg-gray-500 flex items-center justify-center text-[10px] font-bold text-white">X</div>
  ),
  zone_water: (
    <div className="w-5 h-5 rounded-sm bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">~</div>
  ),
  zone_land: (
    <div className="w-5 h-5 rounded-sm bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">▲</div>
  ),
  police_station: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4z" />
    </svg>
  ),
  fire_station: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-1.5 4-1.5 6 0 8 1.5-2 1.5-4 0-8zM8 10c-2 4-2 6 0 10 2-4 2-6 0-10zM16 10c-2 4-2 6 0 10 2-4 2-6 0-10z" />
    </svg>
  ),
  hospital: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  school: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  university: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M5 20V8l7-4 7 4v12" />
      <path d="M9 20v-4h6v4" />
    </svg>
  ),
  park: <TreeIcon size={20} />,
  park_large: <TreeIcon size={20} />,
  tennis: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.5 4.5c5 5 10 5 15 0" />
      <path d="M4.5 19.5c5-5 10-5 15 0" />
    </svg>
  ),
  power_plant: <PowerIcon size={20} />,
  water_tower: <WaterIcon size={20} />,
  subway_station: <SubwayIcon size={20} />,
  stadium: <TrophyIcon size={20} />,
  museum: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M4 20v-6h4v6" />
      <path d="M10 20v-6h4v6" />
      <path d="M16 20v-6h4v6" />
      <path d="M2 14h20" />
      <path d="M12 3l10 7H2l10-7z" />
    </svg>
  ),
  airport: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  ),
  space_program: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L4 5v6.5c0 6 5.5 10.5 8 11.5 2.5-1 8-5.5 8-11.5V5l-8-3z" />
    </svg>
  ),
  city_hall: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M4 20v-8l8-8 8 8v8" />
      <rect x="9" y="14" width="6" height="6" />
    </svg>
  ),
  amusement_park: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

// Category labels for translation
const CATEGORY_LABELS: Record<string, unknown> = {
  'TOOLS': msg('Tools'),
  'ZONES': msg('Zones'),
  'EXPAND_CITY': msg('Expand City'),
  'ZONING': msg('Zoning'),
  'TERRAIN': msg('Terrain'),
  'FARBE': msg('Farbe'),
  'UTILITIES': msg('Utilities'),
  'SERVICES': msg('Services'),
  'PARKS': msg('Parks'),
  'SPORTS': msg('Sports'),
  'WATERFRONT': msg('Waterfront'),
  'COMMUNITY': msg('Community'),
  'SPECIAL': msg('Special'),
  'VERWALTUNG': msg('Verwaltung'),
};

// UI labels for translation
const UI_LABELS = {
  viewOverlays: msg('View Overlays'),
  none: msg('None'),
  power: msg('Power'),
  water: msg('Water'),
  fire: msg('Fire'),
  police: msg('Police'),
  health: msg('Health'),
  education: msg('Education'),
  subway: msg('Subway'),
  statistics: msg('Statistics'),
  settings: msg('Settings'),
  trade: msg('Trade'),
  chat: msg('Chat'),
  user: msg('User'),
};

const toolCategories = {
  'TOOLS': ['select', 'bulldoze', 'road', 'autobahn', 'rail', 'subway', 'bus_stop', 'parking_spot', 'parking_lot', 'parking_lot_large'] as Tool[],
  'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial'] as Tool[],
  'ZONING': ['zone_dezone'] as Tool[],
  'TERRAIN': ['terrain_raise', 'terrain_lower', 'terrain_lower2', 'terrain_hill', 'terrain_mountain', 'terrain_flatten', 'zone_water', 'zone_land'] as Tool[],
  'FARBE': ['paint_green', 'paint_sand', 'paint_dirt', 'paint_snow', 'paint_dark_grass', 'paint_rock', 'paint_reset'] as Tool[],
  'ENERGIE': ['solar_panel', 'wind_turbine', 'power_plant'] as Tool[],
  'UTILITIES': ['water_tower', 'subway_station', 'rail_station', 'bus_station', 'bus_stop'] as Tool[],
  'SERVICES': ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[],
  'PARKS': ['tree_oak', 'tree_maple', 'tree_birch', 'tree_willow', 'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar', 'tree_palm', 'tree_bamboo', 'tree_coconut', 'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria', 'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral', 'flower_bed', 'flower_planter', 'park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[],
  'SPORTS': ['tennis', 'basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[],
  'WATERFRONT': ['marina_docks_small', 'pier_large'] as Tool[],
  'COMMUNITY': ['community_center', 'animal_pens_farm', 'office_building_small', 'woodcutter_house'] as Tool[],
  'SPECIAL': ['stadium', 'fcbasel_stadium', 'st_ursen_kathedrale', 'disco_solothurn', 'primetower', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[],
  'VERWALTUNG': ['bauzone', 'bauzone_remove'] as Tool[],
};

interface MobileToolbarProps {
  onOpenPanel: (panel: 'statistics' | 'settings' | 'trade' | 'chat' | 'firma' | 'gemeinde' | 'leaderboard' | 'marketplace' | 'user') => void;
  overlayMode?: OverlayMode;
  setOverlayMode?: (mode: OverlayMode) => void;
  chatUnreadCount?: number;
  isOwner?: boolean;
  isViewOnly?: boolean;
  onShare?: () => void;
  onExit?: () => void;
}

export function MobileToolbar({ onOpenPanel, overlayMode = 'none', setOverlayMode, chatUnreadCount = 0, isOwner = true, isViewOnly = false, onShare, onExit }: MobileToolbarProps) {
  const { state, setTool, setTaxRate, expandCity, hasTransportCompany, hasBusStation, addNotification } = useGame();
  const { selectedTool, stats } = state;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [expandCityExpanded, setExpandCityExpanded] = useState(false);
  const m = useMessages();

  const handleCategoryClick = (category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };

  const handleToolSelect = (tool: Tool, closeMenu: boolean = false) => {
    if (tool === 'bus_stop' && !hasBusStation) {
      addNotification('Kein Busbahnhof', 'Baue zuerst einen Busbahnhof (3.000 CHF) bevor du Haltestellen platzierst!', '🚏');
      return;
    }
    // If the tool is already selected and it's not 'select', toggle back to select
    if (selectedTool === tool && tool !== 'select') {
      setTool('select');
    } else {
      setTool(tool);
    }
    setExpandedCategory(null);
    if (closeMenu) {
      setShowMenu(false);
    }
  };

  return (
    <>
      {/* Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <Card className="rounded-none border-x-0 border-b-0 bg-card/95 backdrop-blur-sm" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
          {/* Selected tool info - now above the toolbar */}
          {selectedTool && TOOL_INFO[selectedTool] && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-sidebar-border/50 bg-secondary/30 text-xs">
              <span className="text-foreground font-medium">
                {m(TOOL_INFO[selectedTool].name)}
              </span>
              {TOOL_INFO[selectedTool].cost > 0 && (
                <span className={`font-mono ${stats.money >= TOOL_INFO[selectedTool].cost ? 'text-green-400' : 'text-red-400'}`}>
                  ${TOOL_INFO[selectedTool].cost}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-center px-4 py-2 gap-3">
            {/* Quick access tools - only essentials */}
            <Button
              variant={selectedTool === 'select' ? 'default' : 'ghost'}
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={() => handleToolSelect('select')}
            >
              {QuickToolIcons.select}
            </Button>

            <Button
              variant={selectedTool === 'bulldoze' ? 'default' : 'ghost'}
              size="icon"
              className="h-12 w-12 shrink-0 text-red-400"
              onClick={() => handleToolSelect('bulldoze')}
            >
              {QuickToolIcons.bulldoze}
            </Button>

            <Button
              variant={selectedTool === 'road' ? 'default' : 'ghost'}
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={() => handleToolSelect('road')}
            >
              {QuickToolIcons.road}
            </Button>

            <Button
              variant={selectedTool === 'rail' ? 'default' : 'ghost'}
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={() => handleToolSelect('rail')}
            >
              {QuickToolIcons.rail}
            </Button>

            {/* More tools menu button */}
            <Button
              variant={showMenu ? 'default' : 'secondary'}
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={() => setShowMenu(!showMenu)}
            >
              {showMenu ? (
                <CloseIcon size={22} />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Expanded Tool Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
          <Card
            className="absolute left-2 right-2 max-h-[70vh] overflow-hidden rounded-xl flex flex-col"
            style={{ bottom: 'calc(60px + max(env(safe-area-inset-bottom, 0px), 8px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* City Management section at top */}
            <div className="p-2.5 border-b border-border flex-shrink-0">
              {/* Primary panels - 2x2 grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <Button variant="ghost" size="sm" className="h-11 w-full text-[11px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('statistics'); setShowMenu(false); }}>
                  <ChartIcon size={18} />
                  {m(UI_LABELS.statistics)}
                </Button>
                <Button variant="ghost" size="sm" className="h-11 w-full text-[11px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('trade'); setShowMenu(false); }}>
                  <Handshake className="w-4.5 h-4.5" />
                  {m(UI_LABELS.trade)}
                </Button>
                <Button variant="ghost" size="sm" className="relative h-11 w-full text-[11px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('chat'); setShowMenu(false); }}>
                  <MessageCircle className="w-4.5 h-4.5" />
                  {m(UI_LABELS.chat)}
                  {chatUnreadCount > 0 && (
                    <span className="absolute top-0 right-1 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="h-11 w-full text-[11px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('user'); setShowMenu(false); }}>
                  <Users className="w-4.5 h-4.5" />
                  {m(UI_LABELS.user)}
                </Button>
              </div>

              {/* Secondary panels - scrollable row */}
              <div className="grid grid-cols-5 gap-1 mt-1.5">
                <Button variant="ghost" size="sm" className="h-10 w-full text-[10px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('settings'); setShowMenu(false); }}>
                  <SettingsIcon size={15} />
                  {m(UI_LABELS.settings)}
                </Button>
                <Button variant="ghost" size="sm" className="h-10 w-full text-[10px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('firma'); setShowMenu(false); }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>
                  Firma
                </Button>
                <Button variant="ghost" size="sm" className="h-10 w-full text-[10px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('gemeinde'); setShowMenu(false); }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h20" /><path d="M4 20v-8l8-8 8 8v8" /><rect x="9" y="14" width="6" height="6" /></svg>
                  Gemeinde
                </Button>
                <Button variant="ghost" size="sm" className="h-10 w-full text-[10px] flex flex-col items-center gap-0.5 p-1"
                  onClick={() => { onOpenPanel('leaderboard'); setShowMenu(false); }}>
                  <TrophyIcon size={15} />
                  Rangliste
                </Button>
                <LanguageSelector useDrawer iconSize={15} />
              </div>

              {/* Tax & Income row */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground shrink-0">Steuern</span>
                {isViewOnly ? (
                  <span className="text-xs text-amber-500 flex items-center gap-1 shrink-0">{state.taxRate}%</span>
                ) : (
                  <>
                    <Slider value={[state.taxRate]} onValueChange={(value) => setTaxRate(value[0])} min={0} max={100} step={1} className="flex-1 min-w-0" />
                    <span className="text-[11px] font-mono text-foreground w-8 text-right shrink-0">{state.taxRate}%</span>
                  </>
                )}
                <div className="w-px h-4 bg-border/50 shrink-0" />
                <span className={`text-[11px] font-mono shrink-0 ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.income - stats.expenses >= 0 ? '+' : ''}${(stats.income - stats.expenses).toLocaleString()}/mo
                </span>
                {onShare && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                    onClick={() => { onShare(); setShowMenu(false); }}>
                    <Users className="w-3.5 h-3.5" />
                  </Button>
                )}
                {onExit && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => { onExit(); setShowMenu(false); }}>
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-2 space-y-1 pb-4">
                {/* Category buttons */}
                {Object.entries(toolCategories).map(([category, catTools]) => {
                  const tools = hasTransportCompany ? catTools : catTools.filter(t => t !== 'bus_stop');
                  if (tools.length === 0) return null;
                  return (
                  <div key={category}>
                    {/* Expand City section - appears before ZONING */}
                    {category === 'ZONING' && isOwner && (
                      <div className="mb-1">
                        <Button
                          variant={expandCityExpanded ? 'secondary' : 'ghost'}
                          className="w-full justify-start gap-3 h-12"
                          onClick={() => setExpandCityExpanded(!expandCityExpanded)}
                        >
                          <span className="flex-1 text-left font-medium">{m((CATEGORY_LABELS['EXPAND_CITY']) as Parameters<typeof m>[0])}</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandCityExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </Button>

                        {/* Expand City actions */}
                        {expandCityExpanded && (
                          <div className="pl-4 py-1 space-y-0.5">
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-3 h-11"
                              onClick={() => { expandCity(); setShowMenu(false); }}
                            >
                              <span className="flex-1 text-left">{m(TOOL_INFO['expand_city'].name)}</span>
                              <span className="text-xs font-mono text-green-400">
                                ${TOOL_INFO['expand_city'].cost}
                              </span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      variant={expandedCategory === category ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleCategoryClick(category)}
                    >
                      <span className="flex-1 text-left font-medium">{m((CATEGORY_LABELS[category] || category) as Parameters<typeof m>[0])}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </Button>

                    {/* Expanded tools */}
                    {expandedCategory === category && (
                      <div className="pl-4 py-1 space-y-0.5">
                        {tools.map((tool) => {
                          const info = TOOL_INFO[tool];
                          if (!info) return null;
                          const canAfford = stats.money >= info.cost;

                          return (
                            <Button
                              key={tool}
                              variant={selectedTool === tool ? 'default' : 'ghost'}
                              className="w-full justify-start gap-3 h-11"
                              disabled={!canAfford && info.cost > 0}
                              onClick={() => handleToolSelect(tool, true)}
                            >
                              <span className="flex-1 text-left">{m(info.name)}</span>
                              {info.cost > 0 && (
                                <span className={`text-xs font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                                  ${info.cost}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ); })}

                {/* Overlay Toggle Section - at bottom, less prominent */}
                {setOverlayMode && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      {m(UI_LABELS.viewOverlays)}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <Button variant={overlayMode === 'none' ? 'default' : 'ghost'} size="sm" className="h-9 w-full text-xs" onClick={() => setOverlayMode('none')}>{m(UI_LABELS.none)}</Button>
                      <Button variant={overlayMode === 'power' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'power' ? 'bg-amber-500 hover:bg-amber-600' : ''}`} onClick={() => setOverlayMode('power')}>{m(UI_LABELS.power)}</Button>
                      <Button variant={overlayMode === 'water' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'water' ? 'bg-blue-500 hover:bg-blue-600' : ''}`} onClick={() => setOverlayMode('water')}>{m(UI_LABELS.water)}</Button>
                      <Button variant={overlayMode === 'fire' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'fire' ? 'bg-red-500 hover:bg-red-600' : ''}`} onClick={() => setOverlayMode('fire')}>{m(UI_LABELS.fire)}</Button>
                      <Button variant={overlayMode === 'police' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'police' ? 'bg-blue-600 hover:bg-blue-700' : ''}`} onClick={() => setOverlayMode('police')}>{m(UI_LABELS.police)}</Button>
                      <Button variant={overlayMode === 'health' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'health' ? 'bg-green-500 hover:bg-green-600' : ''}`} onClick={() => setOverlayMode('health')}>{m(UI_LABELS.health)}</Button>
                      <Button variant={overlayMode === 'education' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'education' ? 'bg-purple-500 hover:bg-purple-600' : ''}`} onClick={() => setOverlayMode('education')}>{m(UI_LABELS.education)}</Button>
                      <Button variant={overlayMode === 'subway' ? 'default' : 'ghost'} size="sm" className={`h-9 w-full text-xs ${overlayMode === 'subway' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`} onClick={() => setOverlayMode('subway')}>{m(UI_LABELS.subway)}</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default MobileToolbar;
