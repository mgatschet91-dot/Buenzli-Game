'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, CreditCard, BadgeInfo, ReceiptText, RefreshCw } from 'lucide-react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getMyBankingProfile,
  getMyBankingTransactions,
  type UserBankingProfile,
  type BankingTransaction,
} from '@/lib/api/bankingApi';

const UI_LABELS = {
  title:          msg('Bank & Identität'),
  refresh:        msg('Aktualisieren'),
  loading:        msg('Lade Bankdaten...'),
  account:        msg('Konto'),
  identity:       msg('Identität'),
  ahvId:          msg('AHV-ID'),
  taxNumber:      msg('Steuernummer'),
  transactions:   msg('Letzte Transaktionen'),
  noTransactions: msg('Noch keine Transaktionen vorhanden.'),
  statusLabel:    msg('Status:'),
  statusActive:   msg('Aktiv'),
  statusFrozen:   msg('Gesperrt'),
  statusClosed:   msg('Geschlossen'),
  txTax:          msg('Steuer'),
  txIn:           msg('Eingang'),
  txOut:          msg('Ausgang'),
  txReward:       msg('Belohnung'),
  txFee:          msg('Gebühr'),
  txSalary:       msg('Firmenlohn'),
  txFounding:     msg('Gründungskosten'),
  txExpense:      msg('Ausgabe'),
  txIncome:       msg('Einnahme'),
  loadError:      msg('Bankdaten konnten nicht geladen werden'),
};

function formatMoney(amount: number, currency = 'CHF'): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('de-CH');
}

export function BankingPanel() {
  const { setActivePanel } = useGame();
  const m = useMessages();
  const mm = (key: Parameters<typeof m>[0]): string => (m(key) ?? String(key)) as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserBankingProfile | null>(null);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, txData] = await Promise.all([
        getMyBankingProfile(),
        getMyBankingTransactions(20, 0),
      ]);
      setProfile(profileData);
      setTransactions(txData.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : mm(UI_LABELS.loadError as Parameters<typeof m>[0]));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const txTypeLabel = (type: string): string => {
    switch (type) {
      case 'tax': return mm(UI_LABELS.txTax as Parameters<typeof m>[0]);
      case 'transfer_in': return mm(UI_LABELS.txIn as Parameters<typeof m>[0]);
      case 'transfer_out': return mm(UI_LABELS.txOut as Parameters<typeof m>[0]);
      case 'reward': return mm(UI_LABELS.txReward as Parameters<typeof m>[0]);
      case 'fee': return mm(UI_LABELS.txFee as Parameters<typeof m>[0]);
      case 'salary': return mm(UI_LABELS.txSalary as Parameters<typeof m>[0]);
      case 'founding_cost': return mm(UI_LABELS.txFounding as Parameters<typeof m>[0]);
      case 'expense': return mm(UI_LABELS.txExpense as Parameters<typeof m>[0]);
      case 'income': return mm(UI_LABELS.txIncome as Parameters<typeof m>[0]);
      default: return type;
    }
  };

  const statusLabel = useMemo(() => {
    switch (profile?.status) {
      case 'active':
        return mm(UI_LABELS.statusActive as Parameters<typeof m>[0]);
      case 'frozen':
        return mm(UI_LABELS.statusFrozen as Parameters<typeof m>[0]);
      case 'closed':
        return mm(UI_LABELS.statusClosed as Parameters<typeof m>[0]);
      default:
        return '-';
    }
  }, [profile?.status, m]);

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[760px] bg-slate-900/95 border-slate-700 text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Landmark className="w-5 h-5" />
            {mm(UI_LABELS.title as Parameters<typeof m>[0])}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {mm(UI_LABELS.refresh as Parameters<typeof m>[0])}
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {!error && loading && (
            <div className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300">
              {mm(UI_LABELS.loading as Parameters<typeof m>[0])}
            </div>
          )}

          {!error && !loading && profile && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <CreditCard className="w-4 h-4" />
                    {mm(UI_LABELS.account as Parameters<typeof m>[0])}
                  </div>
                  <div className="font-mono text-lg text-emerald-300">
                    {formatMoney(profile.balance, profile.currency)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{profile.account_number}</div>
                  <div className="text-xs text-slate-400 font-mono">{profile.card_number_masked}</div>
                  <div className="text-xs text-slate-400">
                    {mm(UI_LABELS.statusLabel as Parameters<typeof m>[0])} {statusLabel}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <BadgeInfo className="w-4 h-4" />
                    {mm(UI_LABELS.identity as Parameters<typeof m>[0])}
                  </div>
                  <div className="text-xs text-slate-400">{mm(UI_LABELS.ahvId as Parameters<typeof m>[0])}</div>
                  <div className="font-mono text-sm text-slate-100">{profile.ahv_number}</div>
                  <div className="text-xs text-slate-400">{mm(UI_LABELS.taxNumber as Parameters<typeof m>[0])}</div>
                  <div className="font-mono text-sm text-slate-100">{profile.tax_number}</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                <div className="flex items-center gap-2 text-slate-300 text-sm mb-2">
                  <ReceiptText className="w-4 h-4" />
                  {mm(UI_LABELS.transactions as Parameters<typeof m>[0])}
                </div>
                {transactions.length === 0 ? (
                  <div className="text-sm text-slate-400">{mm(UI_LABELS.noTransactions as Parameters<typeof m>[0])}</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-md border border-slate-700/80 bg-slate-900/40 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-slate-100 truncate">
                            {tx.description || txTypeLabel(tx.type)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {txTypeLabel(tx.type)} · {formatDate(tx.created_at)}
                          </div>
                        </div>
                        <div className={`font-mono text-sm ${tx.direction === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.direction === 'credit' ? '+' : '-'}
                          {formatMoney(tx.amount, profile.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
