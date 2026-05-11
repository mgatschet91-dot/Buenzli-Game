'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { msg, useMessages, useGT } from 'gt-next';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Handshake, MapPin, TrendingUp, Link2, CircleDashed, Coins, Clock, Calendar,
  Search, Send, Users, CheckCircle, XCircle, ArrowLeft, Loader2, Eye, ChevronsUp,
  Factory, Zap, HeartHandshake, PartyPopper, PersonStanding, BarChart3, AlertTriangle
} from 'lucide-react';
import { findEdgeRoadInDirection } from '@/components/game/gridFinders';
import * as partnershipApi from '@/lib/api/partnershipApi';
import type { Partnership, ActionCooldowns, ExportCapacity } from '@/lib/api/partnershipApi';

// Translatable UI labels
const UI_LABELS = {
  // Panel header
  tradePartners:           msg('Trade Partners'),
  searchMunicipalities:    msg('Search Municipalities'),
  // Tabs
  tabPartner:              msg('Partner'),
  tabBilanz:               'Handelsbilanz',
  // Status
  discovered:              'Entdeckt',
  connected:               'Verbunden',
  unknown:                 'Unbekannt',
  loading:                 'Laden...',
  // Stats cards
  connectedDiscovered:     'Verbunden / Entdeckt',
  chfPerDay:               'CHF / Tag gesamt',
  chfInvested:             'CHF investiert',
  highestTier:             'Höchste Stufe',
  totalEarned:             'Gesamt verdient seit Verbindung',
  // Incoming requests
  incomingRequest:         'eingehende Anfrage',
  incomingRequests:        'eingehende Anfragen',
  noOwner:                 'Noch kein Besitzer',
  accept:                  'Annehmen',
  decline:                 'Ablehnen',
  // Partner list
  noPartnersYet:           'Noch keine Handelspartner',
  buildRoadsToDiscover:    'Baue Strassen bis zum Rand deiner Stadt, um Nachbargemeinden zu entdecken!',
  connectedDays:           'Tage verbunden',
  totalTradeIncome:        'Gesamtes Handelseinkommen',
  perDay:                  '/Tag',
  // Tier names
  tierKnown:               'Bekannt',
  tierFriendly:            'Freundschaftlich',
  tierStrategic:           'Strategisch',
  tierAllied:              'Alliiert',
  // Tier progress
  tierReady:               'Bereit!',
  // Diplomatic actions
  diplomaticActions:       'Diplomatische Aktionen',
  actionEmergencyAid:      'Nothilfe',
  actionEmergencyAidDesc:  '+5k CHF an Partner',
  actionCityFestival:      'Stadtfest',
  actionCityFestivalDesc:  '+Zufriedenheit 24h',
  actionLaborMigration:    'Arbeitsmigration',
  actionLaborMigDesc:      '+50 Einwohner',
  cooldownDaysLeft:        'Abkühlung übrig',
  loadingCooldowns:        'Abkühlzeiten laden…',
  // Export capacity
  exportCapacity:          'Exportkapazität',
  slots:                   'Stellplätze',
  multiplier:              'Multiplikator',
  noFactories:             'Keine Fabriken',
  lowIndustry:             'Wenig Industrie',
  goodIndustry:            'Gute Industrie',
  fullCapacity:            'Volle Kapazität',
  noPartnerYet:            'Noch kein Partner verbunden',
  perPartnership:          'Pro Partnerschaft',
  noConnectedPartners:     'Noch keine verbundenen Partner',
  totalEarnedLabel:        'gesamt',
  investedLabel:           'investiert',
  // Handelsbilanz
  totalEarnedBilanz:       'CHF gesamt verdient',
  chfInvestedBilanz:       'CHF investiert',
  // Search
  searchPlaceholder:       'Nach Name suchen...',
  sendRequest:             'Anfrage senden',
  requestPending:          'Ausstehend',
  alreadyPartner:          'Bereits Partner',
  noResults:               'Keine Gemeinden gefunden',
  capital:                 'Hauptort',
  population:              'Einwohner',
  // Visit
  visitTooltip:            'Diese Gemeinde als Gast besuchen',
  // Notification strings (inside handlers)
  notifRequestSent:        'Anfrage gesendet',
  notifRequestSentDesc:    'Partnerschaftsanfrage an {city} gesendet',
  notifRequestError:       'Fehler',
  notifRequestSendFailed:  'Anfrage konnte nicht gesendet werden: {reason}',
  notifInvestOk:           'Investition erfolgreich',
  notifInvestOkDesc:       '{amount} CHF in Partnerschaft mit {city} investiert',
  notifInvestFail:         'Investition fehlgeschlagen',
  notifPartnershipAccepted: 'Partnerschaft angenommen!',
  notifPartnershipActiveIncome: '+{income} CHF/Tag ab sofort.',
  notifPartnershipActive:  'Neue Partnerschaft aktiv.',
  notifRequestDeclined:    'Anfrage abgelehnt',
  notifRequestDeclinedDesc: 'Die Partnerschaftsanfrage wurde abgelehnt.',
  notifRespondFailed:      'Anfrage konnte nicht {action} werden.',
  // Directions
  north:                   'Norden',
  south:                   'Süden',
  east:                    'Osten',
  west:                    'Westen',
  // Dynamic format strings (verwendet mit .replace())
  connectedDaysFormat:     '{days}T verbunden',
  multiplierFormat:        'Multiplikator: ×{value}',
  cooldownFormat:          '{days}T Abkühlung übrig',
  chfDayPartner:           '+{income} CHF/Tag',
  // Accept / decline buttons
  yes:                     'Ja',
  no:                      'Nein',
  // CHF/day unit
  chfDayUnit:              'CHF/Tag',
  // Invest
  investButton:            'Investieren',
  investPlaceholder:       'CHF investieren',
  // Notification labels for diplomatic actions
  notifEmergencyAidSent:   'Nothilfe gesendet',
  notifCityFestivalSent:   'Stadtfest gestartet',
  notifLaborMigSent:       'Arbeitsmigration eingeleitet',
  notifActionDone:         'Aktion ausgeführt',
  notifActionFor:          'Aktion ausgeführt für {city}',
  // "ready" check mark
  tierReadyCheck:          'Bereit! ✓',
  // Diplomatic action title tooltip
  diplomaticActionsTooltip: 'Diplomatische Aktionen',
  // Bilanz
  bilanzInvestedShort:     'inv.',
  // Incoming owner
  noOwnerShort:            'Kein Besitzer',
  // Capital badge
  capitalBadge:            'Hauptort',
  // Road warning
  noRoadWarning:           'Keine Strasse nach {dir} — Einkommen pausiert',
};

// Berechne die Dauer seit einem Datum (locale-aware via Intl)
function getConnectionDuration(connectedAt: string | null): string {
  if (!connectedAt) return '—';

  const connected = new Date(connectedAt);
  const now = new Date();
  const diffMs = now.getTime() - connected.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const fmt = (value: number, unit: Intl.NumberFormatOptions['unit']) =>
    new Intl.NumberFormat(undefined, { style: 'unit', unit, unitDisplay: 'long' }).format(value);

  if (diffDays < 30) return fmt(diffDays, 'day');
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return fmt(diffMonths, 'month');
  return fmt(Math.floor(diffMonths / 12), 'year');
}

// Berechne das nächste Auszahlungsdatum für einen Partner (monatlich ab Verbindungsdatum)
function getNextPayoutForPartner(connectedAt: string | null): { date: string; daysUntil: number } | null {
  if (!connectedAt) return null;
  
  const connected = new Date(connectedAt);
  const now = new Date();
  
  // Nächste Auszahlung ist am gleichen Tag des Monats wie die Verbindung
  const payoutDay = connected.getDate();
  
  // Berechne das nächste Auszahlungsdatum
  let nextPayout = new Date(now.getFullYear(), now.getMonth(), payoutDay);
  
  // Wenn das Datum in diesem Monat schon vorbei ist, nimm nächsten Monat
  if (nextPayout <= now) {
    nextPayout = new Date(now.getFullYear(), now.getMonth() + 1, payoutDay);
  }
  
  const diffMs = nextPayout.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short'
  });
  
  return {
    date: formatter.format(nextPayout),
    daysUntil,
  };
}

// Richtungs-Übersetzungen
// Richtungs-Icons
const DIRECTION_ICONS: Record<string, string> = {
  north: '⬆️',
  south: '⬇️',
  east: '➡️',
  west: '⬅️',
};

// View-Modus für das Panel
type ViewMode = 'partners' | 'search';

interface TradePanelProps {
  onVisitMunicipality?: (slug: string, roomCode?: string) => void;
}

export function TradePanel({ onVisitMunicipality }: TradePanelProps) {
  const { state, setActivePanel, municipalitySlug, addNotification, addMoney } = useGame();
  const multiplayer = useMultiplayerOptional();
  const isGuestMode = multiplayer?.isViewOnly ?? false;
  const { adjacentCities, tradeIncome } = state;
  const m = useMessages();
  const gt = useGT();
  const router = useRouter();

  // Lokalisierte Lookup-Maps (innerhalb der Komponente damit m() verfügbar ist)
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;
  const TIER_NAMES: Record<number, string> = {
    1: UI_LABELS.tierKnown,
    2: UI_LABELS.tierFriendly,
    3: UI_LABELS.tierStrategic,
    4: UI_LABELS.tierAllied,
  };
  // Tier color classes (kein Emoji — pixel-font-safe)
  const TIER_COLORS: Record<number, string> = { 1: 'text-slate-300 bg-slate-700', 2: 'text-blue-300 bg-blue-900/40', 3: 'text-purple-300 bg-purple-900/40', 4: 'text-amber-300 bg-amber-900/40' };
  const DIR_LABELS: Record<string, string> = {
    north: UI_LABELS.north,
    south: UI_LABELS.south,
    east:  UI_LABELS.east,
    west:  UI_LABELS.west,
  };
  const DIPLOMATIC_LABELS: Record<string, { label: string; desc: string }> = {
    emergency_aid:   { label: UI_LABELS.actionEmergencyAid, desc: UI_LABELS.actionEmergencyAidDesc },
    city_festival:   { label: UI_LABELS.actionCityFestival, desc: UI_LABELS.actionCityFestivalDesc },
    labor_migration: { label: UI_LABELS.actionLaborMigration, desc: UI_LABELS.actionLaborMigDesc },
  };
  const [isLoading, setIsLoading] = useState(false);
  const [apiPartnerships, setApiPartnerships] = useState<partnershipApi.Partnership[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('partners');
  
  // Such-State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMunicipalities, setSearchMunicipalities] = useState<partnershipApi.SearchMunicipality[]>([]);
  const [isLoadingCanton, setIsLoadingCanton] = useState(false);
  const [outgoingRequests, setOutgoingRequests] = useState<partnershipApi.PartnershipRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<partnershipApi.PartnershipRequest[]>([]);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [respondingRequest, setRespondingRequest] = useState<number | null>(null);
  
  // Ref um vorherige Partnerschaften zu tracken (für Benachrichtigungen bei neuen Partnern)
  const prevPartnerSlugsRef = useRef<Set<string>>(new Set());

  // Invest-State
  const [investingSlug, setInvestingSlug] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState<Record<string, string>>({});

  // Phase 2 State
  const [partnerTab, setPartnerTab] = useState<'list' | 'bilanz'>('list');
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [actionCooldowns, setActionCooldowns] = useState<Record<string, ActionCooldowns>>({});
  const [executingAction, setExecutingAction] = useState<string | null>(null); // `${slug}_${actionType}`
  const [exportCapacity, setExportCapacity] = useState<ExportCapacity | null>(null);

  // ── Randstrassen-Prüfung ────────────────────────────────────────────────────
  // Prüft für jede Himmelsrichtung ob eine Strasse am Kartenrand existiert.
  const roadStatusMap = useMemo((): Record<string, boolean> => {
    const grid = state.grid;
    const gridSize = (state as { gridSize?: number }).gridSize;
    if (!grid || !gridSize) return {};
    return {
      north: findEdgeRoadInDirection(grid, gridSize, 'north') !== null,
      south: findEdgeRoadInDirection(grid, gridSize, 'south') !== null,
      east:  findEdgeRoadInDirection(grid, gridSize, 'east')  !== null,
      west:  findEdgeRoadInDirection(grid, gridSize, 'west')  !== null,
    };
  }, [state.grid, (state as { gridSize?: number }).gridSize]);

  // Server-Sync: Strassenstatus bei Änderungen melden
  const prevRoadSyncRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!municipalitySlug || isGuestMode) return;
    const connectedPartners = apiPartnerships.filter(p => p.status === 'connected');
    for (const p of connectedPartners) {
      const dir = (p.direction || 'north') as string;
      const hasRoad = roadStatusMap[dir] ?? true;
      if (prevRoadSyncRef.current[p.partner.slug] !== hasRoad) {
        prevRoadSyncRef.current[p.partner.slug] = hasRoad;
        partnershipApi.updateRoadStatus(municipalitySlug, p.partner.slug, hasRoad).catch(() => {});
      }
    }
  }, [roadStatusMap, apiPartnerships, municipalitySlug, isGuestMode]);

  // Hilfsfunktion um connected_at für eine Stadt zu finden
  const getConnectedAt = (cityName: string): string | null => {
    const partnership = apiPartnerships.find(
      p => p.partner.name === cityName || p.partner.slug === cityName.toLowerCase().replace(/\s+/g, '-')
    );
    return partnership?.connected_at || null;
  };

  // Lade Partnerschaften von der API beim Öffnen (nicht im Guest-Mode)
  useEffect(() => {
    // Im Guest-Mode keine Partnerschaften laden
    if (isGuestMode) return;
    
    async function loadPartnerships() {
      if (!municipalitySlug) return;
      
      setIsLoading(true);
      try {
        const response = await partnershipApi.getPartnerships(municipalitySlug);
        if (response.success) {
          const newPartnerships = response.data.partnerships;
          
          // Prüfe auf neue Partnerschaften (für Benachrichtigungen)
          const currentSlugs = new Set(newPartnerships.map(p => p.partner.slug));
          const prevSlugs = prevPartnerSlugsRef.current;
          
          // Finde neue Partner (die vorher nicht da waren)
          if (prevSlugs.size > 0) {
            newPartnerships.forEach(p => {
              if (!prevSlugs.has(p.partner.slug) && p.status === 'connected') {
                // Neue Partnerschaft wurde akzeptiert!
                addMoney(5000); // Bonus gutschreiben
                addNotification(
                  UI_LABELS.notifPartnershipAccepted,
                  UI_LABELS.notifRequestSentDesc.replace('{city}', p.partner.name ),
                  'partnership'
                );
              }
            });
          }
          
          // Update ref für nächsten Vergleich
          prevPartnerSlugsRef.current = currentSlugs;
          
          setApiPartnerships(newPartnerships);
        }
        
        // Lade ausgehende + eingehende Anfragen
        try {
          const requestsResponse = await partnershipApi.getPartnershipRequests(municipalitySlug);
          if (requestsResponse.success) {
            setOutgoingRequests(requestsResponse.data.outgoing);
            setIncomingRequests(requestsResponse.data.incoming.filter(r => r.status === 'pending'));
          }
        } catch {
          // API-Endpunkt existiert noch nicht - still ignorieren
        }
      } catch (error) {
        console.error('Fehler beim Laden der Partnerschaften:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadPartnerships();
  }, [municipalitySlug, isGuestMode]);

  // Export-Kapazität laden
  useEffect(() => {
    if (isGuestMode || !municipalitySlug) return;
    partnershipApi.getExportCapacity(municipalitySlug)
      .then(res => { if (res.success) setExportCapacity(res.data); })
      .catch(() => {}); // Optional - kein harter Fehler
  }, [municipalitySlug, isGuestMode]);

  // Action-Cooldowns laden wenn Partner aufgeklappt wird
  useEffect(() => {
    if (!expandedPartner || !municipalitySlug || isGuestMode) return;
    if (actionCooldowns[expandedPartner]) return; // schon geladen
    partnershipApi.getActionCooldowns(municipalitySlug, expandedPartner)
      .then(res => {
        if (res.success) setActionCooldowns(prev => ({ ...prev, [expandedPartner]: res.data.cooldowns }));
      })
      .catch(() => {});
  }, [expandedPartner, municipalitySlug, isGuestMode]);

  // Diplomatische Aktion ausführen
  const handleDiplomaticAction = async (partnerSlug: string, partnerName: string, actionType: 'emergency_aid' | 'city_festival' | 'labor_migration') => {
    if (!municipalitySlug) return;
    const key = `${partnerSlug}_${actionType}`;
    setExecutingAction(key);
    try {
      const res = await partnershipApi.executeDiplomaticAction(municipalitySlug, partnerSlug, actionType);
      if (res.success) {
        setActionCooldowns(prev => ({ ...prev, [partnerSlug]: res.data.cooldowns }));
        const notifLabels: Record<string, string> = {
          emergency_aid:   String(UI_LABELS.notifEmergencyAidSent),
          city_festival:   String(UI_LABELS.notifCityFestivalSent),
          labor_migration: String(UI_LABELS.notifLaborMigSent),
        };
        addNotification(
          notifLabels[actionType] || String(UI_LABELS.notifActionDone),
          UI_LABELS.notifActionFor.replace('{city}', partnerName ),
          'city'
        );
      }
    } catch (err) {
      addNotification(UI_LABELS.notifRequestError, err instanceof Error ? err.message : UI_LABELS.notifActionDone, 'default');
    } finally {
      setExecutingAction(null);
    }
  };

  // Lade schweizweite Gemeinden wenn Such-View geöffnet wird (nicht im Guest-Mode)
  useEffect(() => {
    // Im Guest-Mode keine Gemeinden laden
    if (isGuestMode) return;
    
    async function loadMunicipalities() {
      if (viewMode !== 'search') return;
      if (searchMunicipalities.length > 0) return; // Schon geladen
      
      setIsLoadingCanton(true);
      try {
        const response = await partnershipApi.searchMunicipalities('', 2000);
        if (response.success) {
          setSearchMunicipalities(response.data.municipalities || []);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Gemeinden:', error);
      } finally {
        setIsLoadingCanton(false);
      }
    }
    
    loadMunicipalities();
  }, [viewMode, searchMunicipalities.length, isGuestMode]);

  // Gefilterte Gemeinden basierend auf Suche
  const filteredMunicipalities = useMemo(() => {
    if (!searchQuery.trim()) return searchMunicipalities;
    
    const query = searchQuery.toLowerCase();
    return searchMunicipalities.filter(m => 
      m.name.toLowerCase().includes(query) ||
      m.slug.toLowerCase().includes(query)
    );
  }, [searchMunicipalities, searchQuery]);

  // Prüfe ob bereits Partner oder Anfrage gesendet
  const getPartnerStatus = (slug: string): 'partner' | 'pending' | 'none' => {
    // Ist bereits Partner?
    const isPartner = apiPartnerships.some(p => p.partner.slug === slug);
    if (isPartner) return 'partner';
    
    // Anfrage bereits gesendet?
    const hasPendingRequest = outgoingRequests.some(
      r => r.to_municipality.slug === slug && r.status === 'pending'
    );
    if (hasPendingRequest) return 'pending';
    
    return 'none';
  };

  // Anfrage senden
  const handleSendRequest = async (targetSlug: string, targetName: string) => {
    if (!municipalitySlug) return;
    
    setSendingRequest(targetSlug);
    try {
      const response = await partnershipApi.sendPartnershipRequest(municipalitySlug, targetSlug);
      if (response.success) {
        setOutgoingRequests(prev => [...prev, response.data.request]);
        addNotification(
          UI_LABELS.notifRequestSent,
          UI_LABELS.notifRequestSentDesc.replace('{city}', targetName ),
          'city'
        );
      }
    } catch (error) {
      console.error('Fehler beim Senden der Anfrage:', error);
      addNotification(
        UI_LABELS.notifRequestError,
        UI_LABELS.notifRequestSendFailed.replace('{reason}', error instanceof Error ? error.message : '?' ),
        'default'
      );
    } finally {
      setSendingRequest(null);
    }
  };

  // Kombiniere adjacentCities mit apiPartnerships
  // API-Partnerschaften haben Priorität, da sie den aktuellen DB-Stand widerspiegeln
  const combinedCities = useMemo(() => {
    const cities: Array<{
      id: number | string;
      name: string;
      slug: string;
      direction: string;
      discovered: boolean;
      connected: boolean;
      fromApi?: boolean;
    }> = [];
    
    // Füge zuerst alle API-Partnerschaften hinzu
    apiPartnerships.forEach((p, index) => {
      cities.push({
        id: 1000 + index, // Eindeutige ID für API-Partner
        name: p.partner.name,
        slug: p.partner.slug,
        direction: p.direction || 'north',
        discovered: true,
        connected: p.status === 'connected',
        fromApi: true,
      });
    });
    
    // Füge adjacentCities hinzu, die nicht schon in API-Partnerschaften sind
    (adjacentCities || []).forEach(city => {
      const existsInApi = apiPartnerships.some(
        p => p.partner.slug === city.slug || p.partner.name === city.name
      );
      if (!existsInApi && city.discovered) {
        cities.push({
          id: city.id,
          name: city.name,
          slug: city.slug || city.name.toLowerCase().replace(/\s+/g, '-'),
          direction: city.direction,
          discovered: city.discovered,
          connected: city.connected,
        });
      }
    });
    
    return cities;
  }, [adjacentCities, apiPartnerships]);
  
  // Invest-Handler
  const handleInvest = async (partnerSlug: string) => {
    if (!municipalitySlug) return;
    const amount = parseInt(investAmount[partnerSlug] || '0', 10);
    if (!amount || amount <= 0) return;
    setInvestingSlug(partnerSlug);
    try {
      const res = await partnershipApi.investInPartnership(municipalitySlug, partnerSlug, amount);
      if (res.success) {
        setApiPartnerships(prev => prev.map(p =>
          p.partner.slug === partnerSlug
            ? { ...p, tier_invested: res.data.tier_progress.tierInvested, tier_progress: res.data.tier_progress }
            : p
        ));
        setInvestAmount(prev => ({ ...prev, [partnerSlug]: '' }));
        addNotification(
          UI_LABELS.notifInvestOk,
          UI_LABELS.notifInvestOkDesc.replace('{amount}', amount.toLocaleString()).replace('{city}', partnerSlug ),
          'city'
        );
      }
    } catch (err) {
      addNotification(
        UI_LABELS.notifRequestError,
        err instanceof Error ? err.message : UI_LABELS.notifInvestFail,
        'default'
      );
    } finally {
      setInvestingSlug(null);
    }
  };

  // Anfrage annehmen / ablehnen
  const handleRespond = async (requestId: number, action: 'accept' | 'decline') => {
    if (!municipalitySlug) return;
    setRespondingRequest(requestId);
    try {
      // Primär: über Municipality-Route (benötigt slug)
      const res = action === 'accept'
        ? await partnershipApi.acceptPartnershipRequest(municipalitySlug, requestId)
        : await partnershipApi.declinePartnershipRequest(municipalitySlug, requestId);
      if (res.success) {
        setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
        if (action === 'accept' && res.data.partnership) {
          setApiPartnerships(prev => [...prev, res.data.partnership!]);
          addNotification(
            UI_LABELS.notifPartnershipAccepted,
            UI_LABELS.notifPartnershipActiveIncome.replace('{income}', String(res.data.partnership.trade_income )),
            'partnership'
          );
        } else if (action === 'decline') {
          addNotification(
            UI_LABELS.notifRequestDeclined,
            UI_LABELS.notifRequestDeclinedDesc,
            'default'
          );
        }
      }
    } catch {
      // Fallback: globale Route ohne slug
      try {
        const res2 = await partnershipApi.respondMyPartnershipRequest(requestId, action);
        if (res2.success) {
          setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
          if (action === 'accept' && res2.data.partnership) {
            setApiPartnerships(prev => [...prev, res2.data.partnership!]);
            addNotification(
              UI_LABELS.notifPartnershipAccepted,
              UI_LABELS.notifPartnershipActive,
              'partnership'
            );
          }
        }
      } catch {
        addNotification(
          UI_LABELS.notifRequestError,
          UI_LABELS.notifRespondFailed.replace('{action}', action === 'accept' ? UI_LABELS.accept : UI_LABELS.decline),
          'default'
        );
      }
    } finally {
      setRespondingRequest(null);
    }
  };

  // Berechne Statistiken basierend auf kombinierten Daten
  const discoveredCities = combinedCities.filter(c => c.discovered);
  const connectedCities = combinedCities.filter(c => c.connected);
  const totalMonthlyIncome = apiPartnerships
    .filter(p => p.status === 'connected')
    .reduce((sum, p) => sum + (p.trade_income || 0), 0);

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-lg bg-slate-900/95 border-slate-700 text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-lg sm:text-xl">
            <div className="flex items-center gap-2">
              {viewMode === 'search' && (
                <button
                  onClick={() => setViewMode('partners')}
                  className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <Handshake className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              {viewMode === 'partners' 
                ? UI_LABELS.tradePartners
                : UI_LABELS.searchMunicipalities
              }
            </div>
            {viewMode === 'partners' && (
              <button
                onClick={() => setViewMode('search')}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                title={String(UI_LABELS.searchMunicipalities)}
              >
                <Search className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* SUCH-ANSICHT */}
        {viewMode === 'search' && (
          <>
            {/* Suchfeld */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder={String(UI_LABELS.searchPlaceholder)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Gemeinden-Liste */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {isLoadingCanton ? (
                <div className="text-center text-slate-400 py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  {UI_LABELS.loading}
                </div>
              ) : filteredMunicipalities.length > 0 ? (
                filteredMunicipalities
                  .filter(muni => muni.slug !== municipalitySlug) // Eigene Gemeinde ausschließen
                  .map((muni) => {
                    const status = getPartnerStatus(muni.slug);
                    const isSending = sendingRequest === muni.slug;
                    
                    return (
                      <Card 
                        key={muni.id} 
                        className={`bg-slate-800/50 border-slate-700 p-3 ${
                          status === 'partner' ? 'border-l-4 border-l-emerald-500' :
                          status === 'pending' ? 'border-l-4 border-l-amber-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700 flex items-center justify-center text-base sm:text-lg shrink-0">
                              🏘️
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="truncate">{muni.name}</span>
                                {muni.is_capital && (
                                  <span className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded shrink-0">
                                    {UI_LABELS.capitalBadge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {muni.population?.toLocaleString() || '?'}
                                </span>
                                {muni.owner ? (
                                  <span className="text-emerald-400">
                                    👤 {muni.owner.nickname}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">
                                    {UI_LABELS.noOwner}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div>
                            {status === 'partner' ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                                <CheckCircle className="w-3 h-3" />
                                {UI_LABELS.alreadyPartner}
                              </span>
                            ) : status === 'pending' ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                                <Clock className="w-3 h-3" />
                                {UI_LABELS.requestPending}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendRequest(muni.slug, muni.name)}
                                disabled={isSending || !muni.owner}
                                className="text-xs gap-1 border-slate-600 hover:bg-slate-700"
                              >
                                {isSending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                {UI_LABELS.sendRequest}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{UI_LABELS.noResults}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* PARTNER-ANSICHT */}
        {viewMode === 'partners' && (
          <>
            {/* Tab-Switcher */}
            <div className="flex gap-1 mb-3 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setPartnerTab('list')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${partnerTab === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
              >
                <Handshake className="w-3.5 h-3.5" /> {UI_LABELS.tabPartner}
              </button>
              <button
                onClick={() => setPartnerTab('bilanz')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${partnerTab === 'bilanz' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> {UI_LABELS.tabBilanz}
              </button>
            </div>

            {/* HANDELSBILANZ TAB */}
            {partnerTab === 'bilanz' && (() => {
              const connected = apiPartnerships.filter(p => p.status === 'connected');
              const totalEarned = connected.reduce((s, p) => {
                const days = p.tier_progress?.connectedDays ?? 0;
                return s + days * (p.tier_progress?.dailyIncome ?? 100);
              }, 0);
              const totalInvested = apiPartnerships.reduce((s, p) => s + (p.tier_invested || 0), 0);
              return (
                <div className="space-y-3">
                  {/* Gesamt-Kennzahlen */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-slate-800/50 border-slate-700 p-3 text-center">
                      <div className="text-lg font-bold text-emerald-400">+{totalEarned.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{UI_LABELS.totalEarnedBilanz}</div>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700 p-3 text-center">
                      <div className="text-lg font-bold text-purple-300">{totalInvested.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{UI_LABELS.chfInvestedBilanz}</div>
                    </Card>
                  </div>
                  {/* Export-Kapazität */}
                  {exportCapacity && (
                    <Card className="bg-slate-800/60 border-slate-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Factory className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-200">{UI_LABELS.exportCapacity}</span>
                        <span className="ml-auto text-xs text-amber-400 font-mono">{exportCapacity.slots} {UI_LABELS.slots}</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round(exportCapacity.multiplier * 100))}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>{UI_LABELS.multiplierFormat.replace('{value}', exportCapacity.multiplier.toFixed(1) )}</span>
                        <span>{
                          exportCapacity.slots === 0 ? UI_LABELS.noPartnerYet :
                          exportCapacity.slots <= 2  ? UI_LABELS.lowIndustry :
                          exportCapacity.slots <= 5  ? UI_LABELS.goodIndustry :
                                                       UI_LABELS.fullCapacity
                        }</span>
                      </div>
                    </Card>
                  )}
                  {/* Pro-Partner Bilanz */}
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-semibold">{UI_LABELS.perPartnership}</div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {connected.length === 0 && (
                      <div className="text-center text-slate-500 py-6 text-sm">{UI_LABELS.noConnectedPartners}</div>
                    )}
                    {connected
                      .sort((a, b) => (b.tier_progress?.connectedDays ?? 0) - (a.tier_progress?.connectedDays ?? 0))
                      .map(p => {
                        const days = p.tier_progress?.connectedDays ?? 0;
                        const earned = days * (p.tier_progress?.dailyIncome ?? 100);
                        return (
                          <Card key={p.id} className="bg-slate-800/40 border-slate-700 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white flex items-center gap-1.5">
                                  {p.tier != null && (
                                    <span className={`text-[10px] px-1 py-0.5 rounded font-semibold shrink-0 ${TIER_COLORS[p.tier] ?? 'text-slate-300 bg-slate-700'}`}>
                                      {TIER_NAMES[p.tier]}
                                    </span>
                                  )}
                                  <span className="truncate">{p.partner.name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {UI_LABELS.connectedDaysFormat.replace('{days}', String(days))} · {UI_LABELS.chfDayPartner.replace('{income}', String(p.trade_income ))}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-bold text-emerald-400">+{earned.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-500">{UI_LABELS.totalEarnedLabel}</div>
                                {p.tier_invested > 0 && (
                                  <div className="text-[10px] text-purple-300">−{p.tier_invested.toLocaleString()} {UI_LABELS.bilanzInvestedShort}</div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              );
            })()}

            {/* PARTNER LIST TAB */}
            {partnerTab === 'list' && <>
            {/* Übersichts-Karten */}
            {(() => {
              const totalInvested = apiPartnerships.reduce((s, p) => s + (p.tier_invested || 0), 0);
              const totalEarned   = apiPartnerships.filter(p => p.status === 'connected').reduce((s, p) => {
                const days = p.tier_progress?.connectedDays ?? 0;
                return s + days * (p.tier_progress?.dailyIncome ?? 100);
              }, 0);
              const highestTier = Math.max(1, ...apiPartnerships.map(p => p.tier || 1));
              const tierColorClass: Record<number, string> = {
                1: 'text-slate-300', 2: 'text-blue-300', 3: 'text-purple-300', 4: 'text-amber-300',
              };
              return (
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {/* Verbunden / Entdeckt */}
                  <Card className="bg-slate-800/50 border-slate-700 p-2.5 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-base font-bold text-emerald-400 leading-tight">
                        {connectedCities.length}<span className="text-slate-500 text-xs font-normal"> / {discoveredCities.length}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">{UI_LABELS.connectedDiscovered}</div>
                    </div>
                  </Card>
                  {/* CHF/Tag */}
                  <Card className="bg-slate-800/50 border-slate-700 p-2.5 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-base font-bold text-amber-400 leading-tight">+{totalMonthlyIncome.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{UI_LABELS.chfPerDay}</div>
                    </div>
                  </Card>
                  {/* Investiert */}
                  <Card className="bg-slate-800/50 border-slate-700 p-2.5 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-400 shrink-0" />
                    <div>
                      <div className="text-base font-bold text-purple-300 leading-tight">{totalInvested > 0 ? totalInvested.toLocaleString() : '0'}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{UI_LABELS.chfInvested}</div>
                    </div>
                  </Card>
                  {/* Höchste Stufe */}
                  <Card className="bg-slate-800/50 border-slate-700 p-2.5 flex items-center gap-2">
                    <ChevronsUp className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <div className={`text-sm font-bold leading-tight ${connectedCities.length > 0 ? (tierColorClass[highestTier] ?? 'text-slate-200') : 'text-slate-500'}`}>
                        {connectedCities.length > 0 ? (TIER_NAMES[highestTier] ?? `Tier ${highestTier}`) : UI_LABELS.unknown}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">{UI_LABELS.highestTier}</div>
                    </div>
                  </Card>
                  {/* Total verdient (optional) */}
                  {totalEarned > 0 && (
                    <Card className="col-span-2 bg-emerald-900/20 border-emerald-700/30 p-2.5 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-emerald-300">+{totalEarned.toLocaleString()} CHF</div>
                        <div className="text-[10px] text-slate-400">{UI_LABELS.totalEarned}</div>
                      </div>
                    </Card>
                  )}
                </div>
              );
            })()}

            {/* Eingehende Anfragen */}
            {incomingRequests.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-widest text-amber-400 mb-1.5 font-semibold flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {incomingRequests.length} {incomingRequests.length === 1 ? UI_LABELS.incomingRequest : UI_LABELS.incomingRequests}
                </div>
                <div className="space-y-1.5">
                  {incomingRequests.map(req => (
                    <Card key={req.id} className="bg-amber-900/20 border-amber-700/40 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">🤝 {req.from_municipality.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {req.from_municipality.owner ? `👤 ${req.from_municipality.owner.nickname}` : UI_LABELS.noOwnerShort}
                            {req.message && <span className="ml-2 italic">· {req.message}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" disabled={respondingRequest === req.id}
                            onClick={() => handleRespond(req.id, 'accept')}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                            {respondingRequest === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                            {UI_LABELS.yes}
                          </Button>
                          <Button size="sm" variant="outline" disabled={respondingRequest === req.id}
                            onClick={() => handleRespond(req.id, 'decline')}
                            className="h-7 text-xs border-red-700/50 text-red-400 hover:bg-red-900/30">
                            <XCircle className="w-3 h-3 mr-1" />{UI_LABELS.no}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Partnerliste */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="text-center text-slate-400 py-8">
              <CircleDashed className="w-8 h-8 animate-spin mx-auto mb-2" />
              {UI_LABELS.loading}
            </div>
          ) : discoveredCities.length > 0 ? (
            [...discoveredCities]
              .sort((a, b) => {
                // Sortierung: Connected zuerst, dann Discovered
                if (a.connected && !b.connected) return -1;
                if (!a.connected && b.connected) return 1;
                return 0;
              })
              .map((city) => {
                // Tier-Daten aus apiPartnerships holen (nur für API-Partner verfügbar)
                const apiP: Partnership | undefined = apiPartnerships.find(p => p.partner.slug === city.slug);
                const tp = apiP?.tier_progress;
                const needsInvest = tp?.next && tp.next.minInvested > 0 && tp.next.investLeft > 0;
                const tierColors: Record<number, string> = { 1: 'border-l-slate-400', 2: 'border-l-blue-400', 3: 'border-l-purple-500', 4: 'border-l-amber-400' };
                const tierColor = tierColors[apiP?.tier ?? 1] ?? 'border-l-emerald-500';

                return (
                <React.Fragment key={city.id}>
                <Card
                  className={`bg-slate-800/50 border-slate-700 p-3 ${
                    city.connected
                      ? `border-l-4 ${tierColor}`
                      : city.discovered
                        ? 'border-l-4 border-l-blue-500'
                        : 'opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="text-xl sm:text-2xl shrink-0" title={city.direction}>
                        {DIRECTION_ICONS[city.direction] || '📍'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{city.discovered ? city.name : '???'}</span>
                          {city.connected && <Link2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {/* Tier-Badge */}
                          {tp && apiP?.tier && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${TIER_COLORS[apiP.tier] ?? 'text-slate-300 bg-slate-700'}`}>
                              {TIER_NAMES[apiP.tier] ?? tp.tierName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {DIR_LABELS[city.direction] ?? city.direction}
                          {tp && <span className="ml-1 text-slate-500">· {UI_LABELS.connectedDaysFormat.replace('{days}', String(tp.connectedDays ))}</span>}
                        </div>

                        {/* Warnung: keine Randstrasse in Partnerrichtung */}
                        {city.connected && (roadStatusMap[city.direction] === false) && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-400 font-medium">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{UI_LABELS.noRoadWarning.replace('{dir}', DIR_LABELS[city.direction] ?? city.direction )}</span>
                          </div>
                        )}

                        {/* Fortschrittsbalken zur nächsten Stufe */}
                        {city.connected && tp?.next && (
                          <div className="mt-1.5">
                            <div className="text-[10px] text-slate-500 mb-0.5 flex justify-between">
                              <span>→ {tp.next.name}</span>
                              {tp.next.ready
                                ? <span className="text-emerald-400 font-semibold">{UI_LABELS.tierReadyCheck}</span>
                                : <span>{tp.next.daysLeft > 0 ? `${tp.next.daysLeft}d` : ''}{tp.next.daysLeft > 0 && tp.next.investLeft > 0 ? ' · ' : ''}{tp.next.investLeft > 0 ? `${tp.next.investLeft.toLocaleString()} CHF` : ''}</span>
                              }
                            </div>
                            {tp.next.minDays > 0 && (
                              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.round((tp.connectedDays / tp.next.minDays) * 100))}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Invest-Eingabe für Tier 3/4 */}
                        {city.connected && needsInvest && !isGuestMode && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <input
                              type="number"
                              min={100}
                              step={100}
                              placeholder={String(UI_LABELS.investPlaceholder)}
                              value={investAmount[city.slug] ?? ''}
                              onChange={e => setInvestAmount(prev => ({ ...prev, [city.slug]: e.target.value }))}
                              className="w-28 text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={investingSlug === city.slug || !investAmount[city.slug]}
                              onClick={() => handleInvest(city.slug)}
                              className="text-xs h-7 border-purple-500/50 text-purple-300 hover:bg-purple-500/20"
                            >
                              {investingSlug === city.slug
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <><ChevronsUp className="w-3 h-3 mr-1" />{UI_LABELS.investButton}</>
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status & Einkommen + Besuchen Button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        {city.connected ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1 text-emerald-400 text-xs sm:text-sm">
                              <Coins className="w-3.5 h-3.5" />
                              <span className="font-semibold">+{apiP?.trade_income ?? 100}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{UI_LABELS.chfDayUnit}</div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>{getConnectionDuration(getConnectedAt(city.name))}</span>
                            </div>
                          </div>
                        ) : city.discovered ? (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                            {UI_LABELS.discovered}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-slate-600/50 text-slate-400 rounded">
                            {UI_LABELS.unknown}
                          </span>
                        )}
                      </div>

                      {/* Diplomatische Aktionen aufklappen */}
                      {city.connected && apiP && (apiP.tier ?? 1) >= 2 && !isGuestMode && (
                        <button
                          onClick={() => setExpandedPartner(expandedPartner === city.slug ? null : city.slug)}
                          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-slate-700/50 transition-colors text-xs ${expandedPartner === city.slug ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                          title={String(UI_LABELS.diplomaticActionsTooltip)}
                        >
                          <HeartHandshake className="w-4 h-4" />
                        </button>
                      )}
                      {city.connected && city.slug && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                          onClick={() => {
                            setActivePanel('none');
                            if (onVisitMunicipality) onVisitMunicipality(city.slug);
                            else router.push(`/gemeinde/${city.slug}`);
                          }}
                          title={String(UI_LABELS.visitTooltip)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Diplomatische Aktionen — aufgeklappt */}
                {expandedPartner === city.slug && city.connected && (
                  <Card className="bg-amber-950/30 border-amber-800/40 p-3 -mt-1 rounded-t-none border-t-0">
                    <div className="text-[10px] uppercase tracking-widest text-amber-400 mb-2 font-semibold flex items-center gap-1">
                      <HeartHandshake className="w-3 h-3" /> {UI_LABELS.diplomaticActions}
                    </div>
                    {(() => {
                      const cooldowns = actionCooldowns[city.slug];
                      const actions = [
                        { type: 'emergency_aid'   as const, icon: <Zap className="w-3.5 h-3.5" />,            cost: 5000 },
                        { type: 'city_festival'   as const, icon: <PartyPopper className="w-3.5 h-3.5" />,    cost: 2000 },
                        { type: 'labor_migration' as const, icon: <PersonStanding className="w-3.5 h-3.5" />, cost: 3000 },
                      ];
                      return (
                        <div className="space-y-1.5">
                          {actions.map(a => {
                            const cd = cooldowns?.[a.type];
                            const isExecuting = executingAction === `${city.slug}_${a.type}`;
                            const onCooldown = cd && !cd.ready;
                            return (
                              <div key={a.type} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs text-slate-200 flex items-center gap-1.5">
                                    {a.icon} {DIPLOMATIC_LABELS[a.type]?.label}
                                    <span className="text-[10px] text-slate-500">· {DIPLOMATIC_LABELS[a.type]?.desc}</span>
                                  </div>
                                  {onCooldown && (
                                    <div className="text-[10px] text-amber-600">⏳ {UI_LABELS.cooldownFormat.replace('{days}', String(cd.daysLeft ))}</div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isExecuting || !!onCooldown || !cd?.ready && cd !== undefined && !cd.ready}
                                  onClick={() => handleDiplomaticAction(city.slug, city.name, a.type)}
                                  className={`text-xs h-7 shrink-0 ${onCooldown ? 'opacity-40 border-slate-600 text-slate-500' : 'border-amber-600/50 text-amber-300 hover:bg-amber-900/30'}`}
                                >
                                  {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : `${a.cost.toLocaleString()} CHF`}
                                </Button>
                              </div>
                            );
                          })}
                          {!cooldowns && (
                            <div className="text-[10px] text-slate-500 text-center py-1">
                              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />{UI_LABELS.loadingCooldowns}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                )}
                </React.Fragment>
                );
              })
          ) : (
            <div className="text-center text-slate-400 py-8">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{UI_LABELS.noPartnersYet}</p>
              <p className="text-sm mt-1">{UI_LABELS.buildRoadsToDiscover}</p>
            </div>
          )}
        </div>

            {/* Gesamteinkommen Footer */}
            {connectedCities.length > 0 && (
              <Card className="bg-emerald-900/30 border-emerald-700 p-3 sm:p-4 mt-3 sm:mt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                    <span className="text-xs sm:text-sm text-slate-300 truncate">{UI_LABELS.totalTradeIncome}</span>
                  </div>
                  <div className="text-base sm:text-xl font-bold text-emerald-400 shrink-0">
                    +{totalMonthlyIncome} CHF{UI_LABELS.perDay}
                  </div>
                </div>
              </Card>
            )}
            </> /* end partnerTab==='list' */}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
