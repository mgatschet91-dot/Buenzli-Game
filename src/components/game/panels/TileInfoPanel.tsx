'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { BusStationSection } from './BusStationSection';
import { Tile, BuildingType, TOOL_INFO, Tool, BUILDING_STATS } from '@/types/game';
import { getCondition, getHasWerkhofNpc } from '@/lib/werkhofConditionStore';
import { getBuildingPollution } from '@/lib/simulation';
import { useItemDetails } from '@/lib/hooks/useItemDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { CloseIcon } from '@/components/ui/Icons';
import { useGame } from '@/context/GameContext';
import { Tag, Check, X, Home, User, Loader2, Sparkles, UserPlus, UserMinus } from 'lucide-react';
import { useResidences } from '@/lib/hooks/useResidences';
import { VillaPickerModal } from './VillaPickerModal';
import { getMyAuthProfile } from '@/lib/api/bankingApi';
import { getAuthToken } from '@/lib/api/coreApi';
import {
  buildCoatOfArmsSvg,
  createRandomCoatOfArmsPreset,
  type CoatOfArmsPreset,
  type CoatPattern,
  type CoatSymbol,
} from '@/lib/coatOfArmsGenerator';
import { 
  SERVICE_CONFIG, 
  SERVICE_BUILDING_TYPES,
  NON_UPGRADEABLE_SERVICE_BUILDINGS,
  SERVICE_MAX_LEVEL,
  SERVICE_RANGE_INCREASE_PER_LEVEL,
  SERVICE_UPGRADE_COST_BASE,
  getBuildTimeSeconds,
  getUpgradeBuildTimeSeconds,
} from '@/lib/simulation';

interface TileInfoPanelProps {
  tile: Tile;
  services: {
    police: number[][];
    fire: number[][];
    health: number[][];
    education: number[][];
    power: boolean[][];
    water: boolean[][];
  };
  onClose: () => void;
  isMobile?: boolean;
  isViewOnly?: boolean;
  ownerName?: string;
  municipalityName?: string;
  memberCount?: number;
  administrators?: Array<{ id: number; nickname: string }>;
  coatOfArms?: { svg: string | null; image_url: string | null } | null;
  canEditCoatOfArms?: boolean;
  onSaveCoatOfArms?: (svg: string | null) => void;
  residence?: { user_id: number; nickname: string; mansion_variant_row?: number | null; mansion_variant_col?: number | null } | null;
  municipalitySlug?: string;
  currentRoomCode?: string;
  onViewPlayerProfile?: (userId: number) => void;
  onEnterRoom?: (userId: number, nickname: string) => void;
  mansionParties?: import('@/components/game/types').MansionParty[];
}

const RESIDENTIAL_TYPES = new Set(['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high', 'cabin_house']);

export function TileInfoPanel({
  tile,
  services,
  onClose,
  isMobile = false,
  isViewOnly = false,
  ownerName,
  municipalityName,
  memberCount,
  administrators,
  coatOfArms,
  canEditCoatOfArms = false,
  onSaveCoatOfArms,
  residence,
  municipalitySlug,
  currentRoomCode,
  onViewPlayerProfile,
  onEnterRoom,
  mansionParties = [],
}: TileInfoPanelProps) {
  const { x, y } = tile;
  const { state, upgradeServiceBuilding, repairAtTile, flipBuildingAtTile, placeAtTile, setTool, setBuildingLabel, setAutobahnDirection, parkedVehiclesRef, parkingConfigRef, parkingViolationsRef, emitSetParkingConfig } = useGame();
  const serverItemDetails = useItemDetails();
  
  // Residence state
  const isResidential = RESIDENTIAL_TYPES.has(tile.building.type as string);
  const isMansion = tile.building.type === 'mansion';
  const isStandaloneBuilding = new Set(['bank_house', 'bus_stop', 'bus_station', 'solar_panel', 'fcbasel_stadium', 'st_ursen_kathedrale', 'primetower', 'parking_spot', 'parking_lot', 'parking_lot_large']).has(tile.building.type as string);
  const LANDMARK_META: Record<string, { city: string; icon: string }> = {
    fcbasel_stadium:    { city: 'Basel',     icon: '⚽' },
    st_ursen_kathedrale:{ city: 'Solothurn', icon: '⛪' },
    primetower:         { city: 'Zürich',    icon: '🏙️' },
  };
  const landmarkMeta = LANDMARK_META[tile.building.type as string] ?? null;
  const isLandmark = landmarkMeta !== null;

  // ── Parking lot info ──────────────────────────────────────────────────────
  const PARKING_SIZES: Record<string, number> = {
    parking_spot: 1,
    parking_lot: 2,
    parking_lot_large: 3,
  };
  const parkingSize = PARKING_SIZES[tile.building.type as string] ?? 0;
  const isParking = parkingSize > 0;

  const calcParkingInfo = React.useCallback(() => {
    if (!isParking) return null;
    const totalSlots = parkingSize * parkingSize * 8; // 4 Streifen × 2 Seiten
    let occupied = 0;
    for (let dy = 0; dy < parkingSize; dy++) {
      for (let dx = 0; dx < parkingSize; dx++) {
        occupied += (parkedVehiclesRef?.current ?? []).filter(
          (p) => p.tileX === tile.x + dx && p.tileY === tile.y + dy
        ).length;
      }
    }
    const free = totalSlots - occupied;
    const pct = Math.round((occupied / totalSlots) * 100);
    return { totalSlots, occupied, free, pct };
  }, [isParking, parkingSize, tile.x, tile.y, parkedVehiclesRef]);

  const [parkingInfo, setParkingInfo] = React.useState(calcParkingInfo);
  React.useEffect(() => {
    if (!isParking) return;
    setParkingInfo(calcParkingInfo());
    const interval = setInterval(() => setParkingInfo(calcParkingInfo()), 2000);
    return () => clearInterval(interval);
  }, [isParking, calcParkingInfo]);

  // Parking config (free/paid + rate) — polled from ref
  const getConfigForTile = React.useCallback(() => {
    if (!isParking) return null;
    const cfg = (parkingConfigRef?.current ?? []).find(
      (c) => c.tileX === tile.x && c.tileY === tile.y
    );
    return { isFree: cfg?.isFree ?? false, feeRate: cfg?.feeRate ?? 3 };
  }, [isParking, tile.x, tile.y, parkingConfigRef]);

  const [parkingCfg, setParkingCfg] = React.useState(getConfigForTile);
  const [cfgDirty, setCfgDirty] = React.useState(false);

  React.useEffect(() => {
    if (!isParking) return;
    setParkingCfg(getConfigForTile());
    const interval = setInterval(() => {
      if (!cfgDirty) setParkingCfg(getConfigForTile());
    }, 2000);
    return () => clearInterval(interval);
  }, [isParking, getConfigForTile, cfgDirty]);


  const { claim: claimResidence, release: releaseResidence, upgradeVilla } = useResidences(municipalitySlug || null);
  const [residenceLoading, setResidenceLoading] = useState(false);
  const [residenceMsg, setResidenceMsg] = useState('');
  const myUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || 0) : 0;
  const isMyHouse = residence?.user_id === myUserId;
  const [showVillaPicker, setShowVillaPicker] = useState(false);
  const [myUserRank, setMyUserRank] = useState(0);
  // Load user rank for villa picker
  React.useEffect(() => {
    if (isMyHouse && isMansion) {
      getMyAuthProfile().then(p => setMyUserRank(p.user_rank)).catch(() => {});
    }
  }, [isMyHouse, isMansion]);

  // Rental state
  type Tenant = { id: number; tenant_id: number; tenant_nickname: string; monthly_rent: number; started_at: string; missed_payments: number };
  type TierConfig = { maxTenants: number; minRent: number; maxRent: number };
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tierConfig, setTierConfig] = useState<TierConfig | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteNickname, setInviteNickname] = useState('');
  const [inviteRent, setInviteRent] = useState(0);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [rentalMsg, setRentalMsg] = useState('');

  const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

  const loadTenants = useCallback(async () => {
    if (!isMansion || !municipalitySlug || !currentRoomCode) return;
    setTenantsLoading(true);
    try {
      const token = getAuthToken() || '';
      const url = `${AUTH_API_BASE}/api/game/municipality/${municipalitySlug}/residence/tenants?tile_x=${x}&tile_y=${y}&room_code=${encodeURIComponent(currentRoomCode)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token } });
      const d = await r.json();
      if (d.ok) { setTenants(d.data.tenants || []); setTierConfig(d.data.tier || null); if (inviteRent === 0 && d.data.tier) setInviteRent(d.data.tier.minRent); }
    } catch (_) {}
    finally { setTenantsLoading(false); }
  }, [isMansion, municipalitySlug, currentRoomCode, x, y, AUTH_API_BASE, inviteRent]);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const isTenant = tenants.some(t => t.tenant_id === myUserId);

  // Party State
  const activeParty = mansionParties.find(p => p.tileX === x && p.tileY === y) ?? null;
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyMsg, setPartyMsg] = useState('');
  const [partyCountdown, setPartyCountdown] = useState<number | null>(null); // null = kein Countdown
  const partyCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Aktivierungs-Fanfare via Web Audio (kein MP3 nötig)
  function playPartyFanfare() {
    try {
      const ctx = new AudioContext();
      const notes = [261, 329, 392, 523]; // C4 E4 G4 C5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
      });
    } catch { /* ignore */ }
  }

  function playStopSound() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch { /* ignore */ }
  }

  function handleStartPartyClick() {
    if (partyCountdown !== null || partyLoading) return;
    // 5-Sekunden-Countdown starten
    setPartyCountdown(5);
    setPartyMsg('');
    let count = 5;
    partyCountdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(partyCountdownRef.current!);
        partyCountdownRef.current = null;
        setPartyCountdown(null);
        doStartParty();
      } else {
        setPartyCountdown(count);
      }
    }, 1000);
  }

  function handleCancelCountdown() {
    if (partyCountdownRef.current) {
      clearInterval(partyCountdownRef.current);
      partyCountdownRef.current = null;
    }
    setPartyCountdown(null);
  }

  // Cleanup bei Unmount
  useEffect(() => {
    return () => { if (partyCountdownRef.current) clearInterval(partyCountdownRef.current); };
  }, []);

  async function doStartParty() {
    if (!municipalitySlug || !currentRoomCode) return;
    playPartyFanfare();
    setPartyLoading(true); setPartyMsg('');
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${AUTH_API_BASE}/api/game/municipality/${municipalitySlug}/mansion-party/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ tile_x: x, tile_y: y, room_code: currentRoomCode }),
      });
      const d = await r.json();
      if (!d.ok) setPartyMsg(d.error || 'Fehler beim Starten');
    } catch { setPartyMsg('Netzwerkfehler'); }
    finally { setPartyLoading(false); }
  }

  async function handleStopParty() {
    if (!activeParty || !municipalitySlug) return;
    playStopSound();
    setPartyLoading(true); setPartyMsg('');
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${AUTH_API_BASE}/api/game/municipality/${municipalitySlug}/mansion-party/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ party_id: activeParty.id }),
      });
      const d = await r.json();
      if (d.ok) {
        // Optimistisches Update: Party sofort lokal entfernen ohne auf Server-Tick warten
        window.dispatchEvent(new CustomEvent('party-authoritative', {
          detail: { parties: [], serverTimestamp: Date.now() }
        }));
      } else {
        setPartyMsg(d.error || 'Fehler');
      }
    } catch { setPartyMsg('Netzwerkfehler'); }
    finally { setPartyLoading(false); }
  }

  // Polizei-Intervall je nach Tageszeit (nur Anzeige)
  const policeIntervalLabel = (() => {
    const h = new Date().getHours();
    if (h >= 22 || h < 6) return 'alle 5 Min (Nacht 🌙)';
    if (h >= 18) return 'alle 10 Min (Abend 🌆)';
    return 'alle 20 Min (Tag ☀️)';
  })();

  const FINE_STEPS = [150, 300, 600, 1200];
  const nextFine = activeParty ? FINE_STEPS[Math.min(activeParty.policeVisits, 3)] : FINE_STEPS[0];

  async function handleInvite() {
    if (!inviteNickname.trim() || !municipalitySlug || !currentRoomCode) return;
    setInviteLoading(true); setInviteError('');
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${AUTH_API_BASE}/api/game/municipality/${municipalitySlug}/residence/rent-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ tile_x: x, tile_y: y, room_code: currentRoomCode, tenant_nickname: inviteNickname.trim(), monthly_rent: inviteRent }),
      });
      const d = await r.json();
      if (d.ok) { setShowInviteModal(false); setInviteNickname(''); setRentalMsg('Mieter eingeladen!'); await loadTenants(); }
      else { setInviteError(d.error || 'Fehler'); }
    } catch (_) { setInviteError('Netzwerkfehler'); }
    finally { setInviteLoading(false); }
  }

  async function handleCancelRental(agreementId: number) {
    if (!municipalitySlug) return;
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${AUTH_API_BASE}/api/game/municipality/${municipalitySlug}/residence/rent-out/${agreementId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
      });
      const d = await r.json();
      if (d.ok) { setRentalMsg('Mietvertrag gekündigt.'); await loadTenants(); }
      else { setRentalMsg(d.error || 'Fehler'); }
    } catch (_) { setRentalMsg('Netzwerkfehler'); }
  }

  async function handleClaim() {
    if (!currentRoomCode) return;
    setResidenceLoading(true); setResidenceMsg('');
    try {
      await claimResidence(x, y, currentRoomCode);
      setResidenceMsg('Zuhause beansprucht!');
    } catch (e: unknown) { setResidenceMsg(e instanceof Error ? e.message : 'Fehler'); }
    finally { setResidenceLoading(false); }
  }

  async function handleRelease() {
    setResidenceLoading(true); setResidenceMsg('');
    try {
      await releaseResidence();
      setResidenceMsg('Haus freigegeben.');
    } catch (e: unknown) { setResidenceMsg(e instanceof Error ? e.message : 'Fehler'); }
    finally { setResidenceLoading(false); }
  }

  // Label editing state
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(tile.building.customName || '');
  const [isEditingCoat, setIsEditingCoat] = useState(false);
  const [coatPreset, setCoatPreset] = useState<CoatOfArmsPreset>(() => createRandomCoatOfArmsPreset());
  
  // Check if this is a service building
  const isServiceBuilding = SERVICE_BUILDING_TYPES.has(tile.building.type)
    && !NON_UPGRADEABLE_SERVICE_BUILDINGS.has(tile.building.type);
  
  // Calculate upgrade cost and info for service buildings
  const upgradeInfo = useMemo(() => {
    if (!isServiceBuilding) return null;
    
    const buildingType = tile.building.type;
    // Service buildings are also Tools, so we can safely cast
    const baseCost = (TOOL_INFO as Record<string, { cost: number }>)[buildingType]?.cost ?? 0;
    const currentLevel = tile.building.level;
    const isUpgrading = !!(tile.building.upgradeStartedAt && tile.building.upgradeTargetLevel);
    
    // Get base range and calculate effective range
    const config = SERVICE_CONFIG[buildingType as keyof typeof SERVICE_CONFIG];
    const baseRange = config?.range ?? 0;
    const currentEffectiveRange = Math.floor(baseRange * (1 + (currentLevel - 1) * SERVICE_RANGE_INCREASE_PER_LEVEL));
    const nextEffectiveRange = Math.floor(baseRange * (1 + currentLevel * SERVICE_RANGE_INCREASE_PER_LEVEL));
    
    // Upgrade-Bauzeit berechnen
    // constructionProgress wird im Sim-Tick basierend auf Echtzeit berechnet
    let upgradeProgress = 0;
    let upgradeRemainingSeconds = 0;
    let upgradeTotalSeconds = 0;
    if (isUpgrading && tile.building.upgradeStartedAt) {
      upgradeTotalSeconds = getUpgradeBuildTimeSeconds(
        buildingType as BuildingType,
        currentLevel
      );
      // Nutze constructionProgress (wird im Sim-Tick echtzeit-basiert aktualisiert)
      upgradeProgress = Math.max(0, Math.min(100, tile.building.constructionProgress ?? 0));
      // Verbleibende Zeit aus Progress berechnen
      const progressFraction = upgradeProgress / 100;
      upgradeRemainingSeconds = Math.max(0, upgradeTotalSeconds * (1 - progressFraction));
    }
    
    // Naechstes Upgrade (wenn nicht schon upgradend und nicht max level)
    const effectiveMaxLevel = buildingType === 'woodcutter_house' ? 4 : SERVICE_MAX_LEVEL;
    const canUpgradeNext = !isUpgrading && currentLevel < effectiveMaxLevel;
    // Holzfäller-Haus: Flat $200 pro Arbeiter, andere: exponentiell
    const upgradeCost = canUpgradeNext
      ? (buildingType === 'woodcutter_house' ? 200 : baseCost * Math.pow(SERVICE_UPGRADE_COST_BASE, currentLevel))
      : 0;
    const canAfford = canUpgradeNext && state.stats.money >= upgradeCost;
    const isInitialConstruction = !isUpgrading && tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100;
    const isAbandoned = tile.building.abandoned;
    
    // Vorschau: wie lange würde das nächste Upgrade dauern?
    const nextUpgradeSeconds = canUpgradeNext
      ? getUpgradeBuildTimeSeconds(buildingType as BuildingType, currentLevel)
      : 0;
    
    return {
      cost: upgradeCost,
      canAfford,
      isInitialConstruction,
      isAbandoned,
      currentLevel,
      maxLevel: effectiveMaxLevel,
      baseRange,
      currentEffectiveRange,
      nextEffectiveRange,
      isUpgrading,
      upgradeTargetLevel: tile.building.upgradeTargetLevel ?? 0,
      upgradeProgress,
      upgradeRemainingSeconds,
      upgradeTotalSeconds,
      nextUpgradeSeconds,
      canUpgradeNext,
    };
  }, [isServiceBuilding, tile.building, state.stats.money]);
  
  const handleUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isViewOnly || !upgradeInfo || !upgradeInfo.canAfford) return;
    const success = upgradeServiceBuilding(x, y);
    if (success) {
      // Optionally add notification here
    }
  };
  
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const blockPointerToGrid = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const constructionInfo = useMemo(() => {
    const rawProgress = Number(tile.building.constructionProgress ?? 100);
    const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    const isUnderConstruction = progress < 100;
    const buildingType = tile.building.type as BuildingType;
    const totalSeconds = getBuildTimeSeconds(buildingType);
    const remainingSeconds = Math.max(0, Math.round((totalSeconds * (100 - progress)) / 100));
    const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);

    let phaseLabel = 'Fertig';
    let phaseStart = 100;
    let phaseEnd = 100;
    if (isUnderConstruction && progress < 40) {
      phaseLabel = 'Phase 1: Fundament';
      phaseStart = 0;
      phaseEnd = 40;
    } else if (isUnderConstruction) {
      phaseLabel = 'Phase 2: Geruest / Rohbau';
      phaseStart = 40;
      phaseEnd = 100;
    }
    const phaseSpan = Math.max(1, phaseEnd - phaseStart);
    const phaseProgressPercent = isUnderConstruction
      ? Math.max(0, Math.min(100, Math.round(((progress - phaseStart) / phaseSpan) * 100)))
      : 100;

    const formatDuration = (seconds: number) => {
      const safeSeconds = Math.max(0, Math.round(seconds));
      if (safeSeconds < 60) return `${safeSeconds}s`;
      const m = Math.floor(safeSeconds / 60);
      const s = safeSeconds % 60;
      if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
      const h = Math.floor(m / 60);
      const rm = m % 60;
      if (rm > 0 && s > 0) return `${h}h ${rm}m ${s}s`;
      if (rm > 0) return `${h}h ${rm}m`;
      return s > 0 ? `${h}h ${s}s` : `${h}h`;
    };
    const formatClock = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    return {
      progress,
      isUnderConstruction,
      phaseLabel,
      phaseProgressPercent,
      totalSeconds,
      elapsedSeconds,
      remainingSeconds,
      elapsedLabel: formatDuration(elapsedSeconds),
      remainingLabel: formatDuration(remainingSeconds),
      totalLabel: formatDuration(totalSeconds),
      remainingClock: formatClock(remainingSeconds),
      elapsedClock: formatClock(elapsedSeconds),
      totalClock: formatClock(totalSeconds),
    };
  }, [tile.building.type, tile.building.constructionProgress]);

  const permissionStatusInfo = useMemo(() => {
    if (tile.building.upgradeStartedAt && tile.building.upgradeTargetLevel) {
      return {
        label: `Upgrade auf Lv.${tile.building.upgradeTargetLevel}`,
        className: 'bg-amber-500/20 text-amber-300',
      };
    }
    if (constructionInfo.isUnderConstruction) {
      return {
        label: 'Bau läuft',
        className: 'bg-amber-500/20 text-amber-300',
      };
    }
    if (tile.building.abandoned) {
      return {
        label: 'Gesperrt',
        className: 'bg-red-500/20 text-red-300',
      };
    }
    return {
      label: 'Freigegeben',
      className: 'bg-green-500/20 text-green-400',
    };
  }, [constructionInfo.isUnderConstruction, tile.building.abandoned]);

  const coatPreviewSvg = useMemo(() => buildCoatOfArmsSvg(coatPreset), [coatPreset]);
  const currentCoatSvg = coatOfArms?.svg || null;
  const currentCoatImageSrc = coatOfArms?.image_url || (currentCoatSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(currentCoatSvg)}` : null);

  const handleColorChange = (key: 'primaryColor' | 'secondaryColor' | 'accentColor', value: string) => {
    setCoatPreset((prev) => ({ ...prev, [key]: value }));
  };

  const handlePatternChange = (value: string) => {
    setCoatPreset((prev) => ({ ...prev, pattern: value as CoatPattern }));
  };

  const handleSymbolChange = (value: string) => {
    setCoatPreset((prev) => ({ ...prev, symbol: value as CoatSymbol }));
  };

  // Natur-/Infrastruktur-Tiles ohne Gebaeude-Details (kein Strom/Wasser/Pop/Jobs/Zone noetig)
  const tType = tile.building.type;
  const isNatureTile = tType === 'grass' || tType === 'water' || tType === 'empty'
    || tType === 'road' || tType === 'rail' || tType === 'bridge'
    || tType === 'tree' || tType.startsWith('tree_')
    || tType.startsWith('bush_') || tType.startsWith('flower_') || tType.startsWith('topiary_');

  return (
    <>
    <Card
      className={`${isMobile ? 'fixed left-0 right-0 w-full rounded-none border-x-0 border-t border-b z-30' : 'absolute top-4 right-4 w-72 z-50'}${isLandmark ? ' border-amber-500/50 shadow-lg shadow-amber-500/10' : ''}`}
      style={isMobile ? { top: 'calc(72px + env(safe-area-inset-top, 0px))' } : undefined}
      onClick={handleCardClick}
      onMouseDownCapture={blockPointerToGrid}
      onPointerDownCapture={blockPointerToGrid}
      onTouchStartCapture={blockPointerToGrid}
    >
      <CardHeader className={`pb-2 flex flex-row items-center justify-between${isLandmark ? ' border-b border-amber-500/20' : ''}`}>
        <CardTitle className="text-sm font-sans">Info</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <CloseIcon size={14} />
        </Button>
      </CardHeader>
      {isLandmark && (
        <>
          <style>{`
            @keyframes landmark-shimmer {
              0%   { transform: translateX(-180%) skewX(-20deg); opacity: 0; }
              8%   { opacity: 1; }
              92%  { opacity: 1; }
              100% { transform: translateX(400%) skewX(-20deg); opacity: 0; }
            }
            @keyframes landmark-border-pulse {
              0%, 100% { box-shadow: 0 0 0px 0px rgba(245,158,11,0); }
              50%       { box-shadow: 0 0 14px 3px rgba(245,158,11,0.18); }
            }
          `}</style>
          <div
            className="mx-3 mt-2 rounded-md overflow-hidden border border-amber-500/30 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(120,80,0,0.38) 0%, rgba(180,120,0,0.20) 100%)',
              animation: 'landmark-border-pulse 3s ease-in-out infinite',
            }}
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md">
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '35%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,210,80,0.18), transparent)',
                animation: 'landmark-shimmer 4.5s ease-in-out infinite',
              }} />
            </div>
            <div className="px-3 py-2.5 flex items-center gap-2.5 relative z-10">
              <span className="text-xl leading-none flex-shrink-0">{landmarkMeta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] text-amber-400/60 uppercase tracking-widest font-mono leading-none">Wahrzeichen</span>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 leading-none">{landmarkMeta.city}</span>
                </div>
                <div className="text-amber-200 font-semibold text-[11px] leading-none whitespace-nowrap">⭐ Einmalig in {landmarkMeta.city}</div>
              </div>
            </div>
          </div>
        </>
      )}

      <CardContent className={`space-y-3 text-sm${isLandmark ? ' pt-3' : ''}`}>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Building</span>
          <span className="capitalize">{TOOL_INFO[tile.building.type as keyof typeof TOOL_INFO]?.name ?? tile.building.type.replace(/_/g, ' ')}</span>
        </div>
        
        {/* Label-Sektion entfernt — Label-Werkzeug existiert bereits separat */}

        {/* Residence section for residential buildings */}
        {isResidential && (isMansion || residence) && (
          <>
            <Separator />
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">🏠 Bewohner</div>
            {residence ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-800 flex items-center justify-center text-xs font-bold text-emerald-200">
                      {residence.nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-emerald-200">{residence.nickname}</span>
                  </div>
                  <button
                    onClick={() => onViewPlayerProfile?.(residence.user_id)}
                    className="text-xs text-slate-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <User className="w-3 h-3" /> Profil
                  </button>
                </div>
                {/* Raum betreten — für alle sichtbar wenn Besitzer bekannt */}
                <Button size="sm"
                  className="w-full h-7 text-xs bg-indigo-700 hover:bg-indigo-600 text-white"
                  onClick={() => onEnterRoom?.(residence.user_id, residence.nickname)}>
                  🚪 Zimmer betreten
                </Button>

                {isMyHouse && isMansion && (
                  <Button size="sm"
                    className="w-full h-7 text-xs bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => setShowVillaPicker(true)}>
                    <Sparkles className="w-3 h-3 mr-1" /> Traumhaus wählen
                  </Button>
                )}
                {isMyHouse && !isMansion && (
                  <Button size="sm" variant="outline"
                    className="w-full h-7 text-xs border-red-500/40 text-red-300 hover:bg-red-500/10"
                    onClick={handleRelease} disabled={residenceLoading}>
                    {residenceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Haus freigeben'}
                  </Button>
                )}

                {/* Party-Sektion für eigenes Mansion */}
                {isMyHouse && isMansion && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">🎉</span>
                      <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Mansion Party</span>
                    </div>

                    {/* ZUSTAND: Kein Countdown, keine aktive Party → Idle */}
                    {!activeParty && partyCountdown === null && (
                      <div className="space-y-2">
                        {/* Info-Kacheln */}
                        <div className="grid grid-cols-2 gap-1">
                          <div className="rounded bg-white/5 px-2 py-1.5 text-center">
                            <div className="text-[9px] text-slate-400 uppercase">Gäste</div>
                            <div className="text-xs font-bold text-white">bis 10 NPCs</div>
                          </div>
                          <div className="rounded bg-white/5 px-2 py-1.5 text-center">
                            <div className="text-[9px] text-slate-400 uppercase">Polizei</div>
                            <div className="text-[10px] font-semibold text-yellow-300">{policeIntervalLabel}</div>
                          </div>
                        </div>
                        {/* Bussen-Übersicht */}
                        <div className="flex gap-1">
                          {FINE_STEPS.map((f, i) => (
                            <div key={i} className="flex-1 rounded bg-white/5 py-1 text-center">
                              <div className="text-[8px] text-slate-500">{i + 1}. Warnung</div>
                              <div className="text-[10px] font-bold text-orange-300">CHF {f}</div>
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold shadow-lg"
                          onClick={handleStartPartyClick}
                          disabled={partyLoading}
                        >
                          {partyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '🎉 Party starten'}
                        </Button>
                      </div>
                    )}

                    {/* ZUSTAND: Countdown läuft */}
                    {partyCountdown !== null && (
                      <div className="space-y-2">
                        <div className="rounded-lg bg-gradient-to-br from-pink-900/60 to-purple-900/60 border border-pink-500/30 p-3 text-center">
                          <div
                            className="text-5xl font-black text-white mb-1 tabular-nums"
                            style={{ textShadow: '0 0 20px #ec4899, 0 0 40px #ec4899' }}
                          >
                            {partyCountdown}
                          </div>
                          <div className="text-[11px] text-pink-200 animate-pulse">Party startet gleich…</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[10px] border-slate-600 text-slate-400 hover:bg-slate-700"
                          onClick={handleCancelCountdown}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    )}

                    {/* ZUSTAND: Party aktiv */}
                    {activeParty && partyCountdown === null && (
                      <div className="space-y-2">
                        {/* Live-Header */}
                        <div className={`rounded-lg border p-2.5 ${
                          activeParty.status === 'warning_3'
                            ? 'bg-red-900/40 border-red-500/50'
                            : 'bg-gradient-to-br from-pink-900/40 to-purple-900/40 border-pink-500/30'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-white flex items-center gap-1">
                              <span className="animate-pulse">🎉</span> PARTY LÄUFT
                            </span>
                            <span className="text-[10px] text-slate-300 tabular-nums">
                              {Math.floor(activeParty.durationMinutes)}:{String(Math.round((activeParty.durationMinutes % 1) * 60)).padStart(2, '0')} Min
                            </span>
                          </div>
                          {/* Polizei-Warnstufen */}
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 3].map(lvl => (
                              <div
                                key={lvl}
                                className={`flex-1 h-1.5 rounded-full transition-colors ${
                                  activeParty.policeVisits >= lvl
                                    ? lvl === 3 ? 'bg-red-500' : lvl === 2 ? 'bg-orange-400' : 'bg-yellow-400'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                          {activeParty.policeVisits > 0 && (
                            <div className="text-[9px] text-slate-400 mt-1">
                              {activeParty.policeVisits}/3 Polizei-Warnungen
                            </div>
                          )}
                        </div>

                        {/* Nächste Busse / Warnung */}
                        {activeParty.status === 'warning_3' ? (
                          <div className="rounded border border-red-500/50 bg-red-900/30 px-2 py-1.5 flex items-start gap-1.5">
                            <span className="text-base">🚨</span>
                            <div>
                              <div className="text-[10px] font-bold text-red-300">Letzter Ausweg!</div>
                              <div className="text-[9px] text-red-400">Nächste Polizei = Zwangsabbruch + CHF 1200</div>
                            </div>
                          </div>
                        ) : activeParty.policeVisits > 0 ? (
                          <div className="rounded border border-yellow-500/30 bg-yellow-900/20 px-2 py-1.5 flex items-start gap-1.5">
                            <span>⚠️</span>
                            <div>
                              <div className="text-[10px] text-yellow-200">Nächste Warnung: <strong>CHF {nextFine}</strong></div>
                              <div className="text-[9px] text-yellow-400/70">Polizei kommt {policeIntervalLabel}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded border border-white/10 bg-white/5 px-2 py-1.5 flex items-center gap-1.5">
                            <span>🚓</span>
                            <div className="text-[9px] text-slate-400">
                              Polizei kommt {policeIntervalLabel} — erste Busse CHF {nextFine}
                            </div>
                          </div>
                        )}

                        <Button
                          size="sm"
                          className="w-full h-7 text-[10px] bg-slate-700 hover:bg-red-900/60 border border-slate-600 hover:border-red-500/50 text-slate-300 hover:text-red-300 transition-all"
                          onClick={handleStopParty}
                          disabled={partyLoading}
                        >
                          {partyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '■ Party beenden'}
                        </Button>
                      </div>
                    )}

                    {partyMsg && <div className="text-[10px] text-red-400 mt-1">{partyMsg}</div>}
                  </div>
                )}

                {/* Mieter-Sektion für Mansions */}
                {isMansion && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Mieter {tenantsLoading ? '' : `(${tenants.length}${tierConfig ? `/${tierConfig.maxTenants}` : ''})`}
                      </span>
                      {isMyHouse && tierConfig && tenants.length < tierConfig.maxTenants && (
                        <button
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                          onClick={() => { setShowInviteModal(v => !v); setInviteError(''); }}
                        >
                          <UserPlus className="w-3 h-3" /> Einladen
                        </button>
                      )}
                    </div>

                    {/* Eigene Mieter-Sicht */}
                    {!isMyHouse && isTenant && (() => {
                      const myAgreement = tenants.find(t => t.tenant_id === myUserId);
                      return myAgreement ? (
                        <div className="rounded-lg border border-blue-700/40 bg-blue-900/10 px-2.5 py-2 space-y-1">
                          <div className="text-xs text-blue-300">Du wohnst hier als Mieter</div>
                          <div className="text-xs text-slate-400">{myAgreement.monthly_rent} Fr / Monat</div>
                          <Button size="sm" variant="outline"
                            className="w-full h-6 text-[10px] border-red-500/30 text-red-300 hover:bg-red-500/10 mt-1"
                            onClick={() => handleCancelRental(myAgreement.id)}>
                            <UserMinus className="w-3 h-3 mr-1" /> Ausziehen
                          </Button>
                        </div>
                      ) : null;
                    })()}

                    {/* Mieter-Liste für Besitzer */}
                    {tenantsLoading && <div className="text-xs text-slate-500">Lade Mieter…</div>}
                    {!tenantsLoading && tenants.length > 0 && tenants.map(t => (
                      <div key={t.id} className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-800/30 px-2 py-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                            {t.tenant_nickname.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-slate-200 truncate">{t.tenant_nickname}</div>
                            <div className="text-[10px] text-slate-500">{t.monthly_rent} Fr/Mo</div>
                          </div>
                        </div>
                        {isMyHouse && (
                          <button
                            className="text-[10px] text-red-400/70 hover:text-red-300 ml-1 shrink-0"
                            onClick={() => handleCancelRental(t.id)}
                            title="Kündigen"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!tenantsLoading && tenants.length === 0 && !isMyHouse && !isTenant && (
                      <div className="text-xs text-slate-500">Keine Mieter.</div>
                    )}

                    {/* Einladen-Modal (inline) */}
                    {showInviteModal && isMyHouse && tierConfig && (
                      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 p-2.5 space-y-2">
                        <div className="text-xs font-medium text-emerald-300">Mieter einladen</div>
                        <Input
                          className="h-7 text-xs bg-slate-800 border-slate-600"
                          placeholder="Nickname"
                          value={inviteNickname}
                          onChange={e => setInviteNickname(e.target.value)}
                        />
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Miete: {inviteRent} Fr/Mo</span>
                            <span>{tierConfig.minRent}–{tierConfig.maxRent} Fr</span>
                          </div>
                          <input
                            type="range"
                            min={tierConfig.minRent}
                            max={tierConfig.maxRent}
                            step={Math.max(1, Math.round((tierConfig.maxRent - tierConfig.minRent) / 20))}
                            value={inviteRent || tierConfig.minRent}
                            onChange={e => setInviteRent(Number(e.target.value))}
                            className="w-full accent-emerald-500"
                          />
                        </div>
                        {inviteError && <div className="text-[10px] text-red-400">{inviteError}</div>}
                        <div className="flex gap-1.5">
                          <Button size="sm"
                            className="flex-1 h-7 text-xs bg-emerald-700 hover:bg-emerald-600 text-white"
                            onClick={handleInvite} disabled={inviteLoading || !inviteNickname.trim()}>
                            {inviteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> Einladen</>}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 px-2 text-xs border-slate-600 text-slate-400"
                            onClick={() => setShowInviteModal(false)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {rentalMsg && (
                      <p className={`text-xs ${rentalMsg.includes('!') ? 'text-emerald-400' : 'text-slate-400'}`}>{rentalMsg}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500">Noch niemand wohnt hier.</div>
              </div>
            )}
            {residenceMsg && (
              <p className={`text-xs ${residenceMsg.includes('!') ? 'text-emerald-400' : 'text-red-400'}`}>{residenceMsg}</p>
            )}
          </>
        )}

        {/* City Hall specific: Owner/Administration info */}
        {tile.building.type === 'city_hall' && (
          <>
            <Separator />
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">🏛️ Verwaltung</div>
            
            {municipalityName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gemeinde</span>
                <span className="text-white font-semibold">
                  {municipalityName}
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">👑 Eigentümer</span>
              <span className="text-amber-400 font-semibold">
                {ownerName || 'Unbesetzt'}
              </span>
            </div>
            
            {administrators && administrators.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">⚙️ Verwalter</span>
                <span className="text-blue-400">
                  {administrators.map(a => a.nickname).join(', ')}
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mitglieder</span>
              <span className="text-cyan-400">
                {memberCount !== undefined ? memberCount : 1} 👥
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="default" className={permissionStatusInfo.className}>
                {permissionStatusInfo.label}
              </Badge>
            </div>

            <div className="space-y-2 rounded border border-slate-700/60 p-2">
              <div className="text-xs text-muted-foreground">Wappen</div>
              <div className="flex items-center gap-2">
                <div className="h-14 w-12 overflow-hidden rounded border border-slate-700 bg-slate-900/40">
                  {currentCoatImageSrc ? (
                    <img
                      src={currentCoatImageSrc}
                      alt="Gemeindewappen"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="h-full w-full text-[9px] text-slate-500 flex items-center justify-center">kein Wappen</div>
                  )}
                </div>
                {canEditCoatOfArms && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsEditingCoat((prev) => !prev)}
                  >
                    {isEditingCoat ? 'Schliessen' : 'Wappen erstellen'}
                  </Button>
                )}
              </div>

              {isEditingCoat && canEditCoatOfArms && (
                <div className="space-y-2 rounded border border-slate-700/60 p-2">
                  <div className="h-20 w-16 overflow-hidden rounded border border-slate-700 bg-slate-900/50">
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(coatPreviewSvg)}`}
                      alt="Wappen Vorschau"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <Input
                      type="color"
                      value={coatPreset.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="h-7 p-1"
                    />
                    <Input
                      type="color"
                      value={coatPreset.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="h-7 p-1"
                    />
                    <Input
                      type="color"
                      value={coatPreset.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="h-7 p-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={coatPreset.pattern}
                      onChange={(e) => handlePatternChange(e.target.value)}
                      className="h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs"
                    >
                      <option value="solid">Voll</option>
                      <option value="split_vertical">Vertikal</option>
                      <option value="split_horizontal">Horizontal</option>
                      <option value="diagonal">Diagonal</option>
                      <option value="quarters">Vierteile</option>
                    </select>
                    <select
                      value={coatPreset.symbol}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      className="h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs"
                    >
                      <option value="cross">Kreuz</option>
                      <option value="star">Stern</option>
                      <option value="mountain">Berg</option>
                      <option value="tree">Baum</option>
                      <option value="wave">Welle</option>
                      <option value="gear">Zahnrad</option>
                      <option value="lion">Loewe</option>
                      <option value="eagle">Adler</option>
                      <option value="crown">Krone</option>
                      <option value="castle">Burg</option>
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => setCoatPreset(createRandomCoatOfArmsPreset())}
                    >
                      Zufall
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => onSaveCoatOfArms?.(coatPreviewSvg)}
                    >
                      Speichern
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onSaveCoatOfArms?.(null)}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}
        
        {!isNatureTile && (
        <>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Zone</span>
          <Badge variant={
            tile.zone === 'residential' ? 'default' :
            tile.zone === 'commercial' ? 'secondary' :
            tile.zone === 'industrial' ? 'outline' : 'secondary'
          } className={
            tile.zone === 'residential' ? 'bg-green-500/20 text-green-400' :
            tile.zone === 'commercial' ? 'bg-blue-500/20 text-blue-400' :
            tile.zone === 'industrial' ? 'bg-amber-500/20 text-amber-400' : ''
          }>
            {tile.zone === 'none' ? 'Unzoned' : tile.zone}
          </Badge>
        </div>
        {!isMansion && !isStandaloneBuilding && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Level</span>
            <span>{tile.building.level}/5</span>
          </div>
        )}
        {constructionInfo.isUnderConstruction && !(tile.building.upgradeStartedAt && tile.building.upgradeTargetLevel) && (
          <div className="space-y-1.5 rounded border border-slate-700/60 p-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Baufortschritt</span>
              <span className="font-mono">{constructionInfo.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
              <div
                className={`h-full transition-all ${
                  constructionInfo.progress >= 40 ? 'bg-amber-400' : 'bg-orange-500'
                }`}
                style={{ width: `${constructionInfo.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Phase</span>
              <span>{constructionInfo.phaseLabel} ({constructionInfo.phaseProgressPercent}%)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Restzeit</span>
              <span className="font-mono">
                {constructionInfo.remainingLabel} ({constructionInfo.remainingClock})
              </span>
            </div>
          </div>
        )}
        {/* ── Parking lot: Belegungsanzeige ───────────────────────────── */}
        {isParking && parkingInfo && (
          <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🅿️</span>
              <span className="font-semibold text-sm">Parkplatzbelegung</span>
            </div>

            {/* Slot-Übersicht */}
            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div className="rounded bg-slate-800/80 p-1.5">
                <div className="font-bold text-white text-base leading-none">{parkingInfo.totalSlots}</div>
                <div className="text-muted-foreground mt-0.5">Gesamt</div>
              </div>
              <div className="rounded bg-green-900/40 border border-green-700/40 p-1.5">
                <div className="font-bold text-green-400 text-base leading-none">{parkingInfo.free}</div>
                <div className="text-green-500/80 mt-0.5">Frei</div>
              </div>
              <div className="rounded bg-red-900/30 border border-red-700/30 p-1.5">
                <div className="font-bold text-red-400 text-base leading-none">{parkingInfo.occupied}</div>
                <div className="text-red-500/80 mt-0.5">Belegt</div>
              </div>
            </div>

            {/* Belegungsbalken */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Auslastung</span>
                <span className={
                  parkingInfo.pct >= 90 ? 'text-red-400' :
                  parkingInfo.pct >= 60 ? 'text-yellow-400' : 'text-green-400'
                }>{parkingInfo.pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    parkingInfo.pct >= 90 ? 'bg-red-500' :
                    parkingInfo.pct >= 60 ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                  style={{ width: `${parkingInfo.pct}%` }}
                />
              </div>
            </div>

            {/* Slot-Visualisierung (kleine Quadrate) */}
            <div className="flex flex-wrap gap-1 justify-center pt-0.5">
              {Array.from({ length: parkingInfo.totalSlots }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-3 rounded-sm border ${
                    i < parkingInfo.occupied
                      ? 'bg-red-500/60 border-red-500/80'
                      : 'bg-green-500/30 border-green-600/50'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Parking Config ─────────────────────────────────────────── */}
        {isParking && parkingCfg !== null && (
          <div className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>⚙️</span><span>Parkfeld-Einstellungen</span>
            </div>

            {/* Kostenlos / Gebührenpflichtig Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => { setParkingCfg(c => c ? { ...c, isFree: true } : c); setCfgDirty(true); }}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  parkingCfg.isFree ? 'bg-green-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >🆓 Kostenlos</button>
              <button
                onClick={() => { setParkingCfg(c => c ? { ...c, isFree: false } : c); setCfgDirty(true); }}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  !parkingCfg.isFree ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >💰 Gebührenpflichtig</button>
            </div>

            {/* Gebühren-Slider — nur wenn bezahlt */}
            {!parkingCfg.isFree && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gebühr pro Stunde</span>
                  <span className="font-mono text-white">CHF {parkingCfg.feeRate.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setParkingCfg(c => c ? { ...c, feeRate: Math.max(1, c.feeRate - 1) } : c); setCfgDirty(true); }}
                    className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 text-sm font-bold flex items-center justify-center"
                  >−</button>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(parkingCfg.feeRate / 20) * 100}%` }} />
                  </div>
                  <button
                    onClick={() => { setParkingCfg(c => c ? { ...c, feeRate: Math.min(20, c.feeRate + 1) } : c); setCfgDirty(true); }}
                    className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 text-sm font-bold flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            )}

            {cfgDirty && (
              <button
                onClick={() => {
                  if (parkingCfg) {
                    emitSetParkingConfig(tile.x, tile.y, parkingCfg.isFree, parkingCfg.feeRate);
                    setCfgDirty(false);
                  }
                }}
                className="w-full rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-1.5 font-medium transition-colors"
              >✓ Speichern</button>
            )}
          </div>
        )}

        {!isParking && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Population</span>
          <span>{isMansion ? 1 + tenants.length : tile.building.population}</span>
        </div>
        )}
        {!isMansion && !isParking && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jobs</span>
            <span>{tile.building.jobs}</span>
          </div>
        )}
        {(() => {
          // Belegungs-Anzeige: zeigt wie voll das Gebäude aktuell ist
          if (isMansion) return null; // Mansion: Bewohner-Logik separat
          if (isParking) return null; // Parking: eigene Belegungsanzeige oben
          const b = tile.building;
          if (b.constructionProgress < 100 || b.abandoned) return null;
          const lvl = Math.max(1, b.level || 1);
          // Maximale Kapazität (bei perfekten Bedingungen)
          const maxCapPop = (BUILDING_STATS[b.type]?.maxPop ?? 0) * 0.8 * lvl;
          const maxCapJobs = (BUILDING_STATS[b.type]?.maxJobs ?? 0) * 0.8 * lvl;
          if (maxCapPop <= 0 && maxCapJobs <= 0) return null;
          const pct = maxCapPop > 0
            ? Math.round((b.population / maxCapPop) * 100)
            : Math.round((b.jobs / maxCapJobs) * 100);
          const color = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';
          return (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auslastung</span>
              <span className={color}>{pct}%</span>
            </div>
          );
        })()}

        {(() => {
          // Gebäudezustand (condition) – nur für Wohn- und Gewerbegebäude
          const b = tile.building;
          if (b.constructionProgress < 100 || b.abandoned) return null;
          const maxPop = BUILDING_STATS[b.type]?.maxPop ?? 0;
          const maxJobs = BUILDING_STATS[b.type]?.maxJobs ?? 0;
          // Nur anzeigen wenn Wohngebäude (hat Pop-Kapazität) oder Gewerbegebäude (hat Job-Kapazität, kein Fabrik-Level-Pollution)
          const isResidential = maxPop > 0;
          const isCommercial = maxJobs > 0 && (BUILDING_STATS[b.type]?.pollution ?? 0) < 10;
          if (!isResidential && !isCommercial) return null;
          const condition = getCondition(x, y);
          if (condition === undefined || condition >= 100) return null;
          const condColor = condition > 80 ? 'bg-green-500'
            : condition > 60 ? 'bg-yellow-500'
            : condition > 40 ? 'bg-orange-500'
            : 'bg-red-500';
          const condTextColor = condition > 80 ? 'text-green-400'
            : condition > 60 ? 'text-yellow-400'
            : condition > 40 ? 'text-orange-400'
            : 'text-red-400';
          return (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Zustand</span>
                <span className={`text-xs font-mono ${condTextColor}`}>{Math.round(condition)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800">
                <div
                  className={`h-full transition-all ${condColor}`}
                  style={{ width: `${Math.round(condition)}%` }}
                />
              </div>
            </div>
          );
        })()}
        </>
        )}

        {!isNatureTile && (
        <>
        <Separator />

        {!tile.building.powered && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Strom</span>
            <Badge variant="destructive">Kein Strom</Badge>
          </div>
        )}
        {(() => {
          const wp  = Number((state.stats as any).water_production ?? 0);
          const wc  = Number((state.stats as any).water_consumption ?? 0);
          const wnd = Number((state.stats as any).water_net_deficit ?? 0);
          const isWatered = wp === 0
            ? false
            : wnd <= 0
              ? true
              : Math.abs(Math.sin(x * 127.1 + y * 311.7)) % 1 < (wp / Math.max(wp, wc));

          // Wasserverbrauch dieses Gebäudes schätzen (Anzeige-Zweck)
          const b = tile.building;
          const bType = String(b.type || '');
          const bPop  = Number(b.population ?? 0);
          const bJobs = Number(b.jobs ?? 0);
          let bWaterPerH = 0;
          if (bType === 'water_tower' || bType === 'water_reservoir') {
            bWaterPerH = 0;
          } else if (bType.startsWith('house') || bType.startsWith('apartment') || bType === 'mansion') {
            const flat = bType === 'apartment_high' || bType === 'mansion' ? 0.45
              : bType === 'apartment_low' ? 0.20 : 0.08;
            bWaterPerH = bPop * 0.006 + flat;
          } else if (bType.includes('office') || bType.includes('city_hall') || bType.includes('bank')) {
            bWaterPerH = bJobs * 0.003;
          } else if (bType.includes('shop') || bType.includes('mall') || bType.includes('restaurant') || bType.includes('market') || bType.includes('retail')) {
            bWaterPerH = bJobs * 0.008;
          } else if (tile.zone === 'industrial') {
            bWaterPerH = bJobs * 0.030;
          } else {
            const serviceFlat: Record<string, number> = {
              hospital: 8.0, school: 2.0, university: 4.0,
              police_station: 0.8, fire_station: 0.8,
              city_hall: 0.6, stadium: 3.0, museum: 0.5,
              park: 0.5, park_large: 1.5,
            };
            bWaterPerH = serviceFlat[bType] ?? 0;
          }
          // Adaptiver Display: < 1 m³/h → in L/h anzeigen (mehr Präzision)
          const bWaterDisplay = bWaterPerH >= 1
            ? `${Math.round(bWaterPerH * 10) / 10} m³/h`
            : `${Math.round(bWaterPerH * 1000)} L/h`;
          const bWaterRounded = bWaterPerH;

          return (
            <>
              {!isWatered && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Wasser</span>
                  <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Kein Wasser</Badge>
                </div>
              )}
              {bWaterRounded > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Wasserverbrauch</span>
                  <span className="text-xs text-cyan-300">{bWaterDisplay}</span>
                </div>
              )}
            </>
          );
        })()}
        </>
        )}

        {tile.building.type === 'water_reservoir' && (() => {
          const storageLevel = Number((state.stats as any).water_storage_level ?? 0);
          const storageCap   = Number((state.stats as any).water_storage_capacity ?? 2000);
          const fillPct      = storageCap > 0 ? storageLevel / storageCap * 100 : 0;
          const wp           = Number((state.stats as any).water_production ?? 0);
          const wc           = Number((state.stats as any).water_consumption ?? 0);
          const wnd          = Number((state.stats as any).water_net_deficit ?? 0);
          const rawBal       = wp - wc;
          const isDrawing    = rawBal < 0 && storageLevel > 0 && storageLevel < storageCap && wnd === 0;
          const isFilling    = rawBal > 0 && storageLevel < storageCap;
          const fillColor    = isDrawing ? 'bg-amber-500 animate-pulse' : fillPct >= 80 ? 'bg-cyan-500' : fillPct >= 40 ? 'bg-cyan-600' : 'bg-cyan-800';
          const fmtH = (h: number) => {
            if (h < 1/60) return '< 1 min';
            if (h < 1) return `${Math.round(h * 60)} min`;
            if (h > 48) return '> 2 Tage';
            const fh = Math.floor(h); const m = Math.round((h - fh) * 60);
            return m > 0 ? `${fh}h ${m}min` : `${fh}h`;
          };
          return (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Füllstand</span>
                  <span className="text-cyan-400 font-mono">{storageLevel.toLocaleString('de-CH', {maximumFractionDigits:0})} / {storageCap.toLocaleString('de-CH')} m³</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${Math.min(100, fillPct)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Kapazität {storageCap.toLocaleString('de-CH')} m³</span>
                  <span>{fillPct.toFixed(1)}% befüllt</span>
                </div>
                {isDrawing && (
                  <div className="flex justify-between text-[10px] text-amber-400 bg-amber-500/10 rounded px-1.5 py-1">
                    <span>↓ Entnahme: {Math.round(Math.abs(rawBal))} m³/h</span>
                    <span>leer in ~{fmtH(storageLevel / Math.abs(rawBal))}</span>
                  </div>
                )}
                {isFilling && (
                  <div className="flex justify-between text-[10px] text-cyan-400 bg-cyan-500/10 rounded px-1.5 py-1">
                    <span>↑ Befüllung: +{Math.round(rawBal)} m³/h</span>
                    {(storageCap - storageLevel) / rawBal < 48 && (
                      <span>voll in ~{fmtH((storageCap - storageLevel) / rawBal)}</span>
                    )}
                  </div>
                )}
                {!isDrawing && !isFilling && fillPct >= 100 && rawBal >= 0 && (
                  <div className="text-[10px] text-green-400 text-center">Voll · kein Verbrauch</div>
                )}
              </div>
            </>
          );
        })()}

        {tile.building.type === 'bus_station' && (
          <>
            <Separator />
            <BusStationSection
              municipalityName={municipalityName}
              isViewOnly={isViewOnly}
              onClose={onClose}
            />
          </>
        )}

        {/* === PROBLEME-BOX: Zeigt was fehlt, damit der Spieler reagieren kann === */}
        {(() => {
          const problems: { icon: string; text: string; hint: string; tool?: Tool; toolLabel?: string; cost?: number }[] = [];
          const isZoned = tile.zone !== 'none';
          const isBuilding = tile.building.type !== 'grass' && tile.building.type !== 'empty' && tile.building.type !== 'water';

          if (isBuilding && !tile.building.powered) {
            problems.push({ icon: '⚡', text: 'Kein Strom', hint: 'Zu wenig Strom im Netz – mehr Kraftwerke bauen oder bestehende ausbauen', tool: 'power_plant' as Tool, toolLabel: 'Kraftwerk', cost: TOOL_INFO['power_plant']?.cost });
          }
          const _wp  = Number((state.stats as any).water_production ?? 0);
          const _wc  = Number((state.stats as any).water_consumption ?? 0);
          const _wnd = Number((state.stats as any).water_net_deficit ?? 0);
          const _isWatered = _wp === 0
            ? false
            : _wnd === 0 ? true : Math.abs(Math.sin(x * 127.1 + y * 311.7)) % 1 < (_wc - _wnd) / _wc;
          if (isBuilding && !_isWatered) {
            problems.push({ icon: '💧', text: 'Kein Wasser', hint: 'Zu wenig Wasser im Netz – mehr Wassertürme bauen oder bestehende ausbauen', tool: 'water_tower' as Tool, toolLabel: 'Wasserturm', cost: TOOL_INFO['water_tower']?.cost });
          }
          if (isBuilding && tile.building.abandoned) {
            problems.push({ icon: '🏚️', text: 'Verlassen', hint: 'Nachfrage erhöhen oder Steuern senken' });
          }
          if (isBuilding && tile.building.onFire) {
            problems.push({ icon: '🔥', text: 'Brennt!', hint: 'Feuerwache in der Naehe bauen', tool: 'fire_station' as Tool, toolLabel: 'Feuerwache', cost: TOOL_INFO['fire_station']?.cost });
          }
          if (isZoned && isBuilding) {
            const demand = state.stats.demand;
            if (demand) {
              const zoneDemand = tile.zone === 'residential' ? demand.residential :
                tile.zone === 'commercial' ? demand.commercial :
                tile.zone === 'industrial' ? demand.industrial : 0;
              if (zoneDemand < -20) {
                const zoneToolMap: Record<string, { tool: Tool; label: string }> = {
                  residential: { tool: 'zone_commercial' as Tool, label: 'Gewerbe-Zone' },
                  commercial: { tool: 'zone_residential' as Tool, label: 'Wohn-Zone' },
                  industrial: { tool: 'zone_commercial' as Tool, label: 'Gewerbe-Zone' },
                };
                const zt = zoneToolMap[tile.zone];
                problems.push({
                  icon: '📉',
                  text: `Nachfrage niedrig (${Math.round(zoneDemand)})`,
                  hint: tile.zone === 'residential' ? 'Mehr Jobs schaffen (Commercial/Industrial Zonen)'
                    : tile.zone === 'commercial' ? 'Mehr Einwohner ansiedeln (Residential Zonen)'
                    : 'Nachfrage steigt mit wachsender Stadt',
                  tool: zt?.tool,
                  toolLabel: zt?.label,
                });
              }
            }
            // Service-Abdeckung pruefen
            const policeVal = services.police[y]?.[x] ?? 0;
            const fireVal = services.fire[y]?.[x] ?? 0;
            const healthVal = services.health[y]?.[x] ?? 0;
            const eduVal = services.education[y]?.[x] ?? 0;
            if (policeVal === 0) problems.push({ icon: '🚔', text: 'Keine Polizei', hint: 'Polizeistation in der Naehe bauen', tool: 'police_station' as Tool, toolLabel: 'Polizeistation', cost: TOOL_INFO['police_station']?.cost });
            if (fireVal === 0) problems.push({ icon: '🚒', text: 'Kein Brandschutz', hint: 'Feuerwache in der Naehe bauen', tool: 'fire_station' as Tool, toolLabel: 'Feuerwache', cost: TOOL_INFO['fire_station']?.cost });
            if (healthVal === 0) problems.push({ icon: '🏥', text: 'Keine Gesundheit', hint: 'Krankenhaus in der Naehe bauen', tool: 'hospital' as Tool, toolLabel: 'Krankenhaus', cost: TOOL_INFO['hospital']?.cost });
            if (eduVal === 0) problems.push({ icon: '🎓', text: 'Keine Bildung', hint: 'Schule/Uni in der Naehe bauen', tool: 'school' as Tool, toolLabel: 'Schule', cost: TOOL_INFO['school']?.cost });
          }
          if (tile.pollution > 60) {
            problems.push({
              icon: '☁️',
              text: `Hohe Verschmutzung (${Math.min(100, Math.round(tile.pollution / 3))}%)`,
              hint: 'Parks, Bäume & Grünanlagen in der Nähe bauen',
            });
          }

          if (problems.length > 0) {
            return (
              <>
                <div className="rounded border border-red-500/30 bg-red-500/5">
                  <button
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                    onClick={() => setProblemsOpen(o => !o)}
                  >
                    <span>⚠ Probleme ({problems.length})</span>
                    <span className="text-[10px] text-red-500/70">{problemsOpen ? '▲' : '▼'}</span>
                  </button>
                  {problemsOpen && <div className="space-y-1.5 px-2 pb-2">
                  {problems.map((p, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{p.icon}</span>
                        <span className="text-red-300 font-medium">{p.text}</span>
                      </div>
                      {/* Tool-Button */}
                      {p.tool && (
                        <div className="ml-5 flex flex-col gap-1">
                          <span className="text-muted-foreground">{p.hint}</span>
                          <button
                            className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition-colors text-[10px] font-medium"
                            onClick={() => {
                              setTool(p.tool!);
                              onClose();
                            }}
                          >
                            {p.toolLabel}{p.cost != null ? ` (Fr. ${p.cost})` : ''}
                          </button>
                        </div>
                      )}
                      {/* Kein Tool (nur Hinweis) */}
                      {!p.tool && (
                        <div className="ml-5">
                          <span className="text-muted-foreground">{p.hint}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>}
                </div>
              </>
            );
          }

          // Alles OK
          if (isBuilding && isZoned) {
            return (
              <div className="rounded border border-green-500/30 bg-green-500/5 p-2">
                <div className="text-xs text-green-400 flex items-center gap-1.5">
                  <span>✅</span>
                  <span>Alles in Ordnung — keine Probleme</span>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* === Aktionsbuttons: Reparieren & Abreissen === */}
        {!isViewOnly && (() => {
          const isAbandoned = tile.building.abandoned;
          const isOnFire = tile.building.onFire;
          const isBuildingOnTile = tile.building.type !== 'grass' && tile.building.type !== 'water' && tile.building.type !== 'road' && tile.building.type !== 'rail' && tile.building.type !== 'bridge';
          const isZonedTile = tile.zone !== 'none';
          if (!isBuildingOnTile && !isZonedTile) return null;

          const buildingType = tile.building.type;
          const toolInfo = TOOL_INFO[buildingType as keyof typeof TOOL_INFO];
          const repairCost = Math.round((toolInfo?.cost || 100) * 0.5);
          const canAffordRepair = state.stats.money >= repairCost;

          const botActive = getHasWerkhofNpc();
          return (
            <div className="flex flex-col gap-2">
              {/* Bot-Hinweis wenn Patrol-NPC aktiv und Gebäude beschädigt */}
              {(isAbandoned || isOnFire) && botActive && (
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                  <span className="text-sm">🤖</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-amber-300">Wird vom Bot repariert</span>
                    <span className="text-[10px] text-amber-400/70">Stadtpatrouille · alle ~10 Min</span>
                  </div>
                </div>
              )}
              {/* Reparieren-Button: nur bei verlassenen oder brennenden Gebäuden */}
              {(isAbandoned || isOnFire) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs border-green-500/40 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                  disabled={!canAffordRepair}
                  onClick={() => {
                    const success = repairAtTile(x, y);
                    if (!success) {
                      // Nicht genug Geld oder Reparatur fehlgeschlagen
                    }
                  }}
                >
                  🔧 Selbst reparieren (${repairCost})
                </Button>
              )}
            </div>
          );
        })()}

        {(() => {
          const bType = tile.building.type as string;
          const bLevel = Math.max(1, tile.building.level || 1);
          const bPop = tile.building.population || 0;
          const bJobs = tile.building.jobs || 0;
          const lvlF = 1 + (bLevel - 1) * 0.3;
          // Baustelle: constructionProgress < 100 ODER upgradeStartedAt gesetzt
          const constructionPct = tile.building.constructionProgress ?? 100;
          const isUnderConstruction = constructionPct < 100 || !!tile.building.upgradeStartedAt;
          // Energie-Produktion — Werte synchron mit Server (stats.js POWER_PLANT_OUTPUT)
          const POWER_PLANT_OUT: Record<number, number> = { 1: 80, 2: 180, 3: 350, 4: 620, 5: 1000 };
          // Basis-Stromverbrauch für Service-Gebäude (synchron mit constants.js)
          const SERVICE_CONS: Record<string, number> = {
            police_station: 3, fire_station: 3, hospital: 8, school: 2, university: 6,
            city_hall: 4, stadium: 12, airport: 20, space_program: 25, amusement_park: 10,
            subway_station: 3, rail_station: 3, water_tower: 2, power_plant: 5,
            bus_station: 2, museum: 3,
          };
          let prod = 0;
          let cons = 0;
          if (isUnderConstruction) {
            // Kraftwerk/Solar/Wind im Bau: kein Strom, aber Baustelle verbraucht
            const isPowerBuilder = bType.includes('power_plant') || bType.includes('solar_panel') || bType.includes('wind_turbine');
            if (isPowerBuilder) {
              const consBase = SERVICE_CONS[bType] ?? 5;
              cons = Math.round(consBase * bLevel * 2); // identisch mit stats.js-Formel
            } else {
              return null; // andere Gebäude im Bau: keine Strom-Zeile
            }
          } else {
            // Server-Werte bevorzugen (aus game_item_details via /api/game/item-details)
            const _serverDetail = serverItemDetails.get(bType);
            const _serverProd = _serverDetail ? Number(_serverDetail.power_production ?? 0) : 0;
            if (bType.includes('solar_panel')) {
              // Dynamisch: Tageszeit + Jahreszeit + Wetter (identisch mit stats.js)
              const base = 2; // Fixe Basis — DB-Cache könnte veralteten Wert haben
              const _hour = state.hour ?? 12;
              const _month = state.month ?? 6;
              const _isWinter = [12, 1, 2].includes(_month);
              const _isSummer = [6, 7, 8].includes(_month);
              const _nightStart   = _isWinter ? 17 : _isSummer ? 21 : 20;
              const _morningStart = _isWinter ? 8  : _isSummer ? 5  : 6;
              const _solarTimeFactor =
                (_hour < _morningStart || _hour >= _nightStart)        ? 0.0
                : (_hour < _morningStart+2 || _hour >= _nightStart-2)  ? 0.25
                : (_hour < _morningStart+4 || _hour >= _nightStart-4)  ? 0.65
                : 1.0;
              const _wt = state.weatherType || 'clear';
              const _weatherFactor = _wt === 'clear' ? 1.5
                : _wt === 'fog' ? 0.5
                : ['drizzle', 'rain'].includes(_wt) ? 0.3
                : ['snow', 'blizzard', 'storm', 'thunderstorm'].includes(_wt) ? 0.1
                : 1.0;
              const _seasonFactor = _isWinter ? 0.65 : _isSummer ? 1.20 : 1.0;
              const _dynFactor = _solarTimeFactor * _weatherFactor * _seasonFactor;
              prod = Math.min(3, Math.round(base * bLevel * _dynFactor));
            } else if (bType.includes('wind_turbine')) {
              // Basis vom Server, cap 8 MW
              const base = 3; // Fixe Basis
              prod = Math.min(8, base * bLevel);
            } else if (bType.includes('power_plant')) {
              prod = POWER_PLANT_OUT[Math.min(5, bLevel)] || 80;
            }
            const isPowerProducer = bType.includes('power_plant') || bType.includes('solar_panel') || bType.includes('wind_turbine') || bType.includes('water_reservoir');
            if (isPowerProducer) {
              cons = 0; // Stromerzeuger / Infrastruktur verbrauchen keinen Strom (Jobs zählen nicht als Last)
            } else if (bType.includes('apartment')) {
              cons = Math.max(1, Math.round(bPop * 0.03 * lvlF));
            } else if (bPop > 0) {
              cons = Math.max(1, Math.round(bPop * 0.08 * lvlF));
            } else if (bJobs > 0) {
              const isIndustrial = bType.includes('factory') || bType.includes('warehouse');
              cons = Math.max(1, Math.round(bJobs * (isIndustrial ? 0.025 : 0.015) * lvlF));
            } else if (SERVICE_CONS[bType]) {
              cons = Math.round(SERVICE_CONS[bType] * bLevel);
            }
          }
          const noEnergy = prod === 0 && cons === 0;
          if (noEnergy) return null;
          return (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Strom</span>
              <span className="flex gap-2">
                {isUnderConstruction && <span className="text-zinc-400 text-xs self-center">Baustelle</span>}
                {prod > 0 && <span className="text-emerald-400">+{prod} MW</span>}
                {cons > 0 && <span className="text-orange-400">-{cons} MW</span>}
              </span>
            </div>
          );
        })()}
        {/* === Autobahn Richtung === */}
        {tile.building.type === 'autobahn' && !isViewOnly && (() => {
          const currentDir = tile.building.autobahnDirection;
          const gx = tile.x;
          const gy = tile.y;
          // Always show all 4 directions so every tile (including corners) can be selected
          const dirOptions: { dir: 'north' | 'south' | 'east' | 'west'; label: string }[] = [
            { dir: 'north', label: '↑' }, { dir: 'south', label: '↓' },
            { dir: 'east', label: '→' }, { dir: 'west', label: '←' },
          ];
          return (
            <div className="flex flex-col gap-1 mb-2">
              <span className="text-xs text-gray-400">Verkehrsrichtung</span>
              <div className="flex gap-1">
                {dirOptions.map(({ dir, label }) => (
                  <button
                    key={dir}
                    onClick={() => setAutobahnDirection(gx, gy, currentDir === dir ? null : dir)}
                    className={`px-3 py-1.5 text-sm font-bold rounded border transition-colors ${
                      currentDir === dir
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {currentDir && (
                  <button
                    onClick={() => setAutobahnDirection(gx, gy, null)}
                    className="px-2 py-1.5 text-xs rounded border bg-gray-800 border-gray-600 text-gray-400 hover:bg-red-900/50 hover:border-red-500/50"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bodenwert</span>
          <span>${tile.landValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Verschmutzung</span>
          <span className={tile.pollution > 150 ? 'text-red-400' : tile.pollution > 75 ? 'text-amber-400' : 'text-green-400'}>
            {Math.min(100, Math.round(tile.pollution / 3))}%
          </span>
        </div>
        {(tile.elevation ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Elevation</span>
            <Badge variant="outline" className="bg-amber-500/20 text-amber-400">
              {tile.elevation! <= 2 ? `⛰ ${tile.elevation}` : tile.elevation! <= 4 ? `🏔 ${tile.elevation}` : `🗻 ${tile.elevation}`}
            </Badge>
          </div>
        )}
        {tile.paintColor && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Farbe</span>
            <Badge variant="outline" className="capitalize">
              🎨 {tile.paintColor === 'dark_grass' ? 'Dunkles Gras' : tile.paintColor === 'green' ? 'Grün' : tile.paintColor === 'sand' ? 'Sand' : tile.paintColor === 'dirt' ? 'Erde' : tile.paintColor === 'snow' ? 'Schnee' : tile.paintColor === 'rock' ? 'Fels' : tile.paintColor}
            </Badge>
          </div>
        )}
        
        {tile.building.onFire && (
          <>
            <Separator />
            <div className="flex justify-between text-red-400">
              <span>ON FIRE!</span>
              <span>{Math.round(tile.building.fireProgress)}% damage</span>
            </div>
          </>
        )}
        
        {/* === HOLZFÄLLER-HAUS PLANTAGEN-INFO === */}
        {tile.building.type === 'woodcutter_house' && (() => {
          const workers = tile.building.level || 1;
          const maxWorkers = 4;
          const cfgMap: Record<number, { maxTrees: number; radius: number }> = {
            1: { maxTrees: 6,  radius: 4 },
            2: { maxTrees: 9,  radius: 5 },
            3: { maxTrees: 12, radius: 5 },
            4: { maxTrees: 16, radius: 6 },
          };
          const cfg = cfgMap[Math.min(workers, 4)] || cfgMap[1];
          const canAddWorker = workers < maxWorkers;
          const workerCost = 200;
          const canAffordWorker = canAddWorker && state.stats.money >= workerCost;
          const isBuilding = tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100;

          return (
            <>
              <Separator />
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Holzfäller-Plantage</div>
              <div className="space-y-1.5 text-xs">
                {/* Arbeiter-Anzeige als Punkte */}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Arbeiter</span>
                  <div className="flex gap-1 items-center">
                    {Array.from({ length: maxWorkers }).map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full border ${
                        i < workers
                          ? 'bg-amber-500 border-amber-400'
                          : 'bg-slate-700 border-slate-600'
                      }`} />
                    ))}
                    <span className="font-mono ml-1 text-foreground">{workers}/{maxWorkers}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phase</span>
                  <Badge variant="outline" className={
                    tile.building.plantationPhase === 'planting' ? 'bg-green-500/20 text-green-400' :
                    tile.building.plantationPhase === 'growing' ? 'bg-blue-500/20 text-blue-400' :
                    tile.building.plantationPhase === 'harvesting' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-500/20 text-slate-400'
                  }>
                    {tile.building.plantationPhase === 'planting' ? '🌱 Pflanzen' :
                     tile.building.plantationPhase === 'growing' ? '🌿 Wachsen' :
                     tile.building.plantationPhase === 'harvesting' ? '🪓 Ernten' : '⏳ Warten'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ernten gesamt</span>
                  <span className="font-mono text-green-400">{tile.building.plantationHarvests || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max. Bäume</span>
                  <span className="font-mono">{cfg.maxTrees}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geld pro Ernte</span>
                  <span className="font-mono text-yellow-400">$50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Radius</span>
                  <span className="font-mono">{cfg.radius} Tiles</span>
                </div>
              </div>

              {/* Arbeiter hinzufügen */}
              {canAddWorker && !isBuilding && !isViewOnly && (
                <div className="mt-2 space-y-1">
                  <Button
                    onClick={() => upgradeServiceBuilding(x, y)}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={!canAffordWorker}
                    className="w-full"
                    size="sm"
                    variant="outline"
                  >
                    Arbeiter hinzufügen (${workerCost})
                  </Button>
                  {!canAffordWorker && (
                    <p className="text-[10px] text-muted-foreground text-center">Nicht genug Geld</p>
                  )}
                </div>
              )}
              {workers >= maxWorkers && (
                <p className="text-[10px] text-green-400 text-center mt-1">Alle 4 Arbeiter aktiv</p>
              )}
            </>
          );
        })()}
        
        {!isNatureTile && (
        <>
        <Separator />
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Service Coverage</div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Police</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fire</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Education</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
        </>
        )}
        
        {upgradeInfo && tile.building.type !== 'woodcutter_house' && !isViewOnly && (
          <>
            <Separator />
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Upgrade</div>
            <div className="space-y-2">
              {/* Upgrade läuft gerade */}
              {upgradeInfo.isUpgrading && (
                <>
                  <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-medium">
                        Upgrade auf Level {upgradeInfo.upgradeTargetLevel}
                      </span>
                      <span className="text-amber-400 font-mono text-[10px]">
                        {Math.round(upgradeInfo.upgradeProgress)}%
                      </span>
                    </div>
                    {/* Fortschrittsbalken */}
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, upgradeInfo.upgradeProgress)}%` }}
                      />
                    </div>
                    {/* Verbleibende Zeit */}
                    <div className="text-[10px] text-muted-foreground text-center">
                      {(() => {
                        const s = Math.round(upgradeInfo.upgradeRemainingSeconds);
                        if (s <= 0) return 'Gleich fertig...';
                        const days = Math.floor(s / 86400);
                        const hours = Math.floor((s % 86400) / 3600);
                        const mins = Math.floor((s % 3600) / 60);
                        const parts: string[] = [];
                        if (days > 0) parts.push(`${days}d`);
                        if (hours > 0) parts.push(`${hours}h`);
                        if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
                        return `Noch ${parts.join(' ')}`;
                      })()}
                    </div>
                  </div>
                </>
              )}
              {/* Neues Upgrade starten */}
              {!upgradeInfo.isUpgrading && upgradeInfo.canUpgradeNext && (
                <>
                  {upgradeInfo.baseRange > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Reichweite</span>
                    <span className="font-mono">
                      {upgradeInfo.currentEffectiveRange} → {upgradeInfo.nextEffectiveRange} Tiles
                    </span>
                  </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Kosten</span>
                    <span className={`font-mono ${upgradeInfo.canAfford ? 'text-foreground' : 'text-red-400'}`}>
                      Fr. {upgradeInfo.cost.toLocaleString('de-CH')}
                    </span>
                  </div>
                  {upgradeInfo.nextUpgradeSeconds > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Bauzeit</span>
                      <span className="font-mono text-amber-400">
                        {(() => {
                          const s = upgradeInfo.nextUpgradeSeconds;
                          const days = Math.floor(s / 86400);
                          const hours = Math.floor((s % 86400) / 3600);
                          const mins = Math.floor((s % 3600) / 60);
                          const parts: string[] = [];
                          if (days > 0) parts.push(`${days}d`);
                          if (hours > 0) parts.push(`${hours}h`);
                          if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
                          return parts.join(' ');
                        })()}
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={handleUpgrade}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={!upgradeInfo.canAfford || upgradeInfo.isInitialConstruction || upgradeInfo.isAbandoned}
                    className="w-full"
                    size="sm"
                  >
                    Upgrade auf Level {upgradeInfo.currentLevel + 1}
                  </Button>
                  {!upgradeInfo.canAfford && (
                    <p className="text-xs text-muted-foreground text-center">
                      Nicht genug Geld
                    </p>
                  )}
                  {upgradeInfo.isInitialConstruction && (
                    <p className="text-xs text-muted-foreground text-center">
                      Gebäude wird noch gebaut
                    </p>
                  )}
                  {upgradeInfo.isAbandoned && (
                    <p className="text-xs text-muted-foreground text-center">
                      Gebäude ist verlassen
                    </p>
                  )}
                </>
              )}
              {/* Max Level erreicht */}
              {!upgradeInfo.isUpgrading && !upgradeInfo.canUpgradeNext && upgradeInfo.currentLevel >= upgradeInfo.maxLevel && (
                <p className="text-xs text-green-400 text-center">
                  Max Level erreicht
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>

    {showVillaPicker && municipalitySlug && (
      <VillaPickerModal
        municipalitySlug={municipalitySlug}
        currentVariantRow={residence?.mansion_variant_row ?? null}
        currentVariantCol={residence?.mansion_variant_col ?? null}
        userRank={myUserRank}
        onUpgrade={async (row, col) => { await upgradeVilla(row, col); }}
        onClose={() => setShowVillaPicker(false)}
      />
    )}
  </>
  );
}
