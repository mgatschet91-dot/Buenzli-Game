// ─── game3d-core.js ── Foundation: constants, scene, helpers, avatar config, collision, pathfinding ──

// ─── Three.js Isometric Game ──────────────────────────────────────────────────
// True isometric camera (orthographic) — Three.js handles all 3D perspective.
// Character is built from Box3D shapes (Minecraft/Habbo voxel style).

// Embedded flag — true when running inside an iframe (mansion room viewer).
// Must be declared first so all subsequent code can reference it.
// Immer embedded (wird nur via iframe aus React geladen, Daten kommen vom Server)

const TILE  = 1.0    // world units per tile
var   GRID  = 20     // map size — overridden by SQL (room_models.grid_size)
const SPEED = 5.0    // tiles per second

// ─── Multi-level world ─────────────────────────────────────────────────────────
// All values below are overridden at runtime from SQL (room_floors / room_staircases).
var FLOOR2_Y = 7.0            // first upper floor height in world units

// First upper floor footprint (world coords) — from room_floors WHERE floor_index=1
var F2_X0 = -7, F2_X1 = 8
var F2_Z0 = -9, F2_Z1 = -3

// Fixed staircase zone bounds — from room_staircases
var ST_X0 = 5, ST_X1 = 8
var ST_Z0 = -3, ST_Z1 = 7

// Placed stair zones (shop-placed dynamic ramps, populated by addStairZone)
// Each entry: { uuid, x0,x1,z0,z1, fromX,fromZ, toX,toZ, rise, totalD }
const STAIR_ZONES = []

// Placed teleporter zones (portal pads, populated by addTeleportZone)
// Paired by index: 0↔1, 2↔3, etc.
// Each entry: { uuid, wx, wz }
const TELEPORT_ZONES = []
var _teleportTimer = 0   // cooldown in seconds after each teleport

// ── Editor-Format Room Data (gesetzt von _buildEditorRoom) ────────────────────
// Werden von getFloorY + Level-Tracking genutzt wenn neues Format aktiv ist.
var ROOM_FLOORS_DATA = []     // [{floor_index, x0,x1,z0,z1, y}]
var ROOM_STAIRS_DATA_NEW = [] // [{anchor_x,anchor_z,dir,width,steps,height,from_floor,to_floor,base_y}]
const PLACE_FLOOR_MESHES = [] // Tile-Meshes für Placement-Raycast (kein Y nötig)
const WALL_MESHES = []        // Wand-Meshes für Frame-Raycast {mesh, edge:'N'|'S'|'E'|'W', wallCoord, floorY}

// Returns the character floor Y for a given world XZ + logical level (0=ground, 1=upper).
// Level 0 can walk freely under the second floor footprint (returns 0).
// Level 1 treats the footprint as solid floor (returns FLOOR2_Y).
// Supports both the old template format and the new editor format (ROOM_FLOORS_DATA).
const _STAIR_DV = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }
function getFloorY(wx, wz, level = 0) {
  // ── Neues Format: Editor-Treppen ──────────────────────────────────────────
  for (const st of ROOM_STAIRS_DATA_NEW) {
    const [dx, dz] = _STAIR_DV[st.dir] || [0, 1]
    const hw = (st.width || 3) / 2
    let inZone = false, t = 0
    if (dx === 0) { // N / S
      const zLo = dz > 0 ? st.anchor_z : st.anchor_z - st.steps
      const zHi = dz > 0 ? st.anchor_z + st.steps : st.anchor_z
      if (wx >= st.anchor_x - hw && wx <= st.anchor_x + hw && wz >= zLo && wz <= zHi) {
        inZone = true
        t = dz > 0 ? (wz - st.anchor_z) / st.steps : (st.anchor_z - wz) / st.steps
      }
    } else { // E / W
      const xLo = dx > 0 ? st.anchor_x : st.anchor_x - st.steps
      const xHi = dx > 0 ? st.anchor_x + st.steps : st.anchor_x
      if (wz >= st.anchor_z - hw && wz <= st.anchor_z + hw && wx >= xLo && wx <= xHi) {
        inZone = true
        t = dx > 0 ? (wx - st.anchor_x) / st.steps : (st.anchor_x - wx) / st.steps
      }
    }
    if (inZone) return (st.base_y || 0) + Math.max(0, Math.min(1, t)) * st.height
  }
  // ── Placed stair zones (shop-placed stairs, checked first) ────────────────
  for (const sz of STAIR_ZONES) {
    if (wx < sz.x0 || wx > sz.x1 || wz < sz.z0 || wz > sz.z1) continue
    const dx = sz.toX - sz.fromX, dz = sz.toZ - sz.fromZ
    const t  = Math.max(0, Math.min(1, ((wx - sz.fromX) * dx + (wz - sz.fromZ) * dz) / (sz.totalD * sz.totalD)))
    return t * sz.rise  // rise can be negative (basement stairs)
  }
  // ── Altes Format: Hardcoded staircase ramp (nur wenn kein neues Format) ───
  if (ROOM_STAIRS_DATA_NEW.length === 0) {
    if (wx >= ST_X0 && wx <= ST_X1 && wz >= ST_Z0 && wz <= ST_Z1)
      return Math.max(0, Math.min(FLOOR2_Y, (ST_Z1 - wz) / (ST_Z1 - ST_Z0) * FLOOR2_Y))
  }
  // ── Neues Format: Etagen-Oberfläche ───────────────────────────────────────
  if (ROOM_FLOORS_DATA.length > 0 && level >= 1) {
    const fl = ROOM_FLOORS_DATA.find(f => +f.floor_index === level)
    if (fl) {
      // Bounds-Check mit Toleranz für Treppen-Übergänge (±0.5 Tiles)
      const TOL = 0.5
      if (wx >= fl.x0 - TOL && wx <= fl.x1 + TOL && wz >= fl.z0 - TOL && wz <= fl.z1 + TOL) {
        return fl.y
      }
      // Außerhalb der Etagen-Bounds → 0 zurückgeben (MAX_STEP blockiert das Herunterlaufen)
      return 0
    }
    return 0
  }
  // ── Altes Format: Second floor surface ────────────────────────────────────
  if (level >= 1 && wx >= F2_X0 && wx <= F2_X1 && wz >= F2_Z0 && wz <= F2_Z1) return FLOOR2_Y
  return 0
}

// ─── Scene Setup ──────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.localClippingEnabled = true
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a2e)

// ─── Isometric (Orthographic) Camera ─────────────────────────────────────────
const aspect = window.innerWidth / window.innerHeight
const VIEW   = 10
const camera = new THREE.OrthographicCamera(
  -VIEW * aspect, VIEW * aspect,
   VIEW, -VIEW,
  0.1, 100
)
// True isometric angle: 45° azimuth, arctan(1/√2) ≈ 35.264° elevation
camera.position.set(20, 16, 20)
camera.lookAt(0, 0, 0)

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xffeedd, 1.2)
sun.position.set(10, 20, 10)
sun.castShadow = true
sun.shadow.mapSize.width  = 2048
sun.shadow.mapSize.height = 2048
sun.shadow.camera.near = 0.5
sun.shadow.camera.far  = 100
sun.shadow.camera.left = sun.shadow.camera.bottom = -30
sun.shadow.camera.right = sun.shadow.camera.top   =  30
scene.add(sun)

const fill = new THREE.DirectionalLight(0xaabbff, 0.4)
fill.position.set(-8, 12, -5)
scene.add(fill)

// ─── Room geometry tracker ────────────────────────────────────────────────────
// Alle Objekte die buildRoomGeometry() erzeugt werden hier gesammelt.
// Bei rebuild (neuer ROOM_INIT) werden sie erst entfernt, dann neu aufgebaut.
const ROOM_GEOM_OBJECTS = []

// ─── Character Builder ────────────────────────────────────────────────────────
// Returns a THREE.Group with named sub-meshes for animation.

function makeMat(color) {
  return new THREE.MeshLambertMaterial({ color })
}

// Darken or lighten a hex colour by a fractional factor (-1..+1)
function shadeHex(hex, f) {
  const r = Math.round(Math.max(0, Math.min(255, ((hex >> 16) & 0xff) * (1 + f))))
  const g = Math.round(Math.max(0, Math.min(255, ((hex >>  8) & 0xff) * (1 + f))))
  const b = Math.round(Math.max(0, Math.min(255, ( hex        & 0xff) * (1 + f))))
  return (r << 16) | (g << 8) | b
}

// ─── Avatar configuration ─────────────────────────────────────────────────────

const SKIN_TONES  = [0xfee0c0, 0xf5c5a3, 0xe8a87c, 0xd4956a, 0xb5713c, 0x8d5524, 0x5a3215]
const HAIR_COLORS = [
  0xfce87c, 0xf4a520, 0xc87020, 0x8b3a12,
  0x4a2808, 0x2c1a0e, 0x111111, 0x888888,
  0xdddddd, 0xffffff, 0xff3399, 0x4466ff, 0x22aa44,
]
const SHIRT_COLORS = [
  0x3a7bd5, 0xe03030, 0x30a830, 0xff8800,
  0xaa22cc, 0xffffff, 0x222222, 0xffdd22,
  0x00aacc, 0xff6699, 0x886622, 0x228844,
]
const PANTS_COLORS = [
  0x2c3e50, 0x1a3a80, 0x5c3a1e, 0x2d4a20,
  0x4a1a1a, 0x111111, 0x666666, 0xdddddd, 0xaa8822,
]
const SHOE_COLORS  = [0x4a2e10, 0x1a1008, 0x111111, 0xffffff, 0xcc2222, 0x2244cc, 0x228844]

// Each hair style exposes a build(group, hairMat, hairDarkMat) function
const HAIR_STYLES = [
  { id:'short',  label:'Kurz',     icon:'✂️',
    build(g, h, hd) {
      g.add(box(0.68,0.14,0.62,h,  0,    0.30, 0))
      g.add(box(0.08,0.30,0.54,h, -0.35, 0.05, 0))
      g.add(box(0.08,0.30,0.54,h,  0.35, 0.05, 0))
      g.add(box(0.66,0.28,0.10,h,  0,    0.05,-0.31))
    }
  },
  { id:'medium', label:'Normal',   icon:'👦',
    build(g, h, hd) {
      g.add(box(0.68,0.22,0.62,h,  0,    0.30, 0))
      g.add(box(0.10,0.48,0.54,h, -0.35, 0.07, 0))
      g.add(box(0.10,0.48,0.54,h,  0.35, 0.07, 0))
      g.add(box(0.66,0.46,0.10,h,  0,    0.07,-0.31))
      g.add(box(0.38,0.12,0.08,hd, 0,    0.30, 0.33))
    }
  },
  { id:'long',   label:'Lang',     icon:'👧',
    build(g, h, hd) {
      g.add(box(0.68,0.22,0.62,h,  0,    0.30, 0))
      g.add(box(0.12,0.90,0.54,h, -0.35,-0.13, 0))
      g.add(box(0.12,0.90,0.54,h,  0.35,-0.13, 0))
      g.add(box(0.66,0.88,0.10,h,  0,   -0.11,-0.31))
      g.add(box(0.38,0.12,0.08,hd, 0,    0.30, 0.33))
    }
  },
  { id:'spiky',  label:'Stacheln', icon:'⚡',
    build(g, h, hd) {
      g.add(box(0.66,0.14,0.62,h,  0,    0.26, 0))
      g.add(box(0.14,0.32,0.12,h, -0.24, 0.50, 0))
      g.add(box(0.14,0.38,0.12,h,  0,    0.55, 0))
      g.add(box(0.14,0.28,0.12,h,  0.24, 0.48, 0))
      g.add(box(0.10,0.42,0.54,h, -0.35, 0.05, 0))
      g.add(box(0.10,0.42,0.54,h,  0.35, 0.05, 0))
      g.add(box(0.66,0.40,0.10,h,  0,    0.05,-0.31))
    }
  },
  { id:'mohawk', label:'Mohawk',   icon:'🦅',
    build(g, h, hd) {
      g.add(box(0.24,0.44,0.62,h,  0,    0.40, 0))
      g.add(box(0.66,0.10,0.62,h,  0,    0.20, 0))
      g.add(box(0.08,0.36,0.54,h, -0.35, 0.02, 0))
      g.add(box(0.08,0.36,0.54,h,  0.35, 0.02, 0))
      g.add(box(0.24,0.34,0.10,h,  0,    0.02,-0.31))
    }
  },
  { id:'bun',    label:'Dutt',     icon:'🍩',
    build(g, h, hd) {
      g.add(box(0.66,0.12,0.62,h,  0,    0.26, 0))
      g.add(box(0.08,0.36,0.54,h, -0.35, 0.02, 0))
      g.add(box(0.08,0.36,0.54,h,  0.35, 0.02, 0))
      g.add(box(0.66,0.34,0.10,h,  0,    0.02,-0.31))
      g.add(box(0.44,0.34,0.44,h,  0,    0.44, 0))   // bun ball on top
    }
  },
  { id:'braids', label:'Zöpfe',    icon:'🎀',
    build(g, h, hd) {
      g.add(box(0.68,0.20,0.62,h,  0,    0.28, 0))
      g.add(box(0.66,0.38,0.10,h,  0,    0.05,-0.31))
      g.add(box(0.12,0.82,0.14,h, -0.28,-0.10, 0.18))
      g.add(box(0.12,0.82,0.14,h,  0.28,-0.10, 0.18))
      for (let i = 0; i < 4; i++) {
        const oy = 0.10 - i * 0.13
        g.add(box(0.14,0.08,0.14,hd,-0.28,oy,0.18))
        g.add(box(0.14,0.08,0.14,hd, 0.28,oy,0.18))
      }
    }
  },
  { id:'afro',   label:'Afro',     icon:'🌿',
    build(g, h, hd) {
      g.add(box(0.82,0.34,0.76,h,  0,    0.36, 0))
      g.add(box(0.78,0.18,0.72,h,  0,    0.14, 0))
      g.add(box(0.16,0.52,0.58,h, -0.44, 0.08, 0))
      g.add(box(0.16,0.52,0.58,h,  0.44, 0.08, 0))
      g.add(box(0.74,0.52,0.14,h,  0,    0.08,-0.37))
    }
  },
]

// Each shirt style: build(torsoGroup, shirt, shirtDark, skin, belt, beltBuckle)
const SHIRT_STYLES = [
  { id:'basic',   label:'Basic',    icon:'👕',
    build(g, s, sd, sk, blt, bk) {
      g.add(box(0.62,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.07,0.56,0.39,sd, -0.34,  0,    0))
      g.add(box(0.07,0.56,0.39,sd,  0.34,  0,    0))
      g.add(box(0.12,0.22,0.09,sd, -0.09,  0.25, 0.20))
      g.add(box(0.12,0.22,0.09,sd,  0.09,  0.25, 0.20))
      g.add(box(0.14,0.11,0.05,bk, -0.18,  0.11, 0.21))
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'vneck',   label:'V-Neck',   icon:'🎽',
    build(g, s, sd, sk, blt, bk) {
      g.add(box(0.62,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.07,0.56,0.39,sd, -0.34,  0,    0))
      g.add(box(0.07,0.56,0.39,sd,  0.34,  0,    0))
      g.add(box(0.11,0.32,0.10,sk, -0.07,  0.20, 0.19))   // V skin left
      g.add(box(0.11,0.32,0.10,sk,  0.07,  0.20, 0.19))   // V skin right
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'stripe',  label:'Streifen', icon:'🦓',
    build(g, s, sd, sk, blt, bk) {
      const w = makeMat(0xffffff)
      g.add(box(0.62,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.07,0.56,0.39,sd, -0.34,  0,    0))
      g.add(box(0.07,0.56,0.39,sd,  0.34,  0,    0))
      g.add(box(0.64,0.07,0.39,w,   0,     0.16, 0))      // stripe 1
      g.add(box(0.64,0.07,0.39,w,   0,    -0.06, 0))      // stripe 2
      g.add(box(0.12,0.22,0.09,sd, -0.09,  0.25, 0.20))
      g.add(box(0.12,0.22,0.09,sd,  0.09,  0.25, 0.20))
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'hoodie',  label:'Hoodie',   icon:'🧥',
    build(g, s, sd, sk, blt, bk) {
      g.add(box(0.66,0.62,0.40,sd,  0,     0,    0))      // hoodie body (darker)
      g.add(box(0.07,0.60,0.42,s,  -0.34,  0,    0))      // lighter sides
      g.add(box(0.07,0.60,0.42,s,   0.34,  0,    0))
      g.add(box(0.40,0.22,0.06,s,   0,    -0.08, 0.22))   // kangaroo pocket
      g.add(box(0.54,0.36,0.14,sd,  0,     0.22,-0.24))   // hood drape at back
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'tanktop', label:'Tank Top', icon:'🩱',
    build(g, s, sd, sk, blt, bk) {
      g.add(box(0.56,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.06,0.56,0.39,sd, -0.30,  0,    0))
      g.add(box(0.06,0.56,0.39,sd,  0.30,  0,    0))
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'bikini',  label:'Bikini',  icon:'👙',
    build(g, s, sd, sk, blt, bk) {
      // Linkes Cup
      g.add(box(0.23,0.22,0.10, s,  -0.14, 0.12, 0.19))
      // Rechtes Cup
      g.add(box(0.23,0.22,0.10, s,   0.14, 0.12, 0.19))
      // Mittelteil zwischen Cups
      g.add(box(0.06,0.12,0.10, sd,  0,    0.08, 0.19))
      // Unterband (horizontaler Streifen unten)
      g.add(box(0.52,0.06,0.07, sd,  0,    0.01, 0.19))
      // Seitenstreifen (verbinden Cups mit Rücken)
      g.add(box(0.06,0.22,0.38, sd, -0.29, 0.12, 0))
      g.add(box(0.06,0.22,0.38, sd,  0.29, 0.12, 0))
      // Rückenband
      g.add(box(0.54,0.06,0.07, sd,  0,    0.12,-0.19))
      // Hals-Haut
      g.add(box(0.26,0.20,0.24, sk,  0,    0.37,  0))
      // Bauch-Haut (Midriff sichtbar)
      g.add(box(0.52,0.24,0.30, sk,  0,   -0.14,  0))
    }
  },
]

// Each pants style: build(legGroup, pantsMat, pantsDarkMat, skinLightMat)
const PANTS_STYLES = [
  { id:'regular', label:'Normal',  icon:'👖',
    build(leg, p, pd, skl) {
      leg.add(box(0.27,0.31,0.28,p,  0,-0.14,0))
      leg.add(box(0.26,0.09,0.28,pd, 0,-0.33,0))
      leg.add(box(0.24,0.26,0.25,p,  0,-0.51,0))
      leg.add(box(0.21,0.08,0.22,skl,0,-0.68,0))
    }
  },
  { id:'shorts',  label:'Shorts',  icon:'🩳',
    build(leg, p, pd, skl) {
      leg.add(box(0.28,0.34,0.29,p,  0,-0.16,0))
      leg.add(box(0.26,0.06,0.28,pd, 0,-0.35,0))
      leg.add(box(0.21,0.08,0.22,skl,0,-0.44,0))
    }
  },
  { id:'wide',    label:'Baggy',   icon:'🎪',
    build(leg, p, pd, skl) {
      leg.add(box(0.32,0.30,0.32,p,  0,-0.14,0))
      leg.add(box(0.28,0.09,0.30,pd, 0,-0.33,0))
      leg.add(box(0.26,0.26,0.28,p,  0,-0.51,0))
      leg.add(box(0.21,0.08,0.22,skl,0,-0.68,0))
    }
  },
  { id:'skirt',   label:'Rock',    icon:'👗',
    build(leg, p, pd, skl) {
      leg.add(box(0.44,0.22,0.42,p,  0,-0.11,0))
      leg.add(box(0.40,0.26,0.38,p,  0,-0.34,0))
      leg.add(box(0.21,0.10,0.22,skl,0,-0.55,0))
    }
  },
]

// Body type: defines arm/leg proportions + extra geometry
// buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, shirtMat, shirtDark)
// RULE: Busen/Körper-Extras nur sichtbar bei Bikini/Tanktop — sonst von Shirt verdeckt
const BODY_TYPES = [
  // ── MÄNNLICH ────────────────────────────────────────────────────────────────
  { id:'male',       label:'Mann',       icon:'👨', gender:'male',
    shoulderW:0.28, upperArmW:0.23, legHipOff:0.17,
    buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, sm, sd) {}
  },
  { id:'muscular',   label:'Muskulös',   icon:'💪', gender:'male',
    shoulderW:0.36, upperArmW:0.30, legHipOff:0.18,
    buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, sm, sd) {
      // Pec-Konturen (shirt-farbig, sitzen direkt auf Shirt-Vorderseite)
      torso.add(box(0.26,0.20,0.05, sd, -0.16, 0.14, 0.21))
      torso.add(box(0.26,0.20,0.05, sd,  0.16, 0.14, 0.21))
      torso.add(box(0.04,0.38,0.05, sd,  0,    0.06, 0.21))   // Sternum
    }
  },
  // ── WEIBLICH ────────────────────────────────────────────────────────────────
  { id:'female',     label:'Frau',       icon:'👩', gender:'female',
    shoulderW:0.25, upperArmW:0.20, legHipOff:0.19,
    buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, sm, sd) {
      const sid = (SHIRT_STYLES[cfg.shirtStyle] || SHIRT_STYLES[0]).id
      if (sid === 'bikini') {
        // Haut hinter Bikini-Cups (nur Füllung, Cups decken ab)
        torso.add(box(0.22,0.20,0.09, skin, -0.14, 0.10, 0.14))
        torso.add(box(0.22,0.20,0.09, skin,  0.14, 0.10, 0.14))
      } else if (sid === 'tanktop') {
        // Dezente Rundung — zuerst Haut, dann Shirt-Schicht drüber (bündig)
        torso.add(box(0.20,0.17,0.07, skin, -0.13, 0.09, 0.17))
        torso.add(box(0.20,0.17,0.07, skin,  0.13, 0.09, 0.17))
        torso.add(box(0.22,0.19,0.04, sm,   -0.13, 0.09, 0.21))  // Shirt-Deckschicht
        torso.add(box(0.22,0.19,0.04, sm,    0.13, 0.09, 0.21))
      }
      // Für alle anderen Shirts: keine sichtbaren Extras — Körperform = Proportionen
    }
  },
  { id:'curvy',      label:'Kurvig',     icon:'🍑', gender:'female',
    shoulderW:0.25, upperArmW:0.21, legHipOff:0.21,
    buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, sm, sd) {
      const sid = (SHIRT_STYLES[cfg.shirtStyle] || SHIRT_STYLES[0]).id
      if (sid === 'bikini') {
        torso.add(box(0.26,0.23,0.09, skin, -0.15, 0.11, 0.14))
        torso.add(box(0.26,0.23,0.09, skin,  0.15, 0.11, 0.14))
      } else if (sid === 'tanktop') {
        torso.add(box(0.23,0.20,0.07, skin, -0.14, 0.10, 0.17))
        torso.add(box(0.23,0.20,0.07, skin,  0.14, 0.10, 0.17))
        torso.add(box(0.25,0.22,0.04, sm,   -0.14, 0.10, 0.21))
        torso.add(box(0.25,0.22,0.04, sm,    0.14, 0.10, 0.21))
      }
    }
  },
  { id:'athletic_f', label:'Athletisch', icon:'🤸', gender:'female',
    shoulderW:0.29, upperArmW:0.24, legHipOff:0.18,
    buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, sm, sd) {
      const sid = (SHIRT_STYLES[cfg.shirtStyle] || SHIRT_STYLES[0]).id
      if (sid === 'bikini') {
        torso.add(box(0.18,0.15,0.08, skin, -0.12, 0.08, 0.14))
        torso.add(box(0.18,0.15,0.08, skin,  0.12, 0.08, 0.14))
      } else if (sid === 'tanktop') {
        torso.add(box(0.17,0.14,0.06, skin, -0.11, 0.08, 0.17))
        torso.add(box(0.17,0.14,0.06, skin,  0.11, 0.08, 0.17))
        torso.add(box(0.19,0.16,0.04, sm,   -0.11, 0.08, 0.21))
        torso.add(box(0.19,0.16,0.04, sm,    0.11, 0.08, 0.21))
      }
      // Athletic-Definition seitlich (Shirt-farbig → verdeckt von Shirt)
      torso.add(box(0.06,0.34,0.30, sd, -0.35, 0.02, 0))
      torso.add(box(0.06,0.34,0.30, sd,  0.35, 0.02, 0))
    }
  },
]

// ─── Eye colors ───────────────────────────────────────────────────────────────
const EYE_COLORS = [
  0x0e0e1e, // Schwarz
  0x1a4a8a, // Blau
  0x2d6e2d, // Grün
  0x6b3a2a, // Braun
  0x888888, // Grau
  0x7a3a9a, // Lila
  0x1a8a8a, // Türkis
  0xc08030, // Bernstein
]

// ─── Mouth styles ─────────────────────────────────────────────────────────────
const MOUTH_STYLES = [
  { id:'smile',   label:'Lächeln',    icon:'😊' },
  { id:'neutral', label:'Neutral',    icon:'😐' },
  { id:'grin',    label:'Grinsen',    icon:'😁' },
  { id:'smirk',   label:'Schmunzeln', icon:'😏' },
  { id:'pout',    label:'Schmollen',  icon:'🙁' },
]

// ─── Eyebrow styles ───────────────────────────────────────────────────────────
const BROW_STYLES = [
  { id:'normal', label:'Normal',   icon:'➖' },
  { id:'arched', label:'Gebogen',  icon:'〰️' },
  { id:'thick',  label:'Buschig',  icon:'▬'  },
  { id:'thin',   label:'Dünn',     icon:'—'  },
  { id:'angry',  label:'Wütend',   icon:'⋁'  },
]

// ─── Beard styles ─────────────────────────────────────────────────────────────
const BEARD_STYLES = [
  { id:'none',      label:'Kein Bart',   icon:'🚫',  gender:'both' },
  { id:'stubble',   label:'Stoppeln',    icon:'·',   gender:'male' },
  { id:'mustache',  label:'Schnurrbart', icon:'🥸',  gender:'male' },
  { id:'goatee',    label:'Ziegenbart',  icon:'🐐',  gender:'male' },
  { id:'fullbeard', label:'Vollbart',    icon:'🧔',  gender:'male' },
  { id:'chinstrap', label:'Kinnbart',    icon:'👤',  gender:'male' },
]

// ─── Accessories (multi-select) ───────────────────────────────────────────────
const ACCESSORIES_LIST = [
  { id:'glasses_round',  label:'Runde Brille',  icon:'👓', slot:'face' },
  { id:'glasses_square', label:'Eckige Brille', icon:'🕶️', slot:'face' },
  { id:'sunglasses',     label:'Sonnenbrille',  icon:'😎', slot:'face' },
  { id:'earrings',       label:'Ohrringe',      icon:'💎', slot:'ears' },
  { id:'hat_cap',        label:'Cap',           icon:'🧢', slot:'head' },
  { id:'hat_beanie',     label:'Beanie',        icon:'🪖', slot:'head' },
  { id:'necklace',       label:'Kette',         icon:'📿', slot:'neckA' },
  { id:'scarf',          label:'Schal',         icon:'🧣', slot:'neckB' },
  { id:'watch',          label:'Uhr',           icon:'⌚', slot:'wrist' },
  { id:'phone',          label:'Handy',         icon:'📱', slot:'hand' },
  { id:'bag',            label:'Tasche',        icon:'👜', slot:'carry' },
  { id:'backpack',       label:'Rucksack',      icon:'🎒', slot:'back'  },
]

const AVATAR = {
  skinTone:1, hairStyle:1, hairColor:5,
  shirtStyle:0, shirtColor:0,
  pantsStyle:0, pantsColor:0,
  shoeColor:0,  bodyType:0,
  eyeColor:0, mouthStyle:0, browStyle:0, beardStyle:0,
  accessories: [],
}

function box(w, h, d, mat, x, y, z) {
  const geo  = new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

// ─── Furniture ────────────────────────────────────────────────────────────────
const SEATS = []     // { x, z, facingY } — registered chair positions
const WARDROBES  = [] // teleport wardrobe objects
const FRIDGES    = [] // interactive fridges { group, doorPivot, doorAngle, doorTarget, x, z, facingY, lvl, entranceX, entranceZ, isOpen }
const ROOM_DOORS = [] // Raumtüren { pivot, wx, wz, angle, target, openAngle }

// ─── Drinks ───────────────────────────────────────────────────────────────────
const DRINKS = [
  { id: 'beer',  name: 'Bier',   icon: '🍺', color: 0xd4a012, labelColor: 0xffd700 },
  { id: 'water', name: 'Wasser', icon: '💧', color: 0xaad8f0, labelColor: 0xffffff },
  { id: 'wine',  name: 'Wein',   icon: '🍷', color: 0x7b1f3a, labelColor: 0xc0c0c0 },
  { id: 'cola',  name: 'Cola',   icon: '🥤', color: 0x1a1a1a, labelColor: 0xcc1111 },
]

// ─── Solid collision zones ─────────────────────────────────────────────────────
const SOLID = []
const CHAR_R = 0.32  // character collision radius

function addSolid(x0, x1, z0, z1, level = -1, ref = null) {
  SOLID.push({ x0: Math.min(x0,x1), x1: Math.max(x0,x1),
               z0: Math.min(z0,z1), z1: Math.max(z0,z1), level, ref })
}

function isBlocked(px, pz, level) {
  for (const s of SOLID) {
    if (s.level !== -1 && s.level !== level) continue
    // Only let the character physically pass through a wardrobe while walking in/out
    if (tp && s.ref) {
      if (s.ref === tp.from && tp.phase === 'entering_walk') continue
      if (s.ref === tp.to   && tp.phase === 'exiting')       continue
    }
    if (px + CHAR_R > s.x0 && px - CHAR_R < s.x1 &&
        pz + CHAR_R > s.z0 && pz - CHAR_R < s.z1) return true
  }
  return false
}

// ─── A* Pathfinding ────────────────────────────────────────────────────────────
function findPath(startX, startZ, endX, endZ, level) {
  const STEP = 1.0  // 1 Tile pro Node (vorher 0.5 → 4 Nodes/Tile → zu fein, zu langsam)
  const toG = v => Math.round(v / STEP)
  const toW = v => v * STEP

  let sx = toG(startX), sz = toG(startZ)
  const ex = toG(endX),   ez = toG(endZ)
  if (sx === ex && sz === ez) return []

  // Startposition blockiert (z.B. Charakter sitzt im Sofa-Solid)?
  // → Nächsten freien Tile in Richtung Ziel suchen, damit A* nicht scheitert.
  if (isBlocked(toW(sx), toW(sz), level)) {
    const SEARCH_DIRS = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]
    let found = false
    for (let r = 1; r <= 4 && !found; r++) {
      for (const [dx, dz] of SEARCH_DIRS) {
        const nx = sx + dx * r, nz = sz + dz * r
        if (!isBlocked(toW(nx), toW(nz), level)) {
          sx = nx; sz = nz; found = true; break
        }
      }
    }
  }

  // Bounds: Etage + Treppen (gleiche Logik wie Bewegungsbounds)
  let minX = -20, maxX = 20, minZ = -20, maxZ = 20
  const floor = ROOM_FLOORS_DATA.find(f => +f.floor_index === level)
  if (floor) { minX = floor.x0 - 0.5; maxX = floor.x1 + 0.5; minZ = floor.z0 - 0.5; maxZ = floor.z1 + 0.5 }
  for (const st of ROOM_STAIRS_DATA_NEW) {
    if (st.from_floor === level || st.to_floor === level) {
      const hw = (st.width || 3) / 2 + 0.5
      minX = Math.min(minX, st.anchor_x - hw)
      maxX = Math.max(maxX, st.anchor_x + hw)
      // Treppenzone in Z (max 20 Einheiten Expansion um Suche begrenzt zu halten)
      const stZ0 = st.anchor_z - Math.min(st.steps + 1, 20)
      const stZ1 = st.anchor_z + Math.min(st.steps + 1, 20)
      minZ = Math.min(minZ, stZ0)
      maxZ = Math.max(maxZ, stZ1)
    }
  }

  const key = (x, z) => (x + 200) * 1000 + (z + 200)
  const open = new Map()
  const closed = new Set()
  const parent = new Map()
  const gScore = new Map()

  const h = (x, z) => Math.abs(x - ex) + Math.abs(z - ez)
  open.set(key(sx, sz), { x: sx, z: sz, f: h(sx, sz) })
  gScore.set(key(sx, sz), 0)

  const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
  let iters = 0

  while (open.size > 0 && iters++ < 4000) {
    // Pop node with lowest f
    let bestKey = null, bestNode = null
    for (const [k, n] of open) {
      if (!bestNode || n.f < bestNode.f) { bestKey = k; bestNode = n }
    }
    open.delete(bestKey)
    const { x: cx, z: cz } = bestNode
    if (cx === ex && cz === ez) {
      // Reconstruct
      const path = []
      let cur = key(cx, cz)
      while (parent.has(cur)) {
        const [wx, wz] = parent.get(cur)
        path.unshift({ x: toW(wx), z: toW(wz) })
        cur = key(wx, wz)
      }
      // Remove last waypoint if it's the final destination (handled separately)
      return path
    }
    closed.add(key(cx, cz))

    for (const [dx, dz] of DIRS) {
      const nx = cx + dx, nz = cz + dz
      const wx = toW(nx), wz = toW(nz)
      if (wx < minX || wx > maxX || wz < minZ || wz > maxZ) continue
      const nk = key(nx, nz)
      if (closed.has(nk)) continue
      if (isBlocked(wx, wz, level)) continue

      const cost = (dx !== 0 && dz !== 0) ? 1.414 : 1.0
      const g = gScore.get(key(cx, cz)) + cost
      if (!gScore.has(nk) || g < gScore.get(nk)) {
        gScore.set(nk, g)
        parent.set(nk, [cx, cz])
        open.set(nk, { x: nx, z: nz, f: g + h(nx, nz) })
      }
    }
  }
  return null // kein Pfad gefunden
}

// ─── Shared constants (used by furniture, placement, character) ──────────────

const FACING_DIRS = ['N','E','S','W']
const FACING_Y    = { N: Math.PI, E: -Math.PI/2, S: 0, W: Math.PI/2 }

// ─── Additional furniture builders ────────────────────────────────────────────
// Set during active placement (placeHeld) so all sub-builders know which floor
var _currentPlaceLevel = null

function _lvlBase(wx, wz) {
  let lvl = 0, flY = 0
  if (ROOM_FLOORS_DATA.length > 0) {
    // Expliziter Level bekannt (loadScene, Rotation, aktive Platzierung) → direkt verwenden
    if (_currentPlaceLevel !== null) {
      lvl = _currentPlaceLevel
      const fl = ROOM_FLOORS_DATA.find(f => +f.floor_index === _currentPlaceLevel)
      if (fl) { flY = fl.y }
      // fl===undefined → floor_level=0 auf Erdgeschoss (flY bleibt 0)
    } else {
      // Kein Level bekannt → Position-Erkennung als Fallback
      const exact = ROOM_FLOORS_DATA
        .filter(f => wx >= f.x0 && wx <= f.x1 && wz >= f.z0 && wz <= f.z1)
        .sort((a, b) => b.floor_index - a.floor_index)[0]
      if (exact) {
        lvl = exact.floor_index; flY = exact.y
      } else {
        let best = null, bestD = Infinity
        for (const f of ROOM_FLOORS_DATA) {
          const dx = Math.max(0, f.x0 - wx, wx - f.x1)
          const dz = Math.max(0, f.z0 - wz, wz - f.z1)
          const d  = Math.max(dx, dz)
          if (d < bestD) { bestD = d; best = f }
        }
        if (best && bestD <= 2) { lvl = best.floor_index; flY = best.y }
      }
    }
  } else {
    lvl = (wx >= F2_X0 && wx <= F2_X1 && wz >= F2_Z0 && wz <= F2_Z1) ? 1 : 0
    flY = getFloorY(wx, wz, lvl)
  }
  return { lvl, baseY: flY + 0.06 }
}

const SEATING_TYPES_ALL = ['chair','sofa','armchair','barstool','ottoman','bench','stool','gaming_chair','chair_office','jacuzzi']
