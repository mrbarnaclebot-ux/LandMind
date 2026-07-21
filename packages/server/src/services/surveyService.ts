/**
 * Survey Service — System 4 (Prospecting), Phase D.
 *
 * A Survey reveals a hex's hidden richness/affinity before deploying. Durable
 * knowledge: once surveyed, the (user, q, r) unlock is permanent (design System 4
 * — "durable knowledge, deterministic per hex, never pay-to-see"). Gated by a
 * per-user 5-minute cooldown (Redis key with TTL).
 *
 * The snapshot the client sees always reflects CURRENT hex data (resourceAmount,
 * agentCount) — we store only the unlock, and JOIN the live hex row at read time.
 */

import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import type { Biome, ResourceType } from '@prisma/client';
import { ENGAGEMENT_TABLE } from './engagementConfig.js';

// ---------------------------------------------------------------------------
// Pinned client-facing hex snapshot (a client agent codes against this shape)
// ---------------------------------------------------------------------------

export interface HexSnapshot {
  q: number;
  r: number;
  biome: Biome;
  isDeep: boolean;
  elevation: number;
  resourceType: ResourceType;
  /** BigInt as string. */
  resourceAmount: string;
  agentCount: number;
}

/** Per-user survey cooldown (5 min). */
export const SURVEY_COOLDOWN_MS = ENGAGEMENT_TABLE.surveyCooldownMin * 60_000;

const REDIS_COOLDOWN_PREFIX = 'survey:cooldown:'; // + userId (TTL key)

// ---------------------------------------------------------------------------
// Cooldown (Redis, per-user, TTL-backed)
// ---------------------------------------------------------------------------

/**
 * Check the survey cooldown for a user. Returns remaining ms (>0) if on cooldown,
 * or 0 if the user may survey now.
 */
export async function surveyCooldownRemaining(userId: string): Promise<number> {
  const ttl = await redis.pttl(`${REDIS_COOLDOWN_PREFIX}${userId}`);
  // pttl: -2 = no key, -1 = no expire. Treat both as "not on cooldown".
  return ttl > 0 ? ttl : 0;
}

/** Arm the survey cooldown for a user (5-min TTL). */
export async function armSurveyCooldown(userId: string): Promise<void> {
  await redis.set(`${REDIS_COOLDOWN_PREFIX}${userId}`, '1', 'PX', SURVEY_COOLDOWN_MS);
}

// ---------------------------------------------------------------------------
// Snapshot assembly
// ---------------------------------------------------------------------------

/**
 * Build the current snapshot for a hex at (q,r), or null if the hex doesn't exist.
 * agentCount is the live count of agents currently on the hex.
 */
export async function hexSnapshot(q: number, r: number): Promise<HexSnapshot | null> {
  const hex = await prisma.hex.findUnique({
    where: { q_r: { q, r } },
    select: {
      id: true,
      q: true,
      r: true,
      biome: true,
      isDeep: true,
      elevation: true,
      resourceType: true,
      resourceAmount: true,
    },
  });
  if (!hex) return null;

  const agentCount = await prisma.agent.count({ where: { hexId: hex.id } });

  return {
    q: hex.q,
    r: hex.r,
    biome: hex.biome,
    isDeep: hex.isDeep,
    elevation: hex.elevation,
    resourceType: hex.resourceType,
    resourceAmount: hex.resourceAmount.toString(),
    agentCount,
  };
}

/**
 * Persist (idempotently) a survey unlock for (user, q, r). Safe under the unique
 * constraint — a re-survey of the same hex is a no-op create.
 */
export async function recordSurvey(userId: string, q: number, r: number): Promise<void> {
  await prisma.survey
    .create({ data: { userId, q, r } })
    .catch(() => {
      /* unique(userId,q,r) — already surveyed, ignore */
    });
}

/**
 * All of a user's surveyed hexes with CURRENT data (join the live hex rows). Rows
 * whose hex no longer exists are skipped. Ordered by most-recently surveyed first.
 */
export async function getUserSurveys(userId: string): Promise<HexSnapshot[]> {
  const surveys = await prisma.survey.findMany({
    where: { userId },
    orderBy: { surveyedAt: 'desc' },
    select: { q: true, r: true },
  });
  if (surveys.length === 0) return [];

  // Batch-load the hex rows for the surveyed coordinates.
  const hexes = await prisma.hex.findMany({
    where: { OR: surveys.map((s) => ({ q: s.q, r: s.r })) },
    select: {
      id: true,
      q: true,
      r: true,
      biome: true,
      isDeep: true,
      elevation: true,
      resourceType: true,
      resourceAmount: true,
    },
  });
  const hexByKey = new Map(hexes.map((h) => [`${h.q},${h.r}`, h]));

  // Live agent counts per surveyed hex (one grouped query).
  const hexIds = hexes.map((h) => h.id);
  const counts =
    hexIds.length > 0
      ? await prisma.agent.groupBy({
          by: ['hexId'],
          where: { hexId: { in: hexIds } },
          _count: { _all: true },
        })
      : [];
  const countByHexId = new Map(counts.map((c) => [c.hexId, c._count._all]));

  const out: HexSnapshot[] = [];
  for (const s of surveys) {
    const hex = hexByKey.get(`${s.q},${s.r}`);
    if (!hex) continue; // hex vanished (shouldn't happen); skip
    out.push({
      q: hex.q,
      r: hex.r,
      biome: hex.biome,
      isDeep: hex.isDeep,
      elevation: hex.elevation,
      resourceType: hex.resourceType,
      resourceAmount: hex.resourceAmount.toString(),
      agentCount: countByHexId.get(hex.id) ?? 0,
    });
  }
  return out;
}
