'use client';

import {
  Application, Container, Sprite, Texture, Graphics, BlurFilter,
} from 'pixi.js';
import type { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  NON_LIT_BUILDING_TYPES,
  RESIDENTIAL_BUILDING_TYPES,
  COMMERCIAL_BUILDING_TYPES,
} from './constants';
import { gridToScreen } from './utils';
import { getDarkness, getAmbientColor, pseudoRandom, isWindowLit } from './lightingSystem';

// ============================================================================
// SOFT GLOW TEXTURE (shared cache)
// ============================================================================

const glowTextureCache = new Map<string, Texture>();

function getGlowTexture(size: number, r: number, g: number, b: number, falloffPower = 2.0): Texture {
  const key = `${size}_${r}_${g}_${b}_${falloffPower}`;
  const cached = glowTextureCache.get(key);
  if (cached) return cached;

  const d = size * 2;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size, size, 0, size, size, size);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  if (falloffPower <= 1.5) {
    grad.addColorStop(0.2, `rgba(${r},${g},${b},0.85)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.4)`);
    grad.addColorStop(0.75, `rgba(${r},${g},${b},0.12)`);
  } else {
    grad.addColorStop(0.15, `rgba(${r},${g},${b},0.9)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},0.2)`);
    grad.addColorStop(0.8, `rgba(${r},${g},${b},0.04)`);
  }
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, d, d);

  const tex = Texture.from(canvas);
  glowTextureCache.set(key, tex);
  return tex;
}

// Pre-built textures sizes
const GLOW_SIZE_ROAD = 64;
const GLOW_SIZE_WINDOW = 32;
const GLOW_SIZE_GROUND = 96;
const GLOW_SIZE_SPECIAL = 80;
const GLOW_SIZE_WINDOW_WARM = 24;

// ============================================================================
// LIGHT TYPES & COLORS
// ============================================================================

const SPECIAL_GLOW_COLORS: Record<string, { r: number; g: number; b: number; radius: number; pulse: boolean }> = {
  hospital:       { r: 255, g: 70, b: 70, radius: 40, pulse: true },
  fire_station:   { r: 255, g: 100, b: 40, radius: 35, pulse: true },
  police_station: { r: 50, g: 130, b: 255, radius: 35, pulse: true },
  power_plant:    { r: 255, g: 200, b: 40, radius: 45, pulse: false },
};

// ============================================================================
// PIXI LIGHTING LAYER
// ============================================================================

interface LightSprite {
  sprite: Sprite;
  active: boolean;
}

export class PixiLightingLayer {
  private app: Application | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  // Containers
  private darknessGfx: Graphics | null = null;
  private lightsContainer: Container | null = null;
  private glowContainer: Container | null = null;
  private bloomContainer: Container | null = null;

  // Sprite pools
  private roadPool: LightSprite[] = [];
  private windowPool: LightSprite[] = [];
  private groundPool: LightSprite[] = [];
  private specialPool: LightSprite[] = [];
  private bloomPool: LightSprite[] = [];

  // State
  private lastDarkness = -1;
  private frameTime = 0;

  // Textures (lazy init)
  private texRoadWhite: Texture | null = null;
  private texRoadWarm: Texture | null = null;
  private texWindowWhite: Texture | null = null;
  private texWindowWarm: Texture | null = null;
  private texGround: Texture | null = null;
  private texSpecial: Record<string, Texture> = {};

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

      if (this._destroyed) { this.app.destroy(); this.app = null; return; }

      this._canvas = this.app.canvas as HTMLCanvasElement;
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.left = '0';
      this._canvas.style.pointerEvents = 'none';

      // Darkness overlay (full-screen tinted rect)
      this.darknessGfx = new Graphics();
      this.app.stage.addChild(this.darknessGfx);

      // Main lights — erase blend to cut holes in the darkness
      this.lightsContainer = new Container();
      this.app.stage.addChild(this.lightsContainer);

      // Colored glows (additive) on top of the darkened scene
      this.glowContainer = new Container();
      this.app.stage.addChild(this.glowContainer);

      // Bloom = blurred duplicate of glow for soft light bleed
      this.bloomContainer = new Container();
      this.bloomContainer.filters = [new BlurFilter({ strength: 16, quality: 4 })];
      this.bloomContainer.alpha = 0.45;
      this.app.stage.addChild(this.bloomContainer);

      this.initTextures();

      this._initialized = true;
    } catch {
      this._initialized = false;
    }
  }

  private initTextures(): void {
    this.texRoadWhite = getGlowTexture(GLOW_SIZE_ROAD, 255, 240, 210, 2.0);
    this.texRoadWarm = getGlowTexture(GLOW_SIZE_ROAD, 255, 200, 120, 1.5);
    this.texWindowWhite = getGlowTexture(GLOW_SIZE_WINDOW, 255, 245, 220, 2.5);
    this.texWindowWarm = getGlowTexture(GLOW_SIZE_WINDOW_WARM, 255, 220, 150, 1.2);
    this.texGround = getGlowTexture(GLOW_SIZE_GROUND, 255, 230, 180, 2.0);

    for (const [type, def] of Object.entries(SPECIAL_GLOW_COLORS)) {
      this.texSpecial[type] = getGlowTexture(GLOW_SIZE_SPECIAL, def.r, def.g, def.b, 1.5);
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

  // -------------------------------------------------------------------
  // Sprite pool helpers
  // -------------------------------------------------------------------

  private getFromPool(
    pool: LightSprite[],
    parent: Container,
    tex: Texture,
  ): Sprite {
    for (const item of pool) {
      if (!item.active) {
        item.active = true;
        item.sprite.texture = tex;
        item.sprite.visible = true;
        return item.sprite;
      }
    }
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    parent.addChild(sprite);
    pool.push({ sprite, active: true });
    return sprite;
  }

  private deactivatePool(pool: LightSprite[]): void {
    for (const item of pool) {
      if (item.active) {
        item.active = false;
        item.sprite.visible = false;
      }
    }
  }

  private addBloomSprite(tex: Texture, x: number, y: number, scaleX: number, scaleY: number, alpha: number): void {
    if (!this.bloomContainer) return;
    const s = this.getFromPool(this.bloomPool, this.bloomContainer, tex);
    s.position.set(x, y);
    s.scale.set(scaleX * 1.5, (scaleY ?? scaleX) * 1.5);
    s.alpha = alpha;
    s.blendMode = 'add';
  }

  // -------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------

  render(
    grid: Tile[][],
    gridSize: number,
    offset: { x: number; y: number },
    zoom: number,
    canvasWidth: number,
    canvasHeight: number,
    visualHour: number,
    isMobile: boolean,
    isPanning: boolean,
  ): void {
    if (!this._initialized || !this.app) return;

    const darkness = getDarkness(visualHour);
    this.frameTime += 0.016;

    // --- Clear everything when daylight ---
    if (darkness <= 0.01) {
      if (this.darknessGfx) {
        this.darknessGfx.clear();
      }
      this.deactivatePool(this.roadPool);
      this.deactivatePool(this.windowPool);
      this.deactivatePool(this.groundPool);
      this.deactivatePool(this.specialPool);
      this.deactivatePool(this.bloomPool);
      this.lastDarkness = 0;
      return;
    }


    const dpr = window.devicePixelRatio || 1;
    const ambient = getAmbientColor(visualHour);
    const lightIntensity = Math.min(1, darkness * 1.3);

    // Use actual renderer dimensions to guarantee full coverage
    const rw = this.app.renderer.width;
    const rh = this.app.renderer.height;

    // --- Darkness overlay ---
    if (this.darknessGfx) {
      const alpha = darkness * 0.6;
      this.darknessGfx.clear();
      this.darknessGfx.rect(0, 0, rw, rh);
      this.darknessGfx.fill({
        color: (ambient.r << 16) | (ambient.g << 8) | ambient.b,
        alpha,
      });
    }

    // Deactivate all pools before re-populating
    this.deactivatePool(this.roadPool);
    this.deactivatePool(this.windowPool);
    this.deactivatePool(this.groundPool);
    this.deactivatePool(this.specialPool);
    this.deactivatePool(this.bloomPool);

    // --- Viewport bounds ---
    const viewWidth = canvasWidth / (dpr * zoom);
    const viewHeight = canvasHeight / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
    const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
    const visibleMaxSum = Math.min(gridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));

    const roadSampleRate = isMobile ? 3 : 1;
    let roadCounter = 0;

    const scaleX = dpr * zoom;
    const scaleY = dpr * zoom;
    const transX = offset.x * dpr;
    const transY = offset.y * dpr;

    // --- Collect & render lights in a single pass ---
    for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
      for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
        const y = sum - x;
        if (y < 0 || y >= gridSize) continue;

        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
            screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
          continue;
        }

        const tile = grid[y][x];
        const buildingType = tile.building.type;
        const tileCenterX = screenX + TILE_WIDTH / 2;
        const tileCenterY = screenY + TILE_HEIGHT / 2;
        const sx = tileCenterX * scaleX + transX;
        const sy = tileCenterY * scaleY + transY;

        if (buildingType === 'road' || buildingType === 'bridge') {
          roadCounter++;
          if (roadCounter % roadSampleRate !== 0) continue;

          // Road light cutout (warm white)
          const roadSprite = this.getFromPool(
            this.roadPool,
            this.lightsContainer!,
            this.texRoadWhite!,
          );
          const roadRadius = 38 * scaleX;
          roadSprite.position.set(sx, sy);
          roadSprite.scale.set(roadRadius / GLOW_SIZE_ROAD);
          roadSprite.alpha = 0.85 * lightIntensity;
          roadSprite.blendMode = 'erase';

          // Road warm glow + bloom
          if (!isMobile) {
            const warmRadius = 28 * scaleX;
            const warmSprite = this.getFromPool(
              this.groundPool,
              this.glowContainer!,
              this.texRoadWarm!,
            );
            warmSprite.position.set(sx, sy);
            warmSprite.scale.set(warmRadius / GLOW_SIZE_ROAD);
            warmSprite.alpha = 0.35 * lightIntensity;
            warmSprite.blendMode = 'add';

            this.addBloomSprite(this.texRoadWarm!, sx, sy, warmRadius / GLOW_SIZE_ROAD, warmRadius / GLOW_SIZE_ROAD, 0.2 * lightIntensity);
          }

        } else if (!NON_LIT_BUILDING_TYPES.has(buildingType) && tile.building.powered) {
          const isResidential = RESIDENTIAL_BUILDING_TYPES.has(buildingType);
          const isCommercial = COMMERCIAL_BUILDING_TYPES.has(buildingType);
          const seed = x * 1000 + y;

          // Window lights (desktop) — dynamic on/off switching
          if (!isMobile) {
            let numWindows = 2;
            if (buildingType.includes('medium') || buildingType.includes('low')) numWindows = 3;
            if (buildingType === 'apartment_high') numWindows = 10;
            else if (buildingType === 'office_high') numWindows = 8;
            else if (buildingType.includes('high') || buildingType === 'mall') numWindows = 6;
            else if (buildingType === 'mansion') numWindows = 4;

            const isHighrise = buildingType === 'apartment_high' || buildingType === 'office_high';
            const spreadX = isHighrise ? 18 : 22;
            const spreadY = isHighrise ? 28 : 16;
            const baseY = isHighrise ? -26 : -18;

            const threshold = isResidential ? 0.55 : 0.75;
            const wallTime = performance.now() / 1000;
            for (let i = 0; i < numWindows; i++) {
              if (!isWindowLit(seed, i, threshold, wallTime)) continue;

              const wx = tileCenterX + (pseudoRandom(seed, i + 10) - 0.5) * spreadX;
              const wy = tileCenterY + baseY + (pseudoRandom(seed, i + 20) - 0.5) * spreadY;
              const wsx = wx * scaleX + transX;
              const wsy = wy * scaleY + transY;

              // Cutout (erase darkness)
              const glowStrength = isCommercial ? 0.9 : isResidential ? 0.65 : 0.75;
              const winCutout = this.getFromPool(
                this.windowPool,
                this.lightsContainer!,
                this.texWindowWhite!,
              );
              const winSize = 14 * scaleX;
              winCutout.position.set(wsx, wsy);
              winCutout.scale.set(winSize / GLOW_SIZE_WINDOW);
              winCutout.alpha = glowStrength * lightIntensity;
              winCutout.blendMode = 'erase';

              // Warm colored glow + bloom
              const warmTex = pseudoRandom(seed, i + 30) > 0.4 ? this.texWindowWarm! : this.texWindowWhite!;
              const winGlow = this.getFromPool(
                this.windowPool,
                this.glowContainer!,
                warmTex,
              );
              const winGlowScale = (winSize * 0.7) / GLOW_SIZE_WINDOW_WARM;
              winGlow.position.set(wsx, wsy);
              winGlow.scale.set(winGlowScale);
              winGlow.alpha = glowStrength * 0.45 * lightIntensity;
              winGlow.blendMode = 'add';

              this.addBloomSprite(warmTex, wsx, wsy, winGlowScale, winGlowScale, glowStrength * 0.25 * lightIntensity);
            }
          }

          // Ground glow below building
          const groundRadius = (isMobile ? TILE_WIDTH * 0.55 : TILE_WIDTH * 0.7) * scaleX;
          const gsy = (tileCenterY + TILE_HEIGHT / 4) * scaleY + transY;
          const groundCutout = this.getFromPool(
            this.groundPool,
            this.lightsContainer!,
            this.texGround!,
          );
          groundCutout.position.set(sx, gsy);
          groundCutout.scale.set(groundRadius / GLOW_SIZE_GROUND, (groundRadius * 0.6) / GLOW_SIZE_GROUND);
          groundCutout.alpha = (isMobile ? 0.45 : 0.35) * lightIntensity;
          groundCutout.blendMode = 'erase';

          // Additive warm ground glow
          if (!isMobile) {
            const groundGlow = this.getFromPool(
              this.groundPool,
              this.glowContainer!,
              this.texGround!,
            );
            groundGlow.position.set(sx, gsy);
            groundGlow.scale.set(groundRadius * 0.7 / GLOW_SIZE_GROUND, (groundRadius * 0.45) / GLOW_SIZE_GROUND);
            groundGlow.alpha = 0.18 * lightIntensity;
            groundGlow.blendMode = 'add';
          }

          // Special building colored glow
          const specialDef = SPECIAL_GLOW_COLORS[buildingType];
          if (specialDef && !isMobile) {
            const specTex = this.texSpecial[buildingType];
            if (specTex) {
              const ssy = (tileCenterY - 15) * scaleY + transY;
              const pulseAlpha = specialDef.pulse
                ? 0.55 + 0.15 * Math.sin(this.frameTime * 2.5 + seed)
                : 0.6;
              const specRadius = specialDef.radius * scaleX;

              const specScale = specRadius / GLOW_SIZE_SPECIAL;
              const specSprite = this.getFromPool(
                this.specialPool,
                this.glowContainer!,
                specTex,
              );
              specSprite.position.set(sx, ssy);
              specSprite.scale.set(specScale);
              specSprite.alpha = pulseAlpha * lightIntensity;
              specSprite.blendMode = 'add';

              this.addBloomSprite(specTex, sx, ssy, specScale, specScale, pulseAlpha * 0.4 * lightIntensity);
            }
          }
        }
      }
    }

    // Bloom alpha scales with light intensity
    if (this.bloomContainer) {
      this.bloomContainer.alpha = 0.4 * lightIntensity;
    }

    this.lastDarkness = darkness;
  }

  destroy(): void {
    this._destroyed = true;
    if (this.app) {
      try { this.app.destroy(true, { children: true, texture: false }); } catch { /* PixiJS v8 race */ }
      this.app = null;
    }
    this.darknessGfx = null;
    this.lightsContainer = null;
    this.glowContainer = null;
    this.bloomContainer = null;
    this.roadPool = [];
    this.windowPool = [];
    this.groundPool = [];
    this.specialPool = [];
    this.bloomPool = [];
    this._canvas = null;
    this._initialized = false;
  }
}
