/**
 * ChunkManager — Lädt nur sichtbare Map-Chunks vom Server
 *
 * Teilt die Map in 20×20-Tile-Chunks auf und lädt nur die Chunks,
 * die sich aktuell im Viewport befinden. Neue Chunks werden automatisch
 * geladen wenn der Spieler die Karte bewegt.
 */

import type { GameItemFromApi } from './buildStateFromItems';

export const CHUNK_SIZE = 20;

export interface ChunkCoord { cx: number; cy: number; }

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function tileToChunk(tileX: number, tileY: number): ChunkCoord {
  return {
    cx: Math.floor(tileX / CHUNK_SIZE),
    cy: Math.floor(tileY / CHUNK_SIZE),
  };
}

// Isometrische Tile-Konstanten (müssen mit CanvasIsometricGrid übereinstimmen)
const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = ISO_TILE_WIDTH * 0.60; // 38.4

export interface ViewportState {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
}

export interface ChunkDebugInfo {
  loadedChunks: Set<string>;
  loadingChunks: Set<string>;
  numChunks: number;
  chunkSize: number;
  gridSize: number;
  lastViewport: ViewportState | undefined;
  /** Geschätzter Viewport-Bereich in Tiles (Breite × Höhe im Tile-Space) */
  viewportTilesEstimate: number;
}

export interface ChunkManagerOptions {
  gridSize: number;
  chunkSize?: number;
  /** Wird aufgerufen wenn ein Chunk erfolgreich geladen wurde */
  onChunkLoaded: (items: GameItemFromApi[], cx: number, cy: number) => void;
  /** Fetcht die Items für einen Chunk vom Server */
  fetchChunk: (cx: number, cy: number) => Promise<GameItemFromApi[]>;
}

export class ChunkManager {
  private readonly gridSize: number;
  private readonly chunkSize: number;
  private readonly onChunkLoaded: ChunkManagerOptions['onChunkLoaded'];
  private readonly fetchChunk: ChunkManagerOptions['fetchChunk'];

  private loadedChunks = new Set<string>();
  private loadingChunks = new Set<string>();
  private lastViewport: ViewportState | undefined;

  constructor(opts: ChunkManagerOptions) {
    this.gridSize = opts.gridSize;
    this.chunkSize = opts.chunkSize ?? CHUNK_SIZE;
    this.onChunkLoaded = opts.onChunkLoaded;
    this.fetchChunk = opts.fetchChunk;
  }

  /**
   * Muss bei jeder Viewport-Änderung (Pan, Zoom, Resize) aufgerufen werden.
   * Berechnet sichtbare Chunks und lädt fehlende.
   */
  onViewportChange(viewport: ViewportState): void {
    this.lastViewport = viewport;
    const visible = this.calcVisibleChunks(viewport);
    for (const { cx, cy } of visible) {
      const key = chunkKey(cx, cy);
      if (!this.loadedChunks.has(key) && !this.loadingChunks.has(key)) {
        void this.loadChunk(cx, cy);
      }
    }
  }

  /** Debug-Info: Snapshot des aktuellen Zustands */
  getDebugInfo(): ChunkDebugInfo {
    const numChunks = Math.ceil(this.gridSize / this.chunkSize);
    let viewportTilesEstimate = 0;
    if (this.lastViewport) {
      const { offset, zoom, canvasSize } = this.lastViewport;
      const TW = ISO_TILE_WIDTH;
      const TH = ISO_TILE_HEIGHT;
      const halfTW = TW / 2;
      const halfTH = TH / 2;
      const corners = [
        { sx: 0, sy: 0 }, { sx: canvasSize.width, sy: 0 },
        { sx: 0, sy: canvasSize.height }, { sx: canvasSize.width, sy: canvasSize.height },
      ].map(({ sx, sy }) => {
        const wx = sx / zoom - offset.x / zoom;
        const wy = sy / zoom - offset.y / zoom;
        return {
          gx: (wx / halfTW + wy / halfTH) / 2,
          gy: (wy / halfTH - wx / halfTW) / 2,
        };
      });
      const rangeX = Math.max(...corners.map(c => c.gx)) - Math.min(...corners.map(c => c.gx));
      const rangeY = Math.max(...corners.map(c => c.gy)) - Math.min(...corners.map(c => c.gy));
      // Isometrisches Diamond: sichtbare Fläche ≈ halbe Bounding-Box, capped auf Grid-Total
      const gridTotal = this.gridSize * this.gridSize;
      viewportTilesEstimate = Math.min(gridTotal, Math.round((rangeX * rangeY) / 2));
    }
    return {
      loadedChunks: new Set(this.loadedChunks),
      loadingChunks: new Set(this.loadingChunks),
      numChunks,
      chunkSize: this.chunkSize,
      gridSize: this.gridSize,
      lastViewport: this.lastViewport,
      viewportTilesEstimate,
    };
  }

  /** Reset + sofort sichtbare Chunks neu laden (nutzt letzten bekannten Viewport) */
  forceReload(): void {
    this.resetAll();
    if (this.lastViewport) {
      this.onViewportChange(this.lastViewport);
    }
  }

  isChunkLoaded(cx: number, cy: number): boolean {
    return this.loadedChunks.has(chunkKey(cx, cy));
  }

  /** Markiert alle Chunks als ungeladen (z.B. nach Server-Reconnect) */
  resetAll(): void {
    this.loadedChunks.clear();
    this.loadingChunks.clear();
  }

  /** Markiert einen einzelnen Chunk als bereits geladen (z.B. initialer Full-Load) */
  markAllLoaded(): void {
    const numChunks = Math.ceil(this.gridSize / this.chunkSize);
    for (let cy = 0; cy < numChunks; cy++) {
      for (let cx = 0; cx < numChunks; cx++) {
        this.loadedChunks.add(chunkKey(cx, cy));
      }
    }
  }

  private async loadChunk(cx: number, cy: number): Promise<void> {
    const key = chunkKey(cx, cy);
    this.loadingChunks.add(key);
    try {
      const items = await this.fetchChunk(cx, cy);
      this.loadedChunks.add(key);
      this.loadingChunks.delete(key);
      this.onChunkLoaded(items, cx, cy);
    } catch {
      // Bei Fehler: beim nächsten Viewport-Change erneut versuchen
      this.loadingChunks.delete(key);
    }
  }

  /**
   * Berechnet welche Chunks sich im aktuellen Viewport befinden.
   *
   * Zwei-Stufen-Culling:
   * 1. Grobe Tile-BBox der 4 Canvas-Ecken → kandidaten Chunk-Range
   * 2. Für jeden Kandidaten: Screen-AABB des Chunks gegen den Viewport prüfen
   *    → eliminiert Eck-Chunks die im isometrischen Diamanten nicht sichtbar sind
   *
   * Isometrische Vorwärts-Projektion (Chunk-Ecken → Screen):
   *   screenX = (tx - ty) * halfTW * zoom + offset.x
   *   screenY = (tx + ty) * halfTH * zoom + offset.y
   *
   * AABB eines Chunks (tx1..tx2, ty1..ty2):
   *   minScreenX = (tx1 - ty2) * halfTW * zoom + offset.x   (links:  kleinstes tx, größtes ty)
   *   maxScreenX = (tx2 - ty1) * halfTW * zoom + offset.x   (rechts: größtes tx, kleinstes ty)
   *   minScreenY = (tx1 + ty1) * halfTH * zoom + offset.y   (oben:   beide min)
   *   maxScreenY = (tx2 + ty2) * halfTH * zoom + offset.y   (unten:  beide max)
   */
  private calcVisibleChunks(viewport: ViewportState): ChunkCoord[] {
    const { offset, zoom, canvasSize } = viewport;
    const TW = ISO_TILE_WIDTH;
    const TH = ISO_TILE_HEIGHT;
    const halfTW = TW / 2;
    const halfTH = TH / 2;

    // Stufe 1: grobe Tile-BBox aus den 4 Canvas-Ecken (wie vorher)
    const corners = [
      { sx: 0, sy: 0 },
      { sx: canvasSize.width, sy: 0 },
      { sx: 0, sy: canvasSize.height },
      { sx: canvasSize.width, sy: canvasSize.height },
    ].map(({ sx, sy }) => {
      const wx = sx / zoom - offset.x / zoom;
      const wy = sy / zoom - offset.y / zoom;
      return {
        gx: (wx / halfTW + wy / halfTH) / 2,
        gy: (wy / halfTH - wx / halfTW) / 2,
      };
    });

    const minGX = Math.min(...corners.map(c => c.gx));
    const maxGX = Math.max(...corners.map(c => c.gx));
    const minGY = Math.min(...corners.map(c => c.gy));
    const maxGY = Math.max(...corners.map(c => c.gy));

    const numChunks = Math.ceil(this.gridSize / this.chunkSize);
    const minCX = Math.max(0, Math.floor(minGX / this.chunkSize) - 1);
    const maxCX = Math.min(numChunks - 1, Math.ceil(maxGX / this.chunkSize));
    const minCY = Math.max(0, Math.floor(minGY / this.chunkSize) - 1);
    const maxCY = Math.min(numChunks - 1, Math.ceil(maxGY / this.chunkSize));

    // Puffer in Screen-Pixeln für smooth panning (1 Tile breit)
    const panBuffer = halfTW * zoom;

    const result: ChunkCoord[] = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        // Stufe 2: exakte Screen-AABB des Chunks gegen Viewport
        const tx1 = cx * this.chunkSize;
        const tx2 = (cx + 1) * this.chunkSize;
        const ty1 = cy * this.chunkSize;
        const ty2 = (cy + 1) * this.chunkSize;

        const chunkMinX = (tx1 - ty2) * halfTW * zoom + offset.x;
        const chunkMaxX = (tx2 - ty1) * halfTW * zoom + offset.x;
        const chunkMinY = (tx1 + ty1) * halfTH * zoom + offset.y;
        const chunkMaxY = (tx2 + ty2) * halfTH * zoom + offset.y;

        if (
          chunkMaxX + panBuffer < 0 ||
          chunkMinX - panBuffer > canvasSize.width ||
          chunkMaxY + panBuffer < 0 ||
          chunkMinY - panBuffer > canvasSize.height
        ) {
          continue; // Chunk liegt ausserhalb des Viewports
        }

        result.push({ cx, cy });
      }
    }
    return result;
  }
}
