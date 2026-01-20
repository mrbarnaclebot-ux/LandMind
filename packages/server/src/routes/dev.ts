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

  res.json({ agent });
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

  res.json({ agents: user.agents });
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
