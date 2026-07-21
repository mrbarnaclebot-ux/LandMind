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
  status: 'MINING' | 'RELOCATING' | 'IDLE' | 'TRAPPED';
}

// ---------------------------------------------------------------------------
// Hazard events (System 3 — cave-ins, rescues, rich veins)
// ---------------------------------------------------------------------------

/**
 * An agent got trapped by a cave-in (deep deploy risk). Emitted into the owner's
 * room only. The agent stops mining until the owner taps Rescue (SOL fee) or the
 * `selfDigAt` timer elapses (~4h). Carries the hex so the world can dust-puff it.
 */
export interface AgentTrappedEvent {
  agentId: string;
  hexId: number;
  hexQ: number;
  hexR: number;
  /** Epoch ms at which the agent auto-frees itself (the self-dig timer). */
  selfDigAt: number;
}

/** An agent was freed (rescue paid or self-dig elapsed). Owner room. */
export interface AgentRescuedEvent {
  agentId: string;
}

/**
 * A hex temporarily upgraded to a ×N rich vein. Broadcast to everyone for the
 * land-rush ping. Additive-only; expires at `expiresAt`.
 */
export interface VeinSpawnedEvent {
  hexId: number;
  q: number;
  r: number;
  /** Resource type struck (e.g. 'GOLD'). */
  resourceType: string;
  /** Yield multiplier while active (pinned default: 3). */
  multiplier: number;
  /** Epoch ms at which the vein reverts. */
  expiresAt: number;
}

/** A rich vein reverted. Broadcast. */
export interface VeinExpiredEvent {
  hexId: number;
}

/** An active rich vein as carried in GET /api/world `veins`. */
export interface Vein {
  hexId: number;
  q: number;
  r: number;
  resourceType: string;
  multiplier: number;
  expiresAt: number;
}

/**
 * Published hazard odds (System 3). Returned by GET /api/world as `hazardTable`.
 * Shape is intentionally permissive (server owns the exact contents); the HUD
 * renders whatever fields are present, falling back to the pinned defaults.
 */
export interface HazardTable {
  caveIn: {
    baseChancePerHour: number;
    emberMultiplier: number;
    selfDigHours: number;
    rescueCostLamports: number;
    deepYieldBonus: number;
  };
  wear: {
    fullWearMiningDays: number;
    efficiencyFloor: number;
    repairCostLamports: number;
  };
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
  /**
   * System 2 (additive): GET /api/world now also returns the live weather fronts
   * and the published per-biome weather effect table. Both optional so the
   * client tolerates an older server / the socket-only world:update payload.
   */
  fronts?: WeatherFront[];
  weatherTable?: WeatherTable;
  /**
   * System 3 (additive): GET /api/world now also returns the live rich veins and
   * the published hazard odds table. Both optional so an older server / the
   * socket-only world:update payload is tolerated.
   */
  veins?: Vein[];
  hazardTable?: HazardTable;
}

// ---------------------------------------------------------------------------
// Weather events (System 2 — regional, telegraphed weather fronts)
// ---------------------------------------------------------------------------

/** The four kinds of drifting weather front the server can spawn. */
export type WeatherFrontType = 'rain' | 'dust' | 'snow' | 'ember';

/** A fractional axial hex coordinate (fronts move continuously across the map). */
export interface FractionalHex {
  q: number;
  r: number;
}

/**
 * A single drifting weather cell. The server broadcasts the CURRENT `center`
 * every ~5s, but the client extrapolates position between updates using
 * `origin + velocity*(t - spawnedAt)` for smooth motion + telegraphing.
 *
 * Pinned interface (server codes against this):
 *  - center:   current cell center (fractional axial), authoritative each tick.
 *  - origin:   the cell center at `spawnedAt` (anchor for extrapolation).
 *  - velocity: drift in hexes/MINUTE (axial q,r components).
 *  - radius:   coverage radius in hex distance units.
 *  - spawnedAt / expiresAt: epoch ms lifetime bounds (fade in/out at edges).
 */
export interface WeatherFront {
  id: string;
  type: WeatherFrontType;
  center: FractionalHex;
  origin: FractionalHex;
  /** hexes per minute */
  velocity: FractionalHex;
  radius: number;
  spawnedAt: number;
  expiresAt: number;
}

/**
 * Published per-biome yield multipliers for each front type. Shape is
 * intentionally permissive: the server owns the exact contents (biome keys are
 * upper-case biome names, plus an optional `default`) and the HUD renders
 * whatever rows are present. Example (pinned defaults):
 *   rain  { MARSH:1.15, GRASSLAND:1.15, ROCKY:0.9 }
 *   dust  { PLAINS:0.8 }
 *   snow  { ALPINE:1.2, FOREST:0.9 }
 *   ember { default:1.5 }
 */
export type WeatherBiomeEffects = Partial<Record<string, number>>;

export type WeatherTable = Partial<Record<WeatherFrontType, WeatherBiomeEffects>>;

/** Broadcast every ~5s (public, no auth). Full replacement set of live fronts. */
export interface WeatherUpdateEvent {
  fronts: WeatherFront[];
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
  /**
   * Emitted after a player-initiated relocation lands (System 2). Mirrors
   * agent:placed but carries the relocation cooldown anchor so the client can
   * derive the MOVE-button countdown without a refetch.
   */
  'agent:relocated': (data: {
    agentId: string;
    hexId: number;
    hexQ: number;
    hexR: number;
    lastRelocatedAt?: number;
  }) => void;

  // Admin
  'admin:metrics': (data: PlatformMetrics) => void;

  // World clock (public broadcast, every ~5s)
  'world:update': (data: WorldUpdateEvent) => void;

  // Weather fronts (System 2 — public broadcast, every ~5s)
  'weather:update': (data: WeatherUpdateEvent) => void;

  // Hazards (System 3)
  /** Owner room: an agent got trapped by a cave-in. */
  'agent:trapped': (data: AgentTrappedEvent) => void;
  /** Owner room: an agent was freed (rescue or self-dig). */
  'agent:rescued': (data: AgentRescuedEvent) => void;
  /** Broadcast: a hex struck a temporary ×N rich vein. */
  'vein:spawned': (data: VeinSpawnedEvent) => void;
  /** Broadcast: a rich vein reverted. */
  'vein:expired': (data: VeinExpiredEvent) => void;
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
