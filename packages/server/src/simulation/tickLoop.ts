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
import {
  loadActiveContracts,
  loadContractBoosts,
  contractModFor,
  accrueContractProgress,
  flushContractProgress,
  endOfUTCDay,
  CONTRACT_YIELD_BOOST,
  type ActiveContract,
} from '../services/contractService.js';
import {
  tickGoldRush,
  rehydrateGoldRush,
  loadGoldRushBoosts,
  goldRushModFor,
  accrueGoldRush,
  activeRushResource,
  getGoldRushState,
} from '../services/goldRushService.js';
import { prisma } from '../lib/prisma.js';
import type { ResourceType } from '@prisma/client';
import type { AgentUpdate, EarningsUpdateData } from '../events/types.js';

const TICK_INTERVAL = 5000; // 5 seconds
const FLUSH_INTERVAL = 6; // Flush every 6 ticks (30 seconds)
// Phase D: throttle contract:progress socket emits to every Nth tick (30s at 5s
// ticks) — completions are exempt (emitted immediately). Keeps the owner room
// from receiving a progress event on every 5s tick.
const CONTRACT_PROGRESS_EMIT_EVERY = 6;

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

    // --- Gold Rush (System 4) ---------------------------------------------
    // Deterministic 4h-boundary schedule. tickGoldRush opens a fresh rush at a
    // boundary and finalizes (grants boosts) after one ends. Broadcast publicly
    // while a rush is active or an achieved boost is still live so all clients
    // stay synced. Progress accrues from ALL mining below.
    const goldRush = await tickGoldRush(startTime);
    if (goldRush) {
      io.emit('goldrush:update', goldRush);
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
    // Phase D: the SAME single query also loads seasonBonusPct, so the per-owner
    // season bonus joins the yield product WITHOUT any extra per-tick DB hit — it
    // is memoized in `ownerSeasonBonus` for the whole tick (one findMany for the
    // distinct owners in this batch).
    const ownerIds = Array.from(new Set(agents.map((a) => a.ownerId)));
    const ownerActiveAt = new Map<string, number | null>();
    const ownerSeasonBonus = new Map<string, number>();
    if (ownerIds.length > 0) {
      const owners = await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, lastActiveAt: true, seasonBonusPct: true },
      });
      for (const o of owners) {
        ownerActiveAt.set(o.id, o.lastActiveAt ? o.lastActiveAt.getTime() : null);
        ownerSeasonBonus.set(o.id, o.seasonBonusPct ?? 0);
      }
    }

    // Phase D: load the engagement boost maps + today's active contracts ONCE per
    // tick (Redis HGETALL for the boost sets — O(boosted owners), no per-agent DB
    // read; one DB findMany for today's incomplete contracts). The tick loop
    // resolves each agent's contractMod / goldRushMod in memory against these.
    const contractBoosts = await loadContractBoosts(startTime);
    const goldRushBoosts = await loadGoldRushBoosts(startTime);
    const activeContracts = await loadActiveContracts(startTime);
    const rushResource = activeRushResource(startTime);

    // Accumulators for this tick:
    //  - contractProgressByKey: contract completions/progress to emit after the loop.
    //  - rushMinedThisTick: total of the rush resource mined by ALL agents this tick.
    const contractTouched = new Set<string>(); // `${ownerId}:${resourceType}` keys touched
    const contractCompletions: Array<{
      ownerId: string;
      streak: number;
      boostUntil: number;
    }> = [];
    const contractProgressEmits: Array<{
      ownerId: string;
      progress: bigint;
      target: bigint;
    }> = [];
    let rushMinedThisTick = 0n;

    // Process each agent
    for (const agent of agents) {
      if (agent.status === 'MINING') {
        const mined = await processMiningAgent(
          agent,
          currentPhase,
          startTime,
          ownerActiveAt.get(agent.ownerId) ?? null,
          {
            contractMod: contractModFor(agent.ownerId, contractBoosts, startTime),
            goldRushMod: goldRushModFor(agent.ownerId, goldRushBoosts, startTime),
            seasonBonusPct: ownerSeasonBonus.get(agent.ownerId) ?? 0,
          },
          updates,
          userUpdates,
          hexDepletions,
          relocations,
          trapped
        );

        // Phase D: accrue engagement progress from this agent's yield this tick.
        if (mined && mined.amount > 0n) {
          // Gold rush: sum ALL mining of the active rush's resource type.
          if (rushResource && mined.resourceType === rushResource) {
            rushMinedThisTick += mined.amount;
          }
          // Daily contract: if the owner has today's contract for this resource,
          // accrue toward it. Detect first-time completion for the boost + streak.
          const key = `${agent.ownerId}:${mined.resourceType}`;
          const active = activeContracts.get(key);
          if (active) {
            contractTouched.add(key);
            const result = await accrueContractProgress(active, mined.amount, startTime);
            if (result.justCompleted) {
              // Stop further accrual to this contract this tick + drop it from the
              // active map so later agents don't re-accrue a completed contract.
              activeContracts.delete(key);
              contractCompletions.push({
                ownerId: result.ownerId,
                streak: result.newStreak ?? 0,
                boostUntil: result.boostUntil ?? endOfUTCDay(startTime),
              });
            } else {
              contractProgressEmits.push({
                ownerId: result.ownerId,
                progress: result.progress,
                target: result.target,
              });
            }
          }
        }
      } else if (agent.status === 'RELOCATING') {
        await processRelocatingAgent(agent, updates, userUpdates, arrivals);
      } else if (agent.status === 'TRAPPED') {
        // Auto-rescue when the 4-hour self-dig timer has passed. Wear unchanged;
        // resources kept (never confiscatory). Back to MINING.
        await processTrappedAgent(agent, startTime, updates, rescued);
      }
    }

    // Phase D: accrue the tick's total rush-resource mining toward the community
    // goal. If the target was JUST reached, re-broadcast the fresh state so all
    // clients flip to achieved immediately (boosts are granted after endsAt).
    if (rushResource && rushMinedThisTick > 0n) {
      const { justAchieved } = await accrueGoldRush(rushResource, rushMinedThisTick, startTime);
      const freshRush = getGoldRushState(startTime);
      if (freshRush) io.emit('goldrush:update', freshRush);
      if (justAchieved) {
        console.log(`[goldrush] community achieved rush for ${rushResource} this tick`);
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

    // 7. Engagement (System 4) — contract progress + completion, to owner rooms.
    // Map ownerId -> wallet (for the room name) from the agent batch.
    const ownerIdToWallet = new Map<string, string>();
    for (const agent of agents) ownerIdToWallet.set(agent.ownerId, agent.ownerWallet);

    // 7a. Completions ALWAYS emit immediately (streak + boost payload).
    for (const c of contractCompletions) {
      const wallet = ownerIdToWallet.get(c.ownerId);
      if (wallet) {
        io.to(`user:${wallet}`).emit('contract:completed', {
          streak: c.streak,
          reward: { yieldBoost: CONTRACT_YIELD_BOOST, until: c.boostUntil },
        });
      }
    }

    // 7b. Progress is THROTTLED: emit at most once per owner per tick, and only
    // every few ticks (not on every 5s tick) to avoid chatty updates. Dedupe to
    // the LATEST progress value per owner.
    if (currentTick % CONTRACT_PROGRESS_EMIT_EVERY === 0 && contractProgressEmits.length > 0) {
      const latestByOwner = new Map<string, { progress: bigint; target: bigint }>();
      for (const p of contractProgressEmits) {
        latestByOwner.set(p.ownerId, { progress: p.progress, target: p.target });
      }
      for (const [ownerId, p] of latestByOwner) {
        const wallet = ownerIdToWallet.get(ownerId);
        if (wallet) {
          io.to(`user:${wallet}`).emit('contract:progress', {
            progress: p.progress.toString(),
            target: p.target.toString(),
          });
        }
      }
    }

    // Flush to PostgreSQL every FLUSH_INTERVAL ticks
    if (currentTick % FLUSH_INTERVAL === 0) {
      await flushToPostgres();
      // Phase D: flush buffered contract progress for today's touched contracts so
      // a restart resumes from a persisted value (completions already persisted).
      const touchedContracts: ActiveContract[] = [];
      for (const key of contractTouched) {
        const active = activeContracts.get(key);
        if (active) touchedContracts.push(active);
      }
      await flushContractProgress(touchedContracts);
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

/** Phase D per-owner yield context, resolved in memory (no per-tick DB hit). */
interface EngagementContext {
  /** contractMod (1.1 while the owner's contract boost is active, else 1.0). */
  contractMod: number;
  /** goldRushMod (1.15 while the owner's gold-rush boost is active, else 1.0). */
  goldRushMod: number;
  /** Permanent per-season additive bonus; applied as (1 + seasonBonusPct). */
  seasonBonusPct: number;
}

/**
 * Process a mining agent for one tick.
 *
 * Yield product (final form, System 1-4):
 *   base × phaseMod × weatherMod × deepBonus × wearEfficiency × veinMod ×
 *   contractMod × goldRushMod × (1 + seasonBonusPct)
 *
 * Wear accrues one tick per active mine. Deep-hex agents whose owner is active
 * (< 60 min) also roll for a cave-in this tick.
 *
 * @param ownerActiveAtMs owner's lastActiveAt (epoch ms) or null if never seen.
 * @param engagement per-owner contract/goldRush/season multipliers (Phase D).
 * @returns the mined yield this tick (amount 0n if none), so the caller can accrue
 *   contract + gold-rush progress. Returns null if the hex was invalid.
 */
async function processMiningAgent(
  agent: CachedAgent,
  currentPhase: WorldPhase,
  nowMs: number,
  ownerActiveAtMs: number | null,
  engagement: EngagementContext,
  updates: Array<{ agentId: string; fields: Record<string, string> }>,
  userUpdates: Map<string, AgentUpdate[]>,
  hexDepletions: Array<{ hexId: number; q: number; r: number }>,
  relocations: Array<{ agentId: string; fromHexId: number; toHexId: number; arrivalTick: number }>,
  trapped: Array<{ agentId: string; hexId: number; hexQ: number; hexR: number; selfDigAt: number }>
): Promise<{ amount: bigint; resourceType: ResourceType } | null> {
  // Get hex data (carries elevation + isDeep + biome from the terrain sync)
  const hex = await getHexById(agent.hexId);
  if (!hex) {
    console.warn(`Agent ${agent.agentId} has invalid hexId ${agent.hexId}`);
    return null;
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
      return null;
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

  // Engagement modifiers (System 4, Phase D), resolved in memory for this owner:
  //   contractMod  — 1.1 while the daily-contract completion boost is active
  //   goldRushMod  — 1.15 while an achieved gold-rush boost is active
  //   seasonBonus  — applied as (1 + seasonBonusPct), permanent additive
  const contractMod = engagement.contractMod;
  const goldRushMod = engagement.goldRushMod;
  const seasonMod = 1 + engagement.seasonBonusPct;

  // Combined yield multiplier (final form): base × phaseMod × weatherMod ×
  // deepBonus × wearEfficiency × veinMod × contractMod × goldRushMod ×
  // (1 + seasonBonusPct).
  const modifier =
    phaseMod * weatherMod * deepBonus * wearEff * veinMod * contractMod * goldRushMod * seasonMod;

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

    // Report the mined yield so the caller can accrue contract + gold-rush progress.
    return { amount: yield_.amount, resourceType: yield_.resourceType };
  } else {
    // No yield this tick (e.g. hex momentarily empty), but the agent is still
    // actively MINING — persist the accrued wear so it isn't lost.
    updates.push({
      agentId: agent.agentId,
      fields: { wear: String(newWear), lastTick: String(currentTick) },
    });
    return { amount: 0n, resourceType: yield_.resourceType };
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

  // Rehydrate the gold rush window from Redis (System 4) so a restart mid-rush
  // resumes progress + the achieved boost rather than hard-resetting it.
  await rehydrateGoldRush();

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
