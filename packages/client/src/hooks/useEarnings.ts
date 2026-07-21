/**
 * Hook to fetch user's earnings and subscribe to real-time updates
 */
import { useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useEarningsStore } from '../stores/earningsStore';
import { API_URL } from '../lib/config';
import { apiFetch } from '../lib/apiFetch';
import { getSocket } from '../lib/socket';

export interface EarningsResponse {
  weightedScore: string;
  totalPoolScore: string;
  userShare: string;
  availableFeePool: string;
  claimableAmount: string;
  totalClaimed: string;
  wallet: string;
  minClaimAmount: string;
  canClaim: boolean;
}

/**
 * Fetch earnings from API
 */
export async function fetchEarnings(): Promise<EarningsResponse> {
  const response = await apiFetch(`${API_URL}/api/earnings`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch earnings');
  }

  return response.json();
}

/**
 * Fetch leaderboard data
 */
export async function fetchLeaderboard(): Promise<{
  topUsers: { wallet: string; score: number; rank: number }[];
  totalUsers: number;
  userRank: { rank: number; score: number } | null;
  userPercentile: number | null;
}> {
  const response = await apiFetch(`${API_URL}/api/leaderboard`);

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  return response.json();
}

export function useEarnings() {
  const { isAuthenticated, walletAddress } = useWalletStore();
  const {
    setEarnings,
    setLoading,
    setError,
    claimable,
    totalClaimed,
    weightedScore,
    sharePercent,
    rank,
    percentile,
    canClaim,
    isLoading,
    error,
    lastUpdated,
    getClaimableSOL,
    getTotalClaimedSOL,
    getMinClaimSOL,
  } = useEarningsStore();

  // Fetch earnings data
  const loadEarnings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    try {
      // Fetch earnings and leaderboard in parallel
      const [earningsData, leaderboardData] = await Promise.all([
        fetchEarnings(),
        fetchLeaderboard(),
      ]);

      // Calculate share percent
      const totalPool = BigInt(earningsData.totalPoolScore || '0');
      const userScore = BigInt(earningsData.weightedScore || '0');
      const sharePercentValue = totalPool > 0n
        ? Number(userScore * 10000n / totalPool) / 100
        : 0;

      setEarnings({
        claimable: earningsData.claimableAmount,
        totalClaimed: earningsData.totalClaimed,
        weightedScore: earningsData.weightedScore,
        totalPoolScore: earningsData.totalPoolScore,
        availableFeePool: earningsData.availableFeePool,
        userShare: earningsData.userShare,
        minClaimAmount: earningsData.minClaimAmount,
        canClaim: earningsData.canClaim,
        sharePercent: sharePercentValue,
        rank: leaderboardData.userRank?.rank ?? null,
        percentile: leaderboardData.userPercentile ?? 0,
      });
    } catch (err) {
      console.error('[useEarnings] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load earnings');
    }
  }, [isAuthenticated, setEarnings, setLoading, setError]);

  // Load on auth change
  useEffect(() => {
    if (isAuthenticated) {
      loadEarnings();
    }
  }, [isAuthenticated, loadEarnings]);

  // Subscribe to socket events
  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;

    const sock = getSocket();

    // (Re)subscribe to the user's room. Runs on mount if already connected and
    // again on every socket 'connect' — critical because the socket is opened
    // anonymously pre-login and only authenticates after a reconnect carries the
    // session cookie.
    const subscribe = () => {
      // Guard against emitting an unauthenticated subscribe. `isAuthenticated`
      // can be a stale, persisted value on a fresh page load (localStorage says
      // authed but the session cookie is gone), and the socket 'connect' event
      // can fire during a logout-triggered reconnect. Re-check the live store at
      // emit time so we never fire a pointless unauthenticated subscribe.
      if (!useWalletStore.getState().isAuthenticated) return;
      sock.emit('subscribe', walletAddress, (ack) => {
        const ok = typeof ack === 'boolean' ? ack : ack?.ok;
        if (!ok) {
          const reason =
            ack && typeof ack === 'object' && 'reason' in ack ? ack.reason : undefined;
          if (reason === 'unauthenticated') {
            // Expected race during logout/reconnect (or stale persisted auth) —
            // the handshake cookie just isn't valid yet. Not an error.
            console.debug('[useEarnings] subscribe skipped: unauthenticated');
          } else {
            console.error('[useEarnings] Failed to subscribe to updates', reason ?? '');
          }
        } else {
          // Reconcile any earnings changes missed while disconnected.
          loadEarnings();
        }
      });
    };

    if (sock.connected) subscribe();
    sock.on('connect', subscribe);

    // Handle earnings updates
    sock.on('earnings:update', (data) => {
      setEarnings({
        claimable: data.claimable,
        totalPoolScore: data.totalPoolScore,
        sharePercent: data.sharePercent,
        // weightedScore is only present in the legacy payload.
        ...(data.weightedScore !== undefined ? { weightedScore: data.weightedScore } : {}),
      });
    });

    // Handle claim success - reload earnings
    sock.on('claim:success', () => {
      loadEarnings();
    });

    // Handle claim error
    sock.on('claim:error', (data) => {
      setError(data.message || data.error);
    });

    return () => {
      sock.off('connect', subscribe);
      sock.off('earnings:update');
      sock.off('claim:success');
      sock.off('claim:error');
    };
  }, [isAuthenticated, walletAddress, setEarnings, setError, loadEarnings]);

  return {
    // State
    claimable,
    totalClaimed,
    weightedScore,
    sharePercent,
    rank,
    percentile,
    canClaim,
    isLoading,
    error,
    lastUpdated,

    // Computed SOL values
    claimableSOL: getClaimableSOL(),
    totalClaimedSOL: getTotalClaimedSOL(),
    minClaimSOL: getMinClaimSOL(),

    // Actions
    reload: loadEarnings,
  };
}
