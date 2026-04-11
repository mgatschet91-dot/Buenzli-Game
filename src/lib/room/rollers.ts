/**
 * rollers.ts — Roller-Belt Tiles (buildGameRoller, findRollerAt, updateRollers)
 */
import { THREE } from './three-shim'
import { box } from './materials'

export interface RollerEntry {
  cx:        number
  cz:        number
  dir:       string
  beltSlats: THREE.Mesh[]
  group:     THREE.Group
}

export interface RollerSystem {
  build:       (cx: number, cz: number, dir: string, floorY?: number) => THREE.Group
  findAt:      (x: number, z: number, radius?: number) => RollerEntry | null
  update:      (dt: number) => void
  removeGroup: (group: THREE.Group) => void
  clearAll:    () => void
  getRollers:  () => readonly RollerEntry[]
}

export const ROLLER_H = 0.22

export function createRollers(scene: THREE.Scene): RollerSystem {
  const rollers: RollerEntry[] = []
  const beltMeshes: THREE.Mesh[] = []

  function build(cx: number, cz: number, dir: string, floorY = 0): THREE.Group {
    const baseY = floorY + 0.06
    const BH    = ROLLER_H
    const TW    = 0.92
    const halfT = TW / 2
    const topY  = baseY + BH
    const isNS  = dir === 'N' || dir === 'S'

    const g = new THREE.Group()

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(TW, BH, TW),
      new THREE.MeshLambertMaterial({ color: 0x1e1e1e })
    )
    body.position.set(cx, baseY + BH / 2, cz)
    g.add(body)

    // Red rails
    const RH = BH * 0.55, RT = 0.055
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(isNS ? TW + 0.04 : RT, RH, isNS ? RT : TW + 0.04),
        new THREE.MeshLambertMaterial({ color: 0xcc1818 })
      )
      rim.position.set(
        cx + (isNS ? 0 : side * (halfT + RT / 2)),
        baseY + BH * 0.5,
        cz + (isNS ? side * (halfT + RT / 2) : 0)
      )
      g.add(rim)
    }

    // Belt slats (animated, clipped to roller bounds)
    const clippingPlanes = [
      new THREE.Plane(new THREE.Vector3( 1, 0, 0), -(cx - halfT)),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0),   cx + halfT),
      new THREE.Plane(new THREE.Vector3( 0, 0, 1), -(cz - halfT)),
      new THREE.Plane(new THREE.Vector3( 0, 0,-1),   cz + halfT),
    ]
    const beltMat = new THREE.MeshLambertMaterial({ color: 0x111111, clippingPlanes })
    const beltSlats: THREE.Mesh[] = []
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * TW - halfT
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(isNS ? TW * 0.80 : 0.055, 0.018, isNS ? 0.055 : TW * 0.80),
        beltMat
      )
      slat.position.set(cx + (isNS ? 0 : t), topY + 0.003, cz + (isNS ? t : 0))
      slat.userData = { beltDir: dir, cx, cz, halfT, speed: 0.7 }
      g.add(slat)
      beltSlats.push(slat)
      beltMeshes.push(slat)
    }

    // Arrow
    const arrowGroup = new THREE.Group()
    arrowGroup.position.set(cx, topY + 0.022, cz)
    const arrowMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.26, 3),
      new THREE.MeshLambertMaterial({ color: 0xddcc00 })
    )
    arrowMesh.rotation.x = Math.PI / 2
    arrowGroup.add(arrowMesh)
    arrowGroup.rotation.y = ({ N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 } as Record<string, number>)[dir] ?? 0
    g.add(arrowGroup)

    scene.add(g)
    rollers.push({ cx, cz, dir, beltSlats, group: g })
    return g
  }

  function findAt(x: number, z: number, radius = 0.52): RollerEntry | null {
    let best: RollerEntry | null = null, bestD = radius
    for (const rol of rollers) {
      const d = Math.hypot(x - rol.cx, z - rol.cz)
      if (d < bestD) { bestD = d; best = rol }
    }
    return best
  }

  function update(dt: number) {
    for (const slat of beltMeshes) {
      const { beltDir, cx, cz, halfT, speed } = slat.userData as { beltDir: string; cx: number; cz: number; halfT: number; speed: number }
      const dist = speed * dt
      if      (beltDir === 'N') { slat.position.z -= dist; if (slat.position.z < cz - halfT) slat.position.z += halfT * 2 }
      else if (beltDir === 'S') { slat.position.z += dist; if (slat.position.z > cz + halfT) slat.position.z -= halfT * 2 }
      else if (beltDir === 'E') { slat.position.x += dist; if (slat.position.x > cx + halfT) slat.position.x -= halfT * 2 }
      else if (beltDir === 'W') { slat.position.x -= dist; if (slat.position.x < cx - halfT) slat.position.x += halfT * 2 }
    }
  }

  function removeGroup(group: THREE.Group) {
    const idx = rollers.findIndex(r => r.group === group)
    if (idx < 0) return
    const roller = rollers[idx]
    for (const slat of roller.beltSlats) {
      const bi = beltMeshes.indexOf(slat)
      if (bi >= 0) beltMeshes.splice(bi, 1)
    }
    rollers.splice(idx, 1)
    scene.remove(group)
  }

  function clearAll() {
    for (const r of rollers) scene.remove(r.group)
    rollers.length = 0
    beltMeshes.length = 0
  }

  return { build, findAt, update, removeGroup, clearAll, getRollers: () => rollers }
}
