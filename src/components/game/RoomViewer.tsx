'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle, Ticker } from 'pixi.js';
import { drawAvatar, AvatarAppearance, AvatarAction, AvatarFacing, DEFAULT_APPEARANCE } from './avatarParts';

export type { AvatarAction };

const TILE_W = 64;
const TILE_H = 32;
const TW = TILE_W / 2;
const TH = TILE_H / 2;
const STEP_H = 16;
const WALL_H = 112;
const DOOR_H = 72;
const DOOR_FLOOR = 0xEDE0BE;
const AVATAR_SCALE = 1.45;

// ─── Dynamic color helpers ──────────────────────────────────────────────────
function clamp8(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }
function darken(c: number, f = 0.75) {
  return (clamp8(((c >> 16) & 0xFF) * f) << 16) | (clamp8(((c >> 8) & 0xFF) * f) << 8) | clamp8((c & 0xFF) * f);
}
function lighten(c: number, f: number) {
  return (clamp8(((c >> 16) & 0xFF) * f) << 16) | (clamp8(((c >> 8) & 0xFF) * f) << 8) | clamp8((c & 0xFF) * f);
}
function wallColors(base: number) {
  return {
    nw: base,
    ne: darken(base, 0.82),
    cap: lighten(base, 1.12),
    stepNw: darken(base, 0.88),
    stepNe: darken(base, 0.72),
  };
}
function floorColors(base: number) {
  return { a: base, b: darken(base, 0.92) };
}

// ─── Isometrie ────────────────────────────────────────────────────────────────
function proj(tx: number, ty: number, h: number, ox: number, oy: number) {
  return { sx: (tx - ty) * TW + ox, sy: (tx + ty) * TH - h * STEP_H + oy };
}

function nwUp(sx: number, sy: number, fh: number): number[] {
  return [sx, sy - TH, sx - TW, sy, sx - TW, sy - fh, sx, sy - TH - fh];
}
function nwDown(sx: number, sy: number, fh: number): number[] {
  return [sx, sy - TH, sx - TW, sy, sx - TW, sy + fh, sx, sy - TH + fh];
}
function neUp(sx: number, sy: number, fh: number): number[] {
  return [sx + TW, sy, sx, sy - TH, sx, sy - TH - fh, sx + TW, sy - fh];
}
function neDown(sx: number, sy: number, fh: number): number[] {
  return [sx + TW, sy, sx, sy - TH, sx, sy - TH + fh, sx + TW, sy + fh];
}
function topFace(sx: number, sy: number): number[] {
  return [sx, sy - TH, sx + TW, sy, sx, sy + TH, sx - TW, sy];
}

function fillPoly(g: Graphics, pts: number[], color: number, alpha = 1) {
  g.poly(pts); g.fill({ color, alpha });
}
function strokePoly(g: Graphics, pts: number[], alpha = 0.18) {
  g.poly(pts); g.stroke({ color: 0x000000, width: 0.8, alpha });
}

// ─── Rotation (Bobba GameMap.calculateRotation, tile-space) ──────────────────
function calculateRotation(x1: number, y1: number, x2: number, y2: number): number {
  if (x1 > x2 && y1 > y2) return 7;
  if (x1 < x2 && y1 < y2) return 3;
  if (x1 > x2 && y1 < y2) return 5;
  if (x1 < x2 && y1 > y2) return 1;
  if (x1 > x2) return 6;
  if (x1 < x2) return 2;
  if (y1 < y2) return 4;
  if (y1 > y2) return 0;
  return 2;
}
function rotToFacing(rot: number): [AvatarFacing, number] {
  switch (rot) {
    case 0: return ['back',  1];
    case 1: return ['side',  1];
    case 2: return ['side',  1];
    case 3: return ['front', 1];
    case 4: return ['front',-1];
    case 5: return ['side', -1];
    case 6: return ['side', -1];
    case 7: return ['back', -1];
    default: return ['side', 1];
  }
}

// ─── A* Pathfinding ───────────────────────────────────────────────────────────
interface PathNode {
  tx: number; ty: number; g: number; f: number; parent: PathNode | null;
}

function findPath(
  stx: number, sty: number, etx: number, ety: number,
  getH: (tx: number, ty: number) => number,
): { tx: number; ty: number }[] {
  const key = (tx: number, ty: number) => `${tx},${ty}`;
  const heur = (tx: number, ty: number) => {
    const dx = Math.abs(tx - etx), dy = Math.abs(ty - ety);
    return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
  };
  const dirs = [
    {dx:-1,dy:0,c:10},{dx:1,dy:0,c:10},{dx:0,dy:-1,c:10},{dx:0,dy:1,c:10},
    {dx:-1,dy:-1,c:14},{dx:-1,dy:1,c:14},{dx:1,dy:-1,c:14},{dx:1,dy:1,c:14},
  ];
  const open = new Map<string, PathNode>();
  const closed = new Set<string>();
  open.set(key(stx, sty), { tx: stx, ty: sty, g: 0, f: heur(stx, sty), parent: null });

  while (open.size > 0) {
    let cur: PathNode | null = null;
    for (const n of open.values()) if (!cur || n.f < cur.f) cur = n;
    if (!cur) break;
    if (cur.tx === etx && cur.ty === ety) {
      const path: { tx: number; ty: number }[] = [];
      let n: PathNode | null = cur;
      while (n) { path.unshift({ tx: n.tx, ty: n.ty }); n = n.parent; }
      return path;
    }
    const k = key(cur.tx, cur.ty);
    open.delete(k); closed.add(k);
    const ch = getH(cur.tx, cur.ty);
    for (const { dx, dy, c } of dirs) {
      const nx = cur.tx + dx, ny = cur.ty + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const nh = getH(nx, ny);
      if (nh < 0 || Math.abs(nh - ch) > 1) continue;
      const ng = cur.g + c;
      const ex = open.get(nk);
      if (!ex || ng < ex.g) open.set(nk, { tx: nx, ty: ny, g: ng, f: ng + heur(nx, ny), parent: cur });
    }
  }
  return [];
}

function makeGetH(tiles: string[][]) {
  const rows = tiles.length;
  return (tx: number, ty: number): number => {
    if (ty < 0 || ty >= rows || tx < 0 || tx >= (tiles[ty]?.length ?? 0)) return -1;
    const c = tiles[ty][tx]; return c === 'x' ? -1 : (parseInt(c) || 0);
  };
}

// ─── Raum zeichnen ────────────────────────────────────────────────────────────
function renderRoom(
  stage: Container,
  tiles: string[][],
  doorX: number, doorY: number,
  W: number, H: number,
  avatarPos: { tx: number; ty: number },
  targetPos: { tx: number; ty: number } | null,
  avatarContainer: Container,
  avatarInner: Graphics,
  avatarLabel: Text,
  action: AvatarAction,
  animT: number,
  appearance: AvatarAppearance,
  avatarDir: number,
  avatarFacing: AvatarFacing,
  onTileClick: (tx: number, ty: number) => void,
  oxRef: React.MutableRefObject<number>,
  oyRef: React.MutableRefObject<number>,
  gndRef: React.MutableRefObject<Graphics | null>,
  avatarHOverride?: number,
  wallColor = 0xBEBEB2,
  floorColor = 0xD6C9B0,
) {
  // Alte Tile-Graphics explizit zerstören damit PixiJS GPU-Buffer sauber freigibt
  const oldChildren = stage.children.slice();
  stage.removeChildren();
  for (const c of oldChildren) {
    if (c !== avatarContainer && c !== avatarLabel) (c as Graphics).destroy();
  }
  const rows = tiles.length;
  if (!rows) return;

  const getH = makeGetH(tiles);
  const wc = wallColors(wallColor);
  const fc = floorColors(floorColor);
  const isInnerVoid = (tx: number, ty: number): boolean => {
    if (ty < 0 || ty >= rows || tx < 0 || tx >= (tiles[ty]?.length ?? 0)) return false;
    return tiles[ty][tx] === 'x';
  };

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < (tiles[ty]?.length ?? 0); tx++) {
      const h = getH(tx, ty); if (h < 0) continue;
      const { sx, sy } = proj(tx, ty, h, 0, 0);
      x0 = Math.min(x0, sx-TILE_W/2); x1 = Math.max(x1, sx+TILE_W/2);
      y0 = Math.min(y0, sy-TILE_H/2-WALL_H); y1 = Math.max(y1, sy+TILE_H/2);
    }
  }
  const ox = W/2 - (x0+x1)/2;
  const oy = H/2 - (y0+y1)/2 + 20;
  oxRef.current = ox; oyRef.current = oy;

  const doorOnNW = getH(doorX-1, doorY) < 0;
  const doorOnNE = !doorOnNW && getH(doorX, doorY-1) < 0;
  const entranceTx = doorOnNW ? doorX-1 : doorX;
  const entranceTy = doorOnNE ? doorY-1 : doorY;

  // Zielmarkierung — als erstes Kind, immer unter Kacheln und Avatar
  {
    const gnd = new Graphics();
    gndRef.current = gnd;
    if (targetPos) {
      const th = getH(targetPos.tx, targetPos.ty);
      if (th >= 0) {
        const { sx: tsx, sy: tsy } = proj(targetPos.tx, targetPos.ty, th, ox, oy);
        gnd.poly(topFace(tsx, tsy)); gnd.stroke({ color: 0xFFD700, width: 2.5, alpha: 0.9 });
      }
    }
    stage.addChild(gnd);
  }

  type Entry = { tx: number; ty: number; h: number; isDoor: boolean; isEntrance?: boolean; isAvatar?: boolean };
  const sorted: Entry[] = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < (tiles[ty]?.length ?? 0); tx++) {
      const h = getH(tx, ty); if (h < 0) continue;
      sorted.push({ tx, ty, h, isDoor: tx === doorX && ty === doorY });
    }
  }
  const entranceH = getH(doorX, doorY);
  if (entranceH >= 0) {
    sorted.push({ tx: entranceTx, ty: entranceTy, h: entranceH, isDoor: false, isEntrance: true });
  }
  // Avatar kann Fließkomma-Position haben → floor für Höhen-Lookup
  const avTx = Math.floor(avatarPos.tx), avTy = Math.floor(avatarPos.ty);
  const avHSnap = getH(avTx, avTy) >= 0 ? getH(avTx, avTy) : (entranceH >= 0 ? entranceH : 0);
  const avH = avatarHOverride !== undefined ? avatarHOverride : avHSnap;
  sorted.push({ tx: avatarPos.tx, ty: avatarPos.ty, h: avH, isDoor: false, isAvatar: true });

  sorted.sort((a, b) => {
    const da = a.tx+a.ty, db = b.tx+b.ty;
    if (Math.abs(da - db) > 0.001) return da - db;
    if (a.isAvatar && !b.isAvatar) return 1;
    if (!a.isAvatar && b.isAvatar) return -1;
    return 0;
  });

  for (const { tx, ty, h, isDoor, isEntrance, isAvatar } of sorted) {
    const { sx, sy } = proj(tx, ty, h, ox, oy);
    const g = new Graphics();

    if (isEntrance) {
      fillPoly(g, topFace(sx, sy), DOOR_FLOOR); strokePoly(g, topFace(sx, sy), 0.15);
      g.eventMode = 'static'; g.cursor = 'pointer';
      g.on('pointerdown', (e) => { e.stopPropagation(); onTileClick(tx, ty); });
      stage.addChild(g); continue;
    }

    if (isAvatar) {
      drawAvatar(avatarInner, 0, 0, action, animT, appearance, true, avatarFacing);
      avatarInner.scale.set(avatarDir * AVATAR_SCALE, AVATAR_SCALE);
      avatarContainer.scale.set(1, 1);
      avatarContainer.position.set(sx, sy);
      avatarLabel.x = sx; avatarLabel.y = sy - 43 * AVATAR_SCALE;
      stage.addChild(avatarContainer); stage.addChild(avatarLabel); continue;
    }

    const leftH = getH(tx-1, ty);
    const topH  = getH(tx, ty-1);
    const isDoorNW = isDoor && doorOnNW;
    const isDoorNE = isDoor && doorOnNE;

    // NW wall
    if (leftH < 0) {
      if (isDoorNW) {
        // Door back-wall fill (blocks see-through)
        fillPoly(g, [sx, sy - TH, sx - TW, sy, sx - TW, sy - DOOR_H, sx, sy - TH - DOOR_H], darken(wc.nw, 0.45));
        // Wall above door
        const aboveDoor = WALL_H - DOOR_H;
        if (aboveDoor > 0) {
          const pts = [sx, sy - TH - DOOR_H, sx - TW, sy - DOOR_H, sx - TW, sy - WALL_H, sx, sy - TH - WALL_H];
          fillPoly(g, pts, wc.nw); strokePoly(g, pts, 0.18);
          fillPoly(g, [sx, sy - TH - WALL_H, sx - TW, sy - WALL_H, sx - TW, sy - WALL_H - 3, sx, sy - TH - WALL_H - 3], wc.cap, 0.7);
        }
      } else {
        fillPoly(g, nwUp(sx, sy, WALL_H), wc.nw);
        if (h > 0) fillPoly(g, nwDown(sx, sy, h * STEP_H), wc.nw);
        fillPoly(g, [sx, sy - TH - WALL_H, sx - TW, sy - WALL_H, sx - TW, sy - WALL_H - 3, sx, sy - TH - WALL_H - 3], wc.cap, 0.7);
        strokePoly(g, nwUp(sx, sy, WALL_H));
      }
    } else if (leftH < h) {
      const fh = (h - leftH) * STEP_H; fillPoly(g, nwDown(sx, sy, fh), wc.stepNw); strokePoly(g, nwDown(sx, sy, fh), 0.22);
    } else if (leftH > h) {
      const fh = (leftH - h) * STEP_H; fillPoly(g, nwUp(sx, sy, fh), wc.stepNw); strokePoly(g, nwUp(sx, sy, fh), 0.22);
    }

    // NE wall
    if (topH < 0) {
      if (isDoorNE) {
        // Door back-wall fill
        fillPoly(g, [sx + TW, sy, sx, sy - TH, sx, sy - TH - DOOR_H, sx + TW, sy - DOOR_H], darken(wc.ne, 0.45));
        const aboveDoor = WALL_H - DOOR_H;
        if (aboveDoor > 0) {
          const pts = [sx + TW, sy - DOOR_H, sx, sy - TH - DOOR_H, sx, sy - TH - WALL_H, sx + TW, sy - WALL_H];
          fillPoly(g, pts, wc.ne); strokePoly(g, pts, 0.18);
          fillPoly(g, [sx + TW, sy - WALL_H, sx, sy - TH - WALL_H, sx, sy - TH - WALL_H - 3, sx + TW, sy - WALL_H - 3], wc.cap, 0.7);
        }
      } else {
        fillPoly(g, neUp(sx, sy, WALL_H), wc.ne);
        if (h > 0) fillPoly(g, neDown(sx, sy, h * STEP_H), wc.ne);
        fillPoly(g, [sx + TW, sy - WALL_H, sx, sy - TH - WALL_H, sx, sy - TH - WALL_H - 3, sx + TW, sy - WALL_H - 3], wc.cap, 0.7);
        strokePoly(g, neUp(sx, sy, WALL_H));
      }
    } else if (topH < h) {
      const fh = (h - topH) * STEP_H; fillPoly(g, neDown(sx, sy, fh), wc.stepNe); strokePoly(g, neDown(sx, sy, fh), 0.22);
    } else if (topH > h) {
      const fh = (topH - h) * STEP_H; fillPoly(g, neUp(sx, sy, fh), wc.stepNe); strokePoly(g, neUp(sx, sy, fh), 0.22);
    }

    // Inner void wall
    if (isInnerVoid(tx + 1, ty) && leftH >= 0) {
      const sx2 = sx + TW, sy2 = sy + TH;
      fillPoly(g, nwUp(sx2, sy2, WALL_H), wc.nw);
      if (h > 0) fillPoly(g, nwDown(sx2, sy2, h * STEP_H), wc.nw);
      fillPoly(g, [sx2, sy2 - TH - WALL_H, sx2 - TW, sy2 - WALL_H, sx2 - TW, sy2 - WALL_H - 3, sx2, sy2 - TH - WALL_H - 3], wc.cap, 0.7);
      strokePoly(g, nwUp(sx2, sy2, WALL_H));
    }

    // Floor tile
    const floorCol = isDoor ? DOOR_FLOOR : ((tx + ty) % 2 === 0 ? fc.a : fc.b);
    fillPoly(g, topFace(sx, sy), floorCol);
    strokePoly(g, topFace(sx, sy), 0.2);

    g.eventMode = 'static'; g.cursor = 'pointer';
    g.on('pointerdown', (e) => { e.stopPropagation(); onTileClick(tx, ty); });
    stage.addChild(g);
  }
}

// ─── Komponente ───────────────────────────────────────────────────────────────
export interface RoomViewerProps {
  modelName: string; heightmap: string; doorX: number; doorY: number;
  ownerNickname: string; isOwner: boolean;
  avatarAction?: AvatarAction;
  appearance?: AvatarAppearance;
  onModelChange?: (m: string) => void;
  wallColor?: number;
  floorColor?: number;
}


export function RoomViewer({ heightmap, doorX, doorY, ownerNickname, avatarAction = 'idle', appearance, wallColor = 0xBEBEB2, floorColor = 0xD6C9B0 }: RoomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef       = useRef<Application | null>(null);
  const stageRef     = useRef<Container | null>(null);
  const initedRef    = useRef(false);

  const hmRef     = useRef(heightmap); hmRef.current = heightmap;
  const dxRef     = useRef(doorX);     dxRef.current = doorX;
  const dyRef     = useRef(doorY);     dyRef.current = doorY;
  const wallColorRef  = useRef(wallColor);  wallColorRef.current = wallColor;
  const floorColorRef = useRef(floorColor); floorColorRef.current = floorColor;
  const nRef      = useRef(ownerNickname); nRef.current = ownerNickname;
  const actRef    = useRef<AvatarAction>(avatarAction); actRef.current = avatarAction;
  const appearRef = useRef<AvatarAppearance>(appearance ?? DEFAULT_APPEARANCE);
  appearRef.current = appearance ?? DEFAULT_APPEARANCE;

  // Persistent avatar objects (nicht bei jedem redraw neu erstellen)
  const avatarGfxRef   = useRef<Container | null>(null);  // Container für Scale/Flip
  const avatarInnerRef = useRef<Graphics | null>(null);   // Zeichenfläche (lokale Coords)
  const avatarLabelRef = useRef<Text | null>(null);
  const avatarDirRef   = useRef(1);                       // +1 = rechts, -1 = links
  const avatarFacingRef = useRef<AvatarFacing>('front');

  // Bewegungszustand
  const avatarPosRef  = useRef({ tx: -1, ty: -1 });         // letzter gesnappt Kachel
  const avatarFracRef = useRef({ tx: -1.0, ty: -1.0 });     // gleitende Pixel-Position
  const targetPosRef  = useRef<{ tx: number; ty: number } | null>(null);
  const pathRef       = useRef<{ tx: number; ty: number }[]>([]);
  const walkPhaseRef  = useRef(0);
  const animTRef      = useRef(0);
  const tickerCbRef   = useRef<((ticker: Ticker) => void) | null>(null);

  // Viewport-Offsets für Ticker-Updates
  const oxRef = useRef(0);
  const oyRef = useRef(0);
  // Direkter Ref auf den gnd-Layer (Schatten + Zielring) — sicherer als stage.children[0]
  const gndGfxRef = useRef<Graphics | null>(null);

  const getEntrancePos = useCallback(() => {
    const tiles = hmRef.current.trim().split('\n').map(r => r.split(''));
    const getH = makeGetH(tiles);
    const dx = dxRef.current, dy = dyRef.current;
    const doorOnNW = getH(dx-1, dy) < 0;
    const doorOnNE = !doorOnNW && getH(dx, dy-1) < 0;
    // Avatar startet einen Tile INNEN (weg von der Wand)
    // NW-Tür (linke Wand tx=0): spawn bei dx+1 damit Avatar nicht in der Wand steckt
    // NE-Tür (obere Wand ty=0): spawn bei dy+1
    const spawnTx = doorOnNW ? dx + 1 : dx;
    const spawnTy = doorOnNE ? dy + 1 : dy;
    const facing: AvatarFacing = 'side';
    const dir = doorOnNE ? -1 : 1;
    const tileH = getH(spawnTx, spawnTy);
    return { tx: spawnTx, ty: spawnTy, facing, dir, doorOnNW, doorOnNE, tileH };
  }, []);

  const redraw = useCallback(() => {
    const app = appRef.current; const stage = stageRef.current; const el = containerRef.current;
    if (!app || !stage || !el || !avatarGfxRef.current || !avatarInnerRef.current || !avatarLabelRef.current) return;
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;
    const tiles = hmRef.current.trim().split('\n').map(r => r.split(''));
    const getH = makeGetH(tiles);

    const isWalking = pathRef.current.length > 0;
    const effectiveAction = isWalking ? 'walk' as AvatarAction : actRef.current;
    const effectiveT = animTRef.current;

    // Interpolierte Höhe für Avatar berechnen
    const { tx: atx, ty: aty } = avatarFracRef.current;
    const srcH = getH(Math.floor(atx), Math.floor(aty));
    const nextTile = pathRef.current.length > 0 ? pathRef.current[0] : null;
    const dstH = nextTile ? getH(nextTile.tx, nextTile.ty) : srcH;
    const srcHv = srcH >= 0 ? srcH : 0;
    const dstHv = dstH >= 0 ? dstH : srcHv;
    const adx = nextTile ? nextTile.tx - atx : 0, ady = nextTile ? nextTile.ty - aty : 0;
    const distToNext = nextTile ? Math.sqrt(adx*adx + ady*ady) : 1;
    const hProgress = nextTile ? Math.max(0, Math.min(1, 1 - distToNext)) : 0;
    const avatarH = srcHv + (dstHv - srcHv) * hProgress;

    renderRoom(
      stage, tiles, dxRef.current, dyRef.current, W, H,
      avatarFracRef.current, targetPosRef.current,
      avatarGfxRef.current, avatarInnerRef.current, avatarLabelRef.current,
      effectiveAction, effectiveT, appearRef.current,
      avatarDirRef.current, avatarFacingRef.current,
      (tx, ty) => {
        if (getH(tx, ty) < 0) return;
        // Pfad-Start: nächster Schritt falls gerade in Bewegung, sonst aktuelle Kachel
        const moveStart = pathRef.current.length > 0
          ? pathRef.current[0]
          : avatarPosRef.current;
        const path = findPath(moveStart.tx, moveStart.ty, tx, ty, getH);
        if (path.length < 2) return;
        pathRef.current = path.slice(1);
        targetPosRef.current = { tx, ty };
        redraw(); // Zielmarkierung aktualisieren
      },
      oxRef, oyRef, gndGfxRef, avatarH,
      wallColorRef.current, floorColorRef.current,
    );
  }, []);

  // Avatar-Grafik updaten ohne kompletten redraw (für Walk/Tanz/Wink-Animationen)
  const updateAvatarOnly = useCallback(() => {
    const container = avatarGfxRef.current; const inner = avatarInnerRef.current;
    const lbl = avatarLabelRef.current; const stage = stageRef.current;
    if (!container || !inner || !lbl || !stage) return;
    const tiles = hmRef.current.trim().split('\n').map(r => r.split(''));
    const getH = makeGetH(tiles);
    const { tx, ty } = avatarFracRef.current;
    const path = pathRef.current;
    const srcH = getH(Math.floor(tx), Math.floor(ty));
    const nextTile = path.length > 0 ? path[0] : null;
    const dstH = nextTile ? getH(nextTile.tx, nextTile.ty) : srcH;
    const srcHv = srcH >= 0 ? srcH : 0;
    const dstHv = dstH >= 0 ? dstH : srcHv;
    const dx0 = nextTile ? nextTile.tx - tx : 0, dy0 = nextTile ? nextTile.ty - ty : 0;
    const distToNext = nextTile ? Math.sqrt(dx0*dx0 + dy0*dy0) : 1;
    const hProgress = nextTile ? Math.max(0, Math.min(1, 1 - distToNext)) : 0;
    const h = srcHv + (dstHv - srcHv) * hProgress;
    const { sx, sy } = proj(tx, ty, h, oxRef.current, oyRef.current);
    const isWalking = pathRef.current.length > 0;
    const action = isWalking ? 'walk' as AvatarAction : actRef.current;
    const t = animTRef.current; // einheitliche Zeit wie AvatarTestClient (elapsedRef)
    // Sicher prüfen ob avatarInner noch gültig ist (nicht destroyed)
    if ((inner as unknown as { destroyed: boolean }).destroyed) return;
    drawAvatar(inner, 0, 0, action, t, appearRef.current, true, avatarFacingRef.current);
    inner.scale.set(avatarDirRef.current * AVATAR_SCALE, AVATAR_SCALE);
    container.scale.set(1, 1);
    container.position.set(sx, sy);
    lbl.x = sx; lbl.y = sy - 43 * AVATAR_SCALE;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || initedRef.current) return;
    initedRef.current = true;
    let dead = false;

    (async () => {
      const app = new Application();
      await app.init({
        width: el.clientWidth || window.innerWidth,
        height: el.clientHeight || window.innerHeight,
        backgroundAlpha: 0, preference: 'webgl', antialias: true,
        resolution: window.devicePixelRatio || 1, autoDensity: true,
      });
      if (dead) { app.destroy(true); return; }
      const c = app.canvas as HTMLCanvasElement;
      c.style.width = '100%'; c.style.height = '100%'; c.style.display = 'block';
      el.appendChild(c);
      const root = new Container();
      app.stage.addChild(root);
      appRef.current = app; stageRef.current = root;

      // Persistente Avatar-Objekte erstellen
      const avatarContainer = new Container();
      const avatarInner = new Graphics();
      avatarContainer.addChild(avatarInner);
      avatarGfxRef.current   = avatarContainer;
      avatarInnerRef.current = avatarInner;
      avatarLabelRef.current = new Text({
        text: nRef.current,
        style: new TextStyle({
          fontSize: 11, fill: 0xFFFFFF, fontFamily: 'Arial, sans-serif',
          dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
        }),
      });
      avatarLabelRef.current.anchor.set(0.5, 1);

      // Ticker: Bewegung + Animationen (exakt wie AvatarTestClient)
      const SPEED = 2.4;
      const cb = (ticker: Ticker) => {
        try {
          const dt = Math.min(ticker.deltaMS / 1000, 0.1);
          animTRef.current += dt;

          const path = pathRef.current;
          const frac = avatarFracRef.current;

          if (path.length > 0) {
            const prevDepth = Math.floor(frac.tx + frac.ty);

            // Movement
            const next = path[0];
            const dx = next.tx - frac.tx, dy = next.ty - frac.ty;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = SPEED * dt;
            if (dist <= step) {
              frac.tx = next.tx; frac.ty = next.ty;
              avatarPosRef.current = { tx: next.tx, ty: next.ty };
              path.shift();
              if (path.length === 0) { targetPosRef.current = null; }
            } else {
              frac.tx += dx / dist * step;
              frac.ty += dy / dist * step;
            }

            // Direction via calculateRotation + rotToFacing (same as AvatarTestClient)
            if (path.length > 0) {
              const ndx = path[0].tx - frac.tx, ndy = path[0].ty - frac.ty;
              const rot = calculateRotation(0, 0, ndx > 0 ? 1 : ndx < 0 ? -1 : 0, ndy > 0 ? 1 : ndy < 0 ? -1 : 0);
              const [face, d] = rotToFacing(rot);
              avatarFacingRef.current = face;
              avatarDirRef.current = d;
            }

            walkPhaseRef.current += dt;

            if (Math.floor(frac.tx + frac.ty) !== prevDepth) {
              redraw();
            } else {
              updateAvatarOnly();
            }
          } else if (actRef.current === 'dance' || actRef.current === 'wave') {
            updateAvatarOnly();
          }
        } catch (e) { console.error('[RoomViewer ticker]', e); }
      };
      tickerCbRef.current = cb;
      app.ticker.add(cb);

      const entrance = getEntrancePos();
      avatarPosRef.current = entrance;
      avatarFracRef.current = { tx: entrance.tx, ty: entrance.ty };
      avatarFacingRef.current = entrance.facing;
      avatarDirRef.current = entrance.dir;

      redraw();
    })();

    const ro = new ResizeObserver(() => {
      if (!appRef.current || !el || !el.clientWidth) return;
      appRef.current.renderer.resize(el.clientWidth, el.clientHeight);
      redraw();
    });
    ro.observe(el);

    return () => {
      dead = true; ro.disconnect();
      if (appRef.current && tickerCbRef.current) {
        appRef.current.ticker.remove(tickerCbRef.current);
      }
      appRef.current?.destroy(true);
      appRef.current = null; stageRef.current = null;
      avatarGfxRef.current = null; avatarInnerRef.current = null; avatarLabelRef.current = null;
      gndGfxRef.current = null;
      initedRef.current = false;
    };
  }, [redraw, getEntrancePos, updateAvatarOnly]);

  // Heightmap / Modell wechsel → Avatar zurück zum Eingang
  useEffect(() => {
    pathRef.current = []; targetPosRef.current = null; walkPhaseRef.current = 0;
    const entrance = getEntrancePos();
    avatarPosRef.current = entrance;
    avatarFracRef.current = { tx: entrance.tx, ty: entrance.ty };
    avatarFacingRef.current = entrance.facing;
    avatarDirRef.current = entrance.dir;
    redraw();
  }, [heightmap, doorX, doorY, ownerNickname, redraw, getEntrancePos]);

  // Aktion oder Aussehen wechseln → sofort neu zeichnen
  useEffect(() => {
    actRef.current = avatarAction;
    updateAvatarOnly();
  }, [avatarAction, updateAvatarOnly]);

  useEffect(() => {
    appearRef.current = appearance ?? DEFAULT_APPEARANCE;
    updateAvatarOnly();
  }, [appearance, updateAvatarOnly]);

  // Rebuild when colors change
  useEffect(() => { redraw(); }, [wallColor, floorColor, redraw]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  );
}
