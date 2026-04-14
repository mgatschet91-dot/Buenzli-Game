/**
 * furniture-builders.ts — Alle Möbel-Builder Funktionen
 *
 * Jede buildXxx(wx, wz, facY?) Funktion baut ein THREE.Group,
 * setzt es in die Szene und gibt es zurück.
 * Abhängigkeiten (scene, addSolid, lvlBase, seats, fridges) werden injiziert.
 */
import { THREE } from './three-shim'
import { box, makeMat } from './materials'
import type { FridgeObj } from './drinks'
import type { SeatEntry } from './character'
import type { FloorData } from './types'
import { FACING_DIRS, FACING_Y } from './avatar-config'

// ─── LvlBase Typ ─────────────────────────────────────────────────────────────

export interface LvlBaseResult { lvl: number; baseY: number }

// ─── Builder Kontext (injiziert von engine.ts) ───────────────────────────────

export interface BuilderContext {
  scene:    THREE.Scene
  addSolid: (x0: number, x1: number, z0: number, z1: number, level: number) => void
  lvlBase:  (wx: number, wz: number) => LvlBaseResult
  seats:    SeatEntry[]
  fridges:  FridgeObj[]
  stairZones: Array<{ uuid: string; x0: number; x1: number; z0: number; z1: number; fromX: number; fromZ: number; toX: number; toZ: number; rise: number; totalD: number }>
}

type BuildFn = (wx: number, wz: number, facY?: number) => THREE.Group | null

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeCtx(ctx: BuilderContext) {
  return {
    scene:    ctx.scene,
    add:      (m: THREE.Object3D) => { ctx.scene.add(m); return m },
    addSolid: ctx.addSolid,
    lvlBase:  ctx.lvlBase,
    seats:    ctx.seats,
    fridges:  ctx.fridges,
  }
}

function finalize(g: THREE.Group, ctx: BuilderContext) {
  g.traverse((m: THREE.Object3D) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = true } })
  ctx.scene.add(g)
  return g
}

// ─── Furniture Builders ───────────────────────────────────────────────────────

export function buildTable(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423)
  g.add(box(1.20, 0.09, 0.80, wood,  0, 0.75, 0))
  for (const [lx, lz] of [[-0.50,-0.32],[0.50,-0.32],[-0.50,0.32],[0.50,0.32]])
    g.add(box(0.09, 0.72, 0.09, woodD, lx, 0.36, lz))
  g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

export function buildChair(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423), cush = makeMat(0xb03020)
  g.add(box(0.58, 0.07, 0.58, wood, 0, 0.42, 0))
  g.add(box(0.52, 0.06, 0.52, cush, 0, 0.47, 0))
  g.add(box(0.58, 0.48, 0.08, wood, 0, 0.70, -0.25))
  for (const [lx,lz] of [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]])
    g.add(box(0.08, 0.44, 0.08, woodD, lx, 0.22, lz))
  g.add(box(0.08, 0.92, 0.08, woodD, -0.22, 0.46, -0.22))
  g.add(box(0.08, 0.92, 0.08, woodD,  0.22, 0.46, -0.22))
  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.seats.push({ x: wx, z: wz, facingY: facY, level: lvl })
  return g
}

export function buildSofa(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const fab = makeMat(0x3a5fa8), fabD = makeMat(0x2a4f98), legM = makeMat(0x5a3510)
  g.add(box(1.60, 0.12, 0.75, fabD, 0, 0.18, 0))
  g.add(box(1.60, 0.16, 0.70, fab,  0, 0.36, 0))
  g.add(box(1.60, 0.70, 0.16, fabD, 0, 0.53, -0.30))
  g.add(box(0.16, 0.60, 0.75, fabD, -0.72, 0.42, 0))
  g.add(box(0.16, 0.60, 0.75, fabD,  0.72, 0.42, 0))
  for (const [lx,lz] of [[-0.65,-0.28],[0.65,-0.28],[-0.65,0.28],[0.65,0.28]])
    g.add(box(0.08, 0.18, 0.08, legM, lx, 0.09, lz))
  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  const hw = 0.82, hd = 0.40
  const cos = Math.cos(facY), sin = Math.sin(facY)
  ctx.addSolid(wx-(hw*Math.abs(cos)+hd*Math.abs(sin)), wx+(hw*Math.abs(cos)+hd*Math.abs(sin)),
               wz-(hw*Math.abs(sin)+hd*Math.abs(cos)), wz+(hw*Math.abs(sin)+hd*Math.abs(cos)), lvl)
  ctx.seats.push({ x: wx, z: wz, facingY: facY, level: lvl })
  return g
}

export function buildLamp(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.12, 1.50, 0.12, makeMat(0x999999), 0, 0.75, 0))
  g.add(box(0.08, 0.08, 0.08, makeMat(0x777777), 0, 0.06, 0))
  const shade = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.44),
    new THREE.MeshLambertMaterial({ color: 0xffe87c, emissive: 0xffe87c, emissiveIntensity: 0.75 }))
  shade.position.set(0, 1.60, 0); g.add(shade)
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.22, wx+0.22, wz-0.22, wz+0.22, lvl)
  return g
}

export function buildPlant(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.38, 0.32, 0.38, makeMat(0x7a5030), 0, 0.16, 0))
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.70, 6), makeMat(0x2d6e2d))).position.set(0, 0.67, 0)
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 6), makeMat(0x3a8a3a))).position.set(0, 0.92, 0)
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.40, 6), makeMat(0x44a044))).position.set(0, 1.12, 0)
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.22, wx+0.22, wz-0.22, wz+0.22, lvl)
  return g
}

export function buildArmchair(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const fab = makeMat(0x8b4513), fabD = makeMat(0x6b3010), legM = makeMat(0x4a2a08)
  g.add(box(0.80, 0.12, 0.70, fabD, 0, 0.22, 0))
  g.add(box(0.80, 0.14, 0.65, fab,  0, 0.38, 0))
  g.add(box(0.80, 0.62, 0.13, fabD, 0, 0.58, -0.27))
  g.add(box(0.13, 0.52, 0.70, fabD, -0.33, 0.45, 0))
  g.add(box(0.13, 0.52, 0.70, fabD,  0.33, 0.45, 0))
  for (const [lx,lz] of [[-0.30,-0.26],[0.30,-0.26],[-0.30,0.26],[0.30,0.26]])
    g.add(box(0.08, 0.20, 0.08, legM, lx, 0.10, lz))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.seats.push({ x: wx, z: wz, facingY: facY, level: lvl })
  ctx.addSolid(wx-0.42, wx+0.42, wz-0.37, wz+0.37, lvl)
  return g
}

export function buildBookshelf(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x8b5e3c), woodD = makeMat(0x5c3a20)
  g.add(box(0.85, 1.75, 0.28, woodD, 0, 0.875, 0))
  g.add(box(0.07, 1.75, 0.30, woodD, -0.39, 0.875, 0))
  g.add(box(0.07, 1.75, 0.30, woodD,  0.39, 0.875, 0))
  for (const y of [0.06, 0.58, 1.10, 1.63]) g.add(box(0.85, 0.07, 0.30, wood, 0, y, 0))
  const bc = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xe67e22]
  for (let sh = 0; sh < 3; sh++)
    for (let b = 0; b < 3; b++)
      g.add(box(0.19, 0.28, 0.22, makeMat(bc[(sh*3+b)%6]), -0.25+b*0.25, 0.28+sh*0.52, 0.01))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.44, wx+0.44, wz-0.16, wz+0.16, lvl)
  return g
}

export function buildTV(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.10, 0.96, 0.10, makeMat(0x222233), 0, 0.48, 0))
  g.add(box(0.32, 0.09, 0.32, makeMat(0x222233), 0, 0.05, 0))
  g.add(box(0.09, 0.68, 1.10, makeMat(0x111122), 0, 1.05, 0))
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.96),
    new THREE.MeshLambertMaterial({ color: 0x1a3a6e, emissive: 0x0a1535, emissiveIntensity: 0.6 }))
  scr.position.set(0.02, 1.05, 0); g.add(scr)
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.20, wx+0.20, wz-0.60, wz+0.60, lvl)
  return g
}

export function buildDresser(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423), hndl = makeMat(0xd4a020)
  g.add(box(1.10, 0.80, 0.52, wood, 0, 0.40, 0))
  g.add(box(1.14, 0.06, 0.54, woodD, 0, 0.83, 0))
  g.add(box(1.10, 0.04, 0.04, woodD, 0, 0.20, 0.26))
  g.add(box(1.10, 0.04, 0.04, woodD, 0, 0.58, 0.26))
  for (const [hy,hx] of [[0.10,-0.25],[0.10,0.25],[0.48,-0.25],[0.48,0.25]])
    g.add(box(0.12, 0.06, 0.08, hndl, hx, hy, 0.27))
  for (const [lx,lz] of [[-0.46,-0.20],[0.46,-0.20],[-0.46,0.20],[0.46,0.20]])
    g.add(box(0.08, 0.08, 0.08, woodD, lx, 0.04, lz))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.57, wx+0.57, wz-0.28, wz+0.28, lvl)
  return g
}

export function buildBed(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const frm = makeMat(0x7a5030), matt = makeMat(0xf0ece0), pil = makeMat(0xffffff), bln = makeMat(0x3a7bd5)
  g.add(box(1.30, 0.24, 2.20, frm, 0, 0.12, 0))
  g.add(box(1.20, 0.16, 1.60, matt, 0, 0.30, 0.25))
  g.add(box(1.20, 0.16, 0.70, bln,  0, 0.30, -0.48))
  g.add(box(0.40, 0.14, 0.28, pil, -0.30, 0.36, 0.82))
  g.add(box(0.40, 0.14, 0.28, pil,  0.30, 0.36, 0.82))
  g.add(box(1.30, 0.58, 0.16, frm, 0, 0.45, 1.10))
  g.add(box(1.30, 0.28, 0.12, frm, 0, 0.26, -1.12))
  for (const [lx,lz] of [[-0.56,-0.96],[0.56,-0.96],[-0.56,0.96],[0.56,0.96]])
    g.add(box(0.12, 0.24, 0.12, frm, lx, 0.12, lz))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.68, wx+0.68, wz-1.14, wz+1.14, lvl)
  return g
}

export function buildDiscoball(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.06, 1.40, 0.06, makeMat(0x555566), 0, 0.70, 0))
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xcccccc, emissive: 0x888899, emissiveIntensity: 0.3 }))
  ball.position.set(0, 1.55, 0); g.add(ball)
  const cols = [0xff4444,0x44ff44,0x4444ff,0xffff44,0xff44ff,0x44ffff]
  for (let i = 0; i < 16; i++) {
    const a = (i/16)*Math.PI*2
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,0.07),
      new THREE.MeshLambertMaterial({ color: cols[i%6], emissive: cols[i%6], emissiveIntensity: 0.7 }))
    tile.position.set(Math.cos(a)*0.27, 1.55+Math.sin(i*0.4)*0.18, Math.sin(a)*0.27)
    g.add(tile)
  }
  g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

export function buildDJDesk(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const dark = makeMat(0x1a1a2e), med = makeMat(0x2a2a3e), acc = makeMat(0xff4500)
  g.add(box(1.50, 0.80, 0.80, med, 0, 0.40, 0))
  g.add(box(1.50, 0.08, 0.80, dark, 0, 0.84, 0))
  g.add(box(1.46, 0.06, 0.76, makeMat(0x333344), 0, 0.80, 0))
  g.add(box(0.40, 0.04, 0.60, makeMat(0x111118), 0, 0.85, 0))
  for (let i = -1; i <= 1; i++) g.add(box(0.06, 0.06, 0.06, acc, i*0.30, 0.90, 0))
  for (const [lx,lz] of [[-0.68,-0.32],[0.68,-0.32],[-0.68,0.32],[0.68,0.32]])
    g.add(box(0.08, 0.80, 0.08, dark, lx, 0.40, lz))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.77, wx+0.77, wz-0.42, wz+0.42, lvl)
  return g
}

export function buildBalloon(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const cols = [0xff4444, 0x44aaff, 0xff9922, 0xaa44ff, 0x44ff88]
  for (let i = 0; i < 3; i++) {
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8),
      new THREE.MeshLambertMaterial({ color: cols[i%cols.length] }))
    b2.position.set(-0.18+i*0.18, 1.60+Math.sin(i*1.2)*0.10, Math.cos(i*1.2)*0.08); g.add(b2)
    g.add(box(0.015, 1.60, 0.015, makeMat(0x888888), -0.18+i*0.18, 0.80, 0))
  }
  g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

export function buildPartyFlag(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.06, 1.80, 0.06, makeMat(0x8b5e3c), -0.55, 0.90, 0))
  g.add(box(0.06, 1.80, 0.06, makeMat(0x8b5e3c),  0.55, 0.90, 0))
  g.add(box(1.12, 0.015, 0.015, makeMat(0x555555), 0, 1.80, 0))
  const fc = [0xff4444,0xffff44,0x44ff44,0x44aaff,0xff44ff]
  for (let i = 0; i < 5; i++) g.add(box(0.14, 0.18, 0.04, makeMat(fc[i%5]), -0.44+i*0.22, 1.68, 0))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

export function buildNeon(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(1.20, 0.55, 0.08, makeMat(0x111122), 0, 0.80, 0))
  const nc = [0xff00ff, 0x00ffff, 0xff4400]
  for (let i = 0; i < 3; i++) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.07, 0.06),
      new THREE.MeshLambertMaterial({ color: nc[i], emissive: nc[i], emissiveIntensity: 1.0 }))
    tube.position.set(0, 0.62+i*0.16, 0.05); g.add(tube)
  }
  g.add(box(0.06, 0.54, 0.06, makeMat(0x444455), 0, 0.27, 0))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

export function buildFrame(wx: number, wz: number, facY: number, frameColor: number, ctx: BuilderContext): THREE.Group {
  const EYE_Y = 0.06 + 1.20
  const g = new THREE.Group()
  g.add(box(0.80, 0.72, 0.06, makeMat(frameColor), 0, 0, 0))
  g.add(box(0.64, 0.56, 0.05, makeMat(0xf5f0e8),  0, 0, 0.02))
  const artCol = frameColor === 0x2255aa ? 0xffaa22 : frameColor === 0xcc2222 ? 0x2244cc : frameColor === 0xd4af37 ? 0x226644 : 0xcc4488
  g.add(box(0.28, 0.28, 0.04, makeMat(artCol), -0.10, 0.06, 0.04))
  g.add(box(0.20, 0.14, 0.04, makeMat(0x88bbff), 0.12,-0.12, 0.04))
  g.add(box(0.18, 0.10, 0.04, makeMat(artCol),   0.10, 0.18, 0.04))
  g.add(box(0.04, 0.06, 0.05, makeMat(0xaaaaaa), 0, 0.39, -0.02))
  const WALL_PROJ = 10.0 - 0.11 - 0.03
  g.rotation.y = facY
  const dirKey = Object.entries(FACING_Y).find(([,v]) => Math.abs(v - facY) < 0.01)?.[0] ?? 'S'
  let fx: number, fz: number
  if (dirKey === 'S') { fx = Math.max(-8.5, Math.min(8.5, wx)); fz = -WALL_PROJ }
  else if (dirKey === 'W') { fx = -WALL_PROJ; fz = Math.max(-8.5, Math.min(8.5, wz)) }
  else { fx = wx; fz = wz }
  g.position.set(fx, EYE_Y, fz)
  g.traverse((m: THREE.Object3D) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = true } })
  ctx.scene.add(g)
  return g
}

export function buildBarstool(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const metal = makeMat(0x888898), cush = makeMat(0x8b1a1a)
  g.add(box(0.44, 0.08, 0.44, metal, 0, 0.78, 0))
  g.add(box(0.40, 0.08, 0.40, cush, 0, 0.84, 0))
  g.add(box(0.08, 0.76, 0.08, metal, 0, 0.38, 0))
  g.add(box(0.60, 0.06, 0.10, metal, 0, 0.03, 0))
  g.add(box(0.10, 0.06, 0.60, metal, 0, 0.03, 0))
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.seats.push({ x: wx, z: wz, facingY: 0, level: lvl })
  return g
}

export function buildOttoman(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.70, 0.30, 0.70, makeMat(0x8b6030), 0, 0.15, 0))
  g.add(box(0.72, 0.08, 0.72, makeMat(0x6b4818), 0, 0.04, 0))
  for (const [lx,lz] of [[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]])
    g.add(box(0.07, 0.08, 0.07, makeMat(0x4a2e0a), lx, 0.04, lz))
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.seats.push({ x: wx, z: wz, facingY: 0, level: lvl })
  return g
}

export function buildBench(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423)
  g.add(box(1.50, 0.08, 0.42, wood, 0, 0.42, 0))
  g.add(box(1.50, 0.06, 0.38, makeMat(0xc4aa80), 0, 0.47, 0))
  for (const lx of [-0.60, 0.60]) g.add(box(0.36, 0.42, 0.10, woodD, lx, 0.21, -0.16))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.seats.push({ x: wx, z: wz, facingY: facY, level: lvl })
  return g
}

export function buildStool(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423)
  g.add(box(0.46, 0.07, 0.46, wood, 0, 0.44, 0))
  g.add(box(0.44, 0.06, 0.44, makeMat(0xd2a070), 0, 0.49, 0))
  for (const [lx,lz] of [[-0.16,-0.16],[0.16,-0.16],[-0.16,0.16],[0.16,0.16]])
    g.add(box(0.07, 0.44, 0.07, woodD, lx, 0.22, lz))
  g.add(box(0.36, 0.05, 0.07, woodD, 0, 0.22, 0))
  g.add(box(0.07, 0.05, 0.36, woodD, 0, 0.22, 0))
  g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.seats.push({ x: wx, z: wz, facingY: 0, level: lvl })
  return g
}

export function buildBarCounter(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x6b3a1e), woodD = makeMat(0x4a2a10), metal = makeMat(0x888888)
  g.add(box(1.80, 1.00, 0.65, wood, 0, 0.50, 0))
  g.add(box(1.86, 0.08, 0.70, woodD, 0, 1.04, 0))
  g.add(box(1.84, 0.06, 0.68, makeMat(0x9b6b3a), 0, 1.10, 0))
  g.add(box(1.80, 0.05, 0.06, metal, 0, 0.18, 0.28))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.93, wx+0.93, wz-0.35, wz+0.35, lvl)
  return g
}

export function buildDrinksShelf(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x6b3a1e), woodD = makeMat(0x4a2a10)
  g.add(box(1.00, 1.60, 0.28, woodD, 0, 0.80, 0))
  for (const x2 of [-0.465, 0.465]) g.add(box(0.07, 1.60, 0.28, woodD, x2, 0.80, 0))
  for (const y of [0.56, 1.04, 1.52]) g.add(box(1.00, 0.07, 0.28, wood, 0, y, 0))
  const bc = [0x006600, 0x8b0000, 0x006699, 0xcc6600, 0x333300]
  for (let sh = 0; sh < 3; sh++)
    for (let b = 0; b < 4; b++)
      g.add(box(0.09, 0.28, 0.09, makeMat(bc[(sh*4+b)%5]), -0.32+b*0.22, 0.70+sh*0.48, 0.01))
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.52, wx+0.52, wz-0.16, wz+0.16, lvl)
  return g
}

export function buildCocktailTable(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const metal = makeMat(0x888898)
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 })
  g.add(box(0.07, 0.90, 0.07, metal, 0, 0.45, 0))
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12), glassMat)
  top.position.set(0, 0.93, 0); g.add(top)
  g.add(box(0.65, 0.05, 0.10, metal, 0, 0.02, 0))
  g.add(box(0.10, 0.05, 0.65, metal, 0, 0.02, 0))
  g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

export function buildFridge(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const bodyM = makeMat(0xddddee), darkM = makeMat(0x888899), hndl = makeMat(0xaaaaaa)
  g.add(box(0.82, 1.72, 0.58, bodyM, 0, 0.86, -0.02))
  g.add(box(0.84, 0.08, 0.64, darkM, 0, 1.74, 0))
  g.add(box(0.04, 0.72, 0.60, darkM, 0.41, 0.86, -0.01))
  g.add(box(0.84, 0.04, 0.58, darkM, 0, 0.44, -0.02))
  const intMat = new THREE.MeshLambertMaterial({ color: 0xbbddff, emissive: 0x88aaff, emissiveIntensity: 0.6 })
  const intM = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.50, 0.02), intMat)
  intM.position.set(0, 0.86, -0.28); g.add(intM)
  const doorPivot = new THREE.Group(); doorPivot.position.set(-0.41, 0, 0.29); doorPivot.name = 'fridgeDoor'
  const doorM = new THREE.MeshLambertMaterial({ color: 0xe0e0f0 })
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.72, 0.06), doorM)
  doorMesh.position.set(0.41, 0.86, 0.03); doorMesh.castShadow = true; doorPivot.add(doorMesh)
  doorPivot.add(box(0.06, 0.48, 0.06, hndl, 0.79, 0.80, 0.06))
  doorPivot.add(box(0.06, 0.28, 0.06, hndl, 0.79, 0.28, 0.06))
  g.add(doorPivot)
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  ctx.addSolid(wx-0.43, wx+0.43, wz-0.33, wz+0.33, lvl)
  const fwd = new THREE.Vector3(0, 0, 1.1).applyEuler(new THREE.Euler(0, facY, 0))
  const fObj: FridgeObj = {
    group: g, doorPivot, doorAngle: 0, doorTarget: 0, isOpen: false,
    x: wx, z: wz, facingY: facY, lvl, entranceX: wx + fwd.x, entranceZ: wz + fwd.z,
  }
  ctx.fridges.push(fObj)
  return g
}

export function buildBeertap(wx: number, wz: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const metal = makeMat(0x888898), dark = makeMat(0x333344), gold = makeMat(0xd4a020)
  g.add(box(0.38, 0.18, 0.38, dark, 0, 0.09, 0))
  g.add(box(0.10, 0.50, 0.10, metal, 0, 0.43, 0))
  g.add(box(0.08, 0.06, 0.38, metal, 0, 0.58, 0))
  g.add(box(0.07, 0.20, 0.07, gold, 0, 0.70, 0.16))
  g.add(box(0.04, 0.04, 0.06, metal, 0, 0.68, 0.20))
  g.position.set(wx, baseY, wz)
  return finalize(g, ctx)
}

// ─── Stair Builders ───────────────────────────────────────────────────────────

const STAIR_STEPS = 4, STAIR_STEP_H = 0.5, STAIR_STEP_D = 1.0
const STAIR_RISE = STAIR_STEPS * STAIR_STEP_H
const STAIR_TOTAL_D = STAIR_STEPS * STAIR_STEP_D
const STAIR_W = 0.92

export function buildStairWood(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const woodM = makeMat(0xb08030), woodD = makeMat(0x7a5018), railM = makeMat(0x5a3010)
  const strLen = Math.sqrt(STAIR_TOTAL_D**2 + STAIR_RISE**2)
  const strAng = Math.atan2(STAIR_TOTAL_D, STAIR_RISE)
  for (const sx of [-STAIR_W/2, STAIR_W/2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.10, strLen, 0.16), woodD)
    str.position.set(sx, STAIR_RISE/2, STAIR_TOTAL_D/2); str.rotation.x = strAng; g.add(str)
  }
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i+1)*STAIR_STEP_H, tz = (i+0.5)*STAIR_STEP_D
    for (const ox of [-0.22, 0, 0.22]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W/3-0.03, 0.07, STAIR_STEP_D-0.06), woodM)
      plank.position.set(ox, ty-0.035, tz); g.add(plank)
    }
  }
  for (let i = 0; i <= STAIR_STEPS; i++) g.add(box(0.08, 0.72, 0.08, railM, STAIR_W/2, i*STAIR_STEP_H+0.36, i*STAIR_STEP_D))
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), railM)
  rb.position.set(STAIR_W/2, STAIR_RISE/2+0.72, STAIR_TOTAL_D/2); rb.rotation.x = strAng; g.add(rb)
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  _registerStairZone(g.uuid, wx, wz, FACING_DIRS[Math.round(facY / (Math.PI/2)) % 4] ?? 'N', STAIR_RISE, STAIR_TOTAL_D, ctx)
  return g
}

export function buildStairStone(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const stoneM = makeMat(0x9a9288), stoneD = makeMat(0x6e6660), stoneL = makeMat(0xbab4ae)
  for (let i = 0; i < STAIR_STEPS; i++) {
    const bh = (i+1)*STAIR_STEP_H, bz = (i+0.5)*STAIR_STEP_D
    g.add(box(STAIR_W, bh, STAIR_STEP_D-0.04, stoneM, 0, bh/2, bz))
    g.add(box(STAIR_W, 0.04, STAIR_STEP_D-0.04, stoneL, 0, bh+0.01, bz))
    g.add(box(STAIR_W, 0.06, 0.06, stoneD, 0, bh-0.03, bz-STAIR_STEP_D/2))
  }
  const hw = STAIR_W/2
  for (const sx of [-hw-0.07, hw+0.07]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.10, STAIR_RISE, STAIR_TOTAL_D), stoneD)
    cheek.position.set(sx, STAIR_RISE/2, STAIR_TOTAL_D/2); g.add(cheek)
  }
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  _registerStairZone(g.uuid, wx, wz, FACING_DIRS[Math.round(facY / (Math.PI/2)) % 4] ?? 'N', STAIR_RISE, STAIR_TOTAL_D, ctx)
  return g
}

export function buildStairMetal(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const metalM = makeMat(0x3a3a4a), metalL = makeMat(0x5a5a6e), safeY = makeMat(0xddcc00)
  const strLen = Math.sqrt(STAIR_TOTAL_D**2 + STAIR_RISE**2), strAng = Math.atan2(STAIR_TOTAL_D, STAIR_RISE)
  for (const sx of [-STAIR_W/2, STAIR_W/2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.09, strLen, 0.09), metalM)
    str.position.set(sx, STAIR_RISE/2, STAIR_TOTAL_D/2); str.rotation.x = strAng; g.add(str)
  }
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i+1)*STAIR_STEP_H, tz = (i+0.5)*STAIR_STEP_D
    g.add(box(STAIR_W, 0.05, STAIR_STEP_D-0.06, metalL, 0, ty-0.025, tz))
    g.add(box(STAIR_W, 0.05, 0.06, safeY, 0, ty, tz-STAIR_STEP_D/2+0.03))
    g.add(box(STAIR_W, 0.04, 0.06, metalM, 0, ty-0.08, tz+STAIR_STEP_D/2-0.06))
  }
  for (const sx of [-STAIR_W/2, STAIR_W/2]) {
    for (let i = 0; i <= STAIR_STEPS; i++) g.add(box(0.06, 0.80, 0.06, metalM, sx, i*STAIR_STEP_H+0.40, i*STAIR_STEP_D))
    const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), metalL)
    rb.position.set(sx, STAIR_RISE/2+0.82, STAIR_TOTAL_D/2); rb.rotation.x = strAng; g.add(rb)
  }
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  _registerStairZone(g.uuid, wx, wz, FACING_DIRS[Math.round(facY / (Math.PI/2)) % 4] ?? 'N', STAIR_RISE, STAIR_TOTAL_D, ctx)
  return g
}

export function buildStairOpen(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const spineM = makeMat(0x2a2a3a), treadM = makeMat(0xd8c89a), treadE = makeMat(0x4a3a1a)
  const glassM = new THREE.MeshLambertMaterial({ color: 0xaaccee, transparent: true, opacity: 0.28 })
  const strLen = Math.sqrt(STAIR_TOTAL_D**2 + STAIR_RISE**2), strAng = Math.atan2(STAIR_TOTAL_D, STAIR_RISE)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, strLen, 0.14), spineM)
  spine.position.set(0, STAIR_RISE/2, STAIR_TOTAL_D/2); spine.rotation.x = strAng; g.add(spine)
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i+1)*STAIR_STEP_H, tz = (i+0.5)*STAIR_STEP_D
    g.add(box(STAIR_W, 0.06, STAIR_STEP_D-0.08, treadM, 0, ty-0.03, tz))
    g.add(box(STAIR_W+0.04, 0.04, 0.05, treadE, 0, ty, tz-STAIR_STEP_D/2+0.025))
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, STAIR_STEP_D-0.05), glassM)
    panel.position.set(-STAIR_W/2, (i+0.5)*STAIR_STEP_H+STAIR_STEP_H/2+0.36, tz); g.add(panel)
  }
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), spineM)
  topRail.position.set(-STAIR_W/2, STAIR_RISE/2+0.76, STAIR_TOTAL_D/2); topRail.rotation.x = strAng; g.add(topRail)
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  _registerStairZone(g.uuid, wx, wz, FACING_DIRS[Math.round(facY / (Math.PI/2)) % 4] ?? 'N', STAIR_RISE, STAIR_TOTAL_D, ctx)
  return g
}

export function buildStairDown(wx: number, wz: number, facY: number, ctx: BuilderContext): THREE.Group {
  const { lvl, baseY } = ctx.lvlBase(wx, wz)
  const g = new THREE.Group()
  const woodM = makeMat(0x6a4010), woodD = makeMat(0x3a2008), frameM = makeMat(0x181010)
  const strLen = Math.sqrt(STAIR_TOTAL_D**2 + STAIR_RISE**2), strAng = -Math.atan2(STAIR_TOTAL_D, STAIR_RISE)
  g.add(box(STAIR_W+0.24, 0.14, 0.14, frameM, 0, 0, 0))
  g.add(box(0.14, 0.14, STAIR_TOTAL_D, frameM, -(STAIR_W/2+0.06), 0, STAIR_TOTAL_D/2))
  g.add(box(0.14, 0.14, STAIR_TOTAL_D, frameM, (STAIR_W/2+0.06), 0, STAIR_TOTAL_D/2))
  for (const sx of [-STAIR_W/2, STAIR_W/2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.10, strLen, 0.16), woodD)
    str.position.set(sx, -STAIR_RISE/2, STAIR_TOTAL_D/2); str.rotation.x = strAng; g.add(str)
  }
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = -(i+1)*STAIR_STEP_H, tz = (i+0.5)*STAIR_STEP_D
    for (const ox of [-0.22, 0, 0.22]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W/3-0.03, 0.07, STAIR_STEP_D-0.06), woodM)
      plank.position.set(ox, ty-0.035, tz); g.add(plank)
    }
  }
  g.rotation.y = facY; g.position.set(wx, baseY, wz)
  finalize(g, ctx)
  _registerStairZone(g.uuid, wx, wz, FACING_DIRS[Math.round(facY / (Math.PI/2)) % 4] ?? 'N', -STAIR_RISE, STAIR_TOTAL_D, ctx)
  return g
}

function _registerStairZone(uuid: string, wx: number, wz: number, dir: string, rise: number, totalD: number, ctx: BuilderContext) {
  const hw = 0.62
  let x0: number, x1: number, z0: number, z1: number, toX: number, toZ: number
  if      (dir === 'S') { x0=wx-hw; x1=wx+hw; z0=wz;       z1=wz+totalD; toX=wx;       toZ=wz+totalD }
  else if (dir === 'N') { x0=wx-hw; x1=wx+hw; z0=wz-totalD; z1=wz;       toX=wx;       toZ=wz-totalD }
  else if (dir === 'E') { x0=wx;    x1=wx+totalD; z0=wz-hw; z1=wz+hw;    toX=wx+totalD; toZ=wz }
  else                  { x0=wx-totalD; x1=wx; z0=wz-hw; z1=wz+hw;       toX=wx-totalD; toZ=wz }
  ctx.stairZones.push({ uuid, x0, x1, z0, z1, fromX: wx, fromZ: wz, toX, toZ, rise, totalD })
}

// ─── Ghost Preview Builder ────────────────────────────────────────────────────

export function buildGhostMesh(itemId: string, facingDir: string): THREE.Group {
  const g = new THREE.Group()
  const ghostMat = (color = 0x3a7bd5) =>
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.45 })
  const facY = FACING_Y[facingDir] ?? 0

  if (itemId === 'chair') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.58), ghostMat()))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.08), ghostMat()))
    g.rotation.y = facY
  } else if (itemId === 'table') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.09, 0.80), ghostMat()))
  } else if (itemId === 'sofa') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.60, 0.75), ghostMat())); g.rotation.y = facY
  } else if (itemId === 'lamp') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.50, 0.14), ghostMat(0xffe87c)))
  } else if (itemId === 'plant') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.20, 0.44), ghostMat(0x44aa44)))
  } else if (itemId === 'roller') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.92), ghostMat()))
    const arrowGroup = new THREE.Group(); arrowGroup.position.y = 0.22
    const arr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 3), ghostMat(0xddcc00))
    arr.rotation.x = Math.PI / 2; arrowGroup.add(arr)
    arrowGroup.rotation.y = FACING_Y[facingDir] ?? 0; g.add(arrowGroup)
  } else if (itemId === 'armchair') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.50, 0.70), ghostMat(0x8b4513))); g.rotation.y = facY
  } else if (itemId === 'bookshelf') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.75, 0.28), ghostMat(0xaa7744))); g.rotation.y = facY
  } else if (itemId === 'tv') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.10), ghostMat(0x222244))); g.rotation.y = facY
  } else if (itemId === 'dresser') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.84, 0.52), ghostMat(0xaa7744))); g.rotation.y = facY
  } else if (itemId === 'bed') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.50, 2.20), ghostMat(0x4466aa))); g.rotation.y = facY
  } else if (itemId === 'discoball') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.30, 8, 6), ghostMat(0xcccccc))); g.position.y = 1.25
  } else if (itemId === 'djdesk') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.88, 0.80), ghostMat(0x222244))); g.rotation.y = facY
  } else if (itemId === 'balloon') {
    for (let i = 0; i < 3; i++) {
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.20,6,5), ghostMat(0xff6644))
      b2.position.set(-0.18+i*0.18, 1.40, 0); g.add(b2)
    }
  } else if (itemId === 'partyflag') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.20, 0.06), ghostMat(0xffcc44))); g.rotation.y = facY
  } else if (itemId === 'neon') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.55, 0.08), ghostMat(0xff44ff))); g.rotation.y = facY
  } else if (itemId.startsWith('frame_')) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.72, 0.06), ghostMat(0xaaaaff))); g.rotation.y = facY
    const arw = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.20), ghostMat(0xffffff))
    arw.position.set(0, 0.44, -0.14); g.add(arw)
  } else if (itemId === 'barstool') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.92, 0.44), ghostMat()))
  } else if (itemId === 'ottoman') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.32, 0.70), ghostMat(0xaa6622)))
  } else if (itemId === 'bench') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.50, 0.42), ghostMat(0xaa7744))); g.rotation.y = facY
  } else if (itemId === 'stool') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.50, 0.46), ghostMat(0xaa7744)))
  } else if (itemId === 'barcounter') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.80, 1.12, 0.65), ghostMat(0x884422))); g.rotation.y = facY
  } else if (itemId === 'drinksshelf') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.00, 1.60, 0.28), ghostMat(0x884422))); g.rotation.y = facY
  } else if (itemId === 'cocktailtable') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,0.96,10), ghostMat(0x4488cc)))
  } else if (itemId === 'fridge') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.75, 0.62), ghostMat(0xccccee))); g.rotation.y = facY
  } else if (itemId === 'beertap') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.80, 0.38), ghostMat(0x888898)))
  } else if (itemId.startsWith('stair_')) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(STAIR_W, STAIR_RISE, STAIR_TOTAL_D), ghostMat(0xc8b48a))); g.rotation.y = facY
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.80, 0.80), ghostMat()))
  }

  if (!itemId.startsWith('frame_')) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.56, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    )
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.05; g.add(ring)
  }
  return g
}

// ─── Universal Spawn Dispatcher ────────────────────────────────────────────────

export function spawnBuiltin(
  type: string, wx: number, wz: number, facY: number,
  ctx: BuilderContext
): THREE.Group | null {
  switch (type) {
    case 'chair':        return buildChair(wx, wz, facY, ctx)
    case 'table':        return buildTable(wx, wz, ctx)
    case 'sofa':         return buildSofa(wx, wz, facY, ctx)
    case 'lamp':         return buildLamp(wx, wz, ctx)
    case 'plant':        return buildPlant(wx, wz, ctx)
    case 'armchair':     return buildArmchair(wx, wz, facY, ctx)
    case 'bookshelf':    return buildBookshelf(wx, wz, facY, ctx)
    case 'tv':           return buildTV(wx, wz, facY, ctx)
    case 'dresser':      return buildDresser(wx, wz, facY, ctx)
    case 'bed':          return buildBed(wx, wz, facY, ctx)
    case 'discoball':    return buildDiscoball(wx, wz, ctx)
    case 'djdesk':       return buildDJDesk(wx, wz, facY, ctx)
    case 'balloon':      return buildBalloon(wx, wz, ctx)
    case 'partyflag':    return buildPartyFlag(wx, wz, facY, ctx)
    case 'neon':         return buildNeon(wx, wz, facY, ctx)
    case 'frame_blue':   return buildFrame(wx, wz, facY, 0x2255aa, ctx)
    case 'frame_red':    return buildFrame(wx, wz, facY, 0xcc2222, ctx)
    case 'frame_gold':   return buildFrame(wx, wz, facY, 0xd4af37, ctx)
    case 'frame_dark':   return buildFrame(wx, wz, facY, 0x1a1a2e, ctx)
    case 'barstool':     return buildBarstool(wx, wz, ctx)
    case 'ottoman':      return buildOttoman(wx, wz, ctx)
    case 'bench':        return buildBench(wx, wz, facY, ctx)
    case 'stool':        return buildStool(wx, wz, ctx)
    case 'barcounter':   return buildBarCounter(wx, wz, facY, ctx)
    case 'drinksshelf':  return buildDrinksShelf(wx, wz, facY, ctx)
    case 'cocktailtable':return buildCocktailTable(wx, wz, ctx)
    case 'fridge':       return buildFridge(wx, wz, facY, ctx)
    case 'beertap':      return buildBeertap(wx, wz, ctx)
    case 'stair_wood':   return buildStairWood(wx, wz, facY, ctx)
    case 'stair_stone':  return buildStairStone(wx, wz, facY, ctx)
    case 'stair_metal':  return buildStairMetal(wx, wz, facY, ctx)
    case 'stair_open':   return buildStairOpen(wx, wz, facY, ctx)
    case 'stair_down':   return buildStairDown(wx, wz, facY, ctx)
    default: return null
  }
}
