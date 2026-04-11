'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CircleDashed, User, Star, Building2, Calendar, Pencil, Check, X } from 'lucide-react';
import { getAuthToken } from '@/lib/api/coreApi';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) { headers['Authorization'] = `Bearer ${token}`; headers['X-Game-Token'] = token; }
  return headers;
}

interface ProfileBadge {
  badge_code: string;
  name: string;
  description: string;
  image_url: string;
  rarity: number;
  category: string;
}

interface ProfileCompany {
  name: string;
  level: number;
  reputation: number;
  emoji: string;
  type_name: string;
  role: string;
}

interface PlayerProfile {
  id: number;
  nickname: string;
  motto: string;
  municipality_name: string | null;
  municipality_slug: string | null;
  xp: number;
  level: number;
  created_at: string;
  badges: ProfileBadge[];
  companies: ProfileCompany[];
}

interface PlayerProfilePanelProps {
  userId: number | 'me';
  onClose: () => void;
}

export function PlayerProfilePanel({ userId, onClose }: PlayerProfilePanelProps) {
  const [profile, setProfile]       = useState<PlayerProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [editingMotto, setEditingMotto] = useState(false);
  const [mottoInput, setMottoInput] = useState('');
  const [mottoSaving, setMottoSaving] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(userId === 'me');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Profil laden
        const res  = await fetch(`${AUTH_API_BASE_URL}/api/users/${userId}/profile`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Fehler');
        setProfile(json.data);
        setMottoInput(json.data.motto || '');
        // Prüfen ob eigenes Profil (bei numerischer ID)
        if (userId !== 'me') {
          try {
            const meRes  = await fetch(`${AUTH_API_BASE_URL}/api/users/me/profile`, { headers: getAuthHeaders() });
            const meJson = await meRes.json();
            if (meJson.ok && meJson.data.id === json.data.id) setIsOwnProfile(true);
          } catch {}
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Fehler');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (editingMotto) inputRef.current?.focus();
  }, [editingMotto]);

  const saveMotto = async () => {
    if (!profile) return;
    setMottoSaving(true);
    try {
      const res  = await fetch(`${AUTH_API_BASE_URL}/api/users/me/motto`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ motto: mottoInput }),
      });
      const json = await res.json();
      if (json.ok) {
        setProfile(p => p ? { ...p, motto: json.motto || '' } : p);
        setEditingMotto(false);
      }
    } finally {
      setMottoSaving(false);
    }
  };

  const cancelMotto = () => {
    setMottoInput(profile?.motto || '');
    setEditingMotto(false);
  };

  const rarityColor = (rarity: number) => {
    if (rarity >= 4) return 'text-amber-400 border-amber-400/30';
    if (rarity >= 3) return 'text-purple-400 border-purple-400/30';
    if (rarity >= 2) return 'text-blue-400 border-blue-400/30';
    if (rarity >= 1) return 'text-emerald-400 border-emerald-400/30';
    return 'text-slate-400 border-slate-400/30';
  };

  const rarityLabel = (rarity: number) => {
    if (rarity >= 4) return 'Legendaer';
    if (rarity >= 3) return 'Episch';
    if (rarity >= 2) return 'Selten';
    if (rarity >= 1) return 'Ungewoehnlich';
    return 'Normal';
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm bg-slate-900/95 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Spielerprofil
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <CircleDashed className="w-8 h-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>
        ) : profile ? (
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pr-2">

              {/* ── Profil-Header ── */}
              <div className="text-center space-y-1.5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mx-auto flex items-center justify-center text-2xl font-bold">
                  {profile.nickname.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-lg font-semibold text-white">{profile.nickname}</h3>

                {/* Gemeinde — prominent */}
                {profile.municipality_name && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium">
                    <Building2 className="w-3 h-3" />
                    {profile.municipality_name}
                  </div>
                )}

                {/* Level + XP */}
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="text-amber-400 font-bold">Lv. {profile.level}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">{profile.xp.toLocaleString()} XP</span>
                </div>

                {/* ── Motto ── */}
                <div className="mt-1 min-h-[28px]">
                  {editingMotto ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={inputRef}
                        value={mottoInput}
                        onChange={e => setMottoInput(e.target.value.slice(0, 128))}
                        onKeyDown={e => { if (e.key === 'Enter') saveMotto(); if (e.key === 'Escape') cancelMotto(); }}
                        maxLength={128}
                        placeholder="Dein Motto..."
                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button onClick={saveMotto} disabled={mottoSaving} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelMotto} className="p-1 text-slate-400 hover:text-slate-300">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <p className={`text-sm italic ${profile.motto ? 'text-slate-300' : 'text-slate-500'}`}>
                        {profile.motto || (isOwnProfile ? 'Kein Motto gesetzt...' : '')}
                      </p>
                      {isOwnProfile && (
                        <button
                          onClick={() => setEditingMotto(true)}
                          className="p-0.5 text-slate-500 hover:text-slate-300"
                          title="Motto bearbeiten"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Dabei seit {new Date(profile.created_at).toLocaleDateString('de-CH')}
                </div>
              </div>

              {/* ── Badges ── */}
              {profile.badges.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    Badges ({profile.badges.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {profile.badges.map(b => (
                      <div key={b.badge_code} className={`p-2 rounded-lg border bg-slate-800/50 ${rarityColor(b.rarity)}`}>
                        <div className="flex items-center gap-2">
                          {b.image_url ? (
                            <img src={b.image_url} alt={b.name} className="w-6 h-6 object-contain" />
                          ) : (
                            <Star className="w-5 h-5" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{b.name}</div>
                            <div className="text-[10px] text-slate-500">{rarityLabel(b.rarity)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Firmen ── */}
              {profile.companies.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Firmen</h4>
                  {profile.companies.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800/30 mb-1">
                      <span>{c.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.type_name} · {c.role}</div>
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        Lv. {c.level} · Rep. {c.reputation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
