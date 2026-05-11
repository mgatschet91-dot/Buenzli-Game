'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { deltaQueue } from '@/lib/deltaSync';
import { getAuthToken } from '@/lib/api/coreApi';

// ─── i18n Labels ──────────────────────────────────────────
const UI_LABELS = {
  tabFriends:                  'Freunde',
  onlineFriends:               'Online',
  offlineFriends:              'Offline',
  showProfile:                 'Profil anzeigen',
  startChat:                   'Chat starten',
  writeMessage:                'Nachricht schreiben',
  removeFriend:                'Freund entfernen',
  openChat:                    'Chat öffnen',
  tabSearch:                   'Suche',
  sendFriendRequest:           'Freundschaftsanfrage senden',
  searchPlaceholder:           'Spieler suchen...',
  tabRequests:                 'Anfragen',
  noRequests:                  'Keine Anfragen',
  acceptAll:                   'Alle annehmen',
  denyAll:                     'Alle ablehnen',
  messengerSounds:             'Messenger-Sounds',
  allowFriendRequests:         'Freundschaftsanfragen erlauben',
  profileSearchable:           'Profil in Suche sichtbar',
  accept:                      'Annehmen',
  deny:                        'Ablehnen',
  back:                        'Zurück',
  settings:                    'Einstellungen',
  closeChat:                   'Chat schließen',
  startConversation:           'Starte eine Unterhaltung...',
  chatPlaceholder:             'Nachricht schreiben...',
  otherPlayers:                'Andere Spieler',
  blockUser:                   'Blockieren',
  unblockUser:                 'Entblockieren',
  blockedUsers:                'Blockierte Spieler',
  noBlockedUsers:              'Keine blockierten Spieler',
  blockedErrorMsg:             'Dieser Spieler hat dich blockiert oder du hast ihn blockiert.',
  friendRequestMsgPlaceholder: 'Persönliche Nachricht (optional)...',
  sendRequest:                 'Anfrage senden',
  requestSent:                 'Gesendet!',
  confirmBlock:                'wirklich blockieren?',
  confirmBlockYes:             'Ja, blockieren',
  confirmBlockCancel:          'Abbrechen',
  onlineNow:                   'Online',
  offlineNow:                  'Offline',
  noFriendsYet:                'Noch keine Freunde.',
  noFriendRequestMsg:          'Keine persönliche Nachricht.',
  messenger:                   'Messenger',
};

// ─── Relative Zeitanzeige ──────────────────────────────────
function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec  = Math.floor(diff / 1000);
  const min  = Math.floor(sec / 60);
  const h    = Math.floor(min / 60);
  const d    = Math.floor(h / 24);
  if (sec < 60)  return 'Gerade eben';
  if (min < 60)  return `vor ${min} Min`;
  if (h < 24)    return `vor ${h} Std`;
  if (d === 1)   return 'Gestern';
  if (d < 7)     return `vor ${d} Tagen`;
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
}

// ─── Sound-System ─────────────────────────────────────────
let _sendSound: HTMLAudioElement | null = null;
let _receiveSound: HTMLAudioElement | null = null;

function isMessengerSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem('meinort-messenger-sounds');
  return val !== 'false';
}

function playSentSound() {
  if (!isMessengerSoundEnabled()) return;
  try {
    if (!_sendSound) _sendSound = new Audio('/audio/sent_msg.mp3');
    _sendSound.currentTime = 0;
    _sendSound.volume = 0.5;
    _sendSound.play().catch(() => {});
  } catch {}
}

function playReceiveSound() {
  if (!isMessengerSoundEnabled()) return;
  try {
    if (!_receiveSound) _receiveSound = new Audio('/audio/tururu.mp3');
    _receiveSound.currentTime = 0;
    _receiveSound.volume = 0.5;
    _receiveSound.play().catch(() => {});
  } catch {}
}

// ─── Types ────────────────────────────────────────────────
interface Friend {
  id: number;
  name: string;
  online: boolean;
  conversationId: number | null;
}

interface FriendRequest {
  id: number;
  senderId: number;
  senderName: string;
  message: string;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  text: string;
  type: 'text' | 'system' | 'image';
  createdAt: string;
}

interface SearchResult {
  id: number;
  name: string;
}

// ─── Z-Index Manager ───────────────────────────────────────
let _currentZIndex = 200;
function getNextZIndex() { return ++_currentZIndex; }

// ─── Draggable Hook ────────────────────────────────────────
function useDraggable(handleSelector: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(getNextZIndex());
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const bringToFront = useCallback(() => setZIndex(getNextZIndex()), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(handleSelector)) return;
      dragging.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      offset.current = { x: clientX - pos.x, y: clientY - pos.y };
      bringToFront();
      e.preventDefault();
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPos({ x: clientX - offset.current.x, y: clientY - offset.current.y });
    };

    const onUp = () => { dragging.current = false; };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [pos, handleSelector, bringToFront]);

  return { ref, pos, zIndex, bringToFront };
}

// ═══════════════════════════════════════════════════════════
// ══ MESSENGER PANEL (Freundesliste) ════════════════════════
// ═══════════════════════════════════════════════════════════

enum Tab { Friends, Search, Requests, Settings }

interface MessengerPanelProps {
  onClose: () => void;
  onOpenChat: (friendId: number, friendName: string) => void;
}

export function MessengerPanel({ onClose, onOpenChat }: MessengerPanelProps) {
  const { ref, pos, zIndex, bringToFront } = useDraggable('.msg-title');
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Friends);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchText, setSearchText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messengerSounds, setMessengerSounds] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [profileSearchable, setProfileSearchable] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [blocks, setBlocks] = useState<Array<{ userId: number; name: string }>>([]);
  // Neue States für verbesserte UX
  const [friendRequestMsg, setFriendRequestMsg] = useState('');
  const [sentRequestIds, setSentRequestIds] = useState<Set<number>>(new Set());
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null);
  const [composingForId, setComposingForId] = useState<number | null>(null);

  // Lade Freundesliste beim Öffnen + periodischer Refresh
  useEffect(() => {
    deltaQueue.messengerLoadFriends();
    deltaQueue.messengerLoadRequests();
    deltaQueue.messengerLoadBlocks();
    const interval = setInterval(() => {
      deltaQueue.messengerLoadFriends();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket-Event Listener
  useEffect(() => {
    const onFriendsList = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.friends) {
        const merged = data.friends.map((f: Friend) => {
          const cachedOnline = _friendOnlineCache.get(f.id);
          return cachedOnline !== undefined ? { ...f, online: cachedOnline } : f;
        });
        setFriends(merged);
      }
    };
    const onRequestsList = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.requests) setRequests(data.requests);
    };
    const onSearchResults = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.results) setSearchResults(data.results);
    };
    const onFriendAccepted = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.userId) {
        playReceiveSound();
        deltaQueue.messengerLoadFriends();
        deltaQueue.messengerLoadRequests();
      }
    };
    const onFriendRemoved = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.userId) {
        setFriends(prev => prev.filter(f => f.id !== data.userId));
      }
    };
    const onFriendStatus = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.userId != null) {
        setFriends(prev => prev.map(f => f.id === data.userId ? { ...f, online: data.online } : f));
      }
    };
    const onNewRequest = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.senderId) {
        playReceiveSound();
        deltaQueue.messengerLoadRequests();
      }
    };
    const onError = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.error) {
        setErrorMsg(String(data.error));
        setTimeout(() => setErrorMsg(null), 4000);
      }
    };
    const onBlocksList = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (Array.isArray(data?.blocks)) setBlocks(data.blocks);
    };
    const onBlockResult = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.success) deltaQueue.messengerLoadBlocks();
    };

    window.addEventListener('messenger-friends-list', onFriendsList);
    window.addEventListener('messenger-requests-list', onRequestsList);
    window.addEventListener('messenger-search-results', onSearchResults);
    window.addEventListener('messenger-friend-accepted', onFriendAccepted);
    window.addEventListener('messenger-friend-removed', onFriendRemoved);
    window.addEventListener('messenger-friend-status', onFriendStatus);
    window.addEventListener('messenger-friend-request-received', onNewRequest);
    window.addEventListener('messenger-error', onError);
    window.addEventListener('messenger-blocks-list', onBlocksList);
    window.addEventListener('messenger-block-result', onBlockResult);
    return () => {
      window.removeEventListener('messenger-friends-list', onFriendsList);
      window.removeEventListener('messenger-requests-list', onRequestsList);
      window.removeEventListener('messenger-search-results', onSearchResults);
      window.removeEventListener('messenger-friend-accepted', onFriendAccepted);
      window.removeEventListener('messenger-friend-removed', onFriendRemoved);
      window.removeEventListener('messenger-friend-status', onFriendStatus);
      window.removeEventListener('messenger-friend-request-received', onNewRequest);
      window.removeEventListener('messenger-error', onError);
      window.removeEventListener('messenger-blocks-list', onBlocksList);
      window.removeEventListener('messenger-block-result', onBlockResult);
    };
  }, []);

  const onlineFriends  = friends.filter(f => f.online);
  const offlineFriends = friends.filter(f => !f.online);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchText.trim().length >= 2) {
      deltaQueue.messengerSearch(searchText.trim());
    }
  };

  const handleAcceptRequest = (senderId: number) => {
    deltaQueue.messengerAcceptFriend(senderId);
    setRequests(prev => prev.filter(r => r.senderId !== senderId));
    if (expandedRequestId === senderId) setExpandedRequestId(null);
    playReceiveSound();
  };

  const handleDenyRequest = (senderId: number) => {
    deltaQueue.messengerDenyFriend(senderId);
    setRequests(prev => prev.filter(r => r.senderId !== senderId));
    if (expandedRequestId === senderId) setExpandedRequestId(null);
  };

  const handleAcceptAll = () => {
    requests.forEach(r => deltaQueue.messengerAcceptFriend(r.senderId));
    setRequests([]);
    setExpandedRequestId(null);
    playReceiveSound();
  };

  const handleDenyAll = () => {
    requests.forEach(r => deltaQueue.messengerDenyFriend(r.senderId));
    setRequests([]);
    setExpandedRequestId(null);
  };

  const handleStartChat = (friendId: number) => {
    const friend = friends.find(f => f.id === friendId);
    if (friend) onOpenChat(friend.id, friend.name);
  };

  const handleSendFriendRequest = (userId: number) => {
    deltaQueue.messengerSendFriendRequest(userId, friendRequestMsg.trim() || undefined);
    playSentSound();
    setSentRequestIds(prev => new Set(prev).add(userId));
    setFriendRequestMsg('');
    setComposingForId(null);
  };

  const loadSettings = useCallback(() => {
    if (settingsLoaded) return;
    const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_CORE_API_URL || 'http://127.0.0.1:4100';
    const token = getAuthToken();
    if (!token) return;
    fetch(`${AUTH_API}/api/user/settings`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Game-Token': token },
    })
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data) {
          setMessengerSounds(json.data.messenger_sounds ?? true);
          setAllowFriendRequests(json.data.allow_friend_requests ?? true);
          setProfileSearchable(json.data.profile_searchable ?? true);
          setSettingsLoaded(true);
        }
      })
      .catch(() => {});
  }, [settingsLoaded]);

  const saveSettingKey = useCallback((key: string, value: boolean) => {
    const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_CORE_API_URL || 'http://127.0.0.1:4100';
    const token = getAuthToken();
    if (!token) return;
    fetch(`${AUTH_API}/api/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Game-Token': token },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }, []);

  // ─── Tab Content Render Funktionen ───────────────────────

  const renderFriendsContent = () => (
    <div className="msg-content-scroll">
      {friends.length === 0 && (
        <div className="msg-empty-hint">{UI_LABELS.noFriendsYet}</div>
      )}

      {onlineFriends.length > 0 && (
        <>
          <div className="msg-group-header">{UI_LABELS.onlineFriends} ({onlineFriends.length})</div>
          {onlineFriends.map(f => (
            <div key={f.id} className="msg-friend" onClick={() => handleStartChat(f.id)}>
              <span className="msg-friend-status online" />
              <span className="msg-friend-name">{f.name}</span>
              <div className="msg-icons">
                <button
                  onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-player-profile', { detail: { userId: f.id } })); }}
                  className="msg-icon-btn"
                  title={UI_LABELS.showProfile}
                >
                  <img src="/images/messenger/open_inbox.png" alt={UI_LABELS.showProfile} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartChat(f.id); }}
                  className="msg-icon-btn"
                  title={UI_LABELS.startChat}
                >
                  <img src="/images/messenger/start_chat.png" alt={UI_LABELS.startChat} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {offlineFriends.length > 0 && (
        <>
          <div className="msg-group-header">{UI_LABELS.offlineFriends} ({offlineFriends.length})</div>
          {offlineFriends.map(f => (
            <div key={f.id} className="msg-friend" onClick={() => handleStartChat(f.id)}>
              <span className="msg-friend-status offline" />
              <span className="msg-friend-name">{f.name}</span>
              <div className="msg-icons">
                <button
                  onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-player-profile', { detail: { userId: f.id } })); }}
                  className="msg-icon-btn"
                  title={UI_LABELS.showProfile}
                >
                  <img src="/images/messenger/open_inbox.png" alt={UI_LABELS.showProfile} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartChat(f.id); }}
                  className="msg-icon-btn"
                  title={UI_LABELS.writeMessage}
                >
                  <img src="/images/messenger/start_chat.png" alt={UI_LABELS.writeMessage} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderSearchContent = () => {
    const filteredFriends = friends.filter(f => f.name.toLowerCase().includes(searchText.toLowerCase()));

    return (
      <div className="msg-search-content">
        <form onSubmit={handleSearch} className="msg-search-form">
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={UI_LABELS.searchPlaceholder}
            autoComplete="off"
          />
          <button type="submit">{UI_LABELS.tabSearch}</button>
        </form>

        <div className="msg-content-scroll">
          {filteredFriends.length > 0 && (
            <>
              <div className="msg-group-header">{UI_LABELS.onlineFriends} ({filteredFriends.length})</div>
              {filteredFriends.map(f => (
                <div key={f.id} className="msg-friend" onClick={() => handleStartChat(f.id)}>
                  <span className={`msg-friend-status ${f.online ? 'online' : 'offline'}`} />
                  <span className="msg-friend-name">{f.name}</span>
                </div>
              ))}
            </>
          )}

          {searchResults.length > 0 && (
            <>
              <div className="msg-group-header">{UI_LABELS.otherPlayers} ({searchResults.length})</div>
              {searchResults.map(r => (
                <div key={r.id} className="msg-search-result-wrap">
                  <div className="msg-friend">
                    <span className="msg-friend-name">{r.name}</span>
                    <div className="msg-icons">
                      {sentRequestIds.has(r.id) ? (
                        <span className="msg-request-sent-badge">{UI_LABELS.requestSent}</span>
                      ) : (
                        <button
                          onClick={() => setComposingForId(composingForId === r.id ? null : r.id)}
                          className="msg-icon-btn"
                          title={UI_LABELS.sendFriendRequest}
                        >
                          <img src="/images/messenger/ask_for_friend.png" alt={UI_LABELS.sendFriendRequest} />
                        </button>
                      )}
                    </div>
                  </div>
                  {composingForId === r.id && !sentRequestIds.has(r.id) && (
                    <div className="msg-compose-request">
                      <input
                        type="text"
                        maxLength={120}
                        value={friendRequestMsg}
                        onChange={e => setFriendRequestMsg(e.target.value)}
                        placeholder={UI_LABELS.friendRequestMsgPlaceholder}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSendFriendRequest(r.id); } }}
                      />
                      <button
                        onClick={() => handleSendFriendRequest(r.id)}
                        className="msg-compose-send-btn"
                      >
                        {UI_LABELS.sendRequest}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRequestsContent = () => (
    <div className="msg-requests-list">
      {requests.length === 0 && (
        <div className="msg-empty-hint">{UI_LABELS.noRequests}</div>
      )}

      {requests.map(r => (
        <div key={r.senderId} className="msg-request-card">
          <div
            className="msg-request-header"
            onClick={() => setExpandedRequestId(expandedRequestId === r.senderId ? null : r.senderId)}
          >
            <span className="msg-friend-name">{r.senderName}</span>
            <span className="msg-request-time">{formatRelativeTime(r.createdAt)}</span>
            <span className="msg-request-chevron">{expandedRequestId === r.senderId ? '▲' : '▼'}</span>
          </div>

          {expandedRequestId === r.senderId && (
            <div className="msg-request-body">
              {r.message ? (
                <p className="msg-request-msg-text">„{r.message}"</p>
              ) : (
                <p className="msg-request-msg-empty">{UI_LABELS.noFriendRequestMsg}</p>
              )}
              <div className="msg-request-actions">
                <button className="msg-request-accept-btn" onClick={() => handleAcceptRequest(r.senderId)}>
                  <img src="/images/messenger/accept.png" alt="" />
                  {UI_LABELS.accept}
                </button>
                <button className="msg-request-deny-btn" onClick={() => handleDenyRequest(r.senderId)}>
                  <img src="/images/messenger/decline.png" alt="" />
                  {UI_LABELS.deny}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {requests.length >= 2 && (
        <div className="msg-requests-bulk">
          <button onClick={handleAcceptAll}>{UI_LABELS.acceptAll}</button>
          <button onClick={handleDenyAll}>{UI_LABELS.denyAll}</button>
        </div>
      )}
    </div>
  );

  const renderSettingsContent = () => {
    const toggleItem = (label: string, value: boolean, onChange: (v: boolean) => void, key: string) => (
      <div className="msg-setting-row" key={key}>
        <span>{label}</span>
        <button
          className={`msg-setting-toggle ${value ? 'on' : ''}`}
          onClick={() => {
            const nv = !value;
            onChange(nv);
            saveSettingKey(key, nv);
            if (key === 'messenger_sounds') localStorage.setItem('meinort-messenger-sounds', String(nv));
          }}
        >
          <div className="msg-setting-knob" />
        </button>
      </div>
    );

    return (
      <div className="msg-settings-wrapper">
        <div className="msg-settings-list">
          {toggleItem(UI_LABELS.messengerSounds, messengerSounds, setMessengerSounds, 'messenger_sounds')}
          {toggleItem(UI_LABELS.allowFriendRequests, allowFriendRequests, setAllowFriendRequests, 'allow_friend_requests')}
          {toggleItem(UI_LABELS.profileSearchable, profileSearchable, setProfileSearchable, 'profile_searchable')}
        </div>
        <div className="msg-settings-section-title">{UI_LABELS.blockedUsers}</div>
        <div className="msg-blocklist">
          {blocks.length === 0 ? (
            <div className="msg-blocklist-empty">{UI_LABELS.noBlockedUsers}</div>
          ) : (
            blocks.map(b => (
              <div key={b.userId} className="msg-friend">
                <span className="msg-friend-name">{b.name}</span>
                <div className="msg-icons">
                  <button
                    onClick={() => deltaQueue.messengerUnblock(b.userId)}
                    className="msg-icon-btn"
                    title={UI_LABELS.unblockUser}
                  >
                    <img src="/images/messenger/accept.png" alt={UI_LABELS.unblockUser} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const handleSidebarTabClick = (tab: Tab) => {
    if (tab === Tab.Settings) loadSettings();
    setCurrentTab(tab);
  };

  return (
    <>
      <style>{messengerCSS}</style>
      <div
        ref={ref}
        className="msg-panel"
        style={{ zIndex, transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onMouseDown={bringToFront}
      >
        {/* Header */}
        <div className="msg-header">
          <h2 className="msg-title">{UI_LABELS.messenger}</h2>
          <button className="msg-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body: Sidebar + Content */}
        <div className="msg-body">
          <div className="msg-sidebar">
            <button
              className={`msg-sidebar-btn ${currentTab === Tab.Friends ? 'active' : ''}`}
              onClick={() => handleSidebarTabClick(Tab.Friends)}
              title={UI_LABELS.tabFriends}
            >
              <img src="/images/messenger/start_chat.png" alt="" />
            </button>
            <button
              className={`msg-sidebar-btn ${currentTab === Tab.Search ? 'active' : ''}`}
              onClick={() => handleSidebarTabClick(Tab.Search)}
              title={UI_LABELS.tabSearch}
            >
              <img src="/images/messenger/open_inbox.png" alt="" />
            </button>
            <button
              className={`msg-sidebar-btn ${currentTab === Tab.Requests ? 'active' : ''}`}
              onClick={() => handleSidebarTabClick(Tab.Requests)}
              title={UI_LABELS.tabRequests}
            >
              <img src="/images/messenger/ask_for_friend.png" alt="" />
              {requests.length > 0 && (
                <span className="msg-sidebar-badge">{requests.length > 9 ? '9+' : requests.length}</span>
              )}
            </button>
            <button
              className={`msg-sidebar-btn ${currentTab === Tab.Settings ? 'active' : ''}`}
              onClick={() => handleSidebarTabClick(Tab.Settings)}
              title={UI_LABELS.settings}
            >
              <img src="/images/messenger/open_edit_ctgs.png" alt="" />
            </button>
          </div>

          <div className="msg-content-area">
            {currentTab === Tab.Friends   && renderFriendsContent()}
            {currentTab === Tab.Search    && renderSearchContent()}
            {currentTab === Tab.Requests  && renderRequestsContent()}
            {currentTab === Tab.Settings  && renderSettingsContent()}
          </div>
        </div>

        {/* Fehler-Bar */}
        {errorMsg && (
          <div className="msg-error">{errorMsg}</div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ══ CHAT PANEL (Gesprächsfenster) ══════════════════════════
// ═══════════════════════════════════════════════════════════

interface ActiveChat {
  friendId: number;
  friendName: string;
  conversationId: number | null;
  messages: ChatMessage[];
  unread: boolean;
}

interface MessengerChatPanelProps {
  initialFriendId: number;
  initialFriendName: string;
  onClose: () => void;
  friendsOnlineMap: Map<number, boolean>;
}

export function MessengerChatPanel({ initialFriendId, initialFriendName, onClose, friendsOnlineMap }: MessengerChatPanelProps) {
  const { ref, pos, zIndex, bringToFront } = useDraggable('.msgchat-title');
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [currentChatFriendId, setCurrentChatFriendId] = useState(initialFriendId);
  const [text, setText] = useState('');
  const [blockConfirmFriendId, setBlockConfirmFriendId] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const currentChatFriendIdRef = useRef(initialFriendId);

  // Initialen Chat öffnen
  useEffect(() => {
    deltaQueue.messengerStartChat(initialFriendId);
  }, [initialFriendId]);

  // Auto-scroll
  const scrollDown = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  // WebSocket-Events
  useEffect(() => {
    const onChatOpened = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data?.conversationId) return;
      setActiveChats(prev => {
        const existing = prev.find(c => c.friendId === data.friendId);
        if (existing) {
          return prev.map(c => c.friendId === data.friendId
            ? { ...c, conversationId: data.conversationId, messages: data.messages || [], unread: false }
            : c
          );
        }
        return [...prev, {
          friendId: data.friendId,
          friendName: data.friendName,
          conversationId: data.conversationId,
          messages: data.messages || [],
          unread: false,
        }];
      });
      setCurrentChatFriendId(data.friendId);
      setTimeout(scrollDown, 50);
    };

    const onMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail as ChatMessage & { conversationId: number };
      if (!msg?.conversationId) return;
      setActiveChats(prev => {
        const chat = prev.find(c => c.conversationId === msg.conversationId);
        if (!chat) return prev;
        const isCurrentChat = chat.friendId === currentChatFriendId;
        const myUserId = Number(localStorage.getItem('isocity_user_id') || '0');
        if (msg.senderId !== myUserId) {
          playReceiveSound();
        }
        return prev.map(c => c.conversationId === msg.conversationId
          ? { ...c, messages: [...c.messages, msg], unread: !isCurrentChat }
          : c
        );
      });
      setTimeout(scrollDown, 50);
    };

    const onMessengerError = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.code === 'BLOCKED') {
        const fid = currentChatFriendIdRef.current;
        const systemMsg: ChatMessage = {
          id: Date.now(),
          senderId: 0,
          senderName: 'System',
          text: UI_LABELS.blockedErrorMsg,
          type: 'system',
          createdAt: new Date().toISOString(),
        };
        setActiveChats(prev => prev.map(c =>
          c.friendId === fid ? { ...c, messages: [...c.messages, systemMsg] } : c
        ));
        setTimeout(scrollDown, 50);
      }
    };

    window.addEventListener('messenger-chat-opened', onChatOpened);
    window.addEventListener('messenger-message', onMessage);
    window.addEventListener('messenger-error', onMessengerError);
    return () => {
      window.removeEventListener('messenger-chat-opened', onChatOpened);
      window.removeEventListener('messenger-message', onMessage);
      window.removeEventListener('messenger-error', onMessengerError);
    };
  }, [currentChatFriendId, scrollDown]);

  const currentChat = activeChats.find(c => c.friendId === currentChatFriendId);
  const myUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || '0') : 0;
  const isOnline = friendsOnlineMap.get(currentChatFriendId) ?? false;

  const handleSend = () => {
    if (!text.trim() || !currentChat?.conversationId) return;
    deltaQueue.messengerSend(currentChat.conversationId, text.trim());
    playSentSound();
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => { currentChatFriendIdRef.current = currentChatFriendId; }, [currentChatFriendId]);

  const handleTabChange = (friendId: number) => {
    setBlockConfirmFriendId(null);
    setCurrentChatFriendId(friendId);
    setActiveChats(prev => prev.map(c => c.friendId === friendId ? { ...c, unread: false } : c));
    const chat = activeChats.find(c => c.friendId === friendId);
    if (chat?.conversationId) {
      deltaQueue.messengerStartChat(friendId);
    }
    setTimeout(scrollDown, 50);
  };

  const handleCloseChat = () => {
    const remaining = activeChats.filter(c => c.friendId !== currentChatFriendId);
    if (remaining.length === 0) {
      onClose();
      return;
    }
    setActiveChats(remaining);
    setCurrentChatFriendId(remaining[0].friendId);
    setBlockConfirmFriendId(null);
  };

  // Externe Chat-Öffnung
  useEffect(() => {
    const openNewChat = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.friendId) {
        deltaQueue.messengerStartChat(data.friendId);
      }
    };
    window.addEventListener('messenger-open-chat', openNewChat);
    return () => window.removeEventListener('messenger-open-chat', openNewChat);
  }, []);

  const title = currentChat?.friendName || initialFriendName || 'Chat';

  return (
    <>
      <style>{chatCSS}</style>
      <div
        ref={ref}
        className="msgchat-panel"
        style={{ zIndex, transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onMouseDown={bringToFront}
      >
        <button className="msgchat-close-btn" onClick={onClose}>✕</button>

        {/* Header mit Online-Status — msgchat-title MUSS für useDraggable bleiben */}
        <div className="msgchat-header msgchat-title">
          <span className={`msgchat-online-dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="msgchat-header-name">{title}</span>
          <span className="msgchat-header-status">{isOnline ? UI_LABELS.onlineNow : UI_LABELS.offlineNow}</span>
        </div>

        {/* Chat-Tabs */}
        <div className="msgchat-tabs">
          {activeChats.map(c => (
            <button
              key={c.friendId}
              className={`msgchat-tab ${c.friendId === currentChatFriendId ? 'selected' : ''} ${c.unread ? 'alert' : ''}`}
              onClick={() => handleTabChange(c.friendId)}
              title={c.friendName}
            >
              <span className="msgchat-tab-name">
                {c.friendName.length > 8 ? c.friendName.slice(0, 7) + '…' : c.friendName}
              </span>
              {c.unread && <span className="msgchat-tab-badge">!</span>}
            </button>
          ))}
        </div>

        {/* Actions Bar */}
        <div className="msgchat-actions-bar">
          {blockConfirmFriendId === currentChatFriendId ? (
            <div className="msgchat-block-confirm">
              <span className="msgchat-block-confirm-text">
                {currentChat?.friendName} {UI_LABELS.confirmBlock}
              </span>
              <button
                className="msgchat-block-confirm-yes"
                onClick={() => {
                  deltaQueue.messengerBlock(currentChatFriendId);
                  setBlockConfirmFriendId(null);
                }}
              >
                {UI_LABELS.confirmBlockYes}
              </button>
              <button
                className="msgchat-block-confirm-cancel"
                onClick={() => setBlockConfirmFriendId(null)}
              >
                {UI_LABELS.confirmBlockCancel}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setBlockConfirmFriendId(currentChatFriendId)}
                className="msgchat-block-btn"
                title={UI_LABELS.blockUser}
              >
                {UI_LABELS.blockUser}
              </button>
              <button onClick={handleCloseChat} className="msgchat-close-chat" title={UI_LABELS.closeChat}>
                <img src="/images/messenger/close.png" alt={UI_LABELS.closeChat} />
              </button>
            </>
          )}
        </div>

        {/* Nachrichten */}
        <div className="msgchat-messages" ref={chatRef}>
          {currentChat?.messages.map((msg, i) => {
            let extraClass = '';
            if (msg.type === 'system') extraClass = 'info';
            else if (msg.senderId === myUserId) extraClass = 'me';
            return (
              <div key={msg.id || i} className={`msgchat-msg ${extraClass}`}>
                <div className="msgchat-msg-row">
                  {msg.type !== 'system' && (
                    <strong className="msgchat-msg-sender">{msg.senderName}</strong>
                  )}
                  <span className="msgchat-msg-text">{msg.text}</span>
                </div>
                {msg.createdAt && (
                  <span className="msgchat-msg-time">{formatRelativeTime(msg.createdAt)}</span>
                )}
              </div>
            );
          })}
          {(!currentChat || currentChat.messages.length === 0) && (
            <div className="msgchat-msg info">
              <div className="msgchat-msg-row">
                <span className="msgchat-msg-text">{UI_LABELS.startConversation}</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area mit Send-Button */}
        <div className="msgchat-input-area">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={UI_LABELS.chatPlaceholder}
          />
          <button
            className="msgchat-send-btn"
            onClick={handleSend}
            disabled={!text.trim() || !currentChat?.conversationId}
            title="Senden (Enter)"
          >
            <img src="/images/messenger/start_chat.png" alt="Senden" />
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ══ MESSENGER CONTAINER (orchestriert alles) ═══════════════
// ═══════════════════════════════════════════════════════════

interface MessengerContainerProps {
  visible: boolean;
  onClose: () => void;
}

// Globaler Online-Status Cache (überlebt Panel-Öffnen/Schließen)
const _friendOnlineCache = new Map<number, boolean>();

export function MessengerContainer({ visible, onClose }: MessengerContainerProps) {
  const [chatTarget, setChatTarget] = useState<{ friendId: number; friendName: string } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [friendsOnlineMap, setFriendsOnlineMap] = useState<Map<number, boolean>>(new Map(_friendOnlineCache));

  // Globaler Listener: Sound + Notification + Online-Status-Tracking
  useEffect(() => {
    const onIncomingRequest = () => {
      playReceiveSound();
      window.dispatchEvent(new CustomEvent('messenger-has-unread', { detail: { count: 1 } }));
    };
    const onIncomingMessage = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const myUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || '0') : 0;
      if (data?.senderId && data.senderId !== myUserId) {
        playReceiveSound();
      }
      window.dispatchEvent(new CustomEvent('messenger-has-unread', { detail: { count: 1 } }));
    };
    const onFriendAccepted = () => {
      playReceiveSound();
    };
    const onFriendStatus = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.userId != null) {
        _friendOnlineCache.set(Number(data.userId), Boolean(data.online));
        setFriendsOnlineMap(new Map(_friendOnlineCache));
      }
    };
    const onFriendsList = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.friends) {
        for (const f of data.friends) {
          _friendOnlineCache.set(Number(f.id), Boolean(f.online));
        }
        setFriendsOnlineMap(new Map(_friendOnlineCache));
      }
    };
    window.addEventListener('messenger-friend-request-received', onIncomingRequest);
    window.addEventListener('messenger-message', onIncomingMessage);
    window.addEventListener('messenger-friend-accepted', onFriendAccepted);
    window.addEventListener('messenger-friend-status', onFriendStatus);
    window.addEventListener('messenger-friends-list', onFriendsList);
    return () => {
      window.removeEventListener('messenger-friend-request-received', onIncomingRequest);
      window.removeEventListener('messenger-message', onIncomingMessage);
      window.removeEventListener('messenger-friend-accepted', onFriendAccepted);
      window.removeEventListener('messenger-friend-status', onFriendStatus);
      window.removeEventListener('messenger-friends-list', onFriendsList);
    };
  }, []);

  const handleOpenChat = (friendId: number, friendName: string) => {
    setChatTarget({ friendId, friendName });
    setShowChat(true);
  };

  const handleCloseChat = () => {
    setShowChat(false);
    setChatTarget(null);
  };

  return (
    <>
      {visible && (
        <MessengerPanel onClose={onClose} onOpenChat={handleOpenChat} />
      )}
      {showChat && chatTarget && (
        <MessengerChatPanel
          initialFriendId={chatTarget.friendId}
          initialFriendName={chatTarget.friendName}
          onClose={handleCloseChat}
          friendsOnlineMap={friendsOnlineMap}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ══ CSS ════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════

const messengerCSS = `
/* ─── Messenger Panel ─────────────────────────── */
.msg-panel {
  position: fixed;
  left: 260px;
  top: 80px;
  width: 300px;
  background: rgba(15, 23, 42, 0.97);
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 10px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 12px;
  user-select: none;
  box-shadow: 0 20px 40px rgba(2, 6, 23, 0.6);
  overflow: hidden;
}

/* Header */
.msg-header {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 10px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
}
.msg-title {
  flex: 1;
  font-size: 13px;
  font-weight: bold;
  color: #f8fafc;
  cursor: grab;
  user-select: none;
  margin: 0;
  padding: 0;
}
.msg-title:active { cursor: grabbing; }

.msg-close-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1;
}
.msg-close-btn:hover { color: #f1f5f9; background: rgba(148, 163, 184, 0.15); }

/* Body: Sidebar + Content */
.msg-body {
  display: flex;
  height: 290px;
}

/* Sidebar */
.msg-sidebar {
  width: 40px;
  background: #0b1220;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  flex-shrink: 0;
}
.msg-sidebar-btn {
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.15s, border-color 0.15s;
}
.msg-sidebar-btn:hover {
  background: rgba(148, 163, 184, 0.1);
  border-color: #334155;
}
.msg-sidebar-btn.active {
  background: #1e293b;
  border-color: #475569;
}
.msg-sidebar-btn img {
  width: 16px;
  height: 16px;
  image-rendering: pixelated;
  opacity: 0.7;
}
.msg-sidebar-btn.active img,
.msg-sidebar-btn:hover img { opacity: 1; }

.msg-sidebar-badge {
  position: absolute;
  top: 0px;
  right: 0px;
  background: #ef4444;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  min-width: 13px;
  height: 13px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  line-height: 1;
}

/* Content Area */
.msg-content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #0f172a;
}

/* Scrollbare Liste */
.msg-content-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.msg-group-header {
  background: #1e293b;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  border-bottom: 1px solid #334155;
}

/* Friend Row */
.msg-friend {
  width: 100%;
  min-height: 28px;
  display: flex;
  align-items: center;
  color: #e2e8f0;
  overflow: hidden;
  cursor: pointer;
  padding: 0 6px;
  box-sizing: border-box;
  gap: 4px;
  transition: background 0.1s;
}
.msg-friend:nth-child(even) { background: rgba(30, 41, 59, 0.35); }
.msg-friend:hover { background: #1d4ed8; color: #eff6ff; }

.msg-friend-status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.msg-friend-status.online  { background: #22c55e; box-shadow: 0 0 4px #22c55e88; }
.msg-friend-status.offline { background: #475569; }

.msg-friend-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.msg-icons {
  display: flex;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}
.msg-icon-btn {
  border: none;
  background: none;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: background 0.12s;
}
.msg-icon-btn:hover { background: rgba(148, 163, 184, 0.25); }
.msg-icon-btn img {
  width: 14px;
  height: 14px;
  display: block;
  image-rendering: pixelated;
}

/* Empty hint */
.msg-empty-hint {
  padding: 20px 16px;
  color: #64748b;
  font-size: 11px;
  text-align: center;
}

/* ─── Search Content ──────────────────────────── */
.msg-search-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.msg-search-form {
  display: flex;
  gap: 4px;
  padding: 6px;
  background: #0b1220;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.msg-search-form input {
  flex: 1;
  height: 24px;
  background: #0f172a;
  border: 1px solid #475569;
  color: #e2e8f0;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 3px;
}
.msg-search-form input::placeholder { color: #64748b; }
.msg-search-form button {
  height: 24px;
  padding: 0 8px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
}
.msg-search-form button:hover { background: #334155; }

/* Search result wrapper for compose row */
.msg-search-result-wrap {
  display: flex;
  flex-direction: column;
}

/* Compose Friend Request */
.msg-compose-request {
  display: flex;
  gap: 4px;
  padding: 4px 6px 4px 18px;
  background: #0b1220;
  border-top: 1px solid #1e293b;
}
.msg-compose-request input {
  flex: 1;
  height: 22px;
  background: #0f172a;
  border: 1px solid #475569;
  color: #e2e8f0;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 3px;
}
.msg-compose-request input::placeholder { color: #64748b; }
.msg-compose-send-btn {
  height: 22px;
  padding: 0 8px;
  background: #1d4ed8;
  border: 1px solid #1e40af;
  color: #eff6ff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
}
.msg-compose-send-btn:hover { background: #1e40af; }

.msg-request-sent-badge {
  color: #86efac;
  font-size: 10px;
  font-weight: 700;
  padding: 0 4px;
}

/* ─── Requests Content ────────────────────────── */
.msg-requests-list {
  overflow-y: auto;
  height: 100%;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.msg-request-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.msg-request-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  gap: 6px;
  transition: background 0.1s;
}
.msg-request-header:hover { background: #263347; }

.msg-request-time {
  color: #64748b;
  font-size: 10px;
  margin-left: auto;
  flex-shrink: 0;
}
.msg-request-chevron {
  color: #64748b;
  font-size: 9px;
  flex-shrink: 0;
}

.msg-request-body {
  padding: 6px 8px 8px;
  background: #0f172a;
  border-top: 1px solid #334155;
}
.msg-request-msg-text {
  color: #94a3b8;
  font-size: 11px;
  font-style: italic;
  margin: 0 0 7px;
  line-height: 1.4;
  word-break: break-word;
}
.msg-request-msg-empty {
  color: #475569;
  font-size: 10px;
  margin: 0 0 7px;
}

.msg-request-actions {
  display: flex;
  gap: 6px;
}
.msg-request-accept-btn,
.msg-request-deny-btn {
  height: 22px;
  border-radius: 3px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 8px;
}
.msg-request-accept-btn {
  background: #14532d;
  border-color: #166534;
  color: #86efac;
}
.msg-request-accept-btn:hover { background: #166534; }
.msg-request-deny-btn {
  background: #450a0a;
  border-color: #7f1d1d;
  color: #fca5a5;
}
.msg-request-deny-btn:hover { background: #7f1d1d; }
.msg-request-accept-btn img,
.msg-request-deny-btn img { width: 11px; height: 11px; image-rendering: pixelated; }

.msg-requests-bulk {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-top: 1px solid #334155;
  flex-shrink: 0;
  margin-top: auto;
}
.msg-requests-bulk button {
  flex: 1;
  height: 22px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 10px;
  border-radius: 3px;
  cursor: pointer;
}
.msg-requests-bulk button:hover { background: #334155; color: #e2e8f0; }

/* ─── Settings Content ────────────────────────── */
.msg-settings-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.msg-settings-section-title {
  background: #1e293b;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 8px 3px;
  border-top: 1px solid #334155;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.msg-blocklist {
  overflow-y: auto;
  flex: 1;
}
.msg-blocklist-empty {
  padding: 10px;
  color: #64748b;
  font-size: 11px;
  text-align: center;
}
.msg-settings-list {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.msg-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #1e293b;
  font-size: 12px;
  color: #e2e8f0;
  border-bottom: 1px solid #334155;
}
.msg-setting-row:nth-child(even) { background: #172033; }
.msg-setting-toggle {
  width: 34px;
  height: 18px;
  border-radius: 9px;
  border: 1px solid #64748b;
  background: #334155;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
  flex-shrink: 0;
}
.msg-setting-toggle.on { background: #22c55e; border-color: #16a34a; }
.msg-setting-knob {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.35);
  position: absolute;
  top: 1px;
  left: 1px;
  transition: transform 0.2s;
}
.msg-setting-toggle.on .msg-setting-knob { transform: translateX(16px); }

/* ─── Error Bar ───────────────────────────────── */
.msg-error {
  background: #b91c1c;
  color: #fff;
  font-size: 11px;
  padding: 5px 10px;
  text-align: center;
  font-weight: 600;
  animation: msg-error-fade 0.25s ease-out;
}
@keyframes msg-error-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const chatCSS = `
/* ─── Chat Panel ──────────────────────────────── */
.msgchat-panel {
  position: fixed;
  left: 520px;
  top: 80px;
  width: 290px;
  background: rgba(15, 23, 42, 0.97);
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 10px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 12px;
  user-select: none;
  box-shadow: 0 20px 40px rgba(2, 6, 23, 0.6);
  overflow: hidden;
}

.msgchat-close-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  z-index: 1;
  line-height: 1;
}
.msgchat-close-btn:hover { color: #f1f5f9; background: rgba(148,163,184,0.15); }

/* Header mit Online-Status */
.msgchat-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 32px 0 10px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  min-height: 36px;
  cursor: grab;
}
.msgchat-header:active { cursor: grabbing; }

.msgchat-online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.msgchat-online-dot.online  { background: #22c55e; box-shadow: 0 0 5px #22c55e99; }
.msgchat-online-dot.offline { background: #475569; }

.msgchat-header-name {
  font-size: 13px;
  font-weight: bold;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.msgchat-header-status {
  font-size: 10px;
  color: #64748b;
  flex-shrink: 0;
}

/* Chat-Tabs */
.msgchat-tabs {
  height: 30px;
  background: #1e293b;
  display: flex;
  border-bottom: 1px solid #334155;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.msgchat-tabs::-webkit-scrollbar { display: none; }

.msgchat-tab {
  height: 30px;
  min-width: 54px;
  max-width: 90px;
  padding: 0 7px;
  border: none;
  border-right: 1px solid #334155;
  background: inherit;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 1;
  overflow: hidden;
  transition: background 0.1s, color 0.1s;
}
.msgchat-tab.selected,
.msgchat-tab:hover {
  background: #0f172a;
  color: #f8fafc;
}
.msgchat-tab.alert { color: #93c5fd; }
.msgchat-tab.alert.selected { color: #f8fafc; }

.msgchat-tab-name {
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.msgchat-tab-badge {
  background: #1d4ed8;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Actions Bar */
.msgchat-actions-bar {
  background: #0b1220;
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  justify-content: flex-end;
  gap: 6px;
  border-bottom: 1px solid #1e293b;
}
.msgchat-close-chat {
  border: none !important;
  background: none !important;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: flex;
  align-items: center;
}
.msgchat-close-chat:hover { background: rgba(148,163,184,0.15) !important; }
.msgchat-close-chat img { width: 13px; height: 13px; image-rendering: pixelated; }
.msgchat-block-btn {
  border: 1px solid #7f1d1d;
  background: #450a0a;
  color: #fca5a5;
  font-size: 10px;
  font-weight: 600;
  height: 20px;
  padding: 0 7px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
}
.msgchat-block-btn:hover { background: #7f1d1d; }

/* Inline Block Confirm */
.msgchat-block-confirm {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
}
.msgchat-block-confirm-text {
  font-size: 10px;
  color: #fca5a5;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.msgchat-block-confirm-yes {
  background: #7f1d1d;
  border: 1px solid #991b1b;
  color: #fca5a5;
  font-size: 10px;
  font-weight: 700;
  height: 20px;
  padding: 0 6px;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.msgchat-block-confirm-yes:hover { background: #991b1b; }
.msgchat-block-confirm-cancel {
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 10px;
  height: 20px;
  padding: 0 6px;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.msgchat-block-confirm-cancel:hover { background: #334155; }

/* Messages */
.msgchat-messages {
  height: 230px;
  background: #0f172a;
  overflow-y: auto;
  padding: 2px 0;
}

.msgchat-msg {
  word-break: break-word;
  padding: 4px 8px 2px;
  background: #1e293b;
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
}
.msgchat-msg.me   { background: #1e3a8a; }
.msgchat-msg.info { background: #0f172a; }

.msgchat-msg-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: baseline;
}
.msgchat-msg-sender {
  font-weight: 600;
  font-size: 12px;
  flex-shrink: 0;
  color: #93c5fd;
}
.msgchat-msg.me .msgchat-msg-sender { color: #bfdbfe; }
.msgchat-msg.info .msgchat-msg-sender { color: #64748b; }
.msgchat-msg-text {
  font-size: 12px;
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}
.msgchat-msg-time {
  font-size: 9px;
  color: #475569;
  text-align: right;
  display: block;
  padding-top: 1px;
  padding-bottom: 2px;
  user-select: none;
}
.msgchat-msg.me   .msgchat-msg-time { color: #6b9fdb; }
.msgchat-msg.info .msgchat-msg-time { color: #334155; }

/* Input + Send */
.msgchat-input-area {
  padding: 6px 8px;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  background: #0b1220;
  border-top: 1px solid #1e293b;
}
.msgchat-input-area textarea {
  background: #0f172a;
  color: #e2e8f0;
  border: 1px solid #334155;
  resize: none;
  flex: 1;
  height: 44px;
  font-size: 12px;
  padding: 5px 6px;
  box-sizing: border-box;
  border-radius: 4px;
  font-family: inherit;
  line-height: 1.4;
  transition: border-color 0.15s;
}
.msgchat-input-area textarea:focus {
  outline: none;
  border-color: #475569;
}
.msgchat-input-area textarea::placeholder { color: #64748b; }

.msgchat-send-btn {
  width: 34px;
  height: 34px;
  background: #1d4ed8;
  border: 1px solid #1e40af;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  margin-bottom: 5px;
}
.msgchat-send-btn:hover:not(:disabled) { background: #1e40af; }
.msgchat-send-btn:disabled { opacity: 0.35; cursor: default; }
.msgchat-send-btn img { width: 15px; height: 15px; image-rendering: pixelated; }
`;
