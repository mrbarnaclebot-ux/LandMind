/**
 * Generative ambient music engine for MINERUSH — no audio assets.
 *
 * Two layers, both routed to the shared `music` gain bus:
 *
 *  1. PADS — 2-3 detuned triangle/sine voices per chord, long attack/release,
 *     cycling a warm chord progression every ~20s in the D-minor / F-major
 *     family. A retrig'd scheduler crossfades between chords.
 *
 *  2. PLUCKS — sparse pentatonic notes (short filtered triangle with a
 *     delay/feedback echo), fired from a seeded PRNG roughly once every 2-6s.
 *
 * The engine is PHASE-AWARE: it reads worldStore's `phase` each scheduler tick
 * and crossfades a set of character parameters (brightness, pluck density,
 * shimmer, drone level, voicing octave) smoothly — never a hard cut. See
 * PHASE_CHARACTER below.
 *
 * Everything is scheduled on the AudioContext clock with a look-ahead window so
 * timing stays sample-accurate regardless of main-thread jank.
 */
import { getGraph, isUnlocked } from './context';
import { useWorldStore } from '../../stores/worldStore';
import type { WorldPhase } from '../socketTypes';

// --- seeded PRNG (mulberry32) ----------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- musical material -------------------------------------------------------

/** Frequency for a semitone offset from A2 (110 Hz) — a warm low register. */
function hz(semi: number): number {
  return 110 * Math.pow(2, semi / 12);
}

/**
 * Chord progression in the D-minor / F-major family (amber-warm). Semitone
 * offsets from A2. Each chord is a triad-ish stack; the engine detunes/spreads
 * voices across it. Progression: Dm - F - C - Am (i - III - VII - v feel).
 */
const PROGRESSION: number[][] = [
  [5, 8, 12], // Dm  (D F A)
  [8, 12, 15], // F   (F A C)
  [3, 7, 10], // C   (C E G)
  [0, 3, 7], // Am  (A C E)
];

/** D-minor pentatonic scale degrees (semitones from A2) for plucks. */
const PENTATONIC = [5, 8, 10, 12, 15, 17, 20, 22, 24];

// --- phase character --------------------------------------------------------

interface PhaseChar {
  /** Pad lowpass brightness (Hz). */
  brightness: number;
  /** Octave shift applied to pads/plucks (semitones). */
  octave: number;
  /** Mean seconds between plucks (lower = denser). */
  pluckEvery: number;
  /** Shimmer (high sine harmonic) level, 0-1. */
  shimmer: number;
  /** Low drone level, 0-1. */
  drone: number;
  /** Major-lift bias — chance to raise a pluck by a bright interval. */
  lift: number;
}

const PHASE_CHARACTER: Record<WorldPhase, PhaseChar> = {
  // brighter voicing + slightly denser plucks
  day: { brightness: 2600, octave: 12, pluckEvery: 3.2, shimmer: 0.06, drone: 0.05, lift: 0.15 },
  // soft major-lift + gentle shimmer
  golden_hour: { brightness: 2400, octave: 12, pluckEvery: 3.6, shimmer: 0.14, drone: 0.06, lift: 0.4 },
  // current baseline
  dusk: { brightness: 1700, octave: 0, pluckEvery: 4.2, shimmer: 0.05, drone: 0.1, lift: 0.15 },
  // darker/lower, sparser, low drone
  night: { brightness: 1100, octave: -12, pluckEvery: 5.6, shimmer: 0.03, drone: 0.24, lift: 0.05 },
  // thin and airy
  dawn: { brightness: 2100, octave: 12, pluckEvery: 4.8, shimmer: 0.1, drone: 0.04, lift: 0.25 },
};

// --- engine state -----------------------------------------------------------

interface MusicNodes {
  padGain: GainNode; // master for pad layer
  pluckGain: GainNode;
  droneGain: GainNode;
  shimmerGain: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  padFilter: BiquadFilterNode;
  drone: OscillatorNode;
  droneSub: OscillatorNode;
  shimmer: OscillatorNode;
}

let nodes: MusicNodes | null = null;
let running = false;
let schedTimer: ReturnType<typeof setInterval> | null = null;
let rand = mulberry32(0xc0ffee);

// scheduler cursors (in ctx-time seconds)
let nextChordTime = 0;
let chordIndex = 0;
let nextPluckTime = 0;

const CHORD_SECONDS = 5.5; // per chord; full progression ~22s
const LOOKAHEAD = 0.1; // schedule this far ahead each tick (s)
const TICK_MS = 40;

/** Smoothly-tracked character (lerped toward the current phase each tick). */
let curChar: PhaseChar = { ...PHASE_CHARACTER.dusk };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function trackPhase() {
  const phase = useWorldStore.getState().phase;
  const target = PHASE_CHARACTER[phase] ?? PHASE_CHARACTER.dusk;
  const k = 0.04; // per-tick approach — smooth crossfade, no hard cut
  curChar = {
    brightness: lerp(curChar.brightness, target.brightness, k),
    octave: lerp(curChar.octave, target.octave, k),
    pluckEvery: lerp(curChar.pluckEvery, target.pluckEvery, k),
    shimmer: lerp(curChar.shimmer, target.shimmer, k),
    drone: lerp(curChar.drone, target.drone, k),
    lift: lerp(curChar.lift, target.lift, k),
  };
  if (!nodes) return;
  const ctx = getGraph()!.ctx;
  const t = ctx.currentTime;
  nodes.padFilter.frequency.setTargetAtTime(curChar.brightness, t, 0.3);
  nodes.shimmerGain.gain.setTargetAtTime(curChar.shimmer, t, 0.5);
  nodes.droneGain.gain.setTargetAtTime(curChar.drone, t, 0.6);
}

// --- voice builders ---------------------------------------------------------

/** Schedule one long pad chord with a slow attack/release crossfade. */
function scheduleChord(t0: number) {
  const g = getGraph();
  const n = nodes;
  if (!g || !n) return;
  const ctx = g.ctx;
  const chord = PROGRESSION[chordIndex % PROGRESSION.length];
  const oct = curChar.octave;

  chord.forEach((semi, vi) => {
    // 2 detuned voices per chord tone (triangle + sine), spread wide + soft.
    const base = hz(semi + oct);
    for (let k = 0; k < 2; k++) {
      const osc = ctx.createOscillator();
      osc.type = k === 0 ? 'triangle' : 'sine';
      osc.frequency.value = base;
      osc.detune.value = (k === 0 ? -1 : 1) * (4 + vi * 2);

      const vg = ctx.createGain();
      const peak = 0.09 / (vi + 1); // upper tones softer
      const atk = 2.2;
      const rel = 2.6;
      vg.gain.setValueAtTime(0.0001, t0);
      vg.gain.exponentialRampToValueAtTime(peak, t0 + atk);
      vg.gain.setValueAtTime(peak, t0 + CHORD_SECONDS - rel);
      vg.gain.exponentialRampToValueAtTime(0.0001, t0 + CHORD_SECONDS + 0.4);

      osc.connect(vg);
      vg.connect(n.padFilter);
      osc.start(t0);
      osc.stop(t0 + CHORD_SECONDS + 0.6);
    }
  });
  chordIndex++;
}

/** Schedule one pentatonic pluck (with echo via the shared delay tap). */
function schedulePluck(t0: number) {
  const g = getGraph();
  if (!g || !nodes) return;
  const ctx = g.ctx;

  let idx = Math.floor(rand() * PENTATONIC.length);
  // Golden-hour / dawn "lift": occasionally jump up a bright interval.
  if (rand() < curChar.lift) idx = Math.min(PENTATONIC.length - 1, idx + 2);
  const semi = PENTATONIC[idx];
  const freq = hz(semi + curChar.octave + 12); // plucks an octave up from pads

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(1200, curChar.brightness + 600);

  const vg = ctx.createGain();
  const peak = 0.16;
  vg.gain.setValueAtTime(0.0001, t0);
  vg.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  vg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);

  osc.connect(lp);
  lp.connect(vg);
  vg.connect(nodes.pluckGain); // dry
  vg.connect(nodes.delay); // wet (echo)
  osc.start(t0);
  osc.stop(t0 + 0.8);
}

// --- scheduler --------------------------------------------------------------

function tick() {
  const g = getGraph();
  if (!g || !nodes || !running) return;
  const now = g.ctx.currentTime;
  trackPhase();

  // Pads
  while (nextChordTime < now + LOOKAHEAD) {
    scheduleChord(nextChordTime);
    nextChordTime += CHORD_SECONDS;
  }

  // Plucks — random interval in [0.5x, 1.5x] of the phase mean.
  while (nextPluckTime < now + LOOKAHEAD) {
    schedulePluck(nextPluckTime);
    const mean = curChar.pluckEvery;
    nextPluckTime += mean * (0.5 + rand());
  }
}

function buildNodes(): MusicNodes {
  const g = getGraph()!;
  const ctx = g.ctx;

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = curChar.brightness;
  padFilter.Q.value = 0.4;

  const padGain = ctx.createGain();
  padGain.gain.value = 0.9;
  padFilter.connect(padGain);
  padGain.connect(g.music);

  const pluckGain = ctx.createGain();
  pluckGain.gain.value = 0.5;
  pluckGain.connect(g.music);

  // Echo: delay + feedback for plucks.
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.34;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const echoGain = ctx.createGain();
  echoGain.gain.value = 0.4;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(echoGain);
  echoGain.connect(g.music);

  // Low drone (two detuned saws through a heavy lowpass).
  const droneGain = ctx.createGain();
  droneGain.gain.value = curChar.drone;
  const droneLp = ctx.createBiquadFilter();
  droneLp.type = 'lowpass';
  droneLp.frequency.value = 220;
  const drone = ctx.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = hz(-7); // low D-ish
  const droneSub = ctx.createOscillator();
  droneSub.type = 'sine';
  droneSub.frequency.value = hz(-19);
  droneSub.detune.value = 3;
  drone.connect(droneLp);
  droneSub.connect(droneLp);
  droneLp.connect(droneGain);
  droneGain.connect(g.music);
  drone.start();
  droneSub.start();

  // Shimmer (very quiet high sine, slow tremolo via gain LFO-ish setTarget).
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = curChar.shimmer;
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = hz(36); // high harmonic
  shimmer.connect(shimmerGain);
  shimmerGain.connect(g.music);
  shimmer.start();

  return {
    padGain,
    pluckGain,
    droneGain,
    shimmerGain,
    delay,
    feedback,
    padFilter,
    drone,
    droneSub,
    shimmer,
  };
}

/** Start the generative engine. No-op if locked or already running. */
export function start(): void {
  if (running) return;
  if (!isUnlocked()) return;
  const g = getGraph();
  if (!g) return;

  rand = mulberry32(0xc0ffee ^ Math.floor(g.ctx.currentTime * 1000));
  curChar = { ...(PHASE_CHARACTER[useWorldStore.getState().phase] ?? PHASE_CHARACTER.dusk) };
  nodes = buildNodes();
  running = true;

  const now = g.ctx.currentTime;
  nextChordTime = now + 0.2;
  chordIndex = 0;
  nextPluckTime = now + 1.5;

  // Fade the music bus in gently on start.
  g.music.gain.cancelScheduledValues(now);
  schedTimer = setInterval(tick, TICK_MS);
  tick();
}

/** Stop the engine and tear down persistent voices. */
export function stop(): void {
  running = false;
  if (schedTimer) {
    clearInterval(schedTimer);
    schedTimer = null;
  }
  if (nodes) {
    const g = getGraph();
    const t = g ? g.ctx.currentTime : 0;
    try {
      nodes.drone.stop(t + 0.1);
      nodes.droneSub.stop(t + 0.1);
      nodes.shimmer.stop(t + 0.1);
    } catch {
      /* already stopped */
    }
    nodes = null;
  }
}

export function isRunning(): boolean {
  return running;
}

export const music = { start, stop, isRunning };
