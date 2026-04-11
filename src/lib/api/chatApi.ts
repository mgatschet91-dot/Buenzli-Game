/**
 * Chat API Service
 * 
 * Verwaltet die Gemeinde-Chat-Funktionalität.
 */

function normalizeGameApiUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://127.0.0.1:4100/api/game';
  return trimmed.endsWith('/api/game') ? trimmed : `${trimmed}/api/game`;
}
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const API_BASE_URL = normalizeGameApiUrl(process.env.NEXT_PUBLIC_CORE_API_URL || AUTH_API_BASE_URL);

/**
 * Hole Auth-Token aus localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('isocity_auth_token');
}

/**
 * Erstelle Auth-Headers
 */
function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { 'X-Game-Token': token } : {}),
  };
}

export interface ChatUser {
  id: number;
  name: string;
  avatar_config?: Record<string, unknown> | null;
  role?: 'owner' | 'admin' | 'member' | null;
  is_municipality_owner?: boolean;
}

export interface ChatMessage {
  id: number;
  user: ChatUser;
  message: string;
  type: 'text' | 'system' | 'announcement';
  reply_to?: {
    id: number;
    message: string;
  } | null;
  is_edited: boolean;
  created_at: string;
  edited_at?: string | null;
}

export interface ChatMessagesResponse {
  success: boolean;
  data: {
    messages: ChatMessage[];
    has_more: boolean;
    municipality: {
      id: number;
      name: string;
      slug: string;
    };
  };
}

export interface SendMessageResponse {
  success: boolean;
  data: {
    message: ChatMessage;
  };
}

export interface ChatLogEntry {
  id: number;
  message_id: number;
  user: {
    id: number;
    name: string;
  };
  action: 'created' | 'edited' | 'deleted' | 'restored' | 'reported';
  old_content: string | null;
  new_content: string | null;
  ip_address: string | null;
  created_at: string;
}

/**
 * Chat-Nachrichten einer Gemeinde abrufen
 */
export async function getChatMessages(
  municipalitySlug: string,
  options?: { limit?: number; before?: number; after?: number }
): Promise<ChatMessagesResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.before) params.set('before', options.before.toString());
  if (options?.after) params.set('after', options.after.toString());

  const queryString = params.toString();
  const url = `${API_BASE_URL}/municipality/${municipalitySlug}/chat${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chat messages: ${response.status}`);
  }

  return response.json();
}

/**
 * Neue Chat-Nachricht senden
 */
export async function sendChatMessage(
  municipalitySlug: string,
  message: string,
  replyToId?: number
): Promise<SendMessageResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      message,
      reply_to_id: replyToId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({} as { error?: string; detail?: string }));
    const detail = error.detail ? ` (${error.detail})` : '';
    throw new Error((error.error || `Failed to send message: ${response.status}`) + detail);
  }

  return response.json();
}

/**
 * Chat-Nachricht bearbeiten
 */
export async function editChatMessage(
  municipalitySlug: string,
  messageId: number,
  newMessage: string
): Promise<{ success: boolean; data: { message: Partial<ChatMessage> } }> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/chat/${messageId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ message: newMessage }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to edit message: ${response.status}`);
  }

  return response.json();
}

/**
 * Chat-Nachricht löschen
 */
export async function deleteChatMessage(
  municipalitySlug: string,
  messageId: number
): Promise<{ success: boolean; data: { message: string; deleted_id: number } }> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/chat/${messageId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete message: ${response.status}`);
  }

  return response.json();
}

/**
 * Chat-Logs abrufen (nur für Owner)
 */
export async function getChatLogs(
  municipalitySlug: string,
  limit?: number
): Promise<{ success: boolean; data: { logs: ChatLogEntry[] } }> {
  const url = `${API_BASE_URL}/municipality/${municipalitySlug}/chat/logs${limit ? `?limit=${limit}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch logs: ${response.status}`);
  }

  return response.json();
}
