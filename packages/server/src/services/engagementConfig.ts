/**
 * Engagement layer published parameters — System 4 (Phase D).
 *
 * A single readable table of every engagement-layer number, surfaced verbatim in
 * GET /api/world as `engagementTable`. Design pillar 3: all modifiers are
 * server-authoritative and PUBLISHED (readable odds in-game). Keep every new
 * engagement number here so there is one source of truth for both the tick-loop
 * math and the client-facing table.
 */

export const ENGAGEMENT_TABLE = {
  /** Daily-contract completion yield boost (contractMod), joins the yield product. */
  contractBoost: 1.1,
  /** Gold Rush achieved-boost multiplier (goldRushMod) for in-window miners. */
  goldRushBoost: 1.15,
  /** Hours the Gold Rush boost lasts after the rush ends (endsAt + this). */
  goldRushBoostHours: 2,
  /** Per-user Survey cooldown in minutes. */
  surveyCooldownMin: 5,
  /** Permanent additive per-season yield bonus applied on each season close. */
  seasonBonusPerSeason: 0.02,
} as const;

export type EngagementTable = typeof ENGAGEMENT_TABLE;
