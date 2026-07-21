/**
 * Mining Tick Loop
 * Runs every 5 seconds to process mining, relocation, and broadcast updates
 *
 * From CONTEXT.md:
 * - Tick rate: 5 seconds
 * - Flush interval: 30 seconds (every 6th tick)
 */

import { getIO } from '../lib/socket.js';
import {
  getAllAgents,
  updateAgentsBatch,
  type CachedAgent,
} from '../cache/agentCache.js';
import { calculateMiningYield, addResourcesToAgent } from './mining.js';
import {
  findNearestHexWithResources,
  calculateTravelTime,
  getHexById,
  deductHexResources,
} from './relocation.js';
import { flushToPostgres, loadHotAgentsFromPostgres } from '../cache/persistence.js';
import { getEarningsForUser } from '../services/earningsService.js';
import { getWorldState, getPhaseModifier, type WorldPhase } from './worldClock.js';
import type { AgentUpdate, EarningsUpdateData } from '../events/types.js';

const TICK_INTERVAL = 5000; // 5 seconds
const FLUSH_INTERVAL = 6; // Flush every 6 ticks (30 seconds)

let tickLoopId: NodeJS.Timeout | null = null;
let currentTick = 0;
let isProcessing = false;

/**
 * Process a single tick of the simulation
 */
async function processTick(): Promise<void> {
  if (isProcessing) {
    console.warn('Tick processing overlap detected, skipping tick');
    return;
  }

  isProcessing = true;
  const startTime = Date.now();
  currentTick++;

  try {
    const io = getIO();

    // --- World clock (System 1) -------------------------------------------
    // Pure function of wall-clock time. Broadcast to EVERYONE every tick
    // (public, independent of whether any agents are active) so all clients
    // stay phase-synced. Also drives the per-agent yield modifier below.
    const worldState = getWorldState(startTime);
    const currentPhase: WorldPhase = worldState.phase;
    io.emit('world:update', worldState);

    const agents = await getAllAgents();

    if (agents.length === 0) {
      return; // No agents to process (world:update already broadcast above)
    }
    const updates: Array<{ agentId: string; fields: Record<string, string> }> = [];
    const userUpdates: Map<string, AgentUpdate[]> = new Map();
    const hexDepletions: Array<{ hexId: number; q: number; r: number }> = [];
    const relocations: Array<{
      agentId: string;
      fromHexId: number;
      toHexId: number;
      arrivalTick: number;
    }> = [];
    const arrivals: Array<{ agentId: string; hexId: number; hexQ: number; hexR: number }> = [];

    // Process each agent
    for (const agent of agents) {
      if (agent.status === 'MINING') {
        await processMiningAgent(agent, currentPhase, updates, userUpdates, hexDepletions, relocations);
      } else if (agent.status === 'RELOCATING') {
        await processRelocatingAgent(agent, updates, userUpdates, arrivals);
      }
    }

    // Batch update Redis
    await updateAgentsBatch(updates);

    // Broadcast WebSocket events
    // 1. Mining updates per user
    for (const [wallet, agentUpdates] of userUpdates) {
      io.to(`user:${wallet}`).emit('mining:update', { agents: agentUpdates });
    }

    // 1b. Earnings updates per user (recompute share for owners that changed).
    // Map each updated wallet back to its ownerId so we can compute earnings.
    const walletToOwnerId = new Map<string, string>();
    for (const agent of agents) {
      walletToOwnerId.set(agent.ownerWallet, agent.ownerId);
    }
    for (const wallet of userUpdates.keys()) {
      const ownerId = walletToOwnerId.get(wallet);
      if (!ownerId) continue;
      try {
        const earnings = await getEarningsForUser(ownerId);
        // sharePercent = (userScore / totalPoolScore) * 100
        const sharePercent =
          earnings.totalPoolScore > 0n
            ? (Number(earnings.weightedScore) / Number(earnings.totalPoolScore)) * 100
            : 0;
        const payload: EarningsUpdateData = {
          claimable: earnings.claimableAmount.toString(),
          sharePercent,
          totalPoolScore: earnings.totalPoolScore.toString(),
        };
        io.to(`user:${wallet}`).emit('earnings:update', payload);
      } catch (err) {
        console.error(`Failed to compute earnings update for ${wallet}:`, err);
      }
    }

    // 2. Hex depletion events (broadcast to all)
    for (const depletion of hexDepletions) {
      io.emit('hex:depleted', depletion);
    }

    // 3. Relocation events (to specific users)
    for (const reloc of relocations) {
      const agent = agents.find((a) => a.agentId === reloc.agentId);
      if (agent) {
        io.to(`user:${agent.ownerWallet}`).emit('agent:relocating', reloc);
      }
    }

    // 4. Arrival events (to specific users)
    for (const arrival of arrivals) {
      const agent = agents.find((a) => a.agentId === arrival.agentId);
      if (agent) {
        io.to(`user:${agent.ownerWallet}`).emit('agent:arrived', arrival);
      }
    }

    // Flush to PostgreSQL every FLUSH_INTERVAL ticks
    if (currentTick % FLUSH_INTERVAL === 0) {
      await flushToPostgres();
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 1000) {
      console.warn(`Tick ${currentTick} took ${elapsed}ms (> 1s warning threshold)`);
    }
  } catch (error) {
    console.error('Tick processing error:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Process a mining agent for one tick
 */
async function processMiningAgent(
  agent: CachedAgent,
  currentPhase: WorldPhase,
  updates: Array<{ agentId: string; fields: Record<string, string> }>,
  userUpdates: Map<string, AgentUpdate[]>,
  hexDepletions: Array<{ hexId: number; q: number; r: number }>,
  relocations: Array<{ agentId: string; fromHexId: number; toHexId: number; arrivalTick: number }>
): Promise<void> {
  // Get hex data (carries elevation + isDeep from the terrain sync)
  const hex = await getHexById(agent.hexId);
  if (!hex) {
    console.warn(`Agent ${agent.agentId} has invalid hexId ${agent.hexId}`);
    return;
  }

  // World-clock modifier: golden_hour 1.25x; night deep 1.2x / surface 0.9x;
  // else 1.0x. `isDeep` reaches us via the hex row (see relocation.getHexById).
  const modifier = getPhaseModifier(currentPhase, hex.isDeep);

  // Calculate mining yield (with phase modifier applied)
  const yield_ = calculateMiningYield(hex.resourceType as any, hex.resourceAmount, modifier);

  if (yield_.amount > 0n) {
    // Deduct from hex
    const { depleted } = await deductHexResources(hex.id, yield_.amount);

    // Add to agent
    const newResources = addResourcesToAgent(
      { gold: agent.gold, silver: agent.silver, copper: agent.copper, iron: agent.iron },
      yield_
    );

    // Queue Redis update
    updates.push({
      agentId: agent.agentId,
      fields: {
        gold: newResources.gold,
        silver: newResources.silver,
        copper: newResources.copper,
        iron: newResources.iron,
        lastTick: String(currentTick),
      },
    });

    // Queue user update
    const userUpdate = userUpdates.get(agent.ownerWallet) || [];
    userUpdate.push({
      id: agent.agentId,
      hexId: agent.hexId,
      hexQ: hex.q,
      hexR: hex.r,
      resources: newResources,
      status: 'MINING',
    });
    userUpdates.set(agent.ownerWallet, userUpdate);

    // Handle depletion
    if (depleted) {
      hexDepletions.push({ hexId: hex.id, q: hex.q, r: hex.r });

      // Find new hex
      const newHex = await findNearestHexWithResources({ q: hex.q, r: hex.r }, [hex.id]);

      if (newHex) {
        const travelTime = calculateTravelTime({ q: hex.q, r: hex.r }, { q: newHex.q, r: newHex.r });
        const arrivalTick = currentTick + travelTime;

        // Update agent to relocating
        updates.push({
          agentId: agent.agentId,
          fields: {
            status: 'RELOCATING',
            targetHexId: String(newHex.id),
            targetQ: String(newHex.q),
            targetR: String(newHex.r),
            arrivalTick: String(arrivalTick),
          },
        });

        relocations.push({
          agentId: agent.agentId,
          fromHexId: hex.id,
          toHexId: newHex.id,
          arrivalTick,
        });
      } else {
        console.warn(`No available hexes for agent ${agent.agentId} to relocate to`);
        // Agent goes idle (extremely rare with 1M hexes)
        updates.push({
          agentId: agent.agentId,
          fields: { status: 'IDLE' },
        });
      }
    }
  }
}

/**
 * Process a relocating agent for one tick
 */
async function processRelocatingAgent(
  agent: CachedAgent,
  updates: Array<{ agentId: string; fields: Record<string, string> }>,
  userUpdates: Map<string, AgentUpdate[]>,
  arrivals: Array<{ agentId: string; hexId: number; hexQ: number; hexR: number }>
): Promise<void> {
  if (agent.arrivalTick === undefined || agent.targetHexId === undefined) {
    console.warn(`Relocating agent ${agent.agentId} missing arrival data`);
    return;
  }

  // Check if arrived
  if (currentTick >= agent.arrivalTick) {
    // Agent has arrived
    updates.push({
      agentId: agent.agentId,
      fields: {
        status: 'MINING',
        hexId: String(agent.targetHexId),
        hexQ: String(agent.targetQ),
        hexR: String(agent.targetR),
        // Clear relocation fields
        targetHexId: '',
        targetQ: '',
        targetR: '',
        arrivalTick: '',
      },
    });

    arrivals.push({
      agentId: agent.agentId,
      hexId: agent.targetHexId,
      hexQ: agent.targetQ!,
      hexR: agent.targetR!,
    });

    // Queue user update with new location
    const userUpdate = userUpdates.get(agent.ownerWallet) || [];
    userUpdate.push({
      id: agent.agentId,
      hexId: agent.targetHexId,
      hexQ: agent.targetQ!,
      hexR: agent.targetR!,
      resources: {
        gold: agent.gold,
        silver: agent.silver,
        copper: agent.copper,
        iron: agent.iron,
      },
      status: 'MINING',
    });
    userUpdates.set(agent.ownerWallet, userUpdate);
  } else {
    // Still traveling - send status update
    const userUpdate = userUpdates.get(agent.ownerWallet) || [];
    userUpdate.push({
      id: agent.agentId,
      hexId: agent.hexId,
      hexQ: agent.hexQ,
      hexR: agent.hexR,
      resources: {
        gold: agent.gold,
        silver: agent.silver,
        copper: agent.copper,
        iron: agent.iron,
      },
      status: 'RELOCATING',
    });
    userUpdates.set(agent.ownerWallet, userUpdate);
  }
}

/**
 * Schedule next tick using recursive setTimeout
 * (Prevents drift from setInterval)
 */
function scheduleNextTick(): void {
  tickLoopId = setTimeout(async () => {
    await processTick();
    scheduleNextTick();
  }, TICK_INTERVAL);
}

/**
 * Start the tick loop
 * Loads hot agents from PostgreSQL first
 */
export async function startTickLoop(): Promise<void> {
  console.log('Starting tick loop...');

  // Load hot agents from PostgreSQL
  await loadHotAgentsFromPostgres();

  // Start processing
  console.log(`Tick loop started (interval: ${TICK_INTERVAL}ms)`);
  scheduleNextTick();
}

/**
 * Stop the tick loop
 */
export function stopTickLoop(): void {
  if (tickLoopId) {
    clearTimeout(tickLoopId);
    tickLoopId = null;
    console.log('Tick loop stopped');
  }
}

/**
 * Get current tick number (for debugging/testing)
 */
export function getCurrentTick(): number {
  return currentTick;
}

/**
 * Check if tick loop is running
 */
export function isTickLoopRunning(): boolean {
  return tickLoopId !== null;
}
