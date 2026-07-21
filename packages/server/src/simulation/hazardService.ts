/**
 * Hazard Service — System 3 (cave-ins + equipment wear parameters).
 *
 * Pure, I/O-free math + the published hazard table (surfaced in GET /api/world).
 * The stateful application (rolling cave-ins, trapping/auto-rescuing agents,
 * accruing wear) lives in the tick loop; this module owns the numbers so they
 * are testable and published verbatim (design pillar 3: modifiers are
 * server-authoritative and published — no hidden odds on earnings-affecting RNG).
 *
 * TODO(VRF): cave-in rolls use Math.random for now (logged with roll context in
 * the tick loop). Migrate to Chainlink VRF once on-chain so the hazard RNG is
 * verifiable (design pillar 3 + anti-pattern rule 5).
 */

// ---------------------------------------------------------------------------
// Published hazard table (exported + surfaced in GET /api/world as hazardTable)
// ---------------------------------------------------------------------------

/**
 * Pinned client-facing hazard table. Shape is fixed — a client agent codes
 * against it. All costs are lamports.
 */
export const HAZARD_TABLE = {
  caveIn: {
    /** Base cave-in probability per HOUR on a deep hex (2%/hour). */
    baseChancePerHour: 0.02,
    /** Multiplier to the per-hour chance while an ember front covers the hex. */
    emberMultiplier: 3,
    /** Hours until a trapped agent auto-frees itself (self-dig). */
    selfDigHours: 4,
    /** SOL fee (lamports) to instantly rescue a trapped agent → treasury sink. */
    rescueCostLamports: 5_000_000,
    /** Standing yield bonus for deploying on a deep hex (opt-in risk/reward). */
    deepYieldBonus: 1.25,
  },
  wear: {
    /** Days of ACTIVE mining to reach full wear (1.0). */
    fullWearMiningDays: 3,
    /** Efficiency floor at full wear (efficiency = 1 - 0.3*wear ⇒ 0.7 at wear=1). */
    efficiencyFloor: 0.7,
    /** SOL fee (lamports) to repair (reset wear to 0) → treasury sink. */
    repairCostLamports: 3_000_000,
  },
} as const;

// ---------------------------------------------------------------------------
// Tick / time constants
// ---------------------------------------------------------------------------

/** Simulation tick interval (5s) — must match tickLoop.TICK_INTERVAL. */
export const TICK_MS = 5000;

/** Ticks per hour at a 5s tick (3600s / 5s = 720). */
export const TICKS_PER_HOUR = 3600 / (TICK_MS / 1000); // 720

/** Ticks to reach full wear = fullWearMiningDays * 24h * ticks/hour. */
export const FULL_WEAR_TICKS =
  HAZARD_TABLE.wear.fullWearMiningDays * 24 * TICKS_PER_HOUR; // 3*24*720 = 51840

/** Wear added per tick of active mining (reaches 1.0 after FULL_WEAR_TICKS). */
export const WEAR_PER_TICK = 1 / FULL_WEAR_TICKS; // ≈ 1.929e-5

/** Self-dig duration in ms (4 hours). */
export const SELF_DIG_MS = HAZARD_TABLE.caveIn.selfDigHours * 3_600_000;

/** Offline-grace window: cave-ins only fire if owner was active within 60 min. */
export const OFFLINE_GRACE_MS = 60 * 60_000;

// ---------------------------------------------------------------------------
// Pure math
// ---------------------------------------------------------------------------

/**
 * Per-TICK cave-in probability derived from the published per-HOUR base.
 *
 * We want the compounded per-tick probability over TICKS_PER_HOUR ticks to equal
 * the published per-hour chance. If each tick independently survives with
 * probability (1-pTick), then over an hour the survival is (1-pTick)^720, so:
 *
 *     1 - (1-pTick)^720 = baseChancePerHour
 *     pTick = 1 - (1 - baseChancePerHour)^(1/720)
 *
 * At baseChancePerHour = 0.02, pTick ≈ 2.806e-5. The ember multiplier scales the
 * PER-HOUR chance ×3 before deriving the per-tick value (so ember caves in ~3× as
 * often per hour, matching the published "×3 under ember storm").
 */
export function caveInChancePerTick(ember: boolean): number {
  const perHour = HAZARD_TABLE.caveIn.baseChancePerHour * (ember ? HAZARD_TABLE.caveIn.emberMultiplier : 1);
  return 1 - Math.pow(1 - perHour, 1 / TICKS_PER_HOUR);
}

/**
 * Mining efficiency from wear: 1 - 0.3*wear, clamped to [efficiencyFloor, 1].
 * wear ∈ [0,1] ⇒ efficiency ∈ [0.7, 1.0].
 */
export function wearEfficiency(wear: number): number {
  const clampedWear = Math.min(1, Math.max(0, wear));
  const eff = 1 - 0.3 * clampedWear;
  return Math.max(HAZARD_TABLE.wear.efficiencyFloor, eff);
}

/** Add one tick of wear, clamped to 1.0. */
export function accrueWear(wear: number): number {
  return Math.min(1, wear + WEAR_PER_TICK);
}
