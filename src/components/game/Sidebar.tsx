'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Tool, TOOL_INFO } from '@/types/game';
import { BuildingPreview } from '@/components/game/BuildingPreview';

// Translatable category labels
const CATEGORY_LABELS: Record<string, unknown> = {
  TOOLS: msg('Tools'),
  ZONES: msg('Zones'),
  tools: msg('Tools'),
  zones: msg('Zones'),
  zoning: msg('Zoning'),
  expandCity: msg('Expand City'),
  terrain: msg('Terrain'),
  painting: msg('Farbe'),
  services: msg('Services'),
  parks: msg('Parks'),
  sports: msg('Sports'),
  waterfront: msg('Waterfront'),
  community: msg('Community'),
  utilities: msg('Utilities'),
  energie: '⚡ Energie',
  special: msg('Special'),
  bauzone: msg('Bauzonen'),
  roads: msg('Strassen'),
};

// UI labels for translation
const UI_LABELS = {
  statistics: msg('Statistics'),
  settings: msg('Settings'),
  trade: msg('Trade'),
  navigator: msg('Community'),
  chat: msg('Chat'),
  debug: msg('Debug'),
  firma: msg('Firma'),
  gemeinde: msg('Gemeinde'),
  leaderboard: msg('Rangliste'),
  marketplace: msg('Marktplatz'),
  growth_debug: msg('Wachstums-Diagnose'),
};
import {
  ChartIcon,
  SettingsIcon,
} from '@/components/ui/Icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openCommandMenu } from '@/components/ui/CommandMenu';
// Debug Panel wird über setActivePanel('debug') geöffnet
import {
  Users,
  MousePointer2,
  Trash2,
  Route,
  Train,
  CircleDot,
  Home,
  Store,
  Factory,
  Grid3X3,
  Expand,
  Shield,
  Trees,
  Dumbbell,
  Waves,
  Building2,
  Zap,
  PlugZap,
  Sparkles,
  MapPin,
  Handshake,
  Bug,
  Tag,
  MessageCircle,
  Axe,
  Flower2,
  Siren,
  Skull,
  Glasses,
  Mountain,
  Paintbrush,
  ChevronLeft,
  ChevronRight,
  Search,
  Trophy,
  SquareDashedBottom,
  Mail,
  Loader2,
  Bus,
  TrendingUp,
} from 'lucide-react';
import { ShareModal } from '@/components/multiplayer/ShareModal';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import * as partnershipApi from '@/lib/api/partnershipApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function safeTranslate(
  m: ReturnType<typeof useMessages>,
  value: unknown
): string {
  try {
    return String(m(value as Parameters<typeof m>[0]));
  } catch {
    return String(value ?? '');
  }
}

// Hover Submenu Component for collapsible tool categories
// Implements triangle-rule safe zone for forgiving cursor navigation
const HoverSubmenu = React.memo(function HoverSubmenu({
  label,
  icon,
  tools,
  selectedTool,
  money,
  onSelectTool,
  forceOpenUpward = false,
  showPreviews = false,
  dataSubmenu,
}: {
  label: unknown; // Message object from msg() for translation
  icon?: React.ReactNode;
  tools: Tool[];
  selectedTool: Tool;
  money: number;
  onSelectTool: (tool: Tool) => void;
  forceOpenUpward?: boolean;
  showPreviews?: boolean;
  dataSubmenu?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const m = useMessages();

  const hasSelectedTool = tools.includes(selectedTool);
  const SUBMENU_GAP = 12; // Gap between sidebar and submenu
  const SUBMENU_MAX_HEIGHT = 220; // Approximate max height of submenu

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    // Calculate position based on button location
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if opening downward would overflow the screen
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = forceOpenUpward || (spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT);

      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout, forceOpenUpward]);

  // Triangle rule: Check if cursor is moving toward the submenu
  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;

    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;
    const lastY = lastMousePos.current.y;

    // Check if moving rightward (toward submenu)
    const movingRight = currentX > lastX;

    // Check if cursor is within vertical bounds of submenu (with generous padding)
    const padding = 50;
    const withinVerticalBounds =
      currentY >= submenuRect.top - padding &&
      currentY <= submenuRect.bottom + padding;

    return movingRight && withinVerticalBounds;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    // If moving toward submenu, use a longer delay
    const delay = isMovingTowardSubmenu(e) ? 300 : 100;

    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delay);
  }, [clearCloseTimeout, isMovingTowardSubmenu]);

  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [clearCloseTimeout]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Category Header Button */}
      <Button
        ref={buttonRef}
        {...(dataSubmenu ? { 'data-submenu': dataSubmenu } : {})}
        variant={hasSelectedTool ? 'default' : 'ghost'}
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm group transition-all duration-200 rounded-lg ${hasSelectedTool
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          } ${isOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span className={`${hasSelectedTool ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {icon}
          </span>
          <span className="font-medium">{safeTranslate(m, label)}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${hasSelectedTool ? 'text-emerald-100' : 'text-slate-400'} ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>

      {/* Invisible bridge/safe-zone between button and submenu for triangle rule */}
      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`, // Overlap slightly with submenu
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`, // Tall enough to cover path
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}

      {/* Flyout Submenu - uses fixed positioning to escape all parent containers */}
      {isOpen && (
        <div
          ref={submenuRef}
          className={`fixed ${showPreviews ? 'w-72' : 'w-56'} bg-slate-950/95 dark:bg-slate-900 border border-amber-300/25 rounded-xl shadow-xl overflow-hidden animate-submenu-in`}
          style={{
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            zIndex: 9999,
            ...(menuPosition.openUpward
              ? { bottom: `${window.innerHeight - menuPosition.top}px` }
              : { top: `${menuPosition.top}px` }),
            left: `${menuPosition.left}px`,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="px-3 py-2.5 border-b border-amber-300/20 bg-slate-900/80 dark:bg-slate-900">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">{safeTranslate(m, label)}</span>
          </div>
          <div className={`p-2 flex flex-col gap-1 ${showPreviews ? 'max-h-80' : 'max-h-56'} overflow-y-auto`}>
            {tools.map(tool => {
              const info = TOOL_INFO[tool];
              if (!info) return null;
              const isSelected = selectedTool === tool;
              const canAfford = money >= info.cost;

              return (
                <Button
                  key={tool}
                  onClick={() => onSelectTool(tool)}
                  disabled={!canAfford && info.cost > 0}
                  variant={isSelected ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-2 px-3 ${showPreviews ? 'py-1.5' : 'py-2.5'} h-auto text-sm transition-all duration-150 rounded-lg ${isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  title={`${safeTranslate(m, info.description)} - Kosten: Fr. ${info.cost.toLocaleString('de-CH')}`}
                >
                  {showPreviews && (
                    <BuildingPreview
                      buildingType={tool}
                      size={36}
                      className="rounded"
                    />
                  )}
                  <span className="flex-1 text-left truncate">{safeTranslate(m, info.name)}</span>
                  <span className={`text-xs tabular-nums ${isSelected ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>${info.cost.toLocaleString()}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Action Submenu Component for executing actions (like expand/shrink city)
const ActionSubmenu = React.memo(function ActionSubmenu({
  label,
  icon,
  actions,
  money,
}: {
  label: unknown;
  icon?: React.ReactNode;
  actions: { key: string; name: unknown; description: string; onClick: () => void; cost?: number }[];
  money: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const m = useMessages();

  const SUBMENU_GAP = 12;
  const SUBMENU_MAX_HEIGHT = 220;

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT;

      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout]);

  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;

    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;

    const movingRight = currentX > lastX;
    const padding = 50;
    const withinVerticalBounds =
      currentY >= submenuRect.top - padding &&
      currentY <= submenuRect.bottom + padding;

    return movingRight && withinVerticalBounds;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    const delay = isMovingTowardSubmenu(e) ? 300 : 100;
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delay);
  }, [clearCloseTimeout, isMovingTowardSubmenu]);

  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [clearCloseTimeout]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        className={`w-full justify-between gap-2 px-3 py-2.5 h-auto text-sm group transition-all duration-200 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${isOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          <span className="font-medium">{safeTranslate(m, label)}</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>

      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`,
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`,
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}

      {isOpen && (
        <div
          ref={submenuRef}
          className="fixed w-56 bg-slate-950/95 dark:bg-slate-900 border border-amber-300/25 rounded-xl shadow-xl overflow-hidden animate-submenu-in"
          style={{
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            zIndex: 9999,
            ...(menuPosition.openUpward
              ? { bottom: `${window.innerHeight - menuPosition.top}px` }
              : { top: `${menuPosition.top}px` }),
            left: `${menuPosition.left}px`,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="px-3 py-2.5 border-b border-amber-300/20 bg-slate-900/80 dark:bg-slate-900">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">{safeTranslate(m, label)}</span>
          </div>
          <div className="p-2 flex flex-col gap-1 max-h-56 overflow-y-auto">
            {actions.map(action => {
              const cost = action.cost ?? 0;
              const canAfford = money >= cost;
              return (
                <Button
                  key={action.key}
                  onClick={action.onClick}
                  disabled={cost > 0 && !canAfford}
                  variant="ghost"
                  className="w-full justify-start gap-2 px-3 py-2.5 h-auto text-sm transition-all duration-150 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title={action.description}
                >
                  <span className="flex-1 text-left truncate">{m(action.name as Parameters<typeof m>[0])}</span>
                  {cost > 0 && (
                    <span className={`text-xs tabular-nums ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                      ${cost.toLocaleString()}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Exit confirmation dialog component
function ExitDialog({
  open,
  onOpenChange,
  onExit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
            className="text-slate-300 hover:text-white hover:bg-slate-700/60 border border-slate-700/50"
          >
            Abbrechen
          </Button>
          <Button
            onClick={onExit}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold border-0"
          >
            Ja, beenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Memoized Sidebar Component
export interface SidebarProps {
  onExit?: () => void;
  isViewOnly?: boolean;        // Steuern/Budget gesperrt (für Mitglieder) - NICHT VERWENDET in Sidebar
  isFullyViewOnly?: boolean;   // Komplett gesperrt (für Nicht-Mitglieder)
  hideTradeAction?: boolean;   // Trade/Partnergemeinden ausblenden (z.B. Public Rooms)
  isOwner?: boolean;           // Ist der Benutzer der Eigentümer der Gemeinde
  canUseDebug?: boolean;       // Nur globaler Admin Rank 7 darf Debug sehen
  chatUnreadCount?: number;    // Anzahl ungelesener Chat-Nachrichten
  onToggleMessenger?: () => void;
  messengerUnreadCount?: number;
  showMessenger?: boolean;
  onVisitMunicipality?: (slug: string, roomCode?: string, roomName?: string) => void;
}

export const Sidebar: React.ComponentType<SidebarProps> = React.memo(function Sidebar({ onExit, isFullyViewOnly = false, hideTradeAction = false, isOwner = true, canUseDebug = false, chatUnreadCount = 0, onToggleMessenger, messengerUnreadCount = 0, showMessenger = false, onVisitMunicipality }: SidebarProps) {
  const { state, setTool, setActivePanel, expandCity, municipalityRole, municipalitySlug, hasTransportCompany, hasBusStation, addNotification } = useGame();
  const { selectedTool, stats, activePanel } = state;
  const handleSetTool = useCallback((tool: Tool) => {
    if (tool === 'bus_stop' && !hasBusStation) {
      addNotification('Kein Busbahnhof', 'Baue zuerst einen Busbahnhof (3.000 CHF) bevor du Haltestellen platzierst!', '🚏');
      return;
    }
    setTool(tool);
  }, [setTool, hasBusStation, addNotification]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const multiplayer = useMultiplayerOptional();
  const hasShownShareModalRef = useRef(false);
  const router = useRouter();

  // Auto-show share modal when first connecting as host (not guest)
  // Guests have initialState set (received from host), hosts don't
  useEffect(() => {
    const isHost = multiplayer?.connectionState === 'connected' && multiplayer?.roomCode && !multiplayer?.initialState;
    if (isHost && !hasShownShareModalRef.current) {
      hasShownShareModalRef.current = true;
      setShowShareModal(true);
    }
  }, [multiplayer?.connectionState, multiplayer?.roomCode, multiplayer?.initialState]);
  const m = useMessages();
  const bottomActionsScrollRef = useRef<HTMLDivElement>(null);
  const [bottomActionsDirection, setBottomActionsDirection] = useState<'left' | 'right'>('right');
  const [debugAllowedFromStorage, setDebugAllowedFromStorage] = useState(false);
  const [isInspectorLoading, setIsInspectorLoading] = useState(false);
  const isDev = process.env.NODE_ENV !== 'production';
  const effectiveCanUseAdmin = canUseDebug || debugAllowedFromStorage;
  const effectiveCanUseDebug = isDev && effectiveCanUseAdmin;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rank = Number(window.localStorage.getItem('isocity_user_rank') || 0);
    const globalRole = String(window.localStorage.getItem('isocity_global_role') || '').toLowerCase();
    setDebugAllowedFromStorage(Number.isFinite(rank) && rank >= 7 || globalRole === 'administrator');
  }, []);

  // Exit: Zur Hauptseite weiterleiten
  const handleExit = useCallback(() => {
    setShowExitDialog(false);
    if (onExit) {
      onExit();
      return;
    }
    router.push('/');
  }, [onExit, router]);

  // Tool icons mapping
  const toolIcons: Record<string, React.ReactNode> = {
    'select': <MousePointer2 className="w-4 h-4" />,
    'bulldoze': <Trash2 className="w-4 h-4" />,
    'label': <Tag className="w-4 h-4" />,
    'road': <Route className="w-4 h-4" />,
    'autobahn': <Route className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
    'parking_spot': <span className="text-[10px] font-bold leading-none">P</span>,
    'parking_lot': <span className="text-[10px] font-bold leading-none">PP</span>,
    'parking_lot_large': <span className="text-[10px] font-bold leading-none">PPP</span>,
    'rail': <Train className="w-4 h-4" />,
    'subway': <CircleDot className="w-4 h-4" />,
    'bus_stop': <Bus className="w-4 h-4" />,
    'bus_station': <Bus className="w-4 h-4 text-amber-400" />,
    'zone_residential': <Home className="w-4 h-4 text-green-400" />,
    'zone_commercial': <Store className="w-4 h-4 text-amber-400" />,
    'zone_industrial': <Factory className="w-4 h-4 text-yellow-400" />,
    'npc_woodcutter': <Axe className="w-4 h-4 text-amber-400" />,
    'npc_gardener': <Flower2 className="w-4 h-4 text-green-400" />,
    'npc_police_chase': <Siren className="w-4 h-4 text-amber-400" />,
    'npc_gangster': <Skull className="w-4 h-4 text-red-400" />,
    'npc_buenzli': <Glasses className="w-4 h-4 text-yellow-400" />,
    'inspect': <Search className="w-4 h-4 text-amber-400" />,
    'bauzone': <SquareDashedBottom className="w-4 h-4 text-cyan-400" />,
    'bauzone_remove': <Trash2 className="w-4 h-4 text-cyan-400" />,
    'solar_panel': <Zap className="w-4 h-4 text-yellow-400" />,
    'wind_turbine': <Zap className="w-4 h-4 text-sky-400" />,
    'power_plant': <Zap className="w-4 h-4 text-orange-400" />,
  };

  // Category icons mapping
  const categoryIcons: Record<string, React.ReactNode> = {
    'zoning': <Grid3X3 className="w-4 h-4" />,
    'expandCity': <Expand className="w-4 h-4" />,
    'terrain': <Mountain className="w-4 h-4" />,
    'painting': <Paintbrush className="w-4 h-4" />,
    'services': <Shield className="w-4 h-4" />,
    'parks': <Trees className="w-4 h-4" />,
    'sports': <Dumbbell className="w-4 h-4" />,
    'waterfront': <Waves className="w-4 h-4" />,
    'community': <Building2 className="w-4 h-4" />,
    'utilities': <PlugZap className="w-4 h-4" />,
    'energie': <Zap className="w-4 h-4 text-yellow-400" />,
    'special': <Sparkles className="w-4 h-4" />,
    'npc_testing': <Axe className="w-4 h-4" />,
    'bauzone': <SquareDashedBottom className="w-4 h-4 text-cyan-400" />,
    'roads': <Route className="w-4 h-4" />,
  };

  // Direct tool categories (shown inline)
  const directCategories = useMemo(() => {
    const tools: Tool[] = ['select', 'bulldoze', 'label', 'rail', 'subway', 'inspect'];
    // bus_stop only visible if player has a transport company
    if (hasTransportCompany) tools.splice(tools.indexOf('inspect'), 0, 'bus_stop');
    return {
      'TOOLS': tools,
      'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial'] as Tool[],
    };
  }, [hasTransportCompany]);

  const roadsSubmenu = useMemo(() => ({
    key: 'roads',
    label: CATEGORY_LABELS.roads,
    tools: ['road', 'autobahn', 'parking_spot', 'parking_lot', 'parking_lot_large'] as Tool[]
  }), []);

  // Zoning submenu (shown under ZONES section, before BUILDINGS)
  const zoningSubmenu = useMemo(() => ({
    key: 'zoning',
    label: CATEGORY_LABELS.zoning,
    tools: ['zone_dezone'] as Tool[]
  }), []);

  // Expand City submenu (shown under TOOLS section)
  const expandCityActions = useMemo(() => [
    {
      key: 'expand_city',
      name: TOOL_INFO['expand_city'].name,
      description: `Stadt um 15 Felder erweitern (Fr. ${TOOL_INFO['expand_city'].cost.toLocaleString('de-CH')})`,
      onClick: expandCity,
      cost: TOOL_INFO['expand_city'].cost,
    },
  ], [expandCity]);

  // Submenu categories (hover to expand) - includes all new assets from main
  const submenuCategories = useMemo((): { key: string; label: unknown; tools: Tool[]; showPreviews?: boolean; forceOpenUpward?: boolean; comingSoon?: boolean }[] => [
    {
      key: 'terrain',
      label: CATEGORY_LABELS.terrain,
      tools: ['terrain_raise', 'terrain_lower', 'terrain_lower2', 'terrain_hill', 'terrain_mountain', 'terrain_flatten', 'zone_water', 'zone_land'] as Tool[]
    },
    {
      key: 'painting',
      label: CATEGORY_LABELS.painting,
      tools: ['paint_green', 'paint_sand', 'paint_dirt', 'paint_snow', 'paint_dark_grass', 'paint_rock', 'paint_reset'] as Tool[]
    },
    {
      key: 'services',
      label: CATEGORY_LABELS.services,
      tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[]
    },
    {
      key: 'parks',
      label: CATEGORY_LABELS.parks,
      tools: ['tree', 'tree_oak', 'tree_maple', 'tree_birch', 'tree_willow', 'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar', 'tree_palm', 'tree_bamboo', 'tree_coconut', 'tree_cherry', 'tree_magnolia', 'tree_jacaranda', 'tree_wisteria', 'bush_hedge', 'bush_flowering', 'topiary_ball', 'topiary_spiral', 'flower_bed', 'flower_planter', 'park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[],
      showPreviews: true,
    },
    {
      key: 'sports',
      label: CATEGORY_LABELS.sports,
      tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[]
    },
    {
      key: 'waterfront',
      label: CATEGORY_LABELS.waterfront,
      tools: ['marina_docks_small', 'pier_large'] as Tool[]
    },
    {
      key: 'community',
      label: CATEGORY_LABELS.community,
      tools: ['community_center', 'animal_pens_farm', 'office_building_small', 'woodcutter_house', 'bank_house'] as Tool[]
    },
    {
      key: 'energie',
      label: CATEGORY_LABELS.energie,
      tools: ['solar_panel', 'wind_turbine', 'power_plant'] as Tool[],
      forceOpenUpward: true
    },
    {
      key: 'utilities',
      label: CATEGORY_LABELS.utilities,
      tools: (['water_tower', 'water_reservoir', 'subway_station', 'rail_station', 'bus_station'] as Tool[]).concat(hasTransportCompany ? ['bus_stop' as Tool] : []),
      forceOpenUpward: true
    },
    {
      key: 'special',
      label: CATEGORY_LABELS.special,
      tools: ['stadium', 'fcbasel_stadium', 'st_ursen_kathedrale', 'disco_solothurn', 'primetower', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[],
      forceOpenUpward: true
    },
    {
      key: 'bauzone',
      label: CATEGORY_LABELS.bauzone,
      tools: ['bauzone', 'bauzone_remove'] as Tool[],
      forceOpenUpward: true
    },
  ], [hasTransportCompany]);

  const bottomPanelActions = useMemo(() => [
    { panel: 'statistics' as const, icon: <ChartIcon size={18} />, labelKey: 'statistics' as const },
    ...(isDev ? [{ panel: 'growth_debug' as const, icon: <TrendingUp size={18} />, labelKey: 'growth_debug' as const }] : []),
    { panel: 'trade' as const, icon: <Handshake size={18} />, labelKey: 'trade' as const },
    { panel: 'firma' as const, icon: <Building2 size={18} />, labelKey: 'firma' as const },
    { panel: 'gemeinde' as const, icon: <Users size={18} />, labelKey: 'gemeinde' as const },
    { panel: 'leaderboard' as const, icon: <Trophy size={18} />, labelKey: 'leaderboard' as const },
    { panel: 'marketplace' as const, icon: <Store size={18} />, labelKey: 'marketplace' as const },
    { panel: 'chat' as const, icon: <MessageCircle size={18} />, labelKey: 'chat' as const },
  ].filter((entry) => {
    if (hideTradeAction && entry.panel === 'trade') return false;
    if (entry.panel === 'gemeinde' && !['owner', 'council'].includes(municipalityRole)) return false;
    return true;
  }), [hideTradeAction, municipalityRole]);

  const scrollBottomActions = useCallback((direction: 'left' | 'right') => {
    const container = bottomActionsScrollRef.current;
    if (!container) return;
    const amount = 120;
    container.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  const handleToggleBottomActions = useCallback(() => {
    scrollBottomActions(bottomActionsDirection);
    setBottomActionsDirection((prev) => (prev === 'right' ? 'left' : 'right'));
  }, [bottomActionsDirection, scrollBottomActions]);

  const handleVisitRandomMunicipality = useCallback(async () => {
    if (isInspectorLoading) return;
    setIsInspectorLoading(true);
    try {
      const response = await partnershipApi.searchMunicipalities('', 3000);
      const municipalities = (response.data?.municipalities || []).filter((entry) => {
        if (!entry?.slug) return false;
        if (municipalitySlug && entry.slug === municipalitySlug) return false;
        return true;
      });
      if (!municipalities.length) return;

      const target = municipalities[Math.floor(Math.random() * municipalities.length)];
      if (!target?.slug) return;

      setTool('inspect');
      await new Promise((resolve) => setTimeout(resolve, 700));

      if (onVisitMunicipality) {
        onVisitMunicipality(target.slug);
      } else {
        router.push(`/gemeinde/${target.slug}`);
      }
    } catch {
      // no-op: bewusst minimal ohne zusätzliches Panel
    } finally {
      setIsInspectorLoading(false);
    }
  }, [isInspectorLoading, municipalitySlug, onVisitMunicipality, router, setTool]);

  return (
    <div className="w-60 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col h-screen max-h-screen fixed left-0 top-0 z-50 shadow-lg overflow-hidden">
      {/* Header - Panel Icons + Actions */}
      <div className="flex-shrink-0 px-2 pt-2 pb-1.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {/* Panel Icons - wrapping grid */}
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {bottomPanelActions.map(({ panel, icon, labelKey }) => (
            <Button
              key={panel}
              data-panel={panel}
              onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
              variant={activePanel === panel ? 'default' : 'ghost'}
              size="icon-sm"
              className={`relative h-7 w-7 shrink-0 transition-all duration-150 rounded-md ${activePanel === panel
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white'
                }`}
              title={String(m(UI_LABELS[labelKey]))}
            >
              {React.cloneElement(icon as React.ReactElement<{ size: number }>, { size: 15 })}
              {panel === 'chat' && chatUnreadCount > 0 && activePanel !== 'chat' && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 text-[8px] font-bold text-white bg-red-500 rounded-full shadow-sm ring-1 ring-white dark:ring-slate-800">
                  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                </span>
              )}
            </Button>
          ))}

          {effectiveCanUseDebug && (
            <Button
              variant={activePanel === 'debug' ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={() => setActivePanel(activePanel === 'debug' ? 'none' : 'debug')}
              className={`h-7 w-7 shrink-0 rounded-md transition-all duration-150 ${activePanel === 'debug'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white'
                }`}
              title={String(m(UI_LABELS.debug))}
            >
              <Bug size={14} />
            </Button>
          )}

          {effectiveCanUseAdmin && (
            <Button
              variant={activePanel === 'admin' ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={() => setActivePanel(activePanel === 'admin' ? 'none' : 'admin')}
              className={`h-7 w-7 shrink-0 rounded-md transition-all duration-150 ${activePanel === 'admin'
                  ? 'bg-red-600 text-white shadow-md shadow-red-700/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white'
                }`}
              title="Admin"
            >
              <Shield size={14} />
            </Button>
          )}

          {onToggleMessenger && (
            <Button
              variant={showMessenger ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={onToggleMessenger}
              className={`relative h-7 w-7 shrink-0 rounded-md transition-all duration-150 ${showMessenger
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white'
                }`}
              title="Messenger"
            >
              <Mail size={14} />
              {messengerUnreadCount > 0 && !showMessenger && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 text-[8px] font-bold text-white bg-red-500 rounded-full shadow-sm ring-1 ring-white dark:ring-slate-800">
                  {messengerUnreadCount > 99 ? '99+' : messengerUnreadCount}
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Utility row: Search, Logout */}
        <div className="flex items-center gap-1 border-t border-slate-200 dark:border-slate-700 pt-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openCommandMenu}
            title="Search (⌘K)"
            className="h-7 w-7 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleVisitRandomMunicipality()}
            title="Bünzli Inspector: zufällige Gemeinde"
            disabled={isInspectorLoading}
            className="h-7 w-7 rounded-md transition-all duration-150 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-80"
          >
            {isInspectorLoading ? <Loader2 size={14} className="animate-spin" /> : <Glasses size={14} />}
          </Button>
          <Button
            variant={activePanel === 'user' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setActivePanel(activePanel === 'user' ? 'none' : 'user')}
            title="User Panel"
            className={`h-7 w-7 rounded-md transition-all duration-150 ${
              activePanel === 'user'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Users size={14} />
          </Button>
          {onExit && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowExitDialog(true)}
              title="Logout"
              className="h-7 w-7 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
            >
              <svg className="w-3.5 h-3.5 -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable content area - takes remaining space */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* View Only Overlay - nur für echte Besucher (Nicht-Mitglieder) */}
        {isFullyViewOnly && (
          <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
            <span className="text-4xl mb-2">👀</span>
            <span className="text-amber-400 font-medium text-center">Besuchermodus</span>
            <span className="text-amber-400/70 text-xs text-center mt-1">Bearbeitung deaktiviert</span>
          </div>
        )}

        <ScrollArea className={`h-full py-3 ${isFullyViewOnly ? 'pointer-events-none opacity-30' : ''}`}>
          {/* Direct categories (TOOLS, ZONES) */}
          {Object.entries(directCategories).map(([category, tools]) => {
            return (
            <div key={category} className="mb-2">
              {/* Separator above ZONES */}
              {category === 'ZONES' && (
                <div className="mx-4 my-3 h-px bg-slate-200 dark:bg-slate-700" />
              )}
              <div className="px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                {m((CATEGORY_LABELS[category] || category) as Parameters<typeof m>[0])}
              </div>
              <div className="px-2 flex flex-col gap-0.5">
                {tools.map(tool => {
                  const info = TOOL_INFO[tool];
                  if (!info) return null;
                  const isSelected = selectedTool === tool;
                  const canAfford = stats.money >= info.cost;

                  return (
                    <Button
                      key={tool}
                      data-tool={tool}
                      onClick={() => handleSetTool(tool)}
                      disabled={!canAfford && info.cost > 0}
                      variant={isSelected ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-3 px-3 py-2.5 h-auto text-sm font-medium transition-all duration-150 rounded-lg ${isSelected
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                        }`}
                      title={`${safeTranslate(m, info.description)}${info.cost > 0 ? ` - Kosten: Fr. ${info.cost.toLocaleString('de-CH')}` : ''}`}
                    >
                      <span className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {toolIcons[tool] || <MapPin className="w-4 h-4" />}
                      </span>
                      <span className="flex-1 text-left truncate">{safeTranslate(m, info.name)}</span>
                      {info.cost > 0 && (
                        <span className={`text-xs tabular-nums ${isSelected ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                          ${info.cost.toLocaleString()}
                        </span>
                      )}
                    </Button>
                  );
                })}
                {/* Roads submenu - appears after TOOLS category */}
                {category === 'TOOLS' && (
                  <HoverSubmenu
                    key={roadsSubmenu.key}
                    label={roadsSubmenu.label}
                    icon={categoryIcons.roads}
                    tools={roadsSubmenu.tools}
                    selectedTool={selectedTool}
                    money={stats.money}
                    onSelectTool={handleSetTool}
                    dataSubmenu="roads"
                  />
                )}
                {/* Expand City submenu - appears after TOOLS category, nur für Eigentümer */}
                {category === 'TOOLS' && isOwner && (
                  <ActionSubmenu
                    key="expandCity"
                    label={CATEGORY_LABELS.expandCity}
                    icon={categoryIcons.expandCity}
                    actions={expandCityActions}
                    money={stats.money}
                  />
                )}
                {/* Zoning submenu - appears after ZONES category */}
                {category === 'ZONES' && (
                  <HoverSubmenu
                    key={zoningSubmenu.key}
                    label={zoningSubmenu.label}
                    icon={categoryIcons.zoning}
                    tools={zoningSubmenu.tools}
                    selectedTool={selectedTool}
                    money={stats.money}
                    onSelectTool={handleSetTool}
                  />
                )}
              </div>
            </div>
          );})}

          {/* Separator */}
          <div className="mx-4 my-3 h-px bg-slate-200 dark:bg-slate-700" />

          {/* Buildings header */}
          <div className="px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            BUILDINGS
          </div>

          {/* Submenu categories */}
          <div className="px-2 flex flex-col gap-0.5">
            {submenuCategories.map(({ key, label, tools, forceOpenUpward, comingSoon, showPreviews }) => (
              comingSoon ? (
                // Coming Soon category - disabled and greyed out
                <div
                  key={key}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 h-auto text-sm font-medium rounded-lg opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
                  title="Coming Soon - In Entwicklung"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 text-slate-400 dark:text-slate-500">
                      {categoryIcons[key]}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">{safeTranslate(m, label)}</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                    SOON
                  </span>
                </div>
              ) : (
                <HoverSubmenu
                  key={key}
                  label={label}
                  icon={categoryIcons[key]}
                  tools={tools}
                  selectedTool={selectedTool}
                  money={stats.money}
                  onSelectTool={setTool}
                  forceOpenUpward={forceOpenUpward}
                  showPreviews={showPreviews}
                  dataSubmenu={key}
                />
              )
            ))}
          </div>
        </ScrollArea>
      </div>

      <ExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onExit={handleExit}
      />

      {multiplayer && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
        />
      )}
    </div>
  );
});

export default Sidebar;
