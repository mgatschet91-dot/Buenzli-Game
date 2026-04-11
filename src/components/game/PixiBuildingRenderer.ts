'use client';

import { Application, Sprite, Texture, Container, Rectangle } from 'pixi.js';

export class PixiBuildingRenderer {
  private app: Application | null = null;
  private container: Container | null = null;
  private spritePool: Sprite[] = [];
  private spriteIndex = 0;
  private sourceTextureCache = new WeakMap<object, Texture>();
  private frameTextureCache = new Map<string, Texture>();
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  get initialized(): boolean { return this._initialized; }
  get canvas(): HTMLCanvasElement | null { return this._canvas; }

  async init(width: number, height: number): Promise<void> {
    if (this._initialized || this._destroyed) return;

    try {
      this.app = new Application();
      await this.app.init({
        width,
        height,
        backgroundAlpha: 0,
        preference: 'webgl',
        antialias: false,
        resolution: 1,
      });

      if (this._destroyed) {
        this.app?.destroy();
        this.app = null;
        return;
      }

      this._canvas = this.app.canvas as HTMLCanvasElement;
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.left = '0';
      this._canvas.style.pointerEvents = 'none';
      const dpr = window.devicePixelRatio || 1;
      this._canvas.style.width = `${Math.round(width / dpr)}px`;
      this._canvas.style.height = `${Math.round(height / dpr)}px`;

      this.container = new Container();
      this.app.stage.addChild(this.container);

      this.app.ticker.stop();
      this._initialized = true;
    } catch (err) {
      console.error('[PixiBuildingRenderer] init failed:', err);
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

  beginFrame(dpr: number, zoom: number, offsetX: number, offsetY: number): void {
    if (!this.app || !this.container) return;
    this.spriteIndex = 0;

    this.app.stage.scale.set(dpr * zoom);
    this.app.stage.position.set(offsetX * dpr, offsetY * dpr);
  }

  addSprite(
    image: HTMLImageElement,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
    flipX: boolean,
    alpha = 1,
    skewX = 0,
    tint = 0xFFFFFF,
  ): void {
    if (!this.container) return;

    const baseTex = this.getSourceTexture(image);
    const frameTex = this.getFrameTexture(baseTex, sx, sy, sw, sh);

    const sprite = this.acquireSprite();
    sprite.texture = frameTex;
    sprite.alpha = alpha;
    sprite.tint = tint;

    if (skewX !== 0) {
      sprite.anchor.set(0.5, 1);
      const scaleX = (flipX ? -1 : 1) * (dw / sw);
      sprite.scale.set(scaleX, dh / sh);
      sprite.x = dx + dw / 2;
      sprite.y = dy + dh;
      sprite.skew.set(skewX, 0);
    } else {
      sprite.anchor.set(0, 0);
      sprite.skew.set(0, 0);
      if (flipX) {
        sprite.scale.set(-(dw / sw), dh / sh);
        sprite.x = dx + dw;
        sprite.y = dy;
      } else {
        sprite.scale.set(dw / sw, dh / sh);
        sprite.x = dx;
        sprite.y = dy;
      }
    }
  }

  endFrame(): void {
    if (!this.app) return;

    for (let i = this.spriteIndex; i < this.spritePool.length; i++) {
      this.spritePool[i].visible = false;
      this.spritePool[i].renderable = false;
    }

    this.app.render();
  }

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
    return sprite;
  }

  private getSourceTexture(image: HTMLImageElement): Texture {
    let tex = this.sourceTextureCache.get(image);
    if (!tex) {
      tex = Texture.from(image);
      this.sourceTextureCache.set(image, tex);
    }
    return tex;
  }

  private getFrameTexture(baseTex: Texture, sx: number, sy: number, sw: number, sh: number): Texture {
    const key = `${baseTex.uid}-${sx|0}-${sy|0}-${sw|0}-${sh|0}`;
    let tex = this.frameTextureCache.get(key);
    if (!tex) {
      tex = new Texture({
        source: baseTex.source,
        frame: new Rectangle(sx, sy, sw, sh),
      });
      this.frameTextureCache.set(key, tex);
    }
    return tex;
  }

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;
    this._canvas = null;
    this.spritePool = [];
    this.container = null;
    this.frameTextureCache.clear();
    if (this.app) {
      try { this.app.destroy(); } catch { /* may not be fully initialized */ }
      this.app = null;
    }
  }
}
