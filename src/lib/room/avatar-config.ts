/**
 * avatar-config.ts — Avatar Paletten, Styles und State-Serialisierung
 */
import { box, makeMat } from './materials'

// ─── Richtungen ───────────────────────────────────────────────────────────────
/** Himmelsrichtungen als Index-Array (für FACING_DIRS[n % 4]) */
export const FACING_DIRS: readonly string[] = ['N', 'E', 'S', 'W']
/** Y-Rotation (Radiant) pro Himmelsrichtung */
export const FACING_Y: Record<string, number> = {
  N:  0,
  E:  Math.PI / 2,
  S:  Math.PI,
  W: -Math.PI / 2,
}

// ─── Farbpaletten ─────────────────────────────────────────────────────────────
export const SKIN_TONES  = [0xfee0c0, 0xf5c5a3, 0xe8a87c, 0xd4956a, 0xb5713c, 0x8d5524, 0x5a3215]
export const HAIR_COLORS = [
  0xfce87c, 0xf4a520, 0xc87020, 0x8b3a12,
  0x4a2808, 0x2c1a0e, 0x111111, 0x888888,
  0xdddddd, 0xffffff, 0xff3399, 0x4466ff, 0x22aa44,
]
export const SHIRT_COLORS = [
  0x3a7bd5, 0xe03030, 0x30a830, 0xff8800,
  0xaa22cc, 0xffffff, 0x222222, 0xffdd22,
  0x00aacc, 0xff6699, 0x886622, 0x228844,
]
export const PANTS_COLORS = [
  0x2c3e50, 0x1a3a80, 0x5c3a1e, 0x2d4a20,
  0x4a1a1a, 0x111111, 0x666666, 0xdddddd, 0xaa8822,
]
export const SHOE_COLORS = [0x4a2e10, 0x1a1008, 0x111111, 0xffffff, 0xcc2222, 0x2244cc, 0x228844]

// ─── Hair Styles ──────────────────────────────────────────────────────────────
export interface StyleDef {
  id: string
  label: string
  icon: string
  build: (...args: unknown[]) => void
}

export const HAIR_STYLES: StyleDef[] = [
  { id:'short',  label:'Kurz',     icon:'✂️',
    build(g: any, h: any, hd: any) {
      g.add(box(0.68,0.14,0.62,h,  0,    0.30, 0))
      g.add(box(0.08,0.30,0.54,h, -0.35, 0.05, 0))
      g.add(box(0.08,0.30,0.54,h,  0.35, 0.05, 0))
      g.add(box(0.66,0.28,0.10,h,  0,    0.05,-0.31))
    }
  },
  { id:'medium', label:'Normal',   icon:'👦',
    build(g: any, h: any, hd: any) {
      g.add(box(0.68,0.22,0.62,h,  0,    0.30, 0))
      g.add(box(0.10,0.48,0.54,h, -0.35, 0.07, 0))
      g.add(box(0.10,0.48,0.54,h,  0.35, 0.07, 0))
      g.add(box(0.66,0.46,0.10,h,  0,    0.07,-0.31))
      g.add(box(0.38,0.12,0.08,hd, 0,    0.30, 0.33))
    }
  },
  { id:'long',   label:'Lang',     icon:'👧',
    build(g: any, h: any, hd: any) {
      g.add(box(0.68,0.22,0.62,h,  0,    0.30, 0))
      g.add(box(0.12,0.90,0.54,h, -0.35,-0.13, 0))
      g.add(box(0.12,0.90,0.54,h,  0.35,-0.13, 0))
      g.add(box(0.66,0.88,0.10,h,  0,   -0.11,-0.31))
      g.add(box(0.38,0.12,0.08,hd, 0,    0.30, 0.33))
    }
  },
  { id:'spiky',  label:'Stacheln', icon:'⚡',
    build(g: any, h: any, hd: any) {
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
    build(g: any, h: any, hd: any) {
      g.add(box(0.24,0.44,0.62,h,  0,    0.40, 0))
      g.add(box(0.66,0.10,0.62,h,  0,    0.20, 0))
      g.add(box(0.08,0.36,0.54,h, -0.35, 0.02, 0))
      g.add(box(0.08,0.36,0.54,h,  0.35, 0.02, 0))
      g.add(box(0.24,0.34,0.10,h,  0,    0.02,-0.31))
    }
  },
  { id:'bun',    label:'Dutt',     icon:'🍩',
    build(g: any, h: any, hd: any) {
      g.add(box(0.66,0.12,0.62,h,  0,    0.26, 0))
      g.add(box(0.08,0.36,0.54,h, -0.35, 0.02, 0))
      g.add(box(0.08,0.36,0.54,h,  0.35, 0.02, 0))
      g.add(box(0.66,0.34,0.10,h,  0,    0.02,-0.31))
      g.add(box(0.44,0.34,0.44,h,  0,    0.44, 0))
    }
  },
  { id:'braids', label:'Zoepfe',   icon:'🎀',
    build(g: any, h: any, hd: any) {
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
    build(g: any, h: any, hd: any) {
      g.add(box(0.82,0.34,0.76,h,  0,    0.36, 0))
      g.add(box(0.78,0.18,0.72,h,  0,    0.14, 0))
      g.add(box(0.16,0.52,0.58,h, -0.44, 0.08, 0))
      g.add(box(0.16,0.52,0.58,h,  0.44, 0.08, 0))
      g.add(box(0.74,0.52,0.14,h,  0,    0.08,-0.37))
    }
  },
]

// ─── Shirt Styles ─────────────────────────────────────────────────────────────
export const SHIRT_STYLES: StyleDef[] = [
  { id:'basic',   label:'Basic',    icon:'👕',
    build(g: any, s: any, sd: any, sk: any, blt: any, bk: any) {
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
    build(g: any, s: any, sd: any, sk: any, blt: any, bk: any) {
      g.add(box(0.62,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.07,0.56,0.39,sd, -0.34,  0,    0))
      g.add(box(0.07,0.56,0.39,sd,  0.34,  0,    0))
      g.add(box(0.11,0.32,0.10,sk, -0.07,  0.20, 0.19))
      g.add(box(0.11,0.32,0.10,sk,  0.07,  0.20, 0.19))
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'stripe',  label:'Streifen', icon:'🦓',
    build(g: any, s: any, sd: any, sk: any, blt: any, bk: any) {
      const w = makeMat(0xffffff)
      g.add(box(0.62,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.07,0.56,0.39,sd, -0.34,  0,    0))
      g.add(box(0.07,0.56,0.39,sd,  0.34,  0,    0))
      g.add(box(0.64,0.07,0.39,w,   0,     0.16, 0))
      g.add(box(0.64,0.07,0.39,w,   0,    -0.06, 0))
      g.add(box(0.12,0.22,0.09,sd, -0.09,  0.25, 0.20))
      g.add(box(0.12,0.22,0.09,sd,  0.09,  0.25, 0.20))
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'hoodie',  label:'Hoodie',   icon:'🧥',
    build(g: any, s: any, sd: any, sk: any, blt: any, bk: any) {
      g.add(box(0.66,0.62,0.40,sd,  0,     0,    0))
      g.add(box(0.07,0.60,0.42,s,  -0.34,  0,    0))
      g.add(box(0.07,0.60,0.42,s,   0.34,  0,    0))
      g.add(box(0.40,0.22,0.06,s,   0,    -0.08, 0.22))
      g.add(box(0.54,0.36,0.14,sd,  0,     0.22,-0.24))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
  { id:'tanktop', label:'Tank Top', icon:'🩱',
    build(g: any, s: any, sd: any, sk: any, blt: any, bk: any) {
      g.add(box(0.56,0.58,0.37,s,   0,     0,    0))
      g.add(box(0.06,0.56,0.39,sd, -0.30,  0,    0))
      g.add(box(0.06,0.56,0.39,sd,  0.30,  0,    0))
      g.add(box(0.64,0.09,0.39,blt, 0,    -0.33, 0))
      g.add(box(0.13,0.11,0.07,bk,  0,    -0.33, 0.21))
      g.add(box(0.26,0.20,0.24,sk,  0,     0.37, 0))
    }
  },
]

// ─── Pants Styles ─────────────────────────────────────────────────────────────
export const PANTS_STYLES: StyleDef[] = [
  { id:'regular', label:'Normal',  icon:'👖',
    build(leg: any, p: any, pd: any, skl: any) {
      leg.add(box(0.27,0.31,0.28,p,  0,-0.14,0))
      leg.add(box(0.26,0.09,0.28,pd, 0,-0.33,0))
      leg.add(box(0.24,0.26,0.25,p,  0,-0.51,0))
      leg.add(box(0.21,0.08,0.22,skl,0,-0.68,0))
    }
  },
  { id:'shorts',  label:'Shorts',  icon:'🩳',
    build(leg: any, p: any, pd: any, skl: any) {
      leg.add(box(0.28,0.34,0.29,p,  0,-0.16,0))
      leg.add(box(0.26,0.06,0.28,pd, 0,-0.35,0))
      leg.add(box(0.21,0.08,0.22,skl,0,-0.44,0))
    }
  },
  { id:'wide',    label:'Baggy',   icon:'🎪',
    build(leg: any, p: any, pd: any, skl: any) {
      leg.add(box(0.32,0.30,0.32,p,  0,-0.14,0))
      leg.add(box(0.28,0.09,0.30,pd, 0,-0.33,0))
      leg.add(box(0.26,0.26,0.28,p,  0,-0.51,0))
      leg.add(box(0.21,0.08,0.22,skl,0,-0.68,0))
    }
  },
  { id:'skirt',   label:'Rock',    icon:'👗',
    build(leg: any, p: any, pd: any, skl: any) {
      leg.add(box(0.44,0.22,0.42,p,  0,-0.11,0))
      leg.add(box(0.40,0.26,0.38,p,  0,-0.34,0))
      leg.add(box(0.21,0.10,0.22,skl,0,-0.55,0))
    }
  },
]

// ─── Avatar State ─────────────────────────────────────────────────────────────
export interface AvatarState {
  skinTone: number
  hairStyle: number
  hairColor: number
  shirtStyle: number
  shirtColor: number
  pantsStyle: number
  pantsColor: number
  shoeColor: number
}

export function createDefaultAvatar(): AvatarState {
  return { skinTone:1, hairStyle:1, hairColor:5, shirtStyle:0, shirtColor:0, pantsStyle:0, pantsColor:0, shoeColor:0 }
}

// ─── Avatar Code Serialisierung (pipe-separated) ─────────────────────────────
export function stateToAvatarCode(av: AvatarState): string {
  return [av.skinTone, av.hairStyle, av.hairColor, av.shirtStyle, av.shirtColor, av.pantsStyle, av.pantsColor, av.shoeColor].join('|')
}

export function avatarCodeToState(code: string): AvatarState {
  const p = code.split('|').map(Number)
  return {
    skinTone:   p[0] ?? 1,
    hairStyle:  p[1] ?? 1,
    hairColor:  p[2] ?? 5,
    shirtStyle: p[3] ?? 0,
    shirtColor: p[4] ?? 0,
    pantsStyle: p[5] ?? 0,
    pantsColor: p[6] ?? 0,
    shoeColor:  p[7] ?? 0,
  }
}

// ─── Avatar Editor Kategorien ─────────────────────────────────────────────────
export interface AvatarCategory {
  id: string
  label: string
  icon: string
  prop: keyof AvatarState
  palette?: number[]
  styles?: StyleDef[]
}

export const AV_CATS: AvatarCategory[] = [
  { id: 'skin',  label: 'Haut',  icon: '🖐️', prop: 'skinTone',   palette: SKIN_TONES },
  { id: 'hair',  label: 'Haare', icon: '💇', prop: 'hairStyle',  styles:  HAIR_STYLES },
  { id: 'hairc', label: 'Haarfarbe', icon: '🎨', prop: 'hairColor', palette: HAIR_COLORS },
  { id: 'shirt', label: 'Oberteil',  icon: '👕', prop: 'shirtStyle', styles: SHIRT_STYLES },
  { id: 'shirtc',label: 'Oberteilfarbe', icon: '🎨', prop: 'shirtColor', palette: SHIRT_COLORS },
  { id: 'pants', label: 'Hose',  icon: '👖', prop: 'pantsStyle', styles:  PANTS_STYLES },
  { id: 'pantsc',label: 'Hosenfarbe', icon: '🎨', prop: 'pantsColor', palette: PANTS_COLORS },
  { id: 'shoes', label: 'Schuhe',icon: '👟', prop: 'shoeColor',  palette: SHOE_COLORS },
]
