/**
 * item-registry.ts — Globale Moebel-Registry (ES-Modul-Version)
 *
 * Jede Moebel-Datei ruft ITEM_DEFS.add(item_code, buildFn) auf.
 * item_code muss exakt dem Eintrag in der shop_items SQL-Tabelle entsprechen.
 */
import type * as THREE from 'three'

export type ItemBuildFn = (wx: number, wz: number, facingY: number) => THREE.Group

interface ItemRegistry {
  add(id: string, buildFn: ItemBuildFn): void
  get(id: string): ItemBuildFn | null
  ids(): string[]
}

const _items: Record<string, ItemBuildFn> = Object.create(null)

export const ITEM_DEFS: ItemRegistry = {
  add(id: string, buildFn: ItemBuildFn) {
    _items[id] = buildFn
  },
  get(id: string): ItemBuildFn | null {
    return _items[id] || null
  },
  ids(): string[] {
    return Object.keys(_items)
  },
}

// Global setzen fuer Item-Dateien die noch nicht zu ES-Modulen konvertiert sind
if (typeof globalThis !== 'undefined') {
  ;(globalThis as Record<string, unknown>).ITEM_DEFS = ITEM_DEFS
}
