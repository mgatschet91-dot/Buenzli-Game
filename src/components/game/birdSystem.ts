import { useCallback } from 'react';
import { BirdFlock, Bird, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';

// --- Constants ---
const BIRD_MIN_ZOOM = 0.25;
const BIRD_MAX_ZOOM = 1.4;
const BIRD_SPAWN_INTERVAL_MIN = 4.0;
const BIRD_SPAWN_INTERVAL_MAX = 10.0;
const MAX_FLOCKS = 6;
const MAX_FLOCKS_MOBILE = 3;
const FLOCK_SIZE_MIN = 3;
const FLOCK_SIZE_MAX = 8;
const BIRD_SPEED_MIN = 30;
const BIRD_SPEED_MAX = 60;
const FLOCK_LIFETIME_MIN = 20;
const FLOCK_LIFETIME_MAX = 40;
const WING_SPEED_MIN = 4;
const WING_SPEED_MAX = 7;

// V-formation offsets (relative to leader, in world units)
function generateFlockPositions(count: number): { dx: number; dy: number }[] {
  const positions: { dx: number; dy: number }[] = [];
  // Leader at (0,0)
  positions.push({ dx: 0, dy: 0 });
  // V-formation: alternating left/right behind leader
  for (let i = 1; i < count; i++) {
    const row = Math.ceil(i / 2);
    const side = i % 2 === 1 ? 1 : -1;
    const spread = 12 + Math.random() * 6;
    const back = 10 + Math.random() * 5;
    positions.push({
      dx: side * row * spread,
      dy: row * back,
    });
  }
  return positions;
}

export interface BirdSystemRefs {
  birdsRef: React.MutableRefObject<BirdFlock[]>;
  birdIdRef: React.MutableRefObject<number>;
  birdSpawnTimerRef: React.MutableRefObject<number>;
}

export interface BirdSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
}

export function useBirdSystem(
  refs: BirdSystemRefs,
  state: BirdSystemState,
) {
  const { birdsRef, birdIdRef, birdSpawnTimerRef } = refs;
  const { worldStateRef, isMobile } = state;

  const updateBirds = useCallback((delta: number) => {
    const { gridSize, zoom, canvasSize, offset } = worldStateRef.current;
    if (gridSize <= 0) return;

    // Hide birds if zoomed out too far or zoomed in too close
    if (zoom < BIRD_MIN_ZOOM || zoom > BIRD_MAX_ZOOM) {
      birdsRef.current = [];
      return;
    }

    const maxFlocks = isMobile ? MAX_FLOCKS_MOBILE : MAX_FLOCKS;
    const dpr = window.devicePixelRatio || 1;

    // Viewport bounds in world coordinates
    const viewW = canvasSize.width / (dpr * zoom);
    const viewH = canvasSize.height / (dpr * zoom);
    const margin = 200; // spawn/despawn margin
    const viewLeft = -offset.x / zoom - margin;
    const viewTop = -offset.y / zoom - margin;
    const viewRight = viewW - offset.x / zoom + margin;
    const viewBottom = viewH - offset.y / zoom + margin;

    // World extent in screen coords (roughly)
    const worldCenterX = gridSize * TILE_WIDTH / 2;
    const worldCenterY = gridSize * TILE_HEIGHT / 2;

    // Spawn timer
    birdSpawnTimerRef.current -= delta;
    if (birdSpawnTimerRef.current <= 0 && birdsRef.current.length < maxFlocks) {
      birdSpawnTimerRef.current = BIRD_SPAWN_INTERVAL_MIN +
        Math.random() * (BIRD_SPAWN_INTERVAL_MAX - BIRD_SPAWN_INTERVAL_MIN);

      // Pick a random edge to spawn from
      const edge = Math.floor(Math.random() * 4);
      let spawnX: number, spawnY: number;
      let angle: number;

      // Spawn at viewport edge, fly across
      switch (edge) {
        case 0: // left
          spawnX = viewLeft - 50;
          spawnY = viewTop + Math.random() * (viewBottom - viewTop);
          angle = -0.3 + Math.random() * 0.6; // roughly rightward
          break;
        case 1: // right
          spawnX = viewRight + 50;
          spawnY = viewTop + Math.random() * (viewBottom - viewTop);
          angle = Math.PI - 0.3 + Math.random() * 0.6; // roughly leftward
          break;
        case 2: // top
          spawnX = viewLeft + Math.random() * (viewRight - viewLeft);
          spawnY = viewTop - 50;
          angle = Math.PI / 2 - 0.3 + Math.random() * 0.6; // roughly downward
          break;
        default: // bottom
          spawnX = viewLeft + Math.random() * (viewRight - viewLeft);
          spawnY = viewBottom + 50;
          angle = -Math.PI / 2 - 0.3 + Math.random() * 0.6; // roughly upward
          break;
      }

      const speed = BIRD_SPEED_MIN + Math.random() * (BIRD_SPEED_MAX - BIRD_SPEED_MIN);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const flockSize = FLOCK_SIZE_MIN + Math.floor(Math.random() * (FLOCK_SIZE_MAX - FLOCK_SIZE_MIN + 1));
      const positions = generateFlockPositions(flockSize);

      // Rotate formation offsets to match flight direction
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const birds: Bird[] = positions.map((pos, i) => {
        // Rotate offset to align with flight direction
        const rx = pos.dx * cosA - pos.dy * sinA;
        const ry = pos.dx * sinA + pos.dy * cosA;
        return {
          id: birdIdRef.current++,
          x: spawnX + rx,
          y: spawnY + ry,
          vx,
          vy,
          wingPhase: Math.random() * Math.PI * 2,
          wingSpeed: WING_SPEED_MIN + Math.random() * (WING_SPEED_MAX - WING_SPEED_MIN),
          size: 0.7 + Math.random() * 0.5,
        };
      });

      const flock: BirdFlock = {
        id: birdIdRef.current++,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        birds,
        lifeTime: FLOCK_LIFETIME_MIN + Math.random() * (FLOCK_LIFETIME_MAX - FLOCK_LIFETIME_MIN),
      };

      birdsRef.current.push(flock);
    }

    // Update existing flocks
    const flocks = birdsRef.current;
    for (let i = flocks.length - 1; i >= 0; i--) {
      const flock = flocks[i];
      flock.lifeTime -= delta;

      // Move flock
      flock.x += flock.vx * delta;
      flock.y += flock.vy * delta;

      // Move and animate individual birds
      for (const bird of flock.birds) {
        bird.x += bird.vx * delta;
        bird.y += bird.vy * delta;
        bird.wingPhase = (bird.wingPhase + bird.wingSpeed * delta) % (Math.PI * 2);
      }

      // Remove if lifetime expired or way off screen
      if (flock.lifeTime <= 0 ||
        flock.x < viewLeft - 500 || flock.x > viewRight + 500 ||
        flock.y < viewTop - 500 || flock.y > viewBottom + 500) {
        flocks.splice(i, 1);
      }
    }
  }, [worldStateRef, birdsRef, birdIdRef, birdSpawnTimerRef, isMobile]);

  return { updateBirds };
}
