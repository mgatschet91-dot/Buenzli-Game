'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/coreApi';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const WS_URL   = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://127.0.0.1:4100';

interface RoomGeometry {
  grid_size:   number;
  wall_n:      number; wall_s: number; wall_e: number; wall_w: number;
  door_wall:   string; door_offset: number; door_width: number; door_height: number;
  floors:      unknown[];
  staircases:  unknown[];
}

export interface IsometricRoomViewerProps {
  /** Room model name — maps to a ROOM_TEMPLATES entry in game3d.js */
  modelName: string;
  /** pipe-separated avatar code: skinHex|hairHex|hairStyle|... */
  avatarCode: string | null;
  /** Room geometry from SQL (grid, walls, stairs, floors) */
  geometry?: RoomGeometry;
  /** User-id of the room owner (for loading & saving furniture) */
  ownerId?: number;
  /** Whether the current viewer is the room owner (gates furniture placement) */
  isOwner?: boolean;
  /** Municipality slug for socket room join (enables real-time multi-player sync) */
  municipalitySlug?: string;
  /** Room code for socket room join (default: 'HOME_{ownerId}') */
  roomCode?: string;
  /** Name des lokalen Spielers (für Namensschild über Avatar) */
  playerName?: string;
  /** Name des Raum-Eigentümers (für Besitzer-Anzeige im Möbel-Panel) */
  ownerNickname?: string;
  onAvatarChange?: (avatarCode: string) => void;
  onReady?: () => void;
  /** Teleportation in einen anderen Raum (cross-room) */
  onTeleportToRoom?: (userId: number) => void;
  /** Spieler läuft durch die Tür hinaus */
  onExit?: () => void;
  /** Besucher-Liste geändert (für Moderations-Panel) */
  onVisitorsChange?: (visitors: { playerId: string; userId: number | null; name: string }[]) => void;
  /** Jemand klopft an (nur für Eigentümer) */
  onKnockReceived?: (fromUserId: number, fromNickname: string) => void;
  /** Ref um Knock-Accept/Decline via Socket zu senden */
  knockSocketRef?: React.MutableRefObject<{ accept: (uid: number) => void; decline: (uid: number) => void } | null>;
}

export function IsometricRoomViewer({
  modelName,
  avatarCode,
  geometry,
  ownerId,
  isOwner,
  municipalitySlug,
  roomCode,
  playerName,
  ownerNickname,
  onAvatarChange,
  onReady,
  onTeleportToRoom,
  onExit,
  onVisitorsChange,
  onKnockReceived,
  knockSocketRef,
}: IsometricRoomViewerProps) {
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const readyRef       = useRef(false);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [lockedDialog, setLockedDialog] = useState<{ needsPassword: boolean; knocking?: boolean; declined?: boolean } | null>(null);
  const [pwInput, setPwInput] = useState('');
  const pwInputRef = useRef('');
  const [placements, setPlacements] = useState<unknown[]>([]);
  const placementsRef  = useRef<unknown[]>([]);
  // Möbel-Katalog aus SQL (shop_items Tabelle) — wird einmalig geladen
  const catalogRef     = useRef<unknown[]>([]);
  // Avatar-Code aus SQL (users.avatar_code) — Fallback wenn prop leer
  const sqlAvatarRef   = useRef<string | null>(null);
  // Room NPCs aus SQL
  const npcsRef        = useRef<unknown[]>([]);
  // Socket.IO Verbindung für Echtzeit-Möbel-Sync
  const socketRef        = useRef<Socket | null>(null);
  // Lokale PlayerId (vom Server nach room-joined)
  const localPlayerIdRef = useRef<string | null>(null);
  // Aktueller Avatar-Code (immer aktuell via Ref, kein Stale-Closure Problem)
  const liveAvatarCodeRef = useRef<string | null>(null);
  // Ob wir dem Raum bereits beigetreten sind
  const roomJoinedRef    = useRef(false);
  // Aktueller Spawn-Punkt + Richtung (aus CHAR_SPAWN_POS von game3d)
  const spawnPosRef      = useRef<{ x: number; z: number; dir: number }>({ x: 0, z: 0, dir: 0 });
  // Gepufferte avatars-snapshot (falls vor ROOM_READY angekommen)
  const pendingAvatarsRef = useRef<unknown[] | null>(null);
  // Gepufferte avatar-spawned events (falls vor ROOM_READY angekommen)
  const pendingSpawnsRef  = useRef<unknown[]>([]);
  // Gepuffertes LOCAL_PLAYER_PROFILE (falls vor ROOM_READY angekommen)
  const pendingProfileRef = useRef<object | null>(null);
  // Immer aktueller Spielername (kein Stale-Closure in async Callbacks)
  const playerNameRef    = useRef<string>(playerName || '');
  // pair_id des aktuell platzierten Teleporters (gesetzt via __TELEPORTER_PAIR_SET)
  const pendingTeleporterPairIdRef = useRef<number | null>(null);
  // Passwort für passwortgeschützte Räume
  const roomPasswordRef = useRef<string>('');
  // Besucher-Map: playerId → { userId, name } für Moderations-Panel
  const visitorsRef = useRef<Map<string, { userId: number | null; name: string }>>(new Map());
  const onVisitorsChangeRef = useRef(onVisitorsChange);
  onVisitorsChangeRef.current = onVisitorsChange;
  const onKnockReceivedRef = useRef(onKnockReceived);
  onKnockReceivedRef.current = onKnockReceived;

  // Avatar-Prop → liveRef aktualisieren + evtl. Spawn nachholen
  useEffect(() => {
    if (!avatarCode) return;
    liveAvatarCodeRef.current = avatarCode;
    if (roomJoinedRef.current) {
      const sp = spawnPosRef.current;
      socketRef.current?.emit('avatar-spawn-request', {
        x: sp.x, y: sp.z,
        name: playerNameRef.current || playerName || '',
        avatarConfig: { avatar_code: avatarCode },
      });
    }
  }, [avatarCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // playerNameRef immer aktuell halten + Spawn updaten wenn echter Name nachgeladen
  useEffect(() => {
    playerNameRef.current = playerName || '';
    // Iframe informieren (Namensschild über eigenem Avatar)
    if (playerName && readyRef.current) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'LOCAL_PLAYER_NAME', name: playerName }, '*');
    }
    // Nur Socket-Update wenn echter Name (nicht leer) und Raum bereits beigetreten
    if (!playerName || !roomJoinedRef.current) return;
    const code = liveAvatarCodeRef.current ?? sqlAvatarRef.current ?? null;
    const sp = spawnPosRef.current;
    socketRef.current?.emit('avatar-spawn-request', {
      x: sp.x, y: sp.z,
      name: playerName,
      avatarConfig: code ? { avatar_code: code } : undefined,
    });
  }, [playerName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Katalog aus SQL laden (GET /api/game/shop/furniture) ─────────────────
  useEffect(() => {
    async function fetchCatalog() {
      try {
        const r = await fetch(`${API_BASE}/api/game/shop/furniture`);
        const d = await r.json();
        if (d.ok && Array.isArray(d.data?.items)) {
          catalogRef.current = d.data.items;
        }
      } catch { /* ignore */ }
    }
    fetchCatalog();
  }, []);

  // ── Avatar aus SQL laden (GET /api/game/user/avatar) — falls prop leer ───
  useEffect(() => {
    if (avatarCode) return; // prop hat Vorrang
    async function fetchAvatar() {
      try {
        const token = getAuthToken() || '';
        if (!token) return;
        const r = await fetch(`${API_BASE}/api/game/user/avatar`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        });
        const d = await r.json();
        if (d.ok && d.data?.avatar_code) {
          const code = d.data.avatar_code;
          sqlAvatarRef.current = code;
          liveAvatarCodeRef.current = code;
          // Falls Iframe bereits bereit: Avatar sofort setzen
          if (readyRef.current) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'AVATAR_SET', avatar_code: code },
              '*'
            );
          }
          // Falls Raum bereits beigetreten aber Avatar noch nicht gespawnt: nachholen
          if (roomJoinedRef.current) {
            const sp = spawnPosRef.current;
            socketRef.current?.emit('avatar-spawn-request', {
              x: sp.x, y: sp.z,
              name: playerNameRef.current || playerName || '',
              avatarConfig: { avatar_code: code },
            });
          }
        }
      } catch { /* ignore */ }
    }
    fetchAvatar();
  }, [avatarCode]);

  // ── Möbel-Platzierungen aus SQL laden (nur wenn kein Socket aktiv) ──────
  useEffect(() => {
    // Wenn Socket-Modus aktiv oder PUB-Raum: kein HTTP-Fetch nötig
    const isPubRoomCode = (roomCode || '').toUpperCase().startsWith('PUB');
    if (isPubRoomCode || !ownerId || (municipalitySlug && ownerId)) {
      console.log('[RoomViewer] HTTP furniture fetch SKIPPED — socket mode active or no owner');
      return;
    }
    async function fetchPlacements() {
      try {
        const token = getAuthToken() || '';
        const params = new URLSearchParams();
        if (ownerId) params.set('user_id', String(ownerId));
        if (municipalitySlug) params.set('municipality_slug', municipalitySlug);
        const url = `${API_BASE}/api/game/user/room/furniture?${params.toString()}`;
        console.log('[RoomViewer] HTTP furniture fetch START, readyRef:', readyRef.current);
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        });
        const d = await r.json();
        if (d.ok) {
          console.log('[RoomViewer] HTTP furniture fetch DONE, count:', d.data.placements?.length, 'readyRef:', readyRef.current);
          placementsRef.current = d.data.placements;
          setPlacements(d.data.placements);
        }
      } catch { /* ignore */ }
    }
    fetchPlacements();
  }, [ownerId, municipalitySlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Room NPCs aus SQL laden ─────────────────────────────────────────────
  useEffect(() => {
    // PUB rooms have no personal NPCs; skip to avoid loading visitor's own NPCs
    const isPubRoomCode = (roomCode || '').toUpperCase().startsWith('PUB');
    if (isPubRoomCode || !ownerId) {
      npcsRef.current = [];
      return;
    }
    async function fetchNpcs() {
      try {
        const token = getAuthToken() || '';
        const params = new URLSearchParams();
        params.set('user_id', String(ownerId));
        if (municipalitySlug) params.set('municipality_slug', municipalitySlug);
        const url = `${API_BASE}/api/game/user/room/npcs?${params.toString()}`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        });
        const d = await r.json();
        if (d.ok) npcsRef.current = d.data.npcs;
      } catch { /* ignore */ }
    }
    fetchNpcs();
  }, [ownerId, municipalitySlug, roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket.IO Verbindung für Echtzeit-Möbel-Sync ─────────────────────────
  useEffect(() => {
    // PUB rooms can connect via socket with just roomCode + municipalitySlug (no personal ownerId needed)
    const isPubRoom = (roomCode || '').toUpperCase().startsWith('PUB');
    if (!municipalitySlug || (!ownerId && !isPubRoom)) return;
    const effectiveRoomCode = roomCode || `H${ownerId}`;
    const token = getAuthToken() || '';

    const sock = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = sock;

    sock.on('connect', () => {
      console.log('[RoomViewer] Socket connected, joining room:', effectiveRoomCode, municipalitySlug);
      // Kein authToken! Sonst kickt der Server den bestehenden Haupt-Socket (DeltaQueue)
      // da er denkt es ist eine zweite Anmeldung desselben Users.
      const _joinToken = getAuthToken() || (typeof localStorage !== 'undefined' ? localStorage.getItem('isocity_auth_token') : '') || '';
      sock.emit('join-room', {
        roomCode:        effectiveRoomCode,
        municipalitySlug,
        name:            playerNameRef.current || playerName || '',
        ownerUserId:     ownerId,
        isViewOnly:      !isOwner,
        isRoomViewer:    true,
        authToken:       _joinToken,
        roomPassword:    roomPasswordRef.current || undefined,
      });
    });

    // Room joined → Flags setzen + Avatar spawnen + eigenes Profil laden
    sock.on('room-joined', (data: { playerId: string }) => {
      localPlayerIdRef.current = data.playerId;
      roomJoinedRef.current = true;
      const code = liveAvatarCodeRef.current ?? sqlAvatarRef.current ?? null;
      const sp = spawnPosRef.current;
      // Nur spawnen wenn CHAR_SPAWN_POS bereits eine echte Position geliefert hat.
      // Sonst spawnt CHAR_SPAWN_POS sobald game3d bereit ist — verhindert kurzes Aufflackern in der Mitte.
      if (sp.x !== 0 || sp.z !== 0) {
        sock.emit('avatar-spawn-request', {
          x: sp.x, y: sp.z, dir: sp.dir,
          name: playerNameRef.current || playerName || '',
          avatarConfig: code ? { avatar_code: code } : undefined,
        });
      }
      // Eigenes Profil laden und ans Iframe schicken (Motto, Gemeinde, Level fürs eigene Panel)
      const token = getAuthToken() || (typeof localStorage !== 'undefined' ? localStorage.getItem('isocity_auth_token') : '') || '';
      if (token) {
        fetch(`${API_BASE}/api/users/me/profile`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        }).then(r => r.json()).then(json => {
          if (!json.ok) return;
          const msg = {
            type: 'LOCAL_PLAYER_PROFILE',
            motto: json.data.motto || null,
            municipalityName: json.data.municipality_name || null,
            userLevel: json.data.level ?? 1,
            userId: json.data.id ?? null,
          };
          if (readyRef.current && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(msg, '*');
          } else {
            pendingProfileRef.current = msg;
          }
        }).catch(() => {});
      }
    });

    // Avatare anderer Spieler → puffern falls Iframe noch nicht bereit, sonst direkt senden
    sock.on('avatars-snapshot', (data: { avatars: unknown[] }) => {
      const avatars = data.avatars ?? [];
      if (readyRef.current) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'AVATARS_SNAPSHOT', avatars, localPlayerId: localPlayerIdRef.current },
          '*'
        );
      } else {
        pendingAvatarsRef.current = avatars;
      }
    });

    // Neuer Spieler joined → aktuelle Position + State sofort broadcasten
    sock.on('avatar-resync-request', () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'REQUEST_POS_RESYNC' }, '*');
    });

    sock.on('avatar-spawned', (data: unknown) => {
      const d = data as Record<string, unknown>;
      const msg = { type: 'AVATAR_SPAWNED', ...d, localPlayerId: localPlayerIdRef.current };
      if (readyRef.current) {
        iframeRef.current?.contentWindow?.postMessage(msg, '*');
      } else {
        pendingSpawnsRef.current.push(msg);
      }
      // Besucher-Map aktualisieren (für Moderations-Panel)
      if (typeof d.playerId === 'string' && d.playerId !== localPlayerIdRef.current) {
        visitorsRef.current.set(d.playerId, {
          userId: typeof d.userId === 'number' ? d.userId : null,
          name: typeof d.name === 'string' ? d.name : '?',
        });
        onVisitorsChangeRef.current?.([...visitorsRef.current.entries()].map(([pid, v]) => ({ playerId: pid, ...v })));
      }
    });

    sock.on('avatar-moved', (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AVATAR_MOVED', ...(data as object) },
        '*'
      );
    });

    sock.on('avatar-removed', (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AVATAR_REMOVED', ...(data as object) },
        '*'
      );
    });

    sock.on('player-left', (data: unknown) => {
      const d = data as Record<string, unknown>;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AVATAR_REMOVED', avatarId: d.playerId, playerId: d.playerId },
        '*'
      );
      // Aus Besucher-Map entfernen
      if (typeof d.playerId === 'string') {
        visitorsRef.current.delete(d.playerId);
        onVisitorsChangeRef.current?.([...visitorsRef.current.entries()].map(([pid, v]) => ({ playerId: pid, ...v })));
      }
    });

    // Gekickt / gebannt → Raum verlassen
    sock.on('room-kicked', () => { onExit?.(); });
    sock.on('room-banned', () => { onExit?.(); });

    // Raum gesperrt → Passwort/Anklopf-Dialog anzeigen
    sock.on('room-locked', (data: { needsPassword: boolean }) => {
      setLockedDialog(data);
    });

    // Anklopfen: Eigentümer hat jemanden anklopfen lassen → weiter an Parent
    sock.on('room-knock-received', (data: { fromUserId: number; fromNickname: string }) => {
      onKnockReceivedRef.current?.(data.fromUserId, data.fromNickname);
    });

    // Besucher: wurde eingelassen → automatisch neu joinen
    sock.on('room-knock-accepted', () => {
      setLockedDialog(null);
      const tok = getAuthToken() || '';
      sock.emit('join-room', {
        roomCode: roomCode || 'MAIN',
        municipalitySlug,
        name: playerNameRef.current || playerName || '',
        ownerUserId: ownerId,
        isViewOnly: !isOwner,
        isRoomViewer: true,
        authToken: tok,
      });
    });

    // Besucher: wurde abgelehnt
    sock.on('room-knock-declined', () => {
      setLockedDialog(prev => prev ? { ...prev, knocking: false, declined: true } : null);
    });

    // knockSocketRef befüllen damit Parent accept/decline senden kann
    if (knockSocketRef) {
      knockSocketRef.current = {
        accept: (uid: number) => sock.emit('room-knock-accept', { targetUserId: uid }),
        decline: (uid: number) => sock.emit('room-knock-decline', { targetUserId: uid }),
      };
    }

    sock.on('avatar-state', (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AVATAR_STATE', ...(data as object) },
        '*'
      );
    });

    sock.on('room-chat', (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AVATAR_CHAT', ...(data as object) },
        '*'
      );
    });

    sock.on('lamp-toggled', (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'LAMP_TOGGLED', ...(data as object) },
        '*'
      );
    });

    // Möbel-Snapshot vom Server empfangen
    sock.on('room-furniture-snapshot', (data: { placements: unknown[]; ownerUserId: number }) => {
      if (!Array.isArray(data.placements)) return;
      console.log('[RoomViewer] room-furniture-snapshot received, count:', data.placements.length, 'readyRef:', readyRef.current);
      placementsRef.current = data.placements;
      if (readyRef.current) {
        console.log('[RoomViewer] → sending FURNITURE_REFRESH (no reload)');
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'FURNITURE_REFRESH', placements: data.placements },
          '*'
        );
      } else {
        console.log('[RoomViewer] → setPlacements (iframe not ready yet)');
        setPlacements(data.placements);
      }
    });

    return () => {
      roomJoinedRef.current = false;
      localPlayerIdRef.current = null;
      pendingSpawnsRef.current = [];
      visitorsRef.current.clear();
      setRoomLoaded(false);
      sock.disconnect();
      socketRef.current = null;
    };
  }, [municipalitySlug, ownerId, roomCode, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ROOM_INIT senden (Katalog + Avatar + Platzierungen + Geometrie) ─────
  const sendInit = useCallback((currentPlacements?: unknown[], _caller?: string) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    console.log('[RoomViewer] sendInit called by:', _caller ?? 'unknown', 'placements:', (currentPlacements ?? placementsRef.current)?.length ?? 0);
    const resolvedAvatar = avatarCode ?? sqlAvatarRef.current ?? null;
    win.postMessage(
      {
        type:        'ROOM_INIT',
        model_name:  modelName,
        avatar_code: resolvedAvatar,
        placements:  currentPlacements ?? placementsRef.current,
        // Möbel-Katalog aus SQL — game3d.js baut CATALOG_CATS daraus auf
        catalog:     catalogRef.current,
        // Raumgeometrie aus SQL (grid, Wände, Tür, Stockwerke, Treppen)
        geometry:    geometry ?? null,
        // Room NPCs
        npcs:        npcsRef.current,
        // Nur Eigentümer darf Möbel platzieren
        is_owner:       isOwner ?? false,
        // Name des Raum-Eigentümers (für "Besitzer:" in Möbel-Panel)
        owner_nickname: ownerNickname ?? '',
        // Lokaler Spielername (für Namensschild über eigenem Avatar)
        player_name:    playerNameRef.current || '',
        // Auth-Token + API-Base für Motto-Speichern direkt aus dem Iframe
        auth_token:     getAuthToken() || '',
        api_base:       process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100',
        // Lokale User-ID für Duplikat-Avatar-Filter in game3d (verhindert Z-Fighting)
        local_user_id:  typeof localStorage !== 'undefined' ? Number(localStorage.getItem('isocity_user_id') || 0) || null : null,
      },
      '*'
    );
  }, [modelName, avatarCode, geometry, isOwner, ownerNickname]);

  // Wenn Platzierungen NACH iframe-Ready laden: neu senden
  useEffect(() => {
    if (!readyRef.current) return;
    console.log('[RoomViewer] placements useEffect fired, count:', placements?.length, new Error().stack?.split('\n')[2]);
    sendInit(placements, 'placements-effect');
  }, [placements]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── postMessage Handler ───────────────────────────────────────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      const msg  = e.data as Record<string, unknown>;
      const type = msg.type as string;

      // Iframe scripts fertig geladen → jetzt ROOM_INIT senden
      if (type === 'SCRIPTS_LOADED') {
        console.log('[RoomViewer] SCRIPTS_LOADED → sendInit');
        sendInit(undefined, 'SCRIPTS_LOADED');
        return;
      }

      if (type === 'ROOM_READY') {
        console.log('[RoomViewer] ROOM_READY received, readyRef was:', readyRef.current);
        // Guard: only process the very first ROOM_READY.
        if (readyRef.current) return;
        readyRef.current = true;
        onReady?.();
        sendInit(undefined, 'ROOM_READY');
        // Gepufferte Avatare jetzt senden (kamen vor Iframe-Ready an)
        if (pendingAvatarsRef.current !== null) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'AVATARS_SNAPSHOT', avatars: pendingAvatarsRef.current, localPlayerId: localPlayerIdRef.current },
            '*'
          );
          pendingAvatarsRef.current = null;
        }
        // Gepufferte AVATAR_SPAWNED Events nachholen (kamen vor Iframe-Ready an)
        for (const spawnMsg of pendingSpawnsRef.current) {
          iframeRef.current?.contentWindow?.postMessage(spawnMsg, '*');
        }
        pendingSpawnsRef.current = [];
        // Eigenen Namen senden (falls bereits geladen)
        if (playerNameRef.current) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'LOCAL_PLAYER_NAME', name: playerNameRef.current }, '*'
          );
        }
        // Gepuffertes Profil senden (Motto, Gemeinde, Level)
        if (pendingProfileRef.current) {
          iframeRef.current?.contentWindow?.postMessage(pendingProfileRef.current, '*');
          pendingProfileRef.current = null;
        }
        return;
      }

      // Lokaler Spieler bewegt sich (click) → Server informieren
      if (type === 'CHAR_MOVE_REQUEST' && Array.isArray(msg.path)) {
        socketRef.current?.emit('avatar-move-request', { path: msg.path, level: msg.level ?? 0 });
        return;
      }

      // WASD-Bewegung: throttled Position-Update (1 Wegpunkt = aktuelle Position)
      if (type === 'CHAR_POS_UPDATE') {
        socketRef.current?.emit('avatar-move-request', { path: [{ x: msg.x, y: msg.y }], onRoller: !!msg.onRoller, level: msg.level ?? 0 });
        return;
      }

      // State-Änderung (sitzen, schlafen, …) → broadcasten
      if (type === 'CHAR_STATE') {
        socketRef.current?.emit('avatar-state-request', { state: msg.state, x: msg.x, z: msg.z, dir: msg.dir });
        return;
      }

      // Chat-Nachricht → an alle im Raum senden
      if (type === 'CHAR_CHAT' && typeof msg.message === 'string') {
        socketRef.current?.emit('room-chat', { message: msg.message });
        return;
      }

      // Motto gespeichert → avatar-spawn-request neu schicken damit alle das neue Motto sehen
      if (type === 'MOTTO_SAVED') {
        const sp  = spawnPosRef.current;
        const code = liveAvatarCodeRef.current ?? sqlAvatarRef.current ?? null;
        socketRef.current?.emit('avatar-spawn-request', {
          x: sp.x, y: sp.z, dir: sp.dir,
          name: playerNameRef.current || '',
          avatarConfig: code ? { avatar_code: code } : undefined,
        });
        return;
      }

      // Lampe ein/ausschalten → an alle broadcasten
      if (type === 'CHAR_LAMP_TOGGLE') {
        socketRef.current?.emit('room-lamp-toggle', { x: msg.x, z: msg.z, on: msg.on });
        return;
      }

      // game3d meldet echten Spawn-Punkt nach ROOM_INIT → Avatar-Spawn aktualisieren
      if (type === 'CHAR_SPAWN_POS') {
        const x = Number(msg.x ?? 0);
        const z = Number(msg.z ?? 0);
        const dir = Number(msg.dir ?? 0);
        spawnPosRef.current = { x, z, dir };
        setRoomLoaded(true);
        // Immer neu spawnen mit korrekter Position und Richtung (auch ohne Avatar-Code)
        if (roomJoinedRef.current) {
          const code = liveAvatarCodeRef.current ?? sqlAvatarRef.current ?? null;
          socketRef.current?.emit('avatar-spawn-request', {
            x, y: z, dir,
            name: playerNameRef.current || playerName || '',
            avatarConfig: code ? { avatar_code: code } : undefined,
          });
        }
        return;
      }

      // Avatar geändert → in SQL speichern + alle im Raum sofort updaten
      if (type === 'AVATAR_CHANGED' && typeof msg.avatar_code === 'string') {
        const newCode = msg.avatar_code;
        liveAvatarCodeRef.current = newCode;
        onAvatarChange?.(newCode);
        const token = getAuthToken() || '';
        if (token) {
          fetch(`${API_BASE}/api/game/user/avatar`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
            body:    JSON.stringify({ avatar_code: newCode }),
          }).catch(() => { /* ignore */ });
        }
        // Neues Outfit sofort an alle anderen im Raum broadcasten
        if (roomJoinedRef.current) {
          const sp = spawnPosRef.current;
          socketRef.current?.emit('avatar-spawn-request', {
            x: sp.x, y: sp.z, dir: sp.dir,
            name: playerNameRef.current || '',
            avatarConfig: { avatar_code: newCode },
          });
        }
        return;
      }

      // Spieler läuft durch die Tür hinaus → Overlay schließen
      if (type === 'ROOM_EXIT') {
        onExit?.();
        return;
      }

      // Teleporter-Paar-ID vom Parent empfangen (vor PLACE_ITEM gesendet)
      if (type === '__TELEPORTER_PAIR_SET') {
        pendingTeleporterPairIdRef.current = typeof msg.pair_id === 'number' ? msg.pair_id : null;
        return;
      }

      // Teleporter betreten → verknüpftes Stück suchen + teleportieren
      if (type === 'TELEPORTER_ACTIVATED' && msg.furniture_id != null) {
        const token = getAuthToken() || '';
        fetch(`${API_BASE}/api/game/user/room/furniture/teleport?furniture_id=${msg.furniture_id}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        })
          .then(r => r.json())
          .then(d => {
            if (!d.ok || !d.data) return;
            const { target_user_id, x, z, floor_level } = d.data;
            if (target_user_id === ownerId) {
              // Gleicher Raum: Avatar direkt teleportieren
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'TELEPORT_TO_POS', x, z, floor_level: floor_level ?? 0 },
                '*'
              );
            } else {
              // Anderer Raum: Parent informieren
              onTeleportToRoom?.(Number(target_user_id));
            }
          })
          .catch(() => { /* ignore */ });
        return;
      }

      // Möbel platziert → in SQL speichern (room_furniture Tabelle)
      if (type === 'ROOM_FURNITURE_PLACED') {
        const token = getAuthToken() || '';
        const pairId = msg.item_code === 'teleporter' ? pendingTeleporterPairIdRef.current : null;
        if (msg.item_code === 'teleporter') pendingTeleporterPairIdRef.current = null;
        fetch(`${API_BASE}/api/game/user/room/furniture`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          body:    JSON.stringify({
            item_code:        msg.item_code,
            x:                msg.x,
            z:                msg.z,
            floor_level:      msg.floor_level ?? 0,
            facing_idx:       msg.facing_idx,
            wy:               msg.wy ?? null,
            municipality_slug: municipalitySlug || undefined,
            ...(pairId != null ? { pair_id: pairId } : {}),
          }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.ok) {
              // Server-ID zurück senden damit Iframe künftige Löschungen verfolgen kann
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'FURNITURE_SAVED', uuid: msg.uuid, server_id: d.data.id },
                '*'
              );
              // Alle im Raum über neues Möbel informieren
              socketRef.current?.emit('room-furniture-sync');
            }
          })
          .catch(() => { /* ignore */ });
        return;
      }

      // NPC platziert → in room_npcs speichern
      if (type === 'ROOM_NPC_PLACED') {
        const token = getAuthToken() || '';
        // Metadaten aus localStorage holen (beim Kauf gespeichert)
        const pending = JSON.parse(localStorage.getItem('pending_npc_meta') || '[]');
        const meta = pending.shift() || { npc_name: 'NPC', npc_style: 1 };
        localStorage.setItem('pending_npc_meta', JSON.stringify(pending));

        fetch(`${API_BASE}/api/game/user/room/npcs`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          body:    JSON.stringify({
            npc_name:         meta.npc_name,
            npc_style:        meta.npc_style,
            x:                msg.x,
            z:                msg.z,
            floor_level:      msg.floor_level ?? 0,
            facing_idx:       msg.facing_idx ?? 0,
            municipality_slug: municipalitySlug || undefined,
          }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.ok) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'NPC_SAVED', uuid: msg.uuid, server_id: d.data.id, npc_name: meta.npc_name, npc_style: meta.npc_style },
                '*'
              );
            }
          })
          .catch(() => { /* ignore */ });
        return;
      }

      // NPC entfernt → aus DB löschen + Inventar zurückgeben
      if (type === 'ROOM_NPC_DELETED') {
        const token = getAuthToken() || '';
        const npcId = msg.server_id;
        if (npcId != null) {
          fetch(`${API_BASE}/api/game/user/room/npcs/${npcId}`, {
            method:  'DELETE',
            headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          }).catch(() => { /* ignore */ });
        }
        // Inventar +1
        fetch(`${API_BASE}/api/game/user/inventory/return`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          body:    JSON.stringify({ item_code: 'room_npc' }),
        }).catch(() => { /* ignore */ });
        return;
      }

      // Möbel bewegt (Move-Modus) → server-autoritatives PATCH (kein Duplikat)
      if (type === 'ROOM_FURNITURE_MOVED') {
        const token = getAuthToken() || '';
        const oldId = msg.old_server_id;
        if (oldId != null) {
          // Bekannter DB-Eintrag → PATCH (Position aktualisieren, kein DELETE+INSERT)
          fetch(`${API_BASE}/api/game/user/room/furniture/${oldId}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
            body:    JSON.stringify({
              x:           msg.x,
              z:           msg.z,
              floor_level: msg.floor_level ?? 0,
              facing_idx:  msg.facing_idx,
              wy:          msg.wy ?? null,
            }),
          })
            .then(r => r.json())
            .then(d => {
              if (d.ok) {
                // Gleiche server_id zurücksenden (Eintrag wurde nur aktualisiert)
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'FURNITURE_SAVED', uuid: msg.uuid, server_id: oldId },
                  '*'
                );
                socketRef.current?.emit('room-furniture-sync');
              }
            })
            .catch(() => { /* ignore */ });
        } else {
          // Noch kein DB-Eintrag (Race-Condition: noch nie gespeichert) → neuen erstellen
          fetch(`${API_BASE}/api/game/user/room/furniture`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
            body:    JSON.stringify({
              item_code:   msg.item_code,
              x:           msg.x,
              z:           msg.z,
              floor_level: msg.floor_level ?? 0,
              facing_idx:  msg.facing_idx,
              wy:          msg.wy ?? null,
            }),
          })
            .then(r => r.json())
            .then(d => {
              if (d.ok) {
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'FURNITURE_SAVED', uuid: msg.uuid, server_id: d.data.id },
                  '*'
                );
                socketRef.current?.emit('room-furniture-sync');
              }
            })
            .catch(() => { /* ignore */ });
        }
        return;
      }

      // Möbel gelöscht → aus SQL entfernen (room_furniture Tabelle)
      if (type === 'ROOM_FURNITURE_DELETED' && msg.server_id != null) {
        const token = getAuthToken() || '';
        fetch(`${API_BASE}/api/game/user/room/furniture/${msg.server_id}`, {
          method:  'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        })
          .then(() => socketRef.current?.emit('room-furniture-sync'))
          .catch(() => { /* ignore */ });
        return;
      }

      // Aufnehmen: Möbel aus Raum → DB löschen + Inventar +1
      if (type === 'ROOM_FURNITURE_PICKUP' && typeof msg.item_code === 'string') {
        const token = getAuthToken() || '';
        if (!token) return;

        // DB-Eintrag löschen: entweder via server_id (schnell) oder via Koordinaten (Fallback)
        const sid = msg.server_id;
        if (sid != null) {
          fetch(`${API_BASE}/api/game/user/room/furniture/${sid}`, {
            method:  'DELETE',
            headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          })
            .then(() => socketRef.current?.emit('room-furniture-sync'))
            .catch(() => { /* ignore */ });
        } else if (msg.x != null && msg.z != null) {
          // Fallback: nach Koordinaten löschen (wenn FURNITURE_SAVED noch nicht angekommen)
          fetch(`${API_BASE}/api/game/user/room/furniture/by-pos`, {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
            body:    JSON.stringify({ item_code: msg.item_code, x: msg.x, z: msg.z }),
          })
            .then(() => socketRef.current?.emit('room-furniture-sync'))
            .catch(() => { /* ignore */ });
        }

        // Inventar +1 zurückgeben (Teleporter: pair_id aus Placements lookup)
        const pairId = msg.item_code === 'teleporter' && msg.server_id != null
          ? ((placementsRef.current as any[]).find((p: any) => p.id === msg.server_id)?.pair_id ?? null)
          : null;
        fetch(`${API_BASE}/api/game/user/inventory/return`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          body:    JSON.stringify({
            item_code: msg.item_code,
            ...(pairId != null ? { pair_id: pairId } : {}),
          }),
        }).catch(() => { /* ignore */ });
        return;
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onAvatarChange, onReady, onTeleportToRoom, onExit, sendInit, ownerId]);

  // Avatar-Prop geändert → Iframe live aktualisieren
  useEffect(() => {
    if (!readyRef.current || !avatarCode) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'AVATAR_SET', avatar_code: avatarCode },
      '*'
    );
  }, [avatarCode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        ref={iframeRef}
        id="isometric-iframe"
        src="/isometric?v=20260412"
        className="w-full h-full border-0"
        title="Isometric Room"
        allow="autoplay"
      />
      {!roomLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#0f1420',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, zIndex: 10, pointerEvents: 'none',
        }}>
          {/* Spinner */}
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <div style={{
              position: 'absolute', inset: 0,
              border: '3px solid rgba(251,191,36,0.15)',
              borderTopColor: '#f59e0b',
              borderRadius: '50%',
              animation: 'rv-spin 0.9s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 8,
              border: '2px solid rgba(251,191,36,0.1)',
              borderBottomColor: '#d97706',
              borderRadius: '50%',
              animation: 'rv-spin 1.4s linear infinite reverse',
            }} />
          </div>
          {/* Text */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#f59e0b', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>
              Raum wird geladen…
            </div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
              Bitte warten
            </div>
          </div>
          {/* Ladebalken */}
          <div style={{ width: 180, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #f59e0b, #f97316)',
              borderRadius: 2,
              animation: 'rv-bar 1.6s ease-in-out infinite',
            }} />
          </div>
          <style>{`
            @keyframes rv-spin { to { transform: rotate(360deg); } }
            @keyframes rv-bar {
              0%   { width: 0%;   margin-left: 0%; }
              50%  { width: 70%;  margin-left: 15%; }
              100% { width: 0%;   margin-left: 100%; }
            }
          `}</style>
        </div>
      )}
      {lockedDialog && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: '#1e2535', border: '1px solid #334155', borderRadius: 12,
            padding: '28px 32px', minWidth: 300, textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Raum gesperrt
            </div>
            {lockedDialog.knocking ? (
              /* Warte-Zustand nach Anklopfen */
              <div style={{ color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🚪</div>
                <div style={{ color: '#f8fafc', marginBottom: 6 }}>Warte auf Einlass…</div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 20 }}>Der Eigentümer wurde benachrichtigt</div>
                <button
                  onClick={() => { setLockedDialog(null); onExit?.(); }}
                  style={{ padding: '7px 20px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                >
                  Abbrechen
                </button>
              </div>
            ) : lockedDialog.declined ? (
              /* Abgelehnt */
              <div>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🚫</div>
                <div style={{ color: '#f8fafc', marginBottom: 6 }}>Einlass verweigert</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 20 }}>Der Eigentümer hat abgelehnt.</div>
                <button
                  onClick={() => { setLockedDialog(null); onExit?.(); }}
                  style={{ padding: '7px 20px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                >
                  Zurück
                </button>
              </div>
            ) : lockedDialog.needsPassword ? (
              <>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                  Dieser Raum ist passwortgeschützt.
                </div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Passwort eingeben…"
                  value={pwInput}
                  onChange={e => { setPwInput(e.target.value); pwInputRef.current = e.target.value; }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      roomPasswordRef.current = pwInputRef.current;
                      setPwInput(''); setLockedDialog(null);
                      const tok = getAuthToken() || '';
                      socketRef.current?.emit('join-room', { roomCode: roomCode || 'MAIN', municipalitySlug, name: playerNameRef.current || playerName || '', ownerUserId: ownerId, isViewOnly: !isOwner, isRoomViewer: true, authToken: tok, roomPassword: roomPasswordRef.current });
                    } else if (e.key === 'Escape') { setLockedDialog(null); onExit?.(); }
                  }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 14, background: '#0f1420', border: '1px solid #475569', borderRadius: 6, color: '#f8fafc', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      roomPasswordRef.current = pwInputRef.current;
                      setPwInput(''); setLockedDialog(null);
                      const tok = getAuthToken() || '';
                      socketRef.current?.emit('join-room', { roomCode: roomCode || 'MAIN', municipalitySlug, name: playerNameRef.current || playerName || '', ownerUserId: ownerId, isViewOnly: !isOwner, isRoomViewer: true, authToken: tok, roomPassword: roomPasswordRef.current });
                    }}
                    style={{ padding: '7px 20px', background: '#f59e0b', color: '#0f1420', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    Eintreten
                  </button>
                  <button
                    onClick={() => {
                      setLockedDialog(prev => prev ? { ...prev, knocking: true } : null);
                      socketRef.current?.emit('room-knock', { ownerUserId: ownerId, fromNickname: playerNameRef.current || playerName || '' });
                    }}
                    style={{ padding: '7px 20px', background: '#1e40af', color: '#bfdbfe', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    🚪 Anklopfen
                  </button>
                  <button onClick={() => { setLockedDialog(null); onExit?.(); }} style={{ padding: '7px 16px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                    Zurück
                  </button>
                </div>
              </>
            ) : (
              /* Gesperrt ohne Passwort — nur Anklopfen möglich */
              <>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                  Dieser Raum ist nur auf Einladung zugänglich.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      setLockedDialog(prev => prev ? { ...prev, knocking: true } : null);
                      socketRef.current?.emit('room-knock', { ownerUserId: ownerId, fromNickname: playerNameRef.current || playerName || '' });
                    }}
                    style={{ padding: '7px 20px', background: '#1e40af', color: '#bfdbfe', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    🚪 Anklopfen
                  </button>
                  <button onClick={() => { setLockedDialog(null); onExit?.(); }} style={{ padding: '7px 16px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                    Zurück
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
