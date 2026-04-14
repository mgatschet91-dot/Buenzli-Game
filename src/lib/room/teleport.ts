/**
 * teleport.ts — Wardrobe-Teleporter + Portal-Pads
 *
 * Verwaltet WARDROBES (Kleiderschrank-Teleporter) und TELEPORT_ZONES (Portal-Pads).
 */
import { THREE } from './three-shim'
import { box, makeMat } from './materials'

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface WardrobeObj {
  group:      THREE.Group
  mat:        THREE.MeshLambertMaterial
  doorPivot:  THREE.Group
  wx:         number; wz: number; facingY: number; lvl: number
  entranceX:  number; entranceZ: number
  doorAngle:  number; doorTarget: number
  sparkling:  boolean; sparkleT: number
  partner:    WardrobeObj | null
}

export interface TeleportZone {
  uuid: string
  wx:   number
  wz:   number
}

export interface TeleportState {
  phase:  'walking_to' | 'entering_door' | 'entering_walk' | 'sparkling' | 'exiting'
  from:   WardrobeObj
  to:     WardrobeObj
  timer:  number
}

export interface TeleportSystem {
  buildWardrobe:    (wx: number, wz: number, facingY: number, lvl: number) => WardrobeObj
  addTeleportZone:  (uuid: string, wx: number, wz: number) => void
  removeTeleportZone: (uuid: string) => void
  startTeleport:    (w: WardrobeObj) => void
  update:           (dt: number, charX: number, charZ: number, charLevel: number,
                     onTeleported: (toW: WardrobeObj) => void) => TeleportState | null
  updateAnimations: (dt: number) => void
  checkPortalPads:  (dt: number, charX: number, charZ: number,
                     onTeleport: (destX: number, destZ: number) => void) => void
  removeWardrobe:   (obj: WardrobeObj) => void
  clearAll:         () => void
  getWardrobes:     () => readonly WardrobeObj[]
  getState:         () => TeleportState | null
  /** Used by collision system to allow pass-through while walking in/out */
  isTeleportPassthrough: (ref: unknown) => boolean
}

export function createTeleport(
  scene: THREE.Scene,
  addSolid: (x0: number, x1: number, z0: number, z1: number, level: number, ref: unknown) => void,
  removeSolidByRef: (ref: unknown) => void
): TeleportSystem {
  const wardrobes: WardrobeObj[] = []
  const zones:     TeleportZone[]   = []
  let tp:          TeleportState | null = null
  let _teleportTimer = 0

  // ─── Wardrobe Builder ──────────────────────────────────────────────────────

  function buildWardrobe(wx: number, wz: number, facingY = 0, lvl = 0): WardrobeObj {
    const g     = new THREE.Group()
    const darkW = makeMat(0x3a1e06)
    const mainW = new THREE.MeshLambertMaterial({ color: 0x7a5030 })

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.20, 2.00, 0.60), mainW)
    bodyMesh.position.set(0, 1.00, 0); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true
    g.add(bodyMesh)
    g.add(box(1.22, 0.10, 0.62, darkW, 0, 2.06, 0))
    g.add(box(1.22, 0.08, 0.62, darkW, 0, 0.04, 0))
    g.add(box(0.05, 2.00, 0.62, darkW, -0.61, 1.00, 0))
    g.add(box(0.05, 2.00, 0.62, darkW,  0.61, 1.00, 0))

    const doorPivot = new THREE.Group()
    doorPivot.position.set(-0.60, 0, 0.30)
    g.add(doorPivot)
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.94, 0.06), mainW)
    doorMesh.position.set(0.59, 1.00, 0.03); doorMesh.castShadow = true; doorMesh.receiveShadow = true
    doorPivot.add(doorMesh)
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), makeMat(0xd4a020))
    handle.position.set(1.10, 0.95, 0.08)
    doorPivot.add(handle)

    g.position.set(wx, lvl > 0 ? 0 : 0, wz)  // floor-Y handled by engine via _lvlBase
    g.rotation.y = facingY
    g.traverse((m: THREE.Object3D) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = true } })
    scene.add(g)

    const fwd = new THREE.Vector3(0, 0, 0.95).applyEuler(new THREE.Euler(0, facingY, 0))
    const wObj: WardrobeObj = {
      group: g, mat: mainW, doorPivot,
      wx, wz, facingY, lvl,
      entranceX: wx + fwd.x, entranceZ: wz + fwd.z,
      doorAngle: 0, doorTarget: 0,
      sparkling: false, sparkleT: 0,
      partner: null,
    }
    wardrobes.push(wObj)
    addSolid(wx - 0.62, wx + 0.62, wz - 0.32, wz + 0.32, lvl, wObj)
    return wObj
  }

  // ─── Portal Pads ──────────────────────────────────────────────────────────

  function addTeleportZone(uuid: string, wx: number, wz: number) {
    zones.push({ uuid, wx, wz })
  }

  function removeTeleportZone(uuid: string) {
    const idx = zones.findIndex(z => z.uuid === uuid)
    if (idx >= 0) zones.splice(idx, 1)
  }

  // ─── Teleport State Machine ───────────────────────────────────────────────

  function startTeleport(w: WardrobeObj) {
    if (tp || !w.partner) return
    tp = { phase: 'walking_to', from: w, to: w.partner, timer: 0 }
  }

  function update(
    dt: number,
    charX: number, charZ: number, charLevel: number,
    onTeleported: (toW: WardrobeObj) => void
  ): TeleportState | null {
    if (!tp) return null
    tp.timer += dt

    if (tp.phase === 'walking_to') {
      const dx = charX - tp.from.entranceX, dz = charZ - tp.from.entranceZ
      if (Math.sqrt(dx*dx + dz*dz) < 0.3 || tp.timer > 3.0) {
        tp.phase = 'entering_door'; tp.timer = 0
        tp.from.doorTarget = Math.PI / 2
      }
    } else if (tp.phase === 'entering_door') {
      if (tp.timer > 0.5) { tp.phase = 'entering_walk'; tp.timer = 0 }
    } else if (tp.phase === 'entering_walk') {
      const dx = charX - tp.from.wx, dz = charZ - tp.from.wz
      if (Math.sqrt(dx*dx + dz*dz) < 0.3 || tp.timer > 1.5) {
        tp.from.doorTarget = 0
        tp.to.sparkling = true; tp.to.sparkleT = 0
        tp.to.doorTarget = Math.PI / 2
        tp.phase = 'sparkling'; tp.timer = 0
      }
    } else if (tp.phase === 'sparkling') {
      if (tp.timer > 1.0) {
        tp.to.sparkling = false
        onTeleported(tp.to)
        tp.phase = 'exiting'; tp.timer = 0
      }
    } else if (tp.phase === 'exiting') {
      const dx = charX - tp.to.entranceX, dz = charZ - tp.to.entranceZ
      if (Math.sqrt(dx*dx + dz*dz) < 0.3 || tp.timer > 1.5) {
        tp.to.doorTarget = 0; tp = null
      }
    }
    return tp
  }

  function updateAnimations(dt: number) {
    for (const w of wardrobes) {
      w.doorAngle += (w.doorTarget - w.doorAngle) * Math.min(1, dt * 6)
      w.doorPivot.rotation.y = w.doorAngle
      if (w.sparkling) {
        w.sparkleT += dt
        const on = Math.sin(w.sparkleT * 30) > 0
        w.mat.emissive.setHex(0xffee44)
        w.mat.emissiveIntensity = on ? 0.95 : 0.05
      } else if (w.mat.emissiveIntensity > 0.005) {
        w.mat.emissiveIntensity *= 0.82
      } else {
        w.mat.emissiveIntensity = 0
      }
    }
  }

  function checkPortalPads(
    dt: number,
    charX: number, charZ: number,
    onTeleport: (destX: number, destZ: number) => void
  ) {
    if (_teleportTimer > 0) { _teleportTimer -= dt; return }
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]
      const dx = charX - zone.wx, dz = charZ - zone.wz
      if (dx * dx + dz * dz > 0.36) continue
      const pairIdx = i % 2 === 0 ? i + 1 : i - 1
      if (pairIdx < 0 || pairIdx >= zones.length) break
      const dest = zones[pairIdx]
      onTeleport(dest.wx, dest.wz)
      _teleportTimer = 1.5
      break
    }
  }

  function removeWardrobe(obj: WardrobeObj) {
    const idx = wardrobes.indexOf(obj)
    if (idx >= 0) {
      wardrobes.splice(idx, 1)
      removeSolidByRef(obj)
      scene.remove(obj.group)
    }
  }

  function clearAll() {
    for (const w of wardrobes) { removeSolidByRef(w); scene.remove(w.group) }
    wardrobes.length = 0; zones.length = 0; tp = null
  }

  function isTeleportPassthrough(ref: unknown): boolean {
    if (!tp) return false
    if (ref === tp.from && tp.phase === 'entering_walk') return true
    if (ref === tp.to   && tp.phase === 'exiting')       return true
    return false
  }

  return {
    buildWardrobe, addTeleportZone, removeTeleportZone,
    startTeleport, update, updateAnimations, checkPortalPads,
    removeWardrobe, clearAll,
    getWardrobes: () => wardrobes,
    getState: () => tp,
    isTeleportPassthrough,
  }
}
