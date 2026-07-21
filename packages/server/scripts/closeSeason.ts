/**
 * Close a season — soft prestige (System 4, Phase D).
 *
 * Snapshots the current leaderboard ZSET into Season + SeasonResult rows, resets
 * the ZSET, and grants every PARTICIPATING user a permanent +0.02 seasonBonusPct.
 * Never a hard wipe: agents (cNFTs) and resources carry over; only rank resets and
 * a permanent additive badge accrues (design System 4 + anti-pattern rule 7).
 *
 * Run (like seed.ts / syncTerrain.ts, with DATABASE_URL + REDIS_URL in env):
 *   npx tsx scripts/closeSeason.ts
 *
 * Idempotent-ish guard: refuses to close if a season was already closed within the
 * last hour (prevents an accidental double-close from wiping the fresh board).
 *
 * Steps:
 *   1. Read the whole leaderboard ZSET (wallet -> score), highest first.
 *   2. Map wallets -> userIds (skip any wallet with no user row).
 *   3. Create the Season row (number = last + 1) + one SeasonResult per participant
 *      (rank 1-indexed, score as BigInt), and increment each participant's
 *      seasonBonusPct by 0.02 — all in one transaction.
 *   4. Clear the leaderboard ZSET so the next season starts fresh.
 *   5. Log a summary.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from the project root (three levels up from packages/server/scripts),
// matching seed.ts / syncTerrain.ts so DATABASE_URL + REDIS_URL resolve.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { ENGAGEMENT_TABLE } from '../src/services/engagementConfig.js';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const LEADERBOARD_KEY = 'leaderboard:scores';
const DOUBLE_CLOSE_GUARD_MS = 60 * 60_000; // 1 hour
const SEASON_BONUS_INCREMENT = ENGAGEMENT_TABLE.seasonBonusPerSeason; // 0.02

async function main(): Promise<void> {
  console.log('=== LandMind Season Close ===\n');

  // Guard: refuse to close twice within an hour.
  const lastSeason = await prisma.season.findFirst({ orderBy: { closedAt: 'desc' } });
  if (lastSeason) {
    const sinceMs = Date.now() - lastSeason.closedAt.getTime();
    if (sinceMs < DOUBLE_CLOSE_GUARD_MS) {
      console.error(
        `Refusing to close: season #${lastSeason.number} was closed ` +
          `${Math.round(sinceMs / 60_000)} min ago (< 60 min guard). Aborting.`
      );
      return;
    }
  }
  const nextNumber = (lastSeason?.number ?? 0) + 1;

  // 1. Snapshot the leaderboard ZSET, highest first.
  const flat = await redis.zrevrange(LEADERBOARD_KEY, 0, -1, 'WITHSCORES');
  if (flat.length === 0) {
    console.warn('Leaderboard is empty — nothing to snapshot. Creating an empty season.');
  }

  const entries: Array<{ wallet: string; score: bigint }> = [];
  for (let i = 0; i < flat.length; i += 2) {
    const wallet = flat[i];
    // ZSET scores are numbers; the weighted score is integer-valued so this is exact
    // for the magnitudes we use. Store as BigInt in SeasonResult.score.
    const score = BigInt(Math.round(Number(flat[i + 1])));
    entries.push({ wallet, score });
  }

  // 2. Resolve wallets -> userIds.
  const wallets = entries.map((e) => e.wallet);
  const users =
    wallets.length > 0
      ? await prisma.user.findMany({
          where: { walletPubkey: { in: wallets } },
          select: { id: true, walletPubkey: true },
        })
      : [];
  const userIdByWallet = new Map(users.map((u) => [u.walletPubkey, u.id]));

  const participants: Array<{ userId: string; rank: number; score: bigint }> = [];
  let rank = 0;
  let skipped = 0;
  for (const e of entries) {
    rank++; // 1-indexed rank across ALL ZSET entries (preserves true placement)
    const userId = userIdByWallet.get(e.wallet);
    if (!userId) {
      skipped++;
      continue; // wallet with no user row — skip (can't attribute a bonus)
    }
    participants.push({ userId, rank, score: e.score });
  }

  const totalPool = participants.reduce((acc, p) => acc + p.score, 0n);

  console.log(
    `Season #${nextNumber}: ${entries.length} ZSET entries, ` +
      `${participants.length} participants (${skipped} unmatched wallets skipped), ` +
      `totalPool=${totalPool}.`
  );

  // 3. Create the season + results + bump seasonBonusPct, all in one transaction.
  await prisma.$transaction(async (tx) => {
    const season = await tx.season.create({
      data: { number: nextNumber, totalPool },
    });

    for (const p of participants) {
      await tx.seasonResult.create({
        data: { seasonId: season.id, userId: p.userId, rank: p.rank, score: p.score },
      });
      await tx.user.update({
        where: { id: p.userId },
        data: { seasonBonusPct: { increment: SEASON_BONUS_INCREMENT } },
      });
    }
  });

  // 4. Reset the leaderboard ZSET so the next season starts fresh. (Note: the
  //    write-behind flush rebuilds scores from CURRENT resource totals on the next
  //    flush; a true rank reset would also require zeroing accrued totals, which is
  //    out of scope here — this clears the standings for the new season snapshot.)
  await redis.del(LEADERBOARD_KEY);

  // 5. Summary.
  console.log(
    `\nClosed season #${nextNumber}: ` +
      `${participants.length} participants each +${SEASON_BONUS_INCREMENT} seasonBonusPct, ` +
      `leaderboard ZSET reset.`
  );
  if (participants.length > 0) {
    const top = participants.slice(0, 3);
    console.log('Top 3:');
    for (const p of top) {
      console.log(`  #${p.rank}  user=${p.userId}  score=${p.score}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Season close failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
