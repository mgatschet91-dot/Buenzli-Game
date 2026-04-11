'use strict'
// ═══════════════════════════════════════════════════════════════════════════════
// ROOM EDITOR — Isometric room designer (embedded via iframe, Daten kommen vom Server)
// ═══════════════════════════════════════════════════════════════════════════════

const TILE    = 1.0
const WALL_H  = 2.8
const WALL_TH = 0.22
const DOOR_W  = 1.8
const DOOR_H  = 2.2

const STAIR_STEPS   = 4
const STAIR_STEP_H  = 0.5
const STAIR_STEP_D  = 1.0
const STAIR_RISE    = STAIR_STEPS * STAIR_STEP_H   // 2.0
const STAIR_TOTAL_D = STAIR_STEPS * STAIR_STEP_D   // 4.0
const STAIR_W_NEW   = 0.92  // tread width for new stair styles
const ED_FAC_Y      = { N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 }

// ─── Data Model ───────────────────────────────────────────────────────────────
let roomData = null
let _uid = 0
function uid(p) { return p + (++_uid) }

function defaultRoom() {
  _uid = 1
  roomData = {
    v: 1,
    floors: [{
      id: 'f0', name: 'Erdgeschoss',
      x0: -10, x1: 10, z0: -10, z1: 10,
      y: 0, colorA: 0x4a7a5a, colorB: 0x527d63,
      wallN: true, wallS: false, wallE: false, wallW: true,
      doorN: false, doorS: false, doorE: false, doorW: false,
      holes: []
    }],
    stairs: [],
    rollers: [],
    spawn: { x: 0, z: 0, floorId: 'f0' }
  }
}

function encodeRoom(rd) { return btoa(encodeURIComponent(JSON.stringify(rd))) }
function decodeRoom(code) { return JSON.parse(decodeURIComponent(atob(code))) }

// ─── Three.js Scene ───────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.localClippingEnabled = true
document.getElementById('canvas-host').appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a2e)

let viewSize = 14
const camera = new THREE.OrthographicCamera(
  -viewSize * (window.innerWidth / window.innerHeight),
   viewSize * (window.innerWidth / window.innerHeight),
   viewSize, -viewSize, 0.1, 200
)
// 4 isometric camera angles (NE, NW, SW, SE)
const CAM_ANGLES = [
  new THREE.Vector3( 20, 16,  20),   // NE (default)
  new THREE.Vector3(-20, 16,  20),   // NW
  new THREE.Vector3(-20, 16, -20),   // SW
  new THREE.Vector3( 20, 16, -20),   // SE
]
let camAngleIdx = 0
const camOffset = CAM_ANGLES[0].clone()
const camTarget = new THREE.Vector3(0, 0, 0)
function updateCamera() {
  camera.position.copy(camTarget).add(camOffset)
  camera.lookAt(camTarget)
}
function rotateCam(dir) {
  camAngleIdx = (camAngleIdx + dir + 4) % 4
  camOffset.copy(CAM_ANGLES[camAngleIdx])
  updateCamera()
}
updateCamera()

scene.add(new THREE.AmbientLight(0xffffff, 0.75))
const sun = new THREE.DirectionalLight(0xffeedd, 1.2)
sun.position.set(10, 20, 10); sun.castShadow = true
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048
sun.shadow.camera.left = sun.shadow.camera.bottom = -50
sun.shadow.camera.right = sun.shadow.camera.top = 50
sun.shadow.camera.far = 150
scene.add(sun)
const fill = new THREE.DirectionalLight(0xaabbff, 0.4)
fill.position.set(-8, 12, -5)
scene.add(fill)

const sceneRoot = new THREE.Group()
scene.add(sceneRoot)

// ─── Shared helpers ───────────────────────────────────────────────────────────
function makeMat(color, opts) {
  return new THREE.MeshLambertMaterial({ color, ...opts })
}
function mkBox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

// ─── Scene Rebuild ────────────────────────────────────────────────────────────
let hitMeshes = []        // all clickable meshes (floors, stairs, spawn, rollers)
let selOverlay = null
let rollerBeltMeshes = [] // animated belt slats [{mesh, dir, cx, cz, halfT}]

function rebuild() {
  // Dispose & clear
  sceneRoot.traverse(obj => { if (obj.geometry) obj.geometry.dispose() })
  sceneRoot.clear()
  hitMeshes = []
  selOverlay = null
  rollerBeltMeshes = []

  for (const floor  of roomData.floors)  buildFloor(floor)
  for (const stair  of roomData.stairs)  buildStair(stair)
  for (const roller of (roomData.rollers || [])) buildRoller(roller)
  buildSpawn()

  if (selectedId && selectedType === 'floor') {
    const f = roomData.floors.find(f => f.id === selectedId)
    if (f) addSelOverlay(f)
  }

  refreshList()
  refreshProps()
  refreshCode()
}

// ── Floor ─────────────────────────────────────────────────────────────────────
function buildFloor(floor) {
  const g = new THREE.Group()
  g.userData = { type: 'floor', id: floor.id }

  const matA = makeMat(floor.colorA)
  const matB = makeMat(floor.colorB)
  const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)

  const tilesX = Math.max(1, Math.round((floor.x1 - floor.x0) / TILE))
  const tilesZ = Math.max(1, Math.round((floor.z1 - floor.z0) / TILE))
  const holesSet = new Set((floor.holes || []).map(([x, z]) => `${x},${z}`))

  for (let xi = 0; xi < tilesX; xi++) {
    for (let zi = 0; zi < tilesZ; zi++) {
      if (holesSet.has(`${xi},${zi}`)) continue
      const mat = (xi + zi) % 2 === 0 ? matA : matB
      const tile = new THREE.Mesh(tileGeo, mat)
      tile.position.set(floor.x0 + (xi + 0.5) * TILE, floor.y, floor.z0 + (zi + 0.5) * TILE)
      tile.receiveShadow = true; tile.castShadow = false
      tile.userData = { type: 'floor', id: floor.id, xi, zi }
      g.add(tile)
      hitMeshes.push(tile)
    }
  }

  // Grid overlay
  const cxF = (floor.x0 + floor.x1) / 2, czF = (floor.z0 + floor.z1) / 2
  const maxT = Math.max(tilesX, tilesZ)
  const gh = new THREE.GridHelper(maxT, maxT, 0, 0)
  gh.scale.set(tilesX / maxT, 1, tilesZ / maxT)
  gh.position.set(cxF, floor.y + 0.065, czF)
  gh.material.opacity = 0.1; gh.material.transparent = true
  g.add(gh)

  // Walls
  for (const edge of ['N', 'S', 'E', 'W']) {
    if (floor['wall' + edge]) buildWall(g, floor, edge, floor['door' + edge], getStairGaps(floor, edge))
  }

  sceneRoot.add(g)
}

// Returns [{center, width}] for every stair that passes through this wall edge
function getStairGaps(floor, edge) {
  const gaps = []
  const horiz  = edge === 'N' || edge === 'S'
  const fixedC = edge==='N' ? floor.z0 : edge==='S' ? floor.z1
               : edge==='W' ? floor.x0 : floor.x1
  const dv = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }

  for (const stair of roomData.stairs) {
    if (stair.fromFloorId !== floor.id && stair.toFloorId !== floor.id) continue
    const [dx, dz] = dv[stair.dir]
    // Both endpoints of the stair
    const pts = [
      { x: stair.x,                    z: stair.z },
      { x: stair.x + dx * stair.steps, z: stair.z + dz * stair.steps }
    ]
    for (const p of pts) {
      const perpVal  = horiz ? p.z : p.x
      const alongVal = horiz ? p.x : p.z
      if (Math.abs(perpVal - fixedC) < 1.5) {
        gaps.push({ center: alongVal, width: stair.width + 0.3 })
        break
      }
    }
  }
  return gaps
}

function buildWall(parentGroup, floor, edge, hasDoor, stairGaps = []) {
  const wallMat  = makeMat(0xd8c9a8)
  const frameMat = makeMat(0x4a2e0a)
  const doorMat  = makeMat(0x7a4e28)
  const goldMat  = makeMat(0xd4a020)

  const horiz  = edge === 'N' || edge === 'S'
  const fixedC = edge === 'N' ? floor.z0
               : edge === 'S' ? floor.z1
               : edge === 'W' ? floor.x0 : floor.x1
  const start  = horiz ? floor.x0 : floor.z0
  const end    = horiz ? floor.x1 : floor.z1
  const mid    = (start + end) / 2
  const baseY  = floor.y + 0.06

  // helper: one wall box from a→b along running axis, full WALL_H
  const seg = (a, b, h = WALL_H, yOff = 0) => {
    if (b - a < 0.01) return
    const l = b - a, c = (a + b) / 2
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? l : WALL_TH, h, horiz ? WALL_TH : l),
      wallMat
    )
    m.position.set(horiz ? c : fixedC, baseY + yOff + h / 2, horiz ? fixedC : c)
    m.receiveShadow = true
    m.userData = { type: 'wall', id: floor.id + '_' + edge, floorId: floor.id, edge }
    parentGroup.add(m)
    hitMeshes.push(m)
  }

  // ── Build list of all gaps (stair openings first, then door) ────────────
  // gaps = [{gs, ge, isDoor}] sorted by position
  const allGaps = []

  // Stair gaps — full height opening, no frame/door
  for (const sg of stairGaps) {
    allGaps.push({ gs: sg.center - sg.width / 2, ge: sg.center + sg.width / 2, isDoor: false })
  }

  if (!hasDoor && allGaps.length === 0) {
    seg(start, end)
    return
  }

  // Door gap — centred on wall mid
  const PW = 0.14
  const PT = WALL_TH + 0.12
  const aboveH = WALL_H - DOOR_H

  if (hasDoor) {
    allGaps.push({ gs: mid - DOOR_W / 2, ge: mid + DOOR_W / 2, isDoor: true })
  }

  // Sort gaps left→right
  allGaps.sort((a, b) => a.gs - b.gs)

  // ── Fill wall around all gaps ─────────────────────────────────────────
  let cursor = start
  for (const gap of allGaps) {
    seg(cursor, gap.gs)          // wall before this gap
    cursor = gap.ge
    if (!gap.isDoor) {
      // stair opening: full height gap, no frame, no door
      // (nothing to add — just leave it open)
    }
  }
  seg(cursor, end)               // wall after last gap

  // ── Transom above door gap only ───────────────────────────────────────
  if (hasDoor) {
    const dgs = mid - DOOR_W / 2, dge = mid + DOOR_W / 2
    seg(dgs, dge, aboveH, DOOR_H)

  // ── Frame posts — centred on the opening edges, INSIDE the gap ────────
  for (const side of [-1, 1]) {
    const along = side < 0 ? dgs + PW / 2 : dge - PW / 2
    const post  = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? PW : PT, DOOR_H, horiz ? PT : PW),
      frameMat
    )
    post.position.set(
      horiz ? along : fixedC,
      baseY + DOOR_H / 2,
      horiz ? fixedC : along
    )
    parentGroup.add(post)
  }

  // ── Frame top bar (covers the transom area width + posts) ─────────────
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(
      horiz ? DOOR_W : PT,
      aboveH,
      horiz ? PT : DOOR_W
    ),
    frameMat
  )
  topBar.position.set(
    horiz ? mid : fixedC,
    baseY + DOOR_H + aboveH / 2,
    horiz ? fixedC : mid
  )
  parentGroup.add(topBar)

  // ── Door panel — CLOSED, same thickness as wall, fills gap ───────────
  const panelW     = DOOR_W - PW * 2
  const panelThick = Math.max(WALL_TH, 0.12)  // never thinner than 0.12
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(
      horiz ? panelW      : panelThick,
      DOOR_H - 0.03,
      horiz ? panelThick  : panelW
    ),
    doorMat
  )
  panel.position.set(
    horiz ? mid    : fixedC,
    baseY + (DOOR_H - 0.03) / 2,
    horiz ? fixedC : mid
  )
  parentGroup.add(panel)

  // ── Gold door handle ──────────────────────────────────────────────────
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(
      horiz ? 0.07 : WALL_TH + 0.1,
      0.07,
      horiz ? WALL_TH + 0.1 : 0.07
    ),
    goldMat
  )
  handle.position.set(
    horiz ? mid + panelW * 0.3 : fixedC,
    baseY + DOOR_H * 0.44,
    horiz ? fixedC : mid + panelW * 0.3
  )
  parentGroup.add(handle)
  } // end if (hasDoor)
}

// ── Stair ─────────────────────────────────────────────────────────────────────
const STAIR_STYLE_BUILDERS = { wood: _buildStairWood, stone: _buildStairStone, metal: _buildStairMetal, open: _buildStairOpen, down: _buildStairDown }

function buildStair(stair) {
  const style = stair.style || 'classic'
  if (STAIR_STYLE_BUILDERS[style]) {
    const g = STAIR_STYLE_BUILDERS[style](stair)
    g.traverse(m => { if (m.isMesh) hitMeshes.push(m) })
    sceneRoot.add(g)
    return
  }

  const fromFloor = roomData.floors.find(f => f.id === stair.fromFloorId)
  const toFloor   = roomData.floors.find(f => f.id === stair.toFloorId)

  const fromY = fromFloor ? fromFloor.y : 0
  // Rise: use stair.height if set, otherwise derive from connected floor
  const rise  = stair.height != null
    ? stair.height
    : (toFloor ? toFloor.y - fromY : stair.steps * 0.5)
  const stepH = rise / stair.steps

  const g = new THREE.Group()
  g.userData = { type: 'stair', id: stair.id }

  const stepMat = makeMat(0xc8b48a)
  const railMat = makeMat(0x4a2e0a)

  // Direction travel vectors
  const dv = { N: [0,-1], S: [0,1], E: [1,0], W: [-1,0] }
  const [dx, dz] = dv[stair.dir]
  // Width axis (perpendicular to travel)
  const [wx, wz] = Math.abs(dx) > 0 ? [0, 1] : [1, 0]
  const halfW = stair.width / 2

  for (let i = 0; i < stair.steps; i++) {
    const h  = (i + 1) * stepH
    const cx = stair.x + dx * (i + 0.5)
    const cz = stair.z + dz * (i + 0.5)
    const sw = Math.abs(dx) > 0 ? (1.0 - 0.02) : stair.width
    const sd = Math.abs(dz) > 0 ? (1.0 - 0.02) : stair.width
    const s  = new THREE.Mesh(new THREE.BoxGeometry(sw, h, sd), stepMat)
    s.position.set(cx, fromY + h / 2, cz)
    s.castShadow = s.receiveShadow = true
    s.userData = { type: 'stair', id: stair.id }
    g.add(s)
    hitMeshes.push(s)
  }

  // Handrails on both sides
  for (const side of [-1, 1]) {
    for (let i = 0; i <= stair.steps; i++) {
      const flH = i * stepH
      const px = stair.x + dx * i + wx * side * halfW
      const pz = stair.z + dz * i + wz * side * halfW
      const post = mkBox(0.10, 0.90, 0.10, railMat, px, fromY + flH + 0.45, pz)
      post.castShadow = false; g.add(post)
    }
    for (let i = 0; i < stair.steps; i++) {
      const flH = (i + 0.5) * stepH
      const px  = stair.x + dx * (i + 0.5) + wx * side * halfW
      const pz  = stair.z + dz * (i + 0.5) + wz * side * halfW
      const rw  = Math.abs(dx) > 0 ? 1.05 : 0.08
      const rd  = Math.abs(dz) > 0 ? 1.05 : 0.08
      const rail = mkBox(rw, 0.08, rd, railMat, px, fromY + flH + 0.80, pz)
      rail.castShadow = false; g.add(rail)
    }
  }

  // ── Entrance gate at stair bottom (optional) ────────────────────────────
  if (stair.gate) {
    const gateW   = stair.gate.width || stair.width
    const GH      = 2.4   // gate height
    const gateY   = fromY + 0.06
    const frameMat = makeMat(0x4a2e0a)
    const doorMat  = makeMat(0x7a4e28)
    // Gate is perpendicular to travel direction, at the stair anchor
    const horiz = Math.abs(dz) > 0  // if stair travels N/S, gate is horizontal (X axis)
    const gx = stair.x
    const gz = stair.z

    // Left post
    const leftPX = horiz ? gx - gateW / 2 - 0.065 : gx
    const leftPZ = horiz ? gz : gz - gateW / 2 - 0.065
    const post1 = mkBox(horiz ? 0.14 : 0.14, GH + 0.14, horiz ? 0.14 : 0.14, frameMat,
      leftPX, gateY + (GH + 0.14) / 2, leftPZ)
    post1.castShadow = false; g.add(post1)

    // Right post
    const rightPX = horiz ? gx + gateW / 2 + 0.065 : gx
    const rightPZ = horiz ? gz : gz + gateW / 2 + 0.065
    const post2 = mkBox(horiz ? 0.14 : 0.14, GH + 0.14, horiz ? 0.14 : 0.14, frameMat,
      rightPX, gateY + (GH + 0.14) / 2, rightPZ)
    post2.castShadow = false; g.add(post2)

    // Top bar
    const topBar = mkBox(horiz ? gateW + 0.28 : 0.14, 0.16, horiz ? 0.14 : gateW + 0.28,
      frameMat, gx, gateY + GH + 0.15, gz)
    topBar.castShadow = false; g.add(topBar)

    // Door panel — open or closed depending on stair.gate.open
    const isOpen = !!stair.gate.open
    const pivot  = new THREE.Group()
    // Hinge at left post inner edge
    pivot.position.set(
      horiz ? gx - gateW / 2 + 0.07 : gx,
      gateY,
      horiz ? gz : gz - gateW / 2 + 0.07
    )
    pivot.rotation.y = isOpen ? (horiz ? -Math.PI / 2 : -Math.PI / 2) : 0
    pivot.userData = { type: 'gate', stairId: stair.id }
    const panel = mkBox(
      horiz ? gateW - 0.14 : 0.12,
      GH - 0.03,
      horiz ? 0.12 : gateW - 0.14,
      doorMat,
      horiz ? (gateW - 0.14) / 2 : 0,
      (GH - 0.03) / 2,
      horiz ? 0 : (gateW - 0.14) / 2
    )
    pivot.add(panel)
    g.add(pivot)
    hitMeshes.push(panel)   // make it clickable
  }

  sceneRoot.add(g)
}

// ── Spawn marker ──────────────────────────────────────────────────────────────
function buildSpawn() {
  const sp    = roomData.spawn
  const floor = roomData.floors.find(f => f.id === sp.floorId) || roomData.floors[0]
  const y     = floor ? floor.y + 0.06 : 0.06

  const mat  = makeMat(0xffcc00)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 4), mat)
  cone.position.set(sp.x, y + 0.28, sp.z)
  cone.rotation.y = Math.PI / 4
  cone.castShadow = false
  cone.userData = { type: 'spawn' }
  hitMeshes.push(cone)
  sceneRoot.add(cone)

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.52, 20),
    new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide }))
  ring.rotation.x = -Math.PI / 2
  ring.position.set(sp.x, y + 0.08, sp.z)
  sceneRoot.add(ring)
}

// ── Roller (conveyor tile) ────────────────────────────────────────────────────
function buildRoller(roller) {
  const floor  = roomData.floors.find(f => f.id === roller.floorId) || roomData.floors[0]
  const baseY  = (floor ? floor.y : 0) + 0.06  // sits on top of floor tile

  const g = new THREE.Group()
  g.userData = { type: 'roller', id: roller.id }

  const BH   = 0.22             // total roller body height
  const TW   = TILE * 0.92      // tile footprint (leaves small gap)
  const halfT = TW / 2
  const cx   = roller.x
  const cz   = roller.z
  const topY = baseY + BH       // y of the very top surface

  const isNS = roller.dir === 'N' || roller.dir === 'S'

  // ── Body (dark charcoal) ───────────────────────────────────────────────
  const body = new THREE.Mesh(new THREE.BoxGeometry(TW, BH, TW), makeMat(0x1e1e1e))
  body.position.set(cx, baseY + BH / 2, cz)
  body.receiveShadow = true
  body.userData = { type: 'roller', id: roller.id, floorId: roller.floorId }
  g.add(body)
  hitMeshes.push(body)

  // ── Red side rails (on the two sides perpendicular to travel) ──────────
  const rimMat = makeMat(0xcc1818)
  const RH = BH * 0.55, RT = 0.055
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(
        isNS ? TW + 0.04 : RT,
        RH,
        isNS ? RT : TW + 0.04
      ),
      rimMat
    )
    rim.position.set(
      cx + (isNS ? 0 : side * (halfT + RT / 2)),
      baseY + BH * 0.5,
      cz + (isNS ? side * (halfT + RT / 2) : 0)
    )
    g.add(rim)
  }

  // ── Belt slats (animated, clipped to roller bounds) ────────────────────
  const clippingPlanes = [
    new THREE.Plane(new THREE.Vector3( 1, 0, 0), -(cx - halfT)),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0),   cx + halfT),
    new THREE.Plane(new THREE.Vector3( 0, 0, 1), -(cz - halfT)),
    new THREE.Plane(new THREE.Vector3( 0, 0,-1),   cz + halfT),
  ]
  const beltMat = new THREE.MeshLambertMaterial({ color: 0x111111, clippingPlanes })

  const SLATS = 4
  for (let i = 0; i < SLATS; i++) {
    const t = (i / SLATS) * TW - halfT    // initial offset along travel axis
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(
        isNS ? TW * 0.80 : 0.055,
        0.018,
        isNS ? 0.055 : TW * 0.80
      ),
      beltMat
    )
    slat.position.set(
      cx + (isNS ? 0 : t),
      topY + 0.003,
      cz + (isNS ? t : 0)
    )
    // store animation info on userData
    slat.userData = { beltDir: roller.dir, cx, cz, halfT, speed: 1.1, slatOffset: (i / SLATS) * halfT * 2 }
    g.add(slat)
    rollerBeltMeshes.push(slat)
  }

  // ── Yellow direction arrow ─────────────────────────────────────────────
  const arrowGroup = new THREE.Group()
  arrowGroup.position.set(cx, topY + 0.022, cz)
  const arrowMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.26, 3),
    makeMat(0xddcc00)
  )
  arrowMesh.rotation.x = Math.PI / 2  // lay flat, tip points +Z
  arrowGroup.add(arrowMesh)
  const arrowYRot = { N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 }
  arrowGroup.rotation.y = arrowYRot[roller.dir]
  g.add(arrowGroup)

  // Selection highlight
  if (selectedId === roller.id) {
    const sel = new THREE.Mesh(
      new THREE.BoxGeometry(TW + 0.06, 0.04, TW + 0.06),
      new THREE.MeshBasicMaterial({ color: 0x3a7bd5, transparent: true, opacity: 0.45 })
    )
    sel.position.set(cx, topY + 0.025, cz)
    g.add(sel)
  }

  sceneRoot.add(g)
}

// ── Styled Stair Builders ─────────────────────────────────────────────────────
// Built in local space ascending +Z then rotated by facY.
// Each returns a THREE.Group — caller adds to sceneRoot.
// Dimensions are derived from the stair data model (steps, height).

function _stairDims(stair) {
  const fromFloor = roomData.floors.find(f => f.id === stair.fromFloorId)
  const toFloor   = roomData.floors.find(f => f.id === stair.toFloorId)
  const fromY     = fromFloor ? fromFloor.y : 0
  const steps     = Math.max(2, stair.steps || 4)
  const rise      = stair.height != null ? stair.height
                  : (toFloor ? toFloor.y - fromY : steps * STAIR_STEP_H)
  const stepH     = rise / steps
  const totalD    = steps * STAIR_STEP_D
  const strLen    = Math.sqrt(totalD ** 2 + rise ** 2)
  const strAng    = Math.atan2(totalD, rise)
  const w         = STAIR_W_NEW
  return { fromY, rise, steps, stepH, totalD, strLen, strAng, w }
}

function _stairSetup(stair, fromY) {
  const g = new THREE.Group()
  g.userData = { type: 'stair', id: stair.id }
  g.rotation.y = ED_FAC_Y[stair.dir] ?? 0
  g.position.set(stair.x, fromY, stair.z)
  return g
}
function _stairFinish(g, stair) {
  g.traverse(m => {
    if (!m.isMesh) return
    m.castShadow = m.receiveShadow = true
    m.userData = { type: 'stair', id: stair.id }
  })
  return g
}

function _buildStairWood(stair) {
  const { fromY, rise, steps, stepH, totalD, strLen, strAng, w } = _stairDims(stair)
  const g    = _stairSetup(stair, fromY)
  const woodM  = makeMat(0xb08030)
  const woodD  = makeMat(0x7a5018)
  const railM  = makeMat(0x5a3010)

  for (const sx of [-w / 2, w / 2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.10, strLen, 0.16), woodD)
    str.position.set(sx, rise / 2, totalD / 2)
    str.rotation.x = strAng
    g.add(str)
  }
  for (let i = 0; i < steps; i++) {
    const ty = (i + 1) * stepH, tz = (i + 0.5) * STAIR_STEP_D
    const plankW = w / 3 - 0.03
    for (const ox of [-w / 3 + plankW / 2, 0, w / 3 - plankW / 2]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(plankW, 0.07, STAIR_STEP_D - 0.06), woodM)
      plank.position.set(ox, ty - 0.035, tz)
      g.add(plank)
    }
  }
  for (let i = 0; i <= steps; i++) {
    g.add(mkBox(0.08, 0.72, 0.08, railM, w / 2, i * stepH + 0.36, i * STAIR_STEP_D))
  }
  const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), railM)
  railBar.position.set(w / 2, rise / 2 + 0.72, totalD / 2)
  railBar.rotation.x = strAng
  g.add(railBar)
  return _stairFinish(g, stair)
}

function _buildStairStone(stair) {
  const { fromY, rise, steps, stepH, totalD, w } = _stairDims(stair)
  const g     = _stairSetup(stair, fromY)
  const stoneM = makeMat(0x9a9288)
  const stoneD = makeMat(0x6e6660)
  const stoneL = makeMat(0xbab4ae)
  const hw     = w / 2

  for (let i = 0; i < steps; i++) {
    const bh = (i + 1) * stepH, bz = (i + 0.5) * STAIR_STEP_D
    g.add(mkBox(w, bh, STAIR_STEP_D - 0.04, stoneM, 0, bh / 2, bz))
    g.add(mkBox(w, 0.04, STAIR_STEP_D - 0.04, stoneL, 0, bh + 0.01, bz))
    g.add(mkBox(w, 0.06, 0.06, stoneD, 0, bh - 0.03, bz - STAIR_STEP_D / 2))
  }
  for (const sx of [-hw - 0.07, hw + 0.07]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.10, rise, totalD), stoneD)
    cheek.position.set(sx, rise / 2, totalD / 2)
    g.add(cheek)
    const triA = new THREE.Mesh(new THREE.BoxGeometry(0.10, rise, totalD), stoneD)
    triA.position.set(sx, -rise / 4, totalD / 2)
    triA.scale.y = 0.5
    g.add(triA)
  }
  return _stairFinish(g, stair)
}

function _buildStairMetal(stair) {
  const { fromY, rise, steps, stepH, totalD, strLen, strAng, w } = _stairDims(stair)
  const g     = _stairSetup(stair, fromY)
  const metalM = makeMat(0x3a3a4a)
  const metalL = makeMat(0x5a5a6e)
  const safeY  = makeMat(0xddcc00)

  for (const sx of [-w / 2, w / 2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.09, strLen, 0.09), metalM)
    str.position.set(sx, rise / 2, totalD / 2)
    str.rotation.x = strAng
    g.add(str)
  }
  for (let i = 0; i < steps; i++) {
    const ty = (i + 1) * stepH, tz = (i + 0.5) * STAIR_STEP_D
    g.add(mkBox(w, 0.05, STAIR_STEP_D - 0.06, metalL, 0, ty - 0.025, tz))
    g.add(mkBox(w, 0.05, 0.06, safeY, 0, ty, tz - STAIR_STEP_D / 2 + 0.03))
    g.add(mkBox(w, 0.04, 0.06, metalM, 0, ty - 0.08, tz + STAIR_STEP_D / 2 - 0.06))
    for (const ox of [-w * 0.28, w * 0.28]) {
      g.add(mkBox(0.05, 0.07, STAIR_STEP_D - 0.08, metalM, ox, ty - 0.07, tz))
    }
  }
  for (const sx of [-w / 2, w / 2]) {
    for (let i = 0; i <= steps; i++) {
      g.add(mkBox(0.06, 0.80, 0.06, metalM, sx, i * stepH + 0.40, i * STAIR_STEP_D))
    }
    const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), metalL)
    railBar.position.set(sx, rise / 2 + 0.82, totalD / 2)
    railBar.rotation.x = strAng
    g.add(railBar)
  }
  return _stairFinish(g, stair)
}

function _buildStairOpen(stair) {
  const { fromY, rise, steps, stepH, totalD, strLen, strAng, w } = _stairDims(stair)
  const g     = _stairSetup(stair, fromY)
  const spineM = makeMat(0x2a2a3a)
  const treadM = makeMat(0xd8c89a)
  const treadE = makeMat(0x1a1a28)
  const glassM = new THREE.MeshLambertMaterial({ color: 0xaaccee, transparent: true, opacity: 0.28 })

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, strLen, 0.14), spineM)
  spine.position.set(0, rise / 2, totalD / 2)
  spine.rotation.x = strAng
  g.add(spine)
  for (let i = 0; i < steps; i++) {
    const ty = (i + 1) * stepH, tz = (i + 0.5) * STAIR_STEP_D
    g.add(mkBox(w, 0.06, STAIR_STEP_D - 0.08, treadM, 0, ty - 0.03, tz))
    g.add(mkBox(w + 0.04, 0.04, 0.05, treadE, 0, ty, tz - STAIR_STEP_D / 2 + 0.025))
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, STAIR_STEP_D - 0.05), glassM)
    panel.position.set(-w / 2, (i + 0.5) * stepH + stepH / 2 + 0.36, tz)
    g.add(panel)
  }
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, strLen, 0.06), spineM)
  topRail.position.set(-w / 2, rise / 2 + 0.76, totalD / 2)
  topRail.rotation.x = strAng
  g.add(topRail)
  return _stairFinish(g, stair)
}

function _buildStairDown(stair) {
  const { fromY, rise, steps, stepH, totalD, strLen, w } = _stairDims(stair)
  const absRise = Math.abs(rise)
  const downLen = Math.sqrt(totalD ** 2 + absRise ** 2)
  const downAng = -Math.atan2(totalD, absRise)
  const g    = _stairSetup(stair, fromY)
  const woodM  = makeMat(0x6a4010)
  const woodD  = makeMat(0x3a2008)
  const frameM = makeMat(0x181010)

  g.add(mkBox(w + 0.24, 0.14, 0.14, frameM, 0, 0, 0))
  g.add(mkBox(0.14, 0.14, totalD, frameM, -(w / 2 + 0.06), 0, totalD / 2))
  g.add(mkBox(0.14, 0.14, totalD, frameM,  (w / 2 + 0.06), 0, totalD / 2))
  for (const sx of [-w / 2, w / 2]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.10, downLen, 0.16), woodD)
    str.position.set(sx, -absRise / 2, totalD / 2)
    str.rotation.x = downAng
    g.add(str)
  }
  for (let i = 0; i < steps; i++) {
    const ty = -(i + 1) * Math.abs(stepH), tz = (i + 0.5) * STAIR_STEP_D
    const plankW = w / 3 - 0.03
    for (const ox of [-w / 3 + plankW / 2, 0, w / 3 - plankW / 2]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(plankW, 0.07, STAIR_STEP_D - 0.06), woodM)
      plank.position.set(ox, ty - 0.035, tz)
      g.add(plank)
    }
  }
  return _stairFinish(g, stair)
}

// ── Selection overlay ─────────────────────────────────────────────────────────
function addSelOverlay(floor) {
  const w  = floor.x1 - floor.x0, d = floor.z1 - floor.z0
  const cx = (floor.x0 + floor.x1) / 2, cz = (floor.z0 + floor.z1) / 2
  selOverlay = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.05, d),
    new THREE.MeshBasicMaterial({ color: 0x3a7bd5, transparent: true, opacity: 0.22 })
  )
  selOverlay.position.set(cx, floor.y + 0.09, cz)
  sceneRoot.add(selOverlay)
}

// ─── Selection state ──────────────────────────────────────────────────────────
let selectedId   = null
let selectedType = null

function select(id, type) {
  selectedId   = id
  selectedType = type
  refreshList()
  refreshProps()
}

// ─── Tools ───────────────────────────────────────────────────────────────────
let activeTool    = 'select'
let stairAnchor   = null
let stairModalDir = 'N'
let floorAnchor   = null   // {x, z} world click position for new floor
let rollerAnchor   = null   // {x, z, floorId} for roller placement
let rollerModalDir  = 'S'   // last chosen roller direction
let stairModalStyle = 'classic'

function setTool(tool) {
  activeTool   = tool
  stairAnchor  = null
  floorAnchor  = null
  rollerAnchor = null
  document.querySelectorAll('.tb-btn[data-tool]').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === tool)
  )
  const hints = {
    select: '',
    stair:  'Klicke irgendwo in die Szene für den Treppenanfang',
    floor:  'Klicke in die Szene um die Etage zu platzieren',
    spawn:  'Klicken oder ziehen um den Spawn-Punkt zu setzen',
    roller: 'Klicke auf eine Etage um einen Roller zu platzieren',
    hole:   'Klicke auf ein Tile um es zu entfernen / wiederherzustellen'
  }
  setHint(hints[tool] || '')
}

function setHint(text) {
  const h = document.getElementById('hint')
  h.textContent = text
  h.classList.toggle('show', !!text)
}

// ─── Raycasting + Click ───────────────────────────────────────────────────────
// Double-click: toggle gate open/closed
renderer.domElement.addEventListener('dblclick', e => {
  const hit = getHit(e)
  if (!hit) return
  const ud = hit.object.parent?.userData
  if (ud?.type === 'gate') {
    const stair = roomData.stairs.find(s => s.id === ud.stairId)
    if (stair?.gate) {
      stair.gate.open = !stair.gate.open
      rebuild()
    }
  }
})
const raycaster = new THREE.Raycaster()
const mouse2d   = new THREE.Vector2()

function getWorldPoint(e, planeY) {
  mouse2d.x =  (e.clientX / window.innerWidth)  * 2 - 1
  mouse2d.y = -(e.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse2d, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY)
  const pt    = new THREE.Vector3()
  return raycaster.ray.intersectPlane(plane, pt) ? pt : null
}

function getHit(e) {
  mouse2d.x =  (e.clientX / window.innerWidth)  * 2 - 1
  mouse2d.y = -(e.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse2d, camera)
  const hits = raycaster.intersectObjects(hitMeshes)
  return hits.length ? hits[0] : null
}

renderer.domElement.addEventListener('click', e => {
  if (e.button !== 0) return
  const hit = getHit(e)

  if (activeTool === 'select') {
    if (!hit) { select(null, null); rebuild(); return }
    const { type, id } = hit.object.userData
    if (type === 'spawn')  { select('spawn', 'spawn'); rebuild(); return }
    if (type === 'roller') { select(id, 'roller'); rebuild(); return }
    if (type === 'floor' || type === 'stair' || type === 'wall') {
      select(id, type === 'wall' ? 'floor' : type)  // wall click → select floor
      rebuild()
    }
    return
  }

  if (activeTool === 'roller') {
    // Snap to tile center
    const floorHit = hit && hit.object.userData.type === 'floor'
    const floorId  = floorHit
      ? hit.object.userData.id
      : (roomData.floors.length ? roomData.floors[0].id : null)
    if (!floorId) { setHint('Erst eine Etage erstellen!'); return }
    const raw = floorHit ? hit.point : getWorldPoint(e, 0)
    if (!raw) return
    rollerAnchor = {
      x: Math.round(raw.x),   // snap to whole tile
      z: Math.round(raw.z),
      floorId
    }
    openRollerModal()
    return
  }

  if (activeTool === 'floor') {
    const pt = getWorldPoint(e, 0)
    if (!pt) return
    floorAnchor = { x: Math.round(pt.x), z: Math.round(pt.z) }
    openFloorModal()
    return
  }

  if (activeTool === 'stair') {
    // Allow clicking on empty floor or on a floor tile
    const pt2 = getWorldPoint(e, 0)
    const floorHit = hit && hit.object.userData.type === 'floor'
    const anchorFloorId = floorHit
      ? hit.object.userData.id
      : (roomData.floors.length ? roomData.floors[0].id : null)
    if (!anchorFloorId) { setHint('Erst eine Etage erstellen!'); return }
    const raw = floorHit ? hit.point : pt2
    if (!raw) return
    stairAnchor = {
      x: Math.round(raw.x * 2) / 2,
      z: Math.round(raw.z * 2) / 2,
      floorId: anchorFloorId
    }
    openStairModal()
    return
  }

  if (activeTool === 'hole') {
    // Try direct hit on a tile first
    const hit = getHit(e)
    let targetFloor = null
    let worldPt = null

    if (hit && hit.object.userData.type === 'floor') {
      targetFloor = roomData.floors.find(f => f.id === hit.object.userData.id)
      worldPt = hit.point
    } else {
      // Clicking on a hole (no mesh) — use horizontal plane at selected/first floor Y
      const f = roomData.floors.find(f => f.id === selectedId) || roomData.floors[0]
      if (!f) return
      targetFloor = f
      worldPt = getWorldPoint(e, f.y)
    }

    if (!targetFloor || !worldPt) return

    const tilesX = Math.max(1, Math.round((targetFloor.x1 - targetFloor.x0) / TILE))
    const tilesZ = Math.max(1, Math.round((targetFloor.z1 - targetFloor.z0) / TILE))
    const xi = Math.floor((worldPt.x - targetFloor.x0) / TILE)
    const zi = Math.floor((worldPt.z - targetFloor.z0) / TILE)
    if (xi < 0 || xi >= tilesX || zi < 0 || zi >= tilesZ) return

    if (!targetFloor.holes) targetFloor.holes = []
    const idx = targetFloor.holes.findIndex(([hx, hz]) => hx === xi && hz === zi)
    if (idx >= 0) {
      targetFloor.holes.splice(idx, 1)   // Loch schließen
    } else {
      targetFloor.holes.push([xi, zi])   // Loch öffnen
    }
    rebuild()
    return
  }

  if (activeTool === 'spawn') {
    placeSpawnAt(e)
    setTool('select')
  }
})

// Drag spawn when spawn-tool is active (hold & drag)
let draggingSpawn = false
renderer.domElement.addEventListener('mousedown', e => {
  if (e.button !== 0) return
  if (activeTool === 'spawn') { draggingSpawn = true; placeSpawnAt(e) }
  // Also: in select mode, mousedown on the spawn cone starts dragging
  if (activeTool === 'select') {
    const hit = getHit(e)
    if (hit && hit.object.userData.type === 'spawn') draggingSpawn = true
  }
})
renderer.domElement.addEventListener('mousemove', e => {
  if (!draggingSpawn) return
  if (!(e.buttons & 1)) { draggingSpawn = false; return }
  placeSpawnAt(e)
})
window.addEventListener('mouseup', () => { draggingSpawn = false })

function placeSpawnAt(e) {
  // Find which floor is under the cursor — try hitting floor tiles first,
  // then fall back to a horizontal plane at the nearest floor's Y
  const hit = getHit(e)
  let floor = null
  if (hit) {
    const ud = hit.object.userData
    const fid = ud.type === 'floor' ? ud.id : ud.floorId
    floor = roomData.floors.find(f => f.id === fid) || null
  }
  if (!floor) floor = roomData.floors[0]
  if (!floor) return

  const pt = getWorldPoint(e, floor.y)
  if (!pt) return
  roomData.spawn = { x: Math.round(pt.x * 2) / 2, z: Math.round(pt.z * 2) / 2, floorId: floor.id }
  rebuild()
}

// ─── Floor modal ─────────────────────────────────────────────────────────────
function openFloorModal() {
  // Suggest a sensible Y height
  const suggestY = roomData.floors.length > 0
    ? Math.max(...roomData.floors.map(f => f.y)) + 7
    : 0
  document.getElementById('fm-y').value    = suggestY.toFixed(1)
  document.getElementById('fm-name').value = 'Etage ' + (roomData.floors.length + 1)
  // Default colors: ground floor green, upper floors brown
  const isGround = roomData.floors.length === 0
  document.getElementById('fm-ca').value = isGround ? '#4a7a5a' : '#a07850'
  document.getElementById('fm-cb').value = isGround ? '#527d63' : '#8c6840'
  document.getElementById('floor-modal').classList.remove('hidden')
  setHint('')
  setTimeout(() => document.getElementById('fm-name').select(), 50)
}
function closeFloorModal() {
  document.getElementById('floor-modal').classList.add('hidden')
  floorAnchor = null
  setTool('select')
}
function confirmFloor() {
  const name = document.getElementById('fm-name').value.trim() || ('Etage ' + (roomData.floors.length + 1))
  const y    = parseFloat(document.getElementById('fm-y').value) || 0
  const tx   = Math.max(1, parseInt(document.getElementById('fm-tx').value) || 10)
  const tz   = Math.max(1, parseInt(document.getElementById('fm-tz').value) || 10)
  const ca   = parseInt(document.getElementById('fm-ca').value.replace('#', ''), 16)
  const cb   = parseInt(document.getElementById('fm-cb').value.replace('#', ''), 16)

  const cx = floorAnchor ? floorAnchor.x : 0
  const cz = floorAnchor ? floorAnchor.z : 0
  const hw = tx / 2, hd = tz / 2

  const newFloor = {
    id: uid('f'), name,
    x0: cx - hw, x1: cx + hw,
    z0: cz - hd, z1: cz + hd,
    y, colorA: ca, colorB: cb,
    wallN: false, wallS: false, wallE: false, wallW: false,
    doorN: false, doorS: false, doorE: false, doorW: false
  }
  roomData.floors.push(newFloor)
  select(newFloor.id, 'floor')
  closeFloorModal()
  rebuild()
}

// ─── Stair modal ─────────────────────────────────────────────────────────────
function openStairModal() {
  // Sync style buttons
  document.querySelectorAll('#stair-style-grid .db').forEach(b =>
    b.classList.toggle('sel', b.dataset.style === stairModalStyle)
  )
  // Populate the destination floor dropdown
  const sel = document.getElementById('stair-new-floor')
  sel.innerHTML = '<option value="new">Neue Etage automatisch erstellen</option><option value="none">Nur Treppe (keine obere Etage)</option>'
  const fromId = stairAnchor ? stairAnchor.floorId : null
  for (const f of roomData.floors) {
    if (f.id === fromId) continue   // skip the starting floor
    const opt = document.createElement('option')
    opt.value = f.id
    opt.textContent = '→ ' + f.name + ' (Y=' + f.y + 'm)'
    sel.appendChild(opt)
  }
  // Height row: always visible (height is always configurable)
  document.getElementById('stair-height-row').style.display = ''
  sel.onchange = () => {}   // no hide/show needed anymore

  document.getElementById('stair-modal').classList.remove('hidden')
  setHint('')
}
function closeStairModal() {
  document.getElementById('stair-modal').classList.add('hidden')
  stairAnchor = null
  setTool('select')
}

// ─── Roller modal ─────────────────────────────────────────────────────────────
function openRollerModal() {
  // Highlight the current direction button
  document.querySelectorAll('#roller-modal .db').forEach(b => {
    b.classList.toggle('sel', b.dataset.dir === rollerModalDir)
  })
  document.getElementById('roller-modal').classList.remove('hidden')
  setHint('')
}
function closeRollerModal() {
  document.getElementById('roller-modal').classList.add('hidden')
  rollerAnchor = null
  setTool('select')
}
function confirmRoller() {
  if (!rollerAnchor) { closeRollerModal(); return }
  if (!roomData.rollers) roomData.rollers = []
  const newRoller = {
    id: uid('r'),
    x: rollerAnchor.x,
    z: rollerAnchor.z,
    dir: rollerModalDir,
    floorId: rollerAnchor.floorId
  }
  roomData.rollers.push(newRoller)
  select(newRoller.id, 'roller')
  closeRollerModal()
  rebuild()
}
window.confirmRoller  = confirmRoller
window.closeRollerModal = closeRollerModal

function confirmStair() {
  if (!stairAnchor) { closeStairModal(); return }
  const width      = Math.max(1, parseInt(document.getElementById('stair-width').value) || 3)
  const steps      = Math.max(4, parseInt(document.getElementById('stair-steps').value) || 14)
  const destVal    = document.getElementById('stair-new-floor').value  // 'new' | 'none' | floorId

  const fromFloor  = roomData.floors.find(f => f.id === stairAnchor.floorId)
  let toFloorId    = null

  if (destVal === 'new') {
    // Create a new upper floor automatically
    const upperH = parseFloat(document.getElementById('stair-height').value) || 7
    const toY    = (fromFloor ? fromFloor.y : 0) + upperH
    const dv     = { N: [0,-1], S: [0,1], E: [1,0], W: [-1,0] }
    const [dx, dz] = dv[stairModalDir]
    const exitX  = stairAnchor.x + dx * steps
    const exitZ  = stairAnchor.z + dz * steps
    let x0 = exitX-5, x1 = exitX+5, z0 = exitZ-5, z1 = exitZ+5
    if (stairModalDir === 'N') { z1 = exitZ; z0 = exitZ-10 }
    if (stairModalDir === 'S') { z0 = exitZ; z1 = exitZ+10 }
    if (stairModalDir === 'E') { x0 = exitX; x1 = exitX+10 }
    if (stairModalDir === 'W') { x1 = exitX; x0 = exitX-10 }
    const newFloor = {
      id: uid('f'), name: 'Etage ' + roomData.floors.length,
      x0, x1, z0, z1, y: toY,
      colorA: 0xa07850, colorB: 0x8c6840,
      wallN: false, wallS: false, wallE: false, wallW: false,
      doorN: false, doorS: false, doorE: false, doorW: false
    }
    roomData.floors.push(newFloor)
    toFloorId = newFloor.id

  } else if (destVal !== 'none') {
    // Connect to an existing floor
    toFloorId = destVal
  }
  // 'none' → toFloorId stays null (stair with no upper floor)

  const height = parseFloat(document.getElementById('stair-height').value) || 7
  const newStair = {
    id: uid('s'),
    fromFloorId: stairAnchor.floorId,
    toFloorId,
    x: stairAnchor.x, z: stairAnchor.z,
    dir: stairModalDir, width, steps,
    height,   // always stored on the stair itself
    style: stairModalStyle
  }
  roomData.stairs.push(newStair)
  select(newStair.id, 'stair')
  closeStairModal()
  rebuild()
}

// ─── Resize floor ─────────────────────────────────────────────────────────────
function resizeFloor(axis, delta) {
  if (selectedType !== 'floor') return
  const floor = roomData.floors.find(f => f.id === selectedId)
  if (!floor) return
  floor[axis] += delta * TILE
  // Minimum 1 tile
  if (floor.x1 - floor.x0 < TILE) { if (axis === 'x0') floor.x0 = floor.x1 - TILE; else floor.x1 = floor.x0 + TILE }
  if (floor.z1 - floor.z0 < TILE) { if (axis === 'z0') floor.z0 = floor.z1 - TILE; else floor.z1 = floor.z0 + TILE }
  rebuild()
}
window.resizeFloor = resizeFloor

// Gesamte Etage um 1 Kachel verschieben (dx = X-Richtung, dz = Z-Richtung)
function moveFloor(dx, dz) {
  if (selectedType !== 'floor') return
  const floor = roomData.floors.find(f => f.id === selectedId)
  if (!floor) return
  floor.x0 += dx * TILE; floor.x1 += dx * TILE
  floor.z0 += dz * TILE; floor.z1 += dz * TILE
  rebuild()
}
window.moveFloor = moveFloor

function toggleWall(edge, enabled) {
  if (selectedType !== 'floor') return
  const floor = roomData.floors.find(f => f.id === selectedId)
  if (!floor) return
  floor['wall' + edge] = enabled
  if (!enabled) floor['door' + edge] = false
  rebuild()
}
window.toggleWall = toggleWall

function toggleDoor(edge, enabled) {
  if (selectedType !== 'floor') return
  const floor = roomData.floors.find(f => f.id === selectedId)
  if (!floor) return
  floor['door' + edge] = enabled
  rebuild()
}
window.toggleDoor = toggleDoor

function deleteSelected() {
  if (!selectedId || selectedType === 'spawn') return
  if (selectedType === 'floor') {
    roomData.floors  = roomData.floors.filter(f => f.id !== selectedId)
    roomData.stairs  = roomData.stairs.filter(s => s.fromFloorId !== selectedId && s.toFloorId !== selectedId)
    if (roomData.rollers) roomData.rollers = roomData.rollers.filter(r => r.floorId !== selectedId)
  } else if (selectedType === 'stair') {
    roomData.stairs = roomData.stairs.filter(s => s.id !== selectedId)
  } else if (selectedType === 'roller') {
    if (roomData.rollers) roomData.rollers = roomData.rollers.filter(r => r.id !== selectedId)
  }
  select(null, null)
  rebuild()
}
window.deleteSelected = deleteSelected

// ─── Properties panel ─────────────────────────────────────────────────────────
function hexToHtml(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6) }
function htmlToHex(s)   { return parseInt(s.replace('#', ''), 16) }

function refreshProps() {
  const container = document.getElementById('props-content')

  if (!selectedId) {
    container.innerHTML = '<div id="props-empty">Klicke auf ein Objekt<br>um es zu bearbeiten</div>'
    return
  }

  if (selectedType === 'floor') {
    const floor = roomData.floors.find(f => f.id === selectedId)
    if (!floor) return
    const tilesX = Math.round((floor.x1 - floor.x0) / TILE)
    const tilesZ = Math.round((floor.z1 - floor.z0) / TILE)
    container.innerHTML = `
      <div class="psec">
        <div class="pr"><label>Name</label><input type="text" id="p-name" value="${escHtml(floor.name)}"></div>
        <div class="pr"><label>Höhe Y (m)</label><input type="number" id="p-y" value="${floor.y}" step="0.5"></div>
        <div class="pr two">
          <div><label>Farbe A</label><input type="color" id="p-ca" value="${hexToHtml(floor.colorA)}"></div>
          <div><label>Farbe B</label><input type="color" id="p-cb" value="${hexToHtml(floor.colorB)}"></div>
        </div>
      </div>
      <div class="psec">
        <h5>Position verschieben</h5>
        <div class="pr">
          <label>X — links/rechts im Raum</label>
          <div style="display:flex;gap:4px;align-items:center">
            <button class="rb" style="flex:0 0 32px;font-size:15px" onclick="moveFloor(-1,0)">−</button>
            <input type="number" id="p-cx" value="${((floor.x0+floor.x1)/2).toFixed(1)}" step="1" style="flex:1">
            <button class="rb" style="flex:0 0 32px;font-size:15px" onclick="moveFloor(1,0)">+</button>
          </div>
        </div>
        <div class="pr">
          <label>Z — vorne/hinten im Raum</label>
          <div style="display:flex;gap:4px;align-items:center">
            <button class="rb" style="flex:0 0 32px;font-size:15px" onclick="moveFloor(0,-1)">−</button>
            <input type="number" id="p-cz" value="${((floor.z0+floor.z1)/2).toFixed(1)}" step="1" style="flex:1">
            <button class="rb" style="flex:0 0 32px;font-size:15px" onclick="moveFloor(0,1)">+</button>
          </div>
        </div>
      </div>
      <div class="psec">
        <h5>Größe — ${tilesX} × ${tilesZ} Kacheln</h5>
        <div class="compass">
          <div></div>
          <div class="compass-cell">
            <button class="rb" onclick="resizeFloor('z0',-1)">+N</button>
            <button class="rb" onclick="resizeFloor('z0', 1)">−N</button>
          </div>
          <div></div>
          <div class="compass-cell">
            <button class="rb" onclick="resizeFloor('x0',-1)">+W</button>
            <button class="rb" onclick="resizeFloor('x0', 1)">−W</button>
          </div>
          <div class="compass-center">${tilesX}×${tilesZ}</div>
          <div class="compass-cell">
            <button class="rb" onclick="resizeFloor('x1', 1)">+E</button>
            <button class="rb" onclick="resizeFloor('x1',-1)">−E</button>
          </div>
          <div></div>
          <div class="compass-cell">
            <button class="rb" onclick="resizeFloor('z1', 1)">+S</button>
            <button class="rb" onclick="resizeFloor('z1',-1)">−S</button>
          </div>
          <div></div>
        </div>
      </div>
      <div class="psec">
        <h5>Wände & Türen</h5>
        ${['N','S','E','W'].map(e => {
          const label = e==='N'?'Nord ↑':e==='S'?'Süd ↓':e==='W'?'West ←':'Ost →'
          const hasW  = floor['wall'+e]
          const hasD  = floor['door'+e]
          return `<div class="wall-row">
            <label>
              <input type="checkbox" ${hasW?'checked':''} onchange="toggleWall('${e}',this.checked)">
              ${label}
            </label>
            ${hasW ? `<label class="door-lbl">
              <input type="checkbox" ${hasD?'checked':''} onchange="toggleDoor('${e}',this.checked)">
              🚪
            </label>` : ''}
          </div>`
        }).join('')}
      </div>
      <div class="psec">
        <button class="del-btn" onclick="deleteSelected()">🗑️ Etage löschen</button>
      </div>
    `
    // Wire live inputs
    document.getElementById('p-name').onchange = e => { floor.name = e.target.value; refreshList() }
    document.getElementById('p-y').onchange    = e => { floor.y = parseFloat(e.target.value)||0; rebuild() }
    document.getElementById('p-ca').oninput    = e => { floor.colorA = htmlToHex(e.target.value); rebuild() }
    document.getElementById('p-cb').oninput    = e => { floor.colorB = htmlToHex(e.target.value); rebuild() }
    document.getElementById('p-cx').onchange = e => {
      const newCX = parseFloat(e.target.value) || 0
      const halfW = (floor.x1 - floor.x0) / 2
      floor.x0 = newCX - halfW; floor.x1 = newCX + halfW
      rebuild()
    }
    document.getElementById('p-cz').onchange = e => {
      const newCZ = parseFloat(e.target.value) || 0
      const halfD = (floor.z1 - floor.z0) / 2
      floor.z0 = newCZ - halfD; floor.z1 = newCZ + halfD
      rebuild()
    }

  } else if (selectedType === 'stair') {
    const stair = roomData.stairs.find(s => s.id === selectedId)
    if (!stair) return
    const from = roomData.floors.find(f => f.id === stair.fromFloorId)
    const to   = roomData.floors.find(f => f.id === stair.toFloorId)
    // Use stair.height if set, otherwise derive from connected floor
    const currentH = stair.height != null
      ? stair.height
      : (to ? (to.y - (from ? from.y : 0)) : stair.steps * 0.5)
    const hasGate  = !!stair.gate

    // Exit-Koordinaten (Ende der Treppe = Wandseite)
    const _sDV = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }
    const [_sdx, _sdz] = _sDV[stair.dir] || [0,-1]
    const _stSteps = stair.steps || 14
    const stairExitX = stair.x + _sdx * _stSteps
    const stairExitZ = stair.z + _sdz * _stSteps

    // Build options for the "Zu Etage" selector
    const floorOpts = roomData.floors
      .filter(f => f.id !== stair.fromFloorId)
      .map(f => `<option value="${escHtml(f.id)}" ${f.id === stair.toFloorId ? 'selected' : ''}>
        ${escHtml(f.name)} (Y=${f.y}m)
      </option>`)
      .join('')

    const STYLE_LABELS = { classic:'Klassisch', wood:'🪵 Holz', stone:'🧱 Stein', metal:'⚙️ Metall', open:'✨ Glas', down:'⬇️ Keller' }
    const curStyle = stair.style || 'classic'
    container.innerHTML = `
      <div class="psec">
        <div class="pr"><label>Typ</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:4px">
            ${Object.entries(STYLE_LABELS).map(([s, lbl]) =>
              `<button class="db${curStyle===s?' sel':''}" onclick="setStairStyle('${stair.id}','${s}')">${lbl}</button>`
            ).join('')}
          </div>
        </div>
        <div class="pr"><label>Von Etage</label><div class="pval">${from ? escHtml(from.name) : '?'}</div></div>
        <div class="pr">
          <label>Zu Etage</label>
          <select id="p-tofloor" style="width:100%;padding:5px 8px;border-radius:5px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#ddd;font:inherit;font-size:12px">
            <option value="none" ${!stair.toFloorId ? 'selected' : ''}>(keine obere Etage)</option>
            ${floorOpts}
          </select>
        </div>
        <div class="pr"><label>Richtung</label><div class="pval">${stair.dir}</div></div>
      </div>
      <div class="psec">
        <h5>Position</h5>
        <div class="pr two">
          <div><label>X (Ende)</label><input type="number" id="p-sx" value="${stairExitX}" step="0.5"></div>
          <div><label>Z (Ende)</label><input type="number" id="p-sz" value="${stairExitZ}" step="0.5"></div>
        </div>
        ${stair.toFloorId ? `<div class="pr"><label>Z verschieben (Treppe + Etage)</label><input type="number" id="p-sz-shift" value="${stair.z.toFixed(1)}" step="0.5" style="width:100%"></div>` : ''}
      </div>
      <div class="psec">
        <h5>Abmessungen</h5>
        <div class="pr">
          <label>Höhe (m)${to ? ' — passt obere Etage an' : ''}</label>
          <input type="number" id="p-sh" value="${currentH.toFixed(1)}" min="0.5" max="40" step="0.5">
        </div>
        <div class="pr"><label>Breite (Kacheln)</label>
          <input type="number" id="p-sw" value="${stair.width}" min="1" max="10"></div>
        <div class="pr"><label>Stufen (Anzahl)</label>
          <input type="number" id="p-ss" value="${stair.steps}" min="4" max="40"></div>
      </div>
      <div class="psec">
        <h5>Eingang / Tor</h5>
        <div class="wall-row">
          <label>
            <input type="checkbox" id="p-gate" ${hasGate ? 'checked' : ''}>
            🚪 Tor/Tür am Treppeneingang
          </label>
        </div>
        ${hasGate ? `
        <div class="pr"><label>Tor-Breite (m)</label>
          <input type="number" id="p-gw" value="${stair.gate?.width || stair.width}" step="0.1" min="0.5" max="5"></div>
        ` : ''}
      </div>
      <div class="psec">
        <button class="del-btn" onclick="deleteSelected()">🗑️ Treppe löschen</button>
      </div>
    `
    document.getElementById('p-tofloor').onchange = e => {
      stair.toFloorId = e.target.value === 'none' ? null : e.target.value
      rebuild()   // re-renders props with updated state
    }
    document.getElementById('p-sx').onchange = e => {
      const _dv = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }
      const [_dx] = _dv[stair.dir] || [0,-1]
      stair.x = (parseFloat(e.target.value) || 0) - _dx * (stair.steps || 14)
      rebuild()
    }
    document.getElementById('p-sz').onchange = e => {
      const _dv = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }
      const [, _dz] = _dv[stair.dir] || [0,-1]
      stair.z = (parseFloat(e.target.value) || 0) - _dz * (stair.steps || 14)
      rebuild()
    }
    const pszShift = document.getElementById('p-sz-shift')
    if (pszShift) pszShift.onchange = e => {
      const newZ = parseFloat(e.target.value) || 0
      const delta = newZ - stair.z
      stair.z = newZ
      const toFloor = roomData.floors.find(f => f.id === stair.toFloorId)
      if (toFloor) { toFloor.z0 += delta; toFloor.z1 += delta }
      rebuild()
    }
    document.getElementById('p-sh').onchange = e => {
      const h = Math.max(0.5, parseFloat(e.target.value) || 7)
      stair.height = h   // always store on the stair
      // Also move the connected upper floor if there is one
      const toFloor = roomData.floors.find(f => f.id === stair.toFloorId)
      if (toFloor) { toFloor.y = (from ? from.y : 0) + h }
      rebuild()
    }
    document.getElementById('p-sw').onchange = e => { stair.width = Math.max(1, parseInt(e.target.value)||3); rebuild() }
    document.getElementById('p-ss').onchange = e => { stair.steps = Math.max(4, parseInt(e.target.value)||14); rebuild() }
    document.getElementById('p-gate').onchange = e => {
      stair.gate = e.target.checked ? { width: stair.width } : null
      rebuild()
    }
    if (hasGate && document.getElementById('p-gw')) {
      document.getElementById('p-gw').onchange = e => {
        if (stair.gate) stair.gate.width = Math.max(0.5, parseFloat(e.target.value)||stair.width)
        rebuild()
      }
    }

  } else if (selectedType === 'roller') {
    const roller = (roomData.rollers || []).find(r => r.id === selectedId)
    if (!roller) return
    const floor = roomData.floors.find(f => f.id === roller.floorId)
    const DIRS  = ['N','S','E','W']
    const DLBL  = { N:'↑ Nord', S:'↓ Süd', E:'→ Ost', W:'← West' }
    container.innerHTML = `
      <div class="psec">
        <h5>Roller</h5>
        <div class="pr"><label>Etage</label><div class="pval">${floor ? escHtml(floor.name) : '?'}</div></div>
        <div class="pr two">
          <div><label>X</label><input type="number" id="p-rx" value="${roller.x}" step="1"></div>
          <div><label>Z</label><input type="number" id="p-rz" value="${roller.z}" step="1"></div>
        </div>
      </div>
      <div class="psec">
        <h5>Schubrichtung</h5>
        <div class="dir-grid">
          ${DIRS.map(d => `<button class="db${roller.dir===d?' sel':''}" onclick="setRollerDir('${roller.id}','${d}')">${DLBL[d]}</button>`).join('')}
        </div>
      </div>
      <div class="psec">
        <button class="del-btn" onclick="deleteSelected()">🗑️ Roller löschen</button>
      </div>
    `
    document.getElementById('p-rx').onchange = e => { roller.x = Math.round(parseFloat(e.target.value)||0); rebuild() }
    document.getElementById('p-rz').onchange = e => { roller.z = Math.round(parseFloat(e.target.value)||0); rebuild() }

  } else if (selectedType === 'spawn') {
    const sp    = roomData.spawn
    const floor = roomData.floors.find(f => f.id === sp.floorId)
    container.innerHTML = `
      <div class="psec">
        <h5>Spawn-Punkt</h5>
        <div class="pr"><label>Position</label><div class="pval">(${sp.x}, ${sp.z})</div></div>
        <div class="pr"><label>Etage</label><div class="pval">${floor ? escHtml(floor.name) : '?'}</div></div>
        <div class="pr two">
          <div><label>X</label><input type="number" id="p-sx" value="${sp.x}"></div>
          <div><label>Z</label><input type="number" id="p-sz" value="${sp.z}"></div>
        </div>
        <p class="pdesc" style="margin-top:6px">Oder Spawn-Tool aktivieren und auf ein Tile klicken.</p>
      </div>
    `
    document.getElementById('p-sx').onchange = e => { sp.x = parseInt(e.target.value)||0; rebuild() }
    document.getElementById('p-sz').onchange = e => { sp.z = parseInt(e.target.value)||0; rebuild() }
  }
}

function setRollerDir(id, dir) {
  const r = (roomData.rollers || []).find(r => r.id === id)
  if (r) { r.dir = dir; rebuild() }
}
window.setRollerDir = setRollerDir

function setStairStyle(id, style) {
  const s = roomData.stairs.find(s => s.id === id)
  if (s) { s.style = style; rebuild() }
}
window.setStairStyle = setStairStyle

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// ─── Object list (left panel) ─────────────────────────────────────────────────
function refreshList() {
  const list = document.getElementById('floor-list')
  list.innerHTML = ''
  const add = (id, type, icon, label) => {
    const el = document.createElement('div')
    el.className = 'li' + (selectedId === id ? ' sel' : '')
    el.innerHTML = `<span class="ic">${icon}</span><span class="nm">${escHtml(label)}</span>`
    el.addEventListener('click', () => { select(id, type); rebuild() })
    list.appendChild(el)
  }
  for (const f of roomData.floors)  add(f.id, 'floor',  '🟩', f.name)
  const STAIR_ICONS = { classic:'🪜', wood:'🪵', stone:'🧱', metal:'⚙️', open:'✨', down:'⬇️' }
  for (const s of roomData.stairs)  add(s.id, 'stair',  STAIR_ICONS[s.style||'classic']||'🪜', 'Treppe ' + (s.style||'classic') + ' ' + s.dir)
  for (const r of (roomData.rollers||[])) add(r.id, 'roller', '🔄', 'Roller ' + r.dir + ' (' + r.x + ',' + r.z + ')')
  add('spawn', 'spawn', '⭐', 'Spawn-Punkt')
}

// ─── Code bar (entfernt — wird in DB gespeichert) ─────────────────────────────
function refreshCode() {
  // refreshCode wird bei jeder Änderung aufgerufen — Save geht via API
}

function toast(msg, isErr = false) {
  const t = document.createElement('div')
  t.textContent = msg
  Object.assign(t.style, {
    position: 'fixed', top: '58px', left: '50%', transform: 'translateX(-50%)',
    background: isErr ? 'rgba(160,30,30,0.93)' : 'rgba(30,160,70,0.93)',
    color: '#fff', padding: '8px 18px', borderRadius: '8px',
    zIndex: '999', fontSize: '13px', pointerEvents: 'none',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
  })
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2200)
}

// ─── Camera: pan (right-drag) + zoom (scroll) ─────────────────────────────────
let isPanning = false
let panStartMouse = { x: 0, y: 0 }
let panStartTarget = new THREE.Vector3()

let spaceDown = false
window.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { spaceDown = true; e.preventDefault() } }, true)
window.addEventListener('keyup',   e => { if (e.code === 'Space') spaceDown = false })

renderer.domElement.addEventListener('mousedown', e => {
  // Don't pan if we're dragging the spawn point
  if (draggingSpawn) return
  // Pan: right-click OR middle-click OR Space+left-click
  if (e.button === 2 || e.button === 1 || (e.button === 0 && spaceDown)) {
    isPanning = true
    panStartMouse = { x: e.clientX, y: e.clientY }
    panStartTarget.copy(camTarget)
    e.preventDefault()
  }
})
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault())

window.addEventListener('mousemove', e => {
  if (!isPanning) return
  const scale = viewSize / 280
  const dx    = (e.clientX - panStartMouse.x) * scale
  const dy    = (e.clientY - panStartMouse.y) * scale
  // Adjust for camera angle direction
  const sign  = (camAngleIdx === 1 || camAngleIdx === 2) ? -1 : 1
  const signZ = (camAngleIdx === 2 || camAngleIdx === 3) ? -1 : 1
  camTarget.x = panStartTarget.x - sign  * (dx - dy) * 0.72
  camTarget.z = panStartTarget.z - signZ * (dx + dy) * 0.72
  updateCamera()
})
window.addEventListener('mouseup', e => { if (e.button === 2 || e.button === 1 || e.button === 0) isPanning = false })

renderer.domElement.addEventListener('wheel', e => {
  viewSize = Math.max(5, Math.min(45, viewSize + e.deltaY * 0.025))
  const a = window.innerWidth / window.innerHeight
  camera.left = -viewSize * a; camera.right = viewSize * a
  camera.top  =  viewSize;     camera.bottom = -viewSize
  camera.updateProjectionMatrix()
}, { passive: true })

// ─── Keyboard ─────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  if (e.code === 'Delete' || e.code === 'Backspace') deleteSelected()
  if (e.code === 'Escape')  setTool('select')
  if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) { e.preventDefault() }
})

// ─── Window resize ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const a = window.innerWidth / window.innerHeight
  camera.left = -viewSize * a; camera.right = viewSize * a
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Toolbar & modal wiring ───────────────────────────────────────────────────
document.querySelectorAll('.tb-btn[data-tool]').forEach(btn =>
  btn.addEventListener('click', () => setTool(btn.dataset.tool))
)
document.getElementById('btn-rot-l').addEventListener('click', () => rotateCam(-1))
document.getElementById('btn-rot-r').addEventListener('click', () => rotateCam( 1))


// Stair style buttons
document.querySelectorAll('#stair-style-grid .db').forEach(btn => {
  btn.addEventListener('click', () => {
    stairModalStyle = btn.dataset.style
    document.querySelectorAll('#stair-style-grid .db').forEach(b => b.classList.remove('sel'))
    btn.classList.add('sel')
  })
})
// Stair direction buttons (only inside #stair-modal)
document.querySelectorAll('#stair-modal .db[data-dir]').forEach(btn => {
  btn.addEventListener('click', () => {
    stairModalDir = btn.dataset.dir
    document.querySelectorAll('#stair-modal .db[data-dir]').forEach(b => b.classList.remove('sel'))
    btn.classList.add('sel')
  })
})
// Roller direction buttons (only inside #roller-modal)
document.querySelectorAll('#roller-modal .db').forEach(btn => {
  btn.addEventListener('click', () => {
    rollerModalDir = btn.dataset.dir
    document.querySelectorAll('#roller-modal .db').forEach(b => b.classList.remove('sel'))
    btn.classList.add('sel')
  })
})
document.getElementById('stair-ok').addEventListener('click', confirmStair)
document.getElementById('stair-cancel').addEventListener('click', closeStairModal)
document.getElementById('roller-ok').addEventListener('click', confirmRoller)
document.getElementById('roller-cancel').addEventListener('click', closeRollerModal)

document.getElementById('fm-ok').addEventListener('click', confirmFloor)
document.getElementById('fm-cancel').addEventListener('click', closeFloorModal)
// Enter key in floor modal
document.getElementById('floor-modal').addEventListener('keydown', e => {
  if (e.code === 'Enter') confirmFloor()
  if (e.code === 'Escape') closeFloorModal()
})

// ─── Init ─────────────────────────────────────────────────────────────────────
defaultRoom()
const _urlParams  = new URLSearchParams(window.location.search)
const _authToken  = _urlParams.get('token') || ''
const _apiBase    = _urlParams.get('api') || 'http://127.0.0.1:4100'

rebuild()

// ─── Save/Close-Buttons + Layout vom Server laden ────────────────────────────
const btnSave  = document.getElementById('btn-save')
const btnClose = document.getElementById('btn-close')

// Layout vom Server laden
;(async function loadFromServer() {
  try {
    const r = await fetch(_apiBase + '/api/game/user/room/layout', {
      headers: {
        'Authorization': 'Bearer ' + _authToken,
        'X-Game-Token':  _authToken,
      },
    })
    const d = await r.json()
    if (d.ok && d.data && d.data.v === 1) {
      roomData = d.data
      if (!roomData.rollers) roomData.rollers = []
      if (!roomData.spawn)   roomData.spawn   = { x: 0, z: 0, floorId: 'f0', floor_idx: 0 }
      _uid = Math.max(0,
        ...roomData.floors.map(f => parseInt((f.id || '0').replace(/\D/g,'')) || 0),
        ...roomData.stairs.map(s => parseInt((s.id || '0').replace(/\D/g,'')) || 0),
        ...roomData.rollers.map(r => parseInt((r.id || '0').replace(/\D/g,'')) || 0)
      ) + 1
      select(null, null)
      rebuild()
    }
    // null = noch kein gespeichertes Layout → Standardraum bleibt
  } catch {
    toast('Layout konnte nicht geladen werden', true)
  }
})()

// Speichern-Funktion
async function saveToServer() {
  if (btnSave) { btnSave.textContent = '⏳…'; btnSave.disabled = true }
  try {
    const r = await fetch(_apiBase + '/api/game/user/room/layout', {
      method:  'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + _authToken,
        'X-Game-Token':  _authToken,
      },
      body: JSON.stringify(roomData),
    })
    const d = await r.json()
    if (d.ok) {
      toast('Gespeichert ✓')
      window.parent?.postMessage({ type: 'EDITOR_SAVED' }, '*')
    } else {
      toast('Fehler: ' + (d.error || 'Unbekannt'), true)
    }
  } catch {
    toast('Netzwerkfehler', true)
  } finally {
    if (btnSave) { btnSave.textContent = '💾 Speichern'; btnSave.disabled = false }
  }
}

if (btnSave)  btnSave.addEventListener('click', saveToServer)
if (btnClose) btnClose.addEventListener('click', () => {
  window.parent?.postMessage({ type: 'EDITOR_CLOSE' }, '*')
})

// Ctrl+S → speichern
window.addEventListener('keydown', e => {
  if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    saveToServer()
  }
}, { capture: true })

// ─── Render loop ──────────────────────────────────────────────────────────────
const clock = new THREE.Clock()

function loop() {
  requestAnimationFrame(loop)
  const delta = clock.getDelta()

  // Animate roller belts — synchron via absolutem Timestamp
  const tSec = Date.now() * 0.001  // Unix-Timestamp: identisch auf allen Clients
  for (const slat of rollerBeltMeshes) {
    const { beltDir, cx, cz, halfT, speed, slatOffset } = slat.userData
    const phase = ((tSec * speed + slatOffset) % (halfT * 2) + halfT * 2) % (halfT * 2)
    if (beltDir === 'N' || beltDir === 'S') {
      const sign = beltDir === 'S' ? 1 : -1
      slat.position.z = cz - halfT + ((phase * sign + halfT * 2) % (halfT * 2))
    } else {
      const sign = beltDir === 'E' ? 1 : -1
      slat.position.x = cx - halfT + ((phase * sign + halfT * 2) % (halfT * 2))
    }
  }

  renderer.render(scene, camera)
}
loop()
