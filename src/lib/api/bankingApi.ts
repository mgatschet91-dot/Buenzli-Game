'use client';

import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Game-Token'] = token;
  }
  return headers;
}

export interface UserBankingProfile {
  user_id: number;
  account_number: string;
  card_number_masked: string;
  card_brand: string;
  balance: number;
  currency: string;
  status: 'active' | 'frozen' | 'closed';
  ahv_number: string;
  tax_number: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface BankingTransaction {
  id: number;
  direction: 'credit' | 'debit';
  type: string;
  amount: number;
  balance_after: number;
  reference: string | null;
  description: string | null;
  meta: Record<string, unknown> | null;
  created_at: string | null;
}

export interface BankingTransactionList {
  entries: BankingTransaction[];
  total: number;
  hasMore: boolean;
}

export async function getMyBankingProfile(): Promise<UserBankingProfile> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/banking/me`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Bankprofil konnte nicht geladen werden');
  }
  return json.data as UserBankingProfile;
}

export interface MyAuthProfile {
  nickname: string;
  global_role: string;
  user_rank: number;
  referral_code: string;
  has_google: boolean;
  referred_by_nickname: string | null;
  xp: { total_xp: number; level: number; max_level: number; next_level_xp: number | null; login_streak: number };
}

export async function getMyAuthProfile(): Promise<MyAuthProfile> {
  const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  const u = json.user || {};
  return {
    nickname: String(u.nickname || u.name || ''),
    global_role: String(u.global_role || 'user'),
    user_rank: Number(u.user_rank || 0),
    referral_code: String(u.referral_code || ''),
    has_google: Boolean(u.has_google),
    referred_by_nickname: u.referred_by_nickname ? String(u.referred_by_nickname) : null,
    xp: {
      total_xp: Number(u.xp?.total_xp || 0),
      level: Number(u.xp?.level || 0),
      max_level: Number(u.xp?.max_level || 5),
      next_level_xp: u.xp?.next_level_xp != null ? Number(u.xp.next_level_xp) : null,
      login_streak: Number(u.xp?.login_streak || 0),
    },
  };
}

export async function getMyReferralCode(): Promise<string> {
  const profile = await getMyAuthProfile();
  return profile.referral_code;
}

export async function getMyBankingTransactions(limit = 20, offset = 0): Promise<BankingTransactionList> {
  const safeLimit = Math.max(1, Math.min(100, Math.round(Number(limit) || 20)));
  const safeOffset = Math.max(0, Math.round(Number(offset) || 0));
  const res = await fetch(
    `${AUTH_API_BASE_URL}/api/banking/me/transactions?limit=${safeLimit}&offset=${safeOffset}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Transaktionen konnten nicht geladen werden');
  }
  return json.data as BankingTransactionList;
}
