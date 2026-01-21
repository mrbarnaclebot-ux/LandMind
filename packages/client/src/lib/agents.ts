/**
 * Agent API functions
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Agent {
  id: string;
  hexId: number | null;
  status: 'IDLE' | 'MINING' | 'RELOCATING';
  deployedAt: string;
  agentIndex: number | null;
  mintAddress: string | null;
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
  transaction: string; // base64 serialized
  treasuryAddress: string;
  cost: number;
  blockhash: string;
  lastValidBlockHeight: number;
  warning?: string;
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
  console.log('[fetchUserAgents] Fetching agents from API...');
  const response = await fetch(`${API_BASE_URL}/api/agents`, {
    credentials: 'include',
  });

  if (!response.ok) {
    console.error('[fetchUserAgents] API error:', response.status, response.statusText);
    throw new Error('Failed to fetch agents');
  }

  const data = await response.json();
  console.log('[fetchUserAgents] Raw API response:', data);

  // Map server response to client Agent type
  const mapped = data.agents.map((agent: any) => ({
    id: agent.id,
    hexId: agent.hexId,
    status: agent.status,
    deployedAt: agent.deployedAt,
    agentIndex: agent.agentIndex,
    mintAddress: agent.mintAddress,
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

  console.log('[fetchUserAgents] Mapped agents:', mapped);
  return mapped;
}

/**
 * Request deployment transaction from server
 */
export async function requestDeployTransaction(): Promise<DeployTransactionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/agents/deploy`, {
    method: 'POST',
    credentials: 'include',
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
  const response = await fetch(`${API_BASE_URL}/api/agents/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to confirm deployment');
  }

  return response.json();
}
