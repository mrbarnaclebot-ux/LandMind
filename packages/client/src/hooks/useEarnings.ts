/**
 * Hook to fetch user's earnings and subscribe to real-time updates
 */
import { useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useEarningsStore } from '../stores/earningsStore';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Socket event types
interface EarningsUpdateEvent {
  claimable: string;
  weightedScore: string;
  totalPoolScore: string;
  sharePercent: number;
}

interface ClaimSuccessEvent {
  claimId: string;
  amount: string;
  txSignature: string;
}

interface ClaimErrorEvent {
  error: string;
  message: string;
}

interface ServerToClientEvents {
  'earnings:update': (data: EarningsUpdateEvent) => void;
  'claim:success': (data: ClaimSuccessEvent) => void;
  'claim:error': (data: ClaimErrorEvent) => void;
}

interface ClientToServerEvents {
  'subscribe': (walletPubkey: string, callback: (ok: boolean) => void) => void;
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

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
  const response = await fetch(`${API_BASE_URL}/api/earnings`, {
    credentials: 'include',
  });

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
  const response = await fetch(`${API_BASE_URL}/api/leaderboard`, {
    credentials: 'include',
  });

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

    // Subscribe to user's room
    sock.emit('subscribe', walletAddress, (ok: boolean) => {
      if (!ok) {
        console.error('[useEarnings] Failed to subscribe to updates');
      }
    });

    // Handle earnings updates
    sock.on('earnings:update', (data) => {
      setEarnings({
        claimable: data.claimable,
        weightedScore: data.weightedScore,
        totalPoolScore: data.totalPoolScore,
        sharePercent: data.sharePercent,
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
