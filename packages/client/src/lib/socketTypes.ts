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
// World clock events (System 1 — day/night cycle)
// ---------------------------------------------------------------------------

/** The five ordered phases of the world clock. */
export type WorldPhase = 'dawn' | 'day' | 'golden_hour' | 'dusk' | 'night';

/**
 * Yield modifiers active for the current phase.
 *  - `surface`: multiplier applied to surface (non pit/cave-adjacent) hexes.
 *  - `deep`:    multiplier applied to pit / cave-adjacent hexes.
 */
export interface WorldModifiers {
  surface: number;
  deep: number;
}

/**
 * The full published modifier table (all phases → their modifiers), keyed by
 * phase. Shape is intentionally permissive: the server owns the exact contents
 * and the HUD renders whatever rows are present. The common case is a record of
 * phase → { surface, deep }.
 */
export type WorldModifierTable = Partial<Record<WorldPhase, WorldModifiers>> &
  Record<string, unknown>;

/**
 * Broadcast every ~5s (public, no auth) and returned by GET /api/world for the
 * initial load. The client interpolates `cycleT` locally between updates using
 * the pinned WORLD_EPOCH_MS anchor; the server remains the authority and the
 * client reconciles on every update.
 */
export interface WorldUpdateEvent {
  phase: WorldPhase;
  /** Position in the full cycle, 0–1. */
  cycleT: number;
  /** Progress through the CURRENT phase, 0–1. */
  phaseProgress: number;
  /** Epoch ms at which the next phase begins. */
  nextPhaseAt: number;
  modifiers: WorldModifiers;
  /** Published odds / modifier table for the popover. */
  table: WorldModifierTable;
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

  // World clock (public broadcast, every ~5s)
  'world:update': (data: WorldUpdateEvent) => void;
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
