'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as chatApi from '@/lib/api/chatApi';

/**
 * Erzeugt einen kurzen Benachrichtigungston via Web Audio API.
 * Klingt wie ein sanfter "Ping" - angenehm und nicht störend.
 */
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Erster Ton (höher)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1); // E6
    gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.3);

    // Zweiter Ton (etwas verzögert, harmonisch)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.08); // E6
    gain2.gain.setValueAtTime(0, audioCtx.currentTime);
    gain2.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.08);
    osc2.stop(audioCtx.currentTime + 0.4);

    // AudioContext nach dem Abspielen aufräumen
    setTimeout(() => {
      audioCtx.close().catch(() => {});
    }, 500);
  } catch {
    // Sound-Fehler ignorieren (z.B. wenn der Browser es blockiert)
  }
}

interface UseChatNotificationsOptions {
  /** Slug der Gemeinde */
  municipalitySlug: string | null;
  /** Ob der Chat-Panel aktuell geöffnet ist */
  isChatOpen: boolean;
  /** Ob der Benutzer im Gastmodus ist (keine Notifications) */
  isGuestMode: boolean;
  /** User-ID des aktuellen Benutzers (eigene Nachrichten erzeugen keinen Sound) */
  currentUserId?: number;
  /** Polling-Intervall in Millisekunden (Standard: 15000 = 15 Sekunden) */
  pollInterval?: number;
}

interface UseChatNotificationsReturn {
  /** Anzahl der ungelesenen Nachrichten */
  unreadCount: number;
  /** Setzt den Unread-Zähler auf 0 zurück (z.B. wenn Chat geöffnet wird) */
  resetUnread: () => void;
}

/**
 * Hook für Chat-Benachrichtigungen.
 * Pollt im Hintergrund nach neuen Nachrichten (wenn der Chat geschlossen ist),
 * zählt ungelesene Nachrichten und spielt einen Sound bei neuen Nachrichten ab.
 */
export function useChatNotifications({
  municipalitySlug,
  isChatOpen,
  isGuestMode,
  currentUserId,
  pollInterval = 15000,
}: UseChatNotificationsOptions): UseChatNotificationsReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastKnownMessageIdRef = useRef<number | null>(null);
  const ownMessageIdsRef = useRef<Set<number>>(new Set());
  const ownChatUserIdRef = useRef<number | null>(null);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const isChatOpenRef = useRef(isChatOpen);

  // isChatOpen Ref aktualisieren (vermeidet unnötige Effect-Reruns)
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Wenn der Chat geöffnet wird, Unread-Counter zurücksetzen
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Eigene gesendete Nachrichten merken, damit sie niemals als "neu von anderen" zählen.
  useEffect(() => {
    const onOwnMessageSent = (event: Event) => {
      const custom = event as CustomEvent<{ messageId?: number; userId?: number }>;
      const messageId = Number(custom.detail?.messageId);
      const userId = Number(custom.detail?.userId);
      if (!Number.isFinite(messageId) || messageId <= 0) return;
      ownMessageIdsRef.current.add(messageId);
      seenMessageIdsRef.current.add(messageId);
      if (Number.isFinite(userId) && userId > 0) {
        ownChatUserIdRef.current = userId;
      }
      if (lastKnownMessageIdRef.current === null || messageId > lastKnownMessageIdRef.current) {
        lastKnownMessageIdRef.current = messageId;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('chat-own-message-sent', onOwnMessageSent as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chat-own-message-sent', onOwnMessageSent as EventListener);
      }
    };
  }, []);

  useEffect(() => {
    if (!municipalitySlug) return;
    // Bei Gemeindewechsel alles zurücksetzen, sonst werden alte IDs falsch übertragen.
    lastKnownMessageIdRef.current = null;
    ownMessageIdsRef.current = new Set();
    seenMessageIdsRef.current = new Set();
    hasInitializedRef.current = false;
    setUnreadCount(0);
  }, [municipalitySlug]);

  // Hintergrund-Polling für neue Nachrichten
  useEffect(() => {
    if (!municipalitySlug || isGuestMode) return;

    const checkForNewMessages = async () => {
      try {
        // Nur die neuesten Nachrichten holen
        const response = await chatApi.getChatMessages(municipalitySlug, {
          limit: 10,
          ...(lastKnownMessageIdRef.current ? { after: lastKnownMessageIdRef.current } : {}),
        });

        if (response.success && response.data.messages.length > 0) {
          const messages = response.data.messages;
          const latestId = messages.reduce((max, msg) => {
            const id = Number(msg?.id || 0);
            return id > max ? id : max;
          }, 0);

          if (!hasInitializedRef.current) {
            // Beim ersten Laden: letzte bekannte ID merken, aber keinen Sound spielen
            lastKnownMessageIdRef.current = latestId;
            for (const msg of messages) {
              const id = Number(msg?.id || 0);
              if (id > 0) seenMessageIdsRef.current.add(id);
            }
            hasInitializedRef.current = true;
            return;
          }

          if (lastKnownMessageIdRef.current !== null && latestId > lastKnownMessageIdRef.current) {
            // Neue Nachrichten gefunden!
            const newMessages = messages.filter(
              m => m.id > (lastKnownMessageIdRef.current ?? 0)
            );

            // Nur zählen, wenn der Chat geschlossen ist
            if (!isChatOpenRef.current) {
              // Nachrichten von anderen Benutzern zählen
              const othersMessages = newMessages.filter((m) => {
                if (seenMessageIdsRef.current.has(m.id)) return false;
                if (ownMessageIdsRef.current.has(m.id)) return false;
                if (typeof currentUserId === 'number' && Number.isFinite(currentUserId)) {
                  return m.user.id !== currentUserId;
                }
                if (ownChatUserIdRef.current !== null) {
                  return m.user.id !== ownChatUserIdRef.current;
                }
                // Fallback: wenn keine valide currentUserId vorhanden ist, nur bekannte eigene IDs ignorieren.
                return true;
              });
              
              if (othersMessages.length > 0) {
                setUnreadCount(prev => prev + othersMessages.length);
                // Sound abspielen
                playNotificationSound();
              }
            }
            for (const m of newMessages) {
              if (m?.id) seenMessageIdsRef.current.add(m.id);
            }
          }

          lastKnownMessageIdRef.current = latestId;
          // Alte IDs aufräumen, um das Set klein zu halten.
          if (ownMessageIdsRef.current.size > 200) {
            const minKeepId = Math.max(0, latestId - 500);
            ownMessageIdsRef.current = new Set(
              Array.from(ownMessageIdsRef.current).filter((id) => id >= minKeepId)
            );
          }
        } else if (response.success && !hasInitializedRef.current) {
          // Keine Nachrichten vorhanden, aber initialisiert
          hasInitializedRef.current = true;
        }
      } catch {
        // Fehler beim Polling ignorieren
      }
    };

    // Sofort einmal prüfen (um die letzte bekannte ID zu initialisieren)
    checkForNewMessages();

    // Polling starten
    pollIntervalRef.current = setInterval(checkForNewMessages, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [municipalitySlug, isGuestMode, currentUserId, pollInterval]);

  // Wenn der Chat geöffnet wird, die letzte bekannte ID aktualisieren
  // damit beim Schließen nicht die bereits gesehenen Nachrichten als "neu" gelten
  useEffect(() => {
    if (!isChatOpen || !municipalitySlug || isGuestMode) return;

    const updateLastKnownId = async () => {
      try {
        const response = await chatApi.getChatMessages(municipalitySlug, { limit: 1 });
        if (response.success && response.data.messages.length > 0) {
          const latestId = response.data.messages.reduce((max, msg) => {
            const id = Number(msg?.id || 0);
            return id > max ? id : max;
          }, 0);
          lastKnownMessageIdRef.current = latestId;
          for (const msg of response.data.messages) {
            const id = Number(msg?.id || 0);
            if (id > 0) seenMessageIdsRef.current.add(id);
          }
        }
      } catch {
        // Fehler ignorieren
      }
    };

    // Kurze Verzögerung, damit der ChatPanel die Nachrichten zuerst laden kann
    const timeout = setTimeout(updateLastKnownId, 1000);
    return () => clearTimeout(timeout);
  }, [isChatOpen, municipalitySlug, isGuestMode]);

  return {
    unreadCount,
    resetUnread,
  };
}
