import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { gatherMetrics } from '../services/metricsService.js';
import { prisma } from '../lib/prisma.js';

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
