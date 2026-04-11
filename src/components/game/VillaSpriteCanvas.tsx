'use client';

import React, { useRef, useEffect } from 'react';

const SHEET_COLS = 5;
const SHEET_ROWS = 6;
const BG_R = 255, BG_G = 0, BG_B = 0;
const THRESHOLD = 155;

// Shared filtered-image cache so we only filter once per session
const filteredCache: Map<string, HTMLImageElement> = new Map();

function euclidean(r: number, g: number, b: number) {
  return Math.sqrt((r - BG_R) ** 2 + (g - BG_G) ** 2 + (b - BG_B) ** 2);
}

function filterRed(src: string): Promise<HTMLImageElement> {
  if (filteredCache.has(src)) return Promise.resolve(filteredCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (euclidean(d[i], d[i + 1], d[i + 2]) <= THRESHOLD) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(data, 0, 0);
      const out = new Image();
      out.onload = () => { filteredCache.set(src, out); resolve(out); };
      out.onerror = reject;
      out.src = canvas.toDataURL();
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface VillaSpriteCanvasProps {
  row: number;
  col: number;
  className?: string;
  size?: number; // square px
}

export function VillaSpriteCanvas({ row, col, className = '', size = 80 }: VillaSpriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SRC = '/assets/mansion_alternates.png';

  useEffect(() => {
    let cancelled = false;
    filterRed(SRC).then(img => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tileW = img.naturalWidth / SHEET_COLS;
      const tileH = img.naturalHeight / SHEET_ROWS;
      const sx = col * tileW;
      // Skip a few pixels at the top of each row to avoid bleed from the row above
      const topSkip = row > 0 ? Math.round(tileH * 0.05) : 0;
      const sy = row * tileH + topSkip;
      const sh = tileH - topSkip;

      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);

      const padding = 2;
      ctx.drawImage(img, sx, sy, tileW, sh, padding, padding, size - padding * 2, size - padding * 2);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [row, col, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
