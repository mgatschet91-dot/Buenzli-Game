export type AvatarHeadShape = 'round' | 'square';
export type AvatarEyeStyle = 'dot' | 'line' | 'big';
export type AvatarHatStyle = 'none' | 'cap' | 'beanie' | 'crown';
export type AvatarHairStyle = 'none' | 'short' | 'long' | 'mohawk';

export interface AvatarAppearanceConfig {
  headShape: AvatarHeadShape;
  eyeStyle: AvatarEyeStyle;
  hatStyle: AvatarHatStyle;
  hairStyle: AvatarHairStyle;
  figure: string;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hatColor: string;
  hairColor: string;
  eyeColor: string;
  motto?: string;
}

export const AVATAR_CONFIG_STORAGE_KEY = 'isocity_avatar_config';

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearanceConfig = {
  headShape: 'round',
  eyeStyle: 'dot',
  hatStyle: 'none',
  hairStyle: 'short',
  figure: 'hd-180-1.hr-828-61.ch-210-66.lg-270-82.sh-290-80',
  skinColor: '#f0c8a0',
  shirtColor: '#7c3aed',
  pantsColor: '#312e81',
  hatColor: '#7c3aed',
  hairColor: '#2d1b12',
  eyeColor: '#1f2937',
};

function normalizeAvatarFigure(value: unknown, fallback: string): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  // Habbo-Figure-Pattern: hd-180-1.hr-828-61...
  if (!/^[a-z]{2,3}-[0-9]+(?:-[0-9]+)*(?:\.[a-z]{2,3}-[0-9]+(?:-[0-9]+)*)*$/i.test(raw)) {
    return fallback;
  }
  return raw;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
}

export function normalizeAvatarAppearanceConfig(raw: unknown): AvatarAppearanceConfig {
  const src = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const headShape = src.headShape === 'square' ? 'square' : 'round';
  const eyeStyle = src.eyeStyle === 'line' || src.eyeStyle === 'big' ? src.eyeStyle : 'dot';
  const hatStyle =
    src.hatStyle === 'cap' || src.hatStyle === 'beanie' || src.hatStyle === 'crown'
      ? src.hatStyle
      : 'none';
  const hairStyle =
    src.hairStyle === 'none' || src.hairStyle === 'long' || src.hairStyle === 'mohawk'
      ? src.hairStyle
      : 'short';

  const motto = typeof src.motto === 'string' ? src.motto.slice(0, 100) : undefined;

  return {
    headShape,
    eyeStyle,
    hatStyle,
    hairStyle,
    figure: normalizeAvatarFigure(src.figure, DEFAULT_AVATAR_APPEARANCE.figure),
    skinColor: normalizeHexColor(src.skinColor, DEFAULT_AVATAR_APPEARANCE.skinColor),
    shirtColor: normalizeHexColor(src.shirtColor, DEFAULT_AVATAR_APPEARANCE.shirtColor),
    pantsColor: normalizeHexColor(src.pantsColor, DEFAULT_AVATAR_APPEARANCE.pantsColor),
    hatColor: normalizeHexColor(src.hatColor, DEFAULT_AVATAR_APPEARANCE.hatColor),
    hairColor: normalizeHexColor(src.hairColor, DEFAULT_AVATAR_APPEARANCE.hairColor),
    eyeColor: normalizeHexColor(src.eyeColor, DEFAULT_AVATAR_APPEARANCE.eyeColor),
    ...(motto !== undefined ? { motto } : {}),
  };
}

export function loadAvatarAppearanceFromStorage(): AvatarAppearanceConfig {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_APPEARANCE;
  try {
    const raw = localStorage.getItem(AVATAR_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AVATAR_APPEARANCE;
    return normalizeAvatarAppearanceConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_AVATAR_APPEARANCE;
  }
}

export function saveAvatarAppearanceToStorage(config: AvatarAppearanceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AVATAR_CONFIG_STORAGE_KEY, JSON.stringify(normalizeAvatarAppearanceConfig(config)));
  } catch {
    // ignore storage errors
  }
}
