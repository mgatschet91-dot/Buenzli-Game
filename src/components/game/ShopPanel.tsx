'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShoppingBag, Loader2, ChevronDown, X } from 'lucide-react';
import { getAuthToken } from '@/lib/api/coreApi';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

const CAT_LABELS: Record<string, string> = {
  moebel:       '🛋️ Möbel',
  party:        '🎉 Party',
  bilder:       '🖼️ Bilder',
  hocker:       '🪑 Hocker',
  bar:          '🍺 Bar',
  kueche:       '🍳 Küche',
  buero:        '💼 Büro',
  schlafzimmer: '🛏️ Schlafzimmer',
  deko:         '🕯️ Deko',
  sport:        '🏋️ Sport',
  gaming:       '🎮 Gaming',
  spezial:      '✨ Spezial',
};

interface FurniItem {
  item_code: string;
  display_name: string;
  category: string;
  icon: string | null;
  price: number;
}

interface ShopPanelProps {
  onBuy?: (itemCode: string, displayName: string) => void;
}

const NPC_STYLES = [
  { id: 1, icon: '👷', label: 'Arbeiter', desc: 'Fleissiger Helfer mit Helm' },
  { id: 2, icon: '🤵', label: 'Butler',   desc: 'Eleganter Diener im Anzug' },
  { id: 3, icon: '🐕', label: 'Haustier', desc: 'Treuer Begleiter' },
];

export function ShopPanel({ onBuy }: ShopPanelProps) {
  const [items, setItems]         = useState<FurniItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [buying, setBuying]       = useState<string | null>(null);
  const [toast, setToast]         = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');

  // NPC-Kauf Modal
  const [npcModal, setNpcModal]     = useState(false);
  const [npcName, setNpcName]       = useState('');
  const [npcStyle, setNpcStyle]     = useState(1);
  const [npcBuying, setNpcBuying]   = useState(false);

  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/game/shop/furniture`);
        const d = await r.json();
        if (d.ok) {
          setItems(d.data.items);
          if (d.data.items.length > 0) setActiveCategory(d.data.items[0].category);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const handleBuy = useCallback(async (item: FurniItem) => {
    // NPC: Modal oeffnen statt direkt kaufen
    if (item.item_code === 'room_npc') {
      setNpcName('');
      setNpcStyle(1);
      setNpcModal(true);
      return;
    }

    setBuying(item.item_code);
    try {
      const token = getAuthToken() || '';
      const r = await fetch(`${API_BASE}/api/game/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ item_code: item.item_code, quantity: 1 }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast(`✓ ${item.display_name} gekauft`);
        onBuy?.(item.item_code, item.display_name);
      } else {
        showToast(d.error || 'Fehler beim Kauf');
      }
    } catch {
      showToast('Verbindungsfehler');
    } finally {
      setBuying(null);
    }
  }, [onBuy, showToast]);

  const handleNpcBuy = useCallback(async () => {
    if (!npcName.trim()) { showToast('Bitte Name eingeben'); return; }
    setNpcBuying(true);
    try {
      const token = getAuthToken() || '';
      // 1. Item kaufen (Inventar +1)
      const r = await fetch(`${API_BASE}/api/game/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ item_code: 'room_npc', quantity: 1 }),
      });
      const d = await r.json();
      if (d.ok) {
        // 2. NPC-Metadaten im localStorage speichern (werden beim Platzieren gelesen)
        const pending = JSON.parse(localStorage.getItem('pending_npc_meta') || '[]');
        pending.push({ npc_name: npcName.trim(), npc_style: npcStyle });
        localStorage.setItem('pending_npc_meta', JSON.stringify(pending));

        showToast(`✓ ${NPC_STYLES[npcStyle - 1].label} "${npcName.trim()}" gekauft`);
        onBuy?.('room_npc', npcName.trim());
        setNpcModal(false);
      } else {
        showToast(d.error || 'Fehler beim Kauf');
      }
    } catch {
      showToast('Verbindungsfehler');
    } finally {
      setNpcBuying(false);
    }
  }, [npcName, npcStyle, onBuy, showToast]);

  // Group by page_caption
  const categories = [...new Set(items.map(i => i.category))];
  const visible    = items.filter(i => i.category === activeCategory);

  return (
    <div className="flex flex-col h-full" style={{ background: '#12100c', color: '#e8dbc8' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 shrink-0">
        <ShoppingBag className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300 tracking-wide uppercase">Möbel-Shop</span>
      </div>

      {/* Category tabs */}
      {!loading && categories.length > 0 && (
        <div className="flex gap-1 px-3 pt-2 shrink-0 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                activeCategory === cat
                  ? 'bg-amber-700 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              {CAT_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      )}

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Lade…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Keine Items in dieser Kategorie
          </div>
        )}
        {!loading && visible.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {visible.map(item => (
              <div
                key={item.item_code}
                className="flex flex-col gap-1.5 rounded-lg border border-white/10 p-2.5"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                {/* Icon placeholder */}
                <div
                  className="w-full aspect-square rounded flex items-center justify-center text-2xl"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {item.icon || '📦'}
                </div>
                <span className="text-xs text-slate-200 leading-tight truncate" title={item.display_name}>
                  {item.display_name}
                </span>
                {item.item_code === 'teleporter' && (
                  <span className="text-[9px] text-violet-400 leading-tight">1 kaufen = 2 Stück</span>
                )}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-amber-400 font-semibold">
                    {item.price > 0 ? `${item.price.toLocaleString()} 🪙` : 'Gratis'}
                  </span>
                  <button
                    disabled={buying === item.item_code}
                    onClick={() => handleBuy(item)}
                    className="text-xs px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
                  >
                    {buying === item.item_code ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kaufen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="mx-3 mb-3 px-3 py-2 rounded-lg text-xs text-center"
          style={{ background: 'rgba(180,120,30,0.25)', border: '1px solid rgba(180,120,30,0.4)', color: '#f5d080' }}
        >
          {toast}
        </div>
      )}

      {/* ── NPC-Kauf Modal ── */}
      {npcModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-4 w-[230px]" style={{ background: '#1a1820', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-amber-300">NPC erstellen</span>
              <button onClick={() => setNpcModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name */}
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={npcName}
              onChange={e => setNpcName(e.target.value)}
              maxLength={32}
              placeholder="z.B. Hans"
              className="w-full px-2.5 py-1.5 rounded-lg text-xs mb-3"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#eee' }}
              autoFocus
            />

            {/* Style */}
            <label className="block text-xs text-slate-400 mb-1.5">Style</label>
            <div className="flex flex-col gap-1.5 mb-3">
              {NPC_STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setNpcStyle(s.id)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    npcStyle === s.id
                      ? 'ring-1 ring-amber-400'
                      : 'hover:bg-white/5'
                  }`}
                  style={{
                    background: npcStyle === s.id ? 'rgba(180,120,30,0.2)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span className="text-lg">{s.icon}</span>
                  <div>
                    <div className="text-xs text-slate-200 font-medium">{s.label}</div>
                    <div className="text-[10px] text-slate-500">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Kaufen */}
            <button
              onClick={handleNpcBuy}
              disabled={npcBuying || !npcName.trim()}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
            >
              {npcBuying ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Kaufen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
