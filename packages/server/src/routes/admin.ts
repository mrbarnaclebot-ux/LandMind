import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { gatherMetrics } from '../services/metricsService.js';
import { prisma } from '../lib/prisma.js';
import {
  getEconomyConfig,
  updateEconomyConfig,
} from '../services/economyService.js';

export const adminRouter = Router();

// All admin routes require auth + admin role
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

// GET /admin/metrics - Get platform metrics
adminRouter.get('/metrics', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const metrics = await gatherMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to gather metrics' });
  }
});

// GET /admin/users - List users with pagination
adminRouter.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const where = search
      ? { walletPubkey: { contains: search } }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { agents: true, claims: true } },
          earningsSnapshot: {
            select: { weightedScore: true, totalClaimed: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map(u => ({
        id: u.id,
        walletPubkey: u.walletPubkey,
        role: u.role,
        createdAt: u.createdAt,
        agentCount: u._count.agents,
        claimCount: u._count.claims,
        weightedScore: u.earningsSnapshot?.weightedScore?.toString() ?? '0',
        totalClaimed: u.earningsSnapshot?.totalClaimed?.toString() ?? '0',
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /admin/users/:id - Get user details
adminRouter.get('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agents: {
          include: { miningState: true, hex: true },
        },
        claims: {
          orderBy: { claimedAt: 'desc' },
          take: 10,
        },
        earningsSnapshot: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /admin/users/:id/role - Update user role
adminRouter.post('/users/:id/role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { role } = req.body;
    if (!role || !['USER', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Invalid role. Must be USER or ADMIN' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, walletPubkey: true, role: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// ============================================================================
// Economy Management Endpoints
// ============================================================================

// GET /admin/economy - Get economy config
adminRouter.get('/economy', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await getEconomyConfig();
    res.json({
      minClaimAmount: config.minClaimAmount.toString(),
      goldWeight: config.goldWeight,
      silverWeight: config.silverWeight,
      copperWeight: config.copperWeight,
      ironWeight: config.ironWeight,
      isPaused: config.isPaused,
      pausedAt: config.pausedAt?.toISOString() ?? null,
      pausedBy: config.pausedBy,
      updatedAt: config.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Economy config error:', error);
    res.status(500).json({ error: 'Failed to get economy config' });
  }
});

// PATCH /admin/economy - Update economy config (weights, minClaim)
adminRouter.patch('/economy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { minClaimAmount, goldWeight, silverWeight, copperWeight, ironWeight } = req.body;

    const updates: Record<string, unknown> = {};
    if (minClaimAmount !== undefined) {
      updates.minClaimAmount = BigInt(minClaimAmount);
    }
    if (goldWeight !== undefined) updates.goldWeight = goldWeight;
    if (silverWeight !== undefined) updates.silverWeight = silverWeight;
    if (copperWeight !== undefined) updates.copperWeight = copperWeight;
    if (ironWeight !== undefined) updates.ironWeight = ironWeight;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid updates provided' });
      return;
    }

    const config = await updateEconomyConfig(updates, req.walletAddress!);
    res.json({
      success: true,
      config: {
        minClaimAmount: config.minClaimAmount.toString(),
        goldWeight: config.goldWeight,
        silverWeight: config.silverWeight,
        copperWeight: config.copperWeight,
        ironWeight: config.ironWeight,
      },
    });
  } catch (error) {
    console.error('Economy update error:', error);
    res.status(500).json({ error: 'Failed to update economy config' });
  }
});

// POST /admin/economy/pause - Pause claims (emergency)
adminRouter.post('/economy/pause', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await updateEconomyConfig(
      { isPaused: true },
      req.walletAddress!
    );

    // Note: On-chain vault pause would be called here if deployed
    // await pauseVaultOnChain(req.walletAddress);

    console.log(`[ADMIN] Claims PAUSED by ${req.walletAddress}`);

    res.json({
      success: true,
      isPaused: config.isPaused,
      pausedAt: config.pausedAt?.toISOString(),
      pausedBy: config.pausedBy,
    });
  } catch (error) {
    console.error('Pause error:', error);
    res.status(500).json({ error: 'Failed to pause claims' });
  }
});

// POST /admin/economy/unpause - Resume claims
adminRouter.post('/economy/unpause', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await updateEconomyConfig(
      { isPaused: false },
      req.walletAddress!
    );

    // Note: On-chain vault unpause would be called here if deployed
    // await unpauseVaultOnChain(req.walletAddress);

    console.log(`[ADMIN] Claims RESUMED by ${req.walletAddress}`);

    res.json({
      success: true,
      isPaused: config.isPaused,
    });
  } catch (error) {
    console.error('Unpause error:', error);
    res.status(500).json({ error: 'Failed to unpause claims' });
  }
});

// POST /admin/economy/deposit - Manual fee deposit (for testing/adjustments)
adminRouter.post('/economy/deposit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(Number(amount))) {
      res.status(400).json({ error: 'Valid amount required' });
      return;
    }

    // Record deposit in database
    const deposit = await prisma.feeDeposit.create({
      data: {
        txSignature: `manual-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        amount: BigInt(amount),
        source: 'DEPLOYMENT', // Using existing enum value
        processed: true,
      },
    });

    console.log(`[ADMIN] Manual deposit of ${amount} lamports by ${req.walletAddress}`);

    res.json({
      success: true,
      deposit: {
        id: deposit.id,
        amount: deposit.amount.toString(),
        txSignature: deposit.txSignature,
      },
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to record deposit' });
  }
});
