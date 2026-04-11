'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { deltaQueue } from '@/lib/deltaSync';
import { loadAvatarAppearanceFromStorage } from '@/lib/avatarConfig';
import { requestAvatarCanvas } from '@/lib/avatarImager/avatarRenderer';

type FooterPanel = 'navigator' | 'chat' | 'settings' | 'messenger';

interface FooterButton {
  id: FooterPanel | 'home';
  icon: string;
  alt: string;
  title: string;
}

const LEFT_BUTTONS: FooterButton[] = [
  { id: 'home', icon: '/images/bottom_bar/logo.png', alt: 'Home', title: 'Zurück' },
  { id: 'navigator', icon: '/images/bottom_bar/rooms.png', alt: 'Rooms', title: 'Navigator' },
];

const RIGHT_BUTTONS: FooterButton[] = [
  { id: 'messenger', icon: '/images/bottom_bar/all_friends.png', alt: 'Freunde', title: 'Messenger' },
  { id: 'settings', icon: '/images/bottom_bar/messenger.png', alt: 'Settings', title: 'Einstellungen' },
];

const MAX_CHAT_LENGTH = 95;

interface PublicRoomFooterBarProps {
  onBackToHome?: () => void;
  onToggleMessenger?: () => void;
}

/**
 * Rendert den Avatar-Kopf des Spielers als Data-URL.
 * Da requestAvatarCanvas asynchron lädt (gibt beim ersten Mal null zurück),
 * wird mehrfach gepollt bis das Canvas verfügbar ist.
 */
function useAvatarHeadUrl(): string | null {
  const [headUrl, setHeadUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const tryRender = () => {
      if (cancelled || attempts >= maxAttempts) return;
      attempts++;
      try {
        const config = loadAvatarAppearanceFromStorage();
        const figure = config?.figure;
        if (!figure) return;
        const canvas = requestAvatarCanvas(figure, 2, 'std', 0);
        if (canvas) {
          setHeadUrl(canvas.toDataURL('image/png'));
          return;
        }
        setTimeout(tryRender, 500);
      } catch {
        // Fallback → ghosthead
      }
    };

    tryRender();
    return () => { cancelled = true; };
  }, []);

  return headUrl;
}

export function PublicRoomFooterBar({ onBackToHome, onToggleMessenger }: PublicRoomFooterBarProps) {
  const { state, setActivePanel } = useGame();
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarHeadUrl = useAvatarHeadUrl();

  const focusChatInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(focusChatInput, 300);
    return () => clearTimeout(timer);
  }, [focusChatInput]);

  const [messengerAlert, setMessengerAlert] = useState(false);

  // Messenger-Benachrichtigungs-Listener
  useEffect(() => {
    const onUnread = () => setMessengerAlert(true);
    window.addEventListener('messenger-has-unread', onUnread);
    window.addEventListener('messenger-friend-request-received', onUnread);
    return () => {
      window.removeEventListener('messenger-has-unread', onUnread);
      window.removeEventListener('messenger-friend-request-received', onUnread);
    };
  }, []);

  const handleButtonClick = (btn: FooterButton) => {
    if (btn.id === 'home') {
      onBackToHome?.();
      return;
    }
    if (btn.id === 'messenger') {
      setMessengerAlert(false);
      onToggleMessenger?.();
      return;
    }
    if (state.activePanel === btn.id) {
      setActivePanel('none');
    } else {
      setActivePanel(btn.id);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      deltaQueue.sendRoomChat(text);
      setChatText('');
    } catch (err) {
      console.error('[PublicRoomFooterBar] Chat senden fehlgeschlagen:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {/* Inline-Styles die exakt dem Habbo-Original entsprechen */}
      <style>{`
        .hbb-footer {
          background-color: #1d1e21;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          width: 100%;
          display: flex;
          z-index: 50;
        }
        .hbb-footer .footer_container {
          width: 100%;
          margin: 0 auto;
          display: flex;
        }
        .hbb-footer .left_section {
          display: flex;
          margin: auto;
          width: 20%;
        }
        .hbb-footer .middle_section {
          display: flex;
          margin: auto;
          width: 50%;
          justify-content: center;
        }
        @media (max-width: 1000px) {
          .hbb-footer .middle_section {
            position: absolute;
            bottom: 70px;
            left: 50%;
            transform: translateX(-50%);
            width: auto;
            background: #1d1e21;
            border-radius: 12px;
            padding: 6px 10px;
            box-shadow: 0 -2px 12px rgba(0,0,0,0.5);
          }
          .hbb-footer .middle_section input[type=text] {
            width: 100% !important;
            min-width: 200px;
          }
        }
        .hbb-footer .right_section {
          display: flex;
          margin: auto;
          width: 20%;
          justify-content: flex-end;
        }
        .hbb-footer button {
          padding: 0 12px;
          margin: auto 0;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
        }
        .hbb-footer button:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .hbb-footer button.active {
          background-color: rgba(255, 255, 255, 0.15);
        }
        .hbb-footer button .active-dot {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #fff;
        }
        .hbb-footer button.user_face {
          padding: 0;
        }
        .hbb-footer button.user_face img {
          object-fit: none;
          object-position: 42% 27%;
          width: 40px;
          height: 37px;
        }
        .hbb-footer .avatar-head-rendered {
          width: 40px;
          height: 50px;
          object-fit: cover;
          object-position: center 15%;
          image-rendering: pixelated;
          padding: 0;
          border-radius: 2px;
        }
        .hbb-footer form {
          display: inline-flex;
          align-items: center;
        }
        .hbb-footer input[type=text] {
          width: 350px;
          font: inherit;
          height: 40px;
          padding: 0 0.5em;
          border-radius: 7px;
          box-sizing: border-box;
          color: #000000;
          border: 1px solid #999999;
          margin: 0 0 0 12px;
          background: #ffffff;
          outline: none;
          font-size: 14px;
        }
        .hbb-footer input[type=text]:focus {
          border-color: #6c9bd2;
          box-shadow: 0 0 0 2px rgba(108, 155, 210, 0.3);
        }
        .hbb-footer input[type=text]::placeholder {
          color: #777777;
        }
        .hbb-footer button[type=submit]:disabled {
          opacity: 0.35;
          cursor: default;
        }
        .hbb-footer button img {
          display: block;
        }
      `}</style>

      <footer className="hbb-footer">
        <div className="footer_container">
          {/* Left Section - Navigation Icons */}
          <div className="left_section">
            {LEFT_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleButtonClick(btn)}
                title={btn.title}
                className={state.activePanel === btn.id ? 'active' : ''}
              >
                <img src={btn.icon} alt={btn.alt} draggable={false} />
                {state.activePanel === btn.id && <span className="active-dot" />}
              </button>
            ))}
          </div>

          {/* Middle Section - Avatar Head + Chat Input */}
          <div className="middle_section">
            {/* Avatar-Kopf des Spielers (wie Habbo user_face) */}
            {avatarHeadUrl ? (
              <button className="user_face" title="Mein Avatar">
                <img
                  src={avatarHeadUrl}
                  alt="Me"
                  className="avatar-head-rendered"
                  draggable={false}
                />
              </button>
            ) : (
              <button className="user_face" title="Mein Avatar">
                <img src="/images/bottom_bar/ghosthead.png" alt="Me" draggable={false} />
              </button>
            )}

            {/* Chat-Eingabe - exakt wie im Habbo-Original */}
            <form onSubmit={handleChatSubmit}>
              <input
                ref={inputRef}
                type="text"
                name="chat"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                maxLength={MAX_CHAT_LENGTH}
                autoComplete="off"
                placeholder="Klicke hier zum Chatten"
              />
              <button
                type="submit"
                disabled={sending || chatText.trim().length === 0}
                title="Senden"
              >
                <img src="/images/bottom_bar/chat_styles.png" alt="Chat styles" draggable={false} />
              </button>
            </form>
          </div>

          {/* Right Section */}
          <div className="right_section">
            {RIGHT_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleButtonClick(btn)}
                title={btn.title}
                className={state.activePanel === btn.id ? 'active' : ''}
                style={{ position: 'relative' }}
              >
                <img
                  src={btn.id === 'messenger' && messengerAlert ? '/images/bottom_bar/messenger_notify0.png' : btn.icon}
                  alt={btn.alt}
                  draggable={false}
                  onError={(e) => { (e.target as HTMLImageElement).src = btn.icon; }}
                />
                {btn.id === 'messenger' && messengerAlert && (
                  <span style={{
                    position: 'absolute', top: 4, right: 6,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#ff4444', border: '1px solid #fff',
                  }} />
                )}
                {state.activePanel === btn.id && <span className="active-dot" />}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
