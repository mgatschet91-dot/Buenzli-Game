'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import * as achievementApi from '@/lib/api/achievementApi';

interface AchievementCenterProps {
  className?: string;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Gerade eben';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} Min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} Std`;
  return `${Math.floor(diff / 86400000)} Tage`;
}

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

function playAchievementReachedSound() {
  const audioCtx = createAudioContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.13, now + idx * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.24);
    });
  } finally {
    setTimeout(() => {
      audioCtx.close().catch(() => {});
    }, 450);
  }
}

function playAchievementClaimSound() {
  const audioCtx = createAudioContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const oscA = audioCtx.createOscillator();
    const gainA = audioCtx.createGain();
    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(700, now);
    oscA.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    gainA.gain.setValueAtTime(0.0001, now);
    gainA.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gainA.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    oscA.connect(gainA);
    gainA.connect(audioCtx.destination);
    oscA.start(now);
    oscA.stop(now + 0.2);

    const oscB = audioCtx.createOscillator();
    const gainB = audioCtx.createGain();
    oscB.type = 'square';
    oscB.frequency.setValueAtTime(1244.51, now + 0.07); // D#6
    gainB.gain.setValueAtTime(0.0001, now + 0.07);
    gainB.gain.exponentialRampToValueAtTime(0.08, now + 0.09);
    gainB.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    oscB.connect(gainB);
    gainB.connect(audioCtx.destination);
    oscB.start(now + 0.07);
    oscB.stop(now + 0.25);
  } finally {
    setTimeout(() => {
      audioCtx.close().catch(() => {});
    }, 420);
  }
}

export function AchievementCenter({ className }: AchievementCenterProps) {
  const { addNotification, addMoney } = useGame();
  const multiplayer = useMultiplayerOptional();
  const roomCode = multiplayer?.roomCode || 'MAIN';
  const isGuestMode = multiplayer?.isViewOnly ?? false;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [entries, setEntries] = useState<achievementApi.AchievementEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claimingCode, setClaimingCode] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousEntriesRef = useRef<Map<string, { achieved: boolean; claimed: boolean }> | null>(null);
  const hasSyncedEntriesRef = useRef(false);

  const claimableCount = useMemo(
    () => entries.filter((entry) => entry.achieved && !entry.claimed).length,
    [entries]
  );

  const loadAchievements = useCallback(async () => {
    if (isGuestMode) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await achievementApi.getMyAchievements(roomCode);
      const nextEntries = Array.isArray(response.data?.achievements) ? response.data.achievements : [];
      if (hasSyncedEntriesRef.current && previousEntriesRef.current) {
        let hasNewAchievement = false;
        for (const entry of nextEntries) {
          const previous = previousEntriesRef.current.get(entry.code);
          if (!previous) continue;
          if (!previous.achieved && entry.achieved) {
            hasNewAchievement = true;
            break;
          }
        }
        if (hasNewAchievement) {
          playAchievementReachedSound();
          addNotification('Achievement erreicht!', 'Neuer Erfolg freigeschaltet.', 'gift');
        }
      }

      const nextMap = new Map<string, { achieved: boolean; claimed: boolean }>();
      for (const entry of nextEntries) {
        nextMap.set(entry.code, { achieved: Boolean(entry.achieved), claimed: Boolean(entry.claimed) });
      }
      previousEntriesRef.current = nextMap;
      hasSyncedEntriesRef.current = true;
      setEntries(nextEntries);
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Achievements konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, isGuestMode, addNotification]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAchievements();
    }
  }, [isOpen, loadAchievements]);

  useEffect(() => {
    if (isGuestMode || !isOpen) return;
    const interval = setInterval(() => {
      loadAchievements();
    }, 60000);
    return () => clearInterval(interval);
  }, [isGuestMode, isOpen, loadAchievements]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const claimOne = async (code: string) => {
    if (!code) return;
    setClaimingCode(code);
    try {
      const response = await achievementApi.claimMyAchievement(code, roomCode);
      const money = Number(response.data?.reward_money_applied || 0);
      const xp = Number(response.data?.reward_xp_applied || 0);

      if (money > 0) addMoney(money);

      playAchievementClaimSound();
      const parts: string[] = [];
      if (money > 0) parts.push(`+${money.toLocaleString()} CHF`);
      if (xp > 0) parts.push(`+${xp} XP`);
      addNotification(
        'Achievement geclaimed',
        parts.length > 0 ? `Belohnung: ${parts.join(', ')}` : 'Belohnung wurde verbucht.',
        'gift'
      );
      await loadAchievements();
    } catch (err) {
      addNotification(
        'Claim fehlgeschlagen',
        err instanceof Error ? err.message : 'Achievement konnte nicht geclaimed werden.',
        'default'
      );
    } finally {
      setClaimingCode(null);
    }
  };

  const position = useMemo(() => {
    if (!buttonRef.current) return { top: 60, right: 16 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          'hover:bg-slate-700/50',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          isOpen && 'bg-slate-700/50',
          className
        )}
        aria-label="Achievements"
      >
        <Trophy className={cn('w-5 h-5 transition-colors', claimableCount > 0 ? 'text-amber-400' : 'text-slate-400')} />
        {claimableCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-amber-500 text-black rounded-full animate-pulse">
            {claimableCount > 9 ? '9+' : claimableCount}
          </span>
        )}
      </button>

      {mounted && isOpen && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] w-[360px] max-h-[460px] bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
          style={{ top: position.top, right: position.right }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-medium text-white text-sm">Achievements</span>
              <span className="text-xs text-slate-400">({entries.length})</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[390px]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-300 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Lade Achievements...
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-sm text-red-300">
                {error}
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={loadAchievements}>
                    Erneut laden
                  </Button>
                </div>
              </div>
            ) : entries.length <= 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">Noch keine Achievements vorhanden.</div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {entries.map((entry) => {
                  const isClaiming = claimingCode === entry.code;
                  return (
                    <div key={entry.id} className="px-4 py-3 hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-white truncate">{entry.title}</h4>
                            {entry.claimed ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Geclaimed
                              </span>
                            ) : entry.achieved ? (
                              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                Erreicht
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{entry.description}</p>

                          <div className="mt-2">
                            <Progress value={entry.progress_percent} className="h-2 bg-slate-700" />
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span>{entry.progress_value.toLocaleString()} / {entry.goal_value.toLocaleString()}</span>
                              <span>{entry.progress_percent}%</span>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-[10px] text-amber-300">
                              Reward: +{entry.reward_money.toLocaleString()} CHF, +{entry.reward_xp} XP
                            </div>
                            {entry.achieved && !entry.claimed ? (
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => claimOne(entry.code)}
                                disabled={isClaiming}
                              >
                                {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-500 flex items-center justify-between">
            <span>
              Claimbar: {claimableCount} offen
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastLoadedAt ? formatTime(lastLoadedAt) : '-'}
            </span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default AchievementCenter;
