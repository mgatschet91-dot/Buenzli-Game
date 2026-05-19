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

export interface NavigatorHouseEntry {
  municipality_id: number;
  municipality_name: string;
  municipality_slug: string;
  canton_code?: string | null;
  canton_name?: string | null;
  room_code: string;
  room_name: string;
  room_description?: string | null;
  player_count: number;
  is_locked?: boolean;
  has_thumbnail?: boolean;
  owner: { id: number; nickname: string } | null;
  updated_at?: string | null;
}

export interface RecentRoomEntry {
  municipality_id: number;
  municipality_slug: string;
  municipality_name: string;
  room_code: string;
  room_name: string;
  visited_at: string | null;
  owner_user_id?: number | null;
}

export async function getNavigatorHouses(q = '', limit = 60): Promise<NavigatorHouseEntry[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('limit', String(limit));
  const res = await fetch(`${API_BASE_URL}/navigator/houses?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`navigator/houses: HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.houses as NavigatorHouseEntry[]) ?? [];
}

export interface ActiveRoomEntry {
  type: 'private' | 'public';
  municipality_name: string;
  municipality_slug: string;
  room_code: string;
  room_name: string;
  player_count: number;
  owner_id: number | null;
  owner_nickname: string | null;
}

export interface MyRoomEntry {
  type: 'private' | 'public';
  municipality_id: number;
  municipality_name: string;
  municipality_slug: string;
  room_code: string;
  room_name: string;
  room_description?: string | null;
  player_count: number;
  owner_id?: number | null;
  last_visited_at?: string | null;
  visit_count?: number;
  is_personal?: boolean;
  is_locked?: boolean;
}

export interface RoomsOverviewData {
  publicRooms: ActiveRoomEntry[];
  privateRooms: ActiveRoomEntry[];
}

export async function getRoomsOverview(): Promise<RoomsOverviewData> {
  const res = await fetch(`${API_BASE_URL}/navigator/rooms`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`navigator/rooms: HTTP ${res.status}`);
  const json = await res.json();
  return {
    publicRooms:  (json?.data?.publicRooms  as ActiveRoomEntry[]) ?? [],
    privateRooms: (json?.data?.privateRooms as ActiveRoomEntry[]) ?? [],
  };
}

export async function getActiveRooms(): Promise<ActiveRoomEntry[]> {
  const res = await fetch(`${API_BASE_URL}/navigator/active`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`navigator/active: HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.rooms as ActiveRoomEntry[]) ?? [];
}

export async function getMyRooms(): Promise<MyRoomEntry[]> {
  const res = await fetch(`${API_BASE_URL}/navigator/my-rooms`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`navigator/my-rooms: HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.rooms as MyRoomEntry[]) ?? [];
}

export async function getRecentRooms(limit = 10): Promise<RecentRoomEntry[]> {
  const res = await fetch(`${API_BASE_URL}/navigator/recent?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`navigator/recent: HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.visits as RecentRoomEntry[]) ?? [];
}

export interface FavoriteRoomEntry {
  municipality_slug: string;
  municipality_name: string;
  room_code: string;
  room_name: string;
  owner_user_id: number | null;
  owner_nickname: string | null;
  player_count: number;
  is_locked: boolean;
  added_at: string | null;
}

export async function getFavorites(): Promise<FavoriteRoomEntry[]> {
  const res = await fetch(`${API_BASE_URL}/navigator/favorites`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`navigator/favorites: HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.favorites as FavoriteRoomEntry[]) ?? [];
}

export async function getFavoriteKeys(): Promise<Set<string>> {
  const res = await fetch(`${API_BASE_URL}/navigator/favorites/check`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return new Set();
  const json = await res.json();
  return new Set<string>((json?.data?.favoriteKeys as string[]) ?? []);
}

export async function addFavorite(entry: {
  municipality_slug: string;
  municipality_name: string;
  room_code: string;
  room_name: string;
  owner_user_id?: number | null;
}): Promise<void> {
  await fetch(`${API_BASE_URL}/navigator/favorites`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(entry),
  });
}

export async function removeFavorite(slug: string, roomCode: string): Promise<void> {
  await fetch(`${API_BASE_URL}/navigator/favorites?slug=${encodeURIComponent(slug)}&room_code=${encodeURIComponent(roomCode)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
}
