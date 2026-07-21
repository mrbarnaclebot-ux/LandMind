/**
 * worldStore — client state for System 1 (World Clock / day-night cycle).
 *
 * Source of truth is the server: `world:update` arrives every ~5s (public, no
 * auth) and GET /api/world seeds the initial load. Between updates the client
 * interpolates a SMOOTH `cycleT` locally from a pinned anchor (WORLD_EPOCH_MS)
 * so the sky/HUD never step in 5s jumps. The server remains authoritative — on
 * every `world:update` we reconcile: we snap our local clock so that the
 * locally-derived cycleT matches the server's reported cycleT, then keep
 * advancing smoothly from there.
 *
 * Consumers:
 *  - ThreeScene reads `getSmoothCycleT()` each frame to lerp sky/sun/fog.
 *  - The HUD phase clock subscribes to `phase / phaseProgress / nextPhaseAt /
 *    modifiers / table`.
 *
 * A dev-only override (`__setPhase`) is exposed on `window` for QA to eyeball
 * the lerp without waiting for the real cycle.
 */
import { create } from 'zustand';
import { API_URL } from '../lib/config';
import type {
  WorldPhase,
  WorldModifiers,
  WorldModifierTable,
  WorldUpdateEvent,
  WeatherFront,
  WeatherTable,
  WeatherUpdateEvent,
} from '../lib/socketTypes';

// ---------------------------------------------------------------------------
// Cycle constants (pinned interface — must match the server)
// ---------------------------------------------------------------------------

/** Full cycle length in seconds. */
export const CYCLE_SECONDS = 1440;

/**
 * Pinned anchor: the epoch ms at which cycleT === 0 (start of `dawn`). Used to
 * derive a smooth local cycleT between server updates.
 */
export const WORLD_EPOCH_MS = 1784600000000;

/** Ordered phases with their durations (seconds). Sum === CYCLE_SECONDS. */
export const PHASE_ORDER: readonly WorldPhase[] = [
  'dawn',
  'day',
  'golden_hour',
  'dusk',
  'night',
] as const;

export const PHASE_DURATIONS: Record<WorldPhase, number> = {
  dawn: 120,
  day: 480,
  golden_hour: 120,
  dusk: 240,
  night: 480,
};

/** Cumulative start offset (seconds into the cycle) for each phase. */
export const PHASE_START_SECONDS: Record<WorldPhase, number> = (() => {
  const out = {} as Record<WorldPhase, number>;
  let acc = 0;
  for (const p of PHASE_ORDER) {
    out[p] = acc;
    acc += PHASE_DURATIONS[p];
  }
  return out;
})();

/** Default published table used until the server sends the real one. */
const DEFAULT_TABLE: WorldModifierTable = {
  dawn: { surface: 1.0, deep: 1.0 },
  day: { surface: 1.0, deep: 1.0 },
  golden_hour: { surface: 1.25, deep: 1.25 },
  dusk: { surface: 1.0, deep: 1.0 },
  night: { surface: 0.9, deep: 1.2 },
};

/**
 * Default published weather-effect table (System 2). Matches the pinned server
 * interface; replaced by whatever the server sends via GET /api/world.
 */
const DEFAULT_WEATHER_TABLE: WeatherTable = {
  rain: { MARSH: 1.15, GRASSLAND: 1.15, ROCKY: 0.9 },
  dust: { PLAINS: 0.8 },
  snow: { ALPINE: 1.2, FOREST: 0.9 },
  ember: { default: 1.5 },
};

// ---------------------------------------------------------------------------
// Local phase computation (from the anchor)
// ---------------------------------------------------------------------------

/** Seconds into the current cycle for a given epoch-ms, from the anchor. */
export function cycleSecondsAt(nowMs: number): number {
  const elapsed = (nowMs - WORLD_EPOCH_MS) / 1000;
  return ((elapsed % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
}

/** cycleT (0–1) for a given epoch-ms, from the anchor. */
export function cycleTAt(nowMs: number): number {
  return cycleSecondsAt(nowMs) / CYCLE_SECONDS;
}

/** Which phase a cycleT (0–1) falls in, plus progress through that phase. */
export function phaseAtCycleT(cycleT: number): {
  phase: WorldPhase;
  phaseProgress: number;
} {
  const sec = (((cycleT % 1) + 1) % 1) * CYCLE_SECONDS;
  for (const phase of PHASE_ORDER) {
    const start = PHASE_START_SECONDS[phase];
    const dur = PHASE_DURATIONS[phase];
    if (sec < start + dur) {
      return { phase, phaseProgress: (sec - start) / dur };
    }
  }
  // Floating point tail — fall into the last phase fully progressed.
  return { phase: 'night', phaseProgress: 1 };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WorldState {
  /** Whether we've received at least one authoritative snapshot. */
  ready: boolean;
  phase: WorldPhase;
  /** Server-reported progress through the current phase (0–1). */
  phaseProgress: number;
  nextPhaseAt: number;
  modifiers: WorldModifiers;
  table: WorldModifierTable;

  // --- System 2 (weather fronts) — additive ---------------------------------
  /** Live drifting weather fronts. Full-replacement set from weather:update. */
  fronts: WeatherFront[];
  /** Published per-front-type per-biome effect table (for the HUD popover). */
  weatherTable: WeatherTable;

  /**
   * Reconciliation offset (ms). We add this to `Date.now()` before deriving the
   * local cycleT so the anchor-derived clock matches the server's reported
   * cycleT at the moment of the last update. Keeps local interpolation smooth
   * AND aligned with server authority.
   */
  clockOffsetMs: number;

  /** Dev override: when set, forces the phase/cycleT regardless of the clock. */
  devOverride: { cycleT: number } | null;

  /** Apply an authoritative snapshot (from socket or GET /api/world). */
  applyUpdate: (data: WorldUpdateEvent) => void;
  /** Apply a weather:update broadcast (full-replacement fronts set). */
  applyWeatherUpdate: (data: WeatherUpdateEvent) => void;
  /** Fetch the initial snapshot from GET /api/world. */
  loadWorld: () => Promise<void>;

  /**
   * Smoothly-interpolated cycleT (0–1) for THIS instant. Reads the wall clock,
   * applies the reconciliation offset, and derives cycleT from the anchor. Not
   * reactive — call it inside useFrame / rAF loops.
   */
  getSmoothCycleT: () => number;

  /** Dev-only: force a phase (or raw cycleT) for QA. Pass null to clear. */
  setDevPhase: (phaseOrT: WorldPhase | number | null) => void;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  ready: false,
  phase: 'dusk',
  phaseProgress: 0,
  nextPhaseAt: 0,
  modifiers: { surface: 1.0, deep: 1.0 },
  table: DEFAULT_TABLE,
  fronts: [],
  weatherTable: DEFAULT_WEATHER_TABLE,
  clockOffsetMs: 0,
  devOverride: null,

  applyUpdate: (data) => {
    // Reconcile the local clock: choose an offset such that the anchor-derived
    // cycleT at (now + offset) equals the server's reported cycleT. We solve for
    // the offset in seconds within one cycle, picking the smallest-magnitude
    // shift so the clock nudges rather than jumps a whole cycle.
    const now = Date.now();
    const localSec = cycleSecondsAt(now);
    const serverSec = (((data.cycleT % 1) + 1) % 1) * CYCLE_SECONDS;
    let deltaSec = serverSec - localSec;
    // Wrap into [-CYCLE/2, +CYCLE/2] for the minimal correction.
    if (deltaSec > CYCLE_SECONDS / 2) deltaSec -= CYCLE_SECONDS;
    if (deltaSec < -CYCLE_SECONDS / 2) deltaSec += CYCLE_SECONDS;

    set((state) => ({
      ready: true,
      phase: data.phase,
      phaseProgress: data.phaseProgress,
      nextPhaseAt: data.nextPhaseAt,
      modifiers: data.modifiers,
      table: data.table && Object.keys(data.table).length > 0 ? data.table : DEFAULT_TABLE,
      clockOffsetMs: deltaSec * 1000,
      // GET /api/world (System 2, additive) may also seed weather. Only overwrite
      // when the field is present so a world:update socket payload without weather
      // doesn't clobber fronts delivered by the separate weather:update stream.
      fronts: data.fronts !== undefined ? data.fronts : state.fronts,
      weatherTable:
        data.weatherTable && Object.keys(data.weatherTable).length > 0
          ? data.weatherTable
          : state.weatherTable,
    }));
  },

  applyWeatherUpdate: (data) => {
    set({ fronts: Array.isArray(data.fronts) ? data.fronts : [] });
  },

  loadWorld: async () => {
    try {
      const res = await fetch(`${API_URL}/api/world`, { credentials: 'include' });
      if (!res.ok) throw new Error(`world request failed: ${res.status}`);
      const data = (await res.json()) as WorldUpdateEvent;
      get().applyUpdate(data);
    } catch (err) {
      // Fail soft: keep interpolating from the anchor alone. The socket update
      // will reconcile as soon as it arrives.
      console.error('[worldStore] Failed to fetch /api/world:', err);
    }
  },

  getSmoothCycleT: () => {
    const { devOverride, clockOffsetMs } = get();
    if (devOverride) return devOverride.cycleT;
    return cycleTAt(Date.now() + clockOffsetMs);
  },

  setDevPhase: (phaseOrT) => {
    if (phaseOrT === null) {
      set({ devOverride: null });
      return;
    }
    let cycleT: number;
    if (typeof phaseOrT === 'number') {
      cycleT = ((phaseOrT % 1) + 1) % 1;
    } else {
      // Land in the MIDDLE of the requested phase so the look is unambiguous.
      const start = PHASE_START_SECONDS[phaseOrT];
      const dur = PHASE_DURATIONS[phaseOrT];
      cycleT = (start + dur / 2) / CYCLE_SECONDS;
    }
    const { phase, phaseProgress } = phaseAtCycleT(cycleT);
    const table = get().table;
    const mods = (table[phase] as WorldModifiers | undefined) ?? { surface: 1, deep: 1 };
    set({
      devOverride: { cycleT },
      phase,
      phaseProgress,
      modifiers: mods,
      ready: true,
    });
  },
}));

// ---------------------------------------------------------------------------
// Dev QA hook — window.__setPhase('night') / __setPhase(0.5) / __setPhase(null)
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  (window as unknown as { __setPhase?: (p: WorldPhase | number | null) => void }).__setPhase = (
    p,
  ) => useWorldStore.getState().setDevPhase(p);
}
