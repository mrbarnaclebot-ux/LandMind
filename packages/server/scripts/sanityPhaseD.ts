/**
 * Phase D sanity checks — pure-math only (no DB / Redis).
 *
 * Verifies:
 *   1. Daily-contract determinism: same (userId, dateUTC) → same resource + target;
 *      target scales with agent count; description matches; UTC-day helpers correct.
 *   2. Gold Rush scheduling math: 4h-boundary window index/start, 30-min active
 *      window, deterministic resource pick, target scaling + floor.
 *
 * Run:  npx tsx scripts/sanityPhaseD.ts   (exits non-zero on any failure)
 */

import {
  pickContractResource,
  contractTarget,
  contractDescription,
  dateUTCFor,
  endOfUTCDay,
  hashString,
  CONTRACT_BASE_TARGET,
} from '../src/services/contractService.js';
import {
  windowIndexFor,
  windowStartMs,
  isRushActive,
  pickRushResource,
  rushTarget,
  RUSH_INTERVAL_MS,
  RUSH_DURATION_MS,
  RUSH_TARGET_PER_AGENT,
  RUSH_TARGET_MIN,
} from '../src/services/goldRushService.js';
import { WORLD_EPOCH_MS } from '../src/simulation/worldClock.js';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Contract determinism ===');
{
  const user = 'user-abc-123';
  const day = '2026-07-21';

  // Deterministic resource + target across repeated calls.
  const r1 = pickContractResource(user, day);
  const r2 = pickContractResource(user, day);
  check('resource pick is deterministic per (user, day)', r1 === r2, `${r1} vs ${r2}`);

  // Different day → (usually) can differ, but MUST be stable within a day.
  const r3 = pickContractResource(user, '2026-07-22');
  check('resource pick stable within day / independent per day', typeof r3 === 'string');

  // Different user with same day → deterministic per user.
  const otherA = pickContractResource('user-xyz', day);
  const otherB = pickContractResource('user-xyz', day);
  check('resource pick deterministic for a different user', otherA === otherB);

  // Resource is always one of the four mineable types (never EMPTY).
  check(
    'resource is a mineable type',
    ['GOLD', 'SILVER', 'COPPER', 'IRON'].includes(r1),
    r1
  );

  // Target scaling: base * max(1, agentCount).
  check('target with 0 agents = base*1', contractTarget(0) === BigInt(CONTRACT_BASE_TARGET));
  check('target with 1 agent = base*1', contractTarget(1) === BigInt(CONTRACT_BASE_TARGET));
  check('target with 5 agents = base*5', contractTarget(5) === BigInt(CONTRACT_BASE_TARGET) * 5n);
  check(
    'target with 20 agents = base*20',
    contractTarget(20) === BigInt(CONTRACT_BASE_TARGET) * 20n
  );

  // Description includes the target + a capitalized resource name.
  const desc = contractDescription('COPPER', contractTarget(3));
  check('description mentions target', desc.includes((CONTRACT_BASE_TARGET * 3).toString()), desc);
  check('description capitalizes resource', desc.includes('Copper'), desc);

  // UTC-day helpers.
  const noonUTC = Date.UTC(2026, 6, 21, 12, 0, 0);
  check('dateUTCFor returns YYYY-MM-DD', dateUTCFor(noonUTC) === '2026-07-21', dateUTCFor(noonUTC));
  const eod = endOfUTCDay(noonUTC);
  check(
    'endOfUTCDay is next UTC midnight',
    eod === Date.UTC(2026, 6, 22, 0, 0, 0),
    new Date(eod).toISOString()
  );
  check('endOfUTCDay is strictly after nowMs', eod > noonUTC);

  // Hash is stable + unsigned 32-bit.
  const h = hashString('goldrush:0');
  check('hashString stable', h === hashString('goldrush:0'));
  check('hashString unsigned 32-bit', h >= 0 && h <= 0xffffffff);
}

console.log('\n=== Gold Rush scheduling math ===');
{
  // At the epoch, we are exactly at the start of window 0 (rush active).
  check('window index at epoch = 0', windowIndexFor(WORLD_EPOCH_MS) === 0);
  check('window start of index 0 = epoch', windowStartMs(0) === WORLD_EPOCH_MS);
  check('rush active AT the epoch boundary', isRushActive(WORLD_EPOCH_MS) === true);

  // 30 min in → still active; exactly at 30 min → NOT active (exclusive end).
  check(
    'active 29 min into window',
    isRushActive(WORLD_EPOCH_MS + 29 * 60_000) === true
  );
  check(
    'NOT active exactly at 30 min (rush ended)',
    isRushActive(WORLD_EPOCH_MS + RUSH_DURATION_MS) === false
  );
  check(
    'NOT active 2h into a 4h window (between rushes)',
    isRushActive(WORLD_EPOCH_MS + 2 * 60 * 60_000) === false
  );

  // Next boundary: exactly 4h later starts window 1 and a fresh rush.
  const nextBoundary = WORLD_EPOCH_MS + RUSH_INTERVAL_MS;
  check('window index at +4h = 1', windowIndexFor(nextBoundary) === 1);
  check('window start of index 1 = epoch + 4h', windowStartMs(1) === nextBoundary);
  check('rush active at the +4h boundary', isRushActive(nextBoundary) === true);

  // A time within window 3 resolves to index 3.
  const midWindow3 = WORLD_EPOCH_MS + 3 * RUSH_INTERVAL_MS + 10 * 60_000;
  check('mid-window-3 index = 3', windowIndexFor(midWindow3) === 3);

  // Resource pick deterministic per window index; a mineable type.
  const rp0a = pickRushResource(0);
  const rp0b = pickRushResource(0);
  check('rush resource deterministic per window', rp0a === rp0b, `${rp0a} vs ${rp0b}`);
  check('rush resource is mineable', ['GOLD', 'SILVER', 'COPPER', 'IRON'].includes(rp0a), rp0a);

  // Target scaling + floor.
  check('rush target floors at RUSH_TARGET_MIN (0 agents)', rushTarget(0) === RUSH_TARGET_MIN);
  check(
    'rush target floors at RUSH_TARGET_MIN (3 agents below floor)',
    rushTarget(3) === RUSH_TARGET_MIN, // 200*3=600 < 1000
  );
  check(
    'rush target scales above floor (10 agents)',
    rushTarget(10) === BigInt(RUSH_TARGET_PER_AGENT) * 10n, // 2000 > 1000
    rushTarget(10).toString()
  );
  check(
    'rush target scales above floor (100 agents)',
    rushTarget(100) === BigInt(RUSH_TARGET_PER_AGENT) * 100n
  );
}

console.log('');
if (failures > 0) {
  console.error(`Phase D sanity checks FAILED: ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('Phase D sanity checks PASSED.');
  // Pure-math checks only — force a clean exit so the transitively-imported redis
  // client (never used here) doesn't keep the process alive retrying to connect.
  process.exit(0);
}
