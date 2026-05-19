/**
 * myAvatarRenderer — eigener Avatar-Renderer für das Buenzlifight-Avatar-System.
 * Zeichnet einen Pixel-Art-Avatar aus AvatarAppearanceConfig auf einen Canvas.
 * Keine externen Abhängigkeiten, kein CDN.
 */

import type { AvatarAppearanceConfig } from './avatarConfig';

// Ausgabegrösse in Pixel (bei scale=1)
const BASE_W = 32;
const BASE_H = 56;

/**
 * Rendert einen Avatar-Kopf (nur Head, für Footer-Bar) und gibt den Canvas zurück.
 * @param config  AvatarAppearanceConfig
 * @param scale   Skalierungsfaktor (1 = 32×56, 2 = 64×112)
 */
export function renderAvatarCanvas(config: AvatarAppearanceConfig, scale = 2): HTMLCanvasElement {
  const W = BASE_W * scale;
  const H = BASE_H * scale;
  const s = scale; // Kurzform

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const fill = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, w * s, h * s);
  };

  const skin  = config.skinColor  || '#f0c8a0';
  const shirt = config.shirtColor || '#7c3aed';
  const pants = config.pantsColor || '#312e81';
  const hair  = config.hairColor  || '#2d1b12';
  const hat   = config.hatColor   || '#7c3aed';
  const eye   = config.eyeColor   || '#1f2937';

  // Dunklere Töne für Konturen
  const darken = (hex: string, amt = 40): string => {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return `rgb(${r},${g},${b})`;
  };

  /* ── Füsse ───────────────────────────────────────────────────────────── */
  fill(9,  52, 6, 3, darken(pants, 30));
  fill(17, 52, 6, 3, darken(pants, 30));

  /* ── Beine ───────────────────────────────────────────────────────────── */
  fill(9,  39, 6, 14, pants);
  fill(17, 39, 6, 14, pants);
  // Naht
  fill(15, 39, 2, 14, darken(pants, 20));

  /* ── Körper / Shirt ──────────────────────────────────────────────────── */
  fill(7, 24, 18, 16, shirt);
  // Kragen
  fill(12, 24, 8, 2, darken(shirt, 30));
  // Knopfleiste
  fill(15, 26, 2, 13, darken(shirt, 20));

  /* ── Arme ────────────────────────────────────────────────────────────── */
  fill(2,  24, 6, 13, shirt);
  fill(24, 24, 6, 13, shirt);
  // Ärmel-Saum
  fill(2,  36, 6, 2, darken(shirt, 30));
  fill(24, 36, 6, 2, darken(shirt, 30));

  /* ── Hände ───────────────────────────────────────────────────────────── */
  fill(2,  37, 6, 5, skin);
  fill(24, 37, 6, 5, skin);

  /* ── Hals ─────────────────────────────────────────────────────────────── */
  fill(13, 19, 6, 6, skin);

  /* ── Kopf ─────────────────────────────────────────────────────────────── */
  const isSquare = config.headShape === 'square';
  const hx = isSquare ? 4 : 5;
  const hw = isSquare ? 24 : 22;

  fill(hx, 4, hw, 16, skin);

  // Kinn-Schatten
  fill(hx, 19, hw, 1, darken(skin, 15));

  // Wangen-Highlight
  fill(hx + 1, 12, 3, 2, 'rgba(255,220,180,0.6)');
  fill(hx + hw - 4, 12, 3, 2, 'rgba(255,220,180,0.6)');

  /* ── Augen ───────────────────────────────────────────────────────────── */
  const eyeL = hx + 4;
  const eyeR = hx + hw - 8;
  const eyeY = 11;

  if (config.eyeStyle === 'big') {
    fill(eyeL, eyeY,     4, 4, '#fff');
    fill(eyeL + 1, eyeY + 1, 2, 2, eye);
    fill(eyeR, eyeY,     4, 4, '#fff');
    fill(eyeR + 1, eyeY + 1, 2, 2, eye);
  } else if (config.eyeStyle === 'line') {
    fill(eyeL, eyeY + 1, 4, 1, eye);
    fill(eyeR, eyeY + 1, 4, 1, eye);
  } else {
    // dot (Standard)
    fill(eyeL + 1, eyeY, 2, 2, eye);
    fill(eyeR + 1, eyeY, 2, 2, eye);
  }

  /* ── Haare ───────────────────────────────────────────────────────────── */
  if (config.hairStyle !== 'none') {
    if (config.hairStyle === 'long') {
      // Oben
      fill(hx, 4, hw, 4, hair);
      // Seiten lang
      fill(hx, 8, 3, 12, hair);
      fill(hx + hw - 3, 8, 3, 12, hair);
    } else if (config.hairStyle === 'mohawk') {
      fill(hx + 7, 1, hw - 14, 5, hair);
    } else {
      // short (Standard)
      fill(hx, 4, hw, 4, hair);
      fill(hx, 8, 3,  6, hair);
      fill(hx + hw - 3, 8, 3, 6, hair);
    }
  }

  /* ── Hut ─────────────────────────────────────────────────────────────── */
  if (config.hatStyle === 'cap') {
    fill(hx - 1, 4, hw + 2, 3, hat);
    fill(hx + 2, 1, hw - 4, 4, hat);
    fill(hx - 2, 6, 4, 2, hat); // Schirm
  } else if (config.hatStyle === 'beanie') {
    fill(hx, 2, hw, 5, hat);
    fill(hx + 2, 0, hw - 4, 3, hat);
  } else if (config.hatStyle === 'crown') {
    fill(hx + 2, 4, hw - 4, 3, hat);
    // Zacken
    fill(hx + 4,  2, 3, 3, hat);
    fill(hx + 10, 1, 3, 4, hat);
    fill(hx + 16, 2, 3, 3, hat);
  }

  return canvas;
}

/**
 * Gibt eine Data-URL des gerenderten Avatars zurück.
 */
export function renderAvatarDataUrl(config: AvatarAppearanceConfig, scale = 2): string {
  return renderAvatarCanvas(config, scale).toDataURL('image/png');
}

/**
 * Gibt nur den Kopf-Bereich als Data-URL zurück (für Footer-Bar etc.).
 * Schneidet den Canvas so zu, dass nur Kopf + Hals sichtbar ist.
 */
export function renderAvatarHeadDataUrl(config: AvatarAppearanceConfig, scale = 2): string {
  const full = renderAvatarCanvas(config, scale);
  const headH = 22 * scale; // Kopf geht bis y=22
  const out = document.createElement('canvas');
  out.width = full.width;
  out.height = headH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(full, 0, 0);
  return out.toDataURL('image/png');
}
