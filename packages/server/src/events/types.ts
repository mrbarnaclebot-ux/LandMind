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
// NOTE: shape aligned with the client contract (was: claimableAmount/weightedScore/userShare).
export interface EarningsUpdateData {
  claimable: string;       // BigInt lamports as string (claimable now)
  sharePercent: number;    // User's share of the total pool, as a percentage (0-100)
  totalPoolScore: string;  // BigInt total weighted pool score as string
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

// Structured ack for the `subscribe` event. Backwards-compatible with the old
// boolean-style ack: the object is always truthy, so legacy `if (ok)` checks
// still pass on success. New clients read `ok`/`reason` explicitly.
export interface SubscribeAck {
  ok: boolean;
  reason?: 'unauthenticated' | 'wallet_mismatch';
}

// Client -> Server events
export interface ClientToServerEvents {
  'subscribe': (walletPubkey: string | undefined, callback: (ack: SubscribeAck) => void) => void;
  'admin:subscribe': () => void;
  'admin:unsubscribe': () => void;
}

// Inter-server events (for Redis adapter)
export interface InterServerEvents {
  ping: () => void;
}

// Server -> Client admin metrics event is loosely typed via `admin:metrics`.
// (Kept out of ServerToClientEvents to avoid importing the metrics type here.)

// Socket data attached to each connection.
// Populated by the handshake auth middleware from the session JWT.
export interface SocketData {
  walletPubkey?: string; // authenticated wallet (undefined for unauthenticated sockets)
  userId?: string;       // authenticated user id
  isAdmin?: boolean;     // whether the authenticated wallet is an admin
}
