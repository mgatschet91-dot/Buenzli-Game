'use client';

import { Application, Container, Sprite, Texture } from 'pixi.js';
import { Pedestrian, TILE_WIDTH, TILE_HEIGHT } from './types';
import { PEDESTRIAN_MIN_ZOOM, PEDESTRIAN_MIN_ZOOM_MOBILE } from './constants';
import { getPedestrianOpacity, getVisiblePedestrians } from './pedestrianSystem';
import {
  calculatePedestrianScreenPosition,
  drawSinglePedestrian,
  LOD_SIMPLE_ZOOM,
  LOD_MEDIUM_ZOOM,
  type PedestrianFilterMode,
} from './drawPedestrians';

// Only use PixiJS when zoom >= this threshold.
// Below this, pedestrians are tiny dots and Canvas 2D is more efficient.
export const PIXI_PED_MIN_ZOOM = LOD_SIMPLE_ZOOM;

const RENDER_SCALE = 5;
const TEX_SIZE = 64;
const ANCHOR_X = TEX_SIZE / 2;
const ANCHOR_Y = TEX_SIZE * 0.78;

const WALK_FRAMES = 8;
const WALK_STEP = (Math.PI * 2) / WALK_FRAMES;
const ACTIVITY_FRAMES = 8;
const ACTIVITY_STEP = (Math.PI * 2) / ACTIVITY_FRAMES;

const MAX_TEXTURE_CACHE = 600;

type CachedTex = { texture: Texture; canvas: HTMLCanvasElement; lastUsedFrame: number };

export class PixiPedestrianRenderer {
  private app: Application | null = null;
  private container: Container | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  private spritePool: Sprite[] = [];
  private spriteIndex = 0;

  private texCache = new Map<string, CachedTex>();
  private frameCounter = 0;

  get initialized(): boolean { return this._initialized; }
  get canvas(): HTMLCanvasElement | null { return this._canvas; }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async init(width: number, height: number): Promise<void> {
    if (this._initialized || this._destroyed) return;

    try {
      this.app = new Application();
      await this.app.init({
        width,
        height,
        backgroundAlpha: 0,
        preference: 'webgl',
        antialias: true,
        resolution: 1,
      });

      if (this._destroyed) {
        try { this.app?.destroy(); } catch { /* ok */ }
        this.app = null;
        return;
      }

      this._canvas = this.app.canvas as HTMLCanvasElement;
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.left = '0';
      this._canvas.style.pointerEvents = 'none';

      this.container = new Container();
      this.app.stage.addChild(this.container);
      this.app.ticker.stop();

      this._initialized = true;
    } catch (err) {
      console.error('[PixiPedestrianRenderer] init failed:', err);
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

  hide(): void {
    if (this._canvas) this._canvas.style.display = 'none';
  }

  show(): void {
    if (this._canvas) this._canvas.style.display = '';
  }

  // ------------------------------------------------------------------
  // Render directly to the visible Pixi canvas (no drawImage copy)
  // Used for non-recreation pedestrians whose canvas is in the DOM.
  // ------------------------------------------------------------------

  render(
    pedestrians: Pedestrian[],
    filterMode: PedestrianFilterMode,
    zoom: number,
    dpr: number,
    offsetX: number,
    offsetY: number,
    isMobile: boolean,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!this.app || !this.container || !this._initialized) return;

    const pedestrianMinZoom = isMobile ? PEDESTRIAN_MIN_ZOOM_MOBILE : PEDESTRIAN_MIN_ZOOM;

    if (filterMode === 'non-recreation' && zoom < pedestrianMinZoom) {
      this.hideAllSprites();
      this.app.render();
      return;
    }
    if (filterMode === 'recreation') {
      const hasNpcWorkers = pedestrians.some(p => p.isNpcWorker);
      if (zoom < pedestrianMinZoom && !hasNpcWorkers) {
        this.hideAllSprites();
        this.app.render();
        return;
      }
    }

    if (pedestrians.length === 0) {
      this.hideAllSprites();
      this.app.render();
      return;
    }

    this.frameCounter++;

    let visible = getVisiblePedestrians(pedestrians);

    if (filterMode === 'recreation') {
      visible = visible.filter(ped =>
        ped.isNpcWorker ||
        ped.state === 'at_recreation' ||
        ped.state === 'at_beach' ||
        ped.state === 'approaching_shop' ||
        (ped.activity === 'shopping' && (ped.state === 'entering_building' || ped.state === 'exiting_building'))
      );
    } else if (filterMode === 'non-recreation') {
      visible = visible.filter(ped =>
        !ped.isNpcWorker &&
        ped.state !== 'at_recreation' &&
        ped.state !== 'at_beach' &&
        ped.state !== 'approaching_shop' &&
        !(ped.activity === 'shopping' && (ped.state === 'entering_building' || ped.state === 'exiting_building'))
      );
    }

    if (visible.length === 0) {
      this.hideAllSprites();
      this.app.render();
      return;
    }

    const viewWidth = canvasWidth / (dpr * zoom);
    const viewHeight = canvasHeight / (dpr * zoom);
    const viewLeft = -offsetX / zoom - TILE_WIDTH;
    const viewTop = -offsetY / zoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - offsetX / zoom + TILE_WIDTH;
    const viewBottom = viewHeight - offsetY / zoom + TILE_HEIGHT * 2;

    this.app.stage.scale.set(dpr * zoom);
    this.app.stage.position.set(offsetX * dpr, offsetY * dpr);

    this.spriteIndex = 0;

    for (let i = 0; i < visible.length; i++) {
      const ped = visible[i];
      const pos = calculatePedestrianScreenPosition(ped);

      if (
        pos.x < viewLeft - 50 ||
        pos.x > viewRight + 50 ||
        pos.y < viewTop - 60 ||
        pos.y > viewBottom + 60
      ) continue;

      const opacity = getPedestrianOpacity(ped);
      if (opacity <= 0) continue;

      const tex = this.getOrCreateTexture(ped, zoom);
      const sprite = this.acquireSprite();
      sprite.texture = tex;
      sprite.anchor.set(ANCHOR_X / TEX_SIZE, ANCHOR_Y / TEX_SIZE);
      sprite.x = pos.x;
      sprite.y = pos.y;
      sprite.scale.set(1 / RENDER_SCALE);
      sprite.alpha = opacity;
    }

    this.hideUnusedSprites();
    this.app.render();

    if (this.frameCounter % 300 === 0) this.evictTextures();
  }

  private hideAllSprites(): void {
    for (let i = 0; i < this.spritePool.length; i++) {
      this.spritePool[i].visible = false;
      this.spritePool[i].renderable = false;
    }
  }

  private hideUnusedSprites(): void {
    for (let i = this.spriteIndex; i < this.spritePool.length; i++) {
      this.spritePool[i].visible = false;
      this.spritePool[i].renderable = false;
    }
  }

  // ------------------------------------------------------------------
  // Texture cache
  // ------------------------------------------------------------------

  private getOrCreateTexture(ped: Pedestrian, zoom: number): Texture {
    const key = this.buildCacheKey(ped, zoom);
    const cached = this.texCache.get(key);
    if (cached) {
      cached.lastUsedFrame = this.frameCounter;
      return cached.texture;
    }
    return this.generateTexture(ped, zoom, key);
  }

  private buildCacheKey(ped: Pedestrian, zoom: number): string {
    const lod = zoom < LOD_SIMPLE_ZOOM ? 0 : zoom < LOD_MEDIUM_ZOOM ? 1 : 2;

    const wf = Math.floor(((ped.walkOffset % (Math.PI * 2)) + Math.PI * 2) / WALK_STEP) % WALK_FRAMES;
    const af = Math.floor(((ped.activityAnimTimer % (Math.PI * 2)) + Math.PI * 2) / ACTIVITY_STEP) % ACTIVITY_FRAMES;

    if (ped.isNpcWorker && ped.npcType === 'avatar_test') {
      const action = ped.avatarAction || 'std';
      const figure = ped.avatarFigure || '';
      return `av_${lod}_${ped.state}_${action}_${ped.direction}_${wf}_${figure}`;
    }

    if (lod === 0) {
      return `s_${ped.skinColor}_${ped.shirtColor}`;
    }

    if (lod === 1) {
      const isRec = ped.state === 'at_recreation' ? 1 : 0;
      return `m_${isRec}_${ped.skinColor}_${ped.shirtColor}_${ped.pantsColor}_${wf}_${ped.hasBall ? 1 : 0}`;
    }

    const act = ped.activity || 'none';
    const npc = ped.isNpcWorker ? (ped.npcType || '') : '';
    const extras = `${ped.hasHat ? ped.hatColor : 'n'}_${ped.id % 2}_${ped.hasDog ? 1 : 0}_${ped.hasBag ? 1 : 0}_${ped.hasBall ? 1 : 0}`;
    const stateKey = ped.state === 'npc_working' ? 'nw' : ped.state.charAt(0);
    return `f_${act}_${npc}_${stateKey}_${ped.skinColor}_${ped.shirtColor}_${ped.pantsColor}_${extras}_${wf}_${af}`;
  }

  private generateTexture(ped: Pedestrian, zoom: number, key: string): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    const lod = zoom < LOD_SIMPLE_ZOOM ? 0 : zoom < LOD_MEDIUM_ZOOM ? 1 : 2;
    const wf = Math.floor(((ped.walkOffset % (Math.PI * 2)) + Math.PI * 2) / WALK_STEP) % WALK_FRAMES;
    const af = Math.floor(((ped.activityAnimTimer % (Math.PI * 2)) + Math.PI * 2) / ACTIVITY_STEP) % ACTIVITY_FRAMES;

    const mockPed: Pedestrian = {
      ...ped,
      walkOffset: wf * WALK_STEP,
      activityAnimTimer: af * ACTIVITY_STEP,
    };

    ctx.save();
    ctx.translate(ANCHOR_X, ANCHOR_Y);
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    const effectiveZoom = lod === 0 ? LOD_SIMPLE_ZOOM - 0.01 : lod === 1 ? LOD_MEDIUM_ZOOM - 0.01 : LOD_MEDIUM_ZOOM + 0.01;
    drawSinglePedestrian(ctx, mockPed, effectiveZoom);

    ctx.restore();

    const texture = Texture.from(canvas);
    this.texCache.set(key, { texture, canvas, lastUsedFrame: this.frameCounter });
    return texture;
  }

  private evictTextures(): void {
    if (this.texCache.size <= MAX_TEXTURE_CACHE) return;
    const entries = [...this.texCache.entries()];
    entries.sort((a, b) => a[1].lastUsedFrame - b[1].lastUsedFrame);
    const toRemove = entries.slice(0, entries.length - MAX_TEXTURE_CACHE + 100);
    for (const [k, v] of toRemove) {
      v.texture.destroy(true);
      this.texCache.delete(k);
    }
  }

  // ------------------------------------------------------------------
  // Sprite pool
  // ------------------------------------------------------------------

  private acquireSprite(): Sprite {
    let sprite: Sprite;
    if (this.spriteIndex < this.spritePool.length) {
      sprite = this.spritePool[this.spriteIndex];
    } else {
      sprite = new Sprite();
      this.container!.addChild(sprite);
      this.spritePool.push(sprite);
    }
    this.spriteIndex++;
    sprite.visible = true;
    sprite.renderable = true;
    sprite.tint = 0xffffff;
    sprite.blendMode = 'normal';
    return sprite;
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;
    this._canvas = null;
    this.spritePool = [];
    this.container = null;

    for (const [, v] of this.texCache) {
      v.texture.destroy(true);
    }
    this.texCache.clear();

    if (this.app) {
      try { this.app.destroy(); } catch { /* may not be fully initialized */ }
      this.app = null;
    }
  }
}
