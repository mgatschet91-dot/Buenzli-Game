/**
 * Trade Partner Edge Preview Renderer
 * 
 * Zeichnet eine halbtransparente Vorschau der Handelspartner-Städte
 * am jeweiligen Kartenrand. Rein clientseitig, KEINE Server-Calls.
 * 
 * Features:
 * - Dezenter Nebel/Fog am Kartenrand mit Fade-Out
 * - Vage prozedurale Gebäude-Umrisse (deterministisch per Stadtname)
 * - Straßen-Fortsetzung für verbundene Partner
 * - Floating City-Name Label mit Richtungsanzeige
 */

import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { gridToScreen } from './utils';
import type { Tile } from '@/types/game';

// Konfiguration
const PREVIEW_DEPTH = 6;         // Wie viele Tiles tief die Vorschau reicht
const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

// Richtungs-Pfeile für Labels
const DIRECTION_ARROWS: Record<string, string> = {
  north: '↑',
  south: '↓',
  east: '→',
  west: '←',
};

// Richtungs-Label
const DIRECTION_NAMES: Record<string, string> = {
  north: 'Norden',
  south: 'Süden',
  east: 'Osten',
  west: 'Westen',
};

export interface TradePartnerPreviewData {
  direction: 'north' | 'south' | 'east' | 'west';
  name: string;
  connected: boolean;
  discovered: boolean;
  slug?: string;
}

// ==========================================
// HELPER FUNKTIONEN (rein clientseitig)
// ==========================================

/** Deterministischer Hash für konsistente Platzierung */
function positionHash(x: number, y: number): number {
  return (((x * 7919 + y * 6271 + x * y * 13) & 0x7fffffff) % 1000) / 1000;
}

/** Seed-Wert aus dem Stadtnamen */
function getNameSeed(name: string): number {
  let seed = 0;
  for (let i = 0; i < name.length; i++) {
    seed = ((seed << 5) - seed + name.charCodeAt(i)) | 0;
  }
  return Math.abs(seed);
}

/** Prüft ob ein Tile am Kartenrand eine Straße hat */
function hasRoadAtPosition(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type === 'road' || type === 'bridge';
}

/** Sammelt Straßen-Positionen am Kartenrand */
function getRoadPositionsAtEdge(
  grid: Tile[][],
  gridSize: number,
  direction: 'north' | 'south' | 'east' | 'west'
): Set<number> {
  const roadPositions = new Set<number>();
  switch (direction) {
    case 'north':
      for (let x = 0; x < gridSize; x++) if (hasRoadAtPosition(grid, gridSize, x, 0)) roadPositions.add(x);
      break;
    case 'south':
      for (let x = 0; x < gridSize; x++) if (hasRoadAtPosition(grid, gridSize, x, gridSize - 1)) roadPositions.add(x);
      break;
    case 'east':
      for (let y = 0; y < gridSize; y++) if (hasRoadAtPosition(grid, gridSize, gridSize - 1, y)) roadPositions.add(y);
      break;
    case 'west':
      for (let y = 0; y < gridSize; y++) if (hasRoadAtPosition(grid, gridSize, 0, y)) roadPositions.add(y);
      break;
  }
  return roadPositions;
}

/** Berechnet Tile-Koordinaten für Preview-Tiles jenseits des Rands */
function getPreviewTileCoords(
  direction: 'north' | 'south' | 'east' | 'west',
  along: number,
  depth: number,
  gridSize: number
): { x: number; y: number } {
  switch (direction) {
    case 'north': return { x: along, y: -depth };
    case 'south': return { x: along, y: gridSize - 1 + depth };
    case 'east':  return { x: gridSize - 1 + depth, y: along };
    case 'west':  return { x: -depth, y: along };
  }
}

// ==========================================
// TILE-ZEICHENFUNKTIONEN
// ==========================================

/** Isometrisches Gras-Tile */
function drawGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(screenX + HALF_W, screenY);
  ctx.lineTo(screenX + TILE_WIDTH, screenY + HALF_H);
  ctx.lineTo(screenX + HALF_W, screenY + TILE_HEIGHT);
  ctx.lineTo(screenX, screenY + HALF_H);
  ctx.closePath();
  ctx.fill();
}

/** Straßen-Tile (Fortsetzung vom Spielerrand) */
function drawRoadTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
) {
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(screenX + HALF_W, screenY);
  ctx.lineTo(screenX + TILE_WIDTH, screenY + HALF_H);
  ctx.lineTo(screenX + HALF_W, screenY + TILE_HEIGHT);
  ctx.lineTo(screenX, screenY + HALF_H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(screenX + HALF_W, screenY + 2);
  ctx.lineTo(screenX + HALF_W, screenY + TILE_HEIGHT - 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Zeichnet eine vage Gebäude-Silhouette (nur Umriss, kein Detail)
 * Sieht aus wie eine neblige Skyline am Horizont
 */
function drawBuildingSilhouette(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  tileX: number,
  tileY: number,
  nameSeed: number,
  alpha: number,
  connected: boolean,
) {
  // Gebäudehöhe aus Seed berechnen (deterministisch)
  const hash = (((tileX * 3571 + tileY * 8923 + nameSeed * 1237) & 0x7fffffff) % 1000) / 1000;
  const buildingH = 5 + hash * 18;
  const buildingW = HALF_W * (0.4 + hash * 0.25);
  const bx = screenX + HALF_W - buildingW / 2;
  const by = screenY + HALF_H - buildingH;

  // Nur Umriss - kein gefüllter Körper
  const outlineColor = connected
    ? `rgba(140, 170, 200, ${(alpha * 0.6).toFixed(3)})`
    : `rgba(100, 130, 160, ${(alpha * 0.4).toFixed(3)})`;

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 0.8;

  // Gebäude-Umriss
  ctx.beginPath();
  ctx.rect(bx, by, buildingW, buildingH);
  ctx.stroke();

  // Dach-Linie (flach)
  ctx.beginPath();
  ctx.moveTo(bx - 1, by);
  ctx.lineTo(bx + buildingW + 1, by);
  ctx.stroke();
}

// ==========================================
// CITY-NAME LABEL
// ==========================================

function drawPartnerLabel(
  ctx: CanvasRenderingContext2D,
  partner: TradePartnerPreviewData,
  gridSize: number,
  zoom: number,
  viewBounds: { left: number; top: number; right: number; bottom: number },
) {
  const labelDepth = Math.ceil(PREVIEW_DEPTH * 0.55);
  let labelTileX: number, labelTileY: number;

  switch (partner.direction) {
    case 'north':
      labelTileX = Math.floor(gridSize / 2);
      labelTileY = -labelDepth;
      break;
    case 'south':
      labelTileX = Math.floor(gridSize / 2);
      labelTileY = gridSize - 1 + labelDepth;
      break;
    case 'east':
      labelTileX = gridSize - 1 + labelDepth;
      labelTileY = Math.floor(gridSize / 2);
      break;
    case 'west':
      labelTileX = -labelDepth;
      labelTileY = Math.floor(gridSize / 2);
      break;
  }

  const { screenX, screenY } = gridToScreen(labelTileX, labelTileY, 0, 0);
  const labelX = screenX + HALF_W;
  const labelY = screenY + HALF_H;

  // Viewport-Culling
  if (labelX < viewBounds.left - 200 || labelX > viewBounds.right + 200 ||
    labelY < viewBounds.top - 100 || labelY > viewBounds.bottom + 100) {
    return;
  }

  if (zoom < 0.25) return;

  ctx.save();
  ctx.globalAlpha = partner.connected ? 0.9 : 0.65;

  const baseFontSize = Math.max(10, Math.min(16, 14 / zoom));
  const smallFontSize = Math.max(8, baseFontSize * 0.7);

  // Text messen
  ctx.font = `bold ${baseFontSize}px system-ui, sans-serif`;
  const nameMetrics = ctx.measureText(partner.name);
  ctx.font = `${smallFontSize}px system-ui, sans-serif`;
  const dirLabel = `${DIRECTION_ARROWS[partner.direction]} ${DIRECTION_NAMES[partner.direction]}`;
  const dirMetrics = ctx.measureText(dirLabel);

  const textW = Math.max(nameMetrics.width, dirMetrics.width);
  const paddingX = 10;
  const paddingY = 6;
  const labelW = textW + paddingX * 2;
  const labelH = baseFontSize + smallFontSize + paddingY * 2 + 4;
  const cornerRadius = 6;

  const bgX = labelX - labelW / 2;
  const bgY = labelY - labelH / 2;

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Hintergrund
  const bgColor = partner.connected
    ? 'rgba(16, 42, 28, 0.88)'
    : 'rgba(20, 30, 50, 0.82)';
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(bgX + cornerRadius, bgY);
  ctx.lineTo(bgX + labelW - cornerRadius, bgY);
  ctx.arcTo(bgX + labelW, bgY, bgX + labelW, bgY + cornerRadius, cornerRadius);
  ctx.lineTo(bgX + labelW, bgY + labelH - cornerRadius);
  ctx.arcTo(bgX + labelW, bgY + labelH, bgX + labelW - cornerRadius, bgY + labelH, cornerRadius);
  ctx.lineTo(bgX + cornerRadius, bgY + labelH);
  ctx.arcTo(bgX, bgY + labelH, bgX, bgY + labelH - cornerRadius, cornerRadius);
  ctx.lineTo(bgX, bgY + cornerRadius);
  ctx.arcTo(bgX, bgY, bgX + cornerRadius, bgY, cornerRadius);
  ctx.closePath();
  ctx.fill();

  // Rahmen
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  const borderColor = partner.connected
    ? 'rgba(52, 211, 153, 0.6)'
    : 'rgba(96, 165, 250, 0.4)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Status-Punkt
  const dotRadius = 3;
  const dotX = bgX + 8;
  const dotY = bgY + labelH / 2;
  ctx.fillStyle = partner.connected ? '#34d399' : '#60a5fa';
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  // Stadtname
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${baseFontSize}px system-ui, sans-serif`;
  ctx.fillStyle = partner.connected ? '#d1fae5' : '#dbeafe';
  ctx.fillText(partner.name, labelX, bgY + paddingY);

  // Richtung
  ctx.font = `${smallFontSize}px system-ui, sans-serif`;
  ctx.fillStyle = partner.connected ? '#a7f3d0' : '#bfdbfe';
  ctx.fillText(dirLabel, labelX, bgY + paddingY + baseFontSize + 4);

  ctx.restore();
}

// ==========================================
// HAUPTFUNKTION
// ==========================================

/**
 * Zeichnet die Trade-Partner-Vorschauen an allen Kartenrändern.
 * 
 * Rein clientseitig - keine Server-Calls, kein Bilderladen.
 * Zeigt nur Name + vage Gebäude-Umrisse + Straßen-Fortsetzung.
 */
export function drawTradePartnerPreviews(
  ctx: CanvasRenderingContext2D,
  partners: TradePartnerPreviewData[],
  grid: Tile[][],
  gridSize: number,
  zoom: number,
  viewBounds: { left: number; top: number; right: number; bottom: number },
) {
  // Zeige alle übergebenen Partner (Filter passiert bereits im Aufrufer)
  if (partners.length === 0) return;

  ctx.save();

  for (const partner of partners) {
    const nameSeed = getNameSeed(partner.name);

    // Transparenz - verbundene Partner deutlich sichtbar
    const baseOpacity = partner.connected ? 0.4 : 0.2;

    // Gedämpfte Grasfarben
    const grassDark = partner.connected ? '#2a4f1c' : '#1a3012';
    const grassLight = partner.connected ? '#335a24' : '#223f18';

    // Straßenpositionen am Rand
    const roadPositions = partner.connected
      ? getRoadPositionsAtEdge(grid, gridSize, partner.direction)
      : new Set<number>();

    // Preview-Tiles zeichnen
    for (let along = 0; along < gridSize; along++) {
      for (let depth = 1; depth <= PREVIEW_DEPTH; depth++) {
        const { x: tileX, y: tileY } = getPreviewTileCoords(
          partner.direction, along, depth, gridSize
        );

        const { screenX, screenY } = gridToScreen(tileX, tileY, 0, 0);

        // Viewport-Culling
        if (screenX + TILE_WIDTH < viewBounds.left || screenX > viewBounds.right ||
          screenY + TILE_HEIGHT < viewBounds.top || screenY > viewBounds.bottom) {
          continue;
        }

        // Sanftes Fade-Out mit Tiefe
        const depthRatio = depth / (PREVIEW_DEPTH + 1);
        const fadeFactor = Math.pow(1 - depthRatio, 2.5);
        const alpha = baseOpacity * fadeFactor;

        if (alpha < 0.005) continue;
        ctx.globalAlpha = alpha;

        // Straßen-Fortsetzung
        const isRoadContinuation = roadPositions.has(along) && depth <= 3;

        if (isRoadContinuation) {
          drawRoadTile(ctx, screenX, screenY);
        } else {
          // Gras-Tile (Schachbrett)
          const grassColor = (tileX + tileY) % 2 === 0 ? grassDark : grassLight;
          drawGrassTile(ctx, screenX, screenY, grassColor);
        }

        // Vage Gebäude-Umrisse (nur nah am Rand, nicht auf Straßen)
        if (!isRoadContinuation && depth <= PREVIEW_DEPTH - 2) {
          const hash = positionHash(tileX + nameSeed, tileY);
          if (hash > 0.72) {
            drawBuildingSilhouette(
              ctx, screenX, screenY,
              tileX, tileY, nameSeed,
              alpha, partner.connected
            );
          }
        }
      }
    }

    // Label wird jetzt im CanvasIsometricGrid gezeichnet (einzelner Wegweiser)
  }

  ctx.restore();
}
