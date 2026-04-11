/**
 * Bünzli Event API Client
 *
 * API-Calls für das Event-/Inspektions-System:
 * Events abrufen, reporten und beheben.
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

export interface BuenzliEvent {
  id: number;
  event_type_id: number;
  status: 'detected' | 'reported' | 'investigating' | 'assigned' | 'resolved' | 'expired' | 'failed' | 'false_alarm' | 'external_reported' | 'disputed';
  severity: number;
  confidence: number;
  min_level: number;
  fix_cost: number;
  location_x: number | null;
  location_y: number | null;
  room_code: string | null;
  affected_item_id: number | null;
  building_snapshot: Record<string, unknown> | null;
  building_exists: boolean;
  building_verified_at: string | null;
  reported_by: number | null;
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
  company_type_required: string | null;
}

export interface MunicipalityStats {
  municipality_id: number;
  security: number;
  attractiveness: number;
  cleanliness: number;
  infrastructure: number;
  transparency: number;
  citizen_satisfaction: number;
}

export interface ReportResult {
  event: BuenzliEvent;
  xp: { xp: number; level: number; xp_for_next: number };
  report_type: string;
  is_foreign_report: boolean;
  penalty: number;
  coins: { user: number; user_balance: number };
}

export interface ResolveResult {
  event: BuenzliEvent;
  xp: { xp: number; level: number; xp_for_next: number };
  cost: number;
  building: Record<string, unknown> | null;
  coins: { user: number; user_balance: number };
  auto_resolved?: boolean;
  message?: string;
}

// ── Inspection Types ──────────────────────────────────

export interface Inspection {
  id: number;
  tile_x: number;
  tile_y: number;
  radius: number;
  status: 'searching' | 'completed' | 'cancelled';
  started_at: string;
  completes_at: string;
  remaining_ms: number;
  municipality_id?: number | null;
  municipality_slug?: string | null;
  municipality_name?: string | null;
  is_foreign?: boolean;
}

export interface InspectionStartResult {
  inspection_id: number;
  tile_x: number;
  tile_y: number;
  radius: number;
  started_at: string;
  completes_at: string;
  duration_ms: number;
  municipality_id?: number | null;
  municipality_slug?: string | null;
  municipality_name?: string | null;
  is_foreign?: boolean;
}

export interface InspectionResults {
  inspection: { id: number; tile_x: number; tile_y: number; radius: number; status: string };
  events: BuenzliEvent[];
  user_level: number;
}

// ── API Calls ──────────────────────────────────────────

/**
 * Neue Inspektion server-seitig starten
 */
export async function startInspection(tileX: number, tileY: number, municipalitySlug?: string): Promise<InspectionStartResult> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/inspections/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      tile_x: tileX,
      tile_y: tileY,
      municipality_slug: municipalitySlug || null,
    }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Starten der Inspektion');
  return json.data;
}

/**
 * Aktive Inspektion des Users abrufen
 */
export async function getActiveInspection(): Promise<Inspection | null> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/inspections/active`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden');
  return json.data.inspection;
}

/**
 * Ergebnisse einer abgeschlossenen Inspektion abrufen (server-seitig gefiltert)
 */
export async function getInspectionResults(inspectionId: number): Promise<InspectionResults> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/inspections/${inspectionId}/results`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Inspektion noch nicht abgeschlossen');
  return json.data;
}

/**
 * Inspektion abbrechen
 */
export async function cancelInspection(inspectionId: number): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/inspections/${inspectionId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Abbrechen');
}

/**
 * Alle aktiven Events abrufen (eigene oder fremde Gemeinde)
 */
export async function fetchEvents(status = 'detected', visitingMunicipalityId?: number): Promise<{ events: BuenzliEvent[]; user_level: number; is_visiting?: boolean }> {
  const params = new URLSearchParams({ status });
  if (visitingMunicipalityId) params.set('visiting_municipality_id', String(visitingMunicipalityId));
  const res = await fetch(`${AUTH_API_BASE_URL}/api/events?${params}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Events');
  return json.data;
}

/**
 * Events filtern die in der Nähe eines bestimmten Tiles sind
 */
export function filterEventsNearTile(
  events: BuenzliEvent[],
  tileX: number,
  tileY: number,
  radius = 3
): BuenzliEvent[] {
  return events.filter(e => {
    if (e.location_x === null || e.location_y === null) return false;
    const dx = Math.abs(e.location_x - tileX);
    const dy = Math.abs(e.location_y - tileY);
    return dx <= radius && dy <= radius;
  });
}

/**
 * Ein Event reporten (bestätigen oder untersuchen)
 */
export async function reportEvent(
  eventId: number,
  reportType: 'confirm' | 'investigate' = 'confirm',
  comment?: string,
  inspectionId?: number
): Promise<ReportResult> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/events/${eventId}/report`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      report_type: reportType,
      comment: comment || null,
      inspection_id: inspectionId || null,
    }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Reporten');
  return json.data;
}

/**
 * Ein Event beheben/resolven
 */
export async function resolveEvent(eventId: number): Promise<ResolveResult> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/events/${eventId}/resolve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Beheben');
  return json.data;
}

/**
 * Gemeinde-Statistiken abrufen
 */
export async function fetchMunicipalityStats(): Promise<MunicipalityStats | null> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/events/stats`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Statistiken');
  return json.data.stats;
}
