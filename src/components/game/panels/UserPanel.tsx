'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { User, Landmark, Settings, LogOut, ReceiptText, ClipboardList, UserPlus, Copy, Check, Home, Award, Loader2, Lock, Crown, ShieldCheck, Star, Sparkles } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AdvisorIcon } from '@/components/ui/Icons';
import {
  getMyBankingProfile,
  getMyBankingTransactions,
  getMyAuthProfile,
  type UserBankingProfile,
  type BankingTransaction,
} from '@/lib/api/bankingApi';
import { VILLA_CATALOG, TIER_COLORS, TIER_LABELS, TIER_BG, type VillaVariant } from '@/lib/villaCatalog';
import { VillaSpriteCanvas } from '@/components/game/VillaSpriteCanvas';
import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) { headers['Authorization'] = `Bearer ${token}`; headers['X-Game-Token'] = token; }
  return headers;
}

type UserPanelTab = 'overview' | 'bank' | 'badges' | 'villa';

interface UserPanelProps {
  onOpenSettings?: () => void;
  onOpenReports?: () => void;
  onOpenAdvisors?: () => void;
  onLogout?: () => void;
}

interface UserBadge {
  code: string;
  name: string;
  description: string;
  category: string;
  rarity: number;
  slot: number | null;
}

interface VillaPurchase {
  variant_row: number;
  variant_col: number;
  price_paid: number;
  purchased_at: string;
  is_placed?: boolean;
}

function formatMoney(amount: number, currency = 'CHF'): string {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
}
function formatChf(n: number) { return n.toLocaleString('de-CH') + ' Fr.'; }
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('de-CH');
}

const RARITY_COLORS: Record<number, string> = {
  1: 'border-slate-500 text-slate-400',
  2: 'border-green-600 text-green-400',
  3: 'border-blue-500 text-blue-400',
  4: 'border-purple-500 text-purple-400',
  5: 'border-amber-500 text-amber-400',
};
const RARITY_LABELS: Record<number, string> = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary' };

function isUnlocked(variant: VillaVariant, userRank: number, municipalityRole: string): boolean {
  const { requires_president, requires_council, min_rank } = variant.requirement;
  if (requires_president && municipalityRole !== 'owner') return false;
  if (requires_council && municipalityRole !== 'owner' && municipalityRole !== 'council') return false;
  if (min_rank && userRank < min_rank) return false;
  return true;
}

// ─── Badge Tab ───────────────────────────────────────────────────────────────
function BadgesTab({ myUserId }: { myUserId: number }) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!myUserId) return;
    setLoading(true);
    fetch(`${AUTH_API_BASE_URL}/api/admin/users/${myUserId}/badges`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setBadges(d.data?.badges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myUserId]);

  if (loading) return <div className="text-slate-400 text-sm py-6 text-center">Lade Badges...</div>;
  if (!badges.length) return (
    <div className="text-center py-10 text-slate-500">
      <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">Noch keine Badges verdient.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {badges.map((badge, idx) => (
        <div
          key={badge.code || idx}
          className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border ${RARITY_COLORS[badge.rarity] || RARITY_COLORS[1]} bg-slate-800/60`}
          title={`${badge.name}: ${badge.description}`}
        >
          <img
            src={`https://images.bobba.io/c_images/Badges/${badge.code}.gif`}
            alt={badge.name}
            className="w-10 h-10 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="text-[10px] text-center text-slate-300 leading-tight truncate w-full">{badge.name}</div>
          <div className={`text-[9px] ${RARITY_COLORS[badge.rarity]?.split(' ')[1] || 'text-slate-400'}`}>
            {RARITY_LABELS[badge.rarity] || 'Common'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Villa Tab ────────────────────────────────────────────────────────────────
function VillaTab({
  municipalitySlug,
  userRank,
  municipalityRole,
  onStartPlacement,
  purchase,
  loadingPurchase,
  onReloadPurchase,
}: {
  municipalitySlug: string | null;
  userRank: number;
  municipalityRole: string;
  onStartPlacement: (variantRow: number, variantCol: number) => void;
  purchase: VillaPurchase | null;
  loadingPurchase: boolean;
  onReloadPurchase: () => Promise<void>;
}) {
  const [selectedVariant, setSelectedVariant] = useState<VillaVariant | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentVariantDef = purchase
    ? VILLA_CATALOG.find(v => v.row === purchase.variant_row && v.col === purchase.variant_col)
    : null;

  const handleBuy = async () => {
    if (!selectedVariant || !municipalitySlug) return;
    setBuying(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/game/municipality/${municipalitySlug}/residence/villa-purchase`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ variant_row: selectedVariant.row, variant_col: selectedVariant.col }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'Fehler');
      await onReloadPurchase();
      setSuccess(`"${selectedVariant.name}" wurde als dein Traumhaus gekauft! Baue jetzt eine Mansion auf der Karte – sie erscheint automatisch in deinem Design.`);
      setSelectedVariant(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Kauf');
    } finally {
      setBuying(false);
    }
  };

  if (!municipalitySlug) {
    return (
      <div className="text-center py-10 text-slate-500">
        <Home className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Tritt einer Gemeinde bei, um ein Traumhaus zu kaufen.</p>
      </div>
    );
  }

  const tiers = [1, 2, 3, 4, 5] as const;

  return (
    <div className="space-y-4">
      {/* Current purchase info */}
      {loadingPurchase ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Lade...</div>
      ) : currentVariantDef ? (
        <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-700/40 rounded-lg px-4 py-3">
          <div className="w-12 h-12 rounded border border-emerald-700/50 overflow-hidden shrink-0 bg-slate-800">
            <VillaSpriteCanvas row={currentVariantDef.row} col={currentVariantDef.col} size={48} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" /> {currentVariantDef.name}
            </div>
            <div className="text-xs text-slate-400">{currentVariantDef.description}</div>
            <div className="text-xs text-slate-500 mt-0.5">Bezahlt: {formatChf(purchase!.price_paid)} · {formatDate(purchase!.purchased_at)}</div>
          </div>
          {!purchase!.is_placed && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-emerald-600 text-emerald-300 hover:bg-emerald-800/40 text-xs px-2 py-1 h-auto"
              onClick={() => onStartPlacement(purchase!.variant_row, purchase!.variant_col)}
            >
              <Home className="w-3 h-3 mr-1" />
              Platzieren
            </Button>
          )}
          {purchase!.is_placed && (
            <span className="text-xs text-emerald-400 shrink-0 flex items-center gap-1">
              <Home className="w-3 h-3" /> Platziert
            </span>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-400">
          <Home className="w-4 h-4 inline mr-1.5 opacity-50" />
          Noch kein Traumhaus gekauft. Wähle ein Design aus dem Katalog!
        </div>
      )}

      <p className="text-xs text-slate-500">
        Nach dem Kauf kannst du auf der Karte eine <strong className="text-slate-300">Mansion</strong> platzieren — sie erscheint automatisch in deinem gewählten Design.
        Die Zahlung geht von deinem Privatkonto direkt in die Gemeindekasse.
      </p>

      {/* Error / success */}
      {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{error}</div>}
      {success && <div className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700/40 rounded px-3 py-2">{success}</div>}

      {/* Villa catalog per tier */}
      {tiers.map(tier => {
        const tierVariants = VILLA_CATALOG.filter(v => v.tier === tier);
        return (
          <div key={tier}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${TIER_COLORS[tier]} ${TIER_BG[tier]}`}>
                {TIER_LABELS[tier]}
              </span>
              {tier === 4 && <span className="text-xs text-slate-500">Verwaltung</span>}
              {tier === 5 && <span className="text-xs text-slate-500">Gemeindepresident</span>}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {tierVariants.map(variant => {
                const unlocked = isUnlocked(variant, userRank, municipalityRole);
                const isCurrent = purchase?.variant_row === variant.row && purchase?.variant_col === variant.col;
                const isSelected = selectedVariant?.row === variant.row && selectedVariant?.col === variant.col;

                return (
                  <div
                    key={`${variant.row}-${variant.col}`}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                      !unlocked ? 'opacity-50 cursor-not-allowed border-slate-700' :
                      isCurrent ? 'border-emerald-500 ring-2 ring-emerald-500/30 cursor-default' :
                      isSelected ? 'border-amber-400 ring-2 ring-amber-400/30 scale-[1.03] cursor-pointer' :
                      'border-slate-600 hover:border-slate-400 cursor-pointer'
                    } ${TIER_BG[tier]}`}
                    onClick={() => {
                      if (!unlocked || isCurrent) return;
                      setSelectedVariant(isSelected ? null : variant);
                      setError(''); setSuccess('');
                    }}
                    title={variant.description}
                  >
                    {/* Sprite preview */}
                    <div className="w-full aspect-square bg-slate-900">
                      <VillaSpriteCanvas row={variant.row} col={variant.col} size={96} />
                    </div>
                    {/* Lock */}
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                        <Lock size={16} className="text-slate-400" />
                      </div>
                    )}
                    {/* Current */}
                    {isCurrent && (
                      <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                        <Check size={9} className="text-white" />
                      </div>
                    )}
                    {/* Selected */}
                    {isSelected && !isCurrent && (
                      <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-0.5">
                        <Check size={9} className="text-white" />
                      </div>
                    )}
                    {/* Role icon */}
                    {variant.requirement.requires_president && (
                      <div className="absolute top-1 left-1"><Crown size={9} className="text-amber-400" /></div>
                    )}
                    {variant.requirement.requires_council && !variant.requirement.requires_president && (
                      <div className="absolute top-1 left-1"><ShieldCheck size={9} className="text-purple-400" /></div>
                    )}
                    {variant.requirement.min_rank && (
                      <div className="absolute top-1 left-1"><Star size={9} className="text-blue-400" /></div>
                    )}
                    {/* Price label */}
                    <div className="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 bg-black/70 text-center">
                      <div className="text-[8px] text-white leading-tight truncate">{variant.name}</div>
                      <div className={`text-[8px] font-bold ${unlocked ? 'text-amber-300' : 'text-slate-400'}`}>
                        {formatChf(variant.price)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Confirm buy */}
      {selectedVariant && (
        <div className="sticky bottom-0 bg-slate-900/95 border-t border-slate-700 pt-3 mt-2 flex items-center gap-3">
          <div className="flex-1 text-sm">
            <span className="text-white font-semibold">{selectedVariant.name}</span>
            <span className="text-slate-400"> · </span>
            <span className="text-amber-300 font-bold">{formatChf(selectedVariant.price)}</span>
            <div className="text-xs text-slate-500">Privatkonto → Gemeindekasse</div>
          </div>
          <Button
            onClick={handleBuy}
            disabled={buying}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-4 flex items-center gap-2"
          >
            {buying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Kaufen
          </Button>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={() => setSelectedVariant(null)}
          >
            Abbrechen
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main UserPanel ───────────────────────────────────────────────────────────
export function UserPanel({ onOpenSettings, onOpenReports, onOpenAdvisors, onLogout }: UserPanelProps) {
  const { setActivePanel, municipalitySlug, municipalityRole, state, startResidencePlacement } = useGame();
  const [tab, setTab] = useState<UserPanelTab>('overview');
  const [nickname, setNickname] = useState('');
  const [rank, setRank] = useState(0);
  const [globalRole, setGlobalRole] = useState('');
  const [xpLevel, setXpLevel] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [xpNextLevel, setXpNextLevel] = useState<number | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserBankingProfile | null>(null);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [referredByNickname, setReferredByNickname] = useState<string | null>(null);
  const myUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || 0) : 0;

  // Villa purchase — load once per panel open, pass down to VillaTab
  const [villaPurchase, setVillaPurchase] = useState<VillaPurchase | null>(null);
  const [villaPurchaseLoading, setVillaPurchaseLoading] = useState(true);
  const loadVillaPurchase = useCallback(async () => {
    if (!municipalitySlug) { setVillaPurchaseLoading(false); return; }
    setVillaPurchaseLoading(true);
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/game/municipality/${municipalitySlug}/residence/my-villa`, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      const p = json.data?.purchase || null;
      if (p) p.is_placed = json.data?.is_placed ?? false;
      setVillaPurchase(p);
    } catch { /* ignore */ }
    finally { setVillaPurchaseLoading(false); }
  }, [municipalitySlug]);
  useEffect(() => { loadVillaPurchase(); }, [loadVillaPurchase]);

  useEffect(() => {
    getMyAuthProfile()
      .then((p) => {
        if (p.nickname) setNickname(p.nickname);
        setRank(p.user_rank);
        setGlobalRole(p.global_role);
        setXpLevel(p.xp.level);
        setXpTotal(p.xp.total_xp);
        setXpNextLevel(p.xp.next_level_xp);
        setReferralCode(p.referral_code);
        setHasGoogle(p.has_google);
        setReferredByNickname(p.referred_by_nickname);
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          setNickname(String(window.localStorage.getItem('isocity_user_name') || 'Spieler'));
          setRank(Number(window.localStorage.getItem('isocity_user_rank') || 0));
          setGlobalRole(String(window.localStorage.getItem('isocity_global_role') || 'user'));
        }
      })
      .finally(() => setLoadingReferral(false));
  }, []);

  const referralUrl = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://buenzlifight.ch'}/#ref/${referralCode}${municipalitySlug ? `/${municipalitySlug}` : ''}`
    : '';

  function copyReferralLink() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    });
  }

  const loadBankData = async () => {
    setLoadingBank(true); setBankError(null);
    try {
      const [p, tx] = await Promise.all([getMyBankingProfile(), getMyBankingTransactions(12, 0)]);
      setProfile(p);
      setTransactions(tx.entries || []);
    } catch (err) {
      setBankError(err instanceof Error ? err.message : 'Bankdaten konnten nicht geladen werden');
    } finally { setLoadingBank(false); }
  };

  useEffect(() => {
    if (tab === 'bank' && !profile && !loadingBank) void loadBankData();
  }, [tab, profile, loadingBank]);

  const roleText = useMemo(() => {
    if (globalRole === 'administrator') return 'Administrator';
    if (globalRole === 'moderator') return 'Moderator';
    return 'Spieler';
  }, [globalRole]);

  const TAB_BTN = 'px-3 py-1.5 text-sm rounded-md font-medium transition-colors';
  const ACTIVE = 'bg-slate-700 text-white';
  const INACTIVE = 'text-slate-400 hover:text-slate-200 hover:bg-slate-800';

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[800px] w-full bg-slate-900/95 border-slate-700 text-white p-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="w-5 h-5" />
            User Panel
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-2 border-b border-slate-700 shrink-0 flex-wrap">
          <button className={`${TAB_BTN} ${tab === 'overview' ? ACTIVE : INACTIVE}`} onClick={() => setTab('overview')}>
            Übersicht
          </button>
          <button className={`${TAB_BTN} ${tab === 'bank' ? ACTIVE : INACTIVE}`} onClick={() => setTab('bank')}>
            Bank
          </button>
          <button className={`${TAB_BTN} flex items-center gap-1.5 ${tab === 'badges' ? ACTIVE : INACTIVE}`} onClick={() => setTab('badges')}>
            <Award className="w-3.5 h-3.5" />Badges
          </button>
          {municipalitySlug && (
            <button className={`${TAB_BTN} flex items-center gap-1.5 ${tab === 'villa' ? ACTIVE : INACTIVE}`} onClick={() => setTab('villa')}>
              <Home className="w-3.5 h-3.5" />Mein Haus
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                <div className="text-slate-300 text-sm">Profil</div>
                <div className="mt-2 text-lg font-semibold">{nickname || 'Spieler'}</div>
                <div className="text-sm text-slate-400">Rolle: {roleText}</div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <div className="text-sm text-slate-400">Level <span className="text-amber-300 font-semibold">{xpLevel}</span></div>
                  <div className="text-sm text-slate-400">
                    XP: <span className="text-emerald-300 font-semibold">{xpTotal.toLocaleString('de-CH')}</span>
                    {xpNextLevel != null && <span className="text-slate-500"> / {xpNextLevel.toLocaleString('de-CH')}</span>}
                  </div>
                  {rank > 0 && <div className="text-sm text-slate-400">Rang <span className="text-blue-300 font-semibold">#{rank}</span></div>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {hasGoogle && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Mit Google angemeldet
                    </div>
                  )}
                  {referredByNickname && (
                    <div className="text-xs text-slate-400">
                      Geworben von <span className="text-amber-300 font-medium">{referredByNickname}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Button variant="outline" className="justify-start border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => onOpenReports?.()}>
                  <ClipboardList className="w-4 h-4 mr-2" />Meine Reports
                </Button>
                <Button variant="outline" className="justify-start border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => onOpenAdvisors?.()}>
                  <AdvisorIcon size={16} className="mr-2" />Stadtberater
                </Button>
                <Button variant="outline" className="justify-start border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => onOpenSettings?.()}>
                  <Settings className="w-4 h-4 mr-2" />Einstellungen
                </Button>
                <Button variant="outline" className="justify-start border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => onLogout?.()}>
                  <LogOut className="w-4 h-4 mr-2" />Logout
                </Button>
              </div>

              {/* Freunde einladen */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                  <UserPlus className="w-4 h-4" />Freunde einladen
                </div>
                <p className="text-xs text-slate-400">
                  Dein Freund erhält <span className="text-amber-300 font-medium">800 Fr</span> Startguthaben, du bekommst <span className="text-emerald-400 font-medium">200 Fr + 100 XP</span>.
                </p>
                {loadingReferral ? (
                  <div className="text-xs text-slate-500 italic">Lade Einladungslink...</div>
                ) : referralUrl ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 font-mono text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 truncate">{referralUrl}</div>
                      <Button size="sm" variant="outline" className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 px-3" onClick={copyReferralLink}>
                        {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {referralCopied && <p className="text-xs text-emerald-400">Link kopiert!</p>}
                  </>
                ) : (
                  <div className="text-xs text-slate-500">Link wird nach dem nächsten Login verfügbar.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'bank' && (
            <div className="space-y-3">
              {loadingBank && <div className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300">Lade Bankdaten...</div>}
              {bankError && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{bankError}</div>}
              {!loadingBank && !bankError && profile && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-1">
                      <div className="flex items-center gap-2 text-slate-300 text-sm"><Landmark className="w-4 h-4" />Konto</div>
                      <div className="font-mono text-lg text-emerald-300">{formatMoney(profile.balance, profile.currency)}</div>
                      <div className="text-xs text-slate-400 font-mono">{profile.account_number}</div>
                      <div className="text-xs text-slate-400 font-mono">{profile.card_number_masked}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-1">
                      <div className="text-slate-300 text-sm">Identität</div>
                      <div className="text-xs text-slate-400">AHV-ID</div>
                      <div className="font-mono text-sm text-slate-100">{profile.ahv_number}</div>
                      <div className="text-xs text-slate-400">Steuernummer</div>
                      <div className="font-mono text-sm text-slate-100">{profile.tax_number}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                    <div className="flex items-center gap-2 text-slate-300 text-sm mb-2"><ReceiptText className="w-4 h-4" />Letzte Transaktionen</div>
                    {transactions.length === 0 ? (
                      <div className="text-sm text-slate-400">Noch keine Transaktionen vorhanden.</div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {transactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between rounded-md border border-slate-700/80 bg-slate-900/40 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm text-slate-100 truncate">{tx.description || tx.type}</div>
                              <div className="text-[11px] text-slate-400">{formatDate(tx.created_at)}</div>
                            </div>
                            <div className={`font-mono text-sm ${tx.direction === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {tx.direction === 'credit' ? '+' : '-'}{formatMoney(tx.amount, profile.currency)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'badges' && <BadgesTab myUserId={myUserId} />}

          {tab === 'villa' && (
            <VillaTab
              municipalitySlug={municipalitySlug ?? null}
              userRank={rank}
              municipalityRole={municipalityRole}
              onStartPlacement={(row, col) => { setActivePanel('none'); startResidencePlacement(row, col); }}
              purchase={villaPurchase}
              loadingPurchase={villaPurchaseLoading}
              onReloadPurchase={loadVillaPurchase}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
