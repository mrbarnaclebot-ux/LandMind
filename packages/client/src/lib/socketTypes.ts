/**
 * Shared Socket.io event type definitions.
 *
 * Consolidates the per-hook event interfaces that were previously redeclared
 * in useEarnings, useUserAgents and useAdminSocket. Field shapes match what
 * the hooks already consume so migration is behaviour-preserving.
 */

// ---------------------------------------------------------------------------
// Earnings events
// ---------------------------------------------------------------------------

export interface EarningsUpdateEvent {
  claimable: string;
  sharePercent: number;
  totalPoolScore: string;
  /** Present in the legacy payload; consumed by useEarnings when available. */
  weightedScore?: string;
}

export interface ClaimSuccessEvent {
  claimId: string;
  amount: string;
  txSignature: string;
}

export interface ClaimErrorEvent {
  error: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Agent / mining events
// ---------------------------------------------------------------------------

export interface AgentUpdate {
  id: string;
  hexId: number;
  hexQ: number;
  hexR: number;
  resources: {
    gold: string;
    silver: string;
    copper: string;
    iron: string;
  };
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

// ---------------------------------------------------------------------------
// Admin events
// ---------------------------------------------------------------------------

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalAgents: number;
  miningAgents: number;
  idleAgents: number;
  treasuryBalance: number;
  totalClaimed: number;
  totalDeposits: number;
  redisLatency: number;
  dbLatency: number;
  rpcLatency: number;
  resourcesPerMinute: number;
  connectionsCount: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Aggregate server -> client / client -> server maps
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  // Earnings
  'earnings:update': (data: EarningsUpdateEvent) => void;
  'claim:success': (data: ClaimSuccessEvent) => void;
  'claim:error': (data: ClaimErrorEvent) => void;

  // Agents / mining
  'mining:update': (data: { agents: AgentUpdate[] }) => void;
  'agent:relocating': (data: {
    agentId: string;
    fromHexId: number;
    toHexId: number;
    arrivalTick: number;
  }) => void;
  'agent:arrived': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;
  'agent:deployed': (data: { agent: AgentUpdate }) => void;
  'agent:placed': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;

  // Admin
  'admin:metrics': (data: PlatformMetrics) => void;
}

/**
 * Structured ack for `subscribe`. Backwards-compatible with the old boolean
 * ack: the object is always truthy on success. New clients read `ok`/`reason`.
 */
export interface SubscribeAck {
  ok: boolean;
  reason?: 'unauthenticated' | 'wallet_mismatch';
}

export interface ClientToServerEvents {
  /**
   * Subscribe to the authenticated user's room. The server now derives the
   * wallet from the authenticated handshake; the wallet argument is kept for
   * backwards compatibility. The ack is a structured object — see SubscribeAck.
   */
  subscribe: (walletPubkey: string, callback: (ack: SubscribeAck) => void) => void;

  // Admin
  'admin:subscribe': () => void;
  'admin:unsubscribe': () => void;
}
