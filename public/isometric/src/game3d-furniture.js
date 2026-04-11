// ─── game3d-furniture.js ── All furniture/item builders + catalog ──
// Depends on: game3d-core.js (_lvlBase, makeMat, box, scene, addSolid, SEATS, FRIDGES, FACING_DIRS, FACING_Y, etc.)

// ─── Basic Furniture Builders ─────────────────────────────────────────────────

function buildTable(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood  = makeMat(0x9b6b3a)
  const woodD = makeMat(0x6b4423)
  g.add(box(1.20, 0.09, 0.80, wood,  0, 0.75, 0))   // tabletop
  for (const [lx, lz] of [[-0.50,-0.32],[0.50,-0.32],[-0.50,0.32],[0.50,0.32]]) {
    g.add(box(0.09, 0.72, 0.09, woodD, lx, 0.36, lz))
  }
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

function buildChair(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood  = makeMat(0x9b6b3a)
  const woodD = makeMat(0x6b4423)
  const cush  = makeMat(0xb03020)
  g.add(box(0.58, 0.07, 0.58, wood,  0, 0.42, 0))   // seat board
  g.add(box(0.52, 0.06, 0.52, cush,  0, 0.47, 0))   // cushion
  g.add(box(0.58, 0.48, 0.08, wood,  0, 0.70,-0.25)) // back rest
  for (const [lx, lz] of [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]]) {
    g.add(box(0.08, 0.44, 0.08, woodD, lx, 0.22, lz))
  }
  g.add(box(0.08, 0.92, 0.08, woodD, -0.22, 0.46, -0.22))
  g.add(box(0.08, 0.92, 0.08, woodD,  0.22, 0.46, -0.22))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  SEATS.push({ x: wx, z: wz, facingY, level: lvl })
  return g
}

function buildWardrobeTeleport(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g     = new THREE.Group()
  const darkW = makeMat(0x3a1e06)
  // Per-instance material so sparkle only affects this wardrobe
  const mainW = new THREE.MeshLambertMaterial({ color: 0x7a5030 })

  // Body
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.20, 2.00, 0.60), mainW)
  bodyMesh.position.set(0, 1.00, 0)
  bodyMesh.castShadow = true
  bodyMesh.receiveShadow = true
  g.add(bodyMesh)
  // Dark trim edges
  g.add(box(1.22, 0.10, 0.62, darkW, 0, 2.06, 0))    // top cap
  g.add(box(1.22, 0.08, 0.62, darkW, 0, 0.04, 0))    // bottom trim
  g.add(box(0.05, 2.00, 0.62, darkW, -0.61, 1.00, 0)) // left edge
  g.add(box(0.05, 2.00, 0.62, darkW,  0.61, 1.00, 0)) // right edge

  // Door pivot — hinge at left edge of front face (local x=-0.6, z=+0.3)
  const doorPivot = new THREE.Group()
  doorPivot.position.set(-0.60, 0, 0.30)
  g.add(doorPivot)
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.94, 0.06), mainW)
  doorMesh.position.set(0.59, 1.00, 0.03)
  doorMesh.castShadow = true
  doorMesh.receiveShadow = true
  doorPivot.add(doorMesh)
  // Handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), makeMat(0xd4a020))
  handle.position.set(1.10, 0.95, 0.08)
  doorPivot.add(handle)

  g.position.set(wx, baseY, wz)
  g.rotation.y = facingY
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g)

  // Entrance: 0.95 units forward (in wardrobe's local +Z → world)
  const fwd = new THREE.Vector3(0, 0, 0.95).applyEuler(new THREE.Euler(0, facingY, 0))

  const wObj = {
    group: g, mat: mainW, doorPivot,
    wx, wz, facingY, lvl,
    entranceX: wx + fwd.x, entranceZ: wz + fwd.z,
    doorAngle: 0, doorTarget: 0,
    sparkling: false, sparkleT: 0,
    partner: null
  }
  WARDROBES.push(wObj)
  // Register collision AABB (body only, facingY=0 assumed; door swings away)
  addSolid(wx - 0.62, wx + 0.62, wz - 0.32, wz + 0.32, lvl, wObj)
  return wObj
}

// ─── Roller Tiles ─────────────────────────────────────────────────────────────
var GAME_ROLLERS = []  // { cx, cz, dir, beltMeshes }  — var so all scripts share same array via window
var ROLLER_BELT_MESHES = []  // all belt slats for animation — var so all scripts share same array via window
var JACUZZI_OBJECTS = []  // { wx, wz, bubbles[], group } — for bubble animation

const ROLLER_H = 0.22   // roller body height — character stands ON TOP

function buildGameRoller(cx, cz, dir, floorY = 0) {
  const baseY = floorY + 0.06
  const BH    = ROLLER_H
  const TW    = 0.92
  const halfT = TW / 2
  const topY  = baseY + BH
  const isNS  = dir === 'N' || dir === 'S'

  const makeMR = c => new THREE.MeshLambertMaterial({ color: c })

  // Single group — makes deletion easy
  const g = new THREE.Group()

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(TW, BH, TW), makeMR(0x1e1e1e))
  body.position.set(cx, baseY + BH / 2, cz)
  g.add(body)

  // Red rails
  const RH = BH * 0.55, RT = 0.055
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(isNS ? TW + 0.04 : RT, RH, isNS ? RT : TW + 0.04),
      makeMR(0xcc1818)
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
  const beltSlats = []
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * TW - halfT
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(isNS ? TW * 0.80 : 0.055, 0.018, isNS ? 0.055 : TW * 0.80),
      beltMat
    )
    slat.position.set(cx + (isNS ? 0 : t), topY + 0.003, cz + (isNS ? t : 0))
    // slatOffset = Startabstand im Belt-Zyklus (gleichmässig verteilt, 0..2*halfT)
    slat.userData = { beltDir: dir, cx, cz, halfT, speed: 0.7, slatOffset: (i / 4) * halfT * 2 }
    g.add(slat)
    beltSlats.push(slat)
    ROLLER_BELT_MESHES.push(slat)
  }

  // Yellow arrow
  const arrowGroup = new THREE.Group()
  arrowGroup.position.set(cx, topY + 0.022, cz)
  const arrowMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 3),
    new THREE.MeshLambertMaterial({ color: 0xddcc00 }))
  arrowMesh.rotation.x = Math.PI / 2
  arrowGroup.add(arrowMesh)
  arrowGroup.rotation.y = { N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 }[dir]
  g.add(arrowGroup)

  scene.add(g)
  GAME_ROLLERS.push({ cx, cz, dir, beltSlats, group: g })
  return g
}

// Test roller removed — room starts empty; player places items themselves

// ── Nearest-roller lookup (shared by character + placed-object movement) ─────
function findRollerAt(x, z, radius = 0.52) {
  let best = null, bestD = radius
  for (const rol of GAME_ROLLERS) {
    const d = Math.hypot(x - rol.cx, z - rol.cz)
    if (d < bestD) { bestD = d; best = rol }
  }
  return best
}

// ─── Additional placeable builders ────────────────────────────────────────────
function buildLamp(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.12, 1.50, 0.12, makeMat(0x999999), 0, 0.75, 0))   // pole
  g.add(box(0.08, 0.08, 0.08, makeMat(0x777777), 0, 0.06, 0))   // base weight
  const shadeMat = new THREE.MeshLambertMaterial({ color: 0xffe87c, emissive: 0xffe87c, emissiveIntensity: 0.75 })
  const shade = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.44), shadeMat)
  shade.position.set(0, 1.60, 0)
  g.add(shade)
  // Point-Light für Umgebungsbeleuchtung
  const light = new THREE.PointLight(0xffe87c, 1.2, 6)
  light.position.set(0, 1.60, 0)
  g.add(light)
  // Toggle-State auf der Group speichern
  g.userData._lampOn = true
  g.userData._shadeMat = shadeMat
  g.userData._light = light
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.22, wx + 0.22, wz - 0.22, wz + 0.22, lvl)
  return g
}

function toggleLamp(obj) {
  const g = obj.group
  if (!g) return
  const on = !g.userData._lampOn
  g.userData._lampOn = on
  if (g.userData._shadeMat) {
    g.userData._shadeMat.emissiveIntensity = on ? 0.75 : 0
    g.userData._shadeMat.color.setHex(on ? 0xffe87c : 0x666655)
  }
  if (g.userData._light) {
    g.userData._light.intensity = on ? 1.2 : 0
  }
}

function buildPlant(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.38, 0.32, 0.38, makeMat(0x7a5030), 0, 0.16, 0)) // pot
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.70, 6), makeMat(0x2d6e2d))
  c1.position.set(0, 0.67, 0); g.add(c1)
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 6), makeMat(0x3a8a3a))
  c2.position.set(0, 0.92, 0); g.add(c2)
  const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.40, 6), makeMat(0x44a044))
  c3.position.set(0, 1.12, 0); g.add(c3)
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.22, wx + 0.22, wz - 0.22, wz + 0.22, lvl)
  return g
}

function buildSofa(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const fab  = makeMat(0x3a5fa8)
  const fabD = makeMat(0x2a4f98)
  const legM = makeMat(0x5a3510)
  g.add(box(2.20, 0.12, 0.85, fabD, 0, 0.18, 0))           // seat base
  g.add(box(2.20, 0.16, 0.80, fab,  0, 0.36, 0))           // seat cushion
  g.add(box(2.20, 0.72, 0.16, fabD, 0, 0.54, -0.35))       // backrest
  g.add(box(0.16, 0.62, 0.85, fabD, -1.02, 0.43, 0))       // left arm
  g.add(box(0.16, 0.62, 0.85, fabD,  1.02, 0.43, 0))       // right arm
  // Kissen-Naht in der Mitte
  g.add(box(0.04, 0.17, 0.70, fabD, 0, 0.37, 0.02))
  for (const [lx,lz] of [[-0.90,-0.32],[0.90,-0.32],[-0.90,0.32],[0.90,0.32]]) {
    g.add(box(0.08, 0.18, 0.08, legM, lx, 0.09, lz))
  }
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  // 2 Sitzplätze: links + rechts (±0.50 entlang der Sofa-Breite)
  const cos = Math.cos(facingY), sin = Math.sin(facingY)
  for (const offset of [-0.50, 0.50]) {
    const sx = wx + offset * cos
    const sz = wz + offset * (-sin)
    SEATS.push({ x: sx, z: sz, facingY, level: lvl })
  }
  const hw = 1.12, hd = 0.46
  addSolid(wx - (hw*Math.abs(cos)+hd*Math.abs(sin)), wx + (hw*Math.abs(cos)+hd*Math.abs(sin)),
           wz - (hw*Math.abs(sin)+hd*Math.abs(cos)), wz + (hw*Math.abs(sin)+hd*Math.abs(cos)), lvl)
  return g
}

// ─── Additional furniture builders ────────────────────────────────────────────

function buildArmchair(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const fab = makeMat(0x8b4513), fabD = makeMat(0x6b3010), legM = makeMat(0x4a2a08)
  g.add(box(0.80, 0.12, 0.70, fabD, 0, 0.22, 0))
  g.add(box(0.80, 0.14, 0.65, fab,  0, 0.38, 0))
  g.add(box(0.80, 0.62, 0.13, fabD, 0, 0.58, -0.27))
  g.add(box(0.13, 0.52, 0.70, fabD, -0.33, 0.45, 0))
  g.add(box(0.13, 0.52, 0.70, fabD,  0.33, 0.45, 0))
  for (const [lx,lz] of [[-0.30,-0.26],[0.30,-0.26],[-0.30,0.26],[0.30,0.26]])
    g.add(box(0.08, 0.20, 0.08, legM, lx, 0.10, lz))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  SEATS.push({ x: wx, z: wz, facingY, level: lvl })
  addSolid(wx - 0.42, wx + 0.42, wz - 0.37, wz + 0.37, lvl)
  return g
}

function buildBookshelf(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x8b5e3c), woodD = makeMat(0x5c3a20)
  g.add(box(0.85, 1.75, 0.28, woodD, 0, 0.875, 0))
  g.add(box(0.07, 1.75, 0.30, woodD, -0.39, 0.875, 0))
  g.add(box(0.07, 1.75, 0.30, woodD,  0.39, 0.875, 0))
  g.add(box(0.85, 0.07, 0.30, wood, 0, 0.06, 0))
  g.add(box(0.85, 0.07, 0.30, wood, 0, 0.58, 0))
  g.add(box(0.85, 0.07, 0.30, wood, 0, 1.10, 0))
  g.add(box(0.85, 0.07, 0.30, wood, 0, 1.63, 0))
  const bc = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xe67e22]
  for (let sh = 0; sh < 3; sh++)
    for (let b = 0; b < 3; b++)
      g.add(box(0.19, 0.28, 0.22, makeMat(bc[(sh*3+b)%6]), -0.25+b*0.25, 0.28+sh*0.52, 0.01))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.44, wx + 0.44, wz - 0.16, wz + 0.16, lvl)
  return g
}

function buildTV(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.10, 0.96, 0.10, makeMat(0x222233), 0, 0.48, 0))
  g.add(box(0.32, 0.09, 0.32, makeMat(0x222233), 0, 0.05, 0))
  g.add(box(0.09, 0.68, 1.10, makeMat(0x111122), 0, 1.05, 0))
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.96),
    new THREE.MeshLambertMaterial({ color: 0x1a3a6e, emissive: 0x0a1535, emissiveIntensity: 0.6 }))
  scr.position.set(0.02, 1.05, 0); g.add(scr)
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.20, wx + 0.20, wz - 0.60, wz + 0.60, lvl)
  return g
}

function buildDresser(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423), hndl = makeMat(0xd4a020)
  g.add(box(1.10, 0.80, 0.52, wood, 0, 0.40, 0))
  g.add(box(1.14, 0.06, 0.54, woodD, 0, 0.83, 0))
  g.add(box(1.10, 0.04, 0.04, woodD, 0, 0.20, 0.26))
  g.add(box(1.10, 0.04, 0.04, woodD, 0, 0.58, 0.26))
  for (const [hy, hx] of [[0.10,-0.25],[0.10,0.25],[0.48,-0.25],[0.48,0.25]])
    g.add(box(0.12, 0.06, 0.08, hndl, hx, hy, 0.27))
  for (const [lx,lz] of [[-0.46,-0.20],[0.46,-0.20],[-0.46,0.20],[0.46,0.20]])
    g.add(box(0.08, 0.08, 0.08, woodD, lx, 0.04, lz))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.57, wx + 0.57, wz - 0.28, wz + 0.28, lvl)
  return g
}

function buildBedPlaceable(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const frm = makeMat(0x7a5030), matt = makeMat(0xf0ece0), pil = makeMat(0xffffff), bln = makeMat(0x3a7bd5)
  g.add(box(1.30, 0.24, 2.20, frm,  0, 0.12, 0))
  g.add(box(1.20, 0.16, 1.60, matt, 0, 0.30, 0.25))
  g.add(box(1.20, 0.16, 0.70, bln,  0, 0.30, -0.48))
  g.add(box(0.40, 0.14, 0.28, pil, -0.30, 0.36, 0.82))
  g.add(box(0.40, 0.14, 0.28, pil,  0.30, 0.36, 0.82))
  g.add(box(1.30, 0.58, 0.16, frm,  0, 0.45, 1.10))
  g.add(box(1.30, 0.28, 0.12, frm,  0, 0.26, -1.12))
  for (const [lx,lz] of [[-0.56,-0.96],[0.56,-0.96],[-0.56,0.96],[0.56,0.96]])
    g.add(box(0.12, 0.24, 0.12, frm, lx, 0.12, lz))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.68, wx + 0.68, wz - 1.14, wz + 1.14, lvl)
  return g
}

function buildDiscoball(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
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
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

function buildDJDesk(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const dark = makeMat(0x1a1a2e), med = makeMat(0x2a2a3e), acc = makeMat(0xff4500)
  g.add(box(1.50, 0.80, 0.80, med, 0, 0.40, 0))
  g.add(box(1.50, 0.08, 0.80, dark, 0, 0.84, 0))
  g.add(box(1.46, 0.06, 0.76, makeMat(0x333344), 0, 0.80, 0))
  g.add(box(0.40, 0.04, 0.60, makeMat(0x111118), 0, 0.85, 0))
  for (let i = -1; i <= 1; i++)
    g.add(box(0.06, 0.06, 0.06, acc, i*0.30, 0.90, 0))
  for (const [lx,lz] of [[-0.68,-0.32],[0.68,-0.32],[-0.68,0.32],[0.68,0.32]])
    g.add(box(0.08, 0.80, 0.08, dark, lx, 0.40, lz))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.77, wx + 0.77, wz - 0.42, wz + 0.42, lvl)
  return g
}

function buildBalloon(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const cols = [0xff4444, 0x44aaff, 0xff9922, 0xaa44ff, 0x44ff88]
  for (let i = 0; i < 3; i++) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8),
      new THREE.MeshLambertMaterial({ color: cols[i%cols.length] }))
    ball.position.set(-0.18+i*0.18, 1.60+Math.sin(i*1.2)*0.10, Math.cos(i*1.2)*0.08)
    g.add(ball)
    g.add(box(0.015, 1.60, 0.015, makeMat(0x888888), -0.18+i*0.18, 0.80, 0))
  }
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

function buildPartyFlag(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.06, 1.80, 0.06, makeMat(0x8b5e3c), -0.55, 0.90, 0))
  g.add(box(0.06, 1.80, 0.06, makeMat(0x8b5e3c),  0.55, 0.90, 0))
  g.add(box(1.12, 0.015, 0.015, makeMat(0x555555), 0, 1.80, 0))
  const fc = [0xff4444,0xffff44,0x44ff44,0x44aaff,0xff44ff]
  for (let i = 0; i < 5; i++) {
    g.add(box(0.14, 0.18, 0.04, makeMat(fc[i%5]), -0.44+i*0.22, 1.68, 0))
  }
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

function buildNeon(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(1.20, 0.55, 0.08, makeMat(0x111122), 0, 0.80, 0))
  const nc = [0xff00ff, 0x00ffff, 0xff4400]
  for (let i = 0; i < 3; i++) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.07, 0.06),
      new THREE.MeshLambertMaterial({ color: nc[i], emissive: nc[i], emissiveIntensity: 1.0 }))
    tube.position.set(0, 0.62+i*0.16, 0.05); g.add(tube)
  }
  g.add(box(0.06, 0.54, 0.06, makeMat(0x444455), 0, 0.27, 0))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

// ── Raycast against actual wall meshes ─────────────────────────────────────────
// Returns { wx, wz, wy, facingIdx, wallCoord, wallEdge } or null.
const _frameRc = new THREE.Raycaster()
const _frameMv = new THREE.Vector2()

function getFrameWallHit(clientX, clientY) {
  _frameMv.x =  (clientX / window.innerWidth)  * 2 - 1
  _frameMv.y = -(clientY / window.innerHeight) * 2 + 1
  camera.updateMatrixWorld()
  _frameRc.setFromCamera(_frameMv, camera)

  const hits = _frameRc.intersectObjects(WALL_MESHES)
  if (!hits.length) return null

  const h = hits[0]
  const ud = h.object.userData
  const edge = ud.wallEdge       // 'N','S','E','W'
  const wallCoord = ud.wallCoord // actual coordinate of wall center
  const flY = ud.wallFloorY ?? 0

  // facingIdx: Frame faces INTO the room (opposite of wall edge)
  // N-wall → frame faces S (idx 2), S-wall → faces N (idx 0), W-wall → faces E (idx 1), E-wall → faces W (idx 3)
  const EDGE_TO_FACING = { N: 2, S: 0, W: 1, E: 3 }
  const facingIdx = EDGE_TO_FACING[edge] ?? 2

  const horiz = edge === 'N' || edge === 'S'
  const wx = horiz ? h.point.x : wallCoord
  const wz = horiz ? wallCoord : h.point.z

  return { wx, wz, wy: h.point.y, facingIdx, wallCoord, wallEdge: edge, floorY: flY }
}

function buildFrame(wx, wz, frameColor = 0x8b4513, facingY = 0) {
  const WALL_TH = 0.22
  const FRAME_HALF_D = 0.03  // frame half-depth
  const g = new THREE.Group()

  // ── Wall-mounted flat frame ──────────────────────────────────────────────
  g.add(box(0.80, 0.72, 0.06, makeMat(frameColor), 0, 0, 0))      // frame border
  g.add(box(0.64, 0.56, 0.05, makeMat(0xf5f0e8),  0, 0, 0.02))    // canvas
  const artCol = frameColor === 0x2255aa ? 0xffaa22
               : frameColor === 0xcc2222 ? 0x2244cc
               : frameColor === 0xd4af37 ? 0x226644
               : 0xcc4488
  g.add(box(0.28, 0.28, 0.04, makeMat(artCol),  -0.10, 0.06, 0.04))
  g.add(box(0.20, 0.14, 0.04, makeMat(0x88bbff), 0.12,-0.12, 0.04))
  g.add(box(0.18, 0.10, 0.04, makeMat(artCol),   0.10, 0.18, 0.04))
  g.add(box(0.04, 0.06, 0.05, makeMat(0xaaaaaa), 0, 0.39, -0.02))  // nail

  const dirKey = Object.entries(FACING_Y).find(([,v]) => Math.abs(v - facingY) < 0.01)?.[0] ?? 'S'
  g.rotation.y = facingY

  // Position: flush against actual wall surface
  // wx/wz already hold the wall coordinate — offset by half wall thickness + frame half depth
  const off = WALL_TH / 2 + FRAME_HALF_D
  let fx = wx, fz = wz
  if (dirKey === 'S')      fz = wz + off      // N-wall: frame center slightly into room (+Z)
  else if (dirKey === 'N') fz = wz - off      // S-wall: frame center slightly into room (-Z)
  else if (dirKey === 'E') fx = wx + off      // W-wall: frame center slightly into room (+X)
  else if (dirKey === 'W') fx = wx - off      // E-wall: frame center slightly into room (-X)

  // Y: use click height if available, otherwise eye-level
  const fy = window._pendingFrameWy ?? (0.06 + 1.20)
  g.position.set(fx, fy, fz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}
function buildFrameBlue(wx, wz, facingY = 0) { return buildFrame(wx, wz, 0x2255aa, facingY) }
function buildFrameRed(wx, wz,  facingY = 0) { return buildFrame(wx, wz, 0xcc2222, facingY) }
function buildFrameGold(wx, wz, facingY = 0) { return buildFrame(wx, wz, 0xd4af37, facingY) }
function buildFrameDark(wx, wz, facingY = 0) { return buildFrame(wx, wz, 0x1a1a2e, facingY) }

function buildBarstool(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const metal = makeMat(0x888898), cush = makeMat(0x8b1a1a)
  g.add(box(0.44, 0.08, 0.44, metal, 0, 0.78, 0))
  g.add(box(0.40, 0.08, 0.40, cush,  0, 0.84, 0))
  g.add(box(0.08, 0.76, 0.08, metal, 0, 0.38, 0))
  g.add(box(0.60, 0.06, 0.10, metal, 0, 0.03, 0))
  g.add(box(0.10, 0.06, 0.60, metal, 0, 0.03, 0))
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  SEATS.push({ x: wx, z: wz, facingY: 0, level: lvl })
  return g
}

function buildOttoman(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  g.add(box(0.70, 0.30, 0.70, makeMat(0x8b6030), 0, 0.15, 0))
  g.add(box(0.72, 0.08, 0.72, makeMat(0x6b4818), 0, 0.04, 0))
  for (const [lx,lz] of [[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]])
    g.add(box(0.07, 0.08, 0.07, makeMat(0x4a2e0a), lx, 0.04, lz))
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  SEATS.push({ x: wx, z: wz, facingY: 0, level: lvl })
  return g
}

function buildBench(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423)
  g.add(box(1.50, 0.08, 0.42, wood, 0, 0.42, 0))
  g.add(box(1.50, 0.06, 0.38, makeMat(0xc4aa80), 0, 0.47, 0))
  for (const lx of [-0.60, 0.60])
    g.add(box(0.36, 0.42, 0.10, woodD, lx, 0.21, -0.16))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  SEATS.push({ x: wx, z: wz, facingY, level: lvl })
  return g
}

function buildStool(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x9b6b3a), woodD = makeMat(0x6b4423)
  g.add(box(0.46, 0.07, 0.46, wood,             0, 0.44, 0))
  g.add(box(0.44, 0.06, 0.44, makeMat(0xd2a070), 0, 0.49, 0))
  for (const [lx,lz] of [[-0.16,-0.16],[0.16,-0.16],[-0.16,0.16],[0.16,0.16]])
    g.add(box(0.07, 0.44, 0.07, woodD, lx, 0.22, lz))
  g.add(box(0.36, 0.05, 0.07, woodD, 0, 0.22, 0))
  g.add(box(0.07, 0.05, 0.36, woodD, 0, 0.22, 0))
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  SEATS.push({ x: wx, z: wz, facingY: 0, level: lvl })
  return g
}

function buildBarCounter(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x6b3a1e), woodD = makeMat(0x4a2a10), metal = makeMat(0x888888)
  g.add(box(1.80, 1.00, 0.65, wood,  0, 0.50, 0))
  g.add(box(1.86, 0.08, 0.70, woodD, 0, 1.04, 0))
  g.add(box(1.84, 0.06, 0.68, makeMat(0x9b6b3a), 0, 1.10, 0))
  g.add(box(1.80, 0.05, 0.06, metal, 0, 0.18, 0.28))
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.93, wx + 0.93, wz - 0.35, wz + 0.35, lvl)
  return g
}

function buildDrinksShelf(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const wood = makeMat(0x6b3a1e), woodD = makeMat(0x4a2a10)
  g.add(box(1.00, 1.60, 0.28, woodD, 0, 0.80, 0))
  g.add(box(0.07, 1.60, 0.28, woodD, -0.465, 0.80, 0))
  g.add(box(0.07, 1.60, 0.28, woodD,  0.465, 0.80, 0))
  g.add(box(1.00, 0.07, 0.28, wood, 0, 0.56, 0))
  g.add(box(1.00, 0.07, 0.28, wood, 0, 1.04, 0))
  g.add(box(1.00, 0.07, 0.28, wood, 0, 1.52, 0))
  const bc2 = [0x006600, 0x8b0000, 0x006699, 0xcc6600, 0x333300]
  for (let sh = 0; sh < 3; sh++)
    for (let b = 0; b < 4; b++) {
      g.add(box(0.09, 0.28, 0.09, makeMat(bc2[(sh*4+b)%5]), -0.32+b*0.22, 0.70+sh*0.48, 0.01))
      g.add(box(0.05, 0.06, 0.05, makeMat(0xbbbbbb), -0.32+b*0.22, 0.84+sh*0.48, 0.01))
    }
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.52, wx + 0.52, wz - 0.16, wz + 0.16, lvl)
  return g
}

function buildCocktailTable(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const metal = makeMat(0x888898)
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 })
  g.add(box(0.07, 0.90, 0.07, metal, 0, 0.45, 0))
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12), glassMat)
  top.position.set(0, 0.93, 0); g.add(top)
  g.add(box(0.65, 0.05, 0.10, metal, 0, 0.02, 0))
  g.add(box(0.10, 0.05, 0.65, metal, 0, 0.02, 0))
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

function buildFridge(wx, wz, facingY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const bodyM = makeMat(0xddddee), darkM = makeMat(0x888899), hndl = makeMat(0xaaaaaa)
  // Body (back + sides — front covered by door)
  g.add(box(0.82, 1.72, 0.58, bodyM, 0, 0.86, -0.02))
  g.add(box(0.84, 0.08, 0.64, darkM, 0, 1.74, 0))       // top trim
  g.add(box(0.04, 0.72, 0.60, darkM, 0.41, 0.86, -0.01)) // center divider
  g.add(box(0.84, 0.04, 0.58, darkM, 0, 0.44, -0.02))   // shelf line
  // Interior light visible when open (emissive blue-white panel)
  const intMat = new THREE.MeshLambertMaterial({ color: 0xbbddff, emissive: 0x88aaff, emissiveIntensity: 0.6 })
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.50, 0.02), intMat)).position.set(0, 0.86, -0.28)
  // Door pivot — hinge at left edge (local x = -0.41, z = 0.29)
  const doorPivot = new THREE.Group()
  doorPivot.position.set(-0.41, 0, 0.29)
  doorPivot.name = 'fridgeDoor'
  const doorM = new THREE.MeshLambertMaterial({ color: 0xe0e0f0 })
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.72, 0.06), doorM)
  doorMesh.position.set(0.41, 0.86, 0.03)
  doorMesh.castShadow = true
  doorPivot.add(doorMesh)
  // Handles on door
  doorPivot.add(box(0.06, 0.48, 0.06, hndl, 0.79, 0.80, 0.06))
  doorPivot.add(box(0.06, 0.28, 0.06, hndl, 0.79, 0.28, 0.06))
  g.add(doorPivot)
  g.rotation.y = facingY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  addSolid(wx - 0.43, wx + 0.43, wz - 0.33, wz + 0.33, lvl)
  // Entrance: 1.1 units in front of fridge face (+Z local)
  const fwd = new THREE.Vector3(0, 0, 1.1).applyEuler(new THREE.Euler(0, facingY, 0))
  const fObj = { group: g, doorPivot, doorAngle: 0, doorTarget: 0, isOpen: false,
                 x: wx, z: wz, facingY, lvl, entranceX: wx + fwd.x, entranceZ: wz + fwd.z }
  FRIDGES.push(fObj)
  return g
}

function buildBeertap(wx, wz) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const metal = makeMat(0x888898), dark = makeMat(0x333344), gold = makeMat(0xd4a020)
  g.add(box(0.38, 0.18, 0.38, dark,  0, 0.09, 0))
  g.add(box(0.10, 0.50, 0.10, metal, 0, 0.43, 0))
  g.add(box(0.08, 0.06, 0.38, metal, 0, 0.58, 0))
  g.add(box(0.07, 0.20, 0.07, gold,  0, 0.70, 0.16))
  g.add(box(0.04, 0.04, 0.06, metal, 0, 0.68, 0.20))
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true })
  scene.add(g)
  return g
}

// ─── Placeable Stair Builders ─────────────────────────────────────────────────
// All stairs: 4 steps, stepH=0.5, stepD=1.0 → rise=2.0, totalD=4.0
// Built in local space: entrance at local z=0, top at z=totalD, ascending along +Z.
// Rotated by facingY so they point in any of the 4 directions.
// After building, call addStairZone() with the group uuid to register the ramp.

const STAIR_STEPS = 4, STAIR_STEP_H = 0.5, STAIR_STEP_D = 1.0
const STAIR_RISE = STAIR_STEPS * STAIR_STEP_H   // 2.0
const STAIR_TOTAL_D = STAIR_STEPS * STAIR_STEP_D // 4.0
const STAIR_W = 0.92  // tread width (just under 1 tile)

// Wood stair — open risers, plank treads, diagonal stringers (like the image)
function buildStairWood(wx, wz, facY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const woodM  = makeMat(0xb08030)
  const woodD  = makeMat(0x7a5018)
  const railM  = makeMat(0x5a3010)
  const strLen = Math.sqrt(STAIR_TOTAL_D ** 2 + STAIR_RISE ** 2)
  const strAng = Math.atan2(STAIR_TOTAL_D, STAIR_RISE)  // tilt angle around X

  // Side stringers (the diagonal boards holding the steps)
  for (const sx of [-STAIR_W / 2, STAIR_W / 2]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.10, strLen, 0.16), woodD)
    stringer.position.set(sx, STAIR_RISE / 2, STAIR_TOTAL_D / 2)
    stringer.rotation.x = strAng
    stringer.castShadow = stringer.receiveShadow = true
    g.add(stringer)
  }

  // Treads (horizontal planks) — 3 planks per step for that lumber look
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i + 1) * STAIR_STEP_H
    const tz = (i + 0.5) * STAIR_STEP_D
    for (const ox of [-0.22, 0, 0.22]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W / 3 - 0.03, 0.07, STAIR_STEP_D - 0.06), woodM)
      plank.position.set(ox, ty - 0.035, tz)
      plank.castShadow = plank.receiveShadow = true
      g.add(plank)
    }
  }

  // Handrail posts + top rail (right side only, toward camera)
  for (let i = 0; i <= STAIR_STEPS; i++) {
    const py = i * STAIR_STEP_H, pz = i * STAIR_STEP_D
    g.add(box(0.08, 0.72, 0.08, railM, STAIR_W / 2, py + 0.36, pz))
  }
  const railLen = Math.sqrt(STAIR_TOTAL_D ** 2 + STAIR_RISE ** 2)
  const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, railLen, 0.06), railM)
  railBar.position.set(STAIR_W / 2, STAIR_RISE / 2 + 0.72, STAIR_TOTAL_D / 2)
  railBar.rotation.x = strAng
  g.add(railBar)

  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g); return g
}

// Stone stair — solid stacked blocks, chunky Habbo style
function buildStairStone(wx, wz, facY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const stoneM = makeMat(0x9a9288)
  const stoneD = makeMat(0x6e6660)
  const stoneL = makeMat(0xbab4ae)

  for (let i = 0; i < STAIR_STEPS; i++) {
    const bh = (i + 1) * STAIR_STEP_H   // cumulative block height
    const bz = (i + 0.5) * STAIR_STEP_D
    // Main step block
    g.add(box(STAIR_W, bh, STAIR_STEP_D - 0.04, stoneM, 0, bh / 2, bz))
    // Light top face highlight
    g.add(box(STAIR_W, 0.04, STAIR_STEP_D - 0.04, stoneL, 0, bh + 0.01, bz))
    // Dark front-face nosing
    g.add(box(STAIR_W, 0.06, 0.06, stoneD, 0, bh - 0.03, bz - STAIR_STEP_D / 2))
  }

  // Side cheeks (solid walls on both sides)
  const hw = STAIR_W / 2
  for (const sx of [-hw - 0.07, hw + 0.07]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.10, STAIR_RISE, STAIR_TOTAL_D), stoneD)
    cheek.position.set(sx, STAIR_RISE / 2, STAIR_TOTAL_D / 2)
    g.add(cheek)
    // Triangle fill beneath (the diagonal part of the cheek) - approximate with scaled box
    const triApprox = new THREE.Mesh(new THREE.BoxGeometry(0.10, STAIR_RISE, STAIR_TOTAL_D), stoneD)
    triApprox.position.set(sx, -STAIR_RISE / 4, STAIR_TOTAL_D / 2)
    triApprox.scale.y = 0.5
    g.add(triApprox)
  }

  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g); return g
}

// Metal / industrial stair — grate treads, angle-iron frame, safety yellow nosing
function buildStairMetal(wx, wz, facY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const metalM = makeMat(0x3a3a4a)
  const metalL = makeMat(0x5a5a6e)
  const safeY  = makeMat(0xddcc00)  // safety yellow
  const strLen = Math.sqrt(STAIR_TOTAL_D ** 2 + STAIR_RISE ** 2)
  const strAng = Math.atan2(STAIR_TOTAL_D, STAIR_RISE)

  // Angle-iron stringers
  for (const sx of [-STAIR_W / 2, STAIR_W / 2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.09, strLen, 0.09), metalM)
    str.position.set(sx, STAIR_RISE / 2, STAIR_TOTAL_D / 2)
    str.rotation.x = strAng
    g.add(str)
  }

  // Grate treads — horizontal metal plates with grid lines
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i + 1) * STAIR_STEP_H
    const tz = (i + 0.5) * STAIR_STEP_D
    // Main grate plate (thin)
    g.add(box(STAIR_W, 0.05, STAIR_STEP_D - 0.06, metalL, 0, ty - 0.025, tz))
    // Safety yellow nosing on front edge
    g.add(box(STAIR_W, 0.05, 0.06, safeY, 0, ty, tz - STAIR_STEP_D / 2 + 0.03))
    // Cross-bar under tread
    g.add(box(STAIR_W, 0.04, 0.06, metalM, 0, ty - 0.08, tz + STAIR_STEP_D / 2 - 0.06))
    // Two longitudinal bars under tread
    for (const ox of [-STAIR_W * 0.28, STAIR_W * 0.28]) {
      g.add(box(0.05, 0.07, STAIR_STEP_D - 0.08, metalM, ox, ty - 0.07, tz))
    }
  }

  // Vertical railings + top pipe
  for (const sx of [-STAIR_W / 2, STAIR_W / 2]) {
    for (let i = 0; i <= STAIR_STEPS; i++) {
      g.add(box(0.06, 0.80, 0.06, metalM, sx, i * STAIR_STEP_H + 0.40, i * STAIR_STEP_D))
    }
    const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), metalL)
    railBar.position.set(sx, STAIR_RISE / 2 + 0.82, STAIR_TOTAL_D / 2)
    railBar.rotation.x = strAng
    g.add(railBar)
  }

  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g); return g
}

// Spiral stair — centre pole + 8 wedge treads rotating 45° each, 1×1 footprint
function buildStairSpiral(wx, wz, facY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const poleM  = makeMat(0x5a3a18)  // dark wood pole
  const treadM = makeMat(0xb08030)  // golden wood treads
  const railM  = makeMat(0x7a5018)
  const SPIRAL_STEPS = 8
  const spiralRise = STAIR_RISE      // same 2.0 total height
  const stepH = spiralRise / SPIRAL_STEPS

  // Centre pole
  g.add(box(0.12, spiralRise + 0.30, 0.12, poleM, 0, spiralRise / 2 + 0.15, 0))

  for (let i = 0; i < SPIRAL_STEPS; i++) {
    const angle = (i / SPIRAL_STEPS) * Math.PI * 2   // full circle
    const treadY = (i + 0.5) * stepH

    // Wedge tread: a box rotated around Y
    const tread = new THREE.Group()
    tread.rotation.y = angle
    // The tread is 0.40 long, offset 0.20 from centre
    tread.add(box(0.22, 0.07, 0.42, treadM, 0.22, treadY, 0))
    g.add(tread)

    // Railing post at outer edge
    const postGrp = new THREE.Group()
    postGrp.rotation.y = angle
    postGrp.add(box(0.07, 0.70, 0.07, railM, 0.38, treadY + 0.35, 0))
    g.add(postGrp)
  }

  // Top cap
  g.add(box(0.90, 0.06, 0.90, poleM, 0, spiralRise + 0.30, 0))

  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g); return g
}

// Floating / open-design stair — cantilevered treads, single central spine, modern look
function buildStairOpen(wx, wz, facY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const spineM = makeMat(0x2a2a3a)   // dark steel spine
  const treadM = makeMat(0xd8c89a)   // light oak tread
  const treadE = makeMat(0x1a1a28)   // tread edge (dark)
  const glassM = new THREE.MeshLambertMaterial({ color: 0xaaccee, transparent: true, opacity: 0.28 })
  const strLen = Math.sqrt(STAIR_TOTAL_D ** 2 + STAIR_RISE ** 2)
  const strAng = Math.atan2(STAIR_TOTAL_D, STAIR_RISE)

  // Central spine beam (runs the full diagonal)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, strLen, 0.14), spineM)
  spine.position.set(0, STAIR_RISE / 2, STAIR_TOTAL_D / 2)
  spine.rotation.x = strAng
  g.add(spine)

  // Cantilevered treads — wider on right, narrower on left (asymmetric)
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i + 1) * STAIR_STEP_H
    const tz = (i + 0.5) * STAIR_STEP_D
    g.add(box(STAIR_W, 0.06, STAIR_STEP_D - 0.08, treadM, 0, ty - 0.03, tz))
    g.add(box(STAIR_W + 0.04, 0.04, 0.05, treadE, 0, ty, tz - STAIR_STEP_D / 2 + 0.025))
  }

  // Glass-panel railing (left side)
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = (i + 0.5) * STAIR_STEP_H + STAIR_STEP_H / 2
    const tz = (i + 0.5) * STAIR_STEP_D
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, STAIR_STEP_D - 0.05), glassM)
    panel.position.set(-STAIR_W / 2, ty + 0.36, tz)
    g.add(panel)
  }
  // Top handrail bar
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), spineM)
  topRail.position.set(-STAIR_W / 2, STAIR_RISE / 2 + 0.76, STAIR_TOTAL_D / 2)
  topRail.rotation.x = strAng
  g.add(topRail)

  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g); return g
}

// Basement / down stair — same wood style but descends (rise = -2.0),
// with a dark entrance frame to visually signal "going underground"
function buildStairDown(wx, wz, facY = 0) {
  const { lvl, baseY } = _lvlBase(wx, wz)
  const g = new THREE.Group()
  const woodM  = makeMat(0x6a4010)  // darker wood for underground feel
  const woodD  = makeMat(0x3a2008)
  const frameM = makeMat(0x181010)  // very dark frame at entrance
  const strLen = Math.sqrt(STAIR_TOTAL_D ** 2 + STAIR_RISE ** 2)
  const strAng = -Math.atan2(STAIR_TOTAL_D, STAIR_RISE)  // inverted: descends in +Z

  // Entrance frame (dark border at z=0 to mark the hole in the floor)
  g.add(box(STAIR_W + 0.24, 0.14, 0.14, frameM,  0,               0,     0))       // front
  g.add(box(0.14,            0.14, STAIR_TOTAL_D, frameM, -(STAIR_W/2+0.06), 0, STAIR_TOTAL_D/2))
  g.add(box(0.14,            0.14, STAIR_TOTAL_D, frameM,  (STAIR_W/2+0.06), 0, STAIR_TOTAL_D/2))

  // Side stringers (descending)
  for (const sx of [-STAIR_W / 2, STAIR_W / 2]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.10, strLen, 0.16), woodD)
    stringer.position.set(sx, -STAIR_RISE / 2, STAIR_TOTAL_D / 2)
    stringer.rotation.x = strAng
    g.add(stringer)
  }

  // Treads (descend as i increases)
  for (let i = 0; i < STAIR_STEPS; i++) {
    const ty = -(i + 1) * STAIR_STEP_H   // negative Y (going down)
    const tz = (i + 0.5) * STAIR_STEP_D
    for (const ox of [-0.22, 0, 0.22]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W / 3 - 0.03, 0.07, STAIR_STEP_D - 0.06), woodM)
      plank.position.set(ox, ty - 0.035, tz)
      g.add(plank)
    }
  }

  g.rotation.y = facY
  g.position.set(wx, baseY, wz)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(g); return g
}

// ── Universal spawn dispatcher (used by placeHeld, loadScene, rotatePlacedObj) ──
// hintLevel: optional floor index (char.level) — used when position falls outside floor bounds
function spawnPlaced(type, wx, wz, facingIdx, hintLevel = null) {
  const dir  = FACING_DIRS[facingIdx]
  const facY = FACING_Y[dir]
  let { lvl, baseY: _spBaseY } = _lvlBase(wx, wz)
  // If position-based detection failed (lvl=0 but hint says upper floor), use hint
  if (hintLevel !== null && hintLevel > 0 && lvl === 0 && ROOM_FLOORS_DATA.length > 0) {
    const hintFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === hintLevel)
    if (hintFloor) { lvl = hintLevel; _spBaseY = hintFloor.y + 0.06 }
  }
  const flY = _spBaseY - 0.06

  // ── Registry-Items (Datei-basiertes System) ────────────────────────────────
  const regFn = ITEM_DEFS.get(type)
  if (regFn) {
    // NPC: pending Meta mitsenden
    const meta = (type === 'room_npc' && window._pendingNpcMeta) ? window._pendingNpcMeta : null
    return regFn(wx, wz, facY, meta)
  }

  // ── Legacy Built-in Items (Fallback — bleiben in game3d.js) ───────────────
  switch (type) {
    case 'chair':        return buildChair(wx, wz, facY)
    case 'table':        return buildTable(wx, wz)
    case 'sofa':         return buildSofa(wx, wz, facY)
    case 'lamp':         return buildLamp(wx, wz)
    case 'plant':        return buildPlant(wx, wz)
    case 'roller':       return buildGameRoller(wx, wz, dir, flY)
    case 'armchair':     return buildArmchair(wx, wz, facY)
    case 'bookshelf':    return buildBookshelf(wx, wz, facY)
    case 'tv':           return buildTV(wx, wz, facY)
    case 'dresser':      return buildDresser(wx, wz, facY)
    case 'bed':          return buildBedPlaceable(wx, wz, facY)
    case 'discoball':    return buildDiscoball(wx, wz)
    case 'djdesk':       return buildDJDesk(wx, wz, facY)
    case 'balloon':      return buildBalloon(wx, wz)
    case 'partyflag':    return buildPartyFlag(wx, wz, facY)
    case 'neon':         return buildNeon(wx, wz, facY)
    case 'frame_blue':   return buildFrameBlue(wx, wz, facY)
    case 'frame_red':    return buildFrameRed(wx, wz,  facY)
    case 'frame_gold':   return buildFrameGold(wx, wz, facY)
    case 'frame_dark':   return buildFrameDark(wx, wz, facY)
    case 'barstool':     return buildBarstool(wx, wz)
    case 'ottoman':      return buildOttoman(wx, wz)
    case 'bench':        return buildBench(wx, wz, facY)
    case 'stool':        return buildStool(wx, wz)
    case 'barcounter':   return buildBarCounter(wx, wz, facY)
    case 'drinksshelf':  return buildDrinksShelf(wx, wz, facY)
    case 'cocktailtable':return buildCocktailTable(wx, wz)
    case 'fridge':       return buildFridge(wx, wz, facY)
    case 'beertap':      return buildBeertap(wx, wz)
    // ── Stairs ─────────────────────────────────────────────────────────────
    case 'stair_wood': case 'stair_stone': case 'stair_metal':
    case 'stair_open': case 'stair_down': {
      const builders = {
        stair_wood:  buildStairWood,
        stair_stone: buildStairStone,
        stair_metal: buildStairMetal,
        stair_open:  buildStairOpen,
        stair_down:  buildStairDown,
      }
      const grp = builders[type](wx, wz, facY)
      if (grp) {
        const rise = type === 'stair_down' ? -STAIR_RISE : STAIR_RISE
        addStairZone(grp.uuid, wx, wz, dir, rise, STAIR_TOTAL_D)
      }
      return grp
    }
  }
  return null
}

// ─── Multi-category item catalog ──────────────────────────────────────────────
// Katalog wird via ROOM_INIT postMessage aus der shop_items SQL-Tabelle befüllt.
// Kategorie-Anzeigenamen und Icons sind reine UI-Metadaten (kein Spielzustand).
const CAT_META = {
  moebel:        { label: 'Möbel',        icon: '🛋️' },
  party:         { label: 'Party',        icon: '🎉' },
  bilder:        { label: 'Bilder',       icon: '🖼️' },
  hocker:        { label: 'Hocker',       icon: '🪑' },
  bar:           { label: 'Bar',          icon: '🍺' },
  kueche:        { label: 'Küche',        icon: '🍳' },
  buero:         { label: 'Büro',         icon: '💼' },
  schlafzimmer:  { label: 'Schlafzimmer', icon: '🛏️' },
  deko:          { label: 'Deko',         icon: '🕯️' },
  sport:         { label: 'Sport',        icon: '🏋️' },
  gaming:        { label: 'Gaming',       icon: '🎮' },
  spezial:       { label: 'Spezial',      icon: '✨' },
}

// Wird beim ROOM_INIT aus SQL-Daten aufgebaut (item_code, display_name, icon, category, rotatable)
// CATALOG_CATS wird nie per Zuweisung ersetzt, sondern via setCatalog() in-place mutiert,
// damit findCatalogItem() in jedem Script-Block dieselbe Referenz sieht.
var CATALOG_CATS = []

function buildCatalogFromItems(apiItems) {
  const catMap = {}
  for (const it of apiItems) {
    const catId = it.category || 'moebel'
    if (!catMap[catId]) {
      const meta = CAT_META[catId] || { label: catId, icon: '📦' }
      catMap[catId] = { id: catId, label: meta.label, icon: meta.icon, items: [] }
    }
    catMap[catId].items.push({
      id:         it.item_code,
      label:      it.display_name,
      icon:       it.icon || '📦',
      rotatable:  it.rotatable === 1 || it.rotatable === true,
    })
  }
  // Kategorien in definierter Reihenfolge ausgeben
  const ORDER = ['moebel','party','bilder','hocker','bar','kueche','buero','schlafzimmer','deko','sport','gaming','spezial']
  return [
    ...ORDER.filter(k => catMap[k]).map(k => catMap[k]),
    ...Object.values(catMap).filter(c => !ORDER.includes(c.id)),
  ]
}

/** Katalog setzen — mutiert das Array in-place (cross-script safe) */
function setCatalog(cats) {
  CATALOG_CATS.length = 0
  CATALOG_CATS.push(...cats)
}

function findCatalogItem(id) {
  for (const cat of CATALOG_CATS)
    for (const item of cat.items)
      if (item.id === id) return item
  return null
}
