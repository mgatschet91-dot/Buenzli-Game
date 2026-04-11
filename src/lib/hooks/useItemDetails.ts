'use client';
import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

export interface ServerItemDetail {
  tool: string;
  display_name: string;
  category: string;
  footprint_width: number;
  footprint_height: number;
  build_cost: number;
  power_production: number;
  power_consumption_base: number;
  requires_power: number;
  requires_water: number;
  max_pop: number;
  max_jobs: number;
  pollution: number;
  land_value: number;
  daily_income: number;
}

// Singleton-Cache: einmal geladen, bleibt im Memory
let _cache: Map<string, ServerItemDetail> | null = null;
let _fetching: Promise<Map<string, ServerItemDetail>> | null = null;

export async function fetchAllItemDetails(): Promise<Map<string, ServerItemDetail>> {
  if (_cache) return _cache;
  if (_fetching) return _fetching;
  _fetching = fetch(`${API_BASE}/api/game/item-details`)
    .then(r => r.json())
    .then(d => {
      const map = new Map<string, ServerItemDetail>();
      if (Array.isArray(d.items)) {
        for (const item of d.items) {
          map.set(String(item.tool || '').toLowerCase(), item);
        }
      }
      _cache = map;
      _fetching = null;
      return map;
    })
    .catch(() => {
      _fetching = null;
      return new Map<string, ServerItemDetail>();
    });
  return _fetching;
}

/** Hook: gibt Map<tool, ServerItemDetail> zurück, lädt einmalig vom Server */
export function useItemDetails(): Map<string, ServerItemDetail> {
  const [details, setDetails] = useState<Map<string, ServerItemDetail>>(_cache ?? new Map());
  useEffect(() => {
    if (_cache) { setDetails(_cache); return; }
    fetchAllItemDetails().then(setDetails);
  }, []);
  return details;
}
