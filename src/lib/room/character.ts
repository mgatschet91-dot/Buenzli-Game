/**
 * character.ts — Avatar-Builder, Bewegung, Animation, Chat, Shadow
 *
 * Baut den Habbo-Voxel-Avatar aus Box-Meshes, verwaltet den Character-State
 * und führt Bewegung + Animation pro Frame aus.
 */
import { THREE } from './three-shim'
import { box, makeMat, shadeHex } from './materials'
import { SPEED, CHAR_R } from './types'
import {
  SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, PANTS_COLORS, SHOE_COLORS,
  HAIR_STYLES, SHIRT_STYLES, PANTS_STYLES, FACING_DIRS, FACING_Y,
  type AvatarState, createDefaultAvatar, stateToAvatarCode, avatarCodeToState,
} from './avatar-config'
import type { DrinkDef } from './types'
import type { RollerEntry } from './rollers'
import type { StairDataNew, FloorData } from './types'

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface SeatEntry {
  x: number; z: number; facingY: number; level?: number
}

export interface CharState {
  x:           number; z: number
  dir:         number
  state:       'idle' | 'walk' | 'sit' | 'wave' | 'sleep' | 'dance'
  target:      { x: number; z: number; autoSit?: SeatEntry } | null
  animT:       number
  level:       number
  chatting:    boolean; chatTimer: number; chatText: string
  rollerTarget: { x: number; z: number } | null
  drink:       DrinkDef | null
  sipT:        number
  seatY?:      number
}

export interface CharacterSystem {
  group:          THREE.Group
  shadow:         THREE.Mesh
  state:          CharState
  setAvatar:      (code: string) => void
  getAvatarCode:  () => string
  rebuild:        () => void
  update:         (dt: number) => void
  attachDrink:    (drink: DrinkDef | null) => void
  setPosition:    (x: number, z: number, level: number) => void
  /** Injected by engine */
  setGetFloorY:   (fn: GetFloorYFn) => void
  setIsBlocked:   (fn: IsBlockedFn) => void
  setFindRoller:  (fn: FindRollerFn) => void
  setGetStairs:   (fn: () => { stairsData: StairDataNew[]; floorsData: FloorData[] }) => void
  setSeats:       (seats: SeatEntry[]) => void
  setSipCallback: (fn: (dt: number) => void) => void
}

type GetFloorYFn  = (wx: number, wz: number, level?: number) => number
type IsBlockedFn  = (px: number, pz: number, level: number) => boolean
type FindRollerFn = (x: number, z: number, radius?: number) => RollerEntry | null

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCharacter(scene: THREE.Scene): CharacterSystem {
  let _getFloorY:  GetFloorYFn  = () => 0
  let _isBlocked:  IsBlockedFn  = () => false
  let _findRoller: FindRollerFn = () => null
  let _getStairs:  () => { stairsData: StairDataNew[]; floorsData: FloorData[] } = () => ({ stairsData: [], floorsData: [] })
  let _seats:      SeatEntry[] = []
  let _onSip:      ((dt: number) => void) | null = null
  let _avatar:     AvatarState = createDefaultAvatar()

  const state: CharState = {
    x: 0, z: 0, dir: 0,
    state: 'idle',
    target: null,
    animT: 0,
    level: 0,
    chatting: false, chatTimer: 0, chatText: '',
    rollerTarget: null,
    drink: null, sipT: -5,
  }

  // ─── Avatar Builder ──────────────────────────────────────────────────────

  function _buildCharacter(): THREE.Group {
    const root = new THREE.Group()
    const cfg  = _avatar

    const skinHex  = SKIN_TONES[cfg.skinTone]
    const hairHex  = HAIR_COLORS[cfg.hairColor]
    const shirtHex = SHIRT_COLORS[cfg.shirtColor]
    const pantsHex = PANTS_COLORS[cfg.pantsColor]
    const shoeHex  = SHOE_COLORS[cfg.shoeColor]

    const skin      = makeMat(skinHex)
    const skinDark  = makeMat(shadeHex(skinHex, -0.18))
    const skinLight = makeMat(shadeHex(skinHex,  0.20))
    const hair      = makeMat(hairHex)
    const hairDark  = makeMat(shadeHex(hairHex, -0.38))
    const shirtBlue = makeMat(shirtHex)
    const shirtDark = makeMat(shadeHex(shirtHex, -0.28))
    const shirtCuff = makeMat(shadeHex(shirtHex,  0.35))
    const pants     = makeMat(pantsHex)
    const pantsDark = makeMat(shadeHex(pantsHex, -0.25))
    const shoe      = makeMat(shoeHex)
    const shoeDark  = makeMat(shadeHex(shoeHex, -0.28))
    const shoeSole  = makeMat(shadeHex(shoeHex, -0.50))
    const belt      = makeMat(0x7a5a18)
    const beltBkl   = makeMat(0xd4a820)
    const eyeD      = makeMat(0x0e0e1e)
    const eyeW      = makeMat(0xffffff)
    const mouthD    = makeMat(0x8b3320)

    // HEAD
    const head = new THREE.Group(); head.name = 'head'
    head.add(box(0.66, 0.62, 0.60, skin,  0,     0,    0))
    head.add(box(0.09, 0.17, 0.15, skin, -0.37,  0.02, 0))
    head.add(box(0.09, 0.17, 0.15, skin,  0.37,  0.02, 0))
    HAIR_STYLES[cfg.hairStyle]?.build(head, hair, hairDark)
    head.add(box(0.20, 0.18, 0.06, eyeW, -0.15,  0.08, 0.31))
    head.add(box(0.20, 0.18, 0.06, eyeW,  0.15,  0.08, 0.31))
    head.add(box(0.13, 0.15, 0.05, eyeD, -0.15,  0.04, 0.33))
    head.add(box(0.13, 0.15, 0.05, eyeD,  0.15,  0.04, 0.33))
    head.add(box(0.05, 0.05, 0.03, eyeW, -0.10,  0.10, 0.35))
    head.add(box(0.05, 0.05, 0.03, eyeW,  0.10,  0.10, 0.35))
    head.add(box(0.20, 0.05, 0.04, hairDark, -0.15, 0.22, 0.31))
    head.add(box(0.20, 0.05, 0.04, hairDark,  0.15, 0.22, 0.31))
    head.add(box(0.09, 0.10, 0.09, skinDark, 0, -0.02, 0.32))
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.05), mouthD)
    mouth.name = 'mouth'; mouth.position.set(0, -0.16, 0.32)
    head.add(mouth)
    head.add(box(0.08, 0.08, 0.05, mouthD, -0.13, -0.13, 0.32))
    head.add(box(0.08, 0.08, 0.05, mouthD,  0.13, -0.13, 0.32))
    head.position.set(0, 1.60, 0)
    root.add(head)

    // TORSO
    const torso = new THREE.Group(); torso.name = 'torso'
    SHIRT_STYLES[cfg.shirtStyle]?.build(torso, shirtBlue, shirtDark, skin, belt, beltBkl)
    // S-Logo on back
    const pxS = 0.062, pyS = 0.062, pzS = 0.04, sp = 0.072, bkZ = -0.21, offY = 0.06
    const sGlyph: [number, number][] = [[-1,2],[0,2],[1,2],[-1,1],[-1,0],[0,0],[1,0],[1,-1],[-1,-2],[0,-2],[1,-2]]
    for (const [cx2, cy] of sGlyph) torso.add(box(pxS, pyS, pzS, beltBkl, cx2*sp, cy*sp+offY, bkZ))
    torso.position.set(0, 1.05, 0)
    root.add(torso)

    // ARMS
    function makeArm(side: number) {
      const arm = new THREE.Group(); arm.name = side < 0 ? 'armL' : 'armR'
      arm.add(box(0.28, 0.12, 0.28, shirtDark, 0, -0.02, 0))
      arm.add(box(0.23, 0.30, 0.23, shirtBlue, 0, -0.20, 0))
      arm.add(box(0.25, 0.08, 0.25, shirtCuff, 0, -0.37, 0))
      const forearm = new THREE.Group(); forearm.name = side < 0 ? 'forearmL' : 'forearmR'
      forearm.position.set(0, -0.41, 0)
      forearm.add(box(0.21, 0.26, 0.21, skin, 0, -0.13, 0))
      const hand = new THREE.Group(); hand.name = side < 0 ? 'handL' : 'handR'
      hand.position.set(0, -0.28, 0)
      hand.add(box(0.19, 0.09, 0.19, skinDark, 0, -0.04, 0))
      hand.add(box(0.17, 0.16, 0.17, skin,     0, -0.12, 0))
      hand.add(box(0.06, 0.07, 0.06, skinDark, -0.07, -0.21, 0.05))
      forearm.add(hand); arm.add(forearm)
      arm.position.set(side < 0 ? -0.32 : 0.32, 1.20, 0)
      return arm
    }
    root.add(makeArm(-1)); root.add(makeArm(1))

    // LEGS
    function makeLeg(side: number) {
      const leg = new THREE.Group(); leg.name = side < 0 ? 'legL' : 'legR'
      leg.add(box(0.24, 0.36, 0.24, pants, 0, -0.18, 0))
      leg.add(box(0.22, 0.06, 0.22, pantsDark, 0, -0.38, 0))
      leg.add(box(0.22, 0.26, 0.22, skin, 0, -0.55, 0))
      leg.add(box(0.26, 0.08, 0.32, shoe, 0, -0.71, 0.05))
      leg.add(box(0.26, 0.06, 0.26, shoeDark, 0, -0.76, 0))
      leg.add(box(0.24, 0.04, 0.30, shoeSole, 0, -0.79, 0.05))
      leg.position.set(side < 0 ? -0.13 : 0.13, 0.78, 0)
      return leg
    }
    root.add(makeLeg(-1)); root.add(makeLeg(1))

    root.traverse((m: THREE.Object3D) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = true } })
    return root
  }

  // ─── Group + Shadow ──────────────────────────────────────────────────────

  let group = _buildCharacter()
  scene.add(group)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.22, transparent: true })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.07
  scene.add(shadow)

  // Target ring
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.40, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true, side: THREE.DoubleSide })
  )
  targetRing.rotation.x = -Math.PI / 2
  targetRing.position.y = 0.08
  targetRing.visible    = false
  scene.add(targetRing)

  // ─── Animation ───────────────────────────────────────────────────────────

  function _animate(dt: number) {
    state.animT += dt

    const armL     = group.getObjectByName('armL') as THREE.Object3D
    const armR     = group.getObjectByName('armR') as THREE.Object3D
    const forearmL = group.getObjectByName('forearmL') as THREE.Object3D | null
    const forearmR = group.getObjectByName('forearmR') as THREE.Object3D | null
    const handL    = group.getObjectByName('handL')    as THREE.Object3D | null
    const handR    = group.getObjectByName('handR')    as THREE.Object3D | null
    const legL     = group.getObjectByName('legL')     as THREE.Object3D
    const legR     = group.getObjectByName('legR')     as THREE.Object3D
    const head     = group.getObjectByName('head')     as THREE.Object3D
    const mouth    = group.getObjectByName('mouth')    as THREE.Mesh | null
    const torso    = group.getObjectByName('torso')    as THREE.Object3D

    const resetArms = () => {
      armL.rotation.set(0,0,0); armR.rotation.set(0,0,0)
      forearmL?.rotation.set(0,0,0); forearmR?.rotation.set(0,0,0)
      handL?.rotation.set(0,0,0);   handR?.rotation.set(0,0,0)
    }

    if (state.state === 'walk') {
      const t = state.animT * 8, swing = Math.sin(t) * 0.5
      armL.rotation.x = swing; armL.rotation.z = 0
      legL.rotation.x = -swing * 0.8; legR.rotation.x = swing * 0.8
      head.rotation.x = head.rotation.z = 0
      torso.position.y = 1.05
      if (state.drink) {
        armR.rotation.x = 0; armR.rotation.z = -0.05
        if (forearmR) { forearmR.rotation.x = -Math.PI * 0.50; forearmR.rotation.z = 0 }
        handR?.rotation.set(0,0,0)
        if (forearmL) { forearmL.rotation.x = Math.abs(swing) * 0.3; forearmL.rotation.z = 0 }
        handL?.rotation.set(0,0,0)
      } else {
        armR.rotation.x = -swing; armR.rotation.z = 0
        const eb = Math.abs(swing) * 0.35
        if (forearmL) { forearmL.rotation.x = eb; forearmL.rotation.z = 0 }
        if (forearmR) { forearmR.rotation.x = eb; forearmR.rotation.z = 0 }
        handL?.rotation.set(0,0,0); handR?.rotation.set(0,0,0)
      }
    } else if (state.state === 'idle') {
      const breath = Math.sin(state.animT * 1.5) * 0.02
      torso.position.y = 1.05 + breath
      head.position.y  = 1.6 + breath
      armL.rotation.x = armL.rotation.z = 0
      legL.rotation.x = legR.rotation.x = 0
      head.rotation.x = head.rotation.z = 0
      if (state.drink) {
        const sp = state.sipT >= 0 ? Math.min(1, state.sipT < 1 ? state.sipT : 2 - state.sipT) : 0
        armR.rotation.x = sp * (-1.55); armR.rotation.z = -0.05 + sp * 0.43
        if (forearmR) { forearmR.rotation.x = -Math.PI * 0.50 + sp * (-Math.PI * 0.14); forearmR.rotation.z = 0 }
        if (handR) { handR.rotation.x = sp * 0.55; handR.rotation.z = 0 }
        if (forearmL) { forearmL.rotation.x = 0.06; forearmL.rotation.z = 0 }
        handL?.rotation.set(0,0,0)
      } else {
        armR.rotation.x = 0; armR.rotation.z = 0
        if (forearmR) { forearmR.rotation.x = 0.06; forearmR.rotation.z = 0 }
        handR?.rotation.set(0,0,0)
        if (forearmL) { forearmL.rotation.x = 0.06; forearmL.rotation.z = 0 }
        handL?.rotation.set(0,0,0)
      }
    } else if (state.state === 'wave') {
      armR.rotation.x = -Math.PI * 0.58 + Math.sin(state.animT * 10) * 0.28; armR.rotation.z = 0.14
      if (forearmR) { forearmR.rotation.x = -Math.PI * 0.38 + Math.sin(state.animT * 10 + 0.5) * 0.22; forearmR.rotation.z = 0 }
      if (handR) { handR.rotation.x = Math.sin(state.animT * 10 + 1.0) * 0.18; handR.rotation.z = 0 }
      armL.rotation.x = armL.rotation.z = 0
      if (forearmL) { forearmL.rotation.x = 0.06; forearmL.rotation.z = 0 }
      handL?.rotation.set(0,0,0)
      legL.rotation.x = legR.rotation.x = 0; head.rotation.x = head.rotation.z = 0
    } else if (state.state === 'sit') {
      legL.rotation.x = -Math.PI * 0.5; legR.rotation.x = -Math.PI * 0.5
      armL.rotation.x = armR.rotation.x = 0.15; armL.rotation.z = armR.rotation.z = 0
      if (forearmL) { forearmL.rotation.x = -Math.PI * 0.28; forearmL.rotation.z = 0 }
      if (forearmR) { forearmR.rotation.x = -Math.PI * 0.28; forearmR.rotation.z = 0 }
      handL?.rotation.set(0,0,0); handR?.rotation.set(0,0,0)
      head.rotation.x = head.rotation.z = 0
    } else if (state.state === 'sleep') {
      resetArms(); legL.rotation.x = legR.rotation.x = 0; head.rotation.x = head.rotation.z = 0
      const breath = Math.sin(state.animT * 0.6) * 0.015
      torso.position.y = 1.05 + breath
    } else if (state.state === 'dance') {
      const t = state.animT * 6
      armL.rotation.x = Math.sin(t) * 0.7;   armR.rotation.x = -Math.sin(t) * 0.7
      armL.rotation.z = 0.5  + Math.cos(t * 0.7) * 0.55
      armR.rotation.z = -0.5 - Math.cos(t * 0.7) * 0.55
      if (forearmL) { forearmL.rotation.x = Math.sin(t + 0.6) * 0.55; forearmL.rotation.z = 0 }
      if (forearmR) { forearmR.rotation.x = -Math.sin(t + 0.6) * 0.55; forearmR.rotation.z = 0 }
      if (handL) { handL.rotation.x = Math.sin(t + 1.1) * 0.3; handL.rotation.z = 0 }
      if (handR) { handR.rotation.x = -Math.sin(t + 1.1) * 0.3; handR.rotation.z = 0 }
      legL.rotation.x = Math.sin(t * 1.5) * 0.28; legR.rotation.x = -Math.sin(t * 1.5) * 0.28
      head.rotation.z = Math.sin(t * 0.9) * 0.18; head.rotation.x = 0
      const bounce = Math.abs(Math.sin(t * 2)) * 0.06
      torso.position.y = 1.05 + bounce; head.position.y = 1.6 + bounce
    }
    if (mouth) mouth.scale.y = state.chatting ? (1 + Math.abs(Math.sin(state.animT * 14)) * 1.8) : 1
  }

  // ─── Movement ────────────────────────────────────────────────────────────

  const _STAIR_DV: Record<string, [number, number]> = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }

  function _updateMovement(mx: number, mz: number, dt: number) {
    const { stairsData, floorsData } = _getStairs()
    const floor2Y = floorsData.length > 0
      ? Math.max(...floorsData.filter(f => f.floor_index >= 1).map(f => f.y), 7.0)
      : 7.0

    const halfG = 9.5  // default half-grid
    let _mvMinX = -halfG, _mvMaxX = halfG, _mvMinZ = -halfG, _mvMaxZ = halfG
    if (floorsData.length > 0) {
      for (const f of floorsData) {
        _mvMinX = Math.min(_mvMinX, f.x0); _mvMaxX = Math.max(_mvMaxX, f.x1)
        _mvMinZ = Math.min(_mvMinZ, f.z0); _mvMaxZ = Math.max(_mvMaxZ, f.z1)
      }
      for (const st of stairsData) {
        _mvMinX = Math.min(_mvMinX, st.anchor_x - st.steps, st.anchor_x)
        _mvMaxX = Math.max(_mvMaxX, st.anchor_x + st.steps, st.anchor_x)
        _mvMinZ = Math.min(_mvMinZ, st.anchor_z - st.steps, st.anchor_z)
        _mvMaxZ = Math.max(_mvMaxZ, st.anchor_z + st.steps, st.anchor_z)
      }
    }

    const curH   = _getFloorY(state.x, state.z, state.level)
    const MAX_ST = floor2Y * 0.10
    const nx     = Math.max(_mvMinX, Math.min(_mvMaxX, state.x + mx * SPEED * dt))
    const nz     = Math.max(_mvMinZ, Math.min(_mvMaxZ, state.z + mz * SPEED * dt))

    const bothOK = Math.abs(_getFloorY(nx, nz, state.level) - curH) <= MAX_ST && !_isBlocked(nx, nz, state.level)
    const xOK    = Math.abs(_getFloorY(nx, state.z, state.level) - curH) <= MAX_ST && !_isBlocked(nx, state.z, state.level)
    const zOK    = Math.abs(_getFloorY(state.x, nz, state.level) - curH) <= MAX_ST && !_isBlocked(state.x, nz, state.level)

    if (bothOK)   { state.x = nx; state.z = nz }
    else if (xOK) { state.x = nx }
    else if (zOK) { state.z = nz }

    // Staircase railing clamping
    for (const st of stairsData) {
      const [sdx, sdz] = _STAIR_DV[st.dir] || [0, 1]
      const hw = (st.width || 3) / 2 - CHAR_R
      if (sdx === 0) {
        const szLo = sdz > 0 ? st.anchor_z : st.anchor_z - st.steps
        const szHi = sdz > 0 ? st.anchor_z + st.steps : st.anchor_z
        if (state.z >= szLo && state.z <= szHi)
          state.x = Math.max(st.anchor_x - hw, Math.min(st.anchor_x + hw, state.x))
      } else {
        const sxLo = sdx > 0 ? st.anchor_x : st.anchor_x - st.steps
        const sxHi = sdx > 0 ? st.anchor_x + st.steps : st.anchor_x
        if (state.x >= sxLo && state.x <= sxHi)
          state.z = Math.max(st.anchor_z - hw, Math.min(st.anchor_z + hw, state.z))
      }
    }

    // Update floor level
    if (stairsData.length > 0) {
      let onStair = false
      for (const st of stairsData) {
        const [dx, dz] = _STAIR_DV[st.dir] || [0, 1]
        const hw = (st.width || 3) / 2
        let inZone = false, t = 0
        if (dx === 0) {
          const zLo = dz > 0 ? st.anchor_z : st.anchor_z - st.steps
          const zHi = dz > 0 ? st.anchor_z + st.steps : st.anchor_z
          if (state.x >= st.anchor_x - hw && state.x <= st.anchor_x + hw && state.z >= zLo && state.z <= zHi) {
            inZone = true; t = dz > 0 ? (state.z - st.anchor_z) / st.steps : (st.anchor_z - state.z) / st.steps
          }
        } else {
          const xLo = dx > 0 ? st.anchor_x : st.anchor_x - st.steps
          const xHi = dx > 0 ? st.anchor_x + st.steps : st.anchor_x
          if (state.z >= st.anchor_z - hw && state.z <= st.anchor_z + hw && state.x >= xLo && state.x <= xHi) {
            inZone = true; t = dx > 0 ? (state.x - st.anchor_x) / st.steps : (st.anchor_x - state.x) / st.steps
          }
        }
        if (inZone) {
          onStair = true
          if (t >= 0.90) state.level = st.to_floor ?? 1
          else if (t <= 0.10) state.level = st.from_floor ?? 0
        }
      }
      if (!onStair) {
        const onUpper = floorsData.some(f =>
          f.floor_index >= 1 &&
          state.x >= f.x0 - 2 && state.x <= f.x1 + 2 &&
          state.z >= f.z0 - 2 && state.z <= f.z1 + 2
        )
        if (!onUpper) state.level = 0
      }
    }

    const targetDir = Math.atan2(mx, mz)
    let diff = targetDir - state.dir
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    state.dir += diff * Math.min(1, dt * 18)

    if (state.state !== 'wave' && state.state !== 'sleep') state.state = 'walk'
  }

  // ─── Update (called every frame) ─────────────────────────────────────────

  function update(dt: number) {
    // Sip timer (idle only)
    if (state.drink && state.state === 'idle') {
      state.sipT += dt
      if (state.sipT >= 2.0) state.sipT = -(4 + Math.random() * 5)
    }

    // Chat timer
    if (state.chatting) {
      state.chatTimer -= dt
      if (state.chatTimer <= 0) { state.chatting = false; state.chatTimer = 0 }
    }

    _animate(dt)

    // Position + rotation
    const floorY = _getFloorY(state.x, state.z, state.level)

    if (state.state === 'sit') {
      const SIT_H = state.seatY !== undefined ? state.seatY : 0.45
      group.position.set(state.x, floorY + SIT_H, state.z)
    } else if (state.state === 'sleep') {
      group.position.set(state.x, floorY + 0.06, state.z)
      group.rotation.y = state.dir
    } else {
      group.position.set(state.x, floorY + 0.06, state.z)
    }
    group.rotation.y = state.dir
    shadow.position.set(state.x, floorY + 0.07, state.z)

    // Target ring
    if (state.target) {
      const ty = _getFloorY(state.target.x, state.target.z, state.level)
      targetRing.position.set(state.target.x, ty + 0.08, state.target.z)
      targetRing.visible = true
    } else {
      targetRing.visible = false
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  function rebuild() {
    scene.remove(group)
    group = _buildCharacter()
    scene.add(group)
    if (state.drink) attachDrink(state.drink)
  }

  function setAvatar(code: string) {
    _avatar = avatarCodeToState(code)
    rebuild()
  }

  function getAvatarCode(): string {
    return stateToAvatarCode(_avatar)
  }

  function attachDrink(drink: DrinkDef | null) {
    state.drink = drink
    const handR = group.getObjectByName('handR')
    if (!handR) return
    const old = handR.getObjectByName('drinkProp')
    if (old) handR.remove(old)
    if (!drink) return
    const canMat   = new THREE.MeshLambertMaterial({ color: drink.color })
    const labelMat = new THREE.MeshLambertMaterial({ color: drink.labelColor })
    const capMat   = new THREE.MeshLambertMaterial({ color: 0xcccccc })
    const prop = new THREE.Group(); prop.name = 'drinkProp'
    prop.add(box(0.13, 0.22, 0.13, canMat,   0,     0,     0))
    prop.add(box(0.14, 0.09, 0.14, labelMat, 0,     0.02,  0))
    prop.add(box(0.10, 0.03, 0.10, capMat,   0,     0.125, 0))
    prop.add(box(0.10, 0.03, 0.10, capMat,   0,    -0.125, 0))
    prop.position.set(0, -0.18, 0.08)
    handR.add(prop)
  }

  function setPosition(x: number, z: number, level: number) {
    state.x = x; state.z = z; state.level = level
    state.target = null
  }

  return {
    get group() { return group },
    shadow, state,
    setAvatar, getAvatarCode, rebuild, update, attachDrink, setPosition,
    setGetFloorY:  fn => { _getFloorY = fn },
    setIsBlocked:  fn => { _isBlocked = fn },
    setFindRoller: fn => { _findRoller = fn },
    setGetStairs:  fn => { _getStairs = fn },
    setSeats:      s  => { _seats = s },
    setSipCallback: fn => { _onSip = fn },
  }
}
