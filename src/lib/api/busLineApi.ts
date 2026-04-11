/**
 * Bus Line API Client
 *
 * CRUD fuer Buslinien einer Transport-Firma (ÖV-System).
 */

import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

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

export interface BusLineStop {
  x: number;
  y: number;
  sequence_order: number;
}

export interface ServerBusLine {
  id: number;
  company_id: number;
  municipality_id?: number;
  name: string;
  color: string;
  status: string;
  stops: BusLineStop[];
  created_at?: string;
}

// ── API Calls ──────────────────────────────────────────

/** Alle Buslinien einer Transport-Firma laden */
export async function getCompanyBusLines(companyId: number): Promise<{ bus_lines: ServerBusLine[]; max_lines: number; level: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/bus-lines`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Buslinien konnten nicht geladen werden');
  return data.data;
}

/** Neue Buslinie erstellen */
export async function createBusLine(
  companyId: number,
  payload: { name: string; color: string; stops: { x: number; y: number }[] }
): Promise<ServerBusLine> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/bus-lines`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Linie konnte nicht erstellt werden');
  return data.data.bus_line;
}

/** Buslinie bearbeiten (Name, Farbe, Status, Stops) */
export async function updateBusLine(
  companyId: number,
  lineId: number,
  payload: Partial<{ name: string; color: string; status: string; stops: { x: number; y: number }[] }>
): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/bus-lines/${lineId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Linie konnte nicht bearbeitet werden');
}

/** Buslinie loeschen */
export async function deleteBusLine(companyId: number, lineId: number): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/bus-lines/${lineId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Linie konnte nicht geloescht werden');
}

/** Alle aktiven Buslinien einer Gemeinde (oeffentlich, kein Auth noetig). Akzeptiert Slug oder ID. */
export async function getMunicipalityBusLines(slugOrId: string | number): Promise<ServerBusLine[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/bus-lines/municipality/${slugOrId}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Buslinien konnten nicht geladen werden');
  return data.data.bus_lines;
}
