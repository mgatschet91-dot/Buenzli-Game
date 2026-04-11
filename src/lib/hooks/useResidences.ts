'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

export interface ResidenceInfo {
  tile_x: number;
  tile_y: number;
  room_code: string;
  user_id: number;
  nickname: string;
  occupied_since: string;
  mansion_variant_row: number | null;
  mansion_variant_col: number | null;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) { headers['Authorization'] = `Bearer ${token}`; headers['X-Game-Token'] = token; }
  return headers;
}

export function useResidences(municipalitySlug: string | null) {
  const [residences, setResidences] = useState<ResidenceInfo[]>([]);

  const reload = useCallback(async () => {
    if (!municipalitySlug) { setResidences([]); return; }
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/game/municipality/${municipalitySlug}/residences`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      setResidences(json.data?.residences || []);
    } catch {
      setResidences([]);
    }
  }, [municipalitySlug]);

  useEffect(() => { reload(); }, [reload]);

  const claim = useCallback(async (tileX: number, tileY: number, roomCode: string) => {
    if (!municipalitySlug) return null;
    const res = await fetch(`${AUTH_API_BASE_URL}/api/game/municipality/${municipalitySlug}/residence/claim`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tile_x: tileX, tile_y: tileY, room_code: roomCode }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'Fehler');
    await reload();
    return json.data;
  }, [municipalitySlug, reload]);

  const release = useCallback(async () => {
    if (!municipalitySlug) return;
    const res = await fetch(`${AUTH_API_BASE_URL}/api/game/municipality/${municipalitySlug}/residence/release`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'Fehler');
    await reload();
  }, [municipalitySlug, reload]);

  const upgradeVilla = useCallback(async (variantRow: number, variantCol: number) => {
    if (!municipalitySlug) return null;
    const res = await fetch(`${AUTH_API_BASE_URL}/api/game/municipality/${municipalitySlug}/residence/villa-upgrade`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ variant_row: variantRow, variant_col: variantCol }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'Fehler');
    await reload();
    return json.data;
  }, [municipalitySlug, reload]);

  return { residences, claim, release, reload, upgradeVilla };
}
