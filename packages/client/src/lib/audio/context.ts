/**
 * Audio context + gain bus graph for MINERUSH.
 *
 * A single AudioContext is created LAZILY (never before the user gesture that
 * calls `unlock()`), satisfying browser autoplay policy. The graph is:
 *
 *   [music voices] ─┐
 *                   ├─▶ musicGain ─┐
 *                                  ├─▶ masterGain ─▶ limiter ─▶ destination
 *   [sfx voices]  ──▶ sfxGain ─────┘
 *
 * Volumes + mute persist to localStorage. Nothing produces sound until
 * `unlock()` has resumed the context; callers must guard sound generation with
 * `isUnlocked()`.
 */

const LS_KEYS = {
  muted: 'minerush.audio.muted',
  music: 'minerush.audio.musicVolume',
  sfx: 'minerush.audio.sfxVolume',
} as const;

/** Music bus default — QUIET, sits under the game (per art direction). */
const DEFAULT_MUSIC_VOLUME = 0.35;
const DEFAULT_SFX_VOLUME = 0.6;

function readNumber(key: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === 'true' || raw === '1';
}

export interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  limiter: DynamicsCompressorNode;
}

let graph: AudioGraph | null = null;
let unlocked = false;

// Persisted, reactive-ish state (module-level; the store hook re-reads on change).
let muted = readBool(LS_KEYS.muted, false);
let musicVolume = readNumber(LS_KEYS.music, DEFAULT_MUSIC_VOLUME);
let sfxVolume = readNumber(LS_KEYS.sfx, DEFAULT_SFX_VOLUME);

export interface AudioStateSnapshot {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  unlocked: boolean;
}

// Cached snapshot object — replaced only when state changes so React's
// useSyncExternalStore sees a stable reference between emits (no render loop).
let snapshot: AudioStateSnapshot = { muted, musicVolume, sfxVolume, unlocked };

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  snapshot = { muted, musicVolume, sfxVolume, unlocked };
  for (const l of listeners) l();
}
export function subscribeAudioState(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Stable snapshot of persisted, user-facing audio state (for the header UI). */
export function getAudioState(): AudioStateSnapshot {
  return snapshot;
}

/** Create the graph on first use. Does NOT resume — `unlock()` does that. */
export function ensureGraph(): AudioGraph {
  if (graph) return graph;
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();

  const master = ctx.createGain();
  const music = ctx.createGain();
  const sfx = ctx.createGain();

  // A gentle master limiter so nothing spikes above tasteful volume.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  music.connect(master);
  sfx.connect(master);
  master.connect(limiter);
  limiter.connect(ctx.destination);

  graph = { ctx, master, music, sfx, limiter };
  applyGains();
  return graph;
}

/** Push the current volume/mute state into the live gain nodes. */
function applyGains() {
  if (!graph) return;
  const t = graph.ctx.currentTime;
  const m = muted ? 0 : 1;
  // master stays at 0.9 headroom; buses carry the user volumes.
  graph.master.gain.setTargetAtTime(0.9 * m, t, 0.02);
  graph.music.gain.setTargetAtTime(musicVolume, t, 0.05);
  graph.sfx.gain.setTargetAtTime(sfxVolume, t, 0.02);
}

/** Resume the context from a user gesture. Safe to call repeatedly. */
export async function unlock(): Promise<void> {
  const g = ensureGraph();
  if (g.ctx.state === 'suspended') {
    try {
      await g.ctx.resume();
    } catch {
      /* ignore — some browsers reject if already running */
    }
  }
  unlocked = g.ctx.state === 'running';
  applyGains();
  emit();
}

export function isUnlocked(): boolean {
  return unlocked && !!graph && graph.ctx.state === 'running';
}

export function getGraph(): AudioGraph | null {
  return graph;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEYS.muted, String(next));
  applyGains();
  emit();
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

export function setMusicVolume(v: number): void {
  musicVolume = Math.min(1, Math.max(0, v));
  if (typeof localStorage !== 'undefined')
    localStorage.setItem(LS_KEYS.music, String(musicVolume));
  applyGains();
  emit();
}

export function setSfxVolume(v: number): void {
  sfxVolume = Math.min(1, Math.max(0, v));
  if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEYS.sfx, String(sfxVolume));
  applyGains();
  emit();
}
