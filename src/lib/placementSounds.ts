/**
 * Placement Sound Effects
 * 
 * Plays short, satisfying sounds via Web Audio API when buildings are placed.
 * Different sound types for different building categories.
 * Uses AudioContext pooling to avoid creating too many contexts during rapid placement.
 */

import { Tool } from '@/types/game';

// Shared AudioContext (created lazily on first user interaction)
let sharedAudioCtx: AudioContext | null = null;
let lastSoundTime = 0;
const MIN_SOUND_INTERVAL = 60; // ms - minimum time between sounds to avoid spam during drag

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    // Resume if suspended (happens after page goes idle)
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

type SoundType = 'building' | 'tree' | 'bulldoze' | 'zone' | 'road' | 'terrain';

/**
 * Maps a tool to its sound category
 */
function getToolSoundType(tool: Tool): SoundType {
  // Trees and vegetation
  if (
    tool === 'tree' ||
    tool.startsWith('tree_') ||
    tool.startsWith('bush_') ||
    tool.startsWith('topiary_') ||
    tool.startsWith('flower_')
  ) {
    return 'tree';
  }

  // Bulldoze
  if (tool === 'bulldoze') return 'bulldoze';

  // Roads and rails
  if (tool === 'road' || tool === 'rail' || tool === 'subway') return 'road';

  // Zones
  if (tool.startsWith('zone_') || tool === 'zone_dezone') return 'zone';

  // Terrain tools
  if (tool.startsWith('terrain_') || tool.startsWith('paint_')) return 'terrain';

  // Everything else is a building
  return 'building';
}

/**
 * Building placement: Satisfying "thunk" + shimmer
 * A warm, solid click with a light high-end sparkle
 */
function playBuildingSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Low "thunk" - gives weight to the placement
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(180, now);
  osc1.frequency.exponentialRampToValueAtTime(80, now + 0.12);
  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // High shimmer - gives "success" feeling
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(800, now + 0.02);
  osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0.08, now + 0.02);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.02);
  osc2.stop(now + 0.2);
}

/**
 * Tree/nature placement: Soft rustling swoosh
 * Light and organic feeling
 */
function playTreeSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Soft "whoosh" using filtered noise approximation (fast sine sweep)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  // Gentle high harmonic
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1400, now);
  osc2.frequency.exponentialRampToValueAtTime(900, now + 0.12);
  gain2.gain.setValueAtTime(0.04, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.15);
}

/**
 * Bulldoze: Short deep rumble
 */
function playBulldozeSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Zone placement: Quick sweep
 */
function playZoneSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/**
 * Road/rail placement: Short click
 */
function playRoadSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(350, now + 0.06);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * Terrain tool: Soft thud
 */
function playTerrainSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/**
 * Play a placement sound for the given tool.
 * Throttled to avoid spamming during drag operations.
 */
export function playPlacementSound(tool: Tool): void {
  const now = performance.now();
  if (now - lastSoundTime < MIN_SOUND_INTERVAL) return;
  lastSoundTime = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  const soundType = getToolSoundType(tool);

  switch (soundType) {
    case 'building':
      playBuildingSound(ctx);
      break;
    case 'tree':
      playTreeSound(ctx);
      break;
    case 'bulldoze':
      playBulldozeSound(ctx);
      break;
    case 'zone':
      playZoneSound(ctx);
      break;
    case 'road':
      playRoadSound(ctx);
      break;
    case 'terrain':
      playTerrainSound(ctx);
      break;
  }
}
