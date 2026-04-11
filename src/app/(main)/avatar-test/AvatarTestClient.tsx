'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Sprite, Texture, Rectangle } from 'pixi.js';
import { drawAvatar, drawAvatarAngle, drawShadow, drawSitPose, DEFAULT_APPEARANCE, getSideViewOffsetX, setSideViewOffsetX } from '@/components/game/avatarParts';
import type { AvatarAppearance, AvatarAction, AvatarFacing, HairStyle, ShirtStyle, PantsStyle, HatStyle, ShoeStyle } from '@/components/game/avatarParts';
import { requestAvatarCanvas } from '@/lib/avatarImager/avatarRenderer';
import type { Direction as HabboDirection } from '@/lib/avatarImager/AvatarInfo';

// ─── Room Models (Bobba) ─────────────────────────────────────────────────────
function parseHabboHeightmap(hm: string): number[][] {
  return hm.split(/\r?\n/).filter(r => r.length > 0).map(row =>
    Array.from(row).map(c => c === 'x' ? -1 : parseInt(c, 36))
  );
}
interface RoomModel { id: string; label: string; doorX: number; doorY: number; heightmap: string; }

// ─── LPC Spritesheet constants ───────────────────────────────────────────────
const LPC_FS = 64; // frame size in pixels
// Rotation (0-7) → LPC direction row (0=N, 1=W, 2=S, 3=E)
const LPC_DIR_MAP: number[] = [0, 3, 3, 2, 2, 1, 1, 0];
interface LpcAnim { yOffset: number; cycle: number[]; fps: number; }
const LPC_ANIMS: Record<string, LpcAnim> = {
  walk: { yOffset: 8  * LPC_FS, cycle: [1,2,3,4,5,6,7,8],                fps: 8  },
  idle: { yOffset: 22 * LPC_FS, cycle: [0,0,0,1],                         fps: 3  },
  sit:  { yOffset: 30 * LPC_FS, cycle: [0,0,0,0,0,1,1,1,1,1,2,2,2,2,2], fps: 5  },
  run:  { yOffset: 38 * LPC_FS, cycle: [0,1,2,3,4,5,6,7],                fps: 12 },
  hurt: { yOffset: 20 * LPC_FS, cycle: [0,1,2,3,4,5],                    fps: 6  },
};

// ─── Furniture ───────────────────────────────────────────────────────────────
type FurnitureType = 'table' | 'chair_n' | 'chair_s' | 'chair_e' | 'chair_w';
interface PlacedFurniture { id: number; type: FurnitureType; tx: number; ty: number; }

function findStartTile(model: RoomModel): { x: number; y: number } {
  const map = parseHabboHeightmap(model.heightmap);
  const rows = map.length, cols = map[0]?.length ?? 0;
  for (const t of [
    { x: model.doorX, y: model.doorY },
    { x: model.doorX + 1, y: model.doorY },
    { x: model.doorX, y: model.doorY + 1 },
    { x: model.doorX - 1, y: model.doorY },
    { x: model.doorX, y: model.doorY - 1 },
  ]) {
    if (t.x >= 0 && t.y >= 0 && t.y < rows && t.x < cols && map[t.y][t.x] >= 0) return t;
  }
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) if (map[ty][tx] >= 0) return { x: tx, y: ty };
  return { x: 1, y: 1 };
}

const ROOM_MODELS: RoomModel[] = [
  { id: 'model_s', label: 'S – Klein', doorX: 0, doorY: 3, heightmap:
`xxxxxx
x00000
x00000
000000
x00000
x00000
x00000
x00000` },
  { id: 'model_a', label: 'A – Einfach', doorX: 3, doorY: 5, heightmap:
`xxxxxxxxxxxx
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxx00000000
xxxxxxxxxxxx
xxxxxxxxxxxx` },
  { id: 'model_b', label: 'B – L-Form', doorX: 0, doorY: 5, heightmap:
`xxxxxxxxxxxx
xxxxx0000000
xxxxx0000000
xxxxx0000000
xxxxx0000000
x00000000000
x00000000000
x00000000000
x00000000000
x00000000000
x00000000000
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx` },
  { id: 'model_f', label: 'F – Stufen-L', doorX: 2, doorY: 5, heightmap:
`xxxxxxxxxxxx
xxxxxxx0000x
xxxxxxx0000x
xxx00000000x
xxx00000000x
xxx00000000x
xxx00000000x
x0000000000x
x0000000000x
x0000000000x
x0000000000x
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx` },
  { id: 'model_g', label: 'G – Stufe', doorX: 1, doorY: 7, heightmap:
`xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxx00000
xxxxxxx00000
xxxxxxx00000
xx1111000000
xx1111000000
xx1111000000
xx1111000000
xx1111000000
xx1111000000
xxxxxxx00000
xxxxxxx00000
xxxxxxx00000
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx` },
  { id: 'model_h', label: 'H – Split', doorX: 4, doorY: 4, heightmap:
`xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxx111111x
xxxxx111111x
xxxxx111111x
xxxxx111111x
xxxxx111111x
xxxxx000000x
xxxxx000000x
xxx00000000x
xxx00000000x
xxx00000000x
xxx00000000x
xxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxx` },
  { id: 'model_p', label: 'P – 3 Ebenen', doorX: 0, doorY: 23, heightmap:
`xxxxxxxxxxxxxxxxxxx
xxxxxxx222222222222
xxxxxxx222222222222
xxxxxxx222222222222
xxxxxxx222222222222
xxxxxxx222222222222
xxxxxxx222222222222
xxxxxxx22222222xxxx
xxxxxxx11111111xxxx
x222221111111111111
x222221111111111111
x222221111111111111
x222221111111111111
x222221111111111111
x222221111111111111
x222221111111111111
x222221111111111111
x2222xx11111111xxxx
x2222xx00000000xxxx
x2222xx000000000000
x2222xx000000000000
x2222xx000000000000
x2222xx000000000000
22222xx000000000000
x2222xx000000000000
xxxxxxxxxxxxxxxxxxx` },
  { id: 'model_q', label: 'Q – Komplex 3', doorX: 10, doorY: 4, heightmap:
`xxxxxxxxxxxxxxxxxxx
xxxxxxxxxxx22222222
xxxxxxxxxxx22222222
xxxxxxxxxxx22222222
xxxxxxxxxxx22222222
xxxxxxxxxxx22222222
xxxxxxxxxxx22222222
x222222222222222222
x222222222222222222
x222222222222222222
x222222222222222222
x222222222222222222
x222222222222222222
x2222xxxxxxxxxxxxxx
x2222xxxxxxxxxxxxxx
x2222211111xx000000
x222221111110000000
x222221111110000000
x2222211111xx000000
xx22xxx1111xxxxxxxx
xx11xxx1111xxxxxxxx
x1111xx1111xx000000
x1111xx111110000000
x1111xx111110000000
x1111xx1111xx000000
xxxxxxxxxxxxxxxxxxx` },
  { id: 'model_r', label: 'R – 4 Ebenen', doorX: 10, doorY: 4, heightmap:
`xxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxx33333333333333
xxxxxxxxxxx33333333333333
xxxxxxxxxxx33333333333333
xxxxxxxxxx333333333333333
xxxxxxxxxxx33333333333333
xxxxxxxxxxx33333333333333
xxxxxxx333333333333333333
xxxxxxx333333333333333333
xxxxxxx333333333333333333
xxxxxxx333333333333333333
xxxxxxx333333333333333333
xxxxxxx333333333333333333
x4444433333xxxxxxxxxxxxxx
x4444433333xxxxxxxxxxxxxx
x44444333333222xx000000xx
x44444333333222xx000000xx
xxx44xxxxxxxx22xx000000xx
xxx33xxxxxxxx11xx000000xx
xxx33322222211110000000xx
xxx33322222211110000000xx
xxxxxxxxxxxxxxxxx000000xx
xxxxxxxxxxxxxxxxx000000xx
xxxxxxxxxxxxxxxxx000000xx
xxxxxxxxxxxxxxxxx000000xx
xxxxxxxxxxxxxxxxxxxxxxxxx` },
  { id: 'model_x', label: 'X – Innenhof', doorX: 0, doorY: 12, heightmap:
`xxxxxxxxxxxxxxxxxxxx
x000000000000000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
xxx00xxx0000xxx00xxx
x000000x0000x000000x
x000000x0000x000000x
x000000x0000x000000x
x000000x0000x000000x
0000000x0000x000000x
x000000x0000x000000x
x000000x0000x000000x
x000000x0000x000000x
x000000x0000x000000x
x000000x0000x000000x
x000000xxxxxx000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
x000000000000000000x
xxxxxxxxxxxxxxxxxxxx` },
  { id: 'model_z', label: 'Z – T-Form', doorX: 0, doorY: 9, heightmap:
`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxx00000000000000000000
xxxxxxxxxxx00000000000000000000
xxxxxxxxxxx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
000000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
x00000000xx00000000000000000000
xxxxxxxxxxx00000000000000000000
xxxxxxxxxxx00000000000000000000
xxxxxxxxxxx00000000000000000000
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` },
  { id: 'model_y', label: 'Y – Labyrinth', doorX: 0, doorY: 3, heightmap:
`xxxxxxxxxxxxxxxxxxxxxxxxxxxx
x00000000xx0000000000xx0000x
x00000000xx0000000000xx0000x
000000000xx0000000000xx0000x
x00000000xx0000000000xx0000x
x00000000xx0000xx0000xx0000x
x00000000xx0000xx0000xx0000x
x00000000xx0000xx0000000000x
x00000000xx0000xx0000000000x
xxxxx0000xx0000xx0000000000x
xxxxx0000xx0000xx0000000000x
xxxxx0000xx0000xxxxxxxxxxxxx
xxxxx0000xx0000xxxxxxxxxxxxx
x00000000xx0000000000000000x
x00000000xx0000000000000000x
x00000000xx0000000000000000x
x00000000xx0000000000000000x
x0000xxxxxxxxxxxxxxxxxx0000x
x0000xxxxxxxxxxxxxxxxxx0000x
x00000000000000000000000000x
x00000000000000000000000000x
x00000000000000000000000000x
x00000000000000000000000000x
xxxxxxxxxxxxxxxxxxxxxxxxxxxx` },
];

// ─── Constants ───────────────────────────────────────────────────────────────
const TILE_W = 64, TILE_H = 32, STEP_H = 16, SPEED = 2.4;
const TW = TILE_W / 2, TH = TILE_H / 2;

// Defaults
const DEF_FLOOR = 0x7A9F78, DEF_WALL = 0xBEBEB2;
const DOOR_FLOOR = 0xEDE0BE;
const WALL_H = 112, DOOR_H_PX = 72;

// Derived wall colors from base
function wallColors(base: number) {
  return { nw: base, ne: darken(base, 0.82), cap: lighten(base, 1.12), stepNw: darken(base, 0.70), stepNe: darken(base, 0.58) };
}
function floorColors(base: number) {
  return { a: base, b: lighten(base, 1.15) };
}
function lighten(c: number, f: number) {
  return (clamp8(((c >> 16) & 0xFF) * f) << 16) | (clamp8(((c >> 8) & 0xFF) * f) << 8) | clamp8((c & 0xFF) * f);
}

// ─── Color helpers ───────────────────────────────────────────────────────────
function clamp8(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }
function darken(c: number, f = 0.75) {
  return (clamp8(((c >> 16) & 0xFF) * f) << 16)
       | (clamp8(((c >> 8) & 0xFF) * f) << 8)
       |  clamp8(( c       & 0xFF) * f);
}
function hexToInt(h: string) { return parseInt(h.replace('#', ''), 16); }
function numToHex(n: number) { return '#' + n.toString(16).padStart(6, '0'); }

// ─── Isometric helpers ───────────────────────────────────────────────────────
let MAP: number[][] = [];
let ROWS = 0, COLS = 0;
let DOOR_X = 0, DOOR_Y = 0;

function getH(tx: number, ty: number) {
  if (tx < 0 || ty < 0 || ty >= ROWS || tx >= COLS) return -1;
  return MAP[ty][tx];
}
function toScreen(tx: number, ty: number, h: number) {
  return { sx: (tx - ty) * TW, sy: (tx + ty) * TH - h * STEP_H };
}
function zScore(tx: number, ty: number, h: number, bias = 0) {
  return (tx + ty) * 10000 + h * 100 + bias;
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

// ─── A* (8-directional, Bobba DreamPathfinder style) ─────────────────────────
function findPath(sx: number, sy: number, ex: number, ey: number): { tx: number; ty: number }[] {
  if (getH(ex, ey) < 0) return [];
  const key = (x: number, y: number) => `${x},${y}`;
  type N = { tx: number; ty: number; g: number; f: number; p: N | null };
  const h = (x: number, y: number) => Math.max(Math.abs(ex - x), Math.abs(ey - y));
  const open: N[] = [{ tx: sx, ty: sy, g: 0, f: h(sx, sy), p: null }];
  const closed = new Set<string>();
  const DIRS = [
    { dx: 1, dy: 0, c: 1 }, { dx: -1, dy: 0, c: 1 }, { dx: 0, dy: 1, c: 1 }, { dx: 0, dy: -1, c: 1 },
    { dx: 1, dy: 1, c: 1.4 }, { dx: 1, dy: -1, c: 1.4 }, { dx: -1, dy: 1, c: 1.4 }, { dx: -1, dy: -1, c: 1.4 },
  ];
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.tx, cur.ty);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.tx === ex && cur.ty === ey) {
      const p: { tx: number; ty: number }[] = [];
      let n: N | null = cur; while (n) { p.unshift({ tx: n.tx, ty: n.ty }); n = n.p; } return p.slice(1);
    }
    for (const d of DIRS) {
      const nx = cur.tx + d.dx, ny = cur.ty + d.dy;
      if (getH(nx, ny) < 0 || closed.has(key(nx, ny))) continue;
      if (d.dx !== 0 && d.dy !== 0) {
        if (getH(cur.tx + d.dx, cur.ty) < 0 || getH(cur.tx, cur.ty + d.dy) < 0) continue;
      }
      const g = cur.g + d.c;
      open.push({ tx: nx, ty: ny, g, f: g + h(nx, ny), p: cur });
    }
  }
  return [];
}

// ─── Wall polygon helpers ────────────────────────────────────────────────────
function nwUp(sx: number, sy: number, fh: number) {
  return [sx, sy - TH, sx - TW, sy, sx - TW, sy - fh, sx, sy - TH - fh];
}
function nwDown(sx: number, sy: number, fh: number) {
  return [sx, sy - TH, sx - TW, sy, sx - TW, sy + fh, sx, sy - TH + fh];
}
function neUp(sx: number, sy: number, fh: number) {
  return [sx + TW, sy, sx, sy - TH, sx, sy - TH - fh, sx + TW, sy - fh];
}
function neDown(sx: number, sy: number, fh: number) {
  return [sx + TW, sy, sx, sy - TH, sx, sy - TH + fh, sx + TW, sy + fh];
}
function fillPoly(g: Graphics, pts: number[], color: number, alpha = 1) {
  g.poly(pts); g.fill({ color, alpha });
}
function strokePoly(g: Graphics, pts: number[], alpha = 0.15) {
  g.poly(pts); g.stroke({ color: 0x000000, width: 0.5, alpha });
}

// ─── Furniture drawing ───────────────────────────────────────────────────────
function drawFurniture(g: Graphics, type: FurnitureType, sx: number, sy: number) {
  if (type === 'table') {
    // Legs (drawn first, behind top)
    const legColor = 0x5C3A10;
    const legH = 12;
    // NW leg
    g.rect(sx - TW * 0.7 - 2, sy - legH, 3, legH); g.fill({ color: legColor });
    // NE leg
    g.rect(sx + TW * 0.7 - 1, sy - legH, 3, legH); g.fill({ color: legColor });
    // S leg (left)
    g.rect(sx - TW * 0.15 - 2, sy + TH * 0.7 - legH, 3, legH); g.fill({ color: legColor });
    // S leg (right)
    g.rect(sx + TW * 0.15 - 1, sy + TH * 0.7 - legH, 3, legH); g.fill({ color: legColor });

    // Table sides (slightly elevated)
    const elev = 12;
    const tw = TW * 0.72, th = TH * 0.72;
    // Left side face
    g.poly([sx - tw, sy - elev, sx, sy + th - elev, sx, sy + th - elev + 3, sx - tw, sy - elev + 3]);
    g.fill({ color: darken(0xA0651A, 0.65) });
    // Right side face
    g.poly([sx + tw, sy - elev, sx, sy + th - elev, sx, sy + th - elev + 3, sx + tw, sy - elev + 3]);
    g.fill({ color: darken(0xA0651A, 0.80) });
    // Table top diamond
    g.poly([sx, sy - th - elev, sx + tw, sy - elev, sx, sy + th - elev, sx - tw, sy - elev]);
    g.fill({ color: 0xC49A28 });
    g.stroke({ color: 0x7A5010, width: 0.8, alpha: 0.6 });

  } else {
    // Chair — proper isometric construction
    const elev = 10;          // seat height off floor
    const sw = TW * 0.44, sh = TH * 0.44;   // seat half-extents in screen space
    const legH = elev;
    const backH = 19;         // backrest height in pixels
    const seatColor = 0x8B5E3C;
    const sideColorL = darken(seatColor, 0.65);
    const sideColorR = darken(seatColor, 0.80);
    const backColorFace = darken(seatColor, 0.68);
    const backColorTop  = darken(seatColor, 0.55);
    const legColor = darken(seatColor, 0.50);

    // ── Legs (4 thin vertical rects at diamond corners) ──
    const legW = 2.5;
    // Left corner leg
    g.rect(sx - sw - 1, sy - elev, legW, legH); g.fill({ color: legColor });
    // Right corner leg
    g.rect(sx + sw - legW, sy - elev, legW, legH); g.fill({ color: legColor });
    // Top (back) leg — partially hidden behind seat
    g.rect(sx - legW / 2, sy - sh - elev, legW, legH); g.fill({ color: legColor });
    // Bottom (front) leg
    g.rect(sx - legW / 2, sy + sh - elev, legW, legH); g.fill({ color: legColor });

    // ── Seat side thickness faces (2px thick) ──
    // NW face (left side)
    g.poly([sx, sy - sh - elev, sx - sw, sy - elev,  sx - sw, sy - elev + 2.5, sx, sy - sh - elev + 2.5]);
    g.fill({ color: sideColorL });
    // NE face (right side)
    g.poly([sx, sy - sh - elev, sx + sw, sy - elev,  sx + sw, sy - elev + 2.5, sx, sy - sh - elev + 2.5]);
    g.fill({ color: sideColorR });

    // ── Seat top (diamond) ──
    g.poly([sx, sy - sh - elev,  sx + sw, sy - elev,  sx, sy + sh - elev,  sx - sw, sy - elev]);
    g.fill({ color: seatColor });
    g.stroke({ color: darken(seatColor, 0.45), width: 0.7, alpha: 0.55 });

    // ── Backrest: isometric parallelogram panel along the chosen edge ──
    // Each backrest follows one of the 4 iso diamond faces, raised vertically
    if (type === 'chair_n') {
      // NW edge: from left-corner to top-corner → "left wall" direction
      g.poly([sx, sy - sh - elev,  sx - sw, sy - elev,  sx - sw, sy - elev - backH,  sx, sy - sh - elev - backH]);
      g.fill({ color: backColorFace });
      // cap strip
      g.poly([sx, sy - sh - elev - backH,  sx - sw, sy - elev - backH,  sx - sw, sy - elev - backH - 2,  sx, sy - sh - elev - backH - 2]);
      g.fill({ color: backColorTop });
    } else if (type === 'chair_e') {
      // NE edge: from top-corner to right-corner → "right wall" direction
      g.poly([sx, sy - sh - elev,  sx + sw, sy - elev,  sx + sw, sy - elev - backH,  sx, sy - sh - elev - backH]);
      g.fill({ color: backColorFace });
      g.poly([sx, sy - sh - elev - backH,  sx + sw, sy - elev - backH,  sx + sw, sy - elev - backH - 2,  sx, sy - sh - elev - backH - 2]);
      g.fill({ color: backColorTop });
    } else if (type === 'chair_s') {
      // SE edge: from right-corner to bottom-corner
      g.poly([sx + sw, sy - elev,  sx, sy + sh - elev,  sx, sy + sh - elev - backH,  sx + sw, sy - elev - backH]);
      g.fill({ color: backColorFace });
      g.poly([sx + sw, sy - elev - backH,  sx, sy + sh - elev - backH,  sx, sy + sh - elev - backH - 2,  sx + sw, sy - elev - backH - 2]);
      g.fill({ color: backColorTop });
    } else {
      // chair_w: SW edge: from left-corner to bottom-corner
      g.poly([sx - sw, sy - elev,  sx, sy + sh - elev,  sx, sy + sh - elev - backH,  sx - sw, sy - elev - backH]);
      g.fill({ color: backColorFace });
      g.poly([sx - sw, sy - elev - backH,  sx, sy + sh - elev - backH,  sx, sy + sh - elev - backH - 2,  sx - sw, sy - elev - backH - 2]);
      g.fill({ color: backColorTop });
    }
  }
}

function chairFacing(type: FurnitureType): [AvatarFacing, number] {
  switch (type) {
    case 'chair_n': return ['front',  1];  // Rückenlehne NW → Blick nach SE (zum Betrachter)
    case 'chair_s': return ['back',  -1];  // Rückenlehne SO → Blick nach NW (vom Betrachter weg)
    case 'chair_e': return ['side',  -1];  // Rückenlehne NO → Blick nach SW (linke Seite)
    case 'chair_w': return ['side',   1];  // Rückenlehne SW → Blick nach NO (rechte Seite)
    default:        return ['front',  1];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════
export default function AvatarTestClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initedRef = useRef(false);

  const [action,  setAction]  = useState<AvatarAction>('idle');
  const [facing,  setFacing]  = useState<AvatarFacing | 'auto'>('auto');
  const [dir,     setDir]     = useState(1);
  const [scale,   setScale]   = useState(1.45);
  const [app2,    setApp2]    = useState<AvatarAppearance>({ ...DEFAULT_APPEARANCE });
  const [info,    setInfo]    = useState('');
  const [habboMode, setHabboMode] = useState(false);
  const [habboFigure, setHabboFigure] = useState('hd-180-1.hr-828-61.ch-210-66.lg-270-82.sh-290-80');
  const [pixelOffsetX, setPixelOffsetX] = useState(getSideViewOffsetX());
  const [turntableDeg, setTurntableDeg] = useState(0); // 0°=vorne, 90°=rechte Seite, 180°=Rücken, 270°=linke Seite
  const [turntableMode, setTurntableMode] = useState(false); // Drehteller-Modus (stufenlos)
  const [selectedRoom, setSelectedRoom] = useState(ROOM_MODELS[0].id);
  const [wallColor, setWallColor] = useState(DEF_WALL);
  const [floorColor, setFloorColor] = useState(DEF_FLOOR);

  // Inventory
  const [placedItems, setPlacedItems] = useState<PlacedFurniture[]>([]);
  const [armedItem, setArmedItem] = useState<FurnitureType | null>(null);
  const placedItemsRef = useRef<PlacedFurniture[]>([]);
  const armedItemRef = useRef<FurnitureType | null>(null);
  const nextItemIdRef = useRef(0);

  // LPC Spritesheet mode
  const [lpcMode, setLpcMode] = useState(false);
  const lpcModeRef = useRef(false);
  const lpcFramesRef = useRef<Record<string, Texture>>({});

  // Auto-load default LPC spritesheet on mount
  useEffect(() => {
    function loadLpcSheet(src: string) {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d')!.drawImage(img, 0, 0);
        const baseTex = Texture.from(c);
        const frames: Record<string, Texture> = {};
        for (const [animKey, anim] of Object.entries(LPC_ANIMS)) {
          const unique = [...new Set(anim.cycle)];
          for (let dir = 0; dir < 4; dir++) {
            for (const fi of unique) {
              const key = `${animKey}_${dir}_${fi}`;
              frames[key] = new Texture({ source: baseTex.source, frame: new Rectangle(fi * LPC_FS, anim.yOffset + dir * LPC_FS, LPC_FS, LPC_FS) });
            }
          }
        }
        lpcFramesRef.current = frames;
        lpcModeRef.current = true;
        setLpcMode(true);
      };
      img.src = src;
    }
    loadLpcSheet('/lpc-default.png');
  }, []);

  const stateRef = useRef({
    action: 'idle' as AvatarAction, facing: 'auto' as AvatarFacing | 'auto', dir: 1, scale: 1.45,
    app2: { ...DEFAULT_APPEARANCE }, habboMode: false, habboFigure: 'hd-180-1.hr-828-61.ch-210-66.lg-270-82.sh-290-80',
    turntableMode: false, turntableDeg: 0,
  });
  useEffect(() => {
    stateRef.current = { action, facing, dir, scale, app2, habboMode, habboFigure, turntableMode, turntableDeg };
  }, [action, facing, dir, scale, app2, habboMode, habboFigure, turntableMode, turntableDeg]);

  const fracRef   = useRef({ x: 2, y: 2 });
  const pathRef   = useRef<{ tx: number; ty: number }[]>([]);
  const avFaceRef = useRef<AvatarFacing>('side');
  const avDirRef  = useRef(1);
  const avRotRef  = useRef(2);
  const elapsedRef = useRef(0);
  const setActionRef = useRef(setAction);
  useEffect(() => { setActionRef.current = setAction; }, [setAction]);

  // Room colors refs
  const wallColorRef = useRef(DEF_WALL);
  const floorColorRef = useRef(DEF_FLOOR);
  useEffect(() => { wallColorRef.current = wallColor; floorColorRef.current = floorColor; }, [wallColor, floorColor]);

  // World container refs for camera
  const worldRef = useRef<Container | null>(null);
  const tileLayerRef = useRef<Container | null>(null);
  const avatarContainerRef = useRef<Container | null>(null);
  const avatarGfxRef = useRef<Graphics | null>(null);
  const avatarSpriteRef = useRef<Sprite | null>(null);
  const hoverGfxRef = useRef<Graphics | null>(null);
  const goalGfxRef = useRef<Graphics | null>(null);

  // Camera drag
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const zoomRef = useRef(1.45);

  // ── Room switching ──
  useEffect(() => {
    const model = ROOM_MODELS.find(m => m.id === selectedRoom) ?? ROOM_MODELS[0];
    MAP = parseHabboHeightmap(model.heightmap);
    ROWS = MAP.length;
    COLS = MAP[0].length;
    DOOR_X = model.doorX;
    DOOR_Y = model.doorY;
    pathRef.current = [];
    setAction('idle');
    const start = findStartTile(model);
    fracRef.current = { x: start.x, y: start.y };

    // Rebuild tiles if pixi is ready
    if (tileLayerRef.current && worldRef.current) {
      buildRoom();
      centerCamera();
    }
  }, [selectedRoom]);

  // ── Furniture layer ──
  function rebuildFurnitureLayer() {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;
    for (const item of placedItemsRef.current) {
      const h = Math.max(0, getH(item.tx, item.ty));
      const { sx, sy } = toScreen(item.tx, item.ty, h);
      const g = new Graphics();
      drawFurniture(g, item.type, sx, sy);
      g.zIndex = zScore(item.tx, item.ty, h, 20);
      tileLayer.addChild(g);
    }
  }

  // ── Build room tiles + walls ──
  function buildRoom() {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;

    // Preserve avatar container, destroy everything else
    const avatarCont = avatarContainerRef.current;
    const toDestroy = tileLayer.children.filter(c => c !== avatarCont);
    for (const child of toDestroy) {
      tileLayer.removeChild(child);
      child.destroy();
    }

    // Re-add overlay graphics
    const hoverG = new Graphics();
    hoverG.visible = false;
    hoverG.zIndex = 999998;
    hoverGfxRef.current = hoverG;
    tileLayer.addChild(hoverG);

    const goalG = new Graphics();
    goalG.visible = false;
    goalG.zIndex = 999997;
    goalGfxRef.current = goalG;
    tileLayer.addChild(goalG);

    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const h = getH(tx, ty);
        if (h < 0) continue;
        const { sx, sy } = toScreen(tx, ty, h);

        const g = new Graphics();

        // ── Colors ──
        const wc = wallColors(wallColorRef.current);
        const fc = floorColors(floorColorRef.current);

        // ── Walls ──
        const leftH = getH(tx - 1, ty);
        const topH  = getH(tx, ty - 1);
        const isDoorNW = (tx === DOOR_X && ty === DOOR_Y && leftH < 0);
        const isDoorNE = (tx === DOOR_X && ty === DOOR_Y && topH < 0);

        // NW wall
        if (leftH < 0) {
          if (isDoorNW) {
            // Back wall fill — covers the door opening so you can't see through
            fillPoly(g, [sx, sy - TH, sx - TW, sy, sx - TW, sy - DOOR_H_PX, sx, sy - TH - DOOR_H_PX], darken(wc.nw, 0.45));
            // Wall section above door opening
            const aboveDoor = WALL_H - DOOR_H_PX;
            if (aboveDoor > 0) {
              const pts = [sx, sy - TH - DOOR_H_PX, sx - TW, sy - DOOR_H_PX, sx - TW, sy - WALL_H, sx, sy - TH - WALL_H];
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
            // Back wall fill — covers the door opening
            fillPoly(g, [sx + TW, sy, sx, sy - TH, sx, sy - TH - DOOR_H_PX, sx + TW, sy - DOOR_H_PX], darken(wc.ne, 0.45));
            // Wall section above door opening
            const aboveDoor = WALL_H - DOOR_H_PX;
            if (aboveDoor > 0) {
              const pts = [sx + TW, sy - DOOR_H_PX, sx, sy - TH - DOOR_H_PX, sx, sy - TH - WALL_H, sx + TW, sy - WALL_H];
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

        // ── Height side faces ──
        if (h > 0) {
          const wH = h * STEP_H;
          g.poly([sx - TW, sy, sx, sy + TH, sx, sy + TH + wH, sx - TW, sy + wH]);
          g.fill({ color: darken(fc.a, 0.52) });
          g.poly([sx + TW, sy, sx, sy + TH, sx, sy + TH + wH, sx + TW, sy + wH]);
          g.fill({ color: darken(fc.a, 0.72) });
        }

        // ── Floor tile diamond ──
        const isDoor = tx === DOOR_X && ty === DOOR_Y;
        const floorCol = isDoor ? DOOR_FLOOR : (tx + ty) % 2 === 0 ? fc.a : fc.b;
        g.poly([sx, sy - TH, sx + TW, sy, sx, sy + TH, sx - TW, sy]);
        g.fill({ color: floorCol });
        g.stroke({ color: darken(floorCol, 0.48), width: 0.6, alpha: 0.4 });

        g.zIndex = zScore(tx, ty, h);
        tileLayer.addChild(g);
      }
    }

    // (Door back-wall fill is drawn inline within the tile loop above)

    // Draw placed furniture on top of tiles
    rebuildFurnitureLayer();
  }

  function centerCamera() {
    const world = worldRef.current;
    const app = appRef.current;
    if (!world || !app) return;

    // Compute bounding box of all tiles
    let minSx = Infinity, maxSx = -Infinity, minSy = Infinity, maxSy = -Infinity;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const h = getH(tx, ty);
        if (h < 0) continue;
        const { sx, sy } = toScreen(tx, ty, h);
        minSx = Math.min(minSx, sx - TW);
        maxSx = Math.max(maxSx, sx + TW);
        minSy = Math.min(minSy, sy - TH - WALL_H);
        maxSy = Math.max(maxSy, sy + TH + (h > 0 ? h * STEP_H : 0));
      }
    }
    const cx = (minSx + maxSx) / 2;
    const cy = (minSy + maxSy) / 2;
    const z = zoomRef.current;
    world.position.set(app.screen.width / 2 - cx * z, app.screen.height / 2 - cy * z);
    world.scale.set(z);
  }

  // ── PixiJS Init ──
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const el = containerRef.current!;
    const app = new Application();
    appRef.current = app;

    (async () => {
      await app.init({
        resizeTo: el,
        background: 0x243322,
        preference: 'webgl',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      el.appendChild(canvas);

      // Container hierarchy
      const world = new Container();
      world.sortableChildren = false;
      world.eventMode = 'passive';
      app.stage.addChild(world);
      worldRef.current = world;

      const tileLayer = new Container();
      tileLayer.sortableChildren = true;
      tileLayer.eventMode = 'passive';
      world.addChild(tileLayer);
      tileLayerRef.current = tileLayer;

      // Avatar container
      const avatarCont = new Container();
      avatarCont.sortableChildren = false;
      const avatarGfx = new Graphics();
      const avatarSprite = new Sprite();
      avatarSprite.anchor.set(0.5, 1);
      avatarSprite.visible = false;
      avatarCont.addChild(avatarGfx);
      avatarCont.addChild(avatarSprite);
      tileLayer.addChild(avatarCont);
      avatarContainerRef.current = avatarCont;
      avatarGfxRef.current = avatarGfx;
      avatarSpriteRef.current = avatarSprite;

      // Build initial room
      buildRoom();
      centerCamera();

      // ── screenToTile: convert mouse position → tile coords ──
      function screenToTile(clientX: number, clientY: number): { tx: number; ty: number } | null {
        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        // Undo world transform (position + scale)
        const wx = (mx - world.position.x) / world.scale.x;
        const wy = (my - world.position.y) / world.scale.y;
        // Find closest walkable tile
        let best: { tx: number; ty: number } | null = null, bestD = Infinity;
        for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
          const h = getH(tx, ty); if (h < 0) continue;
          const { sx, sy } = toScreen(tx, ty, h);
          const d = Math.abs(wx - sx) + Math.abs(wy - sy);
          if (d < bestD && d < 55) { bestD = d; best = { tx, ty }; }
        }
        return best;
      }

      // ── Click to walk / place furniture ──
      canvas.addEventListener('click', (e: MouseEvent) => {
        if (e.button !== 0) return;
        const tile = screenToTile(e.clientX, e.clientY);
        if (!tile) return;

        if (armedItemRef.current) {
          const h = getH(tile.tx, tile.ty);
          if (h < 0) return;
          const newItem: PlacedFurniture = { id: nextItemIdRef.current++, type: armedItemRef.current, tx: tile.tx, ty: tile.ty };
          setPlacedItems(prev => {
            const next = [...prev, newItem];
            placedItemsRef.current = next;
            return next;
          });
          setArmedItem(null);
          armedItemRef.current = null;
          return;
        }

        const frac = fracRef.current;
        const p = findPath(Math.floor(frac.x), Math.floor(frac.y), tile.tx, tile.ty);
        if (p.length > 0) { pathRef.current = p; setActionRef.current('walk'); }
      });

      // ── Hover ──
      canvas.addEventListener('mousemove', (e: MouseEvent) => {
        if (dragRef.current.dragging) return;
        const tile = screenToTile(e.clientX, e.clientY);
        const hg = hoverGfxRef.current;
        if (!hg) return;
        if (tile) {
          const h = getH(tile.tx, tile.ty);
          const s = toScreen(tile.tx, tile.ty, h);
          hg.clear();
          hg.poly([s.sx, s.sy - TH, s.sx + TW, s.sy, s.sx, s.sy + TH, s.sx - TW, s.sy]);
          const hasChair = !armedItemRef.current && placedItemsRef.current.some(
            item => item.type !== 'table' && item.tx === tile.tx && item.ty === tile.ty
          );
          hg.fill({ color: armedItemRef.current ? 0xFFDD44 : hasChair ? 0xAA88FF : 0xFFFFFF, alpha: 0.25 });
          if (armedItemRef.current) {
            // Preview furniture ghost
            hg.alpha = 0.55;
            drawFurniture(hg, armedItemRef.current, s.sx, s.sy);
          } else {
            hg.alpha = 1;
          }
          hg.visible = true;
        } else {
          hg.visible = false;
        }
      });

      // ── Camera: drag (right/middle mouse) ──
      canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button === 1 || e.button === 2) {
          dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
          e.preventDefault();
        }
      });
      canvas.addEventListener('pointermove', (e: PointerEvent) => {
        if (!dragRef.current.dragging) return;
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        world.position.x += dx;
        world.position.y += dy;
      });
      const stopDrag = () => { dragRef.current.dragging = false; };
      canvas.addEventListener('pointerup', stopDrag);
      canvas.addEventListener('pointerleave', stopDrag);
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (armedItemRef.current) { setArmedItem(null); armedItemRef.current = null; }
      });

      // ── Camera: zoom ──
      canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const oldZ = zoomRef.current;
        const newZ = Math.max(0.3, Math.min(4, oldZ * (1 - e.deltaY * 0.001)));
        zoomRef.current = newZ;
        setScale(newZ);

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const ratio = newZ / oldZ;
        world.position.x = mx - (mx - world.position.x) * ratio;
        world.position.y = my - (my - world.position.y) * ratio;
        world.scale.set(newZ);
      }, { passive: false });

      // ── Ticker ──
      let prevTexKey = '';
      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        elapsedRef.current += dt;

        const { action, facing, dir, scale: sc, app2: ap, habboMode, habboFigure } = stateRef.current;
        const frac = fracRef.current, path = pathRef.current;

        // Movement
        if (path.length > 0 && action !== 'sit') {
          const next = path[0];
          const dx = next.tx - frac.x, dy = next.ty - frac.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const step = SPEED * dt;
          if (dist <= step) {
            frac.x = next.tx; frac.y = next.ty; path.shift();
            if (path.length === 0) {
              const chair = placedItemsRef.current.find(
                item => item.type !== 'table' && item.tx === next.tx && item.ty === next.ty
              );
              if (chair) {
                const [face, d] = chairFacing(chair.type);
                avFaceRef.current = face;
                avDirRef.current = d;
                setActionRef.current('sit');
              } else {
                setActionRef.current('idle');
              }
            }
          } else {
            frac.x += dx / dist * step;
            frac.y += dy / dist * step;
          }
          if (facing === 'auto' && path.length > 0) {
            const ndx = path[0].tx - frac.x, ndy = path[0].ty - frac.y;
            const rot = calculateRotation(0, 0, ndx > 0 ? 1 : ndx < 0 ? -1 : 0, ndy > 0 ? 1 : ndy < 0 ? -1 : 0);
            const [face, d] = rotToFacing(rot);
            avFaceRef.current = face; avDirRef.current = d; avRotRef.current = rot;
          }
        }

        // Avatar height (interpolated)
        const floorH = Math.max(0, getH(Math.floor(frac.x), Math.floor(frac.y)));
        let avH = floorH;
        if (path.length > 0) {
          const nH = Math.max(0, getH(path[0].tx, path[0].ty));
          const dx0 = path[0].tx - frac.x, dy0 = path[0].ty - frac.y;
          const d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
          avH = floorH + (nH - floorH) * Math.max(0, Math.min(1, 1 - d0));
        }

        const { sx: asx, sy: asy } = toScreen(frac.x, frac.y, avH);
        const f = facing === 'auto' ? avFaceRef.current : facing as AvatarFacing;
        const d = facing === 'auto' ? avDirRef.current : dir;

        // Lift avatar when sitting on a placed chair (seat is 10px above floor)
        const onChair = action === 'sit' && placedItemsRef.current.some(
          item => item.type !== 'table' &&
          item.tx === Math.round(frac.x) && item.ty === Math.round(frac.y)
        );
        avatarCont.position.set(asx, asy - (onChair ? 10 : 0));
        avatarCont.zIndex = zScore(frac.x, frac.y, avH, 50);

        if (lpcModeRef.current && Object.keys(lpcFramesRef.current).length > 0) {
          // ── LPC Spritesheet mode ──
          avatarGfx.visible = false;
          avatarSprite.visible = true;

          const lpcDir = LPC_DIR_MAP[avRotRef.current] ?? 2;
          const animKey = action === 'walk' ? 'walk'
            : action === 'sit'  ? 'sit'
            : 'idle';
          const anim = LPC_ANIMS[animKey] ?? LPC_ANIMS.idle;
          const cycleIdx = Math.floor(elapsedRef.current * anim.fps) % anim.cycle.length;
          const frameX = anim.cycle[cycleIdx];
          const texKey = `${animKey}_${lpcDir}_${frameX}`;

          const tex = lpcFramesRef.current[texKey];
          if (tex) avatarSprite.texture = tex;

          const lpcScale = sc * (80 / LPC_FS);
          avatarSprite.scale.set(lpcScale);
          avatarSprite.anchor.set(0.5, 1);
          avatarSprite.y = 4;
        } else if (habboMode) {
          // Habbo sprite mode
          avatarGfx.visible = false;
          avatarSprite.visible = true;

          const isWalk = action === 'walk';
          const isWave = action === 'wave';
          const isSit  = action === 'sit';
          const habboAct = isSit ? 'sit' : isWave ? 'wav' : isWalk ? 'wlk' : 'std';
          const fc = Math.floor(Date.now() / 100);
          const frame = isWalk ? fc % 4 : isWave ? fc % 2 : 0;
          const habboDir = avRotRef.current as HabboDirection;

          const texKey = `${habboFigure}|${habboDir}|${habboAct}|${frame}`;
          if (texKey !== prevTexKey) {
            prevTexKey = texKey;
            const habboCanvas = requestAvatarCanvas(habboFigure, habboDir, (habboAct === 'sit' ? 'std' : habboAct) as 'wlk' | 'std' | 'wav', frame);
            if (habboCanvas) {
              const tex = Texture.from(habboCanvas);
              avatarSprite.texture = tex;
            }
          }
          const targetH = 80 * sc;
          const spriteScale = avatarSprite.texture.width > 0 ? targetH / avatarSprite.texture.height : 1;
          avatarSprite.scale.set(spriteScale);
          avatarSprite.y = 4;
        } else if (stateRef.current.turntableMode) {
          // Drehteller-Modus: stufenlos drehbar
          avatarSprite.visible = false;
          avatarGfx.visible = true;
          avatarGfx.clear();

          drawAvatarAngle(avatarGfx, 0, 0, stateRef.current.turntableDeg, action, elapsedRef.current, ap, true);
          avatarGfx.scale.set(sc, sc);
        } else {
          // Custom procedural mode (3 feste Ansichten)
          avatarSprite.visible = false;
          avatarGfx.visible = true;
          avatarGfx.clear();

          drawAvatar(avatarGfx, 0, 0, action, elapsedRef.current, ap, true, f);
          avatarGfx.scale.set(d * sc, sc);
        }

        // Goal marker
        const goalG = goalGfxRef.current;
        if (goalG) {
          if (path.length > 0) {
            const last = path[path.length - 1];
            const gh = getH(last.tx, last.ty);
            const gs = toScreen(last.tx, last.ty, gh);
            goalG.clear();
            goalG.poly([gs.sx, gs.sy - TH, gs.sx + TW, gs.sy, gs.sx, gs.sy + TH, gs.sx - TW, gs.sy]);
            goalG.fill({ color: 0x5db85d, alpha: 0.35 });
            goalG.visible = true;
            goalG.zIndex = zScore(last.tx, last.ty, gh, -1);
          } else {
            goalG.visible = false;
          }
        }

        // Info text
        setInfo(`pos=(${frac.x.toFixed(1)}, ${frac.y.toFixed(1)})  rot=${avRotRef.current}  facing=${f}  dir=${d}  action=${action}`);
      });
    })();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      initedRef.current = false;
    };
  }, []);

  // Sync zoom slider → world
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    zoomRef.current = scale;
    world.scale.set(scale);
  }, [scale]);

  // Sync placedItems → ref → rebuild furniture
  useEffect(() => {
    placedItemsRef.current = placedItems;
    if (tileLayerRef.current) buildRoom();
  }, [placedItems]);

  // Rebuild room when selectedRoom or colors change after init
  const prevRoomRef = useRef(selectedRoom);
  const prevColorsRef = useRef(`${wallColor}-${floorColor}`);
  useEffect(() => {
    const colKey = `${wallColor}-${floorColor}`;
    if (!tileLayerRef.current) return;
    if (prevRoomRef.current !== selectedRoom) {
      prevRoomRef.current = selectedRoom;
      prevColorsRef.current = colKey;
      buildRoom();
      centerCamera();
    } else if (prevColorsRef.current !== colKey) {
      prevColorsRef.current = colKey;
      buildRoom();
    }
  }, [selectedRoom, wallColor, floorColor]);

  const setColor = useCallback((key: keyof AvatarAppearance, hex: string) => {
    setApp2(prev => ({ ...prev, [key]: hexToInt(hex) }));
  }, []);

  const btn = (active: boolean) => `px-2 py-1 text-xs rounded border cursor-pointer font-mono transition-colors
    ${active ? 'bg-red-700 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`;

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 font-mono text-xs overflow-hidden">

      <div className="w-52 min-w-52 bg-slate-950 p-3 overflow-y-auto border-r border-slate-700 space-y-3">
        <h2 className="text-yellow-400 font-bold text-sm">Avatar Tester</h2>

        {/* ── LPC Character Generator ── */}
        <section className="border border-emerald-700/60 rounded-lg p-2 bg-emerald-950/30">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-emerald-400 uppercase tracking-wide text-[10px] font-bold">LPC Character</div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${lpcMode ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-400'}`}>
              {lpcMode ? '● aktiv' : '○ lädt…'}
            </span>
          </div>
          {/* Custom spritesheet override */}
          <label className="flex items-center justify-center gap-1 w-full py-1 rounded-lg cursor-pointer text-[9px] border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all">
            <input
              type="file"
              accept=".png,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                  const c = document.createElement('canvas');
                  c.width = img.width; c.height = img.height;
                  c.getContext('2d')!.drawImage(img, 0, 0);
                  const baseTex = Texture.from(c);
                  const frames: Record<string, Texture> = {};
                  for (const [animKey, anim] of Object.entries(LPC_ANIMS)) {
                    const unique = [...new Set(anim.cycle)];
                    for (let dir = 0; dir < 4; dir++) {
                      for (const fi of unique) {
                        const key = `${animKey}_${dir}_${fi}`;
                        frames[key] = new Texture({ source: baseTex.source, frame: new Rectangle(fi * LPC_FS, anim.yOffset + dir * LPC_FS, LPC_FS, LPC_FS) });
                      }
                    }
                  }
                  lpcFramesRef.current = frames;
                  lpcModeRef.current = true;
                  setLpcMode(true);
                  URL.revokeObjectURL(url);
                };
                img.src = url;
              }}
            />
            📂 Eigenes Spritesheet laden
          </label>
          <a href="http://localhost:8765" target="_blank" rel="noreferrer"
            className="block w-full text-center mt-1 text-[9px] text-emerald-500 hover:text-emerald-300">
            🎨 Generator öffnen (localhost:8765)
          </a>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Map / Raum</div>
          <select
            className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-[10px] text-slate-200"
            value={selectedRoom}
            onChange={e => setSelectedRoom(e.target.value)}
          >
            {ROOM_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Raum-Farben</div>
          <label className="flex items-center gap-2 mb-1">
            <input type="color" value={numToHex(wallColor)} onChange={e => setWallColor(hexToInt(e.target.value))} className="w-7 h-6 cursor-pointer rounded" />
            <span className="text-slate-400">Wand</span>
          </label>
          <label className="flex items-center gap-2 mb-1">
            <input type="color" value={numToHex(floorColor)} onChange={e => setFloorColor(hexToInt(e.target.value))} className="w-7 h-6 cursor-pointer rounded" />
            <span className="text-slate-400">Boden</span>
          </label>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Animation</div>
          <div className="flex flex-wrap gap-1">
            {(['idle', 'walk', 'wave', 'dance', 'sit'] as AvatarAction[]).map(a => (
              <button key={a} className={btn(action === a)} onClick={() => { setAction(a); if (a !== 'walk') pathRef.current = []; }}>{a}</button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Blickrichtung</div>
          <div className="flex flex-wrap gap-1">
            {(['auto', 'side', 'back', 'front'] as const).map(f => (
              <button key={f} className={btn(facing === f)} onClick={() => setFacing(f)}>{f}</button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Dir (bei force)</div>
          <div className="flex gap-1">
            <button className={btn(dir === 1)}  onClick={() => setDir(1)}>→ rechts</button>
            <button className={btn(dir === -1)} onClick={() => setDir(-1)}>← links</button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <div className="text-red-400 uppercase tracking-wide text-[10px]">Drehteller</div>
            <button
              className={`px-2 py-0.5 text-xs rounded border font-mono ${turntableMode ? 'bg-red-700 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
              onClick={() => setTurntableMode(p => !p)}
            >{turntableMode ? 'ON ✓' : 'OFF'}</button>
          </div>
          {turntableMode && (
            <div>
              <div className="text-[10px] text-sky-300 font-mono text-center mb-1">{turntableDeg}°</div>
              <div className="flex items-center gap-1 mb-1">
                <button className="px-2 py-0.5 bg-slate-700 rounded text-xs" onClick={() => setTurntableDeg(d => ((d - 1) + 360) % 360)}>◀ -1°</button>
                <input type="range" min={0} max={359} step={1} value={turntableDeg}
                  onChange={e => setTurntableDeg(parseInt(e.target.value))} className="flex-1 accent-red-400" />
                <button className="px-2 py-0.5 bg-slate-700 rounded text-xs" onClick={() => setTurntableDeg(d => (d + 1) % 360)}>+1° ▶</button>
              </div>
              <div className="flex items-center gap-1">
                <button className="px-1.5 py-0.5 bg-slate-700 rounded text-[9px]" onClick={() => setTurntableDeg(0)}>0° Vorne</button>
                <button className="px-1.5 py-0.5 bg-slate-700 rounded text-[9px]" onClick={() => setTurntableDeg(90)}>90° Seite</button>
                <button className="px-1.5 py-0.5 bg-slate-700 rounded text-[9px]" onClick={() => setTurntableDeg(180)}>180° Rücken</button>
                <button className="px-1.5 py-0.5 bg-slate-700 rounded text-[9px]" onClick={() => setTurntableDeg(270)}>270° Links</button>
              </div>
            </div>
          )}
          {!turntableMode && (() => {
            const ROT_LABELS = ['0 ↑ N','1 ↗ NE','2 → E','3 ↘ SE','4 ↓ S','5 ↙ SW','6 ← W','7 ↖ NW'];
            const applyRot = (r: number) => {
              const faces: Record<number, [AvatarFacing|'auto', number]> = {
                0: ['back',  1], 1: ['side',  1], 2: ['side',  1], 3: ['front', 1],
                4: ['front',-1], 5: ['side', -1], 6: ['side', -1], 7: ['back', -1],
              };
              const [f, d] = faces[r];
              setFacing(f); setDir(d);
            };
            const curRot = facing === 'back' && dir === 1 ? 0 : facing === 'side' && dir === 1 ? 2
              : facing === 'front' && dir === 1 ? 3 : facing === 'front' && dir === -1 ? 4
              : facing === 'side' && dir === -1 ? 6 : facing === 'back' && dir === -1 ? 7 : -1;
            return (
              <div className="mt-1">
                <div className="flex items-center gap-1 mb-1">
                  <button className="px-2 py-0.5 bg-slate-700 rounded text-xs" onClick={() => applyRot(((curRot < 0 ? 0 : curRot) + 7) % 8)}>◀</button>
                  <span className="flex-1 text-center text-[10px] text-sky-300 font-mono">{curRot >= 0 ? ROT_LABELS[curRot] : 'auto'}</span>
                  <button className="px-2 py-0.5 bg-slate-700 rounded text-xs" onClick={() => applyRot(((curRot < 0 ? 0 : curRot) + 1) % 8)}>▶</button>
                </div>
                <div className="grid grid-cols-4 gap-0.5">
                  {ROT_LABELS.map((label, i) => (
                    <button key={i} className={`text-[8px] px-1 py-0.5 rounded ${curRot === i ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      onClick={() => applyRot(i)}>{label}</button>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Haut &amp; Haar</div>
          {(['skinColor', 'hairColor'] as const).map(k => (
            <label key={k} className="flex items-center gap-2 mb-1">
              <input type="color" value={numToHex(app2[k] as number)} onChange={e => setColor(k, e.target.value)} className="w-7 h-6 cursor-pointer rounded" />
              <span className="text-slate-400">{k === 'skinColor' ? 'Haut' : 'Haar'}</span>
            </label>
          ))}
          <select className="w-full bg-slate-800 border border-slate-600 rounded p-1 mt-1"
            value={app2.hairStyle} onChange={e => setApp2(p => ({ ...p, hairStyle: e.target.value as HairStyle }))}>
            {['short', 'long', 'mohawk', 'bald'].map(s => <option key={s}>{s}</option>)}
          </select>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Kleidung</div>
          <label className="flex items-center gap-2 mb-1">
            <input type="color" value={numToHex(app2.shirtColor)} onChange={e => setColor('shirtColor', e.target.value)} className="w-7 h-6 cursor-pointer rounded" />
            <span className="text-slate-400">Shirt</span>
          </label>
          <select className="w-full bg-slate-800 border border-slate-600 rounded p-1 mb-1"
            value={app2.shirtStyle} onChange={e => setApp2(p => ({ ...p, shirtStyle: e.target.value as ShirtStyle }))}>
            {['tshirt', 'hoodie', 'suit'].map(s => <option key={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 mb-1">
            <input type="color" value={numToHex(app2.pantsColor)} onChange={e => setColor('pantsColor', e.target.value)} className="w-7 h-6 cursor-pointer rounded" />
            <span className="text-slate-400">Hose</span>
          </label>
          <select className="w-full bg-slate-800 border border-slate-600 rounded p-1 mb-1"
            value={app2.pantsStyle} onChange={e => setApp2(p => ({ ...p, pantsStyle: e.target.value as PantsStyle }))}>
            {['jeans', 'shorts'].map(s => <option key={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 mb-1">
            <input type="color" value={numToHex(app2.shoeColor)} onChange={e => setColor('shoeColor', e.target.value)} className="w-7 h-6 cursor-pointer rounded" />
            <span className="text-slate-400">Schuhe</span>
          </label>
          <select className="w-full bg-slate-800 border border-slate-600 rounded p-1 mb-1"
            value={app2.shoeStyle} onChange={e => setApp2(p => ({ ...p, shoeStyle: e.target.value as ShoeStyle }))}>
            {['basic', 'sneaker'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="w-full bg-slate-800 border border-slate-600 rounded p-1"
            value={app2.hat} onChange={e => setApp2(p => ({ ...p, hat: e.target.value as HatStyle }))}>
            {['none', 'cap', 'snapback', 'tophat', 'beanie'].map(s => <option key={s}>{s}</option>)}
          </select>
        </section>

        <section>
          <div className="text-yellow-500 uppercase tracking-wide mb-1 text-[10px]">Zoom ×{scale.toFixed(2)}</div>
          <input type="range" min={0.3} max={4} step={0.05} value={scale}
            onChange={e => setScale(parseFloat(e.target.value))} className="w-full accent-yellow-400" />
        </section>

        <section>
          <div className="text-red-400 uppercase tracking-wide mb-1 text-[10px]">Side-View X-Offset: {pixelOffsetX}px</div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-0.5 bg-slate-700 rounded text-xs" onClick={() => { const v = pixelOffsetX - 1; setPixelOffsetX(v); setSideViewOffsetX(v); }}>◀ -1</button>
            <input type="range" min={-10} max={10} step={1} value={pixelOffsetX}
              onChange={e => { const v = parseInt(e.target.value); setPixelOffsetX(v); setSideViewOffsetX(v); }} className="flex-1 accent-red-400" />
            <button className="px-2 py-0.5 bg-slate-700 rounded text-xs" onClick={() => { const v = pixelOffsetX + 1; setPixelOffsetX(v); setSideViewOffsetX(v); }}>+1 ▶</button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <div className="text-yellow-500 uppercase tracking-wide text-[10px]">Habbo Mode</div>
            <button
              className={`px-2 py-0.5 text-xs rounded border font-mono ${habboMode ? 'bg-green-700 border-green-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
              onClick={() => setHabboMode(p => !p)}
            >{habboMode ? 'ON ✓' : 'OFF'}</button>
          </div>
          {habboMode && (
            <div className="space-y-1">
              <div className="text-slate-400 text-[9px]">Figure-String:</div>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-[9px] text-slate-200 font-mono"
                value={habboFigure}
                onChange={e => setHabboFigure(e.target.value)}
                placeholder="hd-180-1.hr-828-61..."
              />
              <div className="flex flex-col gap-0.5">
                {[
                  ['Standard',  'hd-180-1.hr-828-61.ch-210-66.lg-270-82.sh-290-80'],
                  ['Blondi',    'hd-180-2.hr-800-52.ch-230-64.lg-275-110.sh-305-62'],
                  ['Dunkel',    'hd-180-7.hr-515-33.ch-215-82.lg-695-110.sh-295-108'],
                  ['Business',  'hd-180-3.hr-890-45.ch-804-82.lg-700-110.sh-906-62'],
                ].map(([label, fig]) => (
                  <button key={fig} className={`text-left px-1 py-0.5 text-[9px] rounded ${habboFigure === fig ? 'bg-green-800 text-green-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    onClick={() => setHabboFigure(fig)}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div ref={containerRef} className="flex-1 relative">
        {/* Status banner when item armed */}
        {armedItem && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black text-xs font-semibold px-3 py-1.5 rounded-lg z-20 pointer-events-none shadow-lg">
            Klicke auf ein Tile zum Platzieren &nbsp;·&nbsp; Rechtsklick = Abbrechen
          </div>
        )}

        {/* Inventory panel */}
        <div className="absolute bottom-8 left-2 z-20 bg-black/75 rounded-xl p-2 flex flex-col gap-1.5 border border-white/10 shadow-xl">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 text-center">Inventar</div>
          {([
            ['table',   '🪵', 'Tisch'],
            ['chair_n', '🪑', 'Stuhl NW'],
            ['chair_s', '🪑', 'Stuhl SO'],
            ['chair_e', '🪑', 'Stuhl NO'],
            ['chair_w', '🪑', 'Stuhl SW'],
          ] as [FurnitureType, string, string][]).map(([type, icon, label]) => (
            <button
              key={type}
              onClick={() => {
                const next = armedItem === type ? null : type;
                setArmedItem(next);
                armedItemRef.current = next;
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all
                ${armedItem === type
                  ? 'bg-yellow-400 text-black ring-2 ring-yellow-300 shadow-md'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
          {placedItems.length > 0 && (
            <button
              onClick={() => { setPlacedItems([]); placedItemsRef.current = []; }}
              className="mt-1 px-2 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-900/40 border border-red-800/50"
            >
              Alles löschen ({placedItems.length})
            </button>
          )}
        </div>

        <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-sky-300 pointer-events-none text-[10px] z-10">
          {info || 'Klick auf Kachel → laufen | Rechtsklick ziehen → Kamera | Mausrad → Zoom'}
        </div>
      </div>
    </div>
  );
}
