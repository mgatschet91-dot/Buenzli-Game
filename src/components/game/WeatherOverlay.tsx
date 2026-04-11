'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'storm' | 'fog';

interface WeatherState {
  type: WeatherType;
  intensity: number;
}

const WEATHER_CYCLE_MS = 5 * 60 * 1000;

const WEATHER_WEIGHTS: Record<WeatherType, number> = {
  clear: 40,
  rain: 25,
  snow: 10,
  storm: 10,
  fog: 15,
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

export function WeatherOverlay() {
  const [weather, setWeather] = useState<WeatherState>({ type: 'clear', intensity: 0.5 });

  useEffect(() => {
    setWeather({ type: pickWeather(), intensity: 0.3 + Math.random() * 0.7 });
    const interval = setInterval(() => {
      setWeather({ type: pickWeather(), intensity: 0.3 + Math.random() * 0.7 });
    }, WEATHER_CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  const particles = useMemo(() => {
    if (weather.type === 'clear') return [];
    const count = weather.type === 'storm' ? 80 : weather.type === 'rain' ? 50 : weather.type === 'snow' ? 40 : 0;
    const adjusted = Math.round(count * weather.intensity);
    return Array.from({ length: adjusted }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: weather.type === 'snow' ? 4 + Math.random() * 4 : 0.8 + Math.random() * 0.6,
      size: weather.type === 'snow' ? 3 + Math.random() * 4 : 1,
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, [weather.type, weather.intensity]);

  if (weather.type === 'clear') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Fog overlay */}
      {weather.type === 'fog' && (
        <div
          className="absolute inset-0 transition-opacity duration-3000"
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, rgba(200,200,220,${weather.intensity * 0.3}) 100%)`,
          }}
        />
      )}

      {/* Storm darkening */}
      {weather.type === 'storm' && (
        <div
          className="absolute inset-0 transition-opacity duration-2000"
          style={{ backgroundColor: `rgba(20,20,40,${weather.intensity * 0.2})` }}
        />
      )}

      {/* Rain / Snow / Storm particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: weather.type === 'snow' ? 'ease-in-out' : 'linear',
            animationName: weather.type === 'snow' ? 'weatherSnowfall' : 'weatherRainfall',
            opacity: p.opacity,
          }}
        >
          {weather.type === 'snow' ? (
            <div
              className="rounded-full bg-white"
              style={{ width: p.size, height: p.size }}
            />
          ) : (
            <div
              className="bg-blue-300/70 rounded-full"
              style={{
                width: p.size,
                height: weather.type === 'storm' ? 18 : 12,
              }}
            />
          )}
        </div>
      ))}

      {/* Keyframe injection */}
      <style>{`
        @keyframes weatherRainfall {
          0% { transform: translateY(-10px) translateX(0); }
          100% { transform: translateY(105vh) translateX(-20px); }
        }
        @keyframes weatherSnowfall {
          0% { transform: translateY(-10px) translateX(0); }
          50% { transform: translateY(50vh) translateX(${Math.random() > 0.5 ? '' : '-'}15px); }
          100% { transform: translateY(105vh) translateX(${Math.random() > 0.5 ? '-' : ''}10px); }
        }
      `}</style>

      {/* Weather indicator */}
      <div className="absolute top-2 left-2 bg-slate-900/60 rounded px-2 py-1 text-[10px] text-slate-300 flex items-center gap-1">
        {weather.type === 'rain' && '🌧️ Regen'}
        {weather.type === 'snow' && '❄️ Schnee'}
        {weather.type === 'storm' && '⛈️ Gewitter'}
        {weather.type === 'fog' && '🌫️ Nebel'}
      </div>
    </div>
  );
}
