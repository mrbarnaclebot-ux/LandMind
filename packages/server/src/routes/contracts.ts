/**
 * Contracts route — System 4 (daily contracts), Phase D.
 *
 * GET /api/contracts (auth) → { contract, streak }
 *
 * The daily contract is generated LAZILY here (deterministic per user + UTC day),
 * so the first GET of the day creates the row and subsequent GETs read it back.
 * Progress accrues in the tick loop; this endpoint reflects the freshest value
 * (Redis buffer preferred over the DB row between flushes).
 */

import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getOrCreateTodayContract } from '../services/contractService.js';

export const contractsRouter = Router();

contractsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await getOrCreateTodayContract(req.userId!);
    res.json(result);
  } catch (error) {
    console.error('Failed to fetch contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});
