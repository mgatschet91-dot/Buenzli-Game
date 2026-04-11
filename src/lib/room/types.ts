/**
 * types.ts — Shared Interfaces und Konstanten fuer das Room-System
 */

// ─── World Constants ─────────────────────────────────────────────────────────
export const TILE  = 1.0   // world units per tile
export const SPEED = 5.0   // tiles per second
export const CHAR_R = 0.32 // character collision radius

// ─── Room Geometry (SQL: room_models / user_room_floors) ──────────────────────
export interface RoomGeometry {
  v?: number
  grid_size?: number
  wall_n?: number; wall_s?: number; wall_e?: number; wall_w?: number
  door_wall?: string
  door_offset?: number; door_width?: number; door_height?: number
  floors?: RoomFloor[]
  stairs?: RoomStair[]
  staircases?: RoomStaircaseLegacy[]
  rollers?: RoomRoller[]
  spawn?: RoomSpawn
}

export interface RoomFloor {
  id: string
  name?: string
  floor_index?: number
  x0: number; x1: number; z0: number; z1: number
  y: number
  colorA?: number; colorB?: number
  wallN?: boolean; wallS?: boolean; wallE?: boolean; wallW?: boolean
  doorN?: boolean; doorS?: boolean; doorE?: boolean; doorW?: boolean
  holes?: Array<{ x: number; z: number }>
}

export interface RoomStair {
  id: string
  anchor_x: number; anchor_z: number
  dir: 'N' | 'S' | 'E' | 'W'
  width?: number
  steps: number
  height: number
  style?: string
  fromFloorId?: string; toFloorId?: string
  from_floor?: number; to_floor?: number
  base_y?: number
  gate_width?: number; gate_open?: boolean
}

export interface RoomStaircaseLegacy {
  x0: number; x1: number; z0: number; z1: number
  from_floor: number; to_floor: number
}

export interface RoomRoller {
  id: string
  x: number; z: number
  dir: 'N' | 'S' | 'E' | 'W'
  floor_idx?: number
  floorId?: string
}

export interface RoomSpawn {
  x: number; z: number
  floorId?: string
  floor_idx?: number
}

// ─── Furniture (SQL: room_furniture / shop_items) ─────────────────────────────
export interface FurniturePlacement {
  id?: number
  uuid?: string
  item_code: string
  x: number; z: number
  floor_level: number
  facing_idx: number
  wy?: number | null
}

export interface CatalogItem {
  item_code: string
  display_name: string
  icon?: string
  category?: string
  price?: number
  rotatable?: boolean
}

// ─── Solid Collision Zone ─────────────────────────────────────────────────────
export interface SolidZone {
  x0: number; x1: number
  z0: number; z1: number
  level: number
  ref?: unknown
}

// ─── Stair Zone (placed stair ramp) ──────────────────────────────────────────
export interface StairZone {
  uuid: string
  x0: number; x1: number; z0: number; z1: number
  fromX: number; fromZ: number
  toX: number; toZ: number
  rise: number; totalD: number
}

// ─── Teleport Zone ───────────────────────────────────────────────────────────
export interface TeleportZone {
  uuid: string
  wx: number; wz: number
}

// ─── Floor Data (runtime) ─────────────────────────────────────────────────────
export interface FloorData {
  floor_index: number
  x0: number; x1: number; z0: number; z1: number
  y: number
}

// ─── Stair Data New Format (runtime) ─────────────────────────────────────────
export interface StairDataNew {
  anchor_x: number; anchor_z: number
  dir: string
  width: number
  steps: number
  height: number
  from_floor: number; to_floor: number
  base_y: number
}

// ─── Drink Definition ─────────────────────────────────────────────────────────
export interface DrinkDef {
  id: string; name: string; icon: string; color: number; labelColor: number
}

export const DRINKS: DrinkDef[] = [
  { id: 'beer',  name: 'Bier',   icon: '🍺', color: 0xd4a012, labelColor: 0xffd700 },
  { id: 'water', name: 'Wasser', icon: '💧', color: 0xaad8f0, labelColor: 0xffffff },
  { id: 'wine',  name: 'Wein',   icon: '🍷', color: 0x7b1f3a, labelColor: 0xc0c0c0 },
  { id: 'cola',  name: 'Cola',   icon: '🥤', color: 0x1a1a1a, labelColor: 0xcc1111 },
]

// ─── Engine Callbacks (React → Engine Kommunikation) ─────────────────────────
export interface Game3DCallbacks {
  onReady: () => void
  onAvatarChanged: (avatarCode: string) => void
  onAvatarEditorClosed: () => void
  onFurniturePlaced: (data: {
    uuid: string; item_code: string
    x: number; z: number; floor_level: number
    facing_idx: number; wy?: number | null
  }) => void
  onFurnitureMoved: (data: {
    uuid: string; item_code: string
    x: number; z: number; floor_level: number
    facing_idx: number; wy?: number | null
    old_server_id?: number | null
  }) => void
  onFurnitureDeleted: (serverId: number) => void
  onFurniturePickup: (data: {
    item_code: string
    server_id?: number | null
    x?: number; z?: number
  }) => void
  onItemPlaced: (data: { item_code: string; quantity: number }) => void
  onFurnitureSelected: (obj: { uuid: string; type: string } | null) => void
  onPlacingStarted: () => void
  onPlacingEnded: () => void
}

// ─── Engine API (Engine → React Kommunikation) ───────────────────────────────
export interface Game3DAPI {
  roomInit: (data: {
    model_name?: string
    avatar_code?: string
    placements?: FurniturePlacement[]
    catalog?: CatalogItem[]
    geometry?: RoomGeometry
    is_owner?: boolean
  }) => void
  avatarSet: (code: string) => void
  showAvatarEditor: () => void
  hideAvatarEditor: () => void
  placeItem: (itemCode: string, quantity: number) => void
  furnitureSaved: (uuid: string, serverId: number) => void
  rotateFurniture: (uuid: string) => void
  moveFurniture: (uuid: string) => void
  pickupFurniture: (uuid: string) => void
  deleteFurniture: (uuid: string) => void
}

// ─── Engine Return Type ──────────────────────────────────────────────────────
export interface Game3DInstance {
  api: Game3DAPI
  destroy: () => void
}

// ─── Editor Callbacks ────────────────────────────────────────────────────────
export interface EditorCallbacks {
  onSaved: () => void
  onClose: () => void
}

export interface EditorConfig {
  authToken: string
  apiBase: string
}

export interface EditorAPI {
  destroy: () => void
}
