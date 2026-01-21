// Mining update sent to user's agents
export interface AgentUpdate {
  id: string;
  hexId: number;
  hexQ: number;  // Hex q coordinate for rendering
  hexR: number;  // Hex r coordinate for rendering
  resources: {
    gold: string;   // BigInt as string for JSON
    silver: string;
    copper: string;
    iron: string;
  };
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

// Earnings update event data
export interface EarningsUpdateData {
  claimableAmount: string; // BigInt as string
  weightedScore: string;
  userShare: string;
}

// Leaderboard update event data
export interface LeaderboardUpdateData {
  topUsers: Array<{
    wallet: string;
    score: string;
    rank: number;
  }>;
  totalUsers: number;
}

// Claim success event data
export interface ClaimSuccessData {
  claimId: string;
  amount: string; // BigInt as string
  txSignature: string;
}

// Claim error event data
export interface ClaimErrorData {
  error: string;
  message: string;
}

// Server -> Client events
export interface ServerToClientEvents {
  'mining:update': (data: { agents: AgentUpdate[] }) => void;
  'hex:depleted': (data: { hexId: number; q: number; r: number }) => void;
  'agent:relocating': (data: {
    agentId: string;
    fromHexId: number;
    toHexId: number;
    arrivalTick: number;
  }) => void;
  'agent:arrived': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;
  'agent:deployed': (data: { agent: AgentUpdate & { hexQ: number; hexR: number } }) => void;
  'agent:placed': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;
  // Earnings and leaderboard events
  'earnings:update': (data: EarningsUpdateData) => void;
  'leaderboard:update': (data: LeaderboardUpdateData) => void;
  'claim:success': (data: ClaimSuccessData) => void;
  'claim:error': (data: ClaimErrorData) => void;
}

// Client -> Server events
export interface ClientToServerEvents {
  'subscribe': (walletPubkey: string, callback: (ok: boolean) => void) => void;
}

// Inter-server events (for Redis adapter)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data attached to each connection
export interface SocketData {
  walletPubkey: string;
}
