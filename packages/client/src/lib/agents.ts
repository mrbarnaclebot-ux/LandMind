/**
 * Agent API functions
 */
import { API_URL } from './config';
import { apiFetch } from './apiFetch';

export interface Agent {
  id: string;
  hexId: number | null;
  status: 'IDLE' | 'MINING' | 'RELOCATING';
  deployedAt: string;
  agentIndex: number | null;
  mintAddress: string | null;
  /** Epoch ms of the agent's last player-initiated relocation (System 2). */
  lastRelocatedAt?: number | null;
  miningState?: {
    gold: string;
    silver: string;
    copper: string;
    iron: string;
  };
  hex?: {
    q: number;
    r: number;
    resourceType: string;
  };
}

export interface DeployTransactionResponse {
  transaction?: string; // base64 serialized (real path only)
  treasuryAddress?: string;
  cost: number;
  blockhash?: string;
  lastValidBlockHeight?: number;
  warning?: string;
  // Fake-SOL test mode: server skips building a real tx and returns a fake sig.
  fake?: boolean;
  deployTxSig?: string;
}

export interface ConfirmResponse {
  success: boolean;
  agent: {
    id: string;
    agentIndex: number;
    mintAddress: string | null;
    mintPending?: boolean;
    hexId?: number | null;
    hexQ?: number | null;
    hexR?: number | null;
  };
  warning?: string;
}

/**
 * Fetch user's agents from server
 */
export async function fetchUserAgents(): Promise<Agent[]> {
  const response = await apiFetch(`${API_URL}/api/agents`);

  if (!response.ok) {
    console.error('[fetchUserAgents] API error:', response.status, response.statusText);
    throw new Error('Failed to fetch agents');
  }

  const data = await response.json();

  // Map server response to client Agent type
  const mapped = data.agents.map((agent: any) => ({
    id: agent.id,
    hexId: agent.hexId,
    status: agent.status,
    deployedAt: agent.deployedAt,
    agentIndex: agent.agentIndex,
    mintAddress: agent.mintAddress,
    lastRelocatedAt:
      agent.lastRelocatedAt != null ? Number(new Date(agent.lastRelocatedAt).getTime()) : null,
    // Map miningState - convert BigInt strings to strings
    miningState: agent.miningState ? {
      gold: String(agent.miningState.gold || '0'),
      silver: String(agent.miningState.silver || '0'),
      copper: String(agent.miningState.copper || '0'),
      iron: String(agent.miningState.iron || '0'),
    } : undefined,
    // Map hex relation
    hex: agent.hex ? {
      q: agent.hex.q,
      r: agent.hex.r,
      resourceType: agent.hex.resourceType,
    } : undefined,
  }));

  return mapped;
}

/**
 * Request deployment transaction from server
 */
export async function requestDeployTransaction(): Promise<DeployTransactionResponse> {
  const response = await apiFetch(`${API_URL}/api/agents/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create deployment');
  }

  return response.json();
}

/**
 * Confirm deployment after transaction sent
 */
export async function confirmDeployment(signature: string): Promise<ConfirmResponse> {
  const response = await apiFetch(`${API_URL}/api/agents/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to confirm deployment');
  }

  return response.json();
}

/**
 * Result of a relocation request. On success the server returns the updated
 * agent; the client maps the fields it cares about (hex + cooldown anchor).
 */
export interface RelocateResult {
  agent: Agent;
}

/**
 * Error thrown by `relocateAgent` on a non-2xx response. Carries the parsed
 * server error and, for the 429 cooldown case, `retryAfterMs` so the UI can show
 * a live countdown without a refetch.
 */
export class RelocateError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'RelocateError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * POST /api/agents/:id/relocate {q,r}. Resolves to the updated agent on 200,
 * throws RelocateError on 400 / 403 / cooldown (429). The 10-minute per-agent
 * cooldown is enforced server-side; the response/agent may carry lastRelocatedAt.
 */
export async function relocateAgent(
  agentId: string,
  q: number,
  r: number,
): Promise<RelocateResult> {
  const response = await apiFetch(`${API_URL}/api/agents/${agentId}/relocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, r }),
  });

  if (!response.ok) {
    let body: any = {};
    try {
      body = await response.json();
    } catch {
      // no JSON body — fall through with generic message
    }
    const retryAfterMs =
      typeof body.retryAfterMs === 'number' ? body.retryAfterMs : undefined;
    const message =
      body.error || body.message || `Relocation failed (${response.status})`;
    throw new RelocateError(message, response.status, retryAfterMs);
  }

  const data = await response.json();
  const raw = data.agent ?? data;
  const agent: Agent = {
    id: raw.id,
    hexId: raw.hexId ?? null,
    status: raw.status ?? 'MINING',
    deployedAt: raw.deployedAt ?? new Date().toISOString(),
    agentIndex: raw.agentIndex ?? null,
    mintAddress: raw.mintAddress ?? null,
    lastRelocatedAt:
      raw.lastRelocatedAt != null ? new Date(raw.lastRelocatedAt).getTime() : Date.now(),
    miningState: raw.miningState
      ? {
          gold: String(raw.miningState.gold || '0'),
          silver: String(raw.miningState.silver || '0'),
          copper: String(raw.miningState.copper || '0'),
          iron: String(raw.miningState.iron || '0'),
        }
      : undefined,
    hex:
      raw.hex
        ? { q: raw.hex.q, r: raw.hex.r, resourceType: raw.hex.resourceType }
        : raw.hexQ != null && raw.hexR != null
          ? { q: raw.hexQ, r: raw.hexR, resourceType: 'GOLD' }
          : undefined,
  };
  return { agent };
}

/**
 * Assemble a client-side Agent object from a successful deploy confirmation.
 *
 * Lives next to confirmDeployment so the deploy hook stays a thin composition.
 * NOTE: resourceType is hardcoded to 'GOLD' pending a server data-model change
 * that returns the real resource type; the value is corrected via socket update.
 */
export function buildDeployedAgent(confirm: ConfirmResponse): Agent {
  const { agent } = confirm;
  return {
    id: agent.id,
    hexId: agent.hexId ?? null,
    status: agent.hexId ? 'MINING' : 'IDLE',
    deployedAt: new Date().toISOString(),
    agentIndex: agent.agentIndex,
    mintAddress: agent.mintAddress,
    hex:
      agent.hexQ != null && agent.hexR != null
        ? {
            q: agent.hexQ,
            r: agent.hexR,
            resourceType: 'GOLD', // Corrected via socket mining update
          }
        : undefined,
  };
}
