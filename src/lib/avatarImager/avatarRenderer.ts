import AvatarImager from './AvatarImager';
import AvatarInfo, { Direction } from './AvatarInfo';

const AVATAR_RESOURCES_URL = 'https://images.bobba.io/gordon/PRODUCTION-202006192205-424220153/';
export const DEFAULT_HABBO_FIGURE = 'hd-180-1.hr-828-61.ch-210-66.lg-270-82.sh-290-80';

const avatarImager = new AvatarImager(AVATAR_RESOURCES_URL);
let initPromise: Promise<void> | null = null;
const avatarCanvasCache = new Map<string, HTMLCanvasElement>();
const avatarPendingCache = new Map<string, Promise<void>>();

function ensureAvatarImagerReady(): Promise<void> {
  if (avatarImager.ready) return Promise.resolve();
  if (!initPromise) {
    initPromise = avatarImager.initialize().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export type AvatarEditorPartOption = {
  id: string;
  gender: 'M' | 'F' | 'U';
  club: number;
  selectable: boolean;
};

export type AvatarEditorPaletteOption = {
  id: string;
  color: string;
  club: number;
};

function toRecordEntries(raw: any): Array<[string, any]> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item: any, idx: number) => [String(item?.id ?? idx), item] as [string, any]);
  }
  return Object.entries(raw) as Array<[string, any]>;
}

function parseSelectable(value: any): boolean {
  if (value === false) return false;
  if (value === 0 || value === '0') return false;
  if (String(value).toLowerCase?.() === 'false') return false;
  return true;
}

function getFigureDataSetType(partType: string): any {
  return avatarImager?.figuredata?.settype?.[partType] || null;
}

export async function getAvatarEditorPartOptions(partType: string): Promise<AvatarEditorPartOption[]> {
  await ensureAvatarImagerReady();
  const setType = getFigureDataSetType(partType);
  const sets = setType?.set || {};
  return toRecordEntries(sets)
    .map(([id, value]: [string, any]) => ({
      id: String(id),
      gender: (value?.gender || 'U') as 'M' | 'F' | 'U',
      club: Number(value?.club || 0),
      selectable: parseSelectable(value?.selectable),
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export async function getAvatarEditorPaletteOptions(partType: string): Promise<AvatarEditorPaletteOption[]> {
  await ensureAvatarImagerReady();
  const setType = getFigureDataSetType(partType);
  const paletteId = String(setType?.paletteid || '');
  const palette = (avatarImager?.figuredata?.palette?.[paletteId] || {}) as Record<string, any>;
  return toRecordEntries(palette)
    .map(([id, value]: [string, any]) => ({
      id: String(id),
      color: String(value?.color || 'ffffff').replace('#', ''),
      club: Number(value?.club || 0),
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export async function getAvatarEditorPaletteCount(partType: string, partId: string): Promise<number> {
  await ensureAvatarImagerReady();
  const setType = getFigureDataSetType(partType);
  const set = setType?.set?.[String(partId)];
  const parts = Array.isArray(set?.part) ? set.part : [];
  const maxColorIndex = parts.reduce((max: number, p: any) => {
    if (!p?.colorable) return max;
    const ci = Number(p?.colorindex || 1);
    return Number.isFinite(ci) ? Math.max(max, ci) : max;
  }, 1);
  return Math.max(1, maxColorIndex);
}

export function requestAvatarCanvas(
  figureRaw: string | undefined,
  habboDirection: Direction,
  action: 'wlk' | 'std' | 'wav',
  frame: number
): HTMLCanvasElement | null {
  const figure = String(figureRaw || '').trim() || DEFAULT_HABBO_FIGURE;
  const normalizedFrame = Math.max(0, frame % 8);
  const key = `${figure}|${habboDirection}|${action}|${normalizedFrame}`;

  const cached = avatarCanvasCache.get(key);
  if (cached) return cached;
  if (avatarPendingCache.has(key)) return null;

  const pending = ensureAvatarImagerReady()
    .then(() => {
      const info = new AvatarInfo(figure, habboDirection, habboDirection, [action], 'std', normalizedFrame, false, false, 'n');
      return avatarImager.generateGeneric(info, false).then((canvas) => {
        avatarCanvasCache.set(key, canvas);
      });
    })
    .catch(() => {
      // gewuenscht: kein Fallback zeichnen
    })
    .finally(() => {
      avatarPendingCache.delete(key);
    });

  avatarPendingCache.set(key, pending);
  return null;
}
