'use client';

import {
  Application, Container, Graphics,
} from 'pixi.js';
import type { BirdFlock } from './types';

const BIRD_WING_SPAN = 6; // half wing length in pixels (world units)
const BIRD_BODY_LENGTH = 3;

export class PixiBirdRenderer {
  private app: Application | null = null;
  private rootContainer: Container | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  // Pool of graphics objects
  private graphicsPool: Graphics[] = [];
  private activeGraphics: Graphics[] = [];

  get initialized(): boolean { return this._initialized; }
  get canvas(): HTMLCanvasElement | null { return this._canvas; }

  async init(width: number, height: number): Promise<void> {
    if (this._initialized || this._destroyed) return;

    try {
      this.app = new Application();
      await this.app.init({
        width, height,
        backgroundAlpha: 0,
        preference: 'webgl',
        antialias: true,
        resolution: 1,
      });

      if (this._destroyed) { this.app.destroy(); this.app = null; return; }

      this._canvas = this.app.canvas as HTMLCanvasElement;
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.left = '0';
      this._canvas.style.pointerEvents = 'none';

      this.rootContainer = new Container();
      this.app.stage.addChild(this.rootContainer);

      this._initialized = true;
    } catch {
      this._initialized = false;
    }
  }

  private _pendingResize: { w: number; h: number; cw: number; ch: number } | null = null;

  resize(width: number, height: number, cssW: number, cssH: number): void {
    if (!this.app || !this._initialized) {
      this._pendingResize = { w: width, h: height, cw: cssW, ch: cssH };
      return;
    }
    this._pendingResize = null;
    this.app.renderer.resize(width, height);
    if (this._canvas) {
      this._canvas.style.width = `${cssW}px`;
      this._canvas.style.height = `${cssH}px`;
    }
  }

  applyPendingResize(): void {
    if (this._pendingResize && this._initialized) {
      const { w, h, cw, ch } = this._pendingResize;
      this.resize(w, h, cw, ch);
    }
  }

  private acquireGraphics(): Graphics {
    if (this.graphicsPool.length > 0) {
      const g = this.graphicsPool.pop()!;
      g.visible = true;
      g.renderable = true;
      g.clear();
      return g;
    }
    const g = new Graphics();
    this.rootContainer!.addChild(g);
    return g;
  }

  private releaseAll(): void {
    for (const g of this.activeGraphics) {
      g.visible = false;
      g.renderable = false;
      this.graphicsPool.push(g);
    }
    this.activeGraphics.length = 0;
  }

  render(
    flocks: BirdFlock[],
    offset: { x: number; y: number },
    zoom: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!this.app || !this.rootContainer || !this._initialized) return;

    const dpr = window.devicePixelRatio || 1;

    // Release all previous graphics back to pool
    this.releaseAll();

    if (flocks.length === 0) return;

    // Set transform
    this.rootContainer.scale.set(dpr * zoom);
    this.rootContainer.position.set(offset.x * dpr, offset.y * dpr);

    // Viewport culling
    const viewW = canvasWidth / (dpr * zoom);
    const viewH = canvasHeight / (dpr * zoom);
    const viewLeft = -offset.x / zoom - 100;
    const viewTop = -offset.y / zoom - 100;
    const viewRight = viewW - offset.x / zoom + 100;
    const viewBottom = viewH - offset.y / zoom + 100;

    for (const flock of flocks) {
      for (const bird of flock.birds) {
        // Cull off-screen birds
        if (bird.x < viewLeft || bird.x > viewRight ||
            bird.y < viewTop || bird.y > viewBottom) continue;

        const g = this.acquireGraphics();
        this.activeGraphics.push(g);

        // Wing animation: wingPhase drives a sine wave for the wing angle
        const wingAngle = Math.sin(bird.wingPhase) * 0.6; // wing flap amplitude ~35deg
        const ws = BIRD_WING_SPAN * bird.size;
        const bl = BIRD_BODY_LENGTH * bird.size;

        // Calculate flight angle for rotation
        const flightAngle = Math.atan2(bird.vy, bird.vx);

        g.position.set(bird.x, bird.y);
        g.rotation = flightAngle;

        // Draw bird as a simple "V" / seagull shape
        const wingY = wingAngle * ws * 0.5; // vertical displacement from flapping
        const strokeStyle = { width: 1.2 * bird.size, color: 0x1a1a2e, alpha: 0.85 };

        // Left wing
        g.moveTo(-bl * 0.3, 0);
        g.lineTo(-ws, -wingY - ws * 0.15);
        g.stroke(strokeStyle);

        // Right wing
        g.moveTo(-bl * 0.3, 0);
        g.lineTo(-ws, wingY + ws * 0.15);
        g.stroke(strokeStyle);

        // Body/head
        g.moveTo(-bl, 0);
        g.lineTo(bl, 0);
        g.stroke(strokeStyle);
      }
    }
  }

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;

    for (const g of this.activeGraphics) {
      g.destroy();
    }
    this.activeGraphics = [];

    for (const g of this.graphicsPool) {
      g.destroy();
    }
    this.graphicsPool = [];

    if (this.app) {
      try { this.app.destroy(true); } catch { /* noop */ }
      this.app = null;
    }
    this._canvas = null;
    this.rootContainer = null;
  }
}
