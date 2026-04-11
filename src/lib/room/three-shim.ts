/**
 * three-shim.ts — Three.js aus npm re-exportieren + globalThis Setup
 *
 * Setzt THREE auf globalThis damit die Item-Dateien (items/*.js)
 * weiterhin das globale THREE-Objekt nutzen koennen bis sie
 * zu ES-Modulen konvertiert werden.
 */
import * as THREE from 'three'

// Globale Referenz fuer Items und Legacy-Code
if (typeof globalThis !== 'undefined') {
  ;(globalThis as Record<string, unknown>).THREE = THREE
}

export default THREE
export { THREE }
