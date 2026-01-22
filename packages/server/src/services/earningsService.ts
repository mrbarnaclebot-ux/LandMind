/**
 * Earnings Service
 * Calculates weighted resource scores and user share of fee pool
 *
 * From PROJECT.md:
 * - Virtual resources (Gold, Silver, Copper, Iron) are fee-weighting mechanism
 * - 50/50 fee split between platform and user rewards
 * - Resource weights: Gold 4x, Silver 2x, Copper 1.5x, Iron 1x (configurable via admin)
 */

import { prisma } from '../lib/prisma.js';
import { getResourceWeights } from './economyService.js';

/**
 * Default resource weight multipliers (scaled by 1000 to avoid floats)
 * Gold: 4x (4000/1000), Silver: 2x (2000/1000), Copper: 1.5x (1500/1000), Iron: 1x (1000/1000)
 * Note: These are fallback defaults. Use getResourceWeights() for live config.
 */
export const RESOURCE_WEIGHTS = {
  GOLD: 4000n,
  SILVER: 2000n,
  COPPER: 1500n,
  IRON: 1000n,
} as const;

export const WEIGHT_DIVISOR = 1000n;

/**
 * User share of fee pool (50%)
 */
export const USER_POOL_SHARE = 50n;
export const SHARE_DIVISOR = 100n;

export interface ResourceTotals {
  gold: bigint;
  silver: bigint;
  copper: bigint;
  iron: bigint;
}

export interface EarningsData {
  weightedScore: bigint;
  totalPoolScore: bigint;
  userShare: bigint;
  availableFeePool: bigint;
  claimableAmount: bigint;
  totalClaimed: bigint;
}

/**
 * Calculate weighted score from resources using default weights
 * Formula: (gold * 4 + silver * 2 + copper * 1.5 + iron * 1)
 *
 * @param resources - Resource totals
 * @returns Weighted score (scaled by WEIGHT_DIVISOR internally, returns unscaled)
 */
export function calculateWeightedScore(resources: ResourceTotals): bigint {
  const goldScore = resources.gold * RESOURCE_WEIGHTS.GOLD;
  const silverScore = resources.silver * RESOURCE_WEIGHTS.SILVER;
  const copperScore = resources.copper * RESOURCE_WEIGHTS.COPPER;
  const ironScore = resources.iron * RESOURCE_WEIGHTS.IRON;

  // Divide by WEIGHT_DIVISOR to get actual weighted value
  return (goldScore + silverScore + copperScore + ironScore) / WEIGHT_DIVISOR;
}

/**
 * Calculate weighted score from resources using configurable weights from admin
 * Formula: (gold * goldWeight + silver * silverWeight + copper * copperWeight + iron * ironWeight) / 1000
 *
 * @param resources - Resource totals
 * @returns Weighted score (scaled by WEIGHT_DIVISOR internally, returns unscaled)
 */
export async function calculateWeightedScoreWithConfig(
  resources: ResourceTotals
): Promise<bigint> {
  const weights = await getResourceWeights();

  const goldScore = resources.gold * weights.gold;
  const silverScore = resources.silver * weights.silver;
  const copperScore = resources.copper * weights.copper;
  const ironScore = resources.iron * weights.iron;

  // Divide by WEIGHT_DIVISOR to get actual weighted value
  return (goldScore + silverScore + copperScore + ironScore) / WEIGHT_DIVISOR;
}

/**
 * Calculate a user's share of the fee pool
 * Formula: (userScore / totalScore) * (totalFeePool * 0.5)
 *
 * @param userScore - User's weighted score
 * @param totalScore - Total weighted score across all users
 * @param totalFeePool - Total fee pool in lamports
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

  // User's proportional share
  // Using multiplication before division for precision
  return (userPool * userScore) / totalScore;
}

/**
 * Get earnings data for a user
 * Aggregates mining state from all their agents and calculates share
 *
 * @param userId - User UUID
 * @returns Complete earnings data including claimable amount
 */
export async function getEarningsForUser(userId: string): Promise<EarningsData> {
  // Get user's agents with mining states
  const agents = await prisma.agent.findMany({
    where: { ownerId: userId },
    include: { miningState: true },
  });

  // Sum resources across all agents
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

  // Calculate share
  const userShare = calculateUserShare(weightedScore, totalPoolScore, availableFeePool);

  // Claimable is share minus already claimed
  const claimableAmount = userShare > totalClaimed ? userShare - totalClaimed : 0n;

  return {
    weightedScore,
    totalPoolScore,
    userShare,
    availableFeePool,
    claimableAmount,
    totalClaimed,
  };
}

/**
 * Update (or create) a user's earnings snapshot
 * Called during flush to keep scores current for leaderboard
 *
 * @param userId - User UUID
 * @returns Updated weighted score
 */
export async function updateUserEarningsSnapshot(userId: string): Promise<bigint> {
  // Get user's agents with mining states
  const agents = await prisma.agent.findMany({
    where: { ownerId: userId },
    include: { miningState: true },
  });

  // Sum resources across all agents
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

  // Calculate weighted score
  const weightedScore = calculateWeightedScore(resources);

  // Upsert snapshot
  await prisma.earningsSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      weightedScore,
      totalClaimed: 0n,
    },
    update: {
      weightedScore,
    },
  });

  return weightedScore;
}

/**
 * Get aggregated resources for a user (utility for display)
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
