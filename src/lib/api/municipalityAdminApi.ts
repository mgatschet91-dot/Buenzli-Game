/**
 * Municipality Admin API Client
 *
 * Mitglieder-Verwaltung fuer Gemeinden (Rollen, Einladen, Kicken).
 */

import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_CORE_API_URL || AUTH_API_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Game-Token'] = token;
  }
  return headers;
}

// ── Types ──────────────────────────────────────────────

export type MunicipalityRole = 'owner' | 'council' | 'citizen' | 'observer';

export interface MunicipalityMember {
  user_id: number;
  role: MunicipalityRole;
  joined_at: string;
  updated_at: string;
  nickname: string;
  email: string;
  user_level: number | null;
  user_xp: number | null;
}

export interface MunicipalityMembersResponse {
  municipality_id: number;
  municipality_name: string;
  member_limit: number;
  member_count: number;
  members: MunicipalityMember[];
}

// ── API Functions ──────────────────────────────────────

/** Alle Mitglieder einer Gemeinde laden */
export async function getMunicipalityMembers(slug: string): Promise<MunicipalityMembersResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/members`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Mitglieder');
  return json.data;
}

/** Mitglied-Rolle aendern */
export async function changeMemberRole(slug: string, userId: number, role: 'council' | 'citizen' | 'observer'): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/administration/members/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!json.success && !json.ok) throw new Error(json.error || 'Fehler beim Ändern der Rolle');
}

/** Mitglied kicken */
export async function kickMember(slug: string, userId: number): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/members/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Entfernen');
}

// ── Stats History ─────────────────────────────────────

export interface StatsHistoryEntry {
  date: string;
  population: number;
  jobs: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
}

/** Taegliche Statistik-History laden */
export async function getStatsHistory(slug: string, days = 90): Promise<StatsHistoryEntry[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/stats-history?days=${days}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Statistik-History');
  return json.data;
}

// ── Benachrichtigungen ────────────────────────────────

export interface ServerNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  icon: string;
  amount: number | null;
  municipality_id: number | null;
  is_read: number;
  created_at: string;
}

/** Alle Benachrichtigungen des Users laden */
export async function getNotifications(): Promise<ServerNotification[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/notifications`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Benachrichtigungen');
  return json.data;
}

/** Alle Benachrichtigungen als gelesen markieren */
export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Markieren');
}

/** Einzelne Benachrichtigung als gelesen markieren */
export async function markNotificationRead(notificationId: number): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Markieren');
}

/** Einzelne Benachrichtigung loeschen */
export async function deleteNotification(notificationId: number): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Loeschen');
}

/** Alle Benachrichtigungen loeschen */
export async function deleteAllNotifications(): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/notifications`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Loeschen');
}

// ── Zone Settings (Bauzone-Modus) ────────────────────

export type BauzoneMode = 'disabled' | 'members' | 'all';

/** Bauzone-Modus der Gemeinde lesen */
export async function getZoneSettings(slug: string): Promise<{ bauzone_mode: BauzoneMode }> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/zone-settings`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok && !json.success) throw new Error(json.error || 'Fehler beim Laden der Zone-Einstellungen');
  return json.data;
}

/** Bauzone-Modus der Gemeinde aendern (nur Owner/Council) */
export async function updateZoneSettings(slug: string, bauzoneMode: BauzoneMode): Promise<{ bauzone_mode: BauzoneMode }> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/zone-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ bauzone_mode: bauzoneMode }),
  });
  const json = await res.json();
  if (!json.ok && !json.success) throw new Error(json.error || 'Fehler beim Speichern der Zone-Einstellungen');
  return json.data;
}

/** Mitglied einladen */
export async function inviteMember(slug: string, userId: number): Promise<{ nickname: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/members/invite`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Einladen');
  return { nickname: json.data.nickname };
}

// ── Bank / Finanzen ──────────────────────────────────────

export interface BankStatus {
  treasury: number;
  debt: number;
  creditLimit: number;
  interestRate: number;
  lastInterestAt: string | null;
  dailyIncome: number;
  dailyExpenses: number;
  population: number;
  nextInterestEstimate: number;
}

export interface LedgerEntry {
  id: number;
  ts: string;
  type: string;
  amount: number;
  balanceAfter: number;
  debtAfter: number;
  meta: Record<string, unknown> | null;
  actorUserId: number | null;
  source: string;
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  total: number;
  hasMore: boolean;
}

export interface BankResult {
  treasury: number;
  debt: number;
  creditLimit: number;
  paid?: number;
  loanAmount?: number;
}

export async function getBankStatus(): Promise<BankStatus> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/bank/status`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden des Bank-Status');
  return json.data;
}

export async function getLedger(
  limit = 15,
  offset = 0,
  filter: 'all' | 'income' | 'expense' = 'all'
): Promise<LedgerResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), filter });
  const res = await fetch(`${getApiBaseUrl()}/api/game/bank/ledger?${params}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden des Ledgers');
  return json.data;
}

export async function takeLoan(amount: number): Promise<BankResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/bank/loan`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Kredit aufnehmen');
  return json.data;
}

export async function repayLoan(amount: number | 'all'): Promise<BankResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/bank/repay`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei der Kredit-Rueckzahlung');
  return json.data;
}

// ── Election API ────────────────────────────────────────

export interface ElectionCandidate {
  user_id: number;
  nickname: string;
  registered_at: string;
  withdrawn_at: string | null;
  votes: number;
}

export interface Election {
  id: number;
  municipality_id: number;
  status: 'candidates' | 'voting' | 'closed' | 'cancelled';
  triggered_by: 'inactivity' | 'council_vote' | 'admin';
  candidates_until: string;
  voting_until: string;
  winner_user_id: number | null;
  started_at: string;
  closed_at: string | null;
  candidate_count: number;
  vote_count: number;
}

export interface ElectionDetails {
  election: Election;
  candidates: ElectionCandidate[];
  my_vote: number | null;
  my_candidacy: { id: number; withdrawn_at: string | null } | null;
}

export async function getElection(slug: string): Promise<ElectionDetails | null> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/election`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Wahl');
  return json.data;
}

export async function openElection(slug: string): Promise<{ election_id: number }> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/election`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Ausrufen der Wahl');
  return json.data;
}

export async function registerCandidate(slug: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/election/candidates`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei der Kandidatur');
}

export async function withdrawCandidate(slug: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/election/candidates`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Zurückziehen');
}

export async function castVote(slug: string, candidateId: number): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/election/vote`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ candidate_id: candidateId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Abstimmen');
}

export async function openNoConfidence(slug: string): Promise<{ no_confidence_id: number }> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/no-confidence`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Misstrauensvotum');
  return json.data;
}

export async function voteNoConfidence(slug: string, noConfidenceId: number): Promise<{ outcome: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/game/municipality/${slug}/no-confidence/${noConfidenceId}/vote`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Abstimmen');
  return json.data;
}
