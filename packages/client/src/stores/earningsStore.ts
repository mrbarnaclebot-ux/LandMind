/**
 * Zustand store for earnings state management
 */
import { create } from 'zustand';

export interface EarningsState {
  // Amounts in lamports (as strings for BigInt serialization)
  claimable: string;
  totalClaimed: string;
  weightedScore: string;
  totalPoolScore: string;
  availableFeePool: string;
  userShare: string;
  minClaimAmount: string;

  // Derived values
  sharePercent: number;
  projectedDaily: string;
  rank: number | null;
  percentile: number;
  canClaim: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface EarningsActions {
  // State setters
  setEarnings: (data: Partial<EarningsState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Computed getters
  getClaimableSOL: () => number;
  getTotalClaimedSOL: () => number;
  getMinClaimSOL: () => number;
}

const initialState: EarningsState = {
  claimable: '0',
  totalClaimed: '0',
  weightedScore: '0',
  totalPoolScore: '0',
  availableFeePool: '0',
  userShare: '0',
  minClaimAmount: '25000000', // 0.025 SOL default
  sharePercent: 0,
  projectedDaily: '0',
  rank: null,
  percentile: 0,
  canClaim: false,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

export const useEarningsStore = create<EarningsState & EarningsActions>((set, get) => ({
  ...initialState,

  setEarnings: (data) => set((state) => ({
    ...state,
    ...data,
    lastUpdated: new Date(),
    error: null,
    isLoading: false,
  })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => set(initialState),

  // Convert lamports to SOL
  getClaimableSOL: () => {
    const { claimable } = get();
    return Number(BigInt(claimable)) / 1e9;
  },

  getTotalClaimedSOL: () => {
    const { totalClaimed } = get();
    return Number(BigInt(totalClaimed)) / 1e9;
  },

  getMinClaimSOL: () => {
    const { minClaimAmount } = get();
    return Number(BigInt(minClaimAmount)) / 1e9;
  },
}));
