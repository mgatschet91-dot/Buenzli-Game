'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getActiveSpritePack, type SpritePack } from '@/lib/renderConfig';
import { loadSpriteImage, loadImage } from '@/components/game/imageLoader';

interface BuildingPreviewProps {
  buildingType: string;
  size?: number;
  className?: string;
}

/**
 * Determines which sprite sheet and coordinates to use for a building type preview.
 * Checks trees, parks, and main sprite sheets in order.
 */
function getSpriteInfo(buildingType: string, pack: SpritePack): {
  src: string;
  row: number;
  col: number;
  cols: number;
  rows: number;
  needsFilter: boolean; // true for PNG sprite sheets with red background
  isStandalone?: boolean;
} | null {
  // 1. Check trees variants (trees sprite sheet - has red background)
  if (pack.treesVariants && buildingType in pack.treesVariants && pack.treesSrc) {
    const variants = pack.treesVariants[buildingType];
    if (variants && variants.length > 0) {
      return {
        src: pack.treesSrc,
        row: variants[0].row,
        col: variants[0].col,
        cols: pack.treesCols || 6,
        rows: pack.treesRows || 6,
        needsFilter: true,
      };
    }
  }

  // 2. Check parks buildings (parks sprite sheet - has red bg)
  if (pack.parksBuildings && buildingType in pack.parksBuildings && pack.parksSrc) {
    const pos = pack.parksBuildings[buildingType];
    if (pos) {
      return {
        src: pack.parksSrc,
        row: pos.row,
        col: pos.col,
        cols: pack.parksCols || 5,
        rows: pack.parksRows || 6,
        needsFilter: true,
      };
    }
  }

  // 3. Check standalone building images
  if (pack.standaloneSrcs && buildingType in pack.standaloneSrcs) {
    const cfg = pack.standaloneSrcs[buildingType];
    return {
      src: cfg.normal,
      row: 0,
      col: 0,
      cols: 1,
      rows: 1,
      needsFilter: false,
      isStandalone: true,
    };
  }

  // 4. Check main sprite sheet
  const spriteKey = pack.buildingToSprite[buildingType];
  if (spriteKey) {
    const index = pack.spriteOrder.indexOf(spriteKey);
    if (index !== -1) {
      return {
        src: pack.src,
        row: Math.floor(index / pack.cols),
        col: index % pack.cols,
        cols: pack.cols,
        rows: pack.rows,
        needsFilter: true,
      };
    }
  }

  return null;
}

/**
 * Renders a small canvas preview of a building/tree sprite from the sprite sheets.
 * Used in the sidebar submenu to give a visual preview of what will be placed.
 */
export const BuildingPreview = React.memo(function BuildingPreview({
  buildingType,
  size = 40,
  className,
}: BuildingPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  const renderPreview = useCallback(async () => {
    const pack = getActiveSpritePack();
    const spriteInfo = getSpriteInfo(buildingType, pack);

    if (!spriteInfo || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Load image - use filtered version for PNG sprite sheets with red background
      const skipWebP = !!spriteInfo.isStandalone;
      const img = spriteInfo.needsFilter
        ? await loadSpriteImage(spriteInfo.src, true, skipWebP)
        : await loadImage(spriteInfo.src, skipWebP);

      const tileWidth = img.naturalWidth / spriteInfo.cols;
      const tileHeight = img.naturalHeight / spriteInfo.rows;

      const sx = spriteInfo.col * tileWidth;
      const sy = spriteInfo.row * tileHeight;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Calculate aspect-fit scaling to center the sprite
      const aspect = tileWidth / tileHeight;
      let dw: number, dh: number, dx: number, dy: number;

      if (aspect > 1) {
        // Wider than tall
        dw = size;
        dh = size / aspect;
        dx = 0;
        dy = (size - dh) / 2;
      } else {
        // Taller than wide or square
        dh = size;
        dw = size * aspect;
        dx = (size - dw) / 2;
        dy = 0;
      }

      // Draw the sprite, scaled to fit the preview
      ctx.drawImage(
        img,
        sx, sy, tileWidth, tileHeight,
        dx, dy, dw, dh
      );

      setLoaded(true);
    } catch (err) {
      console.error(`Failed to load preview for ${buildingType}:`, err);
    }
  }, [buildingType, size]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`flex-shrink-0 ${className || ''} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      style={{ width: size, height: size }}
    />
  );
});

export default BuildingPreview;
