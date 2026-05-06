'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MessageCircle, Send, Reply, Edit2, Trash2,
  Loader2, RefreshCw, AlertCircle, Crown, Shield, X, EyeOff,
  Globe, MapPin, Building2, VolumeX, Smile,
} from 'lucide-react';
import * as chatApi from '@/lib/api/chatApi';
import * as globalChatApi from '@/lib/api/globalChatApi';
import type { ChatMessage, ChatUser } from '@/lib/api/chatApi';
import type { GlobalChatMessage, GlobalChatUser } from '@/lib/api/globalChatApi';
import { deltaQueue } from '@/lib/deltaSync';

// ─── Typen ────────────────────────────────────────────────────
type ChatTab = 'municipality' | 'cantonal' | 'global';

type AnyMessage = (ChatMessage & { _scope: 'municipality' }) | (GlobalChatMessage & { _scope: 'cantonal' | 'global' });

const CHAT_MAX_MESSAGES = 10;
const CHAT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

// ─── Emoji Quick-Menü ─────────────────────────────────────────
const EMOJI_CATEGORY_EMOJIS = [
  ['😄','😂','🥰','😎','🤔','😅','😭','😤','🥳','😏','😬','🤩','😇','🥺','😮','😴','🤗','😡','🤯','🫡'],
  ['👍','👎','👏','🙏','🤝','✌️','💪','🫶','☝️','🤙','👌','🤞','🫠','🙌','👋','✋','🤜','🤛','🫸','🫷'],
  ['❤️','🔥','⭐','✅','❌','💬','💰','⚡','🏆','🎉','🎵','🎮','💎','🔑','🚀','💡','📢','⚠️','🔒','🎯'],
  ['🏙️','🏗️','🏠','🏢','🏦','🏛️','🏪','🏫','🏨','🏭','⛪','🕌','🌉','🌆','🌇','🌃','🌁','🏕️','🛖','🗼'],
  ['🌿','🌳','🌲','🌊','⛅','☀️','🌧️','❄️','🌈','🌸','🌺','🍀','🌾','🐦','🦋','🌍','🌙','⛰️','🌋','🏔️'],
  ['🚗','🚕','🚌','🚎','🚑','🚒','🏗️','🚂','✈️','🚢','🚁','🛵','🚲','🛺','🚛','🏎️','🚐','⛽','🛣️','🗺️'],
];
const EMOJI_CATEGORY_ICONS = ['😀','👋','❤️','🏙️','🌿','🚗'];

function EmojiPicker({ onSelect, onClose, mm }: { onSelect: (e: string) => void; onClose: () => void; mm: (k: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState(0);

  const categoryLabels = [
    UI_LABELS.emojiCatFaces,
    UI_LABELS.emojiCatGestures,
    UI_LABELS.emojiCatSymbols,
    UI_LABELS.emojiCatCity,
    UI_LABELS.emojiCatNature,
    UI_LABELS.emojiCatTraffic,
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 bg-[#0c1520] border border-amber-500/20 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ width: 320, animation: 'slideUp 0.18s ease-out' }}
    >
      {/* Kategorie-Tabs */}
      <div className="flex border-b border-slate-700/60 px-1 pt-1 gap-0.5 overflow-x-auto scrollbar-none">
        {EMOJI_CATEGORY_ICONS.map((icon, i) => (
          <button
            key={i}
            onClick={() => setActiveCategory(i)}
            title={categoryLabels[i]}
            className={`flex-shrink-0 px-2 py-1.5 text-[11px] font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeCategory === i
                ? 'bg-amber-500/15 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Emoji-Grid */}
      <div className="p-2">
        <p className="text-[10px] text-slate-600 mb-1.5 px-1">{categoryLabels[activeCategory]}</p>
        <div className="grid grid-cols-10 gap-0.5">
          {EMOJI_CATEGORY_EMOJIS[activeCategory].map((e) => (
            <button
              key={e}
              onClick={() => { onSelect(e); onClose(); }}
              className="text-xl w-[28px] h-[28px] flex items-center justify-center rounded-lg hover:bg-amber-500/20 transition-colors leading-none"
              title={e}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── i18n Labels ──────────────────────────────────────────────
const UI_LABELS = {
  roleOwner:        'Bürgermeister',
  roleAdmin:        'Verwaltung',
  roleCouncil:      'Gemeinderat',
  roleMod:          'Moderator',
  yesterday:        'Gestern',
  edited:           '(bearbeitet)',
  announcement:     '📢 Ankündigung',
  actionReply:      'Antworten',
  actionEdit:       'Bearbeiten',
  actionDelete:     'Löschen',
  actionMute:       'Stumm',
  confirmDelete:    'Nachricht wirklich löschen?',
  confirmMute:      'Benutzer für wie lange stumm schalten? (Stunden, 0 = permanent)',
  loadError:        'Nachrichten konnten nicht geladen werden',
  title:            'Chat',
  tabMunicipality:  'Gemeinde',
  tabCantonal:      'Kanton',
  tabGlobal:        'Global',
  messageCount:     'Nachrichten',
  unavailableTitle: 'Chat nicht verfügbar',
  unavailableGuest: 'Der Chat ist für Besucher nicht zugänglich.',
  loadingMessages:  'Nachrichten werden geladen...',
  errorTitle:       'Fehler',
  sendError:        'Nachricht konnte nicht gesendet werden',
  muteError:        'Stumm schalten fehlgeschlagen',
  retry:            'Erneut versuchen',
  noMessagesTitle:  'Noch keine Nachrichten',
  noMessagesHint:   'Schreibe die erste Nachricht und starte die Unterhaltung!',
  replyLabel:       'Antwort auf',
  editLabel:        'Nachricht bearbeiten',
  placeholder:      'Nachricht schreiben... (/pn Name Text für private Nachricht)',
  pnSent:           'PN gesendet an',
  pnUserNotFound:   'Benutzer nicht gefunden:',
  noCantonAccess:   'Du bist noch keiner Gemeinde beigetreten.',
  roleGlobalAdmin:  'Admin',
  muteSuccess:      'Benutzer stumm geschaltet',
  emojiCatFaces:    'Gesichter',
  emojiCatGestures: 'Gesten',
  emojiCatSymbols:  'Symbole',
  emojiCatCity:     'Stadt',
  emojiCatNature:   'Natur',
  emojiCatTraffic:  'Verkehr',
};

// ─── Avatar-Komponente ────────────────────────────────────────
function ChatAvatar({ user, size = 40 }: { user: ChatUser | GlobalChatUser; size?: number }) {
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const gradients = [
    'from-blue-500 to-cyan-400', 'from-purple-500 to-pink-400',
    'from-emerald-500 to-green-400', 'from-amber-500 to-yellow-400',
    'from-rose-500 to-red-400', 'from-indigo-500 to-violet-400',
    'from-teal-500 to-cyan-400', 'from-fuchsia-500 to-pink-400',
  ];
  const isOwner = (user as ChatUser).is_municipality_owner || (user as ChatUser).role === 'owner';
  const isAdmin = (user as ChatUser).role === 'admin';
  const isMod   = (user as GlobalChatUser).global_role === 'moderator';
  const isGlobalAdmin = (user as GlobalChatUser).global_role === 'administrator';

  let gradient = gradients[user.id % gradients.length];
  if (isOwner || isGlobalAdmin) gradient = 'from-amber-400 to-orange-500';
  else if (isAdmin || isMod)    gradient = 'from-blue-500 to-indigo-400';

  return (
    <div
      className={`bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white/10 flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// ─── Rollen-Badge ─────────────────────────────────────────────
function RoleBadge({ user, mm }: { user: ChatUser | GlobalChatUser; mm: (k: string) => string }) {
  const cu = user as ChatUser;
  const gu = user as GlobalChatUser;

  if (gu.global_role === 'administrator' || gu.global_role === 'moderator') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm">
          <Shield className="w-3 h-3" />{gu.global_role === 'administrator' ? UI_LABELS.roleGlobalAdmin : UI_LABELS.roleMod}
        </span>
        {gu.municipality_name && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/80 text-slate-300 shadow-sm">
            {gu.municipality_name}
          </span>
        )}
      </span>
    );
  }

  if (cu.is_municipality_owner || cu.role === 'owner') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow-sm">
        <Crown className="w-3 h-3" />{UI_LABELS.roleOwner}
      </span>
    );
  }

  if (cu.role === 'admin') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
        <Shield className="w-3 h-3" />{UI_LABELS.roleAdmin}
      </span>
    );
  }

  if (gu.municipality_name) {
    if (gu.municipality_role === 'owner') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 shadow-sm">
          <Crown className="w-3 h-3" />{UI_LABELS.roleOwner}&nbsp;·&nbsp;{gu.municipality_name}
        </span>
      );
    }
    if (gu.municipality_role === 'council') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-sm">
          <Shield className="w-3 h-3" />{UI_LABELS.roleCouncil}&nbsp;·&nbsp;{gu.municipality_name}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/80 text-slate-300 shadow-sm">
        {gu.municipality_name}
      </span>
    );
  }

  return null;
}

// ─── Datum formatieren ────────────────────────────────────────
function formatDate(dateString: string, yesterdayLabel: string): string {
  const date = new Date(dateString);
  const now  = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === yest.toDateString())
    return `${yesterdayLabel} ${date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Nachrichten deduplizieren ────────────────────────────────
function mergeMessages<T extends { id: number; edited_at?: string | null; created_at: string; is_edited: boolean }>(
  prev: T[], incoming: T[], mode: 'replace' | 'append'
): T[] {
  const source = mode === 'replace' ? incoming : [...prev, ...incoming];
  const byId = new Map<number, T>();
  for (const m of source) {
    if (!m || typeof m.id !== 'number') continue;
    const existing = byId.get(m.id);
    if (!existing) { byId.set(m.id, m); continue; }
    const prevTs = new Date(existing.edited_at || existing.created_at).getTime();
    const nextTs = new Date(m.edited_at || m.created_at).getTime();
    if (nextTs >= prevTs || (m.is_edited && !existing.is_edited)) byId.set(m.id, { ...existing, ...m });
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

function trimMessages<T extends { id: number; created_at: string }>(items: T[]): T[] {
  const minTs = Date.now() - CHAT_MAX_AGE_MS;
  const filtered = items.filter(m => new Date(m.created_at).getTime() >= minTs);
  if (filtered.length <= CHAT_MAX_MESSAGES) return filtered;
  return filtered.slice(filtered.length - CHAT_MAX_MESSAGES);
}

// ─── Einzelne Nachricht ───────────────────────────────────────
function MessageItem({
  message, user, replyTo, currentUserId, canModerate, canMute,
  onReply, onEdit, onDelete, onMute, mm, yesterdayLabel, isOwnMsg,
}: {
  message: { id: number; message: string; type: string; is_edited: boolean; edited_at?: string | null; created_at: string };
  user: ChatUser | GlobalChatUser;
  replyTo?: { id: number; message: string } | null;
  currentUserId?: number;
  canModerate: boolean;
  canMute: boolean;
  isOwnMsg: boolean;
  onReply: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onMute: () => void;
  mm: (k: string) => string;
  yesterdayLabel: string;
}) {
  const isSystem       = message.type === 'system';
  const isAnnouncement = message.type === 'announcement';

  if (isSystem) {
    return (
      <div className="flex justify-center my-3" style={{ animation: 'msgIn 0.2s ease-out' }}>
        <div className="bg-slate-800/60 border border-slate-700/50 px-4 py-1.5 rounded-full text-xs text-slate-400">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex gap-3 py-2.5 px-3 rounded-xl transition-colors duration-150
        ${isAnnouncement
          ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20'
          : isOwnMsg
            ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
            : 'hover:bg-slate-800/50'
        }
      `}
      style={{ animation: 'msgIn 0.2s ease-out' }}
    >
      <ChatAvatar user={user} size={38} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5 mb-1">
          <span className={`font-semibold text-sm ${isOwnMsg ? 'text-emerald-300' : 'text-slate-200'}`}>
            {user.name}
          </span>
          <RoleBadge user={user} mm={mm} />
          {isAnnouncement && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900">
              {UI_LABELS.announcement}
            </span>
          )}
          <span className="text-[11px] text-slate-500 ml-auto">
            {formatDate(message.created_at, yesterdayLabel)}
          </span>
          {message.is_edited && (
            <span className="text-[10px] text-slate-600 italic">{UI_LABELS.edited}</span>
          )}
        </div>

        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-lg mt-1 mb-2 border-l-2 border-amber-500/50">
            <Reply className="w-3 h-3 flex-shrink-0 text-amber-500/70" />
            <span className="truncate">{replyTo.message}</span>
          </div>
        )}

        <p className="text-sm text-slate-300 break-words whitespace-pre-wrap leading-relaxed">
          {message.message}
        </p>
      </div>

      {/* Aktions-Menü */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center gap-0.5 bg-slate-800 border border-slate-700/80 shadow-xl rounded-lg p-0.5">
        <button onClick={onReply} className="p-1.5 hover:bg-amber-500/20 rounded-md transition-colors" title={UI_LABELS.actionReply}>
          <Reply className="w-3.5 h-3.5 text-amber-400" />
        </button>
        {isOwnMsg && onEdit && (
          <button onClick={onEdit} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors" title={UI_LABELS.actionEdit}>
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
        {(isOwnMsg || canModerate) && (
          <button onClick={onDelete} className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors" title={UI_LABELS.actionDelete}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
        {canMute && !isOwnMsg && (
          <button onClick={onMute} className="p-1.5 hover:bg-orange-500/20 rounded-md transition-colors" title={UI_LABELS.actionMute}>
            <VolumeX className="w-3.5 h-3.5 text-orange-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tab-Button ───────────────────────────────────────────────
function TabButton({ active, onClick, icon, label, unread }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; unread?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
        active
          ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/20'
          : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
      {!!unread && unread > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// ChatPanel
// ═══════════════════════════════════════════════════════════════
export function ChatPanel() {
  const { state, setActivePanel, municipalitySlug, addNotification, municipalityRole } = useGame();
  const multiplayer = useMultiplayerOptional();
  const isGuestMode = multiplayer?.isViewOnly ?? false;
  const isOpen = state.activePanel === 'chat';
  const mm = (s: string) => s;

  // ── State ────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<ChatTab>('municipality');
  const [cantonCode, setCantonCode]   = useState<string | null>(null);
  const [cantonName, setCantonName]   = useState<string | null>(null);

  const [muniMessages,    setMuniMessages]    = useState<ChatMessage[]>([]);
  const [cantonMessages,  setCantonMessages]  = useState<GlobalChatMessage[]>([]);
  const [globalMessages,  setGlobalMessages]  = useState<GlobalChatMessage[]>([]);

  const [isLoading, setIsLoading]   = useState(true);
  const [isSending, setIsSending]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo]       = useState<{ id: number; message: string } | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji]   = useState(false);

  const [unreadCanton, setUnreadCanton]   = useState(0);
  const [unreadGlobal, setUnreadGlobal]   = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const pollRef        = useRef<NodeJS.Timeout | null>(null);
  const cantonPollRef  = useRef<NodeJS.Timeout | null>(null);
  const globalPollRef  = useRef<NodeJS.Timeout | null>(null);
  const lastCantonIdRef  = useRef<number>(0);
  const lastGlobalIdRef  = useRef<number>(0);

  const currentUserId   = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id')) || undefined : undefined;
  const currentUserName = typeof window !== 'undefined' ? localStorage.getItem('isocity_user_name') || undefined : undefined;
  const isOwner         = municipalityRole === 'owner';
  const isAdmin         = municipalityRole === 'owner' || municipalityRole === 'council';

  const globalRole = typeof window !== 'undefined' ? localStorage.getItem('isocity_global_role') || 'user' : 'user';
  const isMod      = globalRole === 'moderator' || globalRole === 'administrator';

  // ── Gemeinde-Chat laden ──────────────────────────────────────
  const loadMuniMessages = useCallback(async (afterId?: number) => {
    if (!municipalitySlug) return;
    try {
      const res = await chatApi.getChatMessages(municipalitySlug, { limit: CHAT_MAX_MESSAGES, after: afterId });
      if (res.success) {
        if (!afterId && res.data.municipality?.canton_code) {
          setCantonCode(res.data.municipality.canton_code);
          setCantonName(res.data.municipality.canton_name || res.data.municipality.canton_code);
        }
        setMuniMessages(prev =>
          trimMessages(mergeMessages(prev, res.data.messages, afterId ? 'append' : 'replace'))
        );
        setError(null);
      }
    } catch (e) {
      if (!afterId) setError(UI_LABELS.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [municipalitySlug]);

  // ── Kantonal-Chat laden ──────────────────────────────────────
  const loadCantonMessages = useCallback(async (afterId?: number) => {
    if (!cantonCode) return;
    try {
      const res = await globalChatApi.getCantonalMessages(cantonCode, { limit: CHAT_MAX_MESSAGES, after: afterId });
      if (res.success) {
        setCantonMessages(prev =>
          trimMessages(mergeMessages(prev, res.data.messages, afterId ? 'append' : 'replace'))
        );
      }
    } catch {}
  }, [cantonCode]);

  // ── Global-Chat laden ────────────────────────────────────────
  const loadGlobalMessages = useCallback(async (afterId?: number) => {
    try {
      const res = await globalChatApi.getGlobalMessages({ limit: CHAT_MAX_MESSAGES, after: afterId });
      if (res.success) {
        setGlobalMessages(prev =>
          trimMessages(mergeMessages(prev, res.data.messages, afterId ? 'append' : 'replace'))
        );
      }
    } catch {}
  }, []);

  // ── Initial laden wenn Panel öffnet ─────────────────────────
  useEffect(() => {
    if (!isOpen || isGuestMode) { setIsLoading(false); return; }
    setIsLoading(true);
    loadMuniMessages();
    loadGlobalMessages();
  }, [isOpen, municipalitySlug, isGuestMode]);

  useEffect(() => {
    if (!isOpen || isGuestMode || !cantonCode) return;
    loadCantonMessages();
  }, [isOpen, cantonCode, isGuestMode]);

  // ── Polling: Gemeinde ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || isGuestMode || !municipalitySlug) return;
    if (activeTab !== 'municipality') return;
    pollRef.current = setInterval(() => {
      const lastId = muniMessages.length > 0 ? muniMessages[muniMessages.length - 1].id : undefined;
      loadMuniMessages(lastId);
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isOpen, municipalitySlug, muniMessages.length, activeTab, isGuestMode]);

  // ── Hintergrund-Polling: Kanton ───────────────────────────────
  useEffect(() => {
    if (!cantonCode || isGuestMode) return;
    const check = async () => {
      try {
        const res = await globalChatApi.getCantonalMessages(cantonCode, {
          limit: 5, after: lastCantonIdRef.current || undefined,
        });
        if (res.success && res.data.messages.length > 0) {
          const maxId = Math.max(...res.data.messages.map(m => m.id));
          if (lastCantonIdRef.current === 0) {
            lastCantonIdRef.current = maxId;
          } else if (maxId > lastCantonIdRef.current && activeTab !== 'cantonal') {
            const newCount = res.data.messages.filter(m => m.id > lastCantonIdRef.current && m.user.id !== currentUserId).length;
            if (newCount > 0) setUnreadCanton(p => p + newCount);
            lastCantonIdRef.current = maxId;
          }
        }
      } catch {}
    };
    check();
    cantonPollRef.current = setInterval(check, 15000);
    return () => { if (cantonPollRef.current) clearInterval(cantonPollRef.current); };
  }, [cantonCode, isGuestMode, currentUserId]);

  // ── Hintergrund-Polling: Global ───────────────────────────────
  useEffect(() => {
    if (isGuestMode) return;
    const check = async () => {
      try {
        const res = await globalChatApi.getGlobalMessages({
          limit: 5, after: lastGlobalIdRef.current || undefined,
        });
        if (res.success && res.data.messages.length > 0) {
          const maxId = Math.max(...res.data.messages.map(m => m.id));
          if (lastGlobalIdRef.current === 0) {
            lastGlobalIdRef.current = maxId;
          } else if (maxId > lastGlobalIdRef.current && activeTab !== 'global') {
            const newCount = res.data.messages.filter(m => m.id > lastGlobalIdRef.current && m.user.id !== currentUserId).length;
            if (newCount > 0) setUnreadGlobal(p => p + newCount);
            lastGlobalIdRef.current = maxId;
          }
        }
      } catch {}
    };
    check();
    globalPollRef.current = setInterval(check, 15000);
    return () => { if (globalPollRef.current) clearInterval(globalPollRef.current); };
  }, [isGuestMode, currentUserId]);

  // ── Socket.IO Echtzeit-Events ────────────────────────────────
  useEffect(() => {
    const onGlobal = (e: Event) => {
      const data = (e as CustomEvent).detail as { type: string; message?: GlobalChatMessage; message_id?: number };
      if (data.type === 'created' && data.message) {
        setGlobalMessages(prev => trimMessages(mergeMessages(prev, [data.message!], 'append')));
        if (activeTab !== 'global' && data.message.user.id !== currentUserId) setUnreadGlobal(p => p + 1);
      } else if (data.type === 'deleted' && data.message_id) {
        setGlobalMessages(prev => prev.filter(m => m.id !== data.message_id));
      }
    };
    const onCantonal = (e: Event) => {
      const data = (e as CustomEvent).detail as { type: string; canton_code?: string; message?: GlobalChatMessage; message_id?: number };
      if (data.canton_code?.toUpperCase() !== cantonCode?.toUpperCase()) return;
      if (data.type === 'created' && data.message) {
        setCantonMessages(prev => trimMessages(mergeMessages(prev, [data.message!], 'append')));
        if (activeTab !== 'cantonal' && data.message.user.id !== currentUserId) setUnreadCanton(p => p + 1);
      } else if (data.type === 'deleted' && data.message_id) {
        setCantonMessages(prev => prev.filter(m => m.id !== data.message_id));
      }
    };
    window.addEventListener('global-chat-message',   onGlobal);
    window.addEventListener('cantonal-chat-message', onCantonal);
    return () => {
      window.removeEventListener('global-chat-message',   onGlobal);
      window.removeEventListener('cantonal-chat-message', onCantonal);
    };
  }, [activeTab, cantonCode, currentUserId]);

  // ── Tab wechseln ─────────────────────────────────────────────
  const switchTab = (tab: ChatTab) => {
    setActiveTab(tab);
    setReplyTo(null);
    setEditingMsg(null);
    setInputValue('');
    setShowEmoji(false);
    if (tab === 'cantonal') { setUnreadCanton(0); loadCantonMessages(); }
    if (tab === 'global')   { setUnreadGlobal(0); loadGlobalMessages(); }
  };

  // ── Auto-scroll ──────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [muniMessages, cantonMessages, globalMessages, activeTab]);

  // ── /pn Befehl verarbeiten ───────────────────────────────────
  const handlePnCommand = useCallback(async (rawInput: string): Promise<boolean> => {
    const pnMatch = rawInput.match(/^\/pn\s+(\S+)\s+(.+)$/i);
    if (!pnMatch) return false;
    const targetName = pnMatch[1];
    const pnText     = pnMatch[2].trim();
    if (!pnText) return false;

    setInputValue('');
    const timeoutBox = { id: null as ReturnType<typeof setTimeout> | null };

    const handler = (e: Event) => {
      if (timeoutBox.id !== null) clearTimeout(timeoutBox.id);
      const results: Array<{ id: number; name: string }> =
        (e as CustomEvent).detail?.results || (e as CustomEvent).detail || [];
      const match = results.find(u => u.name.toLowerCase() === targetName.toLowerCase()) || results[0];
      if (!match) {
        addNotification(UI_LABELS.errorTitle, `${UI_LABELS.pnUserNotFound} ${targetName}`, 'default');
        return;
      }
      deltaQueue.messengerStartChat(match.id);
      const chatHandler = (ce: Event) => {
        const cd = (ce as CustomEvent).detail;
        if (!cd?.conversationId) return;
        window.removeEventListener('messenger-chat-opened', chatHandler);
        deltaQueue.messengerSend(cd.conversationId, pnText);
        addNotification('✓', `${UI_LABELS.pnSent} ${match.name}`, 'default');
        window.dispatchEvent(new CustomEvent('open-messenger'));
      };
      window.addEventListener('messenger-chat-opened', chatHandler);
      setTimeout(() => window.removeEventListener('messenger-chat-opened', chatHandler), 5000);
    };

    window.addEventListener('messenger-search-results', handler, { once: true });
    timeoutBox.id = setTimeout(() => {
      window.removeEventListener('messenger-search-results', handler);
      addNotification(UI_LABELS.errorTitle, `${UI_LABELS.pnUserNotFound} ${targetName}`, 'default');
    }, 5000);

    deltaQueue.messengerSearch(targetName);
    return true;
  }, [addNotification, setActivePanel, mm]);

  // ── Nachricht senden ─────────────────────────────────────────
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isSending) return;

    if (text.startsWith('/pn ')) {
      await handlePnCommand(text);
      return;
    }

    setIsSending(true);
    try {
      if (activeTab === 'municipality') {
        if (!municipalitySlug) return;
        if (editingMsg) {
          await chatApi.editChatMessage(municipalitySlug, editingMsg.id, text);
          setMuniMessages(prev => prev.map(m =>
            m.id === editingMsg.id ? { ...m, message: text, is_edited: true, edited_at: new Date().toISOString() } : m
          ));
          setEditingMsg(null);
        } else {
          const res = await chatApi.sendChatMessage(municipalitySlug, text, replyTo?.id);
          if (res.success) {
            setMuniMessages(prev => trimMessages(mergeMessages(prev, [res.data.message], 'append')));
            window.dispatchEvent(new CustomEvent('chat-own-message-sent', {
              detail: { messageId: res.data.message.id, userId: res.data.message.user.id },
            }));
            window.dispatchEvent(new CustomEvent('avatar-chat-message', {
              detail: { text, userName: res.data.message.user.name || currentUserName },
            }));
          }
        }
      } else if (activeTab === 'cantonal' && cantonCode) {
        const res = await globalChatApi.sendCantonalMessage(cantonCode, text, replyTo?.id);
        if (res.success) setCantonMessages(prev => trimMessages(mergeMessages(prev, [res.data.message], 'append')));
      } else if (activeTab === 'global') {
        const res = await globalChatApi.sendGlobalMessage(text, replyTo?.id);
        if (res.success) setGlobalMessages(prev => trimMessages(mergeMessages(prev, [res.data.message], 'append')));
      }
      setInputValue('');
      setReplyTo(null);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '';
      addNotification(UI_LABELS.errorTitle, errMsg || UI_LABELS.sendError, 'default');
    } finally {
      setIsSending(false);
    }
  };

  // ── Nachricht löschen ────────────────────────────────────────
  const handleDelete = async (msgId: number) => {
    if (!confirm(UI_LABELS.confirmDelete)) return;
    try {
      if (activeTab === 'municipality' && municipalitySlug) {
        await chatApi.deleteChatMessage(municipalitySlug, msgId);
        setMuniMessages(prev => prev.filter(m => m.id !== msgId));
      } else if (activeTab === 'cantonal' && cantonCode) {
        await globalChatApi.deleteCantonalMessage(cantonCode, msgId);
        setCantonMessages(prev => prev.filter(m => m.id !== msgId));
      } else if (activeTab === 'global') {
        await globalChatApi.deleteGlobalMessage(msgId);
        setGlobalMessages(prev => prev.filter(m => m.id !== msgId));
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '';
      addNotification(UI_LABELS.errorTitle, errMsg || UI_LABELS.sendError, 'default');
    }
  };

  // ── User muten ───────────────────────────────────────────────
  const handleMute = async (userId: number) => {
    const input = window.prompt(UI_LABELS.confirmMute, '24');
    if (input === null) return;
    const hours = Number(input);
    const scope: 'global' | 'cantonal' = activeTab === 'global' ? 'global' : 'cantonal';
    try {
      await globalChatApi.muteUser({
        user_id: userId, scope,
        canton_code: scope === 'cantonal' ? cantonCode || undefined : undefined,
        duration_hours: isNaN(hours) || hours <= 0 ? null : hours,
      });
      addNotification('✓', `${UI_LABELS.muteSuccess} (#${userId})`, 'default');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '';
      addNotification(UI_LABELS.errorTitle, errMsg || UI_LABELS.muteError, 'default');
    }
  };

  const handleCancel = () => {
    setReplyTo(null);
    setEditingMsg(null);
    setInputValue('');
  };

  const yesterdayLabel = UI_LABELS.yesterday;

  const activeMessages: Array<ChatMessage | GlobalChatMessage> =
    activeTab === 'municipality' ? muniMessages :
    activeTab === 'cantonal'    ? cantonMessages :
    globalMessages;

  const canSendInCurrentTab =
    (activeTab === 'municipality' && !!municipalitySlug) ||
    (activeTab === 'cantonal'    && !!cantonCode) ||
    activeTab === 'global';

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Animations */}
      <style>{`
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setActivePanel('none')}>
        <DialogContent className="sm:max-w-[520px] h-[100dvh] sm:h-[680px] max-h-[100dvh] sm:max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border sm:border-slate-700/60"
          style={{ background: 'linear-gradient(180deg, #0d1520 0%, #0a1118 100%)' }}
        >
          {/* Header */}
          <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-slate-700/50"
            style={{ background: 'rgba(15,25,40,0.95)' }}
          >
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <MessageCircle className="w-4 h-4 text-slate-900" />
              </div>
              <span className="text-white font-bold tracking-tight text-lg">{UI_LABELS.title}</span>
            </DialogTitle>

            {/* Tab-Leiste */}
            <div className="flex items-center gap-1 mt-2.5">
              <TabButton
                active={activeTab === 'municipality'}
                onClick={() => switchTab('municipality')}
                icon={<Building2 className="w-3.5 h-3.5" />}
                label={UI_LABELS.tabMunicipality}
              />
              <TabButton
                active={activeTab === 'cantonal'}
                onClick={() => switchTab('cantonal')}
                icon={<MapPin className="w-3.5 h-3.5" />}
                label={cantonName ? `${cantonName}` : UI_LABELS.tabCantonal}
                unread={unreadCanton}
              />
              <TabButton
                active={activeTab === 'global'}
                onClick={() => switchTab('global')}
                icon={<Globe className="w-3.5 h-3.5" />}
                label={UI_LABELS.tabGlobal}
                unread={unreadGlobal}
              />
              <span className="ml-auto text-[11px] text-slate-500 bg-slate-800/60 border border-slate-700/40 px-2 py-1 rounded-lg">
                {activeMessages.length} {UI_LABELS.messageCount}
              </span>
            </div>
          </DialogHeader>

          {/* Nachrichten-Bereich */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
            {isGuestMode ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="p-5 bg-slate-800/60 rounded-2xl mb-4 border border-slate-700/40">
                  <EyeOff className="w-12 h-12 text-slate-500" />
                </div>
                <p className="font-semibold text-slate-300 mb-1">{UI_LABELS.unavailableTitle}</p>
                <p className="text-sm text-slate-500">{UI_LABELS.unavailableGuest}</p>
              </div>
            ) : activeTab === 'municipality' && isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                <p className="text-sm text-slate-500">{UI_LABELS.loadingMessages}</p>
              </div>
            ) : activeTab === 'municipality' && error ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
                <p className="text-slate-400 mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => loadMuniMessages()}
                  className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-700">
                  <RefreshCw className="w-4 h-4" />{UI_LABELS.retry}
                </Button>
              </div>
            ) : activeTab === 'cantonal' && !cantonCode ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <MapPin className="w-10 h-10 text-slate-600 mb-4" />
                <p className="text-sm text-slate-500">{UI_LABELS.noCantonAccess}</p>
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="p-5 bg-gradient-to-br from-amber-500/10 to-emerald-500/5 rounded-2xl mb-4 border border-amber-500/10">
                  <MessageCircle className="w-12 h-12 text-amber-400/60" />
                </div>
                <p className="font-semibold text-slate-300 mb-1">{UI_LABELS.noMessagesTitle}</p>
                <p className="text-sm text-slate-500">{UI_LABELS.noMessagesHint}</p>
              </div>
            ) : (
              <>
                {activeMessages.map((message) => {
                  const mu = message as ChatMessage;
                  const gu = message as GlobalChatMessage;
                  const user: ChatUser | GlobalChatUser = mu.user || gu.user;
                  const isOwnMsg = user.id === currentUserId;
                  const canMod   = activeTab === 'municipality' ? isOwner : isMod;
                  const canMuteUser = (activeTab === 'cantonal' || activeTab === 'global') &&
                    (isMod || (activeTab === 'cantonal' && isAdmin));

                  return (
                    <MessageItem
                      key={message.id}
                      message={message}
                      user={user}
                      replyTo={activeTab === 'municipality' ? mu.reply_to : gu.reply_to}
                      currentUserId={currentUserId}
                      isOwnMsg={isOwnMsg}
                      canModerate={canMod}
                      canMute={canMuteUser}
                      onReply={() => setReplyTo({ id: message.id, message: message.message })}
                      onEdit={activeTab === 'municipality' ? () => {
                        setEditingMsg(mu);
                        setInputValue(mu.message);
                        setReplyTo(null);
                        inputRef.current?.focus();
                      } : undefined}
                      onDelete={() => handleDelete(message.id)}
                      onMute={() => handleMute(user.id)}
                      mm={mm}
                      yesterdayLabel={yesterdayLabel}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Reply/Edit-Anzeige */}
          {!isGuestMode && (replyTo || editingMsg) && (
            <div className="mx-3 mb-2 px-3 py-2 rounded-xl flex items-center gap-2.5 border border-amber-500/20 bg-amber-500/5">
              <div className={`p-1.5 rounded-lg ${editingMsg ? 'bg-blue-500/20' : 'bg-amber-500/10'}`}>
                {editingMsg
                  ? <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  : <Reply className="w-3.5 h-3.5 text-amber-400" />
                }
              </div>
              <div className="flex-1 min-w-0 text-xs">
                {replyTo && (
                  <>
                    <span className="text-slate-500">{UI_LABELS.replyLabel} </span>
                    <p className="text-slate-400 truncate">{replyTo.message}</p>
                  </>
                )}
                {editingMsg && <span className="text-blue-400 font-medium">{UI_LABELS.editLabel}</span>}
              </div>
              <button onClick={handleCancel} className="p-1.5 hover:bg-slate-700/60 rounded-lg transition-colors text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Eingabe-Bereich */}
          {!isGuestMode && canSendInCurrentTab && (
            <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-slate-700/50"
              style={{ background: 'rgba(13,21,32,0.98)' }}
            >
              <div className="flex gap-2 items-center">
                {/* Emoji-Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmoji(v => !v)}
                    className={`p-2 rounded-lg transition-colors ${
                      showEmoji
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-slate-500 hover:text-amber-400 hover:bg-slate-700/60'
                    }`}
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmoji && (
                    <EmojiPicker
                      onSelect={(e) => {
                        setInputValue(v => v + e);
                        inputRef.current?.focus();
                      }}
                      onClose={() => setShowEmoji(false)}
                      mm={mm}
                    />
                  )}
                </div>

                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={UI_LABELS.placeholder}
                  className="flex-1 bg-slate-800/80 border-slate-700/60 text-slate-200 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/40 rounded-xl text-sm"
                  disabled={isSending}
                />

                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  size="icon"
                  className={`rounded-xl transition-all duration-200 ${
                    inputValue.trim()
                      ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/20 hover:bg-amber-400'
                      : 'bg-slate-800 text-slate-600 border border-slate-700/60'
                  }`}
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
