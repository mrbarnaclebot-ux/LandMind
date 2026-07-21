/**
 * World Clock — System 1 (day/night cycle), FOUNDATION.
 *
 * Pure, I/O-free functions. Phase is a PURE FUNCTION of wall-clock time anchored
 * to a fixed epoch, so no storage is required and every server instance agrees.
 *
 * Contract (see .planning/design/GAMEPLAY-DESIGN.md System 1):
 *   24-minute (1440s) full cycle:
 *     dawn 120s -> day 480s -> golden_hour 120s -> dusk 240s -> night 480s
 *
 *   Yield modifiers (applied inside the mining calc, per agent per tick):
 *     golden_hour -> 1.25x everywhere (surface + deep)
 *     night       -> surface 0.9x, pit/cave-adjacent (deep) 1.2x
 *     else        -> 1.0x
 *
 * Cap swing at 1.25x / 0.9x per research: 2x reads manipulative, zero-yield
 * phases punish idle players.
 */

export type WorldPhase = 'dawn' | 'day' | 'golden_hour' | 'dusk' | 'night';

/**
 * Fixed anchor epoch (ms). Phase = pure function of Date.now() relative to this.
 * Chosen so the cycle boundary is a stable, deterministic constant across all
 * server instances. DO NOT change once clients are live (would jump the clock).
 */
export const WORLD_EPOCH_MS = 1784600000000;

/** Total cycle length in seconds (24 minutes). */
export const CYCLE_SECONDS = 1440;

/** Phase order + durations (seconds). Sum MUST equal CYCLE_SECONDS. */
export const PHASE_DURATIONS: ReadonlyArray<{ phase: WorldPhase; seconds: number }> = [
  { phase: 'dawn', seconds: 120 },
  { phase: 'day', seconds: 480 },
  { phase: 'golden_hour', seconds: 120 },
  { phase: 'dusk', seconds: 240 },
  { phase: 'night', seconds: 480 },
];

/**
 * Published modifier table. Exposed verbatim to clients (GET /api/world) so the
 * odds are readable in-game ("all modifiers server-authoritative and published").
 * `default` covers dawn / day / dusk.
 */
export const MODIFIER_TABLE = {
  golden_hour: { surface: 1.25, deep: 1.25 },
  night: { surface: 0.9, deep: 1.2 },
  default: { surface: 1, deep: 1 },
} as const;

export interface WorldModifiers {
  surface: number;
  deep: number;
}

export interface WorldState {
  phase: WorldPhase;
  /** Position within the full 1440s cycle, 0..1. */
  cycleT: number;
  /** Progress through the CURRENT phase, 0..1. */
  phaseProgress: number;
  /** Epoch ms at which the current phase ends / next phase begins. */
  nextPhaseAt: number;
  /** Modifiers for the CURRENT phase (surface + deep multipliers). */
  modifiers: WorldModifiers;
}

/**
 * Resolve the per-agent yield multiplier for a phase.
 *
 * @param phase  current world phase
 * @param isDeep true if the hex is a pit/cave-adjacent ("deep") hex
 * @returns multiplier applied to base per-tick yield
 *   golden_hour -> 1.25 (deep or surface)
 *   night       -> isDeep ? 1.2 : 0.9
 *   else        -> 1.0
 */
export function getPhaseModifier(phase: WorldPhase, isDeep: boolean): number {
  if (phase === 'golden_hour') return MODIFIER_TABLE.golden_hour.deep; // 1.25 both
  if (phase === 'night') {
    return isDeep ? MODIFIER_TABLE.night.deep : MODIFIER_TABLE.night.surface;
  }
  return MODIFIER_TABLE.default.deep; // 1.0
}

/** The modifiers object for the CURRENT phase (both surface + deep). */
function getPhaseModifiers(phase: WorldPhase): WorldModifiers {
  if (phase === 'golden_hour') return { ...MODIFIER_TABLE.golden_hour };
  if (phase === 'night') return { ...MODIFIER_TABLE.night };
  return { ...MODIFIER_TABLE.default };
}

/**
 * Compute the full world state at a given wall-clock time.
 *
 * Pure: same nowMs => same result on every instance. No I/O, no storage.
 *
 * @param nowMs epoch milliseconds (default Date.now())
 */
export function getWorldState(nowMs: number = Date.now()): WorldState {
  const cycleMs = CYCLE_SECONDS * 1000;

  // Seconds elapsed within the current cycle (always 0..CYCLE_SECONDS).
  // Use a positive modulo so timestamps before WORLD_EPOCH_MS still resolve.
  let offsetMs = (nowMs - WORLD_EPOCH_MS) % cycleMs;
  if (offsetMs < 0) offsetMs += cycleMs;

  const cycleStartMs = nowMs - offsetMs; // epoch ms of the current cycle's start
  const elapsedSec = offsetMs / 1000;
  const cycleT = offsetMs / cycleMs;

  // Walk the phase table to find which phase `elapsedSec` falls in.
  let acc = 0;
  for (const { phase, seconds } of PHASE_DURATIONS) {
    const phaseStart = acc;
    const phaseEnd = acc + seconds;
    if (elapsedSec < phaseEnd) {
      const phaseProgress = (elapsedSec - phaseStart) / seconds;
      const nextPhaseAt = cycleStartMs + phaseEnd * 1000;
      return {
        phase,
        cycleT,
        phaseProgress,
        nextPhaseAt,
        modifiers: getPhaseModifiers(phase),
      };
    }
    acc = phaseEnd;
  }

  // Unreachable if PHASE_DURATIONS sums to CYCLE_SECONDS, but stay safe: treat as
  // the very start of the next cycle (dawn).
  const first = PHASE_DURATIONS[0];
  return {
    phase: first.phase,
    cycleT: 0,
    phaseProgress: 0,
    nextPhaseAt: cycleStartMs + cycleMs + first.seconds * 1000,
    modifiers: getPhaseModifiers(first.phase),
  };
}
