/**
 * Hexes / Prospecting route — System 4 (Survey), Phase D.
 *
 * POST /api/hexes/survey  (auth, 5-min per-user cooldown) — validates the hex
 *   exists, persists the durable Survey unlock, returns the full hex snapshot.
 *   429 { error, retryAfterMs } while on cooldown.
 * GET  /api/surveys       (auth) — all the user's surveyed hexes with CURRENT data.
 *
 * Rate-limited by the sensitiveLimiter mounted in index.ts (in addition to the
 * per-user survey cooldown, which is the durable game-facing gate).
 */

import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import {
  surveyCooldownRemaining,
  armSurveyCooldown,
  hexSnapshot,
  recordSurvey,
  getUserSurveys,
} from '../services/surveyService.js';

export const hexesRouter = Router();

/**
 * POST /api/hexes/survey  body { q, r }
 */
hexesRouter.post('/survey', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, r } = req.body ?? {};
    if (
      typeof q !== 'number' ||
      typeof r !== 'number' ||
      !Number.isInteger(q) ||
      !Number.isInteger(r)
    ) {
      return res.status(400).json({ error: 'Invalid target: q and r must be integers' });
    }

    // Per-user 5-min cooldown (checked BEFORE any work so a spamming client is
    // cheaply rejected). The unlock is durable, so the cooldown limits fresh
    // reveals, not re-reads (GET /api/surveys is uncapped by this cooldown).
    const remaining = await surveyCooldownRemaining(req.userId!);
    if (remaining > 0) {
      return res.status(429).json({ error: 'Survey on cooldown', retryAfterMs: remaining });
    }

    // Validate the hex exists and snapshot its current data.
    const snapshot = await hexSnapshot(q, r);
    if (!snapshot) {
      return res.status(400).json({ error: 'Hex does not exist' });
    }

    // Persist the durable unlock, then arm the cooldown.
    await recordSurvey(req.userId!, q, r);
    await armSurveyCooldown(req.userId!);

    return res.json({ hex: snapshot });
  } catch (error) {
    console.error('Failed to survey hex:', error);
    return res.status(500).json({ error: 'Failed to survey hex' });
  }
});

/**
 * GET /api/surveys — all surveyed hexes for the caller (CURRENT data).
 *
 * Mounted at /api/surveys in index.ts (this router handles the root path).
 */
export const surveysRouter = Router();

surveysRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await getUserSurveys(req.userId!);
    res.json({ surveys });
  } catch (error) {
    console.error('Failed to fetch surveys:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});
