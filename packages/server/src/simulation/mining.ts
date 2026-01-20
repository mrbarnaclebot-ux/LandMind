/**
 * Mining Calculation Logic
 * Determines how many resources an agent mines per tick based on hex richness
 */

import type { ResourceType } from '@prisma/client';

export interface MiningYield {
  amount: bigint;
  resourceType: ResourceType;
}

/**
 * Base mining rates per tick (from CONTEXT.md: 10-50 range)
 * Varies by resource type to add strategic element
 */
const BASE_RATES: Record<ResourceType, number> = {
  GOLD: 10,      // Rare, slower mining
  SILVER: 20,    // Uncommon
  COPPER: 35,    // Common
  IRON: 50,      // Very common, fastest mining
  EMPTY: 0,      // No resources
};

/**
 * Calculate mining yield for an agent on a hex
 *
 * @param hexResourceType - The type of resource in the hex
 * @param hexResourceAmount - Current amount remaining in hex (BigInt)
 * @returns MiningYield with amount mined and resource type
 */
export function calculateMiningYield(
  hexResourceType: ResourceType,
  hexResourceAmount: bigint
): MiningYield {
  const baseRate = BASE_RATES[hexResourceType];

  if (baseRate === 0 || hexResourceAmount <= 0n) {
    return { amount: 0n, resourceType: hexResourceType };
  }

  // Mine up to base rate, but not more than available
  const mineAmount = BigInt(baseRate);
  const actualAmount = mineAmount < hexResourceAmount ? mineAmount : hexResourceAmount;

  return {
    amount: actualAmount,
    resourceType: hexResourceType,
  };
}

/**
 * Add mined resources to agent totals
 */
export function addResourcesToAgent(
  current: { gold: string; silver: string; copper: string; iron: string },
  yield_: MiningYield
): { gold: string; silver: string; copper: string; iron: string } {
  const result = {
    gold: current.gold,
    silver: current.silver,
    copper: current.copper,
    iron: current.iron,
  };

  switch (yield_.resourceType) {
    case 'GOLD':
      result.gold = String(BigInt(current.gold) + yield_.amount);
      break;
    case 'SILVER':
      result.silver = String(BigInt(current.silver) + yield_.amount);
      break;
    case 'COPPER':
      result.copper = String(BigInt(current.copper) + yield_.amount);
      break;
    case 'IRON':
      result.iron = String(BigInt(current.iron) + yield_.amount);
      break;
  }

  return result;
}
