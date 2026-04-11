import { Graphics } from 'pixi.js';

// ─── Typen ────────────────────────────────────────────────────────────────────
export type HairStyle  = 'short' | 'long' | 'mohawk' | 'bald';
export type ShirtStyle = 'tshirt' | 'hoodie' | 'suit';
export type PantsStyle = 'jeans' | 'shorts';
export type HatStyle   = 'none' | 'cap' | 'snapback' | 'tophat' | 'beanie';
export type ShoeStyle  = 'basic' | 'sneaker';
export type AvatarAction = 'idle' | 'sit' | 'wave' | 'dance' | 'walk';

export interface AvatarAppearance {
  skinColor:  number;
  hairColor:  number;
  hairStyle:  HairStyle;
  shirtColor: number;
  shirtStyle: ShirtStyle;
  pantsColor: number;
  pantsStyle: PantsStyle;
  shoeColor:  number;
  shoeStyle:  ShoeStyle;
  hat:        HatStyle;
}

export const DEFAULT_APPEARANCE: AvatarAppearance = {
  skinColor:  0xF5CBA7,
  hairColor:  0x3D2B1F,
  hairStyle:  'short',
  shirtColor: 0x3B82F6,
  shirtStyle: 'tshirt',
  pantsColor: 0x1E3A5F,
  pantsStyle: 'jeans',
  shoeColor:  0x2C1A0E,
  shoeStyle:  'basic',
  hat:        'cap',
};

// Blickrichtung: front=SE (zur Kamera), back=NW (zur Wand), side=NE/SW (seitlich, gespiegelt via scale.x)
export type AvatarFacing = 'front' | 'back' | 'side';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function clamp(v: number): number { return Math.max(0, Math.min(255, Math.round(v))); }

function darken(color: number, factor = 0.75): number {
  return (clamp(((color >> 16) & 0xFF) * factor) << 16)
       | (clamp(((color >>  8) & 0xFF) * factor) <<  8)
       |  clamp(( color        & 0xFF) * factor);
}

// ─── Shadow ───────────────────────────────────────────────────────────────────
export function drawShadow(g: Graphics, ax: number, ay: number) {
  g.ellipse(ax, ay, 13, 5);
  g.fill({ color: 0x000000, alpha: 0.16 });
}

// ─── SEITEN-ANSICHT ───────────────────────────────────────────────────────────
// Isometrische 3/4-Perspektive. Alle Teile als eigenständige Schichten,
// damit später weitere Kleidungsstücke einfach oben drauf gezeichnet werden können.
//
// Koordinaten-Konvention (ax=Mittelpunkt, ay=Bodenniveau):
//   Füße:   ay-4  bis ay      (4px)
//   Beine:  ay-13 bis ay-4    (9px)
//   Körper: ay-26 bis ay-14   (12px)
//   Hals:   ay-28 bis ay-26   (2px)
//   Kopf:   ay-40 bis ay-28   (12px)
//
// Isometrie-Tiefe: sichtbare Vorderseite + 2px dunkle Tiefenkante rechts.
// dir=1 (Blick nach rechts): Gesicht auf linker Seite, Tiefenkante rechts.
// dir=-1 (Blick nach links): scale.x=-1 im Container → alles gespiegelt.

function sideShoe(g: Graphics, ax: number, ay: number, color: number, xOff: number, yOff: number, style: ShoeStyle = 'basic') {
  if (style === 'sneaker') {
    const sole = darken(color, 0.50);
    g.rect(ax + xOff - 1, ay - 2 + yOff, 7, 2); g.fill({ color: sole }); // dicke Sohle
    g.rect(ax + xOff,     ay - 6 + yOff, 5, 4); g.fill({ color: 0xEEEEEE }); // weißes Oberteil
    g.rect(ax + xOff + 5, ay - 6 + yOff, 1, 3); g.fill({ color: darken(0xEEEEEE, 0.65) }); // Tiefe
    g.rect(ax + xOff,     ay - 5 + yOff, 5, 1); g.fill({ color }); // Farbstreifen
    g.rect(ax + xOff + 2, ay - 7 + yOff, 2, 2); g.fill({ color: 0xDDDDDD }); // Zunge
  } else {
    // Basic: 5px breit (schmales Seitenprofil)
    g.rect(ax + xOff,     ay - 4 + yOff, 5, 4); g.fill({ color });
    g.rect(ax + xOff + 5, ay - 4 + yOff, 1, 3); g.fill({ color: darken(color, 0.55) }); // Tiefe
    g.rect(ax + xOff,     ay - 4 + yOff, 5, 1); g.fill({ color: darken(color, 0.80) }); // Sohlen-Oberseite
    g.rect(ax + xOff,     ay      + yOff, 5, 1); g.fill({ color: darken(color, 0.50) }); // Sohle
  }
}

function sideLeg(g: Graphics, ax: number, ay: number, color: number, xOff: number, yOff: number, legH: number, depth = true) {
  // Bein: 3px breit (schmales Seitenprofil)
  g.rect(ax + xOff,     ay - 4 - legH + yOff, 3, legH); g.fill({ color });
  if (depth) {
    g.rect(ax + xOff + 3, ay - 4 - legH + yOff, 1, legH); g.fill({ color: darken(color, 0.6) });
  }
}

function sideBody(g: Graphics, ax: number, bodyY: number, color: number, style: ShirtStyle) {
  // Körper schmal: 7px Vorderseite + 2px Tiefenkante (Seitenprofil)
  g.rect(ax - 1, bodyY, 7, 12); g.fill({ color });
  g.rect(ax + 6, bodyY, 2, 12); g.fill({ color: darken(color, 0.55) }); // Tiefe rechts

  if (style === 'suit') {
    g.rect(ax - 1, bodyY, 2, 12); g.fill({ color: darken(color, 0.65), alpha: 0.85 }); // Revers li
    g.rect(ax + 3, bodyY, 2, 12); g.fill({ color: darken(color, 0.65), alpha: 0.85 }); // Revers re
    g.rect(ax + 1, bodyY, 2, 12); g.fill({ color: 0xFFFFFF, alpha: 0.13 }); // Krawatte
    g.rect(ax,     bodyY, 3,  2); g.fill({ color: 0xFFFFFF, alpha: 0.20 }); // Kragen
  } else if (style === 'hoodie') {
    g.rect(ax - 1, bodyY,     2, 3); g.fill({ color: darken(color, 0.72), alpha: 0.55 }); // Kapuzensaum
    g.rect(ax,     bodyY + 6, 4, 3); g.fill({ color: darken(color, 0.78), alpha: 0.35 }); // Tasche
  } else {
    // T-Shirt: Kragenlinie
    g.rect(ax, bodyY, 5, 1); g.fill({ color: darken(color, 0.78), alpha: 0.45 });
  }
}

function sideArm(g: Graphics, ax: number, bodyY: number, shirtColor: number, skinColor: number, xOff: number, yOff: number, bright: boolean) {
  const c = bright ? shirtColor : darken(shirtColor, 0.62);
  const sc = bright ? skinColor : darken(skinColor, 0.68);
  g.rect(ax + xOff,     bodyY + yOff, 3, 11); g.fill({ color: c });
  if (bright) {
    g.rect(ax + xOff + 3, bodyY + yOff, 1, 11); g.fill({ color: darken(c, 0.62) }); // Tiefe
  }
  g.circle(ax + xOff + 1.5, bodyY + yOff + 12, 2.5); g.fill({ color: sc });
}

function sideHead(g: Graphics, ax: number, headY: number, skinColor: number) {
  // Kopf: 9px Vorderseite + 2px Tiefe = 11px (etwas breiter als Körper für Chibi-Look)
  g.roundRect(ax - 2, headY, 9, 12, 3); g.fill({ color: skinColor });
  g.stroke({ color: darken(skinColor, 0.80), width: 0.7, alpha: 0.4 });
  // Tiefenkante rechts
  g.rect(ax + 7, headY + 1, 2, 10); g.fill({ color: darken(skinColor, 0.62) });
}

function sideFace(g: Graphics, ax: number, headY: number, action: AvatarAction) {
  const eyeY = headY + 4;
  // Auge (sichtbare Seite)
  g.circle(ax + 3.5, eyeY, 1.6); g.fill({ color: 0x1A1A2E });
  g.circle(ax + 4.2, eyeY - 0.6, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 });
  // Nasenandeutung
  g.rect(ax + 5, headY + 6, 2, 1); g.fill({ color: 0x000000, alpha: 0.12 });
  // Mund
  const happy = action === 'dance' || action === 'wave';
  g.rect(ax + 2, headY + 9, happy ? 4 : 3, 1); g.fill({ color: 0x1A1A2E, alpha: happy ? 0.4 : 0.25 });
  if (happy) g.rect(ax + 2, headY + 10, 4, 1); g.fill({ color: 0x1A1A2E, alpha: 0.15 });
}

function sideHair(g: Graphics, ax: number, headY: number, hairColor: number, style: HairStyle) {
  if (style === 'bald') return;
  const hd = darken(hairColor, 0.70);
  // Haupthaare oben (passt zur neuen Kopfbreite ax-2, 9px)
  g.rect(ax - 2, headY - 1, 9, 5); g.fill({ color: hairColor });
  g.rect(ax + 7, headY - 1, 2, 4); g.fill({ color: hd }); // Tiefe
  // Highlight
  g.rect(ax - 1, headY - 1, 4, 2); g.fill({ color: darken(hairColor, 0.90), alpha: 0.30 });
  // Seitliche Haare (Schläfe)
  g.rect(ax - 2, headY + 3, 2, 5); g.fill({ color: hairColor });

  if (style === 'long') {
    // Lange Haare: hintere Strähne
    g.rect(ax + 5, headY + 3, 2, 9); g.fill({ color: hairColor });
    g.rect(ax - 2, headY + 3, 2, 9); g.fill({ color: hairColor });
  } else if (style === 'mohawk') {
    g.rect(ax - 1, headY - 7, 4, 7); g.fill({ color: hairColor });
    g.rect(ax,     headY - 9, 2, 3); g.fill({ color: hairColor });
  }
}

function sideHat(g: Graphics, ax: number, headY: number, hat: HatStyle) {
  if (hat === 'none') return;
  if (hat === 'snapback') {
    g.rect(ax - 2, headY - 5,  9, 6); g.fill({ color: 0x222222 }); // flache Krone
    g.rect(ax + 7, headY - 4,  2, 5); g.fill({ color: darken(0x222222, 0.50) }); // Tiefe
    g.rect(ax + 4, headY + 1,  7, 2); g.fill({ color: 0x222222 }); // flacher Schirm
    g.rect(ax + 4, headY + 3,  7, 1); g.fill({ color: darken(0x222222, 0.60) }); // Schirmkante
    g.rect(ax - 2, headY - 4,  2, 1); g.fill({ color: 0x444444, alpha: 0.6 }); // Verschluss
    g.rect(ax + 1, headY - 5,  3, 1); g.fill({ color: 0x555555, alpha: 0.5 }); // Naht oben
  } else if (hat === 'cap') {
    g.rect(ax - 2, headY - 6,  9, 7); g.fill({ color: 0xCC2222 });
    g.rect(ax + 7, headY - 5,  2, 6); g.fill({ color: darken(0xCC2222, 0.58) }); // Tiefe
    g.rect(ax + 5, headY + 1,  6, 2); g.fill({ color: 0xCC2222 }); // Schirm
    g.rect(ax + 5, headY + 3,  6, 1); g.fill({ color: darken(0xCC2222, 0.70) }); // Schirmkante
    g.rect(ax,     headY - 6,  3, 1); g.fill({ color: darken(0xCC2222, 0.80), alpha: 0.4 }); // Naht
  } else if (hat === 'tophat') {
    g.rect(ax - 2, headY - 11,  9, 11); g.fill({ color: 0x1A1A1A });
    g.rect(ax + 7, headY - 10,  2,  9); g.fill({ color: darken(0x1A1A1A, 0.45) }); // Tiefe
    g.rect(ax - 4, headY  - 1, 13,  2); g.fill({ color: 0x1A1A1A }); // Krempe
    g.rect(ax - 2, headY - 11,  9,  1); g.fill({ color: 0x444444, alpha: 0.65 }); // Highlight
  } else if (hat === 'beanie') {
    g.roundRect(ax - 2, headY - 6, 9, 8, 3); g.fill({ color: 0x22AA66 });
    g.rect(ax + 7, headY - 5, 2, 7);          g.fill({ color: darken(0x22AA66, 0.65) }); // Tiefe
    g.rect(ax - 2, headY + 1, 9, 2);          g.fill({ color: 0x1A8855 }); // Rand
    g.circle(ax + 2, headY - 6, 2.2);         g.fill({ color: 0x33CC77 }); // Bommel
  }
}

// Debug: globaler Pixel-Offset für Seitenansicht (wird vom AvatarTestClient gesetzt)
let _sideViewOffsetX = -1;
export function getSideViewOffsetX() { return _sideViewOffsetX; }
export function setSideViewOffsetX(v: number) { _sideViewOffsetX = v; }


function drawAvatarSide(
  g: Graphics, _ax: number, ay: number,
  action: AvatarAction, t: number, app: AvatarAppearance,
) {
  const ax = _ax + _sideViewOffsetX;
  const phase  = action === 'walk' ? t * 10 : 0;
  const bob    = action === 'walk' ? -Math.abs(Math.sin(phase)) * 2 : 0;
  const B      = Math.round(bob);
  // Bein-Animation: Vorderbein und Hinterbein wechseln sich ab
  const fLeg   = action === 'walk' ? Math.round(Math.sin(phase)            * 4) : 0;
  const bLeg   = action === 'walk' ? Math.round(Math.sin(phase + Math.PI)  * 4) : 0;
  // Arm-Animation: gegenläufig zu Beinen
  const fArm   = action === 'walk' ? Math.round(Math.sin(phase + Math.PI)  * 5) : 0;
  const bArm   = action === 'walk' ? Math.round(Math.sin(phase)            * 4) : 0;
  // Wink-Animation
  const waving = action === 'wave';
  const dancing= action === 'dance';
  const dSwing = dancing ? Math.round(Math.sin(t * 5) * 6) : 0;

  const legH   = app.pantsStyle === 'shorts' ? 5 : 9;
  const bodyY  = ay - 26 + B;
  const headY  = ay - 40 + B;

  // ── Zeichnungsreihenfolge (hinten → vorne) ──────────────────────────────

  // 1. Hinterbein (links, weiter weg, dunkler)
  sideShoe(g, ax, ay + B + bLeg, darken(app.shoeColor, 0.65), -2, 0, app.shoeStyle);
  sideLeg(g, ax, ay + B + bLeg, darken(app.pantsColor, 0.65), -2, 0, legH, false);

  // 2. Hinterer Arm (hinter Körper)
  const bArmOff = waving ? 6 : dancing ? -dSwing : bArm;
  sideArm(g, ax, bodyY, app.shirtColor, app.skinColor, -4, bArmOff, false);

  // 3. Körper
  sideBody(g, ax, bodyY, app.shirtColor, app.shirtStyle);

  // 4. Vorderer Arm (vor Körper)
  const fArmOff = waving ? -10 : dancing ? dSwing : fArm;
  sideArm(g, ax, bodyY, app.shirtColor, app.skinColor, 4, fArmOff, true);
  if (waving) {
    // Wink-Hand hoch
    g.circle(ax + 5.5, bodyY - 11, 3.5); g.fill({ color: app.skinColor });
    // Finger-Andeutungen
    for (let i = 0; i < 3; i++) {
      g.circle(ax + 3.5 + i * 2, bodyY - 14, 1.2); g.fill({ color: app.skinColor });
    }
  }

  // 5. Vorderbein (rechts, näher, volle Farbe)
  sideShoe(g, ax, ay + B + fLeg, app.shoeColor, -2, 0, app.shoeStyle);
  sideLeg(g, ax, ay + B + fLeg, app.pantsColor, -2, 0, legH);

  // 6. Hals (schmal, 3px)
  g.rect(ax, ay - 26 + B, 3, 2); g.fill({ color: app.skinColor });

  // 7. Kopf + Gesicht + Haare + Hut
  sideHead(g, ax, headY, app.skinColor);
  sideFace(g, ax, headY, action);
  sideHair(g, ax, headY, app.hairColor, app.hairStyle);
  sideHat(g, ax, headY, app.hat);
}

// ─── RÜCKEN-ANSICHT ───────────────────────────────────────────────────────────
function drawAvatarBack(
  g: Graphics, ax: number, ay: number,
  action: AvatarAction, t: number, app: AvatarAppearance,
) {
  const phase  = action === 'walk' ? t * 10 : 0;
  const bob    = action === 'walk' ? -Math.abs(Math.sin(phase)) * 2 : 0;
  const B      = Math.round(bob);
  const lLeg   = action === 'walk' ? Math.round(Math.sin(phase) * 4)           : 0;
  const rLeg   = action === 'walk' ? Math.round(Math.sin(phase + Math.PI) * 4) : 0;
  const lArm   = action === 'walk' ? Math.round(Math.sin(phase + Math.PI) * 5) : 0;
  const rArm   = action === 'walk' ? Math.round(Math.sin(phase) * 5)           : 0;

  const legH   = app.pantsStyle === 'shorts' ? 5 : 9;
  const bodyY  = ay - 26 + B;
  const headY  = ay - 40 + B;
  const sc     = darken(app.shirtColor, 0.82);
  const pc     = darken(app.pantsColor, 0.82);
  const skc    = darken(app.skinColor,  0.82);

  // Schuhe
  g.rect(ax - 6, ay - 4 + B + lLeg, 5, 4); g.fill({ color: darken(app.shoeColor, 0.75) });
  g.rect(ax + 1, ay - 4 + B + rLeg, 5, 4); g.fill({ color: darken(app.shoeColor, 0.75) });
  // Beine
  g.rect(ax - 5, ay - 4 - legH + B + lLeg, 4, legH); g.fill({ color: pc });
  g.rect(ax + 1, ay - 4 - legH + B + rLeg, 4, legH); g.fill({ color: pc });
  // Arme
  g.rect(ax - 10, bodyY + lArm, 4, 11); g.fill({ color: sc });
  g.rect(ax +  6, bodyY + rArm, 4, 11); g.fill({ color: sc });
  g.circle(ax - 8, bodyY + 12 + lArm, 2.5); g.fill({ color: skc });
  g.circle(ax + 8, bodyY + 12 + rArm, 2.5); g.fill({ color: skc });
  // Rumpf
  g.rect(ax - 6, bodyY, 12, 12); g.fill({ color: sc });
  // Tiefenkante links/rechts (isometrisch)
  g.rect(ax - 6, bodyY, 2, 12); g.fill({ color: darken(sc, 0.65), alpha: 0.6 });
  g.rect(ax + 4, bodyY, 2, 12); g.fill({ color: darken(sc, 0.65), alpha: 0.6 });
  // "S" = Staff-Markierung auf dem Rücken (T-Shirt, Pixel-Art)
  if (app.shirtStyle === 'tshirt') {
    const sx2 = ax - 1, sy2 = bodyY + 3, c2 = darken(app.shirtColor, 0.55);
    g.rect(sx2, sy2,     3, 1); g.fill({ color: c2, alpha: 0.85 }); // oben
    g.rect(sx2, sy2 + 1, 1, 1); g.fill({ color: c2, alpha: 0.85 }); // links oben
    g.rect(sx2, sy2 + 2, 3, 1); g.fill({ color: c2, alpha: 0.85 }); // mitte
    g.rect(sx2 + 2, sy2 + 3, 1, 1); g.fill({ color: c2, alpha: 0.85 }); // rechts unten
    g.rect(sx2, sy2 + 4, 3, 1); g.fill({ color: c2, alpha: 0.85 }); // unten
  }
  // Hals
  g.rect(ax - 2, ay - 26 + B, 4, 2); g.fill({ color: skc });
  // Kopf (Rückseite)
  g.roundRect(ax - 5, headY, 10, 12, 3); g.fill({ color: skc });
  // Haare Rückseite
  if (app.hairStyle !== 'bald') {
    g.rect(ax - 5, headY - 1, 10, 6); g.fill({ color: app.hairColor });
    if (app.hairStyle === 'long') {
      g.rect(ax - 5, headY + 4, 10, 8); g.fill({ color: app.hairColor });
    } else if (app.hairStyle === 'mohawk') {
      g.rect(ax - 1, headY - 8, 4, 8); g.fill({ color: app.hairColor });
    }
  }
  // Hut Rückseite
  if (app.hat !== 'none') {
    if (app.hat === 'snapback') {
      g.rect(ax - 5, headY - 5, 10, 6); g.fill({ color: darken(0x222222, 0.78) });
    } else if (app.hat === 'cap') {
      g.rect(ax - 5, headY - 6, 10, 7); g.fill({ color: darken(0xCC2222, 0.78) });
    } else if (app.hat === 'tophat') {
      g.rect(ax - 4, headY - 11, 8, 11); g.fill({ color: 0x111111 });
      g.rect(ax - 6, headY - 1, 12,  2); g.fill({ color: 0x111111 });
    } else if (app.hat === 'beanie') {
      g.roundRect(ax - 5, headY - 6, 10, 8, 3); g.fill({ color: darken(0x22AA66, 0.78) });
    }
  }
}

// ─── FRONT-ANSICHT (SE – zur Kamera) ─────────────────────────────────────────
function drawAvatarFront(
  g: Graphics, ax: number, ay: number,
  action: AvatarAction, t: number, app: AvatarAppearance,
) {
  const phase  = action === 'walk' ? t * 10 : 0;
  const bob    = action === 'dance' ? Math.round(Math.sin(t * 5) * 2)
               : action === 'walk'  ? -Math.round(Math.abs(Math.sin(phase)) * 2) : 0;
  const lLeg   = action === 'walk' ? Math.round(Math.sin(phase) * 4)           : 0;
  const rLeg   = action === 'walk' ? Math.round(Math.sin(phase + Math.PI) * 4) : 0;
  const lArm   = action === 'wave' ? -12
               : action === 'walk' ? Math.round(Math.sin(phase + Math.PI) * 5)
               : action === 'dance'? Math.round(Math.sin(t * 5 + Math.PI) * 6) : 0;
  const rArm   = action === 'wave' ? Math.round(Math.sin(t * 8) * 2)
               : action === 'walk' ? Math.round(Math.sin(phase) * 5)
               : action === 'dance'? Math.round(Math.sin(t * 5) * 6) : 0;

  const legH   = app.pantsStyle === 'shorts' ? 5 : 9;
  const bodyY  = ay - 26 + bob;
  const headY  = ay - 40 + bob;

  // Schuhe
  g.rect(ax - 6, ay - 4 + bob + lLeg, 5, 4); g.fill({ color: app.shoeColor });
  g.rect(ax + 1, ay - 4 + bob + rLeg, 5, 4); g.fill({ color: app.shoeColor });
  g.rect(ax + 5, ay - 4 + bob + rLeg, 1, 3); g.fill({ color: darken(app.shoeColor, 0.65) });
  // Beine
  g.rect(ax - 5, ay - 4 - legH + bob + lLeg, 4, legH); g.fill({ color: app.pantsColor });
  g.rect(ax + 1, ay - 4 - legH + bob + rLeg, 4, legH); g.fill({ color: app.pantsColor });
  g.rect(ax - 5, ay - 4 - legH + bob + lLeg, 1, legH); g.fill({ color: darken(app.pantsColor, 0.65), alpha: 0.5 });
  g.rect(ax + 4, ay - 4 - legH + bob + rLeg, 1, legH); g.fill({ color: darken(app.pantsColor, 0.65), alpha: 0.5 });
  // Arme
  g.rect(ax - 10, bodyY + lArm, 4, 11); g.fill({ color: app.shirtColor });
  g.rect(ax +  6, bodyY + rArm, 4, 11); g.fill({ color: app.shirtColor });
  g.circle(ax - 8, bodyY + 12 + lArm, 2.5); g.fill({ color: app.skinColor });
  g.circle(ax + 8, bodyY + 12 + rArm, 2.5); g.fill({ color: app.skinColor });
  if (action === 'wave') {
    g.circle(ax - 8, bodyY + lArm - 2, 3.5); g.fill({ color: app.skinColor });
    for (let i = 0; i < 3; i++) {
      g.circle(ax - 10 + i * 2, bodyY + lArm - 5, 1.2); g.fill({ color: app.skinColor });
    }
  }
  // Körper
  g.rect(ax - 6, bodyY, 12, 12); g.fill({ color: app.shirtColor });
  g.rect(ax - 6, bodyY,  2, 12); g.fill({ color: darken(app.shirtColor, 0.65), alpha: 0.5 });
  g.rect(ax + 4, bodyY,  2, 12); g.fill({ color: darken(app.shirtColor, 0.65), alpha: 0.5 });
  if (app.shirtStyle === 'suit') {
    g.rect(ax - 3, bodyY, 3, 12); g.fill({ color: darken(app.shirtColor, 0.70), alpha: 0.8 });
    g.rect(ax,     bodyY, 3, 12); g.fill({ color: darken(app.shirtColor, 0.70), alpha: 0.8 });
    g.rect(ax - 1, bodyY, 2, 12); g.fill({ color: 0xFFFFFF, alpha: 0.15 });
    g.rect(ax - 2, bodyY, 4,  2); g.fill({ color: 0xFFFFFF, alpha: 0.20 });
  } else if (app.shirtStyle === 'hoodie') {
    g.rect(ax - 4, bodyY, 3, 3); g.fill({ color: darken(app.shirtColor, 0.72), alpha: 0.5 });
    g.rect(ax + 1, bodyY, 3, 3); g.fill({ color: darken(app.shirtColor, 0.72), alpha: 0.5 });
    g.rect(ax - 2, bodyY + 6, 4, 3); g.fill({ color: darken(app.shirtColor, 0.78), alpha: 0.35 });
  } else {
    g.rect(ax - 3, bodyY, 6, 1); g.fill({ color: darken(app.shirtColor, 0.78), alpha: 0.45 });
  }
  // Hals
  g.rect(ax - 2, ay - 26 + bob, 4, 2); g.fill({ color: app.skinColor });
  // Kopf
  g.roundRect(ax - 5, headY, 10, 12, 3); g.fill({ color: app.skinColor });
  g.stroke({ color: darken(app.skinColor, 0.80), width: 0.7, alpha: 0.4 });
  // Augen
  const eyeY = headY + 4;
  g.circle(ax - 2, eyeY, 1.6); g.fill({ color: 0x1A1A2E });
  g.circle(ax + 2, eyeY, 1.6); g.fill({ color: 0x1A1A2E });
  g.circle(ax - 1.4, eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 });
  g.circle(ax + 2.6, eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 });
  // Mund
  const happy = action === 'dance' || action === 'wave';
  g.rect(ax - 2, headY + 9, 4, 1); g.fill({ color: 0x1A1A2E, alpha: happy ? 0.4 : 0.25 });
  if (happy) g.rect(ax - 2, headY + 10, 4, 1); g.fill({ color: 0x1A1A2E, alpha: 0.15 });
  // Haare
  if (app.hairStyle !== 'bald') {
    const hd = darken(app.hairColor, 0.70);
    g.rect(ax - 5, headY - 1, 10, 5); g.fill({ color: app.hairColor });
    g.rect(ax - 5, headY + 3,  2, 5); g.fill({ color: app.hairColor });
    g.rect(ax + 3, headY + 3,  2, 5); g.fill({ color: app.hairColor });
    g.rect(ax - 3, headY - 1,  4, 2); g.fill({ color: hd, alpha: 0.30 });
    if (app.hairStyle === 'long') {
      g.rect(ax - 5, headY + 3, 2, 9); g.fill({ color: app.hairColor });
      g.rect(ax + 3, headY + 3, 2, 9); g.fill({ color: app.hairColor });
    } else if (app.hairStyle === 'mohawk') {
      g.rect(ax - 1, headY - 8, 4, 8); g.fill({ color: app.hairColor });
    }
  }
  // Hut
  drawHat(g, ax, headY, app.hat);
}

// ─── Hut (front-Ansicht) ──────────────────────────────────────────────────────
export function drawHat(g: Graphics, ax: number, headY: number, hat: HatStyle) {
  if (hat === 'none') return;
  if (hat === 'snapback') {
    g.rect(ax - 5, headY - 5, 10, 6); g.fill({ color: 0x222222 }); // flache Krone
    g.rect(ax - 7, headY + 1, 14, 2); g.fill({ color: 0x222222 }); // flacher Schirm
    g.rect(ax - 7, headY + 3, 14, 1); g.fill({ color: darken(0x222222, 0.60) }); // Schirmkante
    g.rect(ax - 2, headY - 5,  4, 1); g.fill({ color: 0x444444, alpha: 0.5 }); // Naht
  } else if (hat === 'cap') {
    g.rect(ax - 5, headY - 6, 10, 7); g.fill({ color: 0xCC2222 });
    g.rect(ax - 7, headY + 1, 14, 2); g.fill({ color: 0xCC2222 });
    g.rect(ax - 2, headY - 6,  4, 1); g.fill({ color: darken(0xCC2222, 0.80), alpha: 0.5 });
  } else if (hat === 'tophat') {
    g.rect(ax - 4, headY - 11, 8, 11); g.fill({ color: 0x1A1A1A });
    g.rect(ax - 6, headY -  1, 12, 2); g.fill({ color: 0x1A1A1A });
    g.rect(ax - 4, headY - 11,  8, 1); g.fill({ color: 0x444444, alpha: 0.7 });
    g.rect(ax - 2, headY - 11,  2, 11); g.fill({ color: 0x333333, alpha: 0.18 });
  } else if (hat === 'beanie') {
    g.roundRect(ax - 5, headY - 6, 10, 8, 3); g.fill({ color: 0x22AA66 });
    g.rect(ax - 5, headY + 1, 10, 2);          g.fill({ color: 0x1A8855 });
    g.circle(ax,   headY - 6, 2.2);            g.fill({ color: 0x33CC77 });
  }
}

// ─── Sitz-Pose ────────────────────────────────────────────────────────────────
export function drawSitPose(
  g: Graphics, ax: number, ay: number, app: AvatarAppearance,
) {
  const bY = ay - 16;
  g.ellipse(ax, ay, 14, 5); g.fill({ color: 0x000000, alpha: 0.14 });
  // Beine horizontal
  const pd = darken(app.pantsColor, 0.80);
  g.rect(ax - 12, bY - 5, 10, 6); g.fill({ color: app.pantsColor });
  g.rect(ax +  2, bY - 5, 10, 6); g.fill({ color: app.pantsColor });
  g.rect(ax - 12, bY - 5,  1, 6); g.fill({ color: pd, alpha: 0.5 });
  g.rect(ax + 11, bY - 5,  1, 6); g.fill({ color: pd, alpha: 0.5 });
  // Schuhe
  g.rect(ax - 14, bY - 11, 7, 5); g.fill({ color: app.shoeColor });
  g.rect(ax +  7, bY - 11, 7, 5); g.fill({ color: app.shoeColor });
  // Körper
  g.rect(ax - 6, bY - 14, 12, 12); g.fill({ color: app.shirtColor });
  g.rect(ax - 6, bY - 14,  2, 12); g.fill({ color: darken(app.shirtColor, 0.65), alpha: 0.5 });
  g.rect(ax + 4, bY - 14,  2, 12); g.fill({ color: darken(app.shirtColor, 0.65), alpha: 0.5 });
  // Arme auf Knien
  g.rect(ax - 10, bY - 14, 4, 11); g.fill({ color: app.shirtColor });
  g.rect(ax +  6, bY - 14, 4, 11); g.fill({ color: app.shirtColor });
  g.circle(ax - 8, bY - 4, 2.5); g.fill({ color: app.skinColor });
  g.circle(ax + 8, bY - 4, 2.5); g.fill({ color: app.skinColor });
  // Hals
  g.rect(ax - 2, bY - 14, 4, 2); g.fill({ color: app.skinColor });
  // Kopf
  const headY = bY - 26;
  g.roundRect(ax - 5, headY, 10, 12, 3); g.fill({ color: app.skinColor });
  // Augen
  const eyeY = headY + 4;
  g.circle(ax - 2, eyeY, 1.6); g.fill({ color: 0x1A1A2E });
  g.circle(ax + 2, eyeY, 1.6); g.fill({ color: 0x1A1A2E });
  g.circle(ax - 1.4, eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 });
  g.circle(ax + 2.6, eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 });
  // Haare
  if (app.hairStyle !== 'bald') {
    g.rect(ax - 5, headY - 1, 10, 5); g.fill({ color: app.hairColor });
    g.rect(ax - 5, headY + 3,  2, 5); g.fill({ color: app.hairColor });
    g.rect(ax + 3, headY + 3,  2, 5); g.fill({ color: app.hairColor });
  }
  // Hut
  drawHat(g, ax, headY, app.hat);
}

// ─── Haupt-Zeichen-Funktion ───────────────────────────────────────────────────
export function drawAvatar(
  g: Graphics,
  ax: number, ay: number,
  action: AvatarAction,
  t: number,
  app: AvatarAppearance,
  withShadow = true,
  facing: AvatarFacing = 'front',
) {
  g.clear();

  if (action === 'sit') {
    drawSitPose(g, ax, ay, app);
    return;
  }

  if (withShadow) drawShadow(g, ax, ay);

  if (facing === 'back') {
    drawAvatarBack(g, ax, ay, action, t, app);
  } else if (facing === 'side') {
    drawAvatarSide(g, ax, ay, action, t, app);
  } else {
    drawAvatarFront(g, ax, ay, action, t, app);
  }
}

// ─── FREI DREHBARE ANSICHT (Drehteller) ──────────────────────────────────────
// Rendert den Avatar aus beliebigem Winkel.
// angleDeg: 0=Vorne (Kamera), 90=rechte Seite, 180=Rücken, 270=linke Seite

interface Box3D {
  cx: number;   // x-Offset vom Zentrum (links-rechts)
  cz: number;   // z-Offset (positiv = Richtung Kamera)
  top: number;  // obere Kante (negativ = über Füßen)
  fw: number;   // Breite Frontansicht
  fd: number;   // Tiefe (Seitenbreite)
  h: number;    // Höhe
  color: number;
  sideDark: number; // Abdunkelung der Seitenfläche (0-1)
  dy: number;   // Animation Y-Offset
}

export function drawAvatarAngle(
  g: Graphics, ax: number, ay: number,
  angleDeg: number,
  action: AvatarAction, t: number, app: AvatarAppearance,
  withShadow = true,
) {
  g.clear();
  if (withShadow) drawShadow(g, ax, ay);

  const θ = angleDeg * Math.PI / 180;
  const cosA = Math.cos(θ);
  const sinA = Math.sin(θ);
  const absCos = Math.abs(cosA);
  const absSin = Math.abs(sinA);

  // ── Animation ──
  const phase  = action === 'walk' ? t * 10 : 0;
  const bob    = action === 'walk' ? -Math.abs(Math.sin(phase)) * 2
               : action === 'dance' ? Math.sin(t * 5) * 2 : 0;
  const B      = Math.round(bob);
  const lLeg   = action === 'walk' ? Math.round(Math.sin(phase)           * 4) : 0;
  const rLeg   = action === 'walk' ? Math.round(Math.sin(phase + Math.PI) * 4) : 0;
  const lArm   = action === 'wave' ? -12
               : action === 'walk' ? Math.round(Math.sin(phase + Math.PI) * 5)
               : action === 'dance'? Math.round(Math.sin(t * 5 + Math.PI) * 6) : 0;
  const rArm   = action === 'wave' ? Math.round(Math.sin(t * 8) * 2)
               : action === 'walk' ? Math.round(Math.sin(phase)           * 5)
               : action === 'dance'? Math.round(Math.sin(t * 5)           * 6) : 0;

  const legH = app.pantsStyle === 'shorts' ? 5 : 9;

  // ── Body-Teile als 3D-Boxen ──
  const parts: Box3D[] = [
    // Schuhe
    { cx: -3, cz: 0, top: -4,      fw: 5, fd: 4, h: 4,    color: app.shoeColor,  sideDark: 0.55, dy: B + lLeg },
    { cx:  3, cz: 0, top: -4,      fw: 5, fd: 4, h: 4,    color: app.shoeColor,  sideDark: 0.55, dy: B + rLeg },
    // Beine
    { cx: -3, cz: 0, top: -4-legH, fw: 4, fd: 3, h: legH, color: app.pantsColor, sideDark: 0.60, dy: B + lLeg },
    { cx:  3, cz: 0, top: -4-legH, fw: 4, fd: 3, h: legH, color: app.pantsColor, sideDark: 0.60, dy: B + rLeg },
    // Arme
    { cx: -8, cz: 0, top: -26,     fw: 4, fd: 3, h: 11,   color: app.shirtColor, sideDark: 0.55, dy: B + lArm },
    { cx:  8, cz: 0, top: -26,     fw: 4, fd: 3, h: 11,   color: app.shirtColor, sideDark: 0.55, dy: B + rArm },
    // Rumpf
    { cx:  0, cz: 0, top: -26,     fw: 12, fd: 8, h: 12,  color: app.shirtColor, sideDark: 0.55, dy: B },
    // Hals
    { cx:  0, cz: 0, top: -28,     fw: 4, fd: 3, h: 2,    color: app.skinColor,  sideDark: 0.62, dy: B },
    // Kopf
    { cx:  0, cz: 0, top: -40,     fw: 10, fd: 8, h: 12,  color: app.skinColor,  sideDark: 0.62, dy: B },
  ];

  // Tiefe-Sortierung: am weitesten von Kamera → zuerst zeichnen
  parts.sort((a, b) => {
    const zA = -a.cx * sinA + a.cz * cosA;
    const zB = -b.cx * sinA + b.cz * cosA;
    return zA - zB;
  });

  for (const p of parts) {
    const screenX = ax + p.cx * cosA;
    const screenY = ay + p.top + p.dy;

    const frontW = Math.max(0.5, p.fw * absCos);
    const sideW  = Math.max(0, p.fd * absSin);
    const totalW = frontW + sideW;

    // Welche Seite zeigen wir?
    const showFront = cosA >= 0; // Vorderseite vs Rückseite
    const showRight = sinA > 0;  // rechte Tiefenkante vs linke

    // Farben
    const mainC = showFront ? p.color : darken(p.color, 0.82);
    const sideC = darken(p.color, p.sideDark);

    const leftX = Math.round(screenX - totalW / 2);
    const rFW = Math.round(frontW);
    const rSW = Math.round(sideW);
    const rH  = p.h;

    if (rSW > 0) {
      if (showRight) {
        // Hauptfläche links, Tiefenkante rechts
        g.rect(leftX,       screenY, rFW, rH); g.fill({ color: mainC });
        g.rect(leftX + rFW, screenY, rSW, rH); g.fill({ color: sideC });
      } else {
        // Tiefenkante links, Hauptfläche rechts
        g.rect(leftX,       screenY, rSW, rH); g.fill({ color: sideC });
        g.rect(leftX + rSW, screenY, rFW, rH); g.fill({ color: mainC });
      }
    } else {
      g.rect(leftX, screenY, rFW, rH); g.fill({ color: mainC });
    }
  }

  // ── Gesichtsdetails (nur wenn Vorderseite sichtbar) ──
  const headY = ay - 40 + B;
  if (cosA > 0.25) {
    const alpha = Math.min(1, (cosA - 0.25) / 0.35);
    const eyeSpread = 2 * cosA;
    const eyeY = headY + 4;
    // Augen
    g.circle(ax - eyeSpread, eyeY, 1.6); g.fill({ color: 0x1A1A2E, alpha });
    g.circle(ax + eyeSpread, eyeY, 1.6); g.fill({ color: 0x1A1A2E, alpha });
    // Glanzpunkte
    g.circle(ax - eyeSpread + 0.6, eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 * alpha });
    g.circle(ax + eyeSpread + 0.6, eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 * alpha });
    // Mund
    const mw = Math.max(2, Math.round(4 * cosA));
    const happy = action === 'dance' || action === 'wave';
    g.rect(ax - mw / 2, headY + 9, mw, 1); g.fill({ color: 0x1A1A2E, alpha: (happy ? 0.4 : 0.25) * alpha });
  }

  // ── Seitengesicht (Auge + Nase wenn seitlich) ──
  if (absCos < 0.7 && absSin > 0.3) {
    const alpha = Math.min(1, (absSin - 0.3) / 0.3) * (1 - Math.min(1, absCos / 0.7));
    const headW = 10 * absCos + 8 * absSin;
    const ex = sinA > 0 ? ax - headW / 2 + headW * 0.35 : ax + headW / 2 - headW * 0.35;
    const eyeY = headY + 4;
    g.circle(ex, eyeY, 1.6); g.fill({ color: 0x1A1A2E, alpha });
    g.circle(ex + (sinA > 0 ? 0.6 : -0.6), eyeY - 0.5, 0.6); g.fill({ color: 0xFFFFFF, alpha: 0.8 * alpha });
    // Nase
    const nx = sinA > 0 ? ax - headW / 2 + headW * 0.15 : ax + headW / 2 - headW * 0.15;
    g.rect(nx, headY + 6, 2 * absSin, 1); g.fill({ color: 0x000000, alpha: 0.12 * alpha });
  }

  // ── Haare ──
  if (app.hairStyle !== 'bald') {
    const headW = 10 * absCos + 8 * absSin;
    const hx = ax - headW / 2;
    g.rect(hx, headY - 1, headW, 5); g.fill({ color: app.hairColor });
    // Highlight
    g.rect(hx + 1, headY - 1, Math.max(2, headW * 0.4), 2); g.fill({ color: darken(app.hairColor, 0.90), alpha: 0.30 });
    // Seitliche Haare
    g.rect(hx, headY + 3, Math.max(1, 2 * absCos + 1 * absSin), 5); g.fill({ color: app.hairColor });
    g.rect(hx + headW - Math.max(1, 2 * absCos + 1 * absSin), headY + 3, Math.max(1, 2 * absCos + 1 * absSin), 5); g.fill({ color: app.hairColor });
    if (app.hairStyle === 'long') {
      g.rect(hx, headY + 3, Math.max(1, 2 * absSin), 9); g.fill({ color: app.hairColor });
      g.rect(hx + headW - Math.max(1, 2 * absSin), headY + 3, Math.max(1, 2 * absSin), 9); g.fill({ color: app.hairColor });
    } else if (app.hairStyle === 'mohawk') {
      g.rect(ax - 2, headY - 8, 4, 8); g.fill({ color: app.hairColor });
    }
  }

  // ── Hut ──
  if (app.hat !== 'none') {
    const headW = 10 * absCos + 8 * absSin;
    const hx = ax - headW / 2;
    if (app.hat === 'cap') {
      g.rect(hx, headY - 6, headW, 7); g.fill({ color: 0xCC2222 });
      const brimW = headW + 4;
      g.rect(ax - brimW / 2, headY + 1, brimW, 2); g.fill({ color: 0xCC2222 });
      g.rect(ax - brimW / 2, headY + 3, brimW, 1); g.fill({ color: darken(0xCC2222, 0.70) });
    } else if (app.hat === 'snapback') {
      g.rect(hx, headY - 5, headW, 6); g.fill({ color: 0x222222 });
      const brimW = headW + 4;
      g.rect(ax - brimW / 2, headY + 1, brimW, 2); g.fill({ color: 0x222222 });
    } else if (app.hat === 'tophat') {
      g.rect(hx + 1, headY - 11, headW - 2, 11); g.fill({ color: 0x1A1A1A });
      g.rect(hx - 1, headY - 1, headW + 2, 2); g.fill({ color: 0x1A1A1A });
    } else if (app.hat === 'beanie') {
      g.roundRect(hx, headY - 6, headW, 8, 3); g.fill({ color: 0x22AA66 });
      g.rect(hx, headY + 1, headW, 2); g.fill({ color: 0x1A8855 });
      g.circle(ax, headY - 6, 2.2); g.fill({ color: 0x33CC77 });
    }
  }

  // ── Wink-Hand (nur wenn linker Arm sichtbar) ──
  if (action === 'wave') {
    const armScreenX = ax + (-8) * cosA;
    const armY = ay - 26 + B + lArm;
    g.circle(armScreenX, armY - 2, 3.5); g.fill({ color: app.skinColor });
    for (let i = 0; i < 3; i++) {
      g.circle(armScreenX - 2 + i * 2, armY - 5, 1.2); g.fill({ color: app.skinColor });
    }
  }

  // ── Hände (Kreise an den Armen) ──
  {
    const lArmX = ax + (-8) * cosA;
    const rArmX = ax + ( 8) * cosA;
    const lArmY = ay - 26 + B + lArm + 12;
    const rArmY = ay - 26 + B + rArm + 12;
    // Sortiere: weiter weg zuerst
    const lZ = -(-8) * sinA;
    const rZ = -(8) * sinA;
    const hands = [
      { x: lArmX, y: lArmY, z: lZ, color: app.skinColor },
      { x: rArmX, y: rArmY, z: rZ, color: app.skinColor },
    ].sort((a, b) => a.z - b.z);
    for (const h of hands) {
      if (action !== 'wave' || h.x !== lArmX) { // Wave-Hand schon oben gezeichnet
        g.circle(h.x, h.y, 2.5); g.fill({ color: h.color });
      }
    }
  }
}

// ─── Einzelne Export-Wrapper (Rückwärtskompatibilität) ───────────────────────
export function drawShadowExport(g: Graphics, ax: number, ay: number, scale = 1) {
  g.ellipse(ax, ay, 13 * scale, 5 * scale);
  g.fill({ color: 0x000000, alpha: 0.16 });
}
