/**
 * Economy Service
 * Manages economy parameters like resource weights, minimum claim amount,
 * and emergency pause functionality.
 *
 * From PROJECT.md:
 * - Admin can adjust economy parameters
 * - Admin can trigger emergency pause
 * - Pause state affects all claim operations
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export interface EconomyConfig {
  minClaimAmount: bigint;
  goldWeight: number;
  silverWeight: number;
  copperWeight: number;
  ironWeight: number;
  isPaused: boolean;
  pausedAt: Date | null;
  pausedBy: string | null;
  updatedAt: Date;
}

const CONFIG_CACHE_KEY = 'economy:config';
const CACHE_TTL = 60; // 1 minute

/**
 * Get economy config (with Redis cache)
 */
export async function getEconomyConfig(): Promise<EconomyConfig> {
  // Try cache first
  const cached = await redis.get(CONFIG_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached, (key, value) => {
      if (key === 'minClaimAmount') return BigInt(value);
      if (key === 'pausedAt' && value) return new Date(value);
      if (key === 'updatedAt') return new Date(value);
      return value;
    });
  }

  // Fetch from DB
  let config = await prisma.economyConfig.findUnique({
    where: { id: 'default' },
  });

  // Create default if not exists
  if (!config) {
    config = await prisma.economyConfig.create({
      data: { id: 'default' },
    });
  }

  // Cache
  await redis.setex(
    CONFIG_CACHE_KEY,
    CACHE_TTL,
    JSON.stringify(config, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );

  return config;
}

/**
 * Update economy config
 */
export async function updateEconomyConfig(
  updates: Partial<Omit<EconomyConfig, 'updatedAt'>>,
  adminWallet: string
): Promise<EconomyConfig> {
  // Build update data
  const updateData: Record<string, unknown> = { ...updates };

  // Track who paused
  if ('isPaused' in updates) {
    if (updates.isPaused) {
      updateData.pausedAt = new Date();
      updateData.pausedBy = adminWallet;
    } else {
      updateData.pausedAt = null;
      updateData.pausedBy = null;
    }
  }

  const config = await prisma.economyConfig.upsert({
    where: { id: 'default' },
    update: updateData,
    create: { id: 'default', ...updateData },
  });

  // Invalidate cache
  await redis.del(CONFIG_CACHE_KEY);

  return config;
}

/**
 * Check if claims are paused
 */
export async function isClaimsPaused(): Promise<boolean> {
  const config = await getEconomyConfig();
  return config.isPaused;
}

/**
 * Get resource weights for earnings calculation
 */
export async function getResourceWeights(): Promise<{
  gold: bigint;
  silver: bigint;
  copper: bigint;
  iron: bigint;
}> {
  const config = await getEconomyConfig();
  return {
    gold: BigInt(config.goldWeight),
    silver: BigInt(config.silverWeight),
    copper: BigInt(config.copperWeight),
    iron: BigInt(config.ironWeight),
  };
}
