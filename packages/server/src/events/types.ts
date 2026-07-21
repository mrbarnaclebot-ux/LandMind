import type { WorldState } from '../simulation/worldClock.js';
import type { WeatherFront } from '../simulation/weatherService.js';
import type { GoldRushState } from '../services/goldRushService.js';

// World-clock update (System 1). Broadcast publicly every tick (5s) to ALL
// sockets. Payload is the pinned WorldState shape:
//   { phase, cycleT, phaseProgress, nextPhaseAt, modifiers: { surface, deep } }
export type WorldUpdateData = WorldState;

// Weather update (System 2). Broadcast publicly every tick to ALL sockets so
// clients can telegraph incoming fronts. `fronts[].center` is the CURRENT
// position; the client extrapolates the future path from origin + velocity.
export interface WeatherUpdateData {
  fronts: WeatherFront[];
}

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
  status: 'MINING' | 'RELOCATING' | 'IDLE' | 'TRAPPED';
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
  // Public world-clock broadcast (System 1) — every tick, to all sockets.
  'world:update': (data: WorldUpdateData) => void;
  // Public weather broadcast (System 2) — every tick, to all sockets.
  'weather:update': (data: WeatherUpdateData) => void;
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
  // Manual relocation (System 2) — emitted to the owner when they move an agent.
  'agent:relocated': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;
  // Hazards (System 3) — cave-in fired on an agent. To the owner's room.
  // selfDigAt = epoch ms when the agent auto-frees itself (4-hour timer).
  'agent:trapped': (data: {
    agentId: string;
    hexId: number;
    hexQ: number;
    hexR: number;
    selfDigAt: number;
  }) => void;
  // Hazards (System 3) — agent freed (rescue endpoint OR self-dig). To owner.
  'agent:rescued': (data: { agentId: string }) => void;
  // Hazards (System 3) — a rich vein spawned. Broadcast to ALL sockets for the
  // land-rush ping. multiplier is always 3; expiresAt is epoch ms.
  'vein:spawned': (data: {
    hexId: number;
    q: number;
    r: number;
    resourceType: string;
    multiplier: number;
    expiresAt: number;
  }) => void;
  // Hazards (System 3) — a rich vein expired. Broadcast to ALL sockets.
  'vein:expired': (data: { hexId: number }) => void;
  // Engagement (System 4) — daily contract progress, to the owner's room.
  // Throttled: emitted only when progress changes materially. BigInts as strings.
  'contract:progress': (data: { progress: string; target: string }) => void;
  // Engagement (System 4) — daily contract completed, to the owner's room.
  'contract:completed': (data: {
    streak: number;
    reward: { yieldBoost: number; until: number };
  }) => void;
  // Engagement (System 4) — gold rush community event. Broadcast to ALL sockets
  // each tick while active or while an achieved boost is still live.
  'goldrush:update': (data: GoldRushState) => void;
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
