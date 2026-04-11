// ─── game3d-rooms.js ── Room geometry builders (old template + editor format) ──
// Depends on: game3d-core.js (scene, makeMat, box, TILE, GRID, FLOOR2_Y, ROOM_GEOM_OBJECTS, etc.)

function _buildGroundFloor() {
  const objs = []
  const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
  const matA = new THREE.MeshLambertMaterial({ color: 0x4a7a5a })
  const matB = new THREE.MeshLambertMaterial({ color: 0x527d63 })
  for (let x = 0; x < GRID; x++) {
    for (let z = 0; z < GRID; z++) {
      const mat  = (x + z) % 2 === 0 ? matA : matB
      const tile = new THREE.Mesh(tileGeo, mat)
      tile.position.set((x - GRID / 2 + 0.5) * TILE, 0, (z - GRID / 2 + 0.5) * TILE)
      tile.receiveShadow = true
      tile.userData = { tileX: x, tileZ: z, isFloorTile: true }
      scene.add(tile); objs.push(tile)
      PLACE_FLOOR_MESHES.push(tile)
    }
  }
  const gh = new THREE.GridHelper(GRID * TILE, GRID, 0x000000, 0x000000)
  gh.position.y = 0.07
  gh.material.opacity = 0.12; gh.material.transparent = true
  scene.add(gh); objs.push(gh)
  return objs
}

function _buildGroundWalls(geo) {
  const objs = []
  const add  = m => { scene.add(m); objs.push(m); return m }
  const GWALL_H = 2.8
  const wallMat  = makeMat(0xd8c9a8)
  const frameMat = makeMat(0x4a2e0a)
  const halfG    = (GRID / 2) * TILE
  const wallY    = GWALL_H / 2 + 0.06
  const th       = 0.22
  if (geo.wall_n ?? 1) { const wm = add(box(GRID * TILE, GWALL_H, th, wallMat, 0, wallY, -halfG)); wm.userData.isWall = true; wm.userData.wallEdge = 'N'; wm.userData.wallCoord = -halfG; wm.userData.wallFloorY = 0; WALL_MESHES.push(wm) }
  if (geo.wall_w ?? 1) { const wm = add(box(th, GWALL_H, GRID * TILE, wallMat, -halfG, wallY, 0)); wm.userData.isWall = true; wm.userData.wallEdge = 'W'; wm.userData.wallCoord = -halfG; wm.userData.wallFloorY = 0; WALL_MESHES.push(wm) }
  if (geo.wall_s ?? 0) { const wm = add(box(GRID * TILE, GWALL_H, th, wallMat, 0, wallY, halfG)); wm.userData.isWall = true; wm.userData.wallEdge = 'S'; wm.userData.wallCoord = halfG; wm.userData.wallFloorY = 0; WALL_MESHES.push(wm) }
  if (geo.wall_e ?? 0) { const wm = add(box(th, GWALL_H, GRID * TILE, wallMat, halfG, wallY, 0)); wm.userData.isWall = true; wm.userData.wallEdge = 'E'; wm.userData.wallCoord = halfG; wm.userData.wallFloorY = 0; WALL_MESHES.push(wm) }
  // Door (Südwand — door_wall='S')
  if ((geo.door_wall ?? 'S') === 'S') {
    const DW = geo.door_width ?? 1.8, DH = geo.door_height ?? 2.2
    const off = geo.door_offset ?? 0
    const fh = DH + 0.14, fy = fh / 2 + 0.06
    add(box(0.13, fh, th + 0.05, frameMat, off - DW/2 - 0.065, fy, halfG))
    add(box(0.13, fh, th + 0.05, frameMat, off + DW/2 + 0.065, fy, halfG))
    add(box(DW + 0.26, 0.15, th + 0.05, frameMat, off, DH + 0.135, halfG))
    const pivot = new THREE.Group()
    pivot.position.set(off + DW/2, 0.06, halfG)
    pivot.rotation.y = 0  // geschlossen
    scene.add(pivot); objs.push(pivot)
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.08), makeMat(0x7a4e28))
    doorMesh.position.set(-DW/2, DH/2, 0)
    doorMesh.castShadow = true; doorMesh.receiveShadow = true
    pivot.add(doorMesh)
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x99ddff, opacity: 0.45, transparent: true })
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.05), glassMat)
    pane.position.set(-DW/2 + 0.58, DH * 0.65, 0.02)
    pivot.add(pane)
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.18), makeMat(0xd4a020))
    handle.position.set(-DW/2 + 0.28, DH * 0.44, -0.09)
    pivot.add(handle)
    ROOM_DOORS.push({ pivot, wx: off, wz: halfG, angle: 0, target: 0, openAngle: -Math.PI / 2 })
  }
  return objs
}

function _buildStaircase() {
  const objs = []
  const stepMat = makeMat(0xc8b48a)
  const railMat = makeMat(0x4a2e0a)
  const STEPS = 20
  const stepH = FLOOR2_Y / STEPS
  const stepD = (ST_Z1 - ST_Z0) / STEPS
  const stepW = ST_X1 - ST_X0
  const cx    = (ST_X0 + ST_X1) / 2
  for (let i = 0; i < STEPS; i++) {
    const h = (i + 1) * stepH, zc = ST_Z1 - (i + 0.5) * stepD
    const s = new THREE.Mesh(new THREE.BoxGeometry(stepW, h, stepD - 0.02), stepMat)
    s.position.set(cx, h / 2, zc)
    s.castShadow = s.receiveShadow = true
    s.userData.isFloorTile = true
    scene.add(s); objs.push(s)
    PLACE_FLOOR_MESHES.push(s)
  }
  ;[ST_X0, ST_X1].forEach(px => {
    for (let i = 0; i <= STEPS; i++) {
      const flH = i * stepH, zc = ST_Z1 - i * stepD
      const m = box(0.10, 0.90, 0.10, railMat, px, flH + 0.45, zc)
      scene.add(m); objs.push(m)
    }
    for (let i = 0; i < STEPS; i++) {
      const flH = (i + 0.5) * stepH, zc = ST_Z1 - (i + 0.5) * stepD
      const m = box(0.08, 0.08, stepD + 0.05, railMat, px, flH + 0.80, zc)
      scene.add(m); objs.push(m)
    }
  })
  return objs
}

function _buildUpperFloor() {
  const objs = []
  const add  = m => { scene.add(m); objs.push(m); return m }
  const addW = m => { m.castShadow = false; return add(m) }
  // Floor tiles
  const tileMatA = new THREE.MeshLambertMaterial({ color: 0xa07850 })
  const tileMatB = new THREE.MeshLambertMaterial({ color: 0x8c6840 })
  const tileGeo2 = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
  for (let xi = F2_X0; xi < F2_X1; xi++) {
    for (let zi = F2_Z0; zi < F2_Z1; zi++) {
      const mat = (xi + zi) % 2 === 0 ? tileMatA : tileMatB
      const t = new THREE.Mesh(tileGeo2, mat)
      t.position.set(xi + 0.5, FLOOR2_Y, zi + 0.5)
      t.castShadow = false; t.receiveShadow = true
      t.userData.isFloorTile = true
      add(t)
      PLACE_FLOOR_MESHES.push(t)
    }
  }
  // Grid overlay
  const fw = F2_X1 - F2_X0, fd = Math.abs(F2_Z1 - F2_Z0)
  const cxF = (F2_X0 + F2_X1) / 2, czF = (F2_Z0 + F2_Z1) / 2
  const g2 = new THREE.GridHelper(fw, fw, 0x000000, 0x000000)
  g2.position.set(cxF, FLOOR2_Y + 0.065, czF)
  g2.material.opacity = 0.09; g2.material.transparent = true
  add(g2)
  // Walls
  const WALL_H = 2.5
  const wallMat = makeMat(0xd8c9a8)
  const wallY  = FLOOR2_Y + WALL_H / 2
  const openW  = ST_X1 - ST_X0
  const solidW = fw - openW
  addW(box(fw, WALL_H, 0.22, wallMat, cxF, wallY, F2_Z0))
  const winH = 1.1, winBot = 0.9, winTop = WALL_H - winBot - winH
  addW(box(0.22, winBot, fd, wallMat, F2_X0, FLOOR2_Y + winBot/2,                  czF))
  addW(box(0.22, winTop, fd, wallMat, F2_X0, FLOOR2_Y + winBot + winH + winTop/2,  czF))
  addW(box(0.22, winH, fd*0.30, wallMat, F2_X0, FLOOR2_Y + winBot + winH/2, F2_Z0 + fd*0.15))
  addW(box(0.22, winH, fd*0.30, wallMat, F2_X0, FLOOR2_Y + winBot + winH/2, F2_Z1 - fd*0.15))
  addW(box(solidW, WALL_H, 0.22, wallMat, F2_X0 + solidW/2, wallY, F2_Z1))
  addW(box(openW, 0.40, 0.22, wallMat, (ST_X0 + ST_X1)/2, FLOOR2_Y + WALL_H - 0.20, F2_Z1))
  addW(box(0.22, WALL_H, fd, wallMat, F2_X1, wallY, czF))
  return objs
}

// Masterfunction: setzt alle SQL-Geometrie-Werte und baut den Raum auf.
// geo = altes Format: { grid_size, wall_n/s/e/w, door_wall, floors[], staircases[] }
//    ODER neues Format: { v:1, floors:[], stairs:[], rollers:[], spawn:{} }
function buildRoomGeometry(geo) {
  // Altes Raumgeometrie entfernen (bei rebuild)
  for (const o of ROOM_GEOM_OBJECTS) scene.remove(o)
  ROOM_GEOM_OBJECTS.length = 0
  ROOM_DOORS.length = 0

  if (!geo) geo = {}

  // ── Neues Editor-Format erkennen (v:1 aus roomData) ──────────────────────
  if (geo.v === 1 && Array.isArray(geo.floors)) {
    SOLID.length = 0
    ROOM_FLOORS_DATA = []
    ROOM_STAIRS_DATA_NEW = []
    PLACE_FLOOR_MESHES.length = 0
    WALL_MESHES.length = 0
    ROOM_GEOM_OBJECTS.push(..._buildEditorRoom(geo))
    return
  }

  // ── Altes Template-Format ─────────────────────────────────────────────────
  // Reset Editor-Arrays damit getFloorY auf altes Format zurückfällt
  ROOM_FLOORS_DATA = []
  ROOM_STAIRS_DATA_NEW = []
  PLACE_FLOOR_MESHES.length = 0
  WALL_MESHES.length = 0

  GRID = geo.grid_size ?? 20

  // geo.floors = []           → SQL sagt "dieser Raum hat kein Stockwerk" → nichts bauen
  // geo.floors = [{...}]      → SQL-Werte verwenden
  const sqlProvided = geo.floors !== undefined

  const f1 = sqlProvided ? geo.floors[0] : { y_height:7.0, x0:-7, x1:8, z0:-9, z1:-3 }
  if (f1) {
    FLOOR2_Y = f1.y_height ?? 7.0
    F2_X0    = f1.x0       ?? -7;  F2_X1 = f1.x1 ?? 8
    F2_Z0    = f1.z0       ?? -9;  F2_Z1 = f1.z1 ?? -3
  }

  const sc = sqlProvided
    ? geo.staircases?.[0]
    : { x0:5, x1:8, z0:-3, z1:7, from_floor:0, to_floor:1 }
  if (sc) {
    ST_X0 = sc.x0 ?? 5;   ST_X1 = sc.x1 ?? 8
    ST_Z0 = sc.z0 ?? -3;  ST_Z1 = sc.z1 ?? 7
  }

  ROOM_GEOM_OBJECTS.push(..._buildGroundFloor())
  ROOM_GEOM_OBJECTS.push(..._buildGroundWalls(geo))
  if (sc) ROOM_GEOM_OBJECTS.push(..._buildStaircase())
  if (f1) ROOM_GEOM_OBJECTS.push(..._buildUpperFloor())
}
window.buildRoomGeometry = buildRoomGeometry

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR-FORMAT ROOM BUILDER (v:1 — roomData aus room editor)
// Portiert von editor.js. Wird aufgerufen wenn geo.v === 1.
// ─────────────────────────────────────────────────────────────────────────────

const _ED_FAC_Y   = { N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 }
const _STAIR_STEP_D = 1.0
const _STAIR_W_NEW  = 0.92

function _edStairDims(stair, fromY) {
  const steps   = Math.max(2, stair.steps || 4)
  const rise    = stair.height || steps * 0.5
  const stepH   = rise / steps
  const totalD  = steps * _STAIR_STEP_D
  const strLen  = Math.sqrt(totalD * totalD + rise * rise)
  const strAng  = Math.atan2(totalD, rise)
  const w = (stair.width > 0 || stair.width_tiles > 0)
    ? (stair.width || stair.width_tiles)
    : _STAIR_W_NEW
  return { fromY, rise, steps, stepH, totalD, strLen, strAng, w }
}
function _edStairSetup(stair, fromY) {
  const g = new THREE.Group()
  g.rotation.y = _ED_FAC_Y[stair.dir] ?? 0
  g.position.set(stair.x ?? stair.anchor_x ?? 0, fromY, stair.z ?? stair.anchor_z ?? 0)
  return g
}

function _edBuildStairWood(stair, fromY) {
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

function _edBuildStairStone(stair, fromY) {
  const { rise, steps, stepH, totalD, w } = _edStairDims(stair, fromY)
  const g = _edStairSetup(stair, fromY)
  const stoneM = makeMat(0x9a9288), stoneD = makeMat(0x6e6660), stoneL = makeMat(0xbab4ae)
  const hw = w/2
  for (let i = 0; i < steps; i++) {
    const bh = (i+1)*stepH, bz = (i+0.5)*_STAIR_STEP_D
    g.add(box(w, bh, _STAIR_STEP_D-0.04, stoneM, 0, bh/2, bz))
    g.add(box(w, 0.04, _STAIR_STEP_D-0.04, stoneL, 0, bh+0.01, bz))
  }
  for (const sx of [-hw-0.07, hw+0.07]) {
    g.add(box(0.10, rise, totalD, stoneD, sx, rise/2, totalD/2))
  }
  return g
}

function _edBuildStairMetal(stair, fromY) {
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

function _edBuildStairOpen(stair, fromY) {
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

function _edBuildStairClassic(stair, fromY) {
  // Klassische Treppe (analog zu _buildStaircase aber mit Stair-Daten)
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

const _ED_STAIR_BUILDERS = {
  classic: _edBuildStairClassic,
  wood:    _edBuildStairWood,
  stone:   _edBuildStairStone,
  metal:   _edBuildStairMetal,
  open:    _edBuildStairOpen,
}

// ── Editor-Wand bauen (eine Kante einer Etage) ─────────────────────────────────
function _edBuildWall(floor, edge, hasDoor, allStairs, floorY) {
  const objs = []
  const GWALL_H = 2.8
  const WALL_TH = 0.22
  const DOOR_W  = 1.8, DOOR_H = 2.2
  const wallMat  = makeMat(0xd8c9a8)
  const frameMat = makeMat(0x4a2e0a)
  const doorMat  = makeMat(0x7a4e28)

  const horiz  = edge === 'N' || edge === 'S'
  const fixedC = edge === 'N' ? floor.z0 : edge === 'S' ? floor.z1
               : edge === 'W' ? floor.x0 : floor.x1
  const start  = horiz ? floor.x0 : floor.z0
  const end    = horiz ? floor.x1 : floor.z1
  const mid    = (start + end) / 2
  const baseY  = floorY + 0.06

  const seg = (a, b, h = GWALL_H, yOff = 0) => {
    if (b - a < 0.01) return
    const l = b - a, c = (a + b) / 2
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? l : WALL_TH, h, horiz ? WALL_TH : l),
      wallMat
    )
    m.position.set(horiz ? c : fixedC, baseY + yOff + h / 2, horiz ? fixedC : c)
    m.receiveShadow = true
    m.userData.isWall = true
    m.userData.wallEdge = edge
    m.userData.wallCoord = fixedC
    m.userData.wallFloorY = floorY
    scene.add(m); objs.push(m)
    WALL_MESHES.push(m)
  }

  // Treppenlücken berechnen
  const stairGaps = []
  for (const stair of (allStairs || [])) {
    const [dx, dz] = _STAIR_DV[stair.dir] || [0, 1]
    const hw = ((stair.width || stair.width_tiles || 3)) / 2
    const ax = stair.x ?? stair.anchor_x ?? 0
    const az = stair.z ?? stair.anchor_z ?? 0
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

  const allGaps = stairGaps.map(sg => ({ gs: sg.center - sg.width / 2, ge: sg.center + sg.width / 2, isDoor: false }))
  const PW = 0.14
  const aboveH = GWALL_H - DOOR_H

  if (hasDoor) allGaps.push({ gs: mid - DOOR_W / 2, ge: mid + DOOR_W / 2, isDoor: true })

  const _wTh = WALL_TH / 2
  const _wLvl = floor.floor_index != null ? floor.floor_index : (parseInt((floor.id || '0').replace(/\D/g, ''), 10) || 0)
  const solidSeg = (a, b) => {
    if (b - a < 0.01) return
    if (horiz) addSolid(a, b, fixedC - _wTh, fixedC + _wTh, _wLvl)
    else        addSolid(fixedC - _wTh, fixedC + _wTh, a, b, _wLvl)
  }

  if (!hasDoor && allGaps.length === 0) { seg(start, end); solidSeg(start, end); return objs }

  allGaps.sort((a, b) => a.gs - b.gs)
  let cursor = start
  for (const gap of allGaps) { seg(cursor, gap.gs); solidSeg(cursor, gap.gs); cursor = gap.ge }
  seg(cursor, end); solidSeg(cursor, end)

  if (hasDoor) {
    const dgs = mid - DOOR_W / 2, dge = mid + DOOR_W / 2
    seg(dgs, dge, aboveH, DOOR_H)
    // Türrahmen-Pfosten
    for (const side of [-1, 1]) {
      const along = side < 0 ? dgs + PW / 2 : dge - PW / 2
      const post  = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? PW : WALL_TH + 0.12, DOOR_H, horiz ? WALL_TH + 0.12 : PW),
        frameMat
      )
      post.position.set(horiz ? along : fixedC, baseY + DOOR_H / 2, horiz ? fixedC : along)
      scene.add(post); objs.push(post)
    }
    // Tür-Panel — startet geschlossen (rotation.y = 0)
    const pivot = new THREE.Group()
    pivot.position.set(horiz ? dge : fixedC, baseY, horiz ? fixedC : dge)
    pivot.rotation.y = 0   // geschlossen
    scene.add(pivot); objs.push(pivot)
    const panelW = DOOR_W - PW * 2
    const panel  = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? panelW : WALL_TH, DOOR_H - 0.03, horiz ? WALL_TH : panelW),
      doorMat
    )
    panel.position.set(horiz ? -panelW / 2 : 0, (DOOR_H - 0.03) / 2, horiz ? 0 : -panelW / 2)
    pivot.add(panel)
    // Türklinke
    const klinke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), makeMat(0xd4a020))
    klinke.position.set(horiz ? -panelW + 0.25 : 0.08, (DOOR_H - 0.03) * 0.44, horiz ? 0.08 : -panelW + 0.25)
    pivot.add(klinke)
    // Türe registrieren für Auto-Öffnen
    const doorCx = horiz ? mid : fixedC
    const doorCz = horiz ? fixedC : mid
    // Öffnungswinkel: Tür schwingt nach innen
    const openAngle = (edge === 'S' || edge === 'E') ? Math.PI / 2 : -Math.PI / 2
    ROOM_DOORS.push({ pivot, wx: doorCx, wz: doorCz, angle: 0, target: 0, openAngle })
  }
  return objs
}

// ── Eine Etage bauen (Boden-Tiles + Wände) ────────────────────────────────────
function _edBuildFloor(floor, allStairs) {
  const objs   = []
  const floorY = floor.y ?? floor.y_height ?? 0
  const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
  const matA    = makeMat(floor.colorA ?? floor.color_a ?? 0x4a7a5a)
  const matB    = makeMat(floor.colorB ?? floor.color_b ?? 0x527d63)

  const tilesX = Math.max(1, Math.round((floor.x1 - floor.x0) / TILE))
  const tilesZ = Math.max(1, Math.round((floor.z1 - floor.z0) / TILE))
  const holesSet = new Set((floor.holes || []).map(([tx, tz]) => `${tx},${tz}`))

  for (let xi = 0; xi < tilesX; xi++) {
    for (let zi = 0; zi < tilesZ; zi++) {
      if (holesSet.has(`${xi},${zi}`)) continue
      const mat  = (xi + zi) % 2 === 0 ? matA : matB
      const tile = new THREE.Mesh(tileGeo, mat)
      tile.position.set(floor.x0 + (xi + 0.5) * TILE, floorY, floor.z0 + (zi + 0.5) * TILE)
      tile.receiveShadow = true
      tile.userData.isFloorTile = true
      scene.add(tile); objs.push(tile)
      PLACE_FLOOR_MESHES.push(tile)
    }
  }


  // Grid-Overlay
  const fw = floor.x1 - floor.x0, fd = Math.abs(floor.z1 - floor.z0)
  const cxF = (floor.x0 + floor.x1) / 2, czF = (floor.z0 + floor.z1) / 2
  const maxT = Math.max(tilesX, tilesZ)
  const gh = new THREE.GridHelper(maxT, maxT, 0x000000, 0x000000)
  gh.scale.set(tilesX / maxT, 1, tilesZ / maxT)
  gh.position.set(cxF, floorY + 0.065, czF)
  gh.material.opacity = 0.09; gh.material.transparent = true
  scene.add(gh); objs.push(gh)

  // Wände pro Kante
  for (const edge of ['N', 'S', 'E', 'W']) {
    const hasW = !!(floor['wall' + edge] ?? floor['wall_' + edge.toLowerCase()])
    const hasD = !!(floor['door' + edge] ?? floor['door_' + edge.toLowerCase()])
    if (hasW) objs.push(..._edBuildWall(floor, edge, hasD, allStairs, floorY))
  }
  return objs
}

// ── Eine Treppe bauen ──────────────────────────────────────────────────────────
function _edBuildStair(stair, fromY) {
  const style   = stair.style || 'classic'
  const builder = _ED_STAIR_BUILDERS[style] || _edBuildStairClassic
  const g       = builder(stair, fromY)
  g.traverse(m => {
    if (m.isMesh) {
      m.castShadow = m.receiveShadow = true
      m.userData.isFloorTile = true
      PLACE_FLOOR_MESHES.push(m)
    }
  })
  scene.add(g)
  // Alle Kinder-Meshes + Group zurückgeben
  const objs = [g]
  return objs
}

// ── Gesamten Raum im Editor-Format aufbauen ────────────────────────────────────
function _buildEditorRoom(geo) {
  // ROOM_FLOORS_DATA + ROOM_STAIRS_DATA_NEW für getFloorY + Level-Tracking befüllen
  ROOM_FLOORS_DATA = geo.floors.map(f => ({
    floor_index: f.floor_index != null ? f.floor_index : (parseInt((f.id || '0').replace(/\D/g, ''), 10) || 0),
    x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1,
    y: f.y != null ? f.y : (f.y_height != null ? f.y_height : 0),
  }))
  ROOM_STAIRS_DATA_NEW = (geo.stairs || []).map(s => {
    const fromIdx = s.from_floor != null ? s.from_floor : (parseInt((s.fromFloorId || '0').replace(/\D/g, ''), 10) || 0)
    const fromFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === fromIdx)
    const toRaw = s.to_floor != null ? s.to_floor : parseInt((s.toFloorId || '').replace(/\D/g, ''), 10)
    return {
      anchor_x: s.x != null ? s.x : (s.anchor_x || 0),
      anchor_z: s.z != null ? s.z : (s.anchor_z || 0),
      dir:      s.dir || 'N',
      width:    s.width != null ? s.width : (s.width_tiles != null ? s.width_tiles : 3),
      steps:    s.steps || 14,
      height:   s.height || 7,
      from_floor: fromIdx,
      to_floor:   (toRaw != null && !isNaN(toRaw)) ? toRaw : 1,
      base_y:     fromFloor ? fromFloor.y : 0,
    }
  })

  const objs = []
  // Etagen
  for (const floor of geo.floors) {
    objs.push(..._edBuildFloor(floor, geo.stairs || []))
  }
  // Treppen
  for (const stair of (geo.stairs || [])) {
    const fromIdx   = stair.from_floor != null ? stair.from_floor : (parseInt((stair.fromFloorId || '0').replace(/\D/g, ''), 10) || 0)
    const fromFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === fromIdx)
    objs.push(..._edBuildStair(stair, fromFloor ? fromFloor.y : 0))
  }
  // Roller (buildGameRoller existiert bereits)
  for (const roller of (geo.rollers || [])) {
    const flIdx   = roller.floor_idx != null ? roller.floor_idx : (parseInt((roller.floorId || '0').replace(/\D/g, ''), 10) || 0)
    const flData  = ROOM_FLOORS_DATA.find(f => +f.floor_index === flIdx)
    const floorY  = flData ? flData.y : 0
    const rg = buildGameRoller(roller.x, roller.z, roller.dir, floorY)
    if (rg) objs.push(rg)  // buildGameRoller fügt rg selbst zu scene hinzu
  }
  // Spawn-Punkt setzen
  if (geo.spawn && typeof char !== 'undefined') {
    const spawnFlIdx = geo.spawn.floor_idx != null ? geo.spawn.floor_idx : (parseInt((geo.spawn.floorId || '0').replace(/\D/g, ''), 10) || 0)
    char.x     = geo.spawn.x ?? 0
    char.z     = geo.spawn.z ?? 0
    char.level = spawnFlIdx
    char.target = null
    // Parent über Spawn-Position informieren → löst avatar-spawn-request mit korrekten Coords aus
    window.parent?.postMessage({ type: 'CHAR_SPAWN_POS', x: char.x, z: char.z, dir: char.dir ?? 0 }, '*')
  }
  return objs
}

// ─── Teleport Wardrobe Pair ────────────────────────────────────────────────────
let warpA = null, warpB = null
