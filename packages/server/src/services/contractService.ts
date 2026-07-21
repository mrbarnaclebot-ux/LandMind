/**
 * Contract Service — System 4 (daily contracts), Phase D.
 *
 * A daily per-user contract: "mine N of resource X today". Generated LAZILY on
 * GET /api/contracts, DETERMINISTIC per (userId, dateUTC): the resource type and
 * target are a pure function of a hash of `${userId}:${dateUTC}` and the user's
 * agent count — so two calls the same day (or a regen after a crash) yield the
 * same contract. Progress accrues in the tick loop as the owner's agents mine the
 * matching resource; on reaching the target the contract completes, the user's
 * `contractStreak` increments (NEVER resets — resume model, design System 4), and
 * a contractYieldBoost (×1.1) applies until the end of the UTC day.
 *
 * Progress is accumulated cheaply in a Redis hash (keyed by contract id) and
 * flushed to the Contract DB row on completion or on the periodic flush, mirroring
 * the write-behind pattern used for agents. The active boost (contractMod) is
 * cached per-owner in Redis (a small set with a TTL to end-of-day) so the tick
 * loop can join it to the yield product WITHOUT a per-tick DB read.
 *
 * Anti-pattern rules honoured: additive-only reward, streak never resets, no
 * losses to offline players (progress simply doesn't accrue while idle).
 */

import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import type { ResourceType } from '@prisma/client';
import { ENGAGEMENT_TABLE } from './engagementConfig.js';

// ---------------------------------------------------------------------------
// Pinned client-facing types (a client agent codes against this — do NOT reshape)
// ---------------------------------------------------------------------------

export type ContractResourceType = 'GOLD' | 'SILVER' | 'COPPER' | 'IRON';

export interface ContractReward {
  /** Yield multiplier while the boost is active (always 1.1). */
  yieldBoost: number;
  /** Epoch ms the boost expires (end of the UTC day), or null when not completed. */
  until: number | null;
}

export interface ContractDTO {
  id: string;
  /** UTC calendar day, 'YYYY-MM-DD'. */
  dateUTC: string;
  description: string;
  resourceType: ContractResourceType;
  /** BigInt as string. */
  target: string;
  /** BigInt as string. */
  progress: string;
  completed: boolean;
  reward: ContractReward;
}

export interface ContractResponse {
  contract: ContractDTO;
  streak: number;
}

// ---------------------------------------------------------------------------
// Tuning (mirrored into the published engagementTable)
// ---------------------------------------------------------------------------

/** The four mineable resource types a contract can target (never EMPTY). */
const CONTRACT_RESOURCES: ContractResourceType[] = ['GOLD', 'SILVER', 'COPPER', 'IRON'];

/** Base target (resource units) per agent. Scales with the user's agent count. */
export const CONTRACT_BASE_TARGET = 600;

/** Contract completion boost — joins the yield product while active. */
export const CONTRACT_YIELD_BOOST = ENGAGEMENT_TABLE.contractBoost; // 1.1

const REDIS_PROGRESS_PREFIX = 'contract:progress:'; // + contractId  -> hash { progress }
const REDIS_BOOST_KEY = 'contract:boostedOwners'; // hash ownerId -> boostUntil(epoch ms)

// ---------------------------------------------------------------------------
// Pure helpers (deterministic — sanity-checkable)
// ---------------------------------------------------------------------------

/** UTC calendar day 'YYYY-MM-DD' for an epoch ms. */
export function dateUTCFor(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Epoch ms at the END of the UTC day containing `nowMs` (exclusive next-midnight). */
export function endOfUTCDay(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
}

/**
 * Small, stable string hash (FNV-1a 32-bit). Deterministic across processes so
 * the same (userId, dateUTC) always picks the same contract. Not for security.
 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned 32-bit
}

/** Deterministic resource type for a (userId, dateUTC). */
export function pickContractResource(userId: string, dateUTC: string): ContractResourceType {
  const h = hashString(`${userId}:${dateUTC}`);
  return CONTRACT_RESOURCES[h % CONTRACT_RESOURCES.length];
}

/** Target scaled to the user's agent count: base * max(1, agentCount). */
export function contractTarget(agentCount: number): bigint {
  return BigInt(CONTRACT_BASE_TARGET) * BigInt(Math.max(1, agentCount));
}

/** Human-readable description for the contract. */
export function contractDescription(resourceType: ContractResourceType, target: bigint): string {
  const nice = resourceType.charAt(0) + resourceType.slice(1).toLowerCase();
  return `Mine ${target.toString()} ${nice} today`;
}

// ---------------------------------------------------------------------------
// Redis progress buffer (write-behind, mirrors the agent cache pattern)
// ---------------------------------------------------------------------------

/** Read the buffered progress for a contract from Redis (0 if none). */
async function getBufferedProgress(contractId: string): Promise<bigint> {
  const raw = await redis.hget(`${REDIS_PROGRESS_PREFIX}${contractId}`, 'progress');
  return raw ? BigInt(raw) : 0n;
}

/** Set the buffered progress for a contract in Redis. */
async function setBufferedProgress(contractId: string, progress: bigint): Promise<void> {
  await redis.hset(`${REDIS_PROGRESS_PREFIX}${contractId}`, 'progress', progress.toString());
}

/** Clear the buffered progress for a contract. */
async function clearBufferedProgress(contractId: string): Promise<void> {
  await redis.del(`${REDIS_PROGRESS_PREFIX}${contractId}`);
}

// ---------------------------------------------------------------------------
// Per-owner boost set (Redis) — read by the tick loop with NO DB hit
// ---------------------------------------------------------------------------

/**
 * Mark an owner as contract-boosted until `untilMs`. Stored in a Redis hash so the
 * tick loop can look up the whole boosted set cheaply (one HGETALL per tick,
 * O(boosted owners)) instead of reading a DB row per agent per tick.
 */
async function setOwnerBoost(ownerId: string, untilMs: number): Promise<void> {
  await redis.hset(REDIS_BOOST_KEY, ownerId, String(untilMs));
}

/**
 * Load the current contract-boost expiry map { ownerId -> untilMs }. The tick loop
 * calls this ONCE per tick and resolves each agent's owner in memory. Expired
 * entries are pruned lazily on read.
 */
export async function loadContractBoosts(
  nowMs: number = Date.now()
): Promise<Map<string, number>> {
  const raw = await redis.hgetall(REDIS_BOOST_KEY);
  const map = new Map<string, number>();
  const stale: string[] = [];
  for (const [ownerId, untilStr] of Object.entries(raw)) {
    const until = Number(untilStr);
    if (Number.isFinite(until) && until > nowMs) {
      map.set(ownerId, until);
    } else {
      stale.push(ownerId);
    }
  }
  if (stale.length > 0) {
    await redis.hdel(REDIS_BOOST_KEY, ...stale).catch(() => {});
  }
  return map;
}

/** contractMod for an owner given the pre-loaded boost map (1.1 while active, else 1.0). */
export function contractModFor(
  ownerId: string,
  boosts: Map<string, number>,
  nowMs: number = Date.now()
): number {
  const until = boosts.get(ownerId);
  return until !== undefined && until > nowMs ? CONTRACT_YIELD_BOOST : 1.0;
}

// ---------------------------------------------------------------------------
// Lazy generation (GET /api/contracts)
// ---------------------------------------------------------------------------

interface ContractRow {
  id: string;
  userId: string;
  dateUTC: string;
  resourceType: ResourceType;
  target: bigint;
  progress: bigint;
  completedAt: Date | null;
}

/**
 * Get (generating if absent) today's contract for a user + the user's streak.
 * Deterministic per (userId, dateUTC). Idempotent under the unique(userId,dateUTC)
 * constraint: a race that tries to create twice falls back to the existing row.
 */
export async function getOrCreateTodayContract(
  userId: string,
  nowMs: number = Date.now()
): Promise<ContractResponse> {
  const dateUTC = dateUTCFor(nowMs);

  // Load the user (for the streak) + today's contract (if any) + agent count.
  const [user, existing, agentCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { contractStreak: true } }),
    prisma.contract.findUnique({ where: { userId_dateUTC: { userId, dateUTC } } }),
    prisma.agent.count({ where: { ownerId: userId } }),
  ]);

  let row: ContractRow;
  if (existing) {
    row = existing as ContractRow;
  } else {
    const resourceType = pickContractResource(userId, dateUTC);
    const target = contractTarget(agentCount);
    try {
      row = (await prisma.contract.create({
        data: { userId, dateUTC, resourceType, target, progress: 0n },
      })) as ContractRow;
    } catch {
      // Unique-constraint race: another request created it first — read it back.
      row = (await prisma.contract.findUnique({
        where: { userId_dateUTC: { userId, dateUTC } },
      })) as ContractRow;
    }
  }

  // Prefer the Redis-buffered progress (fresher than the DB row between flushes).
  const buffered = await getBufferedProgress(row.id);
  const progress = buffered > row.progress ? buffered : row.progress;

  const streak = user?.contractStreak ?? 0;
  const completed = row.completedAt !== null;
  const until = completed ? endOfUTCDay(nowMs) : null;

  return {
    contract: toDTO(row, progress, until),
    streak,
  };
}

function toDTO(row: ContractRow, progress: bigint, until: number | null): ContractDTO {
  const resourceType = row.resourceType as ContractResourceType;
  return {
    id: row.id,
    dateUTC: row.dateUTC,
    description: contractDescription(resourceType, row.target),
    resourceType,
    target: row.target.toString(),
    progress: progress.toString(),
    completed: row.completedAt !== null,
    reward: { yieldBoost: CONTRACT_YIELD_BOOST, until },
  };
}

// ---------------------------------------------------------------------------
// Progress accrual (called from the tick loop)
// ---------------------------------------------------------------------------

/**
 * In-memory index of today's contracts, keyed by `${ownerId}:${resourceType}`, so
 * the tick loop can look up "does this owner have a matching contract?" WITHOUT a
 * DB read per mined agent. Refreshed once per tick from the DB (cheap: today's
 * incomplete contracts only). Value carries what the tick loop needs to accrue.
 */
export interface ActiveContract {
  id: string;
  ownerId: string;
  resourceType: ContractResourceType;
  target: bigint;
  dbProgress: bigint;
}

/**
 * Load today's INCOMPLETE contracts, indexed by `${ownerId}:${resourceType}`.
 * Called once per tick by the tick loop. Only incomplete contracts are returned
 * (a completed contract stops accruing). Returns an empty map when there are none.
 */
export async function loadActiveContracts(
  nowMs: number = Date.now()
): Promise<Map<string, ActiveContract>> {
  const dateUTC = dateUTCFor(nowMs);
  const rows = await prisma.contract.findMany({
    where: { dateUTC, completedAt: null },
    select: { id: true, userId: true, resourceType: true, target: true, progress: true },
  });
  const map = new Map<string, ActiveContract>();
  for (const r of rows) {
    map.set(`${r.userId}:${r.resourceType}`, {
      id: r.id,
      ownerId: r.userId,
      resourceType: r.resourceType as ContractResourceType,
      target: r.target,
      dbProgress: r.progress,
    });
  }
  return map;
}

/** Result of accruing progress to a single contract this tick. */
export interface ContractProgressResult {
  contractId: string;
  ownerId: string;
  progress: bigint;
  target: bigint;
  justCompleted: boolean;
  /** end-of-day epoch ms when justCompleted, else null. */
  boostUntil: number | null;
  newStreak: number | null;
}

/**
 * Accrue `amount` resource units toward a contract in the Redis progress buffer,
 * detecting first-time completion. On completion this method: flushes progress to
 * the DB row, stamps completedAt, increments the user's contractStreak, and sets
 * the per-owner boost in Redis (until end of UTC day). Returns the result so the
 * tick loop can emit contract:progress / contract:completed.
 *
 * The buffer is seeded from the DB progress the first time it's touched today, so
 * a restart mid-day resumes from the persisted value rather than double-counting.
 */
export async function accrueContractProgress(
  active: ActiveContract,
  amount: bigint,
  nowMs: number = Date.now()
): Promise<ContractProgressResult> {
  // Seed the buffer from DB progress if it's below it (handles a fresh boot).
  let buffered = await getBufferedProgress(active.id);
  if (buffered < active.dbProgress) buffered = active.dbProgress;

  const next = buffered + amount;
  await setBufferedProgress(active.id, next);

  const wasComplete = buffered >= active.target;
  const nowComplete = next >= active.target;
  const justCompleted = !wasComplete && nowComplete;

  if (!justCompleted) {
    return {
      contractId: active.id,
      ownerId: active.ownerId,
      progress: next,
      target: active.target,
      justCompleted: false,
      boostUntil: null,
      newStreak: null,
    };
  }

  // First-time completion: persist + increment streak + set the owner boost.
  const boostUntil = endOfUTCDay(nowMs);
  let newStreak = 0;
  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: active.id },
        data: { progress: next, completedAt: new Date(nowMs) },
      });
      return tx.user.update({
        where: { id: active.ownerId },
        data: { contractStreak: { increment: 1 } },
        select: { contractStreak: true },
      });
    });
    newStreak = updatedUser.contractStreak;
  } catch (err) {
    console.error(`[contract] failed to persist completion for ${active.id}:`, err);
  }

  await setOwnerBoost(active.ownerId, boostUntil);
  // Progress is now persisted in the DB; the buffer can be cleared.
  await clearBufferedProgress(active.id).catch(() => {});

  console.log(
    `[contract] COMPLETED id=${active.id} owner=${active.ownerId} ` +
      `type=${active.resourceType} target=${active.target} streak=${newStreak} ` +
      `boostUntil=${boostUntil}`
  );

  return {
    contractId: active.id,
    ownerId: active.ownerId,
    progress: next,
    target: active.target,
    justCompleted: true,
    boostUntil,
    newStreak,
  };
}

/**
 * Flush buffered progress for the given contracts to their DB rows (called on the
 * periodic flush). Only writes when the buffer exceeds the row's stored progress.
 * Completed contracts are skipped (they were already persisted on completion).
 */
export async function flushContractProgress(
  actives: Iterable<ActiveContract>
): Promise<void> {
  for (const active of actives) {
    const buffered = await getBufferedProgress(active.id);
    if (buffered > active.dbProgress) {
      await prisma.contract
        .update({ where: { id: active.id }, data: { progress: buffered } })
        .catch((err) => console.error(`[contract] flush failed for ${active.id}:`, err));
    }
  }
}
