'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Star, TrendingUp, Wallet, FileText, Users, ArrowLeft,
  ChevronRight, UserPlus, Trash2, ArrowUp, ArrowDown, Check, X,
  AlertTriangle, Clock, Briefcase, Shield, Wrench,
} from 'lucide-react';
import {
  getCompanyTypes, getMyCompanies, createCompany, getCompanyDetails,
  removeCompanyMember, changeCompanyMemberRole, dissolveCompany,
  respondToApplication, searchUsers, inviteCompanyMember,
  acceptContract, completeContract, createContractFromEvent, getReportedEvents,
  requestCompanyLoan, getMyLoanRequests, cancelLoanRequest, getCompanyLoan,
  getCompanyNpcBots, hireNpcBot, fireNpcBot, toggleNpcPatrol,
  type CompanyType, type Company, type CompanyDetails, type CompanyContract,
  type CompanyLoanRequest, type CompanyLoan, type CreateCompanyErrorData,
  type NpcBot, type NpcBotType,
} from '@/lib/api/companyApi';
import {
  getCompanyBusLines, deleteBusLine, updateBusLine,
  type ServerBusLine,
} from '@/lib/api/busLineApi';
import { consumeFirmaPrefill } from '@/lib/firmaPrefill';

type View = 'overview' | 'details';

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner: { label: 'Inhaber', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  manager: { label: 'Manager', color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  employee: { label: 'Mitarbeiter', color: 'text-slate-300', bg: 'bg-slate-700/50', border: 'border-slate-600/50' },
};

function getRoleConfig(role: string) {
  return ROLE_LABELS[role] || { label: role, color: 'text-slate-300', bg: 'bg-slate-700/50', border: 'border-slate-600/50' };
}

export function FirmaPanel() {
  const { state, setActivePanel } = useGame();
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [companyTypes, setCompanyTypes] = useState<CompanyType[]>([]);
  const [myCompanies, setMyCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetails | null>(null);

  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createTypeId, setCreateTypeId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<Array<{ id: number; nickname: string; municipality_name: string | null; user_level: number | null }>>([]);
  const [inviting, setInviting] = useState(false);

  // Kredit-System State
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanErrorData, setLoanErrorData] = useState<CreateCompanyErrorData | null>(null);
  const [loanMessage, setLoanMessage] = useState('');
  const [requestingLoan, setRequestingLoan] = useState(false);
  const [myLoanRequests, setMyLoanRequests] = useState<CompanyLoanRequest[]>([]);

  const clearMessages = () => { setError(null); setSuccess(null); };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      clearMessages();
      const [types, companies, loanReqs] = await Promise.all([
        getCompanyTypes(),
        getMyCompanies(),
        getMyLoanRequests().catch(() => [] as CompanyLoanRequest[]),
      ]);
      setCompanyTypes(types);
      setMyCompanies(companies);
      setMyLoanRequests(loanReqs);
      // Deep-Link: Prefill aus BusStationSection o.ä. anwenden
      const prefill = consumeFirmaPrefill();
      if (prefill) {
        const match = types.find(t => t.code === prefill.typeCode);
        if (match) setCreateTypeId(match.id);
        setActiveTab('create');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadCompanyDetails = async (companyId: number) => {
    try {
      setLoading(true);
      clearMessages();
      const details = await getCompanyDetails(companyId);
      setSelectedCompany(details);
      setView('details');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createTypeId) return;
    try {
      setCreating(true);
      clearMessages();
      setShowLoanForm(false);
      setLoanErrorData(null);
      await createCompany(createName.trim(), createTypeId);
      setSuccess('Firma erfolgreich gegründet!');
      setCreateName('');
      setCreateTypeId(null);
      await loadData();
    } catch (err: unknown) {
      const error = err as Error & { data?: CreateCompanyErrorData };
      if (error.data?.insufficient_funds && error.data?.can_request_loan) {
        setLoanErrorData(error.data);
        setShowLoanForm(true);
        setError(`Du hast nicht genug CHF auf deinem Konto! Du kannst einen Kredit bei der Gemeinde beantragen.`);
      } else {
        setError(error.message || 'Fehler beim Gründen');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRequestLoan = async () => {
    if (!createName.trim() || !createTypeId) return;
    try {
      setRequestingLoan(true);
      clearMessages();
      await requestCompanyLoan(createName.trim(), createTypeId, loanMessage || undefined);
      setSuccess('Kredit-Antrag eingereicht! Der Gemeinderat muss diesen genehmigen.');
      setShowLoanForm(false);
      setLoanErrorData(null);
      setCreateName('');
      setCreateTypeId(null);
      setLoanMessage('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Kredit-Antrag');
    } finally {
      setRequestingLoan(false);
    }
  };

  const handleCancelLoan = async (requestId: number) => {
    try {
      clearMessages();
      await cancelLoanRequest(requestId);
      setSuccess('Kredit-Antrag storniert');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    }
  };

  const handleDissolve = async (companyId: number) => {
    if (!confirm('Firma wirklich auflösen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      clearMessages();
      const result = await dissolveCompany(companyId);
      setSuccess(`Firma aufgelöst. ${result.payout > 0 ? `${result.payout} Fr. ausgezahlt.` : ''}`);
      setView('overview');
      setSelectedCompany(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Auflösen');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedCompany || !confirm('Mitglied wirklich entfernen?')) return;
    try {
      clearMessages();
      await removeCompanyMember(selectedCompany.company.id, userId);
      setSuccess('Mitglied entfernt');
      await loadCompanyDetails(selectedCompany.company.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    if (!selectedCompany) return;
    try {
      clearMessages();
      await changeCompanyMemberRole(selectedCompany.company.id, userId, newRole);
      setSuccess('Rolle geändert');
      await loadCompanyDetails(selectedCompany.company.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleApplicationResponse = async (appId: number, decision: 'accepted' | 'rejected') => {
    if (!selectedCompany) return;
    try {
      clearMessages();
      await respondToApplication(selectedCompany.company.id, appId, decision);
      setSuccess(decision === 'accepted' ? 'Bewerbung angenommen' : 'Bewerbung abgelehnt');
      await loadCompanyDetails(selectedCompany.company.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleInviteSearch = async (query: string) => {
    setInviteQuery(query);
    if (query.length < 2) { setInviteResults([]); return; }
    try {
      const results = await searchUsers(query);
      setInviteResults(results);
    } catch { setInviteResults([]); }
  };

  const handleInvite = async (userId: number) => {
    if (!selectedCompany) return;
    try {
      setInviting(true);
      clearMessages();
      await inviteCompanyMember(selectedCompany.company.id, userId);
      setSuccess('Einladung gesendet');
      setInviteQuery('');
      setInviteResults([]);
      await loadCompanyDetails(selectedCompany.company.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einladen');
    } finally {
      setInviting(false);
    }
  };

  const hasCompany = myCompanies.length > 0;
  const defaultTab = hasCompany ? 'my-company' : 'create';
  const currentTab = activeTab ?? defaultTab;

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-xl max-h-[92vh] flex flex-col overflow-hidden bg-slate-900/95 border-slate-700/70 text-white p-0 gap-0 backdrop-blur-sm">
        {/* Header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 border-b border-slate-700/60 shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-semibold">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <span>Firma</span>
                <p className="text-xs text-slate-500 font-normal mt-0.5">Firmen verwalten & Aufträge</p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">Firmen-Verwaltung</DialogDescription>
          </DialogHeader>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-3 sm:mx-6 mt-3 sm:mt-4">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs sm:text-sm flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 cursor-pointer hover:text-red-300" onClick={() => setError(null)} />
              {error}
            </div>
          </div>
        )}
        {success && (
          <div className="mx-3 sm:mx-6 mt-3 sm:mt-4">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs sm:text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {success}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
        {loading && !selectedCompany ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-slate-500 text-sm">Laden...</span>
          </div>
        ) : view === 'details' && selectedCompany ? (
          <CompanyDetailView
            details={selectedCompany}
            onBack={() => { setView('overview'); setSelectedCompany(null); }}
            onRemoveMember={handleRemoveMember}
            onChangeRole={handleChangeRole}
            onDissolve={handleDissolve}
            onApplicationResponse={handleApplicationResponse}
            inviteQuery={inviteQuery}
            inviteResults={inviteResults}
            inviting={inviting}
            onInviteSearch={handleInviteSearch}
            onInvite={handleInvite}
            onRefresh={() => loadCompanyDetails(selectedCompany.company.id)}
          />
        ) : (
          <div className="px-3 sm:px-6 py-3 sm:py-5">
            <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl p-1 h-auto">
                <TabsTrigger value="create" className="flex-1 rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  Gründen
                </TabsTrigger>
                <TabsTrigger value="my-company" className="flex-1 rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  Meine Firmen{hasCompany ? ` (${myCompanies.length})` : ''}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-4">
                  <div className="space-y-3 pr-2">
                    <p className="text-sm text-slate-400 mb-1">
                      Wähle einen Firmen-Typ und gib einen Namen ein.
                    </p>
                    <div className="grid gap-3">
                      {companyTypes.length === 0 && !loading && (
                        <p className="text-sm text-slate-500 text-center py-4">Keine Firmen-Typen verfügbar.</p>
                      )}
                      {companyTypes.map(ct => {
                        const isSelected = createTypeId === ct.id;
                        return (
                          <div key={ct.id} className={`rounded-xl border transition-all ${
                            isSelected
                              ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                              : 'border-slate-700/60 hover:border-slate-600/60'
                          }`}>
                            <button
                              onClick={() => setCreateTypeId(isSelected ? null : ct.id)}
                              className="w-full text-left p-4 hover:bg-slate-800/30 rounded-t-xl transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{ct.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm text-white">{ct.name}</div>
                                  <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">{ct.description}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-xs text-amber-400 font-mono font-medium">{ct.founding_cost.toLocaleString()} CHF</div>
                                  <div className="text-[11px] text-slate-500">Lv. {ct.min_level}+</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50">
                                  Max {ct.max_members} Mitglieder
                                </span>
                                {ct.can_fix_categories.map(cat => (
                                  <span key={cat} className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </button>

                            {isSelected && (
                              <div className="px-4 pb-4 pt-3 border-t border-emerald-500/20 space-y-2.5">
                                <Input
                                  value={createName}
                                  onChange={e => setCreateName(e.target.value)}
                                  placeholder="Firmenname eingeben (min. 3 Zeichen)"
                                  maxLength={64}
                                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm h-10 focus:border-emerald-500 focus:ring-emerald-500/30"
                                  autoFocus
                                />
                                <Button
                                  onClick={handleCreate}
                                  disabled={creating || !createName.trim() || createName.trim().length < 3}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm h-10"
                                >
                                  {creating ? 'Wird gegründet...' : `Firma gründen (${ct.founding_cost.toLocaleString()} CHF)`}
                                </Button>

                                {/* Kredit-Formular bei insufficient_funds */}
                                {showLoanForm && loanErrorData && createTypeId === ct.id && (
                                  <div className="mt-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                                    <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                                      <Wallet className="w-4 h-4" />
                                      Kredit bei der Gemeinde beantragen
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="px-2.5 py-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                                        <span className="text-slate-500">Dein Kontostand</span>
                                        <div className="font-mono text-red-400">{loanErrorData.user_balance.toLocaleString()} CHF</div>
                                      </div>
                                      <div className="px-2.5 py-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                                        <span className="text-slate-500">Gründungskosten</span>
                                        <div className="font-mono text-white">{loanErrorData.founding_cost.toLocaleString()} CHF</div>
                                      </div>
                                      <div className="px-2.5 py-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                                        <span className="text-slate-500">Kreditbetrag</span>
                                        <div className="font-mono text-amber-400">{loanErrorData.founding_cost.toLocaleString()} CHF</div>
                                      </div>
                                      <div className="px-2.5 py-1.5 rounded bg-slate-800/60 border border-slate-700/50">
                                        <span className="text-slate-500">Wöchentl. Rate</span>
                                        <div className="font-mono text-white">~{Math.ceil(loanErrorData.founding_cost / 12).toLocaleString()} CHF</div>
                                      </div>
                                    </div>
                                    <Input
                                      value={loanMessage}
                                      onChange={e => setLoanMessage(e.target.value)}
                                      placeholder="Nachricht an den Gemeinderat (optional)"
                                      maxLength={500}
                                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm h-9 focus:border-amber-500 focus:ring-amber-500/30"
                                    />
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-500/60" />
                                      Der Gemeinderat muss den Kredit genehmigen. Bei 3 verpassten Raten wird die Firma aufgelöst.
                                    </div>
                                    <Button
                                      onClick={handleRequestLoan}
                                      disabled={requestingLoan || !createName.trim() || createName.trim().length < 3}
                                      className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm h-10"
                                    >
                                      {requestingLoan ? 'Wird beantragt...' : '🏦 Kredit beantragen'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
              </TabsContent>

              <TabsContent value="my-company" className="mt-4">
                  <div className="space-y-3 pr-2">
                    {/* Pending Loan Requests */}
                    {myLoanRequests.filter(r => r.status === 'pending').length > 0 && (
                      <div className="space-y-2 mb-3">
                        <div className="text-xs font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Offene Kredit-Anträge
                        </div>
                        {myLoanRequests.filter(r => r.status === 'pending').map(req => (
                          <div key={req.id} className="px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">{req.type_emoji}</span>
                              <span className="font-medium text-sm text-white flex-1">{req.company_name}</span>
                              <Badge variant="outline" className="text-[11px] text-amber-400 border-amber-400/30">Ausstehend</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
                              <span className="text-amber-400 font-mono">{req.loan_amount.toLocaleString()} CHF</span>
                              <span>Rate: {req.weekly_repayment.toLocaleString()} CHF/Woche</span>
                              <span>{req.type_name}</span>
                            </div>
                            {req.message && (
                              <p className="text-xs text-slate-400 italic mb-2">&quot;{req.message}&quot;</p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelLoan(req.id)}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Stornieren
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rejected/Cancelled loan requests */}
                    {myLoanRequests.filter(r => r.status === 'rejected').length > 0 && (
                      <div className="space-y-2 mb-3">
                        {myLoanRequests.filter(r => r.status === 'rejected').map(req => (
                          <div key={req.id} className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{req.type_emoji}</span>
                              <span className="font-medium text-sm text-white flex-1">{req.company_name}</span>
                              <Badge variant="outline" className="text-[11px] text-red-400 border-red-400/30">Abgelehnt</Badge>
                            </div>
                            {req.reject_reason && (
                              <p className="text-xs text-red-300/80">Grund: {req.reject_reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {myCompanies.length === 0 && myLoanRequests.filter(r => r.status === 'pending').length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mx-auto mb-4">
                          <Building2 className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-400 font-medium">Du hast noch keine Firma.</p>
                        <p className="text-xs mt-1.5 text-slate-600">Wechsle zum Tab &quot;Gründen&quot; um loszulegen (max. 3 eigene Firmen).</p>
                      </div>
                    ) : myCompanies.length === 0 ? null : (
                      myCompanies.map(company => {
                        const roleCfg = getRoleConfig(company.my_role || '');
                        return (
                          <button
                            key={company.id}
                            onClick={() => loadCompanyDetails(company.id)}
                            className="w-full text-left rounded-xl border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/30 transition-all group"
                          >
                            {/* Company header */}
                            <div className="flex items-center gap-2.5 sm:gap-4 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-xl sm:text-2xl shrink-0">
                                {company.type_emoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <span className="font-semibold text-sm sm:text-base text-white truncate">{company.name}</span>
                                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                                </div>
                                <span className="text-[11px] sm:text-xs text-slate-500">{company.type_name}</span>
                              </div>
                              <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium shrink-0 ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
                                {company.my_role === 'owner' && <Star className="w-3 h-3" />}
                                {company.my_role === 'manager' && <Shield className="w-3 h-3" />}
                                <span className="hidden sm:inline">{roleCfg.label}</span>
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="mx-3 sm:mx-5 mb-2 sm:mb-3">
                              <CompanyLevelBar level={company.level} reputation={company.reputation} />
                            </div>
                            <div className="grid grid-cols-2 gap-px mx-3 sm:mx-5 mb-3 sm:mb-4 rounded-lg overflow-hidden border border-slate-700/40">
                              <div className="bg-slate-800/40 px-2 sm:px-3 py-2 sm:py-2.5 text-center">
                                <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Konto</div>
                                <div className="font-mono font-bold text-xs sm:text-sm text-amber-400">{company.balance.toLocaleString()}</div>
                              </div>
                              <div className="bg-slate-800/40 px-2 sm:px-3 py-2 sm:py-2.5 text-center">
                                <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Team</div>
                                <div className="font-mono font-bold text-xs sm:text-sm text-white">{company.member_count}</div>
                              </div>
                            </div>

                            {/* Footer info */}
                            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 pb-3 sm:pb-4 text-[11px] sm:text-xs text-slate-500">
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                <span>{company.total_contracts} Aufträge</span>
                              </div>
                              {company.total_revenue > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-emerald-500/60" />
                                  <span>{company.total_revenue.toLocaleString()} Fr.</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── NPC Level System ─────────────────────────────────────

const NPC_LEVELS = [
  { level: 1, title: 'Neuling',   xpMin: 0,    xpMax: 49,   bonus: 0,    color: 'text-slate-400',  stars: 1 },
  { level: 2, title: 'Fachkraft', xpMin: 50,   xpMax: 199,  bonus: 0.02, color: 'text-blue-400',   stars: 2 },
  { level: 3, title: 'Senior',    xpMin: 200,  xpMax: 499,  bonus: 0.05, color: 'text-green-400',  stars: 3 },
  { level: 4, title: 'Experte',   xpMin: 500,  xpMax: 999,  bonus: 0.10, color: 'text-amber-400',  stars: 4 },
  { level: 5, title: 'Meister',   xpMin: 1000, xpMax: Infinity, bonus: 0.15, color: 'text-purple-400', stars: 5 },
];

function getNpcLevel(xp: number) {
  const lvl = [...NPC_LEVELS].reverse().find(l => xp >= l.xpMin) ?? NPC_LEVELS[0];
  const next = NPC_LEVELS.find(l => l.level === lvl.level + 1);
  const progress = next
    ? Math.min(100, Math.round(((xp - lvl.xpMin) / (next.xpMin - lvl.xpMin)) * 100))
    : 100;
  return { ...lvl, next, progress };
}

// ── Company Detail View ──────────────────────────────────

const COMPANY_LEVEL_THRESHOLDS = [0, 20, 60, 120, 200, 320, 480, 700, 1000, 1400];

function CompanyLevelBar({ level, reputation }: { level: number; reputation: number }) {
  const currentThreshold = COMPANY_LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = level < 10 ? COMPANY_LEVEL_THRESHOLDS[level] : null;
  const progress = nextThreshold
    ? Math.min(100, ((reputation - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
    : 100;

  return (
    <div className="border-t border-slate-700/40 bg-slate-800/50 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Level</span>
          <span className="font-mono font-bold text-base text-blue-400">{level}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">Rep.</span>
          <span className="font-mono text-sm text-emerald-400">{reputation}</span>
          {nextThreshold && (
            <span className="text-[10px] text-slate-600">/ {nextThreshold}</span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {nextThreshold && (
        <div className="text-[9px] text-slate-600 mt-1 text-right">
          noch {nextThreshold - reputation} Rep. bis Level {level + 1}
        </div>
      )}
      {!nextThreshold && (
        <div className="text-[9px] text-amber-500/70 mt-1 text-center">Max Level erreicht!</div>
      )}
    </div>
  );
}

interface CompanyDetailViewProps {
  details: CompanyDetails;
  onBack: () => void;
  onRemoveMember: (userId: number) => void;
  onChangeRole: (userId: number, role: string) => void;
  onDissolve: (companyId: number) => void;
  onApplicationResponse: (appId: number, decision: 'accepted' | 'rejected') => void;
  inviteQuery: string;
  inviteResults: Array<{ id: number; nickname: string; municipality_name: string | null; user_level: number | null }>;
  inviting: boolean;
  onInviteSearch: (query: string) => void;
  onInvite: (userId: number) => void;
  onRefresh: () => void;
}

const BUS_LINE_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#9333ea', '#ec4899', '#06b6d4', '#f97316'];

const FINANCE_REASON_LABELS: Record<string, string> = {
  npc_hire_cost:      '👷 NPC Einstellkosten',
  contract_payment:   '📋 Auftragseinnahme',
  salary_paid:        '💸 Lohnzahlung Mitarbeiter',
  tax_payment:        '🏛️ Firmensteuer',
  weekly_salary:      '📅 Wochenlohn NPC',
  fired_no_funds:     '❌ NPC entlassen (kein Geld)',
  founding_cost:      '🏗️ Gründungskosten',
  bonus:              '🎁 Bonus',
  penalty:            '⚠️ Strafe',
  loan_disbursement:  '💰 Kreditauszahlung',
  loan_repayment:     '🔄 Kreditrückzahlung',
  loan_interest:      '📈 Kreditzinsen',
  dissolve_refund:    '🔙 Auflösung Rückerstattung',
  werkhof_repair:               '🔧 Stadtpatrouille Reparatur',
  parking_fine_provision:       '🚔 Parkbusse Provision',
};

function CompanyDetailView({
  details, onBack, onRemoveMember, onChangeRole, onDissolve,
  onApplicationResponse, inviteQuery, inviteResults, inviting,
  onInviteSearch, onInvite, onRefresh,
}: CompanyDetailViewProps) {
  const { company, members, finances, contracts, applications, my_role } = details;
  const isOwner = my_role === 'owner';
  const isManager = my_role === 'manager';
  const canManage = isOwner || isManager;
  const isTransport = company.type_code === 'transport';
  const { startBusLineCreation, loadTransportCompanyStatus, state: gameState, addNotification, setActivePanel } = useGame();

  // NPC-Bot State
  const [npcBots, setNpcBots] = useState<NpcBot[]>([]);
  const [npcTypes, setNpcTypes] = useState<NpcBotType[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [hiringBot, setHiringBot] = useState<string | null>(null);
  const [npcError, setNpcError] = useState<string | null>(null);
  // Ticker für Echtzeit-Fortschrittsbalken
  const [npcTick, setNpcTick] = useState(0);
  useEffect(() => {
    if (npcBots.some(b => b.status === 'working')) {
      const id = setInterval(() => setNpcTick(t => t + 1), 1000);
      return () => clearInterval(id);
    }
  }, [npcBots]);
  const [npcSuccess, setNpcSuccess] = useState<string | null>(null);

  // Bus line state (only for transport companies)
  const [busLines, setBusLines] = useState<ServerBusLine[]>([]);
  const [maxBusLines, setMaxBusLines] = useState(2);
  const [busLinesLoading, setBusLinesLoading] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [showNewLineForm, setShowNewLineForm] = useState(false);

  const loadBusLines = useCallback(async () => {
    if (!isTransport) return;
    setBusLinesLoading(true);
    try {
      const data = await getCompanyBusLines(company.id);
      setBusLines(data.bus_lines);
      setMaxBusLines(data.max_lines);
    } catch { /* ignore */ }
    setBusLinesLoading(false);
  }, [isTransport, company.id]);

  useEffect(() => { loadBusLines(); }, [loadBusLines]);

  const handleDeleteLine = async (lineId: number) => {
    try {
      await deleteBusLine(company.id, lineId);
      setBusLines(prev => prev.filter(l => l.id !== lineId));
    } catch { /* ignore */ }
  };

  const handleToggleLine = async (line: ServerBusLine) => {
    const newStatus = line.status === 'active' ? 'disabled' : 'active';
    try {
      await updateBusLine(company.id, line.id, { status: newStatus });
      setBusLines(prev => prev.map(l => l.id === line.id ? { ...l, status: newStatus } : l));
    } catch { /* ignore */ }
  };

  const handleStartNewLine = () => {
    const name = newLineName.trim() || `Linie ${busLines.length + 1}`;
    const color = BUS_LINE_COLORS[busLines.length % BUS_LINE_COLORS.length];
    startBusLineCreation(company.id, name, color);
    setShowNewLineForm(false);
    setNewLineName('');
  };

  const handleEditLine = (line: ServerBusLine) => {
    const existingStops = [...line.stops]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map(s => ({ x: s.x, y: s.y }));
    startBusLineCreation(company.id, line.name, line.color, existingStops, line.id);
  };

  return (
    <div>
      <div className="px-3 sm:px-6 py-3 sm:py-5 space-y-3 sm:space-y-5">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück</span>
        </button>

        {/* Company Info Card */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 pt-3 sm:pt-5 pb-3 sm:pb-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-2xl sm:text-3xl shrink-0">
              {(company as Company).type_emoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg text-white truncate">{company.name}</h3>
              <p className="text-xs text-slate-400">{(company as Company).type_name}</p>
            </div>
          </div>
          <CompanyLevelBar level={company.level} reputation={company.reputation} />
          <div className="grid grid-cols-2 gap-px border-t border-slate-700/40">
            <div className="bg-slate-800/50 px-3 py-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Konto</div>
              <div className="font-mono font-bold text-base text-amber-400">{company.balance.toLocaleString()}</div>
            </div>
            <div className="bg-slate-800/50 px-3 py-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Aufträge</div>
              <div className="font-mono font-bold text-base text-white">{company.total_contracts}</div>
            </div>
          </div>
        </div>

        {/* Kredit-Karte */}
        <CompanyLoanCard companyId={company.id} />

        {/* Tabs */}
        <Tabs defaultValue={contracts.length > 0 ? 'contracts' : 'members'} className="w-full"
          onValueChange={(v) => {
            if (v === 'npcs' && npcTypes.length === 0 && !npcLoading) {
              setNpcLoading(true);
              setNpcError(null);
              getCompanyNpcBots(company.id)
                .then(d => { setNpcBots(d.bots); setNpcTypes(d.types); })
                .catch(e => setNpcError(e?.message || 'Fehler beim Laden der NPCs'))
                .finally(() => setNpcLoading(false));
            }
          }}
        >
          <TabsList className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl p-1 h-auto overflow-x-auto scrollbar-none">
            <TabsTrigger value="members" className="flex-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white shrink-0">
              <Users className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Mitglieder</span><span className="sm:hidden">Team</span> ({members.length})
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white shrink-0">
              <Wallet className="w-3 h-3 mr-1" />
              Finanzen
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white shrink-0">
              <Briefcase className="w-3 h-3 mr-1" />
              Aufträge{contracts.length > 0 ? ` (${contracts.length})` : ''}
            </TabsTrigger>
            {isTransport && (
              <TabsTrigger value="linien" className="flex-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white shrink-0">
                🚌 Linien ({busLines.length}/{maxBusLines})
              </TabsTrigger>
            )}
            {canManage && applications.length > 0 && (
              <TabsTrigger value="applications" className="flex-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white shrink-0">
                <span className="hidden sm:inline">Bewerbungen</span><span className="sm:hidden">Bew.</span> ({applications.length})
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="npcs"
                className="flex-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white shrink-0"
              >
                🤖 <span className="hidden sm:inline ml-1">NPCs</span>{npcBots.length > 0 ? ` (${npcBots.length})` : ''}
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="settings" className="rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-[11px] sm:text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-500 shrink-0">
                <Wrench className="w-3 h-3" />
              </TabsTrigger>
            )}
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-3">
            <div className="space-y-2">
              {members.map(member => {
                const roleCfg = getRoleConfig(member.role);
                return (
                  <div key={member.user_id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 border ${roleCfg.bg} ${roleCfg.border}`}>
                      <span className={roleCfg.color}>
                        {member.nickname?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs sm:text-sm text-white truncate">{member.nickname}</div>
                      <div className="text-[10px] sm:text-xs text-slate-500">
                        Lv. {member.user_level || '?'} · {member.contracts_done} Aufträge
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
                      <span>{roleCfg.label}</span>
                    </div>
                    {isOwner && member.role !== 'owner' && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => onChangeRole(member.user_id, member.role === 'manager' ? 'employee' : 'manager')}
                          className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-white transition-all"
                          title={member.role === 'manager' ? 'Zum Mitarbeiter machen' : 'Zum Manager befördern'}
                        >
                          {member.role === 'manager' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => onRemoveMember(member.user_id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-all"
                          title="Entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {canManage && (
                <div className="pt-3 border-t border-slate-700/40 space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mitglied einladen</label>
                  <Input
                    value={inviteQuery}
                    onChange={e => onInviteSearch(e.target.value)}
                    placeholder="Username suchen..."
                    className="bg-slate-800/50 border-slate-700/60 text-white placeholder:text-slate-600 h-9 text-sm focus:border-blue-500/40 focus:ring-blue-500/20"
                  />
                  {inviteResults.length > 0 && (
                    <div className="space-y-1 rounded-lg border border-slate-700/50 p-1">
                      {inviteResults.map(user => (
                        <div key={user.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800/60 transition-colors">
                          <div className="w-7 h-7 rounded-md bg-slate-700/60 border border-slate-600/40 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                            {user.nickname?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white">{user.nickname}</span>
                            <span className="text-[11px] text-slate-500 ml-2">Lv. {user.user_level || '?'}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => onInvite(user.id)}
                            disabled={inviting}
                            className="h-7 text-xs bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Einladen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Finances Tab */}
          <TabsContent value="finances" className="mt-3">
            <div className="space-y-1.5">
              {finances.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Keine Transaktionen</p>
                </div>
              ) : (
                finances.map(f => (
                  <div key={f.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-700/50 text-sm">
                    <div className={`font-mono font-bold text-xs sm:text-sm min-w-[60px] sm:min-w-[80px] ${f.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {f.amount >= 0 ? '+' : ''}{f.amount.toLocaleString()}
                    </div>
                    <div className="flex-1 min-w-0 truncate text-slate-300 text-[11px] sm:text-xs">{f.description || FINANCE_REASON_LABELS[f.reason] || f.reason}</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-600 shrink-0">
                      {new Date(f.created_at).toLocaleDateString('de-CH')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-3">
            <ContractsTab
              companyId={company.id}
              contracts={contracts}
              canManage={canManage}
              canFixCategories={company.can_fix_categories}
              onRefresh={onRefresh}
            />
          </TabsContent>

          {/* Applications Tab */}
          {canManage && applications.length > 0 && (
            <TabsContent value="applications" className="mt-3">
              <div className="space-y-2">
                {applications.map(app => (
                  <div key={app.id} className="px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-800/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-white">{app.nickname}</span>
                    </div>
                    {app.message && (
                      <p className="text-xs text-slate-400 mb-3 italic">&quot;{app.message}&quot;</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onApplicationResponse(app.id, 'accepted')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Annehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onApplicationResponse(app.id, 'rejected')}
                        className="border-slate-600 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        Ablehnen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {/* Linien Tab (Transport only) */}
          {isTransport && (
            <TabsContent value="linien" className="mt-3">
              <div className="space-y-3">
                {busLinesLoading ? (
                  <div className="text-center text-slate-500 py-4 text-sm">Lade Linien...</div>
                ) : busLines.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-2xl mb-2">🚌</div>
                    <p className="text-slate-400 text-sm mb-3">Noch keine Buslinien erstellt</p>
                    <p className="text-slate-500 text-xs mb-4">
                      1. Baue einen Busbahnhof (Sidebar → Utilities)<br/>
                      2. Platziere Bushaltestellen entlang der Strassen<br/>
                      3. Erstelle hier eine Linie und verbinde die Haltestellen
                    </p>
                  </div>
                ) : (
                  busLines.map(line => (
                    <div key={line.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white truncate">{line.name}</div>
                          <div className="text-xs text-slate-400">{line.stops.length} Haltestellen</div>
                        </div>
                        <Badge variant={line.status === 'active' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                          {line.status === 'active' ? 'Aktiv' : 'Deaktiviert'}
                        </Badge>
                        {canManage && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300" onClick={() => handleEditLine(line)} title="Linie bearbeiten">
                              <Wrench className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleToggleLine(line)}>
                              {line.status === 'active' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDeleteLine(line.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Neue Linie erstellen */}
                {canManage && busLines.length < maxBusLines && (
                  <div className="pt-2 border-t border-slate-700/40">
                    {showNewLineForm ? (
                      <div className="space-y-2">
                        <Input
                          placeholder={`Linie ${busLines.length + 1}`}
                          value={newLineName}
                          onChange={e => setNewLineName(e.target.value)}
                          className="h-9 bg-slate-800/50 border-slate-700/50 text-sm"
                          maxLength={32}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-500" onClick={handleStartNewLine}>
                            Stops auf Karte wählen
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowNewLineForm(false)}>
                            Abbrechen
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Nach dem Klick wählst du 4-10 Bushaltestellen auf der Karte aus.
                        </p>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-9 text-xs border-dashed border-slate-600"
                        onClick={() => setShowNewLineForm(true)}
                      >
                        + Neue Linie erstellen
                      </Button>
                    )}
                  </div>
                )}

                {canManage && busLines.length >= maxBusLines && (
                  <p className="text-[10px] text-center text-slate-500">
                    Linien-Limit erreicht ({maxBusLines} bei Level {company.level}). Level steigern für mehr Linien.
                  </p>
                )}
              </div>
            </TabsContent>
          )}

          {/* Settings + NPC Tab */}
          {isOwner && (
            <>
            <TabsContent value="settings" className="mt-3">
              <SettingsTab companyName={company.name} companyId={company.id} onDissolve={onDissolve} />
            </TabsContent>
            {/* NPC-Bot Tab */}
            <TabsContent value="npcs" className="mt-3">
              <div className="space-y-4">
                {npcLoading ? (
                  <p className="text-slate-400 text-xs text-center py-4">Lade NPCs…</p>
                ) : (
                  <>
                    {/* Aktive NPCs */}
                    {npcBots.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Aktive Mitarbeiter ({npcBots.length})</div>
                        <div className="space-y-2 pr-0.5">
                        {npcBots.map(bot => {
                          const lvl = getNpcLevel(bot.xp_earned ?? 0);
                          // Echtzeit-Fortschritt aus contract_started_at + work_duration_seconds
                          const liveProgress = (bot.status === 'working' && bot.contract_started_at && bot.work_duration_seconds)
                            ? Math.min(100, Math.round(((Date.now() - new Date(bot.contract_started_at).getTime()) / (bot.work_duration_seconds * 1000)) * 100))
                            : (bot.work_progress_pct ?? 0);
                          // npcTick referenced to force re-render every second
                          void npcTick;
                          return (
                          <div key={bot.id} className={`border rounded-xl overflow-hidden transition-colors ${bot.patrol_mode ? 'bg-amber-500/8 border-amber-500/40' : 'bg-slate-800/60 border-slate-700/50'}`}>
                            {/* Patrol-Banner oben wenn aktiv */}
                            {bot.patrol_mode && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30">
                                <span className="text-sm">🚛</span>
                                <span className="text-[11px] font-semibold text-amber-300">Stadtpatrouille aktiv</span>
                                <span className="text-[10px] text-amber-400/70 ml-auto">repariert Gebäude &lt;90%</span>
                              </div>
                            )}
                            <div className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                  <span className="text-2xl">{bot.emoji}</span>
                                  <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold bg-slate-900 border border-slate-600 rounded px-0.5 ${lvl.color}`}>
                                    {lvl.level}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-sm font-medium text-white truncate">{bot.name}</span>
                                      <span className="text-[10px] text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded shrink-0">{bot.display_name}</span>
                                    </div>
                                    <span className={`text-[10px] font-semibold shrink-0 ${lvl.color}`}>{'★'.repeat(lvl.stars)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[10px] font-medium ${lvl.color}`}>Lv.{lvl.level} {lvl.title}</span>
                                    {lvl.bonus > 0 && <span className="text-[10px] text-emerald-400">+{Math.round(lvl.bonus*100)}% Effizienz</span>}
                                    <span className="text-[10px] text-slate-500 ml-auto">{bot.xp_earned ?? 0} XP</span>
                                  </div>
                                  {/* XP Fortschrittsbar */}
                                  {lvl.next && (
                                    <div className="mt-1 flex items-center gap-1.5">
                                      <div className="flex-1 bg-slate-700 rounded-full h-1">
                                        <div className={`h-1 rounded-full transition-all ${lvl.level >= 4 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${lvl.progress}%` }} />
                                      </div>
                                      <span className="text-[9px] text-slate-500 shrink-0">{lvl.next.xpMin - (bot.xp_earned ?? 0)} bis Lv.{lvl.next.level}</span>
                                    </div>
                                  )}
                                  {/* Arbeits-Status */}
                                  <div className="flex items-center gap-3 mt-1.5">
                                    {bot.patrol_mode ? (
                                      <div className="flex items-center gap-1.5 flex-1">
                                        <span className="text-[10px] text-amber-400">🔧 {bot.patrol_repairs ?? 0} Reparaturen</span>
                                      </div>
                                    ) : bot.status === 'working' ? (
                                      <div className="flex items-center gap-1.5 flex-1">
                                        <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${liveProgress}%` }} />
                                        </div>
                                        <span className="text-[10px] text-blue-400 shrink-0">{liveProgress}%</span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-green-400">● Bereit</span>
                                    )}
                                    <span className="text-[10px] text-slate-500">{bot.contracts_completed} Auftr.</span>
                                    <span className="text-[10px] text-amber-400">CHF {bot.salary_weekly}/Wo.</span>
                                  </div>
                                </div>
                                {/* Entlassen Button */}
                                <button
                                  onClick={async () => {
                                    if (!confirm(`${bot.name} wirklich entlassen?`)) return;
                                    try { await fireNpcBot(company.id, bot.id); setNpcBots(prev => prev.filter(b => b.id !== bot.id)); setNpcSuccess(`${bot.name} entlassen.`); }
                                    catch (e: unknown) { setNpcError(e instanceof Error ? e.message : 'Fehler'); }
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                                  title="Entlassen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Patrol-Toggle — nur für Werkhof-Firmen (nicht parkraum_security) */}
                              {company.type_code !== 'parkraum_security' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const r = await toggleNpcPatrol(company.id, bot.id);
                                    setNpcBots(prev => prev.map(b =>
                                      b.id === bot.id ? { ...b, patrol_mode: r.patrol_mode, status: r.patrol_mode ? 'idle' : b.status }
                                      : r.patrol_mode ? { ...b, patrol_mode: 0 } : b
                                    ));
                                    setNpcSuccess(r.patrol_mode ? `🚛 ${bot.name} patrouilliert jetzt die Stadt!` : `${bot.name} — Patrouille deaktiviert`);
                                  } catch (e: unknown) { setNpcError(e instanceof Error ? e.message : 'Fehler'); }
                                }}
                                className={`mt-2.5 w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                                  bot.patrol_mode
                                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                                    : 'bg-slate-700/50 border border-slate-600/50 text-slate-400 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-300'
                                }`}
                              >
                                <span>🚛</span>
                                {bot.patrol_mode ? 'Stadtpatrouille deaktivieren' : 'Als Stadtpatrouille einsetzen'}
                              </button>
                              )}
                            </div>
                          </div>
                          );
                        })}
                        </div>{/* end scroll container */}
                      </div>
                    )}

                    {/* Fehler/Erfolg */}
                    {npcError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{npcError}</p>}
                    {npcSuccess && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{npcSuccess}</p>}

                    {/* NPC Einstellen */}
                    <div className="space-y-2">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">NPC einstellen</div>
                      {npcTypes.map(t => {
                        const currentCount = npcBots.filter(b => b.bot_type === t.bot_type).length;
                        const atMax = currentCount >= t.max_per_company;
                        return (
                          <div key={t.bot_type} className={`bg-slate-800/60 border rounded-xl p-3 ${atMax ? 'border-slate-700/30 opacity-60' : 'border-slate-700/50'}`}>
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{t.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-white">{t.display_name}</span>
                                  <span className="text-[10px] text-slate-400">{currentCount}/{t.max_per_company}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{t.description}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-[10px] text-amber-400">Einstellung: CHF {t.hire_cost}</span>
                                  <span className="text-[10px] text-slate-400">Lohn: CHF {t.salary_weekly}/Wo.</span>
                                  <span className="text-[10px] text-blue-400">Effizienz: {Math.round(t.efficiency * 100)}%</span>
                                </div>
                              </div>
                            </div>
                            <button
                              disabled={atMax || hiringBot === t.bot_type}
                              onClick={async () => {
                                setHiringBot(t.bot_type); setNpcError(null); setNpcSuccess(null);
                                try {
                                  const r = await hireNpcBot(company.id, t.bot_type);
                                  setNpcSuccess(`${r.name} eingestellt! (CHF ${r.hireCost} abgezogen)`);
                                  const d = await getCompanyNpcBots(company.id);
                                  setNpcBots(d.bots);
                                } catch (e: unknown) { setNpcError(e instanceof Error ? e.message : 'Fehler'); }
                                finally { setHiringBot(null); }
                              }}
                              className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600/80 hover:bg-blue-600 text-white"
                            >
                              {hiringBot === t.bot_type ? 'Wird eingestellt…' : atMax ? 'Maximum erreicht' : `${t.display_name} einstellen`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// ── Company Loan Card ──────────────────────────────────
function CompanyLoanCard({ companyId }: { companyId: number }) {
  const [loan, setLoan] = useState<CompanyLoan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCompanyLoan(companyId)
      .then(l => { setLoan(l); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [companyId]);

  if (!loaded || !loan || loan.status === 'paid_off') return null;

  const paidPercent = loan.original_amount > 0
    ? Math.min(100, Math.round(((loan.original_amount - Math.max(0, loan.remaining_amount)) / loan.original_amount) * 100))
    : 0;

  const isDefaulted = loan.status === 'defaulted';

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDefaulted ? 'border-red-500/30 bg-red-500/5' :
      loan.missed_payments >= 2 ? 'border-red-500/25 bg-red-500/5' :
      loan.missed_payments >= 1 ? 'border-amber-500/25 bg-amber-500/5' :
      'border-blue-500/25 bg-blue-500/5'
    }`}>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🏦</span>
          <span className="text-sm font-medium text-white flex-1">Gemeinde-Kredit</span>
          {isDefaulted ? (
            <Badge variant="outline" className="text-[11px] text-red-400 border-red-400/30">Ausgefallen</Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-blue-400 border-blue-400/30">Aktiv</Badge>
          )}
        </div>

        {!isDefaulted && (
          <>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs mb-2.5">
              <div className="text-center">
                <div className="text-slate-500">Restschuld</div>
                <div className="font-mono font-bold text-amber-400">{Math.max(0, loan.remaining_amount).toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500">Rate/Woche</div>
                <div className="font-mono font-bold text-white">{loan.weekly_repayment.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500">Verpasst</div>
                <div className={`font-mono font-bold ${
                  loan.missed_payments >= 2 ? 'text-red-400' :
                  loan.missed_payments >= 1 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {loan.missed_payments}/3
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-1.5">
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>Zurückgezahlt</span>
                <span>{paidPercent}%</span>
              </div>
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
            </div>

            {loan.missed_payments >= 1 && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-400 mt-2">
                <AlertTriangle className="w-3 h-3" />
                <span>
                  {loan.missed_payments >= 2
                    ? 'Letzte Warnung! Noch 1 verpasste Zahlung und die Firma wird aufgelöst!'
                    : `${loan.missed_payments} verpasste Zahlung(en). Bei 3 wird die Firma aufgelöst.`
                  }
                </span>
              </div>
            )}
          </>
        )}

        {isDefaulted && (
          <div className="text-xs text-red-300/80">
            Kredit ausgefallen. {loan.remaining_amount > 0 ? `Restschuld: ${loan.remaining_amount.toLocaleString()} CHF (Verlust für Gemeinde)` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings Tab ────────────────────────────────────────
function SettingsTab({ companyName, companyId, onDissolve }: {
  companyName: string;
  companyId: number;
  onDissolve: (id: number) => void;
}) {
  const [confirmName, setConfirmName] = useState('');
  const [showDissolve, setShowDissolve] = useState(false);

  const nameMatch = confirmName.trim().toLowerCase() === companyName.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h4 className="text-sm font-medium text-red-400">Gefahrenzone</h4>
        </div>
        {!showDissolve ? (
          <button
            onClick={() => setShowDissolve(true)}
            className="text-xs text-red-400/60 hover:text-red-400 underline transition-colors"
          >
            Firma auflösen...
          </button>
        ) : (
          <div className="space-y-2.5 mt-2">
            <p className="text-xs text-red-300/80">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Mitglieder werden entfernt.
              Das Firmenguthaben wird an die Gemeindekasse zurückgezahlt.
            </p>
            <p className="text-xs text-slate-400">
              Zum Bestätigen, gib den Firmennamen ein: <strong className="text-white">{companyName}</strong>
            </p>
            <Input
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={companyName}
              className="bg-slate-800/50 border-red-500/30 text-white placeholder:text-slate-600 text-sm h-9 focus:border-red-500 focus:ring-red-500/30"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onDissolve(companyId)}
                disabled={!nameMatch}
                className={`text-xs ${nameMatch
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Endgültig auflösen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowDissolve(false); setConfirmName(''); }}
                className="border-slate-600 hover:bg-slate-700 text-slate-400 text-xs"
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Countdown Timer Hook ─────────────────────────────────
function useCountdown(targetDate: string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetDate) { setRemaining(0); return; }
    const target = new Date(targetDate).getTime();

    const update = () => {
      const diff = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return remaining;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  if (hrs > 0) return `${hrs}h ${min.toString().padStart(2, '0')}m`;
  if (min > 0) return `${min}:${sec.toString().padStart(2, '0')}`;
  return `${sec}s`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  if (hrs > 0 && min > 0) return `${hrs}h ${min}min`;
  if (hrs > 0) return `${hrs}h`;
  if (min > 0) return `${min} Min.`;
  return `${seconds}s`;
}

// ── Contract Card ─────────────────────────────────────────
function ContractCard({ contract, companyId, actionLoading, onAccept, onComplete }: {
  contract: CompanyContract;
  companyId: number;
  actionLoading: number | null;
  onAccept: (id: number) => void;
  onComplete: (id: number) => void;
}) {
  const c = contract;
  const remaining = useCountdown(c.completable_at || null);
  const isNpcWorking = c.status === 'in_progress';
  const isUserWorking = (c.status === 'accepted' || c.status === 'assigned') && remaining > 0;
  const isWorking = isUserWorking || isNpcWorking;
  const canComplete = (c.status === 'accepted' || c.status === 'assigned') && remaining === 0;

  const workDuration = c.work_duration_seconds || 60;
  const npcProgressPct = isNpcWorking && c.completable_at
    ? Math.min(100, Math.max(0, ((workDuration - Math.max(0, Math.ceil((new Date(c.completable_at).getTime() - Date.now()) / 1000))) / workDuration) * 100))
    : 0;
  const progressPct = isNpcWorking ? npcProgressPct
    : c.completable_at ? Math.min(100, Math.max(0, ((workDuration - remaining) / workDuration) * 100))
    : 0;

  const statusLabel = (s: string) => {
    switch (s) {
      case 'open': return 'Offen';
      case 'accepted': return remaining > 0 ? 'In Arbeit...' : 'Bereit';
      case 'assigned': return remaining > 0 ? 'In Arbeit...' : 'Bereit';
      case 'in_progress': return '🤖 NPC am Werk';
      case 'completed': return 'Erledigt';
      case 'failed': return 'Fehlgeschlagen';
      case 'cancelled': return 'Storniert';
      default: return s;
    }
  };
  const statusColor = (s: string) => {
    if ((s === 'accepted' || s === 'assigned') && remaining > 0) return 'text-amber-400 border-amber-400/30';
    if ((s === 'accepted' || s === 'assigned') && remaining === 0) return 'text-emerald-400 border-emerald-400/30';
    switch (s) {
      case 'open': return 'text-blue-400 border-blue-400/30';
      case 'in_progress': return 'text-violet-400 border-violet-400/30';
      case 'completed': return 'text-emerald-400 border-emerald-400/30';
      case 'failed': return 'text-red-400 border-red-400/30';
      case 'cancelled': return 'text-slate-400 border-slate-400/30';
      default: return '';
    }
  };

  return (
    <div className={`px-4 py-3 rounded-xl border ${
      c.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' :
      c.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
      isWorking ? 'border-amber-500/25 bg-amber-500/5' :
      canComplete ? 'border-emerald-500/30 ring-1 ring-emerald-500/20 bg-emerald-500/5' :
      'border-slate-700/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{c.event_emoji}</span>
        <span className="font-medium text-sm text-white flex-1">{c.event_name}</span>
        <Badge variant="outline" className={`text-[11px] ${statusColor(c.status)}`}>{statusLabel(c.status)}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
        <span className="text-amber-400 font-medium">{c.payment.toLocaleString()} CHF</span>
        <span>Schwierigkeit {c.difficulty}/5</span>
        {workDuration > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(workDuration)}
          </span>
        )}
        {c.assigned_nickname && <span>👤 {c.assigned_nickname}</span>}
        {c.npc_name && <span className="text-violet-400">🤖 {c.npc_name}</span>}
        {c.status === 'open' && c.deadline_at && (
          <span className="text-red-400">Frist: {(() => {
            const h = Math.max(0, Math.floor((new Date(c.deadline_at).getTime() - Date.now()) / 3600000));
            return h > 24 ? `${Math.floor(h / 24)} Tage` : `${h}h`;
          })()}</span>
        )}
      </div>

      {isWorking && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            {isNpcWorking
              ? <span className="text-violet-400 font-medium">🤖 NPC bearbeitet... {Math.round(progressPct)}%</span>
              : <span className="text-amber-400 font-medium">Wird bearbeitet...</span>
            }
            {!isNpcWorking && <span className="text-amber-400 font-mono">{formatTime(remaining)}</span>}
            {isNpcWorking && c.completable_at && (
              <span className="text-violet-400 font-mono">{formatTime(Math.max(0, Math.ceil((new Date(c.completable_at).getTime() - Date.now()) / 1000)))}</span>
            )}
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isNpcWorking ? 'bg-gradient-to-r from-violet-500 to-blue-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {canComplete && (
        <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 font-medium flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          Arbeit abgeschlossen — bereit zum Abschließen!
        </div>
      )}

      <div className="flex gap-2">
        {c.status === 'open' && (
          <Button size="sm" onClick={() => onAccept(c.id)}
            disabled={actionLoading === c.id}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
            {actionLoading === c.id ? '...' : 'Annehmen'}
          </Button>
        )}
        {canComplete && (
          <Button size="sm" onClick={() => onComplete(c.id)}
            disabled={actionLoading === c.id}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
            {actionLoading === c.id ? '...' : 'Abschließen & Kassieren'}
          </Button>
        )}
        {isWorking && (
          <Button size="sm" disabled className="bg-slate-700 text-slate-400 text-xs cursor-not-allowed">
            Noch {formatTime(remaining)}...
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Contracts Tab ─────────────────────────────────────────

type ContractSubTab = 'eingang' | 'aktiv' | 'abgeschlossen';

function ContractsTab({ companyId, contracts, canManage, canFixCategories, onRefresh }: {
  companyId: number;
  contracts: CompanyContract[];
  canManage: boolean;
  canFixCategories: string[];
  onRefresh: () => void;
}) {
  const [localContracts, setLocalContracts] = useState(contracts);
  const [subTab, setSubTab] = useState<ContractSubTab>(() => {
    const hasActive = contracts.some(c => ['accepted', 'assigned', 'in_progress'].includes(c.status));
    const hasOpen = contracts.some(c => c.status === 'open');
    if (hasActive) return 'aktiv';
    if (hasOpen) return 'eingang';
    return 'eingang';
  });
  const [reportedEvents, setReportedEvents] = useState<Array<{ id: number; name: string; emoji: string; category: string; severity: number; fix_cost: number; status: string }>>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showCreateFrom, setShowCreateFrom] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setLocalContracts(contracts); }, [contracts]);

  // Auto-Refresh: solange NPC-Verträge aktiv sind, alle 10s neu laden
  useEffect(() => {
    const hasNpcActive = localContracts.some(c => c.status === 'in_progress');
    if (!hasNpcActive) return;
    const id = setInterval(() => { onRefresh(); }, 10000);
    return () => clearInterval(id);
  }, [localContracts, onRefresh]);

  const handleAccept = async (contractId: number) => {
    try {
      setActionLoading(contractId);
      const result = await acceptContract(companyId, contractId);
      const data = result as { accepted: boolean; work_duration_seconds?: number; completable_at?: string; assigned_user_id?: number };
      setLocalContracts(prev => prev.map(c => c.id === contractId ? {
        ...c,
        status: 'accepted',
        work_duration_seconds: data.work_duration_seconds || c.work_duration_seconds,
        completable_at: data.completable_at || c.completable_at,
        assigned_user_id: data.assigned_user_id || c.assigned_user_id,
      } : c));
      setSubTab('aktiv');
      setMsg('Auftrag angenommen! Timer läuft...');
    } catch (err: unknown) { setMsg(err instanceof Error ? err.message : 'Fehler'); }
    finally { setActionLoading(null); }
  };

  const handleComplete = async (contractId: number) => {
    try {
      setActionLoading(contractId);
      const result = await completeContract(companyId, contractId);
      setLocalContracts(prev => prev.map(c => c.id === contractId ? { ...c, status: 'completed' } : c));
      setSubTab('abgeschlossen');
      let message = `Auftrag abgeschlossen! Firma: +${result.payment.toLocaleString()} CHF`;
      if (result.worker_payment > 0) {
        message += `, Dein Lohn: +${result.worker_payment.toLocaleString()} CHF`;
      } else if (result.salary_error) {
        message += ` (Lohn-Fehler: ${result.salary_error})`;
      }
      message += `, +${result.xp} XP`;
      if (result.leveled_up) {
        message += ` 🎉 Level-Up! Firma ist jetzt Level ${result.new_level}!`;
      }
      setMsg(message);
      onRefresh();
    } catch (err: unknown) { setMsg(err instanceof Error ? err.message : 'Fehler'); }
    finally { setActionLoading(null); }
  };

  const handleLoadEvents = async () => {
    setShowCreateFrom(!showCreateFrom);
    if (!showCreateFrom) {
      try {
        const events = await getReportedEvents();
        setReportedEvents(events.filter(e => canFixCategories.includes(e.category)));
      } catch { setReportedEvents([]); }
    }
  };

  const handleCreateContract = async (eventId: number) => {
    try {
      setActionLoading(eventId);
      const result = await createContractFromEvent(companyId, eventId);
      setReportedEvents(prev => prev.filter(e => e.id !== eventId));
      setMsg(`Auftrag erstellt: ${result.payment.toLocaleString()} CHF, ${result.xp_reward} XP`);
      const ev = reportedEvents.find(e => e.id === eventId);
      setLocalContracts(prev => [{ id: result.contract_id, company_id: companyId, event_id: eventId,
        municipality_id: 0, assigned_user_id: null, status: 'open', payment: result.payment,
        bonus: 0, penalty: 0, deadline_at: new Date(Date.now() + 86400000).toISOString(),
        difficulty: result.difficulty || ev?.severity || 1, xp_reward: result.xp_reward,
        event_name: ev?.name || 'Event',
        event_emoji: ev?.emoji || '',
        event_status: 'assigned',
        work_duration_seconds: result.work_duration_seconds || 300, completable_at: null }, ...prev]);
    } catch (err: unknown) { setMsg(err instanceof Error ? err.message : 'Fehler'); }
    finally { setActionLoading(null); }
  };

  const filteredContracts = localContracts.filter(c => {
    switch (subTab) {
      case 'eingang': return c.status === 'open';
      case 'aktiv': return ['accepted', 'assigned', 'in_progress'].includes(c.status);
      case 'abgeschlossen': return ['completed', 'failed', 'cancelled'].includes(c.status);
    }
  });

  const countByTab = {
    eingang: localContracts.filter(c => c.status === 'open').length,
    aktiv: localContracts.filter(c => ['accepted', 'assigned', 'in_progress'].includes(c.status)).length,
    abgeschlossen: localContracts.filter(c => ['completed', 'failed', 'cancelled'].includes(c.status)).length,
  };

  return (
    <div className="space-y-3">
      {msg && (
        <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{msg}</span>
          <button className="text-xs underline text-emerald-500/60 hover:text-emerald-400" onClick={() => setMsg(null)}>OK</button>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
        {([
          { key: 'eingang' as const, label: 'Eingang', count: countByTab.eingang },
          { key: 'aktiv' as const, label: 'Aktiv', count: countByTab.aktiv },
          { key: 'abgeschlossen' as const, label: 'Erledigt', count: countByTab.abgeschlossen },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 text-xs py-2 px-2 rounded-lg transition-all font-medium ${
              subTab === t.key
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}{t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {subTab === 'eingang' && canManage && (
          <Button size="sm" variant="outline" onClick={handleLoadEvents}
            className="w-full border-dashed border-slate-600/70 text-slate-400 hover:bg-slate-800/60 hover:text-white mb-1">
            {showCreateFrom ? 'Ausblenden' : 'Neuen Auftrag aus Ereignis erstellen'}
          </Button>
        )}

        {subTab === 'eingang' && showCreateFrom && reportedEvents.length > 0 && (
          <div className="space-y-2 p-3 rounded-xl border border-dashed border-slate-600/50 bg-slate-800/20">
            <p className="text-xs text-slate-500 font-medium">Gemeldete Ereignisse ohne Auftrag:</p>
            {reportedEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30">
                <span className="text-lg">{ev.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{ev.name}</div>
                  <div className="text-xs text-slate-500">Schwere {ev.severity}/5 · {ev.category}</div>
                </div>
                <Button size="sm" onClick={() => handleCreateContract(ev.id)}
                  disabled={actionLoading === ev.id}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                  {actionLoading === ev.id ? '...' : 'Beauftragen'}
                </Button>
              </div>
            ))}
          </div>
        )}
        {subTab === 'eingang' && showCreateFrom && reportedEvents.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-3">Keine passenden Ereignisse gefunden</p>
        )}

        {filteredContracts.length === 0 ? (
          <div className="text-center py-8">
            <Briefcase className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {subTab === 'eingang' ? 'Keine offenen Aufträge' :
               subTab === 'aktiv' ? 'Keine aktiven Aufträge' :
               'Keine abgeschlossenen Aufträge'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pr-0.5">
          {filteredContracts.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              companyId={companyId}
              actionLoading={actionLoading}
              onAccept={handleAccept}
              onComplete={handleComplete}
            />
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
