/**
 * drinks.ts — Fridge-Interaktion + Drink-Props
 */
import { THREE } from './three-shim'
import { box, makeMat } from './materials'
import { DRINKS, type DrinkDef } from './types'

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface FridgeObj {
  group:      THREE.Group
  doorPivot:  THREE.Group
  doorAngle:  number
  doorTarget: number
  isOpen:     boolean
  x:          number; z: number; facingY: number; lvl: number
  entranceX:  number; entranceZ: number
}

export interface DrinkSystem {
  registerFridge: (obj: FridgeObj) => void
  removeFridge:   (group: THREE.Group) => void
  openFridge:     (fridge: FridgeObj) => void
  update:         (dt: number) => void
  getFridges:     () => readonly FridgeObj[]
  createDrinkProp: (drink: DrinkDef) => THREE.Group
  attachDrink:    (charGroup: THREE.Group, drink: DrinkDef | null) => void
}

export function createDrinks(
  onDrinkPicked: (drink: DrinkDef) => void
): DrinkSystem {
  const fridges: FridgeObj[] = []

  function registerFridge(obj: FridgeObj) {
    fridges.push(obj)
  }

  function removeFridge(group: THREE.Group) {
    const idx = fridges.findIndex(f => f.group === group)
    if (idx >= 0) fridges.splice(idx, 1)
  }

  function createDrinkProp(drink: DrinkDef): THREE.Group {
    const g = new THREE.Group()
    g.name = 'drinkProp'
    const canMat   = new THREE.MeshLambertMaterial({ color: drink.color })
    const labelMat = new THREE.MeshLambertMaterial({ color: drink.labelColor })
    const capMat   = new THREE.MeshLambertMaterial({ color: 0xcccccc })
    g.add(box(0.13, 0.22, 0.13, canMat,   0,     0,     0))
    g.add(box(0.14, 0.09, 0.14, labelMat, 0,     0.02,  0))
    g.add(box(0.10, 0.03, 0.10, capMat,   0,     0.125, 0))
    g.add(box(0.10, 0.03, 0.10, capMat,   0,    -0.125, 0))
    return g
  }

  function attachDrink(charGroup: THREE.Group, drink: DrinkDef | null) {
    const handR = charGroup.getObjectByName('handR')
    if (!handR) return
    const old = handR.getObjectByName('drinkProp')
    if (old) handR.remove(old)
    if (!drink) return
    const prop = createDrinkProp(drink)
    prop.position.set(0, -0.18, 0.08)
    handR.add(prop)
  }

  function openFridge(fridge: FridgeObj) {
    if (fridge.isOpen) return
    fridge.isOpen = true
    fridge.doorTarget = -Math.PI / 2
    setTimeout(() => {
      const drink = DRINKS[Math.floor(Math.random() * DRINKS.length)]
      onDrinkPicked(drink)
      setTimeout(() => {
        fridge.doorTarget = 0
        fridge.isOpen = false
      }, 900)
    }, 650)
  }

  function update(dt: number) {
    for (const f of fridges) {
      f.doorAngle += (f.doorTarget - f.doorAngle) * Math.min(1, dt * 7)
      f.doorPivot.rotation.y = f.doorAngle
    }
  }

  return { registerFridge, removeFridge, openFridge, update, getFridges: () => fridges, createDrinkProp, attachDrink }
}
