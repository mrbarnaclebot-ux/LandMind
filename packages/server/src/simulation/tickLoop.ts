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
import { tickWeather, getWeatherModifierAt, getFrontAt, rehydrateWeather } from './weatherService.js';
import { tickVeins, getVeinModifierAt, rehydrateVeins } from './veinService.js';
import {
  caveInChancePerTick,
  wearEfficiency,
  accrueWear,
  HAZARD_TABLE,
  SELF_DIG_MS,
  OFFLINE_GRACE_MS,
} from './hazardService.js';
import { prisma } from '../lib/prisma.js';
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

    // --- Weather fronts (System 2) ----------------------------------------
    // Advance the drifting fronts (despawn/spawn/reposition), persist to Redis,
    // and broadcast publicly every tick so clients can telegraph incoming
    // fronts. Runs independently of whether any agents are active. The
    // per-agent weather modifier below reads the same active-front set.
    const activeFronts = await tickWeather(startTime);
    io.emit('weather:update', { fronts: activeFronts });

    // --- Rich veins (System 3) --------------------------------------------
    // Advance the single-active-vein sim (spawn/expire), persist to Redis, and
    // broadcast the land-rush ping to ALL sockets. Runs independently of agents.
    // The per-agent vein modifier below reads the same active vein.
    const veinResult = await tickVeins(startTime);
    if (veinResult.changed === 'spawned') {
      io.emit('vein:spawned', {
        hexId: veinResult.vein.hexId,
        q: veinResult.vein.q,
        r: veinResult.vein.r,
        resourceType: veinResult.vein.resourceType,
        multiplier: veinResult.vein.multiplier,
        expiresAt: veinResult.vein.expiresAt,
      });
    } else if (veinResult.changed === 'expired') {
      io.emit('vein:expired', { hexId: veinResult.hexId });
    }

    const agents = await getAllAgents();

    if (agents.length === 0) {
      return; // No agents to process (world:update + weather:update already broadcast above)
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
    // Phase C (Hazards): cave-in trap + auto-rescue events, routed to owner rooms.
    const trapped: Array<{
      agentId: string;
      hexId: number;
      hexQ: number;
      hexR: number;
      selfDigAt: number;
    }> = [];
    const rescued: Array<{ agentId: string }> = [];

    // Phase C: load each owner's lastActiveAt once per tick for the offline-grace
    // rule (cave-ins only fire on agents whose owner was active within 60 min).
    // One query for the distinct owners in this batch — cheap and avoids N reads.
    const ownerIds = Array.from(new Set(agents.map((a) => a.ownerId)));
    const ownerActiveAt = new Map<string, number | null>();
    if (ownerIds.length > 0) {
      const owners = await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, lastActiveAt: true },
      });
      for (const o of owners) {
        ownerActiveAt.set(o.id, o.lastActiveAt ? o.lastActiveAt.getTime() : null);
      }
    }

    // Process each agent
    for (const agent of agents) {
      if (agent.status === 'MINING') {
        await processMiningAgent(
          agent,
          currentPhase,
          startTime,
          ownerActiveAt.get(agent.ownerId) ?? null,
          updates,
          userUpdates,
          hexDepletions,
          relocations,
          trapped
        );
      } else if (agent.status === 'RELOCATING') {
        await processRelocatingAgent(agent, updates, userUpdates, arrivals);
      } else if (agent.status === 'TRAPPED') {
        // Auto-rescue when the 4-hour self-dig timer has passed. Wear unchanged;
        // resources kept (never confiscatory). Back to MINING.
        await processTrappedAgent(agent, startTime, updates, rescued);
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

    // 5. Cave-in trap events (System 3) — to the owner's room.
    for (const t of trapped) {
      const agent = agents.find((a) => a.agentId === t.agentId);
      if (agent) {
        io.to(`user:${agent.ownerWallet}`).emit('agent:trapped', t);
      }
    }

    // 6. Auto-rescue events (System 3) — to the owner's room.
    for (const r of rescued) {
      const agent = agents.find((a) => a.agentId === r.agentId);
      if (agent) {
        io.to(`user:${agent.ownerWallet}`).emit('agent:rescued', r);
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
 * Process a mining agent for one tick.
 *
 * Yield product (System 3): base × phaseMod × weatherMod × deepBonus ×
 * wearEfficiency × veinMod. Wear accrues one tick per active mine. Deep-hex
 * agents whose owner is active (< 60 min) also roll for a cave-in this tick.
 *
 * @param ownerActiveAtMs owner's lastActiveAt (epoch ms) or null if never seen.
 */
async function processMiningAgent(
  agent: CachedAgent,
  currentPhase: WorldPhase,
  nowMs: number,
  ownerActiveAtMs: number | null,
  updates: Array<{ agentId: string; fields: Record<string, string> }>,
  userUpdates: Map<string, AgentUpdate[]>,
  hexDepletions: Array<{ hexId: number; q: number; r: number }>,
  relocations: Array<{ agentId: string; fromHexId: number; toHexId: number; arrivalTick: number }>,
  trapped: Array<{ agentId: string; hexId: number; hexQ: number; hexR: number; selfDigAt: number }>
): Promise<void> {
  // Get hex data (carries elevation + isDeep + biome from the terrain sync)
  const hex = await getHexById(agent.hexId);
  if (!hex) {
    console.warn(`Agent ${agent.agentId} has invalid hexId ${agent.hexId}`);
    return;
  }

  // --- Cave-in roll (System 3) ------------------------------------------------
  // Only on deep hexes, and only when the owner is within the offline-grace
  // window (active < 60 min). Absent players' agents never cave in — their yield
  // simply stays at the safe baseline (design anti-pattern rule 1). Ember front
  // over the hex multiplies the per-hour chance ×3.
  const ownerActive =
    ownerActiveAtMs !== null && nowMs - ownerActiveAtMs <= OFFLINE_GRACE_MS;
  if (hex.isDeep && ownerActive) {
    const ember = getFrontAt(hex.q, hex.r, hex.biome, nowMs)?.front.type === 'ember';
    const pCaveIn = caveInChancePerTick(ember);
    const roll = Math.random();
    if (roll < pCaveIn) {
      // TRAP the agent: stop mining, set the 4-hour self-dig timer. Persist to
      // DB directly (trappedAt/selfDigAt/status) so a restart restores it; also
      // update the Redis cache so the tick loop stops mining it immediately.
      const selfDigAt = nowMs + SELF_DIG_MS;
      // TODO(VRF): Math.random cave-in roll — migrate to verifiable VRF on-chain.
      console.log(
        `[cave-in] TRAPPED agent=${agent.agentId} hex=${hex.id} ` +
          `(q=${hex.q},r=${hex.r}) deep=true ember=${ember} ` +
          `roll=${roll.toFixed(8)} p=${pCaveIn.toExponential(3)} selfDigAt=${selfDigAt}`
      );

      updates.push({
        agentId: agent.agentId,
        fields: {
          status: 'TRAPPED',
          selfDigAt: String(selfDigAt),
          // Clear any in-flight relocation fields (shouldn't be set while MINING).
          targetHexId: '',
          targetQ: '',
          targetR: '',
          arrivalTick: '',
        },
      });

      // Persist trapped state to DB immediately (don't wait for the 30s flush) so
      // a restart within that window doesn't resurrect a mining agent.
      await prisma.agent
        .update({
          where: { id: agent.agentId },
          data: {
            status: 'TRAPPED',
            trappedAt: new Date(nowMs),
            selfDigAt: new Date(selfDigAt),
          },
        })
        .catch((err) => console.error(`Failed to persist trap for ${agent.agentId}:`, err));

      trapped.push({
        agentId: agent.agentId,
        hexId: hex.id,
        hexQ: hex.q,
        hexR: hex.r,
        selfDigAt,
      });

      // Trapped agents skip mining entirely this tick (and until freed).
      return;
    }
  }

  // World-clock modifier: golden_hour 1.25x; night deep 1.2x / surface 0.9x;
  // else 1.0x. `isDeep` reaches us via the hex row (see relocation.getHexById).
  const phaseMod = getPhaseModifier(currentPhase, hex.isDeep);

  // Weather modifier (System 2): getFrontAt(hex) × published weatherTable × biome.
  // O(fronts) per agent (≤3 fronts). 1.0 when no front covers this hex.
  const weatherMod = getWeatherModifierAt(hex.q, hex.r, hex.biome, nowMs);

  // Deep-deploy standing bonus (System 3): +25% on pit/cave-adjacent hexes.
  const deepBonus = hex.isDeep ? HAZARD_TABLE.caveIn.deepYieldBonus : 1.0;

  // Wear efficiency (System 3): 1 - 0.3*wear, floored at 0.7.
  const currentWear = agent.wear ?? 0;
  const wearEff = wearEfficiency(currentWear);

  // Rich-vein modifier (System 3): ×3 when the active vein covers this hex.
  const veinMod = getVeinModifierAt(hex.q, hex.r, nowMs);

  // Combined yield multiplier: base × phaseMod × weatherMod × deepBonus ×
  // wearEfficiency × veinMod.
  const modifier = phaseMod * weatherMod * deepBonus * wearEff * veinMod;

  // Accrue one tick of equipment wear (only while actively mining — never idle).
  const newWear = accrueWear(currentWear);

  // Calculate mining yield (with combined modifier applied)
  const yield_ = calculateMiningYield(hex.resourceType as any, hex.resourceAmount, modifier);

  if (yield_.amount > 0n) {
    // Deduct from hex
    const { depleted } = await deductHexResources(hex.id, yield_.amount);

    // Add to agent
    const newResources = addResourcesToAgent(
      { gold: agent.gold, silver: agent.silver, copper: agent.copper, iron: agent.iron },
      yield_
    );

    // Queue Redis update (wear accrues one tick per active mine).
    updates.push({
      agentId: agent.agentId,
      fields: {
        gold: newResources.gold,
        silver: newResources.silver,
        copper: newResources.copper,
        iron: newResources.iron,
        wear: String(newWear),
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
  } else {
    // No yield this tick (e.g. hex momentarily empty), but the agent is still
    // actively MINING — persist the accrued wear so it isn't lost.
    updates.push({
      agentId: agent.agentId,
      fields: { wear: String(newWear), lastTick: String(currentTick) },
    });
  }
}

/**
 * Process a TRAPPED agent for one tick (System 3).
 *
 * Auto-rescue when the 4-hour self-dig timer has passed: status back to MINING,
 * clear trappedAt/selfDigAt, wear unchanged, resources kept (never confiscatory).
 * Persists the freed state to DB immediately so a restart doesn't re-trap it.
 */
async function processTrappedAgent(
  agent: CachedAgent,
  nowMs: number,
  updates: Array<{ agentId: string; fields: Record<string, string> }>,
  rescued: Array<{ agentId: string }>
): Promise<void> {
  // Not yet time to self-dig — stay trapped, skip mining entirely.
  if (agent.selfDigAt === undefined || nowMs < agent.selfDigAt) {
    return;
  }

  console.log(
    `[cave-in] SELF-DIG agent=${agent.agentId} freed at ${nowMs} (selfDigAt=${agent.selfDigAt})`
  );

  // Cache: back to MINING, clear the self-dig timer.
  updates.push({
    agentId: agent.agentId,
    fields: {
      status: 'MINING',
      selfDigAt: '',
    },
  });

  // DB: clear trapped state immediately (don't wait for the 30s flush).
  await prisma.agent
    .update({
      where: { id: agent.agentId },
      data: { status: 'MINING', trappedAt: null, selfDigAt: null },
    })
    .catch((err) => console.error(`Failed to persist self-dig for ${agent.agentId}:`, err));

  rescued.push({ agentId: agent.agentId });
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

  // Rehydrate weather fronts from Redis so a restart doesn't hard-reset weather.
  await rehydrateWeather();

  // Rehydrate the active rich vein from Redis (System 3) so a restart preserves it.
  await rehydrateVeins();

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
