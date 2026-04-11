'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Archive, Loader2, RefreshCw } from 'lucide-react';
import { getAuthToken } from '@/lib/api/coreApi';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

interface InvItem {
  item_code: string;
  quantity: number;
  display_name: string;
  category: string;
  icon: string | null;
  price: number;
}

interface InventoryPanelProps {
  /** Called when user clicks "Platzieren" — sends PLACE_ITEM to the iframe */
  onPlace?: (itemCode: string, quantity: number) => void;
  /** Force a reload (e.g., after buying) */
  refreshTrigger?: number;
}

export function InventoryPanel({ onPlace, refreshTrigger }: InventoryPanelProps) {
  const [items, setItems]     = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  // Track which item is currently being placed (to show active state)
  const [placingCode, setPlacingCode] = useState<string | null>(null);
  const itemsRef = useRef<InvItem[]>([]);
  itemsRef.current = items;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/user/inventory/furniture`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
      });
      const d = await r.json();
      if (d.ok) setItems(d.data.items);
      else setError(d.error || 'Fehler');
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  // Listen for ITEM_PLACED from the iframe: decrement qty in state + persist to API
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'ITEM_PLACED') return;
      const code = e.data.item_code as string;

      // Decrement local quantity immediately
      setItems(prev => {
        const updated = prev.map(it =>
          it.item_code === code ? { ...it, quantity: Math.max(0, it.quantity - 1) } : it
        ).filter(it => it.quantity > 0);
        return updated;
      });

      // If nothing left to place, clear the active placement indicator
      const remaining = (itemsRef.current.find(it => it.item_code === code)?.quantity ?? 1) - 1;
      if (remaining <= 0) setPlacingCode(null);

      // Persist decrement to backend
      try {
        const token = getAuthToken() || '';
        await fetch(`${API_BASE}/api/game/user/inventory/place`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          body: JSON.stringify({ item_code: code }),
        });
      } catch {
        // ignore — local state is already updated; backend may be slightly out of sync
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handlePlace = useCallback((item: InvItem) => {
    setPlacingCode(prev => (prev === item.item_code ? null : item.item_code));
    onPlace?.(item.item_code, item.quantity);
  }, [onPlace]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#12100c', color: '#e8dbc8' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300 tracking-wide uppercase">Inventar</span>
        </div>
        <button
          onClick={load}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Aktualisieren"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Lade…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-full text-red-400 text-sm">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2">
            <Archive className="w-8 h-8 opacity-30" />
            <span>Noch keine Möbel</span>
            <span className="text-xs">Kaufe Möbel im Shop-Tab</span>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {items.map(item => (
              <div
                key={item.item_code}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 border border-white/10"
                style={{ background: placingCode === item.item_code ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)' }}
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-lg shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {item.icon || '📦'}
                </div>
                {/* Name + qty */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate" title={item.display_name}>
                    {item.display_name}
                  </div>
                  <div className="text-xs text-slate-500">×{item.quantity}</div>
                </div>
                {/* Place button */}
                <button
                  onClick={() => handlePlace(item)}
                  className={`text-xs px-2 py-0.5 rounded transition-colors shrink-0 ${
                    placingCode === item.item_code
                      ? 'bg-violet-600 text-white ring-1 ring-violet-400'
                      : 'bg-violet-800 hover:bg-violet-700 text-white'
                  }`}
                >
                  {placingCode === item.item_code ? 'Aktiv' : 'Platzieren'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
