/**
 * Leaderboard routes
 * Public endpoint with optional authentication for personalized data
 */
import { Router, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { prisma } from '../lib/prisma.js';
import {
  getTopUsers,
  getUserRank,
  getUserPercentile,
  getTotalUsers,
  LeaderboardEntry,
} from '../services/leaderboardService.js';

export const leaderboardRouter = Router();

/**
 * GET /api/leaderboard - Get top 10 users plus authenticated user's rank
 * Public with optional authentication
 *
 * Returns:
 * - topUsers: Array of top 10 users with wallet, score, rank
 * - totalUsers: Total number of users on leaderboard
 * - userRank: (if authenticated) User's rank info
 * - userPercentile: (if authenticated) User's percentile
 */
leaderboardRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get top 10 users
    const topUsers: LeaderboardEntry[] = await getTopUsers(10);
    const totalUsers = await getTotalUsers();

    // If authenticated, get user's rank info
    let userRank = null;
    let userPercentile = null;

    if (req.userId) {
      // Get user's wallet
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { walletPubkey: true },
      });

      if (user) {
        userRank = await getUserRank(user.walletPubkey);
        userPercentile = await getUserPercentile(user.walletPubkey);

        // Check if user is in top 10 (highlight their position)
        if (userRank) {
          const userInTop = topUsers.find(u => u.wallet === user.walletPubkey);
          if (userInTop) {
            // Mark user's entry
            (userInTop as LeaderboardEntry & { isCurrentUser?: boolean }).isCurrentUser = true;
          }
        }
      }
    }

    res.json({
      topUsers,
      totalUsers,
      userRank,
      userPercentile,
    });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});
