// Party-Sound via Web Audio API + MP3-Tracks
// Zwei Tracks werden abwechselnd gespielt (nahtloser Loop).
// Lautstärke skaliert mit Zoom (weit weg = leise, nah = laut).

const PARTY_TRACKS = ['/audio/party1.mp3', '/audio/party2.mp3'];

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// MP3-Player
let currentAudio: HTMLAudioElement | null = null;
let currentGainNode: GainNode | null = null;
let currentTrackIndex = 0;
let mp3Active = false;
let mp3Source: MediaElementAudioSourceNode | null = null;

// Bass-Beat Fallback (falls keine MP3s verfügbar)
let partyInterval: ReturnType<typeof setInterval> | null = null;
let currentVolume = 0.0;

// MP3-Verfügbarkeit (einmalig gecheckt)
let tracksChecked = false;
let tracksAvailable = false;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

async function checkTracksAvailable(): Promise<boolean> {
  if (tracksChecked) return tracksAvailable;
  tracksChecked = true;
  try {
    const res = await fetch(PARTY_TRACKS[0], { method: 'HEAD' });
    tracksAvailable = res.ok;
  } catch {
    tracksAvailable = false;
  }
  return tracksAvailable;
}

function playNextTrack(): void {
  const ctx = getAudioCtx();
  if (!masterGain) return;

  // Alten Track aufräumen
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.pause();
    currentAudio = null;
    currentGainNode = null;
    mp3Source = null;
  }

  const trackPath = PARTY_TRACKS[currentTrackIndex % PARTY_TRACKS.length];
  currentTrackIndex++;

  const audio = new Audio(trackPath);
  audio.crossOrigin = 'anonymous';
  currentAudio = audio;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.setTargetAtTime(Math.min(1.0, currentVolume), ctx.currentTime, 0.4); // Fade in
  currentGainNode = gainNode;

  const source = ctx.createMediaElementSource(audio);
  mp3Source = source;
  source.connect(gainNode);
  gainNode.connect(masterGain);

  audio.onended = () => {
    if (mp3Active) playNextTrack(); // Nächster Track
  };

  audio.play().catch(() => {
    // Autoplay-Block — wird beim nächsten User-Interaktion-Event versucht
    mp3Active = false;
  });
}

async function startMp3Playback(volume: number): Promise<void> {
  currentVolume = volume;
  if (mp3Active) return;
  mp3Active = true;
  playNextTrack();
}

function stopMp3Playback(): void {
  mp3Active = false;
  if (currentAudio) {
    currentAudio.onended = null;
    // Kurzer Fade-out
    if (currentGainNode && audioCtx) {
      currentGainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
      setTimeout(() => {
        currentAudio?.pause();
        currentAudio = null;
      }, 500);
    } else {
      currentAudio.pause();
      currentAudio = null;
    }
  }
}

function playBassBeat(volume: number): void {
  try {
    const ctx = getAudioCtx();
    if (!masterGain) return;
    const now = ctx.currentTime;

    // Kick-Drum: Sinus mit Pitch-Envelope
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    gain.gain.setValueAtTime(Math.min(1.0, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.start(now);
    osc.stop(now + 0.35);

    // Hi-Hat
    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 8000;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseGain.gain.setValueAtTime(Math.min(0.3, volume * 0.3), now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noiseSource.start(now);
    noiseSource.stop(now + 0.06);
  } catch {
    // AudioContext nicht verfügbar
  }
}

/**
 * Startet den Party-Sound.
 * Wenn /audio/party1.mp3 vorhanden → Tracks abwechselnd abspielen.
 * Sonst → generierter Bass-Beat als Fallback.
 * @param bpm Beats per minute (nur für Bass-Fallback, default 128)
 * @param volume Lautstärke 0.0–1.0 (zoom-basiert)
 */
export async function startPartySound(bpm = 128, volume = 1.0): Promise<void> {
  if (typeof window === 'undefined') return;
  currentVolume = Math.max(0, Math.min(1.0, volume));

  const ctx = getAudioCtx();
  if (masterGain) {
    masterGain.gain.setTargetAtTime(currentVolume, ctx.currentTime, 0.3);
  }

  const hasTracks = await checkTracksAvailable();

  if (hasTracks) {
    await startMp3Playback(currentVolume);
  } else {
    // Fallback: generierter Beat
    if (partyInterval) return;
    const halfBeatMs = (60 / bpm) * 1000 / 2;
    playBassBeat(currentVolume);
    partyInterval = setInterval(() => playBassBeat(currentVolume), halfBeatMs);
  }
}

/**
 * Aktualisiert die Lautstärke (zoom-basiert, smooth).
 * Wird jeden Frame aufgerufen — sehr effizient dank Web Audio.
 */
export function setPartySoundVolume(volume: number): void {
  currentVolume = Math.max(0, Math.min(1.0, volume));
  if (!audioCtx || !masterGain) return;
  masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.15);

  // Auch GainNode des aktuellen Tracks aktualisieren
  if (currentGainNode) {
    currentGainNode.gain.setTargetAtTime(Math.min(1.0, currentVolume), audioCtx.currentTime, 0.15);
  }
}

/**
 * Stoppt den Party-Sound (mit Fade-out).
 */
export function stopPartySound(): void {
  stopMp3Playback();

  if (partyInterval) {
    clearInterval(partyInterval);
    partyInterval = null;
  }

  if (audioCtx && masterGain) {
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
  }
}

/**
 * Gibt zurück ob der Sound gerade aktiv ist.
 */
export function isPartySoundActive(): boolean {
  return partyInterval !== null || mp3Active;
}
