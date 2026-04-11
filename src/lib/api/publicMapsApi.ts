import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
function normalizeGameApiBaseUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  if (trimmed.endsWith('/api')) return `${trimmed}/game`;
  if (trimmed.endsWith('/api/game')) return trimmed;
  return `${trimmed}/api/game`;
}
const API_BASE_URL = normalizeGameApiBaseUrl(process.env.NEXT_PUBLIC_CORE_API_URL || AUTH_API_BASE_URL);

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken()
    || (typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') || '' : '');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Game-Token'] = token;
  }
  return headers;
}

export interface PublicMapEntry {
  municipality_id: number;
  municipality_name: string;
  municipality_slug: string;
  canton_code?: string | null;
  canton_name?: string | null;
  room_code: string;
  room_name: string;
  player_count: number;
  owner: { id: number; nickname: string } | null;
  region_name?: string | null;
  size_label?: string | null;
  generator?: string | null;
  updated_at?: string | null;
}

export interface PublicMapsResponse {
  success: boolean;
  data: {
    maps: PublicMapEntry[];
    count: number;
    can_create_maps: boolean;
  };
}

export async function getPublicMaps(q = '', limit = 60): Promise<PublicMapsResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('limit', String(limit));
  const response = await fetch(`${API_BASE_URL}/public-maps?${params.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch public maps: ${response.status}`);
  }
  return response.json();
}

export interface CreatePublicMapPayload {
  region_name?: string;
  room_index?: number;
  size_key?: 'very_small' | 'small' | 'medium' | 'large' | 'very_large' | 'xl';
  generator?: 'small_walls' | 'open';
  room_code?: string;
  room_name?: string;
}

export interface CreatePublicMapResponse {
  success: boolean;
  data: {
    municipality_slug: string;
    room_code: string;
    room_name: string;
    region_name: string;
    size_key: string;
    size_label: string;
    room_size: number;
    total_tiles: number;
    generator: string;
    item_count: number;
    message: string;
  };
}

export async function createPublicMap(payload: CreatePublicMapPayload): Promise<CreatePublicMapResponse> {
  const response = await fetch(`${API_BASE_URL}/public-maps`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string; detail?: string };
    const detail = typeof error.detail === 'string' && error.detail.trim() ? ` (${error.detail})` : '';
    throw new Error(`${error.error || `Failed to create public map: ${response.status}`}${detail}`);
  }
  return response.json();
}

