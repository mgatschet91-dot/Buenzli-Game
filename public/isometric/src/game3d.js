// ─── game3d.js ── Main: game loop, avatar editor, debug, postMessage API ──
// Loaded last. Depends on: game3d-core.js, game3d-rooms.js, game3d-furniture.js, game3d-placement.js, game3d-character.js

// ─── Game Loop ─────────────────────────────────────────────────────────────────
let prevTime = performance.now()
let _wsSyncTimer  = 0.08  // WASD pos-update throttle (starts ready)
let _wsPrevState  = 'idle' // state-change detection
let _prevOnRoller = false  // Roller-Übergangs-Detektion für End-Sync

function loop() {
  requestAnimationFrame(loop)

  const now = performance.now()
  const dt  = Math.min((now - prevTime) / 1000, 0.05)
  prevTime  = now

  // ── Fridge door animation ────────────────────────────────────────────────
  for (const f of FRIDGES) {
    f.doorAngle += (f.doorTarget - f.doorAngle) * Math.min(1, dt * 7)
    f.doorPivot.rotation.y = f.doorAngle
  }

  // ── Raumtür-Animation (öffnet wenn lokaler ODER remote Char nah) ────────────
  for (const door of ROOM_DOORS) {
    let nearDoor = false
    const ldx = char.x - door.wx, ldz = char.z - door.wz
    if (Math.sqrt(ldx * ldx + ldz * ldz) < 3.2) nearDoor = true
    if (!nearDoor) {
      for (const [, ra] of _remoteAvatars) {
        const rdx = ra.x - door.wx, rdz = ra.z - door.wz
        if (Math.sqrt(rdx * rdx + rdz * rdz) < 3.2) { nearDoor = true; break }
      }
    }
    door.target = nearDoor ? door.openAngle : 0
    door.angle += (door.target - door.angle) * Math.min(1, dt * 4)
    door.pivot.rotation.y = door.angle
  }

  // ── Sip timer (idle only) ─────────────────────────────────────────────────
  if (char.drink && char.state === 'idle') {
    char.sipT += dt
    if (char.sipT >= 2.0) char.sipT = -(4 + Math.random() * 5)
  }

  // ── Pending fridge: open when character arrives ───────────────────────────
  if (pendingFridge && !char.target) {
    const dx = char.x - pendingFridge.entranceX, dz = char.z - pendingFridge.entranceZ
    if (Math.sqrt(dx*dx + dz*dz) < 1.2) openFridge(pendingFridge)
    pendingFridge = null
  }

  // ── Wardrobe door animation + sparkle ────────────────────────────────────
  for (const w of WARDROBES) {
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

  // ── Animate jacuzzi bubbles ──────────────────────────────────────────────
  for (const jac of JACUZZI_OBJECTS) {
    const dx = char.x - jac.wx, dz = char.z - jac.wz
    const inJacuzzi = Math.abs(dx) < 2.0 && Math.abs(dz) < 2.0
    for (const b of jac.bubbles) {
      b.visible = inJacuzzi
      if (!inJacuzzi) continue
      const ud = b.userData
      ud.phase += dt * ud.speed * 1.8
      b.position.y += ud.speed * dt * 0.38
      // Wenn oben angekommen: zurück nach unten mit neuer X/Z Position
      if (b.position.y > ud.topY) {
        b.position.y = ud.bottomY
        b.position.x = (Math.random() - 0.5) * 1.3
        b.position.z = (Math.random() - 0.5) * 1.3
      }
      // Leichtes Wackeln horizontal
      b.position.x += Math.sin(ud.phase * 1.3) * 0.002
      b.position.z += Math.cos(ud.phase * 0.9) * 0.002
    }
  }

  // ── Animate roller belts — synchron über alle Clients ────────────────────
  // Position aus absolutem Timestamp ableiten (performance.now / 1000 = Sekunden).
  // Alle Clients rechnen denselben Wert → kein Drift möglich.
  const tSec = Date.now() * 0.001  // Unix-Timestamp: identisch auf allen Clients
  for (const slat of ROLLER_BELT_MESHES) {
    const { beltDir, cx, cz, halfT, speed, slatOffset } = slat.userData
    // Globale Belt-Phase: (tSec * speed) mod (2 * halfT), verschoben um Slat-Offset
    const phase = ((tSec * speed + slatOffset) % (halfT * 2) + halfT * 2) % (halfT * 2)
    if      (beltDir === 'N' || beltDir === 'S') {
      const sign = beltDir === 'S' ? 1 : -1
      slat.position.z = cz - halfT + ((phase * sign + halfT * 2) % (halfT * 2))
    } else {
      const sign = beltDir === 'E' ? 1 : -1
      slat.position.x = cx - halfT + ((phase * sign + halfT * 2) % (halfT * 2))
    }
  }

  // ── Teleport state machine ────────────────────────────────────────────────
  updateTeleport(dt)

  // ── WASD / click movement ─────────────────────────────────────────────────
  let mx = 0, mz = 0

  // Block keyboard during teleport door phases
  if (!tp || (tp.phase !== 'entering_door' && tp.phase !== 'entering_walk' && tp.phase !== 'sparkling')) {
    if (keys['KeyW'] || keys['ArrowUp'])    { mx -= 1; mz -= 1 }
    if (keys['KeyS'] || keys['ArrowDown'])  { mx += 1; mz += 1 }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += 1; mz -= 1 }
    if (keys['KeyA'] || keys['ArrowLeft'])  { mx -= 1; mz += 1 }
  }

  // If player actively moves → step off roller, cancel auto-sit
  if (mx !== 0 || mz !== 0) {
    if (char.rollerTarget) char.rollerTarget = null
    if (char.state === 'sit' || char.state === 'jacuzzi_undress') { char.state = 'idle'; redressAfterJacuzzi() }  // aufstehen bei Tastendruck
    const len = Math.sqrt(mx*mx + mz*mz)
    mx /= len; mz /= len
    char.target = null; char._waypoints = []
    targetRing.visible = false
  }

  // ── Click-to-move — Waypoint-basiert (A*) ────────────────────────────────
  if (mx === 0 && mz === 0 && char.target && char.state !== 'sit') {
    if (char.rollerTarget) char.rollerTarget = null

    // Nächsten Wegpunkt bestimmen (oder direkt das Ziel wenn keine Waypoints mehr)
    let wpX = char.target.x, wpZ = char.target.z
    if (char._waypoints && char._waypoints.length > 0) {
      const wp = char._waypoints[0]
      const wpDist = Math.hypot(wp.x - char.x, wp.z - char.z)
      if (wpDist < 0.35) {
        char._waypoints.shift()
        if (char._waypoints.length > 0) { wpX = char._waypoints[0].x; wpZ = char._waypoints[0].z }
      } else {
        wpX = wp.x; wpZ = wp.z
      }
    }

    const dx = wpX - char.x
    const dz = wpZ - char.z
    const dist = Math.sqrt(dx*dx + dz*dz)
    const finalDist = Math.hypot(char.target.x - char.x, char.target.z - char.z)

    if (finalDist <= 0.1) {
      // Am Ziel angekommen
      char.x = char.target.x; char.z = char.target.z
      if (char.target.autoSit) {
        const s = char.target.autoSit
        char.dir = s.facingY
        // Jacuzzi: Auszieh-Animation statt sofort sitzen
        char.state = s.jacuzziCenter ? 'jacuzzi_undress' : 'sit'
        if (s.jacuzziCenter) { char._undressT = 0; char._undressedTop = false }
      }
      char.target = null; char._waypoints = []; targetRing.visible = false
      char._ctmStuck = 0; char._ctmLastDist = undefined
    } else if (dist > 0.08) {
      mx = dx / dist
      mz = dz / dist
      // Stuck detection: nur wenn keine Waypoints mehr → direkte Bewegung blockiert
      if (!char._waypoints || char._waypoints.length === 0) {
        if (char._ctmLastDist === undefined) char._ctmLastDist = finalDist
        if (finalDist >= char._ctmLastDist - 0.005) {
          char._ctmStuck = (char._ctmStuck || 0) + dt
          if (char._ctmStuck > 0.6) {
            char.target = null; char._waypoints = []; targetRing.visible = false
            char._ctmStuck = 0; char._ctmLastDist = undefined
            mx = 0; mz = 0
          }
        } else {
          char._ctmStuck = 0; char._ctmLastDist = finalDist
        }
      } else {
        char._ctmStuck = 0; char._ctmLastDist = undefined
      }
    }
  }

  const onRoller = !!char.rollerTarget   // true while roller is still carrying us

  // ── Apply movement ────────────────────────────────────────────────────────
  const moving = (mx !== 0 || mz !== 0) && char.state !== 'sit' && char.state !== 'sleep' && char.state !== 'jacuzzi_undress'
  if (moving) {
    const halfG  = (GRID / 2 - 0.5) * TILE
    const curH   = getFloorY(char.x, char.z, char.level)
    const MAX_STEP = FLOOR2_Y * 0.10   // max height change per frame ≈ 0.7

    // Bewegungsbounds: auf aktuelle Etage beschränken (nicht alle Etagen zusammenfassen)
    let _mvMinX = -halfG, _mvMaxX = halfG, _mvMinZ = -halfG, _mvMaxZ = halfG
    if (ROOM_FLOORS_DATA.length > 0) {
      if (char.level >= 1) {
        // Nur die aktuelle Etage + verbindende Treppen
        const curFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === char.level)
        if (curFloor) {
          _mvMinX = curFloor.x0; _mvMaxX = curFloor.x1
          _mvMinZ = curFloor.z0; _mvMaxZ = curFloor.z1
          for (const st of ROOM_STAIRS_DATA_NEW) {
            if (st.from_floor === char.level || st.to_floor === char.level) {
              _mvMinX = Math.min(_mvMinX, st.anchor_x - (st.width || 3) / 2)
              _mvMaxX = Math.max(_mvMaxX, st.anchor_x + (st.width || 3) / 2)
              _mvMinZ = Math.min(_mvMinZ, st.anchor_z - st.steps)
              _mvMaxZ = Math.max(_mvMaxZ, st.anchor_z + st.steps)
            }
          }
        }
      } else {
        // Level 0: Erdgeschoss-Bounds + alle Treppen
        const groundFloor = ROOM_FLOORS_DATA.find(f => +f.floor_index === 0)
        if (groundFloor) {
          _mvMinX = groundFloor.x0; _mvMaxX = groundFloor.x1
          _mvMinZ = groundFloor.z0; _mvMaxZ = groundFloor.z1
        }
        for (const st of ROOM_STAIRS_DATA_NEW) {
          _mvMinX = Math.min(_mvMinX, st.anchor_x - (st.width || 3) / 2)
          _mvMaxX = Math.max(_mvMaxX, st.anchor_x + (st.width || 3) / 2)
          _mvMinZ = Math.min(_mvMinZ, st.anchor_z - st.steps)
          _mvMaxZ = Math.max(_mvMaxZ, st.anchor_z + st.steps)
        }
      }
    }

    const nx = Math.max(_mvMinX, Math.min(_mvMaxX, char.x + mx * SPEED * dt))
    const nz = Math.max(_mvMinZ, Math.min(_mvMaxZ, char.z + mz * SPEED * dt))

    const bothOK = Math.abs(getFloorY(nx, nz, char.level) - curH) <= MAX_STEP && !isBlocked(nx, nz, char.level)
    const xOK    = Math.abs(getFloorY(nx, char.z, char.level) - curH) <= MAX_STEP && !isBlocked(nx, char.z, char.level)
    const zOK    = Math.abs(getFloorY(char.x, nz, char.level) - curH) <= MAX_STEP && !isBlocked(char.x, nz, char.level)

    if (bothOK)      { char.x = nx; char.z = nz }
    else if (xOK)    { char.x = nx }
    else if (zOK)    { char.z = nz }

    // ── Hard-Clamp: Bounds halten, aber NICHT in Wand-Solids schieben ────────
    const _cx = Math.max(_mvMinX, Math.min(_mvMaxX, char.x))
    const _cz = Math.max(_mvMinZ, Math.min(_mvMaxZ, char.z))
    if (_cx !== char.x && !isBlocked(_cx, char.z, char.level)) char.x = _cx
    if (_cz !== char.z && !isBlocked(char.x, _cz, char.level)) char.z = _cz

    // ── Staircase railing: clamp perpendicular axis so char can't fall off sides ──
    for (const st of ROOM_STAIRS_DATA_NEW) {
      const [sdx, sdz] = _STAIR_DV[st.dir] || [0, 1]
      const hw = (st.width || 3) / 2 - CHAR_R
      if (sdx === 0) { // N / S — lateral axis is X
        const szLo = sdz > 0 ? st.anchor_z : st.anchor_z - st.steps
        const szHi = sdz > 0 ? st.anchor_z + st.steps : st.anchor_z
        if (char.z >= szLo && char.z <= szHi)
          char.x = Math.max(st.anchor_x - hw, Math.min(st.anchor_x + hw, char.x))
      } else { // E / W — lateral axis is Z
        const sxLo = sdx > 0 ? st.anchor_x : st.anchor_x - st.steps
        const sxHi = sdx > 0 ? st.anchor_x + st.steps : st.anchor_x
        if (char.x >= sxLo && char.x <= sxHi)
          char.z = Math.max(st.anchor_z - hw, Math.min(st.anchor_z + hw, char.z))
      }
    }

    // ── Update floor level from stair progress ────────────────────────────
    if (ROOM_STAIRS_DATA_NEW.length > 0) {
      // Neues Format: Level anhand Editor-Treppen bestimmen
      let onNewStair = false
      for (const st of ROOM_STAIRS_DATA_NEW) {
        const [dx, dz] = _STAIR_DV[st.dir] || [0, 1]
        const hw = (st.width || 3) / 2
        let inZone = false, t = 0
        if (dx === 0) {
          const zLo = dz > 0 ? st.anchor_z : st.anchor_z - st.steps
          const zHi = dz > 0 ? st.anchor_z + st.steps : st.anchor_z
          if (char.x >= st.anchor_x - hw && char.x <= st.anchor_x + hw && char.z >= zLo && char.z <= zHi) {
            inZone = true
            t = dz > 0 ? (char.z - st.anchor_z) / st.steps : (st.anchor_z - char.z) / st.steps
          }
        } else {
          const xLo = dx > 0 ? st.anchor_x : st.anchor_x - st.steps
          const xHi = dx > 0 ? st.anchor_x + st.steps : st.anchor_x
          if (char.z >= st.anchor_z - hw && char.z <= st.anchor_z + hw && char.x >= xLo && char.x <= xHi) {
            inZone = true
            t = dx > 0 ? (char.x - st.anchor_x) / st.steps : (st.anchor_x - char.x) / st.steps
          }
        }
        if (inZone) {
          onNewStair = true
          if (t >= 0.90) char.level = st.to_floor ?? 1
          else if (t <= 0.10) char.level = st.from_floor ?? 0
        }
      }
      if (!onNewStair) {
        // Prüfen ob Character auf einer Ober-Etage steht (2-Tile Toleranz für Treppe→Etage-Lücken)
        const onUpper = ROOM_FLOORS_DATA.some(f =>
          f.floor_index >= 1 &&
          char.x >= f.x0 - 2 && char.x <= f.x1 + 2 &&
          char.z >= f.z0 - 2 && char.z <= f.z1 + 2
        )
        if (!onUpper) char.level = 0
      }
    } else {
      // Altes Format: Hardcoded Treppenzonen
      const onSt = char.x >= ST_X0 && char.x <= ST_X1 && char.z >= ST_Z0 && char.z <= ST_Z1
      if (onSt) {
        const prog = (ST_Z1 - char.z) / (ST_Z1 - ST_Z0)
        if (prog >= 0.90) char.level = 1
        else if (prog <= 0.10) char.level = 0
        // Between 10-90%: keep current level (smooth transition zone)
      } else {
        const inF2 = char.x >= F2_X0 && char.x <= F2_X1 && char.z >= F2_Z0 && char.z <= F2_Z1
        if (!inF2) char.level = 0          // off second floor footprint → always ground
        // If in F2 footprint: keep current level (walk under or on top)
      }
    }

    const targetDir = Math.atan2(mx, mz)
    let diff = targetDir - char.dir
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    char.dir += diff * Math.min(1, dt * 18)

    if (char.state !== 'wave' && char.state !== 'sleep') char.state = 'walk'
    // WASD Multiplayer-Sync: Position throttled an Parent senden (alle 80ms)
    _wsSyncTimer += dt
    if (_wsSyncTimer >= 0.08) {
      _wsSyncTimer = 0
      window.parent?.postMessage({ type: 'CHAR_POS_UPDATE', x: char.x, y: char.z, dir: char.dir, level: char.level ?? 0 }, '*')
    }
  } else if (char.rollerTarget) {
    // Roller schiebt — einmalig beim Betreten senden, danach simulieren andere lokal
    if (char.state !== 'wave' && char.state !== 'sleep' && char.state !== 'sit') char.state = 'idle'
    if (!_prevOnRoller) {
      // Gerade neu auf den Roller getreten → Position einmalig broadcasten
      window.parent?.postMessage({ type: 'CHAR_POS_UPDATE', x: char.x, y: char.z, dir: char.dir, onRoller: true, level: char.level ?? 0 }, '*')
    }
  } else if (char.state === 'sit') {
    // Sitzend auf bewegtem Objekt (zB Stuhl auf Roller) — Position syncen wenn Objekt uns trägt
    const sittingOnMovingObj = PLACED_OBJECTS.some(o =>
      SEATING_TYPES_ALL.includes(o.type) && o.rollerTarget &&
      Math.abs(char.x - o.x) < 0.55 && Math.abs(char.z - o.z) < 0.55
    )
    if (sittingOnMovingObj) {
      _wsSyncTimer += dt
      if (_wsSyncTimer >= 0.08) {
        _wsSyncTimer = 0
        window.parent?.postMessage({ type: 'CHAR_POS_UPDATE', x: char.x, y: char.z, dir: char.dir, level: char.level ?? 0 }, '*')
      }
    } else {
      _wsSyncTimer = 0.08
    }
  } else {
    // Roller hat gerade aufgehört → sofort End-Position syncen damit Remote korrekt ist
    if (_prevOnRoller) {
      window.parent?.postMessage({ type: 'CHAR_POS_UPDATE', x: char.x, y: char.z, dir: char.dir, level: char.level ?? 0 }, '*')
    }
    _wsSyncTimer = 0.08 // reset → nächste WASD-Bewegung sendet sofort
    if (char.state === 'walk') char.state = 'idle'
  }
  _prevOnRoller = !!char.rollerTarget

  // ── Auto-sit: wenn Charakter auf einem Sitz-Objekt steht → automatisch hinsetzen ──
  if (char.state === 'idle' && !char.target && !char.rollerTarget) {
    // 1. Jacuzzi: über PLACED_OBJECTS (braucht Sonder-Snap zur nächsten Bank)
    for (const obj of PLACED_OBJECTS) {
      if (obj.type !== 'jacuzzi') continue
      if (Math.abs(char.x - obj.x) < 2.0 && Math.abs(char.z - obj.z) < 2.0) {
        const nearSeat = SEATS.reduce((best, s) => {
          if (!s.jacuzziCenter) return best
          const d = Math.hypot(s.x - char.x, s.z - char.z)
          return (!best || d < best.d) ? { s, d } : best
        }, null)
        if (nearSeat) {
          char.x   = nearSeat.s.x
          char.z   = nearSeat.s.z
          char.dir = nearSeat.s.facingY
        }
        char.state = 'jacuzzi_undress'
        char._undressT = 0; char._undressedTop = false
        char._headedToSeat = null
        break
      }
    }
    // 2. Normale Sitze: SEATS-Array direkt prüfen.
    //    Radius: 1.2 wenn der Charakter gezielt zu diesem Sitz geklickt hat (_headedToSeat),
    //    sonst 0.45 für "versehentliches" Sitzen beim Drüberlaufen.
    //    Sofa-Sitze liegen im SOLID → Charakter kann nie näher als ~0.7 rankommen → brauchen 1.2.
    if (char.state !== 'sit' && char.state !== 'jacuzzi_undress') {
      const headedSeat = char._headedToSeat   // gezielt angesteuert?
      for (const s of SEATS) {
        if (s.jacuzziCenter) continue
        if ((s.level ?? 0) !== char.level) continue
        const dist = Math.hypot(s.x - char.x, s.z - char.z)
        const radius = (headedSeat === s) ? 1.2 : 0.45   // grösser nur für gezielten Klick
        if (dist < radius) {
          char.x   = s.x; char.z = s.z         // exakt auf Sitz einrasten
          char.dir = s.facingY
          char._sitFacingY = s.facingY          // merken für Aufsteh-Push
          char._currentSeat = s                 // merken welcher Sitz belegt ist
          char.state = 'sit'
          char._headedToSeat = null
          break
        }
      }
    }
    // Wenn wir ankamen aber nicht gesessen haben → _headedToSeat löschen
    if (char.state !== 'sit' && char.state !== 'jacuzzi_undress') {
      char._headedToSeat = null
    }
  }

  // ── State-Change Multiplayer-Sync (sit, sleep, idle …) ─────────────────────
  if (char.state !== _wsPrevState) {
    _wsPrevState = char.state
    window.parent?.postMessage({ type: 'CHAR_STATE', state: char.state, x: char.x, z: char.z, dir: char.dir }, '*')
  }

  // ── Roller push — tile-by-tile, nearest-wins (no corner ambiguity) ────────
  // Sitting chars are carried by their seat object (weld code below) — not by char roller
  if (char.state !== 'sleep' && char.state !== 'sit' && char.state !== 'jacuzzi_undress' && !tp) {
    const PUSH_SPEED = 1.5

    // 1. If we have an active roller target, drive the character to it
    if (char.rollerTarget) {
      const tdx = char.rollerTarget.x - char.x
      const tdz = char.rollerTarget.z - char.z
      const td  = Math.hypot(tdx, tdz)
      if (td < 0.04) {
        // Snap exactly onto the target tile centre
        char.x = char.rollerTarget.x
        char.z = char.rollerTarget.z
        char.rollerTarget = null   // will re-evaluate below
      } else {
        char.x += (tdx / td) * PUSH_SPEED * dt
        char.z += (tdz / td) * PUSH_SPEED * dt
        const tDir = Math.atan2(tdx, tdz)
        let diff = tDir - char.dir
        while (diff >  Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        char.dir += diff * Math.min(1, dt * 12)
      }
    }

    // 2. If no target: find nearest roller — use shared helper (nearest-wins)
    // Exception: if sitting on a seating object that has its OWN rollerTarget,
    // let the object carry the character instead of setting a separate char rollerTarget.
    const seatCarrying = char.state === 'sit' && PLACED_OBJECTS.some(o =>
      SEATING_TYPES_ALL.includes(o.type) && o.rollerTarget &&
      Math.abs(char.x - o.x) < 0.55 && Math.abs(char.z - o.z) < 0.55
    )
    if (!char.rollerTarget && !seatCarrying) {
      const nearRol = findRollerAt(char.x, char.z)
      if (nearRol) {
        const dv = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }[nearRol.dir]
        char.rollerTarget = { x: nearRol.cx + dv[0], z: nearRol.cz + dv[1] }
      }
    }
  } else {
    char.rollerTarget = null   // clear if sitting / sleeping / teleporting
  }

  // ── Roller push for placed objects ───────────────────────────────────────
  {
    const PUSH_SPD   = 1.5
    const ROLLER_DIR = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }

    for (const obj of PLACED_OBJECTS) {
      if (obj.type === 'roller') continue   // rollers don't push each other
      if (obj.type?.startsWith('frame_')) continue  // wall frames: position bleibt fix

      // — Drive toward active target ————————————————————————————————————————
      if (obj.rollerTarget) {
        const tdx = obj.rollerTarget.x - obj.x
        const tdz = obj.rollerTarget.z - obj.z
        const td  = Math.hypot(tdx, tdz)
        if (td < 0.04) {
          obj.x = obj.rollerTarget.x
          obj.z = obj.rollerTarget.z
          obj.rollerTarget = null
          // Keep SEATS entry in sync (so Q-sit finds the right position)
          if (obj.seatRef) { obj.seatRef.x = obj.x; obj.seatRef.z = obj.z }
          saveScene()
        } else {
          obj.x += (tdx / td) * PUSH_SPD * dt
          obj.z += (tdz / td) * PUSH_SPD * dt
          // Keep SEATS entry continuously in sync during movement
          if (obj.seatRef) { obj.seatRef.x = obj.x; obj.seatRef.z = obj.z }
        }
      }

      // — If resting: check if sitting on a roller → get next target ————————
      if (!obj.rollerTarget) {
        const nearRol = findRollerAt(obj.x, obj.z)
        if (nearRol) {
          const dv = ROLLER_DIR[nearRol.dir]
          const tx = nearRol.cx + dv[0], tz = nearRol.cz + dv[1]
          if (Math.abs(tx) <= 9 && Math.abs(tz) <= 9) {
            obj.rollerTarget = { x: tx, z: tz }
          }
        }
        // Correct Y: on roller → elevated, off roller → correct floor surface
        // obj.floorLevel statt hardcoded 0 — sonst landen Ober-Etagen-Möbel immer auf Y=0!
        const objLvl = obj.floorLevel ?? 0
        const objFloorY = getFloorY(Math.round(obj.x), Math.round(obj.z), objLvl)
        obj.group.position.set(obj.x, objFloorY + 0.06 + (nearRol ? ROLLER_H : 0), obj.z)
      } else {
        // Still moving — stay elevated throughout transit
        const objLvlM = obj.floorLevel ?? 0
        const objFloorYM = getFloorY(Math.round(obj.x), Math.round(obj.z), objLvlM)
        obj.group.position.set(obj.x, objFloorYM + 0.06 + ROLLER_H, obj.z)
      }

      // — If character is SITTING on a MOVING roller-object, weld them to it ──
      // Nur wenn obj.rollerTarget aktiv ist (Möbel bewegt sich gerade).
      // Statische Möbel (Sofa, Sessel) NICHT welding — sonst landet char im Solid.
      if (char.state === 'sit' && obj.rollerTarget && SEATING_TYPES_ALL.includes(obj.type)) {
        if (Math.abs(char.x - obj.x) < 0.55 && Math.abs(char.z - obj.z) < 0.55) {
          char.x = obj.x
          char.z = obj.z
        }
      }
    }
  }

  // ── Update character object ────────────────────────────────────────────────
  const floorH = getFloorY(char.x, char.z, char.level)

  // Check if character is standing ON a roller (add roller height so they sit on top)
  let rollerSurface = 0
  for (const rol of GAME_ROLLERS) {
    if (Math.abs(char.x - rol.cx) < 0.5 && Math.abs(char.z - rol.cz) < 0.5) {
      rollerSurface = ROLLER_H; break
    }
  }
  // If sitting on a roller-transported chair that has moved away from the roller,
  // derive elevation from the chair group's actual Y position instead.
  if (char.state === 'sit' && rollerSurface === 0) {
    for (const obj of PLACED_OBJECTS) {
      if (!SEATING_TYPES_ALL.includes(obj.type)) continue
      if (Math.abs(char.x - obj.x) < 0.4 && Math.abs(char.z - obj.z) < 0.4) {
        // Chair is elevated if its group Y is noticeably above the floor
        if (obj.group.position.y > floorH + ROLLER_H * 0.5) {
          rollerSurface = ROLLER_H
        }
        break
      }
    }
  }
  const surfaceY = floorH + rollerSurface

  if (char.state === 'sleep' && window.BED_POS) {
    const bp = window.BED_POS
    charGroup.rotation.x = Math.PI / 2
    charGroup.rotation.y = Math.PI
    charGroup.position.set(bp.x, bp.surfaceY + 0.18, bp.z + 0.85)
    shadowMesh.visible = false
  } else {
    charGroup.rotation.x = 0
    // Jacuzzi: Avatar tiefer setzen damit er im Wasser sitzt (Wasser bei ~0.33 über Boden)
    let jacuzziSink = 0
    if (char.state === 'sit') {
      for (const jac of JACUZZI_OBJECTS) {
        if (Math.abs(char.x - jac.wx) < 2.0 && Math.abs(char.z - jac.wz) < 2.0) {
          jacuzziSink = -0.36  // Avatar um 0.36 absenken → Körper im Wasser
          break
        }
      }
    }
    const charY = surfaceY + (char.state === 'sit' ? 0.09 : 0) + jacuzziSink
    charGroup.position.set(char.x, charY, char.z)
    charGroup.rotation.y = char.dir
    shadowMesh.visible = true
    shadowMesh.position.set(char.x, surfaceY + 0.07, char.z)
  }

  // Animate
  animateChar(dt)
  checkTeleport(dt)

  // ── Chat bubble: countdown + screen-space tracking ───────────────────────
  if (char.chatting) {
    char.chatTimer -= dt
    if (char.chatTimer <= 0) {
      char.chatting = false
      chatBubble.style.display = 'none'
    } else {
      const headObj = charGroup.getObjectByName('head')
      const wp = new THREE.Vector3()
      headObj.getWorldPosition(wp)
      wp.y += 0.42
      wp.project(camera)
      chatBubble.style.left = ((wp.x *  0.5 + 0.5) * window.innerWidth)  + 'px'
      chatBubble.style.top  = ((-wp.y * 0.5 + 0.5) * window.innerHeight) + 'px'
    }
  }

  // ── Camera smooth follow ───────────────────────────────────────────────────
  const targetCamX = char.x + 20
  const targetCamY = floorH + 16
  const targetCamZ = char.z + 20
  camera.position.x += (targetCamX - camera.position.x) * 0.08
  camera.position.y += (targetCamY - camera.position.y) * 0.06
  camera.position.z += (targetCamZ - camera.position.z) * 0.08
  camera.lookAt(char.x, floorH, char.z)

  // ── Remote Avatar Waypoint-Walk (same SPEED as local character) ────────────
  for (const [, ra] of _remoteAvatars) {
    ra.animT = (ra.animT || 0) + dt
    const raSitting  = ra.state === 'sit'
    const raSleeping = ra.state === 'sleep'
    const raSpecial  = ra.state === 'wave' || ra.state === 'dance'
    const raBlocked  = ra.state === 'jacuzzi_undress'
    // Only advance waypoints/roller when not blocked
    if (!raSleeping && !raBlocked) {
      // ── Roller-Logik client-seitig (deterministisch, kein Stream nötig) ──
      const PUSH_SPEED = 1.5
      if (ra.rollerTarget) {
        ra.waypoints = []   // Waypoints löschen während Roller läuft — verhindert Konflikt
        const tdx = ra.rollerTarget.x - ra.x, tdz = ra.rollerTarget.z - ra.z
        const td = Math.hypot(tdx, tdz)
        if (td < 0.04) {
          ra.x = ra.rollerTarget.x; ra.z = ra.rollerTarget.z
          ra.rollerTarget = null
          // Nächsten Roller-Schritt suchen — genau wie beim lokalen Avatar
          const nextRol = findRollerAt(ra.x, ra.z)
          if (nextRol) {
            const dv = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }[nextRol.dir] || [0, 0]
            const tx = nextRol.cx + dv[0], tz = nextRol.cz + dv[1]
            if (Math.abs(tx) <= 9 && Math.abs(tz) <= 9) {
              ra.rollerTarget = { x: tx, z: tz }
            }
          }
        } else {
          ra.x += (tdx / td) * PUSH_SPEED * dt
          ra.z += (tdz / td) * PUSH_SPEED * dt
          ra.dir = Math.atan2(tdx, tdz)
        }
        ra.state = 'idle'
      }
      // Roller-Sim läuft nur noch wenn via onRoller-Flag gestartet (kein automatisches findRollerAt)
      // Verhindert dass Avatare die einfach über Roller laufen in der Sim gefangen werden
      // ── Waypoint-Walk (nur wenn kein Roller aktiv und nicht sitzend) ──
      if (!ra.rollerTarget && !raSitting && !raSpecial) {
        if (ra.waypoints && ra.waypoints.length > 0) {
          ra.state = 'walk'
          const wp = ra.waypoints[0]
          const dx = wp.x - ra.x, dz = wp.z - ra.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < 0.12) {
            ra.x = wp.x; ra.z = wp.z
            ra.waypoints.shift()
          } else {
            const step = Math.min(SPEED * dt, dist)
            ra.x += (dx / dist) * step
            ra.z += (dz / dist) * step
            ra.dir = Math.atan2(dx, dz)
          }
        } else {
          ra.state = 'idle'
        }
      }
    }
    // Chat-Bubble Timer
    if (ra.chatTimer > 0) {
      ra.chatTimer -= dt
      if (ra.chatTimer <= 0 && ra.chatSprite) {
        ra.group.remove(ra.chatSprite)
        ra.chatSprite.material.map?.dispose()
        ra.chatSprite.material.dispose()
        ra.chatSprite = null
      }
    }
    const fy = (typeof getFloorY === 'function') ? getFloorY(ra.x, ra.z, ra.level ?? 0) : 0
    let raSink = 0
    if (ra.state === 'sit' || ra.state === 'jacuzzi_undress') {
      for (const jac of JACUZZI_OBJECTS) {
        if (Math.abs(ra.x - jac.wx) < 2.0 && Math.abs(ra.z - jac.wz) < 2.0) { raSink = -0.36; break }
      }
    }
    ra.group.position.set(ra.x, fy + (ra.state === 'sit' ? 0.09 : 0) + raSink, ra.z)
    ra.group.rotation.y = ra.dir || 0
    // Animation for remote avatar depending on state
    const armL = ra.group.getObjectByName('armL')
    const armR = ra.group.getObjectByName('armR')
    const legL = ra.group.getObjectByName('legL')
    const legR = ra.group.getObjectByName('legR')
    if (armL && legL && legR) {
      if (ra.state === 'walk') {
        const swing = Math.sin(ra.animT * 8) * 0.5
        armL.rotation.x = swing; if (armR) armR.rotation.x = -swing
        legL.rotation.x = -swing * 0.8; legR.rotation.x = swing * 0.8
      } else if (ra.state === 'jacuzzi_undress') {
        // Auszieh-Animation mit Material-Swap (gleich wie lokal)
        ra._undressT = (ra._undressT ?? 0) + dt
        const t = ra._undressT
        const forearmL = ra.group.getObjectByName('forearmL')
        const forearmR = ra.group.getObjectByName('forearmR')
        if (t < 0.6) {
          const p = t / 0.6
          armL.rotation.x = -p * 1.0; armL.rotation.z = p * 0.5
          if (armR) { armR.rotation.x = -p * 1.0; armR.rotation.z = -p * 0.5 }
          if (forearmL) { forearmL.rotation.x = -0.2 - p * 0.8; forearmL.rotation.z = -p * 0.3 }
          if (forearmR) { forearmR.rotation.x = -0.2 - p * 0.8; forearmR.rotation.z = p * 0.3 }
          legL.rotation.x = legR.rotation.x = 0
        } else if (t < 1.0) {
          const p = (t - 0.6) / 0.4
          armL.rotation.x = -1.0 - p * 0.8; armL.rotation.z = 0.5 - p * 0.5
          if (armR) { armR.rotation.x = -1.0 - p * 0.8; armR.rotation.z = -0.5 + p * 0.5 }
          if (forearmL) { forearmL.rotation.x = -1.2 + p * 0.8; forearmL.rotation.z = 0 }
          if (forearmR) { forearmR.rotation.x = -1.2 + p * 0.8; forearmR.rotation.z = 0 }
          legL.rotation.x = legR.rotation.x = 0
          // Material-Swap Oberkörper bei 80% dieser Phase (gleich wie lokal)
          if (p > 0.8 && !ra._undressedTop) { ra._undressedTop = true; _undressRemoteAvatar(ra) }
        } else if (t < 1.4) {
          const p = (t - 1.0) / 0.4
          armL.rotation.x = -0.6; armL.rotation.z = 0.3
          if (armR) { armR.rotation.x = -0.6; armR.rotation.z = -0.3 }
          if (forearmL) { forearmL.rotation.x = -0.3; forearmL.rotation.z = 0 }
          if (forearmR) { forearmR.rotation.x = -0.3; forearmR.rotation.z = 0 }
          legL.rotation.x = legR.rotation.x = p * 0.3
        } else {
          // Fertig → sitzen
          ra._undressT = 0; ra._undressedTop = false
          ra.state = 'sit'
        }
      } else if (ra.state === 'sit') {
        legL.rotation.x = -Math.PI * 0.5; legR.rotation.x = -Math.PI * 0.5
        armL.rotation.x = 0.15; if (armR) armR.rotation.x = 0.15
        armL.rotation.z = 0; if (armR) armR.rotation.z = 0
      } else if (ra.state === 'wave') {
        if (armR) {
          armR.rotation.x = -Math.PI * 0.58 + Math.sin(ra.animT * 10) * 0.28
          armR.rotation.z = 0.14
          const forearmR = ra.group.getObjectByName('forearmR')
          if (forearmR) forearmR.rotation.x = -Math.PI * 0.38 + Math.sin(ra.animT * 10 + 0.5) * 0.22
        }
        armL.rotation.x = 0; armL.rotation.z = 0
        legL.rotation.x = 0; legR.rotation.x = 0
      } else if (ra.state === 'dance') {
        const t = ra.animT * 6
        armL.rotation.x = Math.sin(t) * 0.7; armL.rotation.z = Math.sin(t * 0.7) * 0.3
        if (armR) { armR.rotation.x = -Math.sin(t) * 0.7; armR.rotation.z = -Math.sin(t * 0.7) * 0.3 }
        legL.rotation.x = Math.sin(t * 1.5) * 0.28; legR.rotation.x = -Math.sin(t * 1.5) * 0.28
      } else {
        armL.rotation.x = 0; if (armR) { armR.rotation.x = 0; armR.rotation.z = 0 }
        armL.rotation.z = 0
        legL.rotation.x = 0; legR.rotation.x = 0
      }
    }
  }

  updatePlaceHint()
  if (selectedPlaced) updateObjMenuPos(selectedPlaced)
  if (debugMode) _updateDebugOverlay()
  renderer.render(scene, camera)
}

// ── Clear everything the player placed ───────────────────────────────────────
function clearScene() {
  if (!confirm('Alle platzierten Objekte entfernen?')) return
  // Delete from back to front to avoid index shifting
  const uuids = PLACED_OBJECTS.map(o => o.uuid)
  uuids.forEach(id => deletePlacedObj(id, true))
  saveScene()
}
window.clearScene = clearScene

// ─── Avatar Editor UI ─────────────────────────────────────────────────────────
// Fallback-Definitionen falls game3d-core.js gecacht ist (alte Version ohne neue Arrays)
if (typeof EYE_COLORS === 'undefined') {
  window.EYE_COLORS = [0x0e0e1e,0x1a4a8a,0x2d6e2d,0x6b3a2a,0x888888,0x7a3a9a,0x1a8a8a,0xc08030]
}
if (typeof MOUTH_STYLES === 'undefined') {
  window.MOUTH_STYLES = [
    {id:'smile',label:'Lächeln',icon:'😊'},{id:'neutral',label:'Neutral',icon:'😐'},
    {id:'grin',label:'Grinsen',icon:'😁'},{id:'smirk',label:'Schmunzeln',icon:'😏'},
    {id:'pout',label:'Schmollen',icon:'🙁'},
  ]
}
if (typeof BROW_STYLES === 'undefined') {
  window.BROW_STYLES = [
    {id:'normal',label:'Normal',icon:'➖'},{id:'arched',label:'Gebogen',icon:'〰️'},
    {id:'thick',label:'Buschig',icon:'▬'},{id:'thin',label:'Dünn',icon:'—'},
    {id:'angry',label:'Wütend',icon:'⋁'},
  ]
}
if (typeof BEARD_STYLES === 'undefined') {
  window.BEARD_STYLES = [
    {id:'none',label:'Kein Bart',icon:'🚫',gender:'both'},
    {id:'stubble',label:'Stoppeln',icon:'·',gender:'male'},
    {id:'mustache',label:'Schnurrbart',icon:'🥸',gender:'male'},
    {id:'goatee',label:'Ziegenbart',icon:'🐐',gender:'male'},
    {id:'fullbeard',label:'Vollbart',icon:'🧔',gender:'male'},
    {id:'chinstrap',label:'Kinnbart',icon:'👤',gender:'male'},
  ]
}
if (typeof ACCESSORIES_LIST === 'undefined') {
  window.ACCESSORIES_LIST = [
    {id:'glasses_round',label:'Runde Brille',icon:'👓',slot:'face'},
    {id:'glasses_square',label:'Eckige Brille',icon:'🕶️',slot:'face'},
    {id:'sunglasses',label:'Sonnenbrille',icon:'😎',slot:'face'},
    {id:'earrings',label:'Ohrringe',icon:'💎',slot:'ears'},
    {id:'hat_cap',label:'Cap',icon:'🧢',slot:'head'},
    {id:'hat_beanie',label:'Beanie',icon:'🪖',slot:'head'},
    {id:'necklace',label:'Kette',icon:'📿',slot:'neckA'},
    {id:'scarf',label:'Schal',icon:'🧣',slot:'neckB'},
    {id:'watch',label:'Uhr',icon:'⌚',slot:'wrist'},
    {id:'phone',label:'Handy',icon:'📱',slot:'hand'},
    {id:'bag',label:'Tasche',icon:'👜',slot:'carry'},
    {id:'backpack',label:'Rucksack',icon:'🎒',slot:'back'},
  ]
}
// Fehlende AVATAR-Felder ergänzen (falls alter core.js ohne neue Felder)
if (typeof AVATAR !== 'undefined') {
  if (!('eyeColor'    in AVATAR)) AVATAR.eyeColor    = 0
  if (!('mouthStyle'  in AVATAR)) AVATAR.mouthStyle  = 0
  if (!('browStyle'   in AVATAR)) AVATAR.browStyle   = 0
  if (!('beardStyle'  in AVATAR)) AVATAR.beardStyle  = 0
  if (!('accessories' in AVATAR)) AVATAR.accessories = []
}

// Inject CSS overrides from JS so they apply even when index.html is cached
;(() => {
  const s = document.createElement('style')
  s.id = 'av-injected-css'
  s.textContent = `
    #av-backdrop {
      position:fixed!important;inset:0!important;
      background:rgba(0,0,0,0.55)!important;
      backdrop-filter:blur(5px)!important;
      -webkit-backdrop-filter:blur(5px)!important;
      z-index:89!important;display:none!important;pointer-events:all!important;
    }
    #av-backdrop.av-open { display:block!important; }
    #av-panel {
      position:fixed!important;left:50%!important;top:50%!important;
      transform:translate(-50%,calc(-50% + 24px))!important;
      opacity:0!important;pointer-events:none!important;
      width:min(660px,96vw)!important;max-height:88vh!important;
      border-radius:20px!important;
      border-left:1px solid rgba(255,255,255,0.13)!important;
      box-shadow:0 24px 80px rgba(0,0,0,0.85)!important;
      transition:transform 0.26s cubic-bezier(0.32,0.72,0,1),opacity 0.20s!important;
      overflow:hidden!important;
    }
    #av-panel.av-open {
      transform:translate(-50%,-50%)!important;
      opacity:1!important;pointer-events:all!important;
    }
    #av-random-row {
      display:flex!important;gap:10px!important;padding:12px 16px 0!important;flex-shrink:0!important;
    }
    .av-random-btn {
      flex:1!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;
      padding:10px 12px!important;border-radius:12px!important;cursor:pointer!important;font:inherit!important;
      border:1px solid transparent!important;transition:background 0.15s,transform 0.08s!important;
    }
    .av-random-btn:hover { transform:translateY(-2px)!important; }
    .av-random-male {
      background:rgba(37,99,176,0.20)!important;border-color:rgba(80,160,255,0.35)!important;color:#88ccff!important;
    }
    .av-random-male:hover { background:rgba(37,99,176,0.42)!important; }
    .av-random-female {
      background:rgba(200,60,130,0.20)!important;border-color:rgba(255,100,180,0.35)!important;color:#ffaadd!important;
    }
    .av-random-female:hover { background:rgba(200,60,130,0.42)!important; }
    #av-cats {
      display:flex!important;gap:6px!important;padding:10px 16px!important;flex-shrink:0!important;flex-wrap:wrap!important;
    }
    .av-cat-btn {
      flex:1!important;min-width:0!important;display:flex!important;flex-direction:column!important;
      align-items:center!important;gap:3px!important;padding:8px 4px!important;border-radius:12px!important;
      cursor:pointer!important;font:inherit!important;font-size:11px!important;
      background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.10)!important;
      color:#ccc!important;transition:background 0.13s,border-color 0.13s!important;
    }
    .av-cat-btn.active {
      background:rgba(80,160,255,0.22)!important;border-color:rgba(80,160,255,0.55)!important;color:#fff!important;
    }
    .av-cat-btn .cat-icon { font-size:18px!important; }
    #av-content {
      overflow-y:auto!important;flex:1!important;padding:14px 16px!important;
    }
    .av-swatch-grid {
      display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:8px!important;
    }
    #av-body {
      display:flex!important;flex-direction:row!important;flex:1!important;overflow:hidden!important;min-height:0!important;
    }
    #av-preview-col {
      width:150px!important;flex-shrink:0!important;display:flex!important;flex-direction:column!important;
      align-items:center!important;justify-content:flex-start!important;
      padding:14px 0 14px 14px!important;gap:8px!important;
      border-right:1px solid rgba(255,255,255,0.07)!important;
    }
    #av-preview-canvas {
      border-radius:14px!important;background:rgba(255,255,255,0.04)!important;
      border:1px solid rgba(255,255,255,0.08)!important;
      display:block!important;width:130px!important;height:240px!important;
    }
    #av-preview-lbl {
      font-size:10px!important;color:rgba(255,255,255,0.30)!important;
      letter-spacing:0.5px!important;text-transform:uppercase!important;
    }
    #av-right-col {
      flex:1!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;min-width:0!important;
    }
    #av-colors {
      display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:5px!important;
    }
    .av-swatch {
      width:100%!important;aspect-ratio:1!important;border-radius:6px!important;
      cursor:pointer!important;border:2px solid rgba(255,255,255,0.10)!important;
      transition:transform 0.10s,border-color 0.10s!important;
      min-height:0!important;height:auto!important;
    }
    .av-swatch:hover { transform:scale(1.14)!important;border-color:rgba(255,255,255,0.38)!important; }
    .av-swatch.av-sel,.av-swatch.av-sw-on { border-color:#a060ee!important;transform:scale(1.18)!important;box-shadow:0 0 8px rgba(160,96,238,0.75)!important; }
    #av-styles { grid-template-columns:repeat(3,1fr)!important;gap:6px!important; }
    #av-cats { padding:10px 10px 0!important;gap:3px!important; }
    .av-cat-btn { padding:6px 3px!important;font-size:10px!important; }
    .av-cat-btn .cat-icon { font-size:16px!important; }
    #fp-sit {
      background:rgba(120,60,200,0.22)!important;
      border-color:rgba(170,120,255,0.30)!important;color:#cc99ff!important;
    }
    #fp-sit:hover { background:rgba(120,60,200,0.50)!important; }
    #fp-delete { display:none!important; }
  `
  document.head.appendChild(s)

  // Ensure av-backdrop exists in DOM (may be missing in old cached index.html)
  if (!document.getElementById('av-backdrop')) {
    const bd = document.createElement('div')
    bd.id = 'av-backdrop'
    bd.onclick = () => { if (typeof toggleAvatarEditor === 'function') toggleAvatarEditor() }
    document.body.insertBefore(bd, document.body.firstChild)
  }

  // Ensure av-random-row exists inside av-panel (may be missing in old cached index.html)
  const avPanel = document.getElementById('av-panel')
  if (avPanel && !document.getElementById('av-random-row')) {
    const row = document.createElement('div')
    row.id = 'av-random-row'
    row.innerHTML = `
      <button class="av-random-btn av-random-male"  onclick="avRandomize('male')">🎲 Zufällig Mann</button>
      <button class="av-random-btn av-random-female" onclick="avRandomize('female')">🎲 Zufällig Frau</button>
    `
    const titlebar = avPanel.querySelector('#av-titlebar')
    if (titlebar) titlebar.after(row)
    else avPanel.insertBefore(row, avPanel.firstChild)
  }
  // Ensure #av-body + #av-preview-col + #av-right-col exist (may be missing in cached index.html)
  if (avPanel && !document.getElementById('av-body')) {
    const cats      = document.getElementById('av-cats')
    const stylesWrp = document.getElementById('av-styles-wrap')
    const colorSec  = document.getElementById('av-color-section')
    if (cats && stylesWrp && colorSec) {
      const previewCol = document.createElement('div')
      previewCol.id = 'av-preview-col'
      previewCol.innerHTML = `<canvas id="av-preview-canvas" width="130" height="240"></canvas><div id="av-preview-lbl">Vorschau</div>`
      const rightCol = document.createElement('div')
      rightCol.id = 'av-right-col'
      rightCol.appendChild(cats)
      rightCol.appendChild(stylesWrp)
      rightCol.appendChild(colorSec)
      const body = document.createElement('div')
      body.id = 'av-body'
      body.appendChild(previewCol)
      body.appendChild(rightCol)
      // Insert after av-random-row or at end of panel
      const randomRow = document.getElementById('av-random-row')
      if (randomRow) randomRow.after(body)
      else avPanel.appendChild(body)
    }
  }

  // Ensure fp-sit exists and fp-delete is hidden
  const fpDelete = document.getElementById('fp-delete')
  if (fpDelete) fpDelete.style.display = 'none'
  const fpBtns = document.querySelector('.fp-btns')
  if (fpBtns && !document.getElementById('fp-sit')) {
    const sitBtn = document.createElement('button')
    sitBtn.id = 'fp-sit'
    sitBtn.innerHTML = '<span class="bic">🪑</span><span>Sitzen</span>'
    fpBtns.appendChild(sitBtn)
  }
})()


const AV_CATS = [
  { id:'skin',   icon:'🎨', label:'Haut'    },
  { id:'body',   icon:'🏋️', label:'Körper'  },
  { id:'face',   icon:'👁️', label:'Gesicht' },
  { id:'hair',   icon:'💇', label:'Haar'    },
  { id:'shirt',  icon:'👕', label:'Shirt'   },
  { id:'pants',  icon:'👖', label:'Hose'    },
  { id:'shoes',  icon:'👟', label:'Schuhe'  },
  { id:'acc',    icon:'🎒', label:'Zubehör' },
]

let avEditorOpen = false
let avCat = 'hair'

function renderAvCats() {
  const el = document.getElementById('av-cats')
  if (!el) return
  el.innerHTML = AV_CATS.map(c =>
    `<button class="av-cat${avCat===c.id?' av-active':''}" onclick="avSetCat('${c.id}')">
       <span class="av-cat-ic">${c.icon}</span>
       <span class="av-cat-lb">${c.label}</span>
     </button>`
  ).join('')
}

function renderAvContent() {
  const styleGrid  = document.getElementById('av-styles')
  const colorGrid  = document.getElementById('av-colors')
  const colorLabel = document.getElementById('av-color-lbl')
  if (!styleGrid) return

  function swatches(arr, prop) {
    return arr.map((c, i) => {
      const hex = '#' + c.toString(16).padStart(6, '0')
      const act = AVATAR[prop] === i ? ' av-sw-on' : ''
      return `<div class="av-swatch${act}" style="background:${hex}" onclick="avSet('${prop}',${i})"></div>`
    }).join('')
  }

  const styleItems = (arr, prop) =>
    arr.map((s, i) => {
      const act = AVATAR[prop] === i ? ' av-si-on' : ''
      return `<div class="av-si${act}" onclick="avSet('${prop}',${i})">
                <span class="av-si-ic">${s.icon}</span>
                <span class="av-si-lb">${s.label}</span>
              </div>`
    }).join('')

  if (avCat === 'skin') {
    styleGrid.innerHTML = ''
    colorLabel.textContent = '🎨 Hautton'
    colorGrid.innerHTML = swatches(SKIN_TONES, 'skinTone')

  } else if (avCat === 'body') {
    const makeItems = (arr) => arr.map(s => {
      const i = BODY_TYPES.indexOf(s)
      const act = AVATAR.bodyType === i ? ' av-si-on' : ''
      return `<div class="av-si${act}" onclick="avSet('bodyType',${i})">
                <span class="av-si-ic">${s.icon}</span>
                <span class="av-si-lb">${s.label}</span>
              </div>`
    }).join('')
    const male   = BODY_TYPES.filter(b => b.gender === 'male')
    const female = BODY_TYPES.filter(b => b.gender === 'female')
    styleGrid.innerHTML =
      `<div class="av-gender-lbl">♂ Mann</div>${makeItems(male)}` +
      `<div class="av-gender-lbl">♀ Frau</div>${makeItems(female)}`
    colorLabel.textContent = ''
    colorGrid.innerHTML = ''

  } else if (avCat === 'face') {
    // Eye color + mouth style + brow style + beard
    const isMale = (BODY_TYPES[AVATAR.bodyType]?.gender !== 'female')
    // Eye section
    styleGrid.innerHTML =
      `<div class="av-gender-lbl">👄 Mund</div>` +
      styleItems(MOUTH_STYLES, 'mouthStyle') +
      `<div class="av-gender-lbl">✏️ Augenbrauen</div>` +
      styleItems(BROW_STYLES, 'browStyle') +
      (isMale ? `<div class="av-gender-lbl">🧔 Bart</div>` +
        BEARD_STYLES.filter(b => b.gender !== 'female').map((s, _) => {
          const i = BEARD_STYLES.indexOf(s)
          const act = AVATAR.beardStyle === i ? ' av-si-on' : ''
          return `<div class="av-si${act}" onclick="avSet('beardStyle',${i})">
                    <span class="av-si-ic">${s.icon}</span>
                    <span class="av-si-lb">${s.label}</span>
                  </div>`
        }).join('') : '')
    colorLabel.textContent = '👁️ Augenfarbe'
    colorGrid.innerHTML = EYE_COLORS.map((c, i) => {
      const hex = '#' + c.toString(16).padStart(6, '0')
      const act = AVATAR.eyeColor === i ? ' av-sw-on' : ''
      return `<div class="av-swatch${act}" style="background:${hex}" onclick="avSet('eyeColor',${i})"></div>`
    }).join('')

  } else if (avCat === 'hair') {
    styleGrid.innerHTML = styleItems(HAIR_STYLES, 'hairStyle')
    colorLabel.textContent = '🎨 Haarfarbe'
    colorGrid.innerHTML = swatches(HAIR_COLORS, 'hairColor')

  } else if (avCat === 'shirt') {
    const isFemale = (BODY_TYPES[AVATAR.bodyType]?.gender === 'female')
    const visibleShirts = SHIRT_STYLES.filter(s => s.id !== 'bikini' || isFemale)
    styleGrid.innerHTML = visibleShirts.map(s => {
      const i = SHIRT_STYLES.indexOf(s)
      const act = AVATAR.shirtStyle === i ? ' av-si-on' : ''
      return `<div class="av-si${act}" onclick="avSet('shirtStyle',${i})">
                <span class="av-si-ic">${s.icon}</span>
                <span class="av-si-lb">${s.label}</span>
              </div>`
    }).join('')
    colorLabel.textContent = '🎨 Shirt Farbe'
    colorGrid.innerHTML = swatches(SHIRT_COLORS, 'shirtColor')

  } else if (avCat === 'pants') {
    styleGrid.innerHTML = styleItems(PANTS_STYLES, 'pantsStyle')
    colorLabel.textContent = '🎨 Hosen Farbe'
    colorGrid.innerHTML = swatches(PANTS_COLORS, 'pantsColor')

  } else if (avCat === 'shoes') {
    styleGrid.innerHTML = ''
    colorLabel.textContent = '🎨 Schuh Farbe'
    colorGrid.innerHTML = swatches(SHOE_COLORS, 'shoeColor')

  } else if (avCat === 'acc') {
    // Multi-select accessories — toggle on/off, multiple allowed
    // Slot conflict: only one per slot (face, head, hand, wrist, back, carry) BUT neckA+neckB ok
    const accArr = AVATAR.accessories || []
    styleGrid.innerHTML = ACCESSORIES_LIST.map(a => {
      const on = accArr.includes(a.id)
      return `<div class="av-si av-acc${on ? ' av-si-on' : ''}" onclick="avToggleAcc('${a.id}')">
                <span class="av-si-ic">${a.icon}</span>
                <span class="av-si-lb">${a.label}</span>
              </div>`
    }).join('')
    colorLabel.textContent = ''
    colorGrid.innerHTML = ''
  }
}

function avToggleAcc(id) {
  const slot = (ACCESSORIES_LIST.find(a => a.id === id) || {}).slot
  let arr = [...(AVATAR.accessories || [])]
  if (arr.includes(id)) {
    arr = arr.filter(x => x !== id)
  } else {
    // Remove conflicting slot items (single-slot: face glasses conflict with each other, head hats conflict)
    const singleSlots = ['face','head','hand','wrist','back','carry']
    if (slot && singleSlots.includes(slot)) arr = arr.filter(x => {
      const s = (ACCESSORIES_LIST.find(a => a.id === x) || {}).slot
      return s !== slot
    })
    arr.push(id)
  }
  AVATAR.accessories = arr
  rebuildCharacter(); renderAvContent(); _renderAvPreview()
  clearTimeout(_avSaveTimer)
  _avSaveTimer = setTimeout(() => {
    window.parent.postMessage({ type: 'AVATAR_CHANGED', avatar_code: stateToAvatarCode() }, '*')
  }, 400)
}
window.avToggleAcc = avToggleAcc

function avSetCat(cat) { avCat = cat; renderAvCats(); renderAvContent() }
window.avSetCat = avSetCat

let _avSaveTimer = null
function avSet(prop, val) {
  AVATAR[prop] = val
  // Wenn auf männlichen Body-Type gewechselt wird und Bikini aktiv → auf Basic zurück
  if (prop === 'bodyType' && BODY_TYPES[val]?.gender === 'male') {
    const currentShirt = (SHIRT_STYLES[AVATAR.shirtStyle] || SHIRT_STYLES[0]).id
    if (currentShirt === 'bikini') AVATAR.shirtStyle = 0
  }
  rebuildCharacter()
  renderAvCats()
  renderAvContent()
  _renderAvPreview()
  // Save to parent (debounced 400ms so rapid clicks → single API call)
  clearTimeout(_avSaveTimer)
  _avSaveTimer = setTimeout(() => {
    window.parent.postMessage({ type: 'AVATAR_CHANGED', avatar_code: stateToAvatarCode() }, '*')
  }, 400)
}
window.avSet = avSet

function avRandomize(gender) {
  const bodyIdx = BODY_TYPES.reduce((arr, b, i) => { if (b.gender === gender) arr.push(i); return arr }, [])
  AVATAR.bodyType   = bodyIdx[Math.floor(Math.random() * bodyIdx.length)]
  AVATAR.skinTone   = Math.floor(Math.random() * SKIN_TONES.length)
  AVATAR.hairStyle  = Math.floor(Math.random() * HAIR_STYLES.length)
  AVATAR.hairColor  = Math.floor(Math.random() * HAIR_COLORS.length)
  const validShirts = SHIRT_STYLES.reduce((arr, s, i) => { if (s.id !== 'bikini' || gender === 'female') arr.push(i); return arr }, [])
  AVATAR.shirtStyle = validShirts[Math.floor(Math.random() * validShirts.length)]
  AVATAR.shirtColor = Math.floor(Math.random() * SHIRT_COLORS.length)
  AVATAR.pantsStyle = Math.floor(Math.random() * PANTS_STYLES.length)
  AVATAR.pantsColor = Math.floor(Math.random() * PANTS_COLORS.length)
  AVATAR.shoeColor  = Math.floor(Math.random() * SHOE_COLORS.length)
  // Extended fields
  AVATAR.eyeColor   = Math.floor(Math.random() * EYE_COLORS.length)
  AVATAR.mouthStyle = Math.floor(Math.random() * MOUTH_STYLES.length)
  AVATAR.browStyle  = Math.floor(Math.random() * BROW_STYLES.length)
  const validBeards = BEARD_STYLES.reduce((arr, s, i) => { if (s.gender === 'both' || s.gender === gender) arr.push(i); return arr }, [])
  AVATAR.beardStyle = validBeards[Math.floor(Math.random() * validBeards.length)]
  // Random 0–2 accessories
  const shuffled = [...ACCESSORIES_LIST].sort(() => Math.random() - 0.5)
  const picked = []; const usedSlots = new Set()
  for (const a of shuffled) {
    if (picked.length >= 2) break
    if (!usedSlots.has(a.slot)) { picked.push(a.id); usedSlots.add(a.slot) }
  }
  AVATAR.accessories = picked
  rebuildCharacter(); renderAvCats(); renderAvContent(); _renderAvPreview()
  clearTimeout(_avSaveTimer)
  _avSaveTimer = setTimeout(() => {
    window.parent.postMessage({ type: 'AVATAR_CHANGED', avatar_code: stateToAvatarCode() }, '*')
  }, 400)
}
window.avRandomize = avRandomize

// ─── Live Avatar Preview (mini Three.js renderer) ──────────────────────────
let _avPrev = null  // { renderer, scene, camera, charGroup, animId }

function _initAvPreview() {
  const canvas = document.getElementById('av-preview-canvas')
  if (!canvas) return
  if (_avPrev) { _renderAvPreview(); return }

  const W = 130, H = 240
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H)
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.75))
  const sun = new THREE.DirectionalLight(0xffffff, 1.1)
  sun.position.set(3, 6, 5)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x8899ff, 0.35)
  fill.position.set(-3, 2, -3)
  scene.add(fill)

  // Perspective camera: slightly front-diagonal, looking at torso height
  const camera = new THREE.PerspectiveCamera(22, W / H, 0.1, 100)
  camera.position.set(2.8, 2.2, 4.8)
  camera.lookAt(0, 1.1, 0)

  _avPrev = { renderer, scene, camera, charGroup: null }
  _renderAvPreview()
}

function _renderAvPreview() {
  if (!_avPrev) return
  const { renderer, scene, camera } = _avPrev
  if (_avPrev.charGroup) scene.remove(_avPrev.charGroup)
  const grp = buildCharacter(AVATAR)
  grp.position.set(0, 0, 0)
  scene.add(grp)
  _avPrev.charGroup = grp
  renderer.render(scene, camera)
}

function toggleAvatarEditor() {
  avEditorOpen = !avEditorOpen
  const panel    = document.getElementById('av-panel')
  const backdrop = document.getElementById('av-backdrop')
  if (panel)    panel.classList.toggle('av-open', avEditorOpen)
  if (backdrop) backdrop.classList.toggle('av-open', avEditorOpen)
  if (avEditorOpen) { renderAvCats(); renderAvContent(); setTimeout(_initAvPreview, 40) }
  if (!avEditorOpen) {
    clearTimeout(_avSaveTimer)
    window.parent.postMessage({ type: 'AVATAR_CHANGED', avatar_code: stateToAvatarCode() }, '*')
    window.parent.postMessage({ type: 'AVATAR_EDITOR_CLOSED' }, '*')
  }
}
window.toggleAvatarEditor = toggleAvatarEditor
const _avCloseBtn = document.getElementById('av-close')
if (_avCloseBtn) _avCloseBtn.addEventListener('click', toggleAvatarEditor)

// Convert palette index to 6-char hex string
function _numToHex(n) { return n.toString(16).padStart(6, '0') }
// Find nearest palette index by absolute colour distance
function _nearestIdx(palette, hexStr) {
  const target = parseInt((hexStr || '000000').replace('#', ''), 16)
  let best = 0, bestDist = Infinity
  palette.forEach((c, i) => { const d = Math.abs(c - target); if (d < bestDist) { bestDist = d; best = i } })
  return best
}
// Find style index by id string
function _styleIdx(arr, id) { const i = arr.findIndex(s => s.id === id); return i >= 0 ? i : 0 }

// Serialise current AVATAR state to pipe-separated avatar_code
function stateToAvatarCode() {
  return [
    _numToHex(SKIN_TONES[AVATAR.skinTone]),
    _numToHex(HAIR_COLORS[AVATAR.hairColor]),
    (HAIR_STYLES[AVATAR.hairStyle]  || HAIR_STYLES[0]).id,
    _numToHex(SHIRT_COLORS[AVATAR.shirtColor]),
    (SHIRT_STYLES[AVATAR.shirtStyle] || SHIRT_STYLES[0]).id,
    _numToHex(PANTS_COLORS[AVATAR.pantsColor]),
    (PANTS_STYLES[AVATAR.pantsStyle] || PANTS_STYLES[0]).id,
    _numToHex(SHOE_COLORS[AVATAR.shoeColor]),
    (BODY_TYPES[AVATAR.bodyType] || BODY_TYPES[0]).id,
    // Extended fields (v2) — backwards-compatible
    String(AVATAR.eyeColor ?? 0),
    (MOUTH_STYLES[AVATAR.mouthStyle ?? 0] || MOUTH_STYLES[0]).id,
    (BROW_STYLES[AVATAR.browStyle ?? 0]   || BROW_STYLES[0]).id,
    (BEARD_STYLES[AVATAR.beardStyle ?? 0] || BEARD_STYLES[0]).id,
    (AVATAR.accessories || []).join(',') || 'none',
  ].join('|')
}

// Apply a pipe-separated avatar_code to AVATAR and rebuild character
function applyAvatarCode(code) {
  if (!code) return
  const p = code.split('|')
  if (p.length < 9) return
  AVATAR.skinTone   = _nearestIdx(SKIN_TONES,   p[0])
  AVATAR.hairColor  = _nearestIdx(HAIR_COLORS,  p[1])
  AVATAR.hairStyle  = _styleIdx(HAIR_STYLES,  p[2])
  AVATAR.shirtColor = _nearestIdx(SHIRT_COLORS, p[3])
  AVATAR.shirtStyle = _styleIdx(SHIRT_STYLES, p[4])
  AVATAR.pantsColor = _nearestIdx(PANTS_COLORS, p[5])
  AVATAR.pantsStyle = _styleIdx(PANTS_STYLES, p[6])
  AVATAR.shoeColor  = _nearestIdx(SHOE_COLORS,  p[7])
  AVATAR.bodyType   = p[8] ? _styleIdx(BODY_TYPES, p[8]) : 0
  // Extended v2 fields
  if (p.length >= 14) {
    AVATAR.eyeColor   = Math.min(parseInt(p[9]) || 0, EYE_COLORS.length - 1)
    AVATAR.mouthStyle = _styleIdx(MOUTH_STYLES, p[10])
    AVATAR.browStyle  = _styleIdx(BROW_STYLES,  p[11])
    AVATAR.beardStyle = _styleIdx(BEARD_STYLES, p[12])
    const accRaw = p[13] === 'none' ? '' : (p[13] || '')
    AVATAR.accessories = accRaw ? accRaw.split(',').filter(id => ACCESSORIES_LIST.some(a => a.id === id)) : []
  }
  rebuildCharacter()
}

// ── Local Player Name Label ───────────────────────────────────────────────────
let _localPlayerName = ''
let _roomOwnerName   = ''
function _applyLocalNameLabel() {
  if (!charGroup) return
  // Altes Label entfernen
  const old = charGroup.getObjectByName('_localNameLabel')
  if (old) {
    charGroup.remove(old)
    old.material?.map?.dispose()
    old.material?.dispose()
  }
  if (_localPlayerName) {
    const label = _makeNameLabel(_localPlayerName)
    label.name = '_localNameLabel'
    label.position.set(0, 3.4, 0)
    charGroup.add(label)
  }
}

// ── Player Profile Panel ──────────────────────────────────────────────────────
let _playerPanelEl = document.getElementById('player-panel')

;(() => {
  if (!_playerPanelEl) {
    const el = document.createElement('div')
    el.id = 'player-panel'
    el.style.cssText = [
      'display:none','flex-direction:column','position:fixed',
      'bottom:16px','right:16px','width:230px',
      'background:#0f1117',
      'border:1px solid rgba(255,255,255,0.10)',
      'border-radius:16px','box-shadow:0 12px 40px rgba(0,0,0,0.7)',
      'z-index:9999','font-family:inherit','overflow:hidden'
    ].join(';')
    document.body.appendChild(el)
    _playerPanelEl = el
  }
  const pp = _playerPanelEl

  // Header: Name + close
  if (!document.getElementById('pp-header')) {
    const hdr = document.createElement('div')
    hdr.id = 'pp-header'
    hdr.style.cssText = 'display:flex;align-items:center;gap:8px;padding:11px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.07)'
    hdr.innerHTML =
      '<span id="pp-icon" style="font-size:18px;line-height:1">👤</span>' +
      '<span id="pp-name" style="flex:1;font-size:13px;font-weight:700;color:#f0eee8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">?</span>' +
      '<button id="pp-close" style="background:none;border:none;color:rgba(255,255,255,0.30);font-size:15px;cursor:pointer;padding:0 2px;line-height:1">✕</button>'
    pp.appendChild(hdr)
  }

  // Avatar-Vorschau + Info (rechts davon: Gemeinde, Level, Motto)
  if (!document.getElementById('pp-body')) {
    const body = document.createElement('div')
    body.id = 'pp-body'
    body.style.cssText = 'display:flex;gap:10px;padding:12px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.06)'
    body.innerHTML =
      '<canvas id="pp-avatar-canvas" width="80" height="80" style="width:80px;height:80px;border-radius:10px;background:#1a1e28;image-rendering:pixelated;flex-shrink:0"></canvas>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px">' +
        '<div id="pp-municipality" style="display:none;align-items:center;gap:4px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.25);border-radius:20px;padding:2px 8px;font-size:10px;color:#93c5fd;font-weight:600;width:fit-content;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🏙️ <span id="pp-municipality-name"></span></div>' +
        '<div id="pp-level-badge" style="display:inline-flex;align-items:center;gap:4px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);border-radius:20px;padding:2px 8px;font-size:10px;color:#fbbf24;font-weight:700;width:fit-content">⭐ Level <span id="pp-level-num">1</span></div>' +
        '<div id="pp-motto-row" style="display:flex;align-items:flex-start;gap:4px">' +
          '<p id="pp-motto" style="margin:0;flex:1;font-size:11px;font-style:italic;color:rgba(255,255,255,0.40);line-height:1.3;word-break:break-word;cursor:pointer"></p>' +
          '<button id="pp-motto-edit-btn" style="display:none;background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;padding:1px 2px;font-size:11px;line-height:1;flex-shrink:0" title="Motto bearbeiten">✏️</button>' +
        '</div>' +
        '<div id="pp-motto-edit-row" style="display:none">' +
          '<input id="pp-motto-input" maxlength="128" placeholder="Dein Motto..." style="width:100%;box-sizing:border-box;background:#1e2330;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:11px;color:#e8e4de;outline:none;font-style:italic" />' +
        '</div>' +
      '</div>'
    pp.appendChild(body)
  }

  // Buttons
  if (!document.getElementById('pp-actions')) {
    const acts = document.createElement('div')
    acts.id = 'pp-actions'
    acts.style.cssText = 'display:flex;flex-direction:column;gap:5px;padding:9px 10px 10px'
    acts.innerHTML =
      '<button id="pp-wave" style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);color:#e0dbd2;border-radius:9px;padding:7px 11px;font-size:12px;cursor:pointer;width:100%;text-align:left;transition:background 0.15s">👋 Winken</button>' +
      '<button id="pp-edit" style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);color:#e0dbd2;border-radius:9px;padding:7px 11px;font-size:12px;cursor:pointer;width:100%;text-align:left;transition:background 0.15s">✏️ Avatar bearbeiten</button>'
    pp.appendChild(acts)
  }
})()

// Mini-Renderer für Avatar-Vorschau (einmalig erstellt)
let _miniR = null
function _renderAvatarCfgPreview(canvasEl, avatarCfg) {
  try {
    // Mini-Renderer beim ersten Aufruf erstellen
    if (!_miniR) {
      _miniR = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      _miniR.setPixelRatio(window.devicePixelRatio || 1)
      _miniR.setSize(96, 96)
      _miniR._scene = new THREE.Scene()
      _miniR._scene.background = new THREE.Color(0x1e1a14)
      _miniR._scene.add(new THREE.AmbientLight(0xffffff, 1.1))
      const dl = new THREE.DirectionalLight(0xffffff, 0.6)
      dl.position.set(1, 3, 2)
      _miniR._scene.add(dl)
      // Kamera: isometrisch, schaut auf Kopfhöhe
      _miniR._cam = new THREE.OrthographicCamera(-0.52, 0.52, 0.52, -0.52, 0.01, 20)
      _miniR._cam.position.set(1.2, 2.2, 1.2)
      _miniR._cam.lookAt(0, 1.65, 0)
    }
    // Alten Charakter entfernen
    const old = _miniR._scene.getObjectByName('_previewChar')
    if (old) _miniR._scene.remove(old)

    // Neuen Charakter bauen (buildCharacter ist global aus game3d-character.js)
    const grp = buildCharacter(avatarCfg || null)
    grp.name = '_previewChar'
    _miniR._scene.add(grp)
    _miniR.render(_miniR._scene, _miniR._cam)

    // In Panel-Canvas kopieren
    const dpr = window.devicePixelRatio || 1
    canvasEl.width  = 96 * dpr
    canvasEl.height = 96 * dpr
    canvasEl.style.width  = '96px'
    canvasEl.style.height = '96px'
    const ctx = canvasEl.getContext('2d')
    ctx.drawImage(_miniR.domElement, 0, 0, canvasEl.width, canvasEl.height)
  } catch (err) {
    console.warn('[AvatarPreview]', err)
  }
}

function showPlayerPanel(isLocal, name, group, avatarCfg, motto, municipalityName, userLevel) {
  if (!_playerPanelEl) return
  hideFurniturePanel()
  const _id = (id) => document.getElementById(id)

  // Robuster Name-Fallback
  let displayName = name
  if (!displayName && isLocal) displayName = _localPlayerName
  if (!displayName && group)   displayName = group.userData?.playerName || ''
  if (!displayName)            displayName = '?'

  const nameEl = _id('pp-name')
  if (nameEl) nameEl.textContent = displayName

  const iconEl = _id('pp-icon')
  if (iconEl) iconEl.textContent = isLocal ? '🧑' : '👤'

  // Gemeinde-Badge
  const munEl  = _id('pp-municipality')
  const munName = _id('pp-municipality-name')
  if (munEl && munName) {
    if (municipalityName) {
      munName.textContent = municipalityName
      munEl.style.display = 'flex'
    } else {
      munEl.style.display = 'none'
    }
  }

  // Level-Badge
  const lvlNum = _id('pp-level-num')
  if (lvlNum) lvlNum.textContent = userLevel ?? 1

  // Motto anzeigen + Edit nur für eigenen Avatar
  const mottoEl      = _id('pp-motto')
  const mottoEditBtn = _id('pp-motto-edit-btn')
  const mottoEditRow = _id('pp-motto-edit-row')
  const mottoInput   = _id('pp-motto-input')

  // Edit-Row zurücksetzen beim Öffnen
  if (mottoEditRow) mottoEditRow.style.display = 'none'
  if (mottoEl?.parentElement) mottoEl.parentElement.style.display = 'flex'

  const _updateMottoDisplay = (text) => {
    if (!mottoEl) return
    if (text) {
      mottoEl.textContent = '„' + text + '"'
      mottoEl.style.color = 'rgba(255,255,255,0.55)'
    } else {
      mottoEl.textContent = isLocal ? 'Kein Motto gesetzt...' : ''
      mottoEl.style.color = 'rgba(255,255,255,0.25)'
    }
  }
  _updateMottoDisplay(motto)

  if (mottoEditBtn) mottoEditBtn.style.display = isLocal ? 'block' : 'none'

  const _openMottoEdit = (currentMotto) => {
    if (!mottoEditRow || !mottoInput || !mottoEl?.parentElement) return
    mottoEl.parentElement.style.display = 'none'
    mottoEditRow.style.display = 'block'
    mottoInput.value = currentMotto || ''
    mottoInput.focus()
    mottoInput.select()
  }

  const _saveMotto = async () => {
    if (!mottoInput) return
    const newMotto = mottoInput.value.trim().slice(0, 128)
    if (mottoEditRow) mottoEditRow.style.display = 'none'
    if (mottoEl?.parentElement) mottoEl.parentElement.style.display = 'flex'
    _updateMottoDisplay(newMotto)
    try {
      const token = window._gameAuthToken || localStorage.getItem('isocity_auth_token')
      if (!token) { console.warn('[Motto] Kein Auth-Token'); return }
      const apiBase = window._gameApiBase || 'http://127.0.0.1:4100'
      const res = await fetch(`${apiBase}/api/users/me/motto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Game-Token': token },
        body: JSON.stringify({ motto: newMotto })
      })
      const json = await res.json()
      if (json.ok) {
        window._localMotto = json.motto || ''
        _updateMottoDisplay(json.motto || '')
        // Parent benachrichtigen → re-spawn damit alle das neue Motto sehen
        window.parent?.postMessage({ type: 'MOTTO_SAVED', motto: json.motto || '' }, '*')
      }
    } catch(e) { console.warn('[Motto save]', e) }
  }

  if (mottoEditBtn) mottoEditBtn.onclick = () => _openMottoEdit(window._localMotto || motto)
  if (mottoEl && isLocal) {
    mottoEl.onclick = () => _openMottoEdit(window._localMotto || motto)
    mottoEl.style.cursor = 'pointer'
  } else if (mottoEl) {
    mottoEl.onclick = null
    mottoEl.style.cursor = 'default'
  }
  if (mottoInput) {
    mottoInput.onblur    = _saveMotto          // Wegklicken → speichern
    mottoInput.onkeydown = (e) => {
      e.stopPropagation()
      if (e.key === 'Enter')  { mottoInput.blur() } // blur triggert save
      if (e.key === 'Escape') {
        mottoInput.onblur = null               // Escape → nicht speichern
        mottoInput.value  = window._localMotto || motto || ''
        if (mottoEditRow) mottoEditRow.style.display = 'none'
        if (mottoEl?.parentElement) mottoEl.parentElement.style.display = 'flex'
        _updateMottoDisplay(window._localMotto || motto)
        mottoInput.onblur = _saveMotto         // Wieder aktivieren
      }
    }
  }

  // Avatar-Vorschau
  const canvasEl = _id('pp-avatar-canvas')
  if (canvasEl) {
    const cfg = avatarCfg || (isLocal ? (typeof AVATAR !== 'undefined' ? AVATAR : null) : null)
    _renderAvatarCfgPreview(canvasEl, cfg)
  }

  const waveBtn = _id('pp-wave')
  if (waveBtn) {
    waveBtn.style.display = isLocal ? 'none' : ''
    waveBtn.onclick = () => {
      _hidePlayerPanelImpl()
      if (char.state !== 'sit' && char.state !== 'sleep') char.state = 'wave'
    }
  }

  const editBtn = _id('pp-edit')
  if (editBtn) {
    editBtn.style.display = isLocal ? '' : 'none'
    editBtn.onclick = () => {
      _hidePlayerPanelImpl()
      if (!avEditorOpen) toggleAvatarEditor()
    }
  }

  const closeBtn = _id('pp-close')
  if (closeBtn) closeBtn.onclick = _hidePlayerPanelImpl

  _playerPanelEl.style.display = 'flex'
  _playerPanelEl.classList.add('fp-in')
}

function _hidePlayerPanelImpl() {
  if (_playerPanelEl) {
    _playerPanelEl.classList.remove('fp-in')
    _playerPanelEl.style.display = 'none'
  }
}
window._hidePlayerPanelImpl = _hidePlayerPanelImpl

// ── Aufstehen vom Sitz: Charakter vor dem Möbel platzieren ───────────────────
// Wird aus game3d-character.js aufgerufen (window._standUpFromSeat).
// Schiebt char ~1 Tile in Sitz-Blickrichtung (weg vom Rücken des Sofas),
// bis eine nicht-blockierte Position gefunden ist.
function _standUpFromSeat() {
  if (typeof isBlocked !== 'function') return
  const facY = char._sitFacingY ?? char.dir
  // Versuche 0.8, 1.2, 1.6 Tiles in Blickrichtung
  for (const dist of [0.8, 1.2, 1.6, 2.0]) {
    const tx = char.x + Math.sin(facY) * dist
    const tz = char.z + Math.cos(facY) * dist
    if (!isBlocked(tx, tz, char.level)) {
      char.x = tx; char.z = tz
      return
    }
  }
  // Fallback: alle 8 Richtungen absuchen
  for (const [dx, dz] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const tx = char.x + dx, tz = char.z + dz
    if (!isBlocked(tx, tz, char.level)) { char.x = tx; char.z = tz; return }
  }
}
window._standUpFromSeat = _standUpFromSeat

// ── Auf Möbel sitzen (aus Furniture-Panel) ────────────────────────────────────
window._sitOnFurniture = function(obj) {
  if (!obj || !SEATING_TYPES_ALL.includes(obj.type)) return

  // Jacuzzi: einfach hinlaufen, auto-sit übernimmt
  if (obj.type === 'jacuzzi') {
    if (char.state === 'sit' || char.state === 'jacuzzi_undress') {
      char.state = 'idle'; redressAfterJacuzzi?.(); _standUpFromSeat()
    }
    char.target = { x: obj.x, z: obj.z }
    char._headedToSeat = null
    char._waypoints = findPath(char.x, char.z, obj.x, obj.z, char.level) || []
    return
  }

  // Alle Sitze dieses Möbels sammeln (max 1.6 Tiles vom Objekt-Zentrum)
  const objSeats = SEATS.filter(s =>
    !s.jacuzziCenter &&
    (s.level ?? 0) === char.level &&
    Math.hypot(s.x - obj.x, s.z - obj.z) <= 1.6
  )
  if (objSeats.length === 0) return

  // Aktuell besetzter Sitz dieses Möbels?
  const alreadyOnThisFurniture = (char.state === 'sit') && char._currentSeat &&
    objSeats.includes(char._currentSeat)

  let target = null
  if (alreadyOnThisFurniture && objSeats.length > 1) {
    // Anderen (nicht aktuellen) Sitz wählen — den nächsten freien
    const others = objSeats.filter(s => s !== char._currentSeat)
    // Nächsten zum Charakter
    target = others.reduce((best, s) => {
      const d = Math.hypot(s.x - char.x, s.z - char.z)
      return (!best || d < best.d) ? { s, d } : best
    }, null)?.s
  } else {
    // Erstmalig: nächsten Sitz zum Charakter wählen
    target = objSeats.reduce((best, s) => {
      const d = Math.hypot(s.x - char.x, s.z - char.z)
      return (!best || d < best.d) ? { s, d } : best
    }, null)?.s
  }
  if (!target) return

  // Aufstehen falls nötig
  if (char.state === 'sit' || char.state === 'jacuzzi_undress') {
    char.state = 'idle'; redressAfterJacuzzi?.(); _standUpFromSeat()
  }

  const dist = Math.hypot(target.x - char.x, target.z - char.z)
  if (dist < 1.2) {
    // Direkt einrasten
    char.x = target.x; char.z = target.z
    char.dir = target.facingY
    char._sitFacingY = target.facingY
    char._currentSeat = target
    char.state = 'sit'
  } else {
    // Hinlaufen — auto-sit schnappt beim Ankommen
    char._headedToSeat = target
    char.target = { x: target.x, z: target.z, autoSit: target }
    char._waypoints = findPath(char.x, char.z, target.x, target.z, char.level) || []
    if (char.state !== 'walk') char.state = 'walk'
  }
}

// ── Remote Player Avatars (Multiplayer) ──────────────────────────────────────
const _remoteAvatars = new Map() // playerId → { group, x, z }

function _parseAvatarCodeToCfg(code) {
  if (!code) return null
  const p = code.split('|')
  if (p.length < 10) return null
  return {
    skinTone:   _nearestIdx(SKIN_TONES,   p[0]),
    hairColor:  _nearestIdx(HAIR_COLORS,  p[1]),
    hairStyle:  _styleIdx(HAIR_STYLES,  p[2]),
    shirtColor: _nearestIdx(SHIRT_COLORS, p[3]),
    shirtStyle: _styleIdx(SHIRT_STYLES, p[4]),
    pantsColor: _nearestIdx(PANTS_COLORS, p[5]),
    pantsStyle: _styleIdx(PANTS_STYLES, p[6]),
    shoeColor:  _nearestIdx(SHOE_COLORS,  p[7]),
    bodyType:   p[8] ? _styleIdx(BODY_TYPES, p[8]) : 0,
  }
}

function _makeNameLabel(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(8, 14, 240, 38, 10)
  else ctx.rect(8, 14, 240, 38)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(name || '?').slice(0, 18), 128, 33)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.2, 0.55, 1)
  sprite.renderOrder = 999
  return sprite
}

function _makeChatSprite(text, isOwner) {
  const maxLen = 28
  const raw     = isOwner ? '👑 ' + text : text
  const display = raw.length > maxLen ? raw.slice(0, maxLen - 1) + '…' : raw
  const canvas  = document.createElement('canvas')
  canvas.width  = 320; canvas.height = 80
  const ctx     = canvas.getContext('2d')
  ctx.font      = 'bold 20px sans-serif'
  const tw  = ctx.measureText(display).width
  const pad = 16
  const bw  = Math.max(tw + pad * 2, 60), bh = 46
  const bx  = (320 - bw) / 2, by = 8

  // Bubble background
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10)
  else ctx.rect(bx, by, bw, bh)
  ctx.fillStyle = isOwner ? 'rgba(255,240,140,0.97)' : 'rgba(255,255,255,0.92)'
  ctx.fill()

  // Owner: gold border
  if (isOwner) {
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10)
    else ctx.rect(bx, by, bw, bh)
    ctx.strokeStyle = '#c8910a'
    ctx.lineWidth   = 3
    ctx.stroke()
  }

  ctx.fillStyle     = isOwner ? '#3d2000' : '#1a1a2e'
  ctx.textAlign     = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(display, 160, by + bh / 2)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(3.2, 0.8, 1)
  sprite.renderOrder = 1000
  return sprite
}

function _spawnRemoteAvatar(playerId, name, x, z, avatarCode, dir, level) {
  _removeRemoteAvatar(playerId)
  const cfg = _parseAvatarCodeToCfg(avatarCode)
  const group = buildCharacter(cfg || AVATAR)
  const initLevel = Number(level ?? 0)
  const fy = (typeof getFloorY === 'function') ? getFloorY(x, z, initLevel) : 0
  group.position.set(x, fy, z)
  const label = _makeNameLabel(name)
  label.position.set(0, 3.4, 0)
  group.add(label)
  scene.add(group)
  const initDir = Number(dir ?? 0)
  group.rotation.y = initDir
  const pid = String(playerId)
  group.userData.playerName = name || ''
  // Roller-Sim wird nur noch via explizites onRoller-Flag gestartet (kein auto-findRollerAt)
  _remoteAvatars.set(pid, { group, x, z, dir: initDir, state: 'idle', animT: 0, waypoints: [], chatSprite: null, chatTimer: 0, name: name || '', avatarCode: avatarCode || null, rollerTarget: null, level: initLevel, motto: null, municipalityName: null, userLevel: 1 })
}

// ── Jacuzzi-Undress für Remote-Avatare ──────────────────────────────────────
function _undressRemoteAvatar(ra) {
  if (ra._isUndressed) return
  ra._isUndressed = true
  const cfg = _parseAvatarCodeToCfg(ra.avatarCode)
  const skinTone  = cfg?.skinTone  ?? 0
  const bodyType  = cfg?.bodyType  ?? 0
  const skinHex   = SKIN_TONES[skinTone] ?? 0xfee0c0
  const skinMat   = makeMat(skinHex)
  const isFemale  = (BODY_TYPES[bodyType]?.gender === 'female')
  const trunkHex  = isFemale ? 0xe03068 : 0x2563eb
  const trunkMat  = makeMat(trunkHex)
  const trunkDark = makeMat(shadeHex(trunkHex, -0.25))

  ra._origMats = {}
  const parts = ['torso','armL','armR','forearmL','forearmR','handL','handR','legL','legR','shoeL','shoeR']
  for (const name of parts) {
    const grp = ra.group.getObjectByName(name)
    if (!grp) continue
    ra._origMats[name] = []
    grp.traverse(m => {
      if (!m.isMesh) return
      ra._origMats[name].push({ mesh: m, mat: m.material, vis: m.visible })
      if (name === 'shoeL' || name === 'shoeR') {
        m.visible = false
      } else if (name === 'torso') {
        m.material = skinMat
      } else if (name === 'legL' || name === 'legR') {
        const ly = m.position?.y ?? 0
        m.material = ly > -0.25 ? trunkMat : (ly > -0.45 ? trunkDark : skinMat)
      } else if (name.startsWith('arm') || name.startsWith('forearm') || name.startsWith('hand')) {
        m.material = skinMat
      }
    })
  }
  // Bikini-Top für Frauen
  if (isFemale) {
    const torsoGrp = ra.group.getObjectByName('torso')
    if (torsoGrp) {
      const bikiniTopMat = makeMat(shadeHex(trunkHex, 0.15))
      const topL = box(0.23, 0.22, 0.10, bikiniTopMat, -0.14, 0.12, 0.19)
      const topR = box(0.23, 0.22, 0.10, bikiniTopMat,  0.14, 0.12, 0.19)
      const band = box(0.52, 0.06, 0.07, makeMat(shadeHex(trunkHex, -0.15)), 0, 0.01, 0.19)
      topL.userData._raBikini = true; topR.userData._raBikini = true; band.userData._raBikini = true
      torsoGrp.add(topL); torsoGrp.add(topR); torsoGrp.add(band)
    }
  }
}

function _redressRemoteAvatar(ra) {
  if (!ra._isUndressed) return
  ra._isUndressed = false
  // Bikini-Top Meshes entfernen
  const torsoGrp = ra.group.getObjectByName('torso')
  if (torsoGrp) {
    const toRemove = []
    torsoGrp.traverse(m => { if (m.userData._raBikini) toRemove.push(m) })
    for (const m of toRemove) torsoGrp.remove(m)
  }
  // Originalmaterialien wiederherstellen
  if (ra._origMats) {
    for (const entries of Object.values(ra._origMats)) {
      for (const e of entries) { e.mesh.material = e.mat; e.mesh.visible = e.vis }
    }
    ra._origMats = {}
  }
}

function _removeRemoteAvatar(playerId) {
  const pid = String(playerId)
  const entry = _remoteAvatars.get(pid)
  if (!entry) return
  scene.remove(entry.group)
  entry.group.traverse(o => {
    if (o.isMesh) {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
      else o.material?.dispose()
    }
  })
  _remoteAvatars.delete(pid)
}

function _clearRemoteAvatars() {
  for (const pid of [..._remoteAvatars.keys()]) _removeRemoteAvatar(pid)
}

// ── postMessage API ───────────────────────────────────────────────────────────
let _roomReadySent = false   // guard: ROOM_READY only once (prevents ROOM_INIT ↔ ROOM_READY loop)
window.addEventListener('message', (e) => {
  if (!e.data || typeof e.data !== 'object') return
  const { type } = e.data

  // Parent sends room init data (model_name + avatar_code + catalog from SQL)
  // Room geometry is defined as code constants (ROOM_TEMPLATES) — no JSON stored.
  if (type === 'ROOM_INIT') {
    console.log('[game3d] ROOM_INIT received, placements:', e.data.placements?.length ?? 0)
    canPlaceFurniture = e.data.is_owner === true
    // Katalog aus SQL-Daten aufbauen (shop_items Tabelle)
    // Raumgeometrie aus SQL aufbauen (grid, Wände, Stockwerke, Treppe)
    buildRoomGeometry(e.data.geometry ?? {})
    if (Array.isArray(e.data.catalog) && e.data.catalog.length > 0) {
      setCatalog(buildCatalogFromItems(e.data.catalog))
    }
    if (e.data.player_name) _localPlayerName = String(e.data.player_name)
    if (e.data.owner_nickname) _roomOwnerName = String(e.data.owner_nickname)
    if (e.data.auth_token)  window._gameAuthToken = e.data.auth_token
    if (e.data.api_base)    window._gameApiBase   = e.data.api_base
    _applyLocalNameLabel()  // always call — tags charGroup meshes for click detection
    if (e.data.avatar_code) applyAvatarCode(e.data.avatar_code)
    // Load server-persisted furniture placements
    if (Array.isArray(e.data.placements)) loadScene(e.data.placements)
    // Load room NPCs (separate table, rendered via ITEM_DEFS 'room_npc')
    if (Array.isArray(e.data.npcs)) {
      for (const npc of e.data.npcs) {
        const facingY = FACING_Y[FACING_DIRS[npc.facing_idx ?? 0]] ?? 0
        const buildFn = ITEM_DEFS.get('room_npc')
        if (buildFn) {
          const group = buildFn(npc.x, npc.z, facingY, { npc_name: npc.npc_name, npc_style: npc.npc_style })
          if (group) {
            const meshes = []
            group.traverse(m => { if (m.isMesh) { m.userData.placedUUID = 'npc_' + npc.id; meshes.push(m) } })
            PLACED_MESHES.push(...meshes)
            PLACED_OBJECTS.push({
              type: 'room_npc', group, uuid: 'npc_' + npc.id,
              x: npc.x, z: npc.z, wx: npc.x, wz: npc.z,
              facingIdx: npc.facing_idx ?? 0, floorLevel: npc.floor_level ?? 0,
              serverId: npc.id, meshes,
              isNpc: true, npcName: npc.npc_name, npcStyle: npc.npc_style
            })
          }
        }
      }
    }
    // Only send ROOM_READY once — parent guards against duplicate ROOM_READY,
    // but we avoid spamming by only signalling on the very first init.
    if (!_roomReadySent) {
      _roomReadySent = true
      window.parent?.postMessage({ type: 'ROOM_READY' }, '*')
    }
    return
  }

  // Live-Update: nur Möbel tauschen ohne kompletten Room-Rebuild (für Multiplayer-Sync)
  if (type === 'FURNITURE_REFRESH') {
    console.log('[game3d] FURNITURE_REFRESH received, placements:', e.data.placements?.length ?? 0)
    if (Array.isArray(e.data.placements)) loadScene(e.data.placements)
    return
  }

  // Eigenen Namen aktualisieren (async geladen nach ROOM_INIT)
  if (type === 'LOCAL_PLAYER_NAME' && typeof e.data.name === 'string') {
    _localPlayerName = e.data.name
    _applyLocalNameLabel()
    return
  }

  // Eigenes Profil-Info (Motto, Gemeinde, Level) für das eigene Panel
  if (type === 'LOCAL_PLAYER_PROFILE') {
    window._localMotto           = e.data.motto           ?? null
    window._localMunicipalityName = e.data.municipalityName ?? null
    window._localUserLevel       = e.data.userLevel        ?? 1
    return
  }

  // Snapshot aller Avatare beim Join (andere Spieler bereits im Raum)
  if (type === 'AVATARS_SNAPSHOT') {
    _clearRemoteAvatars()
    const localId = String(e.data.localPlayerId || '')
    for (const av of (e.data.avatars || [])) {
      if (!av || String(av.playerId) === localId) continue
      _spawnRemoteAvatar(av.playerId, av.name, av.x ?? 0, av.y ?? 0, av.avatarConfig?.avatar_code, av.dir, av.level ?? 0)
      const ra = _remoteAvatars.get(String(av.playerId))
      if (ra) {
        ra.motto = av.motto ?? null
        ra.municipalityName = av.municipalityName ?? null
        ra.userLevel = av.userLevel ?? 1
      }
    }
    return
  }

  // Neuer Spieler betritt den Raum (oder Name/Avatar-Update)
  if (type === 'AVATAR_SPAWNED') {
    const localId = String(e.data.localPlayerId || '')
    if (String(e.data.playerId) === localId) return
    // Bestehende Position beibehalten wenn neuer Spawn bei 0,0 (Name-Update)
    const existing = _remoteAvatars.get(String(e.data.playerId))
    const spawnX = (e.data.x === 0 && e.data.y === 0 && existing) ? existing.x : (e.data.x ?? 0)
    const spawnZ = (e.data.x === 0 && e.data.y === 0 && existing) ? existing.z : (e.data.y ?? 0)
    const spawnDir = (e.data.x === 0 && e.data.y === 0 && existing) ? existing.dir : (e.data.dir ?? 0)
    const spawnLevel = (e.data.x === 0 && e.data.y === 0 && existing) ? existing.level : (e.data.level ?? 0)
    _spawnRemoteAvatar(e.data.playerId, e.data.name, spawnX, spawnZ, e.data.avatarConfig?.avatar_code, spawnDir, spawnLevel)
    // Motto / Gemeinde / Level aus Spawn-Daten übernehmen
    const ra = _remoteAvatars.get(String(e.data.playerId))
    if (ra) {
      if (e.data.motto !== undefined)          ra.motto = e.data.motto
      if (e.data.municipalityName !== undefined) ra.municipalityName = e.data.municipalityName
      if (e.data.userLevel !== undefined)        ra.userLevel = e.data.userLevel
    }
    return
  }

  // Spieler bewegt sich → Waypoint-Queue setzen (gleiche Logik wie lokaler Char)
  if (type === 'AVATAR_MOVED') {
    const entry = _remoteAvatars.get(String(e.data.playerId))
    if (!entry) return
    const rawPath = Array.isArray(e.data.path) ? e.data.path : []
    const waypoints = rawPath.length > 0
      ? rawPath.map(p => ({ x: Number(p.x), z: Number(p.y ?? p.z ?? 0) }))
      : [{ x: e.data.targetX ?? e.data.x ?? entry.x, z: e.data.targetY ?? e.data.y ?? entry.z }]
    const firstWp = waypoints[0]
    // Floor-Level übernehmen (damit getFloorY den richtigen Y-Wert liefert)
    if (e.data.level !== undefined) entry.level = e.data.level
    if (e.data.onRoller) {
      // Spieler ist auf einem Roller → Position setzen, nächsten Roller-Target suchen
      if (firstWp) { entry.x = firstWp.x; entry.z = firstWp.z }
      entry.waypoints = []
      // Nächsten Roller-Target deterministisch berechnen (wie beim lokalen Avatar)
      const nearRol = findRollerAt(entry.x, entry.z)
      if (nearRol) {
        const dv = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }[nearRol.dir] || [0, 0]
        entry.rollerTarget = { x: nearRol.cx + dv[0], z: nearRol.cz + dv[1] }
      }
      return
    }
    // Normales Move-Event (kein Roller) → laufende Roller-Simulation abbrechen
    if (entry.rollerTarget) {
      entry.rollerTarget = null
    }
    // Waypoints setzen; wenn zu weit entfernt → teleportieren
    if (firstWp && Math.hypot(firstWp.x - entry.x, firstWp.z - entry.z) > 3.0) {
      entry.x = firstWp.x; entry.z = firstWp.z
      entry.waypoints = waypoints.slice(1)
    } else {
      entry.waypoints = waypoints
    }
    return
  }

  // Chat-Nachricht eines anderen Spielers → Sprechblase über Avatar
  if (type === 'AVATAR_CHAT') {
    const entry = _remoteAvatars.get(String(e.data.playerId))
    if (!entry) return
    // Alte Blase entfernen
    if (entry.chatSprite) {
      entry.group.remove(entry.chatSprite)
      entry.chatSprite.material.map?.dispose()
      entry.chatSprite.material.dispose()
      entry.chatSprite = null
    }
    // Raum-Besitzer bekommt goldene Krone-Blase
    const senderIsOwner = _roomOwnerName && String(e.data.playerName) === _roomOwnerName
    const sprite = _makeChatSprite(String(e.data.message || ''), senderIsOwner)
    sprite.position.set(0, 4.8, 0)
    entry.group.add(sprite)
    entry.chatSprite = sprite
    entry.chatTimer = 5.0
    return
  }

  // Lampe ein/aus von anderem Spieler
  if (type === 'LAMP_TOGGLED') {
    const tx = Number(e.data.x), tz = Number(e.data.z)
    const obj = PLACED_OBJECTS.find(o => (o.type === 'lamp' || o.type === 'test_lamp') && Math.abs(o.x - tx) < 0.1 && Math.abs(o.z - tz) < 0.1)
    if (obj) {
      // force state to match broadcaster
      if (obj.group?.userData) obj.group.userData._lampOn = !e.data.on // toggleLamp will flip it
      toggleLamp(obj)
    }
    return
  }

  // State-Änderung (sitzen, schlafen, idle) eines anderen Spielers
  if (type === 'AVATAR_STATE') {
    const entry = _remoteAvatars.get(String(e.data.playerId))
    if (!entry) return
    let newState = e.data.state || 'idle'
    // jacuzzi_undress: Animation-Timer zurücksetzen, läuft im game-loop
    if (newState === 'jacuzzi_undress') {
      entry.x = e.data.x ?? entry.x
      entry.z = e.data.y ?? entry.z
      entry.waypoints = []
      entry.state = 'jacuzzi_undress'
      entry._undressT = 0
      return
    }
    // Wenn Avatar aus Jacuzzi rausgeht → Kleidung wiederherstellen
    if ((entry.state === 'sit' || entry.state === 'jacuzzi_undress') &&
        newState !== 'sit' && newState !== 'jacuzzi_undress') {
      _redressRemoteAvatar(entry)
    }
    entry.state = newState
    entry.dir = Number(e.data.dir ?? entry.dir)
    if (newState === 'sit' || newState === 'sleep') {
      entry.x = e.data.x ?? entry.x
      entry.z = e.data.y ?? entry.z
      entry.waypoints = []
    }
    return
  }

  // Spieler verlässt den Raum
  if (type === 'AVATAR_REMOVED') {
    _removeRemoteAvatar(e.data.playerId ?? e.data.avatarId)
    return
  }

  // Neuer Spieler joined → aktuelle Position + State sofort an alle broadcasten
  if (type === 'REQUEST_POS_RESYNC') {
    const resyncOnRoller = !!char.rollerTarget
    window.parent?.postMessage({ type: 'CHAR_POS_UPDATE', x: char.x, y: char.z, dir: char.dir, level: char.level ?? 0, onRoller: resyncOnRoller || undefined }, '*')
    window.parent?.postMessage({ type: 'CHAR_STATE', state: char.state, x: char.x, z: char.z, dir: char.dir }, '*')
    return
  }

  // Eigenen lokalen Avatar auf neuen Spawn-Punkt setzen (nach room-joined)
  if (type === 'LOCAL_AVATAR_SPAWN') {
    char.x = e.data.x ?? char.x
    char.z = e.data.z ?? char.z
    return
  }

  // Parent confirms a placement was saved to DB — store the server id
  if (type === 'FURNITURE_SAVED') {
    const obj = PLACED_OBJECTS.find(o => o.uuid === e.data.uuid)
    if (obj) obj.serverId = e.data.server_id
    return
  }

  // NPC saved — store server id + rebuild name tag with actual meta
  if (type === 'NPC_SAVED') {
    const obj = PLACED_OBJECTS.find(o => o.uuid === e.data.uuid)
    if (obj) {
      obj.serverId = e.data.server_id
      obj.isNpc    = true
      obj.npcName  = e.data.npc_name
      obj.npcStyle = e.data.npc_style
    }
    return
  }

  // Parent wants to update only the avatar
  if (type === 'AVATAR_SET') {
    if (e.data.avatar_code) applyAvatarCode(e.data.avatar_code)
    return
  }

  // Parent requests avatar editor panel to open
  if (type === 'SHOW_AVATAR_EDITOR') {
    if (!avEditorOpen) toggleAvatarEditor()
    return
  }

  // Parent requests avatar editor panel to close
  if (type === 'HIDE_AVATAR_EDITOR') {
    if (avEditorOpen) toggleAvatarEditor()
    return
  }

  // Parent requests placing an item from inventory — activates ghost/hold mode.
  // quantity: how many the user has; ghost/hold clears automatically when exhausted.
  if (type === 'PLACE_ITEM' && typeof e.data.item_code === 'string') {
    if (!canPlaceFurniture) return
    heldQty = (typeof e.data.quantity === 'number' && e.data.quantity > 0)
      ? e.data.quantity
      : Infinity
    // NPC: Metadaten speichern für spawnPlaced
    if (e.data.item_code === 'room_npc' && e.data.npc_meta) {
      window._pendingNpcMeta = e.data.npc_meta
    }
    pickItem(e.data.item_code)
    return
  }
})

// Wartet auf ROOM_INIT vom Parent (React) mit den SQL-Geometriedaten.
// ── Debug overlay (Toggle: Shift+D) ───────────────────────────────────────────
let debugMode = false
let _dbgWires      = []   // static wires (floors, solids, stairs) — rebuilt once on toggle
let _dbgPathWires  = []   // dynamic path wires — rebuilt every frame in debug mode
let _dbgHUD        = null
var _dbgLastClick  = null // persistenter Klickpunkt { x, z, level } — bleibt bis nächster Klick

function _clearDebugWires() {
  for (const m of _dbgWires) scene.remove(m)
  _dbgWires = []
}
function _clearPathWires() {
  for (const m of _dbgPathWires) scene.remove(m)
  _dbgPathWires = []
}

// ── Shared line/dot helpers ───────────────────────────────────────────────────
function _dbgLine(pts, color, list) {
  const geo  = new THREE.BufferGeometry().setFromPoints(pts)
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false }))
  line.renderOrder = 999
  scene.add(line); list.push(line)
}
function _dbgDot(x, y, z, color, size, list) {
  const geo  = new THREE.SphereGeometry(size, 5, 5)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false }))
  mesh.renderOrder = 999
  mesh.position.set(x, y, z)
  scene.add(mesh); list.push(mesh)
}
function _dbgWireBox(x0, x1, y, z0, z1, color, list) {
  _dbgLine([
    new THREE.Vector3(x0,y,z0), new THREE.Vector3(x1,y,z0),
    new THREE.Vector3(x1,y,z1), new THREE.Vector3(x0,y,z1),
    new THREE.Vector3(x0,y,z0)
  ], color, list)
}

function _buildDebugWires() {
  _clearDebugWires()
  // Floors (grün=EG, cyan=OG)
  for (const f of ROOM_FLOORS_DATA) {
    const col = +f.floor_index === 0 ? 0x00ff88 : 0x00ccff
    _dbgWireBox(f.x0, f.x1, f.y + 0.08, f.z0, f.z1, col, _dbgWires)
  }
  // Staircase zones (orange)
  for (const st of ROOM_STAIRS_DATA_NEW) {
    const [sdx, sdz] = _STAIR_DV[st.dir] || [0, 1]
    const hw = (st.width || 3) / 2
    let sx0, sx1, sz0, sz1
    if (sdx === 0) {
      sx0 = st.anchor_x - hw; sx1 = st.anchor_x + hw
      sz0 = sdz > 0 ? st.anchor_z : st.anchor_z - st.steps
      sz1 = sdz > 0 ? st.anchor_z + st.steps : st.anchor_z
    } else {
      sz0 = st.anchor_z - hw; sz1 = st.anchor_z + hw
      sx0 = sdx > 0 ? st.anchor_x : st.anchor_x - st.steps
      sx1 = sdx > 0 ? st.anchor_x + st.steps : st.anchor_x
    }
    _dbgWireBox(sx0, sx1, st.base_y + 0.05, sz0, sz1, 0xffaa00, _dbgWires)
  }
  // SOLID zones (rot)
  for (const s of SOLID) {
    const y = s.level <= 0 ? 0.12 : (ROOM_FLOORS_DATA.find(f=>f.floor_index===s.level)?.y ?? FLOOR2_Y) + 0.12
    _dbgWireBox(s.x0, s.x1, y, s.z0, s.z1, 0xff2222, _dbgWires)
  }
  // Placed objects: gelbe Bounding-Dots
  for (const obj of PLACED_OBJECTS) {
    const oy = obj.group.position.y
    _dbgDot(obj.x, oy + 1.0, obj.z, 0xffff00, 0.07, _dbgWires)
  }
}

// ── Path debug: roter Faden + Waypoint-Dots — jedes Frame neu ───────────────
function _updatePathWires() {
  _clearPathWires()
  const flY = charGroup.position.y + 0.15

  // 1. Charakter-Position: weißer Dot
  _dbgDot(char.x, flY, char.z, 0xffffff, 0.10, _dbgPathWires)

  // 2. Klick-Marker — roher Mausklick (grün) + tatsächliches Ziel (cyan)
  const clickRef = char.target
    ? { rawX: char.target.x, rawZ: char.target.z, x: char.target.x, z: char.target.z, floorY: getFloorY(char.target.x, char.target.z, char.level) }
    : _dbgLastClick
  if (clickRef) {
    const arrived = !char.target
    const baseY = (clickRef.floorY ?? 0) + 0.05

    // ── A: Roher Mausklick (grüner Punkt + kleines Kreuz) ──────────────────
    if (clickRef.rawX !== undefined) {
      const ry = baseY + 0.03
      const hs = 0.22
      _dbgDot(clickRef.rawX, ry + 0.08, clickRef.rawZ, 0x44ff44, 0.09, _dbgPathWires)
      _dbgLine([new THREE.Vector3(clickRef.rawX-hs, ry, clickRef.rawZ),
                new THREE.Vector3(clickRef.rawX+hs, ry, clickRef.rawZ)], 0x44ff44, _dbgPathWires)
      _dbgLine([new THREE.Vector3(clickRef.rawX, ry, clickRef.rawZ-hs),
                new THREE.Vector3(clickRef.rawX, ry, clickRef.rawZ+hs)], 0x44ff44, _dbgPathWires)

      // Verbindungslinie Mausklick → Ziel (wenn sie auseinanderfallen)
      const snapDist = Math.hypot(clickRef.rawX - clickRef.x, clickRef.rawZ - clickRef.z)
      if (snapDist > 0.15) {
        _dbgLine([new THREE.Vector3(clickRef.rawX, ry+0.05, clickRef.rawZ),
                  new THREE.Vector3(clickRef.x, baseY+0.05, clickRef.z)], 0x44ff44, _dbgPathWires)
      }
    }

    // ── B: Tatsächliches Ziel (cyan Säule + großes Kreuz) ──────────────────
    const markerColor = arrived ? 0x006666 : 0x00ffff
    const hs = 0.45
    _dbgLine([new THREE.Vector3(clickRef.x-hs, baseY+0.02, clickRef.z),
              new THREE.Vector3(clickRef.x+hs, baseY+0.02, clickRef.z)], markerColor, _dbgPathWires)
    _dbgLine([new THREE.Vector3(clickRef.x, baseY+0.02, clickRef.z-hs),
              new THREE.Vector3(clickRef.x, baseY+0.02, clickRef.z+hs)], markerColor, _dbgPathWires)
    _dbgLine([new THREE.Vector3(clickRef.x, baseY, clickRef.z),
              new THREE.Vector3(clickRef.x, baseY + 2.2, clickRef.z)], markerColor, _dbgPathWires)
    _dbgDot(clickRef.x, baseY + 2.3, clickRef.z, markerColor, 0.12, _dbgPathWires)

    // ── C: Direkte Linie Char → Ziel + blockierende SOLIDs gelb ────────────
    if (!arrived) {
      _dbgLine([new THREE.Vector3(char.x, flY, char.z),
                new THREE.Vector3(clickRef.x, baseY+0.08, clickRef.z)], 0x334455, _dbgPathWires)
      const steps = 32
      const ddx = (clickRef.x - char.x) / steps
      const ddz = (clickRef.z - char.z) / steps
      for (const s of SOLID) {
        if ((s.level ?? 0) !== char.level) continue
        let blocked = false
        for (let i = 1; i < steps; i++) {
          const tx = char.x + ddx * i, tz = char.z + ddz * i
          if (tx >= s.x0 && tx <= s.x1 && tz >= s.z0 && tz <= s.z1) { blocked = true; break }
        }
        if (!blocked) continue
        const sy = (s.level <= 0 ? 0 : (ROOM_FLOORS_DATA.find(f=>f.floor_index===s.level)?.y ?? FLOOR2_Y)) + 0.20
        _dbgWireBox(s.x0-0.04, s.x1+0.04, sy+0.05, s.z0-0.04, s.z1+0.04, 0xffff00, _dbgPathWires)
        _dbgDot((s.x0+s.x1)/2, sy+0.3, (s.z0+s.z1)/2, 0xffcc00, 0.10, _dbgPathWires)
      }
    }
  }

  // 3. Waypoint-Pfad: roter Faden von Char → WP1 → WP2 → … → Ziel
  if (char._waypoints && char._waypoints.length > 0) {
    const pts = [new THREE.Vector3(char.x, flY, char.z)]
    for (const wp of char._waypoints) {
      const wy = getFloorY(wp.x, wp.z, char.level) + 0.18
      pts.push(new THREE.Vector3(wp.x, wy, wp.z))
    }
    if (char.target) {
      const ty = getFloorY(char.target.x, char.target.z, char.level) + 0.18
      pts.push(new THREE.Vector3(char.target.x, ty, char.target.z))
    }
    _dbgLine(pts, 0xff2222, _dbgPathWires)
    // Waypoint-Dots (orange)
    for (const wp of char._waypoints) {
      const wy = getFloorY(wp.x, wp.z, char.level) + 0.18
      _dbgDot(wp.x, wy, wp.z, 0xff6600, 0.07, _dbgPathWires)
    }
  } else if (char.target) {
    // Direktlinie (kein A*-Pfad, direkte Bewegung)
    const ty = getFloorY(char.target.x, char.target.z, char.level) + 0.18
    _dbgLine([new THREE.Vector3(char.x, flY, char.z),
              new THREE.Vector3(char.target.x, ty, char.target.z)], 0xff8800, _dbgPathWires)
  }

  // 4. SOLID-Hindernisse auf aktuellem Level: rote Mini-Kreuze (nur direkt umliegende)
  for (const s of SOLID) {
    if ((s.level ?? 0) !== char.level) continue
    const sy = (s.level <= 0 ? 0 : (ROOM_FLOORS_DATA.find(f=>f.floor_index===s.level)?.y ?? FLOOR2_Y)) + 0.20
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2
    if (Math.abs(cx - char.x) > 8 || Math.abs(cz - char.z) > 8) continue  // nur nahe Objekte zeigen
    _dbgLine([new THREE.Vector3(s.x0, sy, s.z0), new THREE.Vector3(s.x1, sy, s.z0),
              new THREE.Vector3(s.x1, sy, s.z1), new THREE.Vector3(s.x0, sy, s.z1),
              new THREE.Vector3(s.x0, sy, s.z0)], 0xff4444, _dbgPathWires)
  }
}

function _updateDebugOverlay() {
  if (!_dbgHUD) {
    _dbgHUD = document.createElement('div')
    _dbgHUD.id = 'dbg-hud'
    Object.assign(_dbgHUD.style, {
      position:'fixed', top:'8px', left:'8px', background:'rgba(0,0,0,0.75)',
      color:'#0f0', fontFamily:'monospace', fontSize:'11px', padding:'6px 10px',
      borderRadius:'6px', zIndex:'9999', pointerEvents:'none', whiteSpace:'pre',
      lineHeight:'1.5'
    })
    document.body.appendChild(_dbgHUD)
  }

  // Rebuild placed-object dots every frame (they move)
  // Remove old placed dots (last N entries of _dbgWires — too complex, just rebuild section)
  _buildDebugWires()

  _updatePathWires()

  const flY      = getFloorY(char.x, char.z, char.level).toFixed(2)
  const charPhysY = charGroup.position.y.toFixed(2)
  const floorList = ROOM_FLOORS_DATA.map(f =>
    `  idx:${f.floor_index} y:${f.y} x:[${f.x0}..${f.x1}] z:[${f.z0}..${f.z1}]`
  ).join('\n')
  const wpStr = char._waypoints?.length > 0
    ? char._waypoints.slice(0,5).map((w,i)=>`  [${i}] x:${w.x.toFixed(1)} z:${w.z.toFixed(1)}`).join('\n')
      + (char._waypoints.length > 5 ? `\n  …+${char._waypoints.length-5} mehr` : '')
    : '  (leer — Direktlinie)'
  const tStr = char.target
    ? `x:${char.target.x.toFixed(1)} z:${char.target.z.toFixed(1)}${char.target.autoSit ? ' [autoSit]' : ''}`
    : _dbgLastClick
      ? `(angekommen) letzter Klick: x:${_dbgLastClick.x.toFixed(1)} z:${_dbgLastClick.z.toFixed(1)}`
      : '(kein)'
  const solidNear = SOLID.filter(s => (s.level??0)===char.level &&
    Math.abs((s.x0+s.x1)/2-char.x)<8 && Math.abs((s.z0+s.z1)/2-char.z)<8).length

  _dbgHUD.textContent =
    `=== DEBUG + PATH ===\n` +
    `\x1b[0m● CHAR  x:${char.x.toFixed(2)} z:${char.z.toFixed(2)}  physY:${charPhysY}\n` +
    `  level:${char.level}  floorY:${flY}  state:${char.state}\n` +
    `\n🎯 ZIEL   ${tStr}\n` +
    `\n🔴 PFAD (${char._waypoints?.length ?? 0} Waypoints):\n${wpStr}\n` +
    `\n🧱 SOLIDS level=${char.level}: ${solidNear} in Reichweite (rot)\n` +
    `\n🏠 FLOORS (${ROOM_FLOORS_DATA.length}):\n` + (floorList || '  (leer)') + '\n' +
    `   stairs:${ROOM_STAIRS_DATA_NEW.length}  canPlace:${canPlaceFurniture}\n` +
    `\n━━━ Legende ━━━\n` +
    `  ⬜ weiß     = Charakter\n` +
    `  🟢 grün Kreuz = roher Mausklick\n` +
    `  🩵 cyan Säule = tatsächliches Ziel\n` +
    `  ─ grau─     = Direktlinie (ignoriert SOLID)\n` +
    `  🔴 rot      = A*-Pfad\n` +
    `  🟠 orange   = Waypoint-Dot\n` +
    `  🟡 gelb Box = SOLID blockiert Direktweg\n` +
    `  🟥 rot Box  = SOLID (alle Hindernisse)\n` +
    `  🟡 gelb Dot = platziertes Objekt\n` +
    `  🟢 grün Box = Floor EG\n` +
    `  🔵 cyan Box = Floor OG\n` +
    `  🟠 orange Box = Treppen-Zone\n` +
    `[Shift+D = debug aus]`
}

function _toggleDebug() {
  debugMode = !debugMode
  if (debugMode) {
    _buildDebugWires()
  } else {
    _clearDebugWires()
    _clearPathWires()
    if (_dbgHUD) { _dbgHUD.remove(); _dbgHUD = null }
  }
}
window.addEventListener('keydown', e => { if (e.shiftKey && e.key === 'D') _toggleDebug() })
window.toggleDebug = _toggleDebug

// ── Start render loop ─────────────────────────────────────────────────────────
loop()
