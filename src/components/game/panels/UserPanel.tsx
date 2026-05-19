'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { User, Landmark, Settings, LogOut, ReceiptText, ClipboardList, UserPlus, Copy, Check, Home, Award, Loader2, Lock, Crown, ShieldCheck, Star, Sparkles } from 'lucide-react';
import { msg, useMessages } from 'gt-next';
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

const UI_LABELS = {
  title:           msg('User Panel'),
  tabOverview:     msg('Übersicht'),
  tabBank:         msg('Bank'),
  tabBadges:       msg('Badges'),
  tabVilla:        msg('Mein Haus'),
  profileHeading:  msg('Profil'),
  defaultPlayer:   msg('Spieler'),
  roleLabel:       msg('Rolle:'),
  levelLabel:      msg('Level'),
  xpLabel:         msg('XP:'),
  rankLabel:       msg('Rang'),
  steamConnected:  msg('Mit Steam angemeldet'),
  googleConnected: msg('Mit Google angemeldet'),
  referredBy:      msg('Geworben von'),
  myReports:       msg('Meine Reports'),
  advisors:        msg('Stadtberater'),
  settingsBtn:     msg('Einstellungen'),
  logoutBtn:       msg('Logout'),
  referralTitle:   msg('Freunde einladen'),
  friendBonus:     msg('800 Fr'),
  referrerBonus:   msg('200 Fr + 100 XP'),
  loadingLink:     msg('Lade Einladungslink...'),
  steamInvite:     msg('Freunde über Steam einladen'),
  steamCopied:     msg('Link kopiert — im Steam-Chat einfügen (Ctrl+V)'),
  copyLink:        msg('Link kopieren'),
  linkCopied:      msg('Link kopiert!'),
  linkUnavailable: msg('Link wird nach dem nächsten Login verfügbar.'),
  bankLoading:     msg('Lade Bankdaten...'),
  accountHeading:  msg('Konto'),
  identityHeading: msg('Identität'),
  ahvLabel:        msg('AHV-ID'),
  taxLabel:        msg('Steuernummer'),
  txHeading:       msg('Letzte Transaktionen'),
  noTx:            msg('Noch keine Transaktionen vorhanden.'),
  roleAdmin:       msg('Administrator'),
  roleMod:         msg('Moderator'),
  villaNoMunicip:  msg('Tritt einer Gemeinde bei, um ein Traumhaus zu kaufen.'),
  loading:         msg('Lade...'),
  villaPaid:       msg('Bezahlt:'),
  villaPlace:      msg('Platzieren'),
  villaPlaced:     msg('Platziert'),
  villaEmpty:      msg('Noch kein Traumhaus gekauft. Wähle ein Design aus dem Katalog!'),
  villaPaymentDir: msg('Privatkonto → Gemeindekasse'),
  villaBuy:        msg('Kaufen'),
  cancel:          msg('Abbrechen'),
};

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
  image_url?: string | null;
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
function BadgeImage({ src, alt, label }: { src: string; alt: string; label: string }) {
  const alt1 = src.endsWith('.gif') ? src.replace(/\.gif$/, '.png') : src.replace(/\.png$/, '.gif');
  const [urls] = useState([src, alt1]);
  const [idx, setIdx] = useState(0);

  if (idx >= urls.length) {
    return (
      <div className="w-10 h-10 flex items-center justify-center rounded bg-slate-700/60 text-slate-400 text-xs font-bold select-none">
        {label.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={urls[idx]}
      alt={alt}
      className="w-10 h-10 object-contain"
      onError={() => setIdx(i => i + 1)}
    />
  );
}

function BadgesTab({ myUserId }: { myUserId: number }) {
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${AUTH_API_BASE_URL}/api/users/me/badges`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setBadges(d.data?.badges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm py-6 text-center">{mm(UI_LABELS.loading)}</div>;
  if (!badges.length) return (
    <div className="text-center py-10 text-slate-500">
      <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{mm(UI_LABELS.tabBadges)}</p>
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
          {badge.code && (
            <BadgeImage
              src={badge.image_url || `${AUTH_API_BASE_URL}/badges/${badge.code}.gif`}
              alt={badge.name}
              label={badge.name}
            />
          )}
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
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;
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
        <p className="text-sm">{mm(UI_LABELS.villaNoMunicip)}</p>
      </div>
    );
  }

  const tiers = [1, 2, 3, 4, 5] as const;

  return (
    <div className="space-y-4">
      {/* Current purchase info */}
      {loadingPurchase ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />{mm(UI_LABELS.loading)}</div>
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
            <div className="text-xs text-slate-500 mt-0.5">{mm(UI_LABELS.villaPaid)} {formatChf(purchase!.price_paid)} · {formatDate(purchase!.purchased_at)}</div>
          </div>
          {!purchase!.is_placed && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-emerald-600 text-emerald-300 hover:bg-emerald-800/40 text-xs px-2 py-1 h-auto"
              onClick={() => onStartPlacement(purchase!.variant_row, purchase!.variant_col)}
            >
              <Home className="w-3 h-3 mr-1" />
              {mm(UI_LABELS.villaPlace)}
            </Button>
          )}
          {purchase!.is_placed && (
            <span className="text-xs text-emerald-400 shrink-0 flex items-center gap-1">
              <Home className="w-3 h-3" /> {mm(UI_LABELS.villaPlaced)}
            </span>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-400">
          <Home className="w-4 h-4 inline mr-1.5 opacity-50" />
          {mm(UI_LABELS.villaEmpty)}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Nach dem Kauf kannst du auf der Karte eine <strong className="text-slate-300">Mansion</strong> platzieren — sie erscheint automatisch in deinem gewählten Design.
        {' '}{mm(UI_LABELS.villaPaymentDir)}.
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
            <div className="text-xs text-slate-500">{mm(UI_LABELS.villaPaymentDir)}</div>
          </div>
          <Button
            onClick={handleBuy}
            disabled={buying}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-4 flex items-center gap-2"
          >
            {buying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {mm(UI_LABELS.villaBuy)}
          </Button>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={() => setSelectedVariant(null)}
          >
            {mm(UI_LABELS.cancel)}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main UserPanel ───────────────────────────────────────────────────────────
export function UserPanel({ onOpenSettings, onOpenReports, onOpenAdvisors, onLogout }: UserPanelProps) {
  const { setActivePanel, municipalitySlug, municipalityRole, state, startResidencePlacement } = useGame();
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;
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
          setNickname(String(window.localStorage.getItem('isocity_user_name') || mm(UI_LABELS.defaultPlayer)));
          setRank(Number(window.localStorage.getItem('isocity_user_rank') || 0));
          setGlobalRole(String(window.localStorage.getItem('isocity_global_role') || 'user'));
        }
      })
      .finally(() => setLoadingReferral(false));
  }, []);

  const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';

  // Steam Rich Presence automatisch setzen wenn Gemeinde bekannt ist
  useEffect(() => {
    if (!IS_ELECTRON || !window.steam || !municipalitySlug) return;
    const slug = municipalitySlug;
    // Gemeinde-Name kapitalisieren für Anzeige (z.B. "solothurn" → "Solothurn")
    const displayName = slug.charAt(0).toUpperCase() + slug.slice(1);
    window.steam.setPresence('status', `Spielt in ${displayName}`).catch?.(() => {});
    window.steam.setPresence('steam_display', `#Status_InGame`).catch?.(() => {});
  }, [IS_ELECTRON, municipalitySlug]);

  // In Electron immer die echte Web-URL nutzen (nicht 127.0.0.1:3001)
  const referralOrigin = IS_ELECTRON
    ? 'https://buenzlifight.ch'
    : (typeof window !== 'undefined' ? window.location.origin : 'https://buenzlifight.ch');

  const referralUrl = referralCode
    ? `${referralOrigin}/#ref/${referralCode}${municipalitySlug ? `/${municipalitySlug}` : ''}`
    : '';

  const steamConnectStr = referralCode
    ? `+ref/${referralCode}${municipalitySlug ? `/${municipalitySlug}` : ''}`
    : '';

  async function setSteamPresence() {
    if (!window.steam || !referralCode) return;
    try {
      await window.steam.setPresence('status', `Spielt in ${municipalitySlug || 'Schweiz'} — Tritt bei!`);
      await window.steam.setPresence('connect', steamConnectStr);
    } catch {}
  }

  const [steamOverlayOpened, setSteamOverlayOpened] = useState(false);

  async function openSteamInviteDialog() {
    if (!window.steam || !referralUrl) return;
    try {
      await setSteamPresence();
      const opened = await window.steam.openInviteDialog(steamConnectStr);
      if (!opened) {
        // Overlay nicht verfügbar → als Fallback Link kopieren
        navigator.clipboard.writeText(referralUrl).catch(() => {});
        setSteamOverlayOpened(true);
        setTimeout(() => setSteamOverlayOpened(false), 4000);
      }
      // Overlay erfolgreich geöffnet → kein Link kopieren nötig
    } catch {
      navigator.clipboard.writeText(referralUrl).catch(() => {});
      setSteamOverlayOpened(true);
      setTimeout(() => setSteamOverlayOpened(false), 4000);
    }
  }

  function copyReferralLink() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setReferralCopied(true);
      if (IS_ELECTRON) void setSteamPresence();
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
    if (globalRole === 'administrator') return mm(UI_LABELS.roleAdmin);
    if (globalRole === 'moderator') return mm(UI_LABELS.roleMod);
    return mm(UI_LABELS.defaultPlayer);
  }, [globalRole, m]);

  const TAB_BTN = 'px-3 py-1.5 text-sm rounded-md font-medium transition-colors';
  const ACTIVE = 'bg-slate-700 text-white';
  const INACTIVE = 'text-slate-400 hover:text-slate-200 hover:bg-slate-800';

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[800px] w-full bg-[#0f172a] border-slate-700/80 text-white p-0 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="w-5 h-5" />
            {mm(UI_LABELS.title)}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-2 border-b border-slate-700 shrink-0 flex-wrap">
          <button className={`${TAB_BTN} ${tab === 'overview' ? ACTIVE : INACTIVE}`} onClick={() => setTab('overview')}>
            {mm(UI_LABELS.tabOverview)}
          </button>
          <button className={`${TAB_BTN} ${tab === 'bank' ? ACTIVE : INACTIVE}`} onClick={() => setTab('bank')}>
            {mm(UI_LABELS.tabBank)}
          </button>
          <button className={`${TAB_BTN} flex items-center gap-1.5 ${tab === 'badges' ? ACTIVE : INACTIVE}`} onClick={() => setTab('badges')}>
            <Award className="w-3.5 h-3.5" />{mm(UI_LABELS.tabBadges)}
          </button>
          <button className={`${TAB_BTN} flex items-center gap-1.5 ${tab === 'villa' ? ACTIVE : INACTIVE}`} onClick={() => setTab('villa')}>
            <Home className="w-3.5 h-3.5" />{mm(UI_LABELS.tabVilla)}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                <div className="text-slate-300 text-sm">{mm(UI_LABELS.profileHeading)}</div>
                <div className="mt-2 text-lg font-semibold">{nickname || mm(UI_LABELS.defaultPlayer)}</div>
                <div className="text-sm text-slate-400">{mm(UI_LABELS.roleLabel)} {roleText}</div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <div className="text-sm text-slate-400">{mm(UI_LABELS.levelLabel)} <span className="text-amber-300 font-semibold">{xpLevel}</span></div>
                  <div className="text-sm text-slate-400">
                    {mm(UI_LABELS.xpLabel)} <span className="text-emerald-300 font-semibold">{xpTotal.toLocaleString('de-CH')}</span>
                    {xpNextLevel != null && <span className="text-slate-500"> / {xpNextLevel.toLocaleString('de-CH')}</span>}
                  </div>
                  {rank > 0 && <div className="text-sm text-slate-400">{mm(UI_LABELS.rankLabel)} <span className="text-blue-300 font-semibold">#{rank}</span></div>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {IS_ELECTRON && (
                    <div className="flex items-center gap-1.5 text-xs text-[#c6d4df]">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[#66c0f4]">
                        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/>
                      </svg>
                      {mm(UI_LABELS.steamConnected)}
                    </div>
                  )}
                  {hasGoogle && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      {mm(UI_LABELS.googleConnected)}
                    </div>
                  )}
                  {referredByNickname && (
                    <div className="text-xs text-slate-400">
                      {mm(UI_LABELS.referredBy)} <span className="text-amber-300 font-medium">{referredByNickname}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Button variant="outline" className="justify-start border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => onOpenReports?.()}>
                  <ClipboardList className="w-4 h-4 mr-2" />{mm(UI_LABELS.myReports)}
                </Button>
                <Button variant="outline" className="justify-start border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => onOpenAdvisors?.()}>
                  <AdvisorIcon size={16} className="mr-2" />{mm(UI_LABELS.advisors)}
                </Button>
                <Button variant="outline" className="justify-start border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={() => onOpenSettings?.()}>
                  <Settings className="w-4 h-4 mr-2" />{mm(UI_LABELS.settingsBtn)}
                </Button>
                <Button variant="outline" className="justify-start border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => onLogout?.()}>
                  <LogOut className="w-4 h-4 mr-2" />{mm(UI_LABELS.logoutBtn)}
                </Button>
              </div>

              {/* Freunde einladen */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                  <UserPlus className="w-4 h-4" />{mm(UI_LABELS.referralTitle)}
                </div>
                <p className="text-xs text-slate-400">
                  Dein Freund erhält <span className="text-amber-300 font-medium">{mm(UI_LABELS.friendBonus)}</span> Startguthaben, du bekommst <span className="text-emerald-400 font-medium">{mm(UI_LABELS.referrerBonus)}</span>.
                  {municipalitySlug && <span className="text-slate-500"> Sie treten direkt <span className="text-white/60">{municipalitySlug}</span> bei.</span>}
                </p>
                {loadingReferral ? (
                  <div className="text-xs text-slate-500 italic">{mm(UI_LABELS.loadingLink)}</div>
                ) : referralUrl ? (
                  IS_ELECTRON ? (
                    /* Steam-Variante: Overlay-Dialog + Kopieren als Fallback */
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        className="w-full bg-[#1b2838] hover:bg-[#2a475e] border border-[#4c6b8a]/60 hover:border-[#66c0f4]/60 text-[#c6d4df] hover:text-white text-xs flex items-center gap-2 justify-center"
                        onClick={openSteamInviteDialog}
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0z"/>
                        </svg>
                        {mm(UI_LABELS.steamInvite)}
                      </Button>
                      {steamOverlayOpened && (
                        <p className="text-[11px] text-[#66c0f4] text-center">{mm(UI_LABELS.steamCopied)}</p>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-slate-400 hover:text-slate-200 text-xs flex items-center gap-2 justify-center"
                        onClick={copyReferralLink}
                      >
                        {referralCopied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> {mm(UI_LABELS.linkCopied)}</> : <><Copy className="w-3.5 h-3.5" /> {mm(UI_LABELS.copyLink)}</>}
                      </Button>
                    </div>
                  ) : (
                    /* Web-Variante: URL anzeigen + kopieren */
                    <>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 font-mono text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 truncate">{referralUrl}</div>
                        <Button size="sm" variant="outline" className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 px-3" onClick={copyReferralLink}>
                          {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      {referralCopied && <p className="text-xs text-emerald-400">{mm(UI_LABELS.linkCopied)}</p>}
                    </>
                  )
                ) : (
                  <div className="text-xs text-slate-500">{mm(UI_LABELS.linkUnavailable)}</div>
                )}
              </div>
            </div>
          )}

          {tab === 'bank' && (
            <div className="space-y-3">
              {loadingBank && <div className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300">{mm(UI_LABELS.bankLoading)}</div>}
              {bankError && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{bankError}</div>}
              {!loadingBank && !bankError && profile && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-1">
                      <div className="flex items-center gap-2 text-slate-300 text-sm"><Landmark className="w-4 h-4" />{mm(UI_LABELS.accountHeading)}</div>
                      <div className="font-mono text-lg text-emerald-300">{formatMoney(profile.balance, profile.currency)}</div>
                      <div className="text-xs text-slate-400 font-mono">{profile.account_number}</div>
                      <div className="text-xs text-slate-400 font-mono">{profile.card_number_masked}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-1">
                      <div className="text-slate-300 text-sm">{mm(UI_LABELS.identityHeading)}</div>
                      <div className="text-xs text-slate-400">{mm(UI_LABELS.ahvLabel)}</div>
                      <div className="font-mono text-sm text-slate-100">{profile.ahv_number}</div>
                      <div className="text-xs text-slate-400">{mm(UI_LABELS.taxLabel)}</div>
                      <div className="font-mono text-sm text-slate-100">{profile.tax_number}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                    <div className="flex items-center gap-2 text-slate-300 text-sm mb-2"><ReceiptText className="w-4 h-4" />{mm(UI_LABELS.txHeading)}</div>
                    {transactions.length === 0 ? (
                      <div className="text-sm text-slate-400">{mm(UI_LABELS.noTx)}</div>
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
              municipalityRole={municipalityRole || ''}
              onStartPlacement={(variantRow, variantCol) => {
                startResidencePlacement(variantRow, variantCol);
                setActivePanel('none');
              }}
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
