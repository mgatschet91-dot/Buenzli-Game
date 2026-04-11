'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { msg, useMessages } from 'gt-next';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Handshake, MapPin, TrendingUp, Link2, CircleDashed, Coins, Clock, Calendar,
  Search, Send, Users, CheckCircle, XCircle, ArrowLeft, Loader2, Eye
} from 'lucide-react';
import * as partnershipApi from '@/lib/api/partnershipApi';

// Translatable UI labels
const UI_LABELS = {
  tradePartners: msg('Trade Partners'),
  diplomacy: msg('Diplomacy'),
  discovered: msg('Discovered'),
  connected: msg('Connected'),
  unknown: msg('Unknown'),
  noPartnersYet: msg('No trade partners yet'),
  buildRoadsToDiscover: msg('Build roads to the edge of your city to discover neighboring municipalities!'),
  monthlyIncome: msg('Daily Income'),
  totalTradeIncome: msg('Total Trade Income'),
  direction: msg('Direction'),
  north: msg('North'),
  south: msg('South'),
  east: msg('East'),
  west: msg('West'),
  status: msg('Status'),
  perMonth: msg('/Tag'),
  loading: msg('Loading...'),
  connectionBonus: msg('Connection Bonus'),
  // Neue Labels für Suche
  searchMunicipalities: msg('Search Municipalities'),
  searchPlaceholder: msg('Search by name...'),
  sendRequest: msg('Send Request'),
  requestSent: msg('Request Sent'),
  requestPending: msg('Pending'),
  alreadyPartner: msg('Already Partner'),
  noResults: msg('No municipalities found'),
  population: msg('Population'),
  back: msg('Back'),
  owner: msg('Owner'),
  noOwner: msg('No owner yet'),
  visit: msg('Visit'),
  visitTooltip: msg('Visit this municipality as a guest'),
};

// Berechne die Dauer seit einem Datum
function getConnectionDuration(connectedAt: string | null): string {
  if (!connectedAt) return '—';
  
  const connected = new Date(connectedAt);
  const now = new Date();
  const diffMs = now.getTime() - connected.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return '1 Tag';
  if (diffDays < 30) return `${diffDays} Tage`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 Monat';
  if (diffMonths < 12) return `${diffMonths} Monate`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1 ? '1 Jahr' : `${diffYears} Jahre`;
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
  
  const formatter = new Intl.DateTimeFormat('de-CH', { 
    day: 'numeric', 
    month: 'short'
  });
  
  return {
    date: formatter.format(nextPayout),
    daysUntil,
  };
}

// Richtungs-Übersetzungen
const DIRECTION_LABELS: Record<string, ReturnType<typeof msg>> = {
  north: msg('North'),
  south: msg('South'),
  east: msg('East'),
  west: msg('West'),
};

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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [apiPartnerships, setApiPartnerships] = useState<partnershipApi.Partnership[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('partners');
  
  // Such-State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMunicipalities, setSearchMunicipalities] = useState<partnershipApi.SearchMunicipality[]>([]);
  const [isLoadingCanton, setIsLoadingCanton] = useState(false);
  const [outgoingRequests, setOutgoingRequests] = useState<partnershipApi.PartnershipRequest[]>([]);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  
  // Ref um vorherige Partnerschaften zu tracken (für Benachrichtigungen bei neuen Partnern)
  const prevPartnerSlugsRef = useRef<Set<string>>(new Set());
  
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
                  'Partnerschaft bestätigt!',
                  `${p.partner.name} hat deine Anfrage angenommen. +5000 Fr. Bonus und +200 Fr./Monat.`,
                  'partnership'
                );
              }
            });
          }
          
          // Update ref für nächsten Vergleich
          prevPartnerSlugsRef.current = currentSlugs;
          
          setApiPartnerships(newPartnerships);
        }
        
        // Lade auch ausgehende Anfragen (API existiert evtl. noch nicht)
        try {
          const requestsResponse = await partnershipApi.getPartnershipRequests(municipalitySlug);
          if (requestsResponse.success) {
            setOutgoingRequests(requestsResponse.data.outgoing);
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
          'Anfrage gesendet',
          `Partnerschaftsanfrage an ${targetName} wurde gesendet.`,
          'city'
        );
      }
    } catch (error) {
      console.error('Fehler beim Senden der Anfrage:', error);
      addNotification(
        'Fehler',
        `Anfrage konnte nicht gesendet werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
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
  
  // Berechne Statistiken basierend auf kombinierten Daten
  const discoveredCities = combinedCities.filter(c => c.discovered);
  const connectedCities = combinedCities.filter(c => c.connected);
  const totalMonthlyIncome = connectedCities.length * 200; // 200 Fr. pro Verbindung

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
                ? m(UI_LABELS.tradePartners as Parameters<typeof m>[0])
                : m(UI_LABELS.searchMunicipalities as Parameters<typeof m>[0])
              }
            </div>
            {viewMode === 'partners' && (
              <button
                onClick={() => setViewMode('search')}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                title={String(m(UI_LABELS.searchMunicipalities as Parameters<typeof m>[0]))}
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
                placeholder={String(m(UI_LABELS.searchPlaceholder as Parameters<typeof m>[0]))}
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
                  {m(UI_LABELS.loading as Parameters<typeof m>[0])}
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
                                    Hauptort
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
                                    {m(UI_LABELS.noOwner as Parameters<typeof m>[0])}
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
                                {m(UI_LABELS.alreadyPartner as Parameters<typeof m>[0])}
                              </span>
                            ) : status === 'pending' ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                                <Clock className="w-3 h-3" />
                                {m(UI_LABELS.requestPending as Parameters<typeof m>[0])}
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
                                {m(UI_LABELS.sendRequest as Parameters<typeof m>[0])}
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
                  <p className="font-medium">{m(UI_LABELS.noResults as Parameters<typeof m>[0])}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* PARTNER-ANSICHT */}
        {viewMode === 'partners' && (
          <>
            {/* Übersichts-Karten */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-3 sm:mb-4">
              <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{discoveredCities.length}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">{m(UI_LABELS.discovered as Parameters<typeof m>[0])}</div>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-emerald-400">{connectedCities.length}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">{m(UI_LABELS.connected as Parameters<typeof m>[0])}</div>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700 p-2 sm:p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-amber-400">+{totalMonthlyIncome}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">CHF{m(UI_LABELS.perMonth as Parameters<typeof m>[0])}</div>
              </Card>
            </div>

            {/* Partnerliste */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="text-center text-slate-400 py-8">
              <CircleDashed className="w-8 h-8 animate-spin mx-auto mb-2" />
              {m(UI_LABELS.loading as Parameters<typeof m>[0])}
            </div>
          ) : discoveredCities.length > 0 ? (
            [...discoveredCities]
              .sort((a, b) => {
                // Sortierung: Connected zuerst, dann Discovered
                if (a.connected && !b.connected) return -1;
                if (!a.connected && b.connected) return 1;
                return 0;
              })
              .map((city) => (
              <Card 
                key={city.id} 
                className={`bg-slate-800/50 border-slate-700 p-3 ${
                  city.connected 
                    ? 'border-l-4 border-l-emerald-500' 
                    : city.discovered 
                      ? 'border-l-4 border-l-blue-500' 
                      : 'opacity-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {/* Richtungs-Icon */}
                    <div className="text-xl sm:text-2xl shrink-0" title={city.direction}>
                      {DIRECTION_ICONS[city.direction] || '📍'}
                    </div>

                    {/* Stadt-Info */}
                    <div className="min-w-0">
                      <div className="font-medium text-sm flex items-center gap-1.5 sm:gap-2">
                        <span className="truncate">{city.discovered ? city.name : '???'}</span>
                        {city.connected && (
                          <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {m(DIRECTION_LABELS[city.direction] as Parameters<typeof m>[0])}
                      </div>
                    </div>
                  </div>

                  {/* Status & Einkommen + Besuchen Button */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className="text-right">
                      {city.connected ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1 text-emerald-400 text-xs sm:text-sm">
                            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="font-medium">+200</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{getConnectionDuration(getConnectedAt(city.name))}</span>
                          </div>
                          {(() => {
                            const payout = getNextPayoutForPartner(getConnectedAt(city.name));
                            return payout && (
                              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-400/80">
                                <Calendar className="w-3 h-3" />
                                <span>{payout.date} ({payout.daysUntil}d)</span>
                              </div>
                            );
                          })()}
                        </div>
                      ) : city.discovered ? (
                        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                          {m(UI_LABELS.discovered as Parameters<typeof m>[0])}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-slate-600/50 text-slate-400 rounded">
                          {m(UI_LABELS.unknown as Parameters<typeof m>[0])}
                        </span>
                      )}
                    </div>
                    
                    {/* Besuchen Button - nur für verbundene Partner */}
                    {city.connected && city.slug && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                        onClick={() => {
                          // Panel schließen
                          setActivePanel('none');
                          if (onVisitMunicipality) {
                            // Inline-Besuch: Map neu laden ohne Seitennavigation
                            onVisitMunicipality(city.slug);
                          } else {
                            // Fallback: zur Gemeinde-Seite navigieren
                            router.push(`/gemeinde/${city.slug}`);
                          }
                        }}
                        title={String(m(UI_LABELS.visitTooltip as Parameters<typeof m>[0]))}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center text-slate-400 py-8">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{m(UI_LABELS.noPartnersYet as Parameters<typeof m>[0])}</p>
              <p className="text-sm mt-1">{m(UI_LABELS.buildRoadsToDiscover as Parameters<typeof m>[0])}</p>
            </div>
          )}
        </div>

            {/* Gesamteinkommen Footer */}
            {connectedCities.length > 0 && (
              <Card className="bg-emerald-900/30 border-emerald-700 p-3 sm:p-4 mt-3 sm:mt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                    <span className="text-xs sm:text-sm text-slate-300 truncate">{m(UI_LABELS.totalTradeIncome as Parameters<typeof m>[0])}</span>
                  </div>
                  <div className="text-base sm:text-xl font-bold text-emerald-400 shrink-0">
                    +{totalMonthlyIncome} CHF{m(UI_LABELS.perMonth as Parameters<typeof m>[0])}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
