/**
 * Global- und Kantonal-Chat API
 */

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const API_BASE = (process.env.NEXT_PUBLIC_CORE_API_URL || AUTH_API_BASE_URL).replace(/\/+$/, '');

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('isocity_auth_token') : null;
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { 'X-Game-Token': token } : {}),
  };
}

export interface GlobalChatUser {
  id: number;
  name: string;
  avatar_config?: Record<string, unknown> | null;
  global_role?: string;
  municipality_role?: 'owner' | 'council' | 'citizen' | 'observer' | null;
  municipality_name?: string | null;
}

export interface GlobalChatMessage {
  id: number;
  scope: 'global' | 'cantonal';
  canton_code: string | null;
  user: GlobalChatUser;
  message: string;
  type: 'text' | 'system' | 'announcement';
  reply_to?: { id: number; message: string } | null;
  is_edited: boolean;
  edited_at?: string | null;
  created_at: string;
}

export interface GlobalChatResponse {
  success: boolean;
  data: {
    messages: GlobalChatMessage[];
    has_more: boolean;
    canton?: { code: string; name: string };
  };
}

export async function getGlobalMessages(
  opts?: { limit?: number; before?: number; after?: number }
): Promise<GlobalChatResponse> {
  const p = new URLSearchParams();
  if (opts?.limit)  p.set('limit',  String(opts.limit));
  if (opts?.before) p.set('before', String(opts.before));
  if (opts?.after)  p.set('after',  String(opts.after));
  const res = await fetch(`${API_BASE}/api/chat/global${p.toString() ? `?${p}` : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function sendGlobalMessage(
  message: string,
  replyToId?: number
): Promise<{ success: boolean; data: { message: GlobalChatMessage } }> {
  const res = await fetch(`${API_BASE}/api/chat/global`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ message, reply_to_id: replyToId }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function deleteGlobalMessage(
  messageId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat/global/${messageId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function getCantonalMessages(
  cantonCode: string,
  opts?: { limit?: number; before?: number; after?: number }
): Promise<GlobalChatResponse> {
  const p = new URLSearchParams();
  if (opts?.limit)  p.set('limit',  String(opts.limit));
  if (opts?.before) p.set('before', String(opts.before));
  if (opts?.after)  p.set('after',  String(opts.after));
  const res = await fetch(
    `${API_BASE}/api/chat/cantonal/${cantonCode.toUpperCase()}${p.toString() ? `?${p}` : ''}`,
    { headers: getAuthHeaders(), credentials: 'include' }
  );
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function sendCantonalMessage(
  cantonCode: string,
  message: string,
  replyToId?: number
): Promise<{ success: boolean; data: { message: GlobalChatMessage } }> {
  const res = await fetch(`${API_BASE}/api/chat/cantonal/${cantonCode.toUpperCase()}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ message, reply_to_id: replyToId }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function deleteCantonalMessage(
  cantonCode: string,
  messageId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat/cantonal/${cantonCode.toUpperCase()}/${messageId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function muteUser(opts: {
  user_id: number;
  scope: 'global' | 'cantonal';
  canton_code?: string;
  duration_hours?: number | null;
  reason?: string;
}): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat/mute`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(opts),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

export async function unmuteUser(userId: number, scope: 'global' | 'cantonal'): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/chat/mute/${userId}?scope=${scope}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}
