/**
 * Company / Firma API Client
 *
 * Alle API-Calls für das Firmen-System (gründen, verwalten, Mitglieder, Finanzen, Aufträge).
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

export interface CompanyType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  emoji: string | null;
  can_fix_categories: string[];
  founding_cost: number;
  min_level: number;
  max_members: number;
}

export interface Company {
  id: number;
  company_type_id: number;
  name: string;
  slug: string;
  owner_id: number;
  municipality_id: number;
  balance: number;
  reputation: number;
  level: number;
  total_contracts: number;
  total_revenue: number;
  is_active: number;
  founded_at: string;
  type_code: string;
  type_name: string;
  type_emoji: string;
  my_role?: string;
  member_count?: number;
}

export interface CompanyMember {
  id: number;
  company_id: number;
  user_id: number;
  role: 'owner' | 'manager' | 'employee';
  salary: number;
  xp_earned: number;
  contracts_done: number;
  joined_at: string;
  nickname: string;
  email: string;
  user_level: number | null;
}

export interface CompanyFinance {
  id: number;
  company_id: number;
  amount: number;
  balance_after: number;
  reason: string;
  description: string | null;
  ref_type: string | null;
  ref_id: number | null;
  created_at: string;
}

export interface CompanyContract {
  id: number;
  company_id: number;
  event_id: number;
  municipality_id: number;
  assigned_user_id: number | null;
  assigned_nickname?: string | null;
  status: string;
  payment: number;
  bonus: number;
  penalty: number;
  deadline_at: string;
  difficulty: number;
  xp_reward: number;
  event_name: string;
  event_emoji: string;
  event_status: string;
  work_duration_seconds?: number;
  completable_at?: string | null;
  municipality_name?: string;
  npc_name?: string | null;
  npc_bot_type?: string | null;
}

export interface CompanyApplication {
  id: number;
  company_id: number;
  user_id: number;
  message: string | null;
  status: string;
  nickname: string;
  created_at: string;
}

export interface CompanyDetails {
  company: Company & { can_fix_categories: string[]; max_members: number };
  members: CompanyMember[];
  finances: CompanyFinance[];
  contracts: CompanyContract[];
  applications: CompanyApplication[];
  my_role: string | null;
}

// ── API Functions ──────────────────────────────────────

/** Alle Firmen-Typen laden */
export async function getCompanyTypes(): Promise<CompanyType[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/types`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Firmen-Typen');
  return json.data.company_types;
}

/** Meine Firmen laden */
export async function getMyCompanies(): Promise<Company[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/my`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Firmen');
  return json.data.companies;
}

/** Firma gründen — gibt bei insufficient_funds zusätzliche Daten zurück */
export async function createCompany(name: string, companyTypeId: number): Promise<{ company: Company }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, company_type_id: companyTypeId }),
  });
  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.error || 'Fehler beim Gruenden der Firma') as Error & { data?: CreateCompanyErrorData };
    if (json.data?.insufficient_funds) {
      err.data = json.data;
    }
    throw err;
  }
  return json.data;
}

/** Firma-Details laden */
export async function getCompanyDetails(companyId: number): Promise<CompanyDetails> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Firma');
  return json.data;
}

/** Firma bearbeiten */
export async function updateCompany(companyId: number, data: { name?: string }): Promise<Company> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Bearbeiten');
  return json.data.company;
}

/** Firma aufloesen */
export async function dissolveCompany(companyId: number): Promise<{ dissolved: boolean; payout: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Aufloesen');
  return json.data;
}

/** Mitglied einladen */
export async function inviteCompanyMember(companyId: number, userId: number, role: string = 'employee'): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/members/invite`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ user_id: userId, role }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Einladen');
}

/** Mitglied entfernen */
export async function removeCompanyMember(companyId: number, userId: number): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/members/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Entfernen');
}

/** Mitglied-Rolle aendern */
export async function changeCompanyMemberRole(companyId: number, userId: number, role: string): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/members/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Ändern der Rolle');
}

/** Finanz-History laden */
export async function getCompanyFinances(companyId: number, limit: number = 50): Promise<CompanyFinance[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/finances?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Finanzen');
  return json.data.finances;
}

/** Aufträge laden */
export async function getCompanyContracts(companyId: number, status?: string): Promise<CompanyContract[]> {
  const url = status
    ? `${AUTH_API_BASE_URL}/api/companies/${companyId}/contracts?status=${status}`
    : `${AUTH_API_BASE_URL}/api/companies/${companyId}/contracts`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Aufträge');
  return json.data.contracts;
}

/** Bei Firma bewerben */
export async function applyToCompany(companyId: number, message?: string): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/apply`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message: message || '' }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Bewerben');
}

/** Bewerbung annehmen/ablehnen */
export async function respondToApplication(companyId: number, applicationId: number, decision: 'accepted' | 'rejected'): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/applications/${applicationId}/respond`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ decision }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei der Bewerbungsantwort');
}

/** Auftrag annehmen */
export async function acceptContract(companyId: number, contractId: number): Promise<{
  accepted: boolean;
  work_duration_seconds?: number;
  completable_at?: string;
  assigned_user_id?: number;
}> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/contracts/${contractId}/accept`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Annehmen');
  return json.data;
}

/** Auftrag abschließen */
export async function completeContract(companyId: number, contractId: number): Promise<{
  payment: number; gross_payment: number; tax_amount: number;
  worker_payment: number; worker_bank_balance: number | null; salary_error: string | null;
  xp: number; reputation_gain: number; new_reputation: number;
  new_level: number; leveled_up: boolean;
}> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/contracts/${contractId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Abschliessen');
  return json.data;
}

/** Auftrag aus gemeldetem Event erstellen */
export async function createContractFromEvent(companyId: number, eventId: number): Promise<{ contract_id: number; payment: number; xp_reward: number; difficulty: number; work_duration_seconds: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/contracts/create`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ event_id: eventId }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Erstellen');
  return json.data;
}

/** Gemeldete Events ohne Auftrag laden */
export async function getReportedEvents(): Promise<Array<{ id: number; name: string; emoji: string; category: string; severity: number; fix_cost: number; status: string }>> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/events/reported`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden');
  return json.data.events;
}

/** User suchen (fuer Einladungen) */
export async function searchUsers(query: string): Promise<Array<{ id: number; nickname: string; municipality_name: string | null; user_level: number | null }>> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler bei der Suche');
  return json.data.users;
}

// ── Firma-Kredit Types ────────────────────────────────

export interface CreateCompanyErrorData {
  insufficient_funds: boolean;
  user_balance: number;
  founding_cost: number;
  gap: number;
  can_request_loan: boolean;
}

export interface CompanyLoanRequest {
  id: number;
  municipality_id: number;
  requesting_user_id: number;
  company_type_id: number;
  company_name: string;
  founding_cost: number;
  loan_amount: number;
  interest_rate: number;
  weekly_repayment: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message: string | null;
  reject_reason: string | null;
  responded_by: number | null;
  company_id: number | null;
  created_at: string;
  updated_at?: string;
  requester_nickname?: string;
  type_name?: string;
  type_emoji?: string;
  type_code?: string;
}

export interface CompanyLoan {
  id: number;
  company_id: number;
  municipality_id: number;
  loan_request_id: number;
  original_amount: number;
  remaining_amount: number;
  interest_rate: number;
  weekly_repayment: number;
  total_interest_paid: number;
  total_principal_paid: number;
  missed_payments: number;
  status: 'active' | 'paid_off' | 'defaulted';
  last_payment_at: string | null;
  last_interest_at: string | null;
  paid_off_at: string | null;
  defaulted_at: string | null;
  created_at: string;
}

// ── Firma-Kredit API Functions ─────────────────────────

/** Kredit beantragen */
export async function requestCompanyLoan(
  name: string,
  companyTypeId: number,
  message?: string
): Promise<CompanyLoanRequest> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/loan-request`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, company_type_id: companyTypeId, message: message || undefined }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Kredit-Antrag');
  return json.data;
}

/** Eigene Kredit-Antraege laden */
export async function getMyLoanRequests(): Promise<CompanyLoanRequest[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/loan-requests/my`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Antraege');
  return json.data.requests;
}

/** Kredit-Antrag stornieren */
export async function cancelLoanRequest(requestId: number): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/loan-requests/${requestId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Stornieren');
}

/** Offene Kredit-Antraege der Gemeinde laden (Admin) */
export async function getPendingLoanRequests(): Promise<CompanyLoanRequest[]> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/loan-requests/pending`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Antraege');
  return json.data.requests;
}

/** Kredit-Antrag genehmigen (Admin) */
export async function approveLoanRequest(requestId: number): Promise<{
  request_id: number;
  decision: string;
  company_id: number;
  company_name: string;
  loan_amount: number;
}> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/loan-requests/${requestId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Genehmigen');
  return json.data;
}

/** Kredit-Antrag ablehnen (Admin) */
export async function rejectLoanRequest(requestId: number, reason?: string): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/loan-requests/${requestId}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason: reason || undefined }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Ablehnen');
}

/** Kredit-Status einer Firma laden */
export async function getCompanyLoan(companyId: number): Promise<CompanyLoan | null> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/loan`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden des Kredit-Status');
  return json.data.loan;
}

/** Firma-Kredit-Zinssatz laden (Admin) */
export async function getCompanyLoanSettings(): Promise<{ interest_rate: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/game/bank/company-loan-settings`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Einstellungen');
  return json.data;
}

/** Firma-Kredit-Zinssatz aendern (Admin) */
export async function updateCompanyLoanSettings(interestRate: number): Promise<{ interest_rate: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/game/bank/company-loan-settings`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ interest_rate: interestRate }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Speichern');
  return json.data;
}

// ─── NPC-Bot API ─────────────────────────────────────────────

export interface NpcBotType {
  bot_type: 'hilfsarbeiter' | 'facharbeiter' | 'manager';
  display_name: string;
  emoji: string;
  hire_cost: number;
  salary_weekly: number;
  efficiency: number;
  max_per_company: number;
  description: string;
}

export interface NpcBot {
  id: number;
  company_id: number;
  name: string;
  bot_type: 'hilfsarbeiter' | 'facharbeiter' | 'manager';
  display_name: string;
  emoji: string;
  salary_weekly: number;
  efficiency_pct: number;
  status: 'idle' | 'working' | 'fired';
  contracts_completed: number;
  xp_earned: number;
  work_progress_pct: number | null;
  hired_at: string;
  contract_started_at: string | null;
  work_duration_seconds: number | null;
  patrol_mode: number;
  patrol_repairs: number;
}

export async function getCompanyNpcBots(companyId: number): Promise<{ bots: NpcBot[]; types: NpcBotType[] }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/npc-bots`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der NPCs');
  return json.data;
}

export async function hireNpcBot(companyId: number, botType: string): Promise<{ id: number; name: string; hireCost: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/npc-bots/hire`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ bot_type: botType }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Einstellen');
  return json.data;
}

export async function fireNpcBot(companyId: number, botId: number): Promise<void> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/npc-bots/${botId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Entlassen');
}

export async function toggleNpcPatrol(companyId: number, botId: number): Promise<{ patrol_mode: number }> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/companies/${companyId}/npc-bots/${botId}/patrol`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Patrol-Toggle');
  return json.data;
}

// ── Municipality Company Listing ──────────────────────────────────────────────

export interface MunicipalityCompany {
  id: number;
  name: string;
  level: number;
  reputation: number;
  balance: number;
  total_revenue: number;
  type_code: string;
  emoji: string;
  active_line_count: number;
  active_stop_count: number;
}

/** Alle Firmen einer Gemeinde laden (öffentlich, kein Auth). Optional nach Typ filtern. */
export async function getMunicipalityCompanies(slugOrId: string | number, typeCode?: string): Promise<MunicipalityCompany[]> {
  const url = `${AUTH_API_BASE_URL}/api/companies/municipality/${slugOrId}${typeCode ? `?type=${typeCode}` : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler beim Laden der Firmen');
  return json.data.companies;
}

