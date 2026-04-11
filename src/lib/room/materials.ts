/**
 * materials.ts — Shared geometry helpers fuer das Room-System
 *
 * Stellt box(), makeMat(), shadeHex() bereit die von allen
 * Modulen und Item-Dateien benutzt werden.
 */
import { THREE } from './three-shim'

/** Einfaches Lambert-Material mit einer Farbe */
export function makeMat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color })
}

/** Box-Mesh mit Position und Shadow */
export function box(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x: number, y: number, z: number
): THREE.Mesh {
  const geo  = new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

/** Hex-Farbe aufhellen oder abdunkeln (f: -1..+1) */
export function shadeHex(hex: number, f: number): number {
  const r = Math.round(Math.max(0, Math.min(255, ((hex >> 16) & 0xff) * (1 + f))))
  const g = Math.round(Math.max(0, Math.min(255, ((hex >>  8) & 0xff) * (1 + f))))
  const b = Math.round(Math.max(0, Math.min(255, ( hex        & 0xff) * (1 + f))))
  return (r << 16) | (g << 8) | b
}

// ─── Global setzen fuer Item-Dateien ──────────────────────────────────────────
if (typeof globalThis !== 'undefined') {
  const g = globalThis as Record<string, unknown>
  g.makeMat  = makeMat
  g.box      = box
  g.shadeHex = shadeHex
}
