/**
 * Partnership API Service
 * 
 * Verwaltet die Synchronisierung von Gemeinde-Partnerschaften mit dem Server.
 */

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

/** Auth-Headers für API-Calls (Token aus coreApi) */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface Partnership {
  id: number;
  partner: {
    id: number;
    name: string;
    slug: string;
    canton?: string;
    population?: number;
  };
  status: 'discovered' | 'connected';
  direction: 'north' | 'south' | 'east' | 'west';
  trade_income: number;
  connection_bonus_paid: boolean;
  discovered_at: string | null;
  connected_at: string | null;
}

export interface PartnershipsResponse {
  success: boolean;
  data: {
    partnerships: Partnership[];
    total_trade_income: number;
    discovered_count: number;
    connected_count: number;
  };
}

export interface DiscoverResponse {
  success: boolean;
  data: {
    partnership: Partnership;
    already_discovered: boolean;
    message: string;
  };
}

export interface ConnectResponse {
  success: boolean;
  data: {
    partnership: Partnership;
    already_connected: boolean;
    bonus_paid: number;
    monthly_income: number;
    message: string;
  };
}

export interface TradeIncomeResponse {
  success: boolean;
  data: {
    total_monthly_income: number;
    partnerships: Array<{
      partner_name: string;
      partner_slug: string;
      income: number;
    }>;
    partnership_count: number;
  };
}

export interface SearchMunicipality {
  id: number;
  name: string;
  slug: string;
  bfs_number: string;
  is_capital: boolean;
  population: number;
  coordinates: { lat: number; lng: number };
  level: number;
  canton?: string | null;
  owner: { id: number; nickname: string } | null;
}

export interface SearchMunicipalitiesResponse {
  success: boolean;
  data: {
    municipalities: SearchMunicipality[];
    count: number;
  };
}

// ==========================================
// PARTNERSHIP REQUEST TYPES
// ==========================================

export interface PartnershipRequest {
  id: number;
  from_municipality: {
    id: number;
    name: string;
    slug: string;
    canton?: string;
    population?: number;
    owner?: { id: number; nickname: string } | null;
  };
  to_municipality: {
    id: number;
    name: string;
    slug: string;
  };
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  created_at: string;
  responded_at?: string;
}

export interface PartnershipRequestsResponse {
  success: boolean;
  data: {
    incoming: PartnershipRequest[];
    outgoing: PartnershipRequest[];
  };
}

export interface SendRequestResponse {
  success: boolean;
  data: {
    request: PartnershipRequest;
    message: string;
  };
}

export interface RespondRequestResponse {
  success: boolean;
  data: {
    request: PartnershipRequest;
    partnership?: Partnership;
    message: string;
  };
}

/**
 * Lade alle Partnerschaften einer Gemeinde
 */
export async function getPartnerships(municipalitySlug: string): Promise<PartnershipsResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (response.status === 404) {
    // Gemeinde/Route noch nicht vorhanden: als leere Liste behandeln statt hart zu crashen.
    return {
      success: true,
      data: {
        partnerships: [],
        total_trade_income: 0,
        discovered_count: 0,
        connected_count: 0,
      },
    };
  }

  if (response.status === 401) {
    // In Public-/Gast-Kontexten kann die Session fuer Partnership-API fehlen.
    // Nicht als harter Fehler behandeln, sondern Trade-Daten leer lassen.
    return {
      success: true,
      data: {
        partnerships: [],
        total_trade_income: 0,
        discovered_count: 0,
        connected_count: 0,
      },
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch partnerships: ${response.status}`);
  }

  return response.json();
}

/**
 * Entdecke eine neue Partnerschaft (Stadt gefunden durch Straßenbau)
 */
export async function discoverPartnership(
  municipalitySlug: string,
  partnerSlug: string,
  direction: 'north' | 'south' | 'east' | 'west',
  partnerName?: string
): Promise<DiscoverResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/discover`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      partner_slug: partnerSlug,
      partner_name: partnerName,
      direction,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to discover partnership: ${response.status}`);
  }

  return response.json();
}

/**
 * Verbinde eine Partnerschaft (Handelsroute etablieren)
 */
export async function connectPartnership(
  municipalitySlug: string,
  partnerSlug: string
): Promise<ConnectResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/${partnerSlug}/connect`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to connect partnership: ${response.status}`);
  }

  return response.json();
}

/**
 * Hole das gesamte Handelseinkommen
 */
export async function getTradeIncome(municipalitySlug: string): Promise<TradeIncomeResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/trade-income`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch trade income: ${response.status}`);
  }

  return response.json();
}

/**
 * Suche schweizweit nach Gemeinden für Partnerschaftsanfragen.
 */
export async function searchMunicipalities(query = '', limit = 500): Promise<SearchMunicipalitiesResponse> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  params.set('limit', String(limit));
  const response = await fetch(`${API_BASE_URL}/municipalities/search?${params.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to search municipalities: ${response.status}`);
  }
  return response.json();
}

// ==========================================
// PARTNERSHIP REQUEST FUNCTIONS
// ==========================================

/**
 * Lade alle Partnerschaftsanfragen (eingehend und ausgehend)
 */
export async function getPartnershipRequests(municipalitySlug: string): Promise<PartnershipRequestsResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/requests`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch partnership requests: ${response.status}`);
  }

  return response.json();
}

export async function getMyPartnershipRequests(): Promise<PartnershipRequestsResponse> {
  const response = await fetch(`${API_BASE_URL}/partnerships/requests`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch partnership requests: ${response.status}`);
  }

  return response.json();
}

/**
 * Sende eine Partnerschaftsanfrage an eine andere Gemeinde
 */
export async function sendPartnershipRequest(
  municipalitySlug: string,
  targetSlug: string,
  message?: string
): Promise<SendRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/requests`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      target_slug: targetSlug,
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to send partnership request: ${response.status}`);
  }

  return response.json();
}

/**
 * Akzeptiere eine Partnerschaftsanfrage
 */
export async function acceptPartnershipRequest(
  municipalitySlug: string,
  requestId: number
): Promise<RespondRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/requests/${requestId}/accept`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to accept partnership request: ${response.status}`);
  }

  return response.json();
}

export async function respondMyPartnershipRequest(
  requestId: number,
  action: 'accept' | 'decline'
): Promise<RespondRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/partnerships/requests/${requestId}/${action}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to ${action} partnership request: ${response.status}`);
  }

  return response.json();
}

/**
 * Lehne eine Partnerschaftsanfrage ab
 */
export async function declinePartnershipRequest(
  municipalitySlug: string,
  requestId: number
): Promise<RespondRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/municipality/${municipalitySlug}/partnerships/requests/${requestId}/decline`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to decline partnership request: ${response.status}`);
  }

  return response.json();
}
