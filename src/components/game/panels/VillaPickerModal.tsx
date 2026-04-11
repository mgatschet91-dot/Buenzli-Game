'use client';

import React, { useState, useCallback } from 'react';
import { X, Lock, Check, Loader2, Crown, ShieldCheck, Star } from 'lucide-react';
import { VillaSpriteCanvas } from '@/components/game/VillaSpriteCanvas';
import { VILLA_CATALOG, TIER_COLORS, TIER_LABELS, TIER_BG, type VillaVariant } from '@/lib/villaCatalog';
import { useGame } from '@/context/GameContext';

interface VillaPickerModalProps {
  municipalitySlug: string;
  currentVariantRow: number | null;
  currentVariantCol: number | null;
  userRank: number;
  onUpgrade: (variantRow: number, variantCol: number) => Promise<void>;
  onClose: () => void;
}

function formatChf(n: number) {
  return n.toLocaleString('de-CH') + ' Fr.';
}

function RequirementBadge({ variant, userRank, municipalityRole }: {
  variant: VillaVariant;
  userRank: number;
  municipalityRole: string;
}) {
  const { requires_president, requires_council, min_rank } = variant.requirement;
  if (requires_president) {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-amber-400 font-medium">
        <Crown size={9} />Präsident
      </span>
    );
  }
  if (requires_council) {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-purple-400 font-medium">
        <ShieldCheck size={9} />Verwaltung
      </span>
    );
  }
  if (min_rank && min_rank > 0) {
    const met = userRank >= min_rank;
    return (
      <span className={`flex items-center gap-0.5 text-[9px] font-medium ${met ? 'text-blue-400' : 'text-slate-400'}`}>
        <Star size={9} />Rang {min_rank}
      </span>
    );
  }
  return null;
}

function isUnlocked(variant: VillaVariant, userRank: number, municipalityRole: string): boolean {
  const { requires_president, requires_council, min_rank } = variant.requirement;
  if (requires_president && municipalityRole !== 'owner') return false;
  if (requires_council && municipalityRole !== 'owner' && municipalityRole !== 'council') return false;
  if (min_rank && userRank < min_rank) return false;
  return true;
}

export function VillaPickerModal({
  municipalitySlug,
  currentVariantRow,
  currentVariantCol,
  userRank,
  onUpgrade,
  onClose,
}: VillaPickerModalProps) {
  const { municipalityRole } = useGame();

  const [selectedVariant, setSelectedVariant] = useState<VillaVariant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hoveredVariant, setHoveredVariant] = useState<VillaVariant | null>(null);

  const currentVariant = VILLA_CATALOG.find(
    v => v.row === currentVariantRow && v.col === currentVariantCol
  ) ?? null;

  const handleConfirm = useCallback(async () => {
    if (!selectedVariant) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await onUpgrade(selectedVariant.row, selectedVariant.col);
      setSuccess(`"${selectedVariant.name}" wurde als dein Traumhaus gesetzt!`);
      setSelectedVariant(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Kauf');
    } finally {
      setLoading(false);
    }
  }, [selectedVariant, onUpgrade]);

  // Group by tier
  const tiers = [1, 2, 3, 4, 5] as const;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Traumhaus wählen</h2>
            <p className="text-xs text-slate-400">Zahlung geht von deinem Privatkonto in die Gemeindekasse</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Current house */}
          {currentVariant && (
            <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-700/40 rounded-lg px-4 py-2.5">
              <Check size={16} className="text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Aktuelles Design: {currentVariant.name}</div>
                <div className="text-xs text-slate-400">{currentVariant.description} · {formatChf(currentVariant.price)} bezahlt</div>
              </div>
            </div>
          )}

          {/* Tiers */}
          {tiers.map(tier => {
            const tierVariants = VILLA_CATALOG.filter(v => v.tier === tier);
            return (
              <div key={tier}>
                <div className={`flex items-center gap-2 mb-2`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${TIER_COLORS[tier]} ${TIER_BG[tier]}`}>
                    {TIER_LABELS[tier]}
                  </span>
                  {tier === 4 && <span className="text-xs text-slate-400">· Nur für Verwaltungsmitglieder</span>}
                  {tier === 5 && <span className="text-xs text-slate-400">· Nur für den Gemeindepresident</span>}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {tierVariants.map(variant => {
                    const unlocked = isUnlocked(variant, userRank, municipalityRole);
                    const isCurrent = variant.row === currentVariantRow && variant.col === currentVariantCol;
                    const isSelected = selectedVariant?.row === variant.row && selectedVariant?.col === variant.col;
                    const isHovered = hoveredVariant?.row === variant.row && hoveredVariant?.col === variant.col;

                    return (
                      <div
                        key={`${variant.row}-${variant.col}`}
                        className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all duration-150 ${
                          !unlocked ? 'opacity-50 cursor-not-allowed border-slate-700' :
                          isCurrent ? 'border-emerald-500 ring-2 ring-emerald-500/30' :
                          isSelected ? 'border-amber-400 ring-2 ring-amber-400/30 scale-[1.02]' :
                          'border-slate-600 hover:border-slate-400'
                        } ${TIER_BG[tier]}`}
                        onClick={() => {
                          if (!unlocked || isCurrent) return;
                          setSelectedVariant(isSelected ? null : variant);
                          setError('');
                        }}
                        onMouseEnter={() => setHoveredVariant(variant)}
                        onMouseLeave={() => setHoveredVariant(null)}
                        title={unlocked ? variant.description : 'Nicht verfügbar'}
                      >
                        {/* Sprite preview */}
                        <div className="w-full aspect-square bg-slate-900">
                          <VillaSpriteCanvas row={variant.row} col={variant.col} size={96} />
                        </div>

                        {/* Lock overlay */}
                        {!unlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                            <Lock size={18} className="text-slate-400" />
                          </div>
                        )}

                        {/* Current checkmark */}
                        {isCurrent && (
                          <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                            <Check size={10} className="text-white" />
                          </div>
                        )}

                        {/* Selected indicator */}
                        {isSelected && !isCurrent && (
                          <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-0.5">
                            <Check size={10} className="text-white" />
                          </div>
                        )}

                        {/* Bottom: price */}
                        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-center">
                          <div className="text-[9px] text-white font-medium truncate">{variant.name}</div>
                          <div className={`text-[9px] ${unlocked ? 'text-amber-300' : 'text-slate-400'}`}>
                            {formatChf(variant.price)}
                          </div>
                        </div>

                        {/* Requirement badge */}
                        <div className="absolute top-1 left-1">
                          <RequirementBadge variant={variant} userRank={userRank} municipalityRole={municipalityRole} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {hoveredVariant && (
          <div className="mx-4 mb-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-300">
            <span className="font-semibold text-white">{hoveredVariant.name}</span>
            {' — '}{hoveredVariant.description}
            {' · '}<span className="text-amber-300">{formatChf(hoveredVariant.price)}</span>
            {isUnlocked(hoveredVariant, userRank, municipalityRole)
              ? <span className="ml-2 text-emerald-400">· Verfügbar</span>
              : <span className="ml-2 text-red-400">· Nicht verfügbar</span>
            }
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-700 px-5 py-4">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          {success && <p className="text-xs text-emerald-400 mb-2">{success}</p>}

          {selectedVariant ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm">
                <span className="text-white font-semibold">{selectedVariant.name}</span>
                <span className="text-slate-400"> · </span>
                <span className="text-amber-300 font-bold">{formatChf(selectedVariant.price)}</span>
                <div className="text-xs text-slate-400">Zahlung vom Privatkonto → Gemeindekasse</div>
              </div>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Kaufen
              </button>
              <button
                onClick={() => setSelectedVariant(null)}
                className="text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm border border-slate-600 hover:border-slate-400 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center">
              Wähle ein Design aus dem Katalog · Preis wird direkt von deinem Konto abgebucht
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
