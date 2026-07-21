/**
 * Earnings Service
 * Calculates weighted resource scores and user share of the fee pool.
 *
 * Pure scoring math lives in `../lib/scoring.ts` and is re-exported here to keep
 * this module's public API stable. This module owns the Prisma-backed
 * aggregation (getEarningsForUser, getUserTotalResources).
 *
 * From PROJECT.md:
 * - Virtual resources (Gold, Silver, Copper, Iron) are the fee-weighting mechanism
 * - 50/50 fee split between platform and user rewards
 * - Resource weights: Gold 4x, Silver 2x, Copper 1.5x, Iron 1x (configurable via admin)
 */

import { prisma } from '../lib/prisma.js';
import { getResourceWeights } from './economyService.js';
import {
  RESOURCE_WEIGHTS,
  WEIGHT_DIVISOR,
  USER_POOL_SHARE,
  SHARE_DIVISOR,
  calculateWeightedScore,
  calculateWeightedScoreWithWeights,
  calculateUserShare,
  type ResourceTotals,
} from '../lib/scoring.js';

// Re-export pure scoring API so existing importers keep working.
export {
  RESOURCE_WEIGHTS,
  WEIGHT_DIVISOR,
  USER_POOL_SHARE,
  SHARE_DIVISOR,
  calculateWeightedScore,
  calculateUserShare,
};
export type { ResourceTotals };

export interface EarningsData {
  weightedScore: bigint;
  totalPoolScore: bigint;
  /**
   * User's CUMULATIVE lifetime share of the fee pool (lamports).
   *
   * This is the value committed to the Merkle leaf as `total_allowance`.
   * On-chain payout = cumulativeAllowance - claimed_total.
   * (Alias: `userShare` — kept for backward compatibility.)
   */
  cumulativeAllowance: bigint;
  /** @deprecated Same value as `cumulativeAllowance`. */
  userShare: bigint;
  availableFeePool: bigint;
  claimableAmount: bigint;
  totalClaimed: bigint;
}

/**
 * Calculate weighted score from resources using the admin-configurable weights
 * loaded from EconomyConfig.
 */
export async function calculateWeightedScoreWithConfig(
  resources: ResourceTotals
): Promise<bigint> {
  const weights = await getResourceWeights();
  return calculateWeightedScoreWithWeights(resources, {
    gold: weights.gold,
    silver: weights.silver,
    copper: weights.copper,
    iron: weights.iron,
  });
}

/**
 * Get earnings data for a user.
 * Aggregates mining state from all their agents and calculates share.
 *
 * @param userId - User UUID
 * @returns Complete earnings data including cumulative allowance and claimable
 */
export async function getEarningsForUser(userId: string): Promise<EarningsData> {
  const resources = await getUserTotalResources(userId);

  // Calculate user's weighted score
  const weightedScore = calculateWeightedScore(resources);

  // Get total pool score (sum of all users' weighted scores)
  const allSnapshots = await prisma.earningsSnapshot.findMany({
    select: { weightedScore: true },
  });
  const totalPoolScore = allSnapshots.reduce((sum, s) => sum + s.weightedScore, 0n);

  // Get total unprocessed fee deposits
  const feeSum = await prisma.feeDeposit.aggregate({
    _sum: { amount: true },
    where: { processed: false },
  });
  const availableFeePool = feeSum._sum.amount ?? 0n;

  // Get user's earnings snapshot for claimed amount
  const snapshot = await prisma.earningsSnapshot.findUnique({
    where: { userId },
  });
  const totalClaimed = snapshot?.totalClaimed ?? 0n;

  // Cumulative lifetime share of the pool (== on-chain total_allowance)
  const cumulativeAllowance = calculateUserShare(
    weightedScore,
    totalPoolScore,
    availableFeePool
  );

  // Claimable is the cumulative allowance minus what has already been claimed
  const claimableAmount =
    cumulativeAllowance > totalClaimed ? cumulativeAllowance - totalClaimed : 0n;

  return {
    weightedScore,
    totalPoolScore,
    cumulativeAllowance,
    userShare: cumulativeAllowance,
    availableFeePool,
    claimableAmount,
    totalClaimed,
  };
}

/**
 * Get aggregated resources for a user (utility for display).
 *
 * @param userId - User UUID
 * @returns Total resources mined by all agents
 */
export async function getUserTotalResources(userId: string): Promise<ResourceTotals> {
  const agents = await prisma.agent.findMany({
    where: { ownerId: userId },
    include: { miningState: true },
  });

  const resources: ResourceTotals = {
    gold: 0n,
    silver: 0n,
    copper: 0n,
    iron: 0n,
  };

  for (const agent of agents) {
    if (agent.miningState) {
      resources.gold += agent.miningState.gold;
      resources.silver += agent.miningState.silver;
      resources.copper += agent.miningState.copper;
      resources.iron += agent.miningState.iron;
    }
  }

  return resources;
}
