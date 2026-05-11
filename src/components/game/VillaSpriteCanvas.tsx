'use client';

import React from 'react';

interface VillaSpriteCanvasProps {
  row: number;
  col: number;
  className?: string;
  size?: number;
}

export function VillaSpriteCanvas({ row, col, className = '', size = 80 }: VillaSpriteCanvasProps) {
  return (
    <img
      src={`/assets/mansions/mansion_${row}_${col}.webp`}
      width={size}
      height={size}
      alt=""
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
    />
  );
}
