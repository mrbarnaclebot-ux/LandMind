/**
 * Development-Only Routes
 * Provides endpoints for testing the mining simulation
 * Disabled in production via NODE_ENV check
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { cacheAgent, getAllAgents, clearAgentCache } from '../cache/agentCache.js';
import { getCurrentTick } from '../simulation/tickLoop.js';

const devRouter = Router();

/**
 * Helper to serialize BigInt values to strings for JSON response
 */
function serializeBigInts<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

// Guard: Only allow in development
devRouter.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

/**
 * POST /dev/users
 * Create a test user with a wallet pubkey
 */
devRouter.post('/users', async (req: Request, res: Response) => {
  const { walletPubkey } = req.body;

  if (!walletPubkey) {
    return res.status(400).json({ error: 'walletPubkey required' });
  }

  const user = await prisma.user.upsert({
    where: { walletPubkey },
    create: { walletPubkey },
    update: {},
  });

  res.json({ user });
});

/**
 * POST /dev/hexes/seed
 * Seed hexes in a grid pattern for testing
 */
devRouter.post('/hexes/seed', async (req: Request, res: Response) => {
  const { radius = 10 } = req.body;
  const resourceTypes = ['GOLD', 'SILVER', 'COPPER', 'IRON'] as const;

  // Delete existing hexes
  await prisma.hex.deleteMany({});

  // Create hexes in a hex-shaped region
  const hexes: Array<{
    q: number;
    r: number;
    resourceType: typeof resourceTypes[number];
    resourceAmount: bigint;
  }> = [];

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      // Assign resource type based on position for variety
      const typeIndex = Math.abs((q * 7 + r * 13) % 4);
      hexes.push({
        q,
        r,
        resourceType: resourceTypes[typeIndex],
        resourceAmount: BigInt(1000000), // 1M resources per hex
      });
    }
  }

  await prisma.hex.createMany({ data: hexes });

  res.json({ created: hexes.length, radius });
});

/**
 * POST /dev/agents
 * Create a test agent for a user and start mining
 */
devRouter.post('/agents', async (req: Request, res: Response) => {
  const { walletPubkey, hexQ = 0, hexR = 0 } = req.body;

  if (!walletPubkey) {
    return res.status(400).json({ error: 'walletPubkey required' });
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { walletPubkey },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found. Create user first.' });
  }

  // Find hex
  const hex = await prisma.hex.findUnique({
    where: { q_r: { q: hexQ, r: hexR } },
  });

  if (!hex) {
    return res.status(404).json({ error: `Hex (${hexQ}, ${hexR}) not found. Seed hexes first.` });
  }

  // Create agent with mining state
  const agent = await prisma.agent.create({
    data: {
      ownerId: user.id,
      hexId: hex.id,
      status: 'MINING',
      miningState: {
        create: {
          gold: 0,
          silver: 0,
          copper: 0,
          iron: 0,
        },
      },
    },
    include: {
      hex: true,
      miningState: true,
    },
  });

  // Add to Redis cache for tick loop
  await cacheAgent({
    agentId: agent.id,
    ownerId: user.id,
    ownerWallet: walletPubkey,
    hexId: hex.id,
    hexQ: hex.q,
    hexR: hex.r,
    gold: '0',
    silver: '0',
    copper: '0',
    iron: '0',
    status: 'MINING',
    lastTick: getCurrentTick(),
  });

  res.json({ agent: serializeBigInts(agent) });
});

/**
 * GET /dev/agents
 * Get all cached agents (from Redis)
 */
devRouter.get('/agents', async (req: Request, res: Response) => {
  const agents = await getAllAgents();
  res.json({ agents, currentTick: getCurrentTick() });
});

/**
 * GET /dev/agents/:walletPubkey
 * Get agents for a specific user
 */
devRouter.get('/agents/:walletPubkey', async (req: Request, res: Response) => {
  const walletPubkey = req.params.walletPubkey as string;

  const user = await prisma.user.findUnique({
    where: { walletPubkey },
    include: {
      agents: {
        include: {
          hex: true,
          miningState: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ agents: serializeBigInts(user.agents) });
});

/**
 * DELETE /dev/reset
 * Reset all test data (dangerous!)
 */
devRouter.delete('/reset', async (req: Request, res: Response) => {
  // Clear Redis cache
  await clearAgentCache();

  // Clear database in order (respecting foreign keys)
  await prisma.miningState.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.hex.deleteMany({});
  await prisma.user.deleteMany({});

  res.json({ message: 'All data cleared' });
});

/**
 * POST /dev/agents/fix-orphans
 * Fix agents without hex assignments by placing them on available hexes
 */
devRouter.post('/agents/fix-orphans', async (req: Request, res: Response) => {
  // Find all agents without a hex
  const orphanAgents = await prisma.agent.findMany({
    where: { hexId: null },
    include: { owner: true },
  });

  if (orphanAgents.length === 0) {
    return res.json({ message: 'No orphan agents found', fixed: 0 });
  }

  // Find available hexes
  const availableHexes = await prisma.hex.findMany({
    where: {
      resourceAmount: { gt: 0 },
      resourceType: { not: 'EMPTY' },
    },
  });

  if (availableHexes.length === 0) {
    return res.status(400).json({ error: 'No available hexes. Run seed first.' });
  }

  const fixed: string[] = [];

  for (const agent of orphanAgents) {
    // Pick a random hex
    const randomIndex = Math.floor(Math.random() * availableHexes.length);
    const selectedHex = availableHexes[randomIndex];

    // Update agent with hex
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        hexId: selectedHex.id,
        status: 'MINING',
      },
    });

    // Ensure mining state exists
    await prisma.miningState.upsert({
      where: { agentId: agent.id },
      create: {
        agentId: agent.id,
        gold: 0n,
        silver: 0n,
        copper: 0n,
        iron: 0n,
      },
      update: {},
    });

    // Add to Redis cache for tick loop
    await cacheAgent({
      agentId: agent.id,
      ownerId: agent.ownerId,
      ownerWallet: agent.owner.walletPubkey,
      hexId: selectedHex.id,
      hexQ: selectedHex.q,
      hexR: selectedHex.r,
      gold: '0',
      silver: '0',
      copper: '0',
      iron: '0',
      status: 'MINING',
      lastTick: getCurrentTick(),
    });

    fixed.push(agent.id);
  }

  res.json({ message: `Fixed ${fixed.length} orphan agents`, agentIds: fixed });
});

/**
 * GET /dev/status
 * Get simulation status
 */
devRouter.get('/status', async (req: Request, res: Response) => {
  const agents = await getAllAgents();
  const hexCount = await prisma.hex.count();
  const userCount = await prisma.user.count();

  res.json({
    currentTick: getCurrentTick(),
    cachedAgents: agents.length,
    hexCount,
    userCount,
    environment: process.env.NODE_ENV || 'development',
  });
});

export default devRouter;
