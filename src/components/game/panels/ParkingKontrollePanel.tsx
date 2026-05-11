'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const CHECK_DURATION_MS = 2000;
const TICK_MS = 50;
const HIDE_AFTER_MS = 1500;   // Ergebnis kurz zeigen, dann ausblenden
const CHECKED_TTL_MS = 10 * 60 * 1000; // 10 min: schon geprüfte Autos nicht nochmal zeigen

const CH_CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'];

function hashVehicle(tileX: number, tileY: number, slot: number, color: string): number {
  let h = 0;
  const s = `${tileX}|${tileY}|${slot}|${color}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

function getPlate(tileX: number, tileY: number, slot: number, color: string): string {
  const h = hashVehicle(tileX, tileY, slot, color);
  const canton = CH_CANTONS[h % CH_CANTONS.length];
  const num = 100 + (Math.abs(hashVehicle(tileX + 1, tileY + 1, slot + 1, color)) % 99900);
  return `${canton} ${num}`;
}

function storageKey(tileX: number, tileY: number) {
  return `parking_checked_${tileX}_${tileY}`;
}

function loadCheckedKeys(tileX: number, tileY: number): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey(tileX, tileY));
    if (!raw) return new Set();
    const entries: Array<{ key: string; ts: number }> = JSON.parse(raw);
    const now = Date.now();
    return new Set(entries.filter(e => now - e.ts < CHECKED_TTL_MS).map(e => e.key));
  } catch { return new Set(); }
}

function persistCheckedKey(tileX: number, tileY: number, key: string) {
  if (typeof window === 'undefined') return;
  try {
    const sk = storageKey(tileX, tileY);
    const raw = localStorage.getItem(sk);
    const existing: Array<{ key: string; ts: number }> = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const updated = [
      ...existing.filter(e => e.key !== key && now - e.ts < CHECKED_TTL_MS),
      { key, ts: now },
    ];
    localStorage.setItem(sk, JSON.stringify(updated));
  } catch { /* silent */ }
}

interface ParkedVehicle {
  tileX: number;
  tileY: number;
  slot: number;
  color: string;
}

interface Props {
  tileX: number;
  tileY: number;
  parkingSize: number;
  onClose: () => void;
  parkedVehiclesRef: React.MutableRefObject<ParkedVehicle[]>;
}

type SlotState = 'idle' | 'scanning' | 'clean' | 'busted';

interface SlotData {
  state: SlotState;
  progress: number;
  payout?: number;
}

export function ParkingKontrollePanel({ tileX, tileY, parkingSize, onClose, parkedVehiclesRef }: Props) {
  const [slots, setSlots] = useState<Record<string, SlotData>>({});
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => loadCheckedKeys(tileX, tileY));
  const [totalEarned, setTotalEarned] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const hideTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [vehicles, setVehicles] = useState<ParkedVehicle[]>(() => [...(parkedVehiclesRef.current ?? [])]);
  useEffect(() => {
    setVehicles([...(parkedVehiclesRef.current ?? [])]);
    const t = setInterval(() => setVehicles([...(parkedVehiclesRef.current ?? [])]), 1000);
    return () => clearInterval(t);
  }, [parkedVehiclesRef]);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearInterval);
      Object.values(hideTimers.current).forEach(clearTimeout);
    };
  }, []);

  const markCheckedAndHide = useCallback((key: string) => {
    persistCheckedKey(tileX, tileY, key);
    hideTimers.current[key] = setTimeout(() => {
      setCheckedKeys(prev => new Set([...prev, key]));
      delete hideTimers.current[key];
    }, HIDE_AFTER_MS);
  }, [tileX, tileY]);

  // Sichtbare Autos: noch nicht geprüft und noch parkiert
  const visibleSlots: ParkedVehicle[] = [];
  for (let dy = 0; dy < parkingSize; dy++) {
    for (let dx = 0; dx < parkingSize; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      vehicles
        .filter(v => Number(v.tileX) === tx && Number(v.tileY) === ty)
        .forEach(v => {
          const key = `${v.tileX}_${v.tileY}_${v.slot}`;
          if (!checkedKeys.has(key)) visibleSlots.push(v);
        });
    }
  }

  const totalParked = (() => {
    let n = 0;
    for (let dy = 0; dy < parkingSize; dy++)
      for (let dx = 0; dx < parkingSize; dx++)
        n += vehicles.filter(v => Number(v.tileX) === tileX + dx && Number(v.tileY) === tileY + dy).length;
    return n;
  })();
  const checkedCount = totalParked - visibleSlots.length;

  function getSlot(key: string): SlotData {
    return slots[key] ?? { state: 'idle', progress: 0 };
  }

  function startScan(v: ParkedVehicle) {
    const key = `${v.tileX}_${v.tileY}_${v.slot}`;
    if (getSlot(key).state === 'scanning') return;

    setErrorMsg(null);
    setSlots(prev => ({ ...prev, [key]: { state: 'scanning', progress: 0 } }));

    const startedAt = Date.now();
    timers.current[key] = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(100, Math.round((elapsed / CHECK_DURATION_MS) * 100));

      if (progress < 100) {
        setSlots(prev => ({ ...prev, [key]: { state: 'scanning', progress } }));
        return;
      }

      clearInterval(timers.current[key]);
      delete timers.current[key];

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
        const res = await fetch(`${API_BASE}/api/parking/kontrolle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Game-Token': token } : {}),
          },
          body: JSON.stringify({ tileX: v.tileX, tileY: v.tileY, slot: v.slot }),
        });
        const json = await res.json();

        if (!json.ok) {
          setErrorMsg(json.error ?? 'Fehler');
          setSlots(prev => ({ ...prev, [key]: { state: 'idle', progress: 0 } }));
          return;
        }

        const { hasViolation, userPayout } = json.data;
        if (hasViolation) {
          setSlots(prev => ({ ...prev, [key]: { state: 'busted', progress: 100, payout: userPayout } }));
          setTotalEarned(prev => prev + userPayout);
        } else {
          setSlots(prev => ({ ...prev, [key]: { state: 'clean', progress: 100 } }));
        }
        markCheckedAndHide(key);
      } catch {
        setErrorMsg('Netzwerkfehler');
        setSlots(prev => ({ ...prev, [key]: { state: 'idle', progress: 0 } }));
      }
    }, TICK_MS);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-800 px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚔</span>
            <div>
              <div className="font-bold text-sm text-white">Parkplatz-Kontrolle</div>
              <div className="text-xs text-slate-400">
                Tile {tileX}/{tileY}
                {checkedCount > 0 && (
                  <span className="ml-2 text-slate-500">{checkedCount}/{totalParked} geprüft</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg font-bold leading-none">✕</button>
        </div>

        {/* Verdienst-Banner */}
        {totalEarned > 0 && (
          <div className="bg-green-900/40 border-b border-green-700/40 px-4 py-2 flex items-center gap-2">
            <span className="text-green-400 font-bold text-sm">+CHF {totalEarned}</span>
            <span className="text-green-300 text-xs">auf dein Konto gutgeschrieben</span>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div
            className="bg-red-900/30 border-b border-red-700/30 px-4 py-2 text-red-300 text-xs cursor-pointer"
            onClick={() => setErrorMsg(null)}
          >
            {errorMsg}
          </div>
        )}

        {/* Body */}
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {visibleSlots.length === 0 ? (
            <div className="text-center py-6">
              {totalParked === 0
                ? <p className="text-slate-400 text-sm">Keine parkierten Fahrzeuge</p>
                : <p className="text-green-400 text-sm font-semibold">✓ Alle {totalParked} Fahrzeuge geprüft</p>
              }
            </div>
          ) : (
            visibleSlots.map((v) => {
              const key      = `${v.tileX}_${v.tileY}_${v.slot}`;
              const slotData = getSlot(key);

              const rowBg =
                slotData.state === 'busted'   ? 'border-orange-600/60 bg-orange-950/40' :
                slotData.state === 'clean'    ? 'border-green-700/40 bg-green-950/30' :
                slotData.state === 'scanning' ? 'border-blue-700/40 bg-blue-950/20' :
                'border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer';

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => startScan(v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startScan(v); }}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-all select-none ${rowBg}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                      style={{ background: v.color ?? '#4a5568' }}
                    >🚗</div>

                    <div className="flex-1 min-w-0">
                      {/* Schweizer Kennzeichen */}
                      <div className="inline-flex items-center rounded border border-gray-400 bg-white overflow-hidden shadow-sm">
                        <div className="flex items-center justify-center bg-red-600 px-1 py-0.5 self-stretch">
                          <span className="text-white font-bold text-[9px] leading-none">🇨🇭</span>
                        </div>
                        <span className="px-2 py-0.5 text-black font-bold text-xs font-mono tracking-widest">
                          {getPlate(v.tileX, v.tileY, v.slot, v.color)}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5">
                        {slotData.state === 'idle'     && <span className="text-slate-500">Antippen zum Prüfen</span>}
                        {slotData.state === 'scanning' && <span className="text-blue-400 animate-pulse">Wird gescannt…</span>}
                        {slotData.state === 'clean'    && <span className="text-green-400 font-semibold">✓ Alles OK</span>}
                        {slotData.state === 'busted'   && <span className="text-orange-400 font-bold">🚨 Busse! +CHF {slotData.payout}</span>}
                      </div>
                    </div>
                  </div>

                  {slotData.state === 'scanning' && (
                    <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${slotData.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-4 py-3 bg-slate-800/60">
          <p className="text-xs text-slate-500 text-center">
            CHF 15 pro Schwarzparker → dein Konto · CHF 10 → Firma · CHF 25 → Gemeinde
          </p>
        </div>
      </div>
    </div>
  );
}
