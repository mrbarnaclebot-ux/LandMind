/**
 * Redis Agent Cache
 * Caches hot agent state (MINING/RELOCATING) for fast tick loop access
 * Uses Redis hashes with string-serialized BigInts
 */

import { redis } from '../lib/redis.js';

export interface CachedAgent {
  agentId: string;
  ownerId: string;
  ownerWallet: string;  // For routing WebSocket updates
  hexId: number;
  hexQ: number;         // Cached for distance calculations
  hexR: number;
  gold: string;         // BigInt as string (JSON/Redis compatible)
  silver: string;
  copper: string;
  iron: string;
  status: 'MINING' | 'RELOCATING' | 'TRAPPED';
  lastTick: number;
  // Phase C (Hazards): equipment wear ∈ [0,1]. Accrues per tick while MINING.
  // Optional at construction (defaults to 0); always present when read back.
  wear?: number;
  // Phase C (Hazards): epoch ms when a trapped agent auto-frees (self-dig).
  // Only set while status === 'TRAPPED'; undefined otherwise.
  selfDigAt?: number;
  // Relocation fields (only when status === 'RELOCATING')
  targetHexId?: number;
  targetQ?: number;
  targetR?: number;
  arrivalTick?: number;
}

const AGENT_KEY_PREFIX = 'agent:';
const AGENT_INDEX_KEY = 'agents:active';

/**
 * Cache an agent's state in Redis
 */
export async function cacheAgent(agent: CachedAgent): Promise<void> {
  const key = `${AGENT_KEY_PREFIX}${agent.agentId}`;

  const data: Record<string, string> = {
    agentId: agent.agentId,
    ownerId: agent.ownerId,
    ownerWallet: agent.ownerWallet,
    hexId: String(agent.hexId),
    hexQ: String(agent.hexQ),
    hexR: String(agent.hexR),
    gold: agent.gold,
    silver: agent.silver,
    copper: agent.copper,
    iron: agent.iron,
    status: agent.status,
    lastTick: String(agent.lastTick),
    wear: String(agent.wear ?? 0),
  };

  // Phase C: self-dig timer (only meaningful while TRAPPED).
  if (agent.selfDigAt !== undefined) {
    data.selfDigAt = String(agent.selfDigAt);
  }

  // Add relocation fields if relocating
  if (agent.targetHexId !== undefined) {
    data.targetHexId = String(agent.targetHexId);
  }
  if (agent.targetQ !== undefined) {
    data.targetQ = String(agent.targetQ);
  }
  if (agent.targetR !== undefined) {
    data.targetR = String(agent.targetR);
  }
  if (agent.arrivalTick !== undefined) {
    data.arrivalTick = String(agent.arrivalTick);
  }

  await redis.hset(key, data);
  // Track in active agents set for getAllAgents
  await redis.sadd(AGENT_INDEX_KEY, agent.agentId);
}

/**
 * Get a single agent from cache
 */
export async function getAgent(agentId: string): Promise<CachedAgent | null> {
  const key = `${AGENT_KEY_PREFIX}${agentId}`;
  const data = await redis.hgetall(key);

  if (!data || !data.agentId) return null;

  return {
    agentId: data.agentId,
    ownerId: data.ownerId,
    ownerWallet: data.ownerWallet,
    hexId: parseInt(data.hexId, 10),
    hexQ: parseInt(data.hexQ, 10),
    hexR: parseInt(data.hexR, 10),
    gold: data.gold,
    silver: data.silver,
    copper: data.copper,
    iron: data.iron,
    status: data.status as 'MINING' | 'RELOCATING' | 'TRAPPED',
    lastTick: parseInt(data.lastTick, 10),
    wear: data.wear ? parseFloat(data.wear) : 0,
    selfDigAt: data.selfDigAt ? parseInt(data.selfDigAt, 10) : undefined,
    targetHexId: data.targetHexId ? parseInt(data.targetHexId, 10) : undefined,
    targetQ: data.targetQ ? parseInt(data.targetQ, 10) : undefined,
    targetR: data.targetR ? parseInt(data.targetR, 10) : undefined,
    arrivalTick: data.arrivalTick ? parseInt(data.arrivalTick, 10) : undefined,
  };
}

/**
 * Get all active (cached) agents
 */
export async function getAllAgents(): Promise<CachedAgent[]> {
  const agentIds = await redis.smembers(AGENT_INDEX_KEY);
  if (agentIds.length === 0) return [];

  const agents: CachedAgent[] = [];

  // Use pipeline for efficiency
  const pipeline = redis.pipeline();
  for (const id of agentIds) {
    pipeline.hgetall(`${AGENT_KEY_PREFIX}${id}`);
  }

  const results = await pipeline.exec();
  if (!results) return [];

  for (const [err, data] of results) {
    if (err || !data || typeof data !== 'object') continue;
    const d = data as Record<string, string>;
    if (!d.agentId) continue;

    agents.push({
      agentId: d.agentId,
      ownerId: d.ownerId,
      ownerWallet: d.ownerWallet,
      hexId: parseInt(d.hexId, 10),
      hexQ: parseInt(d.hexQ, 10),
      hexR: parseInt(d.hexR, 10),
      gold: d.gold,
      silver: d.silver,
      copper: d.copper,
      iron: d.iron,
      status: d.status as 'MINING' | 'RELOCATING' | 'TRAPPED',
      lastTick: parseInt(d.lastTick, 10),
      wear: d.wear ? parseFloat(d.wear) : 0,
      selfDigAt: d.selfDigAt ? parseInt(d.selfDigAt, 10) : undefined,
      targetHexId: d.targetHexId ? parseInt(d.targetHexId, 10) : undefined,
      targetQ: d.targetQ ? parseInt(d.targetQ, 10) : undefined,
      targetR: d.targetR ? parseInt(d.targetR, 10) : undefined,
      arrivalTick: d.arrivalTick ? parseInt(d.arrivalTick, 10) : undefined,
    });
  }

  return agents;
}

/**
 * Remove an agent from cache (when it goes IDLE)
 */
export async function removeAgent(agentId: string): Promise<void> {
  await redis.del(`${AGENT_KEY_PREFIX}${agentId}`);
  await redis.srem(AGENT_INDEX_KEY, agentId);
}

/**
 * Update specific fields of a cached agent (for tick updates)
 */
export async function updateAgentFields(
  agentId: string,
  fields: Partial<Record<string, string>>
): Promise<void> {
  const key = `${AGENT_KEY_PREFIX}${agentId}`;
  if (Object.keys(fields).length > 0) {
    await redis.hset(key, fields);
  }
}

/**
 * Batch update multiple agents (efficient for tick processing)
 */
export async function updateAgentsBatch(
  updates: Array<{ agentId: string; fields: Record<string, string> }>
): Promise<void> {
  if (updates.length === 0) return;

  const pipeline = redis.pipeline();
  for (const { agentId, fields } of updates) {
    pipeline.hset(`${AGENT_KEY_PREFIX}${agentId}`, fields);
  }
  await pipeline.exec();
}

/**
 * Clear all cached agents (for testing/reset)
 */
export async function clearAgentCache(): Promise<void> {
  const agentIds = await redis.smembers(AGENT_INDEX_KEY);
  if (agentIds.length === 0) return;

  const pipeline = redis.pipeline();
  for (const id of agentIds) {
    pipeline.del(`${AGENT_KEY_PREFIX}${id}`);
  }
  pipeline.del(AGENT_INDEX_KEY);
  await pipeline.exec();
}
