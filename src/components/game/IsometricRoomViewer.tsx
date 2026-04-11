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
}: IsometricRoomViewerProps) {
  const iframeRef      = useRef<HTMLIFrameElement>(null);
  const readyRef       = useRef(false);
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
    // Wenn Socket-Modus aktiv: kein HTTP-Fetch nötig, Socket liefert Snapshot beim Join
    if (municipalitySlug && ownerId) {
      console.log('[RoomViewer] HTTP furniture fetch SKIPPED — socket mode active');
      return;
    }
    async function fetchPlacements() {
      try {
        const token = getAuthToken() || '';
        const url = ownerId
          ? `${API_BASE}/api/game/user/room/furniture?user_id=${ownerId}`
          : `${API_BASE}/api/game/user/room/furniture`;
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
    async function fetchNpcs() {
      try {
        const token = getAuthToken() || '';
        const url = ownerId
          ? `${API_BASE}/api/game/user/room/npcs?user_id=${ownerId}`
          : `${API_BASE}/api/game/user/room/npcs`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Game-Token': token },
        });
        const d = await r.json();
        if (d.ok) npcsRef.current = d.data.npcs;
      } catch { /* ignore */ }
    }
    fetchNpcs();
  }, [ownerId]);

  // ── Socket.IO Verbindung für Echtzeit-Möbel-Sync ─────────────────────────
  useEffect(() => {
    if (!municipalitySlug || !ownerId) return;
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
          x: sp.x, y: sp.z,
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
      const msg = { type: 'AVATAR_SPAWNED', ...(data as object), localPlayerId: localPlayerIdRef.current };
      if (readyRef.current) {
        iframeRef.current?.contentWindow?.postMessage(msg, '*');
      } else {
        pendingSpawnsRef.current.push(msg);
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
    });

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

      // Möbel platziert → in SQL speichern (room_furniture Tabelle)
      if (type === 'ROOM_FURNITURE_PLACED') {
        const token = getAuthToken() || '';
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
            npc_name:    meta.npc_name,
            npc_style:   meta.npc_style,
            x:           msg.x,
            z:           msg.z,
            floor_level: msg.floor_level ?? 0,
            facing_idx:  msg.facing_idx ?? 0,
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

        // Inventar +1 zurückgeben
        fetch(`${API_BASE}/api/game/user/inventory/return`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Game-Token': token },
          body:    JSON.stringify({ item_code: msg.item_code }),
        }).catch(() => { /* ignore */ });
        return;
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onAvatarChange, onReady, sendInit]);

  // Avatar-Prop geändert → Iframe live aktualisieren
  useEffect(() => {
    if (!readyRef.current || !avatarCode) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'AVATAR_SET', avatar_code: avatarCode },
      '*'
    );
  }, [avatarCode]);

  return (
    <iframe
      ref={iframeRef}
      id="isometric-iframe"
      src="/isometric?v=20260412"
      className="w-full h-full border-0"
      title="Isometric Room"
      allow="autoplay"
    />
  );
}
