'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  CircleDashed, ShieldAlert, Users, Flame, BarChart3, Search,
  Ban, CheckCircle, Trash2, ArrowRightLeft, Map, Pencil, X,
  AlertTriangle, Eye, ChevronDown, ExternalLink, Zap, Plus, FileText, Save, Award,
} from 'lucide-react';
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

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${AUTH_API_BASE_URL}${path}`, { ...opts, headers: getAuthHeaders() });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Fehler');
  return json.data;
}

type Tab = 'stats' | 'users' | 'events' | 'maps' | 'errors' | 'notice' | 'changelog' | 'badges';

interface AdminBadge {
  id?: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  rarity: number;
  is_active: number;
  sort_order: number;
}

interface UserBadge {
  badge_code: string;
  name: string | null;
  image_url: string | null;
  rarity: number;
  category: string;
  acquired_at: string;
}

const RARITY_LABELS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RARITY_COLORS = [
  'text-slate-300 bg-slate-700/50 border-slate-600',
  'text-emerald-300 bg-emerald-900/30 border-emerald-700/50',
  'text-blue-300 bg-blue-900/30 border-blue-700/50',
  'text-purple-300 bg-purple-900/30 border-purple-700/50',
  'text-amber-300 bg-amber-900/30 border-amber-600/50',
];

interface FrontendError {
  id: number;
  message: string;
  stack: string | null;
  component_stack: string | null;
  url: string | null;
  user_id: number | null;
  municipality_slug: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
}

interface AdminUser {
  id: number;
  nickname: string;
  email: string;
  level: number;
  xp: number;
  municipality_id: number | null;
  municipality_name: string | null;
  created_at: string;
  is_banned?: number;
}

interface UserDetail extends AdminUser {
  balance: number | null;
  treasury: number | null;
  debt: number | null;
  population: number | null;
  municipality_slug: string | null;
}

interface AdminEvent {
  id: number;
  name: string;
  emoji: string;
  category: string;
  severity: number;
  status: string;
  municipality_name: string;
  spawned_at: string;
}

interface ServerStats {
  users: number;
  municipalities: number;
  active_events: number;
  companies: number;
  online_users: number;
  uptime: number;
}

interface Municipality {
  id: number;
  name: string;
  slug: string;
  canton_code: string;
  members_count: number;
}

interface GameRoom {
  id: number;
  room_code: string;
  city_name: string;
  player_count: number;
  is_active: number;
}

interface ChangelogEntry {
  id: number;
  version: string;
  tag: 'neu' | 'fix' | 'entfernt';
  message: string;
  sort_order: number;
}

type EventStatusFilter = 'all' | 'active' | 'detected' | 'reported' | 'investigating' | 'assigned' | 'resolved' | 'external_reported';

const EVENT_STATUS_LABELS: Record<EventStatusFilter, string> = {
  all: 'Alle',
  active: 'Aktiv',
  detected: 'Erkannt',
  reported: 'Gemeldet',
  investigating: 'In Prüfung',
  assigned: 'Zugewiesen',
  resolved: 'Gelöst',
  external_reported: 'Extern gemeldet',
};

const EVENT_STATUS_COLORS: Record<string, string> = {
  detected: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  reported: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  investigating: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
  assigned: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  resolved: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  external_reported: 'text-red-400 bg-red-500/15 border-red-500/30',
};

export function AdminPanel({ onVisitMunicipality }: { onVisitMunicipality?: (slug: string) => void }) {
  const { setActivePanel } = useGame();
  const [tab, setTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<EventStatusFilter>('active');
  const [showEventFilterDropdown, setShowEventFilterDropdown] = useState(false);

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [muniChangeUser, setMuniChangeUser] = useState<AdminUser | null>(null);
  const [muniSearchText, setMuniSearchText] = useState('');
  const [selectedMuniId, setSelectedMuniId] = useState<number | null>(null);

  const [selectedMapMuni, setSelectedMapMuni] = useState<Municipality | null>(null);
  const [mapRooms, setMapRooms] = useState<GameRoom[]>([]);
  const [renameRoom, setRenameRoom] = useState<GameRoom | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [mapMuniSearch, setMapMuniSearch] = useState('');

  const [frontendErrors, setFrontendErrors] = useState<FrontendError[]>([]);
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null);

  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeFormat, setNoticeFormat] = useState<'normal' | 'bold' | 'italic' | 'small'>('normal');
  const [noticeTarget, setNoticeTarget] = useState<'online' | 'all' | 'user' | 'municipality'>('online');
  const [noticeUserId, setNoticeUserId] = useState<number | null>(null);
  const [noticeMuniId, setNoticeMuniId] = useState<number | null>(null);
  const [noticeMuniSearch, setNoticeMuniSearch] = useState('');
  const [noticeUserSearch, setNoticeUserSearch] = useState('');

  // User-Edit state
  const [editUser, setEditUser] = useState<UserDetail | null>(null);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [giveMoney, setGiveMoney] = useState('');
  const [giveTreasury, setGiveTreasury] = useState('');
  const [setXpValue, setSetXpValue] = useState('');

  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);
  const [newEntry, setNewEntry] = useState<{ version: string; tag: 'neu' | 'fix' | 'entfernt'; message: string }>({ version: '', tag: 'neu', message: '' });
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);

  // Badge state
  const [badges, setBadges] = useState<AdminBadge[]>([]);
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<AdminBadge | null>(null);
  const [badgeUserSearch, setBadgeUserSearch] = useState('');
  const [badgeSearchResults, setBadgeSearchResults] = useState<AdminUser[]>([]);
  const [awardTargetUser, setAwardTargetUser] = useState<AdminUser | null>(null);
  const [awardTargetBadges, setAwardTargetBadges] = useState<UserBadge[]>([]);
  const [showNewBadgeForm, setShowNewBadgeForm] = useState(false);
  const [newBadge, setNewBadge] = useState<Omit<AdminBadge, 'id' | 'is_active'>>({ code: '', name: '', description: '', category: 'general', image_url: '', rarity: 0, sort_order: 0 });
  const [editingBadge, setEditingBadge] = useState<AdminBadge | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/stats');
      setStats(data);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  const loadUsers = useCallback(async (q?: string) => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q || '')}`);
      setUsers(data.users);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  const loadEvents = useCallback(async (status: EventStatusFilter = 'active') => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/admin/events?status=${status}`);
      setEvents(data.events);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  const loadMunicipalities = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/municipalities');
      setMunicipalities(data.municipalities);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  }, []);

  const loadRooms = useCallback(async (muniId: number) => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/admin/rooms?municipality_id=${muniId}`);
      setMapRooms(data.rooms);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/frontend-errors');
      setFrontendErrors(data.errors || []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);


  const deleteError = useCallback(async (id: number) => {
    try {
      await apiFetch(`/api/admin/frontend-errors/${id}`, { method: 'DELETE' });
      setFrontendErrors(prev => prev.filter(e => e.id !== id));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  }, []);

  const loadChangelog = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/changelog');
      setChangelogEntries(data.entries || []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  const loadBadges = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/badges');
      setBadges(data.badges || []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  const searchBadgeUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setBadgeSearchResults([]); return; }
    try {
      const data = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}&limit=8`);
      setBadgeSearchResults(data.users || []);
    } catch { setBadgeSearchResults([]); }
  }, []);

  const loadUserBadges = useCallback(async (userId: number) => {
    try {
      const data = await apiFetch(`/api/admin/users/${userId}/badges`);
      setAwardTargetBadges(data.badges || []);
    } catch { setAwardTargetBadges([]); }
  }, []);

  const awardBadge = async (userId: number, badgeCode: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/badges`, { method: 'POST', body: JSON.stringify({ badge_code: badgeCode }) });
      setMsg('Badge vergeben');
      if (awardTargetUser?.id === userId) loadUserBadges(userId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const revokeBadge = async (userId: number, badgeCode: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/badges/${badgeCode}`, { method: 'DELETE' });
      setMsg('Badge entzogen');
      setAwardTargetBadges(prev => prev.filter(b => b.badge_code !== badgeCode));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const createBadge = async () => {
    try {
      const data = await apiFetch('/api/admin/badges', { method: 'POST', body: JSON.stringify({ ...newBadge, description: newBadge.description || null, image_url: newBadge.image_url || null }) });
      setBadges(prev => [...prev, data]);
      setShowNewBadgeForm(false);
      setNewBadge({ code: '', name: '', description: '', category: 'general', image_url: '', rarity: 0, sort_order: 0 });
      setMsg('Badge erstellt');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const updateBadge = async () => {
    if (!editingBadge) return;
    try {
      await apiFetch(`/api/admin/badges/${editingBadge.code}`, { method: 'PATCH', body: JSON.stringify({ name: editingBadge.name, description: editingBadge.description, image_url: editingBadge.image_url, category: editingBadge.category, rarity: editingBadge.rarity, sort_order: editingBadge.sort_order, is_active: editingBadge.is_active }) });
      setBadges(prev => prev.map(b => b.code === editingBadge.code ? editingBadge : b));
      setEditingBadge(null);
      setMsg('Badge aktualisiert');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const deleteBadge = async (code: string) => {
    if (!confirm(`Badge "${code}" wirklich löschen?`)) return;
    try {
      await apiFetch(`/api/admin/badges/${code}`, { method: 'DELETE' });
      setBadges(prev => prev.filter(b => b.code !== code));
      if (selectedBadge?.code === code) setSelectedBadge(null);
      setMsg('Badge gelöscht');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const createChangelogEntry = async () => {
    if (!newEntry.version || !newEntry.message) return;
    try {
      const maxSort = changelogEntries.filter(e => e.version === newEntry.version).reduce((max, e) => Math.max(max, e.sort_order), 0);
      await apiFetch('/api/admin/changelog', {
        method: 'POST',
        body: JSON.stringify({ ...newEntry, sort_order: maxSort + 1 }),
      });
      setShowNewEntryForm(false);
      setNewEntry({ version: '', tag: 'neu', message: '' });
      setMsg('Eintrag erstellt');
      loadChangelog();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const updateChangelogEntry = async (entry: ChangelogEntry) => {
    try {
      await apiFetch(`/api/admin/changelog/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: entry.version, tag: entry.tag, message: entry.message, sort_order: entry.sort_order }),
      });
      setEditingEntry(null);
      setMsg('Eintrag aktualisiert');
      loadChangelog();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const deleteChangelogEntry = async (id: number) => {
    try {
      await apiFetch(`/api/admin/changelog/${id}`, { method: 'DELETE' });
      setChangelogEntries(prev => prev.filter(e => e.id !== id));
      setMsg('Eintrag gelöscht');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  useEffect(() => {
    setError(null);
    if (tab === 'stats') loadStats();
    else if (tab === 'users') loadUsers();
    else if (tab === 'events') loadEvents(eventFilter);
    else if (tab === 'maps') loadMunicipalities();
    else if (tab === 'errors') loadErrors();
    else if (tab === 'notice') { setNoticeMessage(''); setNoticeTitle(''); setNoticeFormat('normal'); setNoticeTarget('online'); setNoticeUserId(null); setNoticeMuniId(null); setNoticeMuniSearch(''); setNoticeUserSearch(''); loadMunicipalities(); loadUsers(); }
    else if (tab === 'changelog') loadChangelog();
    else if (tab === 'badges') { loadBadges(); setSelectedBadge(null); setAwardTargetUser(null); setAwardTargetBadges([]); setShowNewBadgeForm(false); setEditingBadge(null); }
  }, [tab, loadStats, loadUsers, loadEvents, loadMunicipalities, loadErrors, loadChangelog, loadBadges, eventFilter]);

  const openEditUser = async (u: AdminUser) => {
    setEditUserLoading(true);
    setGiveMoney(''); setGiveTreasury(''); setSetXpValue('');
    try {
      const data = await apiFetch(`/api/admin/users/${u.id}/detail`);
      setEditUser(data);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
    finally { setEditUserLoading(false); }
  };

  const handleGiveMoney = async () => {
    if (!editUser || !giveMoney) return;
    try {
      const data = await apiFetch(`/api/admin/users/${editUser.id}/give-money`, { method: 'POST', body: JSON.stringify({ amount: Number(giveMoney) }) });
      setEditUser(prev => prev ? { ...prev, balance: data.balance } : prev);
      setMsg(`Kontostand von ${editUser.nickname} aktualisiert → ${data.balance} CHF`);
      setGiveMoney('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handleGiveTreasury = async () => {
    if (!editUser || !giveTreasury) return;
    try {
      const data = await apiFetch(`/api/admin/users/${editUser.id}/give-treasury`, { method: 'POST', body: JSON.stringify({ amount: Number(giveTreasury) }) });
      setEditUser(prev => prev ? { ...prev, treasury: data.treasury, debt: data.debt } : prev);
      setMsg(`Gemeindekasse von ${editUser.municipality_name} aktualisiert → ${data.treasury} CHF`);
      setGiveTreasury('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handleSetXp = async () => {
    if (!editUser || !setXpValue) return;
    try {
      const data = await apiFetch(`/api/admin/users/${editUser.id}/set-xp`, { method: 'POST', body: JSON.stringify({ xp: Number(setXpValue) }) });
      setEditUser(prev => prev ? { ...prev, xp: data.xp, level: data.level } : prev);
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, xp: data.xp, level: data.level } : u));
      setMsg(`XP von ${editUser.nickname} → ${data.xp} (Lv.${data.level})`);
      setSetXpValue('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handleBan = async (userId: number, ban: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/${ban ? 'ban' : 'unban'}`, { method: 'POST' });
      setMsg(ban ? 'User gebannt' : 'User entbannt');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: ban ? 1 : 0 } : u));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handleChangeMunicipality = async () => {
    if (!muniChangeUser) return;
    try {
      await apiFetch(`/api/admin/users/${muniChangeUser.id}/municipality`, {
        method: 'POST',
        body: JSON.stringify({ municipality_id: selectedMuniId }),
      });
      const muniName = selectedMuniId ? municipalities.find(m => m.id === selectedMuniId)?.name || null : null;
      setUsers(prev => prev.map(u =>
        u.id === muniChangeUser.id ? { ...u, municipality_id: selectedMuniId, municipality_name: muniName } : u
      ));
      setMsg(`Gemeinde von ${muniChangeUser.nickname} geändert`);
      setMuniChangeUser(null);
      setSelectedMuniId(null);
      setMuniSearchText('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setMsg('Event gelöscht');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handlePushEvent = async (eventId: number) => {
    try {
      await apiFetch('/api/admin/events/push-to-verwaltung', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId }),
      });
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'reported' } : e));
      setMsg('Event an Verwaltung gepusht');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const handleRenameRoom = async () => {
    if (!selectedMapMuni || !renameRoom || !newCityName.trim()) return;
    try {
      await apiFetch('/api/admin/rooms/rename', {
        method: 'POST',
        body: JSON.stringify({
          municipality_id: selectedMapMuni.id,
          room_code: renameRoom.room_code,
          city_name: newCityName.trim(),
        }),
      });
      setMapRooms(prev => prev.map(r =>
        r.id === renameRoom.id ? { ...r, city_name: newCityName.trim() } : r
      ));
      setMsg(`Map "${renameRoom.room_code}" umbenannt zu "${newCityName.trim()}"`);
      setRenameRoom(null);
      setNewCityName('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const filteredMunicipalities = municipalities.filter(m =>
    m.name.toLowerCase().includes(muniSearchText.toLowerCase())
  );

  const mapFilteredMunis = municipalities.filter(m =>
    m.name.toLowerCase().includes(mapMuniSearch.toLowerCase())
  );

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-2xl bg-slate-900/95 border-slate-700 text-white max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Admin-Dashboard
          </DialogTitle>
        </DialogHeader>

        {error && <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-red-400 text-sm">{error}<button className="ml-2 underline" onClick={() => setError(null)}>x</button></div>}
        {msg && <div className="px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded text-emerald-400 text-sm">{msg}<button className="ml-2 underline" onClick={() => setMsg(null)}>x</button></div>}

        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
          {([
            ['stats', BarChart3, 'Statistiken'],
            ['users', Users, 'User'],
            ['events', Flame, 'Events'],
            ['maps', Map, 'Maps'],
            ['errors', AlertTriangle, 'Fehler'],
            ['notice', Zap, 'Nachrichten'],
            ['changelog', FileText, 'Log'],
            ['badges', Award, 'Badges'],
          ] as const).map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key as Tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                tab === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <CircleDashed className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh]">
            {/* ─── STATS TAB ─── */}
            {tab === 'stats' && stats && (
              <div className="grid grid-cols-2 gap-3 pr-2">
                {[
                  ['Spieler', stats.users, 'text-blue-400'],
                  ['Gemeinden', stats.municipalities, 'text-emerald-400'],
                  ['Aktive Events', stats.active_events, 'text-amber-400'],
                  ['Firmen', stats.companies, 'text-purple-400'],
                  ['Online', stats.online_users, 'text-green-400'],
                  ['Uptime', formatUptime(stats.uptime), 'text-slate-300'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                    <div className="text-xs text-slate-400">{label}</div>
                    <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── USERS TAB ─── */}
            {tab === 'users' && (
              <div className="space-y-2 pr-2">
                <div className="flex gap-2">
                  <Input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="User suchen (Name / E-Mail)..."
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    onKeyDown={e => e.key === 'Enter' && loadUsers(userSearch)}
                  />
                  <Button size="sm" onClick={() => loadUsers(userSearch)} className="bg-slate-700 hover:bg-slate-600">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>

                {/* Municipality change dialog */}
                {muniChangeUser && (
                  <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Gemeinde ändern für <span className="text-blue-300">{muniChangeUser.nickname}</span>
                      </span>
                      <button onClick={() => { setMuniChangeUser(null); setSelectedMuniId(null); setMuniSearchText(''); }}>
                        <X className="w-4 h-4 text-slate-400 hover:text-white" />
                      </button>
                    </div>
                    <Input
                      value={muniSearchText}
                      onChange={e => setMuniSearchText(e.target.value)}
                      placeholder="Gemeinde suchen..."
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 text-sm"
                    />
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      <button
                        onClick={() => setSelectedMuniId(null)}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                          selectedMuniId === null ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Keine Gemeinde (entfernen)
                      </button>
                      {filteredMunicipalities.map(m => (
                        <button key={m.id}
                          onClick={() => setSelectedMuniId(m.id)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                            selectedMuniId === m.id ? 'bg-blue-500/20 text-blue-300' : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {m.name} <span className="text-slate-500 text-xs">({m.canton_code} · {m.members_count} Mitglieder)</span>
                        </button>
                      ))}
                    </div>
                    <Button size="sm" onClick={handleChangeMunicipality} className="bg-blue-600 hover:bg-blue-500 w-full">
                      Gemeinde ändern
                    </Button>
                  </div>
                )}

                {users.map(u => (
                  <div key={u.id} className="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden">
                    <div className="flex items-center gap-3 p-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white truncate">{u.nickname}</span>
                          <Badge variant="outline" className="text-[10px]">Lv.{u.level}</Badge>
                          {u.is_banned ? <Badge variant="destructive" className="text-[10px]">Gebannt</Badge> : null}
                        </div>
                        <div className="text-xs text-slate-500">{u.email} · {u.municipality_name || 'Keine Gemeinde'}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline"
                          onClick={() => editUser?.id === u.id ? setEditUser(null) : openEditUser(u)}
                          className={`${editUser?.id === u.id ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' : 'border-violet-500/30 text-violet-400 hover:bg-violet-500/15'}`}
                          title="User bearbeiten"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setMuniChangeUser(u); setSelectedMuniId(u.municipality_id); setMuniSearchText(''); if (municipalities.length === 0) loadMunicipalities(); }}
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/15"
                          title="Gemeinde wechseln"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => handleBan(u.id, !u.is_banned)}
                          className={u.is_banned ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15' : 'border-red-500/30 text-red-400 hover:bg-red-500/15'}
                          title={u.is_banned ? 'Entbannen' : 'Bannen'}
                        >
                          {u.is_banned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* ─ Inline Edit Panel ─ */}
                    {editUser?.id === u.id && (
                      <div className="border-t border-slate-700/60 bg-slate-900/60 p-3 space-y-3">
                        {editUserLoading ? (
                          <div className="flex justify-center py-4"><CircleDashed className="w-5 h-5 animate-spin text-slate-400" /></div>
                        ) : (
                          <>
                            {/* Info-Zeile */}
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-slate-800/60 rounded px-2.5 py-1.5">
                                <div className="text-slate-500">Kontostand</div>
                                <div className="text-emerald-300 font-mono font-semibold">
                                  {editUser.balance !== null ? `${editUser.balance.toLocaleString('de-CH')} CHF` : '—'}
                                </div>
                              </div>
                              <div className="bg-slate-800/60 rounded px-2.5 py-1.5">
                                <div className="text-slate-500">XP / Level</div>
                                <div className="text-blue-300 font-mono font-semibold">{editUser.xp.toLocaleString('de-CH')} XP · Lv.{editUser.level}</div>
                              </div>
                              {editUser.municipality_name && (
                                <>
                                  <div className="bg-slate-800/60 rounded px-2.5 py-1.5">
                                    <div className="text-slate-500">Gemeindekasse</div>
                                    <div className="text-yellow-300 font-mono font-semibold">
                                      {editUser.treasury !== null ? `${editUser.treasury.toLocaleString('de-CH')} CHF` : '—'}
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/60 rounded px-2.5 py-1.5">
                                    <div className="text-slate-500">Schulden / Einw.</div>
                                    <div className="text-red-300 font-mono font-semibold">
                                      {editUser.debt !== null ? `${editUser.debt.toLocaleString('de-CH')} CHF` : '—'} · {editUser.population ?? '—'}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Geld geben */}
                            <div className="space-y-1">
                              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Persönliches Geld (CHF, negativ zum Abziehen)</div>
                              <div className="flex gap-2">
                                <Input value={giveMoney} onChange={e => setGiveMoney(e.target.value)} placeholder="z.B. 500 oder -200"
                                  type="number" className="bg-slate-800/50 border-slate-700 text-white h-8 text-xs flex-1" />
                                <Button size="sm" onClick={handleGiveMoney} disabled={!giveMoney}
                                  className="bg-emerald-700 hover:bg-emerald-600 h-8 text-xs px-3">Geben</Button>
                              </div>
                            </div>

                            {/* Gemeindekasse */}
                            {editUser.municipality_name && (
                              <div className="space-y-1">
                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Gemeindekasse — {editUser.municipality_name}</div>
                                <div className="flex gap-2">
                                  <Input value={giveTreasury} onChange={e => setGiveTreasury(e.target.value)} placeholder="z.B. 5000 oder -1000"
                                    type="number" className="bg-slate-800/50 border-slate-700 text-white h-8 text-xs flex-1" />
                                  <Button size="sm" onClick={handleGiveTreasury} disabled={!giveTreasury}
                                    className="bg-yellow-700 hover:bg-yellow-600 h-8 text-xs px-3">Geben</Button>
                                </div>
                              </div>
                            )}

                            {/* XP setzen */}
                            <div className="space-y-1">
                              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">XP direkt setzen</div>
                              <div className="flex gap-2">
                                <Input value={setXpValue} onChange={e => setSetXpValue(e.target.value)} placeholder="z.B. 2500"
                                  type="number" className="bg-slate-800/50 border-slate-700 text-white h-8 text-xs flex-1" />
                                <Button size="sm" onClick={handleSetXp} disabled={!setXpValue}
                                  className="bg-blue-700 hover:bg-blue-600 h-8 text-xs px-3">Setzen</Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">Keine User gefunden</p>
                )}
              </div>
            )}

            {/* ─── EVENTS TAB ─── */}
            {tab === 'events' && (
              <div className="space-y-2 pr-2">
                {/* Status filter */}
                <div className="relative">
                  <button
                    onClick={() => setShowEventFilterDropdown(v => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 w-full justify-between"
                  >
                    <span>Status: {EVENT_STATUS_LABELS[eventFilter]}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showEventFilterDropdown && (
                    <div className="absolute z-20 top-full mt-1 left-0 w-full bg-slate-800 border border-slate-700 rounded-md shadow-lg overflow-hidden">
                      {(Object.keys(EVENT_STATUS_LABELS) as EventStatusFilter[]).map(key => (
                        <button key={key}
                          onClick={() => { setEventFilter(key); setShowEventFilterDropdown(false); loadEvents(key); }}
                          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                            eventFilter === key ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                          }`}
                        >
                          {EVENT_STATUS_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {events.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Keine Events mit Status &ldquo;{EVENT_STATUS_LABELS[eventFilter]}&rdquo;</p>
                    <p className="text-xs text-slate-500 mt-1">Versuche einen anderen Filter</p>
                  </div>
                ) : events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-700 bg-slate-800/30">
                    <span className="text-lg">{ev.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-white truncate">{ev.name}</span>
                        <Badge className={`text-[10px] border ${EVENT_STATUS_COLORS[ev.status] || 'text-slate-400'}`}>
                          {ev.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400">{ev.municipality_name} · Schwere {ev.severity}/5</div>
                    </div>
                    <div className="flex gap-1">
                      {ev.status === 'detected' && (
                        <Button size="sm" variant="outline"
                          onClick={() => handlePushEvent(ev.id)}
                          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/15"
                          title="An Verwaltung melden"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/15"
                        title="Event löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── MAPS TAB ─── */}
            {tab === 'maps' && (
              <div className="space-y-2 pr-2">
                {!selectedMapMuni ? (
                  <>
                    <Input
                      value={mapMuniSearch}
                      onChange={e => setMapMuniSearch(e.target.value)}
                      placeholder="Gemeinde suchen..."
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    {mapFilteredMunis.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">Keine Gemeinden gefunden</p>
                    ) : mapFilteredMunis.slice(0, 30).map(m => (
                      <div key={m.id} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-700 bg-slate-800/30">
                        <Map className="w-4 h-4 text-emerald-400 shrink-0" />
                        <button onClick={() => { setSelectedMapMuni(m); loadRooms(m.id); }}
                          className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
                          <div className="font-medium text-sm text-white truncate">{m.name}</div>
                          <div className="text-xs text-slate-500">{m.canton_code} · {m.members_count} Mitglieder</div>
                        </button>
                        <Button size="sm" variant="outline"
                          onClick={() => { onVisitMunicipality?.(m.slug); setActivePanel('none'); }}
                          className="border-sky-500/30 text-sky-400 hover:bg-sky-500/15 shrink-0"
                          title="Gemeinde besuchen"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedMapMuni(null); setMapRooms([]); setRenameRoom(null); }}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        ← Zurück
                      </Button>
                      <span className="font-medium text-sm text-white">{selectedMapMuni.name}</span>
                      <Badge variant="outline" className="text-[10px]">{selectedMapMuni.canton_code}</Badge>
                    </div>

                    {/* Rename dialog */}
                    {renameRoom && (
                      <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Map umbenennen: <span className="text-emerald-300">{renameRoom.room_code}</span>
                          </span>
                          <button onClick={() => { setRenameRoom(null); setNewCityName(''); }}>
                            <X className="w-4 h-4 text-slate-400 hover:text-white" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-400">
                          Aktuell: {renameRoom.city_name || '(kein Name)'}
                        </div>
                        <Input
                          value={newCityName}
                          onChange={e => setNewCityName(e.target.value)}
                          placeholder="Neuer Map-Name..."
                          className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 text-sm"
                          onKeyDown={e => e.key === 'Enter' && handleRenameRoom()}
                        />
                        <Button size="sm" onClick={handleRenameRoom} className="bg-emerald-600 hover:bg-emerald-500 w-full"
                          disabled={!newCityName.trim()}>
                          Umbenennen
                        </Button>
                      </div>
                    )}

                    {mapRooms.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">Keine Rooms / Maps für diese Gemeinde</p>
                    ) : mapRooms.map(room => (
                      <div key={room.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-700 bg-slate-800/30">
                        <Map className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-white">{room.room_code}</span>
                            {room.player_count > 0 && (
                              <Badge variant="outline" className="text-[10px] text-green-400">{room.player_count} online</Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{room.city_name || '(kein Name)'}</div>
                        </div>
                        <Button size="sm" variant="outline"
                          onClick={() => { onVisitMunicipality?.(selectedMapMuni!.slug); setActivePanel('none'); }}
                          className="border-sky-500/30 text-sky-400 hover:bg-sky-500/15"
                          title="Map besuchen"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => { setRenameRoom(room); setNewCityName(room.city_name || ''); }}
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
                          title="Umbenennen"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ─── ERRORS TAB ─── */}
            {tab === 'errors' && (
              <div className="space-y-2 pr-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">{frontendErrors.length} Fehler (neueste zuerst)</span>
                  <Button size="sm" variant="outline" onClick={loadErrors}
                    className="border-slate-700 text-slate-400 hover:bg-slate-700 text-xs h-7">
                    Aktualisieren
                  </Button>
                </div>
                {frontendErrors.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Keine Frontend-Fehler geloggt</p>
                ) : frontendErrors.map(fe => (
                  <div key={fe.id} className="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden">
                    <div className="flex items-start gap-2 p-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-red-300 break-all">
                            {fe.message.slice(0, 100)}{fe.message.length > 100 ? '…' : ''}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400 shrink-0">
                            ×{fe.count}
                          </Badge>
                        </div>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {fe.municipality_slug && (
                            <span className="text-[10px] text-slate-500">📍 {fe.municipality_slug}</span>
                          )}
                          {fe.url && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={fe.url}>
                              🔗 {fe.url.replace(/^https?:\/\/[^/]+/, '')}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-600">
                            {new Date(fe.last_seen).toLocaleString('de-CH')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedErrorId(expandedErrorId === fe.id ? null : fe.id)}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="Stack anzeigen"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedErrorId === fe.id ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          onClick={() => deleteError(fe.id)}
                          className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {expandedErrorId === fe.id && (
                      <div className="border-t border-slate-700/50 bg-slate-950/50 p-2.5 space-y-2">
                        {fe.stack && (
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Stack Trace</div>
                            <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                              {fe.stack.slice(0, 2000)}
                            </pre>
                          </div>
                        )}
                        {fe.component_stack && (
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Component Stack</div>
                            <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                              {fe.component_stack.slice(0, 1000)}
                            </pre>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-600">
                          Zuerst gesehen: {new Date(fe.first_seen).toLocaleString('de-CH')}
                          {fe.user_id && ` · User #${fe.user_id}`}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* ─── NACHRICHTEN TAB ─── */}
            {tab === 'notice' && (
              <div className="space-y-4 pr-2">
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Nachricht senden</div>

                {/* Ziel */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Ziel</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      ['online', 'Alle Online'],
                      ['all', 'Alle Spieler'],
                      ['municipality', 'Gemeinde'],
                      ['user', 'Einzelner User'],
                    ] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setNoticeTarget(key)}
                        className={`text-xs px-3 py-1.5 rounded border transition-all ${noticeTarget === key ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gemeinde-Suche */}
                {noticeTarget === 'municipality' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 uppercase font-semibold">Gemeinde wählen</div>
                    <Input
                      placeholder="Gemeinde suchen…"
                      value={noticeMuniSearch}
                      onChange={e => setNoticeMuniSearch(e.target.value)}
                      className="h-8 text-xs bg-slate-900 border-slate-600"
                    />
                    {noticeMuniSearch.length >= 2 && (
                      <div className="bg-slate-900 border border-slate-700 rounded max-h-36 overflow-y-auto">
                        {municipalities.filter(m => m.name.toLowerCase().includes(noticeMuniSearch.toLowerCase())).slice(0, 8).map(m => (
                          <button key={m.id} onClick={() => { setNoticeMuniId(m.id); setNoticeMuniSearch(m.name); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${noticeMuniId === m.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {m.name} <span className="text-slate-500">· {m.members_count} Mitglieder</span>
                          </button>
                        ))}
                        {municipalities.filter(m => m.name.toLowerCase().includes(noticeMuniSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500">Keine Treffer</div>
                        )}
                      </div>
                    )}
                    {noticeMuniId && <div className="text-[11px] text-indigo-400">✓ Gemeinde-ID: {noticeMuniId}</div>}
                  </div>
                )}

                {/* User-Suche */}
                {noticeTarget === 'user' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 uppercase font-semibold">User wählen</div>
                    <Input
                      placeholder="Nickname oder E-Mail suchen…"
                      value={noticeUserSearch}
                      onChange={e => setNoticeUserSearch(e.target.value)}
                      className="h-8 text-xs bg-slate-900 border-slate-600"
                    />
                    {noticeUserSearch.length >= 2 && (
                      <div className="bg-slate-900 border border-slate-700 rounded max-h-36 overflow-y-auto">
                        {users.filter(u => u.nickname.toLowerCase().includes(noticeUserSearch.toLowerCase()) || u.email.toLowerCase().includes(noticeUserSearch.toLowerCase())).slice(0, 8).map(u => (
                          <button key={u.id} onClick={() => { setNoticeUserId(u.id); setNoticeUserSearch(u.nickname); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${noticeUserId === u.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {u.nickname} <span className="text-slate-500">· {u.email}</span>
                          </button>
                        ))}
                        {users.filter(u => u.nickname.toLowerCase().includes(noticeUserSearch.toLowerCase()) || u.email.toLowerCase().includes(noticeUserSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500">Keine Treffer</div>
                        )}
                      </div>
                    )}
                    {noticeUserId && <div className="text-[11px] text-indigo-400">✓ User-ID: {noticeUserId}</div>}
                  </div>
                )}

                {/* Format */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Format</div>
                  <div className="flex gap-1.5">
                    {([
                      ['normal', 'Normal'],
                      ['bold', 'Fett'],
                      ['italic', 'Kursiv'],
                      ['small', 'Klein'],
                    ] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setNoticeFormat(key)}
                        className={`text-xs px-3 py-1.5 rounded border transition-all ${
                          key === 'bold' ? 'font-bold' : key === 'italic' ? 'italic' : key === 'small' ? 'text-[10px]' : ''
                        } ${noticeFormat === key ? 'bg-slate-600 border-slate-500 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Titel (optional) */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Titel <span className="normal-case text-slate-600">(leer = Standard)</span></div>
                  <Input
                    placeholder="Nachricht von Bünzlifight Management"
                    value={noticeTitle}
                    onChange={e => setNoticeTitle(e.target.value)}
                    className="h-8 text-xs bg-slate-900 border-slate-600"
                  />
                </div>

                {/* Nachricht */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold">Nachricht</div>
                  <textarea
                    placeholder="Nachricht eingeben…"
                    value={noticeMessage}
                    onChange={e => setNoticeMessage(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-500"
                  />
                  <div className="text-[10px] text-slate-600 text-right">{noticeMessage.length}/1000</div>
                </div>

                {/* Vorschau */}
                {noticeMessage.trim() && (
                  <div className="bg-slate-800/60 border border-indigo-500/30 rounded p-3 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Vorschau</div>
                    <div className="text-[11px] text-indigo-300 font-semibold">{noticeTitle || 'Nachricht von Bünzlifight Management'}</div>
                    <div className={`text-xs text-slate-200 ${noticeFormat === 'bold' ? 'font-bold' : noticeFormat === 'italic' ? 'italic' : noticeFormat === 'small' ? 'text-[10px]' : ''}`}>
                      {noticeMessage}
                    </div>
                  </div>
                )}

                {/* Senden */}
                <Button
                  disabled={loading || !noticeMessage.trim() || (noticeTarget === 'user' && !noticeUserId) || (noticeTarget === 'municipality' && !noticeMuniId)}
                  onClick={async () => {
                    try {
                      setLoading(true); setError(null);
                      const body: Record<string, unknown> = {
                        target: noticeTarget,
                        message: noticeMessage,
                        format: noticeFormat,
                        ...(noticeTitle.trim() ? { title: noticeTitle.trim() } : {}),
                        ...(noticeTarget === 'user' ? { user_id: noticeUserId } : {}),
                        ...(noticeTarget === 'municipality' ? { municipality_id: noticeMuniId } : {}),
                      };
                      const data = await apiFetch('/api/admin/notice', { method: 'POST', body: JSON.stringify(body) });
                      const sent = data.sent ?? data.notified ?? 1;
                      setMsg(`Nachricht gesendet (${sent} Empfänger)`);
                      // Admin sieht die eigene Nachricht sofort (unabhängig von Socket-Verbindung)
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('system-notice', { detail: {
                          title: noticeTitle.trim() || 'Nachricht von Bünzlifight Management',
                          message: noticeMessage,
                          format: noticeFormat,
                        }}));
                      }
                      setNoticeMessage(''); setNoticeTitle('');
                    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Fehler'); }
                    finally { setLoading(false); }
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm h-9"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {noticeTarget === 'online' ? 'An alle Online senden' : noticeTarget === 'all' ? 'An alle Spieler senden' : noticeTarget === 'municipality' ? 'An Gemeinde senden' : 'An User senden'}
                </Button>
              </div>
            )}
            {/* ─── CHANGELOG TAB ─── */}
            {tab === 'changelog' && (
              <div className="space-y-3 pr-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-300">Changelog-Einträge</h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => { setShowNewEntryForm(!showNewEntryForm); setEditingEntry(null); }}>
                    <Plus className="w-3 h-3 mr-1" /> Neu
                  </Button>
                </div>

                {showNewEntryForm && (
                  <div className="p-3 bg-slate-800/60 rounded border border-slate-700 space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="Version (z.B. v2.2)" value={newEntry.version} onChange={e => setNewEntry(p => ({ ...p, version: e.target.value }))}
                        className="h-8 text-xs bg-slate-900 border-slate-600 flex-[1]" />
                      <select value={newEntry.tag} onChange={e => setNewEntry(p => ({ ...p, tag: e.target.value as 'neu' | 'fix' | 'entfernt' }))}
                        className="h-8 text-xs bg-slate-900 border border-slate-600 rounded px-2 text-white">
                        <option value="neu">Neu</option>
                        <option value="fix">Fix</option>
                        <option value="entfernt">Entfernt</option>
                      </select>
                    </div>
                    <Input placeholder="Beschreibung" value={newEntry.message} onChange={e => setNewEntry(p => ({ ...p, message: e.target.value }))}
                      className="h-8 text-xs bg-slate-900 border-slate-600" />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewEntryForm(false)}>Abbrechen</Button>
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={createChangelogEntry}>
                        <Save className="w-3 h-3 mr-1" /> Speichern
                      </Button>
                    </div>
                  </div>
                )}

                {(() => {
                  const grouped = changelogEntries.reduce<Record<string, ChangelogEntry[]>>((acc, e) => {
                    if (!acc[e.version]) acc[e.version] = [];
                    acc[e.version].push(e);
                    return acc;
                  }, {});
                  const TAG_COLORS: Record<string, string> = {
                    neu: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
                    fix: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
                    entfernt: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
                  };
                  return Object.entries(grouped).map(([version, entries]) => (
                    <div key={version} className="space-y-1">
                      <div className="text-[10px] tracking-[0.15em] uppercase text-amber-200/60 font-semibold pt-1">{version}</div>
                      {entries.map(entry => (
                        editingEntry?.id === entry.id ? (
                          <div key={entry.id} className="p-2 bg-slate-800/60 rounded border border-blue-500/30 space-y-2">
                            <div className="flex gap-2">
                              <Input value={editingEntry.version} onChange={e => setEditingEntry({ ...editingEntry, version: e.target.value })}
                                className="h-7 text-xs bg-slate-900 border-slate-600 flex-[1]" />
                              <select value={editingEntry.tag} onChange={e => setEditingEntry({ ...editingEntry, tag: e.target.value as 'neu' | 'fix' | 'entfernt' })}
                                className="h-7 text-xs bg-slate-900 border border-slate-600 rounded px-2 text-white">
                                <option value="neu">Neu</option>
                                <option value="fix">Fix</option>
                                <option value="entfernt">Entfernt</option>
                              </select>
                            </div>
                            <Input value={editingEntry.message} onChange={e => setEditingEntry({ ...editingEntry, message: e.target.value })}
                              className="h-7 text-xs bg-slate-900 border-slate-600" />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingEntry(null)}>Abbrechen</Button>
                              <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => updateChangelogEntry(editingEntry)}>
                                <Save className="w-3 h-3 mr-1" /> Speichern
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div key={entry.id} className="flex items-center gap-2 group">
                            <Badge className={`text-[10px] px-1.5 py-0 border ${TAG_COLORS[entry.tag] || TAG_COLORS.neu}`}>
                              {entry.tag === 'neu' ? 'Neu' : entry.tag === 'fix' ? 'Fix' : 'Entfernt'}
                            </Badge>
                            <span className="text-xs text-slate-200 flex-1">{entry.message}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-0.5 text-slate-500 hover:text-blue-400" onClick={() => { setEditingEntry({ ...entry }); setShowNewEntryForm(false); }}>
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button className="p-0.5 text-slate-500 hover:text-red-400" onClick={() => deleteChangelogEntry(entry.id)}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  ));
                })()}

                {changelogEntries.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">Keine Einträge vorhanden</div>
                )}
              </div>
            )}

            {/* ─── BADGES TAB ─── */}
            {tab === 'badges' && (
              <div className="space-y-3 pr-2">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {(['all', 'achievement', 'rank', 'event', 'special', 'general'] as const).map(cat => (
                      <button key={cat} onClick={() => setBadgeCategoryFilter(cat)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${badgeCategoryFilter === cat ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
                        {cat === 'all' ? 'Alle' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600"
                    onClick={() => { setShowNewBadgeForm(o => !o); setEditingBadge(null); }}>
                    <Plus className="w-3 h-3 mr-1" /> Neu
                  </Button>
                </div>

                {/* New badge form */}
                {showNewBadgeForm && (
                  <div className="p-3 rounded-lg border border-emerald-700/40 bg-emerald-900/10 space-y-2">
                    <div className="text-xs font-semibold text-emerald-300 mb-1">Neuer Badge</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={newBadge.code} onChange={e => setNewBadge(p => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'') }))}
                        placeholder="CODE (z.B. VIP2)" className="h-7 text-xs bg-slate-900 border-slate-600 font-mono" maxLength={64} />
                      <Input value={newBadge.name} onChange={e => setNewBadge(p => ({ ...p, name: e.target.value }))}
                        placeholder="Name" className="h-7 text-xs bg-slate-900 border-slate-600" maxLength={128} />
                    </div>
                    <Input value={newBadge.image_url || ''} onChange={e => setNewBadge(p => ({ ...p, image_url: e.target.value }))}
                      placeholder="Bild-URL (z.B. https://images.bobba.io/c_images/Badges/VIP.gif)" className="h-7 text-xs bg-slate-900 border-slate-600" />
                    <Input value={newBadge.description || ''} onChange={e => setNewBadge(p => ({ ...p, description: e.target.value }))}
                      placeholder="Beschreibung" className="h-7 text-xs bg-slate-900 border-slate-600" />
                    <div className="flex gap-2">
                      <select value={newBadge.category} onChange={e => setNewBadge(p => ({ ...p, category: e.target.value }))}
                        className="flex-1 h-7 text-xs bg-slate-900 border border-slate-600 rounded px-2 text-slate-200">
                        {['achievement','rank','event','special','general'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={newBadge.rarity} onChange={e => setNewBadge(p => ({ ...p, rarity: Number(e.target.value) }))}
                        className="flex-1 h-7 text-xs bg-slate-900 border border-slate-600 rounded px-2 text-slate-200">
                        {RARITY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowNewBadgeForm(false)}>Abbrechen</Button>
                      <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={createBadge} disabled={!newBadge.code || !newBadge.name}>
                        <Save className="w-3 h-3 mr-1" /> Erstellen
                      </Button>
                    </div>
                  </div>
                )}

                {/* Edit badge form */}
                {editingBadge && (
                  <div className="p-3 rounded-lg border border-blue-700/40 bg-blue-900/10 space-y-2">
                    <div className="text-xs font-semibold text-blue-300 mb-1">Badge bearbeiten: <span className="font-mono">{editingBadge.code}</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editingBadge.name} onChange={e => setEditingBadge(p => p ? { ...p, name: e.target.value } : p)}
                        placeholder="Name" className="h-7 text-xs bg-slate-900 border-slate-600" />
                      <Input value={editingBadge.image_url || ''} onChange={e => setEditingBadge(p => p ? { ...p, image_url: e.target.value || null } : p)}
                        placeholder="Bild-URL" className="h-7 text-xs bg-slate-900 border-slate-600" />
                    </div>
                    <Input value={editingBadge.description || ''} onChange={e => setEditingBadge(p => p ? { ...p, description: e.target.value || null } : p)}
                      placeholder="Beschreibung" className="h-7 text-xs bg-slate-900 border-slate-600" />
                    <div className="flex gap-2">
                      <select value={editingBadge.category} onChange={e => setEditingBadge(p => p ? { ...p, category: e.target.value } : p)}
                        className="flex-1 h-7 text-xs bg-slate-900 border border-slate-600 rounded px-2 text-slate-200">
                        {['achievement','rank','event','special','general'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={editingBadge.rarity} onChange={e => setEditingBadge(p => p ? { ...p, rarity: Number(e.target.value) } : p)}
                        className="flex-1 h-7 text-xs bg-slate-900 border border-slate-600 rounded px-2 text-slate-200">
                        {RARITY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-300">
                        <input type="checkbox" checked={!!editingBadge.is_active} onChange={e => setEditingBadge(p => p ? { ...p, is_active: e.target.checked ? 1 : 0 } : p)} />
                        Aktiv
                      </label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingBadge(null)}>Abbrechen</Button>
                      <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700" onClick={updateBadge}>
                        <Save className="w-3 h-3 mr-1" /> Speichern
                      </Button>
                    </div>
                  </div>
                )}

                {/* Award panel: user search + their current badges */}
                <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Badge an User vergeben</div>
                  <div className="flex gap-2">
                    <Input value={badgeUserSearch} onChange={e => { setBadgeUserSearch(e.target.value); searchBadgeUsers(e.target.value); }}
                      placeholder="User suchen..." className="h-7 text-xs bg-slate-900 border-slate-600" />
                  </div>
                  {badgeSearchResults.length > 0 && !awardTargetUser && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {badgeSearchResults.map(u => (
                        <button key={u.id} onClick={() => { setAwardTargetUser(u); setBadgeSearchResults([]); loadUserBadges(u.id); }}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/60 hover:bg-slate-700/60 text-xs text-left">
                          <span className="font-medium text-slate-200">{u.nickname}</span>
                          <span className="text-slate-500">{u.municipality_name || '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {awardTargetUser && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200">{awardTargetUser.nickname}</span>
                        <button onClick={() => { setAwardTargetUser(null); setBadgeUserSearch(''); setAwardTargetBadges([]); }} className="text-slate-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Current user badges */}
                      {awardTargetBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {awardTargetBadges.map(ub => (
                            <div key={ub.badge_code} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${RARITY_COLORS[ub.rarity] || RARITY_COLORS[0]}`}>
                              {ub.image_url
                                ? <img src={ub.image_url} alt={ub.badge_code} className="w-4 h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                : <Award className="w-3 h-3" />
                              }
                              <span>{ub.name || ub.badge_code}</span>
                              <button onClick={() => revokeBadge(awardTargetUser.id, ub.badge_code)} className="ml-0.5 hover:text-red-400" title="Entziehen">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {awardTargetBadges.length === 0 && <p className="text-[10px] text-slate-500">Noch keine Badges</p>}
                      {selectedBadge && (
                        <Button size="sm" className="w-full h-7 text-xs bg-amber-600 hover:bg-amber-500"
                          onClick={() => awardBadge(awardTargetUser.id, selectedBadge.code)}>
                          <Award className="w-3 h-3 mr-1" /> „{selectedBadge.name || selectedBadge.code}" vergeben
                        </Button>
                      )}
                      {!selectedBadge && <p className="text-[10px] text-slate-500">← Badge aus der Liste auswählen</p>}
                    </div>
                  )}
                </div>

                {/* Badge grid */}
                <div className="grid grid-cols-4 gap-2">
                  {badges
                    .filter(b => badgeCategoryFilter === 'all' || b.category === badgeCategoryFilter)
                    .map(b => (
                      <div key={b.code}
                        onClick={() => setSelectedBadge(selectedBadge?.code === b.code ? null : b)}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border cursor-pointer transition-all ${
                          selectedBadge?.code === b.code
                            ? 'border-amber-500/60 bg-amber-500/10'
                            : `${RARITY_COLORS[b.rarity] || RARITY_COLORS[0]} hover:opacity-80`
                        } ${!b.is_active ? 'opacity-40' : ''}`}
                      >
                        {/* Badge image */}
                        <div className="w-10 h-10 flex items-center justify-center">
                          {b.image_url
                            ? <img src={b.image_url} alt={b.code} className="w-10 h-10 object-contain" onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <Award className="w-8 h-8 text-slate-500" />
                          }
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-medium leading-tight">{b.name || b.code}</div>
                          <div className="text-[9px] text-slate-500 font-mono">{b.code}</div>
                        </div>
                        {/* Edit/Delete */}
                        <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100">
                          <button onClick={e => { e.stopPropagation(); setEditingBadge({ ...b }); setShowNewBadgeForm(false); }}
                            className="p-0.5 text-slate-500 hover:text-blue-300 bg-slate-900/80 rounded">
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteBadge(b.code); }}
                            className="p-0.5 text-slate-500 hover:text-red-400 bg-slate-900/80 rounded">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                {badges.filter(b => badgeCategoryFilter === 'all' || b.category === badgeCategoryFilter).length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-sm">Keine Badges in dieser Kategorie</div>
                )}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
