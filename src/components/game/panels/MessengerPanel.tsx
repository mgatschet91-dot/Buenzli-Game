'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { deltaQueue } from '@/lib/deltaSync';
import { getAuthToken } from '@/lib/api/coreApi';

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
  const [selectedFriendId, setSelectedFriendId] = useState(-1);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const [offlineExpanded, setOfflineExpanded] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messengerSounds, setMessengerSounds] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [profileSearchable, setProfileSearchable] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Lade Freundesliste beim Öffnen + periodischer Refresh
  useEffect(() => {
    deltaQueue.messengerLoadFriends();
    deltaQueue.messengerLoadRequests();
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
        // Merge mit globalem Online-Status-Cache (fängt verpasste Events ab)
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

    window.addEventListener('messenger-friends-list', onFriendsList);
    window.addEventListener('messenger-requests-list', onRequestsList);
    window.addEventListener('messenger-search-results', onSearchResults);
    window.addEventListener('messenger-friend-accepted', onFriendAccepted);
    window.addEventListener('messenger-friend-removed', onFriendRemoved);
    window.addEventListener('messenger-friend-status', onFriendStatus);
    window.addEventListener('messenger-friend-request-received', onNewRequest);
    window.addEventListener('messenger-error', onError);
    return () => {
      window.removeEventListener('messenger-friends-list', onFriendsList);
      window.removeEventListener('messenger-requests-list', onRequestsList);
      window.removeEventListener('messenger-search-results', onSearchResults);
      window.removeEventListener('messenger-friend-accepted', onFriendAccepted);
      window.removeEventListener('messenger-friend-removed', onFriendRemoved);
      window.removeEventListener('messenger-friend-status', onFriendStatus);
      window.removeEventListener('messenger-friend-request-received', onNewRequest);
      window.removeEventListener('messenger-error', onError);
    };
  }, []);

  const onlineFriends = friends.filter(f => f.online);
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
    playReceiveSound();
  };

  const handleDenyRequest = (senderId: number) => {
    deltaQueue.messengerDenyFriend(senderId);
    setRequests(prev => prev.filter(r => r.senderId !== senderId));
  };

  const handleAcceptAll = () => {
    requests.forEach(r => deltaQueue.messengerAcceptFriend(r.senderId));
    setRequests([]);
    playReceiveSound();
  };

  const handleDenyAll = () => {
    requests.forEach(r => deltaQueue.messengerDenyFriend(r.senderId));
    setRequests([]);
  };

  const handleRemoveFriend = () => {
    if (selectedFriendId > 0) {
      deltaQueue.messengerRemoveFriend(selectedFriendId);
      setFriends(prev => prev.filter(f => f.id !== selectedFriendId));
      setSelectedFriendId(-1);
    }
  };

  const handleStartChat = (friendId?: number) => {
    const fid = friendId || selectedFriendId;
    if (fid <= 0) return;
    const friend = friends.find(f => f.id === fid);
    if (friend) onOpenChat(friend.id, friend.name);
  };

  const handleAddFriend = (userId: number) => {
    deltaQueue.messengerSendFriendRequest(userId);
    playSentSound();
  };

  // ─── Render Tabs ─────────────────────────────────────
  const renderFriendsTab = () => {
    if (currentTab !== Tab.Friends) return (
      <div onClick={() => setCurrentTab(Tab.Friends)} className="msg-main-tab msg-selected">
        <span>Freunde</span>
        <button className="msg-open-arrow" />
      </div>
    );
    return (
      <>
        <div onClick={() => setCurrentTab(Tab.Friends)} className="msg-main-tab msg-selected">
          <span>Freunde</span>
          <button className="msg-close-arrow" />
        </div>
        <div className="msg-wrapper">
          <div className="msg-friends-container">
            <button onClick={() => setFriendsExpanded(!friendsExpanded)} className="msg-second-tab">
              Freunde ({onlineFriends.length})
            </button>
            {friendsExpanded && (
              <div className="msg-friend-list">
                {onlineFriends.map(f => (
                  <div key={f.id} className={`msg-friend ${selectedFriendId === f.id ? 'selected' : ''}`} onClick={() => setSelectedFriendId(f.id)}>
                    <span className="msg-friend-status online" />
                    <span className="msg-friend-name">{f.name}</span>
                    <div className="msg-icons">
                      <button onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-player-profile', { detail: { userId: f.id } })); }} className="msg-icon-btn" title="Profil anzeigen">
                        <img src="/images/messenger/open_inbox.png" alt="Profil" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleStartChat(f.id); }} className="msg-icon-btn" title="Chat starten">
                        <img src="/images/messenger/start_chat.png" alt="Chat" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setOfflineExpanded(!offlineExpanded)} className="msg-second-tab">
              Offline ({offlineFriends.length})
            </button>
            {offlineExpanded && (
              <div className="msg-friend-list">
                {offlineFriends.map(f => (
                  <div key={f.id} className={`msg-friend ${selectedFriendId === f.id ? 'selected' : ''}`} onClick={() => setSelectedFriendId(f.id)}>
                    <span className="msg-friend-status offline" />
                    <span className="msg-friend-name">{f.name}</span>
                    <div className="msg-icons">
                      <button onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-player-profile', { detail: { userId: f.id } })); }} className="msg-icon-btn" title="Profil anzeigen">
                        <img src="/images/messenger/open_inbox.png" alt="Profil" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleStartChat(f.id); }} className="msg-icon-btn" title="Nachricht schreiben">
                        <img src="/images/messenger/start_chat.png" alt="Chat" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="msg-actions">
            <button onClick={handleRemoveFriend} title="Freund entfernen">
              <img src="/images/messenger/remove_friend.png" alt="Entfernen" />
            </button>
            <button onClick={() => handleStartChat()} title="Chat öffnen">
              <img src="/images/messenger/open_inbox.png" alt="Chat" />
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderSearchTab = () => {
    const filteredFriends = friends.filter(f => f.name.toLowerCase().includes(searchText.toLowerCase()));

    if (currentTab !== Tab.Search) return (
      <div onClick={() => setCurrentTab(Tab.Search)} className="msg-main-tab">
        <span>Suche</span>
        <button className="msg-open-arrow" />
      </div>
    );
    return (
      <>
        <div onClick={() => setCurrentTab(Tab.Search)} className="msg-main-tab">
          <span>Suche</span>
          <button className="msg-close-arrow" />
        </div>
        <div className="msg-wrapper msg-search">
          <div className="msg-friends-container">
            <button className="msg-second-tab">Freunde ({filteredFriends.length})</button>
            <div className="msg-friend-list">
              {filteredFriends.map(f => (
                <div key={f.id} className="msg-friend">
                  <span className={`msg-friend-status ${f.online ? 'online' : 'offline'}`} />
                  <span className="msg-friend-name">{f.name}</span>
                </div>
              ))}
            </div>
            <button className="msg-second-tab">Andere Spieler ({searchResults.length})</button>
            <div className="msg-friend-list">
              {searchResults.map(r => (
                <div key={r.id} className="msg-friend">
                  <span className="msg-friend-name">{r.name}</span>
                  <div className="msg-icons">
                    <button onClick={() => handleAddFriend(r.id)} className="msg-icon-btn" title="Freundschaftsanfrage senden">
                      <img src="/images/messenger/ask_for_friend.png" alt="Anfrage" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="msg-actions">
            <form onSubmit={handleSearch} style={{ display: 'flex', width: '100%', margin: 'auto' }}>
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Suche..."
                autoComplete="off"
              />
              <button type="submit">Suche</button>
            </form>
          </div>
        </div>
      </>
    );
  };

  const renderRequestsTab = () => {
    const hasRequests = requests.length > 0;
    const tabClass = `msg-main-tab ${hasRequests ? 'msg-active' : ''}`;

    if (currentTab !== Tab.Requests) return (
      <div onClick={() => setCurrentTab(Tab.Requests)} className={tabClass}>
        <span>Anfragen {hasRequests ? `(${requests.length})` : ''}</span>
        <button className="msg-open-arrow" />
      </div>
    );
    return (
      <>
        <div onClick={() => setCurrentTab(Tab.Requests)} className={tabClass}>
          <span>Anfragen ({requests.length})</span>
          <button className="msg-close-arrow" />
        </div>
        <div className="msg-wrapper">
          <div className="msg-friends-container">
            <div className="msg-friend-list">
              {requests.map(r => (
                <div key={r.senderId} className="msg-friend">
                  <span className="msg-friend-name">{r.senderName}</span>
                  <div className="msg-icons">
                    <button onClick={() => handleAcceptRequest(r.senderId)} className="msg-icon-btn" title="Annehmen">
                      <img src="/images/messenger/accept.png" alt="Annehmen" />
                    </button>
                    <button onClick={() => handleDenyRequest(r.senderId)} className="msg-icon-btn" title="Ablehnen">
                      <img src="/images/messenger/decline.png" alt="Ablehnen" />
                    </button>
                  </div>
                </div>
              ))}
              {requests.length === 0 && (
                <div style={{ padding: '10px', color: '#888', textAlign: 'center' }}>Keine Anfragen</div>
              )}
            </div>
          </div>
          <div className="msg-actions msg-requests-actions">
            <button onClick={handleAcceptAll}>
              <img src="/images/messenger/accept.png" alt="Alle annehmen" />
              <span>Alle annehmen</span>
            </button>
            <button onClick={handleDenyAll}>
              <img src="/images/messenger/decline.png" alt="Alle ablehnen" />
              <span>Alle ablehnen</span>
            </button>
          </div>
        </div>
      </>
    );
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

  const renderSettingsTab = () => {
    if (currentTab !== Tab.Settings) return null;

    const toggleItem = (label: string, value: boolean, onChange: (v: boolean) => void, key: string) => (
      <div className="msg-setting-row" key={key}>
        <span>{label}</span>
        <button
          className={`msg-setting-toggle ${value ? 'on' : ''}`}
          onClick={() => { const nv = !value; onChange(nv); saveSettingKey(key, nv); if (key === 'messenger_sounds') localStorage.setItem('meinort-messenger-sounds', String(nv)); }}
        >
          <div className="msg-setting-knob" />
        </button>
      </div>
    );

    return (
      <div className="msg-wrapper msg-settings-wrapper">
        <div className="msg-settings-list">
          {toggleItem('Messenger-Sounds', messengerSounds, setMessengerSounds, 'messenger_sounds')}
          {toggleItem('Freundschaftsanfragen erlauben', allowFriendRequests, setAllowFriendRequests, 'allow_friend_requests')}
          {toggleItem('Profil in Suche sichtbar', profileSearchable, setProfileSearchable, 'profile_searchable')}
        </div>
      </div>
    );
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
        <button className="msg-close-btn" onClick={onClose}>X</button>
        <h2 className="msg-title">Freunde</h2>
        {currentTab !== Tab.Settings && renderFriendsTab()}
        {currentTab !== Tab.Settings && renderSearchTab()}
        {currentTab !== Tab.Settings && renderRequestsTab()}
        {renderSettingsTab()}
        {errorMsg && (
          <div className="msg-error">{errorMsg}</div>
        )}
        <div className="msg-footer">
          <button onClick={() => {
            if (currentTab === Tab.Settings) { setCurrentTab(Tab.Friends); }
            else { loadSettings(); setCurrentTab(Tab.Settings); }
          }}>
            <img src="/images/messenger/open_edit_ctgs.png" alt="Settings" />
            <span>{currentTab === Tab.Settings ? 'Zurück' : 'Einstellungen'}</span>
          </button>
        </div>
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
}

export function MessengerChatPanel({ initialFriendId, initialFriendName, onClose }: MessengerChatPanelProps) {
  const { ref, pos, zIndex, bringToFront } = useDraggable('.msgchat-title');

  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [currentChatFriendId, setCurrentChatFriendId] = useState(initialFriendId);
  const [text, setText] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

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
        // Sound abspielen wenn Nachricht von anderem User
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

    window.addEventListener('messenger-chat-opened', onChatOpened);
    window.addEventListener('messenger-message', onMessage);
    return () => {
      window.removeEventListener('messenger-chat-opened', onChatOpened);
      window.removeEventListener('messenger-message', onMessage);
    };
  }, [currentChatFriendId, scrollDown]);

  const currentChat = activeChats.find(c => c.friendId === currentChatFriendId);
  const myUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || '0') : 0;

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

  const handleTabChange = (friendId: number) => {
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
  };

  // Externe Chat-Öffnung erlauben
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
        <button className="msgchat-close-btn" onClick={onClose}>X</button>
        <h2 className="msgchat-title">{title}</h2>
        <div className="msgchat-tabs">
          {activeChats.map(c => (
            <button
              key={c.friendId}
              className={`${c.friendId === currentChatFriendId ? 'selected' : ''} ${c.unread ? 'alert' : ''}`}
              onClick={() => handleTabChange(c.friendId)}
              title={c.friendName}
            >
              <span className="msgchat-tab-initial">{c.friendName.charAt(0).toUpperCase()}</span>
            </button>
          ))}
        </div>
        <div className="msgchat-actions-bar">
          <button onClick={handleCloseChat} className="msgchat-close-chat" title="Chat schließen">
            <img src="/images/messenger/close.png" alt="Close" />
          </button>
        </div>
        <div className="msgchat-messages" ref={chatRef}>
          {currentChat?.messages.map((msg, i) => {
            let className = 'msgchat-msg';
            if (msg.type === 'system') className += ' info';
            else if (msg.senderId === myUserId) className += ' me';
            return (
              <p key={msg.id || i} className={className}>
                {msg.type !== 'system' && <strong>{msg.senderName}: </strong>}
                {msg.text}
              </p>
            );
          })}
          {(!currentChat || currentChat.messages.length === 0) && (
            <p className="msgchat-msg info">Starte eine Unterhaltung...</p>
          )}
        </div>
        <div className="msgchat-input-area">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Nachricht schreiben..."
          />
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

  // Globaler Listener: Sound + Notification + Online-Status-Tracking
  // Läuft IMMER, egal ob Messenger offen oder geschlossen
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
      }
    };
    const onFriendsList = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.friends) {
        for (const f of data.friends) {
          _friendOnlineCache.set(Number(f.id), Boolean(f.online));
        }
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
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ══ CSS (Habbo-Original Style) ═════════════════════════════
// ═══════════════════════════════════════════════════════════

const messengerCSS = `
/* ─── Messenger Panel ─────────────────────────── */
.msg-panel {
  position: fixed;
  left: 260px;
  top: 80px;
  width: 280px;
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
  border: 1px solid #334155;
  box-sizing: content-box;
  border-radius: 10px;
  text-align: center;
  padding: 0;
  padding-top: 8px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 12px;
  user-select: none;
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.55);
}

.msg-close-btn {
  position: absolute;
  top: 5px;
  right: 4px;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  color: #94a3b8;
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
}
.msg-close-btn:hover { color: #f1f5f9; }

.msg-title {
  font-size: 13px;
  font-weight: bold;
  margin: 0 0 8px;
  color: #f8fafc;
  cursor: grab;
  user-select: none;
  padding: 2px 0;
}
.msg-title:active { cursor: grabbing; }

/* Tabs */
.msg-main-tab {
  cursor: pointer;
  width: 100%;
  background: #1e293b;
  height: 26px;
  box-sizing: border-box;
  border-top: 1px solid rgba(51, 65, 85, 0.8);
  border-bottom: 1px solid rgba(51, 65, 85, 0.8);
  color: #cbd5e1;
  display: flex;
  align-items: center;
  font-size: 12px;
}
.msg-main-tab.msg-selected {
  background: #0f172a;
  color: #f8fafc;
}
.msg-main-tab.msg-active {
  background: #7c2d12;
  color: #ffedd5;
}
.msg-main-tab span { margin: auto 10px; }

.msg-main-tab button {
  border: none;
  background: none;
  margin: auto 0;
  padding: 0;
}
.msg-open-arrow {
  width: 9px;
  height: 5px;
  background-image: url('/images/messenger/arrow_down_white.png');
  background-repeat: no-repeat;
  background-size: contain;
}
.msg-close-arrow {
  width: 5px;
  height: 9px;
  background-image: url('/images/messenger/arrow_right_white.png');
  background-repeat: no-repeat;
  background-size: contain;
}
.msg-main-tab.msg-selected .msg-open-arrow { background-image: url('/images/messenger/arrow_down_white.png'); }
.msg-main-tab.msg-selected .msg-close-arrow { background-image: url('/images/messenger/arrow_right_white.png'); }

/* Wrapper */
.msg-wrapper {
  background: #0f172a;
  height: 240px;
  padding: 5px;
  box-sizing: border-box;
}
.msg-wrapper.msg-search { background: #0b1220; }

.msg-second-tab {
  background: #1e293b;
  color: #e2e8f0;
  width: 100%;
  text-align: left;
  font-size: 12px;
  height: 24px;
  border: 1px solid #334155;
  font-weight: bold;
  cursor: pointer;
  padding: 0 6px;
}
.msg-wrapper.msg-search .msg-second-tab { background: #172033; }

.msg-friends-container {
  overflow-y: auto;
  height: 192px;
}

.msg-friend-list {
  display: flex;
  flex-direction: column;
}
.msg-friend {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  color: #e2e8f0;
  overflow: hidden;
  cursor: pointer;
  padding: 0 4px;
  box-sizing: border-box;
  gap: 3px;
}
.msg-friend:nth-child(even) { background: rgba(30, 41, 59, 0.45); }
.msg-friend:hover, .msg-friend.selected { background: #1d4ed8; color: #eff6ff; }

.msg-friend-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  flex-shrink: 0;
}
.msg-friend-status.online { background: #3c3; border: 1px solid #2a2; }
.msg-friend-status.offline { background: #64748b; border: 1px solid #475569; }

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
  gap: 3px;
  margin-left: auto;
  flex-shrink: 0;
}
.msg-icon-btn {
  border: none;
  background: none;
  padding: 1px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: background 0.15s;
}
.msg-icon-btn:hover {
  background: rgba(148, 163, 184, 0.22);
}
.msg-icon-btn img {
  width: 16px;
  height: 15px;
  display: block;
  image-rendering: pixelated;
}

/* Actions Bar */
.msg-actions {
  margin-top: 4px;
  background: rgba(15, 23, 42, 0.92);
  height: 36px;
  border-radius: 4px;
  border: 1px solid #334155;
  display: flex;
  padding: 3px 5px;
  box-sizing: border-box;
  gap: 4px;
}
.msg-actions button {
  border: 1px solid #334155;
  background: #1e293b;
  color: #e2e8f0;
  min-width: 28px;
  height: 24px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  gap: 3px;
}
.msg-actions button:hover { background: #334155; }
.msg-actions img { width: 14px; height: 14px; }

.msg-actions input {
  height: 22px;
  flex: 1;
  border: 1px solid #475569;
  border-radius: 3px;
  font-size: 12px;
  padding: 0 5px;
  color: #e2e8f0;
  background: #0f172a;
}
.msg-actions input::placeholder { color: #94a3b8; }
.msg-actions form { display: flex; width: 100%; gap: 4px; }

.msg-requests-actions button {
  margin: auto;
  width: 45%;
}

/* Settings */
.msg-settings-wrapper {
  height: 240px;
  display: flex;
  flex-direction: column;
}
.msg-settings-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.msg-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px;
  background: #1e293b;
  font-size: 12px;
  color: #e2e8f0;
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
.msg-setting-toggle.on {
  background: #3c3;
  border-color: #2a2;
}
.msg-setting-knob {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.3);
  position: absolute;
  top: 1px;
  left: 1px;
  transition: transform 0.2s;
}
.msg-setting-toggle.on .msg-setting-knob {
  transform: translateX(16px);
}

/* Error */
.msg-error {
  background: #b91c1c;
  color: #fff;
  font-size: 11px;
  padding: 4px 8px;
  text-align: center;
  font-weight: 600;
  animation: msg-error-fade 0.3s ease-out;
}
@keyframes msg-error-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Footer */
.msg-footer {
  display: flex;
  height: 42px;
}
.msg-footer button {
  background: #1e293b;
  color: #e2e8f0;
  font-size: 11px;
  width: 100px;
  height: 28px;
  border: 1px solid #334155;
  border-radius: 3px;
  margin: auto 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  cursor: pointer;
}
.msg-footer button:hover { background: #334155; }
.msg-footer button img { width: 12px; height: 12px; }
`;

const chatCSS = `
/* ─── Chat Panel ──────────────────────────────── */
.msgchat-panel {
  position: fixed;
  left: 510px;
  top: 80px;
  width: 280px;
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
  border: 1px solid #334155;
  box-sizing: content-box;
  border-radius: 10px;
  text-align: center;
  padding: 0;
  padding-top: 8px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 12px;
  user-select: none;
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.55);
}

.msgchat-close-btn {
  position: absolute;
  top: 5px;
  right: 4px;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  color: #94a3b8;
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
}
.msgchat-close-btn:hover { color: #f8fafc; }

.msgchat-title {
  font-size: 13px;
  font-weight: bold;
  margin: 0 0 5px;
  color: #f8fafc;
  cursor: grab;
  user-select: none;
}
.msgchat-title:active { cursor: grabbing; }

/* Chat-Tabs */
.msgchat-tabs {
  height: 32px;
  background: #1e293b;
  display: flex;
  border-bottom: 1px solid #334155;
}
.msgchat-tabs button {
  height: 32px;
  width: 30px;
  padding: 0;
  border: 1px solid #334155;
  border-left: none;
  background: inherit;
  color: #cbd5e1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.msgchat-tabs button.alert {
  background: #1d4ed8;
}
.msgchat-tabs button.selected,
.msgchat-tabs button:hover {
  background: #0f172a;
  border-bottom-color: #0f172a;
}
.msgchat-tab-initial {
  font-weight: bold;
  font-size: 12px;
  color: #e2e8f0;
}

/* Actions */
.msgchat-actions-bar {
  background: #0f172a;
  height: 28px;
  display: flex;
  padding: 3px 5px;
  justify-content: flex-end;
}
.msgchat-close-chat {
  border: none !important;
  background: none !important;
  cursor: pointer;
  padding: 0;
}
.msgchat-close-chat img { width: 14px; height: 14px; }

/* Messages */
.msgchat-messages {
  height: 240px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-y: auto;
  padding: 0 5px;
  text-align: left;
}
.msgchat-msg {
  word-break: break-word;
  margin: 0;
  padding: 4px 6px;
  background: #1e293b;
  font-size: 12px;
  line-height: 1.4;
  border-bottom: 1px solid rgba(51, 65, 85, 0.45);
}
.msgchat-msg.me { background: #1d4ed8; color: #eff6ff; }
.msgchat-msg.info { background: #172033; color: #94a3b8; }
.msgchat-msg strong { font-weight: 600; }

/* Input */
.msgchat-input-area {
  padding: 8px;
}
.msgchat-input-area textarea {
  background: #0b1220;
  color: #e2e8f0;
  border: 1px solid #475569;
  resize: none;
  width: 100%;
  height: 44px;
  font-size: 12px;
  padding: 4px;
  box-sizing: border-box;
  border-radius: 3px;
  font-family: inherit;
}
.msgchat-input-area textarea::placeholder { color: #94a3b8; }
`;
