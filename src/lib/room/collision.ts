/**
 * collision.ts — Solid-Zones, addSolid(), isBlocked()
 *
 * Verwaltet alle statischen und dynamischen Kollisionszonen.
 * Teleport-Passthrough wird via Callback injiziert.
 */
import { CHAR_R } from './types'
import type { SolidZone } from './types'

export interface CollisionSystem {
  addSolid: (x0: number, x1: number, z0: number, z1: number, level?: number, ref?: unknown) => void
  removeSolidByRef: (ref: unknown) => void
  clearSolids: () => void
  isBlocked: (px: number, pz: number, level: number) => boolean
  getSolids: () => readonly SolidZone[]
  /** Inject callback so wardrobe pass-through can be honoured */
  setTeleportPassthrough: (fn: TeleportPassthroughFn | null) => void
}

/** Returns true if the given solid ref should be passable right now */
export type TeleportPassthroughFn = (ref: unknown, phase: string) => boolean

export function createCollision(): CollisionSystem {
  const solids: SolidZone[] = []
  let _passFn: TeleportPassthroughFn | null = null

  function addSolid(x0: number, x1: number, z0: number, z1: number, level = -1, ref: unknown = null) {
    solids.push({
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
      level, ref,
    })
  }

  function removeSolidByRef(ref: unknown) {
    const idx = solids.findIndex(s => s.ref === ref)
    if (idx >= 0) solids.splice(idx, 1)
  }

  function clearSolids() {
    solids.length = 0
  }

  function isBlocked(px: number, pz: number, level: number): boolean {
    for (const s of solids) {
      if (s.level !== -1 && s.level !== level) continue
      if (_passFn && s.ref && _passFn(s.ref, 'any')) continue
      if (
        px + CHAR_R > s.x0 && px - CHAR_R < s.x1 &&
        pz + CHAR_R > s.z0 && pz - CHAR_R < s.z1
      ) return true
    }
    return false
  }

  return {
    addSolid,
    removeSolidByRef,
    clearSolids,
    isBlocked,
    getSolids: () => solids as readonly SolidZone[],
    setTeleportPassthrough: fn => { _passFn = fn },
  }
}
