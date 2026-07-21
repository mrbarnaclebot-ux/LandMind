/**
 * Public world-clock route (System 1).
 *
 * GET /api/world — no auth, cheap (pure function of the wall clock, no I/O).
 * Returns the same WorldState payload the `world:update` socket event carries,
 * plus the published modifier `table` so the client can render "published odds".
 *
 * Phase B (Weather): also returns the currently-active `fronts` (so a fresh
 * client can render weather immediately without waiting for the next tick) and
 * the published `weatherTable` (readable per-biome weather odds).
 */

import { Router, type Request, type Response } from 'express';
import { getWorldState, MODIFIER_TABLE } from '../simulation/worldClock.js';
import { getActiveFronts, WEATHER_TABLE } from '../simulation/weatherService.js';
import { getActiveVeins } from '../simulation/veinService.js';
import { HAZARD_TABLE } from '../simulation/hazardService.js';
import { getGoldRushState } from '../services/goldRushService.js';
import { ENGAGEMENT_TABLE } from '../services/engagementConfig.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const state = getWorldState();
  res.json({
    ...state,
    // Published modifier table — readable odds for the in-game modifier UI.
    table: MODIFIER_TABLE,
    // Phase B — active weather fronts + published weather modifier table.
    fronts: getActiveFronts(),
    weatherTable: WEATHER_TABLE,
    // Phase C (Hazards) — active rich veins + published hazard table (cave-in
    // odds, self-dig timer, rescue/repair costs, deep-yield bonus, wear params).
    veins: getActiveVeins(),
    hazardTable: HAZARD_TABLE,
    // Phase D (Engagement) — current gold rush (or null) + the published
    // engagement parameter table (contract/goldrush boosts, survey cooldown, etc).
    goldrush: getGoldRushState(),
    engagementTable: ENGAGEMENT_TABLE,
  });
});

export default router;
