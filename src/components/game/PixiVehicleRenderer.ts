'use client';

import { Application, Graphics, Container, RenderTexture, Sprite, Texture } from 'pixi.js';

export type VehicleEntry = {
  x: number;
  y: number;
  angle: number;
  color: string;
  type: 'car' | 'bus' | 'emergency_fire' | 'emergency_police' | 'emergency_ambulance' | 'werkhof_truck' | 'garbage_truck';
  flashTimer?: number;
};

const HEADLIGHT_RADIUS = 18;
const HEADLIGHT_CONE_LENGTH = 32;
export class PixiVehicleRenderer {
  private app: Application | null = null;
  private vehicleContainer: Container | null = null;
  private lightContainer: Container | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _canvas: HTMLCanvasElement | null = null;

  private vehicleSpritePool: Sprite[] = [];
  private vehicleSpriteIndex = 0;
  private lightSpritePool: Sprite[] = [];
  private lightSpriteIndex = 0;

  private carTexCache = new Map<string, Texture>();
  private busTexCache = new Map<string, Texture>();
  private fireTexture: Texture | null = null;
  private policeTexture: Texture | null = null;
  private ambulanceTexture: Texture | null = null;
  private headlightTexture: Texture | null = null;
  private emergencyGlowWhiteTexture: Texture | null = null;
  private emergencyGlowRedTexture: Texture | null = null;
  private emergencyGlowBlueTexture: Texture | null = null;

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

      this.lightContainer = new Container();
      this.lightContainer.blendMode = 'add';
      this.app.stage.addChild(this.lightContainer);

      this.vehicleContainer = new Container();
      this.app.stage.addChild(this.vehicleContainer);

      this.app.ticker.stop();

      this.createHeadlightTexture();
      this.createEmergencyGlowTextures();

      this._initialized = true;
    } catch (err) {
      console.error('[PixiVehicleRenderer] init failed:', err);
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
    if (!this.app || !this.vehicleContainer || !this.lightContainer) return;
    this.vehicleSpriteIndex = 0;
    this.lightSpriteIndex = 0;

    this.app.stage.scale.set(dpr * zoom);
    this.app.stage.position.set(offsetX * dpr, offsetY * dpr);
  }

  addVehicle(entry: VehicleEntry, isNight: boolean): void {
    if (!this.vehicleContainer || !this.app) return;

    const tex = this.getVehicleTexture(entry);
    if (!tex) return;

    const sprite = this.acquireVehicleSprite();
    sprite.texture = tex;
    sprite.anchor.set(0.5, 0.5);
    sprite.x = entry.x;
    sprite.y = entry.y;
    sprite.rotation = entry.angle;
    sprite.alpha = 1;

    if (entry.type === 'emergency_fire' || entry.type === 'emergency_police' || entry.type === 'emergency_ambulance') {
      const flashOn = Math.sin(entry.flashTimer ?? 0) > 0;
      const flashOn2 = Math.sin((entry.flashTimer ?? 0) + Math.PI) > 0;

      if (flashOn || flashOn2) {
        const glowTex = entry.type === 'emergency_fire'
          ? this.emergencyGlowRedTexture
          : entry.type === 'emergency_ambulance'
            ? (flashOn ? this.emergencyGlowRedTexture : this.emergencyGlowWhiteTexture)
            : (flashOn ? this.emergencyGlowRedTexture : this.emergencyGlowBlueTexture);
        if (glowTex) {
          const glow = this.acquireLightSprite();
          glow.texture = glowTex;
          glow.anchor.set(0.5, 0.5);
          glow.x = entry.x;
          glow.y = entry.y;
          glow.rotation = 0;
          glow.alpha = 0.6;
          glow.scale.set(1.5);
        }
      }
    }

    if (isNight && this.headlightTexture) {
      const cosA = Math.cos(entry.angle);
      const sinA = Math.sin(entry.angle);
      const frontOffset = entry.type === 'bus' ? 14 : 8;

      const hlLeft = this.acquireLightSprite();
      hlLeft.texture = this.headlightTexture;
      hlLeft.anchor.set(0.3, 0.5);
      hlLeft.x = entry.x + cosA * frontOffset - sinA * 2;
      hlLeft.y = entry.y + sinA * frontOffset + cosA * 2;
      hlLeft.rotation = entry.angle;
      hlLeft.alpha = 0.55;
      hlLeft.scale.set(0.8, 0.5);

      const hlRight = this.acquireLightSprite();
      hlRight.texture = this.headlightTexture;
      hlRight.anchor.set(0.3, 0.5);
      hlRight.x = entry.x + cosA * frontOffset + sinA * 2;
      hlRight.y = entry.y + sinA * frontOffset - cosA * 2;
      hlRight.rotation = entry.angle;
      hlRight.alpha = 0.55;
      hlRight.scale.set(0.8, 0.5);

      const tailLeft = this.acquireLightSprite();
      tailLeft.texture = this.headlightTexture;
      tailLeft.anchor.set(0.5, 0.5);
      tailLeft.x = entry.x - cosA * frontOffset - sinA * 2;
      tailLeft.y = entry.y - sinA * frontOffset + cosA * 2;
      tailLeft.rotation = entry.angle;
      tailLeft.alpha = 0.25;
      tailLeft.scale.set(0.2, 0.15);
      tailLeft.tint = 0xff2222;

      const tailRight = this.acquireLightSprite();
      tailRight.texture = this.headlightTexture;
      tailRight.anchor.set(0.5, 0.5);
      tailRight.x = entry.x - cosA * frontOffset + sinA * 2;
      tailRight.y = entry.y - sinA * frontOffset - cosA * 2;
      tailRight.rotation = entry.angle;
      tailRight.alpha = 0.25;
      tailRight.scale.set(0.2, 0.15);
      tailRight.tint = 0xff2222;
    }
  }

  endFrame(): void {
    if (!this.app) return;

    for (let i = this.vehicleSpriteIndex; i < this.vehicleSpritePool.length; i++) {
      this.vehicleSpritePool[i].visible = false;
      this.vehicleSpritePool[i].renderable = false;
    }
    for (let i = this.lightSpriteIndex; i < this.lightSpritePool.length; i++) {
      this.lightSpritePool[i].visible = false;
      this.lightSpritePool[i].renderable = false;
    }

    this.app.render();
  }

  hide(): void {
    if (!this._canvas) return;
    this._canvas.style.display = 'none';
  }

  show(): void {
    if (!this._canvas) return;
    this._canvas.style.display = '';
  }

  private getVehicleTexture(entry: VehicleEntry): Texture | null {
    if (!this.app) return null;

    switch (entry.type) {
      case 'car': {
        let tex = this.carTexCache.get(entry.color);
        if (!tex) {
          tex = this.renderCarTexture(entry.color);
          this.carTexCache.set(entry.color, tex);
        }
        return tex;
      }
      case 'bus': {
        let tex = this.busTexCache.get(entry.color);
        if (!tex) {
          tex = this.renderBusTexture(entry.color);
          this.busTexCache.set(entry.color, tex);
        }
        return tex;
      }
      case 'emergency_fire': {
        if (!this.fireTexture) this.fireTexture = this.renderFireTruckTexture();
        return this.fireTexture;
      }
      case 'emergency_police': {
        if (!this.policeTexture) this.policeTexture = this.renderPoliceCarTexture();
        return this.policeTexture;
      }
      case 'emergency_ambulance': {
        if (!this.ambulanceTexture) this.ambulanceTexture = this.renderAmbulanceTexture();
        return this.ambulanceTexture;
      }
      case 'werkhof_truck': {
        // Orange Reparatur-LKW (Bus-Form, orange)
        let tex = this.busTexCache.get('__werkhof__');
        if (!tex) {
          tex = this.renderWerkhofTruckTexture();
          this.busTexCache.set('__werkhof__', tex);
        }
        return tex;
      }
      case 'garbage_truck': {
        // Grün-gelber Müllwagen (Bus-Form, gelbgrün)
        let tex = this.busTexCache.get('__garbage__');
        if (!tex) {
          tex = this.renderGarbageTruckTexture();
          this.busTexCache.set('__garbage__', tex);
        }
        return tex;
      }
    }
  }

  private renderCarTexture(color: string): Texture {
    const s = 0.5;
    const pad = 4;
    const w = (24 + pad * 2) * s;
    const h = (14 + pad * 2) * s;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    g.poly([
      { x: ox + -10 * s, y: oy + -5 * s },
      { x: ox + 10 * s,  y: oy + -5 * s },
      { x: ox + 12 * s,  y: oy },
      { x: ox + 10 * s,  y: oy + 5 * s },
      { x: ox + -10 * s, y: oy + 5 * s },
    ]);
    g.fill(color);

    g.rect(ox + -4 * s, oy + -2.8 * s, 7 * s, 5.6 * s);
    g.fill('rgba(255,255,255,0.6)');

    g.rect(ox + -10 * s, oy + -4 * s, 2.4 * s, 8 * s);
    g.fill('#111827');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private renderBusTexture(color: string): Texture {
    const s = 0.6;
    const length = 20 * s;
    const width = 7 * s;
    const pad = 4;
    const w = length * 2 + pad * 2;
    const h = width * 2 + pad * 2;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    g.rect(ox - length, oy - width, length * 2, width * 2);
    g.fill(color);

    g.rect(ox - length * 0.8, oy - width * 0.7, length * 1.4, width * 0.9);
    g.fill('rgba(255,255,255,0.25)');

    for (let i = 0; i < 4; i++) {
      const wx = ox - length * 0.7 + i * length * 0.45;
      g.rect(wx, oy - width * 0.55, length * 0.25, width * 1.1);
      g.fill('rgba(191,219,254,0.8)');
    }

    g.rect(ox - length * 0.95, oy - width * 0.9, length * 0.1, width * 1.8);
    g.fill('#111827');

    g.rect(ox + length * 0.85, oy - width * 0.35, length * 0.1, width * 0.7);
    g.fill('#fbbf24');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private renderWerkhofTruckTexture(): Texture {
    // Orange Bauhof-LKW — Bus-Form mit Werkzeug-Streifen
    const s = 0.6;
    const length = 20 * s;
    const width = 7 * s;
    const pad = 4;
    const w = length * 2 + pad * 2;
    const h = width * 2 + pad * 2;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    // Hauptkörper orange
    g.rect(ox - length, oy - width, length * 2, width * 2);
    g.fill('#f97316');

    // Dunkler Streifen oben (Werkhof-Markierung)
    g.rect(ox - length * 0.95, oy - width, length * 1.9, width * 0.3);
    g.fill('#c2410c');

    // Kabine vorne
    g.rect(ox + length * 0.55, oy - width * 0.85, length * 0.4, width * 1.7);
    g.fill('#ea580c');

    // Frontscheibe
    g.rect(ox + length * 0.6, oy - width * 0.6, length * 0.25, width * 1.2);
    g.fill('rgba(191,219,254,0.7)');

    // Warnstreifen gelb-schwarz
    for (let i = 0; i < 3; i++) {
      const wx = ox - length * 0.85 + i * length * 0.55;
      g.rect(wx, oy - width * 0.25, length * 0.25, width * 0.5);
      g.fill(i % 2 === 0 ? '#fbbf24' : '#111827');
    }

    // Hinterräder (dunkel)
    g.rect(ox - length * 0.95, oy - width * 0.9, length * 0.12, width * 1.8);
    g.fill('#111827');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private renderGarbageTruckTexture(): Texture {
    // Grün-gelber Müllwagen — breiter Bus mit Aufbau hinten
    const s = 0.6;
    const length = 20 * s;
    const width = 8 * s;
    const pad = 4;
    const w = length * 2 + pad * 2;
    const h = width * 2 + pad * 2;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    // Hauptkörper grün
    g.rect(ox - length, oy - width, length * 2, width * 2);
    g.fill('#16a34a');

    // Müll-Container-Aufbau hinten (dunkler grün)
    g.rect(ox - length, oy - width * 0.95, length * 1.1, width * 1.9);
    g.fill('#15803d');

    // Kabine vorne
    g.rect(ox + length * 0.5, oy - width * 0.85, length * 0.45, width * 1.7);
    g.fill('#166534');

    // Frontscheibe
    g.rect(ox + length * 0.55, oy - width * 0.6, length * 0.25, width * 1.2);
    g.fill('rgba(191,219,254,0.7)');

    // Warnstreifen gelb
    g.rect(ox - length * 0.15, oy - width * 0.15, length * 0.6, width * 0.3);
    g.fill('#fbbf24');

    // Hinterräder
    g.rect(ox - length * 0.95, oy - width * 0.9, length * 0.12, width * 1.8);
    g.fill('#111827');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private renderFireTruckTexture(): Texture {
    const s = 0.6;
    const length = 14;
    const pad = 10;
    const w = (length * 2 + pad * 2) * s;
    const h = (14 + pad * 2) * s;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    g.poly([
      { x: ox + -length * s, y: oy + -5 * s },
      { x: ox + length * s,  y: oy + -5 * s },
      { x: ox + (length + 2) * s, y: oy },
      { x: ox + length * s,  y: oy + 5 * s },
      { x: ox + -length * s, y: oy + 5 * s },
    ]);
    g.fill('#dc2626');

    g.rect(ox + -length * s * 0.5, oy + -3 * s, length * s, 6 * s * 0.3);
    g.fill('#fbbf24');

    g.rect(ox + -2 * s, oy + -3 * s, 5 * s, 6 * s);
    g.fill('rgba(200,220,255,0.7)');

    g.rect(ox + -length * s, oy + -4 * s, 2 * s, 8 * s);
    g.fill('#111827');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private renderPoliceCarTexture(): Texture {
    const s = 0.6;
    const length = 11;
    const pad = 10;
    const w = (length * 2 + pad * 2) * s;
    const h = (14 + pad * 2) * s;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    g.poly([
      { x: ox + -length * s, y: oy + -5 * s },
      { x: ox + length * s,  y: oy + -5 * s },
      { x: ox + (length + 2) * s, y: oy },
      { x: ox + length * s,  y: oy + 5 * s },
      { x: ox + -length * s, y: oy + 5 * s },
    ]);
    g.fill('#1e40af');

    g.rect(ox + -length * s * 0.5, oy + -3 * s, length * s, 6 * s * 0.3);
    g.fill('#ffffff');

    g.rect(ox + -2 * s, oy + -3 * s, 5 * s, 6 * s);
    g.fill('rgba(200,220,255,0.7)');

    g.rect(ox + -length * s, oy + -4 * s, 2 * s, 8 * s);
    g.fill('#111827');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private renderAmbulanceTexture(): Texture {
    const s = 0.6;
    const length = 13;
    const pad = 10;
    const w = (length * 2 + pad * 2) * s;
    const h = (14 + pad * 2) * s;
    const g = new Graphics();
    const ox = w / 2;
    const oy = h / 2;

    g.poly([
      { x: ox + -length * s, y: oy + -5 * s },
      { x: ox + length * s,  y: oy + -5 * s },
      { x: ox + (length + 2) * s, y: oy },
      { x: ox + length * s,  y: oy + 5 * s },
      { x: ox + -length * s, y: oy + 5 * s },
    ]);
    g.fill('#f0f0f0');

    // Red cross
    g.rect(ox - 1 * s, oy - 3.5 * s, 2 * s, 7 * s);
    g.fill('#dc2626');
    g.rect(ox - 3.5 * s, oy - 1 * s, 7 * s, 2 * s);
    g.fill('#dc2626');

    g.rect(ox + -2 * s, oy + -3 * s, 5 * s, 6 * s);
    g.fill('rgba(200,220,255,0.5)');

    g.rect(ox + -length * s, oy + -4 * s, 2 * s, 8 * s);
    g.fill('#111827');

    return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private createHeadlightTexture(): void {
    if (!this.app) return;
    const g = new Graphics();
    const w = HEADLIGHT_CONE_LENGTH * 2;
    const h = HEADLIGHT_RADIUS * 2;
    const cx = w / 2;
    const cy = h / 2;

    g.ellipse(cx + 6, cy, HEADLIGHT_CONE_LENGTH * 0.6, HEADLIGHT_RADIUS * 0.4);
    g.fill({ color: 0xffffcc, alpha: 0.5 });

    g.ellipse(cx + 4, cy, HEADLIGHT_CONE_LENGTH * 0.35, HEADLIGHT_RADIUS * 0.25);
    g.fill({ color: 0xffffff, alpha: 0.4 });

    this.headlightTexture = this.app.renderer.generateTexture({ target: g, resolution: 2 });
  }

  private createEmergencyGlowTextures(): void {
    if (!this.app) return;

    const makeGlow = (color: number): Texture => {
      const g = new Graphics();
      g.circle(16, 16, 16);
      g.fill({ color, alpha: 0.4 });
      g.circle(16, 16, 8);
      g.fill({ color, alpha: 0.6 });
      return this.app!.renderer.generateTexture({ target: g, resolution: 2 });
    };

    this.emergencyGlowRedTexture = makeGlow(0xff0000);
    this.emergencyGlowBlueTexture = makeGlow(0x0066ff);
    this.emergencyGlowWhiteTexture = makeGlow(0xffffff);
  }

  private acquireVehicleSprite(): Sprite {
    let sprite: Sprite;
    if (this.vehicleSpriteIndex < this.vehicleSpritePool.length) {
      sprite = this.vehicleSpritePool[this.vehicleSpriteIndex];
    } else {
      sprite = new Sprite();
      this.vehicleContainer!.addChild(sprite);
      this.vehicleSpritePool.push(sprite);
    }
    this.vehicleSpriteIndex++;
    sprite.visible = true;
    sprite.renderable = true;
    sprite.tint = 0xffffff;
    sprite.blendMode = 'normal';
    return sprite;
  }

  private acquireLightSprite(): Sprite {
    let sprite: Sprite;
    if (this.lightSpriteIndex < this.lightSpritePool.length) {
      sprite = this.lightSpritePool[this.lightSpriteIndex];
    } else {
      sprite = new Sprite();
      this.lightContainer!.addChild(sprite);
      this.lightSpritePool.push(sprite);
    }
    this.lightSpriteIndex++;
    sprite.visible = true;
    sprite.renderable = true;
    sprite.tint = 0xffffff;
    return sprite;
  }

  destroy(): void {
    this._destroyed = true;
    this._initialized = false;
    this._canvas = null;
    this.vehicleSpritePool = [];
    this.lightSpritePool = [];
    this.vehicleContainer = null;
    this.lightContainer = null;
    this.carTexCache.clear();
    this.busTexCache.clear();
    this.fireTexture = null;
    this.policeTexture = null;
    this.ambulanceTexture = null;
    this.headlightTexture = null;
    this.emergencyGlowRedTexture = null;
    this.emergencyGlowBlueTexture = null;
    this.emergencyGlowWhiteTexture = null;
    if (this.app) {
      try { this.app.destroy(); } catch { /* may not be fully initialized */ }
      this.app = null;
    }
  }
}
