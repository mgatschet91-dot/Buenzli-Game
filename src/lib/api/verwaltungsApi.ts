/**
 * Verwaltung (Meldungen/Missstände) API Client
 *
 * API-Calls fuer das Verwaltungs-Panel:
 * Meldungen ansehen, Firma beauftragen, selbst beheben, Stats-History.
 */

import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_CORE_API_URL || 'http://127.0.0.1:4100';

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

export type EventStatus = 'detected' | 'reported' | 'investigating' | 'assigned' | 'resolved' | 'expired' | 'failed' | 'false_alarm' | 'external_reported' | 'disputed';

export interface VerwaltungEvent {
  id: number;
  event_type_id: number;
  status: EventStatus;
  severity: number;
  confidence: number;
  fix_cost: number;
  location_x: number | null;
  location_y: number | null;
  room_code: string | null;
  affected_item_id: number | null;
  building_snapshot: Record<string, unknown> | null;
  building_exists: boolean;
  reported_by: number | null;
  assigned_company_id: number | null;
  resolved_by: number | null;
  spawned_at: string;
  expires_at: string;
  reported_at: string | null;
  resolved_at: string | null;
  code: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  stat_impact: string | null;
  stat_damage: number;
  stat_fix_bonus: number;
  company_type_required: string | null;
  external_reporter_id: number | null;
  external_deadline: string | null;
  escalation_level: number;
  dispute_until: string | null;
  evidence_score: number | null;
  reporter_nickname: string | null;
  external_reporter_nickname: string | null;
  assigned_company_name: string | null;
  company_emoji: string | null;
}

export interface VerwaltungCompany {
  id: number;
  name: string;
  level: number;
  reputation: number;
  type_code: string;
  type_name: string;
  type_emoji: string;
  can_fix_categories: string[];
}

export interface MunicipalityStats {
  municipality_id: number;
  security: number;
  attractiveness: number;
  cleanliness: number;
  infrastructure: number;
  transparency: number;
  citizen_satisfaction: number;
  treasury: number;
  daily_income: number;
  population: number;
  max_population: number;
  shield_active_until: string | null;
  cantonal_investigation_until: string | null;
}

export interface StatsHistoryEntry {
  stat_name: string;
  old_value: number;
  new_value: number;
  change_amount: number;
  reason: string;
  ref_type: string | null;
  ref_id: number | null;
  created_at: string;
}

export interface VerwaltungData {
  events: VerwaltungEvent[];
  stats: MunicipalityStats | null;
  companies: VerwaltungCompany[];
}

export interface BeauftragenResult {
  contract_id: number;
  payment: number;
  xp_reward: number;
  event_name: string;
}

export interface MyReport {
  report_id: number;
  report_type: string;
  comment: string | null;
  is_correct: number | null;
  xp_awarded: number;
  reported_at: string;
  event_id: number;
  event_status: EventStatus;
  severity: number;
  fix_cost: number;
  location_x: number | null;
  location_y: number | null;
  resolved_at: string | null;
  event_name: string;
  emoji: string;
  category: string;
  event_code: string;
  municipality_name: string;
}

export interface ReportSummary {
  total_reports: number;
  correct_reports: number;
  wrong_reports: number;
  pending_reports: number;
  total_xp_earned: number;
}

// ── API Calls ──────────────────────────────────────────

/** Verwaltungs-Meldungen laden (mit Stats und verfuegbaren Firmen) */
export async function fetchVerwaltungMeldungen(status = 'reported,assigned'): Promise<VerwaltungData> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/meldungen?status=${encodeURIComponent(status)}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Meldungen');
  return json.data;
}

/** Firma mit Event beauftragen */
export async function beauftragen(eventId: number, companyId: number): Promise<BeauftragenResult> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/beauftragen`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId, company_id: companyId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Beauftragen');
  return json.data;
}

/** Event direkt selbst beheben (Gemeinde zahlt) */
export async function selbstBeheben(eventId: number): Promise<{ event: VerwaltungEvent; cost: number; xp: unknown }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/selbst-beheben`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Beheben');
  return json.data;
}

/** Notfallreparatur: Abgelaufenes Event nachtraeglich beheben (2x Kosten) */
export async function notfallreparatur(eventId: number): Promise<{
  event_id: number; cost: number; original_cost: number;
  stat_recovered: number; xp_earned: number; message: string;
}> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/notfallreparatur`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei Notfallreparatur');
  return json.data;
}

/** Schutzschild kaufen (1, 3 oder 7 Tage) */
export async function kaufeSchutzschild(days: 1 | 3 | 7): Promise<{
  shield_active_until: string; cost: number; days: number;
  extended: boolean; message: string;
}> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/schutzschild`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ days }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Kauf');
  return json.data;
}

/** Auf externen Report reagieren (accept/dispute) */
export async function externalResponse(eventId: number, action: 'accept' | 'dispute'): Promise<{
  action: string; event_id: number; new_status: string; evidence_score?: number;
  dispute_hours?: number; message?: string;
}> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/external-response`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId, action }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei Reaktion');
  return json.data;
}

/** Stats-History laden */
export async function fetchStatsHistory(days = 14): Promise<StatsHistoryEntry[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/stats-history?days=${days}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Historie');
  return json.data.history;
}

/** Meine Reports laden */
export async function fetchMyReports(): Promise<{ reports: MyReport[]; summary: ReportSummary }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/reports/my`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Reports');
  return json.data;
}

/** Büenzli-Verstoss an Server melden (Treasury-Buchung) */
export async function reportBuenzliViolation(params: {
  event_id?: number;
  violation_type: 'small' | 'big';
  amount: number;
  description: string;
}): Promise<{ booked: boolean; amount: number; treasury: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/game/buenzli-violation`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei Büenzli-Buchung');
  return json.data;
}

/** Polizei zu einem Event schicken */
export async function polizeiSchicken(eventId: number): Promise<{ success: boolean; event?: any; cost?: number; policeStation?: { x: number; y: number } }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/verwaltung/polizei-schicken`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Polizei schicken');
  return json.data;
}

/** Aktive Gemeinden laden (fuer Buenzli-Hetzen Auswahl) */
export async function fetchActiveMunicipalities(): Promise<Array<{
  municipality_id: number;
  name: string;
  population: number;
}>> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/game/active-municipalities`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Gemeinden');
  return json.data.municipalities;
}

/** Büenzli Quiz Cooldown vom Server abrufen */
export async function fetchBuenzliQuizStatus(): Promise<{ cooldown_remaining_ms: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/game/buenzli-quiz-status`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler');
  return json.data;
}

/** Büenzli Quiz Fail auf Server melden (12h Cooldown setzen) */
export async function reportBuenzliQuizFail(): Promise<void> {
  await fetch(`${AUTH_API_BASE_URL}/api/game/buenzli-quiz-fail`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

/** Buenzli auf andere Gemeinde hetzen */
export async function hetzenBuenzli(
  targetMunicipalityId: number,
  quizScore: number,
  sourceEventId?: number
): Promise<{ success: boolean; xp: number; coins: number; target_name: string }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/game/buenzli-hetzen`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      target_municipality_id: targetMunicipalityId,
      quiz_score: quizScore,
      source_event_id: sourceEventId,
    }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Hetzen');
  return json.data;
}
