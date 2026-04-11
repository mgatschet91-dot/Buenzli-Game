/**
 * Pedestrian drawing utilities
 * Renders pedestrians with dynamic activities and states
 * OPTIMIZED for performance with LOD (Level of Detail)
 */

import { Pedestrian, PedestrianActivity, TILE_WIDTH, TILE_HEIGHT } from './types';
import { DIRECTION_META } from './constants';
import { gridToScreen } from './utils';
import { getPedestrianOpacity, getVisiblePedestrians } from './pedestrianSystem';
import { requestAvatarCanvas } from '@/lib/avatarImager/avatarRenderer';
import { Direction as HabboDirection } from '@/lib/avatarImager/AvatarInfo';

// ========== AVATAR DEBUG SYSTEM ==========
let _avatarDebugEnabled = false;
let _avatarDebugLastLog = 0;
const AVATAR_DEBUG_INTERVAL = 1000; // Max 1 Log pro Sekunde für Frame-Logs

/** Debug-Modus ein-/ausschalten: avatarDebug(true) / avatarDebug(false) */
(globalThis as Record<string, unknown>).avatarDebug = (on = true) => {
  _avatarDebugEnabled = on;
  console.log(`[AvatarDebug] ${on ? 'AKTIVIERT ✅' : 'DEAKTIVIERT ❌'}`);
};

function avatarDebugLog(tag: string, data: Record<string, unknown>, throttle = true): void {
  if (!_avatarDebugEnabled) return;
  const now = Date.now();
  if (throttle && now - _avatarDebugLastLog < AVATAR_DEBUG_INTERVAL) return;
  _avatarDebugLastLog = now;
  console.log(`[AvatarDebug:${tag}]`, data);
}

export { avatarDebugLog, _avatarDebugEnabled };
// ==========================================

// LOD thresholds - draw simpler at lower zoom (exported for PixiPedestrianRenderer)
export const LOD_SIMPLE_ZOOM = 0.55;  // Below this, draw very simple pedestrians (just above min zoom)
export const LOD_MEDIUM_ZOOM = 0.75;  // Below this, skip some details

// Hair colors for hairstyles
const HAIR_COLORS = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a', '#8b0000'];

/**
 * Get Y offset to keep pedestrians visually on the sidewalk based on direction and side
 * In isometric view, the sidewalk position varies based on which way they're walking
 * and which side of the road they're on
 */
function getSidewalkYOffset(direction: 'north' | 'south' | 'east' | 'west', sidewalkSide: 'left' | 'right'): number {
  // Offsets tuned for isometric view to keep pedestrians on sidewalk
  // Negative = move up on screen, Positive = move down on screen
  if (direction === 'north') {
    return sidewalkSide === 'left' ? -2 : -6;
  } else if (direction === 'south') {
    return sidewalkSide === 'left' ? 2 : 6;
  } else if (direction === 'east') {
    return sidewalkSide === 'left' ? -6 : -2;
  } else { // west
    return sidewalkSide === 'left' ? 6 : 2;
  }
}

/**
 * Draw hair/ponytail on a pedestrian
 * @param pedId - Pedestrian ID for consistent hair color (avoids flickering)
 */
function drawHair(ctx: CanvasRenderingContext2D, headX: number, headY: number, headRadius: number, pedId: number): void {
  // Pick a hair color based on pedestrian ID (stable, no flickering)
  const hairColor = HAIR_COLORS[pedId % HAIR_COLORS.length];
  
  ctx.fillStyle = hairColor;
  
  // Draw hair on top of head
  ctx.beginPath();
  ctx.arc(headX, headY - headRadius * 0.3, headRadius * 1.1, Math.PI, 0);
  ctx.fill();
  
  // Draw ponytail or longer hair on side
  ctx.beginPath();
  ctx.ellipse(headX + headRadius * 0.8, headY + headRadius * 0.3, headRadius * 0.4, headRadius * 0.9, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Filter mode for drawing pedestrians
 * - 'all': Draw all visible pedestrians
 * - 'recreation': Pedestrians at recreation, beach, or shops (drawn on top of buildings)
 * - 'non-recreation': Walking pedestrians not at destinations (drawn below buildings)
 */
export type PedestrianFilterMode = 'all' | 'recreation' | 'non-recreation';

/**
 * Draw pedestrians with dynamic activities and states
 * Uses LOD (Level of Detail) for performance
 * 
 * @param filterMode - Controls which pedestrians to draw:
 *   - 'all': All visible pedestrians (default)
 *   - 'recreation': Pedestrians at activities (recreation, beach, shops) - draw on buildings canvas
 *   - 'non-recreation': Walking pedestrians not at destinations - draw on cars canvas
 */
export function drawPedestrians(
  ctx: CanvasRenderingContext2D,
  pedestrians: Pedestrian[],
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number },
  zoom: number = 1.0,
  filterMode: PedestrianFilterMode = 'all'
): void {
  // Get only visible pedestrians (not inside buildings)
  let visiblePedestrians = getVisiblePedestrians(pedestrians);
  
  // Apply filter mode
  if (filterMode === 'recreation') {
    // Include recreation, beach, shop activities AND all NPC workers (always drawn on top of buildings)
    visiblePedestrians = visiblePedestrians.filter(ped => 
      ped.isNpcWorker ||
      ped.state === 'at_recreation' || 
      ped.state === 'at_beach' ||
      ped.state === 'approaching_shop' ||
      (ped.activity === 'shopping' && (ped.state === 'entering_building' || ped.state === 'exiting_building'))
    );
  } else if (filterMode === 'non-recreation') {
    // Walking pedestrians (drawn below buildings) - exclude all NPC workers
    visiblePedestrians = visiblePedestrians.filter(ped => 
      !ped.isNpcWorker &&
      ped.state !== 'at_recreation' && 
      ped.state !== 'at_beach' &&
      ped.state !== 'approaching_shop' &&
      !(ped.activity === 'shopping' && (ped.state === 'entering_building' || ped.state === 'exiting_building'))
    );
  }
  
  if (visiblePedestrians.length === 0) return;

  // Determine LOD level based on zoom
  const useSimpleLOD = zoom < LOD_SIMPLE_ZOOM;
  const useMediumLOD = zoom < LOD_MEDIUM_ZOOM;

  // Pre-set common styles to reduce state changes
  ctx.lineCap = 'round';

  for (let i = 0; i < visiblePedestrians.length; i++) {
    const ped = visiblePedestrians[i];
    // Calculate position based on state
    let pedX: number;
    let pedY: number;
    
    if (ped.isNpcWorker && ped.state === 'walking') {
      // NPC-Arbeiter: Pfad-basierte Interpolation zwischen Tiles
      const currentTile = ped.path[ped.pathIndex] || { x: ped.tileX, y: ped.tileY };
      const nextTile = ped.path[ped.pathIndex + 1] || currentTile;
      const { screenX: sx1, screenY: sy1 } = gridToScreen(currentTile.x, currentTile.y, 0, 0);
      const { screenX: sx2, screenY: sy2 } = gridToScreen(nextTile.x, nextTile.y, 0, 0);
      const cx1 = sx1 + TILE_WIDTH / 2;
      const cy1 = sy1 + TILE_HEIGHT / 2;
      const cx2 = sx2 + TILE_WIDTH / 2;
      const cy2 = sy2 + TILE_HEIGHT / 2;
      pedX = cx1 + (cx2 - cx1) * ped.progress;
      pedY = cy1 + (cy2 - cy1) * ped.progress;
      // Bünzli: Gehweg-Offset (läuft auf Trottoir, nicht Strassenmitte)
      if (ped.npcType === 'buenzli') {
        const meta = DIRECTION_META[ped.direction];
        if (meta) {
          const sidewalkOff = ped.sidewalkSide === 'left' ? -10 : 10;
          const yOff = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
          pedX += meta.normal.nx * sidewalkOff;
          pedY += meta.normal.ny * sidewalkOff + yOff;
        }
      }
    } else if (ped.isNpcWorker && (ped.state === 'npc_working' || ped.state === 'idle' || ped.state === 'idle_outside')) {
      // NPC arbeitet direkt AM Baum, wartet, oder steht idle vor dem Haus - steht auf tileX/tileY mit Offset
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      pedX = screenX + TILE_WIDTH / 2 + (ped.activityOffsetX || 0);
      pedY = screenY + TILE_HEIGHT / 2 + (ped.activityOffsetY || 0);
    } else if (ped.state === 'at_recreation') {
      // At recreation area - position at destination with offset
      const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
      pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX;
      pedY = screenY + TILE_HEIGHT / 2 + ped.activityOffsetY;
    } else if (ped.state === 'at_beach') {
      // At beach - position depends on activity (swimming in water, mat on land)
      if (ped.activity === 'beach_swimming') {
        // Swimmers are in the water tile, centered with small random offset
        const { screenX, screenY } = gridToScreen(ped.beachTileX, ped.beachTileY, 0, 0);
        pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX * 0.5;
        pedY = screenY + TILE_HEIGHT / 2 + ped.activityOffsetY * 0.5;
      } else {
        // Mat users are on the land tile (beach), stay centered on their tile
        const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
        pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX * 0.3;
        pedY = screenY + TILE_HEIGHT / 2 + ped.activityOffsetY * 0.3;
      }
    } else if (ped.state === 'approaching_shop') {
      // Approaching shop - walk FROM sidewalk position TO shop entrance
      // Start from the pedestrian's actual sidewalk position (where they were walking)
      const { screenX: roadX, screenY: roadY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const { screenX: shopX, screenY: shopY } = gridToScreen(ped.destX, ped.destY, 0, 0);
      
      // Calculate the starting position on the sidewalk (same as walking calculation)
      const roadCenterX = roadX + TILE_WIDTH / 2;
      const roadCenterY = roadY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
      const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
      
      // Starting position is at the edge of the road tile (progress=1) on the sidewalk
      const startX = roadCenterX + meta.vec.dx + meta.normal.nx * sidewalkOffset;
      const startY = roadCenterY + meta.vec.dy + meta.normal.ny * sidewalkOffset + yOffset;
      
      // Shop entrance is at the center-front of the shop tile
      const shopEntranceX = shopX + TILE_WIDTH / 2;
      const shopEntranceY = shopY + TILE_HEIGHT / 2 + 8; // Slightly in front of shop
      
      // Progress 0 = at sidewalk, progress 1 = at shop entrance
      const progress = ped.buildingEntryProgress;
      
      pedX = startX + (shopEntranceX - startX) * progress + ped.activityOffsetX * progress;
      pedY = startY + (shopEntranceY - startY) * progress + ped.activityOffsetY * progress;
    } else if (ped.state === 'entering_building' || ped.state === 'exiting_building') {
      // At building entrance - position depends on if shopping
      const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
      if (ped.activity === 'shopping') {
        // Shoppers walk into/out of the door
        const doorProgress = ped.state === 'entering_building' 
          ? ped.buildingEntryProgress 
          : 1 - ped.buildingEntryProgress;
        // At entrance (progress 0) to inside building (progress 1)
        pedX = screenX + TILE_WIDTH / 2 + ped.activityOffsetX * (1 - doorProgress);
        // Move up into the building as they enter
        pedY = screenY + TILE_HEIGHT / 2 + 8 * (1 - doorProgress) - doorProgress * 5;
      } else {
        pedX = screenX + TILE_WIDTH / 2;
        pedY = screenY + TILE_HEIGHT / 2;
      }
    } else if (ped.state === 'socializing') {
      // Socializing - standing still with offset to face conversation partner
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
      // Y offset depends on direction AND which side of road to stay on sidewalk
      const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
      pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset + ped.activityOffsetX;
      pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + ped.activityOffsetY + yOffset;
    } else if (ped.state === 'idle') {
      // Standing still at current position
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      if (!meta) { pedX = centerX; pedY = centerY; } else {
        const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
        const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
        pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset;
        pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + yOffset;
      }
    } else {
      // Walking - normal position calculation
      const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[ped.direction];
      if (!meta) { pedX = centerX; pedY = centerY; } else {
        const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
        const yOffset = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
        pedX = centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset;
        pedY = centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + yOffset;
      }
    }

    // Viewport culling - be generous to avoid cutting off activities
    if (
      pedX < viewBounds.viewLeft - 50 ||
      pedX > viewBounds.viewRight + 50 ||
      pedY < viewBounds.viewTop - 60 ||
      pedY > viewBounds.viewBottom + 60
    ) {
      continue;
    }


    // Get opacity for enter/exit animations
    const opacity = getPedestrianOpacity(ped);
    if (opacity <= 0) continue;

    ctx.save();
    ctx.translate(pedX, pedY);
    if (opacity < 1) ctx.globalAlpha = opacity;

    // OPTIMIZED: Use simple LOD for zoomed out view
    if (useSimpleLOD) {
      drawSimplePedestrian(ctx, ped);
      ctx.restore();
      continue;
    }

    // Draw based on current activity/state
    // OPTIMIZED: Use medium detail for most activities when zoomed out
    if (useMediumLOD) {
      if (ped.state === 'at_recreation') {
        drawMediumActivityPedestrian(ctx, ped);
      } else {
        drawMediumWalkingPedestrian(ctx, ped);
      }
      ctx.restore();
      continue;
    }

    // Full detail drawing
    switch (ped.activity) {
      case 'chopping_tree':
        drawWoodcutterWorking(ctx, ped);
        ctx.restore();
        continue;
      case 'planting_tree':
        drawGardenerWorking(ctx, ped);
        ctx.restore();
        continue;
      case 'chasing':
        if (ped.state === 'npc_working') { drawPoliceArresting(ctx, ped); } else { drawPoliceRunning(ctx, ped); }
        ctx.restore();
        continue;
      case 'fleeing':
        if (ped.state === 'npc_working') { drawGangsterArrested(ctx, ped); } else { drawGangsterRunning(ctx, ped); }
        ctx.restore();
        continue;
      case 'arresting':
        drawPoliceArresting(ctx, ped);
        ctx.restore();
        continue;
      case 'arrested':
        drawGangsterArrested(ctx, ped);
        ctx.restore();
        continue;
      case 'robbing':
        if (ped.state === 'npc_working') { drawGangsterRobbing(ctx, ped); } else { drawGangsterRunning(ctx, ped); }
        ctx.restore();
        continue;
      case 'transporting':
        drawPoliceTransporting(ctx, ped);
        ctx.restore();
        continue;
      case 'being_transported':
        drawGangsterBeingTransported(ctx, ped);
        ctx.restore();
        continue;
      case 'inspecting':
        if (ped.state === 'npc_working') { drawBuenzliInspecting(ctx, ped); } else { drawBuenzliWalking(ctx, ped); }
        ctx.restore();
        continue;
      case 'playing_basketball':
        drawBasketballPlayer(ctx, ped);
        break;
      case 'playing_tennis':
        drawTennisPlayer(ctx, ped);
        break;
      case 'playing_soccer':
        drawSoccerPlayer(ctx, ped);
        break;
      case 'playing_baseball':
        drawBaseballPlayer(ctx, ped);
        break;
      case 'swimming':
        drawSwimmer(ctx, ped);
        break;
      case 'beach_swimming':
        drawBeachSwimmer(ctx, ped);
        break;
      case 'lying_on_mat':
        drawBeachMat(ctx, ped);
        break;
      case 'skateboarding':
        drawSkateboarder(ctx, ped);
        break;
      case 'sitting_bench':
        drawSittingPerson(ctx, ped);
        break;
      case 'picnicking':
        drawPicnicker(ctx, ped);
        break;
      case 'jogging':
        drawJogger(ctx, ped);
        break;
      case 'walking_dog':
        drawDogWalker(ctx, ped);
        break;
      case 'playground':
        drawPlaygroundKid(ctx, ped);
        break;
      case 'watching_game':
        drawSpectator(ctx, ped);
        break;
      case 'shopping':
        // Draw shopper based on their state
        if (ped.state === 'approaching_shop') {
          drawShopperQueuing(ctx, ped);
        } else if (ped.state === 'entering_building' || ped.state === 'exiting_building') {
          drawShopperAtDoor(ctx, ped);
        } else {
          // Walking with bag
          drawWalkingPedestrian(ctx, ped);
        }
        break;
      default:
        // Default walking/standing pedestrian
        if (ped.isNpcWorker && ped.npcType === 'avatar_test') {
          drawAvatarTest(ctx, ped);
        } else if (ped.isNpcWorker && ped.npcType === 'woodcutter') {
          drawWoodcutter(ctx, ped);
        } else if (ped.isNpcWorker && ped.npcType === 'gardener') {
          drawGardener(ctx, ped);
        } else if (ped.isNpcWorker && ped.npcType === 'police') {
          drawPoliceRunning(ctx, ped);
        } else if (ped.isNpcWorker && ped.npcType === 'gangster') {
          drawGangsterRunning(ctx, ped);
        } else if (ped.state === 'socializing') {
          drawSocializingPerson(ctx, ped);
        } else if (ped.state === 'idle') {
          drawIdlePerson(ctx, ped);
        } else if (ped.state === 'approaching_shop') {
          drawShopperQueuing(ctx, ped);
        } else {
          drawWalkingPedestrian(ctx, ped);
        }
    }

    if (ped.isNpcWorker && ped.npcType === 'avatar_test') {
      drawAvatarSpeechBubbles(ctx, ped, zoom);
    }

    ctx.restore();
  }
}

// Dance direction cycle: avatar spins through 8 directions for dance effect
const DANCE_DIRECTIONS: HabboDirection[] = [2, 3, 4, 5, 6, 7, 0, 1];

function drawAvatarTest(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const now = Date.now();
  const isWalking = ped.state === 'walking' || ped.state === 'approaching_shop';
  const isWaving = (ped.avatarAction === 'wav') && Number(ped.avatarActionUntil || 0) > now;
  const isDancing = (ped.avatarAction === 'dnc') && Number(ped.avatarActionUntil || 0) > now;
  let habboDirection = resolveAvatarHabboDirection(ped);
  // Bobba-Stil: Frame alle 100ms inkrementieren (FRAME_SPEED=100, wie in RoomUser.ts)
  // wlk: frame % 4 (4 Walk-Frames), wav: frame % 2 (2 Wave-Frames)
  const frameCounter = Math.floor(now / 100);
  const walkFrame = frameCounter % 4;
  const waveFrame = frameCounter % 2;

  let frame: number;
  let action: 'wlk' | 'std' | 'wav';

  if (isDancing) {
    const danceIdx = Math.floor((now / 280) % DANCE_DIRECTIONS.length);
    habboDirection = DANCE_DIRECTIONS[danceIdx];
    const dancePhase = Math.floor((now / 560) % 2);
    action = dancePhase === 0 ? 'wav' : 'wlk';
    frame = frameCounter % 4;
  } else if (isWaving) {
    frame = waveFrame;
    action = 'wav';
  } else if (isWalking) {
    frame = walkFrame;
    action = 'wlk';
  } else {
    frame = 0;
    action = 'std';
  }

  avatarDebugLog('drawAvatar', {
    state: ped.state,
    action,
    habboDirection,
    frame,
    isWalking,
    isWaving,
    isDancing,
    pedDirection: ped.direction,
    tileX: ped.tileX,
    tileY: ped.tileY,
    pathIndex: ped.pathIndex,
    progress: ped.progress?.toFixed(3),
    pathLength: ped.path?.length,
    path: ped.path?.slice(0, 5).map(p => `(${p.x},${p.y})`).join(' → '),
  });

  const avatarCanvas = requestAvatarCanvas(ped.avatarFigure, habboDirection, action, frame);
  if (!avatarCanvas) return;

  const targetHeight = 88;
  // Dance: subtle vertical bob effect
  const danceBob = isDancing ? Math.sin(now / 180) * 2.5 : 0;
  const scale = targetHeight / avatarCanvas.height;
  const drawWidth = avatarCanvas.width * scale;
  const drawHeight = avatarCanvas.height * scale;
  const prevSmooth = ctx.imageSmoothingEnabled;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(avatarCanvas, -drawWidth / 2, -drawHeight + 14 + danceBob, drawWidth, drawHeight);
  ctx.imageSmoothingEnabled = prevSmooth;
}

function buildScreenStepVector(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Grid -> Isometric screen delta
  return {
    x: (dx - dy) * (TILE_WIDTH / 2),
    y: (dx + dy) * (TILE_HEIGHT / 2),
  };
}

function quantizeVectorToHabboDirection(vx: number, vy: number): HabboDirection {
  if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) {
    return 4;
  }
  // 8-way on screen -> Habbo directions.
  // Index: 0=right,1=down-right,2=down,3=down-left,4=left,5=up-left,6=up,7=up-right
  const angle = Math.atan2(vy, vx);
  const sector = (((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8) as number;
  const screenToHabbo: HabboDirection[] = [2, 3, 4, 5, 6, 7, 0, 1];
  return screenToHabbo[sector];
}

function resolveAvatarHabboDirection(ped: Pedestrian): HabboDirection {
  // Beim Laufen: Richtung = aktuelles Pfadsegment (wohin der Avatar GERADE läuft)
  if ((ped.state === 'walking' || ped.state === 'approaching_shop') &&
      Array.isArray(ped.path) && ped.path.length >= 2) {
    const idx = Math.max(0, Math.min(ped.pathIndex, ped.path.length - 1));
    const from = ped.path[idx];
    const to = ped.path[idx + 1];
    if (from && to) {
      const seg = buildScreenStepVector(from, to);
      const dir = quantizeVectorToHabboDirection(seg.x, seg.y);
      avatarDebugLog('resolveDir:segment', {
        from: `(${from.x},${from.y})`, to: `(${to.x},${to.y})`,
        screenVec: `(${seg.x.toFixed(1)},${seg.y.toFixed(1)})`,
        habboDir: dir,
      });
      return dir;
    }
  }

  // Stehen: letzte Laufrichtung aus DIRECTION_META (echte Screen-Vektoren)
  const meta = DIRECTION_META[ped.direction];
  const dir = meta
    ? quantizeVectorToHabboDirection(meta.vec.dx, meta.vec.dy)
    : 4 as HabboDirection;
  avatarDebugLog('resolveDir:standing', {
    pedDir: ped.direction, habboDir: dir, state: ped.state,
  });
  return dir;
}

function drawAvatarNameTag(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const labelRaw = ped.avatarLabel || ped.avatarOwnerId || 'Avatar';
  const label = labelRaw.length > 18 ? `${labelRaw.slice(0, 17)}…` : labelRaw;

  const textY = -12;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = Math.max(34, ctx.measureText(label).width + 12);
  const boxX = -textWidth / 2;
  const boxY = textY - 22;
  const boxH = 16;
  const radius = 6;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.moveTo(boxX + radius, boxY);
  ctx.lineTo(boxX + textWidth - radius, boxY);
  ctx.quadraticCurveTo(boxX + textWidth, boxY, boxX + textWidth, boxY + radius);
  ctx.lineTo(boxX + textWidth, boxY + boxH - radius);
  ctx.quadraticCurveTo(boxX + textWidth, boxY + boxH, boxX + textWidth - radius, boxY + boxH);
  ctx.lineTo(boxX + radius, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
  ctx.lineTo(boxX, boxY + radius);
  ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ede9fe';
  ctx.fillText(label, 0, boxY + boxH / 2);
}

function drawAvatarSpeechBubbles(ctx: CanvasRenderingContext2D, ped: Pedestrian, zoom: number = 1): void {
  const bubbles = ped.avatarSpeechBubbles || [];
  if (bubbles.length === 0) return;

  const now = Date.now();
  // Habbo-artig: laenger sichtbar und bei Zoom-Out automatisch groesser.
  const maxAgeMs = 14000;
  const zoomScale = Math.max(1, Math.min(2.8, 1 / Math.max(0.35, zoom || 1)));
  const fontSize = Math.round(16 * zoomScale);
  const bubbleHeight = Math.round(30 * zoomScale);
  const paddingX = Math.round(18 * zoomScale);
  const minWidth = Math.round(120 * zoomScale);
  const startY = -98 - Math.round((zoomScale - 1) * 30);
  const stackGap = Math.round(36 * zoomScale);
  const cornerR = Math.round(10 * zoomScale);
  const tailHalfW = Math.max(6, Math.round(7 * zoomScale));
  const tailH = Math.max(5, Math.round(7 * zoomScale));
  const alive = bubbles.filter(b => (now - b.createdAt) < maxAgeMs);
  if (alive.length !== bubbles.length) {
    ped.avatarSpeechBubbles = alive;
  }

  const show = alive.slice(-4);
  for (let i = 0; i < show.length; i++) {
    const b = show[show.length - 1 - i]; // Neueste unten, ältere steigen hoch
    const ageMs = now - b.createdAt;
    const progress = Math.max(0, Math.min(1, ageMs / maxAgeMs));
    const rise = progress * 26;
    const alpha = 1 - progress;
    const text = String(b.text || '');
    if (!text) continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const w = Math.max(minWidth, ctx.measureText(text).width + paddingX * 2);
    const h = bubbleHeight;
    const y = startY - i * stackGap - rise * zoomScale;
    const x = -w / 2;
    const r = cornerR;

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(15,23,42,0.75)';
    ctx.lineWidth = Math.max(1.4, 1.6 * zoomScale);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Kleiner "Tail" nur für die neueste Bubble
    if (i === 0) {
      ctx.beginPath();
      ctx.moveTo(-tailHalfW, y + h);
      ctx.lineTo(0, y + h + tailH);
      ctx.lineTo(tailHalfW, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillText(text, 0, y + h / 2);
    ctx.restore();
  }
}

/**
 * Draw a very simple pedestrian (lowest LOD) - just colored dots
 */
function drawSimplePedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  // Just draw a small colored circle for the body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.arc(0, -1.7, 2.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Head as tiny dot
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -4.3, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw medium detail walking pedestrian
 */
function drawMediumWalkingPedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const walkBob = Math.sin(ped.walkOffset) * 0.5;
  const scale = 0.30;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Simple legs (single stroke)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  const legSwing = Math.sin(ped.walkOffset) * 2;
  ctx.beginPath();
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo(legSwing * scale, 5 * scale);
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo(-legSwing * scale, 5 * scale);
  ctx.stroke();
}

/**
 * Draw medium detail activity pedestrian
 */
function drawMediumActivityPedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const anim = Math.sin(ped.activityAnimTimer);

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(anim * scale, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Simple legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, -1 * scale);
  ctx.lineTo(-1.5 * scale, 5 * scale);
  ctx.moveTo(1 * scale, -1 * scale);
  ctx.lineTo(1.5 * scale, 5 * scale);
  ctx.stroke();

  // Activity indicator (colored dot for ball, etc.)
  if (ped.hasBall) {
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.arc(4 * scale, 2 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a standard walking pedestrian - OPTIMIZED
 */
function drawWalkingPedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const walkBob = Math.sin(ped.walkOffset) * 0.8;
  const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.5;
  const scale = 0.30;
  const legSwing = Math.sin(ped.walkOffset) * 3;

  // Draw head and body first (filled shapes)
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians (based on ID)
  if (ped.id % 2 === 0) {
    drawHair(ctx, walkSway * scale, (-12 + walkBob) * scale, 3 * scale, ped.id);
  }

  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw both legs in one path
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway - 1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway + 1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Draw both arms in one path
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const armSwing = legSwing * 0.67;
  ctx.beginPath();
  ctx.moveTo((walkSway - 2) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway - 3 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.moveTo((walkSway + 2) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway + 3 + armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // Dog if walking one (simplified)
  if (ped.hasDog) {
    drawDogSimple(ctx, ped);
  }
}

/**
 * Draw a simplified dog for performance
 */
function drawDogSimple(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.26;
  const offsetX = 8;
  const offsetY = 3;
  
  // Dog as simple ellipse
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(offsetX * scale, (offsetY + 3) * scale, 4 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.arc((offsetX + 4) * scale, (offsetY + 1) * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Leash
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 0.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -2 * scale);
  ctx.lineTo(offsetX * scale, (offsetY + 2) * scale);
  ctx.stroke();
}

/**
 * Draw a basketball player
 */
function drawBasketballPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.32;
  const bounce = Math.abs(Math.sin(ped.activityAnimTimer * 1.5)) * 2;
  const armMove = Math.sin(ped.activityAnimTimer * 3) * 4;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Jersey (bright color)
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + bounce) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shorts
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, (-1 + bounce) * scale, 4 * scale, 3 * scale);

  // Legs - athletic stance
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (2 + bounce) * scale);
  ctx.lineTo(-2 * scale, (6 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, (2 + bounce) * scale);
  ctx.lineTo(2 * scale, (6 + bounce) * scale);
  ctx.stroke();

  // Arms - dribbling motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((-3 + armMove * 0.3) * scale, (-1 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((4 + armMove * 0.3) * scale, (2 + Math.abs(armMove)) * scale);
  ctx.stroke();

  // Basketball
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.arc((4 + armMove * 0.3) * scale, (4 + Math.abs(armMove) + bounce) * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Ball lines
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 0.3 * scale;
  ctx.beginPath();
  ctx.arc((4 + armMove * 0.3) * scale, (4 + Math.abs(armMove) + bounce) * scale, 2 * scale, 0, Math.PI);
  ctx.stroke();
}

/**
 * Draw a tennis player
 */
function drawTennisPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const swing = Math.sin(ped.activityAnimTimer * 1) * 5;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Visor
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -14 * scale, 4 * scale, 1 * scale, 0, 0, Math.PI);
  ctx.fill();

  // Polo shirt
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tennis skirt/shorts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-2.5 * scale, -1 * scale, 5 * scale, 2.5 * scale);

  // Legs
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 1.5 * scale);
  ctx.lineTo(-1.5 * scale, 6 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 1.5 * scale);
  ctx.lineTo(2 * scale, 6 * scale);
  ctx.stroke();

  // Arms with racket
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  // Back arm
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -6 * scale);
  ctx.lineTo(-3 * scale, -2 * scale);
  ctx.stroke();
  // Racket arm
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6 * scale);
  ctx.lineTo((4 + swing * 0.5) * scale, (-8 + Math.abs(swing) * 0.3) * scale);
  ctx.stroke();

  // Tennis racket
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 0.8 * scale;
  ctx.beginPath();
  ctx.moveTo((4 + swing * 0.5) * scale, (-8 + Math.abs(swing) * 0.3) * scale);
  ctx.lineTo((7 + swing) * scale, (-12 + Math.abs(swing) * 0.5) * scale);
  ctx.stroke();
  // Racket head
  ctx.strokeStyle = '#228B22';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.ellipse((8 + swing) * scale, (-14 + Math.abs(swing) * 0.5) * scale, 2.5 * scale, 3 * scale, swing * 0.1, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw a soccer player
 */
function drawSoccerPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const kick = Math.sin(ped.activityAnimTimer * 2) * 4;
  const run = Math.abs(Math.sin(ped.activityAnimTimer * 2.5));

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + run) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Jersey
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + run) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shorts
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, (-1 + run) * scale, 4 * scale, 2.5 * scale);

  // Legs - kicking motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (1.5 + run) * scale);
  ctx.lineTo((-1.5 - kick * 0.2) * scale, (6 + run) * scale);
  ctx.stroke();
  // Kicking leg
  ctx.beginPath();
  ctx.moveTo(1 * scale, (1.5 + run) * scale);
  ctx.lineTo((2 + kick) * scale, (4 + run - Math.abs(kick) * 0.3) * scale);
  ctx.stroke();

  // Soccer ball
  if (Math.abs(kick) > 2) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((4 + kick * 1.5) * scale, (3 + run) * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.3 * scale;
    ctx.stroke();
  }

  // Arms running motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + run) * scale);
  ctx.lineTo((-3 - kick * 0.2) * scale, (-2 + run) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + run) * scale);
  ctx.lineTo((3 + kick * 0.2) * scale, (-2 + run) * scale);
  ctx.stroke();
}

/**
 * Draw a dancing party guest
 */
function drawDancingPerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const t = ped.activityAnimTimer;

  // Körper wippt auf und ab im Takt
  const bob = Math.sin(t * 3) * 1.5;
  // Arme wechseln hoch/runter im Rhythmus (Tanzpose)
  const armL = Math.sin(t * 3) * 5;
  const armR = Math.sin(t * 3 + Math.PI) * 5;
  // Hüft-Sway leicht
  const sway = Math.sin(t * 1.5) * 1.5;

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(sway * scale, (-12 + bob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Party-Hut (Zylinder-Stil)
  if (ped.hasHat) {
    ctx.fillStyle = ped.hatColor;
    // Krempe
    ctx.beginPath();
    ctx.ellipse(sway * scale, (-15.5 + bob) * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // Zylinder
    ctx.fillRect((sway - 2) * scale, (-20 + bob) * scale, 4 * scale, 5 * scale);
  }

  // Shirt (Körper)
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(sway * scale, (-5 + bob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hose
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect((sway - 2) * scale, (-1 + bob) * scale, 4 * scale, 2.5 * scale);

  // Beine — Tanzschritt (abwechselnd links/rechts versetzt)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((sway - 1) * scale, (1.5 + bob) * scale);
  ctx.lineTo((sway - 2 - Math.sin(t * 3) * 2) * scale, (6 + bob) * scale);
  ctx.moveTo((sway + 1) * scale, (1.5 + bob) * scale);
  ctx.lineTo((sway + 2 + Math.sin(t * 3 + Math.PI) * 2) * scale, (6 + bob) * scale);
  ctx.stroke();

  // Arme — ausgestreckt in Tanzpose
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo((sway - 2) * scale, (-6 + bob) * scale);
  ctx.lineTo((sway - 5) * scale, (-6 + bob + armL) * scale);
  ctx.moveTo((sway + 2) * scale, (-6 + bob) * scale);
  ctx.lineTo((sway + 5) * scale, (-6 + bob + armR) * scale);
  ctx.stroke();
}

/**
 * Draw a baseball player
 */
function drawBaseballPlayer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.31;
  const swing = Math.sin(ped.activityAnimTimer * 1) * 6;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Baseball cap
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.arc(0, -13 * scale, 3.5 * scale, Math.PI, 0);
  ctx.fill();
  // Cap bill
  ctx.fillRect(-4 * scale, -13 * scale, 4 * scale, 1 * scale);

  // Uniform
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pants
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, -1 * scale, 4 * scale, 4 * scale);

  // Legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 3 * scale);
  ctx.lineTo(-1.5 * scale, 7 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 3 * scale);
  ctx.lineTo(1.5 * scale, 7 * scale);
  ctx.stroke();

  // Arms and bat
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -6 * scale);
  ctx.lineTo((-1 + swing * 0.3) * scale, (-9) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6 * scale);
  ctx.lineTo((1 + swing * 0.5) * scale, (-9) * scale);
  ctx.stroke();

  // Bat
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((swing * 0.4) * scale, -9 * scale);
  ctx.lineTo((swing * 1.2) * scale, -16 * scale);
  ctx.stroke();
}

/**
 * Draw a swimmer
 */
function drawSwimmer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale for pool swimmers
  const swim = Math.sin(ped.activityAnimTimer * 2);
  const bob = Math.sin(ped.activityAnimTimer * 1) * 1.5;

  // Water effect around swimmer
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 8 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head poking out of water
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-3 + bob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Swim cap
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.arc(0, (-4 + bob) * scale, 3 * scale, Math.PI, 0);
  ctx.fill();

  // Goggles
  ctx.fillStyle = '#333333';
  ctx.fillRect(-3 * scale, (-3 + bob) * scale, 6 * scale, 1 * scale);

  // Arms doing stroke
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (0 + bob) * scale);
  ctx.lineTo((-5 + swim * 3) * scale, (-2 + swim * 2) * scale);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(2 * scale, (0 + bob) * scale);
  ctx.lineTo((5 - swim * 3) * scale, (-2 - swim * 2) * scale);
  ctx.stroke();

  // Splash effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  const splashSize = Math.abs(swim) * 2;
  ctx.beginPath();
  ctx.arc((-5 + swim * 3) * scale, 0, splashSize * scale, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a skateboarder
 */
function drawSkateboarder(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.23; // Smaller scale for skate park
  const ride = Math.sin(ped.activityAnimTimer * 1.5);
  const bob = Math.abs(ride) * 1.5;

  // Skateboard
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-5 * scale, (5 + bob) * scale, 10 * scale, 1.5 * scale);
  // Wheels
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(-3 * scale, (7 + bob) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.arc(3 * scale, (7 + bob) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(ride * scale, (-10 + bob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(ride * scale, (-11 + bob) * scale, 3.5 * scale, Math.PI, 0);
  ctx.fill();

  // Body - crouched
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(ride * scale, (-4 + bob) * scale, 2.5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bent legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo((-1 + ride) * scale, (0 + bob) * scale);
  ctx.quadraticCurveTo((-3 + ride) * scale, (3 + bob) * scale, (-2 + ride) * scale, (5 + bob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((1 + ride) * scale, (0 + bob) * scale);
  ctx.quadraticCurveTo((3 + ride) * scale, (3 + bob) * scale, (2 + ride) * scale, (5 + bob) * scale);
  ctx.stroke();

  // Arms out for balance
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo((-2 + ride) * scale, (-5 + bob) * scale);
  ctx.lineTo((-6 - ride) * scale, (-3 + bob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((2 + ride) * scale, (-5 + bob) * scale);
  ctx.lineTo((6 + ride) * scale, (-3 + bob) * scale);
  ctx.stroke();
}

/**
 * Draw a person sitting on a bench
 */
function drawSittingPerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale to fit better on bench
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;

  // Bench
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-6 * scale, 2 * scale, 12 * scale, 2 * scale);
  // Bench legs
  ctx.fillRect(-5 * scale, 4 * scale, 1.5 * scale, 3 * scale);
  ctx.fillRect(3.5 * scale, 4 * scale, 1.5 * scale, 3 * scale);

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-8 + breathe) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hair for variety
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, (-8 + breathe) * scale, 3 * scale, ped.id);
  }

  // Hat if has one
  if (ped.hasHat) {
    ctx.fillStyle = ped.hatColor;
    ctx.beginPath();
    ctx.ellipse(0, (-11 + breathe) * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body - seated
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-2 + breathe) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - bent at 90 degrees
  ctx.fillStyle = ped.pantsColor;
  // Thighs (horizontal)
  ctx.fillRect(-2 * scale, 1 * scale, 4 * scale, 2 * scale);
  // Lower legs (hanging down)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 3 * scale);
  ctx.lineTo(-1 * scale, 7 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 3 * scale);
  ctx.lineTo(1 * scale, 7 * scale);
  ctx.stroke();

  // Arms resting
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-3 + breathe) * scale);
  ctx.lineTo(-4 * scale, 1 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-3 + breathe) * scale);
  ctx.lineTo(4 * scale, 1 * scale);
  ctx.stroke();
}

/**
 * Draw someone having a picnic
 */
// Muted pastel blanket colors
const BLANKET_COLORS = [
  { main: '#d4a5a5', accent: '#f5e6e6' },  // Dusty rose
  { main: '#a5c4d4', accent: '#e6f0f5' },  // Soft blue
  { main: '#b5d4a5', accent: '#e6f5e6' },  // Sage green
  { main: '#d4cfa5', accent: '#f5f3e6' },  // Muted yellow
  { main: '#c4a5d4', accent: '#f0e6f5' },  // Lavender
  { main: '#d4b5a5', accent: '#f5ece6' },  // Warm beige
];

function drawPicnicker(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale for park activities

  // Picnic blanket - muted pastel colors based on pedestrian ID
  const blanketColor = BLANKET_COLORS[ped.id % BLANKET_COLORS.length];
  ctx.fillStyle = blanketColor.main;
  ctx.fillRect(-8 * scale, 0, 16 * scale, 8 * scale);
  // Blanket pattern
  ctx.fillStyle = blanketColor.accent;
  ctx.fillRect(-6 * scale, 2 * scale, 4 * scale, 4 * scale);
  ctx.fillRect(2 * scale, 2 * scale, 4 * scale, 4 * scale);

  // Person sitting cross-legged
  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -8 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, -8 * scale, 3 * scale, ped.id);
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -2 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crossed legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 2 * scale);
  ctx.lineTo(2 * scale, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 2 * scale);
  ctx.lineTo(-2 * scale, 5 * scale);
  ctx.stroke();

  // Picnic basket
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(5 * scale, 1 * scale, 4 * scale, 3 * scale);
}

/**
 * Draw a jogger
 */
function drawJogger(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.20; // Small scale for park joggers
  const run = ped.walkOffset;
  const bounce = Math.abs(Math.sin(run * 2)) * 2;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians (ponytail bouncing)
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, (-12 + bounce) * scale, 3 * scale, ped.id);
  }

  // Headband
  ctx.fillStyle = ped.shirtColor;
  ctx.fillRect(-3 * scale, (-13 + bounce) * scale, 6 * scale, 1.5 * scale);

  // Athletic top
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + bounce) * scale, 2.3 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Running shorts
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, (-1 + bounce) * scale, 4 * scale, 2 * scale);

  // Legs - running stride
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  const leftLeg = Math.sin(run) * 5;
  const rightLeg = Math.sin(run + Math.PI) * 5;
  ctx.beginPath();
  ctx.moveTo(0, (1 + bounce) * scale);
  ctx.lineTo(leftLeg * scale, (6 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, (1 + bounce) * scale);
  ctx.lineTo(rightLeg * scale, (6 + bounce) * scale);
  ctx.stroke();

  // Arms - pumping motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const leftArm = Math.sin(run + Math.PI) * 3;
  const rightArm = Math.sin(run) * 3;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((-3 + leftArm) * scale, (-2 + bounce) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + bounce) * scale);
  ctx.lineTo((3 + rightArm) * scale, (-2 + bounce) * scale);
  ctx.stroke();
}

/**
 * Draw a dog walker - just uses the regular walking function which handles dogs
 */
function drawDogWalker(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  drawWalkingPedestrian(ctx, ped);
}

/**
 * Draw a kid on playground
 */
function drawPlaygroundKid(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.20; // Small - it's a kid on playground
  const swing = Math.sin(ped.activityAnimTimer * 1.5) * 8;
  const sway = Math.cos(ped.activityAnimTimer * 1.5) * 3;

  // Swing set hint
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -20 * scale);
  ctx.lineTo((-2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, -20 * scale);
  ctx.lineTo((2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();

  // Kid's head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(sway * scale, (-10 + Math.abs(swing) * 0.2) * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(sway * scale, (-4 + Math.abs(swing) * 0.1) * scale, 2 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - kicking while swinging
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(sway * scale, (-1 + Math.abs(swing) * 0.1) * scale);
  ctx.lineTo((sway + swing * 0.3) * scale, (4) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sway * scale, (-1 + Math.abs(swing) * 0.1) * scale);
  ctx.lineTo((sway + swing * 0.2) * scale, (4) * scale);
  ctx.stroke();

  // Arms holding ropes
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo((sway - 1.5) * scale, (-5 + Math.abs(swing) * 0.15) * scale);
  ctx.lineTo((-2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((sway + 1.5) * scale, (-5 + Math.abs(swing) * 0.15) * scale);
  ctx.lineTo((2 + sway) * scale, (-8 + Math.abs(swing) * 0.2) * scale);
  ctx.stroke();
}

/**
 * Draw a spectator watching a game
 */
function drawSpectator(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22; // Smaller scale for park/stadium spectators
  const cheer = Math.sin(ped.activityAnimTimer * 2);
  const cheerUp = cheer > 0.7;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + (cheerUp ? -1 : 0)) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians (instead of cap)
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, (-12 + (cheerUp ? -1 : 0)) * scale, 3 * scale, ped.id);
  } else {
    // Team cap/hat for others
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.arc(0, (-13 + (cheerUp ? -1 : 0)) * scale, 3.5 * scale, Math.PI, 0);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pants
  ctx.fillStyle = ped.pantsColor;
  ctx.fillRect(-2 * scale, -1 * scale, 4 * scale, 3 * scale);

  // Legs
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 2 * scale);
  ctx.lineTo(-1.5 * scale, 7 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, 2 * scale);
  ctx.lineTo(1.5 * scale, 7 * scale);
  ctx.stroke();

  // Arms - raised when cheering
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  if (cheerUp) {
    // Arms up!
    ctx.beginPath();
    ctx.moveTo(-2 * scale, -6 * scale);
    ctx.lineTo(-4 * scale, -14 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2 * scale, -6 * scale);
    ctx.lineTo(4 * scale, -14 * scale);
    ctx.stroke();
  } else {
    // Arms at sides
    ctx.beginPath();
    ctx.moveTo(-2 * scale, -6 * scale);
    ctx.lineTo(-3 * scale, -1 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2 * scale, -6 * scale);
    ctx.lineTo(3 * scale, -1 * scale);
    ctx.stroke();
  }
}

/**
 * Draw a socializing person (facing another person)
 */
function drawSocializingPerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const gesture = Math.sin(ped.activityAnimTimer * 1) * 2;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, -12 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians
  if (ped.id % 2 === 0) {
    drawHair(ctx, 0, -12 * scale, 3 * scale, ped.id);
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, -5 * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (standing)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, -1 * scale);
  ctx.lineTo(-1.5 * scale, 5 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, -1 * scale);
  ctx.lineTo(1.5 * scale, 5 * scale);
  ctx.stroke();

  // Arms - gesturing while talking
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -6 * scale);
  ctx.lineTo((-4 + gesture) * scale, (-4 + Math.abs(gesture) * 0.5) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6 * scale);
  ctx.lineTo((4 - gesture) * scale, (-4 + Math.abs(gesture) * 0.5) * scale);
  ctx.stroke();

  // Speech indicator (small dots)
  if (Math.sin(ped.activityAnimTimer * 2.5) > 0) {
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(5 * scale, -14 * scale, 0.8 * scale, 0, Math.PI * 2);
    ctx.arc(7 * scale, -15 * scale, 0.6 * scale, 0, Math.PI * 2);
    ctx.arc(8.5 * scale, -15.5 * scale, 0.4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw an idle person
 */
function drawIdlePerson(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + breathe) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Add hair for ~50% of pedestrians
  if (ped.id % 2 === 0 && !ped.hasHat) {
    drawHair(ctx, 0, (-12 + breathe) * scale, 3 * scale, ped.id);
  }

  // Hat if has one
  if (ped.hasHat) {
    ctx.fillStyle = ped.hatColor;
    ctx.beginPath();
    ctx.ellipse(0, (-15 + breathe) * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + breathe) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (standing)
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(-1 * scale, (5 + breathe) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(1 * scale, (5 + breathe) * scale);
  ctx.stroke();

  // Arms at rest
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + breathe) * scale);
  ctx.lineTo(-2.5 * scale, (-1 + breathe) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * scale, (-6 + breathe) * scale);
  ctx.lineTo(2.5 * scale, (-1 + breathe) * scale);
  ctx.stroke();

  // Bag if carrying
  if (ped.hasBag) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(3 * scale, (-4 + breathe) * scale, 2 * scale, 3 * scale);
  }
}

/**
 * Draw a woodcutter NPC - larger than normal pedestrians with an axe
 */
function drawWoodcutter(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.42; // Grösser als normale Fussgänger (0.30)
  const walkBob = Math.sin(ped.walkOffset) * 0.8;
  const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.5;
  const legSwing = Math.sin(ped.walkOffset) * 3;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Helm (immer)
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-15 + walkBob) * scale, 4 * scale, 1.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper (braunes Hemd)
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beine
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway - 1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway + 1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Arme
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  const armSwing = legSwing * 0.67;
  ctx.beginPath();
  ctx.moveTo((walkSway - 2.5) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway - 3.5 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.moveTo((walkSway + 2.5) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway + 3.5 + armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // Axt auf dem Rücken
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((walkSway + 3) * scale, (-8 + walkBob) * scale);
  ctx.lineTo((walkSway + 5) * scale, (-1 + walkBob) * scale);
  ctx.stroke();
  // Axt-Klinge
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo((walkSway + 2) * scale, (-9 + walkBob) * scale);
  ctx.lineTo((walkSway + 5) * scale, (-10 + walkBob) * scale);
  ctx.lineTo((walkSway + 4) * scale, (-7 + walkBob) * scale);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a woodcutter NPC working (chopping a tree) - with swing animation
 */
function drawWoodcutterWorking(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.42;
  const chop = Math.sin((ped.npcWorkProgress || 0) * 0.15) * 6;
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + breathe) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Helm
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(0, (-15 + breathe) * scale, 4 * scale, 1.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(0, (-5 + breathe) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beine (breit stehend)
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(-2.5 * scale, (5 + breathe) * scale);
  ctx.moveTo(1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(2.5 * scale, (5 + breathe) * scale);
  ctx.stroke();

  // Arme mit Axt-Schwung
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  // Beide Arme halten die Axt
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-6 + breathe) * scale);
  ctx.lineTo((-3 + chop * 0.3) * scale, (-2 + breathe) * scale);
  ctx.moveTo(2.5 * scale, (-6 + breathe) * scale);
  ctx.lineTo((3 + chop * 0.5) * scale, (-9 + breathe) * scale);
  ctx.stroke();

  // Axt (schwingend)
  ctx.save();
  ctx.translate((4 + chop * 0.3) * scale, (-8 + breathe) * scale);
  ctx.rotate((chop * 0.08) - 0.3);
  // Stiel
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6 * scale, -4 * scale);
  ctx.stroke();
  // Klinge
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(5 * scale, -4 * scale);
  ctx.lineTo(8 * scale, -6 * scale);
  ctx.lineTo(7 * scale, -2 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Fortschrittsbalken
  const progress = (ped.npcWorkProgress || 0) / 100;
  if (progress > 0) {
    const barW = 18 * scale;
    const barH = 3 * scale;
    const barX = -barW / 2;
    const barY = (-20 + breathe) * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // Bäume-Counter
  const trees = ped.npcTreesChopped || 0;
  if (trees > 0) {
    ctx.font = `bold ${10 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(`🪓${trees}`, 0, (-24 + breathe) * scale);
    ctx.fillStyle = '#fff';
    ctx.fillText(`🪓${trees}`, 0, (-24 + breathe) * scale);
  }
}

/**
 * Draw a gardener NPC walking - grünes Outfit mit Schaufel und Setzling
 */
function drawGardener(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.42;
  const walkBob = Math.sin(ped.walkOffset) * 0.8;
  const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.5;
  const legSwing = Math.sin(ped.walkOffset) * 3;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Strohhut
  ctx.fillStyle = '#d4b896';
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-15 + walkBob) * scale, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hutband
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-14.5 + walkBob) * scale, 3.5 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper (grünes Hemd)
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Schürze
  ctx.fillStyle = '#c4a66a';
  ctx.beginPath();
  ctx.fillRect((walkSway - 2) * scale, (-3 + walkBob) * scale, 4 * scale, 5 * scale);

  // Beine
  ctx.strokeStyle = '#c4a66a';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway - 1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway + 1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Arme
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  const armSwing = legSwing * 0.67;
  ctx.beginPath();
  ctx.moveTo((walkSway - 2.5) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway - 3.5 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.moveTo((walkSway + 2.5) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway + 3.5 + armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // Schaufel auf dem Rücken
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((walkSway + 3) * scale, (-9 + walkBob) * scale);
  ctx.lineTo((walkSway + 4.5) * scale, (0 + walkBob) * scale);
  ctx.stroke();
  // Schaufelblatt
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.ellipse((walkSway + 4.5) * scale, (1 + walkBob) * scale, 1.8 * scale, 2.5 * scale, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Kleiner Setzling in der Hand (links)
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc((walkSway - 4 - armSwing) * scale, (-3 + walkBob) * scale, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Stiel
  ctx.strokeStyle = '#4a2f1a';
  ctx.lineWidth = 0.8 * scale;
  ctx.beginPath();
  ctx.moveTo((walkSway - 4 - armSwing) * scale, (-1.5 + walkBob) * scale);
  ctx.lineTo((walkSway - 4 - armSwing) * scale, (-3 + walkBob) * scale);
  ctx.stroke();
}

/**
 * Draw a gardener NPC working (planting a tree) - Grabe-Animation
 */
function drawGardenerWorking(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.42;
  const dig = Math.sin((ped.npcWorkProgress || 0) * 0.2) * 4;
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;
  const progress = (ped.npcWorkProgress || 0) / 100;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kleines Loch im Boden (Fortschritts-abhängig)
  if (progress > 0.1) {
    ctx.fillStyle = '#5c3a1a';
    ctx.beginPath();
    ctx.ellipse(4 * scale, (4) * scale, (2 + progress * 2) * scale, (1 + progress) * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // Erde drumherum
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.ellipse(6 * scale, (2.5) * scale, (1.5 * progress) * scale, (0.8 * progress) * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Setzling wächst aus dem Loch (ab 70% Fortschritt)
  if (progress > 0.7) {
    const growFactor = (progress - 0.7) / 0.3; // 0-1
    // Stamm
    ctx.strokeStyle = '#4a2f1a';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(4 * scale, (4) * scale);
    ctx.lineTo(4 * scale, (4 - 4 * growFactor) * scale);
    ctx.stroke();
    // Blätter
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(4 * scale, (3 - 4 * growFactor) * scale, (2 * growFactor) * scale, 0, Math.PI * 2);
    ctx.fill();
    if (growFactor > 0.5) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc((3) * scale, (2 - 4 * growFactor) * scale, (1.5 * growFactor) * scale, 0, Math.PI * 2);
      ctx.arc((5) * scale, (2 - 4 * growFactor) * scale, (1.5 * growFactor) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + breathe) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Strohhut
  ctx.fillStyle = '#d4b896';
  ctx.beginPath();
  ctx.ellipse(0, (-15 + breathe) * scale, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.ellipse(0, (-14.5 + breathe) * scale, 3.5 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.ellipse(0, (-5 + breathe) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Schürze
  ctx.fillStyle = '#c4a66a';
  ctx.fillRect(-2 * scale, (-3 + breathe) * scale, 4 * scale, 5 * scale);

  // Beine (breit stehend)
  ctx.strokeStyle = '#c4a66a';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(-2.5 * scale, (5 + breathe) * scale);
  ctx.moveTo(1 * scale, (-1 + breathe) * scale);
  ctx.lineTo(2.5 * scale, (5 + breathe) * scale);
  ctx.stroke();

  // Arme mit Schaufel-Grabebewegung
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  // Linker Arm hält Schaufelstiel
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-6 + breathe) * scale);
  ctx.lineTo((-2 + dig * 0.2) * scale, (-1 + breathe) * scale);
  ctx.stroke();
  // Rechter Arm: Schaufelbewegung
  ctx.beginPath();
  ctx.moveTo(2.5 * scale, (-6 + breathe) * scale);
  ctx.lineTo((3 + dig * 0.4) * scale, (-8 + breathe + Math.abs(dig) * 0.3) * scale);
  ctx.stroke();

  // Schaufel (grabend)
  ctx.save();
  ctx.translate((4 + dig * 0.2) * scale, (-7 + breathe) * scale);
  ctx.rotate((dig * 0.06) - 0.2);
  // Stiel
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(5 * scale, 4 * scale);
  ctx.stroke();
  // Schaufelblatt
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.ellipse(5.5 * scale, 5 * scale, 2 * scale, 2.8 * scale, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Erde auf Schaufel (bei Grab-Bewegung)
  if (dig > 1) {
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.ellipse(5 * scale, 4 * scale, 1.5 * scale, 1 * scale, 0.3, 0, Math.PI);
    ctx.fill();
  }
  ctx.restore();

  // Fortschrittsbalken
  if (progress > 0) {
    const barW = 18 * scale;
    const barH = 3 * scale;
    const barX = -barW / 2;
    const barY = (-20 + breathe) * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // Bäume-Counter
  const trees = ped.npcTreesPlanted || 0;
  if (trees > 0) {
    ctx.font = `bold ${10 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(`🌳${trees}`, 0, (-24 + breathe) * scale);
    ctx.fillStyle = '#fff';
    ctx.fillText(`🌳${trees}`, 0, (-24 + breathe) * scale);
  }
}

// ============================================================================
// Police & Gangster Drawing Functions
// ============================================================================

/**
 * Draw a police officer running (chasing) - blaue Uniform, Polizeimütze, Handfeuerwaffe
 */
function drawPoliceRunning(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const run = ped.walkOffset;
  const bounce = Math.abs(Math.sin(run * 2)) * 1.5;
  const legSwing = Math.sin(run) * 5;
  const armSwing = Math.sin(run + Math.PI) * 4;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Polizeimütze
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(0, (-15 + bounce) * scale, 4 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mützen-Schirm
  ctx.fillStyle = '#0f2640';
  ctx.beginPath();
  ctx.ellipse(2 * scale, (-14.5 + bounce) * scale, 2.5 * scale, 0.8 * scale, 0.2, 0, Math.PI);
  ctx.fill();
  // Goldenes Polizei-Abzeichen auf Mütze
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, (-15.5 + bounce) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Körper (dunkelblaue Uniform)
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(0, (-5 + bounce) * scale, 3 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Goldenes Badge auf Brust
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (-7 + bounce) * scale);
  ctx.lineTo(0, (-8.5 + bounce) * scale);
  ctx.lineTo(1 * scale, (-7 + bounce) * scale);
  ctx.lineTo(0, (-6 + bounce) * scale);
  ctx.closePath();
  ctx.fill();

  // Gürtel mit Ausrüstung
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-3 * scale, (-2 + bounce) * scale, 6 * scale, 1.5 * scale);
  // Gürtelschnalle
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-0.5 * scale, (-2 + bounce) * scale, 1 * scale, 1.5 * scale);

  // Beine (rennend)
  ctx.strokeStyle = '#1a2744';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, (-0.5 + bounce) * scale);
  ctx.lineTo(legSwing * scale, (5 + bounce) * scale);
  ctx.moveTo(0, (-0.5 + bounce) * scale);
  ctx.lineTo(-legSwing * scale, (5 + bounce) * scale);
  ctx.stroke();

  // Schuhe
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(legSwing * scale, (5.5 + bounce) * scale, 1.5 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(-legSwing * scale, (5.5 + bounce) * scale, 1.5 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Linker Arm (pumpend)
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-6 + bounce) * scale);
  ctx.lineTo((-3.5 + armSwing * 0.5) * scale, (-2 + bounce) * scale);
  ctx.stroke();

  // Rechter Arm mit Handfeuerwaffe (gestreckt nach vorne)
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(2.5 * scale, (-6 + bounce) * scale);
  ctx.lineTo((4 + armSwing * 0.2) * scale, (-8 + bounce) * scale);
  ctx.stroke();

  // Handfeuerwaffe (Pistole)
  ctx.fillStyle = '#2d2d2d';
  ctx.save();
  ctx.translate((4.5 + armSwing * 0.2) * scale, (-8.5 + bounce) * scale);
  ctx.rotate(-0.3);
  // Griff
  ctx.fillRect(-0.5 * scale, 0, 1 * scale, 2 * scale);
  // Lauf
  ctx.fillRect(-0.5 * scale, -2.5 * scale, 1 * scale, 2.5 * scale);
  ctx.restore();

  // Mündungsblitz (nur wenn Gangster verfolgt wird)
  const isChasing = (ped.npcChaseTargetId || 0) > 0;
  const flash = Math.sin(ped.activityAnimTimer * 3);
  if (isChasing && flash > 0.85) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc((5.5 + armSwing * 0.2) * scale, (-11 + bounce) * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc((5.5 + armSwing * 0.2) * scale, (-11 + bounce) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // "POLIZEI" Kennzeichnung (klein über dem Kopf)
  ctx.font = `bold ${7 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeText('🚔', 0, (-20 + bounce) * scale);
  ctx.fillStyle = '#fff';
  ctx.fillText('🚔', 0, (-20 + bounce) * scale);
}

/**
 * Draw a gangster running (fleeing) - schwarzer Hoodie, Sturmhaube, grosses Gewehr, SCHIESST!
 */
function drawGangsterRunning(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const run = ped.walkOffset;
  const bounce = Math.abs(Math.sin(run * 2.2)) * 1.8;
  const legSwing = Math.sin(run) * 6;
  const armSwing = Math.sin(run) * 4;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Sturmhaube/Skimaske
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, (-12 + bounce) * scale, 3.4 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Augenöffnung
  ctx.fillStyle = ped.skinColor;
  ctx.fillRect(-2.5 * scale, (-12.5 + bounce) * scale, 5 * scale, 2 * scale);
  // Augen (bedrohlich)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(-1 * scale, (-12 + bounce) * scale, 0.6 * scale, 0, Math.PI * 2);
  ctx.arc(1 * scale, (-12 + bounce) * scale, 0.6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hoodie/Kapuze
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.ellipse(0, (-14 + bounce) * scale, 4 * scale, 2.5 * scale, 0, Math.PI * 0.8, Math.PI * 2.2);
  ctx.fill();

  // Körper (schwarzer Hoodie)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, (-5 + bounce) * scale, 3.2 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hoodie-Tasche
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(-2 * scale, (-4 + bounce) * scale, 4 * scale, 2.5 * scale);

  // Beine (rennend)
  ctx.strokeStyle = '#2d2d2d';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, (-0.5 + bounce) * scale);
  ctx.lineTo(legSwing * scale, (5 + bounce) * scale);
  ctx.moveTo(0, (-0.5 + bounce) * scale);
  ctx.lineTo(-legSwing * scale, (5 + bounce) * scale);
  ctx.stroke();

  // Sneakers
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(legSwing * scale, (5.5 + bounce) * scale, 1.5 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(-legSwing * scale, (5.5 + bounce) * scale, 1.5 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arme (rennend, schwingend)
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-6 + bounce) * scale);
  ctx.lineTo((-4 + armSwing) * scale, (-2 + bounce) * scale);
  ctx.moveTo(2.5 * scale, (-6 + bounce) * scale);
  ctx.lineTo((4 - armSwing) * scale, (-2 + bounce) * scale);
  ctx.stroke();

  // Gangster-Kennzeichnung
  ctx.font = `bold ${7 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeText('💀', 0, (-20 + bounce) * scale);
  ctx.fillStyle = '#fff';
  ctx.fillText('💀', 0, (-20 + bounce) * scale);
}

/**
 * Draw police arresting gangster - Polizist steht über Gangster
 */
function drawPoliceArresting(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const breathe = Math.sin(ped.activityAnimTimer * 0.5) * 0.3;
  const progress = (ped.npcWorkProgress || 0) / 100;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 4 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + breathe) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Polizeimütze
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(0, (-15 + breathe) * scale, 4 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, (-15.5 + breathe) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Körper (gebeugt)
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(0, (-4 + breathe) * scale, 3 * scale, 5 * scale, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Badge
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (-6 + breathe) * scale);
  ctx.lineTo(0, (-7.5 + breathe) * scale);
  ctx.lineTo(1 * scale, (-6 + breathe) * scale);
  ctx.closePath();
  ctx.fill();

  // Beine (breit stehend)
  ctx.strokeStyle = '#1a2744';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, (1 + breathe) * scale);
  ctx.lineTo(-2.5 * scale, (5 + breathe) * scale);
  ctx.moveTo(1 * scale, (1 + breathe) * scale);
  ctx.lineTo(2.5 * scale, (5 + breathe) * scale);
  ctx.stroke();

  // Arme: Handschellen anlegen
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-5 + breathe) * scale);
  ctx.lineTo((-4) * scale, (0 + breathe) * scale);
  ctx.moveTo(2.5 * scale, (-5 + breathe) * scale);
  ctx.lineTo((4) * scale, (0 + breathe) * scale);
  ctx.stroke();

  // Handschellen (blitzend)
  if (Math.sin(ped.activityAnimTimer * 4) > 0) {
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.arc(4 * scale, (1 + breathe) * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.arc(5.5 * scale, (1 + breathe) * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 0.5 * scale;
    ctx.beginPath();
    ctx.moveTo(4 * scale, (1 + breathe) * scale);
    ctx.lineTo(5.5 * scale, (1 + breathe) * scale);
    ctx.stroke();
  }

  // Fortschrittsbalken
  if (progress > 0) {
    const barW = 18 * scale;
    const barH = 3 * scale;
    const barX = -barW / 2;
    const barY = (-20 + breathe) * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // Blaulicht-Effekt (pulsierend)
  const siren = Math.sin(ped.activityAnimTimer * 8);
  ctx.fillStyle = siren > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(220, 38, 38, 0.3)';
  ctx.beginPath();
  ctx.arc(0, (-10 + breathe) * scale, 12 * scale, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw gangster being arrested - auf dem Boden, Hände hoch
 */
function drawGangsterArrested(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const tremble = Math.sin(ped.activityAnimTimer * 6) * 0.5;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 4 * scale, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gangster auf dem Boden (kniend)
  // Beine (kniend)
  ctx.strokeStyle = '#2d2d2d';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 2 * scale);
  ctx.lineTo(-2 * scale, 5 * scale);
  ctx.moveTo(1 * scale, 2 * scale);
  ctx.lineTo(2 * scale, 5 * scale);
  ctx.stroke();

  // Körper (schwarzer Hoodie)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(tremble * scale, (-2) * scale, 3 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf mit Sturmhaube
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(tremble * scale, (-8) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Augenöffnung
  ctx.fillStyle = ped.skinColor;
  ctx.fillRect((-2.5 + tremble) * scale, (-8.5) * scale, 5 * scale, 2 * scale);
  // Augen (verängstigt)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc((-1 + tremble) * scale, (-8) * scale, 0.8 * scale, 0, Math.PI * 2);
  ctx.arc((1 + tremble) * scale, (-8) * scale, 0.8 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Arme hoch (Hände hoch!)
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((-2.5 + tremble) * scale, (-4) * scale);
  ctx.lineTo((-4 + tremble) * scale, (-12) * scale);
  ctx.moveTo((2.5 + tremble) * scale, (-4) * scale);
  ctx.lineTo((4 + tremble) * scale, (-12) * scale);
  ctx.stroke();
  // Hände (offen)
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc((-4 + tremble) * scale, (-12.5) * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.arc((4 + tremble) * scale, (-12.5) * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Gewehr am Boden (fallen gelassen)
  ctx.save();
  ctx.translate(5 * scale, 3 * scale);
  ctx.rotate(0.4);
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(7 * scale, 0);
  ctx.stroke();
  ctx.fillStyle = '#5c3a1a';
  ctx.fillRect(5.5 * scale, -1 * scale, 2.5 * scale, 2 * scale);
  ctx.restore();

  // "Verhaftet" text
  const flash = Math.sin(ped.activityAnimTimer * 3) > 0;
  if (flash) {
    ctx.font = `bold ${7 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeText('🔒', 0, (-17) * scale);
    ctx.fillStyle = '#fff';
    ctx.fillText('🔒', 0, (-17) * scale);
  }
}

/**
 * Draw gangster robbing a pedestrian - Gangster bedroht Opfer mit Waffe
 */
function drawGangsterRobbing(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const t = ped.activityAnimTimer;
  const progress = ped.activityProgress;
  const threatPulse = Math.sin(t * 4) * 1.5;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // === OPFER (rechts, verängstigt) ===
  const victimX = 8 * scale;
  const victimTremble = Math.sin(t * 8) * 0.6;

  // Opfer-Körper
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(victimX + victimTremble * scale, (-10) * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Opfer-Augen (erschrocken, weit offen)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc((victimX - 0.8 + victimTremble) * scale, (-10.5) * scale, 0.8 * scale, 0, Math.PI * 2);
  ctx.arc((victimX + 0.8 + victimTremble) * scale, (-10.5) * scale, 0.8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc((victimX - 0.8 + victimTremble) * scale, (-10.5) * scale, 0.4 * scale, 0, Math.PI * 2);
  ctx.arc((victimX + 0.8 + victimTremble) * scale, (-10.5) * scale, 0.4 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Opfer-Mund (offen, schreiend)
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse((victimX + victimTremble) * scale, (-8.5) * scale, 0.8 * scale, 1 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Opfer-Torso
  ctx.fillStyle = '#6ba3d6';
  ctx.beginPath();
  ctx.ellipse((victimX + victimTremble) * scale, (-4) * scale, 2.5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Opfer-Arme (hoch, Hände hoch)
  ctx.strokeStyle = '#e8b88a';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo((victimX - 2 + victimTremble) * scale, (-5) * scale);
  ctx.lineTo((victimX - 3 + victimTremble) * scale, (-12) * scale);
  ctx.moveTo((victimX + 2 + victimTremble) * scale, (-5) * scale);
  ctx.lineTo((victimX + 3 + victimTremble) * scale, (-12) * scale);
  ctx.stroke();

  // Opfer-Beine
  ctx.strokeStyle = '#4a6fa5';
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.moveTo((victimX - 0.5) * scale, 0);
  ctx.lineTo((victimX - 1.5) * scale, 5 * scale);
  ctx.moveTo((victimX + 0.5) * scale, 0);
  ctx.lineTo((victimX + 1.5) * scale, 5 * scale);
  ctx.stroke();

  // === GANGSTER (links, bedrohlich) ===

  // Gangster-Kopf mit Sturmhaube
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(threatPulse * 0.3 * scale, (-12) * scale, 3.4 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skinColor;
  ctx.fillRect((-2.5 + threatPulse * 0.3) * scale, (-12.5) * scale, 5 * scale, 2 * scale);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc((-1 + threatPulse * 0.3) * scale, (-12) * scale, 0.6 * scale, 0, Math.PI * 2);
  ctx.arc((1 + threatPulse * 0.3) * scale, (-12) * scale, 0.6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hoodie/Kapuze
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.ellipse(threatPulse * 0.3 * scale, (-14) * scale, 4 * scale, 2.5 * scale, 0, Math.PI * 0.8, Math.PI * 2.2);
  ctx.fill();

  // Körper (schwarzer Hoodie)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, (-5) * scale, 3.2 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beine (breit, stabil)
  ctx.strokeStyle = '#2d2d2d';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-1 * scale, 0);
  ctx.lineTo(-2.5 * scale, 5 * scale);
  ctx.moveTo(1 * scale, 0);
  ctx.lineTo(2.5 * scale, 5 * scale);
  ctx.stroke();

  // Sneakers
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(-2.5 * scale, 5.5 * scale, 1.5 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(2.5 * scale, 5.5 * scale, 1.5 * scale, 0.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rechter Arm droht dem Opfer (geballte Faust)
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(2.5 * scale, (-6) * scale);
  ctx.lineTo((5 + threatPulse * 0.2) * scale, (-7) * scale);
  ctx.stroke();

  // Geballte Faust
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc((5.5 + threatPulse * 0.2) * scale, (-7) * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5 * scale;
  ctx.stroke();

  // Linker Arm (greift nach Beute / Geldbeutel)
  const grabProgress = Math.min(1, progress * 2);
  const grabX = -2.5 + grabProgress * 3;
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-6) * scale);
  ctx.lineTo(grabX * scale, (-4) * scale);
  ctx.stroke();

  // Geldbeutel/Beute (erscheint wenn Raub fortschreitet)
  if (progress > 0.4) {
    const bagAlpha = Math.min(1, (progress - 0.4) * 3);
    ctx.fillStyle = `rgba(139, 90, 43, ${bagAlpha})`;
    ctx.fillRect((grabX - 1) * scale, (-5) * scale, 2.5 * scale, 2 * scale);
    ctx.fillStyle = `rgba(218, 165, 32, ${bagAlpha})`;
    ctx.fillRect((grabX - 0.5) * scale, (-4.5) * scale, 0.8 * scale, 0.5 * scale);
  }

  // Kennzeichnung
  const flash = Math.sin(t * 3);
  if (flash > 0) {
    ctx.font = `bold ${7 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeText('💰', 0, (-20) * scale);
    ctx.fillStyle = '#fff';
    ctx.fillText('💰', 0, (-20) * scale);
  }

  // "ÜBERFALL!"-Warnung bei Beginn
  if (progress < 0.3) {
    const warnAlpha = 1 - progress / 0.3;
    ctx.font = `bold ${5 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(220, 38, 38, ${warnAlpha})`;
    ctx.strokeStyle = `rgba(0, 0, 0, ${warnAlpha * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.strokeText('ÜBERFALL!', 0, (-25) * scale);
    ctx.fillText('ÜBERFALL!', 0, (-25) * scale);
  }
}

/**
 * Draw police officer walking with arrested gangster to car
 */
function drawPoliceTransporting(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const run = ped.walkOffset;
  const walkBob = Math.abs(Math.sin(run * 1.5)) * 1;
  const legSwing = Math.sin(run) * 3;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 5 * scale, 1.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // === Gangster (rechts, Hände gefesselt, wird geführt) ===
  const gx = 6;
  const gTremble = Math.sin(ped.activityAnimTimer * 4) * 0.3;

  // Gangster-Kopf (Sturmhaube)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc((gx + gTremble) * scale, (-10 + walkBob) * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4956a';
  ctx.fillRect((gx - 2 + gTremble) * scale, (-10.5 + walkBob) * scale, 4 * scale, 1.5 * scale);

  // Gangster-Körper
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse((gx + gTremble) * scale, (-4 + walkBob) * scale, 2.5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gangster-Arme (hinter dem Rücken, gefesselt)
  ctx.strokeStyle = '#c4956a';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo((gx + 2 + gTremble) * scale, (-4 + walkBob) * scale);
  ctx.lineTo((gx + 1 + gTremble) * scale, (-2 + walkBob) * scale);
  ctx.lineTo((gx - 1 + gTremble) * scale, (-2 + walkBob) * scale);
  ctx.lineTo((gx - 2 + gTremble) * scale, (-4 + walkBob) * scale);
  ctx.stroke();

  // Handschellen
  ctx.strokeStyle = '#b0b0b0';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.arc((gx + gTremble) * scale, (-2 + walkBob) * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Gangster-Beine (schlurfend)
  ctx.strokeStyle = '#2d2d2d';
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.moveTo((gx - 0.5) * scale, (0 + walkBob) * scale);
  ctx.lineTo((gx - 1 + legSwing * 0.5) * scale, (5 + walkBob) * scale);
  ctx.moveTo((gx + 0.5) * scale, (0 + walkBob) * scale);
  ctx.lineTo((gx + 1 - legSwing * 0.5) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // === Polizist (links, hält Gangster am Arm) ===

  // Polizei-Kopf
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(0, (-11 + walkBob) * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Polizeimütze
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(0, (-13 + walkBob) * scale, 3 * scale, 1.5 * scale, 0, Math.PI * 0.8, Math.PI * 2.2);
  ctx.fill();
  ctx.fillRect(-2.5 * scale, (-13.5 + walkBob) * scale, 5 * scale, 1.5 * scale);

  // Badge auf Mütze
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.arc(0, (-13 + walkBob) * scale, 0.6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Polizei-Körper (Uniform)
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(0, (-4.5 + walkBob) * scale, 2.8 * scale, 3.8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Polizei-Badge
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.arc(1.5 * scale, (-5.5 + walkBob) * scale, 0.8 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Rechter Arm (hält Gangster)
  ctx.strokeStyle = '#e8b88a';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(2.5 * scale, (-5 + walkBob) * scale);
  ctx.lineTo((gx - 2) * scale, (-4 + walkBob) * scale);
  ctx.stroke();

  // Linker Arm (frei, leicht schwingend)
  ctx.beginPath();
  ctx.moveTo(-2.5 * scale, (-5 + walkBob) * scale);
  ctx.lineTo((-3 + legSwing * 0.3) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // Polizei-Beine
  ctx.strokeStyle = '#1a2a40';
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.moveTo(-0.5 * scale, (0 + walkBob) * scale);
  ctx.lineTo((-1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.moveTo(0.5 * scale, (0 + walkBob) * scale);
  ctx.lineTo((1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Kennzeichnung
  ctx.font = `bold ${6 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeText('🚔', 0, (-18 + walkBob) * scale);
  ctx.fillStyle = '#fff';
  ctx.fillText('🚔', 0, (-18 + walkBob) * scale);
}

/**
 * Draw gangster being transported (walks alongside police, hands behind back)
 */
function drawGangsterBeingTransported(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.30;
  const run = ped.walkOffset;
  const walkBob = Math.abs(Math.sin(run * 1.5)) * 1;
  const legSwing = Math.sin(run) * 2;
  const tremble = Math.sin(ped.activityAnimTimer * 4) * 0.3;

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 5 * scale, 3 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kopf (Sturmhaube, gesenkter Blick)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(tremble * scale, (-9 + walkBob) * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4956a';
  ctx.fillRect((-2 + tremble) * scale, (-9.5 + walkBob) * scale, 4 * scale, 1.5 * scale);
  // Niedergeschlagene Augen
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc((-0.7 + tremble) * scale, (-9 + walkBob) * scale, 0.4 * scale, 0, Math.PI * 2);
  ctx.arc((0.7 + tremble) * scale, (-9 + walkBob) * scale, 0.4 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Körper
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(tremble * scale, (-3.5 + walkBob) * scale, 2.5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arme hinter dem Rücken (gefesselt)
  ctx.strokeStyle = '#c4956a';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.moveTo((1.5 + tremble) * scale, (-3 + walkBob) * scale);
  ctx.lineTo((0.5 + tremble) * scale, (-1 + walkBob) * scale);
  ctx.lineTo((-0.5 + tremble) * scale, (-1 + walkBob) * scale);
  ctx.lineTo((-1.5 + tremble) * scale, (-3 + walkBob) * scale);
  ctx.stroke();

  // Handschellen
  ctx.strokeStyle = '#b0b0b0';
  ctx.lineWidth = 0.8 * scale;
  ctx.beginPath();
  ctx.arc(tremble * scale, (-1 + walkBob) * scale, 1 * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Beine (schlurfend, langsam)
  ctx.strokeStyle = '#2d2d2d';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-0.5 * scale, (0.5 + walkBob) * scale);
  ctx.lineTo((-1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.moveTo(0.5 * scale, (0.5 + walkBob) * scale);
  ctx.lineTo((1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Schuhe
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse((-1 + legSwing) * scale, (5.5 + walkBob) * scale, 1.2 * scale, 0.6 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse((1 - legSwing) * scale, (5.5 + walkBob) * scale, 1.2 * scale, 0.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // "Verhaftet" Icon
  const flash = Math.sin(ped.activityAnimTimer * 2) > 0;
  if (flash) {
    ctx.font = `bold ${5 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeText('🔒', 0, (-14 + walkBob) * scale);
    ctx.fillStyle = '#fff';
    ctx.fillText('🔒', 0, (-14 + walkBob) * scale);
  }
}

// ============================================================================
// Shop Activity Drawing Functions
// ============================================================================

/**
 * Draw a shopper walking from road to shop entrance
 */
function drawShopperQueuing(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.28;
  const walkBob = Math.sin(ped.walkOffset) * 0.6;
  const walkSway = Math.sin(ped.walkOffset * 0.5) * 0.4;
  const legSwing = Math.sin(ped.walkOffset) * 2.5;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(walkSway * scale, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hair for variety
  if (ped.id % 2 === 0) {
    const hairColor = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a'][ped.id % 6];
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(walkSway * scale, (-13 + walkBob) * scale, 3 * scale, Math.PI, 0);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(walkSway * scale, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - walking
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway - 1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(walkSway * scale, (-1 + walkBob) * scale);
  ctx.lineTo((walkSway + 1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Arms - swinging while walking
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const armSwing = legSwing * 0.6;
  ctx.beginPath();
  ctx.moveTo((walkSway - 2) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway - 3 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((walkSway + 2) * scale, (-6 + walkBob) * scale);
  ctx.lineTo((walkSway + 3 + armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();
}

/**
 * Draw a shopper walking through shop door (entering or exiting)
 */
function drawShopperAtDoor(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.28;
  const walkBob = Math.sin(ped.walkOffset) * 0.5;

  // Head
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(0, (-12 + walkBob) * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  if (ped.id % 2 === 0) {
    const hairColor = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a'][ped.id % 6];
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, (-13 + walkBob) * scale, 3 * scale, Math.PI, 0);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = ped.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, (-5 + walkBob) * scale, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - walking slowly
  const legSwing = Math.sin(ped.walkOffset) * 1.5;
  ctx.strokeStyle = ped.pantsColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo((-1 + legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, (-1 + walkBob) * scale);
  ctx.lineTo((1 - legSwing) * scale, (5 + walkBob) * scale);
  ctx.stroke();

  // Arms - swinging slightly
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 1.2 * scale;
  const armSwing = legSwing * 0.5;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, (-6 + walkBob) * scale);
  ctx.lineTo((-3 - armSwing) * scale, (-2 + walkBob) * scale);
  ctx.stroke();

  // If exiting with bag, show shopping bag
  if (ped.hasBag && ped.state === 'exiting_building') {
    // Shopping bag in hand
    ctx.fillStyle = '#e74c3c'; // Red shopping bag
    ctx.fillRect((2) * scale, (-4 + walkBob) * scale, 3 * scale, 4 * scale);
    // Bag handles
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 0.5 * scale;
    ctx.beginPath();
    ctx.moveTo((2.5) * scale, (-4 + walkBob) * scale);
    ctx.lineTo((2.5) * scale, (-5 + walkBob) * scale);
    ctx.moveTo((4.5) * scale, (-4 + walkBob) * scale);
    ctx.lineTo((4.5) * scale, (-5 + walkBob) * scale);
    ctx.stroke();
    
    // Arm holding bag
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(2 * scale, (-6 + walkBob) * scale);
    ctx.lineTo((3) * scale, (-4 + walkBob) * scale);
    ctx.stroke();
  } else {
    // Regular arm
    ctx.beginPath();
    ctx.moveTo(2 * scale, (-6 + walkBob) * scale);
    ctx.lineTo((3 + armSwing) * scale, (-2 + walkBob) * scale);
    ctx.stroke();
  }
}

// ============================================================================
// Beach Activity Drawing Functions
// ============================================================================

/**
 * Draw a beach swimmer (person swimming in open water near shore)
 * Different from pool swimmer - more realistic ocean swimming
 */
function drawBeachSwimmer(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.24;
  const swim = Math.sin(ped.activityAnimTimer * 1.8);
  const bob = Math.sin(ped.activityAnimTimer * 1.2) * 1.5;
  const wave = Math.sin(ped.activityAnimTimer * 0.8) * 0.5;

  // Water ripples around swimmer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 10 * scale + Math.abs(swim) * 2, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Darker water effect
  ctx.fillStyle = 'rgba(30, 100, 180, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 1 * scale, 9 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head bobbing in water
  ctx.fillStyle = ped.skinColor;
  ctx.beginPath();
  ctx.arc(wave * scale, (-2 + bob) * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Wet hair
  const hairColor = HAIR_COLORS[ped.id % HAIR_COLORS.length];
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(wave * scale, (-3.5 + bob) * scale, 3 * scale, Math.PI, 0);
  ctx.fill();

  // Swimming arms - freestyle stroke motion
  ctx.strokeStyle = ped.skinColor;
  ctx.lineWidth = 2 * scale;
  
  // Left arm
  const leftArmPhase = ped.activityAnimTimer * 1.8;
  const leftArmUp = Math.sin(leftArmPhase) > 0;
  if (leftArmUp) {
    // Arm coming out of water
    ctx.beginPath();
    ctx.moveTo((-3 + wave) * scale, (0 + bob) * scale);
    ctx.quadraticCurveTo(
      (-6 + Math.sin(leftArmPhase) * 4) * scale,
      (-3 + Math.cos(leftArmPhase) * 2 + bob) * scale,
      (-8 + Math.sin(leftArmPhase) * 2) * scale,
      (1 + bob) * scale
    );
    ctx.stroke();
  }
  
  // Right arm (offset phase)
  const rightArmPhase = ped.activityAnimTimer * 1.8 + Math.PI;
  const rightArmUp = Math.sin(rightArmPhase) > 0;
  if (rightArmUp) {
    ctx.beginPath();
    ctx.moveTo((3 + wave) * scale, (0 + bob) * scale);
    ctx.quadraticCurveTo(
      (6 + Math.sin(rightArmPhase) * 4) * scale,
      (-3 + Math.cos(rightArmPhase) * 2 + bob) * scale,
      (8 + Math.sin(rightArmPhase) * 2) * scale,
      (1 + bob) * scale
    );
    ctx.stroke();
  }

  // Splash effects when arm enters water
  if (Math.sin(leftArmPhase) < -0.8) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc((-7 + wave) * scale, (1 + bob) * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  if (Math.sin(rightArmPhase) < -0.8) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc((7 + wave) * scale, (1 + bob) * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kick splash behind
  const kickSplash = Math.abs(Math.sin(ped.activityAnimTimer * 3.5)) * 0.4;
  if (kickSplash > 0.2) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6 * scale, 4 * scale, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a person lying on a beach mat/towel
 */
function drawBeachMat(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.22;
  const breathe = Math.sin(ped.activityAnimTimer * 0.3) * 0.3;
  
  // Determine mat orientation based on beach edge
  // The mat should be parallel to the water's edge
  let matAngle = 0;
  switch (ped.beachEdge) {
    case 'north':
      matAngle = Math.PI / 4; // 45 degrees
      break;
    case 'east':
      matAngle = -Math.PI / 4;
      break;
    case 'south':
      matAngle = Math.PI / 4;
      break;
    case 'west':
      matAngle = -Math.PI / 4;
      break;
  }
  
  ctx.save();
  ctx.rotate(matAngle);
  
  // Beach mat/towel - colorful striped design
  const matWidth = 20 * scale;
  const matHeight = 10 * scale;
  
  // Mat shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(1 * scale, 2 * scale, matWidth * 0.55, matHeight * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main mat color
  ctx.fillStyle = ped.matColor;
  ctx.fillRect(-matWidth / 2, -matHeight / 2, matWidth, matHeight);
  
  // Stripes on mat
  const stripeColor = adjustColorBrightness(ped.matColor, -30);
  ctx.fillStyle = stripeColor;
  ctx.fillRect(-matWidth / 2, -matHeight / 2 + matHeight * 0.2, matWidth, matHeight * 0.15);
  ctx.fillRect(-matWidth / 2, -matHeight / 2 + matHeight * 0.55, matWidth, matHeight * 0.15);
  ctx.fillRect(-matWidth / 2, -matHeight / 2 + matHeight * 0.85, matWidth, matHeight * 0.15);
  
  // Mat border/fringe
  ctx.strokeStyle = adjustColorBrightness(ped.matColor, -50);
  ctx.lineWidth = 0.5 * scale;
  ctx.strokeRect(-matWidth / 2, -matHeight / 2, matWidth, matHeight);

  // Person lying face down or on back (random based on ID)
  const faceDown = ped.id % 2 === 0;
  
  if (faceDown) {
    // Lying face down - sunbathing
    // Body (torso) - horizontal
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.ellipse(0, breathe * scale, 3 * scale, 5 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(-6 * scale, breathe * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair on back of head
    const hairColor = HAIR_COLORS[ped.id % HAIR_COLORS.length];
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(-6 * scale, breathe * scale, 2.5 * scale, Math.PI * 0.3, Math.PI * 1.7);
    ctx.fill();
    
    // Arms stretched out or by sides
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe - 2) * scale);
    ctx.lineTo(-8 * scale, (breathe - 3) * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe + 2) * scale);
    ctx.lineTo(-8 * scale, (breathe + 3) * scale);
    ctx.stroke();
    
    // Legs
    ctx.fillStyle = ped.pantsColor;
    ctx.beginPath();
    ctx.ellipse(5 * scale, breathe * scale, 2 * scale, 3 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Feet
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(8 * scale, (breathe - 1) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.arc(8 * scale, (breathe + 1) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Lying on back - relaxing
    // Body (torso) - horizontal
    ctx.fillStyle = ped.shirtColor;
    ctx.beginPath();
    ctx.ellipse(0, breathe * scale, 3 * scale, 5 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(-6 * scale, breathe * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Face details (simple)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    // Eyes closed
    ctx.moveTo(-7 * scale, (breathe - 0.5) * scale);
    ctx.lineTo(-6.5 * scale, (breathe - 0.5) * scale);
    ctx.moveTo(-5.5 * scale, (breathe - 0.5) * scale);
    ctx.lineTo(-5 * scale, (breathe - 0.5) * scale);
    ctx.stroke();
    
    // Arms by sides
    ctx.strokeStyle = ped.skinColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe - 2.5) * scale);
    ctx.lineTo(3 * scale, (breathe - 4) * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2 * scale, (breathe + 2.5) * scale);
    ctx.lineTo(3 * scale, (breathe + 4) * scale);
    ctx.stroke();
    
    // Legs
    ctx.fillStyle = ped.pantsColor;
    ctx.beginPath();
    ctx.ellipse(5 * scale, breathe * scale, 2 * scale, 3 * scale, Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Feet
    ctx.fillStyle = ped.skinColor;
    ctx.beginPath();
    ctx.arc(8 * scale, (breathe - 1.5) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.arc(8 * scale, (breathe + 1.5) * scale, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ==========================================
// BÜNZLI NPC DRAWING
// ==========================================

/**
 * Bünzli beim Laufen zeichnen
 * Schweizer Bünzli: Ordentliches Hemd, dunkle Weste, Brille, Klemmbrett
 */
function drawBuenzliWalking(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.42;
  const t = ped.activityAnimTimer;
  const bounce = Math.sin(t * 4) * 1.5;
  const legSwing = Math.sin(t * 4) * 6;
  const armSwing = Math.sin(t * 4) * 4;

  ctx.save();

  // Schuhe (dunkle Lederschuhe)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse((-1 + legSwing * 0.3) * scale, (8 + bounce * 0.5) * scale, 2.5 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse((-1 - legSwing * 0.3) * scale, (8 + bounce * 0.5) * scale, 2.5 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beine (dunkle Hose)
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo((legSwing * 0.25) * scale, (3 + bounce) * scale);
  ctx.lineTo((legSwing * 0.3) * scale, (7 + bounce * 0.5) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((-legSwing * 0.25) * scale, (3 + bounce) * scale);
  ctx.lineTo((-legSwing * 0.3) * scale, (7 + bounce * 0.5) * scale);
  ctx.stroke();

  // Körper (weisses Hemd)
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.ellipse(0, (bounce - 1) * scale, 4 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Weste (dunkelgrau)
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.ellipse(0, (bounce - 0.5) * scale, 3.5 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Weisser Kragen sichtbar
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(0, (bounce - 5) * scale, 2.5 * scale, Math.PI, Math.PI * 2);
  ctx.fill();

  // Krawatte (rot mit weissem Kreuz = Schweizer Flagge vibe)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-0.8 * scale, (bounce - 4) * scale, 1.6 * scale, 4 * scale);
  // Kleines weisses Kreuz auf Krawatte
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-0.5 * scale, (bounce - 2.5) * scale, 1 * scale, 0.4 * scale);
  ctx.fillRect(-0.2 * scale, (bounce - 2.8) * scale, 0.4 * scale, 1 * scale);

  // Linker Arm (schwingt mit)
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-3.5 * scale, (bounce - 2) * scale);
  ctx.lineTo((-4.5 - armSwing * 0.5) * scale, (bounce + 2) * scale);
  ctx.stroke();
  // Hand
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc((-4.5 - armSwing * 0.5) * scale, (bounce + 2.5) * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Rechter Arm (hält Klemmbrett)
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.moveTo(3.5 * scale, (bounce - 2) * scale);
  ctx.lineTo((5 + armSwing * 0.3) * scale, (bounce + 1) * scale);
  ctx.stroke();
  // Klemmbrett
  ctx.fillStyle = '#92400e';
  ctx.fillRect((4 + armSwing * 0.3) * scale, (bounce - 0.5) * scale, 3.5 * scale, 4.5 * scale);
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect((4.3 + armSwing * 0.3) * scale, (bounce) * scale, 2.9 * scale, 3.5 * scale);
  // Schrift auf dem Klemmbrett (kleine Linien)
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 0.3 * scale;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((4.6 + armSwing * 0.3) * scale, (bounce + 0.8 + i * 0.9) * scale);
    ctx.lineTo((6.8 + armSwing * 0.3) * scale, (bounce + 0.8 + i * 0.9) * scale);
    ctx.stroke();
  }
  // Hand am Klemmbrett
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc((5 + armSwing * 0.3) * scale, (bounce + 1) * scale, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Kopf
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(0, (bounce - 8) * scale, 3.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Brille (rechteckig, typisch Bünzli)
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5 * scale;
  // Bügel
  ctx.beginPath();
  ctx.moveTo(-3 * scale, (bounce - 8.5) * scale);
  ctx.lineTo(3 * scale, (bounce - 8.5) * scale);
  ctx.stroke();
  // Gläser
  ctx.fillStyle = 'rgba(200, 220, 255, 0.5)';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 0.4 * scale;
  ctx.beginPath();
  ctx.rect(-2.8 * scale, (bounce - 9.3) * scale, 2.2 * scale, 1.8 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(0.6 * scale, (bounce - 9.3) * scale, 2.2 * scale, 1.8 * scale);
  ctx.fill();
  ctx.stroke();

  // Haare (kurz, ordentlich, seitlich gekämmt)
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.arc(0, (bounce - 10) * scale, 3 * scale, Math.PI, Math.PI * 2);
  ctx.fill();

  // Strenger Mund
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 0.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-1.2 * scale, (bounce - 6.5) * scale);
  ctx.lineTo(1.2 * scale, (bounce - 6.8) * scale);
  ctx.stroke();

  ctx.restore();
}

/**
 * Bünzli bei Inspektion zeichnen (steht vor Gebäude, schreibt, zeigt auf Dinge)
 */
function drawBuenzliInspecting(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const scale = 0.42;
  const t = ped.activityAnimTimer;
  const progress = ped.npcWorkProgress || 0;

  // Leichtes Wippen beim Stehen
  const breathe = Math.sin(t * 2) * 0.5;
  // Kopf dreht sich hin und her (schaut sich um)
  const headTurn = Math.sin(t * 1.5) * 2;
  // Schreib-Animation auf dem Klemmbrett
  const writeMotion = Math.sin(t * 6) * 1;

  ctx.save();

  // Schuhe
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(-1.5 * scale, (8 + breathe * 0.3) * scale, 2.5 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1.5 * scale, (8 + breathe * 0.3) * scale, 2.5 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beine (stehend)
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(-1.5 * scale, (3 + breathe) * scale);
  ctx.lineTo(-1.5 * scale, (7 + breathe * 0.3) * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1.5 * scale, (3 + breathe) * scale);
  ctx.lineTo(1.5 * scale, (7 + breathe * 0.3) * scale);
  ctx.stroke();

  // Körper (weisses Hemd + Weste)
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.ellipse(0, (breathe - 1) * scale, 4 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.ellipse(0, (breathe - 0.5) * scale, 3.5 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Kragen
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(0, (breathe - 5) * scale, 2.5 * scale, Math.PI, Math.PI * 2);
  ctx.fill();
  // Krawatte
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-0.8 * scale, (breathe - 4) * scale, 1.6 * scale, 4 * scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-0.5 * scale, (breathe - 2.5) * scale, 1 * scale, 0.4 * scale);
  ctx.fillRect(-0.2 * scale, (breathe - 2.8) * scale, 0.4 * scale, 1 * scale);

  // Linker Arm (zeigt auf Gebäude, periodisch)
  const pointPhase = Math.sin(t * 1.2);
  const isPointing = pointPhase > 0.3;
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2.5 * scale;
  if (isPointing) {
    // Arm zeigt nach vorne/oben (Vergehen entdeckt!)
    ctx.beginPath();
    ctx.moveTo(-3.5 * scale, (breathe - 2) * scale);
    ctx.lineTo((-6 + headTurn * 0.5) * scale, (breathe - 6) * scale);
    ctx.stroke();
    // Zeigefinger
    ctx.strokeStyle = '#f0c8a0';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo((-6 + headTurn * 0.5) * scale, (breathe - 6) * scale);
    ctx.lineTo((-7 + headTurn * 0.5) * scale, (breathe - 7.5) * scale);
    ctx.stroke();
  } else {
    // Arm normal
    ctx.beginPath();
    ctx.moveTo(-3.5 * scale, (breathe - 2) * scale);
    ctx.lineTo(-4.5 * scale, (breathe + 2) * scale);
    ctx.stroke();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(-4.5 * scale, (breathe + 2.5) * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rechter Arm (schreibt auf Klemmbrett)
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.moveTo(3.5 * scale, (breathe - 2) * scale);
  ctx.lineTo((5 + writeMotion * 0.2) * scale, (breathe + 0.5) * scale);
  ctx.stroke();
  // Klemmbrett (leicht angewinkelt)
  ctx.save();
  ctx.translate(5 * scale, (breathe) * scale);
  ctx.rotate(-0.2);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-1.5 * scale, -2 * scale, 3.5 * scale, 4.5 * scale);
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(-1.2 * scale, -1.5 * scale, 2.9 * scale, 3.5 * scale);
  // Häkchen auf dem Klemmbrett (Vergehen notiert)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 0.4 * scale;
  const checkmarks = Math.min(Math.floor(progress / 25) + 1, 4);
  for (let i = 0; i < checkmarks; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.8 * scale, (-0.8 + i * 0.8) * scale);
    ctx.lineTo(-0.4 * scale, (-0.4 + i * 0.8) * scale);
    ctx.lineTo(0.5 * scale, (-1.2 + i * 0.8) * scale);
    ctx.stroke();
  }
  // Stift in der Hand (schreibt)
  ctx.fillStyle = '#1a1a1a';
  ctx.save();
  ctx.translate(writeMotion * 0.3 * scale, 0);
  ctx.fillRect(-0.3 * scale, -2.5 * scale, 0.6 * scale, 2 * scale);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-0.3 * scale, -2.5 * scale, 0.6 * scale, 0.5 * scale);
  ctx.restore();
  ctx.restore();

  // Kopf (dreht sich hin und her)
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(headTurn * 0.3 * scale, (breathe - 8) * scale, 3.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Brille
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5 * scale;
  ctx.beginPath();
  ctx.moveTo((-3 + headTurn * 0.3) * scale, (breathe - 8.5) * scale);
  ctx.lineTo((3 + headTurn * 0.3) * scale, (breathe - 8.5) * scale);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200, 220, 255, 0.5)';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 0.4 * scale;
  ctx.beginPath();
  ctx.rect((-2.8 + headTurn * 0.3) * scale, (breathe - 9.3) * scale, 2.2 * scale, 1.8 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect((0.6 + headTurn * 0.3) * scale, (breathe - 9.3) * scale, 2.2 * scale, 1.8 * scale);
  ctx.fill();
  ctx.stroke();

  // Haare
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.arc(headTurn * 0.3 * scale, (breathe - 10) * scale, 3 * scale, Math.PI, Math.PI * 2);
  ctx.fill();

  // Verärgerter Mund (missbilligend)
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 0.6 * scale;
  ctx.beginPath();
  ctx.moveTo((-1.2 + headTurn * 0.3) * scale, (breathe - 6.2) * scale);
  ctx.quadraticCurveTo((headTurn * 0.3) * scale, (breathe - 6.8) * scale, (1.2 + headTurn * 0.3) * scale, (breathe - 6.2) * scale);
  ctx.stroke();

  // Fortschrittsanzeige
  if (progress > 0 && progress < 100) {
    const barWidth = 16;
    const barHeight = 2;
    const barX = -barWidth / 2;
    const barY = -18;
    // Hintergrund
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX * scale, barY * scale, barWidth * scale, barHeight * scale);
    // Fortschritt (gelb/orange)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(barX * scale, barY * scale, barWidth * (progress / 100) * scale, barHeight * scale);
    // Rand
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 0.3 * scale;
    ctx.strokeRect(barX * scale, barY * scale, barWidth * scale, barHeight * scale);
    // 🔍 Icon über dem Balken
    ctx.font = `${3 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🔍', 0, (barY - 1.5) * scale);
  }

  // Ausrufezeichen wenn fast fertig (Vergehen gefunden!)
  if (progress > 75) {
    const excl = Math.sin(t * 8) > 0 ? 1 : 0.5;
    ctx.globalAlpha = excl;
    ctx.fillStyle = '#dc2626';
    ctx.font = `bold ${5 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', 5 * scale, -20 * scale);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/**
 * Adjust color brightness
 */
function adjustColorBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Calculate the screen position for a pedestrian based on its state.
 * Extracted for reuse by PixiPedestrianRenderer.
 */
export function calculatePedestrianScreenPosition(ped: Pedestrian): { x: number; y: number } {
  if (ped.isNpcWorker && ped.state === 'walking') {
    const currentTile = ped.path[ped.pathIndex] || { x: ped.tileX, y: ped.tileY };
    const nextTile = ped.path[ped.pathIndex + 1] || currentTile;
    const { screenX: sx1, screenY: sy1 } = gridToScreen(currentTile.x, currentTile.y, 0, 0);
    const { screenX: sx2, screenY: sy2 } = gridToScreen(nextTile.x, nextTile.y, 0, 0);
    const cx1 = sx1 + TILE_WIDTH / 2;
    const cy1 = sy1 + TILE_HEIGHT / 2;
    const cx2 = sx2 + TILE_WIDTH / 2;
    const cy2 = sy2 + TILE_HEIGHT / 2;
    let px = cx1 + (cx2 - cx1) * ped.progress;
    let py = cy1 + (cy2 - cy1) * ped.progress;
    // Bünzli: Gehweg-Offset
    if (ped.npcType === 'buenzli') {
      const meta = DIRECTION_META[ped.direction];
      if (meta) {
        const sidewalkOff = ped.sidewalkSide === 'left' ? -10 : 10;
        const yOff = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
        px += meta.normal.nx * sidewalkOff;
        py += meta.normal.ny * sidewalkOff + yOff;
      }
    }
    return { x: px, y: py };
  }

  if (ped.isNpcWorker && (ped.state === 'npc_working' || ped.state === 'idle' || ped.state === 'idle_outside')) {
    const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
    return { x: screenX + TILE_WIDTH / 2 + (ped.activityOffsetX || 0), y: screenY + TILE_HEIGHT / 2 + (ped.activityOffsetY || 0) };
  }

  if (ped.state === 'at_recreation') {
    const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
    return { x: screenX + TILE_WIDTH / 2 + ped.activityOffsetX, y: screenY + TILE_HEIGHT / 2 + ped.activityOffsetY };
  }

  if (ped.state === 'at_beach') {
    if (ped.activity === 'beach_swimming') {
      const { screenX, screenY } = gridToScreen(ped.beachTileX, ped.beachTileY, 0, 0);
      return { x: screenX + TILE_WIDTH / 2 + ped.activityOffsetX * 0.5, y: screenY + TILE_HEIGHT / 2 + ped.activityOffsetY * 0.5 };
    }
    const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
    return { x: screenX + TILE_WIDTH / 2 + ped.activityOffsetX * 0.3, y: screenY + TILE_HEIGHT / 2 + ped.activityOffsetY * 0.3 };
  }

  if (ped.state === 'approaching_shop') {
    const { screenX: roadX, screenY: roadY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
    const { screenX: shopX, screenY: shopY } = gridToScreen(ped.destX, ped.destY, 0, 0);
    const roadCenterX = roadX + TILE_WIDTH / 2;
    const roadCenterY = roadY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[ped.direction];
    const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
    const yOff = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
    const startX = roadCenterX + meta.vec.dx + meta.normal.nx * sidewalkOffset;
    const startY = roadCenterY + meta.vec.dy + meta.normal.ny * sidewalkOffset + yOff;
    const shopEntranceX = shopX + TILE_WIDTH / 2;
    const shopEntranceY = shopY + TILE_HEIGHT / 2 + 8;
    const progress = ped.buildingEntryProgress;
    return {
      x: startX + (shopEntranceX - startX) * progress + ped.activityOffsetX * progress,
      y: startY + (shopEntranceY - startY) * progress + ped.activityOffsetY * progress,
    };
  }

  if (ped.state === 'entering_building' || ped.state === 'exiting_building') {
    const { screenX, screenY } = gridToScreen(ped.destX, ped.destY, 0, 0);
    if (ped.activity === 'shopping') {
      const doorProgress = ped.state === 'entering_building' ? ped.buildingEntryProgress : 1 - ped.buildingEntryProgress;
      return {
        x: screenX + TILE_WIDTH / 2 + ped.activityOffsetX * (1 - doorProgress),
        y: screenY + TILE_HEIGHT / 2 + 8 * (1 - doorProgress) - doorProgress * 5,
      };
    }
    return { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT / 2 };
  }

  if (ped.state === 'socializing') {
    const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[ped.direction];
    const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
    const yOff = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
    return {
      x: centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset + ped.activityOffsetX,
      y: centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + ped.activityOffsetY + yOff,
    };
  }

  // Default: walking, idle, or any other state
  const { screenX, screenY } = gridToScreen(ped.tileX, ped.tileY, 0, 0);
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT / 2;
  const meta = DIRECTION_META[ped.direction];
  if (!meta) return { x: centerX, y: centerY };
  const sidewalkOffset = ped.sidewalkSide === 'left' ? -10 : 10;
  const yOff = getSidewalkYOffset(ped.direction, ped.sidewalkSide);
  return {
    x: centerX + meta.vec.dx * ped.progress + meta.normal.nx * sidewalkOffset,
    y: centerY + meta.vec.dy * ped.progress + meta.normal.ny * sidewalkOffset + yOff,
  };
}

/**
 * Draw a single pedestrian at origin (0,0) with the appropriate LOD/activity.
 * Exported for PixiPedestrianRenderer texture generation.
 * Does NOT handle save/restore or translate — caller must do that.
 */
export function drawSinglePedestrian(ctx: CanvasRenderingContext2D, ped: Pedestrian, zoom: number): void {
  ctx.lineCap = 'round';

  if (zoom < LOD_SIMPLE_ZOOM) {
    drawSimplePedestrian(ctx, ped);
    return;
  }

  if (zoom < LOD_MEDIUM_ZOOM) {
    if (ped.state === 'at_recreation') {
      drawMediumActivityPedestrian(ctx, ped);
    } else {
      drawMediumWalkingPedestrian(ctx, ped);
    }
    return;
  }

  switch (ped.activity) {
    case 'chopping_tree': drawWoodcutterWorking(ctx, ped); return;
    case 'planting_tree': drawGardenerWorking(ctx, ped); return;
    case 'chasing':
      if (ped.state === 'npc_working') { drawPoliceArresting(ctx, ped); } else { drawPoliceRunning(ctx, ped); }
      return;
    case 'fleeing':
      if (ped.state === 'npc_working') { drawGangsterArrested(ctx, ped); } else { drawGangsterRunning(ctx, ped); }
      return;
    case 'arresting': drawPoliceArresting(ctx, ped); return;
    case 'arrested': drawGangsterArrested(ctx, ped); return;
    case 'robbing':
      if (ped.state === 'npc_working') { drawGangsterRobbing(ctx, ped); } else { drawGangsterRunning(ctx, ped); }
      return;
    case 'transporting': drawPoliceTransporting(ctx, ped); return;
    case 'being_transported': drawGangsterBeingTransported(ctx, ped); return;
    case 'inspecting':
      if (ped.state === 'npc_working') { drawBuenzliInspecting(ctx, ped); } else { drawBuenzliWalking(ctx, ped); }
      return;
    case 'dancing': drawDancingPerson(ctx, ped); return;
    case 'playing_basketball': drawBasketballPlayer(ctx, ped); return;
    case 'playing_tennis': drawTennisPlayer(ctx, ped); return;
    case 'playing_soccer': drawSoccerPlayer(ctx, ped); return;
    case 'playing_baseball': drawBaseballPlayer(ctx, ped); return;
    case 'swimming': drawSwimmer(ctx, ped); return;
    case 'beach_swimming': drawBeachSwimmer(ctx, ped); return;
    case 'lying_on_mat': drawBeachMat(ctx, ped); return;
    case 'skateboarding': drawSkateboarder(ctx, ped); return;
    case 'sitting_bench': drawSittingPerson(ctx, ped); return;
    case 'picnicking': drawPicnicker(ctx, ped); return;
    case 'jogging': drawJogger(ctx, ped); return;
    case 'walking_dog': drawDogWalker(ctx, ped); return;
    case 'playground': drawPlaygroundKid(ctx, ped); return;
    case 'watching_game': drawSpectator(ctx, ped); return;
    case 'shopping':
      if (ped.state === 'approaching_shop') { drawShopperQueuing(ctx, ped); }
      else if (ped.state === 'entering_building' || ped.state === 'exiting_building') { drawShopperAtDoor(ctx, ped); }
      else { drawWalkingPedestrian(ctx, ped); }
      return;
    default:
      if (ped.isNpcWorker && ped.npcType === 'avatar_test') { drawAvatarTest(ctx, ped); }
      else if (ped.isNpcWorker && ped.npcType === 'woodcutter') { drawWoodcutter(ctx, ped); }
      else if (ped.isNpcWorker && ped.npcType === 'gardener') { drawGardener(ctx, ped); }
      else if (ped.isNpcWorker && ped.npcType === 'police') { drawPoliceRunning(ctx, ped); }
      else if (ped.isNpcWorker && ped.npcType === 'gangster') { drawGangsterRunning(ctx, ped); }
      else if (ped.state === 'socializing') { drawSocializingPerson(ctx, ped); }
      else if (ped.state === 'idle') { drawIdlePerson(ctx, ped); }
      else if (ped.state === 'approaching_shop') { drawShopperQueuing(ctx, ped); }
      else if (ped.state === 'waiting_at_stop') { drawBusWaiter(ctx, ped); }
      else { drawWalkingPedestrian(ctx, ped); }
  }
}

/** Pedestrian waiting at a bus stop - standing still with small idle animation */
function drawBusWaiter(ctx: CanvasRenderingContext2D, ped: Pedestrian): void {
  const t = (ped.busWaitTimer || 0) * 2;
  const bobY = Math.sin(t) * 0.3; // subtle idle bob

  // Body
  ctx.fillStyle = ped.shirtColor || '#4a90d9';
  ctx.fillRect(-1.5, -5 + bobY, 3, 4);

  // Head
  ctx.fillStyle = ped.skinColor || '#deb887';
  ctx.beginPath();
  ctx.arc(0, -6.5 + bobY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Legs (standing)
  ctx.strokeStyle = ped.pantsColor || '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-0.8, -1 + bobY);
  ctx.lineTo(-0.8, 1.5);
  ctx.moveTo(0.8, -1 + bobY);
  ctx.lineTo(0.8, 1.5);
  ctx.stroke();

  // Small bus icon above head (waiting indicator)
  ctx.fillStyle = '#f59e0b';
  ctx.globalAlpha = 0.6 + Math.sin(t * 0.5) * 0.3;
  ctx.fillRect(-2, -10 + bobY, 4, 2);
  ctx.globalAlpha = 1;
}
