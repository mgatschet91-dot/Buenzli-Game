'use client';
import React, { useCallback } from 'react';
import { usePartyMusicPlayer, type Genre } from '@/lib/partyMusicPlayer';

const GENRE_LABELS: Record<string, string> = {
  all: 'Alle',
  techno: 'Techno',
  house: 'House',
  pop: 'Pop',
  misc: 'Misc',
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MusicPlayerWidget() {
  const {
    genre,
    setGenre,
    genres,
    currentTrackName,
    isPlaying,
    isShuffle,
    toggleShuffle,
    volume,
    setVolume,
    progress,
    duration,
    trackIndex,
    totalTracks,
    hasMusic,
    togglePlay,
    next,
    prev,
    seek,
  } = usePartyMusicPlayer();

  const handleSeekClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seek(Math.max(0, Math.min(1, pct)));
    },
    [seek],
  );

  const trackLabel = currentTrackName
    ? currentTrackName.replace(/\.(mp3|ogg|wav)$/i, '')
    : hasMusic
      ? 'Lade...'
      : 'Keine Musik';

  const elapsed = duration * progress;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-72 select-none text-white text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <span className="font-semibold tracking-wide text-purple-300">🎵 Party Music</span>
        <span className="text-xs text-gray-500">
          {hasMusic ? `${trackIndex + 1} / ${totalTracks}` : '—'}
        </span>
      </div>

      {/* Genre Tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g as Genre)}
            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
              genre === g
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {GENRE_LABELS[g] ?? g}
          </button>
        ))}
      </div>

      {/* Track Name */}
      <div className="px-4 py-1 text-center truncate text-gray-100 font-medium text-xs min-h-[1.5rem]">
        {trackLabel}
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-1">
        <div
          className="relative h-1.5 bg-gray-700 rounded-full cursor-pointer"
          onClick={handleSeekClick}
        >
          <div
            className="absolute left-0 top-0 h-full bg-purple-500 rounded-full transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Prev */}
        <button
          onClick={prev}
          disabled={!hasMusic}
          className="text-gray-300 hover:text-white disabled:opacity-40 transition-colors text-lg"
          title="Vorheriger Track"
        >
          ⏮
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!hasMusic}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-full w-9 h-9 flex items-center justify-center transition-colors text-base"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Next */}
        <button
          onClick={next}
          disabled={!hasMusic}
          className="text-gray-300 hover:text-white disabled:opacity-40 transition-colors text-lg"
          title="Nächster Track"
        >
          ⏭
        </button>

        {/* Shuffle */}
        <button
          onClick={toggleShuffle}
          className={`text-lg transition-colors ${isShuffle ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
          title="Shuffle"
        >
          🔀
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <span className="text-gray-400 text-xs">🔊</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-purple-500 h-1 cursor-pointer"
        />
        <span className="text-gray-500 text-[10px] w-7 text-right">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
