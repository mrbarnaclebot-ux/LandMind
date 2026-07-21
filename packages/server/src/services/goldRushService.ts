/**
 * Gold Rush Service — System 4 (community events), Phase D.
 *
 * A shared, community goal on a DETERMINISTIC schedule: a 30-minute "rush" starts
 * at every 4-hour boundary measured from WORLD_EPOCH_MS. During a rush, ALL mining
 * of the rush's resource type (across every player) accrues toward one community
 * target scaled to the number of currently-active mining agents. If the community
 * reaches the target before the rush ends, everyone whose `lastActiveAt` fell
 * within the rush window earns a goldRushBoost (×1.15) until endsAt + 2h.
 *
 * Additive-only (design anti-pattern rule): the rush can only help; missing it
 * costs nothing. The schedule + resource pick are pure functions of the wall clock
 * (deterministic, like the world clock) so every instance agrees and the client
 * can compute the next window. Progress + the boosted-user set are Redis-persisted
 * (same pattern as weather/vein) so a restart mid-rush resumes correctly.
 *
 * The boosted-user set is a Redis hash { userId -> boostUntil }, so the tick loop
 * can join goldRushMod to the yield product WITHOUT a per-tick DB read (one
 * HGETALL per tick, resolved in memory against each agent's owner).
 *
 * TODO(VRF): the resource pick uses a hash of the window index (deterministic, no
 * Math.random). If it ever becomes earnings-affecting RNG, migrate to VRF.
 */

import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import type { ResourceType } from '@prisma/client';
import { WORLD_EPOCH_MS } from '../simulation/worldClock.js';
import { ENGAGEMENT_TABLE } from './engagementConfig.js';
import { hashString } from './contractService.js';

// ---------------------------------------------------------------------------
// Pinned client-facing type (a client agent codes against this — do NOT reshape)
// ---------------------------------------------------------------------------

export interface GoldRushState {
  active: boolean;
  resourceType: ResourceType;
  /** BigInt as string. */
  progress: string;
  /** BigInt as string. */
  target: string;
  /** Epoch ms the rush ends. */
  endsAt: number;
  /** Whether the community reached the target this window. */
  achieved: boolean;
  /** Epoch ms the achieved boost expires (endsAt + boostHours), or null. */
  boostUntil: number | null;
}

// ---------------------------------------------------------------------------
// Schedule + tuning constants
// ---------------------------------------------------------------------------

/** A rush starts at every 4h boundary from WORLD_EPOCH_MS. */
export const RUSH_INTERVAL_MS = 4 * 60 * 60_000; // 4 hours
/** Each rush lasts 30 minutes. */
export const RUSH_DURATION_MS = 30 * 60_000; // 30 minutes
/** The four mineable resource types a rush can target. */
const RUSH_RESOURCES: ResourceType[] = ['GOLD', 'SILVER', 'COPPER', 'IRON'];
/** Community target = this × active mining agents, floored at RUSH_TARGET_MIN. */
export const RUSH_TARGET_PER_AGENT = 200;
export const RUSH_TARGET_MIN = 1000n;
/** Achieved boost multiplier + how long it lasts after endsAt. */
export const GOLD_RUSH_BOOST = ENGAGEMENT_TABLE.goldRushBoost; // 1.15
export const GOLD_RUSH_BOOST_MS = ENGAGEMENT_TABLE.goldRushBoostHours * 60 * 60_000; // 2h

const REDIS_STATE_KEY = 'goldrush:state'; // JSON persisted rush record
const REDIS_BOOST_KEY = 'goldrush:boostedUsers'; // hash userId -> boostUntil(epoch ms)

// ---------------------------------------------------------------------------
// Pure schedule math (deterministic — sanity-checkable)
// ---------------------------------------------------------------------------

/** The 4h window index containing `nowMs` (can be negative before the epoch). */
export function windowIndexFor(nowMs: number): number {
  return Math.floor((nowMs - WORLD_EPOCH_MS) / RUSH_INTERVAL_MS);
}

/** Epoch ms at the START of a given window index (the rush start). */
export function windowStartMs(index: number): number {
  return WORLD_EPOCH_MS + index * RUSH_INTERVAL_MS;
}

/** True if `nowMs` is inside the active 30-min rush of its window. */
export function isRushActive(nowMs: number): boolean {
  const idx = windowIndexFor(nowMs);
  const start = windowStartMs(idx);
  return nowMs >= start && nowMs < start + RUSH_DURATION_MS;
}

/** Deterministic resource pick for a window index (hash-based, no RNG). */
export function pickRushResource(index: number): ResourceType {
  const h = hashString(`goldrush:${index}`);
  return RUSH_RESOURCES[h % RUSH_RESOURCES.length];
}

/** Community target for an active-agent count. */
export function rushTarget(activeAgentCount: number): bigint {
  const scaled = BigInt(RUSH_TARGET_PER_AGENT) * BigInt(Math.max(0, activeAgentCount));
  return scaled > RUSH_TARGET_MIN ? scaled : RUSH_TARGET_MIN;
}

// ---------------------------------------------------------------------------
// Persisted rush record (Redis) — the "current window" the sim is tracking
// ---------------------------------------------------------------------------

interface RushRecord {
  windowIndex: number;
  resourceType: ResourceType;
  target: string; // BigInt as string
  progress: string; // BigInt as string
  startsAt: number;
  endsAt: number;
  achieved: boolean;
  boostUntil: number | null;
}

// Module state — the rush record for the current/most-recent window.
let record: RushRecord | null = null;

/** Rehydrate the rush record from Redis on boot (safe if empty). */
export async function rehydrateGoldRush(): Promise<void> {
  try {
    const raw = await redis.get(REDIS_STATE_KEY);
    record = raw ? (JSON.parse(raw) as RushRecord) : null;
    console.log(record ? `Rehydrated gold rush window ${record.windowIndex}` : 'No gold rush to rehydrate');
  } catch (err) {
    console.error('Failed to rehydrate gold rush, starting empty:', err);
    record = null;
  }
}

async function persistRecord(): Promise<void> {
  try {
    if (record) await redis.set(REDIS_STATE_KEY, JSON.stringify(record));
    else await redis.del(REDIS_STATE_KEY);
  } catch (err) {
    console.error('Failed to persist gold rush record:', err);
  }
}

// ---------------------------------------------------------------------------
// Boosted-user set (Redis) — read by the tick loop with NO DB hit
// ---------------------------------------------------------------------------

/** Grant a gold-rush boost to a set of users until `untilMs`. */
async function grantBoosts(userIds: string[], untilMs: number): Promise<void> {
  if (userIds.length === 0) return;
  const flat: string[] = [];
  for (const id of userIds) {
    flat.push(id, String(untilMs));
  }
  await redis.hset(REDIS_BOOST_KEY, ...flat);
}

/**
 * Load the current gold-rush boost expiry map { userId -> untilMs }. The tick loop
 * calls this ONCE per tick. Expired entries are pruned lazily on read.
 */
export async function loadGoldRushBoosts(
  nowMs: number = Date.now()
): Promise<Map<string, number>> {
  const raw = await redis.hgetall(REDIS_BOOST_KEY);
  const map = new Map<string, number>();
  const stale: string[] = [];
  for (const [userId, untilStr] of Object.entries(raw)) {
    const until = Number(untilStr);
    if (Number.isFinite(until) && until > nowMs) map.set(userId, until);
    else stale.push(userId);
  }
  if (stale.length > 0) await redis.hdel(REDIS_BOOST_KEY, ...stale).catch(() => {});
  return map;
}

/** goldRushMod for a user given the pre-loaded boost map (1.15 while active, else 1.0). */
export function goldRushModFor(
  userId: string,
  boosts: Map<string, number>,
  nowMs: number = Date.now()
): number {
  const until = boosts.get(userId);
  return until !== undefined && until > nowMs ? GOLD_RUSH_BOOST : 1.0;
}

// ---------------------------------------------------------------------------
// Public state (GET /api/world + socket broadcast)
// ---------------------------------------------------------------------------

/**
 * The client-facing gold rush state, or null when no rush is active AND no boost
 * is outstanding. Pure read of module state (the tick loop keeps `record` fresh).
 */
export function getGoldRushState(nowMs: number = Date.now()): GoldRushState | null {
  if (!record) return null;
  const active = nowMs >= record.startsAt && nowMs < record.endsAt;
  const boostLive = record.boostUntil !== null && record.boostUntil > nowMs;
  // Surface while active, or while an achieved boost is still live.
  if (!active && !boostLive) return null;
  return {
    active,
    resourceType: record.resourceType,
    progress: record.progress,
    target: record.target,
    endsAt: record.endsAt,
    achieved: record.achieved,
    boostUntil: record.boostUntil,
  };
}

// ---------------------------------------------------------------------------
// Tick integration
// ---------------------------------------------------------------------------

/** Count of currently-active mining agents (cached agent set). */
async function activeMiningAgentCount(): Promise<number> {
  // Count MINING agents in the DB (cheap COUNT). Used only when a rush opens.
  return prisma.agent.count({ where: { status: 'MINING' } });
}

/**
 * Advance the gold rush sim one tick. Handles:
 *   - opening a fresh rush at a 4h boundary (deterministic resource + target),
 *   - resolving a rush that just ended (grant boosts if achieved),
 *   - keeping `record` in sync with the current window.
 *
 * Returns the current public state (may be null) so the tick loop can broadcast.
 * Progress accrual is a separate call (`accrueGoldRush`) driven by mining.
 */
export async function tickGoldRush(nowMs: number = Date.now()): Promise<GoldRushState | null> {
  const idx = windowIndexFor(nowMs);
  const active = isRushActive(nowMs);

  // Open a new rush when we cross into an active window we're not yet tracking.
  if (active && (!record || record.windowIndex !== idx)) {
    const start = windowStartMs(idx);
    const resourceType = pickRushResource(idx);
    const agentCount = await activeMiningAgentCount();
    const target = rushTarget(agentCount);
    record = {
      windowIndex: idx,
      resourceType,
      target: target.toString(),
      progress: '0',
      startsAt: start,
      endsAt: start + RUSH_DURATION_MS,
      achieved: false,
      boostUntil: null,
    };
    await persistRecord();
    console.log(
      `[goldrush] OPEN window=${idx} type=${resourceType} target=${target} ` +
        `agents=${agentCount} endsAt=${record.endsAt}`
    );
  }

  // Resolve a rush that has ended but hasn't been finalized yet. If it was
  // achieved (target reached during the window), grant the boost to everyone who
  // was active within the window — once (boostUntil stays null until finalized).
  if (record && nowMs >= record.endsAt && record.achieved && record.boostUntil === null) {
    const boostUntil = record.endsAt + GOLD_RUSH_BOOST_MS;
    const winners = await usersActiveInWindow(record.startsAt, record.endsAt);
    await grantBoosts(winners, boostUntil);
    record.boostUntil = boostUntil;
    await persistRecord();
    console.log(
      `[goldrush] ACHIEVED window=${record.windowIndex} winners=${winners.length} ` +
        `boostUntil=${boostUntil}`
    );
  }

  return getGoldRushState(nowMs);
}

/**
 * Users whose lastActiveAt fell within [startMs, endMs]. These are the players who
 * participated in the rush window and earn the achieved boost.
 */
async function usersActiveInWindow(startMs: number, endMs: number): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { lastActiveAt: { gte: new Date(startMs), lte: new Date(endMs) } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Accrue community mining progress toward the active rush. Called from the tick
 * loop with the total amount of the rush's resource mined this tick (across ALL
 * players). Returns whether the target was JUST reached this tick (so the tick
 * loop can log / broadcast the achievement). No-op when no rush is active or the
 * mined resource doesn't match the rush type.
 */
export async function accrueGoldRush(
  resourceType: ResourceType,
  amount: bigint,
  nowMs: number = Date.now()
): Promise<{ justAchieved: boolean }> {
  if (!record || amount <= 0n) return { justAchieved: false };
  if (!isRushActive(nowMs) || record.windowIndex !== windowIndexFor(nowMs)) {
    return { justAchieved: false };
  }
  if (record.resourceType !== resourceType) return { justAchieved: false };
  if (record.achieved) return { justAchieved: false };

  const prev = BigInt(record.progress);
  const target = BigInt(record.target);
  const next = prev + amount;
  record.progress = next.toString();

  const justAchieved = prev < target && next >= target;
  if (justAchieved) {
    record.achieved = true;
    console.log(
      `[goldrush] TARGET REACHED window=${record.windowIndex} progress=${next} target=${target}`
    );
  }
  await persistRecord();
  return { justAchieved };
}

/** The resource type of the active rush, or null when none is active. */
export function activeRushResource(nowMs: number = Date.now()): ResourceType | null {
  if (!record) return null;
  if (!isRushActive(nowMs) || record.windowIndex !== windowIndexFor(nowMs)) return null;
  return record.resourceType;
}
