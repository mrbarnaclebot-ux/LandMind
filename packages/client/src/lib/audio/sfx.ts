/**
 * Synthesized sound effects for MINERUSH — all WebAudio, no assets.
 *
 * Every SFX is a short, pixel-flavored gesture built from oscillators + gain
 * envelopes routed into the shared `sfx` gain bus (which sits behind the master
 * limiter). Nothing plays while the context is locked; `play()` no-ops then.
 *
 * Design intent (art direction): pixel-flavored but NOT harsh. Triangle/sine
 * bodies, filtered noise for whooshes, gentle envelopes, tasteful peak gains.
 */
import { getGraph, isUnlocked } from './context';

export type SfxName =
  | 'ui_click'
  | 'deploy'
  | 'relocate'
  | 'survey'
  | 'claim'
  | 'success'
  | 'warning'
  | 'error'
  | 'trapped'
  | 'rescue'
  | 'golden_hour'
  | 'vein'
  | 'goldrush';

// --- small synthesis helpers ------------------------------------------------

/** Frequency (Hz) for a semitone offset from A4 (440). */
function note(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  toFreq?: number; // optional linear glide target
  t0: number; // start time (relative offset added by caller)
  dur: number;
  attack?: number;
  release?: number;
  peak?: number;
  filter?: number; // lowpass cutoff Hz
  detune?: number;
}

function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts) {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, o.t0);
  if (o.toFreq != null) osc.frequency.linearRampToValueAtTime(o.toFreq, o.t0 + o.dur);
  if (o.detune) osc.detune.value = o.detune;

  const g = ctx.createGain();
  const peak = o.peak ?? 0.3;
  const atk = o.attack ?? 0.005;
  const rel = o.release ?? Math.max(0.02, o.dur * 0.6);
  g.gain.setValueAtTime(0.0001, o.t0);
  g.gain.exponentialRampToValueAtTime(peak, o.t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, o.t0 + o.dur + rel);

  let node: AudioNode = g;
  osc.connect(g);
  if (o.filter != null) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.filter;
    g.connect(lp);
    node = lp;
  }
  node.connect(dest);

  osc.start(o.t0);
  osc.stop(o.t0 + o.dur + rel + 0.05);
}

/** Short filtered noise burst (whoosh / rumble bodies). */
function noise(
  ctx: AudioContext,
  dest: AudioNode,
  t0: number,
  dur: number,
  opts: { peak?: number; type?: BiquadFilterType; cutoff?: number; sweepTo?: number } = {},
) {
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filt = ctx.createBiquadFilter();
  filt.type = opts.type ?? 'bandpass';
  filt.frequency.setValueAtTime(opts.cutoff ?? 900, t0);
  if (opts.sweepTo != null) filt.frequency.linearRampToValueAtTime(opts.sweepTo, t0 + dur);

  const g = ctx.createGain();
  const peak = opts.peak ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.03, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filt);
  filt.connect(g);
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// --- per-SFX recipes --------------------------------------------------------

type Recipe = (ctx: AudioContext, dest: AudioNode, t: number) => void;

const RECIPES: Record<SfxName, Recipe> = {
  ui_click: (c, d, t) => {
    tone(c, d, { type: 'triangle', freq: note(16), t0: t, dur: 0.02, peak: 0.18, filter: 3000 });
  },

  deploy: (c, d, t) => {
    // low thunk...
    tone(c, d, { type: 'sine', freq: note(-24), toFreq: note(-29), t0: t, dur: 0.14, peak: 0.4, filter: 500 });
    noise(c, d, t, 0.08, { peak: 0.12, type: 'lowpass', cutoff: 400 });
    // ...quick ascending 3-note sparkle
    [0, 4, 7].forEach((s, i) =>
      tone(c, d, { type: 'triangle', freq: note(12 + s), t0: t + 0.09 + i * 0.05, dur: 0.06, peak: 0.16, filter: 4000 }),
    );
  },

  relocate: (c, d, t) => {
    noise(c, d, t, 0.28, { peak: 0.2, type: 'bandpass', cutoff: 500, sweepTo: 2600 });
    tone(c, d, { type: 'sine', freq: note(-2), toFreq: note(10), t0: t, dur: 0.24, peak: 0.14, filter: 2500 });
  },

  survey: (c, d, t) => {
    // sonar-ish ping — two soft pings, second fainter (echo)
    tone(c, d, { type: 'sine', freq: note(19), t0: t, dur: 0.18, peak: 0.26, release: 0.35, filter: 3500 });
    tone(c, d, { type: 'sine', freq: note(19), t0: t + 0.22, dur: 0.18, peak: 0.12, release: 0.35, filter: 3000 });
  },

  claim: (c, d, t) => {
    // classic two-note coin chime (E then higher E-ish)
    tone(c, d, { type: 'square', freq: note(19), t0: t, dur: 0.06, peak: 0.16, filter: 5000 });
    tone(c, d, { type: 'square', freq: note(26), t0: t + 0.07, dur: 0.12, peak: 0.16, filter: 5000 });
  },

  success: (c, d, t) => {
    // short major arpeggio (C E G C)
    [0, 4, 7, 12].forEach((s, i) =>
      tone(c, d, { type: 'triangle', freq: note(3 + s), t0: t + i * 0.06, dur: 0.1, peak: 0.18, filter: 4500 }),
    );
  },

  warning: (c, d, t) => {
    // muted double-blip
    tone(c, d, { type: 'sawtooth', freq: note(-2), t0: t, dur: 0.07, peak: 0.14, filter: 1400 });
    tone(c, d, { type: 'sawtooth', freq: note(-2), t0: t + 0.12, dur: 0.07, peak: 0.14, filter: 1400 });
  },

  error: (c, d, t) => {
    // low buzz, brief
    tone(c, d, { type: 'sawtooth', freq: note(-19), toFreq: note(-24), t0: t, dur: 0.22, peak: 0.2, filter: 900 });
  },

  trapped: (c, d, t) => {
    // low rumble
    noise(c, d, t, 0.5, { peak: 0.28, type: 'lowpass', cutoff: 220, sweepTo: 90 });
    tone(c, d, { type: 'sine', freq: note(-31), toFreq: note(-36), t0: t, dur: 0.45, peak: 0.22, filter: 200 });
  },

  rescue: (c, d, t) => {
    // rising resolve (minor -> major lift)
    [-5, 0, 4, 9].forEach((s, i) =>
      tone(c, d, { type: 'triangle', freq: note(3 + s), t0: t + i * 0.08, dur: 0.14, peak: 0.18, filter: 4000 }),
    );
  },

  golden_hour: (c, d, t) => {
    // soft, QUIET 3-note fanfare (warm major)
    [0, 5, 9].forEach((s, i) =>
      tone(c, d, { type: 'sine', freq: note(5 + s), t0: t + i * 0.11, dur: 0.28, peak: 0.12, release: 0.3, filter: 3200 }),
    );
  },

  vein: (c, d, t) => {
    // sparkle shimmer — quick high pentatonic run
    [12, 16, 19, 24].forEach((s, i) =>
      tone(c, d, { type: 'triangle', freq: note(3 + s), t0: t + i * 0.04, dur: 0.09, peak: 0.12, filter: 6000 }),
    );
  },

  goldrush: (c, d, t) => {
    // deeper fanfare — root fifth octave with a low body
    tone(c, d, { type: 'sine', freq: note(-17), t0: t, dur: 0.5, peak: 0.2, filter: 800 });
    [0, 7, 12, 16].forEach((s, i) =>
      tone(c, d, { type: 'triangle', freq: note(-5 + s), t0: t + 0.05 + i * 0.1, dur: 0.24, peak: 0.16, filter: 4000 }),
    );
  },
};

/**
 * Play a synthesized SFX. No-ops silently while the audio context is locked
 * (autoplay policy) or muted-at-zero (the gain bus handles mute regardless).
 */
export function play(name: SfxName): void {
  if (!isUnlocked()) return;
  const g = getGraph();
  if (!g) return;
  const recipe = RECIPES[name];
  if (!recipe) return;
  // Tiny lookahead avoids clicks from starting exactly at currentTime.
  recipe(g.ctx, g.sfx, g.ctx.currentTime + 0.001);
}

export const sfx = { play };
