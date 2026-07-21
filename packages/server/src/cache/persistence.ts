/**
 * Write-Behind Persistence
 * Syncs Redis cache state to PostgreSQL periodically
 * Also updates earnings snapshots and leaderboard on flush
 */

import { prisma } from '../lib/prisma.js';
import { getAllAgents, cacheAgent, type CachedAgent } from './agentCache.js';
import {
  calculateWeightedScore,
  type ResourceTotals,
} from '../services/earningsService.js';
import { updateScoresBatch } from '../services/leaderboardService.js';
import { invalidateMerkleTreeCache } from '../services/merkleService.js';

/**
 * Load all MINING/RELOCATING agents from PostgreSQL into Redis cache
 * Called on server startup to restore hot state
 */
export async function loadHotAgentsFromPostgres(): Promise<number> {
  try {
    const agents = await prisma.agent.findMany({
      where: {
        status: { in: ['MINING', 'RELOCATING'] },
      },
      include: {
        owner: true,
        hex: true,
        miningState: true,
      },
    });

    let count = 0;

    for (const agent of agents) {
      if (!agent.hex || !agent.miningState) continue;

      const cached: CachedAgent = {
        agentId: agent.id,
        ownerId: agent.ownerId,
        ownerWallet: agent.owner.walletPubkey,
        hexId: agent.hexId!,
        hexQ: agent.hex.q,
        hexR: agent.hex.r,
        gold: String(agent.miningState.gold),
        silver: String(agent.miningState.silver),
        copper: String(agent.miningState.copper),
        iron: String(agent.miningState.iron),
        status: agent.status as 'MINING' | 'RELOCATING',
        lastTick: 0, // Will be updated on first tick
      };

      await cacheAgent(cached);
      count++;
    }

    console.log(`Loaded ${count} hot agents from PostgreSQL to Redis`);
    return count;
  } catch (error) {
    // Handle case where database tables don't exist yet (development/testing)
    if (error instanceof Error && error.message.includes('does not exist')) {
      console.warn('Database tables not yet created, skipping agent load');
      return 0;
    }
    throw error;
  }
}

/**
 * Flush all cached agent state to PostgreSQL
 * Called periodically (every 30s) and on shutdown
 * Also updates earnings snapshots and leaderboard
 */
export async function flushToPostgres(): Promise<void> {
  const agents = await getAllAgents();

  if (agents.length === 0) {
    console.log('No agents to flush');
    return;
  }

  console.log(`Flushing ${agents.length} agents to PostgreSQL...`);

  // Group agents by owner for earnings calculation
  const ownerResources = new Map<string, { ownerId: string; wallet: string; resources: ResourceTotals }>();

  for (const agent of agents) {
    const existing = ownerResources.get(agent.ownerId);
    if (existing) {
      existing.resources.gold += BigInt(agent.gold);
      existing.resources.silver += BigInt(agent.silver);
      existing.resources.copper += BigInt(agent.copper);
      existing.resources.iron += BigInt(agent.iron);
    } else {
      ownerResources.set(agent.ownerId, {
        ownerId: agent.ownerId,
        wallet: agent.ownerWallet,
        resources: {
          gold: BigInt(agent.gold),
          silver: BigInt(agent.silver),
          copper: BigInt(agent.copper),
          iron: BigInt(agent.iron),
        },
      });
    }
  }

  // Use a transaction for consistency
  await prisma.$transaction(async (tx) => {
    for (const agent of agents) {
      // Update mining state
      await tx.miningState.update({
        where: { agentId: agent.agentId },
        data: {
          gold: BigInt(agent.gold),
          silver: BigInt(agent.silver),
          copper: BigInt(agent.copper),
          iron: BigInt(agent.iron),
          lastUpdate: new Date(),
        },
      });

      // Update agent status and position
      await tx.agent.update({
        where: { id: agent.agentId },
        data: {
          status: agent.status,
          hexId: agent.hexId,
        },
      });
    }

    // Update earnings snapshots for each owner
    for (const { ownerId, resources } of ownerResources.values()) {
      const weightedScore = calculateWeightedScore(resources);

      await tx.earningsSnapshot.upsert({
        where: { userId: ownerId },
        create: {
          userId: ownerId,
          weightedScore,
          totalClaimed: 0n,
        },
        update: {
          weightedScore,
        },
      });
    }
  });

  // Update leaderboard in Redis (outside transaction, non-critical)
  const leaderboardUpdates = Array.from(ownerResources.values()).map(({ wallet, resources }) => ({
    wallet,
    score: calculateWeightedScore(resources),
  }));

  if (leaderboardUpdates.length > 0) {
    await updateScoresBatch(leaderboardUpdates);
  }

  console.log(`Flushed ${agents.length} agents to PostgreSQL, updated ${ownerResources.size} earnings snapshots`);

  // Snapshot data changed — invalidate the cached Merkle tree so the next
  // claim request rebuilds against fresh allowances.
  invalidateMerkleTreeCache();
}
