'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  CircleDashed, X, Store,
  Zap, AlertTriangle, TrendingUp, RefreshCw, BarChart2, Tag, FileText,
} from 'lucide-react';
import { getAuthToken } from '@/lib/api/coreApi';
import { msg, useMessages } from 'gt-next';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

const UI_LABELS = {
  title:              msg('Marktplatz'),
  tabOverview:        msg('Übersicht'),
  tabMarket:          msg('Markt'),
  tabOffer:           msg('Anbieten'),
  tabContracts:       msg('Verträge'),
  productionSplit:    msg('Produktionsaufteilung'),
  totalMw:            msg('MW gesamt'),
  consumption:        msg('Verbrauch'),
  buffer:             msg('Puffer'),
  sellable:           msg('Verkaufbar'),
  sold:               msg('Verkauft'),
  bought:             msg('Zugekauft'),
  powerDeficit:       msg('Strom-Defizit:'),
  mwMissing:          msg('MW fehlen'),
  autoImportActive:   msg('Auto-Import aktiv.'),
  goToMarket:         msg('Zum Markt →'),
  noPowerProd:        msg('Noch keine Stromerzeugung — bau ein Kraftwerk, Solar- oder Windanlage.'),
  consumptionIncrease: msg('+{pct}% Verbrauch'),
  statProduction:     msg('Produktion'),
  effectiveMw:        msg('{mw} MW effektiv'),
  statBalance:        msg('Bilanz'),
  afterBuffer:        msg('nach Puffer'),
  reserveBuffer:      msg('Reserve-Puffer'),
  mwReserved:         msg('MW reserviert'),
  saving:             msg('Speichern...'),
  bufferInfo:         msg('Kleiner Puffer = mehr verkaufbar, höheres Risiko bei Lastspitzen.'),
  autoBuyLabel:       msg('Auto-Kauf bei Defizit'),
  autoBuyDisabled:    msg('Deaktiviert — kein Auto-Import'),
  autoBuyActive:      msg('Aktiv — {deficit} MW werden gedeckt'),
  noDeficit:          msg('Kein Defizit — kein Einkauf nötig'),
  autoBuyWarning:     msg('Auto-Kauf deaktiviert — Defizit kann Stromausfälle verursachen!'),
  howCovered:         msg('Wie wird gedeckt'),
  cheapestOffers:     msg('Günstigstes Marktangebot, mehrere kombinierbar'),
  surchargeLabel:     msg('Aufpreis'),
  surchargeAmount:    msg('+20% (kein Vertrag)'),
  noOffersAvail:      msg('Kein Angebot am Markt'),
  standardImport:     msg('Standard-Import greift (2.00 CHF/MW)'),
  autoContracts:      msg('Auto-Verträge'),
  autoCancel:         msg('Werden automatisch gekündigt wenn Defizit weg'),
  availMw:            msg('{mw} MW'),
  sellableAfterBuf:   msg('verkaufbar (nach Puffer)'),
  offerButton:        msg('Anbieten →'),
  otherOffers:        msg('Angebote anderer Gemeinden'),
  refresh:            msg('Aktualisieren'),
  spotDesc:           msg('Spot — zahle nur dein Defizit (CHF/MW/h)'),
  mineBadge:          msg('Meins'),
  maxLabel:           msg('max'),
  yourOffer:          msg('dein Angebot'),
  perMwHour:          msg('/MW/h'),
  withdrawOffer:      msg('Angebot zurückziehen'),
  fromSeller:         msg('von {seller} · max {mw} MW verfügbar'),
  subscribe:          msg('Abonnieren'),
  fixedDesc:          msg('Fix — einmalige Zahlung, dauerhafter Import'),
  buy:                msg('Kaufen'),
  noOffers:           msg('Keine Strom-Angebote vorhanden'),
  autoRefresh:        msg('Wird automatisch alle 15s aktualisiert'),
  noPowerToOffer:     msg('Kein Strom zum Anbieten — Bilanz nach Puffer:'),
  spotOffer:          msg('⚡ Spot-Angebot'),
  availAfterBuf:      msg('verfügbar nach Puffer:'),
  spotExplanation:    msg('Käufer zahlt nur bei eigenem Defizit. Abrechnung pro Minute: CHF/MW von seinem Konto → deins.'),
  maxMwLabel:         msg('Max. MW anbieten'),
  priceLabel:         msg('Preis (CHF/MW/h)'),
  atFullCapacity:     msg('Bei vollem Abruf'),
  publishSpot:        msg('Spot-Angebot veröffentlichen'),
  myActiveOffers:     msg('Meine aktiven Angebote'),
  spotDetails:        msg('MW Spot ·'),
  activeContracts:    msg('Aktive Strom-Verträge'),
  noContracts:        msg('Keine aktiven Verträge'),
  saleLabel:          msg('↑ Verkauf'),
  purchaseLabel:      msg('↓ Kauf'),
  spotType:           msg('Spot'),
  fixedType:          msg('Fix'),
  cancelContract:     msg('Kündigen'),
  spotContractActive: msg('Spot-Vertrag aktiv! Abrechnung pro Minute nach Defizit.'),
  contractCancelled:  msg('Vertrag gekündigt'),
  error:              msg('Fehler'),
};

function getAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getAuthToken();
  if (t) { h['Authorization'] = `Bearer ${t}`; h['X-Game-Token'] = t; }
  return h;
}
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${AUTH_API_BASE_URL}${path}`, { ...opts, headers: getAuthHeaders() });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler');
  return json.data;
}

// ── Typen ────────────────────────────────────────────────────────────────────
interface Listing    { id: number; seller_name: string; seller_municipality_name?: string; quantity: number; price_per_unit: number; }
interface SpotOffer  { id: number; seller_municipality_name: string; seller_name: string; max_mw: number; price_per_mw_hour: number; }
interface Contract   { id: number; seller_municipality_id: number; buyer_municipality_id: number; seller_name: string; buyer_name: string; mw_amount: number; price_per_mw: number; contract_type: 'fixed' | 'spot'; spot_max_mw?: number; }
interface MySpotOffer{ id: number; seller_municipality_name: string; max_mw: number; price_per_mw_hour: number; }

type Tab = 'uebersicht' | 'markt' | 'anbieten' | 'vertraege';

const TABS: { key: Tab; icon: React.ElementType; labelKey: keyof typeof UI_LABELS }[] = [
  { key: 'uebersicht', icon: BarChart2, labelKey: 'tabOverview' },
  { key: 'markt',      icon: Store,     labelKey: 'tabMarket'   },
  { key: 'anbieten',   icon: Tag,       labelKey: 'tabOffer'    },
  { key: 'vertraege',  icon: FileText,  labelKey: 'tabContracts'},
];

// ── Balken-Chart ─────────────────────────────────────────────────────────────
function PowerBar({ production, consumption, bufferMw, availToSell, soldMw, boughtMw, labels }: {
  production: number; consumption: number; bufferMw: number;
  availToSell: number; soldMw: number; boughtMw: number;
  labels: {
    productionSplit: string; totalMw: string; consumptionLabel: string;
    bufferLabel: string; sellableLabel: string; soldLabel: string; boughtLabel: string;
  };
}) {
  const total = Math.max(production, 1);
  const pct   = (mw: number) => Math.min(100, (mw / total) * 100);
  const consumedP = pct(consumption);
  const bufferP   = pct(bufferMw);
  const sellableP = pct(availToSell);
  const soldP     = pct(soldMw);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{labels.productionSplit}</span>
        <span className="font-medium text-slate-300">{production} {labels.totalMw}</span>
      </div>
      <div className="h-7 flex rounded-lg overflow-hidden border border-slate-700/60">
        {consumedP > 0  && <div style={{ width: `${consumedP}%`  }} className="bg-amber-500/80  flex items-center justify-center text-[9px] text-white shrink-0 overflow-hidden" title={`${labels.consumptionLabel} ${consumption} MW`}>{consumedP > 12 && `${consumption}MW`}</div>}
        {bufferP > 0    && <div style={{ width: `${bufferP}%`    }} className="bg-orange-500/70 flex items-center justify-center text-[9px] text-white shrink-0 overflow-hidden" title={`${labels.bufferLabel} ${bufferMw} MW`}>{bufferP > 9 && `${bufferMw}MW`}</div>}
        {sellableP > 0  && <div style={{ width: `${sellableP}%`  }} className="bg-emerald-500/80 flex items-center justify-center text-[9px] text-white font-medium shrink-0 overflow-hidden" title={`${labels.sellableLabel} ${availToSell} MW`}>{sellableP > 10 && `${availToSell}MW`}</div>}
        {soldP > 0      && <div style={{ width: `${soldP}%`      }} className="bg-slate-500/50 shrink-0" title={`${labels.soldLabel} ${soldMw} MW`} />}
        {boughtMw > 0   && <div className="flex-1 bg-blue-500/40" title={`${labels.boughtLabel} ${boughtMw} MW`} />}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {[
          ['bg-amber-500/80',  `${labels.consumptionLabel} ${consumption} MW`],
          ['bg-orange-500/70', `${labels.bufferLabel} ${bufferMw} MW`],
          ['bg-emerald-500/80',`${labels.sellableLabel} ${availToSell} MW`],
          ...(soldMw   > 0 ? [['bg-slate-500/50', `${labels.soldLabel} ${soldMw} MW`]] : []),
          ...(boughtMw > 0 ? [['bg-blue-500/40',  `${labels.boughtLabel} ${boughtMw} MW`]] : []),
        ].map(([bg, label]) => (
          <span key={label} className="flex items-center gap-1 text-[9px] text-slate-400">
            <span className={`w-2 h-2 rounded-sm inline-block ${bg}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function MarketplacePanel() {
  const { state, setActivePanel } = useGame();
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;

  const stats    = (state as any)?.stats ?? {};
  const myMuniId = (state as any)?.user?.municipality_id;

  const [tab, setTab]         = useState<Tab>('uebersicht');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [msg2, setMsg2]       = useState<string | null>(null);


  // Energy stats (live from Socket.IO via GameContext)
  const production  = Number(stats.power_production          ?? 0);
  const consumption = Number(stats.power_consumption         ?? 0);
  const effectiveProd = Number(stats.power_production_effective ?? production);
  const balance     = Number(stats.power_balance_effective   ?? 0);
  const availToSell = Number(stats.power_available_to_sell   ?? 0);
  const bufferMw    = Number(stats.power_buffer_mw           ?? 0);
  const soldMw      = Number(stats.power_sold_mw             ?? 0);
  const boughtMw    = Number(stats.power_bought_mw           ?? 0);
  const serverBufPct= Number(stats.power_buffer_pct          ?? 10);
  const multiplier  = Number(stats.power_season_multiplier   ?? 1);
  const season      = String(stats.season                    ?? 'spring');
  const weatherType = String(stats.weather_type              ?? 'clear');
  const temperature = stats.weather_temperature              ?? null;
  const hasDeficit  = balance < 0;
  const deficit     = hasDeficit ? Math.abs(balance) : 0;

  // Energy tab state
  const [contracts,     setContracts]     = useState<Contract[]>([]);
  const [spotOffers,    setSpotOffers]    = useState<SpotOffer[]>([]);
  const [fixedListings, setFixedListings] = useState<Listing[]>([]);
  const [mySpotOffers,  setMySpotOffers]  = useState<MySpotOffer[]>([]);
  const [bufferPct,     setBufferPct]     = useState(serverBufPct);
  const [bufferSaving,  setBufferSaving]  = useState(false);
  const [spotMaxMw,     setSpotMaxMw]     = useState(10);
  const [spotPrice,     setSpotPrice]     = useState(2.0);
  const [submitting,    setSubmitting]    = useState(false);
  const [subscribing,   setSubscribing]   = useState<number | null>(null);
  const [cancelling,    setCancelling]    = useState<number | null>(null);
  const [autoEnabled,   setAutoEnabled]   = useState(true);
  const [autoSaving,    setAutoSaving]    = useState(false);

  useEffect(() => { setBufferPct(serverBufPct); }, [serverBufPct]);

  // Auto-Kauf Toggle: load on mount
  useEffect(() => {
    apiFetch('/api/municipality/auto-market-buy').then((d: any) => { setAutoEnabled(!!d.auto_market_buy_enabled); }).catch(() => {});
  }, []);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const load = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e: unknown) { setError(e instanceof Error ? e.message : mm(UI_LABELS.error)); }
    finally { setLoading(false); }
  }, []);


  const loadMarkt = useCallback(async () => {
    const [d, d2] = await Promise.all([
      apiFetch('/api/marketplace/energy'),
      apiFetch('/api/marketplace/energy/spot/my'),
    ]);
    setSpotOffers(d.spot_offers ?? []);
    setFixedListings(d.fixed_listings ?? []);
    setMySpotOffers(d2.offers ?? []);
  }, []);

  useEffect(() => {
    setError(null); setMsg2(null);
    if (tab === 'markt')     load(loadMarkt);
    if (tab === 'vertraege') load(async () => { const d = await apiFetch('/api/energy-contracts'); setContracts(d.contracts ?? []); const d2 = await apiFetch('/api/marketplace/energy/spot/my'); setMySpotOffers(d2.offers ?? []); });
    if (tab === 'anbieten')  load(async () => { const d = await apiFetch('/api/marketplace/energy/spot/my'); setMySpotOffers(d.offers ?? []); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-Reload Markt alle 15s solange Tab offen
  useEffect(() => {
    if (tab !== 'markt') return;
    const interval = setInterval(() => { loadMarkt().catch(() => {}); }, 15000);
    return () => clearInterval(interval);
  }, [tab, loadMarkt]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const [buying, setBuying] = useState<number | null>(null);
  const handleBuyFixed = async (id: number) => { try { setBuying(id); const d = await apiFetch(`/api/marketplace/${id}/buy-energy`, { method: 'POST' }); setMsg2(`${d.mw_amount} MW gekauft für ${d.cost} CHF`); setFixedListings(p => p.filter(l => l.id !== id)); } catch (e: unknown) { setError(e instanceof Error ? e.message : mm(UI_LABELS.error)); } finally { setBuying(null); }};
  const handleBufferSave = async (pct: number) => { setBufferPct(pct); setBufferSaving(true); try { await apiFetch('/api/municipality/power-settings', { method: 'PUT', body: JSON.stringify({ power_buffer_pct: pct }) }); } catch { /**/ } finally { setBufferSaving(false); }};
  const handleAutoToggle = async (val: boolean) => { setAutoEnabled(val); setAutoSaving(true); try { await apiFetch('/api/municipality/auto-market-buy', { method: 'PUT', body: JSON.stringify({ enabled: val }) }); } catch { setAutoEnabled(!val); } finally { setAutoSaving(false); }};
  const handleSpotOffer = async () => { try { setSubmitting(true); setError(null); await apiFetch('/api/marketplace/energy/spot/offer', { method: 'POST', body: JSON.stringify({ max_mw: spotMaxMw, price_per_mw_hour: spotPrice }) }); setMsg2(`Spot-Angebot: ${spotMaxMw} MW @ ${spotPrice.toFixed(2)} CHF/MW/h`); const d = await apiFetch('/api/marketplace/energy/spot/my'); setMySpotOffers(d.offers ?? []); } catch (e: unknown) { setError(e instanceof Error ? e.message : mm(UI_LABELS.error)); } finally { setSubmitting(false); }};
  const handleSubscribe = async (offerId: number) => { try { setSubscribing(offerId); setError(null); await apiFetch(`/api/marketplace/energy/spot/${offerId}/subscribe`, { method: 'POST' }); setMsg2(mm(UI_LABELS.spotContractActive)); setSpotOffers(p => p.filter(o => o.id !== offerId)); } catch (e: unknown) { setError(e instanceof Error ? e.message : mm(UI_LABELS.error)); } finally { setSubscribing(null); }};
  const handleCancelContract = async (id: number) => { try { setCancelling(id); await apiFetch(`/api/energy-contracts/${id}`, { method: 'DELETE' }); setMsg2(mm(UI_LABELS.contractCancelled)); setContracts(p => p.filter(c => c.id !== id)); } catch (e: unknown) { setError(e instanceof Error ? e.message : mm(UI_LABELS.error)); } finally { setCancelling(null); }};
  const handleCancelSpotOffer = async (id: number) => { try { setCancelling(id); await apiFetch(`/api/marketplace/energy/spot/${id}`, { method: 'DELETE' }); setMySpotOffers(p => p.filter(o => o.id !== id)); } catch (e: unknown) { setError(e instanceof Error ? e.message : mm(UI_LABELS.error)); } finally { setCancelling(null); }};
  // ── Labels ────────────────────────────────────────────────────────────────
  const seasonLabel  = ({ winter: 'Winter', summer: 'Summer', spring: 'Spring', autumn: 'Autumn' } as Record<string, string>)[season] ?? season;
  const weatherLabel = ({ clear: 'Clear', rain: 'Rain', snow: 'Snow', storm: 'Storm', blizzard: 'Blizzard', fog: 'Fog' } as Record<string, string>)[weatherType] ?? weatherType;
  const multPct      = Math.round((multiplier - 1) * 100);
  const balColor     = balance >= 0 ? 'text-emerald-400' : 'text-red-400';

  // ── Resolved label strings ────────────────────────────────────────────────
  const labelTitle          = mm(UI_LABELS.title);
  const labelProductionSplit= mm(UI_LABELS.productionSplit);
  const labelTotalMw        = mm(UI_LABELS.totalMw);
  const labelConsumption    = mm(UI_LABELS.consumption);
  const labelBuffer         = mm(UI_LABELS.buffer);
  const labelSellable       = mm(UI_LABELS.sellable);
  const labelSold           = mm(UI_LABELS.sold);
  const labelBought         = mm(UI_LABELS.bought);
  const labelPowerDeficit   = mm(UI_LABELS.powerDeficit);
  const labelMwMissing      = mm(UI_LABELS.mwMissing);
  const labelAutoImportActive = mm(UI_LABELS.autoImportActive);
  const labelGoToMarket     = mm(UI_LABELS.goToMarket);
  const labelNoPowerProd    = mm(UI_LABELS.noPowerProd);
  const labelStatProduction = mm(UI_LABELS.statProduction);
  const labelStatBalance    = mm(UI_LABELS.statBalance);
  const labelAfterBuffer    = mm(UI_LABELS.afterBuffer);
  const labelReserveBuffer  = mm(UI_LABELS.reserveBuffer);
  const labelMwReserved     = mm(UI_LABELS.mwReserved);
  const labelSaving         = mm(UI_LABELS.saving);
  const labelBufferInfo     = mm(UI_LABELS.bufferInfo);
  const labelAutoBuyLabel   = mm(UI_LABELS.autoBuyLabel);
  const labelAutoBuyDisabled= mm(UI_LABELS.autoBuyDisabled);
  const labelNoDeficit      = mm(UI_LABELS.noDeficit);
  const labelAutoBuyWarning = mm(UI_LABELS.autoBuyWarning);
  const labelHowCovered     = mm(UI_LABELS.howCovered);
  const labelCheapestOffers = mm(UI_LABELS.cheapestOffers);
  const labelSurchargeLabel = mm(UI_LABELS.surchargeLabel);
  const labelSurchargeAmount= mm(UI_LABELS.surchargeAmount);
  const labelNoOffersAvail  = mm(UI_LABELS.noOffersAvail);
  const labelStandardImport = mm(UI_LABELS.standardImport);
  const labelAutoContracts  = mm(UI_LABELS.autoContracts);
  const labelAutoCancel     = mm(UI_LABELS.autoCancel);
  const labelSellableAfterBuf = mm(UI_LABELS.sellableAfterBuf);
  const labelOfferButton    = mm(UI_LABELS.offerButton);
  const labelOtherOffers    = mm(UI_LABELS.otherOffers);
  const labelRefresh        = mm(UI_LABELS.refresh);
  const labelSpotDesc       = mm(UI_LABELS.spotDesc);
  const labelMineBadge      = mm(UI_LABELS.mineBadge);
  const labelMaxLabel       = mm(UI_LABELS.maxLabel);
  const labelYourOffer      = mm(UI_LABELS.yourOffer);
  const labelPerMwHour      = mm(UI_LABELS.perMwHour);
  const labelWithdrawOffer  = mm(UI_LABELS.withdrawOffer);
  const labelSubscribe      = mm(UI_LABELS.subscribe);
  const labelFixedDesc      = mm(UI_LABELS.fixedDesc);
  const labelBuy            = mm(UI_LABELS.buy);
  const labelNoOffers       = mm(UI_LABELS.noOffers);
  const labelAutoRefresh    = mm(UI_LABELS.autoRefresh);
  const labelNoPowerToOffer = mm(UI_LABELS.noPowerToOffer);
  const labelSpotOffer      = mm(UI_LABELS.spotOffer);
  const labelAvailAfterBuf  = mm(UI_LABELS.availAfterBuf);
  const labelSpotExplanation= mm(UI_LABELS.spotExplanation);
  const labelMaxMwLabel     = mm(UI_LABELS.maxMwLabel);
  const labelPriceLabel     = mm(UI_LABELS.priceLabel);
  const labelAtFullCapacity = mm(UI_LABELS.atFullCapacity);
  const labelPublishSpot    = mm(UI_LABELS.publishSpot);
  const labelMyActiveOffers = mm(UI_LABELS.myActiveOffers);
  const labelSpotDetails    = mm(UI_LABELS.spotDetails);
  const labelActiveContracts= mm(UI_LABELS.activeContracts);
  const labelNoContracts    = mm(UI_LABELS.noContracts);
  const labelSaleLabel      = mm(UI_LABELS.saleLabel);
  const labelPurchaseLabel  = mm(UI_LABELS.purchaseLabel);
  const labelSpotType       = mm(UI_LABELS.spotType);
  const labelFixedType      = mm(UI_LABELS.fixedType);
  const labelCancelContract = mm(UI_LABELS.cancelContract);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-md bg-slate-900/95 border-slate-700 text-white p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Store className="w-5 h-5 text-amber-400" />
            {labelTitle}
          </DialogTitle>
        </DialogHeader>

        {error && <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-red-400 text-xs">{error}</div>}
        {msg2  && <div className="px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded text-emerald-400 text-xs">{msg2}</div>}

        {/* ── EINE flache Tab-Zeile ── */}
        <div className="flex gap-0.5 bg-slate-800/60 rounded-xl p-1 border border-slate-700/60 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, icon: Icon, labelKey }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(null); setMsg2(null); }}
              className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-[9px] font-medium transition-all whitespace-nowrap ${
                tab === key
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${tab === key && (key === 'uebersicht' || key === 'markt' || key === 'anbieten' || key === 'vertraege') ? 'text-yellow-400' : ''}`} />
              {mm(UI_LABELS[labelKey])}
            </button>
          ))}
        </div>

        <ScrollArea className="max-h-[58vh]">
          <div className="space-y-3 pr-1">

            {/* ══════ ÜBERSICHT ══════ */}
            {tab === 'uebersicht' && (<>

              {hasDeficit && (
                <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-red-400">{labelPowerDeficit} {deficit} {labelMwMissing}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {labelAutoImportActive}{' '}
                      <button onClick={() => setTab('markt')} className="text-yellow-400 underline">{labelGoToMarket}</button>
                    </div>
                  </div>
                </div>
              )}

              {production === 0 && !hasDeficit && (
                <div className="px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-xs">
                  {labelNoPowerProd}
                </div>
              )}

              {temperature !== null && (
                <div className="flex items-center justify-between text-xs bg-slate-800/40 border border-slate-700/40 rounded px-2.5 py-1.5">
                  <span className="text-slate-400">{seasonLabel} · {weatherLabel}</span>
                  <div className="flex items-center gap-2">
                    {multPct > 0 && <span className="text-orange-400 text-[10px]">+{multPct}% {labelConsumption}</span>}
                    <span className="text-sky-300 font-medium">{temperature}°C</span>
                  </div>
                </div>
              )}

              {production > 0 && (
                <PowerBar production={production} consumption={consumption}
                  bufferMw={bufferMw} availToSell={availToSell}
                  soldMw={soldMw} boughtMw={boughtMw}
                  labels={{
                    productionSplit: labelProductionSplit,
                    totalMw: labelTotalMw,
                    consumptionLabel: labelConsumption,
                    bufferLabel: labelBuffer,
                    sellableLabel: labelSellable,
                    soldLabel: labelSold,
                    boughtLabel: labelBought,
                  }}
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: labelStatProduction, value: `${production} MW`,   sub: soldMw > 0 ? `${effectiveProd} MW ${mm(UI_LABELS.effectiveMw).replace('{mw}', String(effectiveProd))}` : null,         color: 'text-emerald-400' },
                  { label: labelConsumption,    value: `${consumption} MW`,  sub: multPct > 0 ? `+${multPct}% (${seasonLabel})` : null,        color: 'text-amber-400' },
                  { label: labelStatBalance,    value: `${balance >= 0 ? '+' : ''}${balance} MW`, sub: null,                                   color: balColor },
                  { label: labelSellable,       value: `${availToSell} MW`,  sub: labelAfterBuffer,                                            color: availToSell > 0 ? 'text-emerald-400' : 'text-slate-500' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                    <div className={`text-base font-bold ${color}`}>{value}</div>
                    {sub && <div className="text-[9px] text-slate-500">{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Puffer */}
              <div className="bg-slate-800/30 border border-slate-700/60 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">{labelReserveBuffer}</span>
                  <span className="text-xs">
                    <span className="font-bold text-orange-400">{bufferPct}%</span>
                    <span className="text-slate-500 ml-1">· {bufferMw} {labelMwReserved}</span>
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 5, 10, 15, 20, 25].map(p => (
                    <button key={p} onClick={() => handleBufferSave(p)}
                      className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                        bufferPct === p ? 'bg-orange-500 text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600/60 hover:text-white'
                      }`}>{p}%</button>
                  ))}
                </div>
                {bufferSaving && <div className="text-[9px] text-slate-500">{labelSaving}</div>}
                <div className="text-[9px] text-slate-500">{labelBufferInfo}</div>
              </div>

              {/* ── Auto-Kauf Box ── */}
              <div className={`p-3 rounded-lg border space-y-2 ${
                !autoEnabled ? 'border-red-500/30 bg-red-500/5' :
                hasDeficit ? 'border-orange-500/40 bg-orange-500/5' : 'border-slate-700/50 bg-slate-800/25'
              }`}>
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 shrink-0 ${!autoEnabled ? 'text-red-400' : hasDeficit ? 'text-orange-400' : 'text-slate-500'}`} />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-200">{labelAutoBuyLabel}</div>
                    <div className="text-[10px] text-slate-400">
                      {!autoEnabled
                        ? <span className="text-red-400 font-medium">{labelAutoBuyDisabled}</span>
                        : hasDeficit
                          ? <span className="text-orange-300 font-medium">{mm(UI_LABELS.autoBuyActive).replace('{deficit}', String(deficit))}</span>
                          : <span>{labelNoDeficit}</span>}
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => handleAutoToggle(!autoEnabled)}
                    disabled={autoSaving}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${autoEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${autoEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {!autoEnabled && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 rounded px-2.5 py-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {labelAutoBuyWarning}
                  </div>
                )}

                {autoEnabled && hasDeficit && (
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-1.5">
                      <span className="text-slate-400">{labelHowCovered}</span>
                      <span className="text-slate-300">{labelCheapestOffers}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-1.5">
                      <span className="text-slate-400 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-orange-400" />{labelSurchargeLabel}
                      </span>
                      <span className="text-orange-300 font-medium">{labelSurchargeAmount}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-1.5">
                      <span className="text-slate-400">{labelNoOffersAvail}</span>
                      <span className="text-slate-300">{labelStandardImport}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/50 rounded px-2.5 py-1.5">
                      <span className="text-slate-400">{labelAutoContracts}</span>
                      <span className="text-slate-300">{labelAutoCancel}</span>
                    </div>
                  </div>
                )}
                {autoSaving && <div className="text-[9px] text-slate-500">{labelSaving}</div>}
              </div>

              {availToSell > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span><span className="font-bold">{availToSell} MW</span> <span className="text-[10px] text-slate-400">{labelSellableAfterBuf}</span></span>
                  </span>
                  <button onClick={() => setTab('anbieten')} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded transition-colors">
                    {labelOfferButton}
                  </button>
                </div>
              )}
            </>)}

            {/* ══════ MARKT ══════ */}
            {tab === 'markt' && (
              loading ? <div className="flex justify-center py-10"><CircleDashed className="w-6 h-6 animate-spin text-slate-500" /></div>
              : <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{labelOtherOffers}</span>
                  <button onClick={() => load(async () => { const d = await apiFetch('/api/marketplace/energy'); setSpotOffers(d.spot_offers ?? []); setFixedListings(d.fixed_listings ?? []); })}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"><RefreshCw className="w-3 h-3" />{labelRefresh}</button>
                </div>

                {(spotOffers.length > 0 || mySpotOffers.length > 0) && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-yellow-400 flex items-center gap-1.5"><Zap className="w-3 h-3" />{labelSpotDesc}</div>

                    {/* Eigene Angebote mit Badge */}
                    {mySpotOffers.map(o => (
                      <div key={`my-${o.id}`} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-white">{o.seller_municipality_name}</span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{labelMineBadge}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{labelMaxLabel} {o.max_mw} MW · {labelYourOffer}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-yellow-300">{Number(o.price_per_mw_hour).toFixed(2)} CHF</div>
                          <div className="text-[9px] text-slate-500">{labelPerMwHour}</div>
                        </div>
                        <button onClick={() => handleCancelSpotOffer(o.id)} disabled={cancelling === o.id}
                          className="text-red-400/60 hover:text-red-400 transition-colors shrink-0" title={labelWithdrawOffer}>
                          {cancelling === o.id ? <CircleDashed className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}

                    {/* Angebote anderer */}
                    {spotOffers.map(o => (
                      <div key={o.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/5">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white">{o.seller_municipality_name}</div>
                          <div className="text-[10px] text-slate-400">{mm(UI_LABELS.fromSeller).replace('{seller}', o.seller_name).replace('{mw}', String(o.max_mw))}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-yellow-300">{Number(o.price_per_mw_hour).toFixed(2)} CHF</div>
                          <div className="text-[9px] text-slate-500">{labelPerMwHour}</div>
                        </div>
                        <Button size="sm" onClick={() => handleSubscribe(o.id)} disabled={subscribing !== null}
                          className="bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] h-7 px-2 shrink-0">
                          {subscribing === o.id ? <CircleDashed className="w-3 h-3 animate-spin" /> : labelSubscribe}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {fixedListings.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-blue-400">{labelFixedDesc}</div>
                    {fixedListings.map(l => (
                      <div key={l.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-blue-500/25 bg-blue-500/5">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white">{l.seller_municipality_name ?? l.seller_name}</div>
                          <div className="text-[10px] text-slate-400">{l.quantity} MW · {l.seller_name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-blue-300">{(l.price_per_unit * l.quantity).toLocaleString('de-CH', { minimumFractionDigits: 0 })} CHF</div>
                        </div>
                        <Button size="sm" onClick={() => handleBuyFixed(l.id)} disabled={buying !== null}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] h-7 px-2 shrink-0">
                          {buying === l.id ? <CircleDashed className="w-3 h-3 animate-spin" /> : labelBuy}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {spotOffers.length === 0 && fixedListings.length === 0 && mySpotOffers.length === 0 && (
                  <div className="text-center py-10 border border-dashed border-slate-700 rounded-lg space-y-1">
                    <div className="text-slate-500 text-sm">{labelNoOffers}</div>
                    <div className="text-slate-600 text-[10px] flex items-center justify-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {labelAutoRefresh}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══════ ANBIETEN ══════ */}
            {tab === 'anbieten' && (<>
              {availToSell <= 0 && (
                <div className="px-3 py-2.5 bg-slate-800/40 border border-slate-700/40 rounded-lg text-[11px] text-slate-400 text-center">
                  {labelNoPowerToOffer} <span className="text-red-400 font-medium">{availToSell} MW</span>
                </div>
              )}

              <div className="space-y-2.5 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-yellow-300 font-medium">{labelSpotOffer}</div>
                  <div className="text-[10px] text-slate-500">{labelAvailAfterBuf} <span className="text-emerald-400 font-medium">{availToSell} MW</span></div>
                </div>
                <div className="text-[10px] text-slate-400">{labelSpotExplanation}</div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-0.5 block">{labelMaxMwLabel}</label>
                    <Input type="number" value={spotMaxMw}
                      onChange={e => setSpotMaxMw(Math.max(1, Number(e.target.value)))}
                      min={1}
                      className="bg-slate-800/50 border-slate-700 text-white h-8 text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-0.5 block">{labelPriceLabel}</label>
                    <Input type="number" value={spotPrice}
                      onChange={e => setSpotPrice(Math.max(0.1, Math.min(100, Number(e.target.value))))}
                      step={0.1} min={0.1}
                      className="bg-slate-800/50 border-slate-700 text-white h-8 text-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] bg-slate-800/40 rounded px-2 py-1.5">
                  <span className="text-slate-400">{labelAtFullCapacity}</span>
                  <span className="text-yellow-300 font-medium">
                    Fr. {(spotMaxMw * spotPrice).toFixed(2)}/h &nbsp;·&nbsp; Fr. {(spotMaxMw * spotPrice / 60).toFixed(4)}/min
                  </span>
                </div>
                <Button onClick={handleSpotOffer} disabled={submitting || availToSell <= 0}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-sm h-8">
                  {submitting ? <CircleDashed className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                  {labelPublishSpot}
                </Button>
              </div>

              {mySpotOffers.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-700/40">
                  <div className="text-[10px] text-slate-400 pt-1">{labelMyActiveOffers}</div>
                  {mySpotOffers.map(o => (
                    <div key={o.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800/30">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white">{o.max_mw} {labelSpotDetails} {Number(o.price_per_mw_hour).toFixed(2)} CHF{labelPerMwHour}</div>
                        <div className="text-[9px] text-slate-500">{o.seller_municipality_name}</div>
                      </div>
                      <button onClick={() => handleCancelSpotOffer(o.id)} disabled={cancelling === o.id} className="text-red-400/70 hover:text-red-400 transition-colors">
                        {cancelling === o.id ? <CircleDashed className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* ══════ VERTRÄGE ══════ */}
            {tab === 'vertraege' && (
              loading ? <div className="flex justify-center py-8"><CircleDashed className="w-5 h-5 animate-spin text-slate-500" /></div>
              : <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">{labelActiveContracts}</span>
                  <button onClick={() => load(async () => { const d = await apiFetch('/api/energy-contracts'); setContracts(d.contracts ?? []); })} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"><RefreshCw className="w-3 h-3" /></button>
                </div>
                {contracts.length === 0
                  ? <div className="text-xs text-slate-500 text-center py-8 border border-dashed border-slate-700 rounded-lg">{labelNoContracts}</div>
                  : contracts.map(c => {
                    const isSeller = c.seller_municipality_id === myMuniId;
                    const isSpot   = c.contract_type === 'spot';
                    return (
                      <div key={c.id} className={`flex items-center gap-2 p-2.5 rounded-lg border ${isSeller ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-semibold ${isSeller ? 'text-yellow-400' : 'text-blue-400'}`}>{isSeller ? labelSaleLabel : labelPurchaseLabel}</span>
                            <span className="text-xs text-slate-200 truncate">{isSeller ? c.buyer_name : c.seller_name}</span>
                            <Badge variant="outline" className={`text-[9px] py-0 ${isSpot ? 'border-yellow-500/40 text-yellow-400' : 'border-blue-400/40 text-blue-400'}`}>{isSpot ? labelSpotType : labelFixedType}</Badge>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isSpot ? `max ${c.spot_max_mw ?? c.mw_amount} MW · ${Number(c.price_per_mw).toFixed(2)} CHF/MW/h → persönl. Konto` : `${c.mw_amount} MW · ${Number(c.price_per_mw).toFixed(2)} CHF/MW einmalig`}
                          </div>
                        </div>
                        <button onClick={() => handleCancelContract(c.id)} disabled={cancelling === c.id} className="text-red-400/60 hover:text-red-400 shrink-0 transition-colors" title={labelCancelContract}>
                          {cancelling === c.id ? <CircleDashed className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })
                }
              </>
            )}


          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
