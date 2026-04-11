// ─── game3d-placement.js ── Placement mechanics, ghost system, object management ──
console.log('[game3d-placement] v20260409u geladen ✓')
// Depends on: game3d-core.js, game3d-furniture.js (spawnPlaced, findCatalogItem, findRollerAt, etc.)

var heldItem   = null     // { ...catalogEntry, facing: 0-3 }
var ghostGroup = null     // preview mesh in scene
var heldQty    = Infinity // remaining placements for current held item (set via PLACE_ITEM)
var canPlaceFurniture = false  // wird via ROOM_INIT is_owner gesetzt

function ghostMat(color = 0x3a7bd5) {
  return new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.45 })
}

function buildGhost(item) {
  if (ghostGroup) { scene.remove(ghostGroup); ghostGroup = null }
  const dir = FACING_DIRS[item.facing ?? 0]
  const g = new THREE.Group()

  if (item.id === 'chair') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.58), ghostMat()))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.08), ghostMat()))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'table') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.09, 0.80), ghostMat()))
  } else if (item.id === 'sofa') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.60, 0.75), ghostMat()))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'lamp' || item.id === 'test_lamp') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.50, 0.14), ghostMat(0xffe87c)))
  } else if (item.id === 'plant') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.20, 0.44), ghostMat(0x44aa44)))
  } else if (item.id === 'roller') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.92), ghostMat()))
    const arrowGroup = new THREE.Group()
    arrowGroup.position.y = 0.22
    const arr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 3), ghostMat(0xddcc00))
    arr.rotation.x = Math.PI / 2
    arrowGroup.add(arr)
    arrowGroup.rotation.y = { N: Math.PI, S: 0, E: -Math.PI/2, W: Math.PI/2 }[dir]
    g.add(arrowGroup)
  } else if (item.id === 'armchair') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.50, 0.70), ghostMat(0x8b4513)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'bookshelf') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.75, 0.28), ghostMat(0xaa7744)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'tv') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.10), ghostMat(0x222244)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'dresser') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.84, 0.52), ghostMat(0xaa7744)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'bed') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.50, 2.20), ghostMat(0x4466aa)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'discoball') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.30, 8, 6), ghostMat(0xcccccc)))
    g.position.y = 1.25
  } else if (item.id === 'djdesk') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.88, 0.80), ghostMat(0x222244)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'balloon') {
    for (let i = 0; i < 3; i++) {
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.20,6,5), ghostMat(0xff6644))
      b2.position.set(-0.18+i*0.18, 1.40, 0); g.add(b2)
    }
  } else if (item.id === 'partyflag') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.20, 0.06), ghostMat(0xffcc44)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'neon') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.55, 0.08), ghostMat(0xff44ff)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id.startsWith('frame_')) {
    // Flat vertical wall panel — ghost positioned at wall face via mousemove offset
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.72, 0.06), ghostMat(0xaaaaff)))
    g.rotation.y = FACING_Y[dir]
    // Show a small arrow to indicate which wall direction
    const arw = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.20), ghostMat(0xffffff))
    arw.position.set(0, 0.44, -0.14); g.add(arw)
  } else if (item.id === 'barstool') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.92, 0.44), ghostMat()))
  } else if (item.id === 'ottoman') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.32, 0.70), ghostMat(0xaa6622)))
  } else if (item.id === 'bench') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.50, 0.42), ghostMat(0xaa7744)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'stool') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.50, 0.46), ghostMat(0xaa7744)))
  } else if (item.id === 'barcounter') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.80, 1.12, 0.65), ghostMat(0x884422)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'drinksshelf') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.00, 1.60, 0.28), ghostMat(0x884422)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'cocktailtable') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,0.96,10), ghostMat(0x4488cc)))
  } else if (item.id === 'fridge') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.75, 0.62), ghostMat(0xccccee)))
    g.rotation.y = FACING_Y[dir]
  } else if (item.id === 'beertap') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.80, 0.38), ghostMat(0x888898)))
  }

  // Footprint indicator ring — nur für Boden-Items, nicht für Wand-Frames
  if (!item.id.startsWith('frame_')) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.56, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.05
    g.add(ring)
  }

  ghostGroup = g
  ghostGroup.visible = true
  scene.add(ghostGroup)
}

function clearHeld() {
  heldItem = null
  heldQty  = Infinity
  if (ghostGroup) { scene.remove(ghostGroup); ghostGroup = null }
}

// Called after each successful placement when running embedded.
// Wenn heldItem.isMoving gesetzt: server-autoritatives PATCH (kein Inventar-Decrement)
// Sonst: normales Platzieren aus Inventar (ITEM_PLACED + ROOM_FURNITURE_PLACED)
function _notifyItemPlaced() {
  if (!heldItem) return

  const placed = PLACED_OBJECTS[PLACED_OBJECTS.length - 1]
  if (!placed) return

  if (heldItem.isMoving) {
    // ── Move-Modus: server-autoritatives PATCH (kein Duplikat, kein Inventar-Decrement) ──
    window.parent?.postMessage({
      type:          'ROOM_FURNITURE_MOVED',
      old_server_id: heldItem.isMoving.oldServerId,
      uuid:          placed.uuid,
      item_code:     placed.type,
      x:             placed.x,
      z:             placed.z,
      floor_level:   placed.floorLevel ?? char.level,
      facing_idx:    placed.facingIdx,
      wy:            placed.wy ?? null,
    }, '*')
    // Move ist einmalig → Ghost sofort beenden (verhindert Duplikate)
    clearHeld()
  } else {
    // ── Normal: aus Inventar platziert ──
    window.parent?.postMessage({ type: 'ITEM_PLACED', item_code: heldItem.id }, '*')
    const msgType = heldItem.id === 'room_npc' ? 'ROOM_NPC_PLACED' : 'ROOM_FURNITURE_PLACED'
    window.parent?.postMessage({
      type:        msgType,
      uuid:        placed.uuid,
      item_code:   placed.type,
      x:           placed.x,
      z:           placed.z,
      floor_level: char.level,
      facing_idx:  placed.facingIdx,
      wy:          placed.wy ?? null,
    }, '*')

    if (isFinite(heldQty)) {
      heldQty--
      if (heldQty <= 0) clearHeld()
    }
  }
}

function pickItem(id) {
  if (heldItem?.id === id) { clearHeld(); return }
  const entry = findCatalogItem(id)
  if (!entry) return
  heldItem = { ...entry, facing: entry.id === 'roller' ? 2 : 0 }
  buildGhost(heldItem)
}
window.pickItem = pickItem

// ─── Placed stair zones (dynamic ramp logic for walkable stairs) ──────────────
function addStairZone(uuid, wx, wz, facingDir, rise, totalD) {
  const hw = 0.62
  let x0, x1, z0, z1, toX, toZ
  if      (facingDir === 'S') { x0=wx-hw;      x1=wx+hw;      z0=wz;          z1=wz+totalD; toX=wx;          toZ=wz+totalD }
  else if (facingDir === 'N') { x0=wx-hw;      x1=wx+hw;      z0=wz-totalD;   z1=wz;        toX=wx;          toZ=wz-totalD }
  else if (facingDir === 'E') { x0=wx;         x1=wx+totalD;  z0=wz-hw;       z1=wz+hw;     toX=wx+totalD;   toZ=wz }
  else                        { x0=wx-totalD;  x1=wx;         z0=wz-hw;       z1=wz+hw;     toX=wx-totalD;   toZ=wz }
  STAIR_ZONES.push({ uuid, x0, x1, z0, z1, fromX: wx, fromZ: wz, toX, toZ, rise, totalD })
}

// ─── Teleport zones (portal pads) ────────────────────────────────────────────
function addTeleportZone(uuid, wx, wz) {
  TELEPORT_ZONES.push({ uuid, wx, wz })
}

// Check if character stepped on a teleporter pad. Called each frame.
function checkTeleport(dt) {
  if (_teleportTimer > 0) { _teleportTimer -= dt; return }
  if (char.state !== 'idle' && char.state !== 'walk') return

  for (let i = 0; i < TELEPORT_ZONES.length; i++) {
    const zone = TELEPORT_ZONES[i]
    const dx = char.x - zone.wx, dz = char.z - zone.wz
    if (dx * dx + dz * dz > 0.36) continue   // radius ~0.6 tiles

    // Find pair: 0↔1, 2↔3 — only teleport if pair exists
    const pairIdx = i % 2 === 0 ? i + 1 : i - 1
    if (pairIdx < 0 || pairIdx >= TELEPORT_ZONES.length) break   // no pair placed yet

    const dest = TELEPORT_ZONES[pairIdx]
    char.x = dest.wx
    char.z = dest.wz
    char.target = null
    _teleportTimer = 1.5   // 1.5 s cooldown to avoid ping-pong
    break
  }
}

// ─── Placed-object registry (inventory items only) ────────────────────────────
var PLACED_OBJECTS = []   // { uuid, type, x, z, floorLevel, facingIdx, group, meshes } — var for cross-script access
var PLACED_MESHES  = []   // all mesh refs for raycasting — var for cross-script access
var   selectedPlaced = null // currently selected placed object

// ── Server-backed room persistence ───────────────────────────────────────
// Placements are saved/loaded via the parent window (postMessage).
// game3d.js never touches localStorage for room furniture.

function saveScene() {
  // no-op: persistence is handled by the parent via ROOM_FURNITURE_PLACED messages
}

// Restore placed objects from a placements array (sent by parent in ROOM_INIT)
function loadScene(placements) {
  if (!Array.isArray(placements)) return
  // Clear existing placed objects first — prevents duplication when ROOM_INIT fires multiple times
  while (PLACED_OBJECTS.length > 0) {
    deletePlacedObj(PLACED_OBJECTS[0].uuid, true)
  }
  for (const item of placements) {
    const facingIdx  = item.facing_idx ?? item.facingIdx ?? 0
    const itemCode   = item.item_code ?? item.type
    let floorLevel = item.floor_level ?? 0
    // Set placement level so _lvlBase picks the right floor for this item (auch 0 ist explizit!)
    _currentPlaceLevel = floorLevel
    // Für Wand-Frames: gespeicherte Y-Position an buildFrame weitgeben
    if (itemCode?.startsWith('frame_') && typeof item.wy === 'number') {
      window._pendingFrameWy = item.wy
    }
    const _s0 = _solidStart()
    const grp = spawnPlaced(itemCode, item.x, item.z, facingIdx, floorLevel)
    const _s1 = _solidEnd()
    window._pendingFrameWy = undefined
    _currentPlaceLevel = null
    if (grp) {
      // Wall frames: buildFrame berechnet Position selbst
      const isWallFrame = itemCode?.startsWith('frame_')
      if (!isWallFrame) {
        // ── Korrekte Etage bestimmen ────────────────────────────────────────────────
        // Primär: floor_level aus DB (wurde aber früher manchmal als 0 falsch gespeichert)
        // Fallback: Item liegt nur auf einer Etage (nicht Ground) → das muss die richtige sein
        let detectedFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === floorLevel)
        if (!detectedFloor && ROOM_FLOORS_DATA.length > 0) {
          detectedFloor = ROOM_FLOORS_DATA[0]  // Erdgeschoss als Notfall-Fallback
        }
        // Falls floor_level=0 (evtl. falsch), aber Item liegt exklusiv auf Upper-Floor-Fläche
        // (x/z passt zu einer Oberfläche mit floor_index>=1 aber NICHT zur Ground-Fläche),
        // dann korrigieren
        if (ROOM_FLOORS_DATA.length > 1 && floorLevel === 0) {
          const upperCandidates = ROOM_FLOORS_DATA.filter(f =>
            +f.floor_index >= 1 &&
            item.x >= f.x0 - 0.5 && item.x <= f.x1 + 0.5 &&
            item.z >= f.z0 - 0.5 && item.z <= f.z1 + 0.5
          )
          const groundFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === 0)
          if (upperCandidates.length > 0) {
            // Nur auf Upper korrigieren wenn Ground-Boden kleiner ist (Item nicht im Ground-exklusiven Bereich)
            // ODER wenn saved wy deutlich über 0 liegt (Item wurde physisch oben gerettet)
            const wyIndicatesUpper = typeof item.wy === 'number' && item.wy > 1.0
            if (wyIndicatesUpper || !groundFloor) {
              detectedFloor = upperCandidates.sort((a,b) => b.floor_index - a.floor_index)[0]
            }
          }
        }
        const correctBaseY = detectedFloor ? detectedFloor.y + 0.06
                           : (floorLevel >= 1 ? FLOOR2_Y + 0.06 : 0.06)
        const effectiveLevel = detectedFloor ? +detectedFloor.floor_index : floorLevel
        // wy aus DB nur wenn deutlich über Etagenfläche (Roller-Stapel)
        if (typeof item.wy === 'number' && item.wy > correctBaseY + 0.1) {
          grp.position.y = item.wy
        } else {
          grp.position.y = correctBaseY
        }
        // Etagen-Level korrigieren falls falsch gespeichert
        floorLevel = effectiveLevel
      }
      registerPlaced(itemCode, item.x, item.z, facingIdx, grp, item.id, floorLevel, _s0, _s1)
      if (itemCode !== 'roller' && findRollerAt(item.x, item.z)) {
        grp.position.y += ROLLER_H
      }
    }
  }
}

// Track SOLID zones added during a spawnPlaced call
// Usage: const s0 = _solidStart(); spawnPlaced(...); registerPlaced(..., s0, _solidEnd())
function _solidStart() { return SOLID.length }
function _solidEnd()   { return SOLID.length }

function registerPlaced(type, x, z, facingIdx, group, serverId = null, floorLevel = 0, solidStart = -1, solidEnd = -1) {
  const meshes = []
  group.traverse(m => { if (m.isMesh) { m.userData.placedUUID = group.uuid; meshes.push(m) } })
  // Link seating objects to their SEATS entry so roller movement stays in sync
  let seatRef = null
  if (SEATING_TYPES_ALL.includes(type)) {
    seatRef = SEATS.find(s => Math.abs(s.x - x) < 0.15 && Math.abs(s.z - z) < 0.15) ?? null
  }
  PLACED_OBJECTS.push({ uuid: group.uuid, type, x, z, floorLevel, facingIdx, wy: group.position.y, serverId, group, meshes, rollerTarget: null, seatRef, solidStart, solidEnd })
  PLACED_MESHES.push(...meshes)
}

function deletePlacedObj(uuid, skipSave = false) {
  const idx = PLACED_OBJECTS.findIndex(o => o.uuid === uuid)
  if (idx < 0) return
  const obj = PLACED_OBJECTS[idx]
  scene.remove(obj.group)
  obj.group.visible = false  // belt defense: force invisible even if scene.remove lags one frame
  obj.meshes.forEach(m => { const i = PLACED_MESHES.indexOf(m); if (i >= 0) PLACED_MESHES.splice(i,1) })
  if (obj.type === 'roller') {
    const ri = GAME_ROLLERS.findIndex(r => r.group === obj.group)
    if (ri >= 0) {
      GAME_ROLLERS[ri].beltSlats.forEach(s => { const bi = ROLLER_BELT_MESHES.indexOf(s); if (bi>=0) ROLLER_BELT_MESHES.splice(bi,1) })
      GAME_ROLLERS.splice(ri, 1)
    }
  }
  if (SEATING_TYPES_ALL.includes(obj.type)) {
    if (obj.type === 'jacuzzi') {
      // Jacuzzi hat 4 Seats innerhalb ~1.2 Einheiten vom Zentrum
      for (let si = SEATS.length - 1; si >= 0; si--) {
        if (Math.hypot(SEATS[si].x - obj.x, SEATS[si].z - obj.z) < 1.2) SEATS.splice(si, 1)
      }
      const ji = JACUZZI_OBJECTS.findIndex(j => j.group === obj.group)
      if (ji >= 0) JACUZZI_OBJECTS.splice(ji, 1)
    } else {
      const si = SEATS.findIndex(s => Math.abs(s.x - obj.x) < 0.1 && Math.abs(s.z - obj.z) < 0.1)
      if (si >= 0) SEATS.splice(si, 1)
    }
  }
  // Remove stair zone if this was a stair
  const STAIR_TYPES = ['stair_wood','stair_stone','stair_metal','stair_open','stair_down']
  if (STAIR_TYPES.includes(obj.type)) {
    const si = STAIR_ZONES.findIndex(z => z.uuid === uuid)
    if (si >= 0) STAIR_ZONES.splice(si, 1)
  }
  // Remove teleport zone if this was a teleporter
  if (obj.type === 'teleporter') {
    const ti = TELEPORT_ZONES.findIndex(z => z.uuid === uuid)
    if (ti >= 0) TELEPORT_ZONES.splice(ti, 1)
  }
  if (obj.type === 'fridge') {
    const fi = FRIDGES.findIndex(f => f.group === obj.group)
    if (fi >= 0) FRIDGES.splice(fi, 1)
  }
  // Remove SOLID zones that were added when this object was spawned
  if (obj.solidStart >= 0 && obj.solidEnd > obj.solidStart) {
    // Remove from back to front to keep indices stable
    for (let si = obj.solidEnd - 1; si >= obj.solidStart; si--) {
      if (si < SOLID.length) SOLID.splice(si, 1)
    }
  }
  PLACED_OBJECTS.splice(idx, 1)
  selectedPlaced = null
  hideObjMenu()
  if (!skipSave && obj.serverId != null) {
    const delType = obj.isNpc ? 'ROOM_NPC_DELETED' : 'ROOM_FURNITURE_DELETED'
    window.parent?.postMessage({ type: delType, server_id: obj.serverId, item_code: obj.type }, '*')
  }
}

function rotatePlacedObj(uuid) {
  if (!canPlaceFurniture) return
  const obj = PLACED_OBJECTS.find(o => o.uuid === uuid)
  if (!obj) return
  const cat = findCatalogItem(obj.type)
  if (!cat?.rotatable) return
  const newFacing = (obj.facingIdx + 1) % 4
  const oldServerId = obj.serverId
  const objFloorLevel = obj.floorLevel ?? 0
  // Altes Objekt merken und entfernen
  const oldGroup = obj.group
  deletePlacedObj(uuid, true)
  // Sicherheitshalber: alte Group wirklich aus der Scene entfernen (falls deletePlacedObj es nicht geschafft hat)
  if (oldGroup && oldGroup.parent) scene.remove(oldGroup)
  _currentPlaceLevel = objFloorLevel
  const _rs0 = _solidStart()
  const grp = spawnPlaced(obj.type, obj.x, obj.z, newFacing, objFloorLevel)
  const _rs1 = _solidEnd()
  _currentPlaceLevel = null
  if (grp) {
    // Korrekte Etagen-Y per X/Z-Position erzwingen
    // Roller und andere Items die absolute Child-Positionen nutzen: Y NICHT überschreiben
    // (buildGameRoller positioniert Children absolut, Group bleibt bei 0/0/0)
    const skipYOverride = (obj.type === 'roller')
    if (!skipYOverride && !obj.type?.startsWith('frame_')) {
      let flRot = ROOM_FLOORS_DATA.length > 0
        ? ROOM_FLOORS_DATA.filter(f => obj.x >= f.x0 - 0.5 && obj.x <= f.x1 + 0.5 &&
                                        obj.z >= f.z0 - 0.5 && obj.z <= f.z1 + 0.5)
            .sort((a, b) => b.floor_index - a.floor_index)[0]
        : null
      if (!flRot) flRot = ROOM_FLOORS_DATA.find(f => +f.floor_index === objFloorLevel)
      grp.position.y = flRot ? flRot.y + 0.06 : (objFloorLevel >= 1 ? FLOOR2_Y + 0.06 : 0.06)
    }
    registerPlaced(obj.type, obj.x, obj.z, newFacing, grp, oldServerId, objFloorLevel, _rs0, _rs1)
    selectPlaced(grp.uuid)
    // SQL: PATCH (atomarer Update) statt DELETE+INSERT
    const placed = PLACED_OBJECTS.find(o => o.uuid === grp.uuid)
    if (oldServerId != null) {
      window.parent?.postMessage({
        type: 'ROOM_FURNITURE_MOVED',
        uuid: grp.uuid, old_server_id: oldServerId,
        x: obj.x, z: obj.z, floor_level: objFloorLevel,
        facing_idx: newFacing, wy: placed?.wy ?? null
      }, '*')
    } else {
      // Noch kein server_id (gerade erst platziert) — Fallback: neuen Eintrag anlegen
      window.parent?.postMessage({
        type: 'ROOM_FURNITURE_PLACED',
        uuid: grp.uuid, item_code: obj.type,
        x: obj.x, z: obj.z, floor_level: objFloorLevel,
        facing_idx: newFacing, wy: placed?.wy ?? null
      }, '*')
    }
  }
}
window.rotatePlacedObj = rotatePlacedObj
window.deletePlacedObj = deletePlacedObj

function selectPlaced(uuid) {
  selectedPlaced = PLACED_OBJECTS.find(o => o.uuid === uuid) || null
  if (selectedPlaced) showFurniturePanelForObj(selectedPlaced)
  else hideFurniturePanel()
}

// ── Object context-menu (screen-space overlay) ─────────────────────────────
const objMenuEl = document.getElementById('obj-menu')

function worldToScreen(wx, wy, wz) {
  const v = new THREE.Vector3(wx, wy, wz).project(camera)
  return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }
}

function showObjMenu(obj) {
  if (!objMenuEl) return
  const cat = findCatalogItem(obj.type)
  objMenuEl.querySelector('#om-rotate').style.display = cat?.rotatable ? '' : 'none'
  objMenuEl.querySelector('#om-rotate').onclick = () => rotatePlacedObj(obj.uuid)
  objMenuEl.querySelector('#om-delete').onclick = () => deletePlacedObj(obj.uuid)
  objMenuEl.style.display = 'flex'
  updateObjMenuPos(obj)
}

function hideObjMenu() {
  if (objMenuEl) objMenuEl.style.display = 'none'
  // Furniture-Panel ebenfalls schließen (beide zeigen dasselbe an)
  hideFurniturePanel()
}

// ─── Habbo-style Furniture Panel (bottom-right) ───────────────────────────────
const furniturePanelEl = document.getElementById('furniture-panel')

// ── Mini-Renderer für Möbel-Previews ─────────────────────────────────────────
// Rendert ein Möbel einmalig als PNG, cached in localStorage (Key: fp_prev_v1_{type})
const _fpPreviewCache = new Map()  // session-cache: type → dataURL (für _renderFurniturePreview intern)

let _fpRenderer = null
function _getFpRenderer() {
  if (_fpRenderer) return _fpRenderer
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  r.setSize(160, 160)
  r.setClearColor(0x000000, 0)
  r.localClippingEnabled = true  // für Roller-Belt clippingPlanes
  _fpRenderer = r
  return r
}

function _renderFurniturePreview(type) {
  // 1. Session-Cache
  const cached = _fpPreviewCache.get(type)
  if (cached) return cached

  // 2. Build-Funktion ermitteln
  const fromRegistry = typeof ITEM_DEFS !== 'undefined' ? ITEM_DEFS.get(type) : null
  const camel = 'build' + type.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  const fromWindow = typeof window[camel] === 'function' ? window[camel] : null
  const buildFn = fromRegistry || fromWindow
  console.log(`[FP-Preview] type=${type} | ITEM_DEFS=${!!fromRegistry} | window.${camel}=${!!fromWindow} | buildFn=${!!buildFn}`)
  if (!buildFn) { console.warn('[FP-Preview] Kein Builder gefunden für', type); return null }

  try {
    const rend   = _getFpRenderer()
    const fScene = new THREE.Scene()
    fScene.background = null

    // Licht
    const amb  = new THREE.AmbientLight(0xffffff, 0.85)
    const dir  = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(4, 8, 6)
    fScene.add(amb, dir)

    // Möbel bauen & zentrieren
    // Merke Array-Längen VOR dem Build — buildGameRoller hat Seiten-Effekte (scene.add + Array-Pushes)
    const _rollersBefore = typeof GAME_ROLLERS !== 'undefined' ? GAME_ROLLERS.length : -1
    const _beltsBefore   = typeof ROLLER_BELT_MESHES !== 'undefined' ? ROLLER_BELT_MESHES.length : -1

    const grp = buildFn(0, 0, 0)

    // buildGameRoller fügt die Gruppe direkt zur Haupt-scene hinzu → aus Haupt-scene entfernen
    if (typeof scene !== 'undefined') scene.remove(grp)
    // Phantom-Einträge aus globalen Arrays bereinigen
    if (_rollersBefore >= 0 && typeof GAME_ROLLERS !== 'undefined') GAME_ROLLERS.splice(_rollersBefore)
    if (_beltsBefore  >= 0 && typeof ROLLER_BELT_MESHES !== 'undefined') ROLLER_BELT_MESHES.splice(_beltsBefore)

    fScene.add(grp)

    // Bounding Box → Kamera anpassen
    const box3  = new THREE.Box3().setFromObject(grp)
    const ctr   = box3.getCenter(new THREE.Vector3())
    const size3 = box3.getSize(new THREE.Vector3())
    const maxD  = Math.max(size3.x, size3.y, size3.z) * 0.72

    // Isometrische Kamera (gleicher Winkel wie Hauptkamera)
    const fCam = new THREE.OrthographicCamera(-maxD, maxD, maxD, -maxD, 0.01, 100)
    fCam.position.set(ctr.x + maxD * 1.4, ctr.y + maxD * 1.6, ctr.z + maxD * 1.4)
    fCam.lookAt(ctr)

    rend.render(fScene, fCam)
    const dataURL = rend.domElement.toDataURL('image/png')

    // Aufräumen
    fScene.remove(grp)
    grp.traverse(o => { o.geometry?.dispose(); if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material?.dispose() })

    _fpPreviewCache.set(type, dataURL)
    return dataURL
  } catch (err) {
    console.warn('[FP] Preview render error for', type, err)
    return null
  }
}

// Sicherstellen dass Preview + Owner-Elemente im Panel vorhanden sind
// (falls index.html gecacht wird, erzeugt JS sie dynamisch)
;(() => {
  if (!furniturePanelEl) return
  const actionsEl = furniturePanelEl.querySelector('.fp-actions')

  if (!document.getElementById('fp-preview-icon')) {
    const prev = document.createElement('div')
    prev.id = 'fp-preview-icon'
    prev.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:16px 0 12px;font-size:52px;line-height:1;border-bottom:1px solid rgba(255,255,255,0.07)'
    prev.textContent = '📦'
    furniturePanelEl.insertBefore(prev, actionsEl)
  }

  if (!document.getElementById('fp-owner-name')) {
    const ownerDiv = document.createElement('div')
    ownerDiv.style.cssText = 'display:flex;align-items:center;gap:5px;padding:7px 14px 7px;font-size:11px;color:rgba(255,255,255,0.40);border-bottom:1px solid rgba(255,255,255,0.06)'
    ownerDiv.innerHTML = '👤 Besitzer:\u00a0<span id="fp-owner-name" style="color:rgba(255,255,255,0.80);font-weight:600">—</span>'
    const prevEl = document.getElementById('fp-preview-icon')
    furniturePanelEl.insertBefore(ownerDiv, prevEl ? prevEl.nextSibling : actionsEl)
    console.log('[FP] fp-owner-name dynamisch erzeugt')
  }
})()

/** Zeigt das Habbo-Panel für ein beliebiges platziertes Objekt */
function showFurniturePanelForObj(obj) {
  if (!furniturePanelEl) { console.warn('[FP] furniturePanelEl ist null!'); return }
  hidePlayerPanel()
  const cat  = findCatalogItem(obj.type)
  const icon = cat?.icon ?? '📦'
  const _id  = (id) => document.getElementById(id)
  console.log('[FP] showFurniturePanelForObj', obj.type, '| icon:', icon,
    '| fp-preview-icon:', !!_id('fp-preview-icon'),
    '| fp-owner-name:', !!_id('fp-owner-name'),
    '| _roomOwnerName:', typeof _roomOwnerName !== 'undefined' ? _roomOwnerName : 'UNDEFINED')
  if (_id('fp-icon-sm'))  _id('fp-icon-sm').textContent  = icon
  if (_id('fp-title'))    _id('fp-title').textContent    = cat?.label ?? obj.type
  if (_id('fp-owner-name')) _id('fp-owner-name').textContent =
    (typeof _roomOwnerName !== 'undefined' && _roomOwnerName) ? _roomOwnerName : '—'

  // 3D-Preview: lade statische PNG vom Server, generiere bei 404 einmalig und speichere permanent
  const prevEl = _id('fp-preview-icon')
  if (prevEl) {
    const pngUrl = `/isometric/items/previews/${obj.type}.png?v=1`
    const img = document.createElement('img')
    img.style.cssText = 'width:120px;height:120px;object-fit:contain;image-rendering:pixelated'
    img.src = pngUrl
    img.onload = () => { prevEl.innerHTML = ''; prevEl.appendChild(img) }
    img.onerror = () => {
      console.log('[FP-Preview] 404 für', obj.type, '→ rendere...')
      prevEl.textContent = icon
      setTimeout(() => {
        const dataUrl = _renderFurniturePreview(obj.type)
        console.log('[FP-Preview] render result:', dataUrl ? `OK (${dataUrl.length} chars)` : 'NULL')
        if (!dataUrl) return
        fetch('/api/furniture-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: obj.type, dataUrl }),
        }).then(r => r.json()).then(res => {
          console.log('[FP-Preview] Server Antwort:', res)
          const img2 = document.createElement('img')
          img2.style.cssText = 'width:120px;height:120px;object-fit:contain;image-rendering:pixelated'
          img2.src = `/isometric/items/previews/${obj.type}.png?v=${Date.now()}`
          img2.onload = () => { if (_id('fp-preview-icon')) { _id('fp-preview-icon').innerHTML = ''; _id('fp-preview-icon').appendChild(img2) } }
        }).catch(() => {
          // Upload fehlgeschlagen → data URL direkt anzeigen
          const img2 = document.createElement('img')
          img2.style.cssText = 'width:120px;height:120px;object-fit:contain;image-rendering:pixelated'
          img2.src = dataUrl
          if (_id('fp-preview-icon')) { _id('fp-preview-icon').innerHTML = ''; _id('fp-preview-icon').appendChild(img2) }
        })
      }, 0)
    }
  }

  const isOwner = canPlaceFurniture

  // Drehen: nur wenn rotatable UND Eigentümer
  const rotBtn = _id('fp-rotate')
  if (rotBtn) {
    rotBtn.style.display = (isOwner && cat?.rotatable) ? '' : 'none'
    rotBtn.onclick = () => { hideFurniturePanel(); rotatePlacedObj(obj.uuid) }
  }

  // Bewegen / Aufnehmen: nur für Eigentümer
  ;['fp-move','fp-pickup'].forEach(id => {
    const el = _id(id); if (el) el.style.display = isOwner ? '' : 'none'
  })
  const moveEl   = _id('fp-move');   if (moveEl)   moveEl.onclick   = () => movePlaced(obj.uuid)
  const pickEl   = _id('fp-pickup'); if (pickEl)   pickEl.onclick   = () => pickupPlaced(obj.uuid)
  const closeEl  = _id('fp-close');  if (closeEl)  closeEl.onclick  = () => hideFurniturePanel()

  // Sitzen: für alle sichtbar, nur bei Sitz-Möbeln
  const sitEl = _id('fp-sit')
  if (sitEl) {
    const isSeat = typeof SEATING_TYPES_ALL !== 'undefined' && SEATING_TYPES_ALL.includes(obj.type)
    sitEl.style.display = isSeat ? '' : 'none'
    sitEl.onclick = () => {
      hideFurniturePanel()
      if (typeof window._sitOnFurniture === 'function') window._sitOnFurniture(obj)
    }
  }

  furniturePanelEl.style.display = 'flex'
  furniturePanelEl.classList.add('fp-in')
}

/** Rückwärtskompatibel: Kühlschrank-Doppelklick öffnet weiterhin die Tür */
function showFurniturePanel(fridge, obj) {
  showFurniturePanelForObj(obj)
}

function hideFurniturePanel() {
  if (furniturePanelEl) {
    furniturePanelEl.classList.remove('fp-in')
    furniturePanelEl.style.display = 'none'
  }
  selectedPlaced = null
}

// Stub — real implementation in game3d.js (loaded after this file)
function hidePlayerPanel() {
  if (typeof _hidePlayerPanelImpl === 'function') _hidePlayerPanelImpl()
}

/** Bewegen: Objekt aus Welt nehmen und als Ghost wieder in die Hand geben (server-autoritativ via PATCH) */
function movePlaced(uuid) {
  if (!canPlaceFurniture) return
  const obj = PLACED_OBJECTS.find(o => o.uuid === uuid)
  if (!obj) return
  const itemCode    = obj.type
  const oldServerId = obj.serverId  // null wenn noch nicht vom Server bestätigt
  hideFurniturePanel()
  // Aus Szene entfernen (still — Server wird via PATCH aktualisiert, kein separates DELETE)
  deletePlacedObj(uuid, true)
  // Ghost-Modus aktivieren mit isMoving-Flag → verhindert Duplizierung
  heldQty = Infinity
  const entry = findCatalogItem(itemCode)
  if (!entry) return
  heldItem = { ...entry, facing: 0, isMoving: { oldServerId } }
  buildGhost(heldItem)
}

/** Aufnehmen: Objekt aus Welt + DB entfernen und zurück ins Inventar legen */
function pickupPlaced(uuid) {
  if (!canPlaceFurniture) return
  const obj = PLACED_OBJECTS.find(o => o.uuid === uuid)
  if (!obj) return
  const itemCode    = obj.type
  const oldServerId = obj.serverId
  const px = obj.x, pz = obj.z   // Koordinaten als Fallback für serverId=null
  hideFurniturePanel()
  deletePlacedObj(uuid, true)
  // DB-Eintrag löschen — immer mitschicken (server_id kann null sein → Fallback via Koordinaten)
  window.parent?.postMessage({
    type:       'ROOM_FURNITURE_PICKUP',
    item_code:  itemCode,
    server_id:  oldServerId,   // null wenn noch nicht vom Server bestätigt
    x:          px,
    z:          pz,
  }, '*')
}

function updateObjMenuPos(obj) {
  if (!objMenuEl || !obj) return
  const topY = getFloorY(obj.x, obj.z, char.level) + 1.4
  const sc = worldToScreen(obj.x, topY, obj.z)
  objMenuEl.style.left = sc.x + 'px'
  objMenuEl.style.top  = sc.y + 'px'
}

// ─── Placement raycaster (separate from game) ─────────────────────────────────
const invRaycaster = new THREE.Raycaster()
const invMouse     = new THREE.Vector2()

function getPlacePoint(e) {
  invMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
  invMouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  camera.updateMatrixWorld()
  invRaycaster.setFromCamera(invMouse, camera)

  // Direkt auf Floor-Tile-Meshes raycasen — kamera-unabhängig
  const hits = invRaycaster.intersectObjects(PLACE_FLOOR_MESHES)
  if (!hits.length) return null
  return hits[0].point
}

function placeHeld(e) {
  if (!heldItem) return
  if (!canPlaceFurniture) return

  // ── Wall frames: raycast against actual wall meshes ──────────────────────────
  if (heldItem.id.startsWith('frame_')) {
    const wallHit = getFrameWallHit(e.clientX, e.clientY)
    if (wallHit) {
      const _fs0 = _solidStart()
      // Pass wy (click height) to buildFrame via temp property
      window._pendingFrameWy = wallHit.wy
      const grp = spawnPlaced(heldItem.id, wallHit.wx, wallHit.wz, wallHit.facingIdx)
      window._pendingFrameWy = undefined
      const _fs1 = _solidEnd()
      if (grp) {
        registerPlaced(heldItem.id, wallHit.wx, wallHit.wz, wallHit.facingIdx, grp, null, char.level, _fs0, _fs1)
        saveScene()
        _notifyItemPlaced()
      }
    }
    return
  }

  const pt = getPlacePoint(e)
  if (!pt) return
  const wx = Math.round(pt.x), wz = Math.round(pt.z)
  const halfG = GRID / 2 - 1
  let _plOk = Math.abs(wx) <= halfG && Math.abs(wz) <= halfG
  if (!_plOk && ROOM_FLOORS_DATA.length > 0) {
    for (const f of ROOM_FLOORS_DATA) {
      if (wx >= f.x0 && wx <= f.x1 && wz >= f.z0 && wz <= f.z1) { _plOk = true; break }
    }
  }
  if (!_plOk) return
  const facingIdx = heldItem.facing ?? 0
  // ── Etage per Character-Y-Position bestimmen (physisch korrekt) ───────────────
  // charGroup.position.y = getFloorY(char.x,char.z,char.level) = echte Etagenhöhe
  const charPhysY = charGroup.position.y
  let activeFloor = null
  if (ROOM_FLOORS_DATA.length > 0) {
    // Nächste Etage anhand der Y-Distanz zur aktuellen Character-Y-Position
    let bestDist = Infinity
    for (const f of ROOM_FLOORS_DATA) {
      const dist = Math.abs(charPhysY - f.y)
      if (dist < bestDist) { bestDist = dist; activeFloor = f }
    }
  }
  const activeLevel = activeFloor ? +activeFloor.floor_index : char.level
  _currentPlaceLevel = activeLevel
  const _ps0 = _solidStart()
  const grp = spawnPlaced(heldItem.id, wx, wz, facingIdx, activeLevel)
  const _ps1 = _solidEnd()
  _currentPlaceLevel = null
  if (grp) {
    // Korrekte Etagen-Y erzwingen
    if (!heldItem.id.startsWith('frame_')) {
      grp.position.y = activeFloor ? activeFloor.y + 0.06
                     : (activeLevel >= 1 ? FLOOR2_Y + 0.06 : 0.06)
    }
    registerPlaced(heldItem.id, wx, wz, facingIdx, grp, null, activeLevel, _ps0, _ps1)
    // If placed directly on a roller, elevate immediately (avoid one-frame pop)
    if (heldItem.id !== 'roller' && findRollerAt(wx, wz)) {
      grp.position.y += ROLLER_H
    }
    saveScene()
    _notifyItemPlaced()
  }
}

// Wall offset helper used by ghost preview and placement for frames
// (FRAME_WALL_OFF is defined earlier near buildFrame)

// Update ghost position on mousemove
const GHOST_Y_OFF = {
  chair: 0.42, table: 0.80, sofa: 0.36, lamp: 0.75, test_lamp: 0.75, plant: 0.60, roller: 0.11,
  armchair: 0.32, bookshelf: 0.90, tv: 1.00, dresser: 0.46, bed: 0.28,
  discoball: 0.10, djdesk: 0.46, balloon: 0.10, partyflag: 0.95, neon: 0.55,
  frame_blue: 1.14, frame_red: 1.14, frame_gold: 1.14, frame_dark: 1.14,
  barstool: 0.46, ottoman: 0.17, bench: 0.27, stool: 0.27,
  barcounter: 0.58, drinksshelf: 0.82, cocktailtable: 0.50,
  fridge: 0.90, beertap: 0.42,
  stair_wood: 1.10, stair_stone: 1.10, stair_metal: 1.10, stair_open: 1.10, stair_down: 0.10,
}
window.addEventListener('mousemove', e => {
  if (!heldItem || !ghostGroup) return

  // ── Wall frames: snap ghost flush to actual wall mesh ──────────────────────
  if (heldItem.id.startsWith('frame_')) {
    const WALL_TH = 0.22
    const FRAME_HALF_D = 0.03
    const off = WALL_TH / 2 + FRAME_HALF_D
    const wallHit = getFrameWallHit(e.clientX, e.clientY)
    if (wallHit) {
      if (heldItem.facing !== wallHit.facingIdx) {
        heldItem.facing = wallHit.facingIdx
        buildGhost(heldItem)
      }
      const horiz = wallHit.wallEdge === 'N' || wallHit.wallEdge === 'S'
      const inward = wallHit.wallEdge === 'N' || wallHit.wallEdge === 'W' ? 1 : -1
      let gx, gz
      if (horiz) {
        gx = wallHit.wx
        gz = wallHit.wallCoord + off * inward
      } else {
        gx = wallHit.wallCoord + off * inward
        gz = wallHit.wz
      }
      ghostGroup.position.set(gx, wallHit.wy, gz)
      ghostGroup.visible = true
    } else {
      ghostGroup.visible = false
    }
    return
  }

  // ── Normal floor items ─────────────────────────────────────────────────────
  const pt = getPlacePoint(e)
  if (!pt) { ghostGroup.visible = false; return }
  ghostGroup.visible = true
  const wx = Math.round(pt.x), wz = Math.round(pt.z)
  const yOff     = GHOST_Y_OFF[heldItem.id] ?? 0.1
  const rolUnder = findRollerAt(wx, wz)
  ghostGroup.position.set(wx, pt.y + 0.06 + yOff + (rolUnder ? ROLLER_H : 0), wz)
})

// Scroll wheel to rotate held item
window.addEventListener('wheel', e => {
  if (!heldItem || !heldItem.rotatable) return
  heldItem.facing = ((heldItem.facing ?? 0) + (e.deltaY > 0 ? 1 : -1) + 4) % 4
  buildGhost(heldItem)
  e.stopPropagation()
}, { passive: false })

// ─── Static solid zones (walls + large furniture) ─────────────────────────────
;(() => {
  const hG  = (GRID / 2) * TILE  // 10
  const th  = 0.15               // half-thickness margin

  // Ground floor — north and west walls (south/east open)
  addSolid(-hG, hG, -hG - th, -hG + th, 0)     // north wall
  addSolid(-hG - th, -hG + th, -hG, hG, 0)      // west wall

  // Second floor walls
  addSolid(F2_X0, F2_X1,       F2_Z0 - th, F2_Z0 + th, 1)  // back
  addSolid(F2_X0 - th, F2_X0 + th, F2_Z0, F2_Z1,      1)  // left
  addSolid(F2_X1 - th, F2_X1 + th, F2_Z0, F2_Z1,      1)  // right
  // Front wall has a stair gap at x ∈ [ST_X0, ST_X1]
  addSolid(F2_X0, ST_X0, F2_Z1 - th, F2_Z1 + th, 1)        // front-left

  // Bedroom wardrobe (wrX=3.0, wrZ=-8.5, size 1.8 × 0.72)
  addSolid(3.0 - 0.90, 3.0 + 0.90, -8.5 - 0.36, -8.5 + 0.36, 1)
  // Bed (bedX=-4.5, bedZ=-7.0, frame 1.5 × 2.4)
  addSolid(-4.5 - 0.75, -4.5 + 0.75, -7.0 - 1.20, -7.0 + 1.20, 1)
})()
