'use client';

import { useState } from 'react';

interface GuideMediaProps {
  src: string;
  alt: string;
  label?: string;
}

export function GuideMedia({ src, alt, label }: GuideMediaProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full aspect-video rounded-sm border border-white/10 bg-gradient-to-br from-slate-800/80 to-slate-900/80 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="text-slate-500 text-xs text-center px-4">
          {label ?? alt}<br />
          <span className="text-slate-600 text-[10px]">GIF kommt bald — leg es unter /public/guide/{src.split('/').pop()} ab</span>
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="w-full rounded-sm border border-white/10 object-cover"
    />
  );
}
