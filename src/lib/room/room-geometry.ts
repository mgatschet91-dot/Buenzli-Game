/**
 * room-geometry.ts — Raumgeometrie aufbauen (Böden, Wände, Treppen, Roller)
 *
 * Unterstützt sowohl das einfache Template-Format als auch das vollständige
 * Editor-Format (floors[] + stairs[] + rollers[]).
 */
import { THREE } from './three-shim'
import { box, makeMat } from './materials'
import { TILE } from './types'
import type { RoomGeometry, RoomFloor, RoomStair, FloorData, StairDataNew } from './types'

// ─── Interne Typen ────────────────────────────────────────────────────────────

export interface RoomGeometryState {
  floorsData:  FloorData[]
  stairsData:  StairDataNew[]
  grid:        number
  floor2Y:     number
  // Legacy upper-floor bounds
  f2X0: number; f2X1: number; f2Z0: number; f2Z1: number
  // Legacy staircase bounds
  stX0: number; stX1: number; stZ0: number; stZ1: number
}

export interface RoomGeometrySystem {
  build:       (geo: RoomGeometry) => void
  rebuild:     (geo: RoomGeometry) => void
  destroy:     () => void
  getState:    () => RoomGeometryState
  /** Returns floor Y at given world (x,z) for a character at the given level */
  getFloorY:   (wx: number, wz: number, level?: number) => number
  /** addSolid callback injected by engine */
  setAddSolid: (fn: AddSolidFn) => void
  /** buildGameRoller callback injected by rollers module */
  setBuildRoller: (fn: BuildRollerFn) => void
  /** setCharPos callback so spawn point applies */
  setCharPos: (fn: (x: number, z: number, level: number) => void) => void
}

type AddSolidFn = (x0: number, x1: number, z0: number, z1: number, level?: number, ref?: unknown) => void
type BuildRollerFn = (cx: number, cz: number, dir: string, floorY: number) => void

const _STAIR_DV: Record<string, [number, number]> = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }
const _STAIR_STEP_D = 0.75
const _STAIR_W_NEW  = 3.0
const _ED_FAC_Y: Record<string, number> = { N: Math.PI, S: 0, E: -Math.PI/2, W: Math.PI/2 }

export function createRoomGeometry(scene: THREE.Scene): RoomGeometrySystem {
  let _addSolid:    AddSolidFn    = () => {}
  let _buildRoller: BuildRollerFn = () => {}
  let _setCharPos:  (x: number, z: number, level: number) => void = () => {}

  const objs: THREE.Object3D[] = []

  const state: RoomGeometryState = {
    floorsData: [], stairsData: [],
    grid: 20, floor2Y: 7.0,
    f2X0: -7, f2X1: 8, f2Z0: -9, f2Z1: -3,
    stX0: 5,  stX1: 8, stZ0: -3, stZ1: 7,
  }

  // ─── Floor-Y Berechnung ────────────────────────────────────────────────────

  function getFloorY(wx: number, wz: number, level = 0): number {
    // Neues Format: Editor-Treppen (ROOM_STAIRS_DATA_NEW)
    for (const st of state.stairsData) {
      const [dx, dz] = _STAIR_DV[st.dir] || [0, 1]
      const hw = (st.width || 3) / 2
      let inZone = false, t = 0
      if (dx === 0) {
        const zLo = dz > 0 ? st.anchor_z : st.anchor_z - st.steps
        const zHi = dz > 0 ? st.anchor_z + st.steps : st.anchor_z
        if (wx >= st.anchor_x - hw && wx <= st.anchor_x + hw && wz >= zLo && wz <= zHi) {
          inZone = true
          t = dz > 0 ? (wz - st.anchor_z) / st.steps : (st.anchor_z - wz) / st.steps
        }
      } else {
        const xLo = dx > 0 ? st.anchor_x : st.anchor_x - st.steps
        const xHi = dx > 0 ? st.anchor_x + st.steps : st.anchor_x
        if (wz >= st.anchor_z - hw && wz <= st.anchor_z + hw && wx >= xLo && wx <= xHi) {
          inZone = true
          t = dx > 0 ? (wx - st.anchor_x) / st.steps : (st.anchor_x - wx) / st.steps
        }
      }
      if (inZone) return (st.base_y || 0) + Math.max(0, Math.min(1, t)) * st.height
    }
    // Neues Format: Etagen-Oberfläche
    if (state.floorsData.length > 0 && level >= 1) {
      const fl = state.floorsData.find(f => f.floor_index === level)
      if (fl) {
        const TOL = 0.5
        if (wx >= fl.x0 - TOL && wx <= fl.x1 + TOL && wz >= fl.z0 - TOL && wz <= fl.z1 + TOL) {
          return fl.y
        }
        return 0
      }
      return 0
    }
    // Altes Format: Legacy staircase ramp
    if (state.stairsData.length === 0) {
      const { stX0, stX1, stZ0, stZ1, floor2Y } = state
      if (wx >= stX0 && wx <= stX1 && wz >= stZ0 && wz <= stZ1)
        return Math.max(0, Math.min(floor2Y, (stZ1 - wz) / (stZ1 - stZ0) * floor2Y))
    }
    // Altes Format: Second floor surface
    const { f2X0, f2X1, f2Z0, f2Z1, floor2Y } = state
    if (level >= 1 && wx >= f2X0 && wx <= f2X1 && wz >= f2Z0 && wz <= f2Z1) return floor2Y
    return 0
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  function destroy() {
    for (const o of objs) scene.remove(o)
    objs.length = 0
    state.floorsData.length = 0
    state.stairsData.length = 0
  }

  // ─── Einfaches Template-Format ────────────────────────────────────────────

  function _buildGroundFloor() {
    const { grid } = state
    const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
    const matA = new THREE.MeshLambertMaterial({ color: 0x4a7a5a })
    const matB = new THREE.MeshLambertMaterial({ color: 0x527d63 })
    for (let x = 0; x < grid; x++) {
      for (let z = 0; z < grid; z++) {
        const tile = new THREE.Mesh(tileGeo, (x + z) % 2 === 0 ? matA : matB)
        tile.position.set((x - grid / 2 + 0.5) * TILE, 0, (z - grid / 2 + 0.5) * TILE)
        tile.receiveShadow = true
        scene.add(tile); objs.push(tile)
      }
    }
    const gh = new THREE.GridHelper(grid * TILE, grid, 0x000000, 0x000000) as THREE.GridHelper & { material: THREE.Material & { opacity: number; transparent: boolean } }
    gh.position.y = 0.07
    gh.material.opacity = 0.12; gh.material.transparent = true
    scene.add(gh); objs.push(gh)
  }

  function _buildGroundWalls(geo: RoomGeometry) {
    const { grid, floor2Y } = state
    const GWALL_H = 2.8
    const wallMat  = makeMat(0xd8c9a8)
    const frameMat = makeMat(0x4a2e0a)
    const halfG    = (grid / 2) * TILE
    const wallY    = GWALL_H / 2 + 0.06
    const th       = 0.22
    const add = (m: THREE.Object3D) => { scene.add(m); objs.push(m) }
    if (geo.wall_n ?? 1) add(box(grid * TILE, GWALL_H, th, wallMat, 0, wallY, -halfG))
    if (geo.wall_w ?? 1) add(box(th, GWALL_H, grid * TILE, wallMat, -halfG, wallY, 0))
    if (geo.wall_s ?? 0) add(box(grid * TILE, GWALL_H, th, wallMat, 0, wallY, halfG))
    if (geo.wall_e ?? 0) add(box(th, GWALL_H, grid * TILE, wallMat, halfG, wallY, 0))
    // Door (Südwand)
    if ((geo.door_wall ?? 'S') === 'S') {
      const DW = geo.door_width ?? 1.8, DH = geo.door_height ?? 2.2
      const off = geo.door_offset ?? 0
      const fh = DH + 0.14, fy = fh / 2 + 0.06
      add(box(0.13, fh, th + 0.05, frameMat, off - DW/2 - 0.065, fy, halfG))
      add(box(0.13, fh, th + 0.05, frameMat, off + DW/2 + 0.065, fy, halfG))
      add(box(DW + 0.26, 0.15, th + 0.05, frameMat, off, DH + 0.135, halfG))
      const pivot = new THREE.Group()
      pivot.position.set(off + DW/2, 0.06, halfG)
      pivot.rotation.y = -0.45
      scene.add(pivot); objs.push(pivot)
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.08), makeMat(0x7a4e28))
      doorMesh.position.set(-DW/2, DH/2, 0)
      doorMesh.castShadow = true; doorMesh.receiveShadow = true
      pivot.add(doorMesh)
    }
  }

  function _buildLegacyStaircase() {
    const { stX0, stX1, stZ0, stZ1, floor2Y } = state
    const STEPS = 20
    const stepH = floor2Y / STEPS
    const stepD = (stZ1 - stZ0) / STEPS
    const stepW = stX1 - stX0
    const cx    = (stX0 + stX1) / 2
    const stepMat = makeMat(0xc8b48a)
    const railMat = makeMat(0x4a2e0a)
    for (let i = 0; i < STEPS; i++) {
      const h = (i + 1) * stepH, zc = stZ1 - (i + 0.5) * stepD
      const s = new THREE.Mesh(new THREE.BoxGeometry(stepW, h, stepD - 0.02), stepMat)
      s.position.set(cx, h / 2, zc)
      s.castShadow = s.receiveShadow = true
      scene.add(s); objs.push(s)
    }
    for (const px of [stX0, stX1]) {
      for (let i = 0; i <= STEPS; i++) {
        const m = box(0.10, 0.90, 0.10, railMat, px, i * stepH + 0.45, stZ1 - i * stepD)
        scene.add(m); objs.push(m)
      }
    }
  }

  function _buildLegacyUpperFloor() {
    const { f2X0, f2X1, f2Z0, f2Z1, floor2Y } = state
    const tileMatA = new THREE.MeshLambertMaterial({ color: 0xa07850 })
    const tileMatB = new THREE.MeshLambertMaterial({ color: 0x8c6840 })
    const tileGeo2 = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
    for (let xi = f2X0; xi < f2X1; xi++) {
      for (let zi = f2Z0; zi < f2Z1; zi++) {
        const t = new THREE.Mesh(tileGeo2, (xi + zi) % 2 === 0 ? tileMatA : tileMatB)
        t.position.set(xi + 0.5, floor2Y, zi + 0.5)
        t.castShadow = false; t.receiveShadow = true
        scene.add(t); objs.push(t)
      }
    }
  }

  // ─── Editor-Format ─────────────────────────────────────────────────────────

  function _edStairDims(stair: RoomStair, fromY: number) {
    const steps  = stair.steps || 14
    const rise   = stair.height || 7
    const stepH  = rise / steps
    const totalD = steps * _STAIR_STEP_D
    const strLen = Math.sqrt(totalD * totalD + rise * rise)
    const strAng = Math.atan2(totalD, rise)
    const w = stair.width ?? _STAIR_W_NEW
    return { fromY, rise, steps, stepH, totalD, strLen, strAng, w }
  }

  function _edStairSetup(stair: RoomStair, fromY: number) {
    const g = new THREE.Group()
    g.rotation.y = _ED_FAC_Y[stair.dir] ?? 0
    g.position.set(stair.anchor_x ?? 0, fromY, stair.anchor_z ?? 0)
    return g
  }

  function _edBuildStairClassic(stair: RoomStair, fromY: number) {
    const { rise, steps, stepH, totalD, w } = _edStairDims(stair, fromY)
    const g = _edStairSetup(stair, fromY)
    const stepMat = makeMat(0xc8b48a), railMat = makeMat(0x4a2e0a)
    for (let i = 0; i < steps; i++) {
      const h = (i+1)*stepH, cz2 = (i+0.5)*_STAIR_STEP_D
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, _STAIR_STEP_D-0.02), stepMat)
      s.position.set(0, h/2, cz2); s.castShadow = s.receiveShadow = true; g.add(s)
    }
    for (const sx of [-w/2, w/2]) {
      for (let i = 0; i <= steps; i++) g.add(box(0.10, 0.90, 0.10, railMat, sx, i*stepH+0.45, i*_STAIR_STEP_D))
      for (let i = 0; i < steps; i++) g.add(box(0.08, 0.08, _STAIR_STEP_D+0.05, railMat, sx, (i+0.5)*stepH+0.80, (i+0.5)*_STAIR_STEP_D))
    }
    return g
  }

  function _edBuildStairWood(stair: RoomStair, fromY: number) {
    const { rise, steps, stepH, totalD, strLen, strAng, w } = _edStairDims(stair, fromY)
    const g = _edStairSetup(stair, fromY)
    const woodM = makeMat(0xb08030), woodD = makeMat(0x7a5018), railM = makeMat(0x5a3010)
    for (const sx of [-w/2, w/2]) {
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.10, strLen, 0.16), woodD)
      str.position.set(sx, rise/2, totalD/2); str.rotation.x = strAng; g.add(str)
    }
    for (let i = 0; i < steps; i++) {
      const ty = (i+1)*stepH, tz = (i+0.5)*_STAIR_STEP_D
      const pw = w/3-0.03
      for (const ox of [-w/3+pw/2, 0, w/3-pw/2]) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.07, _STAIR_STEP_D-0.06), woodM)
        pl.position.set(ox, ty-0.035, tz); g.add(pl)
      }
    }
    for (let i = 0; i <= steps; i++) g.add(box(0.08, 0.72, 0.08, railM, w/2, i*stepH+0.36, i*_STAIR_STEP_D))
    const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), railM)
    rb.position.set(w/2, rise/2+0.72, totalD/2); rb.rotation.x = strAng; g.add(rb)
    return g
  }

  function _edBuildStairStone(stair: RoomStair, fromY: number) {
    const { rise, steps, stepH, totalD, w } = _edStairDims(stair, fromY)
    const g = _edStairSetup(stair, fromY)
    const stoneM = makeMat(0x9a9288), stoneD = makeMat(0x6e6660), stoneL = makeMat(0xbab4ae)
    const hw = w/2
    for (let i = 0; i < steps; i++) {
      const bh = (i+1)*stepH, bz = (i+0.5)*_STAIR_STEP_D
      g.add(box(w, bh, _STAIR_STEP_D-0.04, stoneM, 0, bh/2, bz))
      g.add(box(w, 0.04, _STAIR_STEP_D-0.04, stoneL, 0, bh+0.01, bz))
    }
    for (const sx of [-hw-0.07, hw+0.07]) g.add(box(0.10, rise, totalD, stoneD, sx, rise/2, totalD/2))
    return g
  }

  function _edBuildStairMetal(stair: RoomStair, fromY: number) {
    const { rise, steps, stepH, totalD, strLen, strAng, w } = _edStairDims(stair, fromY)
    const g = _edStairSetup(stair, fromY)
    const metalM = makeMat(0x3a3a4a), metalL = makeMat(0x5a5a6e), safeY = makeMat(0xddcc00)
    for (const sx of [-w/2, w/2]) {
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.09, strLen, 0.09), metalM)
      str.position.set(sx, rise/2, totalD/2); str.rotation.x = strAng; g.add(str)
    }
    for (let i = 0; i < steps; i++) {
      const ty = (i+1)*stepH, tz = (i+0.5)*_STAIR_STEP_D
      g.add(box(w, 0.05, _STAIR_STEP_D-0.06, metalL, 0, ty-0.025, tz))
      g.add(box(w, 0.05, 0.06, safeY, 0, ty, tz-_STAIR_STEP_D/2+0.03))
    }
    for (const sx of [-w/2, w/2]) {
      for (let i = 0; i <= steps; i++) g.add(box(0.06, 0.80, 0.06, metalM, sx, i*stepH+0.40, i*_STAIR_STEP_D))
      const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), metalL)
      rb.position.set(sx, rise/2+0.82, totalD/2); rb.rotation.x = strAng; g.add(rb)
    }
    return g
  }

  function _edBuildStairOpen(stair: RoomStair, fromY: number) {
    const { rise, steps, stepH, totalD, strLen, strAng, w } = _edStairDims(stair, fromY)
    const g = _edStairSetup(stair, fromY)
    const spineM = makeMat(0x2a2a3a), treadM = makeMat(0xd8c89a)
    const glassM = new THREE.MeshLambertMaterial({ color: 0xaaccee, transparent: true, opacity: 0.28 })
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, strLen, 0.14), spineM)
    spine.position.set(0, rise/2, totalD/2); spine.rotation.x = strAng; g.add(spine)
    for (let i = 0; i < steps; i++) {
      const ty = (i+1)*stepH, tz = (i+0.5)*_STAIR_STEP_D
      g.add(box(w, 0.06, _STAIR_STEP_D-0.08, treadM, 0, ty-0.03, tz))
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, _STAIR_STEP_D-0.05), glassM)
      pane.position.set(-w/2, (i+0.5)*stepH+stepH/2+0.36, tz); g.add(pane)
    }
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), spineM)
    topRail.position.set(-w/2, rise/2+0.76, totalD/2); topRail.rotation.x = strAng; g.add(topRail)
    return g
  }

  const _ED_STAIR_BUILDERS: Record<string, (s: RoomStair, y: number) => THREE.Group> = {
    classic: _edBuildStairClassic,
    wood:    _edBuildStairWood,
    stone:   _edBuildStairStone,
    metal:   _edBuildStairMetal,
    open:    _edBuildStairOpen,
  }

  function _edBuildWall(floor: RoomFloor, edge: string, hasDoor: boolean, allStairs: RoomStair[], floorY: number) {
    const GWALL_H = 2.8
    const WALL_TH = 0.22
    const DOOR_W  = 1.8, DOOR_H = 2.2
    const wallMat  = makeMat(0xd8c9a8)
    const frameMat = makeMat(0x4a2e0a)
    const doorMat  = makeMat(0x7a4e28)

    const horiz   = edge === 'N' || edge === 'S'
    const fixedC  = edge === 'N' ? floor.z0 : edge === 'S' ? floor.z1 : edge === 'W' ? floor.x0 : floor.x1
    const start   = horiz ? floor.x0 : floor.z0
    const end     = horiz ? floor.x1 : floor.z1
    const mid     = (start + end) / 2
    const baseY   = floorY + 0.06
    const wallObjs: THREE.Object3D[] = []

    const seg = (a: number, b: number, h = GWALL_H, yOff = 0) => {
      if (b - a < 0.01) return
      const l = b - a, c = (a + b) / 2
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? l : WALL_TH, h, horiz ? WALL_TH : l), wallMat
      )
      m.position.set(horiz ? c : fixedC, baseY + yOff + h / 2, horiz ? fixedC : c)
      m.receiveShadow = true
      scene.add(m); objs.push(m); wallObjs.push(m)
    }

    // Treppenlücken
    const stairGaps: { center: number; width: number }[] = []
    for (const stair of allStairs) {
      const [dx, dz] = _STAIR_DV[stair.dir] || [0, 1]
      const hw = (stair.width ?? _STAIR_W_NEW) / 2
      const ax = stair.anchor_x ?? 0, az = stair.anchor_z ?? 0
      const steps = stair.steps || 14
      const pts = [{ x: ax, z: az }, { x: ax + dx * steps, z: az + dz * steps }]
      for (const p of pts) {
        const perpVal  = horiz ? p.z : p.x
        const alongVal = horiz ? p.x : p.z
        if (Math.abs(perpVal - fixedC) < 1.5) {
          stairGaps.push({ center: alongVal, width: hw * 2 + 0.3 })
          break
        }
      }
    }

    const PW = 0.14
    const aboveH = GWALL_H - DOOR_H
    const allGaps: { gs: number; ge: number; isDoor: boolean }[] = [
      ...stairGaps.map(sg => ({ gs: sg.center - sg.width / 2, ge: sg.center + sg.width / 2, isDoor: false })),
    ]
    if (hasDoor) allGaps.push({ gs: mid - DOOR_W / 2, ge: mid + DOOR_W / 2, isDoor: true })

    const _wTh = WALL_TH / 2
    const _wLvl = floor.floor_index != null ? floor.floor_index : 0
    const solidSeg = (a: number, b: number) => {
      if (b - a < 0.01) return
      if (horiz) _addSolid(a, b, fixedC - _wTh, fixedC + _wTh, _wLvl)
      else        _addSolid(fixedC - _wTh, fixedC + _wTh, a, b, _wLvl)
    }

    if (allGaps.length === 0) { seg(start, end); solidSeg(start, end); return }
    allGaps.sort((a, b) => a.gs - b.gs)
    let cursor = start
    for (const gap of allGaps) { seg(cursor, gap.gs); solidSeg(cursor, gap.gs); cursor = gap.ge }
    seg(cursor, end); solidSeg(cursor, end)

    if (hasDoor) {
      const dgs = mid - DOOR_W / 2, dge = mid + DOOR_W / 2
      seg(dgs, dge, aboveH, DOOR_H)
      for (const side of [-1, 1]) {
        const along = side < 0 ? dgs + PW / 2 : dge - PW / 2
        const post  = new THREE.Mesh(
          new THREE.BoxGeometry(horiz ? PW : WALL_TH + 0.12, DOOR_H, horiz ? WALL_TH + 0.12 : PW), frameMat
        )
        post.position.set(horiz ? along : fixedC, baseY + DOOR_H / 2, horiz ? fixedC : along)
        scene.add(post); objs.push(post)
      }
      const pivot = new THREE.Group()
      pivot.position.set(horiz ? dge : fixedC, baseY, horiz ? fixedC : dge)
      pivot.rotation.y = -0.45
      scene.add(pivot); objs.push(pivot)
      const panelW = DOOR_W - PW * 2
      const panel  = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? panelW : WALL_TH, DOOR_H - 0.03, horiz ? WALL_TH : panelW), doorMat
      )
      panel.position.set(horiz ? -panelW / 2 : 0, (DOOR_H - 0.03) / 2, horiz ? 0 : -panelW / 2)
      pivot.add(panel)
    }
  }

  function _edBuildFloor(floor: RoomFloor, allStairs: RoomStair[]) {
    const floorY = floor.y ?? 0
    const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
    const matA    = makeMat(floor.colorA ?? 0x4a7a5a)
    const matB    = makeMat(floor.colorB ?? 0x527d63)

    const tilesX = Math.max(1, Math.round((floor.x1 - floor.x0) / TILE))
    const tilesZ = Math.max(1, Math.round((floor.z1 - floor.z0) / TILE))
    const holesSet = new Set((floor.holes || []).map(h => `${h.x},${h.z}`))

    for (let xi = 0; xi < tilesX; xi++) {
      for (let zi = 0; zi < tilesZ; zi++) {
        if (holesSet.has(`${xi},${zi}`)) continue
        const tile = new THREE.Mesh(tileGeo, (xi + zi) % 2 === 0 ? matA : matB)
        tile.position.set(floor.x0 + (xi + 0.5) * TILE, floorY, floor.z0 + (zi + 0.5) * TILE)
        tile.receiveShadow = true
        scene.add(tile); objs.push(tile)
      }
    }

    // Grid overlay
    const maxT = Math.max(tilesX, tilesZ)
    const gh = new THREE.GridHelper(maxT, maxT, 0x000000, 0x000000) as THREE.GridHelper & { material: THREE.Material & { opacity: number; transparent: boolean } }
    gh.scale.set(tilesX / maxT, 1, tilesZ / maxT)
    gh.position.set((floor.x0 + floor.x1) / 2, floorY + 0.065, (floor.z0 + floor.z1) / 2)
    gh.material.opacity = 0.09; gh.material.transparent = true
    scene.add(gh); objs.push(gh)

    // Wände
    for (const edge of ['N', 'S', 'E', 'W']) {
      const eL = edge.toLowerCase() as 'n' | 's' | 'e' | 'w'
      const hasW = !!(floor[`wall${edge}` as keyof RoomFloor] ?? floor[`wall_${eL}` as keyof RoomFloor])
      const hasD = !!(floor[`door${edge}` as keyof RoomFloor] ?? floor[`door_${eL}` as keyof RoomFloor])
      if (hasW) _edBuildWall(floor, edge, hasD, allStairs, floorY)
    }
  }

  function _buildEditorRoom(geo: RoomGeometry) {
    const floors = geo.floors || []
    const stairs = geo.stairs || []

    state.floorsData = floors.map(f => ({
      floor_index: f.floor_index ?? 0,
      x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1,
      y: f.y ?? 0,
    }))
    state.stairsData = stairs.map(s => {
      const fromIdx = s.from_floor ?? 0
      const fromFloor = state.floorsData.find(f => f.floor_index === fromIdx)
      return {
        anchor_x:   s.anchor_x ?? 0,
        anchor_z:   s.anchor_z ?? 0,
        dir:        s.dir || 'N',
        width:      s.width ?? _STAIR_W_NEW,
        steps:      s.steps || 14,
        height:     s.height || 7,
        from_floor: fromIdx,
        to_floor:   s.to_floor ?? 1,
        base_y:     fromFloor ? fromFloor.y : 0,
      }
    })

    for (const floor of floors) _edBuildFloor(floor, stairs)
    for (const stair of stairs) {
      const fromFloor = state.floorsData.find(f => f.floor_index === (stair.from_floor ?? 0))
      const fromY = fromFloor ? fromFloor.y : 0
      const style   = stair.style || 'classic'
      const builder = _ED_STAIR_BUILDERS[style] || _edBuildStairClassic
      const g       = builder(stair, fromY)
      g.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = m.receiveShadow = true } })
      scene.add(g); objs.push(g)
    }
    for (const roller of (geo.rollers || [])) {
      const flIdx  = roller.floor_idx ?? 0
      const flData = state.floorsData.find(f => f.floor_index === flIdx)
      _buildRoller(roller.x, roller.z, roller.dir, flData ? flData.y : 0)
    }
    if (geo.spawn) {
      const spawnFlIdx = geo.spawn.floor_idx ?? 0
      _setCharPos(geo.spawn.x, geo.spawn.z, spawnFlIdx)
    }
  }

  // ─── Hauptfunktion ─────────────────────────────────────────────────────────

  function build(geo: RoomGeometry) {
    state.grid = geo.grid_size ?? 20

    if (geo.floors && geo.floors.length > 0) {
      _buildEditorRoom(geo)
    } else {
      // Legacy template format
      state.floor2Y = 7.0
      _buildGroundFloor()
      _buildGroundWalls(geo)
      _buildLegacyStaircase()
      _buildLegacyUpperFloor()

      // Legacy solid walls
      const hG = (state.grid / 2) * TILE, th = 0.15
      _addSolid(-hG, hG, -hG - th, -hG + th, 0)
      _addSolid(-hG - th, -hG + th, -hG, hG, 0)
      _addSolid(state.f2X0, state.f2X1, state.f2Z0 - th, state.f2Z0 + th, 1)
      _addSolid(state.f2X0 - th, state.f2X0 + th, state.f2Z0, state.f2Z1, 1)
      _addSolid(state.f2X1 - th, state.f2X1 + th, state.f2Z0, state.f2Z1, 1)
      _addSolid(state.f2X0, state.stX0, state.f2Z1 - th, state.f2Z1 + th, 1)
    }
  }

  function rebuild(geo: RoomGeometry) {
    destroy()
    build(geo)
  }

  return {
    build,
    rebuild,
    destroy,
    getState: () => state,
    getFloorY,
    setAddSolid: fn => { _addSolid = fn },
    setBuildRoller: fn => { _buildRoller = fn },
    setCharPos: fn => { _setCharPos = fn },
  }
}
