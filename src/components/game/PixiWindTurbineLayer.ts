'use client';

import { Application, Container, Sprite, Texture } from 'pixi.js';

// Tower texture dimensions
const TOWER_W = 52;
const TOWER_H = 96;
// Hub is at the FRONT-FACE centre of the nacelle (isometric front = bottom-LEFT)
// In texture coords:
const NAC_FRONT_X = 14;   // x of the front face of nacelle (left side in texture)
const NAC_FRONT_Y = 8;    // y of the front face centre of nacelle
const BLADE_W = 72;
const BLADE_H = 12;
const HUB_S = 18;

function createTowerTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = TOWER_W;
  canvas.height = TOWER_H;
  const ctx = canvas.getContext('2d')!;

  const cx = TOWER_W / 2;  // 26

  // ── Nacelle as isometric 3D box — hub/front face on LEFT ──
  // Top face (lightest)
  ctx.beginPath();
  ctx.moveTo(40, 2);   // top-right
  ctx.lineTo(16, 2);   // top-left
  ctx.lineTo(12, 6);   // front-left (lower left)
  ctx.lineTo(36, 6);   // front-right (lower right)
  ctx.closePath();
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();

  // Front/left face — where the hub sits (medium brightness)
  ctx.beginPath();
  ctx.moveTo(12, 6);
  ctx.lineTo(36, 6);
  ctx.lineTo(36, 14);
  ctx.lineTo(12, 14);
  ctx.closePath();
  ctx.fillStyle = '#d0d0d0';
  ctx.fill();

  // Left/side face (darkest — receding into depth)
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(12, 6);
  ctx.lineTo(12, 14);
  ctx.lineTo(16, 10);
  ctx.closePath();
  ctx.fillStyle = '#b0b0b0';
  ctx.fill();

  // Outline
  ctx.beginPath();
  ctx.moveTo(40, 2);
  ctx.lineTo(16, 2);
  ctx.lineTo(12, 6);
  ctx.lineTo(12, 14);
  ctx.lineTo(36, 14);
  ctx.lineTo(36, 6);
  ctx.lineTo(40, 2);
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Hub disc on front face (white circle at NAC_FRONT_X, NAC_FRONT_Y)
  ctx.beginPath();
  ctx.arc(NAC_FRONT_X, NAC_FRONT_Y, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Tower body — tapered trapezoid under nacelle
  const towerTop = 13;
  const topW = 5, baseW = 12;
  const towerBottom = TOWER_H - 2;
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, towerTop);
  ctx.lineTo(cx + topW / 2, towerTop);
  ctx.lineTo(cx + baseW / 2, towerBottom);
  ctx.lineTo(cx - baseW / 2, towerBottom);
  ctx.closePath();

  const grad = ctx.createLinearGradient(cx - baseW / 2, 0, cx + baseW / 2, 0);
  grad.addColorStop(0, '#b0b0b0');
  grad.addColorStop(0.3, '#f0f0f0');
  grad.addColorStop(0.7, '#f0f0f0');
  grad.addColorStop(1, '#b0b0b0');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Base flange
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(cx - 8, towerBottom - 1, 16, 4);

  return Texture.from(canvas);
}

function createBladeTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = BLADE_W;
  canvas.height = BLADE_H;
  const ctx = canvas.getContext('2d')!;

  const midY = BLADE_H / 2;
  // Blade: root (rounded, left) → tip (sharp, right)
  ctx.beginPath();
  ctx.moveTo(3, midY);
  ctx.bezierCurveTo(8, 1, 30, 0, BLADE_W - 1, midY);
  ctx.bezierCurveTo(30, BLADE_H, 8, BLADE_H - 1, 3, midY);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, BLADE_W, 0);
  grad.addColorStop(0, '#d8d8d8');
  grad.addColorStop(0.2, '#f5f5f5');
  grad.addColorStop(0.7, '#fafafa');
  grad.addColorStop(1, '#ebebeb');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Centre rib line
  ctx.beginPath();
  ctx.moveTo(4, midY);
  ctx.lineTo(BLADE_W - 4, midY);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  return Texture.from(canvas);
}

function createHubTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = HUB_S;
  canvas.height = HUB_S;
  const ctx = canvas.getContext('2d')!;

  const r = HUB_S / 2 - 1;
  const grad = ctx.createRadialGradient(HUB_S / 2 - 2, HUB_S / 2 - 2, 0, HUB_S / 2, HUB_S / 2, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.6, '#e8e8e8');
  grad.addColorStop(1, '#c0c0c0');
  ctx.beginPath();
  ctx.arc(HUB_S / 2, HUB_S / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.stroke();

  return Texture.from(canvas);
}

export interface WindTurbineEntry {
  screenX: number;
  screenY: number;
  level: number;
  tileX: number;
  tileY: number;
}

export class PixiWindTurbineLayer {
  private app: Application | null = null;
  private towerContainer: Container | null = null;
  private bladeBackContainer: Container | null = null;   // blades BEHIND nacelle
  private bladeFrontContainer: Container | null = null;  // blades IN FRONT of nacelle
  private hubContainer: Container | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  // Sprite pools
  private towerPool: Sprite[] = [];
  private towerIndex = 0;
  private bladeBackPool: Sprite[] = [];
  private bladeBackIndex = 0;
  private bladeFrontPool: Sprite[] = [];
  private bladeFrontIndex = 0;
  private hubPool: Sprite[] = [];
  private hubIndex = 0;

  // Shared textures (created once)
  private towerTex: Texture | null = null;
  private bladeTex: Texture | null = null;
  private hubTex: Texture | null = null;

  // Animation state
  private _bladeAngle = 0;
  private _lastTime = 0;

  private _pendingResize: { w: number; h: number; cw: number; ch: number } | null = null;

  // Tile dimensions (must match types.ts constants)
  private static readonly TILE_W = 64;
  private static readonly TILE_H = 38.4; // 64 * 0.60

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
        antialias: true,
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

      // Layer order: back blades → tower+nacelle → front blades → hub
      this.bladeBackContainer = new Container();
      this.towerContainer = new Container();
      this.bladeFrontContainer = new Container();
      this.hubContainer = new Container();

      this.app.stage.addChild(this.bladeBackContainer);
      this.app.stage.addChild(this.towerContainer);
      this.app.stage.addChild(this.bladeFrontContainer);
      this.app.stage.addChild(this.hubContainer);

      this.app.ticker.stop();

      // Create shared textures
      this.towerTex = createTowerTexture();
      this.bladeTex = createBladeTexture();
      this.hubTex = createHubTexture();

      this._initialized = true;
    } catch (err) {
      console.error('[PixiWindTurbineLayer] init failed:', err);
    }
  }

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

  /**
   * Call once per frame before adding turbines.
   * windSpeed: km/h from server weather
   */
  beginFrame(dpr: number, zoom: number, offsetX: number, offsetY: number, windSpeed: number): void {
    if (!this.app || !this.bladeBackContainer || !this.bladeFrontContainer || !this.towerContainer || !this.hubContainer) return;

    // Advance blade angle
    const now = performance.now() / 1000;
    const dt = this._lastTime > 0 ? Math.min(now - this._lastTime, 0.1) : 0;
    this._lastTime = now;

    // ArcGIS RPM formula: tipSpeedRatio=6.0, bladeLength=60m (matches ArcGIS sample scale)
    // windSpeed is km/h → convert to m/s
    const windSpeedMs = windSpeed / 3.6;
    const tipSpeedRatio = 6.0;
    const bladeLength = 60; // metres (ArcGIS sample reference scale)
    // Cut-out above 25 m/s; always keep a minimum visual RPM of 1.5 so turbines
    // don't look frozen in the game even at very low wind (minimum 1 km/h)
    const clampedWind = Math.max(0, Math.min(windSpeedMs, 25));
    const physicalRpm = (60 * clampedWind * tipSpeedRatio) / (Math.PI * 2 * bladeLength);
    const rpm = windSpeedMs > 0 ? Math.max(1.5, physicalRpm) : 0;
    this._bladeAngle += (rpm / 60) * Math.PI * 2 * dt;

    // Reset pools
    this.towerIndex = 0;
    this.bladeBackIndex = 0;
    this.bladeFrontIndex = 0;
    this.hubIndex = 0;

    // Apply camera transform to all containers
    const s = dpr * zoom;
    for (const c of [this.bladeBackContainer, this.towerContainer, this.bladeFrontContainer, this.hubContainer]) {
      c.scale.set(s);
      c.position.set(offsetX * dpr, offsetY * dpr);
    }
  }

  /** Add one wind turbine at the given screen position (top-left of tile bounding box). */
  addTurbine(entry: WindTurbineEntry): void {
    if (!this.towerTex || !this.bladeTex || !this.hubTex) return;
    if (!this.bladeBackContainer || !this.bladeFrontContainer || !this.towerContainer || !this.hubContainer) return;

    const { screenX, screenY, level } = entry;
    const TW = PixiWindTurbineLayer.TILE_W;
    const TH = PixiWindTurbineLayer.TILE_H;

    // Centre of the tile diamond
    const cx = screenX + TW / 2;
    // Base of tower sits just above the bottom point of the diamond
    const baseY = screenY + TH * 0.82;

    // Scale turbine with level (L1 = 0.9, L5 = 1.3)
    const scale = 0.88 + (level - 1) * 0.10;

    // Visual tower height in game units
    const towerRendH = 96 * scale;
    const texScale = towerRendH / TOWER_H;

    // Hub sits at the FRONT FACE of the nacelle (NAC_FRONT_X, NAC_FRONT_Y in texture).
    // In screen space the tower sprite is anchor(0.5,1) at (cx, baseY).
    const hubX = cx + (NAC_FRONT_X - TOWER_W / 2) * texScale;
    const hubY = baseY - towerRendH + NAC_FRONT_Y * texScale;

    // ── Tower sprite ──
    const tower = this.acquireSprite(this.towerPool, this.towerContainer);
    tower.texture = this.towerTex;
    tower.anchor.set(0.5, 1); // bottom-center anchor
    tower.x = cx;
    tower.y = baseY;
    // Scale so rendered height matches towerRendH (X and Y same — no artificial widening)
    const towerScaleY = towerRendH / TOWER_H;
    tower.scale.set(towerScaleY, towerScaleY);
    tower.alpha = 1;
    this.towerIndex++;

    // ── 3 Blade sprites ──
    // Rotor spins in a near-vertical plane (like a real windmill).
    // PERSP_Y: how much vertical sweep vs horizontal (1.0 = perfect circle / fully front-facing rotor).
    // Using 0.82 gives a slight isometric compression while keeping the rotation clearly vertical.
    const PERSP_Y = 0.82;
    const bladeLen = 62 * scale;
    const bladeScaleBase = bladeLen / BLADE_W;

    for (let i = 0; i < 3; i++) {
      const theta = this._bladeAngle + (i * (Math.PI * 2) / 3);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Tip traces an ellipse: full width horizontally, slightly compressed vertically
      const tipDx = cosT;
      const tipDy = sinT * PERSP_Y;
      const screenAngle = Math.atan2(tipDy, tipDx);

      // Edge-on effect: blade appears thin when horizontal (sinT ≈ 0), full-width when vertical
      const edgeFactor = 0.18 + 0.82 * Math.abs(sinT);

      // sinT > 0 → blade tip moving downward = going AWAY from viewer → behind tower
      // sinT < 0 → blade tip moving upward  = coming TOWARD viewer  → in front of tower
      const isBehind = sinT > 0;
      const alpha = isBehind ? 0.70 : 1.0;

      const blade = isBehind
        ? this.acquireSprite(this.bladeBackPool, this.bladeBackContainer)
        : this.acquireSprite(this.bladeFrontPool, this.bladeFrontContainer);
      blade.texture = this.bladeTex;
      blade.anchor.set(0.04, 0.5);
      blade.x = hubX;
      blade.y = hubY;
      blade.rotation = screenAngle;
      blade.scale.set(bladeScaleBase, bladeScaleBase * edgeFactor);
      blade.alpha = alpha;
      if (isBehind) this.bladeBackIndex++; else this.bladeFrontIndex++;
    }

    // ── Hub cap sprite (white disc on nacelle front face) ──
    const hub = this.acquireSprite(this.hubPool, this.hubContainer);
    hub.texture = this.hubTex;
    hub.anchor.set(0.5, 0.5);
    hub.x = hubX;
    hub.y = hubY;
    hub.scale.set(scale * 0.72);
    hub.alpha = 1;
    this.hubIndex++;
  }

  endFrame(): void {
    if (!this.app) return;

    // Hide unused pooled sprites
    for (let i = this.towerIndex; i < this.towerPool.length; i++) {
      this.towerPool[i].visible = false;
      this.towerPool[i].renderable = false;
    }
    for (let i = this.bladeBackIndex; i < this.bladeBackPool.length; i++) {
      this.bladeBackPool[i].visible = false;
      this.bladeBackPool[i].renderable = false;
    }
    for (let i = this.bladeFrontIndex; i < this.bladeFrontPool.length; i++) {
      this.bladeFrontPool[i].visible = false;
      this.bladeFrontPool[i].renderable = false;
    }
    for (let i = this.hubIndex; i < this.hubPool.length; i++) {
      this.hubPool[i].visible = false;
      this.hubPool[i].renderable = false;
    }

    this.app.render();
  }

  private acquireSprite(pool: Sprite[], container: Container): Sprite {
    const index = pool === this.towerPool ? this.towerIndex
      : pool === this.bladeBackPool ? this.bladeBackIndex
      : pool === this.bladeFrontPool ? this.bladeFrontIndex
      : this.hubIndex;

    let s: Sprite;
    if (index < pool.length) {
      s = pool[index];
    } else {
      s = new Sprite();
      container.addChild(s);
      pool.push(s);
    }
    s.visible = true;
    s.renderable = true;
    return s;
  }

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;
    this._canvas = null;
    this.towerPool = [];
    this.bladeBackPool = [];
    this.bladeFrontPool = [];
    this.hubPool = [];
    this.towerContainer = null;
    this.bladeBackContainer = null;
    this.bladeFrontContainer = null;
    this.hubContainer = null;
    if (this.app) {
      try { this.app.destroy(); } catch { /* ignore */ }
      this.app = null;
    }
  }
}
