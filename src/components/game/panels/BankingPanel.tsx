'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, CreditCard, BadgeInfo, ReceiptText, RefreshCw } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getMyBankingProfile,
  getMyBankingTransactions,
  type UserBankingProfile,
  type BankingTransaction,
} from '@/lib/api/bankingApi';

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

function txTypeLabel(type: string): string {
  switch (type) {
    case 'tax': return 'Steuer';
    case 'transfer_in': return 'Eingang';
    case 'transfer_out': return 'Ausgang';
    case 'reward': return 'Belohnung';
    case 'fee': return 'Gebühr';
    case 'salary': return 'Firmenlohn';
    case 'founding_cost': return 'Gründungskosten';
    case 'expense': return 'Ausgabe';
    case 'income': return 'Einnahme';
    default: return type;
  }
}

export function BankingPanel() {
  const { setActivePanel } = useGame();
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
      setError(err instanceof Error ? err.message : 'Bankdaten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const statusLabel = useMemo(() => {
    switch (profile?.status) {
      case 'active':
        return 'Aktiv';
      case 'frozen':
        return 'Gesperrt';
      case 'closed':
        return 'Geschlossen';
      default:
        return '-';
    }
  }, [profile?.status]);

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[760px] bg-slate-900/95 border-slate-700 text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Landmark className="w-5 h-5" />
            Bank & Identität
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
              Aktualisieren
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {!error && loading && (
            <div className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300">
              Lade Bankdaten...
            </div>
          )}

          {!error && !loading && profile && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <CreditCard className="w-4 h-4" />
                    Konto
                  </div>
                  <div className="font-mono text-lg text-emerald-300">
                    {formatMoney(profile.balance, profile.currency)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{profile.account_number}</div>
                  <div className="text-xs text-slate-400 font-mono">{profile.card_number_masked}</div>
                  <div className="text-xs text-slate-400">Status: {statusLabel}</div>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <BadgeInfo className="w-4 h-4" />
                    Identität
                  </div>
                  <div className="text-xs text-slate-400">AHV-ID</div>
                  <div className="font-mono text-sm text-slate-100">{profile.ahv_number}</div>
                  <div className="text-xs text-slate-400">Steuernummer</div>
                  <div className="font-mono text-sm text-slate-100">{profile.tax_number}</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                <div className="flex items-center gap-2 text-slate-300 text-sm mb-2">
                  <ReceiptText className="w-4 h-4" />
                  Letzte Transaktionen
                </div>
                {transactions.length === 0 ? (
                  <div className="text-sm text-slate-400">Noch keine Transaktionen vorhanden.</div>
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
