import { useState, useEffect, useRef, useCallback } from 'react';
import type { MusicLibrary } from '@/app/(main)/api/music-library/route';

export type Genre = 'techno' | 'house' | 'pop' | 'misc' | 'all';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function usePartyMusicPlayer() {
  const [library, setLibrary] = useState<MusicLibrary>({});
  const [genre, setGenre] = useState<Genre>('all');
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load library on mount
  useEffect(() => {
    fetch('/api/music-library')
      .then((r) => r.json())
      .then((data: MusicLibrary) => setLibrary(data))
      .catch(() => {});
  }, []);

  // Rebuild playlist when genre or library changes
  useEffect(() => {
    const genres = Object.keys(library) as Genre[];
    let tracks: string[] = [];

    if (genre === 'all') {
      for (const g of genres) {
        tracks.push(...(library[g] ?? []).map((f) => `/audio/music/${g}/${f}`));
      }
    } else {
      tracks = (library[genre] ?? []).map((f) => `/audio/music/${genre}/${f}`);
    }

    const ordered = isShuffle ? shuffle(tracks) : tracks;
    setPlaylist(ordered);
    setTrackIndex(0);
  }, [library, genre, isShuffle]);

  // Sync audio element src
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playlist.length === 0) return;
    const src = playlist[trackIndex];
    if (audio.src !== window.location.origin + src) {
      audio.src = src;
      audio.load();
      if (isPlaying) audio.play().catch(() => {});
    }
  }, [trackIndex, playlist]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const currentTrackName = playlist[trackIndex]
    ? decodeURIComponent(playlist[trackIndex].split('/').pop() ?? '')
    : null;

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const next = useCallback(() => {
    setTrackIndex((i) => (playlist.length > 0 ? (i + 1) % playlist.length : 0));
  }, [playlist.length]);

  const prev = useCallback(() => {
    setTrackIndex((i) => (playlist.length > 0 ? (i - 1 + playlist.length) % playlist.length : 0));
  }, [playlist.length]);

  const seek = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  }, []);

  const toggleShuffle = useCallback(() => setIsShuffle((s) => !s), []);

  // Audio element event handlers
  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      setProgress(audio.currentTime / audio.duration);
      setDuration(audio.duration);
    }
  }, []);

  const onEnded = useCallback(() => {
    next();
    // Auto-play next
    setTimeout(() => audioRef.current?.play().catch(() => {}), 100);
  }, [next]);

  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);

  const initAudio = useCallback(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.volume = volume;
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audioRef.current = audio;
  }, [volume, onTimeUpdate, onEnded, onPlay, onPause]);

  useEffect(() => {
    initAudio();
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audioRef.current = null;
      }
    };
  }, []);

  const totalTracks = playlist.length;
  const genres = ['all', ...Object.keys(library)] as Genre[];
  const hasMusic = totalTracks > 0;

  return {
    genre,
    setGenre,
    genres,
    playlist,
    trackIndex,
    currentTrackName,
    isPlaying,
    isShuffle,
    toggleShuffle,
    volume,
    setVolume,
    progress,
    duration,
    totalTracks,
    hasMusic,
    togglePlay,
    play,
    pause,
    next,
    prev,
    seek,
  };
}
