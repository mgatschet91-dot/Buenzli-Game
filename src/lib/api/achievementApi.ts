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
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export interface AchievementEntry {
  id: number;
  code: string;
  title: string;
  description: string;
  goal_type: string;
  goal_value: number;
  progress_value: number;
  progress_percent: number;
  reward_xp: number;
  reward_money: number;
  achieved: boolean;
  achieved_at: string | null;
  claimed: boolean;
  claimed_at: string | null;
}

export interface AchievementsResponse {
  success: boolean;
  data: {
    room_code: string;
    achievements: AchievementEntry[];
    totals: {
      total: number;
      achieved: number;
      claimed: number;
    };
  };
}

export interface ClaimAchievementResponse {
  success: boolean;
  data: {
    room_code: string;
    achievement: AchievementEntry;
    already_claimed: boolean;
    reward_money_applied: number;
    reward_xp_applied: number;
    xp: { total_xp: number; level: number; old_level: number; xp_change: number } | null;
    updated_stats: unknown | null;
  };
}

export async function getAchievements(municipalitySlug: string, roomCode = 'MAIN'): Promise<AchievementsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/municipality/${municipalitySlug}/achievements?room_code=${encodeURIComponent(roomCode)}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to fetch achievements: ${response.status}`);
  }
  return response.json();
}

export async function getMyAchievements(roomCode = 'MAIN'): Promise<AchievementsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/me/achievements?room_code=${encodeURIComponent(roomCode)}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to fetch achievements: ${response.status}`);
  }
  return response.json();
}

export async function claimAchievement(
  municipalitySlug: string,
  achievementCode: string,
  roomCode = 'MAIN'
): Promise<ClaimAchievementResponse> {
  const response = await fetch(
    `${API_BASE_URL}/municipality/${municipalitySlug}/achievements/${encodeURIComponent(achievementCode)}/claim`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ room_code: roomCode }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to claim achievement: ${response.status}`);
  }
  return response.json();
}

export async function claimMyAchievement(
  achievementCode: string,
  roomCode = 'MAIN'
): Promise<ClaimAchievementResponse> {
  const response = await fetch(
    `${API_BASE_URL}/me/achievements/${encodeURIComponent(achievementCode)}/claim`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ room_code: roomCode }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `Failed to claim achievement: ${response.status}`);
  }
  return response.json();
}
