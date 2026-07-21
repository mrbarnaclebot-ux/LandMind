/**
 * Pure scoring functions for the earnings/fee-distribution system.
 *
 * Extracted from earningsService so they can be unit-tested and reused without
 * pulling in Prisma. earningsService re-exports these to keep its public API
 * stable.
 *
 * From PROJECT.md:
 * - Virtual resources (Gold, Silver, Copper, Iron) are the fee-weighting mechanism
 * - 50/50 fee split between platform and user rewards
 * - Resource weights: Gold 4x, Silver 2x, Copper 1.5x, Iron 1x (configurable via admin)
 */

/**
 * Default resource weight multipliers (scaled by 1000 to avoid floats).
 * Gold 4x, Silver 2x, Copper 1.5x, Iron 1x.
 * Fallback defaults — use getResourceWeights() for live config.
 */
export const RESOURCE_WEIGHTS = {
  GOLD: 4000n,
  SILVER: 2000n,
  COPPER: 1500n,
  IRON: 1000n,
} as const;

export const WEIGHT_DIVISOR = 1000n;

/** User share of fee pool (50%). */
export const USER_POOL_SHARE = 50n;
export const SHARE_DIVISOR = 100n;

export interface ResourceTotals {
  gold: bigint;
  silver: bigint;
  copper: bigint;
  iron: bigint;
}

export interface ResourceWeights {
  gold: bigint;
  silver: bigint;
  copper: bigint;
  iron: bigint;
}

/**
 * Calculate weighted score from resources using the default weights.
 * Formula: (gold*4 + silver*2 + copper*1.5 + iron*1)
 */
export function calculateWeightedScore(resources: ResourceTotals): bigint {
  return calculateWeightedScoreWithWeights(resources, {
    gold: RESOURCE_WEIGHTS.GOLD,
    silver: RESOURCE_WEIGHTS.SILVER,
    copper: RESOURCE_WEIGHTS.COPPER,
    iron: RESOURCE_WEIGHTS.IRON,
  });
}

/**
 * Calculate weighted score from resources with explicit (admin-configurable)
 * weights. Pure — the caller supplies the weights.
 */
export function calculateWeightedScoreWithWeights(
  resources: ResourceTotals,
  weights: ResourceWeights
): bigint {
  const goldScore = resources.gold * weights.gold;
  const silverScore = resources.silver * weights.silver;
  const copperScore = resources.copper * weights.copper;
  const ironScore = resources.iron * weights.iron;

  return (goldScore + silverScore + copperScore + ironScore) / WEIGHT_DIVISOR;
}

/**
 * Calculate a user's cumulative share of the fee pool.
 * Formula: (userScore / totalScore) * (totalFeePool * 0.5)
 *
 * @returns User's share in lamports
 */
export function calculateUserShare(
  userScore: bigint,
  totalScore: bigint,
  totalFeePool: bigint
): bigint {
  if (totalScore === 0n) return 0n;

  // Calculate user pool (50% of total)
  const userPool = (totalFeePool * USER_POOL_SHARE) / SHARE_DIVISOR;

  // Multiplication before division for precision
  return (userPool * userScore) / totalScore;
}
