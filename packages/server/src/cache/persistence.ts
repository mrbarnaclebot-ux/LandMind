/**
 * Write-Behind Persistence
 * Syncs Redis cache state to PostgreSQL periodically
 */

import { prisma } from '../lib/prisma.js';
import { getAllAgents, cacheAgent, type CachedAgent } from './agentCache.js';

/**
 * Load all MINING/RELOCATING agents from PostgreSQL into Redis cache
 * Called on server startup to restore hot state
 */
export async function loadHotAgentsFromPostgres(): Promise<number> {
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
}

/**
 * Flush all cached agent state to PostgreSQL
 * Called periodically (every 30s) and on shutdown
 */
export async function flushToPostgres(): Promise<void> {
  const agents = await getAllAgents();

  if (agents.length === 0) {
    console.log('No agents to flush');
    return;
  }

  console.log(`Flushing ${agents.length} agents to PostgreSQL...`);

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
  });

  console.log(`Flushed ${agents.length} agents to PostgreSQL`);
}

/**
 * Calculate missed ticks since last update (for crash recovery)
 * Capped at 10 ticks (50 seconds) to prevent long startup
 */
export function calculateMissedTicks(lastUpdate: Date, tickInterval: number): number {
  const elapsed = Date.now() - lastUpdate.getTime();
  const missedTicks = Math.floor(elapsed / tickInterval);
  return Math.min(missedTicks, 10); // Cap at 10 ticks
}
