// Mining update sent to user's agents
export interface AgentUpdate {
  id: string;
  hexId: number;
  resources: {
    gold: string;   // BigInt as string for JSON
    silver: string;
    copper: string;
    iron: string;
  };
  status: 'MINING' | 'RELOCATING' | 'IDLE';
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
  'agent:arrived': (data: { agentId: string; hexId: number }) => void;
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
