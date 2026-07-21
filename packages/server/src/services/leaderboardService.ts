/**
 * Leaderboard Service
 * Manages user rankings using Redis sorted sets (ZSET)
 *
 * Uses Redis ZSET for O(log N) rank operations:
 * - ZADD: Update/add user score
 * - ZREVRANGE: Get top N users (highest first)
 * - ZREVRANK: Get user's rank (0-indexed, highest first)
 * - ZSCORE: Get user's score
 * - ZCARD: Get total users in leaderboard
 * - ZREM: Remove user from leaderboard
 */

import { redis } from '../lib/redis.js';

const LEADERBOARD_KEY = 'leaderboard:scores';

export interface LeaderboardEntry {
  wallet: string;
  score: string; // BigInt as string for JSON compatibility
  rank: number; // 1-indexed for display
}

export interface UserRankInfo {
  wallet: string;
  score: string;
  rank: number;
  totalUsers: number;
}

/**
 * Update a user's score in the leaderboard
 * Creates entry if doesn't exist, updates if it does
 *
 * @param wallet - User's wallet public key
 * @param score - Weighted score (will be converted to number for Redis)
 */
export async function updateUserScore(wallet: string, score: bigint): Promise<void> {
  // Redis ZADD expects a number score
  // BigInt scores are precise but we store as number since Redis doesn't support BigInt
  // For very large scores, we may need to consider score bucketing
  const scoreNum = Number(score);

  await redis.zadd(LEADERBOARD_KEY, scoreNum, wallet);
}

/**
 * Get the top N users from the leaderboard
 *
 * @param count - Number of users to return (default 10)
 * @returns Array of leaderboard entries with rank, wallet, and score
 */
export async function getTopUsers(count: number = 10): Promise<LeaderboardEntry[]> {
  // ZREVRANGE returns highest first, WITHSCORES includes the scores
  const results = await redis.zrevrange(LEADERBOARD_KEY, 0, count - 1, 'WITHSCORES');

  // Results are [wallet1, score1, wallet2, score2, ...]
  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const wallet = results[i];
    const score = results[i + 1];
    entries.push({
      wallet,
      score,
      rank: Math.floor(i / 2) + 1, // 1-indexed rank
    });
  }

  return entries;
}

/**
 * Get a user's rank and score
 *
 * @param wallet - User's wallet public key
 * @returns User's rank info or null if not found
 */
export async function getUserRank(wallet: string): Promise<UserRankInfo | null> {
  // Use pipeline for efficiency
  const pipeline = redis.pipeline();
  pipeline.zrevrank(LEADERBOARD_KEY, wallet); // 0-indexed rank (highest first)
  pipeline.zscore(LEADERBOARD_KEY, wallet);
  pipeline.zcard(LEADERBOARD_KEY);

  const results = await pipeline.exec();
  if (!results) return null;

  const [rankResult, scoreResult, cardResult] = results;

  // Check if user exists in leaderboard
  const rank = rankResult[1];
  if (rank === null) return null;

  const score = scoreResult[1] as string | null;
  const totalUsers = cardResult[1] as number;

  return {
    wallet,
    score: score ?? '0',
    rank: (rank as number) + 1, // Convert to 1-indexed
    totalUsers,
  };
}

/**
 * Calculate a user's percentile ranking
 * Percentile = ((totalUsers - rank) / totalUsers) * 100
 *
 * @param wallet - User's wallet public key
 * @returns Percentile (0-100) or null if not found
 */
export async function getUserPercentile(wallet: string): Promise<number | null> {
  const rankInfo = await getUserRank(wallet);
  if (!rankInfo) return null;

  // Top 1 out of 100 = 99th percentile
  // Rank 50 out of 100 = 50th percentile
  // Last place = 0th percentile
  if (rankInfo.totalUsers === 0) return null;

  const percentile = ((rankInfo.totalUsers - rankInfo.rank) / rankInfo.totalUsers) * 100;
  return Math.round(percentile * 100) / 100; // Round to 2 decimal places
}

/**
 * Remove a user from the leaderboard
 *
 * @param wallet - User's wallet public key
 */
export async function removeUser(wallet: string): Promise<void> {
  await redis.zrem(LEADERBOARD_KEY, wallet);
}

/**
 * Get total number of users in the leaderboard
 *
 * @returns Total user count
 */
export async function getTotalUsers(): Promise<number> {
  return await redis.zcard(LEADERBOARD_KEY);
}

/**
 * Clear the entire leaderboard (for testing/reset)
 */
export async function clearLeaderboard(): Promise<void> {
  await redis.del(LEADERBOARD_KEY);
}

/**
 * Batch update multiple users' scores (efficient for flush operations)
 *
 * @param updates - Array of wallet/score pairs
 */
export async function updateScoresBatch(
  updates: Array<{ wallet: string; score: bigint }>
): Promise<void> {
  if (updates.length === 0) return;

  const pipeline = redis.pipeline();
  for (const { wallet, score } of updates) {
    pipeline.zadd(LEADERBOARD_KEY, Number(score), wallet);
  }
  await pipeline.exec();
}
