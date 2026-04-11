'use client';

import {
  Application, Container, Sprite, Texture,
} from 'pixi.js';
import type { Cloud, CloudType, CloudPuff } from './types';
import {
  CLOUD_MIN_ZOOM, CLOUD_MAX_ZOOM, CLOUD_FADE_ZOOM,
  CLOUD_WIDTH, CLOUD_MAX_COVERAGE, CLOUD_COVERAGE_FADE_END,
  CLOUD_NIGHT_OPACITY_MULT,
} from './constants';

// Cached soft-circle textures keyed by tint hex (created once per color variant)
const puffTextureCache = new Map<number, Texture>();

function createSoftCircleTexture(size: number, color: number): Texture {
  const cached = puffTextureCache.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const d = size * 2;
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d')!;

  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  const grad = ctx.createRadialGradient(size, size, 0, size, size, size);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.2, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.35)`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},0.15)`);
  grad.addColorStop(0.85, `rgba(${r},${g},${b},0.04)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, d, d);

  const tex = Texture.from(canvas);
  puffTextureCache.set(color, tex);
  return tex;
}

const PUFF_TEX_SIZE = 128;

// Cloud type tint colors (main + shadow)
const CLOUD_TINTS: Record<CloudType, { main: number; shadow: number; base?: number; top?: number }> = {
  cumulus:        { main: 0xffffff, shadow: 0xa0a8b9 },
  stratus:        { main: 0xdcdee4, shadow: 0xafb6c6 },
  cirrus:         { main: 0xf8faff, shadow: 0x000000 },
  cumulonimbus:   { main: 0xb0b8c8, shadow: 0x2a2e3a, base: 0x1e2230, top: 0xe8ecf4 },
  altocumulus:    { main: 0xeef0f5, shadow: 0xc8d0dc },
};

interface PixiCloudSprite {
  container: Container;
  puffSprites: Sprite[];
  shadowSprites: Sprite[];
  cloudId: number;
}

export class PixiCloudLayer {
  private app: Application | null = null;
  private rootContainer: Container | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  private spritePool: PixiCloudSprite[] = [];
  private activeSprites = new Map<number, PixiCloudSprite>();

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

      // Pre-generate textures for all cloud types
      for (const tints of Object.values(CLOUD_TINTS)) {
        createSoftCircleTexture(PUFF_TEX_SIZE, tints.main);
        createSoftCircleTexture(PUFF_TEX_SIZE, tints.shadow);
        if (tints.base) createSoftCircleTexture(PUFF_TEX_SIZE, tints.base);
        if (tints.top) createSoftCircleTexture(PUFF_TEX_SIZE, tints.top);
      }

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

  render(
    clouds: Cloud[],
    offset: { x: number; y: number },
    zoom: number,
    canvasWidth: number,
    canvasHeight: number,
    currentHour: number,
  ): void {
    if (!this.app || !this.rootContainer || !this._initialized) return;

    const dpr = window.devicePixelRatio || 1;

    // Zoom-based visibility
    if (clouds.length === 0 || zoom < CLOUD_MIN_ZOOM) {
      this.hideAll();
      return;
    }

    let zoomOpacity = 1;
    if (zoom > CLOUD_FADE_ZOOM) {
      this.hideAll();
      return;
    } else if (zoom > CLOUD_MAX_ZOOM) {
      zoomOpacity = 1 - (zoom - CLOUD_MAX_ZOOM) / (CLOUD_FADE_ZOOM - CLOUD_MAX_ZOOM);
    }

    // Night modifier
    const isNight = currentHour >= 20 || currentHour < 6;
    const isDusk = currentHour >= 18 && currentHour < 20;
    const isDawn = currentHour >= 6 && currentHour < 8;
    let nightMult = 1.0;
    if (isNight) nightMult = CLOUD_NIGHT_OPACITY_MULT;
    else if (isDusk) nightMult = 1.0 - (1.0 - CLOUD_NIGHT_OPACITY_MULT) * ((currentHour - 18) / 2);
    else if (isDawn) nightMult = CLOUD_NIGHT_OPACITY_MULT + (1.0 - CLOUD_NIGHT_OPACITY_MULT) * ((currentHour - 6) / 2);

    // Viewport bounds (world coords)
    const viewWidth = canvasWidth / (dpr * zoom);
    const viewHeight = canvasHeight / (dpr * zoom);
    const viewLeft = -offset.x / zoom - CLOUD_WIDTH;
    const viewTop = -offset.y / zoom - CLOUD_WIDTH;
    const viewRight = viewWidth - offset.x / zoom + CLOUD_WIDTH;
    const viewBottom = viewHeight - offset.y / zoom + CLOUD_WIDTH;
    const viewportArea = viewWidth * viewHeight;

    // Coverage fade
    const sortedClouds = [...clouds].sort((a, b) => a.layer - b.layer);
    let totalCloudArea = 0;
    for (const cloud of sortedClouds) {
      if (cloud.x < viewLeft || cloud.x > viewRight || cloud.y < viewTop || cloud.y > viewBottom) continue;
      let maxExtent = 0;
      for (const puff of cloud.puffs) {
        const rx = puff.size * cloud.scale * (puff.stretchX ?? 1);
        const ry = puff.size * cloud.scale * (puff.stretchY ?? 1);
        const extent = Math.sqrt(puff.offsetX * puff.offsetX + puff.offsetY * puff.offsetY) + Math.max(rx, ry);
        if (extent > maxExtent) maxExtent = extent;
      }
      totalCloudArea += Math.PI * maxExtent * maxExtent;
    }
    const coverage = viewportArea > 0 ? totalCloudArea / viewportArea : 0;
    let coverageOpacity = 1;
    if (coverage > CLOUD_MAX_COVERAGE) {
      const fadeRange = CLOUD_COVERAGE_FADE_END - CLOUD_MAX_COVERAGE;
      coverageOpacity = Math.max(0, 1 - (coverage - CLOUD_MAX_COVERAGE) / fadeRange);
    }

    // Transform root: apply zoom + offset
    this.rootContainer.scale.set(dpr * zoom);
    this.rootContainer.position.set(offset.x * dpr, offset.y * dpr);

    // Track which clouds are active
    const activeIds = new Set<number>();

    for (const cloud of sortedClouds) {
      if (cloud.x < viewLeft || cloud.x > viewRight || cloud.y < viewTop || cloud.y > viewBottom) continue;
      activeIds.add(cloud.id);

      const finalOpacity = cloud.opacity * nightMult * zoomOpacity * coverageOpacity;
      if (finalOpacity <= 0.01) continue;

      let entry = this.activeSprites.get(cloud.id);

      if (!entry) {
        entry = this.acquireSprite(cloud);
        this.activeSprites.set(cloud.id, entry);
        this.rootContainer.addChild(entry.container);
      }

      this.updateCloudSprite(entry, cloud, finalOpacity);
    }

    // Recycle sprites for clouds no longer visible
    for (const [id, entry] of this.activeSprites) {
      if (!activeIds.has(id)) {
        this.releaseSprite(entry);
        this.activeSprites.delete(id);
      }
    }
  }

  private hideAll(): void {
    for (const [id, entry] of this.activeSprites) {
      this.releaseSprite(entry);
      this.activeSprites.delete(id);
    }
  }

  private acquireSprite(cloud: Cloud): PixiCloudSprite {
    // Reuse from pool if available
    if (this.spritePool.length > 0) {
      const entry = this.spritePool.pop()!;
      entry.cloudId = cloud.id;
      entry.container.visible = true;
      entry.container.renderable = true;
      this.rebuildPuffs(entry, cloud);
      return entry;
    }

    const container = new Container();
    const entry: PixiCloudSprite = { container, puffSprites: [], shadowSprites: [], cloudId: cloud.id };
    this.rebuildPuffs(entry, cloud);
    return entry;
  }

  private rebuildPuffs(entry: PixiCloudSprite, cloud: Cloud): void {
    // Remove old sprites
    for (const s of entry.puffSprites) { s.removeFromParent(); s.destroy(); }
    for (const s of entry.shadowSprites) { s.removeFromParent(); s.destroy(); }
    entry.puffSprites = [];
    entry.shadowSprites = [];

    const tints = CLOUD_TINTS[cloud.cloudType] ?? CLOUD_TINTS.cumulus;
    const hasShadow = cloud.cloudType !== 'cirrus';

    for (const puff of cloud.puffs) {
      // Shadow first (below main puffs)
      if (hasShadow) {
        const shadowTex = createSoftCircleTexture(PUFF_TEX_SIZE, tints.shadow);
        const shadowSprite = new Sprite(shadowTex);
        shadowSprite.anchor.set(0.5);
        entry.container.addChild(shadowSprite);
        entry.shadowSprites.push(shadowSprite);
      }
    }

    for (const puff of cloud.puffs) {
      let tint = tints.main;
      if (cloud.cloudType === 'cumulonimbus' && puff.portion === 'base' && tints.base) tint = tints.base;
      if (cloud.cloudType === 'cumulonimbus' && puff.portion === 'top' && tints.top) tint = tints.top;

      const tex = createSoftCircleTexture(PUFF_TEX_SIZE, tint);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      entry.container.addChild(sprite);
      entry.puffSprites.push(sprite);
    }
  }

  private updateCloudSprite(entry: PixiCloudSprite, cloud: Cloud, finalOpacity: number): void {
    const c = entry.container;
    c.position.set(cloud.x, cloud.y);

    const tints = CLOUD_TINTS[cloud.cloudType] ?? CLOUD_TINTS.cumulus;
    const hasShadow = cloud.cloudType !== 'cirrus';
    const shadowMult = cloud.cloudType === 'stratus' ? 0.1 : 0.15;

    // Update shadow sprites
    if (hasShadow) {
      for (let i = 0; i < entry.shadowSprites.length && i < cloud.puffs.length; i++) {
        const puff = cloud.puffs[i];
        const s = entry.shadowSprites[i];
        const puffSize = puff.size * cloud.scale * 0.9;
        const sx = (puff.stretchX ?? 1);
        const sy = (puff.stretchY ?? 1);
        const shadowOpacity = finalOpacity * puff.opacity * shadowMult;

        s.position.set(puff.offsetX * cloud.scale, (puff.offsetY + 8) * cloud.scale);
        s.scale.set((puffSize * sx) / PUFF_TEX_SIZE, (puffSize * sy) / PUFF_TEX_SIZE);
        s.alpha = shadowOpacity;
        s.visible = shadowOpacity > 0.01;
      }
    }

    // Update main puff sprites
    for (let i = 0; i < entry.puffSprites.length && i < cloud.puffs.length; i++) {
      const puff = cloud.puffs[i];
      const s = entry.puffSprites[i];
      const puffSize = puff.size * cloud.scale;
      const sx = (puff.stretchX ?? 1);
      const sy = (puff.stretchY ?? 1);
      const puffOpacity = finalOpacity * puff.opacity;

      s.position.set(puff.offsetX * cloud.scale, puff.offsetY * cloud.scale);
      s.scale.set((puffSize * sx) / PUFF_TEX_SIZE, (puffSize * sy) / PUFF_TEX_SIZE);
      s.alpha = puffOpacity;
      s.visible = puffOpacity > 0.01;
    }
  }

  private releaseSprite(entry: PixiCloudSprite): void {
    entry.container.visible = false;
    entry.container.renderable = false;
    entry.container.removeFromParent();
    this.spritePool.push(entry);
  }

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;

    for (const [, entry] of this.activeSprites) {
      entry.container.destroy({ children: true });
    }
    this.activeSprites.clear();

    for (const entry of this.spritePool) {
      entry.container.destroy({ children: true });
    }
    this.spritePool = [];

    puffTextureCache.clear();

    if (this.app) {
      try { this.app.destroy(true); } catch { /* noop */ }
      this.app = null;
    }
    this._canvas = null;
    this.rootContainer = null;
  }
}
