'use client';

import {
  Application, TilingSprite, Texture, DisplacementFilter,
  Sprite, Graphics, Container,
} from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

function createDisplacementMap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const vx = 128 +
        25 * Math.sin(x * 0.03 + y * 0.015) +
        12 * Math.sin(x * 0.065 - y * 0.045) +
        6 * Math.sin(x * 0.13 + y * 0.08);
      const vy = 128 +
        22 * Math.cos(x * 0.025 - y * 0.035) +
        10 * Math.cos(x * 0.06 + y * 0.04) +
        5 * Math.cos(x * 0.12 - y * 0.09);
      imageData.data[i] = Math.max(0, Math.min(255, vx));
      imageData.data[i + 1] = Math.max(0, Math.min(255, vy));
      imageData.data[i + 2] = 128;
      imageData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export interface WaterTileInfo {
  screenX: number;
  screenY: number;
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean };
  adjacentCount: number;
}

const BEACH_FILL = 0xd4a574;
const BEACH_CURB = 0xb8956a;
const BEACH_CURB_WIDTH = 1;
const BEACH_WIDTH_RATIO = 0.04 * 2.5;
const BEACH_CORNER_FACTOR = 1.2;

const INWARD: Record<string, { dx: number; dy: number }> = {
  north: { dx: 0.707, dy: 0.707 },
  east:  { dx: -0.707, dy: 0.707 },
  south: { dx: -0.707, dy: -0.707 },
  west:  { dx: 0.707, dy: -0.707 },
};

export class PixiWaterLayer {
  private app: Application | null = null;
  private waterContainer: Container | null = null;
  private tilingSprite: TilingSprite | null = null;
  private waterMask: Graphics | null = null;
  private shoreGraphics: Graphics | null = null;
  private gridGraphics: Graphics | null = null;
  private beachGraphics: Graphics | null = null;
  private depthGraphics: Graphics | null = null;
  private displacementSprite: Sprite | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  get initialized(): boolean { return this._initialized; }
  get canvas(): HTMLCanvasElement | null { return this._canvas; }

  async init(width: number, height: number, waterImageSrc: string): Promise<void> {
    if (this._initialized || this._destroyed) return;

    try {
      this.app = new Application();
      await this.app.init({
        width, height,
        backgroundAlpha: 0,
        preference: 'webgl',
        antialias: false,
        resolution: 1,
      });

      if (this._destroyed) { this.app?.destroy(); this.app = null; return; }

      this._canvas = this.app.canvas as HTMLCanvasElement;
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.left = '0';
      this._canvas.style.pointerEvents = 'none';

      this.waterContainer = new Container();
      this.app.stage.addChild(this.waterContainer);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = waterImageSrc;
      });

      if (this._destroyed) { this.app?.destroy(); this.app = null; return; }

      const texture = Texture.from(img);

      this.tilingSprite = new TilingSprite({ texture, width: 20000, height: 20000 });
      this.tilingSprite.position.set(-5000, -5000);
      this.waterContainer.addChild(this.tilingSprite);

      this.waterMask = new Graphics();
      this.waterContainer.addChild(this.waterMask);
      this.tilingSprite.mask = this.waterMask;

      this.depthGraphics = new Graphics();
      this.waterContainer.addChild(this.depthGraphics);

      this.shoreGraphics = new Graphics();
      this.waterContainer.addChild(this.shoreGraphics);

      this.gridGraphics = new Graphics();
      this.waterContainer.addChild(this.gridGraphics);

      this.beachGraphics = new Graphics();
      this.waterContainer.addChild(this.beachGraphics);

      // Displacement filter for wave distortion
      // Filter wird erst nach dem ersten Render aktiviert (Textur muss erst auf GPU hochgeladen sein)
      const dispCanvas = createDisplacementMap(256, 256);
      const dispTexture = Texture.from(dispCanvas);
      this.displacementSprite = new Sprite(dispTexture);
      this.displacementSprite.renderable = false;
      this.app.stage.addChild(this.displacementSprite);

      const filter = new DisplacementFilter({
        sprite: this.displacementSprite,
        scale: { x: 6, y: 4 },
      });

      // Filter erst nach dem ersten Frame setzen — verhindert null-ids race condition
      let filterApplied = false;
      this.app.ticker.addOnce(() => {
        if (this.tilingSprite && !this._destroyed) {
          try {
            if (this.displacementSprite?.texture?.source) {
              this.displacementSprite.texture.source.style.addressMode = 'repeat';
            }
            this.tilingSprite.filters = [filter];
            filterApplied = true;
          } catch {
            // Filter konnte nicht angewendet werden – Wasser bleibt ohne Welleffekt
          }
        }
      });
      void filterApplied; // suppress unused warning

      // Natural wave animation: oscillating motion instead of constant drift
      this.app.ticker.add(() => {
        const t = performance.now() / 1000;

        if (this.tilingSprite) {
          this.tilingSprite.tilePosition.x =
            Math.sin(t * 0.4) * 10 +
            Math.sin(t * 0.7) * 5 +
            Math.cos(t * 0.25) * 3;
          this.tilingSprite.tilePosition.y =
            Math.cos(t * 0.35) * 8 +
            Math.sin(t * 0.55) * 4 +
            Math.cos(t * 0.18) * 2;
        }

        if (this.displacementSprite) {
          this.displacementSprite.x =
            Math.sin(t * 0.3) * 40 +
            Math.cos(t * 0.5) * 20;
          this.displacementSprite.y =
            Math.cos(t * 0.25) * 30 +
            Math.sin(t * 0.45) * 15;
        }
      });

      this._initialized = true;
    } catch (err) {
      console.error('[PixiWaterLayer] init failed:', err);
    }
  }

  updateTransform(dpr: number, zoom: number, offsetX: number, offsetY: number): void {
    if (!this.app) return;
    this.app.stage.scale.set(dpr * zoom);
    this.app.stage.position.set(offsetX * dpr, offsetY * dpr);
  }

  render(): void {
    if (!this.app || !this._initialized || this._destroyed) return;
    try {
      this.app.render();
    } catch {
      // Transiente PixiJS-Rendering-Fehler ignorieren (z.B. Textur noch nicht auf GPU)
    }
  }

  private _pendingResize: { w: number; h: number; cw: number; ch: number } | null = null;

  resize(width: number, height: number, cssWidth: number, cssHeight: number): void {
    if (!this.app || !this._canvas || !this._initialized) {
      this._pendingResize = { w: width, h: height, cw: cssWidth, ch: cssHeight };
      return;
    }
    this._pendingResize = null;
    this.app.renderer.resize(width, height);
    this._canvas.style.width = `${cssWidth}px`;
    this._canvas.style.height = `${cssHeight}px`;
  }

  applyPendingResize(): void {
    if (this._pendingResize && this._initialized) {
      const { w, h, cw, ch } = this._pendingResize;
      this.resize(w, h, cw, ch);
    }
  }

  updateWaterTiles(tiles: WaterTileInfo[], zoom: number): void {
    if (this._destroyed || !this.waterMask || !this.beachGraphics || !this.depthGraphics || !this.gridGraphics || !this.shoreGraphics) return;

    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    const hw = w / 2;
    const hh = h / 2;

    // --- Water mask (diamond per tile) ---
    this.waterMask.clear();
    for (let i = 0; i < tiles.length; i++) {
      const { screenX: x, screenY: y } = tiles[i];
      this.waterMask.moveTo(x + hw, y);
      this.waterMask.lineTo(x + w, y + hh);
      this.waterMask.lineTo(x + hw, y + h);
      this.waterMask.lineTo(x, y + hh);
      this.waterMask.closePath();
    }
    this.waterMask.fill({ color: 0xffffff });

    // --- Depth overlay: deep center darker ---
    this.depthGraphics.clear();
    for (let i = 0; i < tiles.length; i++) {
      const { screenX: x, screenY: y, adjacentCount } = tiles[i];
      if (adjacentCount >= 3) {
        this.depthGraphics.moveTo(x + hw, y);
        this.depthGraphics.lineTo(x + w, y + hh);
        this.depthGraphics.lineTo(x + hw, y + h);
        this.depthGraphics.lineTo(x, y + hh);
        this.depthGraphics.closePath();
        this.depthGraphics.fill({ color: 0x001020, alpha: adjacentCount === 4 ? 0.2 : 0.12 });
      }
    }

    // --- Shore gradient: light turquoise strips along land edges ---
    this.shoreGraphics.clear();
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const { adjacentLand } = tile;
      if (!adjacentLand.north && !adjacentLand.east && !adjacentLand.south && !adjacentLand.west) continue;
      this.drawShoreGradient(tile);
    }

    // --- Grid lines ---
    this.gridGraphics.clear();
    if (zoom >= 0.3) {
      const gridAlpha = Math.min(0.25, (zoom - 0.3) * 0.6);
      for (let i = 0; i < tiles.length; i++) {
        const { screenX: x, screenY: y } = tiles[i];
        this.gridGraphics.moveTo(x + hw, y);
        this.gridGraphics.lineTo(x + w, y + hh);
        this.gridGraphics.lineTo(x + hw, y + h);
        this.gridGraphics.lineTo(x, y + hh);
        this.gridGraphics.closePath();
      }
      this.gridGraphics.stroke({ color: 0x70b8cc, width: 0.6, alpha: gridAlpha });
    }

    // --- Beach edges ---
    this.beachGraphics.clear();
    if (zoom >= 0.4) {
      for (let i = 0; i < tiles.length; i++) {
        this.drawBeach(tiles[i]);
      }
    }
  }

  // ─── Shore gradient: layered turquoise strips simulating shallow water ─

  private drawShoreGradient(tile: WaterTileInfo): void {
    const { screenX: x, screenY: y, adjacentLand } = tile;
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    const hw = w / 2;
    const hh = h / 2;
    const cx = x + hw;
    const cy = y + hh;

    const corners = {
      top:    { x: cx,     y: y },
      right:  { x: x + w,  y: cy },
      bottom: { x: cx,     y: y + h },
      left:   { x: x,      y: cy },
    };

    const layers = [
      { inset: 0.08, alpha: 0.18 },
      { inset: 0.20, alpha: 0.12 },
      { inset: 0.35, alpha: 0.06 },
    ];

    const g = this.shoreGraphics!;

    for (const { inset, alpha } of layers) {
      const hasN = adjacentLand.north;
      const hasE = adjacentLand.east;
      const hasS = adjacentLand.south;
      const hasW = adjacentLand.west;

      if (hasN) {
        const outerL = corners.left;
        const outerT = corners.top;
        const innerL = { x: outerL.x + (cx - outerL.x) * inset, y: outerL.y + (cy - outerL.y) * inset };
        const innerT = { x: outerT.x + (cx - outerT.x) * inset, y: outerT.y + (cy - outerT.y) * inset };
        g.moveTo(outerL.x, outerL.y);
        g.lineTo(outerT.x, outerT.y);
        g.lineTo(innerT.x, innerT.y);
        g.lineTo(innerL.x, innerL.y);
        g.closePath();
        g.fill({ color: 0x5ec8d4, alpha });
      }
      if (hasE) {
        const outerT = corners.top;
        const outerR = corners.right;
        const innerT = { x: outerT.x + (cx - outerT.x) * inset, y: outerT.y + (cy - outerT.y) * inset };
        const innerR = { x: outerR.x + (cx - outerR.x) * inset, y: outerR.y + (cy - outerR.y) * inset };
        g.moveTo(outerT.x, outerT.y);
        g.lineTo(outerR.x, outerR.y);
        g.lineTo(innerR.x, innerR.y);
        g.lineTo(innerT.x, innerT.y);
        g.closePath();
        g.fill({ color: 0x5ec8d4, alpha });
      }
      if (hasS) {
        const outerR = corners.right;
        const outerB = corners.bottom;
        const innerR = { x: outerR.x + (cx - outerR.x) * inset, y: outerR.y + (cy - outerR.y) * inset };
        const innerB = { x: outerB.x + (cx - outerB.x) * inset, y: outerB.y + (cy - outerB.y) * inset };
        g.moveTo(outerR.x, outerR.y);
        g.lineTo(outerB.x, outerB.y);
        g.lineTo(innerB.x, innerB.y);
        g.lineTo(innerR.x, innerR.y);
        g.closePath();
        g.fill({ color: 0x5ec8d4, alpha });
      }
      if (hasW) {
        const outerB = corners.bottom;
        const outerL = corners.left;
        const innerB = { x: outerB.x + (cx - outerB.x) * inset, y: outerB.y + (cy - outerB.y) * inset };
        const innerL = { x: outerL.x + (cx - outerL.x) * inset, y: outerL.y + (cy - outerL.y) * inset };
        g.moveTo(outerB.x, outerB.y);
        g.lineTo(outerL.x, outerL.y);
        g.lineTo(innerL.x, innerL.y);
        g.lineTo(innerB.x, innerB.y);
        g.closePath();
        g.fill({ color: 0x5ec8d4, alpha });
      }
    }
  }

  // ─── Beach drawing (ported from Canvas 2D drawBeachOnWater) ──────────

  private drawBeach(tile: WaterTileInfo): void {
    const { screenX: x, screenY: y, adjacentLand } = tile;
    const { north, east, south, west } = adjacentLand;
    if (!north && !east && !south && !west) return;

    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    const bw = w * BEACH_WIDTH_RATIO;

    const corners = {
      top:    { x: x + w / 2, y },
      right:  { x: x + w, y: y + h / 2 },
      bottom: { x: x + w / 2, y: y + h },
      left:   { x, y: y + h / 2 },
    };

    if (north) this.drawEdge(corners.left, corners.top, INWARD.north, bw, west, east);
    if (east)  this.drawEdge(corners.top, corners.right, INWARD.east, bw, north, south);
    if (south) this.drawEdge(corners.right, corners.bottom, INWARD.south, bw, east, west);
    if (west)  this.drawEdge(corners.bottom, corners.left, INWARD.west, bw, south, north);

    if (north && east) this.drawCorner(corners.top, corners.left, INWARD.north, corners.right, INWARD.east, bw);
    if (east && south) this.drawCorner(corners.right, corners.top, INWARD.east, corners.bottom, INWARD.south, bw);
    if (south && west) this.drawCorner(corners.bottom, corners.right, INWARD.south, corners.left, INWARD.west, bw);
    if (west && north) this.drawCorner(corners.left, corners.bottom, INWARD.west, corners.top, INWARD.north, bw);
  }

  private drawEdge(
    start: { x: number; y: number }, end: { x: number; y: number },
    inv: { dx: number; dy: number }, bw: number,
    shortenStart: boolean, shortenEnd: boolean,
  ): void {
    const g = this.beachGraphics!;
    const sd = bw * BEACH_CORNER_FACTOR;
    const edx = end.x - start.x;
    const edy = end.y - start.y;
    const len = Math.hypot(edx, edy);
    const dirX = edx / len;
    const dirY = edy / len;

    let sx = start.x, sy = start.y, ex = end.x, ey = end.y;
    if (shortenStart && len > sd * 2) { sx += dirX * sd; sy += dirY * sd; }
    if (shortenEnd && len > sd * 2) { ex -= dirX * sd; ey -= dirY * sd; }

    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.lineTo(ex + inv.dx * bw, ey + inv.dy * bw);
    g.lineTo(sx + inv.dx * bw, sy + inv.dy * bw);
    g.closePath();
    g.fill({ color: BEACH_FILL });

    g.moveTo(sx + inv.dx * bw, sy + inv.dy * bw);
    g.lineTo(ex + inv.dx * bw, ey + inv.dy * bw);
    g.stroke({ color: BEACH_CURB, width: BEACH_CURB_WIDTH });
  }

  private drawCorner(
    corner: { x: number; y: number },
    edge1: { x: number; y: number }, inv1: { dx: number; dy: number },
    edge2: { x: number; y: number }, inv2: { dx: number; dy: number },
    bw: number,
  ): void {
    const g = this.beachGraphics!;
    const sd = bw * BEACH_CORNER_FACTOR;

    const d1x = edge1.x - corner.x, d1y = edge1.y - corner.y;
    const l1 = Math.hypot(d1x, d1y);
    const i1x = corner.x + (d1x / l1) * sd + inv1.dx * bw;
    const i1y = corner.y + (d1y / l1) * sd + inv1.dy * bw;

    const d2x = edge2.x - corner.x, d2y = edge2.y - corner.y;
    const l2 = Math.hypot(d2x, d2y);
    const i2x = corner.x + (d2x / l2) * sd + inv2.dx * bw;
    const i2y = corner.y + (d2y / l2) * sd + inv2.dy * bw;

    g.moveTo(corner.x, corner.y);
    g.lineTo(i1x, i1y);
    g.lineTo(i2x, i2y);
    g.closePath();
    g.fill({ color: BEACH_FILL });
  }

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;
    if (this.app) {
      // Ticker zuerst stoppen damit kein Frame mehr gerendert wird
      // bevor die internen Referenzen genullt werden
      this.app.ticker?.stop();
    }
    this._canvas = null;
    this.waterContainer = null;
    this.tilingSprite = null;
    this.waterMask = null;
    this.shoreGraphics = null;
    this.gridGraphics = null;
    this.beachGraphics = null;
    this.depthGraphics = null;
    this.displacementSprite = null;
    if (this.app) {
      try { this.app.destroy(); } catch { /* may not be fully initialized */ }
      this.app = null;
    }
  }
}
