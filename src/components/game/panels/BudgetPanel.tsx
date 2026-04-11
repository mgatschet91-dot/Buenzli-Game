'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Wallet, Building2, Landmark, Wrench } from 'lucide-react';

const UI_LABELS = {
  budget: msg('Budget'),
  income: msg('Income'),
  expenses: msg('Expenses'),
  net: msg('Net'),
};

interface BudgetPanelProps {
  isViewOnly?: boolean;
}

export function BudgetPanel({ isViewOnly = false }: BudgetPanelProps) {
  const { state, setActivePanel, setBudgetFunding } = useGame();
  const { budget, stats } = state;
  const m = useMessages();

  const netIncome = stats.income - stats.expenses;
  const taxIncome = stats.tax_income || 0;
  const populationTaxIncome = stats.tax_income_population || 0;
  const businessTaxIncome = stats.tax_income_business || 0;
  const propertyTaxIncome = stats.tax_income_property || 0;
  const buildingIncome = stats.building_income || 0;
  
  const categories = [
    { key: 'police', ...budget.police },
    { key: 'fire', ...budget.fire },
    { key: 'health', ...budget.health },
    { key: 'education', ...budget.education },
    { key: 'transportation', ...budget.transportation },
    { key: 'parks', ...budget.parks },
    { key: 'power', ...budget.power },
    { key: 'water', ...budget.water },
  ];
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[520px] bg-slate-900/95 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wallet className="w-5 h-5" />
            {m(UI_LABELS.budget)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5">
          {/* Hauptübersicht: Einkommen / Ausgaben / Netto */}
          <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-700">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <TrendingUp className="w-3 h-3" />
                Einkommen
              </div>
              <div className="text-emerald-400 font-mono font-semibold text-sm">
                ${stats.income.toLocaleString()}/Tag
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <TrendingDown className="w-3 h-3" />
                Ausgaben
              </div>
              <div className="text-red-400 font-mono font-semibold text-sm">
                ${stats.expenses.toLocaleString()}/Tag
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Wallet className="w-3 h-3" />
                Netto
              </div>
              <div className={`font-mono font-semibold text-sm ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netIncome >= 0 ? '+' : ''}${netIncome.toLocaleString()}/Tag
              </div>
            </div>
          </div>

          {/* Einkommens-Aufschluesselung */}
          {stats.income > 0 && (
            <div className="space-y-1.5 pb-4 border-b border-slate-700">
              <div className="text-xs text-slate-400 font-medium mb-2">Einnahmen-Details</div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Landmark className="w-3.5 h-3.5" />
                  Steuern gesamt
                </span>
                <span className="font-mono text-emerald-400">${taxIncome.toLocaleString()}/Tag</span>
              </div>
              <div className="pl-5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">- Einwohnersteuer</span>
                  <span className="font-mono text-emerald-400">${populationTaxIncome.toLocaleString()}/Tag</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">- Firmensteuer (v1)</span>
                  <span className="font-mono text-emerald-400">${businessTaxIncome.toLocaleString()}/Tag</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">- Grundsteuer</span>
                  <span className="font-mono text-emerald-400">${propertyTaxIncome.toLocaleString()}/Tag</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Building2 className="w-3.5 h-3.5" />
                  Gebäude-Einkommen
                </span>
                <span className="font-mono text-emerald-400">${buildingIncome.toLocaleString()}/Tag</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Wrench className="w-3.5 h-3.5" />
                  Unterhalt
                </span>
                <span className="font-mono text-red-400">-${stats.expenses.toLocaleString()}/Tag</span>
              </div>
            </div>
          )}
          
          {isViewOnly && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded text-amber-400 text-sm">
              <span>🔒</span>
              <span>Nur Besitzer oder Verwaltung können das Budget ändern</span>
            </div>
          )}
          
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.key} className="flex items-center gap-4">
                <Label className="w-28 text-sm text-slate-300">{cat.name}</Label>
                {isViewOnly ? (
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-500 rounded-full" 
                      style={{ width: `${cat.funding}%` }}
                    />
                  </div>
                ) : (
                  <Slider
                    value={[cat.funding]}
                    onValueChange={(value) => setBudgetFunding(cat.key as keyof typeof budget, value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                )}
                <span className="w-12 text-right font-mono text-sm text-slate-300">{cat.funding}%</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
