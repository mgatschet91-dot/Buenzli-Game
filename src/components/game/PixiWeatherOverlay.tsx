'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Application, Container, Graphics, BlurFilter } from 'pixi.js';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'storm' | 'fog' | 'thunderstorm' | 'blizzard' | 'drizzle';

export interface WeatherState {
  type: WeatherType;
  intensity: number;
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
  wind: number;
}

interface SnowFlake {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
  wobblePhase: number;
  wind: number;
}

interface LightningBolt {
  segments: { x1: number; y1: number; x2: number; y2: number }[];
  opacity: number;
  age: number;
  maxAge: number;
  branches: { x1: number; y1: number; x2: number; y2: number }[][];
  flashIntensity: number;
}

const WEATHER_CYCLE_MS = 5 * 60 * 1000;
const WEATHER_STORAGE_KEY = 'meinort-last-weather';

/** Letztes Wetter aus localStorage laden */
function loadCachedWeather(): WeatherState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === 'string' && typeof parsed.intensity === 'number') {
      return { type: parsed.type as WeatherType, intensity: parsed.intensity };
    }
  } catch { /* ignore */ }
  return null;
}

/** Wetter in localStorage cachen */
function saveCachedWeather(w: WeatherState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ type: w.type, intensity: w.intensity }));
  } catch { /* ignore */ }
}

const WEATHER_WEIGHTS: Record<WeatherType, number> = {
  clear: 35,
  rain: 20,
  snow: 8,
  storm: 8,
  fog: 12,
  thunderstorm: 5,
  blizzard: 4,
  drizzle: 8,
};

function pickWeather(): WeatherType {
  const total = Object.values(WEATHER_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [type, weight] of Object.entries(WEATHER_WEIGHTS)) {
    r -= weight;
    if (r <= 0) return type as WeatherType;
  }
  return 'clear';
}

const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: '',
  rain: '🌧️ Regen',
  snow: '❄️ Schnee',
  storm: '⛈️ Sturm',
  fog: '🌫️ Nebel',
  thunderstorm: '⚡ Gewitter',
  blizzard: '🌨️ Schneesturm',
  drizzle: '🌦️ Nieselregen',
};

function generateLightningBolt(w: number, h: number): LightningBolt {
  const startX = w * 0.15 + Math.random() * w * 0.7;
  const segments: LightningBolt['segments'] = [];
  const branches: LightningBolt['branches'] = [];

  let x = startX;
  let y = 0;
  const steps = 8 + Math.floor(Math.random() * 8);
  const stepHeight = h / steps;

  for (let i = 0; i < steps; i++) {
    const newX = x + (Math.random() - 0.5) * 120;
    const newY = y + stepHeight * (0.7 + Math.random() * 0.6);
    segments.push({ x1: x, y1: y, x2: newX, y2: newY });

    if (Math.random() < 0.35 && i > 1) {
      const branchSegs: { x1: number; y1: number; x2: number; y2: number }[] = [];
      let bx = newX;
      let by = newY;
      const bSteps = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < bSteps; j++) {
        const nbx = bx + (Math.random() - 0.5) * 80;
        const nby = by + stepHeight * (0.3 + Math.random() * 0.4);
        branchSegs.push({ x1: bx, y1: by, x2: nbx, y2: nby });
        bx = nbx;
        by = nby;
      }
      branches.push(branchSegs);
    }

    x = newX;
    y = newY;
    if (y >= h) break;
  }

  return {
    segments,
    opacity: 1,
    age: 0,
    maxAge: 0.15 + Math.random() * 0.2,
    branches,
    flashIntensity: 0.5 + Math.random() * 0.5,
  };
}

function getScreenDims() {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const h = typeof window !== 'undefined' ? window.innerHeight : 720;
  return { dpr, w, h, pw: Math.round(w * dpr), ph: Math.round(h * dpr) };
}

function forceDestroyPixiApp(app: Application) {
  try { app.destroy(true); } catch { /* noop */ }
}

interface PixiWeatherOverlayProps {
  debugOverride?: WeatherType | null;
  serverWeather?: { type: string; intensity: number } | null;
  /** Wenn true, wird auf Server-Wetter gewartet statt lokalen Fallback zu starten */
  waitForServer?: boolean;
}

export function PixiWeatherOverlay({ debugOverride, serverWeather, waitForServer = false }: PixiWeatherOverlayProps) {
  const [weatherEnabled, setWeatherEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const stored = localStorage.getItem('meinort-weather-enabled');
      setWeatherEnabled(stored !== 'false');
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initedRef = useRef(false);
  const rainDropsRef = useRef<RainDrop[]>([]);
  const snowFlakesRef = useRef<SnowFlake[]>([]);
  const lightningRef = useRef<LightningBolt[]>([]);
  const lightningTimerRef = useRef(0);
  const fogPhaseRef = useRef(0);
  // Letztes Wetter aus localStorage als Sofort-Fallback (kein Flackern)
  const cachedInitial = useRef<WeatherState>(loadCachedWeather() || { type: 'clear', intensity: 0 });
  const weatherRef = useRef<WeatherState>(cachedInitial.current);
  const lastTimeRef = useRef(0);

  const [weather, setWeather] = useState<WeatherState>(cachedInitial.current);

  const particlesGfxRef = useRef<Graphics | null>(null);
  const overlayGfxRef = useRef<Graphics | null>(null);
  const lightningGfxRef = useRef<Graphics | null>(null);
  const fogGfxRefs = useRef<Graphics[]>([]);

  // Priority: 1. Debug override  2. Server weather  3. Local fallback
  useEffect(() => {
    if (debugOverride != null) {
      const newWeather: WeatherState = { type: debugOverride, intensity: debugOverride === 'clear' ? 0 : 0.7 };
      setWeather(newWeather);
      weatherRef.current = newWeather;
      return;
    }
    if (serverWeather) {
      const validTypes: WeatherType[] = ['clear', 'rain', 'snow', 'storm', 'fog', 'thunderstorm', 'blizzard', 'drizzle'];
      const type = validTypes.includes(serverWeather.type as WeatherType)
        ? (serverWeather.type as WeatherType)
        : 'clear';
      const newWeather: WeatherState = { type, intensity: serverWeather.intensity };
      setWeather(newWeather);
      weatherRef.current = newWeather;
      // In localStorage cachen für nächsten Seitenlade
      saveCachedWeather(newWeather);
    }
  }, [debugOverride, serverWeather?.type, serverWeather?.intensity]);

  // Local fallback cycle when no server weather AND no debug override
  // Im Gemeinde-Modus (waitForServer=true): 10s warten damit Server-Wetter Zeit hat zu laden
  // Im Singleplayer/Sandbox: sofort lokales Random-Wetter starten
  useEffect(() => {
    if (debugOverride != null || serverWeather) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const startFallback = () => {
      const fallback: WeatherState = { type: pickWeather(), intensity: 0.3 + Math.random() * 0.7 };
      setWeather(fallback);
      weatherRef.current = fallback;

      interval = setInterval(() => {
        const next: WeatherState = { type: pickWeather(), intensity: 0.3 + Math.random() * 0.7 };
        setWeather(next);
        weatherRef.current = next;
      }, WEATHER_CYCLE_MS);
    };

    if (waitForServer) {
      // Gemeinde-Modus: 7s warten — wenn bis dahin kein Server-Wetter kam, Fallback starten
      // In der Zwischenzeit zeigt der localStorage-Cache das letzte bekannte Wetter
      const delay = setTimeout(startFallback, 7_000);
      return () => { clearTimeout(delay); if (interval) clearInterval(interval); };
    } else {
      // Singleplayer/Sandbox: sofort starten
      startFallback();
      return () => { if (interval) clearInterval(interval); };
    }
  }, [debugOverride, serverWeather, waitForServer]);

  // --- Build particle arrays for current weather ---
  const rebuildParticles = useCallback(() => {
    const { pw, ph } = getScreenDims();
    const wt = weatherRef.current;
    rainDropsRef.current = [];
    snowFlakesRef.current = [];
    lightningRef.current = [];
    lightningTimerRef.current = 0;

    const isRain = wt.type === 'rain' || wt.type === 'storm' || wt.type === 'thunderstorm' || wt.type === 'drizzle';
    const isSnow = wt.type === 'snow' || wt.type === 'blizzard';

    if (isRain) {
      const baseCount = wt.type === 'storm' || wt.type === 'thunderstorm' ? 400 : wt.type === 'drizzle' ? 80 : 200;
      const count = Math.round(baseCount * wt.intensity);
      for (let i = 0; i < count; i++) {
        const windBase = wt.type === 'storm' || wt.type === 'thunderstorm' ? 3 : wt.type === 'drizzle' ? 0.3 : 1;
        rainDropsRef.current.push({
          x: Math.random() * (pw + 200) - 100,
          y: Math.random() * ph,
          speed: 600 + Math.random() * 400 * wt.intensity,
          length: wt.type === 'drizzle' ? 4 + Math.random() * 6 : 10 + Math.random() * 15 * wt.intensity,
          opacity: wt.type === 'drizzle' ? 0.15 + Math.random() * 0.2 : 0.2 + Math.random() * 0.4,
          wind: windBase + Math.random() * windBase,
        });
      }
    }

    if (isSnow) {
      const baseCount = wt.type === 'blizzard' ? 300 : 150;
      const count = Math.round(baseCount * wt.intensity);
      for (let i = 0; i < count; i++) {
        const windBase = wt.type === 'blizzard' ? 4 : 0.5;
        snowFlakesRef.current.push({
          x: Math.random() * (pw + 100) - 50,
          y: Math.random() * ph,
          speed: wt.type === 'blizzard' ? 100 + Math.random() * 150 : 30 + Math.random() * 60,
          size: 1.5 + Math.random() * 3.5,
          opacity: 0.4 + Math.random() * 0.5,
          wobble: 0,
          wobbleSpeed: 1 + Math.random() * 2,
          wobblePhase: Math.random() * Math.PI * 2,
          wind: windBase + Math.random() * windBase,
        });
      }
    }
  }, []);

  // --- Tick: update + draw ---
  const tick = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const now = performance.now();
    const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = now;

    const { pw: w, ph: h } = getScreenDims();
    const wt = weatherRef.current;

    // --- Storm/thunderstorm darkening overlay ---
    const overlay = overlayGfxRef.current;
    if (overlay) {
      overlay.clear();
      if (wt.type === 'storm' || wt.type === 'thunderstorm') {
        const alpha = wt.intensity * (wt.type === 'thunderstorm' ? 0.25 : 0.18);
        overlay.rect(0, 0, w, h);
        overlay.fill({ color: 0x0a0a1e, alpha });
      }
    }

    // --- Fog ---
    const fogs = fogGfxRefs.current;
    if (fogs.length > 0) {
      const isFog = wt.type === 'fog';
      const isBlizzard = wt.type === 'blizzard';
      const showFog = isFog || isBlizzard;

      if (showFog) {
        fogPhaseRef.current += delta * 0.3;
        const phase = fogPhaseRef.current;

        for (let i = 0; i < fogs.length; i++) {
          const fg = fogs[i];
          const targetAlpha = isFog ? wt.intensity * (0.12 + i * 0.05) : wt.intensity * 0.06;
          fg.alpha += (targetAlpha - fg.alpha) * delta * 2;

          fg.clear();
          const cx = w * (0.3 + 0.4 * Math.sin(phase * (0.4 + i * 0.15) + i * 1.2));
          const cy = h * (0.4 + 0.2 * Math.cos(phase * (0.3 + i * 0.1) + i * 0.8));
          const rx = w * (0.5 + 0.2 * Math.sin(phase * 0.2 + i));
          const ry = h * (0.35 + 0.15 * Math.cos(phase * 0.25 + i * 0.7));

          fg.ellipse(cx, cy, rx, ry);
          fg.fill({ color: isBlizzard ? 0xdde4ee : 0xc8c8dc, alpha: 0.6 });
        }
      } else {
        for (const fg of fogs) {
          if (fg.alpha > 0.001) {
            fg.alpha *= 0.92;
            if (fg.alpha < 0.001) { fg.alpha = 0; fg.clear(); }
          }
        }
      }
    }

    // --- Rain + Snow particles ---
    const g = particlesGfxRef.current;
    if (g) {
      g.clear();

      for (const drop of rainDropsRef.current) {
        drop.y += drop.speed * delta;
        drop.x += drop.wind * 60 * delta;

        if (drop.y > h) {
          drop.y = -drop.length;
          drop.x = Math.random() * (w + 200) - 100;
        }
        if (drop.x > w + 100) drop.x = -100;

        const endX = drop.x + drop.wind * drop.length * 0.3;
        const endY = drop.y + drop.length;

        g.moveTo(drop.x, drop.y);
        g.lineTo(endX, endY);
        g.stroke({ width: 1.2, color: 0x8ab4f8, alpha: drop.opacity });
      }

      for (const flake of snowFlakesRef.current) {
        flake.y += flake.speed * delta;
        flake.wobble = Math.sin(flake.wobblePhase + now * 0.001 * flake.wobbleSpeed) * 30;
        flake.x += (flake.wobble * 0.5 + flake.wind * 40) * delta;

        if (flake.y > h) {
          flake.y = -flake.size * 2;
          flake.x = Math.random() * (w + 100) - 50;
        }
        if (flake.x > w + 50) flake.x = -50;
        if (flake.x < -50) flake.x = w + 50;

        g.circle(flake.x, flake.y, flake.size);
        g.fill({ color: 0xffffff, alpha: flake.opacity });
      }
    }

    // --- Lightning ---
    const lg = lightningGfxRef.current;
    if (lg) {
      lg.clear();

      const hasLightning = wt.type === 'thunderstorm' || wt.type === 'storm';

      if (hasLightning) {
        lightningTimerRef.current -= delta;
        if (lightningTimerRef.current <= 0) {
          lightningRef.current.push(generateLightningBolt(w, h));
          lightningTimerRef.current = wt.type === 'thunderstorm'
            ? 0.8 + Math.random() * 2.5
            : 2 + Math.random() * 5;
        }
      }

      const activeBolts: LightningBolt[] = [];
      for (const bolt of lightningRef.current) {
        bolt.age += delta;
        if (bolt.age >= bolt.maxAge) continue;
        activeBolts.push(bolt);

        const lifeRatio = bolt.age / bolt.maxAge;
        const fade = lifeRatio < 0.3 ? 1 : 1 - ((lifeRatio - 0.3) / 0.7);
        const alpha = fade * bolt.opacity;

        if (lifeRatio < 0.15) {
          const flashAlpha = bolt.flashIntensity * (1 - lifeRatio / 0.15) * 0.15;
          lg.rect(0, 0, w, h);
          lg.fill({ color: 0xffffff, alpha: flashAlpha });
        }

        for (const seg of bolt.segments) {
          lg.moveTo(seg.x1, seg.y1);
          lg.lineTo(seg.x2, seg.y2);
        }
        lg.stroke({ width: 3, color: 0xffffff, alpha: alpha * 0.9 });

        for (const seg of bolt.segments) {
          lg.moveTo(seg.x1, seg.y1);
          lg.lineTo(seg.x2, seg.y2);
        }
        lg.stroke({ width: 8, color: 0xaaccff, alpha: alpha * 0.3 });

        for (const branch of bolt.branches) {
          for (const seg of branch) {
            lg.moveTo(seg.x1, seg.y1);
            lg.lineTo(seg.x2, seg.y2);
          }
          lg.stroke({ width: 1.5, color: 0xddeeff, alpha: alpha * 0.5 });
        }
      }
      lightningRef.current = activeBolts;
    }
  }, []);

  // --- Init PixiJS once the container DOM element exists ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container || initedRef.current) return;
    initedRef.current = true;

    let destroyed = false;
    let app: Application | null = null;

    const setup = async () => {
      const { w, h, pw, ph } = getScreenDims();

      app = new Application();
      await app.init({
        width: pw,
        height: ph,
        backgroundAlpha: 0,
        preference: 'webgl',
        antialias: true,
        resolution: 1,
        autoDensity: false,
      });

      if (destroyed) { forceDestroyPixiApp(app); return; }

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      container.appendChild(canvas);

      // Darkening overlay (storms)
      const overlay = new Graphics();
      app.stage.addChild(overlay);
      overlayGfxRef.current = overlay;

      // Fog layers
      const fogArr: Graphics[] = [];
      const fogParent = new Container();
      app.stage.addChild(fogParent);
      for (let i = 0; i < 4; i++) {
        const fg = new Graphics();
        fg.filters = [new BlurFilter({ strength: 30 + i * 15 })];
        fg.alpha = 0;
        fogParent.addChild(fg);
        fogArr.push(fg);
      }
      fogGfxRefs.current = fogArr;

      // Particle layer (rain + snow)
      const particlesGfx = new Graphics();
      app.stage.addChild(particlesGfx);
      particlesGfxRef.current = particlesGfx;

      // Lightning layer
      const lightningGfx = new Graphics();
      app.stage.addChild(lightningGfx);
      lightningGfxRef.current = lightningGfx;

      appRef.current = app;
      lastTimeRef.current = performance.now();

      rebuildParticles();

      app.ticker.add(tick);
    };

    // 50ms debounce verhindert doppelten Init durch React Strict Mode / HMR
    const setupTimer = setTimeout(setup, 50);

    const handleResize = () => {
      if (!appRef.current) return;
      const { w, h, pw, ph } = getScreenDims();
      appRef.current.renderer.resize(pw, ph);
      const canvas = appRef.current.canvas as HTMLCanvasElement;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      rebuildParticles();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(setupTimer);
      destroyed = true;
      window.removeEventListener('resize', handleResize);
      initedRef.current = false;
      // Use appRef.current (set only after full init) to avoid double-destroying
      // an app whose init() is still in flight (causes zombie WebGL contexts).
      const fullyInitedApp = appRef.current;
      appRef.current = null;
      overlayGfxRef.current = null;
      particlesGfxRef.current = null;
      lightningGfxRef.current = null;
      fogGfxRefs.current = [];
      if (fullyInitedApp) {
        forceDestroyPixiApp(fullyInitedApp);
      }
    };
  }, [rebuildParticles, tick]);

  // --- Rebuild particles whenever weather state changes ---
  useEffect(() => {
    rebuildParticles();
  }, [weather, rebuildParticles]);

  const label = WEATHER_LABELS[weather.type];

  if (!weatherEnabled) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      {label && (
        <div className="absolute top-2 left-2 bg-slate-900/60 rounded px-2 py-1 text-[10px] text-slate-300 flex items-center gap-1">
          {label}
        </div>
      )}
    </div>
  );
}
