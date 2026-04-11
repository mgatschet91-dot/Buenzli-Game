'use client';
/* eslint-disable react-compiler/react-compiler */
'use no memo';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useMessages, T, Var, useGT } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { TOOL_INFO, Tile, Building, BuildingType, AdjacentCity, Tool } from '@/types/game';
import { getBuildingSize, requiresWaterAdjacency, getWaterAdjacency } from '@/lib/simulation';
import { FireIcon, SafetyIcon, AlertIcon, PopulationIcon } from '@/components/ui/Icons';
import { getSpriteCoords, BUILDING_TO_SPRITE, SPRITE_VERTICAL_OFFSETS, SPRITE_HORIZONTAL_OFFSETS, getActiveSpritePack } from '@/lib/renderConfig';
import { selectSpriteSource, calculateSpriteCoords, calculateSpriteScale, calculateSpriteOffsets, getSpriteRenderInfo } from '@/components/game/buildingSprite';
import { getAuthToken } from '@/lib/api/coreApi';

// Import shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Import extracted game components, types, and utilities
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  HEIGHT_STEP,
  KEY_PAN_SPEED,
  Car,
  Bus,
  BusLine,
  Airplane,
  Helicopter,
  Seaplane,
  EmergencyVehicle,
  Boat,
  Barge,
  TourWaypoint,
  FactorySmog,
  OverlayMode,
  Pedestrian,
  Firework,
  Cloud,
  BirdFlock,
  WorldRenderState,
} from '@/components/game/types';
import {
  SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD,
  ZOOM_MIN,
  ZOOM_MAX,
  WATER_ASSET_PATH,
  AIRPLANE_SPRITE_SRC,
  TRAIN_MIN_ZOOM,
  DIRECTION_META,
  CAR_MIN_ZOOM,
  CAR_MIN_ZOOM_MOBILE,
} from '@/components/game/constants';
import {
  gridToScreen,
  screenToGrid,
} from '@/components/game/utils';
import {
  drawGreenBaseTile,
  drawGreyBaseTile,
  drawBeachOnWater,
  drawFoundationPlot,
  drawCliffSides,
  PAINT_COLORS,
} from '@/components/game/drawing';
import {
  getOverlayFillStyle,
  OVERLAY_TO_BUILDING_TYPES,
  OVERLAY_CIRCLE_COLORS,
  OVERLAY_CIRCLE_FILL_COLORS,
  OVERLAY_HIGHLIGHT_COLORS,
  TREE_BUILDING_TYPES,
  PARK_BUILDING_TYPES,
  getPollutionInfluenceRadius,
  getPollutionRadiusColors,
  getBuildingPollutionValue,
} from '@/components/game/overlays';
import { RESIDENTIAL_BUILDING_TYPES } from '@/components/game/constants';
import { SERVICE_CONFIG, SERVICE_RANGE_INCREASE_PER_LEVEL } from '@/lib/simulation';
import { drawPlaceholderBuilding } from '@/components/game/placeholders';
import { loadImage, loadImageDirect, loadSpriteImage, onImageLoaded, getCachedImage, notifyImageLoaded, getStandaloneBottomEmptyFraction, getStandaloneHorizontalBounds, loadStandaloneOffsetsFromServer } from '@/components/game/imageLoader';
import { PixiWaterLayer, type WaterTileInfo } from '@/components/game/PixiWaterLayer';
import { PixiBuildingRenderer } from '@/components/game/PixiBuildingRenderer';
import { PixiVehicleRenderer, VehicleEntry } from '@/components/game/PixiVehicleRenderer';
import { getDarkness } from '@/components/game/lightingSystem';
import { DISASTER_INFO, DISASTER_DURATION_MS } from '@/components/game/DisasterOverlay';
import { findStations as findStationsUtil } from '@/components/game/gridFinders';
import { PixiCloudLayer } from '@/components/game/PixiCloudLayer';
import { PixiWindTurbineLayer } from '@/components/game/PixiWindTurbineLayer';
import { PixiLightingLayer } from '@/components/game/PixiLightingLayer';
import { TileInfoPanel } from '@/components/game/panels';
import { InspectionPanel } from '@/components/game/panels/InspectionPanel';
import { RoomViewerOverlay } from '@/components/game/RoomViewerOverlay';
import BuenzliQuizDialog from './BuenzliQuizDialog';
import { drawTradePartnerPreviews, type TradePartnerPreviewData } from '@/components/game/drawTradePartnerPreview';
import { findNearestTree as findNearestTreeUtil, createWoodcutterNpc as createWoodcutterNpcUtil, buildDirectGridPath as buildDirectGridPathUtil, findNearestGrass as findNearestGrassUtil, createGardenerNpc as createGardenerNpcUtil, createPoliceNpc as createPoliceNpcUtil, createGangsterNpc as createGangsterNpcUtil, findFleePoint as findFleePointUtil, findNearestInspectableBuilding as findNearestInspectableBuildingUtil, createBuenzliNpc as createBuenzliNpcUtil, createPlantationWoodcutterNpc as createPlantationWoodcutterNpcUtil, createHomelessNpc as createHomelessNpcUtil, WOODCUTTER_LEVEL_CONFIG, updatePartyGuests as updatePartyGuestsUtil, createPartyGuestNpc as createPartyGuestNpcUtil, partyGuestMap } from '@/components/game/pedestrianSystem';
import { avatarDebugLog } from '@/components/game/drawPedestrians';
import { findPathOnRoads as findPathOnRoadsUtil, findNearestRoadToBuilding as findNearestRoadToBuildingUtil } from '@/components/game/utils';
import {
  findMarinasAndPiers,
  findAdjacentWaterTile,
  isOverWater,
  generateTourWaypoints,
} from '@/components/game/gridFinders';
import { drawAirplanes as drawAirplanesUtil, drawHelicopters as drawHelicoptersUtil, drawSeaplanes as drawSeaplanesUtil } from '@/components/game/drawAircraft';
import { useVehicleSystems, VehicleSystemRefs, VehicleSystemState } from '@/components/game/vehicleSystems';
import { useBuildingHelpers } from '@/components/game/buildingHelpers';
import { useAircraftSystems, AircraftSystemRefs, AircraftSystemState } from '@/components/game/aircraftSystems';
import { useBargeSystem, BargeSystemRefs, BargeSystemState } from '@/components/game/bargeSystem';
import { useBoatSystem, BoatSystemRefs, BoatSystemState } from '@/components/game/boatSystem';
import { useSeaplaneSystem, SeaplaneSystemRefs, SeaplaneSystemState } from '@/components/game/seaplaneSystem';
import { useEffectsSystems, EffectsSystemRefs, EffectsSystemState, setServerWindDirection } from '@/components/game/effectsSystems';
import { useBirdSystem, BirdSystemRefs, BirdSystemState } from '@/components/game/birdSystem';
import { PixiBirdRenderer } from '@/components/game/PixiBirdRenderer';
import {
  analyzeMergedRoad,
} from '@/components/game/trafficSystem';
import { drawRoad, RoadDrawingOptions, drawAutobahn, AutobahnDrawingOptions, createAutobahnMergeInfoCache, MergedRoadInfo } from '@/components/game/roadDrawing';
import {
  drawBridgeTile,
  drawSuspensionBridgeTowers,
  drawSuspensionBridgeOverlay,
} from '@/components/game/bridgeDrawing';
import { deltaQueue, AvatarSyncState } from '@/lib/deltaSync';
import { CrimeType, getCrimeName, getCrimeDescription, getFireDescriptionForTile, getFireNameForTile } from '@/components/game/incidentData';
import {
  drawRailTrack,
  drawRailTracksOnly,
  countRailTiles,
  findRailroadCrossings,
  drawRailroadCrossing,
  getCrossingStateForTile,
  GATE_ANIMATION_SPEED,
} from '@/components/game/railSystem';
import {
  spawnTrain,
  updateTrain,
  drawTrains,
  MIN_RAIL_TILES_FOR_TRAINS,
  MAX_TRAINS,
  MAX_TRAINS_MOBILE,
  TRAIN_SPAWN_INTERVAL,
  TRAIN_SPAWN_INTERVAL_MOBILE,
  TRAINS_PER_RAIL_TILES,
  TRAINS_PER_RAIL_TILES_MOBILE,
} from '@/components/game/trainSystem';
import { Train } from '@/components/game/types';
// lightingSystem functions used by PixiLightingLayer internally
import * as chatApi from '@/lib/api/chatApi';
import {
  AvatarAppearanceConfig,
  DEFAULT_AVATAR_APPEARANCE,
  loadAvatarAppearanceFromStorage,
  normalizeAvatarAppearanceConfig,
  saveAvatarAppearanceToStorage,
} from '@/lib/avatarConfig';
import {
  DEFAULT_HABBO_FIGURE,
  requestAvatarCanvas,
  getAvatarEditorPartOptions,
  getAvatarEditorPaletteOptions,
  getAvatarEditorPaletteCount,
  AvatarEditorPartOption,
  AvatarEditorPaletteOption,
} from '@/lib/avatarImager/avatarRenderer';
import '@/components/game/avatarHabboWindows.css';

// Props interface for CanvasIsometricGrid
export interface CanvasIsometricGridProps {
  overlayMode: OverlayMode;
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  isMobile?: boolean;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: { offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } }) => void;
  onBargeDelivery?: (cargoValue: number, cargoType: number) => void;
  ownerName?: string;
  municipalityName?: string;
  memberCount?: number;
  administrators?: Array<{ id: number; nickname: string }>;
  coatOfArms?: { svg: string | null; image_url: string | null } | null;
  canEditCoatOfArms?: boolean;
  onSaveCoatOfArms?: (svg: string | null) => void;
  isFullyViewOnly?: boolean; // Wenn true, kann nichts platziert werden (Besuchermodus)
  showPublicRoomWalls?: boolean;
  onVisitMunicipality?: (slug: string, roomCode?: string) => void; // Inline-Navigation zur Partner-Gemeinde
  serverWeather?: { type: string; intensity: number; temperature?: number; windspeed?: number; winddirection?: number; isDay?: boolean } | null;
  disastersRef?: React.MutableRefObject<import('@/components/game/DisasterOverlay').ActiveDisaster[]>;
  mansionPartiesRef?: React.MutableRefObject<import('@/components/game/types').MansionParty[]>;
  selectedDisasterId?: string | null;
  onSelectDisaster?: (id: string | null) => void;
  chunkManager?: import('@/lib/chunkManager').ChunkManager;
  playerResidences?: Array<{ tile_x: number; tile_y: number; room_code: string; user_id: number; nickname: string; mansion_variant_row?: number | null; mansion_variant_col?: number | null }>;
  onViewPlayerProfile?: (userId: number) => void;
  currentRoomCode?: string;
}

// ════════════════════════════════════════════════════════════
// FURNI MODULE-LEVEL CACHES (persist across renders)
// ════════════════════════════════════════════════════════════
type FurniMeta = {
  assets: Record<string, { x: number; y: number; exists?: boolean; source?: string; flipH?: number }>;
  layers: Array<{ layerId: number; z: number; ink?: string }>;
};
const _furniMetaCache: Record<string, FurniMeta | 'loading' | 'error'> = {};
const _furniCompositeCache: Record<string, { img: HTMLImageElement; anchorX: number; anchorY: number } | 'loading' | 'error'> = {};

function _layerIdToLetter(id: number): string {
  return String.fromCharCode(97 + id); // 0→a, 1→b, 2→c …
}

/** Kick off loading + compositing a furni sprite. Calls notifyFn when done. */
function _loadFurniComposite(cls: string, dir: number, state: number, notifyFn: () => void): void {
  const cKey = `${cls}_${dir}_${state}`;
  if (_furniCompositeCache[cKey]) return;
  _furniCompositeCache[cKey] = 'loading';

  const basePath = `/assets/hof_furni/${cls}`;

  // Step 1 – fetch furni.json (or use cached meta)
  const metaReady: Promise<FurniMeta | null> = (() => {
    const cached = _furniMetaCache[cls];
    if (cached && cached !== 'loading' && cached !== 'error') return Promise.resolve(cached);
    if (cached === 'error') return Promise.resolve(null);
    if (cached === 'loading') {
      return new Promise<FurniMeta | null>((resolve) => {
        let tries = 0;
        const iv = setInterval(() => {
          tries++;
          const c = _furniMetaCache[cls];
          if (c && c !== 'loading') { clearInterval(iv); resolve(c === 'error' ? null : c); }
          if (tries > 100) { clearInterval(iv); resolve(null); }
        }, 50);
      });
    }
    _furniMetaCache[cls] = 'loading';
    return fetch(`${basePath}/furni.json`)
      .then((r) => r.json())
      .then((json: Record<string, unknown>) => {
        const assets: FurniMeta['assets'] = {};
        const rawAssets = (json.assets ?? {}) as Record<string, Record<string, unknown>>;
        for (const [name, a] of Object.entries(rawAssets)) {
          assets[name] = {
            x: (a.x as number) ?? 0,
            y: (a.y as number) ?? 0,
            exists: a.exists !== false,
            source: (a.source as string) ?? undefined,
            flipH: (a.flipH as number) ?? 0,
          };
        }
        const viz64 = ((json.visualization ?? {}) as Record<string, Record<string, unknown>>)['64'] as
          | { layerCount?: number; layers?: Array<{ layerId: number; z: number; ink?: string }> }
          | undefined;
        // Build complete layer list from layerCount, merging special
        // properties (z, ink) from the optional layers override array.
        // Many furni.json files only list layers that have non-default
        // properties (ink blending, custom z-order) while omitting
        // plain layers – layerCount is the authoritative layer total.
        const layerCount = Math.max(0, Number(viz64?.layerCount ?? 0));
        const specialLayers = viz64?.layers ?? [];
        const layers: FurniMeta['layers'] = [];
        for (let i = 0; i < layerCount; i++) {
          const special = specialLayers.find((l) => l.layerId === i);
          layers.push({
            layerId: i,
            z: special?.z ?? 0,
            ink: special?.ink,
          });
        }
        layers.sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
        const meta: FurniMeta = { assets, layers };
        _furniMetaCache[cls] = meta;
        return meta;
      })
      .catch(() => { _furniMetaCache[cls] = 'error'; return null; });
  })();

  metaReady.then((meta) => {
    if (!meta) { _furniCompositeCache[cKey] = 'error'; return; }

    type LayerInfo = { imgPath: string; x: number; y: number; z: number; ink?: string; flipH: boolean };

    /** Try to resolve layer infos for a specific direction */
    function resolveLayersForDir(d: number): LayerInfo[] {
      const infos: LayerInfo[] = [];
      for (const layer of meta!.layers) {
        const letter = _layerIdToLetter(layer.layerId);
        const assetName = `${cls}_64_${letter}_${d}_${state}`;
        const asset = meta!.assets[assetName];
        if (!asset) continue;

        let srcName = assetName;
        let flipH = false;
        if (!asset.exists && asset.source) {
          srcName = asset.source;
          flipH = !!asset.flipH;
        } else if (!asset.exists) {
          continue;
        }

        infos.push({
          imgPath: `${basePath}/${srcName}.png`,
          x: asset.x, y: asset.y, z: layer.z ?? 0,
          ink: layer.ink, flipH,
        });
      }
      return infos;
    }

    // Try requested direction first, then fall back to other common Habbo directions
    let layerInfos = resolveLayersForDir(dir);
    if (layerInfos.length === 0) {
      const fallbackDirs = [0, 2, 4, 6].filter((d) => d !== dir);
      for (const fallbackDir of fallbackDirs) {
        layerInfos = resolveLayersForDir(fallbackDir);
        if (layerInfos.length > 0) break;
      }
    }

    if (layerInfos.length === 0) { _furniCompositeCache[cKey] = 'error'; return; }

    Promise.all(
      layerInfos.map((li) =>
        loadImageDirect(li.imgPath).then((img) => ({ ...li, img })).catch(() => null)
      )
    ).then((loaded) => {
      const valid = loaded.filter(Boolean) as Array<LayerInfo & { img: HTMLImageElement }>;
      if (valid.length === 0) { _furniCompositeCache[cKey] = 'error'; return; }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const l of valid) {
        const iw = l.img.naturalWidth || l.img.width;
        const ih = l.img.naturalHeight || l.img.height;
        minX = Math.min(minX, -l.x);
        minY = Math.min(minY, -l.y);
        maxX = Math.max(maxX, -l.x + iw);
        maxY = Math.max(maxY, -l.y + ih);
      }

      const cw = Math.max(1, maxX - minX);
      const ch = Math.max(1, maxY - minY);

      const offscreen = document.createElement('canvas');
      offscreen.width = cw;
      offscreen.height = ch;
      const octx = offscreen.getContext('2d');
      if (!octx) { _furniCompositeCache[cKey] = 'error'; return; }

      for (const l of valid) {
        const iw = l.img.naturalWidth || l.img.width;
        const dx = -l.x - minX;
        const dy = -l.y - minY;
        octx.globalCompositeOperation = l.ink === 'ADD' ? 'lighter' : 'source-over';
        if (l.flipH) {
          octx.save();
          octx.translate(dx + iw, dy);
          octx.scale(-1, 1);
          octx.drawImage(l.img, 0, 0);
          octx.restore();
        } else {
          octx.drawImage(l.img, dx, dy);
        }
      }
      octx.globalCompositeOperation = 'source-over';

      const compositeImg = new Image();
      compositeImg.onload = () => {
        _furniCompositeCache[cKey] = { img: compositeImg, anchorX: -minX, anchorY: -minY };
        notifyFn();
      };
      compositeImg.onerror = () => { _furniCompositeCache[cKey] = 'error'; };
      compositeImg.src = offscreen.toDataURL();
    });
  });
}
const LOCAL_AVATAR_SERVER_ID_PREFIX = 'avatar:';
const BOBBA_BADGE_BASE_URL = 'https://images.bobba.io/c_images/Badges/';
const DEFAULT_PROFILE_BADGES = ['AC1', 'BRA', 'Z58'];
const PUBLIC_ROOM_FIT_PADDING = 36;
const RAW_GAME_API_BASE_URL =
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'http://127.0.0.1:4100';
const GAME_API_BASE_URL = (() => {
  const trimmed = String(RAW_GAME_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  if (trimmed.endsWith('/api/game')) return trimmed;
  return `${trimmed}/api/game`;
})();
const PUBLIC_ROOM_FIXED_DESKTOP_CAMERA = {
  zoom: 1.5056,
  offsetX: 873.1,
  offsetY: 368.6,
};

type GridStep = { x: number; y: number };
type AvatarEditorMainTabId = 'generic' | 'head' | 'torso' | 'legs';
type AvatarEditorSecondaryTab = { type: string; name: string; image: string; required: boolean };
type AvatarEditorMainTab = { id: AvatarEditorMainTabId; tabs: AvatarEditorSecondaryTab[] };
const AVATAR_EDITOR_ICON_BASE_URL = (
  process.env.NEXT_PUBLIC_AVATAR_EDITOR_ICON_BASE_URL || '/images/avatar_editor/'
).replace(/\/?$/, '/');

const AVATAR_EDITOR_TABS: AvatarEditorMainTab[] = [
  { id: 'generic', tabs: [{ type: 'hd', name: 'Skin', image: '', required: true }] },
  {
    id: 'head',
    tabs: [
      { type: 'hr', name: 'Hair', image: 'head_hair', required: false },
      { type: 'ha', name: 'Hat', image: 'head_hats', required: false },
      { type: 'he', name: 'Accessories', image: 'head_accessories', required: false },
      { type: 'ea', name: 'Glass', image: 'head_eyewear', required: false },
      { type: 'fa', name: 'Masks', image: 'head_face_accessories', required: false },
    ],
  },
  {
    id: 'torso',
    tabs: [
      { type: 'ch', name: 'Top', image: 'top_shirt', required: true },
      { type: 'cc', name: 'Jacket', image: 'top_jacket', required: false },
      { type: 'ca', name: 'Collar', image: 'top_accessories', required: false },
      { type: 'cp', name: 'Print', image: 'top_prints', required: false },
    ],
  },
  {
    id: 'legs',
    tabs: [
      { type: 'lg', name: 'Pants', image: 'bottom_trousers', required: true },
      { type: 'sh', name: 'Shoes', image: 'bottom_shoes', required: false },
      { type: 'wa', name: 'Belts', image: 'bottom_accessories', required: false },
    ],
  },
];
const AVATAR_EDITOR_MAIN_TAB_ICON_FILE: Record<AvatarEditorMainTabId, string> = {
  generic: 'ae_tabs_generic.png',
  head: 'ae_tabs_head.png',
  torso: 'ae_tabs_torso.png',
  legs: 'ae_tabs_legs.png',
};

function avatarEditorIconUrl(fileName: string): string {
  return `${AVATAR_EDITOR_ICON_BASE_URL}${fileName}`;
}

type FigurePartData = { type: string; id: string; colors: string[] };

function parseFigureString(figureRaw: string): FigurePartData[] {
  const figure = String(figureRaw || '').trim();
  if (!figure) return [];
  return figure
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const d = part.split('-');
      return {
        type: d[0] || '',
        id: d[1] || '1',
        colors: d.slice(2).filter(Boolean),
      };
    })
    .filter(p => !!p.type);
}

function serializeFigureString(parts: FigurePartData[]): string {
  return parts.map(p => [p.type, p.id, ...p.colors].join('-')).join('.');
}

function upsertFigurePart(figure: string, nextPart: FigurePartData): string {
  const parts = parseFigureString(figure);
  const next = parts.filter(p => p.type !== nextPart.type);
  next.push(nextPart);
  return serializeFigureString(next);
}

function removeFigurePart(figure: string, partType: string): string {
  return serializeFigureString(parseFigureString(figure).filter(p => p.type !== partType));
}

function getFigurePart(figure: string, partType: string): FigurePartData | null {
  return parseFigureString(figure).find(p => p.type === partType) || null;
}

function getLocalAvatarDisplayName(): string {
  if (typeof window === 'undefined') return 'Spieler';
  const fromStorage = localStorage.getItem('isocity_user_name');
  const fromWindow = (window as unknown as { __ISOCITY_PLAYER_NAME__?: string }).__ISOCITY_PLAYER_NAME__;
  const label = (fromStorage || fromWindow || '').trim();
  return label || 'Spieler';
}

function getLocalAvatarAppearanceConfig(): AvatarAppearanceConfig {
  return normalizeAvatarAppearanceConfig(loadAvatarAppearanceFromStorage());
}

function isSameGridStep(a?: { x: number; y: number }, b?: { x: number; y: number }): boolean {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

function resolveAvatarFigure(avatar: AvatarSyncState): string {
  const raw = String(
    (avatar as AvatarSyncState & { avatarFigure?: string; figure?: string; look?: string }).avatarFigure ||
    (avatar as AvatarSyncState & { avatarFigure?: string; figure?: string; look?: string }).figure ||
    (avatar as AvatarSyncState & { avatarConfig?: { figure?: string } }).avatarConfig?.figure ||
    (avatar as AvatarSyncState & { avatarFigure?: string; figure?: string; look?: string }).look ||
    ''
  ).trim();
  return raw || DEFAULT_HABBO_FIGURE;
}

function isAvatarWalkableTile(tile: Tile | undefined): boolean {
  if (!tile?.building?.type) return false;
  const type = tile.building.type;
  return (
    type === 'road' ||
    type === 'bridge' ||
    type === 'grass' ||
    type === 'empty'
  );
}

function isAvatarRoadTile(tile: Tile | undefined): boolean {
  if (!tile?.building?.type) return false;
  return tile.building.type === 'road' || tile.building.type === 'bridge';
}

function findAvatarPathAStar(
  gridData: Tile[][],
  gridSizeValue: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): GridStep[] {
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < gridSizeValue && y < gridSizeValue;
  if (!inBounds(fromX, fromY) || !inBounds(toX, toY)) return [];
  if (!isAvatarWalkableTile(gridData[fromY]?.[fromX])) return [];
  if (!isAvatarWalkableTile(gridData[toY]?.[toX])) return [];
  if (fromX === toX && fromY === toY) return [{ x: fromX, y: fromY }];

  const key = (x: number, y: number) => `${x},${y}`;
  const heuristic = (x: number, y: number) => {
    const dx = Math.abs(toX - x);
    const dy = Math.abs(toY - y);
    const diag = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diag;
    return diag * 1.4 + straight;
  };
  const dirs = [
    { dx: -1, dy: 0, diag: false },
    { dx: 1, dy: 0, diag: false },
    { dx: 0, dy: -1, diag: false },
    { dx: 0, dy: 1, diag: false },
    { dx: -1, dy: -1, diag: true },
    { dx: -1, dy: 1, diag: true },
    { dx: 1, dy: -1, diag: true },
    { dx: 1, dy: 1, diag: true },
  ];

  const openSet: Array<{ x: number; y: number; f: number }> = [{ x: fromX, y: fromY, f: heuristic(fromX, fromY) }];
  const cameFrom = new Map<string, GridStep>();
  const gScore = new Map<string, number>([[key(fromX, fromY), 0]]);
  const closed = new Set<string>();

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    if (!current) break;

    if (current.x === toX && current.y === toY) {
      const path: GridStep[] = [{ x: toX, y: toY }];
      let cursorKey = key(toX, toY);
      while (cameFrom.has(cursorKey)) {
        const prev = cameFrom.get(cursorKey);
        if (!prev) break;
        path.push(prev);
        cursorKey = key(prev.x, prev.y);
      }
      return path.reverse();
    }

    const currentKey = key(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    const currentG = gScore.get(currentKey) ?? Infinity;

    for (const { dx, dy, diag } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inBounds(nx, ny)) continue;
      const neighborTile = gridData[ny]?.[nx];
      if (!isAvatarWalkableTile(neighborTile)) continue;

      // Keine diagonalen "Corner-Cuts" durch blockierte Ecken.
      if (diag) {
        const sideA = gridData[current.y]?.[current.x + dx];
        const sideB = gridData[current.y + dy]?.[current.x];
        if (!isAvatarWalkableTile(sideA) || !isAvatarWalkableTile(sideB)) continue;
      }

      const baseCost = diag ? 1.4 : 1;
      const terrainFactor = isAvatarRoadTile(neighborTile) ? 1 : 2.4; // Strassen bevorzugen, Gras als Fallback
      const moveCost = baseCost * terrainFactor;
      const tentativeG = currentG + moveCost;
      const nKey = key(nx, ny);
      if (tentativeG >= (gScore.get(nKey) ?? Infinity)) continue;

      cameFrom.set(nKey, { x: current.x, y: current.y });
      gScore.set(nKey, tentativeG);
      const f = tentativeG + heuristic(nx, ny);
      openSet.push({ x: nx, y: ny, f });
    }
  }

  return [];
}

// Canvas-based Isometric Grid - HIGH PERFORMANCE
export function CanvasIsometricGrid({ overlayMode, selectedTile, setSelectedTile, isMobile = false, navigationTarget, onNavigationComplete, onViewportChange, onBargeDelivery, ownerName, municipalityName, memberCount, administrators, coatOfArms, canEditCoatOfArms = false, onSaveCoatOfArms, isFullyViewOnly = false, showPublicRoomWalls = false, onVisitMunicipality, serverWeather, disastersRef, mansionPartiesRef, selectedDisasterId, onSelectDisaster, chunkManager, playerResidences, onViewPlayerProfile, currentRoomCode }: CanvasIsometricGridProps) {
  const { state, latestStateRef, placeAtTile: originalPlaceAtTile, flipBuildingAtTile, finishTrackDrag, connectToCityWithApi, checkAndDiscoverCities, currentSpritePack, visualHour, setBuildingLabel, addMoney, addNotification, renameWaterBody, municipalitySlug, busLineCreationMode, residencePlacement, cancelResidencePlacement, activeRoom, openResidenceRoom, closeResidenceRoom, parkedVehiclesRef, emitParkVehicle, emitLeaveParking, parkingViolationsRef } = useGame();
  const { grid, gridSize, selectedTool, speed, adjacentCities, waterBodies, gameVersion } = state;

  // Bünzli Inspection State
  const [inspectTile, setInspectTile] = useState<{ x: number; y: number } | null>(null);

  // Beim Laden: prüfen ob eine aktive Inspektion auf dem Server existiert
  useEffect(() => {
    let cancelled = false;
    import('@/lib/api/eventApi').then(({ getActiveInspection }) => {
      getActiveInspection().then(insp => {
        if (cancelled) return;
        if (insp && (insp.status === 'searching' || insp.status === 'completed')) {
          setInspectTile({ x: insp.tile_x, y: insp.tile_y });
        }
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  // Bünzli Alert State
  const [buenzliAlert, setBuenzliAlert] = useState<{ message: string; amount: number; type: string; id: number } | null>(null);
  const buenzliAlertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownBuenzliIdsRef = useRef<Set<number>>(new Set());
  const buenzliFirstLoadRef = useRef(true);

  // Ref für NPC-Spawn-Callback (wird gesetzt nachdem pedestriansRef erstellt ist)
  const spawnNpcCallbackRef = useRef<((x: number, y: number) => void) | null>(null);

  // Flag: Verhindert Doppel-Spawn von NPCs bei Drag (mouseDown + mouseMove)
  const npcSpawnedThisClickRef = useRef(false);
  const localAvatarServerIdRef = useRef<string | null>(null);
  const avatarServerToPedIdRef = useRef<Map<string, number>>(new Map());
  const forceAvatarSpawnRef = useRef(false);
  const localAvatarMoveLockUntilRef = useRef<number>(0);
  const avatarFigureOverridesRef = useRef<Map<string, string>>(new Map());
  const publicRoomAutoSpawnedRef = useRef(false);

  const findAvatarPath = useCallback((fromX: number, fromY: number, toX: number, toY: number): GridStep[] => {
    const currentGrid = latestStateRef.current.grid;
    const currentGridSize = latestStateRef.current.gridSize;
    return findAvatarPathAStar(currentGrid, currentGridSize, fromX, fromY, toX, toY);
  }, [latestStateRef]);

  // Sichere Wrapper-Funktion: Im Besuchermodus wird nichts platziert
  const placeAtTile = useCallback((x: number, y: number) => {
    const currentTool = latestStateRef.current.selectedTool;

    // Inspect muss auch im Besuchermodus funktionieren.
    if (currentTool === 'inspect') {
      setInspectTile({ x, y });
      return;
    }

    if (isFullyViewOnly) {
      console.log('[CanvasIsometricGrid] Platzierung blockiert - Besuchermodus');
      return;
    }

    // Avatar-Test: Klick setzt Ziel oder spawnt beim ersten Klick.
    // ABER: Wenn ein Inventar-Item armed ist (Place to Room), Platzierung statt Avatar-Lauf!
    const hasArmedInventoryItem = typeof window !== 'undefined' &&
      !!window.sessionStorage.getItem('isocity_inventory_place_item');
    const isFurniTool = typeof currentTool === 'string' && currentTool.startsWith('furni_');
    const shouldPlaceInstead = isFurniTool || hasArmedInventoryItem;
    if ((forceAvatarSpawnRef.current || showPublicRoomWalls) && !shouldPlaceInstead) {
      if (npcSpawnedThisClickRef.current) return;
      npcSpawnedThisClickRef.current = true;
      spawnNpcCallbackRef.current?.(x, y);
      return;
    }

    // NPC spawnen: Nur EINMAL pro Klick (nicht bei Drag)
    if (currentTool === 'npc_woodcutter' || currentTool === 'npc_gardener' || currentTool === 'npc_police_chase' || currentTool === 'npc_gangster' || currentTool === 'npc_buenzli') {
      if (npcSpawnedThisClickRef.current) return; // Bereits gespawnt in diesem Klick
      npcSpawnedThisClickRef.current = true;
      spawnNpcCallbackRef.current?.(x, y);
      return;
    }

    originalPlaceAtTile(x, y);

    // Wenn placementFlipped aktiv ist, Gebäude nach dem Platzieren spiegeln
    if (placementFlippedRef.current) {
      flipBuildingAtTile(x, y);
    }

    // === HOLZFÄLLER-HAUS: NPCs nach Platzierung spawnen ===
    if (currentTool === 'woodcutter_house') {
      // customName auf "Holzfäller" setzen (Label über dem Haus)
      const st = latestStateRef.current;
      const tile = st.grid[y]?.[x];
      if (tile && tile.building.type === 'woodcutter_house') {
        tile.building.customName = 'Holzfäller';
        tile.building.plantationPhase = 'planting';
        tile.building.plantationHarvests = 0;
        tile.building.plantationMoneyEarned = 0;
      }

      // NPC(s) spawnen basierend auf Level (1-4 Arbeiter)
      const level = tile?.building?.level || 1;
      const config = WOODCUTTER_LEVEL_CONFIG[Math.min(level, 4)] || WOODCUTTER_LEVEL_CONFIG[1];
      for (let i = 0; i < config.npcCount; i++) {
        pedestrianIdRef.current++;
        const dirs: ('north' | 'east' | 'south' | 'west')[] = ['south', 'east', 'west', 'north'];
        const npc = createPlantationWoodcutterNpcUtil(
          pedestrianIdRef.current,
          x, y,
          dirs[i % dirs.length]
        );
        pedestriansRef.current = [...pedestriansRef.current, npc];
        console.log(`[Plantage] Holzfäller #${npc.id} gespawnt bei Haus (${x},${y})`);
      }
    }
  }, [isFullyViewOnly, originalPlaceAtTile, flipBuildingAtTile, latestStateRef, showPublicRoomWalls]);

  // Trade Partner Wegweiser - Hitboxen für Klick-Navigation
  const partnerHitboxesRef = useRef<Array<{ slug: string; name: string; x: number; y: number; w: number; h: number }>>([]);
  const [hoveringPartner, setHoveringPartner] = useState(false);

  // PERF: Use latestStateRef for real-time grid access in animation loops
  // This avoids waiting for React state sync which is throttled for performance
  const m = useMessages();
  const gt = useGT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null); // PERF: Separate canvas for hover/selection highlights
  const carsCanvasRef = useRef<HTMLCanvasElement>(null);
  const buildingsCanvasRef = useRef<HTMLCanvasElement>(null); // Buildings rendered on top of cars/trains
  const airCanvasRef = useRef<HTMLCanvasElement>(null); // Aircraft + fireworks rendered above buildings
  const lightingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixiLightingRef = useRef<PixiLightingLayer | null>(null);
  const pixiLightingContainerRef = useRef<HTMLDivElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null); // UI labels (owner name) rendered on top of everything
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPendingRef = useRef<number | null>(null); // PERF: Track pending render frame
  const lastMainRenderTimeRef = useRef<number>(0); // PERF: Throttle main renders at high speed
  const pixiWaterRef = useRef<PixiWaterLayer | null>(null);
  const pixiWaterContainerRef = useRef<HTMLDivElement>(null);
  const pixiBuildingsRef = useRef<PixiBuildingRenderer | null>(null);
  const pixiBuildingsContainerRef = useRef<HTMLDivElement>(null);
  const pixiVehiclesRef = useRef<PixiVehicleRenderer | null>(null);
  const pixiVehiclesContainerRef = useRef<HTMLDivElement>(null);
  const pixiCloudsRef = useRef<PixiCloudLayer | null>(null);
  const pixiCloudsContainerRef = useRef<HTMLDivElement>(null);
  const pixiWindTurbinesRef = useRef<PixiWindTurbineLayer | null>(null);
  const pixiWindTurbinesContainerRef = useRef<HTMLDivElement>(null);
  const weatherEnabledRef = useRef(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const stored = localStorage.getItem('meinort-weather-enabled');
      weatherEnabledRef.current = stored !== 'false';
      if (!weatherEnabledRef.current && pixiCloudsContainerRef.current) {
        pixiCloudsContainerRef.current.style.display = 'none';
      } else if (pixiCloudsContainerRef.current) {
        pixiCloudsContainerRef.current.style.display = '';
      }
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);
  const [offset, setOffset] = useState({ x: isMobile ? 200 : 620, y: isMobile ? 100 : 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isWheelZooming, setIsWheelZooming] = useState(false); // State to trigger re-render when wheel zooming stops
  const isPanningRef = useRef(false); // Ref for animation loop to check panning state
  const isPinchZoomingRef = useRef(false); // Ref for animation loop to check pinch zoom state
  const isWheelZoomingRef = useRef(false); // Ref for animation loop to check desktop wheel zoom state
  const wheelZoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout to detect end of wheel zoom
  const zoomRef = useRef(isMobile ? 0.6 : 1); // Ref for animation loop to check zoom level
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panCandidateRef = useRef<{ startX: number; startY: number; gridX: number; gridY: number } | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [placementFlipped, setPlacementFlipped] = useState(false);
  const placementFlippedRef = useRef(false);
  placementFlippedRef.current = placementFlipped;
  const [publicRoomCameraDebugOpen, setPublicRoomCameraDebugOpen] = useState(true);
  const [avatarQuickChatInput, setAvatarQuickChatInput] = useState('');
  const [avatarQuickChatSending, setAvatarQuickChatSending] = useState(false);
  const [hasLocalAvatar, setHasLocalAvatar] = useState(false);
  const [selectedAvatarProfile, setSelectedAvatarProfile] = useState<{
    avatarId: string;
    name: string;
    figure: string;
    isLocal: boolean;
    motto?: string;
  } | null>(null);
  const [avatarProfilePreviewUrl, setAvatarProfilePreviewUrl] = useState<string>('');
  // Wind sway — triggers main canvas re-render periodically from the animation loop
  const lastWindRenderRef = useRef(0);
  const [windTick, setWindTick] = useState(0);
  // PERF: Static base tile cache — reuse rendered tiles when grid/zoom/offset unchanged
  const staticCacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticCacheKeyRef = useRef({
    gridVersion: -1, zoom: -1, offsetX: NaN, offsetY: NaN,
    overlayMode: '', canvasW: 0, canvasH: 0,
    dragStart: '', dragEnd: '', showsDragGrid: false,
  });
  const serverWeatherRef = useRef(serverWeather);
  serverWeatherRef.current = serverWeather;
  if (serverWeather?.winddirection != null) {
    setServerWindDirection(serverWeather.winddirection);
  }

  const [mottoEditing, setMottoEditing] = useState(false);
  const [mottoInput, setMottoInput] = useState('');
  const [changeLooksOpen, setChangeLooksOpen] = useState(false);
  const [changeLooksFigure, setChangeLooksFigure] = useState(DEFAULT_HABBO_FIGURE);
  const [changeLooksPreviewUrl, setChangeLooksPreviewUrl] = useState<string>('');
  const [changeLooksMainTab, setChangeLooksMainTab] = useState<AvatarEditorMainTabId>('generic');
  const [changeLooksSecondTabIdx, setChangeLooksSecondTabIdx] = useState(0);
  const [changeLooksGender, setChangeLooksGender] = useState<'M' | 'F'>('M');
  const [changeLooksPos, setChangeLooksPos] = useState({ x: 24, y: 24 });
  const [changeLooksParts, setChangeLooksParts] = useState<AvatarEditorPartOption[]>([]);
  const [changeLooksPalette, setChangeLooksPalette] = useState<AvatarEditorPaletteOption[]>([]);
  const [changeLooksVisiblePartCount, setChangeLooksVisiblePartCount] = useState(36);
  const [changeLooksPartThumbTick, setChangeLooksPartThumbTick] = useState(0);
  const changeLooksPartPreviewCacheRef = useRef<Map<string, string>>(new Map());
  const changeLooksPartPreviewPrefetchRafRef = useRef<number | null>(null);
  const changeLooksPartsGridRef = useRef<HTMLDivElement | null>(null);
  const changeLooksDragRef = useRef<{ dragging: boolean; startMouseX: number; startMouseY: number; startX: number; startY: number }>({
    dragging: false,
    startMouseX: 0,
    startMouseY: 0,
    startX: 20,
    startY: 15,
  });
  const [hoveredIncident, setHoveredIncident] = useState<{
    x: number;
    y: number;
    type: 'fire' | 'crime' | 'npc_dealer' | 'npc_gangster' | 'npc_homeless' | 'npc_police_chase' | 'npc_buenzli';
    crimeType?: CrimeType;
    npcState?: string; // Server-State: 'loitering' | 'dealing' | 'burglary' | 'fleeing'
    screenX: number;
    screenY: number;
  } | null>(null);
  const [zoom, setZoom] = useState(isMobile ? 0.6 : 1);
  const carsRef = useRef<Car[]>([]);
  const carIdRef = useRef(0);
  const carSpawnTimerRef = useRef(0);
  const busesRef = useRef<Bus[]>([]);
  const busIdRef = useRef(0);
  const busSpawnTimerRef = useRef(0);
  const busLinesRef = useRef<BusLine[]>([]);
  const busLinesGridVersionRef = useRef(0);
  const serverBusLinesRef = useRef<{ id: number; name: string; color: string; stops: { x: number; y: number; sequence_order: number }[] }[]>([]);
  const emergencyVehiclesRef = useRef<EmergencyVehicle[]>([]);
  const emergencyVehicleIdRef = useRef(0);
  const emergencyDispatchTimerRef = useRef(0);
  const activeFiresRef = useRef<Set<string>>(new Set()); // Track fires that already have a truck dispatched
  const activeCrimesRef = useRef<Set<string>>(new Set()); // Track crimes that already have a car dispatched
  const activeCrimeIncidentsRef = useRef<Map<string, { x: number; y: number; type: CrimeType; timeRemaining: number }>>(new Map()); // Persistent crime incidents
  const crimeSpawnTimerRef = useRef(0); // Timer for spawning new crime incidents

  // Stable refs for parking emit functions (prevent stale closures in vehicleSystems)
  const emitParkVehicleRef = useRef(emitParkVehicle);
  const emitLeaveParkingRef = useRef(emitLeaveParking);
  useEffect(() => { emitParkVehicleRef.current = emitParkVehicle; }, [emitParkVehicle]);
  useEffect(() => { emitLeaveParkingRef.current = emitLeaveParking; }, [emitLeaveParking]);

  // Bus line creation mode preview
  const busLineCreationRef = useRef<{ active: boolean; stops: { x: number; y: number }[]; lineColor: string } | null>(null);
  const busLinePreviewCacheKeyRef = useRef<string>('');
  const busLinePreviewPathRef = useRef<{ x: number; y: number }[]>([]);

  // Keep bus line creation ref in sync
  busLineCreationRef.current = busLineCreationMode ? { active: busLineCreationMode.active, stops: busLineCreationMode.stops, lineColor: busLineCreationMode.lineColor } : null;

  // Residence placement ref
  const residencePlacementRef = useRef<{ variantRow: number; variantCol: number } | null>(null);
  residencePlacementRef.current = residencePlacement;

  // Label tool state
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [labelTarget, setLabelTarget] = useState<{ x: number; y: number } | null>(null);
  const [labelInput, setLabelInput] = useState('');
  // Water body rename state
  const [showWaterLabelDialog, setShowWaterLabelDialog] = useState(false);
  const [waterLabelTarget, setWaterLabelTarget] = useState<string | null>(null); // WaterBody id
  const [waterLabelInput, setWaterLabelInput] = useState('');

  // Büenzli Quiz state
  const [showBuenzliQuiz, setShowBuenzliQuiz] = useState(false);
  const [buenzliQuizData, setBuenzliQuizData] = useState<{
    eventType?: string;
    serverId?: number;
  } | null>(null);

  // Collectible money system (TEST)
  interface Collectible {
    id: number;
    x: number;
    y: number;
    amount: number;
    spawnTime: number;
  }
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const collectibleIdRef = useRef(0);
  const collectibleSpawnTimerRef = useRef(0);

  // Pedestrian system refs
  const pedestriansRef = useRef<Pedestrian[]>([]);
  const pedestrianIdRef = useRef(0);
  const pedestrianSpawnTimerRef = useRef(0);
  const wcReconcileRef = useRef(0); // Timer für Holzfäller NPC-Reconciliation
  const crimeNpcIdsRef = useRef<Set<number>>(new Set()); // Tracking der server-spawned Crime-NPCs
  const partyCarSpawnTimerRef = useRef(0); // Timer für Party-Gäste-Autos
  const partyCarExitedRef = useRef<Set<number>>(new Set()); // Car-IDs die schon einen NPC gespawnt haben

  // === DEV TEST: Habbo-Avatare ohne Login spawnen ===
  useEffect(() => {
    const TEST_AVATARS = [
      { figure: 'hd-180-1.hr-828-61.ch-210-66.lg-270-82.sh-290-80', label: 'TestUser1', tx: 5, ty: 5 },
      { figure: 'hd-180-2.hr-800-52.ch-230-64.lg-275-110.sh-305-62', label: 'TestUser2', tx: 7, ty: 5 },
      { figure: 'hd-180-7.hr-515-33.ch-215-82.lg-695-110.sh-295-108', label: 'TestUser3', tx: 9, ty: 5 },
    ];
    for (const av of TEST_AVATARS) {
      pedestrianIdRef.current++;
      const ped: Pedestrian = {
        id: pedestrianIdRef.current,
        tileX: av.tx, tileY: av.ty,
        direction: 'south', progress: 0, speed: 0.62,
        age: 0, maxAge: 999999,
        skinColor: '#f0c8a0', shirtColor: '#3b82f6', pantsColor: '#1e3a5f',
        hasHat: false, hatColor: '#cc2222',
        walkOffset: 0, sidewalkSide: 'left',
        destType: 'tree', homeX: av.tx, homeY: av.ty, destX: av.tx, destY: av.ty,
        returningHome: false,
        path: [{ x: av.tx, y: av.ty }], pathIndex: 0,
        state: 'idle', activity: 'none',
        activityProgress: 0, activityDuration: 999999,
        buildingEntryProgress: 0, socialTarget: null,
        activityOffsetX: 0, activityOffsetY: 0, activityAnimTimer: 0,
        hasBall: false, hasDog: false, hasBag: false,
        hasBeachMat: false, matColor: '#7c3aed',
        beachTileX: -1, beachTileY: -1, beachEdge: null,
        isNpcWorker: true, npcType: 'avatar_test',
        avatarServerId: `dev-test-${av.tx}-${av.ty}`,
        avatarLabel: av.label,
        avatarFigure: av.figure,
        avatarSpeechBubbles: [],
      };
      pedestriansRef.current.push(ped);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === CRIME NPC SYSTEM: Server-autoritative Gangster/Dealer/Polizei/Homeless ===
  // Mechanik: Dealer dealt mit NPCs, Einbrueche nur nachts, Polizei jagt nach Delay.
  // Max 3 Gangster + max 3 Obdachlose — langsamer Aufbau, echte Gameplay-Mechanik.
  useEffect(() => {
    const handleCrimeUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      const { criminals, crimeEvents, homeless, isNight } = detail as {
        criminals: Array<{ id: number; x: number; y: number; state: string; isDealer: boolean; beingChased: boolean; policeX: number | null; policeY: number | null; ticksAlive: number }>;
        crimeEvents: Array<{ type: string; id: number; x: number; y: number; isDealer?: boolean; policeX?: number; policeY?: number; stolenTotal?: number }>;
        homeless: number;
        isNight: boolean;
      };

      const st = worldStateRef.current;
      if (!st) return;

      // Helper: Finde naechste Strasse zu einem Gebaeude-Tile
      const findNearestRoad = (bx: number, by: number): { x: number; y: number } => {
        const grid = st.grid;
        const size = st.gridSize;
        for (let radius = 1; radius <= 5; radius++) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) + Math.abs(dy) > radius) continue;
              const nx = bx + dx;
              const ny = by + dy;
              if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
              const tile = grid[ny]?.[nx];
              if (!tile) continue;
              const bType = (tile.building?.type || '').toLowerCase();
              if (bType === 'road') return { x: nx, y: ny };
            }
          }
        }
        return { x: bx, y: by };
      };

      // ──── RECONCILIATION: Server-Criminal-Liste ist Master ────
      const serverCriminalIds = new Set((criminals || []).map(c => c.id));

      // 1) Entferne Client-NPCs die Server nicht mehr hat (gefasst/despawnt)
      const staleGangsters = pedestriansRef.current.filter(
        p => p.npcType === 'gangster' && p.npcCrimeServerId != null && !serverCriminalIds.has(p.npcCrimeServerId)
      );
      if (staleGangsters.length > 0) {
        const removeIds = new Set(staleGangsters.map(p => p.id));
        // Zugehoerige Polizei-NPCs auch entfernen
        const stalePolice = pedestriansRef.current.filter(
          p => p.npcType === 'police' && p.npcChaseTargetId != null && removeIds.has(p.npcChaseTargetId)
        );
        const allRemoveIds = new Set([...removeIds, ...stalePolice.map(p => p.id)]);
        pedestriansRef.current = pedestriansRef.current.filter(p => !allRemoveIds.has(p.id));
      }

      // 2) Spawne/Update Server-Criminals
      for (const criminal of criminals || []) {
        let gangsterPed = pedestriansRef.current.find(
          p => p.npcType === 'gangster' && p.npcCrimeServerId === criminal.id
        );

        if (!gangsterPed) {
          // Neuen NPC spawnen auf Strasse
          const roadPos = findNearestRoad(criminal.x, criminal.y);
          pedestrianIdRef.current++;
          gangsterPed = createGangsterNpcUtil(
            pedestrianIdRef.current,
            roadPos.x, roadPos.y, 0,
            roadPos.x, roadPos.y, [], 'south'
          );
          gangsterPed.npcCrimeServerId = criminal.id;
          gangsterPed.npcIsDealer = criminal.isDealer || false;
          pedestriansRef.current = [...pedestriansRef.current, gangsterPed];
          crimeNpcIdsRef.current.add(pedestrianIdRef.current);
        }

        // Activity-State synchronisieren (dealing/loitering/burglary/fleeing)
        if (criminal.state === 'burglary' && gangsterPed.activity !== 'fleeing') {
          gangsterPed.activity = 'working' as any; // Nachts: visuell anders
        } else if (criminal.state === 'dealing' && gangsterPed.activity !== 'fleeing') {
          gangsterPed.activity = 'shopping' as any; // Dealer-Aktivitaet
        }

        // Position: NUR updaten wenn NPC idle ist (kein mid-walk Reset!)
        if (!criminal.beingChased && gangsterPed.state !== 'walking') {
          const targetRoad = findNearestRoad(criminal.x, criminal.y);
          if (gangsterPed.tileX !== targetRoad.x || gangsterPed.tileY !== targetRoad.y) {
            const path = buildDirectGridPathUtil(gangsterPed.tileX, gangsterPed.tileY, targetRoad.x, targetRoad.y);
            if (path.length > 0) {
              gangsterPed.path = path;
              gangsterPed.pathIndex = 0;
              gangsterPed.progress = 0;
              gangsterPed.state = 'walking';
            }
          }
        }

        // Chase: Polizei jagt Gangster
        if (criminal.beingChased && gangsterPed.activity !== 'fleeing') {
          gangsterPed.state = 'walking';
          gangsterPed.activity = 'fleeing';

          // Polizei-NPC spawnen von Station
          const hasPolice = pedestriansRef.current.some(
            p => p.npcType === 'police' && p.npcChaseTargetId === gangsterPed!.id
          );
          if (!hasPolice && criminal.policeX != null && criminal.policeY != null) {
            const policeRoad = findNearestRoad(criminal.policeX, criminal.policeY);
            const gangsterRoad = findNearestRoad(criminal.x, criminal.y);
            pedestrianIdRef.current++;
            const police = createPoliceNpcUtil(
              pedestrianIdRef.current,
              policeRoad.x, policeRoad.y,
              gangsterPed.id,
              gangsterRoad.x, gangsterRoad.y, [], 'south'
            );
            police.npcCrimeServerId = criminal.id;
            gangsterPed.npcChaseTargetId = police.id;
            pedestriansRef.current = [...pedestriansRef.current, police];
            crimeNpcIdsRef.current.add(pedestrianIdRef.current);
          }
        }
      }

      // 3) Crime-Events: Caught → kurze Arrest-Animation
      for (const evt of crimeEvents || []) {
        if (evt.type === 'caught') {
          const gangsterPed = pedestriansRef.current.find(
            p => p.npcType === 'gangster' && p.npcCrimeServerId === evt.id
          );
          if (gangsterPed) {
            gangsterPed.state = 'arrested' as any;
            gangsterPed.activity = 'arrested';
            // Kurze Animation, dann wird Reconciliation beim naechsten Tick aufraeuemen
            setTimeout(() => {
              pedestriansRef.current = pedestriansRef.current.filter(p => p !== gangsterPed);
              const policePed = pedestriansRef.current.find(
                p => p.npcType === 'police' && p.npcChaseTargetId === gangsterPed.id
              );
              if (policePed) {
                pedestriansRef.current = pedestriansRef.current.filter(p => p !== policePed);
              }
            }, 3000);
          }
        }
      }

      // 4) Obdachlose: Server sendet Housing-Mangel-Zahl, Client zeigt max 3
      const targetHomeless = Math.max(0, Math.min(3, Math.floor((homeless || 0) / 5))); // 1 NPC pro 5 Homeless
      const currentHomeless = pedestriansRef.current.filter(p => p.npcType === 'homeless');
      const homelessDiff = targetHomeless - currentHomeless.length;

      if (homelessDiff > 0) {
        // Neue Obdachlose auf Parks/Strassen spawnen
        const grid = st.grid;
        const size = st.gridSize;
        const spots: { x: number; y: number }[] = [];
        for (let hy = 0; hy < size; hy++) {
          for (let hx = 0; hx < size; hx++) {
            const tile = grid[hy]?.[hx];
            if (!tile) continue;
            const bType = tile.building?.type?.toLowerCase() || '';
            if (bType === 'park' || bType === 'park_fountain' || bType === 'bench' || bType === 'road') {
              const occupied = currentHomeless.some(h => h.tileX === hx && h.tileY === hy);
              if (!occupied) spots.push({ x: hx, y: hy });
            }
          }
        }
        spots.sort(() => Math.random() - 0.5);
        const dirs: ('north' | 'east' | 'south' | 'west')[] = ['south', 'east', 'west', 'north'];
        for (let i = 0; i < Math.min(homelessDiff, spots.length); i++) {
          pedestrianIdRef.current++;
          const hp = createHomelessNpcUtil(
            pedestrianIdRef.current,
            spots[i].x, spots[i].y,
            dirs[i % dirs.length]
          );
          pedestriansRef.current = [...pedestriansRef.current, hp];
        }
      } else if (homelessDiff < 0) {
        // Ueberschuessige entfernen
        const toRemoveCount = Math.abs(homelessDiff);
        const removeSet = new Set(currentHomeless.slice(0, toRemoveCount).map(h => h.id));
        pedestriansRef.current = pedestriansRef.current.filter(p => !removeSet.has(p.id));
      }
    };

    window.addEventListener('crime-authoritative-update', handleCrimeUpdate);
    return () => window.removeEventListener('crime-authoritative-update', handleCrimeUpdate);
  }, []);

  // === BUENZLI NPC SYSTEM: Server-autoritative Büenzli-Inspektoren ===
  // Max 3 Büenzli-NPCs gleichzeitig, Server-Liste ist Master.
  useEffect(() => {
    const handleBuenzliUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !Array.isArray(detail.npcs)) return;
      const { npcs } = detail as { npcs: Array<{ id: number; x: number; y: number; eventType: string; severity: number; status: string; fixCost?: number }> };

      const st = worldStateRef.current;
      if (!st) return;

      // ── Detect new Bünzli NPCs → Alert Banner ──
      const BUENZLI_EVENT_LABELS: Record<string, string> = {
        // Ordnung & Sauberkeit
        trash_lying: 'Abfall auf der Strasse',
        graffiti: 'Graffiti an Gebäude',
        noise_complaint: 'Lärmbeschwerde',
        illegal_dumping: 'Illegale Entsorgung',
        recycling_violation: 'Recycling-Verstoss',
        fence_too_high: 'Zaun zu hoch',
        lawn_overgrown: 'Rasen verwildert',
        dog_unleashed: 'Hund ohne Leine',
        laundry_sunday: 'Wäsche am Sonntag',
        bbq_smoke: 'Übermässiger Grillrauch',
        illegal_parking: 'Falschparkieren',
        sunday_noise: 'Sonntagslärm',
        // Infrastruktur
        fire_safety: 'Brandschutz mangelhaft',
        illegal_build: 'Bau ohne Bewilligung',
        building_decay: 'Gebäude verfallen',
        road_damage: 'Strassenschäden',
        water_pipe_broken: 'Wasserleitung defekt',
        power_outage: 'Stromausfall',
        // Sicherheit
        police_underfunded: 'Polizei unterfinanziert',
        burglary_wave: 'Einbruchserie',
        vandalism_wave: 'Vandalismus-Welle',
        drug_problem: 'Drogenszene',
        // Verwaltung
        corruption: 'Korruption',
        tax_abuse: 'Steuermissbrauch',
        bureaucracy_jam: 'Bürokratie-Stau',
        missing_transparency: 'Fehlende Transparenz',
        // Soziales
        homelessness: 'Obdachlosigkeit steigt',
        school_understaffed: 'Schule unterbesetzt',
        youth_crime: 'Jugendkriminalität',
        hospital_overload: 'Spital überlastet',
        housing_shortage: 'Wohnungsnot',
      };

      // Beim ersten Load: bestehende Events als bekannt markieren (kein Alert-Spam bei Reload)
      if (buenzliFirstLoadRef.current) {
        buenzliFirstLoadRef.current = false;
        knownBuenzliIdsRef.current = new Set(npcs.map(n => n.id));
        // Kein Alert beim ersten Load — Events waren schon vorher da
      }

      const knownIds = knownBuenzliIdsRef.current;
      const newNpcs = npcs.filter(n => !knownIds.has(n.id));
      knownBuenzliIdsRef.current = new Set(npcs.map(n => n.id));

      if (newNpcs.length > 0) {
        const npc = newNpcs[0];
        const label = BUENZLI_EVENT_LABELS[npc.eventType] || npc.eventType;
        const isBig = npc.severity >= 4;
        const amount = npc.fixCost ?? (isBig ? npc.severity * 100 : npc.severity * 50);

        setBuenzliAlert({
          message: label,
          amount,
          type: isBig ? 'big' : 'normal',
          id: Date.now(),
        });
        if (buenzliAlertTimeoutRef.current) clearTimeout(buenzliAlertTimeoutRef.current);
        buenzliAlertTimeoutRef.current = setTimeout(() => setBuenzliAlert(null), 8000);
      }

      // Helper: Finde naechste Strasse zu einem Gebaeude-Tile
      const findNearestRoad = (bx: number, by: number): { x: number; y: number } => {
        const grid = st.grid;
        const size = st.gridSize;
        for (let radius = 1; radius <= 5; radius++) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) + Math.abs(dy) > radius) continue;
              const nx = bx + dx;
              const ny = by + dy;
              if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
              const tile = grid[ny]?.[nx];
              if (!tile) continue;
              const bType = (tile.building?.type || '').toLowerCase();
              if (bType === 'road') return { x: nx, y: ny };
            }
          }
        }
        return { x: bx, y: by };
      };

      // ──── RECONCILIATION: Server-NPC-Liste ist Master ────
      const serverBuenzliIds = new Set(npcs.map(n => n.id));

      // 1) Entferne Client-NPCs die Server nicht mehr kennt
      const staleBuenzli = pedestriansRef.current.filter(
        p => p.npcType === 'buenzli' && (p as any).npcBuenzliServerId != null && !serverBuenzliIds.has((p as any).npcBuenzliServerId)
      );
      if (staleBuenzli.length > 0) {
        const removeIds = new Set(staleBuenzli.map(p => p.id));
        pedestriansRef.current = pedestriansRef.current.filter(p => !removeIds.has(p.id));
      }

      // 2) Spawne fehlende Büenzli-NPCs (max 3)
      const currentBuenzliCount = pedestriansRef.current.filter(
        p => p.npcType === 'buenzli' && (p as any).npcBuenzliServerId != null
      ).length;
      let spawned = 0;

      for (const npc of npcs) {
        if (currentBuenzliCount + spawned >= 3) break;

        const existing = pedestriansRef.current.find(
          p => p.npcType === 'buenzli' && (p as any).npcBuenzliServerId === npc.id
        );
        if (existing) continue;

        // Spawne auf naechster Strasse zum Gebaeude
        const roadPos = findNearestRoad(npc.x, npc.y);
        // Suche einen weiter entfernten Spawn-Punkt auf der Strasse fuer sichtbaren Laufweg
        let spawnRoad = roadPos;
        // Versuche 8-15 Tiles entfernt auf einer Strasse zu spawnen
        for (let attempt = 0; attempt < 8; attempt++) {
          const range = 8 + attempt * 2;
          const tx = Math.max(0, Math.min(st.gridSize - 1, roadPos.x + Math.floor(Math.random() * range * 2) - range));
          const ty = Math.max(0, Math.min(st.gridSize - 1, roadPos.y + Math.floor(Math.random() * range * 2) - range));
          const tile = st.grid[ty]?.[tx];
          if (tile && tile.building?.type === 'road') {
            const testPath = findPathOnRoadsUtil(st.grid, st.gridSize, tx, ty, roadPos.x, roadPos.y);
            if (testPath && testPath.length >= 4) {
              spawnRoad = { x: tx, y: ty };
              break;
            }
          }
        }
        // Baue Pfad auf Strassen von Spawn zum Ziel-Road neben dem Gebaeude
        const buenzliPath = findPathOnRoadsUtil(st.grid, st.gridSize, spawnRoad.x, spawnRoad.y, roadPos.x, roadPos.y);
        const finalPath = (buenzliPath && buenzliPath.length >= 2)
          ? buenzliPath
          : [{ x: roadPos.x, y: roadPos.y }];
        let buenzliDir: 'north' | 'east' | 'south' | 'west' = 'south';
        if (finalPath.length > 1) {
          const dx = finalPath[1].x - finalPath[0].x;
          const dy = finalPath[1].y - finalPath[0].y;
          if (dx > 0) buenzliDir = 'south';
          else if (dx < 0) buenzliDir = 'north';
          else if (dy > 0) buenzliDir = 'west';
          else if (dy < 0) buenzliDir = 'east';
        }
        pedestrianIdRef.current++;
        const buenzliPed = createBuenzliNpcUtil(
          pedestrianIdRef.current,
          spawnRoad.x, spawnRoad.y,
          npc.x, npc.y,
          finalPath,
          buenzliDir
        );
        // Wenn Pfad nur 1 Tile: direkt Inspektion starten (kein Laufweg)
        if (finalPath.length < 2) {
          buenzliPed.tileX = roadPos.x;
          buenzliPed.tileY = roadPos.y;
          buenzliPed.state = 'npc_working';
          buenzliPed.activity = 'inspecting';
          buenzliPed.activityProgress = 0;
          buenzliPed.npcWorkProgress = 0;
        }
        (buenzliPed as any).npcBuenzliServerId = npc.id;
        (buenzliPed as any).npcBuenzliEventType = npc.eventType;
        pedestriansRef.current = [...pedestriansRef.current, buenzliPed];
        spawned++;
      }
    };

    window.addEventListener('buenzli-npc-authoritative-update', handleBuenzliUpdate);
    return () => window.removeEventListener('buenzli-npc-authoritative-update', handleBuenzliUpdate);
  }, []);

  const findPedestrianByAvatarId = useCallback((avatarId: string): Pedestrian | null => {
    return pedestriansRef.current.find(p => p.avatarServerId === avatarId) || null;
  }, []);

  const applyAvatarAppearanceToPedestrian = useCallback((ped: Pedestrian, configRaw: unknown) => {
    const config = normalizeAvatarAppearanceConfig(configRaw || DEFAULT_AVATAR_APPEARANCE);
    ped.skinColor = config.skinColor;
    ped.shirtColor = config.shirtColor;
    ped.pantsColor = config.pantsColor;
    ped.hatColor = config.hatColor;
    ped.hasHat = config.hatStyle !== 'none';
    ped.avatarHeadShape = config.headShape;
    ped.avatarEyeStyle = config.eyeStyle;
    ped.avatarHatStyle = config.hatStyle;
    ped.avatarHairStyle = config.hairStyle;
    ped.avatarEyeColor = config.eyeColor;
    ped.avatarHairColor = config.hairColor;
  }, []);

  const applyAvatarMetadataToPedestrian = useCallback((ped: Pedestrian, avatar: AvatarSyncState) => {
    ped.avatarOwnerId = avatar.ownerPlayerId;
    ped.avatarServerId = avatar.id;
    ped.avatarLabel = avatar.ownerName || ped.avatarLabel;
    const overriddenFigure = avatarFigureOverridesRef.current.get(avatar.id);
    ped.avatarFigure = overriddenFigure || resolveAvatarFigure(avatar);
    ped.avatarSpeechBubbles = ped.avatarSpeechBubbles || [];
    applyAvatarAppearanceToPedestrian(ped, avatar.avatarConfig);
  }, [applyAvatarAppearanceToPedestrian]);

  const getAvatarWorldPosition = useCallback((ped: Pedestrian): { x: number; y: number } => {
    if (Array.isArray(ped.path) && ped.state === 'walking' && ped.path.length >= 2) {
      const currentIndex = Math.max(0, Math.min(ped.pathIndex ?? 0, ped.path.length - 1));
      const currentTile = ped.path[currentIndex] || { x: ped.tileX, y: ped.tileY };
      const nextTile = ped.path[currentIndex + 1] || currentTile;
      const { screenX: sx1, screenY: sy1 } = gridToScreen(currentTile.x, currentTile.y, 0, 0);
      const { screenX: sx2, screenY: sy2 } = gridToScreen(nextTile.x, nextTile.y, 0, 0);
      const cx1 = sx1 + TILE_WIDTH / 2;
      const cy1 = sy1 + TILE_HEIGHT / 2;
      const cx2 = sx2 + TILE_WIDTH / 2;
      const cy2 = sy2 + TILE_HEIGHT / 2;
      const p = Math.max(0, Math.min(1, ped.progress ?? 0));
      return { x: cx1 + (cx2 - cx1) * p, y: cy1 + (cy2 - cy1) * p };
    }
    const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
    return { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT / 2 };
  }, []);

  const findAvatarByClick = useCallback((clientX: number, clientY: number, rect: DOMRect): Pedestrian | null => {
    const worldX = (clientX - rect.left - offset.x) / zoom;
    const worldY = (clientY - rect.top - offset.y) / zoom;
    let best: { ped: Pedestrian; score: number } | null = null;

    for (const ped of pedestriansRef.current) {
      if (ped.npcType !== 'avatar_test' || !ped.avatarServerId) continue;
      const pos = getAvatarWorldPosition(ped);
      const centerX = pos.x;
      const centerY = pos.y - 32;
      const rx = 30;
      const ry = 60;
      const nx = (worldX - centerX) / rx;
      const ny = (worldY - centerY) / ry;
      const score = nx * nx + ny * ny;
      if (score <= 1 && (!best || score < best.score)) {
        best = { ped, score };
      }
    }

    return best?.ped ?? null;
  }, [getAvatarWorldPosition, offset.x, offset.y, zoom]);

  const openAvatarProfile = useCallback((ped: Pedestrian) => {
    const avatarId = String(ped.avatarServerId || '');
    if (!avatarId) return;
    const figure = String(ped.avatarFigure || DEFAULT_HABBO_FIGURE).trim() || DEFAULT_HABBO_FIGURE;
    const isLocal = localAvatarServerIdRef.current === avatarId;
    const motto = isLocal ? (getLocalAvatarAppearanceConfig().motto || '') : '';
    setSelectedAvatarProfile({
      avatarId,
      name: ped.avatarLabel || ped.avatarOwnerId || 'Avatar',
      figure,
      isLocal,
      motto,
    });
    setMottoEditing(false);
    setMottoInput(motto);
  }, []);

  useEffect(() => {
    if (!selectedAvatarProfile?.figure) {
      setAvatarProfilePreviewUrl('');
      return;
    }
    let raf = 0;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const canvas = requestAvatarCanvas(selectedAvatarProfile.figure, 4, 'std', 0);
      if (canvas) {
        setAvatarProfilePreviewUrl(canvas.toDataURL());
        return;
      }
      raf = window.requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [selectedAvatarProfile?.figure]);

  useEffect(() => {
    if (!changeLooksOpen || !changeLooksFigure) {
      setChangeLooksPreviewUrl('');
      return;
    }
    let raf = 0;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const canvas = requestAvatarCanvas(changeLooksFigure, 4, 'std', 0);
      if (canvas) {
        setChangeLooksPreviewUrl(canvas.toDataURL());
        return;
      }
      raf = window.requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [changeLooksFigure, changeLooksOpen]);

  const activeMainTab = useMemo(
    () => AVATAR_EDITOR_TABS.find(t => t.id === changeLooksMainTab) || AVATAR_EDITOR_TABS[0],
    [changeLooksMainTab]
  );
  const activeSecondaryTab = useMemo(
    () => activeMainTab.tabs[Math.max(0, Math.min(changeLooksSecondTabIdx, activeMainTab.tabs.length - 1))] || activeMainTab.tabs[0],
    [activeMainTab, changeLooksSecondTabIdx]
  );

  useEffect(() => {
    setChangeLooksSecondTabIdx(0);
  }, [changeLooksMainTab]);

  useEffect(() => {
    if (!changeLooksOpen || !activeSecondaryTab) return;
    let cancelled = false;
    getAvatarEditorPartOptions(activeSecondaryTab.type)
      .then((items) => {
        if (cancelled) return;
        const filtered = items
          .filter(i => i.selectable)
          .filter(i => i.gender === 'U' || i.gender === changeLooksGender);
        setChangeLooksParts(filtered);
      })
      .catch(() => {
        if (!cancelled) setChangeLooksParts([]);
      });
    getAvatarEditorPaletteOptions(activeSecondaryTab.type)
      .then((items) => {
        if (!cancelled) setChangeLooksPalette(items);
      })
      .catch(() => {
        if (!cancelled) setChangeLooksPalette([]);
      });
    return () => { cancelled = true; };
  }, [activeSecondaryTab, changeLooksGender, changeLooksOpen]);

  useEffect(() => {
    setChangeLooksVisiblePartCount(36);
  }, [changeLooksOpen, activeSecondaryTab?.type, changeLooksGender]);

  useEffect(() => {
    changeLooksPartPreviewCacheRef.current.clear();
  }, [changeLooksFigure, changeLooksGender, activeSecondaryTab?.type]);

  useEffect(() => {
    return () => {
      if (changeLooksPartPreviewPrefetchRafRef.current !== null) {
        window.cancelAnimationFrame(changeLooksPartPreviewPrefetchRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!changeLooksOpen || !activeSecondaryTab) return;
    const visible = changeLooksParts.slice(0, Math.min(220, changeLooksVisiblePartCount));
    if (visible.length === 0) return;
    const cache = changeLooksPartPreviewCacheRef.current;

    let cancelled = false;
    let cursor = 0;

    const pump = () => {
      if (cancelled) return;
      let changed = false;
      const batchSize = 6;
      let processed = 0;
      while (cursor < visible.length && processed < batchSize) {
        const part = visible[cursor++];
        processed++;
        const partType = activeSecondaryTab.type;
        const current = getFigurePart(changeLooksFigure, partType);
        const colors = current?.colors?.length ? current.colors : ['1'];
        const previewFigure = upsertFigurePart(changeLooksFigure, { type: partType, id: part.id, colors });
        const cacheKey = `${previewFigure}|${changeLooksGender}`;
        if (cache.has(cacheKey)) continue;
        const canvas = requestAvatarCanvas(previewFigure, 4, 'std', 0);
        if (!canvas) continue;
        cache.set(cacheKey, canvas.toDataURL());
        changed = true;
      }

      if (changed) {
        setChangeLooksPartThumbTick((v) => (v + 1) % 100000);
      }
      if (cursor < visible.length) {
        changeLooksPartPreviewPrefetchRafRef.current = window.requestAnimationFrame(pump);
      } else {
        changeLooksPartPreviewPrefetchRafRef.current = null;
      }
    };

    if (changeLooksPartPreviewPrefetchRafRef.current !== null) {
      window.cancelAnimationFrame(changeLooksPartPreviewPrefetchRafRef.current);
      changeLooksPartPreviewPrefetchRafRef.current = null;
    }
    changeLooksPartPreviewPrefetchRafRef.current = window.requestAnimationFrame(pump);

    return () => {
      cancelled = true;
      if (changeLooksPartPreviewPrefetchRafRef.current !== null) {
        window.cancelAnimationFrame(changeLooksPartPreviewPrefetchRafRef.current);
        changeLooksPartPreviewPrefetchRafRef.current = null;
      }
    };
  }, [
    changeLooksOpen,
    activeSecondaryTab,
    changeLooksParts,
    changeLooksVisiblePartCount,
    changeLooksFigure,
    changeLooksGender,
  ]);

  useEffect(() => {
    if (!changeLooksOpen) return;
    const onMove = (ev: MouseEvent | PointerEvent) => {
      const drag = changeLooksDragRef.current;
      if (!drag.dragging) return;
      const dx = ev.clientX - drag.startMouseX;
      const dy = ev.clientY - drag.startMouseY;
      const nextX = drag.startX + dx;
      const nextY = drag.startY + dy;
      const maxX = Math.max(8, window.innerWidth - 390);
      const maxY = Math.max(8, window.innerHeight - 420);
      setChangeLooksPos({
        x: Math.max(8, Math.min(maxX, nextX)),
        y: Math.max(8, Math.min(maxY, nextY)),
      });
    };
    const onUp = () => {
      changeLooksDragRef.current.dragging = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [changeLooksOpen]);

  const applyEditorPart = useCallback(async (partId: string) => {
    if (!activeSecondaryTab) return;
    const partType = activeSecondaryTab.type;
    const current = getFigurePart(changeLooksFigure, partType);
    const paletteCount = await getAvatarEditorPaletteCount(partType, partId).catch(() => 1);
    const colors: string[] = [];
    for (let i = 0; i < Math.max(1, paletteCount); i++) {
      colors.push(current?.colors?.[i] || '1');
    }
    const next = upsertFigurePart(changeLooksFigure, { type: partType, id: partId, colors });
    setChangeLooksFigure(next);
  }, [activeSecondaryTab, changeLooksFigure]);

  const removeEditorPart = useCallback(() => {
    if (!activeSecondaryTab || activeSecondaryTab.required) return;
    setChangeLooksFigure(prev => removeFigurePart(prev, activeSecondaryTab.type));
  }, [activeSecondaryTab]);

  const applyEditorPaletteColor = useCallback((paletteIndex: number, colorId: string) => {
    if (!activeSecondaryTab) return;
    const current = getFigurePart(changeLooksFigure, activeSecondaryTab.type);
    if (!current) return;
    const nextColors = [...current.colors];
    while (nextColors.length <= paletteIndex) nextColors.push('1');
    nextColors[paletteIndex] = colorId;
    const next = upsertFigurePart(changeLooksFigure, { ...current, colors: nextColors });
    setChangeLooksFigure(next);
  }, [activeSecondaryTab, changeLooksFigure]);

  const handleChangeLooksGender = useCallback(async (targetGender: 'M' | 'F') => {
    const requiredPartTypes = ['hd', 'hr', 'ch', 'lg', 'sh'];
    let nextFigure = String(changeLooksFigure || '').trim() || DEFAULT_HABBO_FIGURE;

    for (const partType of requiredPartTypes) {
      const options = await getAvatarEditorPartOptions(partType).catch(() => []);
      const allowed = options
        .filter(o => o.selectable)
        .filter(o => o.gender === 'U' || o.gender === targetGender);
      if (allowed.length === 0) continue;

      const current = getFigurePart(nextFigure, partType);
      const keepCurrent = current && allowed.some(o => o.id === current.id);
      if (keepCurrent) continue;

      const fallback = allowed[0];
      const paletteCount = await getAvatarEditorPaletteCount(partType, fallback.id).catch(() => 1);
      const colors: string[] = [];
      for (let i = 0; i < Math.max(1, paletteCount); i++) {
        colors.push(current?.colors?.[i] || '1');
      }
      nextFigure = upsertFigurePart(nextFigure, { type: partType, id: fallback.id, colors });
    }

    setChangeLooksFigure(nextFigure);
    setChangeLooksGender(targetGender);
  }, [changeLooksFigure]);

  const handleChangeLooksPartsScroll = useCallback(() => {
    const el = changeLooksPartsGridRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 28;
    if (!nearBottom) return;
    setChangeLooksVisiblePartCount(prev => Math.min(220, prev + 24));
  }, []);

  const getEditorPartPreviewUrl = useCallback((partId: string): string => {
    if (!activeSecondaryTab) return '';
    const partType = activeSecondaryTab.type;
    const current = getFigurePart(changeLooksFigure, partType);
    const colors = current?.colors?.length ? current.colors : ['1'];
    const previewFigure = upsertFigurePart(changeLooksFigure, { type: partType, id: partId, colors });
    const cache = changeLooksPartPreviewCacheRef.current;
    const cacheKey = `${previewFigure}|${changeLooksGender}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    return '';
  }, [activeSecondaryTab, changeLooksFigure, changeLooksGender, changeLooksPartThumbTick]);

  const createAvatarPedestrian = useCallback((
    avatar: AvatarSyncState,
    existingPed?: Pedestrian | null
  ): Pedestrian => {
    const startX = Math.max(0, Math.round(Number(avatar.x || 0)));
    const startY = Math.max(0, Math.round(Number(avatar.y || 0)));
    if (existingPed) {
      existingPed.tileX = startX;
      existingPed.tileY = startY;
      existingPed.path = [{ x: startX, y: startY }];
      existingPed.pathIndex = 0;
      existingPed.progress = 0;
      existingPed.state = 'idle';
      existingPed.activity = 'none';
      existingPed.activityDuration = 999999;
      applyAvatarMetadataToPedestrian(existingPed, avatar);
      return existingPed;
    }

    const appearance = normalizeAvatarAppearanceConfig(avatar.avatarConfig || DEFAULT_AVATAR_APPEARANCE);

    pedestrianIdRef.current++;
    const ped: Pedestrian = {
      id: pedestrianIdRef.current,
      tileX: startX,
      tileY: startY,
      direction: 'south',
      progress: 0,
      speed: 0.62,
      age: 0,
      maxAge: 999999,
      skinColor: appearance.skinColor,
      shirtColor: appearance.shirtColor,
      pantsColor: appearance.pantsColor,
      hasHat: appearance.hatStyle !== 'none',
      hatColor: appearance.hatColor,
      walkOffset: Math.random() * Math.PI * 2,
      sidewalkSide: 'left',
      destType: 'tree',
      homeX: startX,
      homeY: startY,
      destX: startX,
      destY: startY,
      returningHome: false,
      path: [{ x: startX, y: startY }],
      pathIndex: 0,
      state: 'idle',
      activity: 'none',
      activityProgress: 0,
      activityDuration: 999999,
      buildingEntryProgress: 0,
      socialTarget: null,
      activityOffsetX: 0,
      activityOffsetY: 0,
      activityAnimTimer: Math.random() * Math.PI * 2,
      hasBall: false,
      hasDog: false,
      hasBag: false,
      hasBeachMat: false,
      matColor: '#7c3aed',
      beachTileX: -1,
      beachTileY: -1,
      beachEdge: null,
      isNpcWorker: true,
      npcType: 'avatar_test',
      avatarServerId: avatar.id,
      avatarOwnerId: avatar.ownerPlayerId,
      avatarLabel: avatar.ownerName || 'Avatar',
      avatarFigure: resolveAvatarFigure(avatar),
      avatarSpeechBubbles: [],
      avatarHeadShape: appearance.headShape,
      avatarEyeStyle: appearance.eyeStyle,
      avatarHatStyle: appearance.hatStyle,
      avatarHairStyle: appearance.hairStyle,
      avatarEyeColor: appearance.eyeColor,
      avatarHairColor: appearance.hairColor,
    };
    avatarServerToPedIdRef.current.set(avatar.id, ped.id);
    return ped;
  }, [applyAvatarMetadataToPedestrian]);

  const pushSpeechBubbleToLocalAvatar = useCallback((text: string) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const avatarId = localAvatarServerIdRef.current;
    if (!avatarId) return;
    const ped = findPedestrianByAvatarId(avatarId);
    if (!ped) return;
    const next = [...(ped.avatarSpeechBubbles || []), {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text: trimmed.slice(0, 80),
      createdAt: Date.now(),
    }];
    ped.avatarSpeechBubbles = next.slice(-5);
  }, [findPedestrianByAvatarId]);

  const pushSpeechBubbleToNamedAvatar = useCallback((text: string, userName?: string) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const normalized = String(userName || '').trim().toLowerCase();
    if (!normalized) {
      pushSpeechBubbleToLocalAvatar(trimmed);
      return;
    }
    const target = pedestriansRef.current.find(p =>
      p.npcType === 'avatar_test' &&
      String(p.avatarLabel || '').trim().toLowerCase() === normalized
    );
    if (!target) {
      pushSpeechBubbleToLocalAvatar(trimmed);
      return;
    }
    const next = [...(target.avatarSpeechBubbles || []), {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text: trimmed.slice(0, 80),
      createdAt: Date.now(),
    }];
    target.avatarSpeechBubbles = next.slice(-5);
  }, [pushSpeechBubbleToLocalAvatar]);

  const waveToAvatar = useCallback((avatarId: string) => {
    const ped = findPedestrianByAvatarId(avatarId);
    if (!ped) return;
    ped.avatarAction = 'wav';
    ped.avatarActionUntil = Date.now() + 1800;
  }, [findPedestrianByAvatarId]);

  const danceWithAvatar = useCallback((avatarId: string) => {
    const ped = findPedestrianByAvatarId(avatarId);
    if (!ped) return;
    // Wenn Avatar bereits tanzt -> stoppen, sonst 8 Sekunden tanzen
    if (ped.avatarAction === 'dnc' && Number(ped.avatarActionUntil || 0) > Date.now()) {
      ped.avatarAction = 'std';
      ped.avatarActionUntil = 0;
    } else {
      ped.avatarAction = 'dnc';
      ped.avatarActionUntil = Date.now() + 8000;
    }
  }, [findPedestrianByAvatarId]);

  const sendAvatarQuickChatMessage = useCallback(async () => {
    const text = avatarQuickChatInput.trim();
    if (!text || avatarQuickChatSending) return;

    // In Public Rooms: Raum-Chat per WebSocket (nicht Gemeinde-Chat)
    if (showPublicRoomWalls) {
      setAvatarQuickChatSending(true);
      try {
        deltaQueue.sendRoomChat(text);
        setAvatarQuickChatInput('');
        // Speech-Bubble für eigenen Avatar wird über den room-chat Listener gesetzt
      } catch (err) {
        console.error('Failed to send room chat message:', err);
        addNotification('Fehler', 'Nachricht konnte nicht gesendet werden', 'default');
      } finally {
        setAvatarQuickChatSending(false);
      }
      return;
    }

    // Normale Gemeinde: Chat über API
    if (!municipalitySlug) {
      addNotification('Fehler', 'Keine Gemeinde aktiv', 'default');
      return;
    }

    setAvatarQuickChatSending(true);
    try {
      const response = await chatApi.sendChatMessage(municipalitySlug, text);
      if (response.success) {
        setAvatarQuickChatInput('');
        if (typeof window !== 'undefined') {
          if (response.data.message?.id) {
            window.dispatchEvent(new CustomEvent('chat-own-message-sent', {
              detail: {
                messageId: response.data.message.id,
                userId: response.data.message?.user?.id,
              },
            }));
          }
          window.dispatchEvent(new CustomEvent('avatar-chat-message', {
            detail: {
              text,
              userName: response.data.message?.user?.name || getLocalAvatarDisplayName(),
            },
          }));
        }
      }
    } catch (err) {
      console.error('Failed to send avatar quick chat message:', err);
      addNotification('Fehler', 'Nachricht konnte nicht gesendet werden', 'default');
    } finally {
      setAvatarQuickChatSending(false);
    }
  }, [avatarQuickChatInput, avatarQuickChatSending, municipalitySlug, showPublicRoomWalls, addNotification]);

  const renderAvatarQuickChatForm = () => (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void sendAvatarQuickChatMessage();
      }}
    >
      <Input
        value={avatarQuickChatInput}
        onChange={(e) => setAvatarQuickChatInput(e.target.value)}
        placeholder="Chat..."
        maxLength={240}
        className="h-8 w-[260px] bg-background/90"
        disabled={avatarQuickChatSending}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void sendAvatarQuickChatMessage();
          }
        }}
      />
      <Button
        type="submit"
        size="sm"
        className="h-8"
        disabled={!avatarQuickChatInput.trim() || avatarQuickChatSending}
      >
        {avatarQuickChatSending ? '...' : 'Senden'}
      </Button>
    </form>
  );

  const applyAvatarMoveToPedestrian = useCallback((
    ped: Pedestrian,
    avatar: AvatarSyncState
  ) => {
    const prevPath = Array.isArray(ped.path) ? ped.path : [];
    const prevIndex = Math.max(0, Math.min(ped.pathIndex ?? 0, Math.max(0, prevPath.length - 1)));
    const prevCurrent = prevPath[prevIndex];
    const prevNext = prevPath[prevIndex + 1];
    const wasWalking = ped.state === 'walking' && prevPath.length >= 2;

    const path = Array.isArray(avatar.path) ? avatar.path : [];
    let normalizedPath = path
      .map(step => ({ x: Math.round(Number(step.x)), y: Math.round(Number(step.y)) }))
      .filter(step => Number.isFinite(step.x) && Number.isFinite(step.y));

    if (normalizedPath.length < 2) {
      // Bei Klick-Spam nicht abrupt in idle springen, solange der Avatar noch läuft.
      if (wasWalking) return;

      ped.tileX = Math.round(Number(avatar.x));
      ped.tileY = Math.round(Number(avatar.y));
      ped.path = [{ x: ped.tileX, y: ped.tileY }];
      ped.pathIndex = 0;
      ped.progress = 0;
      ped.state = 'idle';
      ped.activity = 'none';
      ped.activityDuration = 999999;
      return;
    }

    let nextProgress = 0;
    let nextTileX = normalizedPath[0].x;
    let nextTileY = normalizedPath[0].y;

    if (wasWalking && prevCurrent) {
      const startsAtCurrent = isSameGridStep(normalizedPath[0], prevCurrent);
      const startsAtNext = isSameGridStep(normalizedPath[0], prevNext);

      if (!startsAtCurrent) {
        // Aktuelle Segmentposition als Anker vorne lassen -> kein Teleport-Sprung.
        normalizedPath = [prevCurrent, ...normalizedPath];
      }

      // Bewegungsphase beibehalten, damit Laufanimation nicht stoppt.
      nextProgress = Math.max(0, Math.min(0.98, ped.progress ?? 0));
      nextTileX = prevCurrent.x;
      nextTileY = prevCurrent.y;

      if (startsAtNext && prevNext) {
        // Falls der neue Pfad am nächsten Tile beginnt, trotzdem beim aktuellen Segment bleiben.
        normalizedPath = [prevCurrent, ...normalizedPath];
      }
    }

    ped.path = normalizedPath;
    ped.pathIndex = 0;
    ped.progress = nextProgress;
    ped.state = 'walking';
    ped.activity = 'none';
    ped.activityDuration = 999999;
    ped.destX = normalizedPath[normalizedPath.length - 1].x;
    ped.destY = normalizedPath[normalizedPath.length - 1].y;
    ped.returningHome = false;
    ped.tileX = nextTileX;
    ped.tileY = nextTileY;

    avatarDebugLog('applyMove', {
      newState: 'walking',
      tileX: nextTileX, tileY: nextTileY,
      direction: ped.direction,
      pathLength: normalizedPath.length,
      dest: `(${ped.destX},${ped.destY})`,
      path: normalizedPath.slice(0, 6).map(p => `(${p.x},${p.y})`).join(' → '),
      progress: nextProgress.toFixed(3),
    }, false);
  }, []);

  const getAvatarRepathStart = useCallback((ped: Pedestrian): { x: number; y: number } => {
    if (!Array.isArray(ped.path) || ped.path.length === 0) {
      return { x: ped.tileX, y: ped.tileY };
    }

    const currentIndex = Math.max(0, Math.min(ped.pathIndex ?? 0, ped.path.length - 1));
    const currentStep = ped.path[currentIndex] ?? { x: ped.tileX, y: ped.tileY };
    // Immer vom aktuellen Segment starten, damit bei schnellen Mehrfachklicks
    // keine Vor-/Rueckwaertsspruenge entstehen.
    return { x: currentStep.x, y: currentStep.y };
  }, []);

  // NPC-Spawn-Callback setzen (nachdem pedestriansRef existiert)
  spawnNpcCallbackRef.current = (x: number, y: number) => {
    const currentGrid = latestStateRef.current.grid;
    const currentGridSize = latestStateRef.current.gridSize;
    const currentTool = latestStateRef.current.selectedTool;

    if (forceAvatarSpawnRef.current || showPublicRoomWalls) {
      forceAvatarSpawnRef.current = false;
      const localAvatarId = localAvatarServerIdRef.current || `${LOCAL_AVATAR_SERVER_ID_PREFIX}${deltaQueue.id}`;
      localAvatarServerIdRef.current = localAvatarId;
      setHasLocalAvatar(true);
      const ownerName = getLocalAvatarDisplayName();
      const avatarConfig = getLocalAvatarAppearanceConfig();

      let ped = findPedestrianByAvatarId(localAvatarId);
      if (!ped) {
        const avatarState: AvatarSyncState = {
          id: localAvatarId,
          ownerPlayerId: deltaQueue.id,
          ownerName,
          avatarConfig,
          x,
          y,
          targetX: x,
          targetY: y,
          path: [{ x, y }],
          updatedAt: Date.now(),
        };
        ped = createAvatarPedestrian(avatarState, null);
        pedestriansRef.current = [...pedestriansRef.current, ped];
        deltaQueue.sendAvatarSpawn({ x, y, ownerName, avatarConfig });
        return;
      }

      const { x: fromX, y: fromY } = getAvatarRepathStart(ped);
      const path = findAvatarPath(fromX, fromY, x, y);
      avatarDebugLog('CLICK', {
        clickedTile: `(${x},${y})`,
        avatarFrom: `(${fromX},${fromY})`,
        pathLength: path.length,
        path: path.slice(0, 8).map(p => `(${p.x},${p.y})`).join(' → '),
        pedState: ped.state,
        pedDirection: ped.direction,
        pedTile: `(${ped.tileX},${ped.tileY})`,
      }, false);
      if (path.length < 2) return;
      applyAvatarMoveToPedestrian(ped, {
        id: localAvatarId,
        ownerPlayerId: deltaQueue.id,
        ownerName,
        avatarConfig,
        x: fromX,
        y: fromY,
        targetX: x,
        targetY: y,
        path,
      });
      deltaQueue.sendAvatarMove({
        avatarId: localAvatarId,
        x,
        y,
        path,
      });
      // Lokale Klickbewegung kurzzeitig gegen alte Server-Snapshots schuetzen.
      localAvatarMoveLockUntilRef.current = Date.now() + 1400;
    } else if (currentTool === 'npc_woodcutter') {
      // === HOLZFÄLLER spawnen ===
      const existingNpcs = pedestriansRef.current
        .filter(p => p.isNpcWorker && p.npcType === 'woodcutter')
        .map(p => ({ x: p.destX, y: p.destY }));

      const target = findNearestTreeUtil(currentGrid, currentGridSize, x, y, existingNpcs);
      if (!target) {
        console.log('[NPC] Kein Baum in der Nähe gefunden (Radius: 15 Tiles)');
        return;
      }

      const fullPath = buildDirectGridPathUtil(x, y, target.treeX, target.treeY);
      if (fullPath.length < 2) {
        console.log('[NPC] Pfad zu kurz - Baum zu nah oder kein Weg');
        return;
      }

      let dir: 'north' | 'east' | 'south' | 'west' = 'south';
      if (fullPath.length > 1) {
        const dx = fullPath[1].x - fullPath[0].x;
        const dy = fullPath[1].y - fullPath[0].y;
        if (dx > 0) dir = 'south';
        else if (dx < 0) dir = 'north';
        else if (dy > 0) dir = 'west';
        else if (dy < 0) dir = 'east';
      }

      pedestrianIdRef.current++;
      const npc = createWoodcutterNpcUtil(
        pedestrianIdRef.current,
        x, y,
        target.treeX, target.treeY,
        fullPath,
        dir
      );

      pedestriansRef.current = [...pedestriansRef.current, npc];
      console.log(`[NPC] 🪓 Holzfäller #${npc.id} gespawnt bei (${x},${y}) → Baum (${target.treeX},${target.treeY}), Pfad: ${fullPath.length} Tiles`);
    } else if (currentTool === 'npc_gardener') {
      // === GÄRTNER spawnen ===
      const existingNpcs = pedestriansRef.current
        .filter(p => p.isNpcWorker && p.npcType === 'gardener')
        .map(p => ({ x: p.destX, y: p.destY }));

      const target = findNearestGrassUtil(currentGrid, currentGridSize, x, y, existingNpcs);
      if (!target) {
        console.log('[NPC] Kein leeres Gras-Tile in der Nähe gefunden (Radius: 15 Tiles)');
        return;
      }

      const fullPath = buildDirectGridPathUtil(x, y, target.grassX, target.grassY);
      if (fullPath.length < 2) {
        console.log('[NPC] Pfad zu kurz - Gras zu nah oder kein Weg');
        return;
      }

      let dir: 'north' | 'east' | 'south' | 'west' = 'south';
      if (fullPath.length > 1) {
        const dx = fullPath[1].x - fullPath[0].x;
        const dy = fullPath[1].y - fullPath[0].y;
        if (dx > 0) dir = 'south';
        else if (dx < 0) dir = 'north';
        else if (dy > 0) dir = 'west';
        else if (dy < 0) dir = 'east';
      }

      pedestrianIdRef.current++;
      const npc = createGardenerNpcUtil(
        pedestrianIdRef.current,
        x, y,
        target.grassX, target.grassY,
        fullPath,
        dir
      );

      pedestriansRef.current = [...pedestriansRef.current, npc];
      console.log(`[NPC] 🌱 Gärtner #${npc.id} gespawnt bei (${x},${y}) → Gras (${target.grassX},${target.grassY}), Pfad: ${fullPath.length} Tiles`);
    } else if (currentTool === 'npc_gangster') {
      // === NUR GANGSTER spawnen (läuft alleine rum) ===

      // Zufälliges Ziel zum Hinlaufen
      const targetX = Math.max(2, Math.min(currentGridSize - 3, x + Math.floor(Math.random() * 15) - 7));
      const targetY = Math.max(2, Math.min(currentGridSize - 3, y + Math.floor(Math.random() * 15) - 7));

      const gangsterPath = buildDirectGridPathUtil(x, y, targetX, targetY);
      if (gangsterPath.length < 2) {
        console.log('[NPC] Gangster-Pfad zu kurz');
        return;
      }

      let gangsterDir: 'north' | 'east' | 'south' | 'west' = 'south';
      if (gangsterPath.length > 1) {
        const dx = gangsterPath[1].x - gangsterPath[0].x;
        const dy = gangsterPath[1].y - gangsterPath[0].y;
        if (dx > 0) gangsterDir = 'south';
        else if (dx < 0) gangsterDir = 'north';
        else if (dy > 0) gangsterDir = 'west';
        else if (dy < 0) gangsterDir = 'east';
      }

      pedestrianIdRef.current++;
      const gangster = createGangsterNpcUtil(
        pedestrianIdRef.current,
        x, y,
        0, // Kein Polizist zugewiesen (noch)
        targetX, targetY,
        gangsterPath,
        gangsterDir
      );

      pedestriansRef.current = [...pedestriansRef.current, gangster];
      console.log(`[NPC] 💀 Gangster #${gangster.id} gespawnt bei (${x},${y}) - läuft rum`);

    } else if (currentTool === 'npc_police_chase') {
      // === NUR POLIZIST spawnen (sucht nächsten Gangster) ===

      // Finde nächsten freien Gangster (der noch nicht gejagt wird)
      const allPolice = pedestriansRef.current.filter(p => p.isNpcWorker && p.npcType === 'police');
      const chasedGangsterIds = new Set(allPolice.map(p => p.npcChaseTargetId).filter(id => id && id > 0));

      const freeGangster = pedestriansRef.current.find(p =>
        p.isNpcWorker && p.npcType === 'gangster' && !chasedGangsterIds.has(p.id)
      );

      // Ziel: Gangster-Position oder Klickpunkt
      const targetX = freeGangster ? freeGangster.tileX : x;
      const targetY = freeGangster ? freeGangster.tileY : y;

      const policePath = buildDirectGridPathUtil(x, y, targetX, targetY);
      if (policePath.length < 2) {
        // Fallback: kurzer Pfad in zufällige Richtung
        const fallbackX = Math.max(2, Math.min(currentGridSize - 3, x + 3));
        const fallbackY = Math.max(2, Math.min(currentGridSize - 3, y + 3));
        const fallbackPath = buildDirectGridPathUtil(x, y, fallbackX, fallbackY);
        if (fallbackPath.length < 2) {
          console.log('[NPC] Polizei-Pfad zu kurz');
          return;
        }
        // Nutze Fallback
        policePath.length = 0;
        fallbackPath.forEach(p => policePath.push(p));
      }

      let policeDir: 'north' | 'east' | 'south' | 'west' = 'south';
      if (policePath.length > 1) {
        const dx = policePath[1].x - policePath[0].x;
        const dy = policePath[1].y - policePath[0].y;
        if (dx > 0) policeDir = 'south';
        else if (dx < 0) policeDir = 'north';
        else if (dy > 0) policeDir = 'west';
        else if (dy < 0) policeDir = 'east';
      }

      pedestrianIdRef.current++;
      const police = createPoliceNpcUtil(
        pedestrianIdRef.current,
        x, y,
        freeGangster ? freeGangster.id : 0, // Gangster-ID oder 0 (sucht später)
        targetX, targetY,
        policePath,
        policeDir
      );

      // Gangster bekommt die Polizei-ID zugewiesen (Flucht-Modus)
      if (freeGangster) {
        freeGangster.npcChaseTargetId = police.id;
        freeGangster.activity = 'fleeing';
      }

      pedestriansRef.current = [...pedestriansRef.current, police];
      console.log(`[NPC] 🚔 Polizist #${police.id} gespawnt bei (${x},${y})${freeGangster ? ` → jagt Gangster #${freeGangster.id}` : ' - kein Gangster gefunden, patrouilliert'}`);

    } else if (currentTool === 'npc_buenzli') {
      // === BÜNZLI spawnen (läuft auf Strassen, inspiziert Gebäude) ===

      // Klickpunkt muss auf/neben einer Strasse sein
      let spawnRoadX = x;
      let spawnRoadY = y;
      const clickTile = currentGrid[y]?.[x];
      if (!clickTile || (clickTile.building.type !== 'road' && clickTile.building.type !== 'bridge')) {
        // Finde nächste Strasse zum Klickpunkt
        const nearRoad = findNearestRoadToBuildingUtil(currentGrid, currentGridSize, x, y);
        if (!nearRoad) {
          console.log('[NPC] Keine Strasse in der Nähe gefunden');
          return;
        }
        spawnRoadX = nearRoad.x;
        spawnRoadY = nearRoad.y;
      }

      // Finde nächstes inspizierbares Gebäude mit Strassenanschluss
      const existingBuenzlis = pedestriansRef.current
        .filter(p => p.isNpcWorker && p.npcType === 'buenzli')
        .map(p => ({ x: p.destX, y: p.destY }));

      const target = findNearestInspectableBuildingUtil(currentGrid, currentGridSize, spawnRoadX, spawnRoadY, existingBuenzlis);
      if (!target) {
        console.log('[NPC] Kein inspizierbares Gebäude mit Strassenanschluss gefunden');
        return;
      }

      // Pfad auf Strassen zum Road-Tile neben dem Gebäude
      const buenzliPath = findPathOnRoadsUtil(currentGrid, currentGridSize, spawnRoadX, spawnRoadY, target.roadX, target.roadY);
      if (!buenzliPath || buenzliPath.length < 2) {
        console.log('[NPC] Bünzli-Pfad auf Strassen zu kurz');
        return;
      }

      let buenzliDir: 'north' | 'east' | 'south' | 'west' = 'south';
      if (buenzliPath.length > 1) {
        const dx = buenzliPath[1].x - buenzliPath[0].x;
        const dy = buenzliPath[1].y - buenzliPath[0].y;
        if (dx > 0) buenzliDir = 'south';
        else if (dx < 0) buenzliDir = 'north';
        else if (dy > 0) buenzliDir = 'west';
        else if (dy < 0) buenzliDir = 'east';
      }

      pedestrianIdRef.current++;
      const buenzli = createBuenzliNpcUtil(
        pedestrianIdRef.current,
        spawnRoadX, spawnRoadY,
        target.buildingX, target.buildingY,
        buenzliPath,
        buenzliDir
      );

      pedestriansRef.current = [...pedestriansRef.current, buenzli];
      console.log(`[NPC] 🔍 Bünzli #${buenzli.id} gespawnt auf Strasse (${spawnRoadX},${spawnRoadY}) → Gebäude (${target.buildingX},${target.buildingY}) via Strasse (${target.roadX},${target.roadY})`);
    }
  };

  useEffect(() => {
    const handleSnapshot = (avatars: AvatarSyncState[]) => {
      const idsInSnapshot = new Set<string>();
      for (const avatar of avatars) {
        if (!avatar?.id) continue;
        idsInSnapshot.add(avatar.id);
        if (localAvatarServerIdRef.current === avatar.id) {
          setHasLocalAvatar(true);
        }
        const existing = findPedestrianByAvatarId(avatar.id);
        if (!existing) {
          const created = createAvatarPedestrian(avatar, null);
          pedestriansRef.current = [...pedestriansRef.current, created];
        } else {
          const isLocalAvatar = localAvatarServerIdRef.current === avatar.id;
          const localMoveLocked = isLocalAvatar && Date.now() < localAvatarMoveLockUntilRef.current;
          if (localMoveLocked) {
            applyAvatarMetadataToPedestrian(existing, avatar);
            continue;
          }
          createAvatarPedestrian(avatar, existing);
          // Keep local avatar movement client-smooth while walking.
          // Server updates still refresh appearance/name via createAvatarPedestrian.
          if (!isLocalAvatar || existing.state !== 'walking') {
            applyAvatarMoveToPedestrian(existing, avatar);
          }
        }
      }

      pedestriansRef.current = pedestriansRef.current.filter(p => {
        if (p.npcType !== 'avatar_test' || !p.avatarServerId) return true;
        if (p.avatarServerId === localAvatarServerIdRef.current) return true;
        return idsInSnapshot.has(p.avatarServerId);
      });
    };

    const handleAvatarUpdated = (avatar: AvatarSyncState) => {
      if (!avatar?.id) return;
      if (localAvatarServerIdRef.current === avatar.id) {
        setHasLocalAvatar(true);
      }
      const existing = findPedestrianByAvatarId(avatar.id);
      if (!existing) {
        const created = createAvatarPedestrian(avatar, null);
        applyAvatarMoveToPedestrian(created, avatar);
        pedestriansRef.current = [...pedestriansRef.current, created];
        return;
      }
      const isLocalAvatar = localAvatarServerIdRef.current === avatar.id;
      const localMoveLocked = isLocalAvatar && Date.now() < localAvatarMoveLockUntilRef.current;
      if (localMoveLocked) {
        applyAvatarMetadataToPedestrian(existing, avatar);
        return;
      }
      createAvatarPedestrian(avatar, existing);
      if (!isLocalAvatar || existing.state !== 'walking') {
        applyAvatarMoveToPedestrian(existing, avatar);
      }
    };

    const handleAvatarRemoved = (avatarId: string) => {
      if (!avatarId) return;
      pedestriansRef.current = pedestriansRef.current.filter(p => p.avatarServerId !== avatarId);
      avatarServerToPedIdRef.current.delete(avatarId);
      if (localAvatarServerIdRef.current === avatarId) {
        localAvatarServerIdRef.current = null;
        setHasLocalAvatar(false);
      }
    };

    deltaQueue.setOnAvatarSnapshot(handleSnapshot);
    deltaQueue.setOnAvatarUpdated(handleAvatarUpdated);
    deltaQueue.setOnAvatarRemoved(handleAvatarRemoved);
    return () => {
      deltaQueue.setOnAvatarSnapshot(null);
      deltaQueue.setOnAvatarUpdated(null);
      deltaQueue.setOnAvatarRemoved(null);
    };
  }, [applyAvatarMetadataToPedestrian, applyAvatarMoveToPedestrian, createAvatarPedestrian, findPedestrianByAvatarId]);

  useEffect(() => {
    const spawnLocalAvatarAtDefaultTile = (preferFirstTile: boolean) => {
      forceAvatarSpawnRef.current = true;
      const currentGrid = latestStateRef.current.grid;
      const currentGridSize = latestStateRef.current.gridSize;
      let spawnX = preferFirstTile ? 0 : Math.floor(currentGridSize / 2);
      let spawnY = preferFirstTile ? 0 : Math.floor(currentGridSize / 2);

      if (preferFirstTile) {
        let foundFirst = false;
        for (let y = 0; y < currentGridSize && !foundFirst; y++) {
          for (let x = 0; x < currentGridSize && !foundFirst; x++) {
            if (!isAvatarWalkableTile(currentGrid[y]?.[x])) continue;
            spawnX = x;
            spawnY = y;
            foundFirst = true;
          }
        }
      }

      if (!isAvatarWalkableTile(currentGrid[spawnY]?.[spawnX])) {
        for (let r = 1; r < Math.min(40, currentGridSize); r++) {
          let found = false;
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              const tx = spawnX + dx;
              const ty = spawnY + dy;
              if (tx < 0 || ty < 0 || tx >= currentGridSize || ty >= currentGridSize) continue;
              if (!isAvatarWalkableTile(currentGrid[ty]?.[tx])) continue;
              spawnX = tx;
              spawnY = ty;
              found = true;
            }
          }
          if (found) break;
        }
      }
      spawnNpcCallbackRef.current?.(spawnX, spawnY);
    };

    const onSpawnRequest = () => {
      spawnLocalAvatarAtDefaultTile(false);
    };

    window.addEventListener('avatar-test-spawn-request', onSpawnRequest);
    return () => {
      window.removeEventListener('avatar-test-spawn-request', onSpawnRequest);
    };
  }, [latestStateRef]);

  useEffect(() => {
    if (!showPublicRoomWalls) {
      publicRoomAutoSpawnedRef.current = false;
      return;
    }
    if (publicRoomAutoSpawnedRef.current) return;
    if (localAvatarServerIdRef.current) return;

    const timer = window.setTimeout(() => {
      if (localAvatarServerIdRef.current) return;
      forceAvatarSpawnRef.current = true;
      const currentGrid = latestStateRef.current.grid;
      const currentGridSize = latestStateRef.current.gridSize;
      let spawnX = 0;
      let spawnY = 0;
      let foundFirst = false;
      for (let y = 0; y < currentGridSize && !foundFirst; y++) {
        for (let x = 0; x < currentGridSize && !foundFirst; x++) {
          if (!isAvatarWalkableTile(currentGrid[y]?.[x])) continue;
          spawnX = x;
          spawnY = y;
          foundFirst = true;
        }
      }
      if (!isAvatarWalkableTile(currentGrid[spawnY]?.[spawnX])) {
        spawnX = Math.floor(currentGridSize / 2);
        spawnY = Math.floor(currentGridSize / 2);
        for (let r = 1; r < Math.min(40, currentGridSize); r++) {
          let found = false;
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              const tx = spawnX + dx;
              const ty = spawnY + dy;
              if (tx < 0 || ty < 0 || tx >= currentGridSize || ty >= currentGridSize) continue;
              if (!isAvatarWalkableTile(currentGrid[ty]?.[tx])) continue;
              spawnX = tx;
              spawnY = ty;
              found = true;
            }
          }
          if (found) break;
        }
      }
      spawnNpcCallbackRef.current?.(spawnX, spawnY);
      publicRoomAutoSpawnedRef.current = true;
    }, 180);

    return () => window.clearTimeout(timer);
  }, [showPublicRoomWalls, latestStateRef]);

  useEffect(() => {
    const onAvatarChat = (event: Event) => {
      const custom = event as CustomEvent<{ text?: string; userName?: string }>;
      pushSpeechBubbleToNamedAvatar(custom?.detail?.text || '', custom?.detail?.userName);
    };
    window.addEventListener('avatar-chat-message', onAvatarChat);
    return () => window.removeEventListener('avatar-chat-message', onAvatarChat);
  }, [pushSpeechBubbleToNamedAvatar]);

  // Room-Chat: eingehende Nachrichten per WebSocket als Speech-Bubble anzeigen
  useEffect(() => {
    if (!showPublicRoomWalls) return;
    deltaQueue.setOnRoomChat((data) => {
      pushSpeechBubbleToNamedAvatar(data.text, data.userName);
    });
    return () => {
      deltaQueue.setOnRoomChat(null);
    };
  }, [showPublicRoomWalls, pushSpeechBubbleToNamedAvatar]);

  useEffect(() => {
    const onAvatarConfigUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ config?: AvatarAppearanceConfig }>;
      const avatarId = localAvatarServerIdRef.current;
      if (!avatarId) return;
      const ped = findPedestrianByAvatarId(avatarId);
      if (!ped) return;
      const nextConfig = normalizeAvatarAppearanceConfig(custom?.detail?.config || getLocalAvatarAppearanceConfig());
      applyAvatarAppearanceToPedestrian(ped, nextConfig);
      deltaQueue.sendAvatarSpawn({
        avatarId,
        x: ped.tileX,
        y: ped.tileY,
        ownerName: ped.avatarLabel || getLocalAvatarDisplayName(),
        avatarConfig: nextConfig,
      });
    };
    window.addEventListener('avatar-config-updated', onAvatarConfigUpdated);
    return () => window.removeEventListener('avatar-config-updated', onAvatarConfigUpdated);
  }, [applyAvatarAppearanceToPedestrian, findPedestrianByAvatarId]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
    if (!token) return;
    let cancelled = false;

    const loadAvatarConfigFromSql = async () => {
      try {
        const response = await fetch(`${GAME_API_BASE_URL}/user-data/avatar-config`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Game-Token': token,
          },
        });
        if (!response.ok) return;
        const json = await response.json().catch(() => null);
        if (!json?.success) return;
        const normalized = normalizeAvatarAppearanceConfig(json?.data?.avatar_config || {});
        if (cancelled) return;
        saveAvatarAppearanceToStorage(normalized);
        window.dispatchEvent(new CustomEvent('avatar-config-updated', {
          detail: { config: normalized },
        }));
      } catch {
        // still okay: local storage fallback remains active
      }
    };

    void loadAvatarConfigFromSql();
    return () => {
      cancelled = true;
    };
  }, [applyAvatarAppearanceToPedestrian]);

  // Touch gesture state for mobile
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(zoom);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Airplane system refs
  const airplanesRef = useRef<Airplane[]>([]);
  const airplaneIdRef = useRef(0);
  const airplaneSpawnTimerRef = useRef(0);

  // Helicopter system refs
  const helicoptersRef = useRef<Helicopter[]>([]);
  const helicopterIdRef = useRef(0);
  const helicopterSpawnTimerRef = useRef(0);

  // Bird system refs
  const birdsRef = useRef<BirdFlock[]>([]);
  const birdIdRef = useRef(0);
  const birdSpawnTimerRef = useRef(0);

  // Pixi bird renderer
  const pixiBirdsRef = useRef<PixiBirdRenderer | null>(null);
  const pixiBirdsContainerRef = useRef<HTMLDivElement>(null);

  // Seaplane system refs
  const seaplanesRef = useRef<Seaplane[]>([]);
  const seaplaneIdRef = useRef(0);
  const seaplaneSpawnTimerRef = useRef(0);

  // Boat system refs
  const boatsRef = useRef<Boat[]>([]);
  const boatIdRef = useRef(0);
  const boatSpawnTimerRef = useRef(0);

  // Barge system refs (ocean cargo ships)
  const bargesRef = useRef<Barge[]>([]);
  const bargeIdRef = useRef(0);
  const bargeSpawnTimerRef = useRef(0);

  // Train system refs
  const trainsRef = useRef<Train[]>([]);
  const trainIdRef = useRef(0);
  const trainSpawnTimerRef = useRef(0);

  // Navigation light flash timer for planes/helicopters/boats at night
  const navLightFlashTimerRef = useRef(0);

  // Railroad crossing state
  const crossingFlashTimerRef = useRef(0);
  const crossingGateAnglesRef = useRef<Map<number, number>>(new Map()); // key = y * gridSize + x, value = angle (0=open, 90=closed)
  const crossingPositionsRef = useRef<{ x: number, y: number }[]>([]); // Cached crossing positions for O(1) iteration

  // Firework system refs
  const fireworksRef = useRef<Firework[]>([]);
  const fireworkIdRef = useRef(0);
  const fireworkSpawnTimerRef = useRef(0);
  const fireworkShowActiveRef = useRef(false);
  const fireworkShowStartTimeRef = useRef(0);
  const fireworkLastHourRef = useRef(-1); // Track hour changes to detect night transitions

  // Factory smog system refs
  const factorySmogRef = useRef<FactorySmog[]>([]);
  const smogLastGridVersionRef = useRef(-1); // Track when to rebuild factory list

  // Cloud system refs
  const cloudsRef = useRef<Cloud[]>([]);
  const cloudIdRef = useRef(0);
  const cloudSpawnTimerRef = useRef(0);

  // Traffic light system timer (cumulative time for cycling through states)
  const trafficLightTimerRef = useRef(0);

  // Performance: Cache expensive grid calculations
  const cachedRoadTileCountRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  const cachedPopulationRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });
  // PERF: Cache intersection status per-tile to avoid repeated getDirectionOptions() calls
  const cachedIntersectionMapRef = useRef<{ map: Map<number, boolean>; gridVersion: number }>({ map: new Map(), gridVersion: -1 });
  const gridVersionRef = useRef(0);
  // Cache wind turbine positions (re-scan only when grid changes)
  const windTurbineCacheRef = useRef<{ positions: { screenX: number; screenY: number; level: number; tileX: number; tileY: number }[]; gridVersion: number }>({ positions: [], gridVersion: -1 });
  // Cache woodcutter house positions — verhindert O(gridSize²) full-scan alle 2s im rAF
  const wcHouseCacheRef = useRef<{ positions: { x: number; y: number; level: number }[]; gridVersion: number }>({ positions: [], gridVersion: -1 });

  // Performance: Cache road merge analysis (expensive calculation done per-road-tile)
  const roadAnalysisCacheRef = useRef<Map<string, ReturnType<typeof analyzeMergedRoad>>>(new Map());
  const roadAnalysisCacheVersionRef = useRef(-1);

  // Performance: Cache autobahn merge analysis
  const autobahnMergeInfoCacheRef = useRef(new Map<string, MergedRoadInfo>());
  const autobahnCacheVersionRef = useRef(0);

  // PERF: Cache background gradient - recreate when canvas height or hour changes
  const bgGradientCacheRef = useRef<{ gradient: CanvasGradient | null; height: number; hour: number }>({ gradient: null, height: 0, hour: -1 });

  // Sky: cached star positions (stable per session)
  const skyStarsRef = useRef<{ x: number; y: number; size: number; phase: number }[] | null>(null);

  // PERF: Render queue arrays cached across frames to reduce GC pressure
  // These are cleared at the start of each render frame with .length = 0
  type BuildingDrawItem = { screenX: number; screenY: number; tile: Tile; depth: number };
  type OverlayDrawItem = { screenX: number; screenY: number; tile: Tile };
  const renderQueuesRef = useRef({
    buildingQueue: [] as BuildingDrawItem[],
    waterQueue: [] as BuildingDrawItem[],
    roadQueue: [] as BuildingDrawItem[],
    bridgeQueue: [] as BuildingDrawItem[],
    railQueue: [] as BuildingDrawItem[],
    beachQueue: [] as BuildingDrawItem[],
    baseTileQueue: [] as BuildingDrawItem[],
    greenBaseTileQueue: [] as BuildingDrawItem[],
    overlayQueue: [] as OverlayDrawItem[],
  });

  const worldStateRef = useRef<WorldRenderState>({
    grid,
    gridSize,
    offset,
    zoom,
    speed,
    canvasSize: { width: 1200, height: 800 },
  });
  const [roadDrawDirection, setRoadDrawDirection] = useState<'h' | 'v' | null>(null);
  const placedRoadTilesRef = useRef<Set<string>>(new Set());
  // Track progressive image loading - start true to render immediately with placeholders
  const [imagesLoaded, setImagesLoaded] = useState(true);
  // Counter to trigger re-renders when new images become available
  const [imageLoadVersion, setImageLoadVersion] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [dragStartTile, setDragStartTile] = useState<{ x: number; y: number } | null>(null);
  const [dragEndTile, setDragEndTile] = useState<{ x: number; y: number } | null>(null);
  const [cityConnectionDialog, setCityConnectionDialog] = useState<{ direction: 'north' | 'south' | 'east' | 'west' } | null>(null);
  const keysPressedRef = useRef<Set<string>>(new Set());

  // Reset placementFlipped wenn Tool wechselt
  useEffect(() => {
    setPlacementFlipped(false);
  }, [selectedTool]);

  // Only zoning tools show the grid/rectangle selection visualization
  // Note: zone_water uses supportsDragPlace behavior (place on click/drag) instead of rectangle selection
  const showsDragGrid = ['zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'].includes(selectedTool);

  // Roads, bulldoze, and other tools support drag-to-place but don't show the grid
  const supportsDragPlace = selectedTool !== 'select';

  const PAN_DRAG_THRESHOLD = 6;

  // Use extracted building helpers (with pre-computed tile metadata for O(1) lookups)
  const { isPartOfMultiTileBuilding, findBuildingOrigin, isPartOfParkBuilding, getTileMetadata } = useBuildingHelpers(grid, gridSize);

  // Use extracted vehicle systems
  const vehicleSystemRefs: VehicleSystemRefs = {
    carsRef,
    carIdRef,
    carSpawnTimerRef,
    busesRef,
    busIdRef,
    busSpawnTimerRef,
    emergencyVehiclesRef,
    emergencyVehicleIdRef,
    emergencyDispatchTimerRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
    crimeSpawnTimerRef,
    pedestriansRef,
    pedestrianIdRef,
    pedestrianSpawnTimerRef,
    trafficLightTimerRef,
    trainsRef,
    busLinesRef,
    busLinesGridVersionRef,
    serverBusLinesRef,
  };

  const vehicleSystemState: VehicleSystemState = {
    worldStateRef,
    gridVersionRef,
    cachedRoadTileCountRef,
    cachedIntersectionMapRef,
    state: {
      services: state.services,
      stats: state.stats,
    },
    isMobile,
    visualHour,
    parkedVehiclesRef,
    emitParkVehicleRef,
    emitLeaveParkingRef,
  };

  // Load server bus lines for the municipality (from Transport companies)
  const loadServerBusLines = useCallback(() => {
    if (!municipalitySlug) return;
    import('@/lib/api/busLineApi').then(({ getMunicipalityBusLines }) => {
      getMunicipalityBusLines(municipalitySlug).then(lines => {
        serverBusLinesRef.current = lines;
        busLinesGridVersionRef.current = 0;
      }).catch(() => {});
    });
  }, [municipalitySlug]);

  useEffect(() => { loadServerBusLines(); }, [loadServerBusLines]);

  useEffect(() => {
    const handleBusLinesUpdated = () => loadServerBusLines();
    window.addEventListener('bus-lines-updated', handleBusLinesUpdated);
    return () => window.removeEventListener('bus-lines-updated', handleBusLinesUpdated);
  }, [loadServerBusLines]);


  const {
    spawnRandomCar,
    spawnPartyGuestCar,
    spawnPedestrian,
    spawnCrimeIncidents,
    updateCrimeIncidents,
    findCrimeIncidents,
    dispatchEmergencyVehicle,
    updateEmergencyDispatch,
    updateEmergencyVehicles,
    updateCars,
    updateBuses,
    updatePedestrians,
    drawCars,
    drawBuses,
    drawPedestrians,
    drawRecreationPedestrians,
    drawEmergencyVehicles,
    drawIncidentIndicators,
    debugSpawnBus,
    debugBusInfo,
  } = useVehicleSystems(vehicleSystemRefs, vehicleSystemState);

  // Room-Join: sofort geparkte Autos für laufende Parties vorspawnen
  useEffect(() => {
    const handleSpawnParkedCars = (e: Event) => {
      const { parties } = (e as CustomEvent).detail as {
        parties: import('@/components/game/types').MansionParty[];
      };
      if (!parties?.length) return;
      setTimeout(() => {
        for (const party of parties) {
          if (party.status === 'shutdown') continue;
          // Anzahl vorhandener Autos basierend auf Party-Dauer schätzen
          // (je länger die Party läuft, desto mehr Autos stehen schon dort)
          const durationMin = party.durationMinutes ?? 0;
          const preSpawnCount = Math.min(20, Math.max(3, Math.round(durationMin * 2)));
          for (let i = 0; i < preSpawnCount; i++) {
            const spawned = spawnPartyGuestCar(party.tileX, party.tileY);
            if (spawned) {
              const lastCar = carsRef.current[carsRef.current.length - 1];
              if (lastCar) {
                lastCar.parked = true;
                lastCar.progress = 0.45 + Math.random() * 0.1;
                const curbOffset = 12 + Math.random() * 2;
                lastCar.laneOffset = lastCar.laneOffset >= 0 ? curbOffset : -curbOffset;
                // Restliche Parkzeit zufällig (0–3 Min) — simuliert unterschiedliche Ankunftszeiten
                const remainPark = Math.random() * 180;
                lastCar.parkedUntilAge = lastCar.age + remainPark;
                lastCar.maxAge = lastCar.parkedUntilAge + 90;
                if (Math.random() < 0.5) {
                  const perpDir: Record<string, string> = {
                    north: lastCar.laneOffset > 0 ? 'east' : 'west',
                    south: lastCar.laneOffset > 0 ? 'west' : 'east',
                    east:  lastCar.laneOffset > 0 ? 'south' : 'north',
                    west:  lastCar.laneOffset > 0 ? 'north' : 'south',
                  };
                  lastCar.direction = (perpDir[lastCar.direction] ?? lastCar.direction) as typeof lastCar.direction;
                }
              }
            }
          }
        }
      }, 800);
    };
    window.addEventListener('party-spawn-parked-cars', handleSpawnParkedCars);
    return () => window.removeEventListener('party-spawn-parked-cars', handleSpawnParkedCars);
  }, [spawnPartyGuestCar, carsRef]);

  // Expose bus debug functions on window for DebugPanel
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__debugBus = { spawnBus: debugSpawnBus, getInfo: debugBusInfo };
    return () => { delete (window as unknown as Record<string, unknown>).__debugBus; };
  }, [debugSpawnBus, debugBusInfo]);

  // Gangster/Polizei Notifications (Test-Modus)
  useEffect(() => {
    const onGameNotification = (event: Event) => {
      const { title, message } = (event as CustomEvent<{ title: string; message: string }>).detail;
      addNotification(title, message, 'default');
    };
    window.addEventListener('game-notification', onGameNotification as EventListener);
    return () => window.removeEventListener('game-notification', onGameNotification as EventListener);
  }, [addNotification]);

  // Listen for manual emergency dispatch requests from disaster popup
  useEffect(() => {
    const onDispatchEmergency = (event: Event) => {
      const custom = event as CustomEvent<{ type: 'fire_truck' | 'police_car' | 'ambulance'; targetX: number; targetY: number }>;
      const { type, targetX, targetY } = custom.detail;
      const { grid: g, gridSize: gs } = worldStateRef.current;
      if (!g || gs <= 0) return;
      const stationType = type === 'fire_truck' ? 'fire_station' : type === 'ambulance' ? 'hospital' : 'police_station';
      const stations = findStationsUtil(g, gs, stationType as 'fire_station' | 'police_station' | 'hospital');
      if (stations.length === 0) return;
      let nearest = stations[0];
      let bestDist = Math.abs(nearest.x - targetX) + Math.abs(nearest.y - targetY);
      for (let i = 1; i < stations.length; i++) {
        const dist = Math.abs(stations[i].x - targetX) + Math.abs(stations[i].y - targetY);
        if (dist < bestDist) { nearest = stations[i]; bestDist = dist; }
      }
      dispatchEmergencyVehicle(type, nearest.x, nearest.y, targetX, targetY);
    };
    window.addEventListener('isocity-dispatch-emergency', onDispatchEmergency as EventListener);

    const onSetBuildingFire = (event: Event) => {
      const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
      const { grid: g, gridSize: gs } = worldStateRef.current;
      if (!g || gs <= 0 || x < 0 || y < 0 || x >= gs || y >= gs) return;
      const tile = g[y]?.[x];
      if (!tile || !tile.building) return;
      const skip = ['grass', 'empty', 'water', 'road', 'tree'];
      if (skip.includes(tile.building.type)) return;
      tile.building.onFire = true;
      tile.building.fireProgress = 0;
    };
    window.addEventListener('isocity-set-building-fire', onSetBuildingFire as EventListener);

    return () => {
      window.removeEventListener('isocity-dispatch-emergency', onDispatchEmergency as EventListener);
      window.removeEventListener('isocity-set-building-fire', onSetBuildingFire as EventListener);
    };
  }, [dispatchEmergencyVehicle]);

  // Use extracted aircraft systems
  const aircraftSystemRefs: AircraftSystemRefs = {
    airplanesRef,
    airplaneIdRef,
    airplaneSpawnTimerRef,
    helicoptersRef,
    helicopterIdRef,
    helicopterSpawnTimerRef,
  };

  const aircraftSystemState: AircraftSystemState = {
    worldStateRef,
    gridVersionRef,
    cachedPopulationRef,
    isMobile,
  };

  const {
    updateAirplanes,
    updateHelicopters,
  } = useAircraftSystems(aircraftSystemRefs, aircraftSystemState);

  // Use extracted seaplane system
  const seaplaneSystemRefs: SeaplaneSystemRefs = {
    seaplanesRef,
    seaplaneIdRef,
    seaplaneSpawnTimerRef,
  };

  const seaplaneSystemState: SeaplaneSystemState = {
    worldStateRef,
    gridVersionRef,
    cachedPopulationRef,
    isMobile,
  };

  const {
    updateSeaplanes,
  } = useSeaplaneSystem(seaplaneSystemRefs, seaplaneSystemState);

  // Use extracted barge system
  const bargeSystemRefs: BargeSystemRefs = {
    bargesRef,
    bargeIdRef,
    bargeSpawnTimerRef,
  };

  const bargeSystemState: BargeSystemState = {
    worldStateRef,
    isMobile,
    visualHour,
    onBargeDelivery,
  };

  const {
    updateBarges,
    drawBarges,
  } = useBargeSystem(bargeSystemRefs, bargeSystemState);

  // Use extracted boat system
  const boatSystemRefs: BoatSystemRefs = {
    boatsRef,
    boatIdRef,
    boatSpawnTimerRef,
  };

  const boatSystemState: BoatSystemState = {
    worldStateRef,
    isMobile,
    visualHour,
  };

  const {
    updateBoats,
    drawBoats,
  } = useBoatSystem(boatSystemRefs, boatSystemState);

  // Use extracted effects systems (fireworks and smog)
  const effectsSystemRefs: EffectsSystemRefs = {
    fireworksRef,
    fireworkIdRef,
    fireworkSpawnTimerRef,
    fireworkShowActiveRef,
    fireworkShowStartTimeRef,
    fireworkLastHourRef,
    factorySmogRef,
    smogLastGridVersionRef,
    cloudsRef,
    cloudIdRef,
    cloudSpawnTimerRef,
  };

  const effectsSystemState: EffectsSystemState = {
    worldStateRef,
    gridVersionRef,
    isMobile,
  };

  const {
    updateFireworks,
    drawFireworks,
    updateSmog,
    drawSmog,
    updateClouds,
  } = useEffectsSystems(effectsSystemRefs, effectsSystemState);

  // Use extracted bird system
  const birdSystemRefs: BirdSystemRefs = {
    birdsRef,
    birdIdRef,
    birdSpawnTimerRef,
  };

  const birdSystemState: BirdSystemState = {
    worldStateRef,
    isMobile,
  };

  const { updateBirds } = useBirdSystem(birdSystemRefs, birdSystemState);

  // PERF: Sync worldStateRef from latestStateRef (real-time) instead of React state (throttled)
  // This runs on every animation frame via the render loop, not on React state changes
  useEffect(() => {
    // Initial sync from React state
    worldStateRef.current.grid = grid;
    worldStateRef.current.gridSize = gridSize;
    gridVersionRef.current++;
    crossingPositionsRef.current = findRailroadCrossings(grid, gridSize);
  }, [grid, gridSize]);

  // PERF: Continuously sync from latestStateRef for real-time grid updates
  // This allows canvas to see simulation changes before React state syncs
  useEffect(() => {
    let animFrameId: number;
    let lastGridVersion = 0;

    const syncFromRef = () => {
      animFrameId = requestAnimationFrame(syncFromRef);

      // Only update if latestStateRef has newer data
      const latest = latestStateRef.current;
      if (latest && latest.grid !== worldStateRef.current.grid) {
        worldStateRef.current.grid = latest.grid;
        worldStateRef.current.gridSize = latest.gridSize;
        // Only recalculate crossings if grid actually changed
        const newVersion = gridVersionRef.current + 1;
        if (newVersion !== lastGridVersion) {
          lastGridVersion = newVersion;
          gridVersionRef.current = newVersion;
          crossingPositionsRef.current = findRailroadCrossings(latest.grid, latest.gridSize);
        }
      }
    };

    animFrameId = requestAnimationFrame(syncFromRef);
    return () => cancelAnimationFrame(animFrameId);
  }, [latestStateRef]);

  useEffect(() => {
    worldStateRef.current.offset = offset;
  }, [offset]);

  useEffect(() => {
    worldStateRef.current.zoom = zoom;
  }, [zoom]);

  useEffect(() => {
    worldStateRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    worldStateRef.current.canvasSize = canvasSize;
  }, [canvasSize]);

  // Clear all vehicles/entities when game version changes (new game, load state, etc.)
  useEffect(() => {
    // Clear all vehicle refs
    carsRef.current = [];
    carIdRef.current = 0;
    carSpawnTimerRef.current = 0;
    emergencyVehiclesRef.current = [];
    emergencyVehicleIdRef.current = 0;
    emergencyDispatchTimerRef.current = 0;
    activeFiresRef.current.clear();
    activeCrimesRef.current.clear();
    activeCrimeIncidentsRef.current.clear();
    crimeSpawnTimerRef.current = 0;

    // Clear pedestrians
    pedestriansRef.current = [];
    pedestrianIdRef.current = 0;
    pedestrianSpawnTimerRef.current = 0;
    partyCarSpawnTimerRef.current = 0;
    partyCarExitedRef.current.clear();

    // Clear aircraft
    airplanesRef.current = [];
    airplaneIdRef.current = 0;
    airplaneSpawnTimerRef.current = 0;
    helicoptersRef.current = [];
    helicopterIdRef.current = 0;
    helicopterSpawnTimerRef.current = 0;
    seaplanesRef.current = [];
    seaplaneIdRef.current = 0;
    seaplaneSpawnTimerRef.current = 0;

    // Clear boats
    boatsRef.current = [];
    boatIdRef.current = 0;
    boatSpawnTimerRef.current = 0;

    // Clear barges
    bargesRef.current = [];
    bargeIdRef.current = 0;
    bargeSpawnTimerRef.current = 0;

    // Clear trains
    trainsRef.current = [];
    trainIdRef.current = 0;
    trainSpawnTimerRef.current = 0;

    // Clear fireworks
    fireworksRef.current = [];
    fireworkIdRef.current = 0;
    fireworkSpawnTimerRef.current = 0;
    fireworkShowActiveRef.current = false;

    // Clear factory smog
    factorySmogRef.current = [];
    smogLastGridVersionRef.current = -1;

    // Clear clouds
    cloudsRef.current = [];
    cloudIdRef.current = 0;
    cloudSpawnTimerRef.current = 0;

    // Reset traffic light timer
    trafficLightTimerRef.current = 0;
  }, [gameVersion]);

  // Sync isPanning state to ref for animation loop access
  useEffect(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);

  // Sync zoom state to ref for animation loop access
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const computePublicRoomFitCamera = useCallback(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0 || gridSize <= 0) return null;
    const corners = [
      gridToScreen(0, 0, 0, 0),
      gridToScreen(gridSize - 1, 0, 0, 0),
      gridToScreen(0, gridSize - 1, 0, 0),
      gridToScreen(gridSize - 1, gridSize - 1, 0, 0),
    ];
    const minX = Math.min(...corners.map(c => c.screenX - TILE_WIDTH / 2));
    const maxX = Math.max(...corners.map(c => c.screenX + TILE_WIDTH / 2));
    const minY = Math.min(...corners.map(c => c.screenY));
    const maxY = Math.max(...corners.map(c => c.screenY + TILE_HEIGHT));
    const topWithWall = minY - TILE_HEIGHT * 2.2; // Raumwände oben mit ins Sichtfeld nehmen.
    const roomWidth = Math.max(1, maxX - minX);
    const roomHeight = Math.max(1, maxY - topWithWall);
    const fitZoomX = (canvasSize.width - PUBLIC_ROOM_FIT_PADDING * 2) / roomWidth;
    const fitZoomY = (canvasSize.height - PUBLIC_ROOM_FIT_PADDING * 2) / roomHeight;
    const targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(fitZoomX, fitZoomY)));
    const targetOffset = {
      x: (canvasSize.width - (minX + maxX) * targetZoom) / 2,
      y: (canvasSize.height - (topWithWall + maxY) * targetZoom) / 2,
    };
    return { targetZoom, targetOffset };
  }, [canvasSize.width, canvasSize.height, gridSize]);

  // Public Rooms: Kamera automatisch auf ganzen Raum fitten.
  useEffect(() => {
    if (!showPublicRoomWalls) return;
    if (!isMobile) {
      setZoom(PUBLIC_ROOM_FIXED_DESKTOP_CAMERA.zoom);
      setOffset({
        x: PUBLIC_ROOM_FIXED_DESKTOP_CAMERA.offsetX,
        y: PUBLIC_ROOM_FIXED_DESKTOP_CAMERA.offsetY,
      });
      return;
    }
    const fitCamera = computePublicRoomFitCamera();
    if (!fitCamera) return;
    const { targetZoom, targetOffset } = fitCamera;
    setZoom(targetZoom);
    setOffset(targetOffset);
  }, [showPublicRoomWalls, computePublicRoomFitCamera, isMobile]);

  const nudgePublicRoomCamera = useCallback((dx: number, dy: number, zoomDelta = 0) => {
    if (!showPublicRoomWalls) return;
    if (zoomDelta !== 0) {
      const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + zoomDelta));
      if (nextZoom !== zoom) {
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;
        const worldX = (centerX - offset.x) / zoom;
        const worldY = (centerY - offset.y) / zoom;
        const nextOffset = {
          x: centerX - worldX * nextZoom + dx,
          y: centerY - worldY * nextZoom + dy,
        };
        setOffset(nextOffset);
        setZoom(nextZoom);
        return;
      }
    }
    if (dx !== 0 || dy !== 0) {
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, [showPublicRoomWalls, zoom, offset.x, offset.y, canvasSize.width, canvasSize.height]);

  // Notify parent of viewport changes for minimap + trigger chunk loading
  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
    chunkManager?.onViewportChange({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange, chunkManager]);

  // Keyboard panning (WASD / arrow keys)
  useEffect(() => {
    const pressed = keysPressedRef.current;
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest('input, textarea, select, [contenteditable="true"]');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        pressed.add(key);
        e.preventDefault();
      }
      // R-Taste: Gebäude-Platzierung spiegeln/drehen
      if (key === 'r') {
        setPlacementFlipped((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.delete(key);
    };

    let animationFrameId = 0;
    let lastTime = performance.now();

    const tick = (time: number) => {
      animationFrameId = requestAnimationFrame(tick);
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!pressed.size) return;

      let dx = 0;
      let dy = 0;
      if (pressed.has('w') || pressed.has('arrowup')) dy += KEY_PAN_SPEED * delta;
      if (pressed.has('s') || pressed.has('arrowdown')) dy -= KEY_PAN_SPEED * delta;
      if (pressed.has('a') || pressed.has('arrowleft')) dx += KEY_PAN_SPEED * delta;
      if (pressed.has('d') || pressed.has('arrowright')) dx -= KEY_PAN_SPEED * delta;

      if (dx !== 0 || dy !== 0) {
        const { zoom: currentZoom, gridSize: n, canvasSize: cs } = worldStateRef.current;
        // Calculate bounds inline
        const padding = 100;
        const mapLeft = -(n - 1) * TILE_WIDTH / 2;
        const mapRight = (n - 1) * TILE_WIDTH / 2;
        const mapTop = 0;
        const mapBottom = (n - 1) * TILE_HEIGHT;
        const minOffsetX = padding - mapRight * currentZoom;
        const maxOffsetX = cs.width - padding - mapLeft * currentZoom;
        const minOffsetY = padding - mapBottom * currentZoom;
        const maxOffsetY = cs.height - padding - mapTop * currentZoom;

        setOffset(prev => ({
          x: Math.max(minOffsetX, Math.min(maxOffsetX, prev.x + dx)),
          y: Math.max(minOffsetY, Math.min(maxOffsetY, prev.y + dy)),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      pressed.clear();
    };
  }, []);

  // Find marinas and piers (uses imported utility)
  const findMarinasAndPiersCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findMarinasAndPiers(currentGrid, currentGridSize);
  }, []);

  // Find adjacent water tile (uses imported utility)
  const findAdjacentWaterTileCallback = useCallback((dockX: number, dockY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAdjacentWaterTile(currentGrid, currentGridSize, dockX, dockY);
  }, []);

  // Check if screen position is over water (uses imported utility)
  const isOverWaterCallback = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  }, []);

  // Generate tour waypoints (uses imported utility)
  const generateTourWaypointsCallback = useCallback((startTileX: number, startTileY: number): TourWaypoint[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return generateTourWaypoints(currentGrid, currentGridSize, startTileX, startTileY);
  }, []);

  // Draw airplanes with contrails (uses extracted utility)
  const drawAirplanes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    // Early exit if no airplanes
    if (!currentGrid || currentGridSize <= 0 || airplanesRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 200,
      viewTop: -currentOffset.y / currentZoom - 200,
      viewRight: viewWidth - currentOffset.x / currentZoom + 200,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 200,
    };

    // Use extracted utility function for drawing
    drawAirplanesUtil(ctx, airplanesRef.current, viewBounds, visualHour, navLightFlashTimerRef.current, isMobile);

    ctx.restore();
  }, [visualHour, isMobile]);

  // Draw helicopters with rotor wash (uses extracted utility)
  const drawHelicopters = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    // Early exit if no helicopters
    if (!currentGrid || currentGridSize <= 0 || helicoptersRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 100,
      viewTop: -currentOffset.y / currentZoom - 100,
      viewRight: viewWidth - currentOffset.x / currentZoom + 100,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 100,
    };

    // Use extracted utility function for drawing
    drawHelicoptersUtil(ctx, helicoptersRef.current, viewBounds, visualHour, navLightFlashTimerRef.current, isMobile, currentZoom);

    ctx.restore();
  }, [visualHour, isMobile]);

  // Draw seaplanes with wakes and contrails (uses extracted utility)
  const drawSeaplanes = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    // Early exit if no seaplanes
    if (!currentGrid || currentGridSize <= 0 || seaplanesRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewBounds = {
      viewLeft: -currentOffset.x / currentZoom - 200,
      viewTop: -currentOffset.y / currentZoom - 200,
      viewRight: viewWidth - currentOffset.x / currentZoom + 200,
      viewBottom: viewHeight - currentOffset.y / currentZoom + 200,
    };

    // Use extracted utility function for drawing
    drawSeaplanesUtil(ctx, seaplanesRef.current, viewBounds, visualHour, navLightFlashTimerRef.current, isMobile);

    ctx.restore();
  }, [visualHour, isMobile]);

  // Boats are now handled by useBoatSystem hook (see above)

  // Update trains - spawn, move, and manage lifecycle
  const updateTrains = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Count rail tiles
    const railTileCount = countRailTiles(currentGrid, currentGridSize);

    // No trains if not enough rail
    if (railTileCount < MIN_RAIL_TILES_FOR_TRAINS) {
      trainsRef.current = [];
      return;
    }

    // Calculate max trains based on rail network size - lower limits on mobile
    const maxTrainsLimit = isMobile ? MAX_TRAINS_MOBILE : MAX_TRAINS;
    const trainsPerTile = isMobile ? TRAINS_PER_RAIL_TILES_MOBILE : TRAINS_PER_RAIL_TILES;
    const maxTrains = Math.min(maxTrainsLimit, Math.ceil(railTileCount / trainsPerTile));

    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;

    // Spawn timer - slower on mobile
    const spawnInterval = isMobile ? TRAIN_SPAWN_INTERVAL_MOBILE : TRAIN_SPAWN_INTERVAL;
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      const newTrain = spawnTrain(currentGrid, currentGridSize, trainIdRef);
      if (newTrain) {
        trainsRef.current.push(newTrain);
      }
      trainSpawnTimerRef.current = spawnInterval;
    }

    // Update existing trains (pass all trains for collision detection)
    const allTrains = trainsRef.current;
    trainsRef.current = trainsRef.current.filter(train =>
      updateTrain(train, delta, speedMultiplier, currentGrid, currentGridSize, allTrains, isMobile)
    );
  }, [isMobile]);

  // Draw trains on the rail network
  const drawTrainsCallback = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize, canvasSize: size } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || trainsRef.current.length === 0) {
      return;
    }

    // Skip drawing trains when very zoomed out (for large map performance)
    if (currentZoom < TRAIN_MIN_ZOOM) {
      return;
    }

    drawTrains(ctx, trainsRef.current, currentOffset, currentZoom, size, currentGrid, currentGridSize, visualHour, isMobile);
  }, [visualHour, isMobile]);

  // Fireworks and smog are now handled by useEffectsSystems hook (see above)



  // Progressive image loading - load sprites in background, render immediately
  // Subscribe to image load notifications to trigger re-renders as assets become available
  useEffect(() => {
    const unsubscribe = onImageLoaded(() => {
      // Trigger re-render when any new image loads
      setImageLoadVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  // Load sprite sheets on mount and when sprite pack changes
  // This now runs in background - rendering starts immediately with placeholders
  useEffect(() => {
    // Pre-load all known standalone bottom-offsets from server (fire-and-forget).
    // After the first ever render of a new building the value is saved server-side,
    // so all subsequent loads skip the pixel-scan entirely.
    loadStandaloneOffsetsFromServer().catch(() => {});

    // Load images progressively - each will trigger a re-render when ready
    // Priority: main sprite sheet first, then water, then secondary sheets

    // High priority - main sprite sheet
    loadSpriteImage(currentSpritePack.src, true).catch(console.error);

    // High priority - water texture
    loadImage(WATER_ASSET_PATH).catch(console.error);

    // Medium priority - load secondary sheets after a small delay
    // This allows the main content to render first
    const loadSecondarySheets = () => {
      if (currentSpritePack.constructionSrc) {
        loadSpriteImage(currentSpritePack.constructionSrc, true).catch(console.error);
      }
      if (currentSpritePack.abandonedSrc) {
        loadSpriteImage(currentSpritePack.abandonedSrc, true).catch(console.error);
      }
      if (currentSpritePack.denseSrc) {
        loadSpriteImage(currentSpritePack.denseSrc, true).catch(console.error);
      }
      if (currentSpritePack.parksSrc) {
        loadSpriteImage(currentSpritePack.parksSrc, true).catch(console.error);
      }
      if (currentSpritePack.parksConstructionSrc) {
        loadSpriteImage(currentSpritePack.parksConstructionSrc, true).catch(console.error);
      }
      if (currentSpritePack.farmsSrc) {
        loadSpriteImage(currentSpritePack.farmsSrc, true).catch(console.error);
      }
      if (currentSpritePack.shopsSrc) {
        loadSpriteImage(currentSpritePack.shopsSrc, true).catch(console.error);
      }
      if (currentSpritePack.stationsSrc) {
        loadSpriteImage(currentSpritePack.stationsSrc, true).catch(console.error);
      }
      if (currentSpritePack.modernSrc) {
        loadSpriteImage(currentSpritePack.modernSrc, true).catch(console.error);
      }
      if (currentSpritePack.servicesSrc) {
        loadSpriteImage(currentSpritePack.servicesSrc, true).catch(console.error);
      }
      if (currentSpritePack.infrastructureSrc) {
        loadSpriteImage(currentSpritePack.infrastructureSrc, true).catch(console.error);
      }
      if (currentSpritePack.mansionsSrc) {
        loadSpriteImage(currentSpritePack.mansionsSrc, true).catch(console.error);
      }
      if (currentSpritePack.treesSrc) {
        loadSpriteImage(currentSpritePack.treesSrc, true).catch(console.error);
      }
      if (currentSpritePack.standaloneSrcs) {
        for (const cfg of Object.values(currentSpritePack.standaloneSrcs)) {
          loadSpriteImage(cfg.normal, false, true).catch(console.error);
          if (cfg.construction) loadSpriteImage(cfg.construction, false, true).catch(console.error);
          if (cfg.abandoned) loadSpriteImage(cfg.abandoned, false, true).catch(console.error);
        }
      }
      // Load airplane sprite sheet (always loaded, not dependent on sprite pack)
      loadSpriteImage(AIRPLANE_SPRITE_SRC, false).catch(console.error);
    };

    // Load secondary sheets after 50ms to prioritize first paint
    const timer = setTimeout(loadSecondarySheets, 50);
    return () => clearTimeout(timer);
  }, [currentSpritePack]);

  // PixiJS water layer — direct DOM rendering with displacement animation
  useEffect(() => {
    const layer = new PixiWaterLayer();
    pixiWaterRef.current = layer;
    const dpr = window.devicePixelRatio || 1;
    const physW = canvasSize.width || Math.round(800 * dpr);
    const physH = canvasSize.height || Math.round(600 * dpr);
    layer.init(physW, physH, WATER_ASSET_PATH).then(() => {
      if (layer.canvas && pixiWaterContainerRef.current) {
        pixiWaterContainerRef.current.appendChild(layer.canvas);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          layer.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          layer.resize(physW, physH, Math.round(physW / dpr), Math.round(physH / dpr));
        }
        layer.applyPendingResize();
      }
    }).catch(console.error);
    return () => { layer.destroy(); pixiWaterRef.current = null; };
  }, []);

  // PixiJS building sprites — replaces Canvas 2D drawImage for buildings
  useEffect(() => {
    const renderer = new PixiBuildingRenderer();
    pixiBuildingsRef.current = renderer;
    const dpr = window.devicePixelRatio || 1;
    const bw = canvasSize.width || 800;
    const bh = canvasSize.height || 600;
    renderer.init(
      Math.round(bw * dpr),
      Math.round(bh * dpr),
    ).then(() => {
      if (renderer.canvas && pixiBuildingsContainerRef.current) {
        pixiBuildingsContainerRef.current.appendChild(renderer.canvas);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          renderer.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          renderer.resize(Math.round(bw * dpr), Math.round(bh * dpr), bw, bh);
        }
        renderer.applyPendingResize();
      }
    }).catch(console.error);
    return () => { renderer.destroy(); pixiBuildingsRef.current = null; };
  }, []);

  // PixiJS vehicle layer — renders vehicles with WebGL + headlights at night
  useEffect(() => {
    const renderer = new PixiVehicleRenderer();
    pixiVehiclesRef.current = renderer;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvasSize.width || 800;
    const ch = canvasSize.height || 600;
    renderer.init(
      Math.round(cw * dpr),
      Math.round(ch * dpr),
    ).then(() => {
      if (renderer.canvas && pixiVehiclesContainerRef.current) {
        pixiVehiclesContainerRef.current.appendChild(renderer.canvas);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          renderer.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          renderer.resize(Math.round(cw * dpr), Math.round(ch * dpr), cw, ch);
        }
        renderer.applyPendingResize();
      }
    }).catch(console.error);
    return () => { renderer.destroy(); pixiVehiclesRef.current = null; };
  }, []);

  // PixiJS pedestrian renderer disabled — procedurally drawn pedestrians with high
  // visual variety cause texture cache thrashing that is slower than Canvas 2D.

  // PixiJS cloud layer — replaces Canvas 2D cloud rendering with WebGL
  useEffect(() => {
    const layer = new PixiCloudLayer();
    pixiCloudsRef.current = layer;
    const dpr = window.devicePixelRatio || 1;
    const physW = canvasSize.width || Math.round(800 * dpr);
    const physH = canvasSize.height || Math.round(600 * dpr);
    layer.init(physW, physH).then(() => {
      if (layer.canvas && pixiCloudsContainerRef.current) {
        pixiCloudsContainerRef.current.appendChild(layer.canvas);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          layer.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          layer.resize(physW, physH, Math.round(physW / dpr), Math.round(physH / dpr));
        }
        layer.applyPendingResize();
      }
    }).catch(console.error);
    return () => { layer.destroy(); pixiCloudsRef.current = null; };
  }, []);

  // PixiJS wind turbine layer — renders animated wind turbines with rotating blades
  useEffect(() => {
    const layer = new PixiWindTurbineLayer();
    pixiWindTurbinesRef.current = layer;
    const dpr = window.devicePixelRatio || 1;
    const physW = canvasSize.width || Math.round(800 * dpr);
    const physH = canvasSize.height || Math.round(600 * dpr);
    layer.init(physW, physH).then(() => {
      if (layer.canvas && pixiWindTurbinesContainerRef.current) {
        pixiWindTurbinesContainerRef.current.appendChild(layer.canvas);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          layer.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          layer.resize(physW, physH, Math.round(physW / dpr), Math.round(physH / dpr));
        }
        layer.applyPendingResize();
      }
    }).catch(console.error);
    return () => { layer.destroy(); pixiWindTurbinesRef.current = null; };
  }, []);

  // PixiJS bird layer — renders animated bird flocks with WebGL
  useEffect(() => {
    const renderer = new PixiBirdRenderer();
    pixiBirdsRef.current = renderer;
    const dpr = window.devicePixelRatio || 1;
    const physW = canvasSize.width || Math.round(800 * dpr);
    const physH = canvasSize.height || Math.round(600 * dpr);
    renderer.init(physW, physH).then(() => {
      if (renderer.canvas && pixiBirdsContainerRef.current) {
        pixiBirdsContainerRef.current.appendChild(renderer.canvas);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          renderer.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          renderer.resize(physW, physH, Math.round(physW / dpr), Math.round(physH / dpr));
        }
        renderer.applyPendingResize();
      }
    }).catch(console.error);
    return () => { renderer.destroy(); pixiBirdsRef.current = null; };
  }, []);

  // PixiJS lighting layer — replaces Canvas 2D lighting with WebGL + bloom
  useEffect(() => {
    const lighting = new PixiLightingLayer();
    pixiLightingRef.current = lighting;
    const dpr = window.devicePixelRatio || 1;
    const physW = canvasSize.width || Math.round(800 * dpr);
    const physH = canvasSize.height || Math.round(600 * dpr);
    lighting.init(physW, physH).then(() => {
      if (lighting.canvas && pixiLightingContainerRef.current) {
        pixiLightingContainerRef.current.appendChild(lighting.canvas);
        // Resize to actual container size (ResizeObserver may have fired before init finished)
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          lighting.resize(Math.round(rect.width * dpr), Math.round(rect.height * dpr), rect.width, rect.height);
        } else {
          lighting.resize(physW, physH, Math.round(physW / dpr), Math.round(physH / dpr));
        }
        lighting.applyPendingResize();
        // Initial render immediately after init so darkness is visible without user interaction
        const ws = worldStateRef.current;
        if (ws.grid && ws.gridSize) {
          const hour = new Date().getHours() + new Date().getMinutes() / 60;
          const w = container ? Math.round(container.getBoundingClientRect().width * dpr) : physW;
          const h = container ? Math.round(container.getBoundingClientRect().height * dpr) : physH;
          lighting.render(ws.grid, ws.gridSize, ws.offset, ws.zoom, w, h, hour, isMobile, false);
        }
      }
    }).catch(console.error);
    return () => { lighting.destroy(); pixiLightingRef.current = null; };
  }, []);

  // Building helper functions moved to buildingHelpers.ts

  // Update canvas size on resize with high-DPI support
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current.getBoundingClientRect();

        // Set display size
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        if (hoverCanvasRef.current) {
          hoverCanvasRef.current.style.width = `${rect.width}px`;
          hoverCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (carsCanvasRef.current) {
          carsCanvasRef.current.style.width = `${rect.width}px`;
          carsCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (buildingsCanvasRef.current) {
          buildingsCanvasRef.current.style.width = `${rect.width}px`;
          buildingsCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (pixiWaterRef.current?.initialized) {
          pixiWaterRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (pixiBuildingsRef.current?.initialized) {
          pixiBuildingsRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (pixiVehiclesRef.current?.initialized) {
          pixiVehiclesRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (pixiCloudsRef.current?.initialized) {
          pixiCloudsRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (pixiWindTurbinesRef.current?.initialized) {
          pixiWindTurbinesRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (pixiBirdsRef.current?.initialized) {
          pixiBirdsRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (airCanvasRef.current) {
          airCanvasRef.current.style.width = `${rect.width}px`;
          airCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (lightingCanvasRef.current) {
          lightingCanvasRef.current.style.width = `${rect.width}px`;
          lightingCanvasRef.current.style.height = `${rect.height}px`;
        }
        if (pixiLightingRef.current?.initialized) {
          pixiLightingRef.current.resize(
            Math.round(rect.width * dpr),
            Math.round(rect.height * dpr),
            rect.width,
            rect.height,
          );
        }
        if (uiCanvasRef.current) {
          uiCanvasRef.current.style.width = `${rect.width}px`;
          uiCanvasRef.current.style.height = `${rect.height}px`;
        }

        // Set actual size in memory (scaled for DPI)
        setCanvasSize({
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Collectible spawning system (TEST) - currently disabled for museums
  const collectiblesRef = useRef<Collectible[]>([]);
  collectiblesRef.current = collectibles;

  // Handle collecting money
  const handleCollectMoney = useCallback((collectible: Collectible) => {
    // Remove the collectible
    setCollectibles(prev => prev.filter(c => c.id !== collectible.id));

    // Add money to player
    addMoney(collectible.amount);

    // Show notification
    addNotification(
      '💰 Geld eingesammelt!',
      `+${collectible.amount}$ Bonus`,
      'default'
    );
  }, [addMoney, addNotification]);

  // Main render function - PERF: Uses requestAnimationFrame throttling to batch multiple state updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // PERF: Cancel any pending render to avoid duplicate work
    if (renderPendingRef.current !== null) {
      cancelAnimationFrame(renderPendingRef.current);
    }

    // PERF: Defer render to next animation frame - batches multiple state updates into one render
    renderPendingRef.current = requestAnimationFrame(() => {
      renderPendingRef.current = null;

      // PERF: Throttle main renders at 3x speed to reduce dropped frames
      // At high speed, we can skip some renders since simulation ticks are frequent
      const currentSpeed = worldStateRef.current.speed;
      const now = performance.now();
      const timeSinceLastRender = now - lastMainRenderTimeRef.current;
      const minRenderInterval = currentSpeed === 3 ? 50 : 0; // Skip renders within 50ms at 3x speed

      if (timeSinceLastRender < minRenderInterval) {
        return; // Skip this render, next tick will trigger a new one
      }
      lastMainRenderTimeRef.current = now;

      const dpr = window.devicePixelRatio || 1;

      // Disable image smoothing for crisp pixel art
      ctx.imageSmoothingEnabled = false;

      // Public Rooms: schwarzer Hintergrund statt Himmel-Gradient.
      if (showPublicRoomWalls) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // --- Dynamic Sky Background ---
        const skyHour = visualHour;
        const skyMinute = new Date().getMinutes();
        const skyT = skyHour + skyMinute / 60; // fractional hour (e.g. 14.5 = 14:30)
        const cW = canvas.width;
        const cH = canvas.height;

        // Color interpolation helper
        const lerpColor = (a: number[], b: number[], t: number) => [
          Math.round(a[0] + (b[0] - a[0]) * t),
          Math.round(a[1] + (b[1] - a[1]) * t),
          Math.round(a[2] + (b[2] - a[2]) * t),
        ];
        const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

        // Sky phase colors: [top, mid, bottom]
        const nightTop = [8, 12, 28], nightMid = [12, 18, 35], nightBot = [15, 22, 32];
        const dawnTop = [45, 30, 60], dawnMid = [180, 100, 60], dawnBot = [220, 160, 80];
        const dayTop = [60, 130, 200], dayMid = [110, 170, 220], dayBot = [160, 200, 230];
        const duskTop = [50, 30, 80], duskMid = [180, 80, 50], duskBot = [200, 120, 60];

        let topC: number[], midC: number[], botC: number[];
        if (skyT < 5) {
          // deep night
          topC = nightTop; midC = nightMid; botC = nightBot;
        } else if (skyT < 7) {
          // night -> dawn
          const p = (skyT - 5) / 2;
          topC = lerpColor(nightTop, dawnTop, p);
          midC = lerpColor(nightMid, dawnMid, p);
          botC = lerpColor(nightBot, dawnBot, p);
        } else if (skyT < 9) {
          // dawn -> day
          const p = (skyT - 7) / 2;
          topC = lerpColor(dawnTop, dayTop, p);
          midC = lerpColor(dawnMid, dayMid, p);
          botC = lerpColor(dawnBot, dayBot, p);
        } else if (skyT < 17) {
          // day
          topC = dayTop; midC = dayMid; botC = dayBot;
        } else if (skyT < 19) {
          // day -> dusk
          const p = (skyT - 17) / 2;
          topC = lerpColor(dayTop, duskTop, p);
          midC = lerpColor(dayMid, duskMid, p);
          botC = lerpColor(dayBot, duskBot, p);
        } else if (skyT < 21) {
          // dusk -> night
          const p = (skyT - 19) / 2;
          topC = lerpColor(duskTop, nightTop, p);
          midC = lerpColor(duskMid, nightMid, p);
          botC = lerpColor(duskBot, nightBot, p);
        } else {
          // deep night
          topC = nightTop; midC = nightMid; botC = nightBot;
        }

        // PERF: Cache gradient, invalidate on height or hour change
        const bgCache = bgGradientCacheRef.current;
        const roundedHour = Math.floor(skyT * 4); // quarter-hour precision
        if (!bgCache.gradient || bgCache.height !== cH || bgCache.hour !== roundedHour) {
          const gradient = ctx.createLinearGradient(0, 0, 0, cH);
          gradient.addColorStop(0, rgb(topC));
          gradient.addColorStop(0.45, rgb(midC));
          gradient.addColorStop(1, rgb(botC));
          bgCache.gradient = gradient;
          bgCache.height = cH;
          bgCache.hour = roundedHour;
        }
        ctx.fillStyle = bgCache.gradient;
        ctx.fillRect(0, 0, cW, cH);

        // --- Stars (night only, fade in/out during twilight) ---
        let starAlpha = 0;
        if (skyT < 5) starAlpha = 1;
        else if (skyT < 7) starAlpha = 1 - (skyT - 5) / 2;
        else if (skyT > 21) starAlpha = 1;
        else if (skyT > 19) starAlpha = (skyT - 19) / 2;

        if (starAlpha > 0.02) {
          if (!skyStarsRef.current) {
            const stars: { x: number; y: number; size: number; phase: number }[] = [];
            let seed = 42;
            const seededRand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
            for (let i = 0; i < 100; i++) {
              stars.push({
                x: seededRand(),
                y: seededRand() * 0.6,
                size: 0.5 + seededRand() * 1.5,
                phase: seededRand() * Math.PI * 2,
              });
            }
            skyStarsRef.current = stars;
          }
          const nowMs = Date.now();
          const stars = skyStarsRef.current;
          for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const twinkle = 0.5 + 0.5 * Math.sin(nowMs * 0.001 + s.phase);
            const a = starAlpha * (0.4 + 0.6 * twinkle);
            ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
            ctx.fillRect(s.x * cW, s.y * cH, s.size * dpr, s.size * dpr);
          }
        }

      }

      ctx.save();
      // Scale for device pixel ratio first, then apply zoom
      ctx.scale(dpr * zoom, dpr * zoom);
      ctx.translate(offset.x / zoom, offset.y / zoom);

      // Calculate visible tile range for culling (account for DPR in canvas size)
      const viewWidth = canvas.width / (dpr * zoom);
      const viewHeight = canvas.height / (dpr * zoom);
      const viewLeft = -offset.x / zoom - TILE_WIDTH;
      const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
      const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
      const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;

      // Trade Partner Edge Preview wird NACH dem Grid gezeichnet (siehe unten)

      // PERF: Pre-compute visible diagonal range to skip entire rows of tiles
      // In isometric rendering, screenY = (x + y) * (TILE_HEIGHT / 2), so sum = x + y = screenY * 2 / TILE_HEIGHT
      // Add padding for tall buildings that may extend above their tile position
      const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
      const visibleMaxSum = Math.min(gridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));

      // PERF: Queue array aliases — declared here so buildings section can access them
      // (queue clearing happens inside the cache block below, only when tiles need redraw)
      const queues = renderQueuesRef.current;
      const buildingQueue = queues.buildingQueue;
      const waterQueue = queues.waterQueue;
      const roadQueue = queues.roadQueue;
      const bridgeQueue = queues.bridgeQueue;
      const railQueue = queues.railQueue;
      const beachQueue = queues.beachQueue;
      const baseTileQueue = queues.baseTileQueue;
      const greenBaseTileQueue = queues.greenBaseTileQueue;
      const overlayQueue = queues.overlayQueue;

      // PERF: Insertion sort — declared here so buildings section can call it
      function insertionSortByDepth<T extends { depth: number }>(arr: T[]): void {
        for (let i = 1; i < arr.length; i++) {
          const current = arr[i];
          let j = i - 1;
          // Only move elements that are strictly greater (maintains stability)
          while (j >= 0 && arr[j].depth > current.depth) {
            arr[j + 1] = arr[j];
            j--;
          }
          arr[j + 1] = current;
        }
      }

      // PixiJS buildings layer — declared here so buildings section (after cache block) can access them
      const pixiBuildings = pixiBuildingsRef.current;
      const usePixiBuildings = pixiBuildings?.initialized;

      /** Draw a placed furni on the isometric grid */
      function drawFurni(ctx: CanvasRenderingContext2D, tileScreenX: number, tileScreenY: number, building: Building) {
        const cls = building.furniClassname!;
        const dir = building.furniDirection ?? 2;
        const st = building.furniState ?? 0;
        const cKey = `${cls}_${dir}_${st}`;
        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;

        const cached = _furniCompositeCache[cKey];
        if (!cached || cached === 'loading' || cached === 'error') {
          if (!cached) _loadFurniComposite(cls, dir, st, notifyImageLoaded);
          // Placeholder diamond while loading
          if (cached !== 'error') {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#6B5B00';
            ctx.beginPath();
            ctx.moveTo(tileScreenX + w / 2, tileScreenY);
            ctx.lineTo(tileScreenX + w, tileScreenY + h / 2);
            ctx.lineTo(tileScreenX + w / 2, tileScreenY + h);
            ctx.lineTo(tileScreenX, tileScreenY + h / 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          return;
        }

        // Scale furni to roughly match avatar height (~0.75 of native Habbo 64-size)
        const FURNI_SCALE = 0.75;
        const imgW = (cached.img.naturalWidth || cached.img.width) * FURNI_SCALE;
        const imgH = (cached.img.naturalHeight || cached.img.height) * FURNI_SCALE;

        // Position: use the Habbo anchor point (registration) to center on tile diamond
        const tileCenterX = tileScreenX + w / 2;
        const tileCenterY = tileScreenY + h / 2;
        // The anchor tells us where the "registration point" is within the composite.
        // Align that point with the tile center.
        const drawX = tileCenterX - cached.anchorX * FURNI_SCALE;
        const drawY = tileCenterY - cached.anchorY * FURNI_SCALE;
        ctx.drawImage(cached.img, Math.round(drawX), Math.round(drawY), Math.round(imgW), Math.round(imgH));
      }

      // Map: "tileX,tileY" → { row, col } für player-gewählte Mansion-Variante
      const mansionVariantMap = new Map<string, { row: number; col: number }>();
      if (playerResidences) {
        for (const r of playerResidences) {
          if ((!currentRoomCode || r.room_code === currentRoomCode) &&
              r.mansion_variant_row != null && r.mansion_variant_col != null) {
            mansionVariantMap.set(`${r.tile_x},${r.tile_y}`, {
              row: r.mansion_variant_row,
              col: r.mansion_variant_col,
            });
          }
        }
      }

      // Draw building sprite
      function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile) {
        const buildingType = tile.building.type;
        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;

        // ── Furni (Habbo-style furniture from local assets) ────────
        if ((buildingType === 'furni' || buildingType.startsWith('furni_')) && tile.building.furniClassname) {
          drawFurni(ctx, x, y, tile.building);
          return;
        }

        // Parking lots — procedural isometric drawing
        if (buildingType === 'parking_spot' || buildingType === 'parking_lot' || buildingType === 'parking_lot_large') {
          const size = buildingType === 'parking_lot_large' ? 3 : buildingType === 'parking_lot' ? 2 : 1;
          const tw = w;   // TILE_WIDTH  — ctx already scaled by zoom
          const th = h;   // TILE_HEIGHT
          for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
              const { screenX: tx, screenY: ty } = gridToScreen(tile.x + dx, tile.y + dy, 0, 0);

              // ── Diamond fill (asphalt) ──
              ctx.beginPath();
              ctx.moveTo(tx + tw / 2, ty);
              ctx.lineTo(tx + tw,     ty + th / 2);
              ctx.lineTo(tx + tw / 2, ty + th);
              ctx.lineTo(tx,          ty + th / 2);
              ctx.closePath();
              ctx.fillStyle = '#383838';
              ctx.fill();
              ctx.strokeStyle = '#252525';
              ctx.lineWidth = 0.5;
              ctx.stroke();

              // ── 3 Stellplatz-Trennlinien parallel zur NE-Kante ──
              ctx.strokeStyle = 'rgba(255,255,255,0.75)';
              ctx.lineWidth = 1;
              for (const t of [0.25, 0.5, 0.75]) {
                const sx = tx       + (tw / 2) * t;
                const sy = ty + th / 2 + (th / 2) * t;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + tw / 2, sy - th / 2);
                ctx.stroke();
              }
              // ── Mittellinie in SE-Richtung (teilt in 2×2 = 4 Plätze) ──
              // Von Mitte NW-Kante (tx+tw/4, ty+th/4) nach Mitte SE-Kante (tx+3tw/4, ty+3th/4)
              ctx.strokeStyle = 'rgba(255,255,255,0.6)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(tx + tw / 4,     ty + th / 4);
              ctx.lineTo(tx + tw * 3 / 4, ty + th * 3 / 4);
              ctx.stroke();

              // ── Draw parked cars in this sub-tile's slots ──
              // Cars use the exact same pentagon+windshield+bumper as road cars.
              // Positions are derived mathematically from the parking stall geometry:
              //   Center divider: (tx+tw/4, ty+th/4) → (tx+3tw/4, ty+3th/4)  ["south" dir]
              //   Stall lines: t=0.25/0.5/0.75 along "east" direction, creating 4 strips
              //   Car center = divider midpoint at strip_s ± 0.4*(tw/2, -th/2)
              //   NE-side cars face "west" (nose toward divider), SW-side face "east"
              const parkedHere = parkedVehiclesRef.current.filter(
                (p) => p.tileX === tile.x + dx && p.tileY === tile.y + dy
              );
              if (parkedHere.length > 0) {
                // Road-car angles (matching DIRECTION_META exactly)
                const angleEast = Math.atan2(-th / 2,  tw / 2); // nose NE ≈ -31°
                const angleWest = Math.atan2( th / 2, -tw / 2); // nose SW ≈ +149°
                // 4 Streifen × 2 Seiten = 8 Slots pro Tile
                // Slot-Nummerierung: strip*2 + 0 = NE-Seite, strip*2 + 1 = SW-Seite
                const ex = tw * 0.20; const ey = th * 0.20;
                const SLOTS = [
                  { px: tx + tw/4 + tw/2*0.125 + ex, py: ty + th/4 + th/2*0.125 - ey, angle: angleWest }, // 0: strip0 NE
                  { px: tx + tw/4 + tw/2*0.125 - ex, py: ty + th/4 + th/2*0.125 + ey, angle: angleEast }, // 1: strip0 SW
                  { px: tx + tw/4 + tw/2*0.375 + ex, py: ty + th/4 + th/2*0.375 - ey, angle: angleWest }, // 2: strip1 NE
                  { px: tx + tw/4 + tw/2*0.375 - ex, py: ty + th/4 + th/2*0.375 + ey, angle: angleEast }, // 3: strip1 SW
                  { px: tx + tw/4 + tw/2*0.625 + ex, py: ty + th/4 + th/2*0.625 - ey, angle: angleWest }, // 4: strip2 NE
                  { px: tx + tw/4 + tw/2*0.625 - ex, py: ty + th/4 + th/2*0.625 + ey, angle: angleEast }, // 5: strip2 SW
                  { px: tx + tw/4 + tw/2*0.875 + ex, py: ty + th/4 + th/2*0.875 - ey, angle: angleWest }, // 6: strip3 NE
                  { px: tx + tw/4 + tw/2*0.875 - ex, py: ty + th/4 + th/2*0.875 + ey, angle: angleEast }, // 7: strip3 SW
                ];
                const scale = 0.5;
                for (const pv of parkedHere) {
                  const s = SLOTS[pv.slot % 8];
                  if (!s) continue;
                  ctx.save();
                  ctx.translate(s.px, s.py);
                  ctx.rotate(s.angle);
                  // Body – identical pentagon to road car
                  ctx.fillStyle = pv.color;
                  ctx.beginPath();
                  ctx.moveTo(-10 * scale, -5 * scale);
                  ctx.lineTo( 10 * scale, -5 * scale);
                  ctx.lineTo( 12 * scale,  0);
                  ctx.lineTo( 10 * scale,  5 * scale);
                  ctx.lineTo(-10 * scale,  5 * scale);
                  ctx.closePath();
                  ctx.fill();
                  // Windshield
                  ctx.fillStyle = 'rgba(255,255,255,0.6)';
                  ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);
                  // Bumper
                  ctx.fillStyle = '#111827';
                  ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);
                  // Orange violation dot if this exact slot has an unpaid Schwarzparker
                  const carSlot = pv.slot;
                  const slotViolation = (parkingViolationsRef?.current ?? []).some(
                    (v) => v.tileX === tile.x + dx && v.tileY === tile.y + dy && v.slot === carSlot && v.status === 'unpaid'
                  );
                  if (slotViolation) {
                    ctx.fillStyle = 'rgba(249,115,22,0.9)';
                    ctx.beginPath();
                    ctx.arc(6 * scale, -6 * scale, 3 * scale, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${5 * scale}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText('!', 6 * scale, -4.5 * scale);
                  }
                  ctx.restore();
                }
              }
            }
          }
          return;
        }

        // Handle roads separately with adjacency
        if (buildingType === 'road') {
          drawRoad(ctx, x, y, tile.x, tile.y, zoom, roadDrawingOptions);
          return;
        }

        if (buildingType === 'autobahn') {
          drawAutobahn(ctx, x, y, tile.x, tile.y, zoom, autobahnDrawingOptions);
          return;
        }

        // Handle bridges with special rendering
        if (buildingType === 'bridge') {
          drawBridgeTile(ctx, x, y, tile.building, tile.x, tile.y, zoom);
          return;
        }

        // Draw water tiles underneath marina/pier buildings
        if (!usePixiBuildings && (buildingType === 'marina_docks_small' || buildingType === 'pier_large')) {
          const buildingSize = getBuildingSize(buildingType);
          // Draw water tiles for each tile in the building's footprint
          for (let dx = 0; dx < buildingSize.width; dx++) {
            for (let dy = 0; dy < buildingSize.height; dy++) {
              const tileGridX = tile.x + dx;
              const tileGridY = tile.y + dy;
              const { screenX, screenY } = gridToScreen(tileGridX, tileGridY, 0, 0);
              drawWaterTileAt(ctx, screenX, screenY, tileGridX, tileGridY);
            }
          }
        }

        // Check if this building type has a sprite in the tile renderer, parks sheet, stations sheet, or standalone images
        const activePack = getActiveSpritePack();
        const hasTileSprite = BUILDING_TO_SPRITE[buildingType] ||
          (activePack.parksBuildings && activePack.parksBuildings[buildingType]) ||
          (activePack.stationsVariants && activePack.stationsVariants[buildingType]) ||
          (activePack.standaloneSrcs && activePack.standaloneSrcs[buildingType]) ||
          (activePack.infrastructureVariants && activePack.infrastructureVariants[buildingType]) ||
          (activePack.servicesVariants && activePack.servicesVariants[buildingType]);

        if (hasTileSprite) {
          // Fallback water drawing (used only when PixiJS water layer is not initialized)
          if (buildingType === 'water') {
            const waterImage = getCachedImage(WATER_ASSET_PATH);

            const gridX = tile.x;
            const gridY = tile.y;
            const adjacentWater = {
              north: gridX > 0 && grid[gridY]?.[gridX - 1]?.building.type === 'water',
              east: gridY > 0 && grid[gridY - 1]?.[gridX]?.building.type === 'water',
              south: gridX < gridSize - 1 && grid[gridY]?.[gridX + 1]?.building.type === 'water',
              west: gridY < gridSize - 1 && grid[gridY + 1]?.[gridX]?.building.type === 'water',
            };

            const adjacentCount = (adjacentWater.north ? 1 : 0) + (adjacentWater.east ? 1 : 0) +
              (adjacentWater.south ? 1 : 0) + (adjacentWater.west ? 1 : 0);

            if (waterImage) {
              const tileCenterX = x + w / 2;
              const tileCenterY = y + h / 2;

              const imgW = waterImage.naturalWidth || waterImage.width;
              const imgH = waterImage.naturalHeight || waterImage.height;

              const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
              const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;

              const cropScale = 0.35;
              const cropW = imgW * cropScale;
              const cropH = imgH * cropScale;
              const maxOffsetX = imgW - cropW;
              const maxOffsetY = imgH - cropH;
              const srcX = seedX * maxOffsetX;
              const srcY = seedY * maxOffsetY;

              const expand = w * 0.4;

              const topY = y - (adjacentWater.north && adjacentWater.east ? expand * 0.5 : 0);
              const rightX = x + w + ((adjacentWater.east && adjacentWater.south) ? expand * 0.5 : 0);
              const bottomY = y + h + ((adjacentWater.south && adjacentWater.west) ? expand * 0.5 : 0);
              const leftX = x - ((adjacentWater.west && adjacentWater.north) ? expand * 0.5 : 0);

              const topExpand = (adjacentWater.north && adjacentWater.east) ? expand * 0.3 : 0;
              const rightExpand = (adjacentWater.east && adjacentWater.south) ? expand * 0.3 : 0;
              const bottomExpand = (adjacentWater.south && adjacentWater.west) ? expand * 0.3 : 0;
              const leftExpand = (adjacentWater.west && adjacentWater.north) ? expand * 0.3 : 0;

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(x + w / 2, topY - topExpand);
              ctx.lineTo(rightX + rightExpand, y + h / 2);
              ctx.lineTo(x + w / 2, bottomY + bottomExpand);
              ctx.lineTo(leftX - leftExpand, y + h / 2);
              ctx.closePath();
              ctx.clip();

              const aspectRatio = cropH / cropW;
              const savedAlpha = ctx.globalAlpha;

              const jitterX = (seedX - 0.5) * w * 0.3;
              const jitterY = (seedY - 0.5) * h * 0.3;

              if (zoom < 0.5) {
                const destWidth = w * 1.15;
                const destHeight = destWidth * aspectRatio;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(
                  waterImage,
                  srcX, srcY, cropW, cropH,
                  Math.round(tileCenterX - destWidth / 2),
                  Math.round(tileCenterY - destHeight / 2),
                  Math.round(destWidth),
                  Math.round(destHeight)
                );
              } else if (adjacentCount >= 2) {
                const outerScale = 2.0 + adjacentCount * 0.3;
                const outerWidth = w * outerScale;
                const outerHeight = outerWidth * aspectRatio;
                ctx.globalAlpha = 0.35;
                ctx.drawImage(
                  waterImage,
                  srcX, srcY, cropW, cropH,
                  Math.round(tileCenterX - outerWidth / 2 + jitterX),
                  Math.round(tileCenterY - outerHeight / 2 + jitterY),
                  Math.round(outerWidth),
                  Math.round(outerHeight)
                );

                const coreScale = 1.1;
                const coreWidth = w * coreScale;
                const coreHeight = coreWidth * aspectRatio;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(
                  waterImage,
                  srcX, srcY, cropW, cropH,
                  Math.round(tileCenterX - coreWidth / 2 + jitterX * 0.5),
                  Math.round(tileCenterY - coreHeight / 2 + jitterY * 0.5),
                  Math.round(coreWidth),
                  Math.round(coreHeight)
                );
              } else {
                const destWidth = w * 1.15;
                const destHeight = destWidth * aspectRatio;

                ctx.globalAlpha = 0.95;
                ctx.drawImage(
                  waterImage,
                  srcX, srcY, cropW, cropH,
                  Math.round(tileCenterX - destWidth / 2 + jitterX * 0.3),
                  Math.round(tileCenterY - destHeight / 2 + jitterY * 0.3),
                  Math.round(destWidth),
                  Math.round(destHeight)
                );
              }

              ctx.globalAlpha = savedAlpha;
              ctx.restore();
            } else {
              ctx.fillStyle = '#0ea5e9';
              ctx.beginPath();
              ctx.moveTo(x + w / 2, y);
              ctx.lineTo(x + w, y + h / 2);
              ctx.lineTo(x + w / 2, y + h);
              ctx.lineTo(x, y + h / 2);
              ctx.closePath();
              ctx.fill();
            }
          } else {
            // ===== TILE RENDERER PATH =====
            // Handles both single-tile and multi-tile buildings using extracted sprite utilities

            // Check if building is under construction (constructionProgress < 100)
            const isUnderConstruction = tile.building.constructionProgress !== undefined &&
              tile.building.constructionProgress < 100;

            // Construction has two phases:
            // Phase 1 (0-40%): Foundation/dirt plot phase - just show a dirt mound
            // Phase 2 (40-100%): Construction scaffolding phase - show construction sprite
            const constructionProgress = tile.building.constructionProgress ?? 100;
            const isFoundationPhase = isUnderConstruction && constructionProgress < 40;

            // If in foundation phase, draw the foundation plot and skip sprite rendering
            if (isFoundationPhase) {
              // Get building size to handle multi-tile foundations
              const buildingSize = getBuildingSize(buildingType);

              // For multi-tile buildings, we only draw the foundation from the origin tile
              if (buildingSize.width > 1 || buildingSize.height > 1) {
                // Draw foundation plots for each tile in the footprint
                for (let dy = 0; dy < buildingSize.height; dy++) {
                  for (let dx = 0; dx < buildingSize.width; dx++) {
                    const plotX = x + (dx - dy) * (w / 2);
                    const plotY = y + (dx + dy) * (h / 2);
                    drawFoundationPlot(ctx, plotX, plotY, w, h, zoom);
                  }
                }
              } else {
                // Single-tile building - just draw one foundation
                drawFoundationPlot(ctx, x, y, w, h, zoom);
              }
              return;
            }

            // Use extracted utilities to determine sprite source, coords, scale, and offsets
            const mansionOverride = buildingType === 'mansion'
              ? mansionVariantMap.get(`${tile.x},${tile.y}`) ?? null
              : null;
            const spriteSourceInfo = selectSpriteSource(buildingType, tile.building, tile.x, tile.y, activePack, mansionOverride);
            const filteredSpriteSheet = getCachedImage(spriteSourceInfo.source, true) || getCachedImage(spriteSourceInfo.source);

            if (filteredSpriteSheet) {
              const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
              const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;

              // Calculate sprite coordinates using extracted utility
              const coords = calculateSpriteCoords(buildingType, spriteSourceInfo, sheetWidth, sheetHeight, activePack);

              if (coords) {
                // Calculate scale and offsets using extracted utilities
                const scaleMultiplier = calculateSpriteScale(buildingType, spriteSourceInfo, tile.building, activePack);
                const offsets = calculateSpriteOffsets(buildingType, spriteSourceInfo, tile.building, activePack);

                // Get building size for positioning
                const buildingSize = getBuildingSize(buildingType);
                const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;

                // Calculate draw position for multi-tile buildings
                let drawPosX = x;
                let drawPosY = y;

                if (isMultiTile) {
                  const frontmostOffsetX = buildingSize.width - 1;
                  const frontmostOffsetY = buildingSize.height - 1;
                  const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (w / 2);
                  const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (h / 2);
                  drawPosX = x + screenOffsetX;
                  drawPosY = y + screenOffsetY;
                }

                const isStandaloneVariant =
                  spriteSourceInfo.variantType === 'standalone' ||
                  spriteSourceInfo.variantType === 'standaloneConstruction' ||
                  spriteSourceInfo.variantType === 'standaloneAbandoned';

                // Calculate destination size
                const baseDestWidth = w * 1.2 * scaleMultiplier;
                const aspectRatio = coords.sh / coords.sw;
                const baseDestHeight = baseDestWidth * aspectRatio;

                // standaloneScales acts as a "fill multiplier":
                //   1.0 (default) = visible content fills the footprint exactly
                //   1.1 = 10 % larger than footprint, etc.
                const standaloneScaleFactor = isStandaloneVariant ? (activePack.standaloneScales?.[buildingType] ?? 1) : 1;

                let destWidth: number;
                let destHeight: number;
                let drawX: number;

                if (isStandaloneVariant && isMultiTile) {
                  // Auto-scale: make visible content fill the isometric footprint width,
                  // then apply standaloneScales as a fine-tune multiplier.
                  const hBounds = getStandaloneHorizontalBounds(filteredSpriteSheet as HTMLImageElement);
                  const contentFraction = 1 - hBounds.leftEmptyFraction - hBounds.rightEmptyFraction;
                  const footprintScreenWidth = (buildingSize.width + buildingSize.height) * (w / 2);

                  const autoScale = contentFraction > 0.05
                    ? (footprintScreenWidth / contentFraction / baseDestWidth) * standaloneScaleFactor
                    : standaloneScaleFactor;

                  destWidth  = baseDestWidth  * autoScale;
                  destHeight = baseDestHeight * autoScale;

                  // Auto-center: align visual content center to footprint center
                  const visualCenterFraction = hBounds.leftEmptyFraction + contentFraction / 2;
                  const footprintCenterX = drawPosX + w / 2;
                  drawX = footprintCenterX - visualCenterFraction * destWidth + offsets.horizontal * w;
                } else {
                  destWidth  = baseDestWidth  * standaloneScaleFactor;
                  destHeight = baseDestHeight * standaloneScaleFactor;
                  drawX = drawPosX + w / 2 - destWidth / 2 + offsets.horizontal * w;
                }

                let verticalPush: number;
                if (isMultiTile && isStandaloneVariant) {
                  // Automatically align the visible building base to the front-tile ground.
                  // Scan the PNG once to find how many transparent rows are at the bottom,
                  // then shift the image down by that fraction so the last visible pixel
                  // lands exactly on the front-tile ground line.
                  const emptyBottom = getStandaloneBottomEmptyFraction(filteredSpriteSheet as HTMLImageElement);
                  verticalPush = emptyBottom * destHeight;
                } else if (isMultiTile) {
                  const footprintDepth = buildingSize.width + buildingSize.height - 2;
                  verticalPush = footprintDepth * h * 0.25;
                } else {
                  verticalPush = destHeight * 0.15;
                }
                verticalPush += offsets.vertical * h;
                // Apply pack-level per-building vertical offset override for standalone buildings
                if (isStandaloneVariant) {
                  verticalPush += (activePack.standaloneVerticalOffsets?.[buildingType] ?? 0) * h;
                }

                const drawY = drawPosY + h - destHeight + verticalPush;

                // Determine flip based on road adjacency or random
                const isWaterfrontAsset = requiresWaterAdjacency(buildingType);
                const shouldRoadMirror = (() => {
                  // Standalone buildings: use only the explicit flipped flag (R-key rotation).
                  // shouldRoadMirror XOR logic would invert the user's intent.
                  if (isStandaloneVariant) return false;
                  if (isWaterfrontAsset) return false;

                  const originMetadata = getTileMetadata(tile.x, tile.y);
                  if (originMetadata?.hasAdjacentRoad) {
                    return originMetadata.shouldFlipForRoad;
                  }

                  const mirrorSeed = (tile.x * 47 + tile.y * 83) % 100;
                  return mirrorSeed < 50;
                })();

                const baseFlipped = tile.building.flipped === true;
                const isFlipped = baseFlipped !== shouldRoadMirror;

                const rDrawX = Math.round(drawX);
                const rDrawY = Math.round(drawY);
                const rDestW = Math.round(destWidth);
                const rDestH = Math.round(destHeight);

                const isTree = TREE_BUILDING_TYPES.has(buildingType);

                // Haus-Varianten: subtile Farbtöne für Wohnhäuser (Dach/Wand-Variation)
                const HOUSE_TINTS = [0xFFFFFF, 0xFFF0E0, 0xE8EEFF, 0xF5FFE8, 0xFFE8EE, 0xFFF8E0];
                const houseTint = (buildingType === 'house_small' || buildingType === 'house_medium')
                  ? HOUSE_TINTS[((tile.x * 53 + tile.y * 97) >>> 0) % HOUSE_TINTS.length]
                  : 0xFFFFFF;

                if (usePixiBuildings) {
                  let treeSway = 0;
                  if (isTree) {
                    const w_ = serverWeatherRef.current;
                    const windSpeed = w_?.windspeed ?? 5;
                    const isStorm = w_?.type === 'storm' || w_?.type === 'thunderstorm' || w_?.type === 'blizzard';
                    const windFactor = Math.min(windSpeed / 15, 1) * (isStorm ? 2.5 : 1);
                    const baseAmp = 0.008 + windFactor * 0.035;
                    const gustAmp = 0.004 + windFactor * 0.018;
                    const baseSpeed = 1.0 + windFactor * 1.5;
                    const gustSpeed = 2.2 + windFactor * 2.0;
                    const phase = (tile.x * 2.3 + tile.y * 3.7);
                    const t = Date.now() / 1000;
                    treeSway = Math.sin(t * baseSpeed + phase) * baseAmp + Math.sin(t * gustSpeed + phase * 1.4) * gustAmp;
                  }
                  pixiBuildings!.addSprite(
                    filteredSpriteSheet,
                    coords.sx, coords.sy, coords.sw, coords.sh,
                    rDrawX, rDrawY, rDestW, rDestH,
                    isFlipped,
                    1,
                    treeSway,
                    houseTint,
                  );
                } else if (isTree) {
                  ctx.save();
                  const anchorX = rDrawX + rDestW / 2;
                  const anchorY = rDrawY + rDestH;
                  const w_ = serverWeatherRef.current;
                  const windSpeed = w_?.windspeed ?? 5;
                  const isStorm = w_?.type === 'storm' || w_?.type === 'thunderstorm' || w_?.type === 'blizzard';
                  const windFactor = Math.min(windSpeed / 15, 1) * (isStorm ? 2.5 : 1);
                  const baseAmp = 0.008 + windFactor * 0.035;
                  const gustAmp = 0.004 + windFactor * 0.018;
                  const baseSpeed = 1.0 + windFactor * 1.5;
                  const gustSpeed = 2.2 + windFactor * 2.0;
                  const phase = (tile.x * 2.3 + tile.y * 3.7);
                  const t = Date.now() / 1000;
                  const sway = Math.sin(t * baseSpeed + phase) * baseAmp + Math.sin(t * gustSpeed + phase * 1.4) * gustAmp;
                  ctx.translate(anchorX, anchorY);
                  ctx.transform(1, 0, sway, 1, 0, 0);
                  if (isFlipped) ctx.scale(-1, 1);
                  ctx.translate(-anchorX, -anchorY);
                  ctx.drawImage(
                    filteredSpriteSheet,
                    coords.sx, coords.sy, coords.sw, coords.sh,
                    rDrawX, rDrawY, rDestW, rDestH
                  );
                  ctx.restore();
                } else if (isFlipped) {
                  ctx.save();
                  const centerX = rDrawX + rDestW / 2;
                  ctx.translate(centerX, 0);
                  ctx.scale(-1, 1);
                  ctx.translate(-centerX, 0);
                  ctx.drawImage(
                    filteredSpriteSheet,
                    coords.sx, coords.sy, coords.sw, coords.sh,
                    rDrawX, rDrawY, rDestW, rDestH
                  );
                  ctx.restore();
                } else {
                  ctx.drawImage(
                    filteredSpriteSheet,
                    coords.sx, coords.sy, coords.sw, coords.sh,
                    rDrawX, rDrawY, rDestW, rDestH
                  );
                }
              }

            } else {
              // Sprite sheet not loaded yet - draw placeholder building
              drawPlaceholderBuilding(ctx, x, y, buildingType, w, h);
            }
          }
        }

        // Draw fire effect
        if (tile.building.onFire) {
          const fireX = x + w / 2;
          const fireY = y - 10;

          ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
          ctx.beginPath();
          ctx.ellipse(fireX, fireY, 18, 25, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
          ctx.beginPath();
          ctx.ellipse(fireX, fireY + 5, 10, 15, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
          ctx.beginPath();
          ctx.ellipse(fireX, fireY + 8, 5, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Helper function to check if a tile is water
      function isWater(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
        return grid[gridY][gridX].building.type === 'water';
      }

      // Helper function to check if a tile has a road or bridge
      function hasRoad(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
        const type = grid[gridY][gridX].building.type;
        return type === 'road' || type === 'bridge';
      }

      // Helper function to check if a tile has an autobahn
      function hasAutobahn(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
        return grid[gridY][gridX].building.type === 'autobahn';
      }

      // Helper function to check if a tile is a bridge (for beach exclusion)
      function isBridge(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
        return grid[gridY][gridX].building.type === 'bridge';
      }

      // Helper function to check if a tile has a marina dock or pier (no beaches next to these)
      // Also checks 'empty' tiles that are part of multi-tile marina buildings
      function hasMarinaPier(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return false;
        const buildingType = grid[gridY][gridX].building.type;
        if (buildingType === 'marina_docks_small' || buildingType === 'pier_large') return true;

        // Check if this is an 'empty' tile that belongs to a marina (2x2 building)
        // Marina is 2x2, so check up to 1 tile away for the origin
        if (buildingType === 'empty') {
          for (let dy = 0; dy <= 1; dy++) {
            for (let dx = 0; dx <= 1; dx++) {
              const checkX = gridX - dx;
              const checkY = gridY - dy;
              if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
                const checkType = grid[checkY][checkX].building.type;
                if (checkType === 'marina_docks_small') {
                  // Verify this tile is within the 2x2 footprint
                  if (gridX >= checkX && gridX < checkX + 2 && gridY >= checkY && gridY < checkY + 2) {
                    return true;
                  }
                }
              }
            }
          }
        }
        return false;
      }

      // Helper to get cached road merge analysis (invalidates when grid changes)
      function getCachedMergeInfo(gx: number, gy: number): ReturnType<typeof analyzeMergedRoad> {
        const currentVersion = gridVersionRef.current;
        if (roadAnalysisCacheVersionRef.current !== currentVersion) {
          roadAnalysisCacheRef.current.clear();
          roadAnalysisCacheVersionRef.current = currentVersion;
        }

        const key = `${gx},${gy}`;
        let info = roadAnalysisCacheRef.current.get(key);
        if (!info) {
          info = analyzeMergedRoad(grid, gridSize, gx, gy);
          roadAnalysisCacheRef.current.set(key, info);
        }
        return info;
      }

      // Create road drawing options for the extracted drawRoad function
      const roadDrawingOptions: RoadDrawingOptions = {
        hasRoad,
        getMergeInfo: getCachedMergeInfo,
        isMobile,
        isPanning: isPanningRef.current,
        isPinchZooming: isPinchZoomingRef.current,
        trafficLightTimer: trafficLightTimerRef.current,
      };

      // Create autobahn drawing options
      const getCachedAutobahnMergeInfo = createAutobahnMergeInfoCache(grid, gridSize, autobahnMergeInfoCacheRef, autobahnCacheVersionRef, gridVersionRef);
      const autobahnDrawingOptions: AutobahnDrawingOptions = {
        hasAutobahn,
        getAutobahnMergeInfo: getCachedAutobahnMergeInfo,
        isMobile,
        isPanning: isPanningRef.current,
        isPinchZooming: isPinchZoomingRef.current,
      };


      // Draw isometric tile base
      function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number, tile: Tile, highlight: boolean, currentZoom: number, skipGreyBase: boolean = false, skipGreenBase: boolean = false) {
        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;

        // Determine tile colors (top face and shading)
        let topColor = '#4a7c3f'; // grass
        let strokeColor = '#2d4a26';

        // PERF: Use pre-computed tile metadata for grey base check (O(1) lookup)
        const tileRenderMetadata = getTileMetadata(tile.x, tile.y);
        const isPark = tileRenderMetadata?.isPartOfParkBuilding ||
          ['park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
            'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
            'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater',
            'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground', 'marina_docks_small',
            'pier_large', 'roller_coaster_small', 'community_garden', 'pond_park', 'park_gate',
            'mountain_lodge', 'mountain_trailhead', 'woodcutter_house'].includes(tile.building.type);
        const hasGreyBase = tileRenderMetadata?.needsGreyBase ?? false;

        if (tile.building.type === 'water') {
          topColor = '#2563eb';
          strokeColor = '#1e3a8a';
        } else if (tile.building.type === 'road' || tile.building.type === 'bridge') {
          topColor = '#4a4a4a';
          strokeColor = '#333';
        } else if (isPark) {
          topColor = '#4a7c3f';
          strokeColor = '#2d4a26';
        } else if (tile.zone === 'residential') {
          if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
            topColor = '#3d7c3f';
          } else {
            topColor = '#2d5a2d';
          }
          strokeColor = '#22c55e';
        } else if (tile.zone === 'commercial') {
          if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
            topColor = '#3a5c7c';
          } else {
            topColor = '#2a4a6a';
          }
          strokeColor = '#3b82f6';
        } else if (tile.zone === 'industrial') {
          if (tile.building.type !== 'grass' && tile.building.type !== 'empty') {
            topColor = '#7c5c3a';
          } else {
            topColor = '#6a4a2a';
          }
          strokeColor = '#f59e0b';
        }

        // Override colors with paint color if set (for grass/empty/tree tiles)
        if (tile.paintColor && (tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'tree' || isPark)) {
          const paintScheme = PAINT_COLORS[tile.paintColor];
          if (paintScheme) {
            topColor = paintScheme.top;
            strokeColor = paintScheme.stroke;
          }
        }

        // Skip drawing green base for tiles adjacent to water (will be drawn later over water)
        // This includes grass, empty, and tree tiles - all have green bases
        // Also skip bridge tiles - they will have water drawn underneath them in the road queue
        const pixiWaterActive = pixiWaterRef.current?.initialized;
        const shouldSkipDrawing = (skipGreenBase && (tile.building.type === 'grass' || tile.building.type === 'empty' || tile.building.type === 'tree')) ||
          tile.building.type === 'bridge' ||
          (tile.building.type === 'water' && pixiWaterActive);

        // Draw the isometric diamond (top face) - cliff sides are handled separately in the main loop
        if (!shouldSkipDrawing) {
          ctx.fillStyle = topColor;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h / 2);
          ctx.lineTo(x + w / 2, y + h);
          ctx.lineTo(x, y + h / 2);
          ctx.closePath();
          ctx.fill();

          // Snow cap for high mountains (elevation >= 4)
          const elevation = tile.elevation || 0;
          if (elevation >= 4 && currentZoom >= 0.4) {
            const cx = x + w / 2;
            const cy = y + h * 0.35;
            const peakSize = w * 0.15;
            ctx.fillStyle = elevation >= 5 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.moveTo(cx, cy - peakSize * 0.8);
            ctx.lineTo(cx + peakSize, cy + peakSize * 0.4);
            ctx.lineTo(cx - peakSize, cy + peakSize * 0.4);
            ctx.closePath();
            ctx.fill();
          }

          // Draw grid lines only when zoomed in (hide when zoom < 0.6)
          if (currentZoom >= 0.6) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w / 2, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
            ctx.stroke();
          }

          // Draw zone border with dashed line (hide when zoomed out, only on grass/empty tiles - not on roads or buildings)
          if (tile.zone !== 'none' &&
            currentZoom >= 0.95 &&
            (tile.building.type === 'grass' || tile.building.type === 'empty')) {
            ctx.strokeStyle = tile.zone === 'residential' ? '#22c55e' :
              tile.zone === 'commercial' ? '#3b82f6' : '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Draw Bauzone overlay (semi-transparent cyan tint + dashed border)
          if (tile.bauzone) {
            ctx.fillStyle = 'rgba(0, 200, 220, 0.12)';
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w / 2, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
            ctx.fill();
            if (currentZoom >= 0.7) {
              ctx.strokeStyle = 'rgba(0, 200, 220, 0.6)';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([6, 3]);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }

        // Highlight on hover/select (always draw, even if base was skipped)
        if (highlight) {
          // Draw a semi-transparent fill for better visibility
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h / 2);
          ctx.lineTo(x + w / 2, y + h);
          ctx.lineTo(x, y + h / 2);
          ctx.closePath();
          ctx.fill();

          // Draw white border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      function drawPublicRoomBoundaryWalls(
        ctx: CanvasRenderingContext2D,
        gridSize: number,
        currentZoom: number
      ) {
        if (!showPublicRoomWalls) return;
        if (currentZoom < 0.42) return;
        if (gridSize <= 0) return;

        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;
        const wallHeight = Math.max(24, Math.round(h * 2.5));
        const topCapOffsetX = -3;
        const topCapOffsetY = -2;
        const wallFill = 'rgba(206, 212, 224, 0.97)';
        const wallTopFill = 'rgba(238, 242, 248, 0.95)';

        const drawWallSegment = (
          ax: number,
          ay: number,
          bx: number,
          by: number,
          fill: string,
          topFill: string
        ) => {
          const txA = ax;
          const tyA = ay - wallHeight;
          const txB = bx;
          const tyB = by - wallHeight;

          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.lineTo(txB, tyB);
          ctx.lineTo(txA, tyA);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = topFill;
          ctx.beginPath();
          ctx.moveTo(txA, tyA);
          ctx.lineTo(txB, tyB);
          ctx.lineTo(txB + topCapOffsetX, tyB + topCapOffsetY);
          ctx.lineTo(txA + topCapOffsetX, tyA + topCapOffsetY);
          ctx.closePath();
          ctx.fill();

          // Helle Top-Kante wie bei Habbo-Waenden (auf jedem Segment gleich).
          ctx.strokeStyle = 'rgba(248, 251, 255, 0.95)';
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(txA + topCapOffsetX, tyA + topCapOffsetY);
          ctx.lineTo(txB + topCapOffsetX, tyB + topCapOffsetY);
          ctx.stroke();
        };

        // North wall = hintere Kante (y=0), von Top nach Rechts.
        const northStartTile = gridToScreen(0, 0, 0, 0);
        const northEndTile = gridToScreen(gridSize - 1, 0, 0, 0);
        const northAX = northStartTile.screenX + w / 2;
        const northAY = northStartTile.screenY;
        const northBX = northEndTile.screenX + w;
        const northBY = northEndTile.screenY + h / 2;

        // Durchgehende North-Wall (ohne Eingang)
        drawWallSegment(
          northAX, northAY, northBX, northBY,
          wallFill,
          wallTopFill
        );

        // West wall = linke Kante (x=0), von Top nach Links.
        const westStartTile = gridToScreen(0, 0, 0, 0);
        const westEndTile = gridToScreen(0, gridSize - 1, 0, 0);
        const westAX = westStartTile.screenX;
        const westAY = westStartTile.screenY + h / 2;
        const westBX = westEndTile.screenX;
        const westBY = westEndTile.screenY + h / 2;

        drawWallSegment(
          westAX, westAY, westBX, westBY,
          wallFill,
          wallTopFill
        );

        // Ecke zwischen North- und West-Wall schliessen.
        const cornerTopA_X = northAX;
        const cornerTopA_Y = northAY - wallHeight;
        const cornerTopB_X = westAX;
        const cornerTopB_Y = westAY - wallHeight;
        ctx.fillStyle = wallFill;
        ctx.beginPath();
        ctx.moveTo(northAX, northAY);
        ctx.lineTo(westAX, westAY);
        ctx.lineTo(cornerTopB_X, cornerTopB_Y);
        ctx.lineTo(cornerTopA_X, cornerTopA_Y);
        ctx.closePath();
        ctx.fill();
        // Top-Cap auch für die Eckverbindung füllen (schliesst den letzten dunklen Spalt).
        ctx.fillStyle = wallTopFill;
        ctx.beginPath();
        ctx.moveTo(cornerTopA_X, cornerTopA_Y);
        ctx.lineTo(cornerTopB_X, cornerTopB_Y);
        ctx.lineTo(cornerTopB_X + topCapOffsetX, cornerTopB_Y + topCapOffsetY);
        ctx.lineTo(cornerTopA_X + topCapOffsetX, cornerTopA_Y + topCapOffsetY);
        ctx.closePath();
        ctx.fill();
        // Auch die Eckverbindung bekommt dieselbe helle Top-Rim-Kontur.
        ctx.strokeStyle = 'rgba(248, 251, 255, 0.95)';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(cornerTopA_X + topCapOffsetX, cornerTopA_Y + topCapOffsetY);
        ctx.lineTo(cornerTopB_X + topCapOffsetX, cornerTopB_Y + topCapOffsetY);
        ctx.stroke();
      }

      // Helper function to draw water tile at a given screen position
      // Used for marina/pier buildings that sit on water
      function drawWaterTileAt(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, gridX: number, gridY: number) {
        const waterImage = getCachedImage(WATER_ASSET_PATH);
        if (!waterImage) return;

        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;
        const tileCenterX = screenX + w / 2;
        const tileCenterY = screenY + h / 2;

        const imgW = waterImage.naturalWidth || waterImage.width;
        const imgH = waterImage.naturalHeight || waterImage.height;

        const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
        const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;

        const cropScale = 0.35;
        const cropW = imgW * cropScale;
        const cropH = imgH * cropScale;
        const maxOffsetX = imgW - cropW;
        const maxOffsetY = imgH - cropH;
        const srcX = seedX * maxOffsetX;
        const srcY = seedY * maxOffsetY;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenX + w / 2, screenY);
        ctx.lineTo(screenX + w, screenY + h / 2);
        ctx.lineTo(screenX + w / 2, screenY + h);
        ctx.lineTo(screenX, screenY + h / 2);
        ctx.closePath();
        ctx.clip();

        const aspectRatio = cropH / cropW;
        const jitterX = (seedX - 0.5) * w * 0.3;
        const jitterY = (seedY - 0.5) * h * 0.3;

        const destWidth = w * 1.15;
        const destHeight = destWidth * aspectRatio;

        ctx.globalAlpha = 0.95;
        ctx.drawImage(
          waterImage,
          srcX, srcY, cropW, cropH,
          Math.round(tileCenterX - destWidth / 2 + jitterX * 0.3),
          Math.round(tileCenterY - destHeight / 2 + jitterY * 0.3),
          Math.round(destWidth),
          Math.round(destHeight)
        );

        ctx.restore();
      }

      // ─── PERF: Static Base Tile Cache ──────────────────────────────────────────
      // Terrain, cliffs, roads, beach are expensive canvas 2D draws that rarely change.
      // Render them once to an offscreen canvas; reuse each frame unless something changed.
      {
        const _dragS = dragStartTile ? `${dragStartTile.x},${dragStartTile.y}` : '';
        const _dragE = dragEndTile ? `${dragEndTile.x},${dragEndTile.y}` : '';
        const _ck = staticCacheKeyRef.current;
        const _tilesCacheValid =
          staticCacheCanvasRef.current !== null &&
          staticCacheCanvasRef.current.width === canvas.width &&
          staticCacheCanvasRef.current.height === canvas.height &&
          _ck.gridVersion === gridVersionRef.current &&
          _ck.zoom === zoom &&
          _ck.offsetX === offset.x &&
          _ck.offsetY === offset.y &&
          _ck.overlayMode === overlayMode &&
          _ck.canvasW === canvasSize.width &&
          _ck.canvasH === canvasSize.height &&
          _ck.dragStart === _dragS &&
          _ck.dragEnd === _dragE &&
          _ck.showsDragGrid === showsDragGrid;

        if (!_tilesCacheValid) {
          // Create or resize the offscreen canvas
          if (!staticCacheCanvasRef.current ||
              staticCacheCanvasRef.current.width !== canvas.width ||
              staticCacheCanvasRef.current.height !== canvas.height) {
            staticCacheCanvasRef.current = document.createElement('canvas');
            staticCacheCanvasRef.current.width = canvas.width;
            staticCacheCanvasRef.current.height = canvas.height;
          }
          // Shadow `ctx` so all base tile drawing goes to the offscreen canvas
          // eslint-disable-next-line no-shadow
          const ctx = staticCacheCanvasRef.current.getContext('2d')!;
          ctx.imageSmoothingEnabled = false;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(dpr * zoom, dpr * zoom);
          ctx.translate(offset.x / zoom, offset.y / zoom);

          // PERF: Clear queue arrays (faster than re-creating)
          queues.buildingQueue.length = 0;
          queues.waterQueue.length = 0;
          queues.roadQueue.length = 0;
          queues.bridgeQueue.length = 0;
          queues.railQueue.length = 0;
          queues.beachQueue.length = 0;
          queues.baseTileQueue.length = 0;
          queues.greenBaseTileQueue.length = 0;
          queues.overlayQueue.length = 0;

      // Draw tiles in isometric order (back to front)
      // PERF: Only iterate through diagonal bands that intersect the visible viewport
      for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
        for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
          const y = sum - x;
          if (y < 0 || y >= gridSize) continue;

          const { screenX, screenY: rawScreenY } = gridToScreen(x, y, 0, 0);

          const tile = grid[y][x];

          // Apply elevation Y-offset: higher tiles are shifted UP
          const tileElevation = tile.elevation || 0;
          const screenY = rawScreenY - tileElevation * HEIGHT_STEP;

          // Viewport culling (generous padding for elevated tiles + cliffs)
          if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 4 + 6 * HEIGHT_STEP < viewTop || screenY > viewBottom) {
            continue;
          }

          // PERF: Hover and selection highlights are now rendered on a separate canvas layer
          // Only keep drag rect and subway station highlights in main render (these change infrequently)

          // Check if tile is in drag selection rectangle (only show for zoning tools)
          const isInDragRect = showsDragGrid && dragStartTile && dragEndTile &&
            x >= Math.min(dragStartTile.x, dragEndTile.x) &&
            x <= Math.max(dragStartTile.x, dragEndTile.x) &&
            y >= Math.min(dragStartTile.y, dragEndTile.y) &&
            y <= Math.max(dragStartTile.y, dragEndTile.y);

          // PERF: Use pre-computed tile metadata (O(1) lookup instead of expensive per-tile calculations)
          const tileMetadata = getTileMetadata(x, y);
          const needsGreyBase = tileMetadata?.needsGreyBase ?? false;
          const needsGreenBaseOverWater = tileMetadata?.needsGreenBaseOverWater ?? false;
          const needsGreenBaseForPark = tileMetadata?.needsGreenBaseForPark ?? false;

          // Draw cliff/side faces BEFORE the top face (they extend downward)
          if (tileElevation > 0 && tile.building.type !== 'water') {
            // Get neighbor elevations for cliff drawing
            // South neighbor = grid[y][x+1], West neighbor = grid[y+1][x]
            const southNeighbor = (x + 1 < gridSize) ? grid[y]?.[x + 1] : null;
            const westNeighbor = (y + 1 < gridSize) ? grid[y + 1]?.[x] : null;
            const neighborElevations = {
              south: southNeighbor ? (southNeighbor.elevation || 0) : 0,
              west: westNeighbor ? (westNeighbor.elevation || 0) : 0,
            };
            drawCliffSides(ctx, screenX, screenY, tile, neighborElevations, zoom);
          }

          // Draw base tile for all tiles (including water), skip green bases for grass/empty adjacent to water or parks
          // Highlight subway stations when subway overlay is active
          const isSubwayStationHighlight =
            overlayMode === 'subway' &&
            tile.building.type === 'subway_station';
          drawIsometricTile(ctx, screenX, screenY, tile, !!(isInDragRect || isSubwayStationHighlight), zoom, true, needsGreenBaseOverWater || needsGreenBaseForPark);

          if (needsGreyBase) {
            drawGreyBaseTile(ctx, screenX, screenY, tile, zoom);
          }

          if (needsGreenBaseOverWater || needsGreenBaseForPark) {
            greenBaseTileQueue.push({ screenX, screenY, tile, depth: x + y });
          }

          // Separate water tiles into their own queue (drawn after base tiles, below other buildings)
          if (tile.building.type === 'water') {
            const size = getBuildingSize(tile.building.type);
            const depth = x + y + size.width + size.height - 2;
            waterQueue.push({ screenX, screenY, tile, depth });
          }
          // Roads go to their own queue (drawn above water)
          else if (tile.building.type === 'road') {
            const depth = x + y;
            roadQueue.push({ screenX, screenY, tile, depth });
          }
          else if (tile.building.type === 'autobahn') {
            const depth = x + y;
            roadQueue.push({ screenX, screenY, tile, depth });
          }
          // Bridges go to a separate queue (drawn after roads to cover centerlines)
          else if (tile.building.type === 'bridge') {
            const depth = x + y;
            bridgeQueue.push({ screenX, screenY, tile, depth });
          }
          // Rail tiles - drawn after roads, above water
          else if (tile.building.type === 'rail') {
            const depth = x + y;
            railQueue.push({ screenX, screenY, tile, depth });
          }
          // Check for beach tiles (grass/empty tiles adjacent to water) - use pre-computed metadata
          else if ((tile.building.type === 'grass' || tile.building.type === 'empty') &&
            (tileMetadata?.isAdjacentToWater ?? false)) {
            beachQueue.push({ screenX, screenY, tile, depth: x + y });
          }
          // Other buildings go to regular building queue
          else {
            const isBuilding = tile.building.type !== 'grass' && tile.building.type !== 'empty';
            if (isBuilding) {
              // Wind turbines are rendered by PixiWindTurbineLayer (animated blades)
              if (tile.building.type === 'wind_turbine') {
                continue;
              }
              const size = getBuildingSize(tile.building.type);
              const depth = x + y + size.width + size.height - 2;
              buildingQueue.push({ screenX, screenY, tile, depth });
            }
          }

          // Determine which tiles to show overlay on
          // - subway: all non-water tiles
          // - pollution: ALL tiles (heatmap covers everything)
          // - trees/houses/parks: all non-water tiles (relevant buildings get highlighted, rest dimmed)
          // - other services: buildings only (not grass/water/road)
          const showOverlay =
            overlayMode !== 'none' &&
            (overlayMode === 'subway'
              ? tile.building.type !== 'water'
              : overlayMode === 'pollution'
              ? true  // Heatmap für alle Tiles
              : overlayMode === 'trees' || overlayMode === 'houses' || overlayMode === 'parks'
              ? tile.building.type !== 'water'  // Alle nicht-Wasser-Tiles für Hervorhebung
              : (tile.building.type !== 'grass' &&
                tile.building.type !== 'water' &&
                tile.building.type !== 'road'));
          if (showOverlay) {
            overlayQueue.push({ screenX, screenY, tile });
          }
        }
      }

      // Public-Room Wände als durchgehende Habbo-ähnliche Flächen über den Bodentiles zeichnen.
      drawPublicRoomBoundaryWalls(ctx, gridSize, zoom);

      // ── PixiJS Water Layer: pass tile data, update transform ──
      insertionSortByDepth(waterQueue);

      const pixiWater = pixiWaterRef.current;
      if (pixiWater?.initialized) {
        const cssW = Math.round(canvasSize.width / dpr);
        const cssH = Math.round(canvasSize.height / dpr);
        pixiWater.resize(canvasSize.width, canvasSize.height, cssW, cssH);
        pixiWater.updateTransform(dpr, zoom, offset.x, offset.y);

        const waterTileInfos: WaterTileInfo[] = [];
        for (let i = 0; i < waterQueue.length; i++) {
          const { tile, screenX, screenY } = waterQueue[i];
          const gx = tile.x;
          const gy = tile.y;
          const adjN = gx > 0 && grid[gy]?.[gx - 1]?.building.type === 'water';
          const adjE = gy > 0 && grid[gy - 1]?.[gx]?.building.type === 'water';
          const adjS = gx < gridSize - 1 && grid[gy]?.[gx + 1]?.building.type === 'water';
          const adjW = gy < gridSize - 1 && grid[gy + 1]?.[gx]?.building.type === 'water';
          const adjacentCount = (adjN ? 1 : 0) + (adjE ? 1 : 0) + (adjS ? 1 : 0) + (adjW ? 1 : 0);
          waterTileInfos.push({
            screenX, screenY,
            adjacentLand: {
              north: (gx - 1 >= 0 && gx - 1 < gridSize && gy >= 0 && gy < gridSize) && !isWater(gx - 1, gy) && !hasMarinaPier(gx - 1, gy) && !isBridge(gx - 1, gy),
              east:  (gx >= 0 && gx < gridSize && gy - 1 >= 0 && gy - 1 < gridSize) && !isWater(gx, gy - 1) && !hasMarinaPier(gx, gy - 1) && !isBridge(gx, gy - 1),
              south: (gx + 1 >= 0 && gx + 1 < gridSize && gy >= 0 && gy < gridSize) && !isWater(gx + 1, gy) && !hasMarinaPier(gx + 1, gy) && !isBridge(gx + 1, gy),
              west:  (gx >= 0 && gx < gridSize && gy + 1 >= 0 && gy + 1 < gridSize) && !isWater(gx, gy + 1) && !hasMarinaPier(gx, gy + 1) && !isBridge(gx, gy + 1),
            },
            adjacentCount,
          });
        }
        pixiWater.updateWaterTiles(waterTileInfos, zoom);
        pixiWater.render();
      } else {
        // Fallback: Canvas 2D water (while PixiJS initializes)
        const topLeft = gridToScreen(0, 0, 0, 0);
        const topRight = gridToScreen(gridSize - 1, 0, 0, 0);
        const bottomRight = gridToScreen(gridSize - 1, gridSize - 1, 0, 0);
        const bottomLeft = gridToScreen(0, gridSize - 1, 0, 0);
        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(topLeft.screenX + w / 2, topLeft.screenY);
        ctx.lineTo(topRight.screenX + w, topRight.screenY + h / 2);
        ctx.lineTo(bottomRight.screenX + w / 2, bottomRight.screenY + h);
        ctx.lineTo(bottomLeft.screenX, bottomLeft.screenY + h / 2);
        ctx.closePath();
        ctx.clip();
        for (let i = 0; i < waterQueue.length; i++) {
          const { tile, screenX, screenY } = waterQueue[i];
          drawBuilding(ctx, screenX, screenY, tile);
        }
        ctx.restore();
        if (zoom >= 0.4) {
          for (let i = 0; i < waterQueue.length; i++) {
            const { tile, screenX, screenY } = waterQueue[i];
            const adjacentLand = {
              north: (tile.x - 1 >= 0 && tile.x - 1 < gridSize && tile.y >= 0 && tile.y < gridSize) && !isWater(tile.x - 1, tile.y) && !hasMarinaPier(tile.x - 1, tile.y) && !isBridge(tile.x - 1, tile.y),
              east:  (tile.x >= 0 && tile.x < gridSize && tile.y - 1 >= 0 && tile.y - 1 < gridSize) && !isWater(tile.x, tile.y - 1) && !hasMarinaPier(tile.x, tile.y - 1) && !isBridge(tile.x, tile.y - 1),
              south: (tile.x + 1 >= 0 && tile.x + 1 < gridSize && tile.y >= 0 && tile.y < gridSize) && !isWater(tile.x + 1, tile.y) && !hasMarinaPier(tile.x + 1, tile.y) && !isBridge(tile.x + 1, tile.y),
              west:  (tile.x >= 0 && tile.x < gridSize && tile.y + 1 >= 0 && tile.y + 1 < gridSize) && !isWater(tile.x, tile.y + 1) && !hasMarinaPier(tile.x, tile.y + 1) && !isBridge(tile.x, tile.y + 1),
            };
            drawBeachOnWater(ctx, screenX, screenY, adjacentLand);
          }
        }
      }

      // PERF: Pre-compute tile dimensions once outside loops
      const tileWidth = TILE_WIDTH;
      const tileHeight = TILE_HEIGHT;
      const halfTileWidth = tileWidth / 2;
      const halfTileHeight = tileHeight / 2;

      // Draw green base tiles for grass/empty tiles adjacent to water BEFORE bridges
      // This ensures bridge railings are drawn on top of the green base tiles
      insertionSortByDepth(greenBaseTileQueue);
      for (let i = 0; i < greenBaseTileQueue.length; i++) {
        const { tile, screenX, screenY } = greenBaseTileQueue[i];
        drawGreenBaseTile(ctx, screenX, screenY, tile, zoom);
      }

      // Draw roads (above water, needs full redraw including base tile)
      insertionSortByDepth(roadQueue);
      // PERF: Use for loop instead of forEach
      for (let i = 0; i < roadQueue.length; i++) {
        const { tile, screenX, screenY } = roadQueue[i];

        // Draw road base tile first (grey diamond, black for autobahn)
        ctx.fillStyle = tile.building.type === 'autobahn' ? '#1a1a1a' : '#4a4a4a';
        ctx.beginPath();
        ctx.moveTo(screenX + halfTileWidth, screenY);
        ctx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
        ctx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
        ctx.lineTo(screenX, screenY + halfTileHeight);
        ctx.closePath();
        ctx.fill();

        // Draw road markings and sidewalks
        drawBuilding(ctx, screenX, screenY, tile);

        // If this road has a rail overlay, draw just the rail tracks (ties and rails, no ballast)
        // Crossing signals/gates are drawn later (after rail tiles) to avoid z-order issues
        if (tile.hasRailOverlay) {
          drawRailTracksOnly(ctx, screenX, screenY, tile.x, tile.y, grid, gridSize, zoom);
        }
      }

      // Draw bridges AFTER roads to ensure bridge decks cover road centerlines
      insertionSortByDepth(bridgeQueue);
      for (let i = 0; i < bridgeQueue.length; i++) {
        const { tile, screenX, screenY } = bridgeQueue[i];

        // Draw water tile underneath the bridge
        drawWaterTileAt(ctx, screenX, screenY, tile.x, tile.y);

        // Draw bridge structure
        drawBuilding(ctx, screenX, screenY, tile);
      }

      // Draw rail tracks (above water, similar to roads)
      insertionSortByDepth(railQueue);
      // PERF: Use for loop instead of forEach
      for (let i = 0; i < railQueue.length; i++) {
        const { tile, screenX, screenY } = railQueue[i];
        // Draw rail base tile first (dark gravel colored diamond)
        ctx.fillStyle = '#5B6345'; // Dark gravel color for contrast with ballast
        ctx.beginPath();
        ctx.moveTo(screenX + halfTileWidth, screenY);
        ctx.lineTo(screenX + tileWidth, screenY + halfTileHeight);
        ctx.lineTo(screenX + halfTileWidth, screenY + tileHeight);
        ctx.lineTo(screenX, screenY + halfTileHeight);
        ctx.closePath();
        ctx.fill();

        // Draw edge shading for depth
        ctx.strokeStyle = '#4B5335';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX + halfTileWidth, screenY + tileHeight);
        ctx.lineTo(screenX, screenY + halfTileHeight);
        ctx.lineTo(screenX + halfTileWidth, screenY);
        ctx.stroke();

        // Draw the rail tracks
        drawRailTrack(ctx, screenX, screenY, tile.x, tile.y, grid, gridSize, zoom);
      }

      // Grey base tiles are drawn inline during the main tile loop (see needsGreyBase)

      // Draw suspension bridge towers AGAIN on main canvas after base tiles
      // Draw suspension bridge FRONT towers on main canvas after base tiles
      // Only the front tower is drawn here (back tower was drawn before deck in drawBridgeTile)
      for (let i = 0; i < bridgeQueue.length; i++) {
        const { tile, screenX, screenY } = bridgeQueue[i];
        if (tile.building.bridgeType === 'suspension') {
          drawSuspensionBridgeTowers(ctx, screenX, screenY, tile.building, zoom);
        }
      }

      // Draw railroad crossing signals and gates AFTER base tiles to ensure they appear on top
      // PERF: Build a Set of crossing keys for O(1) lookup instead of calling isRailroadCrossing
      const crossingKeySet = new Set<number>();
      const cachedCrossings = crossingPositionsRef.current;
      for (let i = 0; i < cachedCrossings.length; i++) {
        const { x, y } = cachedCrossings[i];
        crossingKeySet.add(y * gridSize + x);
      }

      // PERF: Pre-compute constants used in loop
      const currentTrains = trainsRef.current;
      const currentFlashTimer = crossingFlashTimerRef.current;
      const gateAnglesMap = crossingGateAnglesRef.current;

      // Only iterate roads with rail overlay that are crossings
      // PERF: Use for loop instead of forEach
      for (let i = 0; i < roadQueue.length; i++) {
        const { tile, screenX, screenY } = roadQueue[i];
        if (tile.hasRailOverlay) {
          // PERF: Use numeric key and Set lookup instead of isRailroadCrossing call
          const crossingKey = tile.y * gridSize + tile.x;
          if (crossingKeySet.has(crossingKey)) {
            const gateAngle = gateAnglesMap.get(crossingKey) ?? 0;
            const crossingState = getCrossingStateForTile(currentTrains, tile.x, tile.y);
            const isActive = crossingState !== 'open';

            drawRailroadCrossing(
              ctx,
              screenX,
              screenY,
              tile.x,
              tile.y,
              grid,
              gridSize,
              zoom,
              currentFlashTimer,
              gateAngle,
              isActive
            );
          }
        }
      }

      // Note: Beach drawing has been moved to water tiles (drawBeachOnWater)
      // The beachQueue is no longer used for drawing beaches on land tiles


      // When Pixi building sprites are active, draw marina/pier water underlays on the main canvas.
      // This keeps docks in water without drawing water on top of Pixi sprites.
      if (usePixiBuildings) {
        for (let i = 0; i < buildingQueue.length; i++) {
          const { tile } = buildingQueue[i];
          const buildingType = tile.building.type;
          if (buildingType !== 'marina_docks_small' && buildingType !== 'pier_large') continue;

          const buildingSize = getBuildingSize(buildingType);
          for (let dx = 0; dx < buildingSize.width; dx++) {
            for (let dy = 0; dy < buildingSize.height; dy++) {
              const tileGridX = tile.x + dx;
              const tileGridY = tile.y + dy;
              const { screenX, screenY } = gridToScreen(tileGridX, tileGridY, 0, 0);
              drawWaterTileAt(ctx, screenX, screenY, tileGridX, tileGridY);
            }
          }
        }
      }

          // End of base tile rendering — restore offscreen canvas state
          ctx.restore();

          // Update cache key
          _ck.gridVersion = gridVersionRef.current;
          _ck.zoom = zoom;
          _ck.offsetX = offset.x;
          _ck.offsetY = offset.y;
          _ck.overlayMode = overlayMode;
          _ck.canvasW = canvasSize.width;
          _ck.canvasH = canvasSize.height;
          _ck.dragStart = _dragS;
          _ck.dragEnd = _dragE;
          _ck.showsDragGrid = showsDragGrid;
        } // end if (!_tilesCacheValid)

        // Composite cached base tiles onto main canvas (bypass isometric transform)
        if (staticCacheCanvasRef.current) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(staticCacheCanvasRef.current, 0, 0);
          ctx.restore();
        }
      } // end static tile cache block
      // ─── End Static Base Tile Cache ────────────────────────────────────────────

      // Draw buildings sorted by depth so multi-tile sprites sit above adjacent tiles
      insertionSortByDepth(buildingQueue);
      if (usePixiBuildings) {
        pixiBuildings!.resize(canvasSize.width, canvasSize.height,
          canvasSize.width / dpr, canvasSize.height / dpr);
        pixiBuildings!.beginFrame(dpr, zoom, offset.x, offset.y);
      }

      // Render buildings on the buildings canvas (on top of cars/trains)
      const buildingsCanvas = buildingsCanvasRef.current;
      if (buildingsCanvas) {
        buildingsCanvas.width = canvasSize.width;
        buildingsCanvas.height = canvasSize.height;

        const buildingsCtx = buildingsCanvas.getContext('2d');
        if (buildingsCtx) {
          buildingsCtx.setTransform(1, 0, 0, 1, 0, 0);
          buildingsCtx.clearRect(0, 0, buildingsCanvas.width, buildingsCanvas.height);

          buildingsCtx.scale(dpr, dpr);
          buildingsCtx.translate(offset.x, offset.y);
          buildingsCtx.scale(zoom, zoom);

          buildingsCtx.imageSmoothingEnabled = false;

          for (let i = 0; i < buildingQueue.length; i++) {
            const { tile, screenX, screenY } = buildingQueue[i];
            drawBuilding(buildingsCtx, screenX, screenY, tile);
          }

          // Finalize PixiJS building sprite render
          if (usePixiBuildings) {
            pixiBuildings!.endFrame();
          }

          // Draw suspension bridge towers ON TOP of buildings
          // These need to appear above nearby buildings for proper visual layering
          for (let i = 0; i < bridgeQueue.length; i++) {
            const { tile, screenX, screenY } = bridgeQueue[i];
            if (tile.building.bridgeType === 'suspension') {
              drawSuspensionBridgeTowers(buildingsCtx, screenX, screenY, tile.building, zoom);
            }
          }

          // Draw suspension bridge cables ON TOP of towers
          for (let i = 0; i < bridgeQueue.length; i++) {
            const { tile, screenX, screenY } = bridgeQueue[i];
            if (tile.building.bridgeType === 'suspension') {
              drawSuspensionBridgeOverlay(buildingsCtx, screenX, screenY, tile.building, zoom);
            }
          }

          // NOTE: Recreation pedestrians are now drawn in the animation loop on the air canvas
          // so their animations are smooth (the buildings canvas only updates when grid changes)

          // Draw overlays on the buildings canvas so they appear ON TOP of buildings
          // (The buildings canvas is layered above the main canvas, so overlays must be drawn here)
          // PERF: Use for loop instead of forEach
          const halfTileWidth = TILE_WIDTH / 2;
          const halfTileHeight = TILE_HEIGHT / 2;
          for (let i = 0; i < overlayQueue.length; i++) {
            const { tile, screenX, screenY } = overlayQueue[i];
            // Get service coverage for this tile
            const coverage = {
              fire: state.services.fire[tile.y][tile.x],
              police: state.services.police[tile.y][tile.x],
              health: state.services.health[tile.y][tile.x],
              education: state.services.education[tile.y][tile.x],
            };

            const fillStyle = getOverlayFillStyle(overlayMode, tile, coverage);
            // Only draw if there's actually a color to show
            if (fillStyle !== 'rgba(0, 0, 0, 0)') {
              buildingsCtx.fillStyle = fillStyle;
              buildingsCtx.beginPath();
              buildingsCtx.moveTo(screenX + halfTileWidth, screenY);
              buildingsCtx.lineTo(screenX + TILE_WIDTH, screenY + halfTileHeight);
              buildingsCtx.lineTo(screenX + halfTileWidth, screenY + TILE_HEIGHT);
              buildingsCtx.lineTo(screenX, screenY + halfTileHeight);
              buildingsCtx.closePath();
              buildingsCtx.fill();
            }
          }

          // Draw service radius circles and building highlights for the active overlay
          if (overlayMode !== 'none' && overlayMode !== 'subway') {
            const isNewOverlay = overlayMode === 'pollution' || overlayMode === 'trees' || overlayMode === 'houses' || overlayMode === 'parks';

            if (!isNewOverlay) {
              // ── Standard service-building overlays (power, water, fire, police, health, education) ──
              const serviceBuildingTypes = OVERLAY_TO_BUILDING_TYPES[overlayMode];
              const circleColor = OVERLAY_CIRCLE_COLORS[overlayMode];
              const circleFillColor = OVERLAY_CIRCLE_FILL_COLORS[overlayMode];
              const highlightColor = OVERLAY_HIGHLIGHT_COLORS[overlayMode];

              for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
                for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
                  const y = sum - x;
                  if (y < 0 || y >= gridSize) continue;

                  const tile = grid[y][x];
                  if (!serviceBuildingTypes.includes(tile.building.type)) continue;
                  if (tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100) continue;
                  if (tile.building.abandoned) continue;

                  const config = SERVICE_CONFIG[tile.building.type as keyof typeof SERVICE_CONFIG];
                  if (!config || !('range' in config)) continue;

                  const baseRange = config.range;
                  const effectiveRange = baseRange * (1 + (tile.building.level - 1) * SERVICE_RANGE_INCREASE_PER_LEVEL);
                  const range = Math.floor(effectiveRange);

                  const { screenX: bldgScreenX, screenY: bldgScreenY } = gridToScreen(x, y, 0, 0);
                  const centerX = bldgScreenX + halfTileWidth;
                  const centerY = bldgScreenY + halfTileHeight;

                  const radiusX = range * halfTileWidth;
                  const radiusY = range * halfTileHeight;

                  // Viewport-Culling: Ellipse-AABB komplett außerhalb → überspringen
                  if (centerX + radiusX < viewLeft || centerX - radiusX > viewRight ||
                      centerY + radiusY < viewTop  || centerY - radiusY > viewBottom) continue;

                  buildingsCtx.strokeStyle = circleColor;
                  buildingsCtx.lineWidth = 2 / zoom;
                  buildingsCtx.beginPath();
                  buildingsCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                  buildingsCtx.stroke();

                  buildingsCtx.fillStyle = circleFillColor;
                  buildingsCtx.fill();

                  buildingsCtx.strokeStyle = highlightColor;
                  buildingsCtx.lineWidth = 3 / zoom;
                  buildingsCtx.beginPath();
                  buildingsCtx.moveTo(bldgScreenX + halfTileWidth, bldgScreenY);
                  buildingsCtx.lineTo(bldgScreenX + TILE_WIDTH, bldgScreenY + halfTileHeight);
                  buildingsCtx.lineTo(bldgScreenX + halfTileWidth, bldgScreenY + TILE_HEIGHT);
                  buildingsCtx.lineTo(bldgScreenX, bldgScreenY + halfTileHeight);
                  buildingsCtx.closePath();
                  buildingsCtx.stroke();

                  buildingsCtx.fillStyle = highlightColor;
                  buildingsCtx.beginPath();
                  buildingsCtx.arc(centerX, centerY, 4 / zoom, 0, Math.PI * 2);
                  buildingsCtx.fill();
                }
              }
            } else {
              // ── Neue Overlays: Verschmutzung, Bäume, Häuser, Parks ──
              // Bestimme welche Gebäude einen Radius bekommen sollen
              const shouldDrawRadius = (buildingType: string): boolean => {
                switch (overlayMode) {
                  case 'pollution':
                    // Alle Gebäude mit Verschmutzungswert != 0 (Verschmutzer UND Reiniger)
                    return getPollutionInfluenceRadius(buildingType) > 0;
                  case 'trees':
                    return TREE_BUILDING_TYPES.has(buildingType);
                  case 'houses':
                    return RESIDENTIAL_BUILDING_TYPES.has(buildingType);
                  case 'parks':
                    return PARK_BUILDING_TYPES.has(buildingType);
                  default:
                    return false;
                }
              };

              for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
                for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
                  const y = sum - x;
                  if (y < 0 || y >= gridSize) continue;

                  const tile = grid[y][x];
                  const bType = tile.building.type;
                  if (!shouldDrawRadius(bType)) continue;

                  // Skip Baustellen & verlassene Gebäude
                  if (tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100) continue;
                  if (tile.building.abandoned) continue;

                  // Radius berechnen
                  const range = getPollutionInfluenceRadius(bType);
                  if (range <= 0) continue;

                  const { screenX: bldgScreenX, screenY: bldgScreenY } = gridToScreen(x, y, 0, 0);
                  const centerX = bldgScreenX + halfTileWidth;
                  const centerY = bldgScreenY + halfTileHeight;

                  const radiusX = range * halfTileWidth;
                  const radiusY = range * halfTileHeight;

                  // Viewport-Culling: Ellipse-AABB komplett außerhalb → überspringen
                  if (centerX + radiusX < viewLeft || centerX - radiusX > viewRight ||
                      centerY + radiusY < viewTop  || centerY - radiusY > viewBottom) continue;

                  // Farbe basierend auf Overlay-Modus und Verschmutzungswert
                  let strokeColor: string;
                  let fillColor: string;
                  let highlightColor: string;

                  if (overlayMode === 'pollution') {
                    // Pollution-Overlay: Farbe nach Verschmutzer/Reiniger unterscheiden
                    const pollutionValue = getBuildingPollutionValue(bType);
                    const pollColors = getPollutionRadiusColors(pollutionValue);
                    strokeColor = pollColors.stroke;
                    fillColor = pollColors.fill;
                    highlightColor = pollColors.highlight;
                  } else {
                    // Bäume/Häuser/Parks: Overlay-spezifische Farben
                    strokeColor = OVERLAY_CIRCLE_COLORS[overlayMode];
                    fillColor = OVERLAY_CIRCLE_FILL_COLORS[overlayMode];
                    highlightColor = OVERLAY_HIGHLIGHT_COLORS[overlayMode];
                  }

                  // Isometrische Ellipse für den Radius zeichnen
                  buildingsCtx.strokeStyle = strokeColor;
                  buildingsCtx.lineWidth = 1.5 / zoom;
                  buildingsCtx.beginPath();
                  buildingsCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                  buildingsCtx.stroke();

                  // Subtile Füllung
                  buildingsCtx.fillStyle = fillColor;
                  buildingsCtx.fill();

                  // Highlight-Rahmen um das Gebäude
                  buildingsCtx.strokeStyle = highlightColor;
                  buildingsCtx.lineWidth = 2.5 / zoom;
                  buildingsCtx.beginPath();
                  buildingsCtx.moveTo(bldgScreenX + halfTileWidth, bldgScreenY);
                  buildingsCtx.lineTo(bldgScreenX + TILE_WIDTH, bldgScreenY + halfTileHeight);
                  buildingsCtx.lineTo(bldgScreenX + halfTileWidth, bldgScreenY + TILE_HEIGHT);
                  buildingsCtx.lineTo(bldgScreenX, bldgScreenY + halfTileHeight);
                  buildingsCtx.closePath();
                  buildingsCtx.stroke();

                  // Punkt in der Gebäudemitte
                  buildingsCtx.fillStyle = highlightColor;
                  buildingsCtx.beginPath();
                  buildingsCtx.arc(centerX, centerY, 3 / zoom, 0, Math.PI * 2);
                  buildingsCtx.fill();
                }
              }
            }
          }

          buildingsCtx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }


      // === TRADE PARTNER EDGE INDICATORS ===
      // Wird NACH dem gesamten Grid gezeichnet, damit es oben drauf liegt.
      // Zeigt deutlich sichtbare Wegweiser am Kartenrand für verbundene Partner.
      if (adjacentCities && adjacentCities.length > 0) {
        const connectedPartners = adjacentCities.filter(c => c.connected);
        
        if (connectedPartners.length > 0) {
          // Zuerst: halbtransparente Gras-Tiles am Kartenrand (Hintergrund-Preview)
          const partnerPreviewData: TradePartnerPreviewData[] = connectedPartners.map(c => ({
            direction: c.direction,
            name: c.name,
            connected: c.connected,
            discovered: c.discovered,
            slug: c.slug,
          }));
          
          drawTradePartnerPreviews(
            ctx,
            partnerPreviewData,
            grid,
            gridSize,
            zoom,
            {
              left: viewLeft - TILE_WIDTH * 8,
              top: viewTop - TILE_HEIGHT * 8,
              right: viewRight + TILE_WIDTH * 8,
              bottom: viewBottom + TILE_HEIGHT * 8,
            },
          );
          
          // Dann: Deutlich sichtbare Richtungs-Banner am Kartenrand (klickbar)
          const newHitboxes: typeof partnerHitboxesRef.current = [];
          
          for (const partner of connectedPartners) {
            const mid = Math.floor(gridSize / 2);
            let edgeX: number, edgeY: number;
            let arrow: string;
            
            switch (partner.direction) {
              case 'north': edgeX = mid; edgeY = -1; arrow = '↑'; break;
              case 'south': edgeX = mid; edgeY = gridSize; arrow = '↓'; break;
              case 'east':  edgeX = gridSize; edgeY = mid; arrow = '→'; break;
              case 'west':  edgeX = -1; edgeY = mid; arrow = '←'; break;
            }
            
            const { screenX, screenY } = gridToScreen(edgeX, edgeY, 0, 0);
            const labelX = screenX + TILE_WIDTH / 2;
            const labelY = screenY + TILE_HEIGHT / 2;
            
            if (labelX < viewLeft - 300 || labelX > viewRight + 300 ||
                labelY < viewTop - 200 || labelY > viewBottom + 200) continue;
            
            ctx.save();
            ctx.globalAlpha = 1;
            
            const fontSize = Math.max(11, Math.min(18, 14 / zoom));
            const smallFontSize = Math.max(9, fontSize * 0.75);
            const padding = 12;
            
            const mainText = `${arrow} ${partner.name}`;
            const subText = 'Klick zum Besuchen →';
            
            ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
            const mainWidth = ctx.measureText(mainText).width;
            ctx.font = `${smallFontSize}px system-ui, -apple-system, sans-serif`;
            const subWidth = ctx.measureText(subText).width;
            
            const boxW = Math.max(mainWidth, subWidth) + padding * 2;
            const boxH = fontSize + smallFontSize + padding * 2 + 4;
            const boxX = labelX - boxW / 2;
            const boxY = labelY - boxH / 2;
            const radius = 8;
            
            // Hitbox speichern (in World-Coords)
            if (partner.slug) {
              newHitboxes.push({ slug: partner.slug, name: partner.name, x: boxX, y: boxY, w: boxW, h: boxH });
            }
            
            // Schatten
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 3;
            
            // Hintergrund
            ctx.fillStyle = 'rgba(10, 45, 25, 0.92)';
            ctx.beginPath();
            ctx.moveTo(boxX + radius, boxY);
            ctx.lineTo(boxX + boxW - radius, boxY);
            ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + radius, radius);
            ctx.lineTo(boxX + boxW, boxY + boxH - radius);
            ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH, radius);
            ctx.lineTo(boxX + radius, boxY + boxH);
            ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - radius, radius);
            ctx.lineTo(boxX, boxY + radius);
            ctx.arcTo(boxX, boxY, boxX + radius, boxY, radius);
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Grüner Dot
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(boxX + 10, boxY + boxH / 2, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Haupttext
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = '#d1fae5';
            ctx.fillText(mainText, labelX, boxY + padding);
            
            // Untertext (Klick-Aufforderung)
            ctx.font = `${smallFontSize}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = '#6ee7b7';
            ctx.fillText(subText, labelX, boxY + padding + fontSize + 4);
            
            ctx.restore();
          }
          
          // Hitboxen aktualisieren für Klick-Erkennung
          partnerHitboxesRef.current = newHitboxes;
        }
      }

      // ── Fehlende-Service Icons pro Zonen-Cluster (1x pro zusammenhaengender Zone) ──
      if (zoom >= 0.7) {
        // Server-authoritative Wasserversorgung
        const _effectiveWaterProd = Number((state.stats as any).water_production ?? 0);
        const _effectiveWaterCons = Number((state.stats as any).water_consumption ?? 0);

        // Flood-fill: zusammenhaengende Zonen-Tiles gleichen Typs gruppieren
        const visited = new Set<string>();
        const clusters: Array<{ tiles: Array<{ x: number; y: number }>; zoneType: string }> = [];

        for (let cy = 0; cy < gridSize; cy++) {
          for (let cx = 0; cx < gridSize; cx++) {
            const t = grid[cy]?.[cx];
            if (!t || t.zone === 'none') continue;
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            // Flood-fill fuer diesen Cluster
            const cluster: Array<{ x: number; y: number }> = [];
            const stack = [{ x: cx, y: cy }];
            const zt = t.zone;
            while (stack.length > 0) {
              const p = stack.pop()!;
              const pk = `${p.x},${p.y}`;
              if (visited.has(pk)) continue;
              if (p.x < 0 || p.x >= gridSize || p.y < 0 || p.y >= gridSize) continue;
              const pt = grid[p.y]?.[p.x];
              if (!pt || pt.zone !== zt) continue;
              visited.add(pk);
              cluster.push(p);
              stack.push({ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y },
                { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 });
            }
            if (cluster.length > 0) clusters.push({ tiles: cluster, zoneType: zt });
          }
        }

        for (const cluster of clusters) {
          // Icons nur zeigen wenn mindestens 1 Tile noch kein fertiges Gebaeude hat
          const hasUnbuiltTile = cluster.tiles.some(p => {
            const ct = grid[p.y]?.[p.x];
            if (!ct) return false;
            const bType = ct.building.type;
            const isBuilding = bType !== 'grass' && bType !== 'empty' && bType !== 'water';
            if (!isBuilding) return true; // Noch kein Gebaeude
            return (ct.building.constructionProgress ?? 100) < 100; // Noch im Bau
          });
          if (!hasUnbuiltTile) continue;

          // Pruefen ob der GESAMTE Cluster Strom/Wasser/Strasse hat (mindestens 1 Tile)
          let clusterHasPower = false;
          let clusterHasWater = false;
          let clusterHasRoad = false;
          // Globales Wasser: wenn genug produziert → alle versorgt
          if (_effectiveWaterProd > 0 && (_effectiveWaterCons <= 0 || _effectiveWaterProd >= _effectiveWaterCons)) {
            clusterHasWater = true;
          }
          for (const p of cluster.tiles) {
            if (state.services.power[p.y]?.[p.x]) clusterHasPower = true;
            if (!clusterHasWater && _effectiveWaterProd > 0 && _effectiveWaterCons > 0) {
              if (Math.abs(Math.sin(p.x * 127.1 + p.y * 311.7)) % 1 < _effectiveWaterProd / _effectiveWaterCons) {
                clusterHasWater = true;
              }
            }
            if (!clusterHasRoad) {
              if (hasRoad(p.x - 1, p.y) || hasRoad(p.x + 1, p.y) ||
                hasRoad(p.x, p.y - 1) || hasRoad(p.x, p.y + 1)) clusterHasRoad = true;
            }
            if (clusterHasPower && clusterHasWater && clusterHasRoad) break;
          }

          const missing: string[] = [];
          if (!clusterHasPower) missing.push('power');
          if (!clusterHasWater) missing.push('water');
          if (!clusterHasRoad) missing.push('road');
          if (missing.length === 0) continue;

          // Mittelpunkt des Clusters berechnen
          let avgX = 0, avgY = 0;
          for (const p of cluster.tiles) { avgX += p.x; avgY += p.y; }
          avgX = Math.round(avgX / cluster.tiles.length);
          avgY = Math.round(avgY / cluster.tiles.length);

          const { screenX: scX, screenY: scY } = gridToScreen(avgX, avgY, 0, 0);
          const elev = grid[avgY]?.[avgX]?.elevation || 0;
          const baseY = scY - elev * HEIGHT_STEP;

          // Viewport-Check
          if (scX + TILE_WIDTH < viewLeft || scX - TILE_WIDTH > viewRight ||
            baseY + TILE_HEIGHT < viewTop || baseY - 60 > viewBottom) continue;

          const iconSize = Math.max(12, Math.round(16 * zoom));
          const iconGap = Math.round(iconSize * 0.5);
          const totalW = missing.length * iconSize + (missing.length - 1) * iconGap;
          const startIX = scX + TILE_WIDTH / 2 - totalW / 2;
          const iconBaseY = baseY - iconSize * 0.5;

          // Hintergrund-Pill
          const pillPad = 4;
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          const pillW = totalW + pillPad * 2;
          const pillH = iconSize + pillPad * 2;
          const pillX = startIX - pillPad;
          const pillY = iconBaseY - pillPad;
          const pillR = pillH / 2;
          ctx.beginPath();
          ctx.moveTo(pillX + pillR, pillY);
          ctx.lineTo(pillX + pillW - pillR, pillY);
          ctx.arc(pillX + pillW - pillR, pillY + pillR, pillR, -Math.PI / 2, Math.PI / 2);
          ctx.lineTo(pillX + pillR, pillY + pillH);
          ctx.arc(pillX + pillR, pillY + pillR, pillR, Math.PI / 2, -Math.PI / 2);
          ctx.closePath();
          ctx.fill();

          for (let mi = 0; mi < missing.length; mi++) {
            const ix = startIX + mi * (iconSize + iconGap);
            const iy = iconBaseY;
            const svc = missing[mi];

            if (svc === 'power') {
              // Blitz (gelb)
              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              const bx = ix + iconSize * 0.25, by = iy + iconSize * 0.1;
              const bw = iconSize * 0.5, bh = iconSize * 0.8;
              ctx.moveTo(bx + bw * 0.6, by);
              ctx.lineTo(bx, by + bh * 0.55);
              ctx.lineTo(bx + bw * 0.45, by + bh * 0.45);
              ctx.lineTo(bx + bw * 0.35, by + bh);
              ctx.lineTo(bx + bw, by + bh * 0.45);
              ctx.lineTo(bx + bw * 0.55, by + bh * 0.55);
              ctx.closePath();
              ctx.fill();
            } else if (svc === 'water') {
              // Tropfen (blau)
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath();
              const cx2 = ix + iconSize / 2, cy2 = iy + iconSize * 0.65;
              const r = iconSize * 0.3;
              ctx.arc(cx2, cy2, r, 0, Math.PI, false);
              ctx.lineTo(cx2, iy + iconSize * 0.1);
              ctx.closePath();
              ctx.fill();
            } else if (svc === 'road') {
              // Strasse (grau + weisse Streifen)
              ctx.fillStyle = '#a1a1aa';
              const rx = ix + iconSize * 0.2, ry = iy + iconSize * 0.15;
              const rw = iconSize * 0.6, rh = iconSize * 0.7;
              ctx.fillRect(rx, ry, rw, rh);
              ctx.fillStyle = '#fafafa';
              const sw = rw * 0.15;
              ctx.fillRect(rx + rw / 2 - sw / 2, ry + rh * 0.1, sw, rh * 0.25);
              ctx.fillRect(rx + rw / 2 - sw / 2, ry + rh * 0.55, sw, rh * 0.25);
            }
          }
        }
      }

      ctx.restore();
    }); // End requestAnimationFrame callback

    // PERF: Cleanup - cancel pending render on unmount or deps change
    return () => {
      if (renderPendingRef.current !== null) {
        cancelAnimationFrame(renderPendingRef.current);
        renderPendingRef.current = null;
      }
    };
    // PERF: hoveredTile and selectedTile removed from deps - now rendered on separate hover canvas layer
    // windTick triggers re-render every 100ms so tree sway (Date.now()) animates;
    // with the static tile cache the windTick frames hit the fast path (1× drawImage) + buildings section only
  }, [grid, gridSize, offset, zoom, overlayMode, imagesLoaded, imageLoadVersion, canvasSize, dragStartTile, dragEndTile, state.services, currentSpritePack, waterBodies, adjacentCities, getTileMetadata, showsDragGrid, isMobile, windTick]);

  // PERF: Lightweight hover/selection overlay - renders ONLY tile highlights
  // This runs frequently (on mouse move) but is extremely fast since it only draws simple shapes
  useEffect(() => {
    const canvas = hoverCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Clear the hover canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform (same as main canvas)
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    const getTileScreenWithElevation = (tx: number, ty: number) => {
      const { screenX, screenY: rawScreenY } = gridToScreen(tx, ty, 0, 0);
      const elevation = Number(grid?.[ty]?.[tx]?.elevation || 0);
      return {
        screenX,
        screenY: rawScreenY - elevation * HEIGHT_STEP,
      };
    };

    // Helper to draw highlight diamond
    const drawHighlight = (screenX: number, screenY: number, color: string = 'rgba(255, 255, 255, 0.25)', strokeColor: string = '#ffffff') => {
      const w = TILE_WIDTH;
      const h = TILE_HEIGHT;

      // Draw semi-transparent fill
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(screenX + w / 2, screenY);
      ctx.lineTo(screenX + w, screenY + h / 2);
      ctx.lineTo(screenX + w / 2, screenY + h);
      ctx.lineTo(screenX, screenY + h / 2);
      ctx.closePath();
      ctx.fill();

      // Draw border
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    // Draw hovered tile highlight (with multi-tile preview for buildings)
    if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < gridSize && hoveredTile.y >= 0 && hoveredTile.y < gridSize) {
      // Check if selectedTool is a building type (not a non-building tool)
      const nonBuildingTools: Tool[] = [
        'select', 'bulldoze', 'road', 'rail', 'subway', 'tree', 'label',
        'zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone', 'zone_water', 'zone_land',
        'terrain_raise', 'terrain_lower', 'terrain_lower2', 'terrain_hill', 'terrain_mountain', 'terrain_flatten',
        'paint_green', 'paint_sand', 'paint_dirt', 'paint_snow', 'paint_dark_grass', 'paint_rock', 'paint_reset',
        'npc_woodcutter', 'npc_gardener', 'npc_police_chase', 'npc_gangster', 'npc_buenzli',
      ];
      const isBuildingTool = selectedTool && !nonBuildingTools.includes(selectedTool);

      // ── Residence placement ghost ──────────────────────────────────────────
      if (residencePlacementRef.current) {
        const { variantRow, variantCol } = residencePlacementRef.current;
        const w = TILE_WIDTH;
        const h = TILE_HEIGHT;
        // 2×2 footprint highlight
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            const tx = hoveredTile.x + dx;
            const ty = hoveredTile.y + dy;
            if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
              const { screenX, screenY } = getTileScreenWithElevation(tx, ty);
              drawHighlight(screenX, screenY, 'rgba(251,191,36,0.15)', 'rgba(251,191,36,0.7)');
            }
          }
        }
        // Sprite ghost from mansion_alternates.png
        const activePack = getActiveSpritePack();
        const mansionSrc = activePack.mansionsSrc;
        if (mansionSrc) {
          const sheet = getCachedImage(mansionSrc, true) || getCachedImage(mansionSrc);
          if (sheet) {
            const COLS = activePack.mansionsCols || 5;
            const ROWS = activePack.mansionsRows || 6;
            const tileW = (sheet.naturalWidth || sheet.width) / COLS;
            const tileH = (sheet.naturalHeight || sheet.height) / ROWS;
            const sx = variantCol * tileW;
            const sy = variantRow * tileH;
            const destWidth = w * 2.4;
            const destHeight = destWidth * (tileH / tileW);
            const { screenX: originX, screenY: originY } = getTileScreenWithElevation(hoveredTile.x, hoveredTile.y);
            // 2×2 multi-tile offset (same formula as building ghost for 2×2 buildings)
            const screenOffsetX = (1 - 1) * (w / 2);
            const screenOffsetY = (1 + 1) * (h / 2);
            const drawPosX = originX + screenOffsetX;
            const drawPosY = originY + screenOffsetY;
            const drawX = drawPosX + w / 2 - destWidth / 2;
            // Match real mansion vertical: footprintDepth(2)*h*0.25 + mansionsVerticalOffset(-0.65)*h
            const verticalPush = 2 * h * 0.25 + (-0.65) * h;
            const drawY = drawPosY + h - destHeight + verticalPush;
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.drawImage(sheet, sx, sy, tileW, tileH, Math.round(drawX), Math.round(drawY), Math.round(destWidth), Math.round(destHeight));
            ctx.restore();
          }
        }
      }

      // Furni ghost preview (uses composite cache from drawFurni system)
      const isFurniToolHover = typeof selectedTool === 'string' && selectedTool.startsWith('furni_');
      if (residencePlacementRef.current) {
        // skip tool-based ghost during residence placement — already drawn above
      } else if (isFurniToolHover) {
        const { screenX, screenY } = getTileScreenWithElevation(hoveredTile.x, hoveredTile.y);
        const cls = selectedTool.replace(/^furni_/, '');
        const cKey = `${cls}_2_0`;
        const cached = _furniCompositeCache[cKey];
        if (!cached) _loadFurniComposite(cls, 2, 0, notifyImageLoaded);
        // Draw tile highlight
        drawHighlight(screenX, screenY);
        // Draw ghost composite if ready (same scale/position as drawFurni)
        if (cached && cached !== 'loading' && cached !== 'error') {
          const FURNI_SCALE = 0.75;
          const gW = (cached.img.naturalWidth || cached.img.width) * FURNI_SCALE;
          const gH = (cached.img.naturalHeight || cached.img.height) * FURNI_SCALE;
          const gcx = screenX + TILE_WIDTH / 2;
          const gcy = screenY + TILE_HEIGHT / 2;
          const gx = gcx - cached.anchorX * FURNI_SCALE;
          const gy = gcy - cached.anchorY * FURNI_SCALE;
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.drawImage(cached.img, Math.round(gx), Math.round(gy), Math.round(gW), Math.round(gH));
          ctx.restore();
        }
      } else if (isBuildingTool) {
        // Get building size and draw preview for all tiles in footprint
        const buildingType = selectedTool as BuildingType;
        const buildingSize = getBuildingSize(buildingType);

        // Check if all tiles in footprint are valid for placement
        let allTilesValid = true;
        for (let dx = 0; dx < buildingSize.width; dx++) {
          for (let dy = 0; dy < buildingSize.height; dy++) {
            const tx = hoveredTile.x + dx;
            const ty = hoveredTile.y + dy;
            if (tx < 0 || tx >= gridSize || ty < 0 || ty >= gridSize) {
              allTilesValid = false;
            }
          }
        }

        // Draw highlight for each tile in the building footprint
        const highlightColor = allTilesValid ? 'rgba(255, 255, 255, 0.15)' : 'rgba(239, 68, 68, 0.2)';
        const highlightStroke = allTilesValid ? 'rgba(255, 255, 255, 0.6)' : '#ef4444';
        for (let dx = 0; dx < buildingSize.width; dx++) {
          for (let dy = 0; dy < buildingSize.height; dy++) {
            const tx = hoveredTile.x + dx;
            const ty = hoveredTile.y + dy;
            if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
              const { screenX, screenY } = getTileScreenWithElevation(tx, ty);
              drawHighlight(screenX, screenY, highlightColor, highlightStroke);
            }
          }
        }

        // Draw ghost sprite preview of the building
        if (allTilesValid) {
          const activePack = getActiveSpritePack();
          const w = TILE_WIDTH;
          const h = TILE_HEIGHT;

          // Create a minimal fake building for sprite lookup (normal state, not under construction)
          const fakeBuilding: Building = {
            type: buildingType,
            level: 1,
            population: 0,
            jobs: 0,
            powered: false,
            watered: false,
            onFire: false,
            fireProgress: 0,
            age: 0,
            constructionProgress: 100,
            abandoned: false,
          };

          // Check if building type has a sprite
          const hasTileSprite = BUILDING_TO_SPRITE[buildingType] ||
            (activePack.parksBuildings && activePack.parksBuildings[buildingType]) ||
            (activePack.stationsVariants && activePack.stationsVariants[buildingType]) ||
            (activePack.treesVariants && activePack.treesVariants[buildingType]) ||
            (activePack.standaloneSrcs && activePack.standaloneSrcs[buildingType]) ||
            (activePack.infrastructureVariants && activePack.infrastructureVariants[buildingType]) ||
            (activePack.servicesVariants && activePack.servicesVariants[buildingType]);

          if (buildingType === 'wind_turbine') {
            // Wind turbine has no sprite sheet entry — draw inline with Canvas 2D
            const { screenX: wtX, screenY: wtY } = getTileScreenWithElevation(hoveredTile.x, hoveredTile.y);
            const cx = wtX + w / 2;
            const baseY = wtY + h * 0.82;
            const towerH = 88;
            const hubY = baseY - towerH + 5;
            ctx.save();
            ctx.globalAlpha = 0.55;
            // Tower
            ctx.beginPath();
            ctx.moveTo(cx - 2, hubY + 4);
            ctx.lineTo(cx + 2, hubY + 4);
            ctx.lineTo(cx + 5, baseY);
            ctx.lineTo(cx - 5, baseY);
            ctx.closePath();
            ctx.fillStyle = '#d0d0d0';
            ctx.fill();
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 0.7;
            ctx.stroke();
            // Nacelle
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(cx - 9, hubY - 3, 18, 8);
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 0.7;
            ctx.strokeRect(cx - 9, hubY - 3, 18, 8);
            // 3 blades (static in preview, pointing at 90°/210°/330° — one straight up)
            const bladeLen = 52;
            const PERSP_Y = 0.82;
            for (let bi = 0; bi < 3; bi++) {
              const ang = Math.PI / 2 + (bi * Math.PI * 2) / 3;
              const tipX = cx + Math.cos(ang) * bladeLen;
              const tipY = hubY + Math.sin(ang) * PERSP_Y * bladeLen;
              // Edge-on effect: thinner when horizontal
              const edgeFactor = 0.18 + 0.82 * Math.abs(Math.sin(ang));
              const lineW = Math.max(1.5, 7 * edgeFactor);
              ctx.beginPath();
              ctx.moveTo(cx, hubY);
              ctx.lineTo(tipX, tipY);
              ctx.strokeStyle = '#e8e8e8';
              ctx.lineWidth = lineW;
              ctx.lineCap = 'round';
              ctx.stroke();
              ctx.strokeStyle = 'rgba(150,150,150,0.5)';
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
            // Hub
            ctx.beginPath();
            ctx.arc(cx, hubY, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#d8d8d8';
            ctx.fill();
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          } else if (hasTileSprite) {
            const spriteSourceInfo = selectSpriteSource(buildingType, fakeBuilding, hoveredTile.x, hoveredTile.y, activePack);
            const filteredSpriteSheet = getCachedImage(spriteSourceInfo.source, true) || getCachedImage(spriteSourceInfo.source);

            if (filteredSpriteSheet) {
              const sheetWidth = filteredSpriteSheet.naturalWidth || filteredSpriteSheet.width;
              const sheetHeight = filteredSpriteSheet.naturalHeight || filteredSpriteSheet.height;
              const coords = calculateSpriteCoords(buildingType, spriteSourceInfo, sheetWidth, sheetHeight, activePack);

              if (coords) {
                const scaleMultiplier = calculateSpriteScale(buildingType, spriteSourceInfo, fakeBuilding, activePack);
                const offsets = calculateSpriteOffsets(buildingType, spriteSourceInfo, fakeBuilding, activePack);

                const isMultiTile = buildingSize.width > 1 || buildingSize.height > 1;
                const { screenX: originX, screenY: originY } = getTileScreenWithElevation(hoveredTile.x, hoveredTile.y);

                // Calculate draw position for multi-tile buildings
                let drawPosX = originX;
                let drawPosY = originY;

                if (isMultiTile) {
                  const frontmostOffsetX = buildingSize.width - 1;
                  const frontmostOffsetY = buildingSize.height - 1;
                  const screenOffsetX = (frontmostOffsetX - frontmostOffsetY) * (w / 2);
                  const screenOffsetY = (frontmostOffsetX + frontmostOffsetY) * (h / 2);
                  drawPosX = originX + screenOffsetX;
                  drawPosY = originY + screenOffsetY;
                }

                const isStandaloneVariantPreview =
                  spriteSourceInfo.variantType === 'standalone' ||
                  spriteSourceInfo.variantType === 'standaloneConstruction' ||
                  spriteSourceInfo.variantType === 'standaloneAbandoned';

                // Calculate destination size
                const baseDestWidthPrev = w * 1.2 * scaleMultiplier;
                const aspectRatio = coords.sh / coords.sw;
                const baseDestHeightPrev = baseDestWidthPrev * aspectRatio;

                const standaloneScaleFactorPrev = isStandaloneVariantPreview ? (activePack.standaloneScales?.[buildingType] ?? 1) : 1;

                let destWidth: number;
                let destHeight: number;
                let drawX: number;

                if (isStandaloneVariantPreview && isMultiTile) {
                  const hBoundsPrev = getStandaloneHorizontalBounds(filteredSpriteSheet as HTMLImageElement);
                  const contentFractionPrev = 1 - hBoundsPrev.leftEmptyFraction - hBoundsPrev.rightEmptyFraction;
                  const footprintScreenWidthPrev = (buildingSize.width + buildingSize.height) * (w / 2);

                  const autoScalePrev = contentFractionPrev > 0.05
                    ? (footprintScreenWidthPrev / contentFractionPrev / baseDestWidthPrev) * standaloneScaleFactorPrev
                    : standaloneScaleFactorPrev;

                  destWidth  = baseDestWidthPrev  * autoScalePrev;
                  destHeight = baseDestHeightPrev * autoScalePrev;

                  const visualCenterFractionPrev = hBoundsPrev.leftEmptyFraction + contentFractionPrev / 2;
                  const footprintCenterXPrev = drawPosX + w / 2;
                  drawX = footprintCenterXPrev - visualCenterFractionPrev * destWidth + offsets.horizontal * w;
                } else {
                  destWidth  = baseDestWidthPrev  * standaloneScaleFactorPrev;
                  destHeight = baseDestHeightPrev * standaloneScaleFactorPrev;
                  drawX = drawPosX + w / 2 - destWidth / 2 + offsets.horizontal * w;
                }

                let verticalPush: number;
                if (isMultiTile && isStandaloneVariantPreview) {
                  const emptyBottomPreview = getStandaloneBottomEmptyFraction(filteredSpriteSheet as HTMLImageElement);
                  verticalPush = emptyBottomPreview * destHeight;
                } else if (isMultiTile) {
                  const footprintDepth = buildingSize.width + buildingSize.height - 2;
                  verticalPush = footprintDepth * h * 0.25;
                } else {
                  verticalPush = destHeight * 0.15;
                }
                verticalPush += offsets.vertical * h;
                // Apply pack-level per-building vertical offset override for standalone buildings
                if (isStandaloneVariantPreview) {
                  verticalPush += (activePack.standaloneVerticalOffsets?.[buildingType] ?? 0) * h;
                }
                const drawY = drawPosY + h - destHeight + verticalPush;

                // Draw semi-transparent ghost sprite (gespiegelt wenn placementFlipped)
                ctx.save();
                ctx.globalAlpha = 0.55;
                if (placementFlipped) {
                  const centerX = Math.round(drawX + destWidth / 2);
                  ctx.translate(centerX, 0);
                  ctx.scale(-1, 1);
                  ctx.translate(-centerX, 0);
                }
                ctx.drawImage(
                  filteredSpriteSheet,
                  coords.sx, coords.sy, coords.sw, coords.sh,
                  Math.round(drawX), Math.round(drawY),
                  Math.round(destWidth), Math.round(destHeight)
                );
                ctx.restore();
              }
            }
          }
        }
      } else {
        // Single tile highlight for non-building tools
        const { screenX, screenY } = getTileScreenWithElevation(hoveredTile.x, hoveredTile.y);
        drawHighlight(screenX, screenY);
      }

      // ── Platzierungs-Vorschau Pill (Wasser-Infrastruktur) ─────────────────
      {
        const PLACEMENT_INFO: Partial<Record<string, string>> = {
          water_tower: '+80 m³/h · −2 MW',
          water_reservoir: '+2\'000 m³ Speicher · −5 MW',
        };
        const infoText = PLACEMENT_INFO[selectedTool as string];
        if (infoText && hoveredTile) {
          const buildingSize = getBuildingSize(selectedTool as BuildingType);
          const { screenX: ox, screenY: oy } = getTileScreenWithElevation(hoveredTile.x, hoveredTile.y);
          const pillX = ox + TILE_WIDTH / 2;
          const pillY = oy - (buildingSize.height > 1 ? TILE_HEIGHT * 1.8 : TILE_HEIGHT * 0.6);

          const fontSize = Math.max(10, Math.round(13 * zoom));
          ctx.save();
          ctx.font = `bold ${fontSize}px sans-serif`;
          const textW = ctx.measureText(infoText).width;
          const pad = 6;
          const pillW = textW + pad * 2;
          const pillH = fontSize + pad * 1.5;
          const rx = pillX - pillW / 2;
          const ry = pillY - pillH / 2;
          const r = pillH / 2;

          ctx.beginPath();
          ctx.moveTo(rx + r, ry);
          ctx.lineTo(rx + pillW - r, ry);
          ctx.arcTo(rx + pillW, ry, rx + pillW, ry + r, r);
          ctx.lineTo(rx + pillW, ry + pillH - r);
          ctx.arcTo(rx + pillW, ry + pillH, rx + pillW - r, ry + pillH, r);
          ctx.lineTo(rx + r, ry + pillH);
          ctx.arcTo(rx, ry + pillH, rx, ry + pillH - r, r);
          ctx.lineTo(rx, ry + r);
          ctx.arcTo(rx, ry, rx + r, ry, r);
          ctx.closePath();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.88)';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(infoText, pillX, pillY);
          ctx.restore();
        }
      }
    }

    // Draw selected tile highlight (including multi-tile buildings)
    if (selectedTile && selectedTile.x >= 0 && selectedTile.x < gridSize && selectedTile.y >= 0 && selectedTile.y < gridSize) {
      const selectedOrigin = grid[selectedTile.y]?.[selectedTile.x];
      if (selectedOrigin) {
        const selectedSize = getBuildingSize(selectedOrigin.building.type);
        // Draw highlight for each tile in the building footprint
        for (let dx = 0; dx < selectedSize.width; dx++) {
          for (let dy = 0; dy < selectedSize.height; dy++) {
            const tx = selectedTile.x + dx;
            const ty = selectedTile.y + dy;
            if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
              const { screenX, screenY } = getTileScreenWithElevation(tx, ty);
              drawHighlight(screenX, screenY, 'rgba(100, 200, 255, 0.3)', '#60a5fa');
            }
          }
        }
      }
    }

    // Draw road/rail drag preview with bridge validity indication
    if (isDragging && (selectedTool === 'road' || selectedTool === 'rail') && dragStartTile && dragEndTile) {
      const minX = Math.min(dragStartTile.x, dragEndTile.x);
      const maxX = Math.max(dragStartTile.x, dragEndTile.x);
      const minY = Math.min(dragStartTile.y, dragEndTile.y);
      const maxY = Math.max(dragStartTile.y, dragEndTile.y);

      // Collect all tiles in the path
      const pathTiles: { x: number; y: number; isWater: boolean }[] = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            const tile = grid[y][x];
            pathTiles.push({ x, y, isWater: tile.building.type === 'water' });
          }
        }
      }

      // Analyze the path for bridge validity
      // A valid bridge: water tiles that are bounded by land/road on both ends
      // An invalid partial crossing: water tiles that don't form a complete bridge
      const analyzePathForBridges = () => {
        const result: Map<string, 'valid' | 'invalid' | 'land'> = new Map();

        // Determine if this is a horizontal or vertical path
        const isHorizontal = maxX - minX > maxY - minY;

        // Sort tiles by their position along the path
        const sortedTiles = [...pathTiles].sort((a, b) =>
          isHorizontal ? a.x - b.x : a.y - b.y
        );

        // Find water segments and check if they're valid bridges
        let i = 0;
        while (i < sortedTiles.length) {
          const tile = sortedTiles[i];

          if (!tile.isWater) {
            // Land tile - always valid
            result.set(`${tile.x},${tile.y}`, 'land');
            i++;
            continue;
          }

          // Found water - find the extent of this water segment
          const waterStart = i;
          while (i < sortedTiles.length && sortedTiles[i].isWater) {
            i++;
          }
          const waterEnd = i - 1;
          const waterLength = waterEnd - waterStart + 1;

          // Check if this water segment is bounded by land on both sides
          const hasLandBefore = waterStart > 0 && !sortedTiles[waterStart - 1].isWater;
          const hasLandAfter = waterEnd < sortedTiles.length - 1 && !sortedTiles[waterEnd + 1].isWater;

          // Also check if there's existing land/road adjacent to the start/end of path
          let hasExistingLandBefore = false;
          let hasExistingLandAfter = false;

          if (waterStart === 0) {
            // Check the tile before the path start
            const firstWater = sortedTiles[waterStart];
            const checkX = isHorizontal ? firstWater.x - 1 : firstWater.x;
            const checkY = isHorizontal ? firstWater.y : firstWater.y - 1;
            if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
              const prevTile = grid[checkY][checkX];
              hasExistingLandBefore = prevTile.building.type !== 'water';
            }
          }

          if (waterEnd === sortedTiles.length - 1) {
            // Check the tile after the path end
            const lastWater = sortedTiles[waterEnd];
            const checkX = isHorizontal ? lastWater.x + 1 : lastWater.x;
            const checkY = isHorizontal ? lastWater.y : lastWater.y + 1;
            if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
              const nextTile = grid[checkY][checkX];
              hasExistingLandAfter = nextTile.building.type !== 'water';
            }
          }

          const isValidBridge = (hasLandBefore || hasExistingLandBefore) &&
            (hasLandAfter || hasExistingLandAfter) &&
            waterLength <= 10; // Max bridge span

          // Mark all water tiles in this segment
          for (let j = waterStart; j <= waterEnd; j++) {
            const waterTile = sortedTiles[j];
            result.set(`${waterTile.x},${waterTile.y}`, isValidBridge ? 'valid' : 'invalid');
          }
        }

        return result;
      };

      const bridgeAnalysis = analyzePathForBridges();

      // Draw preview for each tile in the path
      for (const tile of pathTiles) {
        const { screenX, screenY } = getTileScreenWithElevation(tile.x, tile.y);
        const key = `${tile.x},${tile.y}`;
        const status = bridgeAnalysis.get(key) || 'land';

        if (status === 'valid') {
          // Valid bridge - show blue/cyan placeholder
          drawHighlight(screenX, screenY, 'rgba(59, 130, 246, 0.5)', '#3b82f6');
        } else if (status === 'invalid') {
          // Invalid water crossing - show red
          drawHighlight(screenX, screenY, 'rgba(239, 68, 68, 0.5)', '#ef4444');
        }
        // Land tiles don't need special preview - they're already being placed
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [hoveredTile, selectedTile, selectedTool, offset, zoom, gridSize, grid, isDragging, dragStartTile, dragEndTile, placementFlipped]);

  // Animate decorative car traffic AND emergency vehicles on top of the base canvas
  useEffect(() => {
    const canvas = carsCanvasRef.current;
    const airCanvas = airCanvasRef.current;
    if (!canvas || !airCanvas) return;
    const ctx = canvas.getContext('2d');
    const airCtx = airCanvas.getContext('2d');
    if (!ctx || !airCtx) return;

    ctx.imageSmoothingEnabled = false;
    airCtx.imageSmoothingEnabled = false;

    const clearAirCanvas = () => {
      airCtx.setTransform(1, 0, 0, 1, 0, 0);
      airCtx.clearRect(0, 0, airCanvas.width, airCanvas.height);
    };

    let animationFrameId: number;
    let lastTime = performance.now();
    let lastRenderTime = 0;

    // Target 30fps on mobile (33ms per frame), 60fps on desktop (16ms per frame)
    const targetFrameTime = isMobile ? 33 : 16;

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);

      // Frame rate limiting for mobile - skip frames to maintain target FPS
      const timeSinceLastRender = time - lastRenderTime;
      if (isMobile && timeSinceLastRender < targetFrameTime) {
        return; // Skip this frame on mobile to reduce CPU load
      }

      const delta = Math.min((time - lastTime) / 1000, 0.3);
      lastTime = time;
      lastRenderTime = time;

      // PERF: Skip ALL vehicle/entity updates during mobile panning/zooming (not just drawing)
      // This provides a massive performance boost for big cities on mobile
      const skipMobileUpdates = isMobile && (isPanningRef.current || isPinchZoomingRef.current);

      if (delta > 0 && !skipMobileUpdates) {
        updateCars(delta);
        // Party-Autos sofort wegschicken wenn ihre Party beendet wurde
        {
          const _activePartyKeys = new Set(
            (mansionPartiesRef?.current ?? []).map(p => `${p.tileX}_${p.tileY}`)
          );
          for (const car of carsRef.current) {
            if (car.isParty && car.partyMansionX !== undefined && car.partyMansionY !== undefined) {
              if (!_activePartyKeys.has(`${car.partyMansionX}_${car.partyMansionY}`)) {
                if (car.parked) car.parkedUntilAge = car.age; // sofort ausparken
                car.maxAge = car.age + 10;                    // 10s zum Wegfahren
                car.partyMansionX = undefined;                // nicht nochmals bearbeiten
                car.partyMansionY = undefined;
              }
            }
          }
        }
        updateBuses(delta);
        spawnCrimeIncidents(delta); // Spawn new crime incidents
        updateCrimeIncidents(delta); // Update/decay crime incidents
        updateEmergencyVehicles(delta); // Update emergency vehicles!
        updatePedestrians(delta); // Update pedestrians (zoom-gated)

        // Party-Auto Ausstieg: frisch parkierte Autos spawnen einen Gast-NPC
        for (const car of carsRef.current) {
          if (car.isParty && car.parked && !partyCarExitedRef.current.has(car.id)
              && car.partyMansionX !== undefined && car.partyMansionY !== undefined) {
            partyCarExitedRef.current.add(car.id);
            const { grid: exitGrid, gridSize: exitGridSize } = worldStateRef.current;
            if (exitGrid && exitGridSize > 0) {
              pedestrianIdRef.current++;
              const guest = createPartyGuestNpcUtil(
                pedestrianIdRef.current,
                car.partyMansionX,
                car.partyMansionY,
                exitGrid,
                exitGridSize
              );
              if (guest) {
                // NPC startet auf dem Auto-Tile, nicht auf einem zufälligen Punkt
                guest.tileX = car.tileX;
                guest.tileY = car.tileY;
                pedestriansRef.current = [...pedestriansRef.current, guest];
                // In partyGuestMap eintragen damit er beim Partyende abgeräumt wird
                const _partyKey = `${car.partyMansionX}_${car.partyMansionY}`;
                if (!partyGuestMap.has(_partyKey)) partyGuestMap.set(_partyKey, new Set());
                partyGuestMap.get(_partyKey)!.add(guest.id);
              }
            }
          }
        }
        // Augestiegene IDs von nicht mehr existierenden Autos aufräumen (alle ~10s)
        if (Math.floor(performance.now() / 10000) !== Math.floor((performance.now() - 16) / 10000)) {
          const activeCarIds = new Set(carsRef.current.map(c => c.id));
          for (const id of partyCarExitedRef.current) {
            if (!activeCarIds.has(id)) partyCarExitedRef.current.delete(id);
          }
        }

        // Party-Gäste NPC Verwaltung (Spawn/Despawn basierend auf Server-State)
        if (mansionPartiesRef?.current && mansionPartiesRef.current.length > 0) {
          const { grid: partyGrid, gridSize: partyGridSize } = worldStateRef.current;
          if (partyGrid && partyGridSize > 0) {
            // Adapter: React-Ref (.current) → { value } Interface von pedestrianSystem
            const partyIdAdapter = {
              get value() { return pedestrianIdRef.current; },
              set value(v: number) { pedestrianIdRef.current = v; }
            };
            updatePartyGuestsUtil(
              delta,
              mansionPartiesRef.current,
              pedestriansRef.current,
              partyGrid,
              partyGridSize,
              partyIdAdapter
            );

            // Party-Autos: alle ~4s ein neues spawnen (max 25 Party-Autos gleichzeitig)
            // Timer startet bei 3.5 damit sofort beim ersten Tick ein Auto erscheint
            if (partyCarSpawnTimerRef.current === 0) partyCarSpawnTimerRef.current = 3.5;
            partyCarSpawnTimerRef.current += delta;
            if (partyCarSpawnTimerRef.current >= 4) {
              partyCarSpawnTimerRef.current = 0;
              const partyCarCount = carsRef.current.filter(c => c.isParty).length;
              if (partyCarCount < 25) {
                // Zufällige aktive Party auswählen
                const activeParties = mansionPartiesRef.current.filter(
                  p => p.status !== 'shutdown'
                );
                if (activeParties.length > 0) {
                  const rndParty = activeParties[Math.floor(Math.random() * activeParties.length)];
                  spawnPartyGuestCar(rndParty.tileX, rndParty.tileY);
                }
              }
            }

          }
        } else {
          partyCarSpawnTimerRef.current = 0;
          // Auch bei leerer Party-Liste aufrufen damit tanzende Gäste zum Auto laufen
          const { grid: cleanGrid, gridSize: cleanGridSize } = worldStateRef.current;
          if (cleanGrid && cleanGridSize > 0) {
            const cleanIdAdapter = {
              get value() { return pedestrianIdRef.current; },
              set value(v: number) { pedestrianIdRef.current = v; }
            };
            updatePartyGuestsUtil(delta, [], pedestriansRef.current, cleanGrid, cleanGridSize, cleanIdAdapter);
          }
        }

        // Bünzli-NPC ist rein visuell — keine client-seitigen Violations mehr.
        // Strafen/Buchungen kommen nur vom Server via municipality_events System.

        updateBirds(delta); // Update bird flocks
        updateAirplanes(delta); // Update airplanes (airport required)
        updateHelicopters(delta); // Update helicopters (hospital/airport required)
        updateSeaplanes(delta); // Update seaplanes (bay/large water required)
        updateBoats(delta); // Update boats (marina/pier required)
        updateBarges(delta); // Update ocean barges (ocean marinas required)
        updateTrains(delta); // Update trains on rail network
        updateFireworks(delta, visualHour); // Update fireworks (nighttime only)
        updateSmog(delta); // Update factory smog particles
        if (!showPublicRoomWalls) {
          updateClouds(delta, visualHour); // Update atmospheric clouds
        }
        navLightFlashTimerRef.current += delta * 3; // Update nav light flash timer
        trafficLightTimerRef.current += delta; // Update traffic light cycle timer
        crossingFlashTimerRef.current += delta; // Update crossing flash timer

        // Update railroad crossing gate angles based on train proximity
        // PERF: Use cached crossing positions instead of O(n²) grid scan
        const trains = trainsRef.current;
        const gateAngles = crossingGateAnglesRef.current;
        // PERF: Access speed via worldStateRef to avoid animation restart on speed change
        const currentSpeed = worldStateRef.current.speed;
        const gateSpeedMult = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
        const crossings = crossingPositionsRef.current;
        const currentGridSize = worldStateRef.current.gridSize;

        // Iterate only over known crossings (O(k) where k = number of crossings)
        for (let i = 0; i < crossings.length; i++) {
          const { x: gx, y: gy } = crossings[i];
          // PERF: Use numeric key instead of string concatenation
          const key = gy * currentGridSize + gx;
          const currentAngle = gateAngles.get(key) ?? 0;
          const crossingState = getCrossingStateForTile(trains, gx, gy);

          // Determine target angle based on state
          const targetAngle = crossingState === 'open' ? 0 : 90;

          // Animate gate toward target
          if (currentAngle !== targetAngle) {
            const angleDelta = GATE_ANIMATION_SPEED * delta * gateSpeedMult;
            if (currentAngle < targetAngle) {
              gateAngles.set(key, Math.min(targetAngle, currentAngle + angleDelta));
            } else {
              gateAngles.set(key, Math.max(targetAngle, currentAngle - angleDelta));
            }
          }
        }
      }
      // Wind sway: force main canvas re-render every ~100ms so tree skew animates
      {
        const now = performance.now();
        if (now - lastWindRenderRef.current > 100) {
          lastWindRenderRef.current = now;
          setWindTick(prev => (prev + 1) & 0x7fffffff);
        }
      }

      // PERF: Skip drawing animated elements during mobile panning/zooming for better performance
      const skipAnimatedElements = isMobile && (isPanningRef.current || isPinchZoomingRef.current);
      // PERF: Skip small elements (boats, helis, smog) on desktop when panning while very zoomed out
      const skipSmallElements = !isMobile && isPanningRef.current && zoomRef.current < SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD;

      if (skipAnimatedElements) {
        // Clear the canvases but don't draw anything - hides all animated elements while panning/zooming
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearAirCanvas();
        if (pixiVehiclesRef.current?.initialized) pixiVehiclesRef.current.hide();
      } else {
        const currentZoom = zoomRef.current;
        const carMinZoom = isMobile ? CAR_MIN_ZOOM_MOBILE : CAR_MIN_ZOOM;
        const pixiVehicles = pixiVehiclesRef.current;
        const usePixiVehicles = pixiVehicles?.initialized && currentZoom >= 1.3;
        const isNight = visualHour >= 19 || visualHour < 6;

        if (usePixiVehicles) {
          pixiVehicles!.show();
          const { offset: vOff, zoom: vZoom } = worldStateRef.current;
          const dpr = window.devicePixelRatio || 1;
          pixiVehicles!.beginFrame(dpr, vZoom, vOff.x, vOff.y);

          if (vZoom >= carMinZoom) {
            for (const car of carsRef.current) {
              const { screenX, screenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
              const centerX = screenX + TILE_WIDTH / 2;
              const centerY = screenY + TILE_HEIGHT / 2;
              const meta = DIRECTION_META[car.direction];
              pixiVehicles!.addVehicle({
                x: centerX + meta.vec.dx * car.progress + meta.normal.nx * car.laneOffset,
                y: centerY + meta.vec.dy * car.progress + meta.normal.ny * car.laneOffset,
                angle: meta.angle,
                color: car.color,
                type: 'car',
              // Parkierte Party-Autos: Motor aus → keine Scheinwerfer nachts
              }, isNight && !car.parked);
            }
          }

          for (const bus of busesRef.current) {
            const { screenX, screenY } = gridToScreen(bus.tileX, bus.tileY, 0, 0);
            const centerX = screenX + TILE_WIDTH / 2;
            const centerY = screenY + TILE_HEIGHT / 2;
            const meta = DIRECTION_META[bus.direction];
            pixiVehicles!.addVehicle({
              x: centerX + meta.vec.dx * bus.progress + meta.normal.nx * bus.laneOffset,
              y: centerY + meta.vec.dy * bus.progress + meta.normal.ny * bus.laneOffset,
              angle: meta.angle,
              color: bus.color,
              type: 'bus',
            }, isNight);
          }

          for (const ev of emergencyVehiclesRef.current) {
            const { screenX, screenY } = gridToScreen(ev.tileX, ev.tileY, 0, 0);
            const centerX = screenX + TILE_WIDTH / 2;
            const centerY = screenY + TILE_HEIGHT / 2;
            const meta = DIRECTION_META[ev.direction];
            pixiVehicles!.addVehicle({
              x: centerX + meta.vec.dx * ev.progress + meta.normal.nx * ev.laneOffset,
              y: centerY + meta.vec.dy * ev.progress + meta.normal.ny * ev.laneOffset,
              angle: meta.angle,
              color: '',
              type: ev.type === 'fire_truck' ? 'emergency_fire' : ev.type === 'ambulance' ? 'emergency_ambulance' : 'emergency_police',
              flashTimer: ev.flashTimer,
            }, isNight);
          }

          pixiVehicles!.endFrame();

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
          if (pixiVehicles?.initialized) pixiVehicles.hide();
          drawCars(ctx);
          drawBuses(ctx);
          // ── Helper: draw a pre-computed bus line path + stop markers ──
          const drawBusLineFromPath = (fullPath: { x: number; y: number }[], stops: { x: number; y: number }[], color: string, isDashed: boolean) => {
            const { offset: blOffset, zoom: blZoom } = worldStateRef.current;
            const blDpr = window.devicePixelRatio || 1;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(blDpr * blZoom, blDpr * blZoom);
            ctx.translate(blOffset.x / blZoom, blOffset.y / blZoom);
            ctx.globalAlpha = isDashed ? 0.85 : 0.6;

            // Draw the road path with direction arrows
            if (fullPath.length >= 2) {
              ctx.lineWidth = 4;
              ctx.strokeStyle = color;
              ctx.setLineDash(isDashed ? [10, 5] : []);
              ctx.beginPath();
              // Convert path to screen coords once
              const screenPath: { sx: number; sy: number }[] = [];
              for (let j = 0; j < fullPath.length; j++) {
                const s = gridToScreen(fullPath[j].x, fullPath[j].y, 0, 0);
                screenPath.push({ sx: s.screenX + TILE_WIDTH / 2, sy: s.screenY + TILE_HEIGHT / 2 });
              }
              for (let j = 0; j < screenPath.length; j++) {
                if (j === 0) ctx.moveTo(screenPath[j].sx, screenPath[j].sy);
                else ctx.lineTo(screenPath[j].sx, screenPath[j].sy);
              }
              ctx.stroke();

              // Draw direction arrows every ~8 path segments
              ctx.setLineDash([]);
              ctx.fillStyle = color;
              const arrowInterval = 8;
              for (let j = arrowInterval; j < screenPath.length - 1; j += arrowInterval) {
                const prev = screenPath[j - 1];
                const curr = screenPath[j];
                const dx = curr.sx - prev.sx;
                const dy = curr.sy - prev.sy;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len < 1) continue;
                const angle = Math.atan2(dy, dx);
                const arrowSize = 6;
                ctx.save();
                ctx.translate(curr.sx, curr.sy);
                ctx.rotate(angle);
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.moveTo(arrowSize, 0);
                ctx.lineTo(-arrowSize, -arrowSize * 0.7);
                ctx.lineTo(-arrowSize, arrowSize * 0.7);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
            }

            // Draw stop markers
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            for (let i = 0; i < stops.length; i++) {
              const s = gridToScreen(stops[i].x, stops[i].y, 0, 0);
              const sx = s.screenX + TILE_WIDTH / 2;
              const sy = s.screenY + TILE_HEIGHT / 2;
              ctx.beginPath();
              ctx.arc(sx, sy, 8, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 10px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(i + 1), sx, sy);
            }
            ctx.restore();
          };

          // Draw saved bus lines only during creation/edit mode
          if (busLineCreationRef.current?.active) {
            const savedLines = busLinesRef.current;
            if (savedLines && savedLines.length > 0) {
              for (const line of savedLines) {
                if (line.fullPath && line.fullPath.length >= 2) {
                  drawBusLineFromPath(line.fullPath, line.stopSequence, line.color, false);
                }
              }
            }
          }

          // Draw bus line creation preview (compute path on the fly, cached in ref)
          if (busLineCreationRef.current?.active && busLineCreationRef.current.stops.length > 0) {
            const blStops = busLineCreationRef.current.stops;
            const blColor = busLineCreationRef.current.lineColor;
            // Build cache key from stop coordinates
            const cacheKey = blStops.map(s => `${s.x},${s.y}`).join('|');
            if (cacheKey !== busLinePreviewCacheKeyRef.current) {
              // Recompute path
              const currentGrid = worldStateRef.current.grid;
              const currentGridSize = worldStateRef.current.gridSize;
              const fullPath: { x: number; y: number }[] = [];
              for (let i = 0; i < blStops.length - 1; i++) {
                const segment = findPathOnRoadsUtil(currentGrid, currentGridSize, blStops[i].x, blStops[i].y, blStops[i + 1].x, blStops[i + 1].y);
                if (segment && segment.length > 0) {
                  if (fullPath.length > 0) fullPath.push(...segment.slice(1));
                  else fullPath.push(...segment);
                } else {
                  // Fallback: direct line
                  if (fullPath.length === 0) fullPath.push(blStops[i]);
                  fullPath.push(blStops[i + 1]);
                }
              }
              busLinePreviewPathRef.current = fullPath;
              busLinePreviewCacheKeyRef.current = cacheKey;
            }
            if (busLinePreviewPathRef.current.length >= 2) {
              drawBusLineFromPath(busLinePreviewPathRef.current, blStops, blColor, true);
            } else if (blStops.length === 1) {
              // Single stop: just draw the marker
              drawBusLineFromPath([], blStops, blColor, true);
            }
          } else {
            busLinePreviewCacheKeyRef.current = '';
            busLinePreviewPathRef.current = [];
          }
          drawEmergencyVehicles(ctx);
        }

        if (!skipSmallElements) {
          drawBoats(ctx); // Draw boats on water (skip when panning zoomed out on desktop)
        }
        drawBarges(ctx); // Draw ocean barges (larger, keep visible)
        drawTrainsCallback(ctx); // Draw trains on rail network
        if (!skipSmallElements) {
          drawSmog(ctx); // Draw factory smog (skip when panning zoomed out on desktop)
        }
        drawPedestrians(ctx);
        clearAirCanvas();

        // Draw incident indicators on air canvas (above buildings so tooltips are visible)
        drawIncidentIndicators(airCtx, delta); // Draw fire/crime incident indicators!

        // Draw disaster markers on air canvas
        if (disastersRef?.current && disastersRef.current.length > 0) {
          const { offset: dOff, zoom: dZoom } = worldStateRef.current;
          const dDpr = window.devicePixelRatio || 1;
          const dViewW = airCanvas.width / (dDpr * dZoom);
          const dViewH = airCanvas.height / (dDpr * dZoom);
          const dViewL = -dOff.x / dZoom - TILE_WIDTH * 4;
          const dViewT = -dOff.y / dZoom - TILE_HEIGHT * 8;
          const dViewR = dViewW - dOff.x / dZoom + TILE_WIDTH * 4;
          const dViewB = dViewH - dOff.y / dZoom + TILE_HEIGHT * 8;
          const dTime = performance.now() / 1000;

          airCtx.save();
          airCtx.scale(dDpr * dZoom, dDpr * dZoom);
          airCtx.translate(dOff.x / dZoom, dOff.y / dZoom);

          for (const d of disastersRef.current) {
            const { screenX: dsx, screenY: dsy } = gridToScreen(d.x, d.y, 0, 0);
            const cx = dsx + TILE_WIDTH / 2;
            const cy = dsy + TILE_HEIGHT / 2;

            if (cx < dViewL || cx > dViewR || cy < dViewT || cy > dViewB) continue;

            const info = DISASTER_INFO[d.type];
            const isSelected = d.id === selectedDisasterId;
            const pc = parseInt(info.particleColor.slice(1), 16);
            const pr = (pc >> 16) & 255, pg = (pc >> 8) & 255, pb = pc & 255;
            const pulse = Math.sin(dTime * 3 + d.x * 1.3) * 0.3 + 0.7;
            const outerPulse = Math.sin(dTime * 2 + d.y * 1.7) * 0.5 + 0.5;

            // Vertical light beam
            const beamAlpha = 0.08 + Math.sin(dTime * 2 + d.x) * 0.04;
            const beamGrad = airCtx.createLinearGradient(cx, cy - 60, cx, cy);
            beamGrad.addColorStop(0, `rgba(${pr},${pg},${pb},0)`);
            beamGrad.addColorStop(0.4, `rgba(${pr},${pg},${pb},${beamAlpha.toFixed(2)})`);
            beamGrad.addColorStop(1, `rgba(${pr},${pg},${pb},${(beamAlpha * 2).toFixed(2)})`);
            airCtx.fillStyle = beamGrad;
            airCtx.beginPath();
            airCtx.moveTo(cx - 8, cy - 60);
            airCtx.lineTo(cx + 8, cy - 60);
            airCtx.lineTo(cx + 4, cy);
            airCtx.lineTo(cx - 4, cy);
            airCtx.closePath();
            airCtx.fill();

            // Outer glow
            const glowR = 30 + pulse * 8;
            const glowGrad = airCtx.createRadialGradient(cx, cy - 6, 0, cx, cy - 6, glowR);
            glowGrad.addColorStop(0, `rgba(${pr},${pg},${pb},0.3)`);
            glowGrad.addColorStop(0.3, `rgba(${pr},${pg},${pb},0.12)`);
            glowGrad.addColorStop(0.7, `rgba(${pr},${pg},${pb},0.04)`);
            glowGrad.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
            airCtx.fillStyle = glowGrad;
            airCtx.beginPath();
            airCtx.arc(cx, cy - 6, glowR, 0, Math.PI * 2);
            airCtx.fill();

            // Pulsating ring
            const ringR = 14 + outerPulse * 20;
            const ringAlpha = (1 - outerPulse) * 0.45;
            airCtx.beginPath();
            airCtx.arc(cx, cy - 6, ringR, 0, Math.PI * 2);
            airCtx.strokeStyle = `rgba(${pr},${pg},${pb},${ringAlpha.toFixed(2)})`;
            airCtx.lineWidth = 2 * (1 - outerPulse);
            airCtx.stroke();

            // Inner solid circle
            airCtx.beginPath();
            airCtx.arc(cx, cy - 6, 12, 0, Math.PI * 2);
            airCtx.fillStyle = `rgba(${pr},${pg},${pb},0.2)`;
            airCtx.fill();
            airCtx.strokeStyle = `rgba(${pr},${pg},${pb},0.5)`;
            airCtx.lineWidth = 1.5;
            airCtx.stroke();

            // Selection highlight
            if (isSelected) {
              airCtx.beginPath();
              airCtx.arc(cx, cy - 6, 22, 0, Math.PI * 2);
              airCtx.strokeStyle = `rgba(255,255,255,0.7)`;
              airCtx.lineWidth = 2;
              airCtx.setLineDash([4, 4]);
              airCtx.lineDashOffset = -dTime * 20;
              airCtx.stroke();
              airCtx.setLineDash([]);
              airCtx.lineDashOffset = 0;
            }

            // Emoji icon (bouncing)
            const bounce = Math.sin(dTime * 2.5 + d.x) * 3;
            airCtx.font = '20px serif';
            airCtx.textAlign = 'center';
            airCtx.textBaseline = 'middle';
            airCtx.shadowColor = `rgb(${pr},${pg},${pb})`;
            airCtx.shadowBlur = 8;
            airCtx.fillText(info.emoji, cx, cy - 22 + bounce);
            airCtx.shadowBlur = 0;

            // Particles per type
            const particleCount = 2 + Math.min(d.severity, 2);
            for (let i = 0; i < particleCount; i++) {
              const seed = d.x * 7.3 + d.y * 11.7 + i * 3.1;
              const t = (dTime * (0.8 + (i % 3) * 0.3) + seed) % 3;
              const life = t / 3;

              if (d.type === 'fire') {
                const px = cx + Math.sin(seed * 2.3 + dTime * 1.5) * (7 + i * 1.5);
                const py = cy - 10 - life * 45;
                const size = (1 - life) * 3.5;
                const alpha = (1 - life) * 0.55;
                airCtx.fillStyle = i % 3 === 0
                  ? `rgba(255,200,50,${alpha.toFixed(2)})`
                  : i % 3 === 1
                    ? `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`
                    : `rgba(100,100,100,${(alpha * 0.4).toFixed(2)})`;
                airCtx.beginPath();
                airCtx.arc(px, py, size, 0, Math.PI * 2);
                airCtx.fill();
              } else if (d.type === 'earthquake') {
                const angle = (i / particleCount) * Math.PI * 2 + dTime * 0.5;
                const dist = 10 + life * 25;
                const px = cx + Math.cos(angle) * dist;
                const py = cy - 4 + Math.sin(angle) * dist * 0.5;
                const alpha = (1 - life) * 0.4;
                airCtx.fillStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`;
                airCtx.beginPath();
                airCtx.arc(px, py, 2.5 + (1 - life) * 2, 0, Math.PI * 2);
                airCtx.fill();
              } else if (d.type === 'tornado') {
                const angle = (i / particleCount) * Math.PI * 2 + dTime * 3.5;
                const dist = 6 + life * 20;
                const px = cx + Math.cos(angle) * dist;
                const py = cy - 8 - life * 25 + Math.sin(angle) * dist * 0.3;
                const alpha = (1 - life) * 0.45;
                airCtx.fillStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`;
                airCtx.beginPath();
                airCtx.arc(px, py, 1.5 + life * 1.5, 0, Math.PI * 2);
                airCtx.fill();
              } else if (d.type === 'flood') {
                const waveR = 12 + life * 30;
                const alpha = (1 - life) * 0.35;
                airCtx.beginPath();
                airCtx.arc(cx, cy - 3, waveR, 0, Math.PI * 2);
                airCtx.strokeStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`;
                airCtx.lineWidth = 1.5;
                airCtx.stroke();
              } else if (d.type === 'meteor') {
                const px = cx + Math.sin(seed * 1.7) * 15;
                const py = cy - 35 + life * 40;
                const alpha = (1 - life) * 0.55;
                airCtx.fillStyle = `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`;
                airCtx.beginPath();
                airCtx.arc(px, py, (1 - life) * 3, 0, Math.PI * 2);
                airCtx.fill();
              }
            }
          }

          airCtx.restore();
        }

        // Draw party lighting effects for active mansion parties
        if (mansionPartiesRef?.current && mansionPartiesRef.current.length > 0) {
          const { offset: pOff, zoom: pZoom } = worldStateRef.current;
          const pDpr = window.devicePixelRatio || 1;
          const pTime = performance.now() / 1000;
          const PARTY_COLORS = ['#f43f5e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#06b6d4', '#facc15'];

          airCtx.save();
          airCtx.scale(pDpr * pZoom, pZoom * pDpr);
          airCtx.translate(pOff.x / pZoom, pOff.y / pZoom);

          for (const party of mansionPartiesRef.current) {
            // Mansion ist 2x2 — alle 4 Tiles abdecken
            // tileX/tileY ist die nordwestliche Ecke (top tile in iso)
            const isWarning3 = party.status === 'warning_3';
            const pulse = 0.5 + 0.5 * Math.sin(pTime * 5);
            const pulse2 = 0.5 + 0.5 * Math.sin(pTime * 3.3 + 1.2);

            // 4 Eck-Punkte des 2x2 Mansion-Footprints in Screenspace
            const corners = [
              gridToScreen(party.tileX,     party.tileY,     0, 0),
              gridToScreen(party.tileX + 1, party.tileY,     0, 0),
              gridToScreen(party.tileX,     party.tileY + 1, 0, 0),
              gridToScreen(party.tileX + 1, party.tileY + 1, 0, 0),
            ].map(s => ({ x: s.screenX + TILE_WIDTH / 2, y: s.screenY + TILE_HEIGHT / 2 }));

            // Zentrum des 2x2-Gebäudes
            const bldCx = (corners[0].x + corners[3].x) / 2;
            const bldCy = (corners[0].y + corners[3].y) / 2 - 8;

            if (isWarning3) {
              // Polizei-Blaulicht: Rot/Blau alternierend an den Ecken
              const blink = Math.floor(pTime * 4) % 2 === 0;
              corners.forEach((c, i) => {
                const col = (blink ? i < 2 : i >= 2) ? '#2563eb' : '#dc2626';
                const g = airCtx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 28);
                g.addColorStop(0, `${col}99`);
                g.addColorStop(1, `${col}00`);
                airCtx.fillStyle = g;
                airCtx.beginPath(); airCtx.arc(c.x, c.y, 28, 0, Math.PI * 2); airCtx.fill();
              });
            } else {
              // === Lichter-Effekte ===

              // 1) Grosser zentraler Glow über dem ganzen Gebäude
              const mainColor = PARTY_COLORS[Math.floor(pTime * 1.5) % PARTY_COLORS.length];
              const mainG = airCtx.createRadialGradient(bldCx, bldCy, 0, bldCx, bldCy, 70);
              mainG.addColorStop(0, `${mainColor}44`);
              mainG.addColorStop(0.5, `${mainColor}18`);
              mainG.addColorStop(1, `${mainColor}00`);
              airCtx.fillStyle = mainG;
              airCtx.beginPath(); airCtx.arc(bldCx, bldCy, 70, 0, Math.PI * 2); airCtx.fill();

              // 2) Rotierende Spotlights (4 Strahlen, je eigene Farbe)
              for (let si = 0; si < 4; si++) {
                const spotCol = PARTY_COLORS[(si + Math.floor(pTime * 2)) % PARTY_COLORS.length];
                const angle = pTime * 1.8 + (si / 4) * Math.PI * 2;
                const spotR = 45 + Math.sin(pTime * 2 + si) * 10;
                const sx = bldCx + Math.cos(angle) * spotR;
                const sy = bldCy + Math.sin(angle) * spotR * 0.45; // iso-Verzerrung
                const sg = airCtx.createRadialGradient(sx, sy, 0, sx, sy, 16);
                sg.addColorStop(0, `${spotCol}88`);
                sg.addColorStop(1, `${spotCol}00`);
                airCtx.fillStyle = sg;
                airCtx.beginPath(); airCtx.arc(sx, sy, 16, 0, Math.PI * 2); airCtx.fill();
              }

              // 3) Punkte-Lichter an allen 4 Ecken (pulsierend, verschiedene Farben)
              corners.forEach((c, i) => {
                const col = PARTY_COLORS[(i + Math.floor(pTime * 2.5)) % PARTY_COLORS.length];
                const r = 18 + (i % 2 === 0 ? pulse : pulse2) * 8;
                const g2 = airCtx.createRadialGradient(c.x, c.y - 2, 0, c.x, c.y - 2, r);
                g2.addColorStop(0, `${col}bb`);
                g2.addColorStop(0.4, `${col}44`);
                g2.addColorStop(1, `${col}00`);
                airCtx.fillStyle = g2;
                airCtx.beginPath(); airCtx.arc(c.x, c.y - 2, r, 0, Math.PI * 2); airCtx.fill();
              });

              // 4) Schwebende Konfetti-Punkte
              for (let ci = 0; ci < 8; ci++) {
                const seed = party.tileX * 3.7 + party.tileY * 5.3 + ci * 7.1;
                const cx2 = bldCx + Math.sin(seed + pTime * 0.7) * 35;
                const cy2 = bldCy - 20 - ((pTime * 18 + seed * 5) % 40);
                const col = PARTY_COLORS[ci % PARTY_COLORS.length];
                const alpha = 0.5 + 0.4 * Math.sin(pTime * 2 + seed);
                airCtx.fillStyle = `${col}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
                airCtx.beginPath();
                airCtx.arc(cx2, cy2, 2 + Math.sin(seed + pTime) * 1, 0, Math.PI * 2);
                airCtx.fill();
              }
            }

            // Party-Emoji oben (gross, springend)
            const emojiSize = 16 + pulse * 4;
            airCtx.font = `${emojiSize}px serif`;
            airCtx.textAlign = 'center';
            airCtx.textBaseline = 'middle';
            const emojiY = bldCy - 45 + Math.sin(pTime * 2.5) * 4;
            airCtx.fillText(isWarning3 ? '🚨' : '🎉', bldCx, emojiY);
          }

          airCtx.restore();
        }

        // Draw recreation pedestrians on air canvas (above parks, not other buildings)
        drawRecreationPedestrians(airCtx); // Draw recreation pedestrians (at parks, benches, etc.)

        // ── FCB Stadium: Trainingsspieler auf dem Rasen (animiert, 60fps) ──
        {
          const { offset: stOff, zoom: stZoom, grid: stGrid, gridSize: stGridSize } = worldStateRef.current;
          if (stGrid && stGridSize > 0 && stZoom >= 0.5) {
            const stDpr = window.devicePixelRatio || 1;
            const t = performance.now() / 1000;
            const stW = TILE_WIDTH, stH = TILE_HEIGHT;

            // FCB-Trikotfarben
            const PLAYERS: Array<{ phase: number; rx: number; ry: number; color: string; speed: number }> = [
              { phase: 0.00,           rx: 1.00, ry: 1.00, color: '#CC0000', speed: 0.65 },
              { phase: Math.PI * 0.33, rx: 0.68, ry: 0.68, color: '#003078', speed: 0.90 },
              { phase: Math.PI * 0.66, rx: 0.85, ry: 0.85, color: '#CC0000', speed: 0.55 },
              { phase: Math.PI * 1.00, rx: 1.00, ry: 1.00, color: '#003078', speed: 0.75 },
              { phase: Math.PI * 1.33, rx: 0.58, ry: 0.58, color: '#CC0000', speed: 1.00 },
              { phase: Math.PI * 1.66, rx: 0.88, ry: 0.88, color: '#FFFFFF', speed: 0.50 },
              { phase: Math.PI * 0.50, rx: 0.55, ry: 0.55, color: '#CC0000', speed: 0.82 },
              { phase: Math.PI * 1.50, rx: 0.75, ry: 0.75, color: '#003078', speed: 0.68 },
            ];

            // Stadion-Image für exakte Positions-Berechnung
            const stadiumImg = getCachedImage('/assets/buildings/fcbasel.png', true) || getCachedImage('/assets/buildings/fcbasel.png');

            airCtx.save();
            airCtx.scale(stDpr * stZoom, stDpr * stZoom);
            airCtx.translate(stOff.x / stZoom, stOff.y / stZoom);

            for (let gy = 0; gy < stGridSize; gy++) {
              for (let gx = 0; gx < stGridSize; gx++) {
                const stTile = stGrid[gy]?.[gx];
                if (stTile?.building?.type !== 'fcbasel_stadium') continue;

                // Exakt dieselbe Positions-Mathematik wie im Building-Renderer
                const { screenX: bsx, screenY: bsy } = gridToScreen(gx, gy, 0, 0);
                const drawPosX = bsx; // frontmostOffsetX == frontmostOffsetY für 3x3
                const drawPosY = bsy + 4 * (stH / 2); // (2+2) * h/2

                const baseDestWidth = stW * 1.2 * 3; // 230.4 (scaleMultiplier=3 für 3x3)

                let destWidth = baseDestWidth;
                let destHeight = baseDestWidth; // aspect=1 (1024×1024)
                let drawX = drawPosX + stW / 2 - destWidth / 2;

                if (stadiumImg) {
                  const hBounds = getStandaloneHorizontalBounds(stadiumImg);
                  const cf = 1 - hBounds.leftEmptyFraction - hBounds.rightEmptyFraction;
                  if (cf > 0.05) {
                    const footprintW = (3 + 3) * (stW / 2); // 192
                    const autoScale = footprintW / cf / baseDestWidth;
                    destWidth  = baseDestWidth * autoScale;
                    destHeight = destWidth; // aspect=1
                    const vcf = hBounds.leftEmptyFraction + cf / 2;
                    drawX = drawPosX + stW / 2 - vcf * destWidth;
                  }
                  const emptyBottom = getStandaloneBottomEmptyFraction(stadiumImg);
                  const drawY = drawPosY + stH - destHeight + emptyBottom * destHeight;

                  // Rasen-Mittelpunkt: ~50% horizontal, ~37% von oben im Bild
                  const pitchCX = drawX + destWidth * 0.50;
                  const pitchCY = drawY + destHeight * 0.37;

                  // Iso-Ellipse für Spielerbewegung (Rasen-Ausdehnung)
                  const pitchRX = destWidth * 0.14;
                  const pitchRY = pitchRX * 0.42;

                  // Spielergrösse: sehr klein, wie echte Stadionspieler aus der Vogelperspektive
                  const ps = 1.2;

                  for (const p of PLAYERS) {
                    const angle = t * p.speed + p.phase;
                    const px = pitchCX + Math.cos(angle) * pitchRX * p.rx;
                    const py = pitchCY + Math.sin(angle) * pitchRY * p.ry;
                    const bob = Math.sin(t * p.speed * 6 + p.phase) * 0.4;

                    // Schatten
                    airCtx.fillStyle = 'rgba(0,0,0,0.22)';
                    airCtx.beginPath();
                    airCtx.ellipse(px, py + ps * 2.5, ps * 1.3, ps * 0.45, 0, 0, Math.PI * 2);
                    airCtx.fill();

                    // Beine
                    airCtx.fillStyle = '#111133';
                    airCtx.fillRect(px - ps, py + ps * 1.4 + bob, ps * 0.8, ps * 1.5);
                    airCtx.fillRect(px + ps * 0.2, py + ps * 1.4 - bob, ps * 0.8, ps * 1.5);

                    // Trikot
                    airCtx.fillStyle = p.color;
                    airCtx.fillRect(px - ps, py - ps * 0.3, ps * 2.0, ps * 1.8);

                    // Kopf
                    airCtx.fillStyle = '#F5C08A';
                    airCtx.beginPath();
                    airCtx.arc(px, py - ps * 1.2, ps, 0, Math.PI * 2);
                    airCtx.fill();

                    // Haare
                    airCtx.fillStyle = '#1A0E00';
                    airCtx.beginPath();
                    airCtx.arc(px, py - ps * 1.55, ps * 0.85, Math.PI, Math.PI * 2);
                    airCtx.fill();
                  }
                }
              }
            }
            airCtx.restore();
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        if (!skipSmallElements) {
          drawHelicopters(airCtx); // Draw helicopters (skip when panning zoomed out on desktop)
          drawSeaplanes(airCtx); // Draw seaplanes (skip when panning zoomed out on desktop)
        }
        // Wind turbines rendered via PixiJS WebGL layer (above buildings, below clouds)
        {
          const pixiWT = pixiWindTurbinesRef.current;
          if (pixiWT?.initialized) {
            const { offset: wtOffset, zoom: wtZoom, grid: wtGrid, gridSize: wtGridSize } = worldStateRef.current;
            const wtDpr = window.devicePixelRatio || 1;
            const wtWindSpeed = serverWeatherRef.current?.windspeed ?? 10;

            // Rebuild position cache when grid changes
            const curVer = gridVersionRef.current;
            if (windTurbineCacheRef.current.gridVersion !== curVer && wtGrid && wtGridSize > 0) {
              const positions: { screenX: number; screenY: number; level: number; tileX: number; tileY: number }[] = [];
              for (let wy = 0; wy < wtGridSize; wy++) {
                for (let wx = 0; wx < wtGridSize; wx++) {
                  const tile = wtGrid[wy]?.[wx];
                  if (!tile || tile.building.type !== 'wind_turbine') continue;
                  if (tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100) continue;
                  if (tile.building.abandoned) continue;
                  const { screenX, screenY } = gridToScreen(wx, wy, 0, 0);
                  positions.push({ screenX, screenY, level: tile.building.level ?? 1, tileX: wx, tileY: wy });
                }
              }
              windTurbineCacheRef.current = { positions, gridVersion: curVer };
            }

            pixiWT.resize(canvasSize.width, canvasSize.height, canvasSize.width / wtDpr, canvasSize.height / wtDpr);
            pixiWT.beginFrame(wtDpr, wtZoom, wtOffset.x, wtOffset.y, wtWindSpeed);
            for (const entry of windTurbineCacheRef.current.positions) {
              pixiWT.addTurbine(entry);
            }
            pixiWT.endFrame();
          }
        }

        // Birds rendered via PixiJS WebGL layer (below clouds, above helicopters)
        {
          const pixiBirds = pixiBirdsRef.current;
          if (pixiBirds?.initialized) {
            const { offset: birdOffset, zoom: birdZoom } = worldStateRef.current;
            pixiBirds.render(
              birdsRef.current,
              birdOffset,
              birdZoom,
              canvasSize.width,
              canvasSize.height,
            );
          }
        }

        if (!showPublicRoomWalls && weatherEnabledRef.current) {
          // Clouds now rendered via PixiJS WebGL layer
          const pixiClouds = pixiCloudsRef.current;
          if (pixiClouds?.initialized) {
            const { offset: cloudOffset, zoom: cloudZoom } = worldStateRef.current;
            pixiClouds.render(
              cloudsRef.current,
              cloudOffset,
              cloudZoom,
              canvasSize.width,
              canvasSize.height,
              visualHour,
            );
          }
        }
        drawAirplanes(airCtx); // Draw airplanes above clouds
        drawFireworks(airCtx); // Draw fireworks above everything (nighttime only)
      }
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
    // PERF: Removed grid, gridSize, speed from deps - they're accessed via worldStateRef to avoid restarting animation on every tick
  }, [canvasSize.width, canvasSize.height, updateCars, updateBuses, drawCars, drawBuses, spawnCrimeIncidents, updateCrimeIncidents, updateEmergencyVehicles, drawEmergencyVehicles, updatePedestrians, drawPedestrians, drawRecreationPedestrians, updateAirplanes, drawAirplanes, updateHelicopters, drawHelicopters, updateSeaplanes, drawSeaplanes, updateBoats, drawBoats, updateBarges, drawBarges, updateTrains, drawTrainsCallback, drawIncidentIndicators, updateFireworks, drawFireworks, updateSmog, drawSmog, updateClouds, updateBirds, visualHour, isMobile, showPublicRoomWalls]);

  // Periodic re-render trigger for dynamic window lights at night
  const [windowLightTick, setWindowLightTick] = useState(0);
  useEffect(() => {
    if (getDarkness(visualHour) <= 0.01) return;
    const id = setInterval(() => setWindowLightTick(t => (t + 1) & 0x7fffffff), 4000);
    return () => clearInterval(id);
  }, [visualHour]);

  // Day/Night cycle lighting — PixiJS WebGL with bloom
  useEffect(() => {
    const pixi = pixiLightingRef.current;
    if (!pixi?.initialized) return;
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || !currentGridSize) return;

    const isMoving = isPanningRef.current || isPinchZoomingRef.current || isWheelZoomingRef.current;
    pixi.render(
      currentGrid,
      currentGridSize,
      offset,
      zoom,
      canvasSize.width,
      canvasSize.height,
      visualHour,
      isMobile,
      isMoving,
    );
  }, [worldStateRef, visualHour, offset, zoom, canvasSize.width, canvasSize.height, isMobile, isPanningRef, isPinchZoomingRef, isWheelZoomingRef, isPanning, isWheelZooming, windowLightTick]);

  // Load coat of arms image
  const [coatOfArmsImage, setCoatOfArmsImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const svgSource = coatOfArms?.svg ? `data:image/svg+xml;utf8,${encodeURIComponent(coatOfArms.svg)}` : null;
    const imageSource = coatOfArms?.image_url || null;
    const src = imageSource || svgSource;
    if (!src) {
      setCoatOfArmsImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setCoatOfArmsImage(img);
    img.onerror = () => setCoatOfArmsImage(null);
    img.src = src;
  }, [coatOfArms?.svg, coatOfArms?.image_url]);

  // UI Canvas - always-visible world labels (owner + construction progress bars)
  useEffect(() => {
    const canvas = uiCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform (same as main canvas)
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Viewport-Culling für Label-Loops (gleiche Formel wie Main-Render-Effect)
    const labelViewWidth  = canvasSize.width  / (dpr * zoom);
    const labelViewHeight = canvasSize.height / (dpr * zoom);
    const labelViewLeft   = -offset.x / zoom - TILE_WIDTH;
    const labelViewTop    = -offset.y / zoom - TILE_HEIGHT * 2;
    const labelViewRight  = labelViewWidth  - offset.x / zoom + TILE_WIDTH;
    const labelViewBottom = labelViewHeight - offset.y / zoom + TILE_HEIGHT * 2;
    const labelVisibleMinSum = Math.max(0, Math.floor((labelViewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
    const labelVisibleMaxSum = Math.min(gridSize * 2 - 2, Math.ceil((labelViewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));

    // Find city_hall in grid and draw owner label if present
    if (ownerName) {
      outerCityHall:
      for (let sum = labelVisibleMinSum; sum <= labelVisibleMaxSum; sum++) {
        for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
          const y = sum - x;
          if (y < 0 || y >= gridSize) continue;
          const tile = grid[y]?.[x];
          if (tile?.building?.type === 'city_hall') {
            ctx.save();

            // City Hall is 2x2, so center on x+1, y+1 (center of 2x2 building)
            const { screenX, screenY } = gridToScreen(x + 1, y + 1, 0, 0);

            // Position above the building - fixed offset in tile units
            const textX = screenX + TILE_WIDTH * 0.8;
            const textY = screenY - 80;

            // Draw coat of arms if available
            if (coatOfArmsImage) {
              const coaSize = 40; // Size of coat of arms
              const coaX = textX - coaSize / 2;
              const coaY = textY - coaSize - 30; // Above the name label
              const circleRadius = coaSize / 2 + 4;

              // Draw white background circle for coat of arms
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.beginPath();
              ctx.arc(textX, coaY + coaSize / 2, circleRadius, 0, Math.PI * 2);
              ctx.fill();

              // Draw coat of arms centered inside the circle
              ctx.save();
              ctx.beginPath();
              ctx.arc(textX, coaY + coaSize / 2, circleRadius - 0.5, 0, Math.PI * 2);
              ctx.clip();
              const imageSize = coaSize - 4;
              const imageX = textX - imageSize / 2;
              const imageY = coaY + coaSize / 2 - imageSize / 2 + 2;
              ctx.drawImage(coatOfArmsImage, imageX, imageY, imageSize, imageSize);
              ctx.restore();
            }

            const fontSize = 12;
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            const labelText = `🏛️ ${ownerName}`;
            const textWidth = ctx.measureText(labelText).width;
            const padding = 6;
            const pillHeight = 20;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(
              textX - textWidth / 2 - padding,
              textY - pillHeight + 4,
              textWidth + padding * 2,
              pillHeight,
              5
            );
            ctx.fill();

            ctx.fillStyle = '#fbbf24';
            ctx.fillText(labelText, textX, textY);

            ctx.restore();
            break outerCityHall;
          }
        }
      }
    }

    // Draw custom labels for all buildings that have them
    for (let sum = labelVisibleMinSum; sum <= labelVisibleMaxSum; sum++) {
      for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
        const y = sum - x;
        if (y < 0 || y >= gridSize) continue;
        const tile = grid[y]?.[x];
        if (!tile?.building) continue;

        // Schnelle Vorauswahl: nur Tiles mit sichtbaren Labels weiterverarbeiten
        const isWoodcutter = tile.building.type === 'woodcutter_house';
        const hasCustomName = tile.building.customName && tile.building.type !== 'city_hall';
        if (!isWoodcutter && !hasCustomName) continue;

        // Viewport-Check: Label ist klein (~20px über Tile)
        const { screenX: labelCheckX, screenY: labelCheckY } = gridToScreen(x, y, 0, 0);
        if (labelCheckX + TILE_WIDTH < labelViewLeft || labelCheckX > labelViewRight ||
            labelCheckY + TILE_HEIGHT < labelViewTop  || labelCheckY - 60 > labelViewBottom) continue;

        // === HOLZFÄLLER-HAUS: Spezielles Label mit Arbeiter-Anzeige ===
        if (isWoodcutter) {
          ctx.save();
          const fontSize = Math.max(8, 10);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const labelX = labelCheckX + TILE_WIDTH / 2;
          const labelY = labelCheckY - 20;
          const rawWorkers = tile.building.level || 1;
          const maxW = 4;
          const workers = Math.max(0, Math.min(rawWorkers, maxW));
          const phase = tile.building.plantationPhase || 'planting';
          const harvests = tile.building.plantationHarvests || 0;
          const phaseIcon = phase === 'planting' ? '🌱' : phase === 'growing' ? '🌿' : '🪓';

          // Arbeiter-Punkte als String: ●●○○ (gefüllt = aktiv, leer = frei)
          const workerDots = '●'.repeat(workers) + '○'.repeat(maxW - workers);
          const labelTextContent = `${phaseIcon} Holzfäller ${workerDots}`;
          const textWidthLabel = ctx.measureText(labelTextContent).width;
          const paddingLabel = 5;
          const pillHeightLabel = 18;

          // Hintergrund-Pill (holzfarben)
          ctx.fillStyle = 'rgba(59, 31, 8, 0.85)';
          ctx.beginPath();
          ctx.roundRect(
            labelX - textWidthLabel / 2 - paddingLabel,
            labelY - pillHeightLabel + 2,
            textWidthLabel + paddingLabel * 2,
            pillHeightLabel,
            5
          );
          ctx.fill();
          // Rand
          ctx.strokeStyle = 'rgba(180, 83, 9, 0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Text (warm-gelb)
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(labelTextContent, labelX, labelY);

          // Zweite Zeile: Ernte-Zähler (wenn Ernten > 0)
          if (harvests > 0) {
            ctx.font = `${fontSize - 1}px sans-serif`;
            const harvestText = `$${harvests * 50} verdient`;
            ctx.fillStyle = 'rgba(59, 31, 8, 0.75)';
            const hw = ctx.measureText(harvestText).width;
            ctx.beginPath();
            ctx.roundRect(labelX - hw / 2 - 3, labelY + 2, hw + 6, 13, 3);
            ctx.fill();
            ctx.fillStyle = '#86efac';
            ctx.fillText(harvestText, labelX, labelY + 13);
          }

          ctx.restore();
        } else if (hasCustomName) {
          // Normales Custom-Label
          ctx.save();

          const fontSize = Math.max(8, 10);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const labelX = labelCheckX + TILE_WIDTH / 2;
          const labelY = labelCheckY - 20;

          const labelTextContent = `🏷️ ${tile.building.customName}`;
          const textWidthLabel = ctx.measureText(labelTextContent).width;
          const paddingLabel = 4;
          const pillHeightLabel = 16;

          // Draw background pill
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.roundRect(
            labelX - textWidthLabel / 2 - paddingLabel,
            labelY - pillHeightLabel + 2,
            textWidthLabel + paddingLabel * 2,
            pillHeightLabel,
            4
          );
          ctx.fill();

          // Draw text
          ctx.fillStyle = '#a5f3fc'; // Cyan color for custom labels
          ctx.fillText(labelTextContent, labelX, labelY);

          ctx.restore();
        }
      }
    }

    // Draw residence name labels (nur bei zoom >= 1.5)
    if (playerResidences && playerResidences.length > 0 && zoom >= 1.5) {
      const residenceMap = new Map(
        playerResidences
          .filter(r => !currentRoomCode || r.room_code === currentRoomCode)
          .map(r => [`${r.tile_x},${r.tile_y}`, r])
      );
      if (residenceMap.size > 0) {
        for (let sum = labelVisibleMinSum; sum <= labelVisibleMaxSum; sum++) {
          for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
            const y = sum - x;
            if (y < 0 || y >= gridSize) continue;
            const res = residenceMap.get(`${x},${y}`);
            if (!res) continue;
            const { screenX: sx, screenY: sy } = gridToScreen(x, y, 0, 0);
            if (sx + TILE_WIDTH < labelViewLeft || sx > labelViewRight ||
                sy + TILE_HEIGHT < labelViewTop || sy - 50 > labelViewBottom) continue;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const fontSize = Math.max(9, Math.round(11 * Math.min(zoom / 1.5, 1.4)));
            ctx.font = `bold ${fontSize}px sans-serif`;
            const labelText = `🏠 ${res.nickname}`;
            const tw = ctx.measureText(labelText).width;
            const pad = 5;
            const ph = fontSize + 6;
            const lx = sx + TILE_WIDTH / 2;
            const ly = sy - 4;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.beginPath();
            ctx.roundRect(lx - tw / 2 - pad, ly - ph, tw + pad * 2, ph, 4);
            ctx.fill();
            ctx.fillStyle = '#86efac';
            ctx.fillText(labelText, lx, ly);
            ctx.restore();
          }
        }
      }
    }

    // Draw water body names on the UI layer so they're visible above all other layers
    if (waterBodies && waterBodies.length > 0) {
      ctx.save();
      ctx.font = `italic ${Math.max(10, 12)}px sans-serif`;
      ctx.fillStyle = 'rgba(200, 230, 255, 0.85)';
      ctx.strokeStyle = 'rgba(0, 20, 50, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const viewWidth = canvasSize.width / (dpr * zoom);
      const viewHeight = canvasSize.height / (dpr * zoom);
      const viewLeft = -offset.x / zoom - TILE_WIDTH;
      const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
      const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
      const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;

      for (const waterBody of waterBodies) {
        if (waterBody.tiles.length === 0) continue;
        const { screenX, screenY } = gridToScreen(waterBody.centerX, waterBody.centerY, 0, 0);
        if (screenX >= viewLeft - 100 && screenX <= viewRight + 100 &&
          screenY >= viewTop - 50 && screenY <= viewBottom + 50) {
          ctx.strokeText(waterBody.name, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
          ctx.fillText(waterBody.name, screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        }
      }
      ctx.restore();
    }

  }, [grid, gridSize, offset, zoom, canvasSize, ownerName, coatOfArmsImage, addNotification, waterBodies]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      panCandidateRef.current = null;
      e.preventDefault();
      return;
    }

    if (e.button === 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = (e.clientX - rect.left) / zoom;
        const mouseY = (e.clientY - rect.top) / zoom;
        const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);

        const isInsideGrid = gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize;
        if (!isInsideGrid) {
          // Prüfe ob Klick auf Handelspartner-Wegweiser (ausserhalb des Grids)
          const worldX = (e.clientX - rect.left - offset.x) / zoom;
          const worldY = (e.clientY - rect.top - offset.y) / zoom;
          const hitPartner = partnerHitboxesRef.current.find(h =>
            worldX >= h.x && worldX <= h.x + h.w && worldY >= h.y && worldY <= h.y + h.h
          );
          if (hitPartner) {
            // Inline-Navigation zur Partner-Gemeinde (ohne URL-Wechsel)
            if (onVisitMunicipality) {
              onVisitMunicipality(hitPartner.slug);
            }
            return;
          }
          setIsPanning(true);
          setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
          panCandidateRef.current = null;
          return;
        }

        const avatarHit = findAvatarByClick(e.clientX, e.clientY, rect);
        if (avatarHit) {
          panCandidateRef.current = null;
          openAvatarProfile(avatarHit);
          return;
        }

        // ── Büenzli NPC Click → Quiz ──
        const clickedBuenzli = pedestriansRef.current.find(p =>
          p.npcType === 'buenzli' &&
          Math.abs(p.tileX - gridX) <= 1 &&
          Math.abs(p.tileY - gridY) <= 1
        );
        if (clickedBuenzli) {
          panCandidateRef.current = null;
          setBuenzliQuizData({
            eventType: (clickedBuenzli as any).npcBuenzliEventType,
            serverId: (clickedBuenzli as any).npcBuenzliServerId,
          });
          setShowBuenzliQuiz(true);
          return;
        }

        // ── Residence placement click ──────────────────────────────────────
        if (residencePlacementRef.current && isInsideGrid) {
          panCandidateRef.current = null;
          const { variantRow, variantCol } = residencePlacementRef.current;
          console.log('[ResidencePlace] click', { gridX, gridY, municipalitySlug, currentRoomCode });
          const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
          const token = getAuthToken() || '';
          fetch(`${AUTH_API_BASE}/api/game/municipality/${municipalitySlug}/residence/place`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Game-Token': token },
            body: JSON.stringify({ tile_x: gridX, tile_y: gridY, room_code: currentRoomCode }),
          })
            .then(r => r.json())
            .then(d => {
              console.log('[ResidencePlace] response', d);
              if (d.ok) {
                cancelResidencePlacement();
                window.dispatchEvent(new Event('player-residences-updated'));
              } else {
                addNotification('Fehler', d.error || 'Platzierung fehlgeschlagen', '❌');
              }
            })
            .catch((err) => { console.error('[ResidencePlace] fetch error', err); addNotification('Fehler', 'Netzwerkfehler', '❌'); });
          return;
        }

        if (selectedTool === 'select') {
          // Check disaster markers BEFORE building selection
          if (disastersRef?.current && onSelectDisaster) {
            const hitDisaster = disastersRef.current.find(d =>
              Math.abs(d.x - gridX) <= 2 && Math.abs(d.y - gridY) <= 2
            );
            if (hitDisaster) {
              panCandidateRef.current = null;
              onSelectDisaster(hitDisaster.id);
              return;
            }
          }

          const tile = grid[gridY]?.[gridX];
          const isOpenTile = tile?.building.type === 'empty' ||
            tile?.building.type === 'grass' ||
            tile?.building.type === 'water';
          if (isOpenTile) {
            // Check if this empty tile is part of a multi-tile building (e.g. 2x2 mansion)
            const multiOrigin = tile?.building.type === 'empty' ? findBuildingOrigin(gridX, gridY) : null;
            if (multiOrigin) {
              panCandidateRef.current = null;
              setSelectedTile({ x: multiOrigin.originX, y: multiOrigin.originY });
            } else {
              panCandidateRef.current = { startX: e.clientX, startY: e.clientY, gridX, gridY };
            }
            return;
          }
          panCandidateRef.current = null;
          // For multi-tile buildings, select the origin tile
          const origin = findBuildingOrigin(gridX, gridY);
          if (origin) {
            setSelectedTile({ x: origin.originX, y: origin.originY });
          } else {
            setSelectedTile({ x: gridX, y: gridY });
          }
        } else if (selectedTool === 'label') {
          // Label tool - open dialog to name the building or water body
          panCandidateRef.current = null;
          const origin = findBuildingOrigin(gridX, gridY);
          const targetX = origin ? origin.originX : gridX;
          const targetY = origin ? origin.originY : gridY;
          const tile = grid[targetY]?.[targetX];
          if (tile?.building && tile.building.type === 'water' && waterBodies && waterBodies.length > 0) {
            // Water tile clicked - find the water body that contains this tile
            const wb = waterBodies.find(w => w.tiles.some(t => t.x === targetX && t.y === targetY));
            if (wb) {
              setWaterLabelTarget(wb.id);
              setWaterLabelInput(wb.name);
              setShowWaterLabelDialog(true);
            }
          } else if (tile?.building && tile.building.type !== 'empty' && tile.building.type !== 'grass' && tile.building.type !== 'water') {
            setLabelTarget({ x: targetX, y: targetY });
            setLabelInput(tile.building.customName || '');
            setShowLabelDialog(true);
          }
        } else if (showsDragGrid) {
          panCandidateRef.current = null;
          // Start drag rectangle selection for zoning tools
          setDragStartTile({ x: gridX, y: gridY });
          setDragEndTile({ x: gridX, y: gridY });
          setIsDragging(true);
        } else if (supportsDragPlace) {
          panCandidateRef.current = null;
          // For roads, bulldoze, and other tools, start drag-to-place
          setDragStartTile({ x: gridX, y: gridY });
          setDragEndTile({ x: gridX, y: gridY });
          setIsDragging(true);
          // Reset road drawing state for new drag
          setRoadDrawDirection(null);
          placedRoadTilesRef.current.clear();
          // Place immediately on first click
          placeAtTile(gridX, gridY);
          // Track initial tile for roads, rail, and subways
          if (selectedTool === 'road' || selectedTool === 'rail' || selectedTool === 'subway') {
            placedRoadTilesRef.current.add(`${gridX},${gridY}`);
          }
        }
      }
    }
  }, [offset, gridSize, selectedTool, placeAtTile, zoom, showsDragGrid, supportsDragPlace, setSelectedTile, findBuildingOrigin, grid, waterBodies, findAvatarByClick, openAvatarProfile, cancelResidencePlacement, addNotification, currentRoomCode, municipalitySlug]);

  // Calculate camera bounds based on grid size
  const getMapBounds = useCallback((currentZoom: number, canvasW: number, canvasH: number) => {
    const n = gridSize;
    const padding = 100; // Allow some over-scroll

    // Map bounds in world coordinates
    const mapLeft = -(n - 1) * TILE_WIDTH / 2;
    const mapRight = (n - 1) * TILE_WIDTH / 2;
    const mapTop = 0;
    const mapBottom = (n - 1) * TILE_HEIGHT;

    const minOffsetX = padding - mapRight * currentZoom;
    const maxOffsetX = canvasW - padding - mapLeft * currentZoom;
    const minOffsetY = padding - mapBottom * currentZoom;
    const maxOffsetY = canvasH - padding - mapTop * currentZoom;

    return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY };
  }, [gridSize]);

  // Clamp offset to keep camera within reasonable bounds
  const clampOffset = useCallback((newOffset: { x: number; y: number }, currentZoom: number) => {
    const bounds = getMapBounds(currentZoom, canvasSize.width, canvasSize.height);
    return {
      x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
      y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
    };
  }, [getMapBounds, canvasSize.width, canvasSize.height]);

  // Handle minimap navigation - center the view on the target tile
  useEffect(() => {
    if (!navigationTarget) return;

    // Convert grid coordinates to screen coordinates
    const { screenX, screenY } = gridToScreen(navigationTarget.x, navigationTarget.y, 0, 0);

    // Calculate offset to center this position on the canvas
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    const newOffset = {
      x: centerX - screenX * zoom,
      y: centerY - screenY * zoom,
    };

    // Clamp and set the new offset - this is a legitimate use case for responding to navigation requests
    const bounds = getMapBounds(zoom, canvasSize.width, canvasSize.height);
    setOffset({ // eslint-disable-line
      x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
      y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
    });

    // Signal that navigation is complete
    onNavigationComplete?.();
  }, [navigationTarget, zoom, canvasSize.width, canvasSize.height, getMapBounds, onNavigationComplete]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning && panCandidateRef.current) {
      const { startX, startY } = panCandidateRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) >= PAN_DRAG_THRESHOLD || Math.abs(dy) >= PAN_DRAG_THRESHOLD) {
        setIsPanning(true);
        setDragStart({ x: startX - offset.x, y: startY - offset.y });
        panCandidateRef.current = null;
        const newOffset = {
          x: e.clientX - (startX - offset.x),
          y: e.clientY - (startY - offset.y),
        };
        setOffset(clampOffset(newOffset, zoom));
        return;
      }
    }

    if (isPanning) {
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      setOffset(clampOffset(newOffset, zoom));
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = (e.clientX - rect.left) / zoom;
      const mouseY = (e.clientY - rect.top) / zoom;
      const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);

      // Prüfe ob Maus über Partner-Wegweiser (für Pointer-Cursor)
      const wX = (e.clientX - rect.left - offset.x) / zoom;
      const wY = (e.clientY - rect.top - offset.y) / zoom;
      const overPartner = partnerHitboxesRef.current.some(h =>
        wX >= h.x && wX <= h.x + h.w && wY >= h.y && wY <= h.y + h.h
      );
      if (overPartner !== hoveringPartner) setHoveringPartner(overPartner);

      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        // Only update hovered tile if it actually changed to avoid unnecessary re-renders
        setHoveredTile(prev => (prev?.x === gridX && prev?.y === gridY) ? prev : { x: gridX, y: gridY });

        // Check for fire, crime incidents, or Crime-NPCs at this tile for tooltip display
        const tile = grid[gridY]?.[gridX];
        const crimeKey = `${gridX},${gridY}`;
        const crimeIncident = activeCrimeIncidentsRef.current.get(crimeKey);

        // Check for Crime-NPCs (Gangster/Dealer/Homeless/Buenzli) auf diesem Tile
        const npcAtTile = pedestriansRef.current.find(p =>
          (p.npcType === 'gangster' || p.npcType === 'homeless' || p.npcType === 'buenzli') &&
          p.tileX === gridX && p.tileY === gridY
        );

        if (tile?.building.onFire) {
          setHoveredIncident({
            x: gridX, y: gridY, type: 'fire',
            screenX: e.clientX, screenY: e.clientY,
          });
        } else if (npcAtTile?.npcType === 'gangster') {
          // Gangster/Dealer NPC — Tooltip je nach State
          const serverCriminal = (npcAtTile as any).npcCrimeServerId;
          const isDealer = (npcAtTile as any).npcIsDealer === true;
          const isFleeing = npcAtTile.activity === 'fleeing';
          setHoveredIncident({
            x: gridX, y: gridY,
            type: isFleeing ? 'npc_police_chase' : (isDealer ? 'npc_dealer' : 'npc_gangster'),
            npcState: isFleeing ? 'fleeing' : (isDealer ? 'dealing' : 'loitering'),
            screenX: e.clientX, screenY: e.clientY,
          });
        } else if (npcAtTile?.npcType === 'buenzli') {
          const eventType = (npcAtTile as any).npcBuenzliEventType || '';
          setHoveredIncident({
            x: gridX, y: gridY, type: 'npc_buenzli',
            npcState: eventType,
            screenX: e.clientX, screenY: e.clientY,
          });
        } else if (npcAtTile?.npcType === 'homeless') {
          setHoveredIncident({
            x: gridX, y: gridY, type: 'npc_homeless',
            screenX: e.clientX, screenY: e.clientY,
          });
        } else if (crimeIncident) {
          setHoveredIncident({
            x: gridX, y: gridY, type: 'crime',
            crimeType: crimeIncident.type,
            screenX: e.clientX, screenY: e.clientY,
          });
        } else {
          setHoveredIncident(null);
        }

        // Update drag rectangle end point for zoning tools
        if (isDragging && showsDragGrid && dragStartTile) {
          setDragEndTile({ x: gridX, y: gridY });
        }
        // For roads, rail, and subways, use straight-line snapping
        else if (isDragging && (selectedTool === 'road' || selectedTool === 'rail' || selectedTool === 'subway') && dragStartTile) {
          const dx = Math.abs(gridX - dragStartTile.x);
          const dy = Math.abs(gridY - dragStartTile.y);

          // Lock direction after moving at least 1 tile
          let direction = roadDrawDirection;
          if (!direction && (dx > 0 || dy > 0)) {
            // Lock to the axis with more movement, or horizontal if equal
            direction = dx >= dy ? 'h' : 'v';
            setRoadDrawDirection(direction);
          }

          // Calculate target position along the locked axis
          let targetX = gridX;
          let targetY = gridY;
          if (direction === 'h') {
            targetY = dragStartTile.y; // Lock to horizontal
          } else if (direction === 'v') {
            targetX = dragStartTile.x; // Lock to vertical
          }

          setDragEndTile({ x: targetX, y: targetY });

          // Place all tiles from start to target in a straight line
          // Skip water tiles - they'll be handled on mouse up for bridge creation
          const minX = Math.min(dragStartTile.x, targetX);
          const maxX = Math.max(dragStartTile.x, targetX);
          const minY = Math.min(dragStartTile.y, targetY);
          const maxY = Math.max(dragStartTile.y, targetY);

          for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const key = `${x},${y}`;
              if (!placedRoadTilesRef.current.has(key)) {
                // Skip water tiles during drag - they'll show preview and be handled on mouse up
                const tile = grid[y]?.[x];
                if (tile && tile.building.type === 'water') {
                  // Don't place on water during drag, just mark as "seen"
                  placedRoadTilesRef.current.add(key);
                  continue;
                }
                placeAtTile(x, y);
                placedRoadTilesRef.current.add(key);
              }
            }
          }
        }
        // For other drag-to-place tools, place continuously
        else if (isDragging && supportsDragPlace && dragStartTile) {
          placeAtTile(gridX, gridY);
        }
      }
    }
  }, [isPanning, dragStart, offset, zoom, gridSize, isDragging, showsDragGrid, dragStartTile, selectedTool, roadDrawDirection, supportsDragPlace, placeAtTile, clampOffset, grid]);

  const handleMouseUp = useCallback(() => {
    if (panCandidateRef.current && !isPanning && selectedTool === 'select') {
      const { gridX, gridY } = panCandidateRef.current;
      panCandidateRef.current = null;

      // Check if click hit a disaster marker (also check nearby tiles for multi-tile buildings)
      if (disastersRef?.current && onSelectDisaster) {
        const hitDisaster = disastersRef.current.find(d =>
          Math.abs(d.x - gridX) <= 2 && Math.abs(d.y - gridY) <= 2
        );
        if (hitDisaster) {
          onSelectDisaster(hitDisaster.id);
          return;
        }
        if (selectedDisasterId) {
          onSelectDisaster(null);
        }
      }

      if (showPublicRoomWalls) {
        placeAtTile(gridX, gridY);
        return;
      }
      const origin = findBuildingOrigin(gridX, gridY);
      if (origin) {
        setSelectedTile({ x: origin.originX, y: origin.originY });
      } else {
        setSelectedTile({ x: gridX, y: gridY });
      }
    } else {
      panCandidateRef.current = null;
    }
    // Fill the drag rectangle when mouse is released (only for zoning tools)
    if (isDragging && dragStartTile && dragEndTile && showsDragGrid) {
      const minX = Math.min(dragStartTile.x, dragEndTile.x);
      const maxX = Math.max(dragStartTile.x, dragEndTile.x);
      const minY = Math.min(dragStartTile.y, dragEndTile.y);
      const maxY = Math.max(dragStartTile.y, dragEndTile.y);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          placeAtTile(x, y);
        }
      }
    }

    // After placing roads or rail, create bridges for valid water crossings and check for city discovery
    if (isDragging && (selectedTool === 'road' || selectedTool === 'rail') && dragStartTile && dragEndTile) {
      // Collect all tiles in the drag path
      const minX = Math.min(dragStartTile.x, dragEndTile.x);
      const maxX = Math.max(dragStartTile.x, dragEndTile.x);
      const minY = Math.min(dragStartTile.y, dragEndTile.y);
      const maxY = Math.max(dragStartTile.y, dragEndTile.y);

      const pathTiles: { x: number; y: number }[] = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          pathTiles.push({ x, y });
        }
      }

      // Create bridges for valid water crossings in the drag path
      if (!isFullyViewOnly) {
        finishTrackDrag(pathTiles, selectedTool as 'road' | 'rail');
      }

      // Use setTimeout to allow state to update first, then check for discoverable cities
      setTimeout(() => {
        checkAndDiscoverCities((discoveredCity) => {
          // Show dialog for the newly discovered city
          setCityConnectionDialog({ direction: discoveredCity.direction });
        });
      }, 50);
    }

    // Clear drag state
    setIsDragging(false);
    setDragStartTile(null);
    setDragEndTile(null);
    setIsPanning(false);
    setRoadDrawDirection(null);
    placedRoadTilesRef.current.clear();

    // NPC-Spawn-Flag zurücksetzen für nächsten Klick
    npcSpawnedThisClickRef.current = false;

    // Clear hovered tile when mouse leaves
    if (!containerRef.current) {
      setHoveredTile(null);
    }
  }, [isDragging, showsDragGrid, dragStartTile, placeAtTile, finishTrackDrag, selectedTool, dragEndTile, checkAndDiscoverCities, findBuildingOrigin, setSelectedTile, isPanning, showPublicRoomWalls, disastersRef, selectedDisasterId, onSelectDisaster]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Einige Browser/Container liefern Wheel-Events als passiv.
    // preventDefault nur auf cancelbaren Events aufrufen, um Runtime-Warnungen zu vermeiden.
    if (e.cancelable) {
      e.preventDefault();
    }
    if (showPublicRoomWalls) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Mouse position relative to canvas (in screen pixels)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate new zoom with proportional scaling for smoother feel
    // Use smaller base delta (0.05) and scale by current zoom for consistent feel at all levels
    const baseZoomDelta = 0.05;
    const scaledDelta = baseZoomDelta * Math.max(0.5, zoom); // Scale with zoom, min 0.5x
    const zoomDelta = e.deltaY > 0 ? -scaledDelta : scaledDelta;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + zoomDelta));

    if (newZoom === zoom) return;

    // PERF: Track wheel zooming state to disable lights during zoom (like mobile pinch zoom)
    if (!isWheelZoomingRef.current) {
      isWheelZoomingRef.current = true;
      setIsWheelZooming(true);
    }
    if (wheelZoomTimeoutRef.current) {
      clearTimeout(wheelZoomTimeoutRef.current);
    }
    wheelZoomTimeoutRef.current = setTimeout(() => {
      isWheelZoomingRef.current = false;
      setIsWheelZooming(false); // Trigger re-render to restore lights
    }, 150); // Wait 150ms after last wheel event to consider zooming complete

    // World position under the mouse before zoom
    // screen = world * zoom + offset → world = (screen - offset) / zoom
    const worldX = (mouseX - offset.x) / zoom;
    const worldY = (mouseY - offset.y) / zoom;

    // After zoom, keep the same world position under the mouse
    // mouseX = worldX * newZoom + newOffset.x → newOffset.x = mouseX - worldX * newZoom
    const newOffsetX = mouseX - worldX * newZoom;
    const newOffsetY = mouseY - worldY * newZoom;

    // Clamp to map bounds
    const clampedOffset = clampOffset({ x: newOffsetX, y: newOffsetY }, newZoom);

    setOffset(clampedOffset);
    setZoom(newZoom);
  }, [zoom, offset, clampOffset, showPublicRoomWalls]);

  // Touch handlers for mobile
  const getTouchDistance = useCallback((touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - could be pan or tap
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      setIsPanning(true);
      isPinchZoomingRef.current = false;
    } else if (e.touches.length === 2) {
      if (showPublicRoomWalls) return;
      // Two finger touch - pinch to zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      initialPinchDistanceRef.current = distance;
      initialZoomRef.current = zoom;
      lastTouchCenterRef.current = getTouchCenter(e.touches[0], e.touches[1]);
      setIsPanning(false);
      isPinchZoomingRef.current = true;
    }
  }, [offset, zoom, getTouchDistance, getTouchCenter, showPublicRoomWalls]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (showPublicRoomWalls && e.touches.length >= 2) return;

    if (e.touches.length === 1 && isPanning && !initialPinchDistanceRef.current) {
      // Single touch pan
      const touch = e.touches[0];
      const newOffset = {
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      };
      setOffset(clampOffset(newOffset, zoom));
    } else if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      // Pinch to zoom
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistanceRef.current;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, initialZoomRef.current * scale));

      const currentCenter = getTouchCenter(e.touches[0], e.touches[1]);
      const rect = containerRef.current?.getBoundingClientRect();

      if (rect && lastTouchCenterRef.current) {
        // Calculate center position relative to canvas
        const centerX = currentCenter.x - rect.left;
        const centerY = currentCenter.y - rect.top;

        // World position at pinch center
        const worldX = (centerX - offset.x) / zoom;
        const worldY = (centerY - offset.y) / zoom;

        // Keep the same world position under the pinch center after zoom
        const newOffsetX = centerX - worldX * newZoom;
        const newOffsetY = centerY - worldY * newZoom;

        // Also account for pan movement during pinch
        const panDeltaX = currentCenter.x - lastTouchCenterRef.current.x;
        const panDeltaY = currentCenter.y - lastTouchCenterRef.current.y;

        const clampedOffset = clampOffset(
          { x: newOffsetX + panDeltaX, y: newOffsetY + panDeltaY },
          newZoom
        );

        setOffset(clampedOffset);
        setZoom(newZoom);
        lastTouchCenterRef.current = currentCenter;
      }
    }
  }, [isPanning, dragStart, zoom, offset, clampOffset, getTouchDistance, getTouchCenter, showPublicRoomWalls]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;

    if (e.touches.length === 0) {
      // All fingers lifted
      if (touchStart && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStart.x);
        const deltaY = Math.abs(touch.clientY - touchStart.y);
        const deltaTime = Date.now() - touchStart.time;

        // Detect tap (short duration, minimal movement)
        if (deltaTime < 300 && deltaX < 10 && deltaY < 10) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const mouseX = (touch.clientX - rect.left) / zoom;
            const mouseY = (touch.clientY - rect.top) / zoom;
            const { gridX, gridY } = screenToGrid(mouseX, mouseY, offset.x / zoom, offset.y / zoom);

            if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
              // Check disaster markers first on mobile too (radius for multi-tile buildings)
              if (selectedTool === 'select' && disastersRef?.current && onSelectDisaster) {
                const hitDisaster = disastersRef.current.find(d =>
                  Math.abs(d.x - gridX) <= 2 && Math.abs(d.y - gridY) <= 2
                );
                if (hitDisaster) {
                  onSelectDisaster(hitDisaster.id);
                  // Skip normal tile selection
                  touchStartRef.current = null;
                  setIsPanning(false);
                  setIsDragging(false);
                  isPinchZoomingRef.current = false;
                  initialPinchDistanceRef.current = null;
                  lastTouchCenterRef.current = null;
                  npcSpawnedThisClickRef.current = false;
                  return;
                }
                if (selectedDisasterId) {
                  onSelectDisaster(null);
                }
              }

              if (selectedTool === 'select') {
                const origin = findBuildingOrigin(gridX, gridY);
                if (origin) {
                  setSelectedTile({ x: origin.originX, y: origin.originY });
                } else {
                  setSelectedTile({ x: gridX, y: gridY });
                }
              } else {
                placeAtTile(gridX, gridY);
              }
            }
          }
        }
      }

      // Reset all touch state
      setIsPanning(false);
      setIsDragging(false);
      isPinchZoomingRef.current = false;
      touchStartRef.current = null;
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
      npcSpawnedThisClickRef.current = false;
    } else if (e.touches.length === 1) {
      // Went from 2 touches to 1 - reset to pan mode
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      setIsPanning(true);
      isPinchZoomingRef.current = false;
      initialPinchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    }
  }, [zoom, offset, gridSize, selectedTool, placeAtTile, setSelectedTile, findBuildingOrigin]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden relative w-full h-full touch-none"
      style={{
        cursor: isPanning ? 'grabbing' : isDragging ? 'crosshair' : hoveringPartner ? 'pointer' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0"
      />
      <div ref={pixiWaterContainerRef} className="absolute top-0 left-0 pointer-events-none" />
      {/* PERF: Separate canvas for hover/selection highlights - avoids full redraw on mouse move */}
      <canvas
        ref={hoverCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <canvas
        ref={carsCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <div ref={pixiVehiclesContainerRef} className="absolute top-0 left-0 pointer-events-none" />
      <div ref={pixiBuildingsContainerRef} className="absolute top-0 left-0 pointer-events-none" />
      <canvas
        ref={buildingsCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <div ref={pixiWindTurbinesContainerRef} className="absolute top-0 left-0 pointer-events-none" />
      <canvas
        ref={airCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      <div ref={pixiBirdsContainerRef} className="absolute inset-0 pointer-events-none" />
      <div ref={pixiCloudsContainerRef} className="absolute inset-0 pointer-events-none" />
      <div ref={pixiLightingContainerRef} className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'multiply' }} />
      <canvas
        ref={lightingCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ mixBlendMode: 'multiply', display: 'none' }}
      />
      <canvas
        ref={uiCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0 pointer-events-none"
      />

      {/* Collectible Money Overlay (TEST) */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        {collectibles.map(collectible => {
          // Get screen position in canvas coordinates (without offset)
          const { screenX, screenY } = gridToScreen(collectible.x, collectible.y, 0, 0);

          // Apply zoom to get position within the transformed container
          const cssX = (screenX * zoom) + (TILE_WIDTH * zoom / 2) - 20;
          const cssY = (screenY * zoom) - 40; // Above the tile

          return (
            <button
              key={collectible.id}
              onClick={(e) => {
                e.stopPropagation();
                handleCollectMoney(collectible);
              }}
              className="absolute z-50 flex items-center justify-center 
                         w-10 h-10 rounded-full pointer-events-auto
                         bg-gradient-to-b from-yellow-400 to-amber-500
                         border-2 border-yellow-300 
                         shadow-lg shadow-amber-500/50
                         hover:scale-125 hover:from-yellow-300 hover:to-amber-400
                         transition-transform duration-200 cursor-pointer
                         animate-bounce"
              style={{
                left: `${cssX}px`,
                top: `${cssY}px`,
                transform: `scale(${Math.max(0.6, zoom)})`,
              }}
              title={`+${collectible.amount}$ einsammeln`}
            >
              <span className="text-lg font-bold text-amber-900 drop-shadow-sm">$</span>
            </button>
          );
        })}
      </div>

      {showPublicRoomWalls && (
        <div className="absolute top-3 left-3 z-[120] pointer-events-auto">
          {!publicRoomCameraDebugOpen ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-black/70 border-white/30 text-white hover:bg-black/80"
              onClick={() => setPublicRoomCameraDebugOpen(true)}
            >
              Cam Debug
            </Button>
          ) : (
            <div className="rounded-md border border-white/25 bg-black/75 text-white px-3 py-2 text-xs min-w-[220px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Public Room Cam Debug</span>
                <button
                  type="button"
                  onClick={() => setPublicRoomCameraDebugOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  x
                </button>
              </div>
              <div className="font-mono text-[11px] leading-5">
                <div>zoom: {zoom.toFixed(4)}</div>
                <div>offsetX: {offset.x.toFixed(1)}</div>
                <div>offsetY: {offset.y.toFixed(1)}</div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => nudgePublicRoomCamera(0, -16)}>Y-</Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => nudgePublicRoomCamera(-16, 0)}>X-</Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => nudgePublicRoomCamera(16, 0)}>X+</Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => nudgePublicRoomCamera(0, 16)}>Y+</Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => nudgePublicRoomCamera(0, 0, -0.03)}>Zoom-</Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => nudgePublicRoomCamera(0, 0, 0.03)}>Zoom+</Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full mt-2 text-xs border-white/30 bg-transparent hover:bg-white/10"
                onClick={() => {
                  const fit = computePublicRoomFitCamera();
                  if (!fit) return;
                  setZoom(fit.targetZoom);
                  setOffset(fit.targetOffset);
                }}
              >
                Auto-Fit Reset
              </Button>
            </div>
          )}
        </div>
      )}

      {selectedTile && selectedTool === 'select' && !isMobile && !showPublicRoomWalls && !isFullyViewOnly && (
        <TileInfoPanel
          tile={grid[selectedTile.y][selectedTile.x]}
          services={state.services}
          onClose={() => setSelectedTile(null)}
          isViewOnly={isFullyViewOnly}
          ownerName={ownerName}
          municipalityName={municipalityName}
          memberCount={memberCount}
          administrators={administrators}
          coatOfArms={coatOfArms}
          canEditCoatOfArms={canEditCoatOfArms}
          onSaveCoatOfArms={onSaveCoatOfArms}
          residence={playerResidences?.find(r => r.tile_x === selectedTile.x && r.tile_y === selectedTile.y && (!currentRoomCode || r.room_code === currentRoomCode))}
          municipalitySlug={municipalitySlug || undefined}
          currentRoomCode={currentRoomCode}
          onViewPlayerProfile={onViewPlayerProfile}
          onEnterRoom={openResidenceRoom}
          mansionParties={mansionPartiesRef?.current ?? []}
        />
      )}

      {/* Habbo-style Raum-Overlay */}
      {activeRoom && municipalitySlug && (
        <RoomViewerOverlay
          userId={activeRoom.userId}
          nickname={activeRoom.nickname}
          municipalitySlug={municipalitySlug}
          isOwner={(() => {
            const myId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || 0) : 0;
            return activeRoom.userId === myId;
          })()}
          onClose={closeResidenceRoom}
        />
      )}

      {/* Bünzli Inspection Panel */}
      {inspectTile && (
        <InspectionPanel
          inspectTileX={inspectTile.x}
          inspectTileY={inspectTile.y}
          onClose={() => setInspectTile(null)}
          isVisiting={isFullyViewOnly}
          currentMunicipalityName={municipalityName}
        />
      )}

      {/* City Connection Dialog */}
      {cityConnectionDialog && (() => {
        // Find a discovered but not connected city in this direction
        const city = adjacentCities.find(c => c.direction === cityConnectionDialog.direction && c.discovered && !c.connected);
        if (!city) return null;

        // Direction translation
        const directionDE = {
          north: 'Norden',
          south: 'Süden',
          east: 'Osten',
          west: 'Westen'
        }[cityConnectionDialog.direction] || cityConnectionDialog.direction;

        return (
          <Dialog open={true} onOpenChange={() => {
            setCityConnectionDialog(null);
            setDragStartTile(null);
            setDragEndTile(null);
          }}>
            <DialogContent
              className="max-w-[400px]"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DialogHeader>
                <DialogTitle>Gemeinde entdeckt!</DialogTitle>
                <DialogDescription className="break-words">
                  Deine Straße hat die Grenze im {directionDE} erreicht! Du hast {city.name} entdeckt.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Eine Verbindung zu {city.name} bringt:
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>5.000 $ Einmalbonus</li>
                    <li>200 $/Monat zusätzliches Einkommen</li>
                  </ul>
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCityConnectionDialog(null);
                      setDragStartTile(null);
                      setDragEndTile(null);
                    }}
                  >
                    Vielleicht später
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      connectToCityWithApi(city.id);
                      setCityConnectionDialog(null);
                      setDragStartTile(null);
                      setDragEndTile(null);
                    }}
                  >
                    Verbinden
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {hoveredTile && selectedTool !== 'select' && TOOL_INFO[selectedTool] && (() => {
        // Check if this is a waterfront building tool and if placement is valid
        const buildingType = (selectedTool as string) as BuildingType;
        const isWaterfrontTool = requiresWaterAdjacency(buildingType);
        const isAvatarTool = false;
        let isWaterfrontPlacementInvalid = false;

        if (isWaterfrontTool && hoveredTile) {
          const size = getBuildingSize(buildingType);
          const waterCheck = getWaterAdjacency(grid, hoveredTile.x, hoveredTile.y, size.width, size.height, gridSize);
          isWaterfrontPlacementInvalid = !waterCheck.hasWater;
        }

        const toolName = m(TOOL_INFO[selectedTool].name);

        return (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 text-sm pointer-events-auto ${isAvatarTool
              ? 'rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-md'
              : isWaterfrontPlacementInvalid
                ? 'rounded-md border bg-destructive/90 border-destructive-foreground/30 text-destructive-foreground'
                : 'rounded-md border bg-card/90 border-border'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {!isAvatarTool && (
              <>
                {isDragging && dragStartTile && dragEndTile && showsDragGrid ? (
                  <>
                    {(() => {
                      const areaWidth = Math.abs(dragEndTile.x - dragStartTile.x) + 1;
                      const areaHeight = Math.abs(dragEndTile.y - dragStartTile.y) + 1;
                      const totalCost = TOOL_INFO[selectedTool].cost * areaWidth * areaHeight;
                      return (
                        <>
                          {gt('{toolName} - {width}x{height} area', { toolName, width: areaWidth, height: areaHeight })}
                          {TOOL_INFO[selectedTool].cost > 0 && ` - Fr. ${totalCost.toLocaleString('de-CH')}`}
                        </>
                      );
                    })()}
                  </>
                ) : isWaterfrontPlacementInvalid ? (
                  <>
                    {gt('{toolName} must be placed next to water', { toolName })}
                  </>
                ) : (
                  <>
                    {hoveredTile
                      ? gt('{toolName} at ({x}, {y})', { toolName, x: hoveredTile.x, y: hoveredTile.y })
                      : `${toolName} aktiv`}
                    {hoveredTile && TOOL_INFO[selectedTool].cost > 0 && ` - Fr. ${TOOL_INFO[selectedTool].cost.toLocaleString('de-CH')}`}
                    {showsDragGrid && gt(' - Drag to zone area')}
                    {supportsDragPlace && !showsDragGrid && gt(' - Drag to place')}
                    {placementFlipped && <span className="ml-2 text-amber-400">[Gespiegelt]</span>}
                    {!showsDragGrid && !isWaterfrontTool && <span className="ml-2 text-muted-foreground/60 text-xs">(R = Drehen)</span>}
                  </>
                )}
              </>
            )}

          </div>
        );
      })()}

      {/* Quick-Chat in Public Rooms: jetzt im Footer-Bar (PublicRoomFooterBar) */}

      {/* Incident Tooltip - shows when hovering over fire, crime, or NPCs */}
      {hoveredIncident && (() => {
        // Calculate position to avoid overflow
        const tooltipWidth = 200;
        const padding = 16;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

        // Check if tooltip would overflow right edge
        const wouldOverflowRight = hoveredIncident.screenX + padding + tooltipWidth > viewportWidth - padding;
        const left = wouldOverflowRight
          ? hoveredIncident.screenX - tooltipWidth - padding
          : hoveredIncident.screenX + padding;

        // NPC-spezifische Tooltip-Daten
        const getNpcTooltip = () => {
          switch (hoveredIncident.type) {
            case 'npc_dealer':
              return {
                icon: <SafetyIcon size={14} className="text-purple-400" />,
                title: gt('Drug Deal'),
                desc: gt('Suspected narcotics transaction. Dealer active in low-coverage area.'),
                borderColor: 'border-purple-500/60',
              };
            case 'npc_gangster':
              return {
                icon: <AlertIcon size={14} className="text-yellow-400" />,
                title: gt('Suspicious Activity'),
                desc: hoveredIncident.npcState === 'burglary'
                  ? gt('Break-in detected. Suspect operating under cover of night.')
                  : gt('Suspicious individual loitering near buildings. Low police coverage.'),
                borderColor: 'border-yellow-500/60',
              };
            case 'npc_police_chase':
              return {
                icon: <SafetyIcon size={14} className="text-blue-400" />,
                title: gt('Police Pursuit'),
                desc: gt('Suspect fleeing from police. Officers in pursuit.'),
                borderColor: 'border-blue-500/60',
              };
            case 'npc_homeless':
              return {
                icon: <PopulationIcon size={14} className="text-orange-400" />,
                title: gt('Homeless Person'),
                desc: gt('Person without shelter. Housing shortage in the area.'),
                borderColor: 'border-orange-500/60',
              };
            case 'npc_buenzli':
              return {
                icon: <AlertIcon size={14} className="text-yellow-500" />,
                title: 'Büenzli-Inspektor',
                desc: hoveredIncident.npcState === 'illegal_parking'
                  ? 'Kontrolliert Falschparkieren'
                  : 'Inspiziert Gebäude',
                borderColor: 'border-[#d4a017]/60',
              };
            default:
              return null;
          }
        };

        const npcTooltip = getNpcTooltip();
        const isNpcType = npcTooltip !== null;

        return (
          <div
            className="fixed pointer-events-none z-[100]"
            style={{ left, top: hoveredIncident.screenY - 8 }}
          >
            <div className={`bg-sidebar border ${isNpcType ? npcTooltip!.borderColor : 'border-sidebar-border'} rounded-md shadow-lg px-3 py-2 w-[220px]`}>
              {/* Header */}
              <div className="flex gap-2 items-center mb-1">
                {isNpcType ? npcTooltip!.icon : hoveredIncident.type === 'fire' ? (
                  <FireIcon size={14} className="text-red-400" />
                ) : (
                  <SafetyIcon size={14} className="text-blue-400" />
                )}
                <span className="text-xs font-semibold text-sidebar-foreground">
                  {isNpcType
                    ? npcTooltip!.title
                    : hoveredIncident.type === 'fire'
                      ? getFireNameForTile(hoveredIncident.x, hoveredIncident.y)
                      : hoveredIncident.crimeType
                        ? getCrimeName(hoveredIncident.crimeType)
                        : gt('Incident')}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-tight">
                {isNpcType
                  ? npcTooltip!.desc
                  : hoveredIncident.type === 'fire'
                    ? getFireDescriptionForTile(hoveredIncident.x, hoveredIncident.y)
                    : hoveredIncident.crimeType
                      ? getCrimeDescription(hoveredIncident.crimeType)
                      : gt('Incident reported.')}
              </p>

              {/* Location */}
              <div className="mt-1.5 pt-1.5 border-t border-sidebar-border/50 text-[10px] text-muted-foreground/60 font-mono">
                ({hoveredIncident.x}, {hoveredIncident.y})
              </div>
            </div>
          </div>
        );
      })()}

      {/* Label Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={(open) => {
        if (!open) {
          setShowLabelDialog(false);
          setLabelTarget(null);
          setLabelInput('');
        }
      }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              🏷️ Gebäude benennen
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Gib diesem Gebäude einen individuellen Namen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="z.B. Müllers Bäckerei"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              maxLength={30}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-600"
                onClick={() => {
                  setShowLabelDialog(false);
                  setLabelTarget(null);
                  setLabelInput('');
                }}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                disabled={isFullyViewOnly}
                onClick={() => {
                  if (labelTarget && !isFullyViewOnly) {
                    setBuildingLabel(labelTarget.x, labelTarget.y, labelInput.trim());
                  }
                  setShowLabelDialog(false);
                  setLabelTarget(null);
                  setLabelInput('');
                }}
              >
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Water Body Rename Dialog */}
      <Dialog open={showWaterLabelDialog} onOpenChange={(open) => {
        if (!open) {
          setShowWaterLabelDialog(false);
          setWaterLabelTarget(null);
          setWaterLabelInput('');
        }
      }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              🌊 Gewässer umbenennen
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Gib diesem See oder Ozean einen neuen Namen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={waterLabelInput}
              onChange={(e) => setWaterLabelInput(e.target.value)}
              placeholder="z.B. Bodensee"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              maxLength={30}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-600"
                onClick={() => {
                  setShowWaterLabelDialog(false);
                  setWaterLabelTarget(null);
                  setWaterLabelInput('');
                }}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-cyan-600 hover:bg-cyan-500"
                disabled={isFullyViewOnly}
                onClick={() => {
                  if (waterLabelTarget && !isFullyViewOnly && waterLabelInput.trim()) {
                    renameWaterBody(waterLabelTarget, waterLabelInput.trim());
                  }
                  setShowWaterLabelDialog(false);
                  setWaterLabelTarget(null);
                  setWaterLabelInput('');
                }}
              >
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Büenzli Quiz Dialog */}
      <BuenzliQuizDialog
        open={showBuenzliQuiz}
        onOpenChange={setShowBuenzliQuiz}
        eventType={buenzliQuizData?.eventType}
        buenzliServerId={buenzliQuizData?.serverId}
      />

      {selectedAvatarProfile && (
        <>
          <div className="mg-habbo-window mg-user-info">
            <button className="close" onClick={() => setSelectedAvatarProfile(null)}>X</button>
            <h2 className="title">{selectedAvatarProfile.name}</h2>
            <hr />
            <div className="user-container">
              <div className="avatar-container">
                {(avatarProfilePreviewUrl || (changeLooksOpen ? changeLooksPreviewUrl : '')) ? (
                  <img src={avatarProfilePreviewUrl || changeLooksPreviewUrl} alt="Avatar preview" />
                ) : (
                  <span style={{ color: '#9d9ca0' }}>...</span>
                )}
              </div>
              <div className="badge-container">
                {DEFAULT_PROFILE_BADGES.map((badge) => (
                  <div key={badge} className="badge-box">
                    <img
                      src={`${BOBBA_BADGE_BASE_URL}${badge}.gif`}
                      alt={badge}
                      className="h-8 w-8 object-contain [image-rendering:pixelated]"
                    />
                  </div>
                ))}
              </div>
            </div>
            <hr />
            {selectedAvatarProfile.isLocal ? (
              mottoEditing ? (
                <div className="motto-edit-row">
                  <input
                    className="motto-input"
                    value={mottoInput}
                    onChange={(e) => setMottoInput(e.target.value.slice(0, 100))}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = mottoInput.trim();
                        const nextConfig = normalizeAvatarAppearanceConfig({
                          ...getLocalAvatarAppearanceConfig(),
                          motto: trimmed,
                        });
                        saveAvatarAppearanceToStorage(nextConfig);
                        setSelectedAvatarProfile((prev) => prev ? { ...prev, motto: trimmed } : prev);
                        setMottoEditing(false);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('avatar-config-updated', {
                            detail: { config: nextConfig },
                          }));
                        }
                        try {
                          const token = typeof window !== 'undefined'
                            ? localStorage.getItem('isocity_auth_token')
                            : null;
                          if (token) {
                            await fetch(`${GAME_API_BASE_URL}/user-data/avatar-config`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-Game-Token': token,
                              },
                              body: JSON.stringify({ avatar_config: nextConfig }),
                            });
                          }
                        } catch { /* ignore */ }
                      } else if (e.key === 'Escape') {
                        setMottoEditing(false);
                        setMottoInput(selectedAvatarProfile.motto || '');
                      }
                    }}
                    placeholder="Dein Motto..."
                    maxLength={100}
                    autoFocus
                  />
                  <button
                    className="motto-save-btn"
                    onClick={async () => {
                      const trimmed = mottoInput.trim();
                      const nextConfig = normalizeAvatarAppearanceConfig({
                        ...getLocalAvatarAppearanceConfig(),
                        motto: trimmed,
                      });
                      saveAvatarAppearanceToStorage(nextConfig);
                      setSelectedAvatarProfile((prev) => prev ? { ...prev, motto: trimmed } : prev);
                      setMottoEditing(false);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('avatar-config-updated', {
                          detail: { config: nextConfig },
                        }));
                      }
                      try {
                        const token = typeof window !== 'undefined'
                          ? localStorage.getItem('isocity_auth_token')
                          : null;
                        if (token) {
                          await fetch(`${GAME_API_BASE_URL}/user-data/avatar-config`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                              'X-Game-Token': token,
                            },
                            body: JSON.stringify({ avatar_config: nextConfig }),
                          });
                        }
                      } catch { /* ignore */ }
                    }}
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <p
                  className="motto motto-clickable"
                  onClick={() => {
                    setMottoInput(selectedAvatarProfile.motto || '');
                    setMottoEditing(true);
                  }}
                  title="Klicke um dein Motto zu bearbeiten"
                >
                  {selectedAvatarProfile.motto || 'Das bist du. ✏️'}
                </p>
              )
            ) : (
              <p className="motto">Besucher im Raum.</p>
            )}
          </div>
          <div className="mg-user-buttons">
            <button
              onClick={() => {
                setChangeLooksFigure(selectedAvatarProfile.figure || DEFAULT_HABBO_FIGURE);
                setChangeLooksMainTab('generic');
                setChangeLooksSecondTabIdx(0);
                setChangeLooksPos({
                  x: Math.max(24, Math.min(window.innerWidth - 410, Math.round(window.innerWidth * 0.62))),
                  y: Math.max(24, Math.min(window.innerHeight - 440, Math.round(window.innerHeight * 0.12))),
                });
                setChangeLooksOpen(true);
              }}
            >
              Change looks
            </button>
            <button onClick={() => waveToAvatar(selectedAvatarProfile.avatarId)}>
              Wave
            </button>
            <button onClick={() => danceWithAvatar(selectedAvatarProfile.avatarId)}>
              Dance
            </button>
          </div>
        </>
      )}

      {changeLooksOpen && (
        <div
          className="mg-habbo-window mg-changelooks"
          style={{ left: `${changeLooksPos.x}px`, top: `${changeLooksPos.y}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="close" onClick={() => setChangeLooksOpen(false)}>X</button>
          <h2
            className="title mg-draggable-title"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              changeLooksDragRef.current = {
                dragging: true,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                startX: changeLooksPos.x,
                startY: changeLooksPos.y,
              };
            }}
          >
            Change your looks
          </h2>
          <hr />
          <div className="main-tabs">
            {AVATAR_EDITOR_TABS.map(tab => (
              <button
                key={tab.id}
                className={changeLooksMainTab === tab.id ? 'active' : ''}
                onClick={() => setChangeLooksMainTab(tab.id)}
              >
                <img
                  className="mg-main-tab-icon-image"
                  src={avatarEditorIconUrl(AVATAR_EDITOR_MAIN_TAB_ICON_FILE[tab.id])}
                  alt={tab.id}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </button>
            ))}
          </div>
          <div className="parts">
            <div className="mg-second-tabs">
              {changeLooksMainTab !== 'generic' && activeMainTab.tabs.map((tab, i) => (
                <button
                  key={tab.type}
                  className={changeLooksSecondTabIdx === i ? 'active' : ''}
                  onClick={() => setChangeLooksSecondTabIdx(i)}
                  title={tab.name}
                  aria-label={tab.name}
                >
                  {tab.image ? (
                    <img
                      src={avatarEditorIconUrl(`${tab.image}.png`)}
                      alt={tab.name}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : null}
                </button>
              ))}
              {changeLooksMainTab === 'generic' && (
                <div className="mg-gender-tabs">
                  <button
                    className={changeLooksGender === 'M' ? 'active' : ''}
                    onClick={() => { void handleChangeLooksGender('M'); }}
                    title="Männlich"
                    aria-label="Männlich"
                  >
                    <img
                      className="mg-gender-icon-image"
                      src={avatarEditorIconUrl('gender_male.png')}
                      alt="Männlich"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </button>
                  <button
                    className={changeLooksGender === 'F' ? 'active' : ''}
                    onClick={() => { void handleChangeLooksGender('F'); }}
                    title="Weiblich"
                    aria-label="Weiblich"
                  >
                    <img
                      className="mg-gender-icon-image"
                      src={avatarEditorIconUrl('gender_female.png')}
                      alt="Weiblich"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </button>
                </div>
              )}
            </div>
            <div className="editor-grid">
              <div className="figure-input">
                <div
                  className="mg-parts-grid"
                  ref={changeLooksPartsGridRef}
                  onScroll={handleChangeLooksPartsScroll}
                >
                  {!activeSecondaryTab.required && (
                    <button
                      className={`mg-part-tile ${!getFigurePart(changeLooksFigure, activeSecondaryTab.type) ? 'active' : ''}`}
                      onClick={removeEditorPart}
                    >
                      X
                    </button>
                  )}
                  {changeLooksParts.slice(0, Math.min(220, changeLooksVisiblePartCount)).map((part) => {
                    const current = getFigurePart(changeLooksFigure, activeSecondaryTab.type);
                    const selected = current?.id === part.id;
                    const previewUrl = getEditorPartPreviewUrl(part.id);
                    return (
                      <button
                        key={part.id}
                        className={`mg-part-tile ${selected ? 'active' : ''} ${part.club ? 'hc' : ''}`}
                        onClick={() => applyEditorPart(part.id)}
                      >
                        {previewUrl ? (
                          <img
                            className={`mg-part-preview mg-part-preview-${changeLooksMainTab}`}
                            src={previewUrl}
                            alt={`Part ${part.id}`}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          part.id
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="platform">
                {changeLooksPreviewUrl && (
                  <img src={changeLooksPreviewUrl} alt="Change looks preview" />
                )}
              </div>
            </div>
            <div className="swatches">
              <div className="mg-color-grid">
                {changeLooksPalette.slice(0, 100).map((c) => (
                  <button
                    key={c.id}
                    className="mg-color-tile"
                    style={{ backgroundColor: `#${c.color}` }}
                    onClick={() => applyEditorPaletteColor(0, c.id)}
                    title={`#${c.color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="button-row">
            <button onClick={() => setChangeLooksOpen(false)}>Cancel</button>
            <button
              onClick={async () => {
                const nextFigure = String(changeLooksFigure || '').trim() || DEFAULT_HABBO_FIGURE;
                const profile = selectedAvatarProfile;
                if (profile?.avatarId) {
                  avatarFigureOverridesRef.current.set(profile.avatarId, nextFigure);
                  const ped = findPedestrianByAvatarId(profile.avatarId);
                  if (ped) ped.avatarFigure = nextFigure;
                  setSelectedAvatarProfile({ ...profile, figure: nextFigure });
                }
                const nextConfig = normalizeAvatarAppearanceConfig({
                  ...getLocalAvatarAppearanceConfig(),
                  figure: nextFigure,
                });
                saveAvatarAppearanceToStorage(nextConfig);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('avatar-config-updated', {
                    detail: { config: nextConfig },
                  }));
                }
                try {
                  const token = typeof window !== 'undefined'
                    ? localStorage.getItem('isocity_auth_token')
                    : null;
                  if (token) {
                    const response = await fetch(`${GAME_API_BASE_URL}/user-data/avatar-config`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Game-Token': token,
                      },
                      body: JSON.stringify({ avatar_config: nextConfig }),
                    });
                    if (!response.ok) {
                      throw new Error(`Server ${response.status}`);
                    }
                    const json = await response.json().catch(() => null);
                    if (json && json.success === false) {
                      throw new Error(String(json.error || 'Avatar-Look konnte nicht gespeichert werden'));
                    }
                  } else {
                    addNotification('Hinweis', 'Kein Login-Token: nur lokal gespeichert, nicht in MySQL', 'default');
                  }
                } catch {
                  addNotification('Fehler', 'MySQL-Speicherung fehlgeschlagen. Bitte Server/Token prüfen.', 'default');
                  return;
                }
                setChangeLooksOpen(false);
              }}
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Bünzli Alert Banner */}
      {buenzliAlert && (
        <div
          key={buenzliAlert.id}
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto animate-in slide-in-from-top-5 fade-in duration-500
            ${buenzliAlert.type === 'big' 
              ? 'bg-gradient-to-r from-red-900/95 to-red-800/95 border-red-500/60' 
              : 'bg-gradient-to-r from-amber-900/95 to-yellow-900/95 border-amber-500/60'
            } backdrop-blur-sm border rounded-xl shadow-2xl px-5 py-3 max-w-[500px]`}
        >
            <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">
              {buenzliAlert.type === 'big' ? '🚨' : '🔍'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold ${buenzliAlert.type === 'big' ? 'text-red-300' : 'text-amber-300'}`}>
                  {buenzliAlert.type === 'big' ? '⚠️ GROSSER PATZER!' : 'Bünzli findet Verstösse!'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">{buenzliAlert.message}</p>
              <div className={`text-xs font-bold mt-0.5 ${buenzliAlert.type === 'big' ? 'text-red-400' : 'text-amber-400'}`}>
                {buenzliAlert.type === 'big' 
                  ? `Die Gemeinde erhält eine Strafe von ${Math.abs(buenzliAlert.amount)} CHF!`
                  : `Busse: ${Math.abs(buenzliAlert.amount)} CHF`
                }
              </div>
              {buenzliAlert.type === 'big' && (
                <p className="text-[10px] text-red-400/70 mt-0.5">Bünzli hat den Verstoss den Behörden gemeldet.</p>
              )}
            </div>
            <button 
              onClick={() => setBuenzliAlert(null)}
              className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
