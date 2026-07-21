/**
 * Hook to fetch leaderboard data with periodic refresh
 * Uses optional authentication to show personalized user rank
 */
import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../lib/config';

const REFRESH_INTERVAL = 30_000; // 30 seconds

export interface LeaderboardEntry {
  wallet: string;
  score: string;
  rank: number;
  isCurrentUser?: boolean;
}

export interface UserRankInfo {
  wallet: string;
  score: string;
  rank: number;
  totalUsers: number;
}

interface LeaderboardResponse {
  topUsers: LeaderboardEntry[];
  totalUsers: number;
  userRank: UserRankInfo | null;
  userPercentile: number | null;
}

interface UseLeaderboardReturn {
  /** Top 10 users */
  top10: LeaderboardEntry[];
  /** Current user's rank info (if authenticated and not in top 10) */
  userRank: UserRankInfo | null;
  /** Current user's percentile (if authenticated) */
  userPercentile: number | null;
  /** Total users on leaderboard */
  totalUsers: number;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
}

/**
 * Fetch leaderboard data from API
 * Uses credentials to include auth cookie if available
 */
async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(`${API_URL}/api/leaderboard`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  return response.json();
}

/**
 * Hook for leaderboard data with auto-refresh
 */
export function useLeaderboard(): UseLeaderboardReturn {
  const [top10, setTop10] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRankInfo | null>(null);
  const [userPercentile, setUserPercentile] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchLeaderboard();
      setTop10(data.topUsers);
      setTotalUsers(data.totalUsers);
      setUserRank(data.userRank);
      setUserPercentile(data.userPercentile);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    top10,
    userRank,
    userPercentile,
    totalUsers,
    isLoading,
    error,
    refresh,
  };
}
