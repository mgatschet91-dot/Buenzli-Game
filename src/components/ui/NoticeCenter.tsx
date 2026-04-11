'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Trash2, MapPin, Route, Coins, Gift, Truck, Clock, Check, XCircle, Loader2, Handshake, Glasses } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGame } from '@/context/GameContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { T } from 'gt-next';
import * as partnershipApi from '@/lib/api/partnershipApi';
import { getNotifications, markAllNotificationsRead, deleteNotification, deleteAllNotifications, type ServerNotification } from '@/lib/api/municipalityAdminApi';

// Icon mapping für verschiedene Notification-Typen
const ICON_MAP: Record<string, React.ReactNode> = {
  road: <Route className="w-4 h-4 text-blue-400" />,
  city: <MapPin className="w-4 h-4 text-emerald-400" />,
  money: <Coins className="w-4 h-4 text-amber-400" />,
  gift: <Gift className="w-4 h-4 text-purple-400" />,
  cargo: <Truck className="w-4 h-4 text-orange-400" />,
  partnership: <Handshake className="w-4 h-4 text-cyan-400" />,
  buenzli: <Glasses className="w-4 h-4 text-yellow-400" />,
  default: <Bell className="w-4 h-4 text-slate-400" />,
};

// Zeitformatierung
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Gerade eben';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} Min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} Std`;
  return `${Math.floor(diff / 86400000)} Tage`;
}

interface NoticeCenterProps {
  className?: string;
}

export function NoticeCenter({ className }: NoticeCenterProps) {
  const { state, clearNotifications, addNotification, addMoney, loadPartnershipsFromApi } = useGame();
  const multiplayer = useMultiplayerOptional();
  const isGuestMode = multiplayer?.isViewOnly ?? false;
  
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Partnership requests state
  const [incomingRequests, setIncomingRequests] = useState<partnershipApi.PartnershipRequest[]>([]);
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);
  const [lastRequestCheck, setLastRequestCheck] = useState(0);

  // Server-Benachrichtigungen (persistent)
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  const [serverNotifsLoaded, setServerNotifsLoaded] = useState(false);
  
  // Filter out malformed notifications (where title is an object instead of string)
  // Im Guest-Mode keine Benachrichtigungen anzeigen
  const localNotifications = isGuestMode ? [] : (state.notifications || []).filter(n => 
    typeof n.title === 'string' && typeof n.description === 'string'
  );
  const unreadServerCount = serverNotifications.filter(n => !n.is_read).length;
  const totalUnread = Math.max(0, localNotifications.length - lastSeenCount) + incomingRequests.length + unreadServerCount;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Server-Benachrichtigungen laden
  const loadServerNotifications = useCallback(async () => {
    if (isGuestMode) return;
    try {
      const data = await getNotifications();
      setServerNotifications(data);
      setServerNotifsLoaded(true);
    } catch (err) {
      // Leise fehlschlagen wenn API nicht erreichbar
    }
  }, [isGuestMode]);

  // Einmalig beim Mount laden
  useEffect(() => {
    if (!isGuestMode) {
      loadServerNotifications();
    }
  }, [loadServerNotifications, isGuestMode]);

  // Beim Oeffnen nachladen + als gelesen markieren
  useEffect(() => {
    if (isOpen && !isGuestMode) {
      loadServerNotifications();
      // Ungelesene auf dem Server als gelesen markieren
      if (unreadServerCount > 0) {
        markAllNotificationsRead().then(() => {
          setServerNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        }).catch(() => {});
      }
    }
  }, [isOpen, isGuestMode, loadServerNotifications, unreadServerCount]);

  // Lade eingehende Partnerschaftsanfragen (nicht im Guest-Mode)
  const loadIncomingRequests = useCallback(async () => {
    // Im Guest-Mode keine Anfragen laden
    if (isGuestMode) return;
    
    try {
      const response = await partnershipApi.getMyPartnershipRequests();
      if (response.success) {
        setIncomingRequests(response.data.incoming.filter(r => r.status === 'pending'));
      }
    } catch (error) {
      // API-Endpunkt existiert noch nicht - still ignorieren
      // console.error('Fehler beim Laden der Anfragen:', error);
    }
  }, [isGuestMode]);

  // Periodisch Anfragen laden (alle 30 Sekunden) - nicht im Guest-Mode
  useEffect(() => {
    // Im Guest-Mode kein Polling
    if (isGuestMode) return;
    
    loadIncomingRequests();
    
    const interval = setInterval(() => {
      loadIncomingRequests();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadIncomingRequests, isGuestMode]);

  // Anfrage akzeptieren
  const handleAcceptRequest = async (requestId: number, fromName: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await partnershipApi.respondMyPartnershipRequest(requestId, 'accept');
      if (response.success) {
        setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
        
        // Bonus gutschreiben
        addMoney(5000);
        
        addNotification(
          'Partnerschaft angenommen!',
          `Du bist jetzt Partner mit ${fromName}. +5000 Fr. Bonus und +200 Fr./Monat.`,
          'partnership'
        );
        // Partnerschaften neu laden
        if (loadPartnershipsFromApi) {
          loadPartnershipsFromApi();
        }
      }
    } catch (error) {
      console.error('Fehler beim Akzeptieren:', error);
      addNotification(
        'Fehler',
        `Anfrage konnte nicht akzeptiert werden.`,
        'default'
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  // Anfrage ablehnen
  const handleDeclineRequest = async (requestId: number, fromName: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await partnershipApi.respondMyPartnershipRequest(requestId, 'decline');
      if (response.success) {
        setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
        addNotification(
          'Anfrage abgelehnt',
          `Partnerschaftsanfrage von ${fromName} wurde abgelehnt.`,
          'default'
        );
      }
    } catch (error) {
      console.error('Fehler beim Ablehnen:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  // Schließen wenn außerhalb geklickt
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Wenn geöffnet, als gelesen markieren
  useEffect(() => {
    if (isOpen) {
      setLastSeenCount(localNotifications.length);
    }
  }, [isOpen, localNotifications.length]);

  const handleClearAll = () => {
    if (clearNotifications) {
      clearNotifications();
      setLastSeenCount(0);
    }
    if (serverNotifications.length > 0) {
      deleteAllNotifications().then(() => {
        setServerNotifications([]);
      }).catch(() => {});
    }
  };

  const handleDeleteServerNotification = (id: number) => {
    setServerNotifications(prev => prev.filter(n => n.id !== id));
    deleteNotification(id).catch(() => {});
  };

  const getIcon = (iconName: string) => {
    return ICON_MAP[iconName] || ICON_MAP.default;
  };

  // Panel Position berechnen
  const getPosition = () => {
    if (!buttonRef.current) return { top: 60, right: 16 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    };
  };

  const position = getPosition();

  return (
    <>
      {/* Glocken-Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          'hover:bg-slate-700/50',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          isOpen && 'bg-slate-700/50',
          className
        )}
        aria-label="Benachrichtigungen"
      >
        <Bell className={cn(
          'w-5 h-5 transition-colors',
          totalUnread > 0 ? 'text-primary' : 'text-slate-400'
        )} />
        
        {/* Unread Badge */}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown Panel (Portal) */}
      {mounted && isOpen && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] w-80 max-h-[400px] bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
          style={{
            top: position.top,
            right: position.right,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-medium text-white text-sm">
                <T>Benachrichtigungen</T>
              </span>
              {(localNotifications.length + serverNotifications.length) > 0 && (
                <span className="text-xs text-slate-400">({localNotifications.length + serverNotifications.length})</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(localNotifications.length > 0 || serverNotifications.length > 0) && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors"
                  title="Alle löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[320px]">
            {/* Eingehende Partnerschaftsanfragen */}
            {incomingRequests.length > 0 && (
              <div className="border-b border-cyan-500/30 bg-cyan-900/20">
                <div className="px-4 py-2 text-xs font-medium text-cyan-400 flex items-center gap-2">
                  <Handshake className="w-3 h-3" />
                  <T>Partnerschaftsanfragen</T>
                  <span className="ml-auto bg-cyan-500/30 px-1.5 rounded text-[10px]">
                    {incomingRequests.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="px-4 py-3 bg-cyan-900/10"
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-900/50 border border-cyan-500/30 flex items-center justify-center">
                          <Handshake className="w-4 h-4 text-cyan-400" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-white">
                              {request.from_municipality.name}
                            </h4>
                            <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-slate-500">
                              <Clock className="w-3 h-3" />
                              {formatTime(new Date(request.created_at).getTime())}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            möchte Handelspartner werden
                          </p>
                          {request.from_municipality.owner && (
                            <p className="text-[10px] text-cyan-400/70 mt-0.5">
                              👤 {request.from_municipality.owner.nickname}
                            </p>
                          )}
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => handleAcceptRequest(request.id, request.from_municipality.name)}
                              disabled={processingRequest === request.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded transition-colors disabled:opacity-50"
                            >
                              {processingRequest === request.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              Annehmen
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(request.id, request.from_municipality.name)}
                              disabled={processingRequest === request.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3" />
                              Ablehnen
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Server-Benachrichtigungen (persistent) */}
            {serverNotifications.length > 0 && (
              <div className="divide-y divide-slate-700/50">
                {serverNotifications.map((sn) => (
                  <div
                    key={`srv-${sn.id}`}
                    className={cn(
                      'group px-4 py-3 hover:bg-slate-800/50 transition-colors relative',
                      !sn.is_read && 'bg-amber-900/10 border-l-2 border-l-amber-500/50'
                    )}
                  >
                    <button
                      onClick={() => handleDeleteServerNotification(sn.id)}
                      className="absolute top-2 right-2 p-1 text-slate-600 hover:text-red-400 hover:bg-slate-700/50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Löschen"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                        {getIcon(sn.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-medium text-white truncate">
                            {sn.title}
                          </h4>
                          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatTime(new Date(sn.created_at).getTime())}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {sn.message}
                        </p>
                        {sn.amount != null && sn.amount !== 0 && (
                          <span className={cn(
                            'inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded',
                            sn.amount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          )}>
                            {sn.amount > 0 ? '+' : ''}{sn.amount.toLocaleString()} $
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lokale Benachrichtigungen (Session) */}
            {localNotifications.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {localNotifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'px-4 py-3 hover:bg-slate-800/50 transition-colors',
                      index < (localNotifications.length - lastSeenCount) && 'bg-slate-800/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                        {getIcon(notification.icon)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-medium text-white truncate">
                            {notification.title}
                          </h4>
                          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {notification.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : serverNotifications.length === 0 && incomingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">
                  <T>Keine Benachrichtigungen</T>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  <T>Neue Events erscheinen hier</T>
                </p>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
