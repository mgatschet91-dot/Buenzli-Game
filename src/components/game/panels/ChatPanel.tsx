'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, Send, Reply, Edit2, Trash2,
  Loader2, RefreshCw, AlertCircle, Crown, Shield, X, EyeOff
} from 'lucide-react';
import * as chatApi from '@/lib/api/chatApi';
import type { ChatMessage, ChatUser } from '@/lib/api/chatApi';

const CHAT_MAX_MESSAGES = 10;
const CHAT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

// Rollen-Badge Komponente
function RoleBadge({ role, isOwner }: { role?: string; isOwner?: boolean }) {
  if (isOwner || role === 'owner') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
        <Crown className="w-3 h-3" />
        Eigentümer
      </span>
    );
  }
  
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
        <Shield className="w-3 h-3" />
        Verwaltung
      </span>
    );
  }
  
  return null;
}

// Avatar-Komponente mit Gradient
function ChatAvatar({ user, size = 40 }: { user: ChatUser; size?: number }) {
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Schönere Gradient-Farben basierend auf User-ID
  const gradients = [
    'from-blue-500 to-cyan-400',
    'from-purple-500 to-pink-400',
    'from-green-500 to-emerald-400',
    'from-orange-500 to-amber-400',
    'from-rose-500 to-red-400',
    'from-indigo-500 to-violet-400',
    'from-teal-500 to-cyan-400',
    'from-fuchsia-500 to-pink-400',
  ];
  const gradientIndex = user.id % gradients.length;
  
  // Spezielle Farben für Owner/Admin
  const isOwner = user.is_municipality_owner || user.role === 'owner';
  const isAdmin = user.role === 'admin';
  
  let gradient = gradients[gradientIndex];
  if (isOwner) gradient = 'from-amber-500 to-orange-400';
  if (isAdmin) gradient = 'from-blue-500 to-indigo-400';

  return (
    <div 
      className={`bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white/20`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// Datum formatieren
function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return `Gestern ${date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function mergeUniqueMessages(
  previous: ChatMessage[],
  incoming: ChatMessage[],
  mode: 'replace' | 'append'
): ChatMessage[] {
  const source = mode === 'replace' ? incoming : [...previous, ...incoming];
  const byId = new Map<number, ChatMessage>();

  for (const msg of source) {
    if (!msg || typeof msg.id !== 'number') continue;
    const prev = byId.get(msg.id);
    if (!prev) {
      byId.set(msg.id, msg);
      continue;
    }

    const prevTs = new Date(prev.edited_at || prev.created_at).getTime();
    const nextTs = new Date(msg.edited_at || msg.created_at).getTime();
    const shouldReplace = nextTs >= prevTs || (!!msg.is_edited && !prev.is_edited);
    if (shouldReplace) {
      byId.set(msg.id, { ...prev, ...msg });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

function keepLatestMessagesWithinWindow(items: ChatMessage[]): ChatMessage[] {
  const minTimestamp = Date.now() - CHAT_MAX_AGE_MS;
  const filtered = items.filter((msg) => {
    const createdTs = new Date(msg.created_at).getTime();
    return Number.isFinite(createdTs) && createdTs >= minTimestamp;
  });
  if (filtered.length <= CHAT_MAX_MESSAGES) return filtered;
  return filtered.slice(filtered.length - CHAT_MAX_MESSAGES);
}

// Einzelne Nachricht
function MessageItem({ 
  message, 
  currentUserId,
  isOwner,
  onReply,
  onEdit,
  onDelete 
}: { 
  message: ChatMessage;
  currentUserId?: number;
  isOwner: boolean;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
}) {
  const isOwnMessage = currentUserId === message.user.id;
  const canEdit = isOwnMessage;
  const canDelete = isOwnMessage || isOwner;
  const isSystem = message.type === 'system';
  const isAnnouncement = message.type === 'announcement';
  const userIsOwner = message.user.is_municipality_owner || message.user.role === 'owner';
  const userIsAdmin = message.user.role === 'admin';

  // System-Nachricht
  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-1.5 rounded-full text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`group relative flex gap-3 py-3 px-3 rounded-xl transition-all duration-200
        ${isAnnouncement 
          ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50' 
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }
        ${isOwnMessage ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
      `}
    >
      <ChatAvatar user={message.user} size={42} />
      
      <div className="flex-1 min-w-0">
        {/* Header mit Name, Rolle und Zeit */}
        <div className="flex items-center flex-wrap gap-1.5 mb-1">
          <span className={`font-semibold text-sm ${userIsOwner ? 'text-amber-600 dark:text-amber-400' : userIsAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
            {message.user.name}
          </span>
          
          <RoleBadge role={message.user.role ?? undefined} isOwner={message.user.is_municipality_owner} />
          
          {isAnnouncement && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-amber-400 to-orange-400 text-white">
              📢 Ankündigung
            </span>
          )}
          
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
            {formatMessageDate(message.created_at)}
          </span>
          
          {message.is_edited && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">(bearbeitet)</span>
          )}
        </div>
        
        {/* Antwort-Referenz */}
        {message.reply_to && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg mt-1 mb-2 border-l-3 border-blue-400">
            <Reply className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{message.reply_to.message}</span>
          </div>
        )}
        
        {/* Nachrichtentext */}
        <p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap leading-relaxed">
          {message.message}
        </p>
      </div>

      {/* Aktions-Menü */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 bg-white dark:bg-slate-800 shadow-lg rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onReply(message)}
          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
          title="Antworten"
        >
          <Reply className="w-4 h-4 text-blue-500" />
        </button>
        
        {canEdit && (
          <button
            onClick={() => onEdit(message)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Bearbeiten"
          >
            <Edit2 className="w-4 h-4 text-slate-500" />
          </button>
        )}
        
        {canDelete && (
          <button
            onClick={() => onDelete(message)}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors"
            title="Löschen"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { state, setActivePanel, municipalitySlug, addNotification, municipalityRole } = useGame();
  const multiplayer = useMultiplayerOptional();
  const isGuestMode = multiplayer?.isViewOnly ?? false;
  const isOpen = state.activePanel === 'chat';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id')) || undefined : undefined;
  const currentUserName = typeof window !== 'undefined' ? localStorage.getItem('isocity_user_name') || undefined : undefined;
  const isOwner = municipalityRole === 'owner';

  // Nachrichten laden
  const loadMessages = useCallback(async (afterId?: number) => {
    if (!municipalitySlug) return;

    try {
      const response = await chatApi.getChatMessages(municipalitySlug, { 
        limit: CHAT_MAX_MESSAGES,
        after: afterId 
      });
      
      if (response.success) {
        if (afterId) {
          setMessages(prev => keepLatestMessagesWithinWindow(mergeUniqueMessages(prev, response.data.messages, 'append')));
        } else {
          setMessages(keepLatestMessagesWithinWindow(mergeUniqueMessages([], response.data.messages, 'replace')));
        }
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      if (!afterId) {
        setError('Nachrichten konnten nicht geladen werden');
      }
    } finally {
      setIsLoading(false);
    }
  }, [municipalitySlug]);

  // Initial laden (nicht im Guest-Mode)
  useEffect(() => {
    if (isGuestMode) {
      setIsLoading(false);
      return;
    }
    if (isOpen && municipalitySlug) {
      setIsLoading(true);
      loadMessages();
    }
  }, [isOpen, municipalitySlug, loadMessages, isGuestMode]);

  // Polling für neue Nachrichten (nicht im Guest-Mode)
  useEffect(() => {
    if (isGuestMode) return;
    
    if (isOpen && municipalitySlug) {
      pollIntervalRef.current = setInterval(() => {
        const lastId = messages.length > 0 ? messages[messages.length - 1].id : undefined;
        loadMessages(lastId);
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, municipalitySlug, messages.length, loadMessages, isGuestMode]);

  // Auto-scroll zu neuen Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Nachricht senden
  const handleSend = async () => {
    if (!inputValue.trim() || !municipalitySlug || isSending) return;

    setIsSending(true);
    
    try {
      if (editingMessage) {
        const response = await chatApi.editChatMessage(
          municipalitySlug, 
          editingMessage.id, 
          inputValue.trim()
        );
        
        if (response.success) {
          setMessages(prev => prev.map(m => 
            m.id === editingMessage.id 
              ? { ...m, message: inputValue.trim(), is_edited: true, edited_at: new Date().toISOString() }
              : m
          ));
          setEditingMessage(null);
        }
      } else {
        const response = await chatApi.sendChatMessage(
          municipalitySlug, 
          inputValue.trim(),
          replyTo?.id
        );
        
        if (response.success) {
          setMessages(prev => keepLatestMessagesWithinWindow(mergeUniqueMessages(prev, [response.data.message], 'append')));
          if (typeof window !== 'undefined' && response.data.message?.id) {
            window.dispatchEvent(new CustomEvent('chat-own-message-sent', {
              detail: {
                messageId: response.data.message.id,
                userId: response.data.message?.user?.id,
              },
            }));
          }
          setReplyTo(null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('avatar-chat-message', {
              detail: {
                text: inputValue.trim(),
                userName: response.data.message?.user?.name || currentUserName || undefined,
              },
            }));
          }
        }
      }
      
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
      addNotification('Fehler', 'Nachricht konnte nicht gesendet werden', 'default');
    } finally {
      setIsSending(false);
    }
  };

  // Nachricht löschen
  const handleDelete = async (message: ChatMessage) => {
    if (!municipalitySlug) return;
    if (!confirm('Nachricht wirklich löschen?')) return;

    try {
      const response = await chatApi.deleteChatMessage(municipalitySlug, message.id);
      if (response.success) {
        setMessages(prev => prev.filter(m => m.id !== message.id));
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
      addNotification('Fehler', 'Nachricht konnte nicht gelöscht werden', 'default');
    }
  };

  const handleEdit = (message: ChatMessage) => {
    setEditingMessage(message);
    setInputValue(message.message);
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const handleReply = (message: ChatMessage) => {
    setReplyTo(message);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    setReplyTo(null);
    setEditingMessage(null);
    setInputValue('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActivePanel('none')}>
      <DialogContent className="sm:max-w-[520px] h-[100dvh] sm:h-[650px] max-h-[100dvh] sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 dark:bg-slate-900 sm:rounded-xl rounded-none border-slate-200 dark:border-slate-700">
        {/* Header - Sidebar Style */}
        <DialogHeader className="flex-shrink-0 px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-800 dark:text-white font-bold tracking-tight text-lg">Gemeinde-Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                {messages.length} Nachrichten
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Nachrichten-Bereich */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {isGuestMode ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="p-5 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-700/50 rounded-2xl mb-4">
                <EyeOff className="w-14 h-14 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Chat nicht verfügbar</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Der Chat ist für Besucher nicht zugänglich.</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
              <p className="text-sm text-slate-500">Nachrichten werden geladen...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={() => loadMessages()} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Erneut versuchen
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="p-5 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl mb-4">
                <MessageCircle className="w-14 h-14 text-blue-400" />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Noch keine Nachrichten</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Schreibe die erste Nachricht und starte die Unterhaltung!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                  isOwner={isOwner}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Antwort/Bearbeiten-Anzeige - Sidebar Style (nicht im Guest-Mode) */}
        {!isGuestMode && (replyTo || editingMessage) && (
          <div className="mx-3 mb-2 p-2.5 bg-white dark:bg-slate-800 rounded-lg flex items-center gap-2.5 border border-slate-200 dark:border-slate-700">
            <div className={`p-1.5 rounded-lg ${editingMessage ? 'bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-700'}`}>
              {editingMessage ? (
                <Edit2 className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <Reply className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {replyTo && (
                <div className="text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Antwort auf </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{replyTo.user.name}</span>
                  <p className="text-slate-400 dark:text-slate-500 truncate">{replyTo.message}</p>
                </div>
              )}
              {editingMessage && (
                <div className="text-xs">
                  <span className="text-blue-500 font-medium">Nachricht bearbeiten</span>
                </div>
              )}
            </div>
            <button 
              onClick={handleCancel} 
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Eingabe-Bereich - Sidebar Style (nicht im Guest-Mode) */}
        {!isGuestMode && (
          <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Nachricht schreiben..."
                className="flex-1 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                disabled={isSending}
              />
              <Button 
                onClick={handleSend} 
                disabled={!inputValue.trim() || isSending}
                size="icon"
                className={`rounded-lg transition-all duration-150 ${
                  inputValue.trim() 
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25 hover:bg-blue-600' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
