/**
 * Public world-clock route (System 1).
 *
 * GET /api/world — no auth, cheap (pure function of the wall clock, no I/O).
 * Returns the same WorldState payload the `world:update` socket event carries,
 * plus the published modifier `table` so the client can render "published odds".
 */

import { Router, type Request, type Response } from 'express';
import { getWorldState, MODIFIER_TABLE } from '../simulation/worldClock.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const state = getWorldState();
  res.json({
    ...state,
    // Published modifier table — readable odds for the in-game modifier UI.
    table: MODIFIER_TABLE,
  });
});

export default router;
