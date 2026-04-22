'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PowerStatusWidget } from './PowerStatusWidget';
import { WaterStatusWidget } from './WaterStatusWidget';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Crown, Shield, User, Eye, UserPlus, Trash2, ChevronUp, ChevronDown,
  Search, Users, X, Check, AlertTriangle, ArrowRight, Settings, MapPin,
  Landmark, TrendingUp, TrendingDown, CreditCard, Banknote, Clock, Filter,
  CircleDashed, CheckCircle2, Building2, ChevronLeft, Coins, FileWarning, Wrench, Globe, Gavel,
} from 'lucide-react';
import {
  getMunicipalityMembers, changeMemberRole, kickMember, inviteMember,
  getZoneSettings, updateZoneSettings,
  getBankStatus, getLedger, takeLoan, repayLoan,
  getElection, openElection, registerCandidate, withdrawCandidate, castVote, openNoConfidence,
  type MunicipalityMember, type MunicipalityMembersResponse, type MunicipalityRole,
  type BauzoneMode, type BankStatus, type LedgerEntry, type LedgerResponse,
  type ElectionDetails, type ElectionCandidate,
} from '@/lib/api/municipalityAdminApi';
import {
  fetchVerwaltungMeldungen, beauftragen, selbstBeheben, notfallreparatur, kaufeSchutzschild,
  externalResponse, polizeiSchicken,
  type VerwaltungEvent, type VerwaltungCompany, type MunicipalityStats, type EventStatus,
} from '@/lib/api/verwaltungsApi';
import {
  searchUsers,
  getPendingLoanRequests, approveLoanRequest, rejectLoanRequest,
  getCompanyLoanSettings, updateCompanyLoanSettings,
  type CompanyLoanRequest,
} from '@/lib/api/companyApi';

const ROLE_CONFIG: Record<MunicipalityRole, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  avatarBg: string;
}> = {
  owner: {
    label: 'Gemeindepraesident',
    icon: Crown,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-300',
    avatarBg: 'bg-gradient-to-br from-amber-500/30 to-amber-600/20 border-amber-500/40',
  },
  council: {
    label: 'Gemeinderat',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-300',
    avatarBg: 'bg-gradient-to-br from-blue-500/25 to-blue-600/15 border-blue-500/35',
  },
  citizen: {
    label: 'Bürger',
    icon: User,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/25',
    textColor: 'text-emerald-300',
    avatarBg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  },
  observer: {
    label: 'Beobachter',
    icon: Eye,
    color: 'text-slate-400',
    bgColor: 'bg-slate-700/40',
    borderColor: 'border-slate-600/50',
    textColor: 'text-slate-400',
    avatarBg: 'bg-gradient-to-br from-slate-600/30 to-slate-700/20 border-slate-600/40',
  },
};

const ROLE_ORDER: MunicipalityRole[] = ['owner', 'council', 'citizen', 'observer'];
const ASSIGNABLE_ROLES: MunicipalityRole[] = ['council', 'citizen', 'observer'];

function InlineRoleSelector({
  currentRole,
  requesterRole,
  onSelect,
  onClose,
}: {
  currentRole: MunicipalityRole;
  requesterRole: MunicipalityRole;
  onSelect: (role: MunicipalityRole) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const availableRoles = ASSIGNABLE_ROLES.filter(r => {
    if (r === currentRole) return false;
    if (requesterRole === 'council' && r === 'council') return false;
    return true;
  });

  const currentCfg = ROLE_CONFIG[currentRole];
  const CurrentIcon = currentCfg.icon;

  return (
    <div ref={ref} className="mt-2 rounded-xl border border-slate-600/50 bg-slate-800/60">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40 bg-slate-800/40 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rang ändern</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-1 text-[11px] ${currentCfg.textColor}`}>
            <CurrentIcon className="w-3 h-3" />
            <span>{currentCfg.label}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {availableRoles.map(role => {
          const cfg = ROLE_CONFIG[role];
          const Icon = cfg.icon;
          return (
            <button
              key={role}
              onClick={() => onSelect(role)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor} hover:brightness-125`}
            >
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  isOwner,
  myRole,
  confirmKickId,
  setConfirmKickId,
  showRoleSelector,
  setShowRoleSelector,
  handleRoleChange,
  handleKick,
}: {
  member: MunicipalityMember;
  isSelf: boolean;
  canManage: boolean;
  isOwner: boolean;
  myRole: MunicipalityRole;
  confirmKickId: number | null;
  setConfirmKickId: (id: number | null) => void;
  showRoleSelector: number | null;
  setShowRoleSelector: (id: number | null) => void;
  handleRoleChange: (userId: number, role: MunicipalityRole) => void;
  handleKick: (userId: number) => void;
}) {
  const cfg = ROLE_CONFIG[member.role];
  const MemberIcon = cfg.icon;
  const showActions = member.role !== 'owner' && !isSelf && canManage;
  const isKickTarget = confirmKickId === member.user_id;
  const isRoleSelectorOpen = showRoleSelector === member.user_id;

  return (
    <div>
      <div
        className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all ${
          isSelf
            ? 'border-emerald-500/25 bg-emerald-500/5 ring-1 ring-emerald-500/10'
            : 'border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/30'
        }`}
      >
        {/* Avatar */}
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm sm:text-base font-bold shrink-0 border ${cfg.avatarBg}`}>
          <span className={cfg.textColor}>
            {member.nickname?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-semibold text-xs sm:text-sm text-white truncate">
              {member.nickname}
            </span>
            {isSelf && (
              <span className="text-[9px] sm:text-[10px] text-emerald-500/70 font-medium bg-emerald-500/10 px-1 sm:px-1.5 py-0.5 rounded shrink-0">(Du)</span>
            )}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1.5 sm:gap-2 mt-0.5">
            <span>Lv. {member.user_level || '?'}</span>
            {member.user_xp != null && (
              <>
                <span className="text-slate-700">·</span>
                <span className="hidden sm:inline">{member.user_xp.toLocaleString()} XP</span>
              </>
            )}
          </div>
        </div>

        {/* Role Badge */}
        <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium shrink-0 ${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor}`}>
          <MemberIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">{cfg.label}</span>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowRoleSelector(isRoleSelectorOpen ? null : member.user_id)}
              className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md border transition-all ${
                isRoleSelectorOpen
                  ? 'bg-slate-600/80 border-slate-500/60 text-white'
                  : 'bg-slate-700/70 hover:bg-slate-600/80 border-slate-600/60 text-slate-300 hover:text-white'
              }`}
              title="Rang ändern"
            >
              {isRoleSelectorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="hidden sm:inline">Rang</span>
            </button>
            {isOwner && !isKickTarget && (
              <button
                onClick={() => setConfirmKickId(member.user_id)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/15 text-slate-600 hover:text-red-400 transition-all"
                title="Mitglied entfernen"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline role selector below the row */}
      {isRoleSelectorOpen && (
        <InlineRoleSelector
          currentRole={member.role}
          requesterRole={myRole}
          onSelect={(role) => {
            handleRoleChange(member.user_id, role);
            setShowRoleSelector(null);
          }}
          onClose={() => setShowRoleSelector(null)}
        />
      )}

      {/* Kick confirmation below the row */}
      {isKickTarget && (
        <div className="flex items-center gap-2 px-4 py-2.5 mt-2 rounded-xl bg-red-500/10 border border-red-500/25">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300 flex-1">
            <span className="font-semibold">{member.nickname}</span> wirklich entfernen?
          </span>
          <button
            onClick={() => handleKick(member.user_id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/25 text-red-300 hover:bg-red-500/40 transition-colors font-medium border border-red-500/30"
          >
            Ja, kicken
          </button>
          <button
            onClick={() => setConfirmKickId(null)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-600/80 transition-colors text-slate-400 border border-slate-600/50"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}

type GemeindeTab = 'members' | 'meldungen' | 'finanzen' | 'settings' | 'election';

const LEDGER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  company_contract: { label: 'Firmenauftrag', color: 'text-orange-400' },
  building_cost: { label: 'Baukosten', color: 'text-red-400' },
  bulldoze_cost: { label: 'Abriss', color: 'text-red-400' },
  upgrade_cost: { label: 'Upgrade', color: 'text-orange-400' },
  company_founding: { label: 'Firmengruendung', color: 'text-red-400' },
  company_dissolve: { label: 'Firmenaufloesung', color: 'text-emerald-400' },
  marketplace_buy: { label: 'Marktplatz Kauf', color: 'text-red-400' },
  marketplace_sell: { label: 'Marktplatz Verkauf', color: 'text-emerald-400' },
  trade_send: { label: 'Handel gesendet', color: 'text-red-400' },
  trade_receive: { label: 'Handel erhalten', color: 'text-emerald-400' },
  event_fix: { label: 'Event behoben', color: 'text-red-400' },
  event_penalty: { label: 'Strafgebühr', color: 'text-red-400' },
  emergency_repair: { label: 'Notfallreparatur', color: 'text-red-400' },
  shield: { label: 'Schutzschild', color: 'text-red-400' },
  milestone: { label: 'Meilenstein', color: 'text-emerald-400' },
  loan_take: { label: 'Kredit aufgenommen', color: 'text-blue-400' },
  loan_repay: { label: 'Kredit zurückgezahlt', color: 'text-cyan-400' },
  interest: { label: 'Zinsen', color: 'text-red-400' },
  idle_earnings: { label: 'Idle-Einnahmen', color: 'text-emerald-400' },
  buenzli_fine: { label: 'Bünzli-Busse', color: 'text-amber-400' },
  buenzli_penalty: { label: 'Bünzli-Strafe', color: 'text-red-400' },
  crime_burglary: { label: 'Einbruch-Schaden', color: 'text-red-400' },
  crime_catch_reward: { label: 'Verbrecherjagd', color: 'text-emerald-400' },
  police_dispatch: { label: 'Polizeieinsatz', color: 'text-blue-400' },
  company_tax: { label: 'Firmensteuer', color: 'text-emerald-400' },
  company_founding_loan: { label: 'Gründungskredit', color: 'text-red-400' },
  werkhof_repair:        { label: '🔧 Stadtpatrouille Reparatur', color: 'text-amber-400' },
  parking_fee:           { label: '🅿️ Parkgebühren', color: 'text-emerald-400' },
  parking_fine:          { label: '🚔 Parkbusse (Gemeinde)', color: 'text-emerald-400' },
};

// ── Meldungen (Verwaltung) ─────────────────────────────────

type StatusTab = 'offen' | 'extern' | 'in_bearbeitung' | 'erledigt';
const STATUS_TAB_MAP: Record<StatusTab, string> = {
  offen: 'reported',
  extern: 'external_reported,disputed',
  in_bearbeitung: 'investigating,assigned',
  erledigt: 'resolved,expired,failed,false_alarm',
};

function meldungStatusLabel(s: EventStatus | string): string {
  switch (s) {
    case 'detected': return 'Entdeckt';
    case 'reported': return 'Gemeldet';
    case 'investigating': return 'Untersuchung';
    case 'assigned': return 'Beauftragt';
    case 'resolved': return 'Behoben';
    case 'expired': return 'Abgelaufen';
    case 'failed': return 'Fehlgeschlagen';
    case 'false_alarm': return 'Fehlalarm';
    case 'external_reported': return 'Extern gemeldet';
    case 'disputed': return 'Einspruch';
    default: return s;
  }
}

function meldungStatusColor(s: EventStatus): string {
  switch (s) {
    case 'detected': return 'text-blue-400 border-blue-400/30 bg-blue-500/10';
    case 'reported': return 'text-amber-400 border-amber-400/30 bg-amber-500/10';
    case 'investigating': return 'text-purple-400 border-purple-400/30 bg-purple-500/10';
    case 'assigned': return 'text-cyan-400 border-cyan-400/30 bg-cyan-500/10';
    case 'resolved': return 'text-emerald-400 border-emerald-400/30 bg-emerald-500/10';
    case 'expired': return 'text-slate-400 border-slate-400/30 bg-slate-500/10';
    case 'failed': return 'text-red-400 border-red-400/30 bg-red-500/10';
    case 'false_alarm': return 'text-gray-400 border-gray-400/30 bg-gray-500/10';
    case 'external_reported': return 'text-purple-400 border-purple-400/30 bg-purple-500/10';
    case 'disputed': return 'text-rose-400 border-rose-400/30 bg-rose-500/10';
    default: return '';
  }
}

function severityColor(severity: number) {
  if (severity >= 4) return 'text-red-400';
  if (severity >= 3) return 'text-orange-400';
  if (severity >= 2) return 'text-yellow-400';
  return 'text-blue-400';
}

function severityLabel(severity: number) {
  if (severity >= 5) return 'Katastrophal';
  if (severity >= 4) return 'Kritisch';
  if (severity >= 3) return 'Schwer';
  if (severity >= 2) return 'Mittel';
  return 'Leicht';
}

function timeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

function MeldungenContent() {
  const { municipalityRole } = useGame();
  const [tab, setTab] = useState<StatusTab>('offen');
  const [events, setEvents] = useState<VerwaltungEvent[]>([]);
  const [stats, setStats] = useState<MunicipalityStats | null>(null);
  const [companies, setCompanies] = useState<VerwaltungCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<VerwaltungEvent | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [shieldLoading, setShieldLoading] = useState<number | null>(null);
  const [externCount, setExternCount] = useState(0);

  const loadData = useCallback(async (statusFilter: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVerwaltungMeldungen(statusFilter);
      setEvents(data.events);
      setStats(data.stats);
      setCompanies(data.companies);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(STATUS_TAB_MAP[tab]); }, [tab, loadData]);
  useEffect(() => { fetchVerwaltungMeldungen('external_reported,disputed').then(d => setExternCount(d.events.length)).catch(() => {}); }, []);

  const handleBeauftragen = async (eventId: number, companyId: number) => {
    try {
      setActionLoading(true); setError(null);
      const result = await beauftragen(eventId, companyId);
      setSuccess(`Auftrag erstellt: "${result.event_name}" \u2192 ${result.payment.toLocaleString()} CHF`);
      setSelectedEvent(null);
      await loadData(STATUS_TAB_MAP[tab]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler beim Beauftragen'); } finally { setActionLoading(false); }
  };

  const handleSelbstBeheben = async (eventId: number) => {
    try {
      setActionLoading(true); setError(null);
      const result = await selbstBeheben(eventId);
      setSuccess(`Event behoben! Kosten: ${result.cost.toLocaleString()} CHF`);
      setSelectedEvent(null);
      await loadData(STATUS_TAB_MAP[tab]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler beim Beheben'); } finally { setActionLoading(false); }
  };

  const handleNotfallreparatur = async (eventId: number) => {
    try {
      setActionLoading(true); setError(null);
      const result = await notfallreparatur(eventId);
      setSuccess(result.message);
      setSelectedEvent(null);
      await loadData(STATUS_TAB_MAP[tab]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler bei Notfallreparatur'); } finally { setActionLoading(false); }
  };

  const handlePolizeiSchicken = async (eventId: number) => {
    try {
      setActionLoading(true); setError(null);
      const result = await polizeiSchicken(eventId);
      setSuccess(`Polizei unterwegs! Kosten: ${result.cost?.toLocaleString() ?? '?'} CHF`);
      // Optional: Polizei-Auto dispatchen wenn policeStation Koordinaten vorhanden
      if (result.policeStation) {
        const evt = selectedEvent;
        if (evt?.location_x != null && evt?.location_y != null) {
          window.dispatchEvent(new CustomEvent('isocity-dispatch-emergency', {
            detail: { type: 'police_car', targetX: evt.location_x, targetY: evt.location_y }
          }));
        }
      }
      setSelectedEvent(null);
      await loadData(STATUS_TAB_MAP[tab]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler beim Polizei schicken'); } finally { setActionLoading(false); }
  };

  const handleExternalResponse = async (eventId: number, action: 'accept' | 'dispute') => {
    try {
      setActionLoading(true); setError(null);
      const result = await externalResponse(eventId, action);
      setSuccess(result.message || (action === 'accept' ? 'Akzeptiert' : 'Einspruch eingelegt'));
      setSelectedEvent(null);
      await loadData(STATUS_TAB_MAP[tab]);
      fetchVerwaltungMeldungen('external_reported,disputed').then(d => setExternCount(d.events.length)).catch(() => {});
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setActionLoading(false); }
  };

  const handleKaufeSchild = async (days: 1 | 3 | 7) => {
    try {
      setShieldLoading(days); setError(null);
      const result = await kaufeSchutzschild(days);
      setSuccess(result.message);
      await loadData(STATUS_TAB_MAP[tab]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler beim Kauf'); } finally { setShieldLoading(null); }
  };

  const getMatchingCompanies = (event: VerwaltungEvent): VerwaltungCompany[] => {
    if (!event.company_type_required) return companies;
    return companies.filter(c => c.type_code === event.company_type_required);
  };

  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 text-center">
          {[
            { label: 'Sicherheit', value: stats.security, emoji: '\uD83D\uDEE1' },
            { label: 'Attraktivität', value: stats.attractiveness, emoji: '\u2B50' },
            { label: 'Sauberkeit', value: stats.cleanliness, emoji: '\uD83E\uDDF9' },
            { label: 'Infrastruktur', value: stats.infrastructure, emoji: '\uD83C\uDFD7' },
            { label: 'Transparenz', value: stats.transparency, emoji: '\uD83D\uDD0D' },
          ].map(s => {
            const diff = s.value - 50;
            const effectLabel = diff > 0 ? `+${Math.round(diff * 0.3)}` : diff < 0 ? `${Math.round(diff * 0.3)}` : '\u00B10';
            return (
              <div key={s.label} className={`px-1 py-1.5 rounded-lg bg-slate-800/50 border ${
                s.value < 40 ? 'border-red-500/30' : s.value < 50 ? 'border-amber-500/20' : 'border-slate-700'
              }`}>
                <div className="text-[9px] sm:text-[10px] text-slate-400 truncate">{s.emoji} {s.label}</div>
                <div className={`font-mono font-bold text-sm ${
                  s.value >= 60 ? 'text-emerald-400' : s.value >= 40 ? 'text-amber-400' : 'text-red-400'
                }`}>{s.value}</div>
                <div className={`text-[9px] font-mono ${
                  diff > 0 ? 'text-emerald-500/60' : diff < 0 ? 'text-red-500/60' : 'text-slate-600'
                }`}>{effectLabel} Sim</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kantonale Untersuchung */}
      {stats?.cantonal_investigation_until && new Date(stats.cantonal_investigation_until) > new Date() && (
        <div className="p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
          <div className="flex items-center gap-2 font-bold mb-1"><Gavel className="w-4 h-4" /> Kantonale Untersuchung aktiv!</div>
          <p>Event-Rate verdoppelt, Reputation sinkt. Endet in {timeRemaining(stats.cantonal_investigation_until)}.</p>
        </div>
      )}

      {/* Schutzschild */}
      {stats && (() => {
        const shieldUntil = stats.shield_active_until ? new Date(stats.shield_active_until) : null;
        const isActive = shieldUntil && shieldUntil > new Date();
        const remainingMs = isActive ? shieldUntil.getTime() - Date.now() : 0;
        const remainingH = Math.floor(remainingMs / 3600000);
        const remainingD = Math.floor(remainingH / 24);
        const timeStr = remainingD > 0 ? `${remainingD}d ${remainingH % 24}h` : `${remainingH}h`;
        return (
          <div className={`p-2.5 rounded-lg border ${isActive ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800/30 border-slate-700/50'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Shield className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className={isActive ? 'text-blue-300' : 'text-slate-400'}>
                  {isActive ? `Schutzschild aktiv (${timeStr})` : 'Kein Schutzschild'}
                </span>
              </div>
              {isActive && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400 px-1.5 py-0">Debuffs blockiert</Badge>}
            </div>
            <p className="text-[10px] text-slate-500 mb-2">
              {isActive ? 'Abgelaufene Events verursachen keinen Stat-Schaden.' : 'Blockiert Stat-Schaden wenn Events ablaufen. Kaufbar:'}
            </p>
            <div className="flex gap-1.5">
              {([{ days: 1 as const, price: "2'000", label: '1 Tag' }, { days: 3 as const, price: "5'000", label: '3 Tage' }, { days: 7 as const, price: "10'000", label: '7 Tage' }]).map(opt => (
                <Button key={opt.days} size="sm" onClick={() => handleKaufeSchild(opt.days)} disabled={shieldLoading !== null}
                  className="flex-1 h-7 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600">
                  {shieldLoading === opt.days ? <CircleDashed className="w-3 h-3 animate-spin" /> : <>{isActive ? '+' : ''}{opt.label} · {opt.price} CHF</>}
                </Button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Messages */}
      {error && <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
      {success && (
        <div className="px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          {success} <button className="ml-2 underline text-xs" onClick={() => setSuccess(null)}>OK</button>
        </div>
      )}

      {/* Event Detail or Event List */}
      {selectedEvent ? (
        <MeldungEventDetail
          event={selectedEvent}
          companies={getMatchingCompanies(selectedEvent)}
          loading={actionLoading}
          stats={stats}
          onBack={() => setSelectedEvent(null)}
          municipalityRole={municipalityRole}
          onBeauftragen={handleBeauftragen}
          onSelbstBeheben={handleSelbstBeheben}
          onNotfallreparatur={handleNotfallreparatur}
          onPolizeiSchicken={handlePolizeiSchicken}
          onExternalResponse={handleExternalResponse}
        />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)} className="w-full">
          <TabsList className="w-full bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="offen" className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-xs">
              <FileWarning className="w-3.5 h-3.5 mr-1" />Offen
            </TabsTrigger>
            <TabsTrigger value="extern" className="flex-1 data-[state=active]:bg-purple-700 data-[state=active]:text-white text-xs relative">
              <Globe className="w-3.5 h-3.5 mr-1" />Extern
              {externCount > 0 && <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{externCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="in_bearbeitung" className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-xs">
              <Wrench className="w-3.5 h-3.5 mr-1" />Arbeit
            </TabsTrigger>
            <TabsTrigger value="erledigt" className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Erledigt
            </TabsTrigger>
          </TabsList>
          {(['offen', 'extern', 'in_bearbeitung', 'erledigt'] as StatusTab[]).map(tabKey => (
            <TabsContent key={tabKey} value={tabKey}>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400"><CircleDashed className="w-8 h-8 animate-spin" /></div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400/50" />
                  <p className="text-sm">Keine Meldungen in dieser Kategorie</p>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {events.map(event => (
                    <button key={event.id} onClick={() => setSelectedEvent(event)}
                      className="w-full text-left p-3 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{event.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white truncate">{event.name}</div>
                          <div className="text-[10px] text-slate-500">{event.category}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${severityColor(event.severity)}`}>{severityLabel(event.severity)}</Badge>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${meldungStatusColor(event.status)}`}>{meldungStatusLabel(event.status)}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-0.5"><Coins className="w-2.5 h-2.5" />{event.fix_cost.toLocaleString()}</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeRemaining(event.expires_at)}</span>
                        {event.external_reporter_nickname && <span className="text-purple-400">von {event.external_reporter_nickname}</span>}
                        {event.escalation_level > 0 && <span className="text-red-400">Eskaliert ({event.escalation_level}x)</span>}
                        {event.assigned_company_name && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" />{event.assigned_company_name}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function MeldungEventDetail({ event, companies, loading, stats, municipalityRole, onBack, onBeauftragen, onSelbstBeheben, onNotfallreparatur, onPolizeiSchicken, onExternalResponse }: {
  event: VerwaltungEvent; companies: VerwaltungCompany[]; loading: boolean; stats: MunicipalityStats | null;
  municipalityRole: 'owner' | 'council' | 'citizen' | 'observer';
  onBack: () => void; onBeauftragen: (eid: number, cid: number) => void; onSelbstBeheben: (eid: number) => void;
  onNotfallreparatur: (eid: number) => void; onPolizeiSchicken: (eid: number) => void; onExternalResponse: (eid: number, action: 'accept' | 'dispute') => void;
}) {
  const canAct = ['reported', 'external_reported'].includes(event.status);
  const canAfford = stats ? stats.treasury >= event.fix_cost : false;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Zurück zur Liste
      </button>

      <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{event.emoji}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-white">{event.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-xs ${event.severity >= 4 ? 'text-red-400 border-red-400/30' : event.severity >= 3 ? 'text-orange-400 border-orange-400/30' : 'text-yellow-400 border-yellow-400/30'}`}>
                Schwere {event.severity}/5
              </Badge>
              <span className="text-xs text-slate-400">{event.category}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-300 mb-3">{event.description}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-amber-400" /><span className="text-slate-400">Kosten:</span><span className="font-mono font-bold text-amber-400">{event.fix_cost.toLocaleString()}</span></div>
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" /><span className="text-slate-400">Frist:</span><span className="font-mono text-blue-400">{new Date(event.expires_at).getTime() > Date.now() ? `${Math.ceil((new Date(event.expires_at).getTime() - Date.now()) / 3600000)}h` : 'Abgelaufen'}</span></div>
          {event.stat_impact && (() => {
            const statNames: Record<string, { label: string; icon: string }> = { security: { label: 'Sicherheit', icon: '\uD83D\uDEE1' }, attractiveness: { label: 'Attraktivität', icon: '\u2B50' }, cleanliness: { label: 'Sauberkeit', icon: '\uD83E\uDDF9' }, infrastructure: { label: 'Infrastruktur', icon: '\uD83C\uDFD7' }, transparency: { label: 'Transparenz', icon: '\uD83D\uDD0D' } };
            const stat = statNames[event.stat_impact] || { label: event.stat_impact, icon: '\uD83D\uDCCA' };
            const isActive = ['detected', 'reported', 'assigned'].includes(event.status);
            return (
              <div className="p-2 rounded-lg border border-slate-700/50 bg-slate-800/30 space-y-1">
                <div className="flex items-center gap-2 text-xs"><TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" /><span className="text-slate-400">Schaden:</span><span className="text-red-400 font-medium">{stat.icon} {stat.label} {event.stat_damage}</span>{isActive && <span className="text-red-500/60 text-[10px]">(aktiv!)</span>}</div>
                <div className="flex items-center gap-2 text-xs"><TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span className="text-slate-400">Fix-Bonus:</span><span className="text-emerald-400 font-medium">{stat.icon} {stat.label} +{event.stat_fix_bonus}</span></div>
              </div>
            );
          })()}
          {event.location_x !== null && <div className="flex items-center gap-2"><span className="text-slate-400">Ort:</span><span className="font-mono text-slate-300">{event.location_x}, {event.location_y}</span></div>}
          {event.reporter_nickname && <div className="flex items-center gap-2"><span className="text-slate-400">Melder:</span><span className="text-slate-300">{event.reporter_nickname}</span></div>}
        </div>
        {event.assigned_company_name && (
          <div className="mt-3 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-sm">
            <div className="flex items-center gap-2 text-cyan-400"><Building2 className="w-4 h-4" /><span className="font-medium">Beauftragt: {event.company_emoji} {event.assigned_company_name}</span></div>
          </div>
        )}
      </div>

      {event.status === 'external_reported' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-300">
            <div className="flex items-center gap-2 font-bold mb-1"><Globe className="w-4 h-4" /> Externe Meldung</div>
            <p>Ein Bürger einer anderen Gemeinde hat dieses Problem gemeldet.</p>
            {event.external_reporter_nickname && <p className="mt-1">Melder: <span className="font-medium text-purple-200">{event.external_reporter_nickname}</span></p>}
            {event.external_deadline && <p className="mt-1">Frist: <span className="font-mono text-amber-400">{timeRemaining(event.external_deadline)}</span></p>}
            {event.escalation_level > 0 && <p className="mt-1 text-red-400">Eskalationsstufe: {event.escalation_level}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onExternalResponse(event.id, 'accept')} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
              {loading ? <CircleDashed className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Akzeptieren</>}
            </Button>
            <Button onClick={() => onExternalResponse(event.id, 'dispute')} disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs h-8">
              {loading ? <CircleDashed className="w-3.5 h-3.5 animate-spin" /> : <><Gavel className="w-3.5 h-3.5 mr-1" />Einspruch</>}
            </Button>
          </div>
        </div>
      )}

      {event.status === 'disputed' && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300">
          <div className="flex items-center gap-2 font-bold mb-1"><Gavel className="w-4 h-4" /> Einspruch läuft</div>
          <p>Evidence-Score: <span className="font-mono font-bold">{event.evidence_score ?? '?'}/100</span></p>
          {event.dispute_until && <p>Auswertung in: <span className="font-mono">{timeRemaining(event.dispute_until)}</span></p>}
        </div>
      )}

      {canAct && event.status === 'reported' && (
        <div className="space-y-3">
          {companies.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Firma beauftragen</h4>
              {companies.map(company => (
                <button key={company.id} onClick={() => onBeauftragen(event.id, company.id)} disabled={loading}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left">
                  <span className="text-xl">{company.type_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white">{company.name}</div>
                    <div className="text-[10px] text-slate-400">{company.type_name} · Lv. {company.level} · Rep. {company.reputation}</div>
                  </div>
                  <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-2 border border-dashed border-slate-700 rounded-lg">
              Keine passende Firma in der Gemeinde vorhanden
              {event.company_type_required && <div className="text-xs text-slate-500 mt-1">Benoetigt: {event.company_type_required}</div>}
            </div>
          )}
          <div className="pt-2 border-t border-slate-700">
            <Button onClick={() => onSelbstBeheben(event.id)} disabled={loading || !canAfford} className="w-full bg-amber-600 hover:bg-amber-500 text-white">
              {loading ? <CircleDashed className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
              Sofort beheben ({event.fix_cost.toLocaleString()} CHF)
            </Button>
            {!canAfford && stats && <p className="text-xs text-red-400 mt-1 text-center">Nicht genug Geld (Kasse: {stats.treasury.toLocaleString()})</p>}
          </div>
          {['ordnung', 'sicherheit'].includes(event.category) && ['reported', 'external_reported'].includes(event.status) && ['owner', 'admin', 'council'].includes(municipalityRole) && (
            <div className="pt-2 border-t border-slate-700">
              <Button onClick={() => onPolizeiSchicken(event.id)} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-600 text-white">
                {loading ? <CircleDashed className="w-4 h-4 animate-spin mr-2" /> : <span className="mr-2">🚔</span>}
                Polizei schicken (Kosten: {(event.severity * 100).toLocaleString()} CHF)
              </Button>
            </div>
          )}
        </div>
      )}

      {!canAct && !['expired', 'external_reported', 'disputed'].includes(event.status) && (
        <div className={`p-3 rounded-lg border text-sm ${event.status === 'resolved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : event.status === 'assigned' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
          <div className="flex items-center gap-2">
            {event.status === 'resolved' && <CheckCircle2 className="w-4 h-4" />}
            {event.status === 'assigned' && <Wrench className="w-4 h-4" />}
            {event.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
            <span className="font-medium">Status: {event.status === 'resolved' ? `Behoben am ${new Date(event.resolved_at || '').toLocaleDateString('de-CH')}` : event.status === 'assigned' ? 'Firma arbeitet daran...' : meldungStatusLabel(event.status)}</span>
          </div>
        </div>
      )}

      {event.status === 'expired' && (() => {
        const emergencyCost = Math.round(event.fix_cost * 2);
        const canAffordEmergency = stats ? stats.treasury >= emergencyCost : false;
        return (
          <div className="space-y-2">
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
              <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1"><AlertTriangle className="w-4 h-4" />Frist abgelaufen \u2014 Stat-Schaden angewendet!</div>
              <p className="text-xs text-red-300/70">Dieses Event wurde nicht rechtzeitig behoben. Eine Notfallreparatur kann den Schaden teilweise rückgängig machen.</p>
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-2"><Wrench className="w-3.5 h-3.5" />Notfallreparatur verfügbar (2x Kosten)</div>
              <Button onClick={() => onNotfallreparatur(event.id)} disabled={loading || !canAffordEmergency} className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs h-8">
                {loading ? <CircleDashed className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wrench className="w-3.5 h-3.5 mr-1.5" />}
                Notfallreparatur ({emergencyCost.toLocaleString()} CHF)
              </Button>
              {!canAffordEmergency && stats && <p className="text-[10px] text-red-400 mt-1 text-center">Nicht genug Geld (Kasse: {stats.treasury.toLocaleString()} CHF)</p>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Finanzen ───────────────────────────────────────────────

function formatCHF(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('de-CH');
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}

function FinanzenContent({ canManage }: { canManage: boolean }) {
  const { state, setTaxRate, setBudgetFunding, setSocialContributionRate, setWelfarePerUnemployed } = useGame();
  const [draftTaxRate, setDraftTaxRate] = useState<number>(Math.round(state.taxRate || 0));
  const [financeSubTab, setFinanceSubTab] = useState<'tax_budget' | 'bank_ledger' | 'company_loans' | 'social_fund'>('tax_budget');
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerResponse | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [loading, setLoading] = useState(true);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusResult, ledgerResult] = await Promise.allSettled([
        getBankStatus(),
        getLedger(15, 0, ledgerFilter),
      ]);
      if (statusResult.status === 'fulfilled') setBankStatus(statusResult.value);
      if (ledgerResult.status === 'fulfilled') setLedgerData(ledgerResult.value);
      if (statusResult.status === 'rejected') {
        setActionMsg({ type: 'err', text: 'Fehler beim Laden des Bank-Status' });
      }
      if (ledgerResult.status === 'rejected') {
        const errMsg = ledgerResult.reason instanceof Error ? ledgerResult.reason.message : 'Fehler beim Laden der Buchungen';
        setActionMsg({ type: 'err', text: errMsg });
      }
    } finally {
      setLoading(false);
    }
  }, [ledgerFilter]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    setDraftTaxRate(Math.round(state.taxRate || 0));
  }, [state.taxRate]);

  const handleTakeLoan = async () => {
    const amt = Math.round(Number(loanAmount) || 0);
    if (amt <= 0) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await takeLoan(amt);
      setLoanDialogOpen(false);
      setLoanAmount('');
      setActionMsg({ type: 'ok', text: `Kredit von Fr. ${amt.toLocaleString('de-CH')} aufgenommen` });
      await loadData();
    } catch (err: unknown) {
      setActionMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepay = async (amount: number | 'all') => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const result = await repayLoan(amount);
      setActionMsg({ type: 'ok', text: `Fr. ${(result.paid || 0).toLocaleString('de-CH')} zurückgezahlt` });
      await loadData();
    } catch (err: unknown) {
      setActionMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <div className="w-5 h-5 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">Laden...</span>
      </div>
    );
  }

  if (!bankStatus) {
    return <div className="text-center py-12 text-slate-500 text-sm">Keine Finanzdaten verfügbar</div>;
  }

  const debtPercent = bankStatus.creditLimit > 0
    ? Math.min(100, Math.round((bankStatus.debt / bankStatus.creditLimit) * 100))
    : 0;
  const availableCredit = Math.max(0, bankStatus.creditLimit - bankStatus.debt);
  const netIncome = state.stats.income - state.stats.expenses;
  const taxIncome = state.stats.tax_income || 0;
  const populationTaxIncome = state.stats.tax_income_population || 0;
  const businessTaxIncome = state.stats.tax_income_business || 0;
  const propertyTaxIncome = state.stats.tax_income_property || 0;
  const buildingIncome = state.stats.building_income || 0;
  const budgetExpense = state.stats.budget_expenses || 0;
  const maintenanceExpense = state.stats.maintenance_expenses || 0;
  const administrationBaseExpense = state.stats.administration_base_expenses || 0;
  const civicOverheadExpense = state.stats.civic_overhead_expenses || 0;
  const utilityOverheadExpense = state.stats.utility_overhead_expenses || 0;
  const budgetCategories = [
    { key: 'police', ...state.budget.police },
    { key: 'fire', ...state.budget.fire },
    { key: 'health', ...state.budget.health },
    { key: 'education', ...state.budget.education },
    { key: 'transportation', ...state.budget.transportation },
    { key: 'parks', ...state.budget.parks },
    { key: 'power', ...state.budget.power },
    { key: 'water', ...state.budget.water },
  ] as const;
  const serverBudgetCostByKey: Record<string, number> = {
    police: Number((state.stats as any).budget_cost_police || 0),
    fire: Number((state.stats as any).budget_cost_fire || 0),
    health: Number((state.stats as any).budget_cost_health || 0),
    education: Number((state.stats as any).budget_cost_education || 0),
    transportation: Number((state.stats as any).budget_cost_transportation || 0),
    parks: Number((state.stats as any).budget_cost_parks || 0),
    power: Number((state.stats as any).budget_cost_power || 0),
    water: Number((state.stats as any).budget_cost_water || 0),
  };
  const fundingBand = (funding: number): 'kritisch' | 'niedrig' | 'stabil' | 'hoch' => {
    if (funding < 40) return 'kritisch';
    if (funding < 70) return 'niedrig';
    if (funding <= 110) return 'stabil';
    return 'hoch';
  };
  const fundingBandStyle = (band: ReturnType<typeof fundingBand>) => {
    if (band === 'kritisch') return 'text-red-400';
    if (band === 'niedrig') return 'text-amber-400';
    if (band === 'hoch') return 'text-cyan-300';
    return 'text-emerald-400';
  };
  const fundingHint = (key: string, funding: number) => {
    const band = fundingBand(funding);
    const impactStrength = band === 'kritisch' ? 'stark' : band === 'niedrig' ? 'spuerbar' : band === 'hoch' ? 'hoch' : 'normal';
    if (key === 'police') return `Sicherheit (${impactStrength})`;
    if (key === 'fire') return `Brandschutz (${impactStrength})`;
    if (key === 'health') return `Gesundheit/Zufriedenheit (${impactStrength})`;
    if (key === 'education') return `Bildung/Zufriedenheit (${impactStrength})`;
    if (key === 'transportation') return 'Aktuell vor allem Kostensteuerung';
    if (key === 'parks') return 'Aktuell vor allem Kostensteuerung';
    if (key === 'power') return 'Aktuell vor allem Kostensteuerung';
    if (key === 'water') return 'Aktuell vor allem Kostensteuerung';
    return 'Wirkung wird simuliert';
  };

  return (
    <div className="px-3 sm:px-6 py-3 sm:py-5 space-y-3 sm:space-y-5">
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFinanceSubTab('tax_budget')}
          className={`flex-1 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all shrink-0 ${
            financeSubTab === 'tax_budget'
              ? 'bg-slate-700/80 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Steuer & Budget
        </button>
        <button
          onClick={() => setFinanceSubTab('bank_ledger')}
          className={`flex-1 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all shrink-0 ${
            financeSubTab === 'bank_ledger'
              ? 'bg-slate-700/80 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Bank & Buchungen
        </button>
        <button
          onClick={() => setFinanceSubTab('company_loans')}
          className={`flex-1 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all shrink-0 ${
            financeSubTab === 'company_loans'
              ? 'bg-slate-700/80 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Firma-Kredite
        </button>
        <button
          onClick={() => setFinanceSubTab('social_fund')}
          className={`flex-1 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all shrink-0 ${
            financeSubTab === 'social_fund'
              ? 'bg-slate-700/80 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Sozialkasse
        </button>
      </div>

      {financeSubTab === 'tax_budget' && (
      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 rounded-xl border border-slate-700/50 bg-slate-800/25">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Steuer & Budget</span>
          <span className="text-xs text-slate-500">Gemeinde-Regler</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Steuersatz</span>
            <span className="font-mono text-cyan-300">{Math.round(draftTaxRate)}%</span>
          </div>
          <Slider
            value={[draftTaxRate]}
            onValueChange={(value) => setDraftTaxRate(Math.round(Number(value?.[0] || 0)))}
            onValueCommit={(value) => {
              const next = Math.round(Number(value?.[0] || 0));
              setDraftTaxRate(next);
              setTaxRate(next);
            }}
            min={0}
            max={100}
            step={1}
            disabled={!canManage}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 sm:p-2.5">
            <div className="text-[10px] sm:text-[11px] text-slate-500">Einkommen</div>
            <div className="text-emerald-400 font-mono text-xs sm:text-sm">+{state.stats.income.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 sm:p-2.5">
            <div className="text-[10px] sm:text-[11px] text-slate-500">Ausgaben</div>
            <div className="text-red-400 font-mono text-xs sm:text-sm">-{state.stats.expenses.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 sm:p-2.5">
            <div className="text-[10px] sm:text-[11px] text-slate-500">Netto</div>
            <div className={`font-mono text-xs sm:text-sm ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netIncome >= 0 ? '+' : ''}{netIncome.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="text-xs text-slate-400">Einnahmen-Aufschlüsselung pro Tag</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Steuern gesamt</span>
            <span className="font-mono text-emerald-400">{taxIncome.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">- Einwohnersteuer</span>
            <span className="font-mono text-emerald-400">{populationTaxIncome.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">- Firmensteuer (v1)</span>
            <span className="font-mono text-emerald-400">{businessTaxIncome.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">- Grundsteuer</span>
            <span className="font-mono text-emerald-400">{propertyTaxIncome.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Gebäude-Einnahmen</span>
            <span className="font-mono text-emerald-400">{buildingIncome.toLocaleString()} CHF</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="text-xs text-slate-400">Ausgaben-Aufschlüsselung pro Tag</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Budget (Regler)</span>
            <span className="font-mono text-red-400">{budgetExpense.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Gebäude-Wartung</span>
            <span className="font-mono text-red-400">{maintenanceExpense.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Basis-Verwaltung</span>
            <span className="font-mono text-red-400">{administrationBaseExpense.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Bürger-/Job-Overhead</span>
            <span className="font-mono text-red-400">{civicOverheadExpense.toLocaleString()} CHF</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Strom/Wasser Betrieb</span>
            <span className="font-mono text-red-400">{utilityOverheadExpense.toLocaleString()} CHF</span>
          </div>
        </div>

        {/* Strom-Status */}
        <div className="space-y-1 pt-1">
          <div className="text-xs text-slate-400">Stromversorgung</div>
          <PowerStatusWidget />
        </div>

        {/* Wasser-Status */}
        <div className="space-y-1 pt-1">
          <div className="text-xs text-slate-400">Wasserversorgung</div>
          <WaterStatusWidget />
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-xs text-slate-400">Budget-Finanzierung</div>
          {budgetCategories.map((cat) => (
            <div key={cat.key} className="space-y-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="w-14 sm:w-24 text-[11px] sm:text-xs text-slate-400 truncate">{cat.name}</span>
                <Slider
                  value={[cat.funding]}
                  onValueChange={(value) => setBudgetFunding(cat.key as keyof typeof state.budget, value[0])}
                  min={0}
                  max={100}
                  step={5}
                  disabled={!canManage}
                  className="flex-1"
                />
                <span className="w-10 sm:w-12 text-right text-xs font-mono text-slate-300">{cat.funding}%</span>
              </div>
              <div className="ml-14 sm:ml-24 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] sm:text-[11px] gap-0.5">
                <span className={fundingBandStyle(fundingBand(cat.funding))}>
                  {fundingHint(cat.key, cat.funding)}
                </span>
                <span className="font-mono text-slate-500">
                  {Math.round((Number(serverBudgetCostByKey[cat.key] || 0) * Number(cat.funding || 0)) / 100).toLocaleString()} CHF/Tag
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {financeSubTab === 'bank_ledger' && (
      <>
      {/* Status Messages */}
      {actionMsg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
          actionMsg.type === 'ok'
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {actionMsg.type === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* Finance Overview Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-medium">Kontostand</span>
          </div>
          <span className="text-sm sm:text-lg font-bold text-emerald-300">
            Fr. {bankStatus.treasury.toLocaleString('de-CH')}
          </span>
        </div>

        <div className={`p-2.5 sm:p-3.5 rounded-xl border ${bankStatus.debt > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30'}`}>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
            <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-medium">Schulden</span>
          </div>
          <span className={`text-sm sm:text-lg font-bold ${bankStatus.debt > 0 ? 'text-red-300' : 'text-slate-500'}`}>
            Fr. {bankStatus.debt.toLocaleString('de-CH')}
          </span>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-medium">Einnahmen/T</span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-emerald-300">
            +Fr. {bankStatus.dailyIncome.toLocaleString('de-CH')}
          </span>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
            <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-medium">Ausgaben/T</span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-red-300">
            -Fr. {bankStatus.dailyExpenses.toLocaleString('de-CH')}
          </span>
        </div>
      </div>

      {/* Credit Limit Bar */}
      <div className="p-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Kreditrahmen</span>
          <span className="text-xs text-slate-400 font-mono">
            {bankStatus.debt.toLocaleString('de-CH')} / {bankStatus.creditLimit.toLocaleString('de-CH')} CHF
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              debtPercent > 80 ? 'bg-red-500/80' : debtPercent > 50 ? 'bg-orange-500/80' : 'bg-blue-500/60'
            }`}
            style={{ width: `${debtPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-slate-600">Verfuegbar: Fr. {availableCredit.toLocaleString('de-CH')}</span>
          {bankStatus.nextInterestEstimate > 0 && (
            <span className="text-[11px] text-red-400/70 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Zinsen: ~Fr. {bankStatus.nextInterestEstimate.toLocaleString('de-CH')}/Tag
            </span>
          )}
        </div>
      </div>

      {/* Loan Actions (only for Owner/Council) */}
      {canManage && (
        <div className="flex gap-2">
          {!loanDialogOpen ? (
            <>
              <Button
                size="sm"
                onClick={() => setLoanDialogOpen(true)}
                disabled={actionLoading}
                className="flex-1 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-500/50"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                Kredit aufnehmen
              </Button>
              {bankStatus.debt > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleRepay('all')}
                  disabled={actionLoading || bankStatus.treasury <= 0}
                  className="flex-1 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-500/50 disabled:opacity-50"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Schulden zahlen
                </Button>
              )}
            </>
          ) : (
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  placeholder={`Max. ${availableCredit.toLocaleString('de-CH')} CHF`}
                  className="h-9 text-sm bg-slate-800/60 border-slate-700/70 text-white placeholder:text-slate-600"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleTakeLoan}
                  disabled={actionLoading || !loanAmount || Number(loanAmount) <= 0}
                  className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 disabled:opacity-50 whitespace-nowrap"
                >
                  {actionLoading ? '...' : 'Aufnehmen'}
                </Button>
                <button
                  onClick={() => { setLoanDialogOpen(false); setLoanAmount(''); }}
                  className="p-2 rounded-md hover:bg-slate-700/60 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-1.5">
                {[10000, 25000, 50000].filter(v => v <= availableCredit).map(v => (
                  <button
                    key={v}
                    onClick={() => setLoanAmount(String(v))}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-700/60 text-slate-400 hover:bg-slate-600/80 hover:text-white border border-slate-600/40 transition-colors"
                  >
                    {(v / 1000)}k
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ledger */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">Buchungen</span>
          <div className="flex gap-1 bg-slate-800/60 rounded-lg p-0.5">
            {(['all', 'income', 'expense'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLedgerFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  ledgerFilter === f
                    ? 'bg-slate-700/80 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? 'Alle' : f === 'income' ? 'Einnahmen' : 'Ausgaben'}
              </button>
            ))}
          </div>
        </div>

        {ledgerData && ledgerData.entries.length > 0 ? (
          <div className="space-y-1.5">
            {ledgerData.entries.map((entry: LedgerEntry) => {
              const typeInfo = LEDGER_TYPE_LABELS[entry.type] || { label: entry.type, color: 'text-slate-400' };
              const isPositive = entry.amount >= 0;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-700/30 bg-slate-800/20 hover:bg-slate-800/40 transition-colors"
                >
                  <div className={`w-1 h-8 rounded-full shrink-0 ${isPositive ? 'bg-emerald-500/60' : 'bg-red-500/60'}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(entry.ts).toLocaleString('de-CH', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCHF(entry.amount)}
                  </span>
                </div>
              );
            })}
            {ledgerData.hasMore && (
              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-600">
                  {ledgerData.total} Einträge insgesamt
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 text-sm">
            Keine Buchungen vorhanden
          </div>
        )}
      </div>
      </>
      )}

      {financeSubTab === 'company_loans' && (
        <CompanyLoanManagement canManage={canManage} />
      )}

      {financeSubTab === 'social_fund' && (
        <SozialkasseContent canManage={canManage} />
      )}
    </div>
  );
}

// ── Sozialkasse (ALV-Style Social Fund) ──────────────────────

function SozialkasseContent({ canManage }: { canManage: boolean }) {
  const { state, setSocialContributionRate, setWelfarePerUnemployed } = useGame();
  const stats = state.stats as any;
  const socialFund = Number(stats.social_fund || 0);
  const socialContributionRate = Number(stats.social_contribution_rate ?? 5);
  const welfarePerUnemployed = Number(stats.welfare_per_unemployed ?? 8);
  const socialFundIncome = Number(stats.social_fund_income || 0);
  const socialFundExpenses = Number(stats.social_fund_expenses || 0);
  const socialExpenses = Number(stats.social_expenses || 0);
  const welfareCoverage = Number(stats.welfare_coverage ?? 100);
  const unemployed = Number(stats.unemployed || 0);
  const unemploymentRate = Number(stats.unemployment_rate || 0);
  const population = Number(stats.population || 0);
  const employed = Number(stats.employed || 0);
  const workforce = Number(stats.workforce || 0);
  const workforceRate = Number(stats.workforce_rate || 0);
  const children = Number(stats.children || 0);
  const seniors = Number(stats.seniors || 0);
  const students = Number(stats.students || 0);
  const jobs = Number(stats.jobs || 0);
  const schoolCapacity = Number(stats.school_capacity || 0);
  const uniCapacity = Number(stats.uni_capacity || 0);
  const educationOvercrowding = Number(stats.education_overcrowding || 0);
  const healthCapacity = Number(stats.health_capacity || 0);
  const healthDemand = Number(stats.health_demand || 0);
  const healthAdequacy = Number(stats.health_adequacy || 0);

  const [draftContribRate, setDraftContribRate] = useState(socialContributionRate);
  const [draftWelfare, setDraftWelfare] = useState(welfarePerUnemployed);

  useEffect(() => { setDraftContribRate(socialContributionRate); }, [socialContributionRate]);
  useEffect(() => { setDraftWelfare(welfarePerUnemployed); }, [welfarePerUnemployed]);

  const fundHealthColor = socialFund > 5000 ? 'text-emerald-400' : socialFund > 1000 ? 'text-amber-400' : 'text-red-400';
  const coverageColor = welfareCoverage >= 100 ? 'text-emerald-400' : welfareCoverage >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 rounded-xl border border-slate-700/50 bg-slate-800/25">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Sozialkasse (ALV)</span>
        <span className="text-xs text-slate-500">Arbeitslosenversicherung</span>
      </div>

      {/* Status-Karten */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 sm:p-2.5">
          <div className="text-[10px] sm:text-[11px] text-slate-500">Kassenstand</div>
          <div className={`font-mono text-xs sm:text-sm ${fundHealthColor}`}>
            {Math.round(socialFund).toLocaleString('de-CH')} CHF
          </div>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 sm:p-2.5">
          <div className="text-[10px] sm:text-[11px] text-slate-500">Arbeitslose</div>
          <div className="text-orange-400 font-mono text-xs sm:text-sm">
            {unemployed.toLocaleString('de-CH')} ({unemploymentRate.toFixed(1)}%)
          </div>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-2 sm:p-2.5">
          <div className="text-[10px] sm:text-[11px] text-slate-500">Deckungsgrad</div>
          <div className={`font-mono text-xs sm:text-sm ${coverageColor}`}>
            {welfareCoverage}%
          </div>
        </div>
      </div>

      {/* Bevoelkerungs-Demographie */}
      <div className="space-y-1.5 pt-1">
        <div className="text-xs text-slate-400">Bev&ouml;lkerungsstruktur</div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Einwohner gesamt</span>
          <span className="font-mono text-white">{population.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Kinder (0-15)</span>
          <span className="font-mono text-blue-300">{children.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Sch&uuml;ler/Studenten</span>
          <span className="font-mono text-blue-300">{students.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Senioren (65+)</span>
          <span className="font-mono text-blue-300">{seniors.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-slate-700/40 pt-1">
          <span className="text-slate-400">Erwerbsf&auml;hige ({workforceRate.toFixed(1)}%)</span>
          <span className="font-mono text-white">{workforce.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-500">Angestellt</span>
          <span className="font-mono text-emerald-400">{employed.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-orange-500">Arbeitslos</span>
          <span className="font-mono text-orange-400">{unemployed.toLocaleString('de-CH')} ({unemploymentRate.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Verf&uuml;gbare Stellen</span>
          <span className="font-mono text-cyan-300">{jobs.toLocaleString('de-CH')}</span>
        </div>
      </div>

      {/* Bildungskapazitaet */}
      <div className="space-y-1.5 pt-1">
        <div className="text-xs text-slate-400">Bildungskapazit&auml;t</div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Schulpl&auml;tze</span>
          <span className="font-mono text-blue-300">{schoolCapacity.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Uni-Pl&auml;tze</span>
          <span className="font-mono text-blue-300">{uniCapacity.toLocaleString('de-CH')}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-slate-700/40 pt-1">
          <span className="text-slate-400">Auslastung</span>
          <span className={`font-mono text-xs ${educationOvercrowding >= 80 ? 'text-emerald-400' : educationOvercrowding >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {educationOvercrowding.toFixed(0)}%
          </span>
        </div>
        {educationOvercrowding < 80 && educationOvercrowding > 0 && (
          <div className="text-[10px] text-amber-400/80">
            Zu wenig Schulen/Unis! Mehr bauen oder upgraden (h&ouml;heres Level = mehr Pl&auml;tze).
          </div>
        )}
      </div>

      {/* Gesundheitsversorgung */}
      <div className="space-y-1.5 pt-1">
        <div className="text-xs text-slate-400">Gesundheitsversorgung</div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Kapazit&auml;t</span>
          <span className="font-mono text-blue-300">{healthCapacity.toLocaleString('de-CH')} Pat.</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Bedarf</span>
          <span className="font-mono text-slate-300">{healthDemand.toLocaleString('de-CH')} Pat.</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-slate-700/40 pt-1">
          <span className="text-slate-400">Deckungsgrad</span>
          <span className={`font-mono text-xs ${healthAdequacy >= 80 ? 'text-emerald-400' : healthAdequacy >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {healthAdequacy.toFixed(0)}%
          </span>
        </div>
        {healthAdequacy < 80 && healthAdequacy > 0 && (
          <div className="text-[10px] text-amber-400/80">
            Gesundheitsversorgung unzureichend! Happiness sinkt. Mehr Spit&auml;ler bauen oder upgraden.
          </div>
        )}
        {seniors > 0 && (
          <div className="text-[10px] text-slate-500">
            Senioren belasten das System 3x mehr ({seniors.toLocaleString('de-CH')} Senioren).
          </div>
        )}
      </div>

      {/* Einnahmen/Ausgaben der Kasse */}
      <div className="space-y-1.5 pt-1">
        <div className="text-xs text-slate-400">Sozialkasse pro Tag</div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Sozialabgaben (Einzahlung)</span>
          <span className="font-mono text-emerald-400">+{socialFundIncome.toLocaleString('de-CH')} CHF</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Sozialhilfe (Auszahlung)</span>
          <span className="font-mono text-red-400">-{socialFundExpenses.toLocaleString('de-CH')} CHF</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-slate-700/40 pt-1">
          <span className="text-slate-400">Belastung Stadtkasse</span>
          <span className="font-mono text-red-400">-{socialExpenses.toLocaleString('de-CH')} CHF/Tag</span>
        </div>
      </div>

      {/* Warnung bei schlechter Deckung */}
      {welfareCoverage < 100 && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
          Sozialkasse unterfinanziert! Nur {welfareCoverage}% der Sozialhilfe werden ausbezahlt.
          {welfareCoverage < 50 && ' Obdachlosigkeit und Kriminalit\u00e4t steigen.'}
        </div>
      )}

      {unemploymentRate > 15 && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs">
          Hohe Arbeitslosigkeit ({unemploymentRate.toFixed(1)}%)! Bevölkerungswachstum gebremst. Mehr Gewerbe-/Industriezonen bauen.
        </div>
      )}

      {/* Regler: Sozialabgabe-Satz */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Sozialabgabe-Satz</span>
          <span className="font-mono text-cyan-300">{draftContribRate}%</span>
        </div>
        <Slider
          value={[draftContribRate]}
          onValueChange={(value) => setDraftContribRate(Math.round(Number(value?.[0] || 0)))}
          onValueCommit={(value) => {
            const next = Math.round(Number(value?.[0] || 0));
            setDraftContribRate(next);
            setSocialContributionRate(next);
          }}
          min={0}
          max={15}
          step={1}
          disabled={!canManage}
        />
        <div className="text-[10px] text-slate-500">
          Anteil der Steuereinnahmen, der in die Sozialkasse fliesst.
          {draftContribRate === 0 && ' Keine Einzahlungen — Kasse wird aufgebraucht!'}
          {draftContribRate >= 10 && ' Hohe Abgabe — belastet die Stadtkasse stark.'}
        </div>
      </div>

      {/* Regler: Sozialhilfe pro Kopf */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Sozialhilfe pro Arbeitslosem</span>
          <span className="font-mono text-cyan-300">{draftWelfare} CHF/Tag</span>
        </div>
        <Slider
          value={[draftWelfare]}
          onValueChange={(value) => setDraftWelfare(Math.round(Number(value?.[0] || 0)))}
          onValueCommit={(value) => {
            const next = Math.round(Number(value?.[0] || 0));
            setDraftWelfare(next);
            setWelfarePerUnemployed(next);
          }}
          min={0}
          max={50}
          step={1}
          disabled={!canManage}
        />
        <div className="text-[10px] text-slate-500">
          {draftWelfare === 0 && 'Keine Sozialhilfe — Arbeitslose werden obdachlos!'}
          {draftWelfare > 0 && draftWelfare <= 10 && 'Minimale Grundversorgung.'}
          {draftWelfare > 10 && draftWelfare <= 25 && 'Solide Versorgung — Zufriedenheit stabil.'}
          {draftWelfare > 25 && 'Grossz\u00fcgige Sozialhilfe — teuer aber beliebt.'}
        </div>
      </div>
    </div>
  );
}

// ── Firma-Kredit-Verwaltung ──────────────────────────────────

function CompanyLoanManagement({ canManage }: { canManage: boolean }) {
  const [pendingRequests, setPendingRequests] = useState<CompanyLoanRequest[]>([]);
  const [interestRate, setInterestRate] = useState<number>(0.001);
  const [draftRate, setDraftRate] = useState<number>(0.1);
  const [savingRate, setSavingRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const rateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqsResult, settingsResult] = await Promise.allSettled([
        getPendingLoanRequests(),
        getCompanyLoanSettings(),
      ]);
      if (reqsResult.status === 'fulfilled') setPendingRequests(reqsResult.value);
      if (settingsResult.status === 'fulfilled') {
        const rate = settingsResult.value.interest_rate;
        setInterestRate(rate);
        setDraftRate(Math.round(rate * 10000) / 100); // 0.001 → 0.1%
      }
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      setMsg(null);
      const result = await approveLoanRequest(requestId);
      setMsg({ type: 'ok', text: `Kredit genehmigt! "${result.company_name}" wurde gegründet.` });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: unknown) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      setMsg(null);
      await rejectLoanRequest(requestId, rejectReason || undefined);
      setMsg({ type: 'ok', text: 'Kredit-Antrag abgelehnt.' });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setRejectId(null);
      setRejectReason('');
    } catch (err: unknown) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler' });
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-Save Zinssatz mit Debounce (500ms nach letzter Slider-Aenderung)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const newRate = Math.max(0, Math.min(5, draftRate)) / 100;
    if (Math.abs(newRate - interestRate) < 0.000001) return;
    if (rateTimerRef.current) clearTimeout(rateTimerRef.current);
    rateTimerRef.current = setTimeout(async () => {
      try {
        setSavingRate(true);
        const result = await updateCompanyLoanSettings(newRate);
        setInterestRate(result.interest_rate);
      } catch (err: unknown) {
        setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler beim Speichern' });
      } finally {
        setSavingRate(false);
      }
    }, 500);
    return () => { if (rateTimerRef.current) clearTimeout(rateTimerRef.current); };
  }, [draftRate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <div className="w-5 h-5 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">Laden...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === 'ok'
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {msg.type === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{msg.text}</span>
          <button className="text-xs underline opacity-60 hover:opacity-100" onClick={() => setMsg(null)}>OK</button>
        </div>
      )}

      {/* Zinssatz-Einstellung */}
      {canManage && (
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/25 space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">Firma-Kredit-Zinssatz</span>
          </div>
          <p className="text-xs text-slate-500">
            Wöchentlicher Zinssatz für neue Firma-Kredite. Bestehende Kredite behalten ihren Satz.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Slider
                value={[draftRate]}
                onValueChange={([v]) => setDraftRate(Math.round(v * 100) / 100)}
                min={0}
                max={5}
                step={0.1}
                className="w-full"
              />
            </div>
            <div className="min-w-[60px] text-right">
              <span className="font-mono text-sm text-amber-400 font-bold">{draftRate.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>0% (gratis)</span>
            <span className="flex items-center gap-1.5">
              {savingRate && (
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Speichern...
                </span>
              )}
              <span>5% (max)</span>
            </span>
          </div>
        </div>
      )}

      {/* Offene Kredit-Anträge */}
      <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/25 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Kredit-Anträge</span>
          {pendingRequests.length > 0 && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[11px]">{pendingRequests.length}</Badge>
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Keine offenen Anträge</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="rounded-lg border border-slate-700/40 bg-slate-900/30 overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{req.type_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-white">{req.company_name}</div>
                      <div className="text-xs text-slate-500">
                        von <span className="text-slate-300">{req.requester_nickname}</span> · {req.type_name}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs mb-2">
                    <div className="px-1.5 sm:px-2 py-1 sm:py-1.5 rounded bg-slate-800/60 border border-slate-700/50 text-center">
                      <div className="text-slate-500">Kredit</div>
                      <div className="font-mono text-amber-400 font-bold">{req.loan_amount.toLocaleString()}</div>
                    </div>
                    <div className="px-1.5 sm:px-2 py-1 sm:py-1.5 rounded bg-slate-800/60 border border-slate-700/50 text-center">
                      <div className="text-slate-500">Rate/Wo</div>
                      <div className="font-mono text-white font-bold">{req.weekly_repayment.toLocaleString()}</div>
                    </div>
                    <div className="px-1.5 sm:px-2 py-1 sm:py-1.5 rounded bg-slate-800/60 border border-slate-700/50 text-center">
                      <div className="text-slate-500">Zins</div>
                      <div className="font-mono text-white font-bold">{(req.interest_rate * 100).toFixed(1)}%</div>
                    </div>
                  </div>

                  {req.message && (
                    <p className="text-xs text-slate-400 italic mb-2 px-1">&quot;{req.message}&quot;</p>
                  )}

                  {rejectId === req.id ? (
                    <div className="space-y-2">
                      <Input
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Ablehnungsgrund (optional)"
                        maxLength={500}
                        className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm h-9"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs"
                        >
                          {actionLoading === req.id ? '...' : 'Ablehnen'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectId(null); setRejectReason(''); }}
                          className="border-slate-600 text-slate-400 text-xs"
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      >
                        {actionLoading === req.id ? '...' : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Genehmigen
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectId(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Ablehnen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const BAUZONE_MODE_OPTIONS: { value: BauzoneMode; label: string; description: string }[] = [
  { value: 'disabled', label: 'Deaktiviert', description: 'Keine Bauzone-Einschränkung. Jeder kann überall bauen.' },
  { value: 'members', label: 'Nur Mitglieder', description: 'Bürger müssen innerhalb der Bauzonen bauen. Gemeinderat und Präsident sind frei.' },
  { value: 'all', label: 'Für alle', description: 'Alle müssen in Bauzonen bauen. Nur der Gemeindepräsident ist frei.' },
];

function BauzoneSettings({ slug, canManage, onModeChange }: { slug: string; canManage: boolean; onModeChange?: (mode: BauzoneMode) => void }) {
  const [mode, setMode] = useState<BauzoneMode>('disabled');
  const [savedMode, setSavedMode] = useState<BauzoneMode>('disabled');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getZoneSettings(slug)
      .then(d => { setMode(d.bauzone_mode); setSavedMode(d.bauzone_mode); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSave = async () => {
    if (!canManage || mode === savedMode) return;
    setSaving(true);
    setMsg(null);
    try {
      await updateZoneSettings(slug, mode);
      setSavedMode(mode);
      onModeChange?.(mode);
      setMsg({ type: 'ok', text: 'Gespeichert' });
    } catch (err: unknown) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <div className="w-5 h-5 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">Laden...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Bauzonen-Modus</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Bestimmt, wer sich an die Bauzone-Einschraenkungen halten muss. Bauzonen markieren Bereiche, in denen gebaut werden darf.
        </p>

        <div className="space-y-2">
          {BAUZONE_MODE_OPTIONS.map(opt => {
            const isSelected = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => canManage && setMode(opt.value)}
                disabled={!canManage}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-cyan-500/40 bg-cyan-500/10 ring-1 ring-cyan-500/20'
                    : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/60 hover:bg-slate-800/50'
                } ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                      {opt.label}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {canManage && mode !== savedMode && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 hover:border-cyan-500/50 disabled:opacity-50"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
          <button
            onClick={() => setMode(savedMode)}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
          >
            Abbrechen
          </button>
        </div>
      )}

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === 'ok'
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/25 text-red-400'
        }`}>
          {msg.type === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Election Tab ─────────────────────────────────────────────────────────────

const ELECTION_LABELS: Record<string, Record<string, string>> = {
  de: {
    tab_election: 'Wahl',
    tab_loading: 'Laden...',
    no_municipality: 'Keine Gemeinde zugeordnet',
    election: 'Wahl',
    no_election: 'Keine laufende Wahl',
    start_election: 'Wahl ausrufen',
    candidates_phase: 'Kandidaturphase',
    voting_phase: 'Abstimmungsphase',
    closed: 'Wahl abgeschlossen',
    cancelled: 'Wahl abgebrochen',
    until: 'bis',
    candidates: 'Kandidaten',
    no_candidates: 'Noch keine Kandidaten',
    register: 'Kandidieren',
    withdraw: 'Zurückziehen',
    vote: 'Abstimmen',
    voted: 'Abgestimmt',
    winner: 'Gewählt',
    triggered_inactivity: 'Ausgelöst durch Inaktivität des Bürgermeisters',
    triggered_council: 'Ausgelöst durch Gemeinderatsbeschluss',
    triggered_admin: 'Ausgelöst durch Admin',
    no_confidence: 'Misstrauensvotum',
    no_confidence_hint: 'Misstrauensvotum gegen Bürgermeister einleiten (Gemeinderat)',
    votes: 'Stimmen',
    loading: 'Laden...',
    error_load: 'Fehler beim Laden',
    days_left: 'Tage verbleibend',
    hours_left: 'Stunden verbleibend',
  },
  en: {
    tab_election: 'Election',
    tab_loading: 'Loading...',
    no_municipality: 'No municipality assigned',
    election: 'Election',
    no_election: 'No active election',
    start_election: 'Call election',
    candidates_phase: 'Candidacy phase',
    voting_phase: 'Voting phase',
    closed: 'Election closed',
    cancelled: 'Election cancelled',
    until: 'until',
    candidates: 'Candidates',
    no_candidates: 'No candidates yet',
    register: 'Run for office',
    withdraw: 'Withdraw',
    vote: 'Vote',
    voted: 'Voted',
    winner: 'Elected',
    triggered_inactivity: 'Triggered by mayor inactivity',
    triggered_council: 'Triggered by council vote',
    triggered_admin: 'Triggered by admin',
    no_confidence: 'No-confidence vote',
    no_confidence_hint: 'Initiate no-confidence vote against mayor (council only)',
    votes: 'votes',
    loading: 'Loading...',
    error_load: 'Error loading',
    days_left: 'days remaining',
    hours_left: 'hours remaining',
  },
  fr: {
    tab_election: 'Élection',
    tab_loading: 'Chargement...',
    no_municipality: 'Aucune commune assignée',
    election: 'Élection',
    no_election: 'Aucune élection en cours',
    start_election: 'Lancer une élection',
    candidates_phase: 'Phase de candidature',
    voting_phase: 'Phase de vote',
    closed: 'Élection terminée',
    cancelled: 'Élection annulée',
    until: "jusqu'au",
    candidates: 'Candidats',
    no_candidates: 'Aucun candidat',
    register: 'Se présenter',
    withdraw: 'Retirer',
    vote: 'Voter',
    voted: 'Voté',
    winner: 'Élu',
    triggered_inactivity: "Déclenché par l'inactivité du maire",
    triggered_council: 'Déclenché par le conseil',
    triggered_admin: 'Déclenché par admin',
    no_confidence: 'Motion de censure',
    no_confidence_hint: 'Initier une motion de censure contre le maire (conseil)',
    votes: 'voix',
    loading: 'Chargement...',
    error_load: 'Erreur de chargement',
    days_left: 'jours restants',
    hours_left: 'heures restantes',
  },
  it: {
    tab_election: 'Elezione',
    tab_loading: 'Caricamento...',
    no_municipality: 'Nessun comune assegnato',
    election: 'Elezione',
    no_election: 'Nessuna elezione in corso',
    start_election: "Avviare un'elezione",
    candidates_phase: 'Fase di candidatura',
    voting_phase: 'Fase di voto',
    closed: 'Elezione chiusa',
    cancelled: 'Elezione annullata',
    until: 'fino al',
    candidates: 'Candidati',
    no_candidates: 'Nessun candidato',
    register: 'Candidarsi',
    withdraw: 'Ritira',
    vote: 'Vota',
    voted: 'Votato',
    winner: 'Eletto',
    triggered_inactivity: 'Attivato da inattività del sindaco',
    triggered_council: 'Attivato dal consiglio',
    triggered_admin: 'Attivato da admin',
    no_confidence: 'Mozione di sfiducia',
    no_confidence_hint: 'Avviare mozione di sfiducia contro il sindaco (consiglio)',
    votes: 'voti',
    loading: 'Caricamento...',
    error_load: 'Errore di caricamento',
    days_left: 'giorni rimanenti',
    hours_left: 'ore rimanenti',
  },
};

function useElectionLabels() {
  const [locale, setLocale] = React.useState('de');
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('gt-locale') || navigator.language?.slice(0, 2) || 'de';
      setLocale(stored);
    } catch {}
  }, []);
  return ELECTION_LABELS[locale] || ELECTION_LABELS['de'];
}

function electionTimeRemaining(until: string, t: Record<string, string>): string {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return '—';
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ${t.days_left}`;
  return `${hours} ${t.hours_left}`;
}

function ElectionContent({ slug, myRole, currentUserId }: { slug: string; myRole: MunicipalityRole; currentUserId: number }) {
  const t = useElectionLabels();
  const [details, setDetails] = React.useState<ElectionDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const canManage = myRole === 'owner' || myRole === 'council';

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDetails(await getElection(slug));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.error_load);
    } finally {
      setLoading(false);
    }
  }, [slug, t.error_load]);

  React.useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setBusy(true);
      setError(null);
      await fn();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm">{t.loading}</div>;

  const election = details?.election;
  const candidates = details?.candidates || [];
  const myVote = details?.my_vote;
  const myCandidacy = details?.my_candidacy;
  const isCandidatePhase = election?.status === 'candidates';
  const isVotingPhase = election?.status === 'voting';
  const amCandidate = !!myCandidacy && !myCandidacy.withdrawn_at;
  const hasVoted = myVote !== null && myVote !== undefined;

  const triggeredLabel: Record<string, string> = {
    inactivity: t.triggered_inactivity,
    council_vote: t.triggered_council,
    admin: t.triggered_admin,
  };

  return (
    <div className="px-3 sm:px-6 py-4 space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!election ? (
        <div className="space-y-4">
          <div className="text-center py-8 text-slate-500 text-sm">{t.no_election}</div>
          {myRole === 'council' && (
            <div className="space-y-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act(() => openElection(slug))}
                className="w-full bg-amber-600/80 hover:bg-amber-600 text-white text-xs"
              >
                <Gavel className="w-3.5 h-3.5 mr-1.5" />
                {t.start_election}
              </Button>
              {myRole === 'council' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => act(() => openNoConfidence(slug))}
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  {t.no_confidence}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status Header */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                isCandidatePhase ? 'bg-blue-500/20 text-blue-300' :
                isVotingPhase ? 'bg-amber-500/20 text-amber-300' :
                election.status === 'closed' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-slate-600/30 text-slate-400'
              }`}>
                {isCandidatePhase ? t.candidates_phase :
                 isVotingPhase ? t.voting_phase :
                 election.status === 'closed' ? t.closed : t.cancelled}
              </span>
              <span className="text-xs text-slate-500">
                {isCandidatePhase && electionTimeRemaining(election.candidates_until, t)}
                {isVotingPhase && electionTimeRemaining(election.voting_until, t)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{triggeredLabel[election.triggered_by]}</p>
          </div>

          {/* Candidates */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.candidates}</h4>
            {candidates.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">{t.no_candidates}</div>
            ) : (
              <div className="space-y-1.5">
                {candidates.filter(c => !c.withdrawn_at).map((c: ElectionCandidate) => {
                  const isWinner = election.winner_user_id === c.user_id;
                  const isMyVote = myVote === c.user_id;
                  return (
                    <div key={c.user_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      isWinner ? 'bg-emerald-500/10 border-emerald-500/30' :
                      isMyVote ? 'bg-amber-500/10 border-amber-500/25' :
                      'bg-slate-800/40 border-slate-700/40'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          <span className="text-sm font-medium text-slate-200 truncate">{c.nickname}</span>
                          {isMyVote && !election.winner_user_id && (
                            <span className="text-[10px] text-amber-400 shrink-0">✓ {t.voted}</span>
                          )}
                          {isWinner && (
                            <span className="text-[10px] text-emerald-400 shrink-0">{t.winner}</span>
                          )}
                        </div>
                        {(isVotingPhase || election.status === 'closed') && (
                          <span className="text-[11px] text-slate-500">{c.votes} {t.votes}</span>
                        )}
                      </div>
                      {isVotingPhase && !hasVoted && c.user_id !== currentUserId && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => act(() => castVote(slug, c.user_id))}
                          className="shrink-0 h-7 px-3 text-xs bg-amber-600/80 hover:bg-amber-600 text-white"
                        >
                          {t.vote}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My actions */}
          {isCandidatePhase && (
            <div className="pt-1">
              {!amCandidate ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => act(() => registerCandidate(slug))}
                  className="w-full text-xs bg-blue-600/80 hover:bg-blue-600 text-white"
                >
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  {t.register}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => act(() => withdrawCandidate(slug))}
                  className="w-full text-xs border-slate-600 text-slate-400 hover:bg-slate-700/50"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  {t.withdraw}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GemeindePanel() {
  const { setActivePanel, municipalitySlug, setBauzoneMode } = useGame();
  const slug = municipalitySlug || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<MunicipalityMembersResponse | null>(null);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<Array<{ id: number; nickname: string; municipality_name: string | null; user_level: number | null }>>([]);
  const [inviting, setInviting] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<number | null>(null);
  const [showRoleSelector, setShowRoleSelector] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState<GemeindeTab>('members');
  const tPanel = useElectionLabels();

  const clearMessages = () => { setError(null); setSuccess(null); };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadMembers = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      clearMessages();
      const result = await getMunicipalityMembers(slug);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const currentUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || 0) : 0;
  const myMember = data?.members.find(m => m.user_id === currentUserId);
  const myRole = (myMember?.role || 'citizen') as MunicipalityRole;
  const isOwner = myRole === 'owner';
  const canManage = isOwner || myRole === 'council';
  const canInvite = canManage;

  const handleRoleChange = async (userId: number, newRole: MunicipalityRole) => {
    try {
      clearMessages();
      await changeMemberRole(slug, userId, newRole as 'council' | 'citizen' | 'observer');
      setSuccess('Rang geändert');
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleKick = async (userId: number) => {
    try {
      clearMessages();
      await kickMember(slug, userId);
      setSuccess('Mitglied entfernt');
      setConfirmKickId(null);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleInviteSearch = async (query: string) => {
    setInviteQuery(query);
    if (query.length < 2) { setInviteResults([]); return; }
    try {
      const results = await searchUsers(query);
      const memberIds = new Set(data?.members.map(m => m.user_id) || []);
      setInviteResults(results.filter(u => !memberIds.has(u.id)));
    } catch { setInviteResults([]); }
  };

  const handleInvite = async (userId: number) => {
    try {
      setInviting(true);
      clearMessages();
      const result = await inviteMember(slug, userId);
      setSuccess(`${result.nickname} eingeladen`);
      setInviteQuery('');
      setInviteResults([]);
      setShowInvite(false);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einladen');
    } finally {
      setInviting(false);
    }
  };

  const memberCount = data?.member_count || 0;
  const memberLimit = data?.member_limit || 25;
  const fillPercent = Math.min(100, Math.round((memberCount / memberLimit) * 100));

  const ownerMember = data?.members.find(m => m.role === 'owner');
  const nonOwnerRoles: MunicipalityRole[] = ['council', 'citizen', 'observer'];

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="flex flex-col w-[min(95vw,680px)] max-w-none max-h-[92dvh] bg-slate-900/95 border-slate-700/70 text-white p-0 gap-0 overflow-hidden backdrop-blur-sm">
        {/* Header — fixed, never scrolls */}
        <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 border-b border-slate-700/60">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-semibold">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="truncate block">{data?.municipality_name || 'Gemeinde'}</span>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Gemeinde-Verwaltung</p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">Gemeinde-Verwaltung</DialogDescription>
          </DialogHeader>

          {/* Member count bar */}
          <div className="mt-3 sm:mt-5 flex items-center gap-3">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1">
              <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60 transition-all duration-500"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-slate-500 font-mono tabular-nums shrink-0">
              {memberCount}/{memberLimit}
            </span>
          </div>

          {/* Tabs - horizontally scrollable on mobile */}
          <div className="mt-3 sm:mt-4 flex gap-1 bg-slate-800/60 rounded-lg p-1 overflow-x-auto scrollbar-none -mx-1 px-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 justify-center ${
                activeTab === 'members'
                  ? 'bg-slate-700/80 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Mitglieder
            </button>
            {canManage && (
              <button
                onClick={() => setActiveTab('meldungen')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 justify-center ${
                  activeTab === 'meldungen'
                    ? 'bg-slate-700/80 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <FileWarning className="w-3.5 h-3.5" />
                Meldungen
              </button>
            )}
            {canManage && (
              <button
                onClick={() => setActiveTab('finanzen')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 justify-center ${
                  activeTab === 'finanzen'
                    ? 'bg-slate-700/80 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Budget &</span> Finanzen
              </button>
            )}
            {canManage && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 justify-center ${
                  activeTab === 'settings'
                    ? 'bg-slate-700/80 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Einstellungen</span>
                <span className="sm:hidden">Setup</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('election')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 justify-center ${
                activeTab === 'election'
                  ? 'bg-amber-700/80 text-white'
                  : 'text-slate-500 hover:text-amber-300'
              }`}
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>{tPanel.tab_election}</span>
            </button>
          </div>
        </div>

        {/* Messages — shrink-0 so they sit between header and content */}
        {(error || success) && (
          <div className="shrink-0 mx-3 sm:mx-6 mt-3 sm:mt-4 space-y-2">
            {error && (
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs sm:text-sm flex items-center gap-2">
                <X className="w-4 h-4 shrink-0 cursor-pointer hover:text-red-300" onClick={() => setError(null)} />
                {error}
              </div>
            )}
            {success && (
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs sm:text-sm flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}
          </div>
        )}

        {/* Content — fills remaining space, scrolls internally */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-slate-500 text-sm">{tPanel.tab_loading}</span>
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {tPanel.no_municipality}
          </div>
        ) : activeTab === 'election' ? (
          <ElectionContent slug={slug} myRole={myRole} currentUserId={currentUserId} />
        ) : activeTab === 'meldungen' && canManage ? (
          <MeldungenContent />
        ) : activeTab === 'settings' && canManage ? (
          <div className="px-3 sm:px-6 py-3 sm:py-5">
            <BauzoneSettings slug={slug} canManage={canManage} onModeChange={setBauzoneMode} />
          </div>
        ) : activeTab === 'finanzen' && canManage ? (
          <FinanzenContent canManage={canManage} />
        ) : (
          <div>
            <div className="px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5">

              {/* Owner (always at top) */}
              {ownerMember && (
                <div>
                  <MemberRow
                    member={ownerMember}
                    isSelf={ownerMember.user_id === currentUserId}
                    canManage={canManage}
                    isOwner={isOwner}
                    myRole={myRole}
                    confirmKickId={confirmKickId}
                    setConfirmKickId={setConfirmKickId}
                    showRoleSelector={showRoleSelector}
                    setShowRoleSelector={setShowRoleSelector}
                    handleRoleChange={handleRoleChange}
                    handleKick={handleKick}
                  />
                </div>
              )}

              {/* Non-owner groups */}
              {nonOwnerRoles.map(group => {
                const members = data.members.filter(m => m.role === group);
                if (members.length === 0) return null;
                const cfg = ROLE_CONFIG[group];
                const GroupIcon = cfg.icon;

                return (
                  <div key={group}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <GroupIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        {cfg.label}
                      </span>
                      <span className="text-[11px] text-slate-600">({members.length})</span>
                      <div className="flex-1 h-px bg-slate-700/50" />
                    </div>

                    <div className="space-y-2">
                      {members.map((member: MunicipalityMember) => (
                        <MemberRow
                          key={member.user_id}
                          member={member}
                          isSelf={member.user_id === currentUserId}
                          canManage={canManage}
                          isOwner={isOwner}
                          myRole={myRole}
                          confirmKickId={confirmKickId}
                          setConfirmKickId={setConfirmKickId}
                          showRoleSelector={showRoleSelector}
                          setShowRoleSelector={setShowRoleSelector}
                          handleRoleChange={handleRoleChange}
                          handleKick={handleKick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Footer: Invite (only on members tab) — shrink-0 so it never disappears */}
        {canInvite && data && activeTab === 'members' && (
          <div className="shrink-0 border-t border-slate-700/60 px-3 sm:px-6 py-3 sm:py-5">
            {!showInvite ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInvite(true)}
                className="w-full border-dashed border-slate-600/70 text-slate-400 hover:bg-slate-800/60 hover:text-white hover:border-slate-500/70 transition-all"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Mitglied einladen
              </Button>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={inviteQuery}
                      onChange={e => handleInviteSearch(e.target.value)}
                      placeholder="Username suchen..."
                      className="pl-8 h-9 text-sm bg-slate-800/60 border-slate-700/70 text-white placeholder:text-slate-600 focus:border-emerald-500/40 focus:ring-emerald-500/20"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => { setShowInvite(false); setInviteQuery(''); setInviteResults([]); }}
                    className="p-2 rounded-md hover:bg-slate-700/60 text-slate-500 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {inviteResults.length > 0 && (
                  <div className="space-y-1 max-h-[140px] overflow-y-auto rounded-lg border border-slate-700/50 p-1">
                    {inviteResults.map(user => (
                      <div key={user.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-800/60 transition-colors">
                        <div className="w-7 h-7 rounded-md bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                          {user.nickname?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{user.nickname}</span>
                            <span className="text-[11px] text-slate-500">Lv. {user.user_level || '?'}</span>
                          </div>
                          {user.municipality_name && (
                            <span className="text-[10px] text-slate-600">{user.municipality_name}</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleInvite(user.id)}
                          disabled={inviting}
                          className="h-7 text-xs bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/50 disabled:opacity-50"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          Einladen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {inviteQuery.length >= 2 && inviteResults.length === 0 && (
                  <p className="text-[11px] text-slate-600 text-center py-3">Keine User gefunden</p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
