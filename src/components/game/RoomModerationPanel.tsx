'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Shield, UserX, Ban, Loader2, X, Trash2 } from 'lucide-react';
import { getAuthToken } from '@/lib/api/coreApi';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

interface Visitor {
  playerId: string;
  userId: number | null;
  name: string;
}

interface BannedUser {
  banned_user_id: number;
  nickname: string;
  reason: string | null;
  created_at: string;
}

interface RoomModerationPanelProps {
  visitors: Visitor[];
  onClose: () => void;
}

export function RoomModerationPanel({ visitors, onClose }: RoomModerationPanelProps) {
  const [bans, setBans]       = useState<BannedUser[]>([]);
  const [busy, setBusy]       = useState<number | null>(null);
  const [toast, setToast]     = useState('');
  const [tab, setTab]         = useState<'visitors' | 'bans'>('visitors');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const loadBans = useCallback(async () => {
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/user/room/bans`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
      });
      const d = await r.json();
      if (d.ok) setBans(d.data.bans);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadBans(); }, [loadBans]);

  const kick = useCallback(async (userId: number, name: string) => {
    setBusy(userId);
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/user/room/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ target_user_id: userId }),
      });
      const d = await r.json();
      showToast(d.ok ? `${name} wurde gekickt` : d.error || 'Fehler');
    } catch { showToast('Verbindungsfehler'); }
    finally { setBusy(null); }
  }, [showToast]);

  const ban = useCallback(async (userId: number, name: string) => {
    setBusy(userId);
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/user/room/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ target_user_id: userId }),
      });
      const d = await r.json();
      if (d.ok) { showToast(`${name} wurde gebannt`); loadBans(); }
      else showToast(d.error || 'Fehler');
    } catch { showToast('Verbindungsfehler'); }
    finally { setBusy(null); }
  }, [showToast, loadBans]);

  const unban = useCallback(async (userId: number, nickname: string) => {
    setBusy(userId);
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/user/room/ban/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
      });
      const d = await r.json();
      if (d.ok) { showToast(`${nickname} entsperrt`); loadBans(); }
      else showToast(d.error || 'Fehler');
    } catch { showToast('Verbindungsfehler'); }
    finally { setBusy(null); }
  }, [showToast, loadBans]);

  // Visitors excludes self (no userId = anonymous / view-only, skip)
  const actionableVisitors = visitors.filter(v => v.userId !== null);

  return (
    <div
      className="flex flex-col rounded-xl shadow-2xl overflow-hidden"
      style={{ width: 260, background: '#1a1820', border: '1px solid rgba(255,255,255,0.12)', color: '#e8dbc8' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-semibold text-rose-300 tracking-wide uppercase">Moderation</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {(['visitors', 'bans'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'bans') loadBans(); }}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'text-rose-300 border-b-2 border-rose-500' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'visitors' ? `Besucher (${actionableVisitors.length})` : `Bans (${bans.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0" style={{ maxHeight: 280 }}>
        {tab === 'visitors' && (
          <>
            {actionableVisitors.length === 0 && (
              <div className="flex items-center justify-center h-20 text-slate-600 text-xs">
                Keine Besucher
              </div>
            )}
            {actionableVisitors.map(v => (
              <div
                key={v.playerId}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="flex-1 text-xs text-slate-200 truncate">{v.name}</span>
                <button
                  title="Kicken"
                  disabled={busy === v.userId}
                  onClick={() => kick(v.userId!, v.name)}
                  className="p-1 rounded hover:bg-amber-700/40 text-amber-400 disabled:opacity-40 transition-colors"
                >
                  {busy === v.userId ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                </button>
                <button
                  title="Bannen"
                  disabled={busy === v.userId}
                  onClick={() => ban(v.userId!, v.name)}
                  className="p-1 rounded hover:bg-rose-800/40 text-rose-400 disabled:opacity-40 transition-colors"
                >
                  {busy === v.userId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </>
        )}

        {tab === 'bans' && (
          <>
            {bans.length === 0 && (
              <div className="flex items-center justify-center h-20 text-slate-600 text-xs">
                Keine Bans
              </div>
            )}
            {bans.map(b => (
              <div
                key={b.banned_user_id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">{b.nickname}</div>
                  {b.reason && <div className="text-[10px] text-slate-500 truncate">{b.reason}</div>}
                </div>
                <button
                  title="Entsperren"
                  disabled={busy === b.banned_user_id}
                  onClick={() => unban(b.banned_user_id, b.nickname)}
                  className="p-1 rounded hover:bg-emerald-800/40 text-emerald-400 disabled:opacity-40 transition-colors"
                >
                  {busy === b.banned_user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="mx-2 mb-2 px-3 py-1.5 rounded-lg text-xs text-center"
          style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
